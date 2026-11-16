#!/usr/bin/env node

/**
 * scripts/test-scraper-photo-pick.mjs
 * Skrip dry-run untuk menguji pipeline pemilihan foto produk (P1 -> P5)
 * Tanpa menulis data apa pun ke database.
 *
 * Penggunaan:
 *   node scripts/test-scraper-photo-pick.mjs "<URL_PRODUK>"
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env.local jika ada
if (typeof process.loadEnvFile === 'function' && fs.existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

if (!process.env.PG_SEARCH_PATH) {
  process.env.PG_SEARCH_PATH = 'dev,public';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const targetUrl = process.argv[2];
if (!targetUrl) {
  console.error('Penggunaan: node scripts/test-scraper-photo-pick.mjs "<URL_PRODUK>"');
  process.exit(1);
}

async function runDryRun() {
  console.log(`\n======================================================`);
  console.log(`🔍 [DRY-RUN SCRAPER FOTO PRODUK] Memulai Pengujian`);
  console.log(`URL Target: ${targetUrl}`);
  console.log(`======================================================\n`);

  let visionCallsCount = 0;

  // Siapkan folder output
  const timestamp = Date.now();
  const runOutputDir = path.join(projectRoot, 'public', 'temp', 'scraper_dry_run', `run_${timestamp}`);
  fs.mkdirSync(runOutputDir, { recursive: true });

  // 1. Scrape URL & ekstraksi kandidat gambar (P1)
  console.log(`[Langkah 1/5] Menjalankan Playwright Scraper & DOM Gallery Extraction...`);
  const { scrapeUrl, downloadECommerceImage } = await import('../lib/url-scraper.js');
  const scrapeResult = await scrapeUrl(targetUrl);

  const title = scrapeResult?.title || 'Produk Tanpa Nama';
  const candidates = scrapeResult?.imageCandidates || [];
  console.log(`✅ Judul Produk: "${title}"`);
  console.log(`📸 Kandidat Gambar Ditemukan: ${candidates.length} gambar unik\n`);

  candidates.forEach((cand, idx) => {
    console.log(`   [#${idx}] [${cand.source}] ${cand.w || '?'}x${cand.h || '?'} - Alt: "${cand.alt || '-'}"`);
    console.log(`        URL: ${cand.url.slice(0, 100)}...`);
  });

  if (candidates.length === 0) {
    console.warn(`⚠️ Tidak ada kandidat gambar yang ditemukan dari URL ini.`);
    return;
  }

  // 2. Evaluasi & Pemilihan Foto Produk via Gemini Vision (P2)
  console.log(`\n[Langkah 2/5] Mengunduh hingga 6 kandidat dan mengevaluasi via Gemini Vision (1 call)...`);
  const { pickBestProductPhoto } = await import('../lib/product-photo-picker.js');
  const { generateWithImages, generateWithImage } = await import('../lib/gemini.js');

  const wrappedGenerateWithImages = async (imgs, prompt, schema) => {
    visionCallsCount++;
    console.log(`   ⚡ [Vision Call #${visionCallsCount}] generateWithImages (evaluasi kandidat foto)`);
    return generateWithImages(imgs, prompt, schema, null, { traceContext: { stage: 'dry_run_picker' } });
  };

  const photoPickerResult = await pickBestProductPhoto({
    candidates,
    downloadFn: downloadECommerceImage,
    generateWithImagesFn: wrappedGenerateWithImages,
    tempDir: runOutputDir
  });

  console.log(`\n📊 Hasil Evaluasi Foto (P2):`);
  console.log(`   Foto Terpilih: ${photoPickerResult.selectedUrl}`);
  console.log(`   Indeks Terpilih: #${photoPickerResult.selectedCandidate?.index ?? 0}`);
  console.log(`   Status Review Awal: ${photoPickerResult.needsReview ? '⚠️ NEEDS_REVIEW' : '✅ APPROVED'}`);
  if (photoPickerResult.reason) {
    console.log(`   Alasan Review: ${photoPickerResult.reason}`);
  }
  if (photoPickerResult.evaluation?.candidates) {
    console.log(`   Detail Skor AI:`);
    photoPickerResult.evaluation.candidates.forEach(c => {
      console.log(`     - Kandidat #${c.index}: Skor=${c.score}, AdaOrang=${c.has_person}, Teks=${c.text_overlay}, Infografis=${c.is_infographic}, ProdukUtuh=${c.product_visible}`);
    });
  }

  // Unduh foto mentah terpilih
  const rawPath = path.join(runOutputDir, 'raw_selected.png');
  console.log(`\n📥 Mengunduh foto terpilih ke: ${rawPath}`);
  await downloadECommerceImage(photoPickerResult.selectedUrl, rawPath);

  // 3. AI Spatial Smart Crop (P3)
  console.log(`\n[Langkah 3/5] Menjalankan AI Spatial Smart Cropping (mengecualikan orang/model/teks)...`);
  const rawImageBuffer = fs.readFileSync(rawPath);
  const cropPrompt = `Analyze this product photo. There might be multiple variants of the same product. Box the product package only. Exclude any people, faces, hands, models, logos/badges and promotional text. If a person is holding the product, box only the product. Return the bounding box coordinates [ymin, xmin, ymax, xmax] for only that ONE item. Return coordinates as normalized integers from 0 to 1000 representing [ymin, xmin, ymax, xmax]. For example, [0, 0, 1000, 1000] would be the entire image.`;
  const cropResponseSchema = {
    type: 'object',
    properties: {
      ymin: { type: 'integer' },
      xmin: { type: 'integer' },
      ymax: { type: 'integer' },
      xmax: { type: 'integer' }
    },
    required: ['ymin', 'xmin', 'ymax', 'xmax']
  };

  visionCallsCount++;
  console.log(`   ⚡ [Vision Call #${visionCallsCount}] generateWithImage (spatial bounding box)`);
  const cropResultText = await generateWithImage(rawImageBuffer, 'image/png', cropPrompt, cropResponseSchema);
  let croppedPath = rawPath;

  try {
    const cropCoords = JSON.parse(cropResultText);
    console.log(`   Koordinat Crop AI: [ymin=${cropCoords.ymin}, xmin=${cropCoords.xmin}, ymax=${cropCoords.ymax}, xmax=${cropCoords.xmax}]`);
    const sharp = (await import('sharp')).default;
    const metadata = await sharp(rawPath).metadata();
    const left = Math.max(0, Math.round((cropCoords.xmin / 1000) * metadata.width));
    const top = Math.max(0, Math.round((cropCoords.ymin / 1000) * metadata.height));
    const width = Math.min(metadata.width - left, Math.round(((cropCoords.xmax - cropCoords.xmin) / 1000) * metadata.width));
    const height = Math.min(metadata.height - top, Math.round(((cropCoords.ymax - cropCoords.ymin) / 1000) * metadata.height));

    if (width > 10 && height > 10) {
      const croppedBuffer = await sharp(rawPath).extract({ left, top, width, height }).toBuffer();
      croppedPath = path.join(runOutputDir, 'cropped.png');
      fs.writeFileSync(croppedPath, croppedBuffer);
      console.log(`   ✅ Bounding Box Sharp Crop berhasil: ${width}x${height}px -> ${croppedPath}`);
    }
  } catch (cropErr) {
    console.warn(`   ⚠️ AI Crop gagal, memakai gambar mentah:`, cropErr.message);
  }

  // 4. Background Removal & Final Check (P4)
  console.log(`\n[Langkah 4/5] Menjalankan AI Background Removal & Pemeriksaan Akhir...`);
  const { createCleanProductShot } = await import('../lib/bg-remover.js');
  const cleanFilename = `cleaned_${timestamp}.jpg`;
  let cleanRelativePath = '';
  let cleanAbsolutePath = '';

  try {
    cleanRelativePath = await createCleanProductShot(croppedPath, cleanFilename);
    cleanAbsolutePath = path.join(projectRoot, 'public', cleanRelativePath);
    console.log(`   ✅ Background removal selesai: ${cleanAbsolutePath}`);
  } catch (bgErr) {
    console.warn(`   ⚠️ Background removal gagal:`, bgErr.message);
    cleanAbsolutePath = croppedPath;
  }

  // P4 Final Check
  const { verifyCleanProductShot, decidePhotoStatus } = await import('../lib/product-photo-picker.js');
  const wrappedGenerateWithImageForCheck = async (buf, mime, prompt, schema) => {
    visionCallsCount++;
    console.log(`   ⚡ [Vision Call #${visionCallsCount}] generateWithImage (pemeriksaan akhir produk bersih)`);
    return generateWithImage(buf, mime, prompt, schema);
  };

  const finalCheckResult = await verifyCleanProductShot({
    cleanImagePath: cleanAbsolutePath,
    generateWithImageFn: wrappedGenerateWithImageForCheck
  });
  console.log(`   P4 Final Check: has_person=${finalCheckResult.has_person}, has_heavy_text=${finalCheckResult.has_heavy_text}`);

  const photoDecision = decidePhotoStatus({
    pickerNeedsReview: Boolean(photoPickerResult.needsReview),
    pickerReason: photoPickerResult.reason,
    selectedCandidate: photoPickerResult.selectedCandidate,
    finalCheck: finalCheckResult
  });

  console.log(`\n🎯 STATUS AKHIR FOTO: ${photoDecision.status.toUpperCase()}`);
  if (photoDecision.error) {
    console.log(`   Catatan / Error: ${photoDecision.error}`);
  }

  // 5. Validasi Format Reference Image G-Labs (P5)
  console.log(`\n[Langkah 5/5] Memeriksa Format Reference Image G-Labs (P5 Data URI)...`);
  const { bufferToBase64DataUrl, inspectBase64ImageReference } = await import('../lib/base64-image-reference.js');
  let glabsValid = false;
  let referenceCheck = null;
  try {
    const cleanBuffer = fs.readFileSync(cleanAbsolutePath);
    const dataUrl = bufferToBase64DataUrl(cleanBuffer, cleanAbsolutePath);
    referenceCheck = inspectBase64ImageReference(dataUrl);

    console.log(`   MIME Terdeteksi: ${referenceCheck.mimeType}`);
    console.log(`   Ukuran Buffer: ${referenceCheck.byteLength} bytes`);
    console.log(`   Format Valid untuk G-Labs: ✅ VALID`);
    glabsValid = true;
  } catch (refErr) {
    console.log(`   Format Valid untuk G-Labs: ❌ TIDAK VALID (${refErr.message})`);
  }

  // Simpan JSON audit
  const summary = {
    url: targetUrl,
    title,
    visionCallsTotal: visionCallsCount,
    candidatesCount: candidates.length,
    selectedUrl: photoPickerResult.selectedUrl,
    selectedCandidate: photoPickerResult.selectedCandidate,
    pickerEvaluation: photoPickerResult.evaluation,
    finalCheck: finalCheckResult,
    photo_status: photoDecision.status,
    photo_error: photoDecision.error,
    glabsReferenceValid: glabsValid,
    savedFiles: {
      raw: rawPath,
      cropped: croppedPath,
      cleaned: cleanAbsolutePath
    }
  };

  const summaryPath = path.join(runOutputDir, 'dry_run_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log(`\n======================================================`);
  console.log(`🏁 [SELESAI] Hasil dry-run tersimpan di:`);
  console.log(`   📁 ${runOutputDir}`);
  console.log(`   📄 ${summaryPath}`);
  console.log(`   ⚡ Total Panggilan Gemini Vision: ${visionCallsCount}`);
  console.log(`======================================================\n`);
}

runDryRun().catch(err => {
  console.error('\n❌ Fatal error saat menjalankan dry-run:', err);
  process.exit(1);
});
