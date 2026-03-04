const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

const BOOKING_URL = 'https://www.booking.com/hotel/ma/casbah-amor-rooftop-with-pool-amp-air-conditioning.fr.html?checkin=2026-03-07&checkout=2026-03-08&group_adults=2&group_children=0&no_rooms=1';
const AIRBNB_URL = 'https://www.airbnb.fr/rooms/1478200670415261868?source_impression_id=p3_1772580878_P3uyw1Sdr8EjZSSv&check_in=2026-04-14&guests=1&adults=1&check_out=2026-04-15';
const IMG_DIR = path.join(__dirname, 'images', 'booking');

function downloadImg(url, filepath) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if ([301, 302, 303, 307].includes(res.statusCode)) return downloadImg(res.headers.location, filepath).then(resolve).catch(reject);
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => { fs.writeFileSync(filepath, Buffer.concat(chunks)); resolve(); });
    }).on('error', reject);
  });
}

(async () => {
  if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR'
  });

  // ==================== BOOKING.COM ====================
  console.log('========== BOOKING.COM ==========');
  const bookingPage = await ctx.newPage();

  // Intercept images
  const bookingPhotos = new Set();
  bookingPage.on('response', (resp) => {
    const url = resp.url();
    if (url.includes('bstatic.com') && (url.includes('/photo/') || url.includes('/max')) && resp.status() === 200) {
      bookingPhotos.add(url.split('?')[0]);
    }
  });

  console.log('Opening Booking.com listing...');
  await bookingPage.goto(BOOKING_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await bookingPage.waitForTimeout(5000);

  // Accept cookies
  try { await bookingPage.click('#onetrust-accept-btn-handler', { timeout: 5000 }); } catch(e) {}
  try { await bookingPage.click('button:has-text("Accepter")', { timeout: 3000 }); } catch(e) {}
  await bookingPage.waitForTimeout(2000);

  // Close login popup if any
  try { await bookingPage.click('[aria-label="Fermer la fenêtre de connexion"]', { timeout: 3000 }); } catch(e) {}
  try { await bookingPage.click('button[aria-label="Rejeter"]', { timeout: 2000 }); } catch(e) {}
  await bookingPage.waitForTimeout(1000);

  // Screenshot main page
  await bookingPage.screenshot({ path: path.join(IMG_DIR, 'booking-main.png'), fullPage: false });

  // Scroll to load everything
  console.log('Scrolling page...');
  for (let i = 0; i < 30; i++) {
    await bookingPage.keyboard.press('PageDown');
    await bookingPage.waitForTimeout(400);
  }
  await bookingPage.waitForTimeout(3000);

  // Take full page screenshot
  await bookingPage.screenshot({ path: path.join(IMG_DIR, 'booking-full.png'), fullPage: true });

  // Extract ALL text
  const bookingText = await bookingPage.evaluate(() => document.body.innerText);
  fs.writeFileSync(path.join(__dirname, 'booking-full-data.txt'), bookingText);
  console.log('Full booking text saved (' + bookingText.length + ' chars)');

  // Extract images from DOM
  const domImgs = await bookingPage.evaluate(() => {
    const urls = new Set();
    document.querySelectorAll('img, [style*="background"]').forEach(el => {
      // img src
      if (el.src && el.src.includes('bstatic.com')) urls.add(el.src.split('?')[0]);
      // data-lazy
      if (el.dataset && el.dataset.lazy && el.dataset.lazy.includes('bstatic.com')) urls.add(el.dataset.lazy.split('?')[0]);
      // srcset
      if (el.srcset) {
        el.srcset.split(',').forEach(s => {
          const u = s.trim().split(' ')[0];
          if (u.includes('bstatic.com')) urls.add(u.split('?')[0]);
        });
      }
      // background-image
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg.includes('bstatic.com')) {
        const match = bg.match(/url\(["']?([^"')]+)/);
        if (match) urls.add(match[1].split('?')[0]);
      }
    });
    return [...urls];
  });
  domImgs.forEach(u => bookingPhotos.add(u));

  // Try opening photo gallery
  console.log('Opening photo gallery...');
  try {
    await bookingPage.click('[data-testid="photo-grid-item"], .bh-photo-grid img, a.bh-photo-grid, [data-testid="gallery-header-button"]', { timeout: 5000 });
    await bookingPage.waitForTimeout(3000);

    // Scroll through gallery
    for (let i = 0; i < 40; i++) {
      await bookingPage.keyboard.press('ArrowRight');
      await bookingPage.waitForTimeout(300);
    }
    await bookingPage.waitForTimeout(2000);

    // Get more images from gallery
    const galleryImgs = await bookingPage.evaluate(() => {
      const urls = [];
      document.querySelectorAll('img').forEach(el => {
        if (el.src && el.src.includes('bstatic.com')) urls.push(el.src.split('?')[0]);
      });
      return urls;
    });
    galleryImgs.forEach(u => bookingPhotos.add(u));

    await bookingPage.screenshot({ path: path.join(IMG_DIR, 'booking-gallery.png') });
  } catch(e) {
    console.log('Could not open gallery:', e.message.substring(0, 100));
  }

  // Extract structured data
  const structuredData = await bookingPage.evaluate(() => {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    return [...scripts].map(s => s.textContent);
  });
  if (structuredData.length > 0) {
    fs.writeFileSync(path.join(__dirname, 'booking-structured.json'), JSON.stringify(structuredData, null, 2));
    console.log('Structured data saved');
  }

  // Extract price elements
  const prices = await bookingPage.evaluate(() => {
    const priceEls = [];
    document.querySelectorAll('[data-testid*="price"], [class*="price"], [class*="Price"]').forEach(el => {
      const text = el.textContent.trim();
      if (text && (text.includes('€') || text.includes('MAD') || text.includes('EUR'))) {
        priceEls.push(text);
      }
    });
    return [...new Set(priceEls)];
  });
  console.log('\nPRICES FOUND:', prices);

  // Filter actual property photos (not icons/logos)
  const realPhotos = [...bookingPhotos].filter(u =>
    (u.includes('/photo/') || u.includes('/max')) &&
    !u.includes('flag') && !u.includes('logo') && !u.includes('icon') &&
    !u.includes('avatar') && !u.includes('badge')
  );

  console.log(`\nBooking photos: ${realPhotos.length} unique`);

  // Download booking photos
  let bCount = 0;
  for (let i = 0; i < realPhotos.length; i++) {
    const fn = `booking-${String(i + 1).padStart(2, '0')}.jpg`;
    try {
      await downloadImg(realPhotos[i], path.join(IMG_DIR, fn));
      const sz = fs.statSync(path.join(IMG_DIR, fn)).size;
      if (sz > 5000) { // Skip tiny images
        bCount++;
        console.log(`✓ ${fn} (${(sz/1024).toFixed(0)}KB)`);
      } else {
        fs.unlinkSync(path.join(IMG_DIR, fn));
      }
    } catch(e) {
      console.log(`✗ ${fn}: ${e.message.substring(0, 50)}`);
    }
  }
  console.log(`Booking: downloaded ${bCount} photos`);

  // ==================== AIRBNB ====================
  console.log('\n========== AIRBNB ==========');
  const airbnbPage = await ctx.newPage();

  const airbnbPhotos = new Set();
  airbnbPage.on('response', (resp) => {
    const url = resp.url();
    if (url.includes('muscache.com') && url.includes('Hosting') && url.includes('original') && resp.status() === 200) {
      airbnbPhotos.add(url.split('?')[0]);
    }
  });

  console.log('Opening Airbnb listing...');
  await airbnbPage.goto(AIRBNB_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await airbnbPage.waitForTimeout(5000);

  // Accept cookies
  try { await airbnbPage.click('button:has-text("OK")', { timeout: 3000 }); } catch(e) {}
  await airbnbPage.waitForTimeout(1000);

  // Click "Show all photos"
  try {
    // First close any modal
    try {
      const closeBtn = airbnbPage.locator('[aria-label="Fermer"], [aria-label="Close"]').first();
      if (await closeBtn.isVisible({ timeout: 2000 })) await closeBtn.click();
      await airbnbPage.waitForTimeout(1000);
    } catch(e) {}

    const showAllBtn = airbnbPage.locator('button:has-text("Afficher toutes les photos")').first();
    if (await showAllBtn.isVisible({ timeout: 5000 })) {
      // Use JavaScript click to bypass overlay issues
      await showAllBtn.evaluate(el => el.click());
      console.log('Clicked "Show all photos"');
      await airbnbPage.waitForTimeout(3000);

      // Scroll through the photo modal
      for (let i = 0; i < 60; i++) {
        await airbnbPage.evaluate(() => {
          const modal = document.querySelector('[role="dialog"]') || document.querySelector('[data-testid="modal-container"]');
          if (modal) {
            const scrollable = modal.querySelector('[style*="overflow"]') || modal;
            scrollable.scrollTop += 500;
          }
          window.scrollBy(0, 500);
        });
        await airbnbPage.waitForTimeout(300);
      }
      await airbnbPage.waitForTimeout(2000);
    }
  } catch(e) {
    console.log('Show all photos failed:', e.message.substring(0, 100));
  }

  // Also scroll main page
  for (let i = 0; i < 30; i++) {
    await airbnbPage.keyboard.press('PageDown');
    await airbnbPage.waitForTimeout(300);
  }
  await airbnbPage.waitForTimeout(2000);

  // Get DOM images
  const airbnbDomImgs = await airbnbPage.evaluate(() => {
    const urls = new Set();
    document.querySelectorAll('img').forEach(img => {
      [img.src, img.dataset?.src].forEach(url => {
        if (url && url.includes('muscache.com') && url.includes('Hosting')) urls.add(url.split('?')[0]);
      });
      if (img.srcset) {
        img.srcset.split(',').forEach(s => {
          const u = s.trim().split(' ')[0];
          if (u.includes('muscache.com') && u.includes('Hosting')) urls.add(u.split('?')[0]);
        });
      }
    });
    return [...urls];
  });
  airbnbDomImgs.forEach(u => airbnbPhotos.add(u));

  // Extract Airbnb text
  const airbnbText = await airbnbPage.evaluate(() => document.body.innerText);
  fs.writeFileSync(path.join(__dirname, 'airbnb-full-data.txt'), airbnbText);
  console.log('Full Airbnb text saved (' + airbnbText.length + ' chars)');

  // Screenshot
  await airbnbPage.screenshot({ path: path.join(IMG_DIR, 'airbnb-page.png'), fullPage: false });

  const airbnbRealPhotos = [...airbnbPhotos];
  console.log(`Airbnb photos: ${airbnbRealPhotos.length} unique`);

  // Download Airbnb photos
  const airbnbImgDir = path.join(__dirname, 'images', 'airbnb-new');
  if (!fs.existsSync(airbnbImgDir)) fs.mkdirSync(airbnbImgDir, { recursive: true });

  let aCount = 0;
  for (let i = 0; i < airbnbRealPhotos.length; i++) {
    const fn = `airbnb-${String(i + 1).padStart(2, '0')}.jpeg`;
    try {
      await downloadImg(airbnbRealPhotos[i], path.join(airbnbImgDir, fn));
      const sz = fs.statSync(path.join(airbnbImgDir, fn)).size;
      aCount++;
      console.log(`✓ ${fn} (${(sz/1024).toFixed(0)}KB)`);
    } catch(e) {
      console.log(`✗ ${fn}: ${e.message.substring(0, 50)}`);
    }
  }
  console.log(`Airbnb: downloaded ${aCount} photos`);

  // Save URLs
  fs.writeFileSync(path.join(IMG_DIR, 'booking-urls.txt'), realPhotos.join('\n'));
  fs.writeFileSync(path.join(airbnbImgDir, 'airbnb-urls.txt'), airbnbRealPhotos.join('\n'));

  console.log('\n========== SUMMARY ==========');
  console.log(`Booking photos: ${bCount}`);
  console.log(`Airbnb photos: ${aCount}`);
  console.log('Booking text: booking-full-data.txt');
  console.log('Airbnb text: airbnb-full-data.txt');

  // Print first part of booking data for quick view
  console.log('\n--- BOOKING DATA PREVIEW ---');
  console.log(bookingText.substring(0, 5000));

  await browser.close();
  console.log('\nDone!');
})();
