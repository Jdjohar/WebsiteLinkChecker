const axios = require('axios');
const cheerio = require('cheerio');
const robotsParser = require('robots-parser');
const pLimit = require('p-limit').default;
const { URL } = require('url');

const limit = pLimit(5);
const visitedUrls = new Set();

const axiosInstance = axios.create({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36'
  },
  timeout: 10000,
  maxRedirects: 5
});

function normalizeUrl(url) {
  try {
    const normalized = new URL(url);
    normalized.hash = '';
    return normalized.href;
  } catch (error) {
    console.error(`❌ normalizeUrl failed for ${url}: ${error.message}`);
    return null;
  }
}

async function fetchRobotsTxt(baseUrl) {
  try {
    const robotsUrl = new URL('/robots.txt', baseUrl).href;
    const res = await axiosInstance.get(robotsUrl);
    console.log(`🤖 Fetched robots.txt for ${baseUrl}`);
    return robotsParser(robotsUrl, res.data);
  } catch (error) {
    console.warn(`⚠️ Failed to fetch robots.txt for ${baseUrl}: ${error.message}`);
    return robotsParser('', 'User-agent: *\nDisallow:');
  }
}

async function scanLinks(startUrl, schedule) {
  startUrl = startUrl.replace(/^http:/, 'https:');
  console.log(`🔍 Starting scan for ${startUrl}, schedule: ${schedule}`);

  const toVisit = [{ url: normalizeUrl(startUrl), depth: 0 }];
  const brokenLinksMap = new Map();
  const checkedUrls = new Set();

  const base = new URL(startUrl).origin;
  const robots = await fetchRobotsTxt(base);

  if (!robots.isAllowed(startUrl, '*')) {
    console.warn(`🚫 ${startUrl} blocked by robots.txt`);
    return {
      brokenLinks: [],
      checkedUrls: [],
    };
  }

  while (toVisit.length > 0) {
    const { url, depth } = toVisit.shift();
    if (!url || visitedUrls.has(url) || depth > 3) {
      console.log(`⏭️ Skipping ${url}: ${!url ? 'invalid' : visitedUrls.has(url) ? 'visited' : 'max depth'}`);
      continue;
    }
    visitedUrls.add(url);

    try {
      console.log(`🌐 Fetching ${url}`);
      const response = await axiosInstance.get(url);
      const html = response.data;
      const $ = cheerio.load(html);

      const resourceLinks = [];

      // Extract various types of resource links
      $('a[href]').each((_, el) => resourceLinks.push($(el).attr('href')));
      $('link[rel="stylesheet"]').each((_, el) => resourceLinks.push($(el).attr('href')));
      $('script[src]').each((_, el) => resourceLinks.push($(el).attr('src')));
      $('img[src]').each((_, el) => resourceLinks.push($(el).attr('src')));
      $('source[src], video[src], audio[src], iframe[src]').each((_, el) => resourceLinks.push($(el).attr('src')));

      const checkPromises = resourceLinks.map(link => limit(async () => {
        const absolute = normalizeUrl(new URL(link, url).href);
        if (!absolute || checkedUrls.has(absolute)) {
          console.log(`⏭️ Skipping resource ${absolute}: ${!absolute ? 'invalid' : 'already checked'}`);
          return;
        }
        if (!absolute.startsWith(base)) {
          console.log(`⏭️ Skipping external resource ${absolute}`);
          return;
        }

        checkedUrls.add(absolute);

        // Follow internal HTML pages for crawling
        if (!visitedUrls.has(absolute) && absolute.endsWith('/')) {
          toVisit.push({ url: absolute, depth: depth + 1 });
          console.log(`➡️ Added to crawl queue: ${absolute}`);
        }

        try {
          console.log(`🔗 Checking resource ${absolute}`);
          const res = await axiosInstance.get(absolute, { validateStatus: null });
          if (res.status >= 400) {
            if (!brokenLinksMap.has(absolute)) {
              brokenLinksMap.set(absolute, { url: absolute, status: res.status, source: url });
              console.log(`❌ Broken link found: ${absolute} (status: ${res.status})`);
            }
          }
        } catch (error) {
          if (!brokenLinksMap.has(absolute)) {
            brokenLinksMap.set(absolute, { url: absolute, status: 'Failed', source: url });
            console.error(`❌ Failed to check ${absolute}: ${error.message}`);
          }
        }
      }));

      await Promise.allSettled(checkPromises);
    } catch (err) {
      console.error(`❌ Failed to fetch ${url}: ${err.message}`);
      brokenLinksMap.set(url, { url, status: 'Failed', source: startUrl });
    }
  }

  const result = {
    brokenLinks: Array.from(brokenLinksMap.values()),
    checkedUrls: Array.from(checkedUrls),
  };

  console.log(`🏁 Scan completed for ${startUrl}: ${result.checkedUrls.length} URLs checked, ${result.brokenLinks.length} broken links found`);

  return result;
}

module.exports = { scanLinks };