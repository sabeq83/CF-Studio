import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { detectNotFoundPage, isValidProductImageUrl } from '../lib/url-scraper.js';

test('S2: detectNotFoundPage accurately flags Tokopedia 404 fixture', () => {
  const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'tokopedia_404_2026.html');
  const html = fs.readFileSync(fixturePath, 'utf8');

  const result = detectNotFoundPage({
    httpStatus: 200,
    title: 'Situs Jual Beli Online Terlengkap, Mudah & Aman | Tokopedia',
    bodyText: 'Waduh, tujuanmu nggak ada! Mungkin kamu salah jalan atau alamat. Ayo balik sebelum gelap! Kembali',
    html
  });

  assert.equal(result.notFound, true);
  assert.ok(result.reason.includes('tujuanmu nggak ada') || result.reason.includes('tidak ditemukan'));
});

test('S2: detectNotFoundPage allows valid product fixture to pass', () => {
  const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'tokopedia_product_2026.html');
  const html = fs.readFileSync(fixturePath, 'utf8');

  const result = detectNotFoundPage({
    httpStatus: 200,
    title: 'Habarlic 5 in 1 Suplemen Herbal Bawang Putih dan Habbatussauda',
    bodyText: 'Rp 125.000 Detail produk Habarlic 5 in 1 mengandung ekstrak bawang putih lanang...',
    html
  });

  assert.equal(result.notFound, false);
  assert.equal(result.reason, null);
});

test('S2: detectNotFoundPage flags HTTP 404 and 410 regardless of content', () => {
  const res404 = detectNotFoundPage({ httpStatus: 404 });
  assert.equal(res404.notFound, true);
  assert.ok(res404.reason.includes('404'));

  const res410 = detectNotFoundPage({ httpStatus: 410 });
  assert.equal(res410.notFound, true);
  assert.ok(res410.reason.includes('410'));
});

test('S2: detectNotFoundPage flags empty page lacking both price and product detail markers', () => {
  const emptyRes = detectNotFoundPage({
    httpStatus: 200,
    title: 'Halaman Kosong',
    bodyText: 'Halaman ini tidak berisi apa-apa dan tidak ada info.',
    html: '<div>Halaman ini tidak berisi apa-apa dan tidak ada info.</div>'
  });

  assert.equal(emptyRes.notFound, true);
  assert.ok(emptyRes.reason.includes('tidak memiliki indikator harga'));
});

test('S3: isValidProductImageUrl validates URL structure and rejects domain-only strings', () => {
  // Domain only / empty path
  assert.equal(isValidProductImageUrl('https://images.tokopedia.net'), false);
  assert.equal(isValidProductImageUrl('https://images.tokopedia.net/'), false);
  assert.equal(isValidProductImageUrl(''), false);
  assert.equal(isValidProductImageUrl(null), false);
  assert.equal(isValidProductImageUrl('not-a-url'), false);

  // Valid image URLs
  assert.equal(isValidProductImageUrl('https://images.tokopedia.net/img/cache/700/product-1/2026/test.jpeg.webp'), true);
  assert.equal(isValidProductImageUrl('https://p16-images-sign-sg.tokopedia-static.net/tos-alisg-i-aphluv4xwc-sg/b6b4581b~tplv-aphluv4xwc-resize-jpeg:700:0.jpeg'), true);
  assert.equal(isValidProductImageUrl('https://down-id.img.susercontent.com/file/id-11134207-7r98r-lkt6h50f2p563f'), true);
  assert.equal(isValidProductImageUrl('https://cf.shopee.co.id/file/id-11134207-7r98r-lkt6h50f2p563f.jpg'), true);
});
