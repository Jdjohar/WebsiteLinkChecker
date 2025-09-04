// crawler.js
const axios = require('axios');
const cheerio = require('cheerio');
const robotsParser = require('robots-parser');
const { URL } = require('url');
const { XMLParser } = require('fast-xml-parser');
const puppeteer = require('puppeteer');

// ----- p-limit compatibility (works for most setups) -----
let pLimit;
try {
  // For ESM builds published as default export
  pLimit = require('p-limit').default;
} catch {
  // Older CJS versions export the function directly
  pLimit = require('p-limit');
}
const limit = pLimit(10);
// --------------------------------------------------------

const MAX_URLS = 5000;
const DEBUG_PUPPETEER = false; // set true only when you really want screenshots/logs

const axiosInstance = axios.create({
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
  },
  timeout: 15000,
  maxRedirects: 5,
});

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.href;
  } catch (error) {
    // Keep quiet on noisy pages; log once per run is fine if you prefer
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
    // Default allow-all
    return robotsParser('', 'User-agent: *\nAllow: /');
  }
}

async function fetchSitemap(sitemapUrl) {
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
          const sub = await fetchSitemap(sitemap.loc);
          urls.push(...sub);
        }
      }
    }
    if (parsed.urlset?.url) {
      const list = Array.isArray(parsed.urlset.url)
        ? parsed.urlset.url
        : [parsed.urlset.url];
      for (const u of list) {
        const n = normalizeUrl(u.loc);
        if (n) urls.push(n);
      }
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
    browser = await puppeteer.launch({
      headless: !DEBUG_PUPPETEER,
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36'
    );

    // Interception BEFORE navigation to catch XHRs
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      request.continue();
    });

    await page.goto(blogUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    const links = new Set();
    let previousBlogCount = 0;
    let attemptCount = 0;
    const maxAttempts = 15;

    if (DEBUG_PUPPETEER) {
      await page.screenshot({ path: `blog_initial_${Date.now()}.png` });
      console.log(`📸 Initial screenshot saved`);
    }

    while (attemptCount < maxAttempts) {
      // Extract likely blog links
      const blogElements = await page.$$eval(
        'article, .post, .blog-post, .blog-item, .entry, .post-item, .wp-block-post',
        (elements) =>
          elements
            .map((el) => {
              const a = el.querySelector('a[href]');
              return a ? a.getAttribute('href') : null;
            })
            .filter(Boolean)
      );

      blogElements.forEach((link) => {
        try {
          const absolute = normalizeUrl(new URL(link, blogUrl).href);
          if (absolute && absolute.startsWith(base)) links.add(absolute);
        } catch {}
      });

      const currentCount = links.size;
      console.log(`📄 Attempt ${attemptCount + 1}: Found ${currentCount} blog links`);

      if (currentCount === previousBlogCount && attemptCount > 0) {
        console.log(`ℹ️ No new blogs loaded on ${blogUrl}. Stopping.`);
        break;
      }
      previousBlogCount = currentCount;

      // Try a generic "Load more" button
      const loadMoreButton = await page.$(
        '#loadMore, .btn.btn-primary.mt-4, button.load-more, .load-more, [data-load-more]'
      );
      if (!loadMoreButton) {
        console.log(`ℹ️ No Load More button found on ${blogUrl}`);
        break;
      }

      if (DEBUG_PUPPETEER) {
        await page.screenshot({ path: `blog_before_click_${attemptCount}_${Date.now()}.png` });
      }

      await page.evaluate((el) => {
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
        el.click();
      }, loadMoreButton);

      // Give UI time to render; then wait for quiet network
      await page.waitForTimeout(1500);
      // Puppeteer v20+: waitForNetworkIdle accepts {idleTime, timeout}
      await page.waitForNetworkIdle({ idleTime: 1000, timeout: 30000 }).catch(() => {});

      if (DEBUG_PUPPETEER) {
        await page.screenshot({ path: `blog_after_click_${attemptCount}_${Date.now()}.png` });
      }

      attemptCount++;
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

// Heuristic: which links are “page-like” and worth crawling deeper?
const PAGE_EXT_RE = /\.(html?|php|aspx?)$/i;
const ASSET_EXT_RE = /\.(?:png|jpe?g|gif|webp|svg|ico|css|js|mjs|pdf|zip|rar|7z|woff2?|ttf|eot|mp4|mp3|webm|ogg|json)$/i;
function looksLikePageUrl(href) {
  if (!href) return false;
  if (ASSET_EXT_RE.test(href)) return false;
  // Allow clean URLs (/about, /products/abc), pages with extensions, or trailing slash
  return PAGE_EXT_RE.test(href) || /\/$/.test(href) || !/\.[a-z0-9]{2,5}$/i.test(href);
}

async function scanLinks(startUrl, schedule, options = {}) {
  startUrl = startUrl.replace(/^http:/, 'https:');
  const { maxDepth = 2, maxUrls = MAX_URLS, blogPageUrl } = options;
  console.log(`🔍 Starting scan for ${startUrl}, schedule: ${schedule}, maxDepth: ${maxDepth}`);

  const startNormalized = normalizeUrl(startUrl);
  if (!startNormalized) throw new Error(`Invalid startUrl: ${startUrl}`);

  const toVisit = [{ url: startNormalized, depth: 0 }];
  const statusMap = new Map(); // url -> { url, status, source, text? }
  const checkedUrls = new Set(); // resources already probed
  const visitedUrls = new Set(); // pages already crawled
  const base = new URL(startNormalized).origin;
  const robots = await fetchRobotsTxt(base);

  // ---- SITEMAP ----
  const sitemapUrls = [`${base}/sitemap.xml`, `${base}/sitemap_index.xml`];
  for (const sitemapUrl of sitemapUrls) {
    const sitemapLinks = await fetchSitemap(sitemapUrl);
    if (sitemapLinks.length > 0) {
      console.log(`📄 Found ${sitemapLinks.length} URLs in sitemap for ${startUrl}`);
      for (const s of sitemapLinks) {
        const n = normalizeUrl(s);
        if (n && !visitedUrls.has(n)) {
          toVisit.push({ url: n, depth: 0 });
        }
      }
      break; // stop after first non-empty sitemap
    }
  }

  // ---- BLOG PAGE (optional) ----
  if (blogPageUrl) {
    let finalBlogPageUrl = blogPageUrl;
    try {
      console.log(`📖 Trying blog page: ${blogPageUrl}`);
      await axiosInstance.head(blogPageUrl, { validateStatus: null });
    } catch (err) {
      finalBlogPageUrl = `${base}/blogs/`;
      console.warn(
        `⚠️ ${blogPageUrl} failed: ${err.message}. Trying fallback: ${finalBlogPageUrl}`
      );
      try {
        await axiosInstance.head(finalBlogPageUrl, { validateStatus: null });
      } catch (fallbackErr) {
        console.error(
          `❌ Both /blog/ and /blogs/ failed: ${fallbackErr.message}. Skipping blog scan.`
        );
        finalBlogPageUrl = null;
      }
    }

    if (finalBlogPageUrl) {
      console.log(`📖 Scanning blog page: ${finalBlogPageUrl}`);
      const blogLinks = await fetchBlogLinksWithPuppeteer(finalBlogPageUrl, base);
      for (const link of blogLinks) {
        const n = normalizeUrl(link);
        if (n && !visitedUrls.has(n)) {
          toVisit.push({ url: n, depth: 0 });
        }
      }
    }
  }

  // ---- CRAWL ----
  while (toVisit.length > 0 && checkedUrls.size < maxUrls) {
    const { url, depth } = toVisit.shift();
    if (!url) continue;
    if (visitedUrls.has(url)) continue;
    if (maxDepth !== Infinity && depth > maxDepth) {
      console.log(`⏭️ Skipping ${url}: max depth`);
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
      statusMap.set(url, { url, status: response.status, source: 'crawl' });

      if (response.status >= 200 && response.status < 300) {
        const html = response.data;
        const $ = cheerio.load(html);
        const resourceLinks = [];

        // Collect links + anchor text (for <a>)
        $('a[href], link[href], script[src], img[src], source[src], video[src], audio[src], iframe[src]').each(
          (_, el) => {
            const href = $(el).attr('href') || $(el).attr('src');
            if (!href) return;
            const text = $(el).is('a') ? $(el).text().trim() : '';
            try {
              const abs = new URL(href, url).href;
              resourceLinks.push({ url: abs, text });
            } catch {}
          }
        );

        // Meta refresh → url=
        $('meta[http-equiv="refresh"]').each((_, el) => {
          const content = $(el).attr('content');
          if (!content) return;
          const match = content.match(/url=(.+)/i);
          if (match) {
            try {
              const abs = new URL(match[1], url).href;
              resourceLinks.push({ url: abs, text: '' });
            } catch {}
          }
        });

        // JSON-LD: extract any http(s) strings
        $('script[type="application/ld+json"]').each((_, el) => {
          try {
            const json = JSON.parse($(el).html() || '{}');
            const collect = (obj) => {
              if (typeof obj === 'string' && /^https?:\/\//i.test(obj)) {
                resourceLinks.push({ url: obj, text: '' });
              } else if (obj && typeof obj === 'object') {
                Object.values(obj).forEach(collect);
              }
            };
            collect(json);
          } catch {}
        });

        // Check every resource (internal + external)
        await Promise.allSettled(
          resourceLinks.map(({ url: link, text }) =>
            limit(async () => {
              const absolute = normalizeUrl(link);
              if (!absolute) return;
              if (checkedUrls.has(absolute)) return;
              checkedUrls.add(absolute);

              // Internal page-like links → crawl deeper
              if (absolute.startsWith(base) && looksLikePageUrl(absolute) && !visitedUrls.has(absolute)) {
                toVisit.push({ url: absolute, depth: depth + 1 });
                console.log(`➡️ Added to crawl queue: ${absolute}`);
              }

              // Status check (both internal + external)
              // Retry up to 3 times on network errors
              let recorded = false;
              for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                  console.log(`🔗 Checking ${absolute} (attempt ${attempt})`);
                  const res = await axiosInstance.get(absolute, { validateStatus: null });
                  if (!statusMap.has(absolute)) {
                    statusMap.set(absolute, { url: absolute, status: res.status, source: url, text });
                    console.log(`ℹ️ Status for ${absolute}: ${res.status} ${text ? `| Text: ${text}` : ''}`);
                  }
                  recorded = true;
                  break;
                } catch (error) {
                  if (attempt === 3) {
                    statusMap.set(absolute, { url: absolute, status: 'Failed', source: url, text });
                    console.error(`❌ Failed to check ${absolute}: ${error.message}`);
                    recorded = true;
                  }
                }
              }
              if (!recorded) {
                // Fallback just in case
                statusMap.set(absolute, { url: absolute, status: 'Failed', source: url, text });
              }
            })
          )
        );
      }
    } catch (err) {
      statusMap.set(url, { url, status: 'Failed', source: 'crawl' });
      console.error(`❌ Failed to fetch ${url}: ${err.message}`);
    }
  }

  // ---- RESULT ----
  const allStatuses = Array.from(statusMap.values());

  const brokenLinks = allStatuses.filter(
    (item) =>
      item.status === 'Failed' ||
      (typeof item.status === 'number' && item.status >= 400)
  );

  const result = {
  brokenLinks: Array.from(statusMap.values()).filter(
    item => typeof item.status === "number" && [400, 404].includes(item.status)
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

// Load dotenv in dev only (optional)
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch {}
}
