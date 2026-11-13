// Capture transparent overlay frames from overlay.html using the cfstudio Playwright install.
const { createRequire } = require('module');
const path = require('path');
const fs = require('fs');
const req = createRequire('/Users/sabeqmmursyid/_cfstudio/package.json');
const { chromium } = req('playwright');

const dir = __dirname;
const outDir = path.join(dir, 'frames');
const FPS = 30;

(async () => {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(dir, 'overlay.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const meta = await page.evaluate(() => window.META);
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 1));
  const fonts = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight));
  console.log('fonts loaded:', [...new Set(fonts)].join(', '));
  const n = Math.ceil(meta.dur * FPS);
  const phone = await page.$('#phone');
  for (let i = 0; i < n; i++) {
    await page.evaluate(t => window.renderAt(t), i / FPS);
    await phone.screenshot({ path: path.join(outDir, `f_${String(i).padStart(4, '0')}.png`), omitBackground: true });
    if (i % 90 === 0) console.log('frame', i, '/', n);
  }
  await browser.close();
  console.log('done', n, 'frames');
})().catch(e => { console.error(e); process.exit(1); });
