const puppeteer = require('puppeteer');
const axios = require('axios');
const robotsParser = require('robots-parser');
const pLimit = require('p-limit').default;
const { URL } = require('url');

const limit = pLimit(5);
const visitedUrls = new Set();
const checkedUrls = new Set();

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

  console.log("StartLink From Puppeteer");
  
  startUrl = startUrl.replace(/^http:/, 'https:');
  console.log(`🔍 Starting scan for ${startUrl}, schedule: ${schedule}`);

  const toVisit = [{ url: normalizeUrl(startUrl), depth: 0 }];
  const brokenLinksMap = new Map();

  const base = new URL(startUrl).origin;
  const robots = await fetchRobotsTxt(base);

  if (!robots.isAllowed(startUrl, '*')) {
    console.warn(`🚫 ${startUrl} blocked by robots.txt`);
    return {
      brokenLinks: [],
      checkedUrls: []
    };
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    while (toVisit.length > 0) {
      const { url, depth } = toVisit.shift();
      if (!url || visitedUrls.has(url)) {
        console.log(`⏭️ Skipping ${url}: ${!url ? 'invalid' : 'visited'}`);
        continue;
      }
      visitedUrls.add(url);

      const page = await browser.newPage();
      try {
        console.log(`🌐 Navigating to ${url}`);
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Extract resource links using Puppeteer
        const resourceLinks = await page.evaluate(() => {
          const links = [];

          // Helper to add non-empty attributes to links array
          const addIfValid = (elements, attr) => {
            elements.forEach(el => {
              const value = el.getAttribute(attr);
              if (value && value.trim() !== '') links.push(value);
            });
          };

          addIfValid(document.querySelectorAll('a[href]'), 'href');
          addIfValid(document.querySelectorAll('link[rel="stylesheet"]'), 'href');
          addIfValid(document.querySelectorAll('script[src]'), 'src');
          addIfValid(document.querySelectorAll('img[src]'), 'src');
          addIfValid(document.querySelectorAll('source[src]'), 'src');
          addIfValid(document.querySelectorAll('video[src]'), 'src');
          addIfValid(document.querySelectorAll('audio[src]'), 'src');
          addIfValid(document.querySelectorAll('iframe[src]'), 'src');

          return links;
        });

        const checkPromises = resourceLinks.map(link => limit(async () => {
          if (!link || link.trim() === '') {
            console.log(`⏭️ Skipping invalid link: ${link}`);
            return;
          }

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

          // Add to crawl queue if it's an HTML page (likely a WordPress page)
          if (!visitedUrls.has(absolute) && link.match(/\.(html|php)?($|\?|#)/i)) {
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
        console.error(`❌ Failed to navigate ${url}: ${err.message}`);
        brokenLinksMap.set(url, { url, status: 'Failed', source: startUrl });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  const result = {
    brokenLinks: Array.from(brokenLinksMap.values()),
    checkedUrls: Array.from(checkedUrls)
  };

  console.log(`🏁 Scan completed for ${startUrl}: ${result.checkedUrls.length} URLs checked, ${result.brokenLinks.length} broken links found PuppeteerScanner`);

  return result;
}

module.exports = { scanLinks };