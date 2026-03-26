/* utils/linkScanner.js */
const axios = require('axios');
const cheerio = require('cheerio');
const robotsParser = require('robots-parser');
const pLimit = require('p-limit').default;
const { URL } = require('url');
const { XMLParser } = require('fast-xml-parser');
const puppeteer = require('puppeteer-extra'); // Replacement for standard puppeteer
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs').promises;

const limit = pLimit(18);
const MAX_URLS = 15000;

// Allow walking off-domain (external links)
const CRAWL_EXTERNAL = false;

// 🚩 Toggle to ignore robots.txt entirely
const IGNORE_ROBOTS = true;

// ---- Axios instance tuned to look like a real browser ----
const axiosInstance = axios.create({
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 WebsiteLinkChecker-Valid-Bot',
    'Accept':
      'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Upgrade-Insecure-Requests': '1',
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
    return null;
  }
}

function sameSite(base, url) {
  try {
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
  }

  for (const c of candidates) {
    try {
      await fetchAndParse(c);
    } catch {}
  }

  return [...out].slice(0, MAX_URLS);
}

// ---- Puppeteer for dynamic blog pages (no request interception) ----
async function fetchBlogLinksWithPuppeteer(blogUrl, base) {
  let browser;
  try {
    browser = await puppeteer.launch({
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
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 WebsiteLinkChecker-Valid-Bot'
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
  } catch (error) {
    console.error(`❌ Puppeteer error for blog ${blogUrl}:`, error.message);
    return [];
  } finally {
    if (browser) await browser.close();
  }
}

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
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 WebsiteLinkChecker-Valid-Bot'
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
  } catch (error) {
    console.error(`❌ Puppeteer fallback error for ${url}:`, error.message);
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
  }

  const result = {
    brokenLinks: Array.from(brokenLinksMap.values()),
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