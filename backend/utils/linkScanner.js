const axios = require('axios');
const cheerio = require('cheerio');

async function scanLinks(url, schedule) {
  console.log('Starting scan for URL:', url); // Debug log
  try {
    const response = await axios.get(url, { timeout: 10000 }); // 10-second timeout
    const html = response.data;
    const $ = cheerio.load(html);
    const links = $('a[href]').map((i, link) => $(link).attr('href')).get();
    const brokenLinks = [];
    const checkedUrls = [];

    for (const link of links.slice(0, 50)) { // Limit to 50 links to avoid overload
      try {
        const fullUrl = new URL(link, url).href;
        const linkResponse = await axios.head(fullUrl, { timeout: 5000 }); // 5-second timeout
        if (linkResponse.status >= 400) {
          brokenLinks.push({ url: fullUrl, status: linkResponse.status, source: url });
        }
        checkedUrls.push(fullUrl);
      } catch (error) {
        console.log('Link check error for', link, ':', error.message); // Debug log
        brokenLinks.push({ url: link, status: 'Failed', source: url });
        checkedUrls.push(link);
      }
    }

    console.log('Scan completed for', url, 'with', brokenLinks.length, 'broken links'); // Debug log
    return { brokenLinks, checkedUrls };
  } catch (error) {
    console.error('Scan failed for', url, ':', error.message); // Log scan failure
    return { brokenLinks: [], checkedUrls: [] };
  }
}

module.exports = { scanLinks };