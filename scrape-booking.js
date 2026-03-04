const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR'
  });

  // Try multiple search approaches for Casbah Amor on Booking.com
  const urls = [
    'https://www.booking.com/searchresults.fr.html?ss=Casbah+Amor+Marrakech&checkin=2026-04-14&checkout=2026-04-16&group_adults=2',
    'https://www.booking.com/searchresults.fr.html?ss=Riad+Kasbah+Amour+Marrakech&checkin=2026-04-14&checkout=2026-04-16&group_adults=2'
  ];

  let allData = '';

  for (const url of urls) {
    console.log(`\nTrying: ${url.substring(0, 80)}...`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);

      // Accept cookies
      try { await page.click('#onetrust-accept-btn-handler', { timeout: 3000 }); } catch(e) {}
      try { await page.click('button:has-text("Accepter")', { timeout: 2000 }); } catch(e) {}
      await page.waitForTimeout(1000);

      const text = await page.evaluate(() => document.body.innerText);
      allData += `\n\n=== ${url} ===\n${text.substring(0, 8000)}`;

      // Take screenshot
      const screenshotName = url.includes('Casbah') ? 'booking-search-casbah.png' : 'booking-search-kasbah.png';
      await page.screenshot({ path: path.join(__dirname, 'images', 'airbnb', screenshotName) });
    } catch(e) {
      console.log(`Failed: ${e.message}`);
    }
  }

  // Also try their direct booking.com URL
  try {
    console.log('\nTrying direct hotel page...');
    await page.goto('https://www.booking.com/hotel/ma/casbah-amor.fr.html?checkin=2026-04-14&checkout=2026-04-16&group_adults=2', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);

    try { await page.click('#onetrust-accept-btn-handler', { timeout: 3000 }); } catch(e) {}
    await page.waitForTimeout(1000);

    // Scroll to load all content
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('PageDown');
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(2000);

    const text = await page.evaluate(() => document.body.innerText);
    allData += `\n\n=== DIRECT HOTEL PAGE ===\n${text.substring(0, 15000)}`;

    await page.screenshot({ path: path.join(__dirname, 'images', 'airbnb', 'booking-direct.png'), fullPage: false });

    // Try to get price table specifically
    const priceData = await page.evaluate(() => {
      const prices = [];
      // Look for price elements
      document.querySelectorAll('[data-testid="price-and-discounted-price"], .bui-price-display, .prco-val498-buy498, [class*="price"]').forEach(el => {
        if (el.textContent.includes('€') || el.textContent.includes('MAD')) {
          prices.push(el.textContent.trim());
        }
      });
      return prices;
    });

    if (priceData.length > 0) {
      allData += `\n\n=== PRICES FOUND ===\n${priceData.join('\n')}`;
    }
  } catch(e) {
    console.log(`Direct page failed: ${e.message}`);
  }

  // Also try kasbahamour.com for their own prices
  try {
    console.log('\nChecking kasbahamour.com...');
    await page.goto('https://kasbahamour.com', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(3000);

    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('PageDown');
      await page.waitForTimeout(300);
    }

    const text = await page.evaluate(() => document.body.innerText);
    allData += `\n\n=== KASBAHAMOUR.COM ===\n${text.substring(0, 8000)}`;

    await page.screenshot({ path: path.join(__dirname, 'images', 'airbnb', 'kasbahamour-site.png'), fullPage: true });

    // Get all links
    const links = await page.evaluate(() => {
      return [...document.querySelectorAll('a')].map(a => ({ text: a.textContent.trim(), href: a.href })).filter(l => l.text.length > 0);
    });
    allData += `\n\nLinks:\n${links.map(l => `${l.text}: ${l.href}`).join('\n')}`;
  } catch(e) {
    console.log(`kasbahamour.com failed: ${e.message}`);
  }

  // Save all data
  fs.writeFileSync(path.join(__dirname, 'booking-data.txt'), allData);
  console.log('\nAll data saved to booking-data.txt');
  console.log(allData.substring(0, 3000));

  await browser.close();
})();
