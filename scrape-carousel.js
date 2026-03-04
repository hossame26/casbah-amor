const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');

const IMG_DIR = path.join(__dirname, 'images', 'airbnb');

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    https.get({ hostname: parsedUrl.hostname, path: parsedUrl.pathname, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => { fs.writeFileSync(filepath, Buffer.concat(chunks)); resolve(); });
    }).on('error', reject);
  });
}

(async () => {
  if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false }); // visible for debugging
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 }
  });

  // Capture all image URLs from network
  const photoUrls = new Set();
  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('muscache.com') && (url.includes('Hosting') || url.includes('hosting')) && url.includes('original') && resp.status() === 200) {
      const cleanUrl = url.split('?')[0];
      if (!photoUrls.has(cleanUrl)) {
        photoUrls.add(cleanUrl);
        console.log(`[NETWORK] New photo: ${cleanUrl.substring(cleanUrl.lastIndexOf('/') + 1)}`);
      }
    }
  });

  console.log('Opening Airbnb listing...');
  await page.goto('https://www.airbnb.fr/rooms/1478200670415261868', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  // Close cookie popup
  try { await page.click('button:has-text("OK")', { timeout: 3000 }); } catch(e) {}
  await page.waitForTimeout(1000);

  // Take screenshot of main page
  await page.screenshot({ path: path.join(IMG_DIR, 'main-page.png') });

  // Click on the first/main photo to open lightbox/carousel
  console.log('Opening photo viewer...');
  try {
    // Try clicking the main hero image
    await page.click('img[data-original-uri], [data-testid="photo-viewer-section"] img, button:has-text("Afficher toutes les photos")', { timeout: 5000 });
    await page.waitForTimeout(2000);
  } catch(e) {
    console.log('Trying alternative click...');
    // Click on image container
    const imgs = await page.$$('img');
    for (const img of imgs) {
      const src = await img.getAttribute('src');
      if (src && src.includes('muscache.com') && src.includes('Hosting')) {
        await img.click();
        break;
      }
    }
    await page.waitForTimeout(2000);
  }

  // Now scroll inside the modal
  console.log('Scrolling through modal...');

  // Find the modal and scroll inside it
  await page.evaluate(async () => {
    // Find scrollable modal container
    const modal = document.querySelector('[data-testid="modal-container"]') ||
                  document.querySelector('[role="dialog"]') ||
                  document.querySelector('[aria-modal="true"]');

    if (modal) {
      const scrollable = modal.querySelector('[style*="overflow"]') || modal;
      // Scroll to bottom slowly
      const scrollHeight = scrollable.scrollHeight;
      for (let pos = 0; pos < scrollHeight + 5000; pos += 300) {
        scrollable.scrollTop = pos;
        window.scrollTo(0, pos);
        await new Promise(r => setTimeout(r, 200));
      }
    }

    // Also scroll the whole page
    for (let pos = 0; pos < document.body.scrollHeight + 5000; pos += 300) {
      window.scrollTo(0, pos);
      await new Promise(r => setTimeout(r, 100));
    }
  });
  await page.waitForTimeout(3000);

  // Try arrow key navigation for carousel
  console.log('Trying arrow navigation...');
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);

    // Also try clicking next button
    try {
      const nextBtn = await page.$('[aria-label="Suivant"], [aria-label="Next"], button[aria-label*="next"], button[aria-label*="suivant"]');
      if (nextBtn) await nextBtn.click({ timeout: 500 });
    } catch(e) {}
  }
  await page.waitForTimeout(2000);

  // Extract from DOM too
  const domPhotos = await page.evaluate(() => {
    const urls = new Set();
    document.querySelectorAll('img, picture source').forEach(el => {
      const sources = [el.src, el.dataset?.src, el.srcset].filter(Boolean);
      sources.forEach(s => {
        const matches = s.match(/https?:\/\/[^\s,"]+muscache\.com[^\s,"]+/g) || [];
        matches.forEach(url => {
          if ((url.includes('Hosting') || url.includes('hosting')) && !url.includes('AirbnbPlatform')) {
            urls.add(url.split('?')[0].split(' ')[0]);
          }
        });
      });
    });
    return [...urls];
  });
  domPhotos.forEach(u => photoUrls.add(u));

  // Close browser
  await page.screenshot({ path: path.join(IMG_DIR, 'final-state.png') });

  const allUrls = [...photoUrls];
  console.log(`\nTotal unique riad photos found: ${allUrls.length}`);
  allUrls.forEach((url, i) => {
    const id = url.substring(url.lastIndexOf('/') + 1);
    console.log(`${i + 1}. ${id}`);
  });

  // Download all
  let count = 0;
  for (let i = 0; i < allUrls.length; i++) {
    const filename = `airbnb-${String(i + 1).padStart(2, '0')}.jpeg`;
    const filepath = path.join(IMG_DIR, filename);
    try {
      await downloadImage(allUrls[i], filepath);
      const size = fs.statSync(filepath).size;
      count++;
      console.log(`✓ ${filename} (${(size/1024).toFixed(0)}KB)`);
    } catch(e) {
      console.log(`✗ ${filename}: ${e.message}`);
    }
  }

  fs.writeFileSync(path.join(IMG_DIR, 'final-urls.txt'), allUrls.join('\n'));
  console.log(`\nDone: ${count}/${allUrls.length} downloaded`);

  await browser.close();
})();
