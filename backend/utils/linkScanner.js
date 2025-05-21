const axios = require('axios');
const cheerio = require('cheerio');
const robotsParser = require('robots-parser');
const pLimit = require('p-limit').default;
const { URL } = require('url');
const { XMLParser } = require('fast-xml-parser');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;

const limit = pLimit(10);
const MAX_URLS = 5000;

const axiosInstance = axios.create({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
  },
  timeout: 15000,
  maxRedirects: 5,
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
    return robotsParser('', 'User-agent: *\nAllow: /');
  }
}

async function fetchSitemap(sitemapUrl, baseUrl) {
  try {
    const response = await axiosInstance.get(sitemapUrl, { timeout: 15000 });
    const parser = new XMLParser();
    const parsed = parser.parse(response.data);
    const urls = [];

    if (parsed.sitemapindex?.sitemap) {
      const sitemaps = Array.isArray(parsed.sitemapindex.sitemap)
        ? parsed.sitemapindex.sitemap
        : [parsed.sitemapindex.sitemap];
      for (const sitemap of sitemaps) {
        if (sitemap.loc) {
          const subSitemapUrls = await fetchSitemap(sitemap.loc, baseUrl);
          urls.push(...subSitemapUrls);
        }
      }
    }
    if (parsed.urlset?.url) {
      const sitemapUrls = Array.isArray(parsed.urlset.url)
        ? parsed.urlset.url
        : [parsed.urlset.url];
      urls.push(...sitemapUrls.map(u => u.loc).filter(u => normalizeUrl(u)));
    }
    return urls.slice(0, MAX_URLS);
  } catch (error) {
    console.error(`❌ Error fetching sitemap ${sitemapUrl}: ${error.message}`);
    return [];
  }
}

async function fetchBlogLinksWithPuppeteer(blogUrl, base) {
  let browser;
  try {
    browser = await puppeteer.launch({ headless: false }); // Non-headless for debugging
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36');
    await page.goto(blogUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Monitor AJAX requests
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.url().includes('wp-json') || request.url().includes('ajax')) {
        console.log(`🌐 AJAX request: ${request.url()}`);
      }
      request.continue();
    });

    const links = new Set();
    let previousBlogCount = 0;
    let attemptCount = 0;
    const maxAttempts = 15; // Covers ~11 clicks for 64 blogs

    // Initial screenshot
    await page.screenshot({ path: `blog_initial_${Date.now()}.png` });
    console.log(`📸 Initial screenshot saved`);

    while (attemptCount < maxAttempts) {
      // Extract blog links
      const blogElements = await page.$$eval(
        'article, .post, .blog-post, .blog-item, .entry, .post-item, .wp-block-post',
        elements => elements.map(el => {
          const link = el.querySelector('a[href]');
          return link ? link.getAttribute('href') : null;
        }).filter(href => href)
      );

      blogElements.forEach(link => {
        const absolute = normalizeUrl(new URL(link, blogUrl).href);
        if (absolute && absolute.startsWith(base)) links.add(absolute);
      });

      const currentBlogCount = links.size;
      console.log(`📄 Attempt ${attemptCount + 1}: Found ${currentBlogCount} blog links`);

      // Stop if no new blogs
      if (currentBlogCount === previousBlogCount && attemptCount > 0) {
        console.log(`ℹ️ No new blogs loaded on ${blogUrl}. Stopping.`);
        break;
      }
      previousBlogCount = currentBlogCount;

      // Find "Load More" button
      const loadMoreButton = await page.$('#loadMore, .btn.btn-primary.mt-4');
      if (loadMoreButton) {
        console.log(`🔍 Load More button found on ${blogUrl}`);
        const buttonHtml = await page.evaluate(el => el.outerHTML, loadMoreButton);
        console.log(`ℹ️ Button HTML: ${buttonHtml}`);

        // Screenshot before click
        await page.screenshot({ path: `blog_before_click_${attemptCount}_${Date.now()}.png` });

        // Simulate click with scroll and dispatch
        await page.evaluate(el => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.click();
        }, loadMoreButton);
        console.log(`🔄 Clicked Load More button (attempt ${attemptCount + 1})`);

        // Wait for content
        await page.waitForTimeout(5000); // Increased for animations
        await page.waitForNetworkIdle({ timeout: 30000 }).catch(() => {
          console.log(`ℹ️ No more network activity after clicking Load More`);
        });

        // Screenshot after click
        await page.screenshot({ path: `blog_after_click_${attemptCount}_${Date.now()}.png` });
        console.log(`📸 Screenshot saved after click ${attemptCount + 1}`);

        attemptCount++;
      } else {
        console.log(`❌ No Load More button found on ${blogUrl}`);
        break;
      }
    }

    console.log(`📄 Final: Found ${links.size} blog links on ${blogUrl}`);
    return Array.from(links);
  } catch (error) {
    console.error(`❌ Puppeteer failed for ${blogUrl}: ${error.message}`);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

async function scanLinks(startUrl, schedule, options = {}) {
  startUrl = startUrl.replace(/^http:/, 'https:');
  const { maxDepth = Infinity, maxUrls = MAX_URLS, blogPageUrl } = options;
  console.log(`🔍 Starting scan for ${startUrl}, schedule: ${schedule}, maxDepth: ${maxDepth}`);

  const toVisit = [{ url: normalizeUrl(startUrl), depth: 0 }];
  const statusMap = new Map();
  const checkedUrls = new Set();
  const visitedUrls = new Set();
  const base = new URL(startUrl).origin;
  const robots = await fetchRobotsTxt(base);

  // Fetch sitemap URLs
  const sitemapUrls = [
    `${base}/sitemap.xml`,
    `${base}/sitemap_index.xml`,
  ];
  let sitemapLinks = [];
  for (const sitemapUrl of sitemapUrls) {
    sitemapLinks = await fetchSitemap(sitemapUrl, base);
    if (sitemapLinks.length > 0) {
      console.log(`📄 Found ${sitemapLinks.length} URLs in sitemap for ${startUrl}`);
      sitemapLinks.forEach(url => {
        const normalized = normalizeUrl(url);
        if (normalized && !visitedUrls.has(normalized)) {
          toVisit.push({ url: normalized, depth: 0 });
        }
      });
      break;
    }
  }

  // Handle blog page
  let finalBlogPageUrl = blogPageUrl;
  let blogLinks = [];

  if (blogPageUrl) {
    try {
      console.log(`📖 Trying blog page: ${blogPageUrl}`);
      await axiosInstance.head(blogPageUrl);
    } catch (err) {
      finalBlogPageUrl = `${base}/blogs/`;
      console.warn(`⚠️ ${blogPageUrl} failed: ${err.message}. Trying fallback: ${finalBlogPageUrl}`);
      try {
        await axiosInstance.head(finalBlogPageUrl);
      } catch (fallbackErr) {
        console.error(`❌ Both /blog/ and /blogs/ failed: ${fallbackErr.message}. Skipping blog scan.`);
        finalBlogPageUrl = null;
      }
    }

    if (finalBlogPageUrl) {
      console.log(`📖 Scanning blog page: ${finalBlogPageUrl}`);
      blogLinks = await fetchBlogLinksWithPuppeteer(finalBlogPageUrl, base);
      blogLinks.forEach(link => {
        const normalized = normalizeUrl(link);
        if (normalized && !visitedUrls.has(normalized)) {
          toVisit.push({ url: normalized, depth: 0 });
        }
      });
    }
  }

  // Start crawling
  while (toVisit.length > 0 && checkedUrls.size < maxUrls) {
    const { url, depth } = toVisit.shift();
    if (!url || visitedUrls.has(url) || (maxDepth !== Infinity && depth > maxDepth)) {
      console.log(`⏭️ Skipping ${url}: ${!url ? 'invalid' : visitedUrls.has(url) ? 'visited' : 'max depth'}`);
      continue;
    }
    if (!robots.isAllowed(url, '*')) {
      console.warn(`🚫 ${url} blocked by robots.txt`);
      continue;
    }
    visitedUrls.add(url);

    try {
      console.log(`🌐 Fetching ${url}`);
      const response = await axiosInstance.get(url, { validateStatus: null });
      statusMap.set(url, { url, status: response.status, source: startUrl });

 // Inside the scanLinks function, replace the resourceLinks extraction block
if (response.status >= 200 && response.status < 300) {
  const html = response.data;
  const $ = cheerio.load(html);
  const resourceLinks = [];

  // Extract links with their text content
  $('a[href], link[href], script[src], img[src], source[src], video[src], audio[src], iframe[src]').each((_, el) => {
    const attr = $(el).attr('href') || $(el).attr('src');
    if (attr) {
      // For <a> tags, capture the text content
      const text = $(el).is('a') ? $(el).text().trim() : '';
      resourceLinks.push({ url: attr, text });
    }
  });
  $('meta[http-equiv="refresh"]').each((_, el) => {
    const content = $(el).attr('content');
    if (content) {
      const match = content.match(/url=(.+)/i);
      if (match) resourceLinks.push({ url: match[1], text: '' });
    }
  });
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html());
      const extractUrls = (obj) => {
        if (typeof obj === 'string' && obj.startsWith('http')) resourceLinks.push({ url: obj, text: '' });
        if (typeof obj === 'object') Object.values(obj).forEach(extractUrls);
      };
      extractUrls(json);
    } catch (e) {}
  });

  const checkPromises = resourceLinks.map(({ url: link, text }) =>
    limit(async () => {
      const absolute = normalizeUrl(new URL(link, url).href);
      if (!absolute || checkedUrls.has(absolute)) return;
      if (!absolute.startsWith(base)) return;

      checkedUrls.add(absolute);

      if (!visitedUrls.has(absolute) && (absolute.endsWith('/') || absolute.match(/\.(html|php)$/))) {
        toVisit.push({ url: absolute, depth: depth + 1 });
        console.log(`➡️ Added to crawl queue: ${absolute}`);
      }

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`🔗 Checking resource ${absolute} (attempt ${attempt})`);
          const res = await axiosInstance.get(absolute, { validateStatus: null });
          if (!statusMap.has(absolute)) {
            statusMap.set(absolute, { url: absolute, status: res.status, source: url, text });
            console.log(`ℹ️ Status for ${absolute}: ${res.status}, Text: ${text}`);
          }
          break;
        } catch (error) {
          if (attempt === 3) {
            statusMap.set(absolute, { url: absolute, status: 'Failed', source: url, text });
            console.error(`❌ Failed to check ${absolute}: ${error.message}`);
          }
        }
      }
    })
  );

  await Promise.allSettled(checkPromises);
}
    } catch (err) {
      statusMap.set(url, { url, status: 'Failed', source: startUrl });
      console.error(`❌ Failed to fetch ${url}: ${err.message}`);
    }
  }

  const result = {
    brokenLinks: Array.from(statusMap.values()).filter(
      item => typeof item.status === 'number' && item.status >= 400
    ),
    checkedUrls: Array.from(checkedUrls),
    allStatuses: Array.from(statusMap.values()),
  };

  console.log(
    `🏁 Scan completed for ${startUrl}: ${result.checkedUrls.length} URLs checked, ${result.brokenLinks.length} broken links found`
  );

  return result;
}

module.exports = { scanLinks };

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}