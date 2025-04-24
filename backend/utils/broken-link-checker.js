if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const axios = require('axios');
const cheerio = require('cheerio');
const { XMLParser } = require('fast-xml-parser');
const Domain = require('../models/Domain');
const Report = require('../models/Report');
const { sendEmail } = require('./email');

const CONCURRENT_REQUESTS = 10;
const REQUEST_DELAY = 200;
const MAX_URLS_PER_SITE = 500;

// Validate URL
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Resolve relative URLs
function resolveUrl(base, relative) {
  try {
    return new URL(relative, base).href;
  } catch (error) {
    console.error(`Error resolving URL: ${relative}`);
    return null;
  }
}

// Check if link is same domain
function isSameDomain(baseUrl, linkUrl) {
  try {
    const base = new URL(baseUrl);
    const link = new URL(linkUrl);
    return base.hostname === link.hostname;
  } catch (error) {
    return false;
  }
}

// Delay function
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check single link
async function checkLink(linkUrl, sourceUrl, brokenLinks, checkedUrls) {
  if (checkedUrls.has(linkUrl) || !isValidUrl(linkUrl)) {
    if (!isValidUrl(linkUrl)) {
      brokenLinks.push({ url: linkUrl, status: 'Invalid URL', source: sourceUrl });
    }
    return;
  }
  checkedUrls.add(linkUrl);
  try {
    const response = await axios.get(linkUrl, { timeout: 5000 });
    if (response.status < 200 || response.status >= 400) {
      brokenLinks.push({ url: linkUrl, status: response.status, source: sourceUrl });
    }
  } catch (error) {
    const status = error.response ? error.response.status : 'Unreachable';
    brokenLinks.push({ url: linkUrl, status, source: sourceUrl });
  }
}

// Fetch URLs from sitemap
async function fetchSitemap(sitemapUrl) {
  try {
    const response = await axios.get(sitemapUrl, { timeout: 5000 });
    const parser = new XMLParser();
    const parsed = parser.parse(response.data);
    const urls = [];
    if (parsed.sitemapindex && parsed.sitemapindex.sitemap) {
      const sitemaps = Array.isArray(parsed.sitemapindex.sitemap)
        ? parsed.sitemapindex.sitemap
        : [parsed.sitemapindex.sitemap];
      for (const sitemap of sitemaps) {
        if (sitemap.loc) {
          const subSitemapUrls = await fetchSitemap(sitemap.loc);
          urls.push(...subSitemapUrls);
        }
      }
    }
    if (parsed.urlset && parsed.urlset.url) {
      const sitemapUrls = Array.isArray(parsed.urlset.url)
        ? parsed.urlset.url
        : [parsed.urlset.url];
      urls.push(...sitemapUrls.map(u => u.loc).filter(u => isValidUrl(u)));
    }
    return urls.slice(0, MAX_URLS_PER_SITE);
  } catch (error) {
    console.error(`Error fetching sitemap ${sitemapUrl}: ${error.message}`);
    return [];
  }
}

// Fetch homepage links
async function fetchHomepageLinks(baseUrl) {
  try {
    const response = await axios.get(baseUrl, { timeout: 5000 });
    const $ = cheerio.load(response.data);
    const links = [];
    $('a').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        const resolvedUrl = resolveUrl(baseUrl, href);
        if (resolvedUrl && isSameDomain(baseUrl, resolvedUrl)) {
          links.push(resolvedUrl);
        }
      }
    });
    return [...new Set(links)].slice(0, MAX_URLS_PER_SITE);
  } catch (error) {
    console.error(`Error fetching homepage ${baseUrl}: ${error.message}`);
    return [];
  }
}

// Extract internal links
async function extractInternalLinks(pageUrl, websiteUrl, checkedUrls) {
  try {
    const response = await axios.get(pageUrl, { timeout: 5000 });
    const $ = cheerio.load(response.data);
    const links = [];
    $('a').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        const resolvedUrl = resolveUrl(pageUrl, href);
        if (resolvedUrl && isSameDomain(websiteUrl, resolvedUrl) && !checkedUrls.has(resolvedUrl)) {
          links.push(resolvedUrl);
        }
      }
    });
    return [...new Set(links)];
  } catch (error) {
    console.error(`Error extracting links from ${pageUrl}: ${error.message}`);
    return [];
  }
}

// Collect links
async function collectLinks(websiteUrl) {
  const sitemapUrls = [
    `${websiteUrl}/sitemap.xml`,
    `${websiteUrl}/sitemap_index.xml`,
  ];
  let initialUrls = [];
  for (const sitemapUrl of sitemapUrls) {
    const sitemapLinks = await fetchSitemap(sitemapUrl);
    if (sitemapLinks.length > 0) {
      initialUrls = [...new Set(sitemapLinks)];
      console.log(`Found ${initialUrls.length} URLs in sitemap for ${websiteUrl}`);
      break;
    }
  }
  if (initialUrls.length === 0) {
    console.log(`No sitemap found for ${websiteUrl}, crawling homepage...-limiting to 50 urls`);
    initialUrls = await fetchHomepageLinks(websiteUrl);
    console.log(`Found ${initialUrls.length} URLs on homepage for ${websiteUrl}`);
  }
  const urlsToCheck = [];
  const checkedUrls = new Set();
  for (const url of initialUrls) {
    if (urlsToCheck.length >= MAX_URLS_PER_SITE) break;
    urlsToCheck.push(url);
    checkedUrls.add(url);
    const internalLinks = await extractInternalLinks(url, websiteUrl, checkedUrls);
    urlsToCheck.push(...internalLinks);
  }
  return [...new Set(urlsToCheck)].slice(0, MAX_URLS_PER_SITE);
}

// Check all links
async function checkAllLinks(urlsToCheck, websiteUrl, brokenLinks, checkedUrls) {
  console.log(`Checking ${urlsToCheck.length} URLs for ${websiteUrl}...`);
  for (let i = 0; i < urlsToCheck.length; i += CONCURRENT_REQUESTS) {
    const batch = urlsToCheck.slice(i, i + CONCURRENT_REQUESTS);
    await Promise.all(
      batch.map(async (link, index) => {
        await checkLink(link, 'Sitemap or Inner Page', brokenLinks, checkedUrls);
        await delay(REQUEST_DELAY);
        const progress = Math.round(((i + index + 1) / urlsToCheck.length) * 100);
        console.log(`Progress for ${websiteUrl}: ${progress}% (${i + index + 1}/${urlsToCheck.length})`);
      })
    );
  }
}

// Analyze single website
async function analyzeWebsite(websiteUrl, userId, domainId) {
  console.log(`Starting broken link check for ${websiteUrl}`);
  const brokenLinks = [];
  const checkedUrls = new Set();
  const urlsToCheck = await collectLinks(websiteUrl);
  await checkAllLinks(urlsToCheck, websiteUrl, brokenLinks, checkedUrls);

  const report = new Report({
    userId,
    domainId,
    brokenLinks,
    checkedUrls: Array.from(checkedUrls),
  });
  await report.save();

  const emailReport = generateReport(websiteUrl, brokenLinks, checkedUrls);
  await sendEmail(emailReport, websiteUrl, userId);
}

// Generate report
function generateReport(websiteUrl, brokenLinks, checkedUrls) {
  const formattedDate = new Date().toLocaleString();
  const totalBrokenLinks = brokenLinks.length;
  const totalUrlsChecked = checkedUrls.size;

  const htmlReport = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { background: #003087; color: #fff; padding: 20px; text-align: center; border-top-left-radius: 8px; border-top-right-radius: 8px; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 20px; }
        h2 { color: #003087; font-size: 20px; margin-top: 0; }
        p { line-height: 1.6; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
        th { background: #f9f9f9; font-weight: bold; }
        .footer { text-align: center; padding: 20px; border-top: 1px solid #ddd; font-size: 14px; color: #777; }
        .footer a { color: #003087; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Broken Links Report for ${websiteUrl}</h1>
        </div>
        <div class="content">
          <h2>Summary</h2>
          <p><strong>Website:</strong> <a href="${websiteUrl}">${websiteUrl}</a></p>
          <p><strong>Date:</strong> ${formattedDate}</p>
          <p><strong>Total URLs Checked:</strong> ${totalUrlsChecked}</p>
          <p><strong>Total Broken Links Found:</strong> ${totalBrokenLinks}</p>
          <h2>Broken Links</h2>
          ${
            totalBrokenLinks === 0
              ? '<p>No broken links were found.</p>'
              : `
                <table>
                  <thead>
                    <tr>
                      <th>URL</th>
                      <th>Status</th>
                      <th>Source Page</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${brokenLinks
                      .map(
                        link => `
                          <tr>
                            <td><a href="${link.url}">${link.url}</a></td>
                            <td>${link.status}</td>
                            <td><a href="${link.source}">${link.source}</a></td>
                          </tr>
                        `
                      )
                      .join('')}
                  </tbody>
                </table>
              `
          }
          <h2>Scanned URLs</h2>
          ${
            checkedUrls.size === 0
              ? '<p>No URLs were scanned.</p>'
              : `
                <p>The following ${checkedUrls.size} URLs were checked:</p>
                <ul>
                  ${Array.from(checkedUrls)
                    .map(url => `<li><a href="${url}">${url}</a></li>`)
                    .join('')}
                </ul>
              `
          }
        </div>
        <div class="footer">
          <p>Generated by Website Link Checker | <a href="${process.env.FRONTEND_URL}">Visit Us</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textReport = `
Broken Links Report for ${websiteUrl}
Website: ${websiteUrl}
Date: ${formattedDate}
Total URLs Checked: ${totalUrlsChecked}
Total Broken Links Found: ${totalBrokenLinks}
Broken Links:
${totalBrokenLinks === 0 ? 'No broken links found.' : brokenLinks.map(link => `URL: ${link.url}\nStatus: ${link.status}\nSource: ${link.source}\n`).join('\n')}
Scanned URLs:
${checkedUrls.size === 0 ? 'No URLs were scanned.' : Array.from(checkedUrls).join('\n')}
  `;

  return { html: htmlReport, text: textReport };
}

module.exports = { analyzeWebsite };