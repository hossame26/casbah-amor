const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

const LISTING_URL = 'https://www.airbnb.fr/rooms/1478200670415261868?source_impression_id=p3_1772580878_P3uyw1Sdr8EjZSSv&check_in=2026-04-14&guests=1&adults=1&check_out=2026-04-15&modal=PHOTO_TOUR_SCROLLABLE';
const IMG_DIR = path.join(__dirname, 'images', 'airbnb');

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const stream = fs.createWriteStream(filepath);
      res.pipe(stream);
      stream.on('finish', () => { stream.close(); resolve(); });
    }).on('error', reject);
  });
}

(async () => {
  if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    viewport: { width: 1440, height: 900 }
  });

  // Intercept image requests to capture ALL photo URLs
  const allPhotoUrls = new Set();
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('muscache.com') && url.includes('Hosting') && url.includes('original')) {
      allPhotoUrls.add(url.split('?')[0]);
    }
  });

  console.log('Opening listing with photo tour modal...');
  await page.goto(LISTING_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  // Close cookie popup
  try {
    await page.click('button:has-text("OK")', { timeout: 3000 });
  } catch(e) {}
  await page.waitForTimeout(1000);

  // Find the modal/dialog and scroll through it
  console.log('Scrolling through photo tour to load all images...');

  // Try multiple scroll strategies
  // Strategy 1: Scroll the dialog/modal
  const scrollTargets = [
    '[role="dialog"]',
    '[data-testid="photo-viewer-section"]',
    '[aria-label="Tour photo"]',
    'section[aria-label]',
    'main',
    'body'
  ];

  for (const selector of scrollTargets) {
    try {
      const el = await page.$(selector);
      if (el) {
        console.log(`Scrolling: ${selector}`);
        for (let i = 0; i < 40; i++) {
          await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (el) el.scrollTop += 600;
            window.scrollBy(0, 600);
          }, selector);
          await page.waitForTimeout(400);
        }
        break;
      }
    } catch(e) {}
  }

  // Also try keyboard scrolling
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(3000);

  // Now also extract from DOM
  const domUrls = await page.evaluate(() => {
    const urls = new Set();
    document.querySelectorAll('img').forEach(img => {
      [img.src, img.dataset.src, ...(img.srcset || '').split(',').map(s => s.trim().split(' ')[0])].forEach(url => {
        if (url && url.includes('muscache.com') && (url.includes('Hosting') || url.includes('hosting'))) {
          urls.add(url.split('?')[0]);
        }
      });
    });
    // Check picture sources
    document.querySelectorAll('picture source').forEach(src => {
      (src.srcset || '').split(',').forEach(s => {
        const url = s.trim().split(' ')[0];
        if (url && url.includes('muscache.com') && url.includes('Hosting')) {
          urls.add(url.split('?')[0]);
        }
      });
    });
    return [...urls];
  });

  domUrls.forEach(u => allPhotoUrls.add(u));

  // If we still don't have many photos, try clicking "Show all photos" button
  if (allPhotoUrls.size < 15) {
    console.log(`Only ${allPhotoUrls.size} photos found, trying "Show all photos"...`);
    try {
      // Go to page without modal first
      await page.goto('https://www.airbnb.fr/rooms/1478200670415261868', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      try { await page.click('button:has-text("OK")', { timeout: 2000 }); } catch(e) {}

      // Click show all photos
      const showAll = await page.$('button:has-text("Afficher toutes les photos"), button:has-text("Show all photos")');
      if (showAll) {
        await showAll.click();
        await page.waitForTimeout(3000);

        // Scroll through all photos
        for (let i = 0; i < 50; i++) {
          await page.keyboard.press('PageDown');
          await page.waitForTimeout(300);
        }
        await page.waitForTimeout(2000);

        // Extract again
        const moreUrls = await page.evaluate(() => {
          const urls = [];
          document.querySelectorAll('img').forEach(img => {
            [img.src, img.dataset.src].forEach(url => {
              if (url && url.includes('muscache.com') && url.includes('Hosting')) {
                urls.push(url.split('?')[0]);
              }
            });
          });
          return urls;
        });
        moreUrls.forEach(u => allPhotoUrls.add(u));
      }
    } catch(e) {
      console.log('Show all photos approach failed:', e.message);
    }
  }

  // Also try direct API approach - Airbnb uses a predictable pattern
  // Download all unique photos
  const photoUrls = [...allPhotoUrls].filter(url =>
    !url.includes('User/original') && // Skip profile pics
    !url.includes('AirbnbPlatformAssets') // Skip platform icons
  );

  console.log(`\nFound ${photoUrls.length} unique riad photos`);
  console.log('URLs:');
  photoUrls.forEach((url, i) => console.log(`${i + 1}. ${url}`));

  // Download
  let count = 0;
  for (let i = 0; i < photoUrls.length; i++) {
    const url = photoUrls[i];
    const filename = `riad-${String(i + 1).padStart(2, '0')}.jpeg`;
    const filepath = path.join(IMG_DIR, filename);
    try {
      await downloadImage(url, filepath);
      count++;
      const stats = fs.statSync(filepath);
      console.log(`✓ ${filename} (${(stats.size / 1024).toFixed(0)}KB)`);
    } catch (e) {
      console.log(`✗ ${filename}: ${e.message}`);
    }
  }

  console.log(`\nDownloaded: ${count}/${photoUrls.length} photos`);

  // Take screenshots of the page too
  await page.screenshot({ path: path.join(IMG_DIR, 'page-screenshot.png'), fullPage: true });
  console.log('Page screenshot saved');

  // Save all URLs
  fs.writeFileSync(path.join(IMG_DIR, 'all-photo-urls.txt'), photoUrls.join('\n'));

  await browser.close();
})();
