const axios = require('axios');
const cheerio = require('cheerio');
const robotsParser = require('robots-parser');
const pLimit = require('p-limit').default;
const { URL } = require('url');

const limit = pLimit(10);
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
  } catch {
    return null;
  }
}

async function fetchRobotsTxt(baseUrl) {
  try {
    const robotsUrl = new URL('/robots.txt', baseUrl).href;
    const res = await axiosInstance.get(robotsUrl);
    return robotsParser(robotsUrl, res.data);
  } catch {
    return robotsParser('', 'User-agent: *\nDisallow:');
  }
}

async function scanLinks(startUrl, maxDepth = 3) {

  startUrl = startUrl.replace(/^http:/, 'https:');
  console.log(startUrl,"startUrl");
  

  const toVisit = [{ url: normalizeUrl(startUrl), depth: 0 }];
  const brokenLinksMap = new Map();
  const checkedUrls = new Set();

  const base = new URL(startUrl).origin;
  const robots = await fetchRobotsTxt(base);

  while (toVisit.length > 0) {
    const { url, depth } = toVisit.shift();
    if (!url || visitedUrls.has(url) || depth > maxDepth) continue;
    visitedUrls.add(url);

    if (!robots.isAllowed(url, '*')) {
      console.log('Blocked by robots.txt:', url);
      continue;
    }

    try {
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
        if (!absolute || checkedUrls.has(absolute)) return;
        if (!absolute.startsWith(base)) return;

        checkedUrls.add(absolute);

        // Follow internal HTML pages for crawling
        if (!visitedUrls.has(absolute) && absolute.endsWith('/')) {
          toVisit.push({ url: absolute, depth: depth + 1 });
        }

        try {
          const res = await axiosInstance.get(absolute, { validateStatus: null });
          if (res.status >= 400) {
            if (!brokenLinksMap.has(absolute)) {
              brokenLinksMap.set(absolute, { url: absolute, status: res.status, source: url });
            }
          }
        } catch {
          if (!brokenLinksMap.has(absolute)) {
            brokenLinksMap.set(absolute, { url: absolute, status: 'Failed', source: url });
          }
        }
      }));

      await Promise.allSettled(checkPromises);
    } catch (err) {
      console.log('Failed to fetch:', url, err.message);
    }
  }

  return {
    brokenLinks: Array.from(brokenLinksMap.values()),
    checkedUrls: Array.from(checkedUrls),
  };
}

module.exports = { scanLinks };



// const axios = require('axios');
// const cheerio = require('cheerio');

// async function scanLinks(url, schedule) {
//   console.log('Starting scan for URL:', url); // Debug log
//   try {
//     const response = await axios.get(url, { timeout: 10000 }); // 10-second timeout
//     const html = response.data;
//     const $ = cheerio.load(html);
//     const links = $('a[href]').map((i, link) => $(link).attr('href')).get();
//     const brokenLinks = [];
//     const checkedUrls = [];

//     for (const link of links.slice(0, 50)) { // Limit to 50 links to avoid overload
//       try {
//         const fullUrl = new URL(link, url).href;
//         const linkResponse = await axios.head(fullUrl, { timeout: 5000 }); // 5-second timeout
//         if (linkResponse.status >= 400) {
//           brokenLinks.push({ url: fullUrl, status: linkResponse.status, source: url });
//         }
//         checkedUrls.push(fullUrl);
//       } catch (error) {
//         console.log('Link check error for', link, ':', error.message); // Debug log
//         brokenLinks.push({ url: link, status: 'Failed', source: url });
//         checkedUrls.push(link);
//       }
//     }

//     console.log('Scan completed for', url, 'with', brokenLinks.length, 'broken links'); // Debug log
//     return { brokenLinks, checkedUrls };
//   } catch (error) {
//     console.error('Scan failed for', url, ':', error.message); // Log scan failure
//     return { brokenLinks: [], checkedUrls: [] };
//   }
// }

// module.exports = { scanLinks };