import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { computeCropBox } from '../lib/product-photo-picker.js';
import { isPlainWhiteBackground, createCleanProductShot } from '../lib/bg-remover.js';

test('S8: computeCropBox applies exactly 10% padding to bounding box', () => {
  // 1000x1000 image, object at [ymin: 100, xmin: 300, ymax: 800, xmax: 700]
  // normW = 400, padX = 40 -> xmin = 260, xmax = 740 -> width = 480 px
  // normH = 700, padY = 70 -> ymin = 30, ymax = 870 -> height = 840 px (longestCrop 840 >= 800)
  const coords = { ymin: 100, xmin: 300, ymax: 800, xmax: 700 };
  const result = computeCropBox({ coords, width: 1000, height: 1000 });

  assert.equal(result.shouldSkip, false);
  assert.equal(result.left, 260, 'Left should be padded by 10% normW (40 norm)');
  assert.equal(result.top, 30, 'Top should be padded by 10% normH (70 norm)');
  assert.equal(result.width, 480, 'Width should be 400 + 2*40 = 480 px');
  assert.equal(result.height, 840, 'Height should be 700 + 2*70 = 840 px');
});

test('S8: isPlainWhiteBackground detects pure white and near-white borders', async () => {
  // 1. Gambar latar putih dengan objek di tengah
  const whiteBgBuffer = await sharp({
    create: {
      width: 200,
      height: 200,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
  .composite([
    {
      // Objek abu/hitam di tengah (x: 50..150, y: 50..150), tidak menyentuh strip tepi 4% (8px)
      input: await sharp({
        create: {
          width: 80,
          height: 80,
          channels: 3,
          background: { r: 80, g: 80, b: 80 }
        }
      }).png().toBuffer(),
      top: 60,
      left: 60
    }
  ])
  .jpeg()
  .toBuffer();

  const isWhite = await isPlainWhiteBackground(whiteBgBuffer);
  assert.equal(isWhite, true, 'Gambar dengan tepi putih solid harus terdeteksi true');

  // 2. Gambar latar warna (pink e-commerce Tokopedia / Shopee)
  const pinkBgBuffer = await sharp({
    create: {
      width: 200,
      height: 200,
      channels: 3,
      background: { r: 255, g: 182, b: 193 } // Pink
    }
  })
  .jpeg()
  .toBuffer();

  const isPinkWhite = await isPlainWhiteBackground(pinkBgBuffer);
  assert.equal(isPinkWhite, false, 'Gambar dengan latar pink harus terdeteksi false');
});

test('S8: createCleanProductShot bypasses rembg on white background image', async () => {
  const tempDir = path.join(process.cwd(), 'public', 'temp', 'test_rembg_s8');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const inputPath = path.join(tempDir, 'white_input.jpg');
  const outputFilename = `clean_test_s8_${Date.now()}.jpg`;

  // Buat file putih dengan objek di tengah
  await sharp({
    create: {
      width: 200,
      height: 200,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
  .composite([
    {
      input: await sharp({
        create: {
          width: 60,
          height: 60,
          channels: 3,
          background: { r: 50, g: 150, b: 200 }
        }
      }).png().toBuffer(),
      top: 70,
      left: 70
    }
  ])
  .jpeg()
  .toFile(inputPath);

  const cleanRelPath = await createCleanProductShot(inputPath, outputFilename);
  assert.ok(cleanRelPath.includes(outputFilename));

  const cleanAbsPath = path.join(process.cwd(), 'public', cleanRelPath);
  assert.ok(fs.existsSync(cleanAbsPath), 'Clean product image file must be generated');

  // Cleanup
  try {
    fs.unlinkSync(inputPath);
    fs.unlinkSync(cleanAbsPath);
    fs.rmdirSync(tempDir);
  } catch (_) {}
});
