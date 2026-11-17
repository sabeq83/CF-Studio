import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseHtml } from '../lib/url-scraper.js';

test('P1: parseHtml extracts tokopedia-static.net images, dedupes hashes & prefers highest resolution', () => {
  const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'tokopedia_product_2026.html');
  const html = fs.readFileSync(fixturePath, 'utf8');
  const url = 'https://www.tokopedia.com/toko-herbal/habarlic-5-in-1';

  const domImages = [
    {
      src: 'https://p16-images-sign-sg.tokopedia-static.net/tos-alisg-i-aphluv4xwc-sg/b6b4581bdb0b432a8a6756e451d8a093~tplv-aphluv4xwc-resize-jpeg:1200:0.jpeg',
      w: 1200,
      h: 1200,
      alt: 'Product detail media - 1'
    }
  ];

  const parsed = parseHtml(html, url, domImages);

  assert.ok(parsed.imageCandidates, 'imageCandidates should be defined');
  assert.ok(Array.isArray(parsed.imageCandidates), 'imageCandidates should be an array');
  assert.ok(parsed.imageCandidates.length >= 3, `Expected >= 3 image candidates, got ${parsed.imageCandidates.length}`);

  // DOM image should be first
  assert.equal(parsed.imageCandidates[0].source, 'dom');
  assert.ok(parsed.imageCandidates[0].url.includes('b6b4581bdb0b432a8a6756e451d8a093'));

  // Deduplication: b6b4581bdb0b432a8a6756e451d8a093 should only appear ONCE despite 700px and 1200px in HTML
  const b6Matches = parsed.imageCandidates.filter(c => c.url.includes('b6b4581bdb0b432a8a6756e451d8a093'));
  assert.equal(b6Matches.length, 1, 'Duplicate image hash should be deduplicated to 1 candidate');
  assert.ok(b6Matches[0].url.includes('1200:0'), 'Should retain highest resolution variant');

  // Check that p19 is also captured
  const p19Match = parsed.imageCandidates.find(c => c.url.includes('p19-images-sign-sg.tokopedia-static.net'));
  assert.ok(p19Match, 'Should recognize p19-images-sign-sg.tokopedia-static.net CDN domain');

  // Check fullText retains candidate URLs
  assert.ok(parsed.fullText.includes('GAMBAR PRODUK DITEMUKAN:'), 'fullText should include found images');
  assert.ok(parsed.fullText.includes('b6b4581bdb0b432a8a6756e451d8a093'));
});

test('P1 Regression: parseHtml still detects legacy Tokopedia and Shopee CDN URLs', () => {
  const legacyHtml = `
    <html>
      <head>
        <meta property="og:image" content="https://images.tokopedia.net/img/cache/700/VqbcmM/2022/1/1/legacy_main.jpg">
      </head>
      <body>
        <img src="https://down-id.img.susercontent.com/file/id-11134207-7ras8-m4y93822o70w2c" alt="Shopee Product">
        <img src="https://cf.shopee.co.id/file/shopee_legacy_hash" alt="Shopee Legacy">
        <img src="https://ecs7.tokopedia.net/img/cache/900/VqbcmM/2021/ecs7_image.jpg" alt="Tokopedia ECS7">
      </body>
    </html>
  `;
  const parsed = parseHtml(legacyHtml, 'https://shopee.co.id/test-product');

  assert.ok(parsed.imageCandidates.length >= 3, `Expected >= 3 candidates from legacy HTML, got ${parsed.imageCandidates.length}`);
  const urls = parsed.imageCandidates.map(c => c.url);
  assert.ok(urls.some(u => u.includes('images.tokopedia.net')), 'Should detect images.tokopedia.net');
  assert.ok(urls.some(u => u.includes('susercontent.com')), 'Should detect susercontent.com');
  assert.ok(urls.some(u => u.includes('cf.shopee.co.id')), 'Should detect cf.shopee.co.id');
  assert.ok(urls.some(u => u.includes('ecs7.tokopedia.net')), 'Should detect ecs7.tokopedia.net');
});

test('S3: parseHtml rejects bare domain images and decodes &amp; entities', () => {
  const html = `
    <html>
      <head>
        <meta property="og:image" content="https://images.tokopedia.net/">
      </head>
      <body>
        <!-- Domain only without path or with trailing slash: must be rejected -->
        <img src="https://images.tokopedia.net" alt="Invalid Domain Only 1">
        <img src="https://images.tokopedia.net/" alt="Invalid Domain Only 2">
        <!-- URL with &amp; signature params: must decode to & -->
        <script>
          const data = "https://images.tokopedia.net/img/cache/700/product/photo.jpg?x-expires=123&amp;x-signature=abc";
        </script>
        <!-- Valid URL -->
        <img src="https://images.tokopedia.net/img/cache/700/product/item.jpeg.webp" alt="Valid Product Image">
      </body>
    </html>
  `;

  const parsed = parseHtml(html, 'https://www.tokopedia.com/product/test');
  const urls = parsed.imageCandidates.map(c => c.url);

  // Bare domain should be rejected
  assert.equal(urls.includes('https://images.tokopedia.net'), false, 'Should reject bare domain');
  assert.equal(urls.includes('https://images.tokopedia.net/'), false, 'Should reject bare domain with slash');

  // Valid image with .jpeg.webp must pass
  assert.ok(urls.some(u => u.includes('item.jpeg.webp')), 'Valid item.jpeg.webp should pass');

  // &amp; in regex matches must be decoded to &
  const signedUrl = urls.find(u => u.includes('photo.jpg'));
  assert.ok(signedUrl, 'Signed photo.jpg should pass');
  assert.ok(!signedUrl.includes('&amp;'), '&amp; must be decoded to &');
  assert.ok(signedUrl.includes('&x-signature=abc'), '& signature parameter should be intact');
});
