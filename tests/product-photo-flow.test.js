import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { processProductPhotoFromRaw, decidePhotoStatus } from '../lib/product-photo-picker.js';

test('S1: decidePhotoStatus combines multiple error reasons into photo_error', () => {
  const result = decidePhotoStatus({
    pickerNeedsReview: true,
    pickerReason: 'semua kandidat ditolak',
    bgError: true,
    hasNewPhoto: true,
    finalCheck: { has_person: true, has_heavy_text: true }
  });

  assert.equal(result.status, 'needs_review');
  assert.ok(result.error.includes('semua kandidat ditolak'));
  assert.ok(result.error.includes('hapus latar belakang gagal'));
  assert.ok(result.error.includes('foto memuat orang/teks'));
  assert.ok(result.error.includes('; '), 'Multiple reasons must be joined by semicolon');
});

test('S1: processProductPhotoFromRaw executes crop, clean, and final check without ReferenceError', async () => {
  const sharp = (await import('sharp')).default;
  const tempDir = path.join(process.cwd(), 'public', 'temp', 'test_photo_flow');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Create a minimal 400x400 test image
  const testRawFile = path.join(tempDir, 'raw_test_prod_123.png');
  await sharp({
    create: {
      width: 400,
      height: 400,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  }).png().toFile(testRawFile);

  const mockGenerateWithImage = async (buffer, mime, prompt) => {
    if (prompt.includes('Bounding Box') || prompt.includes('Box the complete product')) {
      return JSON.stringify({ ymin: 100, xmin: 100, ymax: 900, xmax: 900 });
    }
    if (prompt.includes('pemeriksaan foto') || prompt.includes('has_person')) {
      return JSON.stringify({ has_person: false, has_heavy_text: false });
    }
    return JSON.stringify({});
  };

  const mockCreateCleanProductShot = async (inputPath, filename) => {
    assert.ok(fs.existsSync(inputPath), `Input file must exist: ${inputPath}`);
    const cleanDir = path.join(process.cwd(), 'public', 'temp', 'test_photo_flow');
    const cleanAbs = path.join(cleanDir, filename);
    fs.writeFileSync(cleanAbs, fs.readFileSync(inputPath));
    // Return relative path from public
    return `/temp/test_photo_flow/${filename}`;
  };

  const result = await processProductPhotoFromRaw({
    productId: 'test_prod_123',
    rawAbsPath: testRawFile,
    runCrop: true,
    generateWithImageFn: mockGenerateWithImage,
    createCleanProductShotFn: mockCreateCleanProductShot
  });

  assert.equal(result.success, true);
  assert.equal(result.cropApplied, true);
  assert.ok(result.cleanPhotoPath.includes('clean_test_prod_123'));
  assert.equal(result.photoStatus, 'approved');
  assert.equal(result.photoError, null);

  // Clean up
  try {
    if (fs.existsSync(testRawFile)) fs.unlinkSync(testRawFile);
    const cropFile = path.join(tempDir, `raw_test_prod_123_${result.ts}_crop.png`);
    if (fs.existsSync(cropFile)) fs.unlinkSync(cropFile);
    fs.rmdirSync(tempDir);
  } catch (_) {}
});
