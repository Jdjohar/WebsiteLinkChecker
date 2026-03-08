<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> main
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
<<<<<<< HEAD

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
=======
=======
/* utils/linkScanner.js */
const axios = require('axios');
const cheerio = require('cheerio');
const robotsParser = require('robots-parser');
// const pLimit = require('p-limit').default;
const pLimit = require('p-limit');
const { URL } = require('url');
const { XMLParser } = require('fast-xml-parser');
const puppeteer = require('puppeteer'); // optional for dynamic/challenged pages
const fs = require('fs').promises;

const limit = pLimit(18);
const MAX_URLS = 15000;
>>>>>>> 78a13c7d58cf4823248334d5814d2c3a8d9298d9

// Allow walking off-domain (external links)
const CRAWL_EXTERNAL = false;

// 🚩 Toggle to ignore robots.txt entirely
const IGNORE_ROBOTS = true;

// ---- Axios instance tuned to look like a real browser ----
const axiosInstance = axios.create({
  headers: {
    'User-Agent':
<<<<<<< HEAD
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
=======
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':
      'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Upgrade-Insecure-Requests': '1',
>>>>>>> 78a13c7d58cf4823248334d5814d2c3a8d9298d9
  },
  // Give the challenge page time to finish
  timeout: 45000,
  maxRedirects: 5,
  validateStatus: () => true, // we will handle non-2xx ourselves
});

// ---- Helpers ----
const JUNK_PROTOCOLS = [
  'javascript:',
  'data:',
  'mailto:',
  'tel:',
  'sms:',
  'whatsapp:',
  'skype:',
];

function isJunkHref(href) {
  if (!href) return true;
  const h = href.trim().toLowerCase();
  if (h === '#' || h === '##' || h === '/' || h.startsWith('#')) return true;
  return JUNK_PROTOCOLS.some((p) => h.startsWith(p));
}

function looksLikeBotChallenge(html) {
  const t = (html || '').toLowerCase();
  return (
    t.includes('checking your browser') ||
    t.includes('just a moment') ||
    t.includes('attention required') ||
    t.includes('cloudflare') ||
    t.includes('sucuri')
  );
}

function normalizeUrl(u) {
  try {
<<<<<<< HEAD
>>>>>>> main
    const u = new URL(url);
    u.hash = '';
    return u.href;
  } catch (error) {
    // Keep quiet on noisy pages; log once per run is fine if you prefer
<<<<<<< HEAD
=======
=======
    const out = new URL(u);
    // normalize default ports
    if (
      (out.protocol === 'http:' && out.port === '80') ||
      (out.protocol === 'https:' && out.port === '443')
    ) {
      out.port = '';
    }
    // strip hash
    out.hash = '';
    // ensure trailing slash consistency
    if (!out.pathname) out.pathname = '/';
    return out.toString();
  } catch {
>>>>>>> 78a13c7d58cf4823248334d5814d2c3a8d9298d9
>>>>>>> main
    return null;
  }
}

<<<<<<< HEAD
async function fetchRobotsTxt(baseUrl) {
  try {
=======
function sameSite(base, url) {
  try {
<<<<<<< HEAD
>>>>>>> main
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
<<<<<<< HEAD
        }
      }
    }
=======
=======
    const a = new URL(base);
    const b = new URL(url);
    return a.hostname === b.hostname; // allow http<->https within same host
  } catch {
    return false;
  }
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(url);
}

// ---- Robots.txt with allow-all fallback (or disabled entirely) ----
async function fetchRobotsTxt(baseUrl) {
  if (IGNORE_ROBOTS) {
    // Always allow everything when ignoring robots
    return robotsParser('', 'User-agent: *\nDisallow:');
  }
  const robotsUrl = new URL('/robots.txt', baseUrl).href;
  try {
    const res = await axiosInstance.get(robotsUrl);
    const body = typeof res.data === 'string' ? res.data : '';
    const looksHtml = /<html|<head|<body/i.test(body);

    if (res.status >= 400 || looksHtml || looksLikeBotChallenge(body)) {
      return robotsParser('', 'User-agent: *\nDisallow:');
    }
    return robotsParser(robotsUrl, body);
  } catch {
    return robotsParser('', 'User-agent: *\nDisallow:');
  }
}

// ---- Sitemap discovery (handles sitemap indexes) ----
async function fetchSitemapUrls(baseUrl) {
  const candidates = [
    '/sitemap.xml',
    '/sitemap.xml.gz',
    '/sitemap_index.xml',
    '/sitemap_index.xml.gz',
    '/sitemap-index.xml',
    '/sitemap-index.xml.gz',
    '/sitemap1.xml',
  ].map((p) => new URL(p, baseUrl).href);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    allowBooleanAttributes: true,
  });

  const seen = new Set();
  const out = new Set();

  async function fetchAndParse(sitemapUrl) {
    if (seen.has(sitemapUrl)) return;
    seen.add(sitemapUrl);
    try {
      const isGz = sitemapUrl.endsWith('.gz');
      const res = await axiosInstance.get(sitemapUrl, { responseType: isGz ? 'arraybuffer' : 'text' });
      if (res.status >= 400) return;

      let body = typeof res.data === 'string' ? res.data : '';
      if (isGz) {
        try {
          const buf = Buffer.from(res.data);
          body = require('zlib').gunzipSync(buf).toString('utf-8');
        } catch {}
      }
      if (!body || looksLikeBotChallenge(body)) return;

      const xml = parser.parse(body);

      // <urlset><url><loc>...</loc></url>...
      if (xml && xml.urlset) {
        const urls = Array.isArray(xml.urlset.url)
          ? xml.urlset.url
          : xml.urlset.url
          ? [xml.urlset.url]
          : [];
        for (const u of urls) {
          if (u && u.loc && isHttpUrl(u.loc)) {
            const nu = normalizeUrl(new URL(u.loc, baseUrl).href);
            if (nu && sameSite(baseUrl, nu)) out.add(nu);
          }
>>>>>>> 78a13c7d58cf4823248334d5814d2c3a8d9298d9
        }
      }

      // <sitemapindex><sitemap><loc>...</loc></sitemap>...
      if (xml && xml.sitemapindex) {
        const maps = Array.isArray(xml.sitemapindex.sitemap)
          ? xml.sitemapindex.sitemap
          : xml.sitemapindex.sitemap
          ? [xml.sitemapindex.sitemap]
          : [];
        for (const sm of maps) {
          if (sm && sm.loc && isHttpUrl(sm.loc)) {
            await fetchAndParse(new URL(sm.loc, baseUrl).href);
          }
        }
      }
    } catch {
      // ignore individual failures
    }
<<<<<<< HEAD
>>>>>>> main
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
<<<<<<< HEAD
  }
}

=======
=======
>>>>>>> 78a13c7d58cf4823248334d5814d2c3a8d9298d9
  }

  for (const c of candidates) {
    try {
      await fetchAndParse(c);
    } catch {}
  }

  return [...out].slice(0, MAX_URLS);
}

// ---- Puppeteer for dynamic blog pages (no request interception) ----
>>>>>>> main
async function fetchBlogLinksWithPuppeteer(blogUrl, base) {
  let browser;
  try {
    browser = await puppeteer.launch({
<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> main
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
<<<<<<< HEAD
=======
=======
      headless: 'shell', // set to false to debug locally
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
      protocolTimeout: 180000,
      defaultViewport: { width: 1366, height: 768 },
    });

    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9' });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );

    await page.goto(blogUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('a[href]', { timeout: 15000 });

    const links = await page.$$eval('a[href]', (as) =>
      as.map((a) => a.getAttribute('href')).filter(Boolean)
    );

    const cleaned = links
      .filter((href) => !/^#|javascript:|data:|mailto:|tel:/i.test(href))
      .map((href) => new URL(href, blogUrl).href)
      .filter((abs) => /^https?:/i.test(abs) && abs.startsWith(base));

    return [...new Set(cleaned)];
  } catch {
>>>>>>> 78a13c7d58cf4823248334d5814d2c3a8d9298d9
>>>>>>> main
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> main
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
<<<<<<< HEAD
    }
=======
=======
// ---- NEW: Generic Puppeteer fallback for any page under challenge ----
async function fetchPageLinksWithPuppeteer(url, base) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'shell',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
      protocolTimeout: 180000,
      defaultViewport: { width: 1366, height: 768 },
    });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'accept-language': 'en-US,en;q=0.9' });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    // let the JS challenge complete
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    try { await page.waitForSelector('a[href]', { timeout: 20000 }); } catch {}
    const links = await page.$$eval('a[href]', (as) =>
      as.map(a => a.getAttribute('href')).filter(Boolean)
    );
    const cleaned = links
      .filter(href => !/^#|javascript:|data:|mailto:|tel:/i.test(href))
      .map(href => new URL(href, url).href)
      .filter(abs => /^https?:/i.test(abs) && abs.startsWith(base));
    return [...new Set(cleaned)];
  } catch {
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

// ---- Core scan ----
async function scanLinks(startUrl, schedule = 'daily', opts = {}) {
  // Support legacy numeric 3rd arg
  let maxDepth;
  if (typeof opts === 'number') {
    maxDepth = opts;
    opts = {};
  } else {
    maxDepth =
      Number.isFinite(opts.maxDepth) || opts.maxDepth === Infinity
        ? opts.maxDepth
        : Infinity;
  }
  const blogPageUrl = opts.blogPageUrl;

  const base = new URL(startUrl).origin;
  // Always define robots safely
  const robots = IGNORE_ROBOTS ? { isAllowed: () => true } : await fetchRobotsTxt(base);

  console.log(
    `🔍 Starting scan for ${startUrl}, schedule: ${schedule}, maxDepth: ${maxDepth}`
  );

  const visited = new Set();
  const queued = [];
  const checkedUrls = new Set();
  const statusMap = new Map(); // url -> { url, status, source, text, type }
  const brokenLinksMap = new Map(); // url -> { url, source, text, type, status }

  function enqueue(url, source = startUrl, depth = 0) {
    const n = normalizeUrl(url);
    if (!n || visited.has(n)) return;
    if (!sameSite(base, n)) return;
    if (!/^https?:/i.test(n)) return;
    if (queued.length + visited.size >= MAX_URLS) return;
    queued.push({ url: n, source, depth });
  }

  // Seed with sitemap URLs first (works even when HTML fetch is challenged)
  try {
    const sitemapUrls = await fetchSitemapUrls(startUrl);
    if (sitemapUrls.length) {
      console.log(`🗺️  Found ${sitemapUrls.length} URLs via sitemap`);
      for (const u of sitemapUrls) enqueue(u, startUrl, 1);
>>>>>>> 78a13c7d58cf4823248334d5814d2c3a8d9298d9
    }
  } catch {}

  // Always include the start URL
  enqueue(startUrl, startUrl, 0);

  // Blog candidates (include provided blogPageUrl if present)
  const blogCandidates = [
    new URL('/blogs/', base).href,
    new URL('/blog/', base).href,
    new URL('/news/', base).href,
    new URL('/insights/', base).href,
    new URL('/resources/', base).href,
    new URL('/articles/', base).href,
  ];
  if (blogPageUrl) {
    try {
      const normalized = new URL(blogPageUrl, base).href;
      blogCandidates.unshift(normalized);
    } catch {}
  }

  // Crawl loop
  while (queued.length && visited.size < MAX_URLS) {
    const batch = queued.splice(0, 10);
    await Promise.all(
      batch.map(({ url, source, depth }) =>
        limit(async () => {
          if (visited.has(url)) return;
          visited.add(url);

          // Respect robots when readable (disabled when IGNORE_ROBOTS)
          if (!IGNORE_ROBOTS && robots && robots.isAllowed && robots.isAllowed(url, '*') === false) {
            statusMap.set(url, {
              url,
              status: 401,
              source,
              text: 'Disallowed by robots.txt',
              type: 'internal',
            });
            return;
          }

          // Fetch page
          let res;
          try {
            res = await axiosInstance.get(url);
          } catch (err) {
            statusMap.set(url, {
              url,
              status: 'FetchError',
              source,
              text: err.message || '',
              type: 'internal',
            });
            return;
          }

          const status = res.status;
          const html = typeof res.data === 'string' ? res.data : '';
          checkedUrls.add(url);

          // If blocked or under challenge, try Puppeteer fallback before bailing
          if (status === 202) {
            // WAF / bot-check; try Puppeteer first and only mark broken if that fails
            try {
              const plinks = await fetchPageLinksWithPuppeteer(url, base);
              for (const pl of plinks) enqueue(pl, url, depth + 1);
              statusMap.set(url, { url, status: 'puppeteer-fallback', source, text: '', type: 'internal' });
              return; // don't mark as broken yet
            } catch {
              brokenLinksMap.set(url, {
                url,
                source,
                text: '',
                type: sameSite(base, url) ? 'internal' : 'external',
                status,
              });
              statusMap.set(url, { url, status, source, text: '', type: 'internal' });
              return;
            }
          }

          if (status >= 400) {
            // Real HTTP error; mark broken, but still try a browser pass for discovery
            brokenLinksMap.set(url, {
              url,
              source,
              text: '',
              type: sameSite(base, url) ? 'internal' : 'external',
              status,
            });
            statusMap.set(url, { url, status, source, text: '', type: 'internal' });
            try {
              const plinks = await fetchPageLinksWithPuppeteer(url, base);
              for (const pl of plinks) enqueue(pl, url, depth + 1);
            } catch {}
            return;
          }

          if (looksLikeBotChallenge(html)) {
            statusMap.set(url, {
              url,
              status: 'blocked-by-bot-protection',
              source,
              text: '',
              type: sameSite(base, url) ? 'internal' : 'external',
            });
            // 🔁 Also try Puppeteer to continue discovery
            try {
              const plinks = await fetchPageLinksWithPuppeteer(url, base);
              for (const pl of plinks) enqueue(pl, url, depth + 1);
            } catch {}
            return; // do not parse challenge HTML with Cheerio
          }

          // ✅ Record successful fetch before parsing
          statusMap.set(url, { url, status, source, text: '', type: 'internal' });

          // Proactive discovery with a real browser (for JS-rendered nav)
          try {
            const plinks = await fetchPageLinksWithPuppeteer(url, base);
            for (const pl of plinks) enqueue(pl, url, depth + 1);
          } catch {}

          // Parse links
          let $;
          try {
            $ = cheerio.load(html);
          } catch {
            return;
          }

          const resourceLinks = [];
          $(
            'a[href], link[href], script[src], img[src], source[src], video[src], audio[src], iframe[src]'
          ).each((_, el) => {
            const attr = $(el).attr('href') || $(el).attr('src');
            if (!attr) return;

            // Skip junk/placeholder links
            if (isJunkHref(attr)) return;

            // Skip some <link rel=...> noise
            if ($(el).is('link')) {
              const rel = (($(el).attr('rel') || '') + '').toLowerCase();
              if (['shortlink', 'canonical', 'alternate'].includes(rel)) return;
            }

            const text = $(el).is('a') ? (($(el).text() || '').trim()) : '';
            resourceLinks.push({ url: attr, text });
          });

          // Check resources and enqueue internal pages
          for (const { url: href, text } of resourceLinks) {
            let abs;
            try {
              abs = new URL(href, url).href;
            } catch {
              continue;
            }

            const absNorm = normalizeUrl(abs);
            if (!absNorm || !isHttpUrl(absNorm)) continue;

            const type = sameSite(base, absNorm) ? 'internal' : 'external';

            // Enqueue internal pages for crawling (respect depth)
            if (type === 'internal' && depth + 1 <= maxDepth) {
              enqueue(absNorm, url, depth + 1);
            }

            // Record queued status; later we actively check these
            if (!statusMap.has(absNorm)) {
              statusMap.set(absNorm, {
                url: absNorm,
                status: 'Queued',
                source: url,
                text,
                type,
              });
            }
          }
        })
      )
    );
  }

  // Optional: try to pull from blog candidates using Puppeteer once
  for (const blog of blogCandidates) {
    try {
      if (!sameSite(base, blog)) continue;
      const blogLinks = await fetchBlogLinksWithPuppeteer(blog, base);
      for (const bl of blogLinks) {
        enqueue(bl, blog, 1);
      }
    } catch {}
  }

  // Actively check resources that were marked "Queued"
  const allToCheck = Array.from(statusMap.values()).filter(
    (s) => s.status === 'Queued'
  );

  await Promise.all(
    allToCheck.map((item) =>
      limit(async () => {
        try {
          const res = await axiosInstance.get(item.url);
          const status = res.status;
          if (status >= 400) {
            brokenLinksMap.set(item.url, {
              url: item.url,
              source: item.source,
              text: item.text || '',
              type: item.type,
              status,
            });
            statusMap.set(item.url, { ...item, status });
          } else {
            const html = typeof res.data === 'string' ? res.data : '';
            if (looksLikeBotChallenge(html)) {
              statusMap.set(item.url, {
                ...item,
                status: 'blocked-by-bot-protection',
              });
            } else {
              statusMap.set(item.url, { ...item, status });
            }
          }
          checkedUrls.add(item.url);
        } catch (err) {
          brokenLinksMap.set(item.url, {
            url: item.url,
            source: item.source,
            text: item.text || '',
            type: item.type,
            status: 'Failed',
          });
          statusMap.set(item.url, { ...item, status: 'Failed' });
          checkedUrls.add(item.url);
        }
      })
    )
  );

  // Ensure homepage has a status entry
  if (!statusMap.has(startUrl)) {
    statusMap.set(startUrl, {
      url: startUrl,
      status: 'unknown',
      source: startUrl,
      text: '',
      type: 'internal',
    });
>>>>>>> main
  }

  // ---- RESULT ----
  const allStatuses = Array.from(statusMap.values());

  const brokenLinks = allStatuses.filter(
    (item) =>
      item.status === 'Failed' ||
      (typeof item.status === 'number' && item.status >= 400)
  );

  const result = {
<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> main
  brokenLinks: Array.from(statusMap.values()).filter(
    item => typeof item.status === "number" && [400, 404].includes(item.status)
  ),
  checkedUrls: Array.from(checkedUrls),
  allStatuses: Array.from(statusMap.values()),
};
<<<<<<< HEAD
=======
=======
    brokenLinks: Array.from(brokenLinksMap.values()),
    checkedUrls: Array.from(checkedUrls),
    allStatuses: Array.from(statusMap.values()),
  };
>>>>>>> 78a13c7d58cf4823248334d5814d2c3a8d9298d9
>>>>>>> main

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
