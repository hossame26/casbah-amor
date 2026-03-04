const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const LISTING_URL = 'https://www.airbnb.fr/rooms/1478200670415261868?source_impression_id=p3_1772580878_P3uyw1Sdr8EjZSSv&check_in=2026-04-14&guests=1&adults=1&check_out=2026-04-15&modal=PHOTO_TOUR_SCROLLABLE';
const IMG_DIR = path.join(__dirname, 'images', 'airbnb');

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
      }
      const stream = fs.createWriteStream(filepath);
      res.pipe(stream);
      stream.on('finish', () => { stream.close(); resolve(filepath); });
      stream.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'fr-FR'
  });
  const page = await context.newPage();

  console.log('Navigating to Airbnb listing...');
  await page.goto(LISTING_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  // Close cookie banner if present
  try {
    const cookieBtn = page.locator('button:has-text("OK")').first();
    if (await cookieBtn.isVisible({ timeout: 2000 })) await cookieBtn.click();
  } catch(e) {}

  // Try to get the description text first
  console.log('\n=== EXTRACTING DESCRIPTION ===');
  let description = '';
  try {
    // Close modal first to get description
    try {
      const closeBtn = page.locator('[aria-label="Fermer"], [aria-label="Close"], button[aria-label*="close"]').first();
      if (await closeBtn.isVisible({ timeout: 2000 })) await closeBtn.click();
      await page.waitForTimeout(1000);
    } catch(e) {}

    // Get all text content from the page
    description = await page.evaluate(() => {
      const sections = [];

      // Get title
      const title = document.querySelector('h1');
      if (title) sections.push('TITRE: ' + title.textContent.trim());

      // Get all section headings and their content
      const allText = document.body.innerText;
      return allText;
    });

    // Save description to file
    fs.writeFileSync(path.join(__dirname, 'airbnb-description.txt'), description);
    console.log('Description saved to airbnb-description.txt');

    // Print first 3000 chars
    console.log(description.substring(0, 5000));
    console.log('\n...[truncated, full text in airbnb-description.txt]');
  } catch(e) {
    console.log('Could not extract description:', e.message);
  }

  // Now open the photo tour
  console.log('\n=== EXTRACTING PHOTOS ===');

  // Click on "Afficher toutes les photos" or navigate back to photo tour
  try {
    await page.goto(LISTING_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Close cookie banner again
    try {
      const cookieBtn = page.locator('button:has-text("OK")').first();
      if (await cookieBtn.isVisible({ timeout: 2000 })) await cookieBtn.click();
    } catch(e) {}
  } catch(e) {}

  await page.waitForTimeout(2000);

  // Scroll through the photo modal to load all images
  const photoModal = page.locator('[aria-label="Tour photo"], [data-testid="photo-viewer-section"], [role="dialog"]').first();

  // Scroll down multiple times to load all photos
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(2000);

  // Extract all image URLs
  const imageUrls = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img');
    const urls = new Set();
    imgs.forEach(img => {
      const src = img.src || img.dataset.src || '';
      if (src.includes('muscache.com') && src.includes('original')) {
        urls.add(src.split('?')[0]);
      } else if (src.includes('muscache.com') && (src.includes('Hosting') || src.includes('pictures'))) {
        // Try to get original version
        const origUrl = src.replace(/im\/pictures/, 'im/pictures').split('?')[0];
        urls.add(origUrl);
      }
    });

    // Also check srcset
    imgs.forEach(img => {
      const srcset = img.srcset || '';
      const matches = srcset.match(/https:\/\/a0\.muscache\.com[^\s,]+/g);
      if (matches) {
        matches.forEach(url => {
          if (url.includes('original') || url.includes('Hosting')) {
            urls.add(url.split('?')[0]);
          }
        });
      }
    });

    // Check picture > source elements
    document.querySelectorAll('picture source').forEach(source => {
      const srcset = source.srcset || '';
      const matches = srcset.match(/https:\/\/a0\.muscache\.com[^\s,]+/g);
      if (matches) {
        matches.forEach(url => urls.add(url.split('?')[0]));
      }
    });

    return [...urls];
  });

  console.log(`Found ${imageUrls.length} unique images`);

  // Also take a screenshot of the photo tour
  await page.screenshot({ path: path.join(IMG_DIR, 'screenshot-phototour.png'), fullPage: false });

  // Download all images
  let downloaded = 0;
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    const ext = url.includes('.png') ? '.png' : '.jpeg';
    const filename = `photo-${String(i + 1).padStart(2, '0')}${ext}`;
    const filepath = path.join(IMG_DIR, filename);

    try {
      await downloadImage(url, filepath);
      downloaded++;
      console.log(`Downloaded: ${filename} (${url.substring(0, 80)}...)`);
    } catch (e) {
      console.log(`Failed: ${filename} - ${e.message}`);
    }
  }

  console.log(`\nTotal downloaded: ${downloaded}/${imageUrls.length}`);

  // Save URLs list
  fs.writeFileSync(path.join(IMG_DIR, 'urls.txt'), imageUrls.join('\n'));
  console.log('URLs saved to images/airbnb/urls.txt');

  await browser.close();
  console.log('Done!');
})();
