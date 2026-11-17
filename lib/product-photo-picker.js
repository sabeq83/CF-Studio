import fs from 'node:fs';
import path from 'node:path';
import { detectMimeTypeFromBuffer } from './base64-image-reference.js';

export const PHOTO_PICKER_SCHEMA = {
  type: 'object',
  properties: {
    best_index: { type: 'integer' },
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          has_person: { type: 'boolean' },
          text_overlay: { type: 'string', enum: ['none', 'light', 'heavy'] },
          is_infographic: { type: 'boolean' },
          product_visible: { type: 'boolean' },
          score: { type: 'integer' }
        },
        required: ['index', 'has_person', 'text_overlay', 'is_infographic', 'product_visible', 'score']
      }
    }
  },
  required: ['best_index', 'candidates']
};

export const PHOTO_FINAL_CHECK_SCHEMA = {
  type: 'object',
  properties: {
    has_person: { type: 'boolean' },
    has_heavy_text: { type: 'boolean' }
  },
  required: ['has_person', 'has_heavy_text']
};

export const PHOTO_PICKER_PROMPT = `
Kamu memilih foto referensi produk untuk katalog. Ada N kandidat foto dari listing e-commerce yang sama.
Untuk setiap kandidat, nilai secara teliti:
1. "has_person": apakah ada manusia, model, wajah (termasuk foto tokoh/endorser di banner), tangan memegang yang dominan, atau siluet orang? (true jika ada orang/wajah apapun, false jika murni produk).
2. "text_overlay": seberapa banyak teks promosi/iklan di atas gambar? ("none" = polos tanpa tulisan, "light" = label kecil/watermark samar, "heavy" = banner promosi penuh tulisan diskon/klaim/testimoni).
3. "is_infographic": apakah berupa infografis, tabel nutrisi, diagram klaim, atau kolase panduan? (true jika infografis, false jika foto produk nyata).
4. "product_visible": apakah kemasan atau wujud produk fisik terlihat jelas dan utuh? (true/false).
5. "score": skor kelayakan 0-100 sebagai foto produk bersih (prioritaskan kemasan utuh, latar polos/studio, tanpa orang dan tanpa teks promosi).

Kembalikan "best_index" = indeks kandidat terbaik (prioritaskan produk saja tanpa orang).
`.trim();

export const PHOTO_FINAL_CHECK_PROMPT = `
Periksa foto produk ini setelah proses pembersihan latar belakang.
1. "has_person": Apakah gambar ini memuat manusia, wajah (termasuk tokoh/endorser/model), atau tangan memegang produk?
2. "has_heavy_text": Apakah ada teks promosi besar, banner promo, atau watermark tebal yang menutupi gambar?

Kembalikan JSON terstruktur sesuai skema.
`.trim();

/**
 * R1: Helper untuk mengubah kandidat ke format audit ringkas (whitelist field).
 * Mencegah kebocoran buffer biner ke raw_response database.
 */
export function toAuditCandidate(cand) {
  if (!cand) return null;
  return {
    index: Number(cand.index ?? 0),
    url: cand.url || '',
    source: cand.source || 'dom',
    w: cand.w ? Number(cand.w) : null,
    h: cand.h ? Number(cand.h) : null,
    has_person: Boolean(cand.has_person),
    text_overlay: cand.text_overlay || 'none',
    is_infographic: Boolean(cand.is_infographic),
    product_visible: cand.product_visible !== false,
    score: Number.isFinite(cand.score) ? Number(cand.score) : 50,
    isAcceptable: Boolean(cand.isAcceptable),
    local_path: cand.local_path || null
  };
}

/**
 * Aturan logika pemilihan crop spasial
 */
export function shouldRunSpatialCrop({ isRepair = false, refreshPhoto = false, budgetMode = false } = {}) {
  // Produk baru (!isRepair) atau refresh_photo selalu di-crop
  if (!isRepair || Boolean(refreshPhoto)) return true;
  // Produk lama pada mode hemat budget melewati crop
  if (budgetMode) return false;
  return true;
}

/**
 * R5: Menghitung koordinat crop dengan padding 6% dan evaluasi ambang batas resolusi/luas.
 */
export function computeCropBox({ coords, width, height }) {
  if (!coords || typeof coords.ymin !== 'number' || typeof coords.xmin !== 'number') {
    return { shouldSkip: true, reason: 'koordinat tidak valid', box: null };
  }

  const normW = Math.max(0, coords.xmax - coords.xmin);
  const normH = Math.max(0, coords.ymax - coords.ymin);
  const padX = Math.round(normW * 0.06);
  const padY = Math.round(normH * 0.06);

  const xmin = Math.max(0, coords.xmin - padX);
  const ymin = Math.max(0, coords.ymin - padY);
  const xmax = Math.min(1000, coords.xmax + padX);
  const ymax = Math.min(1000, coords.ymax + padY);

  const left = Math.max(0, Math.round((xmin / 1000) * width));
  const top = Math.max(0, Math.round((ymin / 1000) * height));
  const cropW = Math.min(width - left, Math.round(((xmax - xmin) / 1000) * width));
  const cropH = Math.min(height - top, Math.round(((ymax - ymin) / 1000) * height));

  const longestCrop = Math.max(cropW, cropH);
  const longestSource = Math.max(width, height);
  const areaFraction = (width > 0 && height > 0) ? (cropW * cropH) / (width * height) : 0;

  // Aturan lewati crop:
  // 1. Hasil crop < 800 px pada sisi terpanjang dan sumbernya >= 1000 px
  // 2. Luas crop < 25% dari gambar keseluruhan
  if (longestCrop < 800 && longestSource >= 1000) {
    return {
      shouldSkip: true,
      reason: `resolusi crop (${longestCrop}px) < 800px saat sumber >= 1000px`,
      box: null,
      left: 0,
      top: 0,
      width,
      height
    };
  }

  if (areaFraction < 0.25) {
    return {
      shouldSkip: true,
      reason: `luas crop (${Math.round(areaFraction * 100)}%) < 25% gambar`,
      box: null,
      left: 0,
      top: 0,
      width,
      height
    };
  }

  return {
    shouldSkip: false,
    reason: null,
    box: { left, top, width: cropW, height: cropH },
    left,
    top,
    width: cropW,
    height: cropH
  };
}

/**
 * R2: Aturan logika penentuan status foto akhir (Anti False-Approved).
 */
export function decidePhotoStatus({
  pickerNeedsReview = false,
  pickerReason = null,
  selectedCandidate = null,
  finalCheck = null,
  bgError = false,
  hasNewPhoto = false
} = {}) {
  const reasons = [];

  // 1. Jika picker menandai review
  if (pickerNeedsReview) {
    reasons.push(pickerReason || 'foto memuat orang/teks');
  }

  // 2. Jika kandidat terpilih memuat orang atau produk tidak utuh
  if (selectedCandidate?.has_person) {
    reasons.push('foto mentah memuat orang/model');
  }
  if (selectedCandidate?.product_visible === false) {
    reasons.push('foto mentah tidak memuat produk utuh');
  }

  // 3. Jika penghapusan latar belakang gagal
  if (bgError) {
    reasons.push('hapus latar belakang gagal');
  }

  // 4. Jika foto baru diproses pada run ini tapi finalCheck bermasalah/kosong
  if (hasNewPhoto && !finalCheck) {
    reasons.push('pemeriksaan akhir foto tidak berjalan');
  } else if (finalCheck?.error) {
    reasons.push('pemeriksaan foto gagal');
  } else if (finalCheck && (finalCheck.has_person || finalCheck.has_heavy_text)) {
    reasons.push('foto memuat orang/teks');
  }

  if (reasons.length > 0) {
    const uniqueReasons = [];
    for (const r of reasons) {
      if (r && !uniqueReasons.includes(r)) {
        uniqueReasons.push(r);
      }
    }
    return {
      status: 'needs_review',
      error: uniqueReasons.join('; ')
    };
  }

  return {
    status: 'approved',
    error: null
  };
}

/**
 * R3: Fungsi murni untuk membangun objek update produk pada mode refresh_photo.
 * Mencegah kolom foto terhapus saat refresh gagal.
 */
export function buildRefreshPhotoUpdates({
  existing = {},
  newRaw = null,
  newClean = null,
  newGenerated = null,
  status = 'approved',
  error = null,
  targetImageUrl = '',
  rawResponse = null
} = {}) {
  // Jika unduhan foto baru gagal total, JANGAN ubah kolom foto apa pun
  if (!newRaw) {
    return {
      photo_status: existing.photo_status || 'needs_review',
      photo_error: `refresh foto gagal: ${error || 'foto mentah baru tidak berhasil didapat'}`
    };
  }

  const updates = {
    raw_photo_url: newRaw,
    scraped_image_url: targetImageUrl || existing.scraped_image_url || '',
    clean_photo_url: newClean || existing.clean_photo_url || existing.cleaned_photo_url || newRaw,
    cleaned_photo_url: newClean || existing.cleaned_photo_url || existing.clean_photo_url || newRaw,
    photo_status: status,
    photo_error: error || null
  };

  // Hanya perbarui generated_photo_url jika ada hasil baru; jangan hapus foto lama jika G-Labs gagal
  if (newGenerated) {
    updates.generated_photo_url = newGenerated;
    updates.active_photo = 'generated_photo_url';
    updates.photo_url = newGenerated;
  } else {
    if (existing.generated_photo_url) {
      updates.generated_photo_url = existing.generated_photo_url;
    }
    // Jika ada clean baru tapi generated gagal, arahkan active_photo ke cleaned_photo_url
    if (newClean) {
      updates.active_photo = 'cleaned_photo_url';
      updates.photo_url = newClean;
    } else {
      updates.active_photo = existing.active_photo || 'raw_photo_url';
      updates.photo_url = existing.photo_url || newRaw;
    }
  }

  if (rawResponse) {
    updates.raw_response = rawResponse;
  }

  return updates;
}

/**
 * Evaluasi skor dan kelayakan kandidat foto produk.
 * R1: Hanya menghasilkan data audit ringkas (whitelist) tanpa buffer biner.
 */
export function evaluateCandidateScores(candidates = [], aiResult = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      selectedIndex: -1,
      selectedCandidate: null,
      needsReview: true,
      reason: 'tidak ada kandidat foto',
      evaluated: []
    };
  }

  const aiList = Array.isArray(aiResult?.candidates) ? aiResult.candidates : [];

  const evaluated = candidates.map((cand, idx) => {
    const aiItem = aiList.find(c => Number(c.index) === idx) || {};
    const hasPerson = Boolean(aiItem.has_person);
    const isInfographic = Boolean(aiItem.is_infographic);
    const textOverlay = aiItem.text_overlay || 'none';
    const productVisible = aiItem.product_visible !== false;
    const score = Number.isFinite(aiItem.score) ? Number(aiItem.score) : 50;

    const isAcceptable = !hasPerson && !isInfographic && textOverlay !== 'heavy' && productVisible;
    const resScore = (Number(cand.w) || 0) * (Number(cand.h) || 0);

    const item = {
      index: idx,
      url: cand.url,
      source: cand.source || 'dom',
      w: cand.w || null,
      h: cand.h || null,
      has_person: hasPerson,
      is_infographic: isInfographic,
      text_overlay: textOverlay,
      product_visible: productVisible,
      score,
      resScore,
      isAcceptable,
      local_path: cand.local_path || null
    };

    return toAuditCandidate(item);
  });

  const acceptable = evaluated.filter(c => c.isAcceptable);

  if (acceptable.length > 0) {
    // Urutkan dari skor AI tertinggi, jika seri pilih resolusi terbesar
    acceptable.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const resA = (Number(a.w) || 0) * (Number(a.h) || 0);
      const resB = (Number(b.w) || 0) * (Number(b.h) || 0);
      return resB - resA;
    });

    const chosen = acceptable[0];
    return {
      selectedIndex: chosen.index,
      selectedCandidate: chosen,
      needsReview: false,
      reason: null,
      evaluated
    };
  }

  // Jika SEMUA tertolak (misal semua memuat orang/infografis)
  evaluated.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const resA = (Number(a.w) || 0) * (Number(a.h) || 0);
    const resB = (Number(b.w) || 0) * (Number(b.h) || 0);
    return resB - resA;
  });

  const fallback = evaluated[0];
  return {
    selectedIndex: fallback ? fallback.index : 0,
    selectedCandidate: fallback || toAuditCandidate(candidates[0]),
    needsReview: true,
    reason: 'semua kandidat memuat orang/teks',
    evaluated
  };
}

/**
 * Memilih foto produk terbaik menggunakan Gemini Vision (1 call multi-image).
 * R1/R7: Menyimpan file kandidat ke public/uploads/products/candidates/<productId>/
 */
export async function pickBestProductPhoto({
  candidates = [],
  downloadFn,
  generateWithImagesFn,
  productId = null,
  tempDir = path.join(process.cwd(), 'public', 'temp', 'photo_picker')
} = {}) {
  const { isValidProductImageUrl } = await import('./url-scraper.js');
  const validCandidates = (Array.isArray(candidates) ? candidates : []).filter(c => isValidProductImageUrl(c?.url));

  if (!validCandidates || validCandidates.length === 0) {
    return {
      selectedUrl: null,
      selectedCandidate: null,
      needsReview: true,
      reason: 'tidak ada kandidat gambar yang valid',
      evaluation: null
    };
  }

  // Ambil maksimal 6 kandidat teratas
  const pool = validCandidates.slice(0, 6);

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // R7: Folder permanen penyimpanan kandidat produk
  let candidateStorageDir = null;
  if (productId) {
    candidateStorageDir = path.join(process.cwd(), 'public', 'uploads', 'products', 'candidates', productId);
    try {
      if (fs.existsSync(candidateStorageDir)) {
        // Bersihkan isi folder lama saat refresh
        const oldFiles = fs.readdirSync(candidateStorageDir);
        for (const file of oldFiles) {
          try { fs.unlinkSync(path.join(candidateStorageDir, file)); } catch (_) {}
        }
      } else {
        fs.mkdirSync(candidateStorageDir, { recursive: true });
      }
    } catch (dirErr) {
      console.warn(`[Photo Picker] Gagal menyiapkan candidateStorageDir:`, dirErr.message);
    }
  }

  const downloaded = [];
  const visionImages = [];

  for (let idx = 0; idx < pool.length; idx++) {
    const cand = pool[idx];
    const tempFile = path.join(tempDir, `cand_${Date.now()}_${idx}.jpg`);
    let ok = false;
    try {
      if (typeof downloadFn === 'function') {
        ok = await downloadFn(cand.url, tempFile);
      }
    } catch (dlErr) {
      console.warn(`[Photo Picker] Gagal mengunduh kandidat #${idx} (${cand.url}):`, dlErr.message);
      ok = false;
    }

    if (ok && fs.existsSync(tempFile)) {
      try {
        const buf = fs.readFileSync(tempFile);
        if (buf.length >= 500) {
          const detectedMime = detectMimeTypeFromBuffer(buf) || 'image/jpeg';
          let localPath = null;

          // R7: Simpan kandidat ke storage permanen jika candidateStorageDir tersedia
          if (candidateStorageDir) {
            const ext = detectedMime === 'image/png' ? 'png' : (detectedMime === 'image/webp' ? 'webp' : 'jpg');
            const targetFilename = `cand_${idx}.${ext}`;
            const targetAbs = path.join(candidateStorageDir, targetFilename);
            try {
              fs.writeFileSync(targetAbs, buf);
              localPath = `/uploads/products/candidates/${productId}/${targetFilename}`;
            } catch (saveErr) {
              console.warn(`[Photo Picker] Gagal menyimpan kandidat permanen #${idx}:`, saveErr.message);
            }
          }

          downloaded.push({
            ...cand,
            local_path: localPath,
            tempPath: tempFile,
            buffer: buf,
            mimeType: detectedMime
          });
          visionImages.push({
            buffer: buf,
            mimeType: detectedMime,
            label: `Kandidat #${downloaded.length - 1} (Sumber: ${cand.source}, Resolusi: ${cand.w || 'auto'}x${cand.h || 'auto'})`
          });
        } else {
          try { fs.unlinkSync(tempFile); } catch (_) {}
        }
      } catch (readErr) {
        console.warn(`[Photo Picker] Gagal membaca buffer file #${idx}:`, readErr.message);
      }
    }
  }

  // Bersihkan file temporary tempDir setelah di-buffer
  const cleanupTempFiles = () => {
    for (const item of downloaded) {
      if (item.tempPath && fs.existsSync(item.tempPath)) {
        try { fs.unlinkSync(item.tempPath); } catch (_) {}
      }
    }
  };

  if (visionImages.length === 0) {
    console.warn('[Photo Picker] Tidak ada gambar kandidat yang berhasil diunduh.');
    const firstCand = toAuditCandidate(pool[0]);
    return {
      selectedUrl: pool[0].url,
      selectedCandidate: firstCand,
      needsReview: true,
      reason: 'gagal mengunduh semua kandidat gambar',
      evaluation: null
    };
  }

  // Jika hanya 1 kandidat yang berhasil diunduh dan tidak ada pembanding
  if (visionImages.length === 1 && pool.length === 1) {
    cleanupTempFiles();
    const singleCand = toAuditCandidate(downloaded[0]);
    return {
      selectedUrl: downloaded[0].url,
      selectedCandidate: singleCand,
      needsReview: false,
      reason: null,
      evaluation: {
        selectedIndex: 0,
        selectedCandidate: singleCand,
        needsReview: false,
        reason: null,
        evaluated: [singleCand]
      }
    };
  }

  try {
    console.log(`[Photo Picker] Mengirim ${visionImages.length} kandidat foto ke Gemini Vision untuk evaluasi multi-image...`);
    const responseText = await generateWithImagesFn(visionImages, PHOTO_PICKER_PROMPT, PHOTO_PICKER_SCHEMA);
    const parsed = typeof responseText === 'string' ? JSON.parse(responseText) : responseText;

    const evaluation = evaluateCandidateScores(downloaded, parsed);
    cleanupTempFiles();

    console.log(`[Photo Picker] Hasil pemilihan foto: Index #${evaluation.selectedIndex}, URL: ${evaluation.selectedCandidate?.url}, NeedsReview: ${evaluation.needsReview}`);

    return {
      selectedUrl: evaluation.selectedCandidate?.url || pool[0].url,
      selectedCandidate: evaluation.selectedCandidate || toAuditCandidate(pool[0]),
      needsReview: evaluation.needsReview,
      reason: evaluation.reason,
      evaluation
    };
  } catch (visionErr) {
    console.error('[Photo Picker] Error panggilan Gemini Vision:', visionErr.message);
    cleanupTempFiles();
    const safeFallback = pool.find(c => c.source === 'dom' || c.source === 'og') || pool[0];
    const fallbackAudit = toAuditCandidate(safeFallback);
    return {
      selectedUrl: safeFallback.url,
      selectedCandidate: fallbackAudit,
      needsReview: true,
      reason: 'pemilihan foto otomatis gagal',
      evaluation: null
    };
  }
}

/**
 * Pemeriksaan akhir foto clean (P4)
 */
export async function verifyCleanProductShot({
  cleanImagePath,
  generateWithImageFn
} = {}) {
  if (!cleanImagePath || !fs.existsSync(cleanImagePath)) {
    return { error: 'file clean tidak ditemukan', has_person: false, has_heavy_text: false };
  }

  try {
    const buf = fs.readFileSync(cleanImagePath);
    const mime = cleanImagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const resText = await generateWithImageFn(buf, mime, PHOTO_FINAL_CHECK_PROMPT, PHOTO_FINAL_CHECK_SCHEMA);
    const parsed = typeof resText === 'string' ? JSON.parse(resText) : resText;
    return {
      has_person: Boolean(parsed.has_person),
      has_heavy_text: Boolean(parsed.has_heavy_text)
    };
  } catch (err) {
    console.warn('[Photo Picker] P4 Final Check vision error:', err.message);
    return {
      error: err.message,
      has_person: true, // Fail-safe: jika API gagal, tandai review
      has_heavy_text: false
    };
  }
}

/**
 * R7: Ekstraksi pipeline pemrosesan foto dari raw image ke clean product shot.
 * Dipakai bersama oleh scraper utama dan endpoint photo-replace.
 */
export async function processProductPhotoFromRaw({
  productId,
  rawAbsPath,
  runCrop = true,
  pickerNeedsReview = false,
  pickerReason = null,
  selectedCandidate = null,
  generateWithImageFn,
  createCleanProductShotFn
} = {}) {
  if (!rawAbsPath || !fs.existsSync(rawAbsPath)) {
    throw new Error(`File raw foto tidak ditemukan di ${rawAbsPath}`);
  }

  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  let processInputPath = rawAbsPath;
  let cropApplied = false;

  // 1. Spatial Smart Cropping (jika runCrop diaktifkan)
  if (runCrop && typeof generateWithImageFn === 'function') {
    try {
      const sharp = (await import('sharp')).default;
      const metadata = await sharp(rawAbsPath).metadata();
      const rawBuffer = fs.readFileSync(rawAbsPath);

      const cropPrompt = `Analyze this product photo. Box the complete product package set shown (for example the bottle together with its box). If several identical variants appear side by side, box only one complete set. Exclude any people, faces, hands, models, logos/badges and promotional text. If a person is holding the product, box only the product set. Return the bounding box coordinates [ymin, xmin, ymax, xmax] as normalized integers from 0 to 1000.`;

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

      const cropResultText = await generateWithImageFn(
        rawBuffer,
        'image/png',
        cropPrompt,
        cropResponseSchema
      );

      const cropCoords = typeof cropResultText === 'string' ? JSON.parse(cropResultText) : cropResultText;
      const cropDecision = computeCropBox({
        coords: cropCoords,
        width: metadata.width,
        height: metadata.height
      });

      if (!cropDecision.shouldSkip && cropDecision.box) {
        const cropDir = path.dirname(rawAbsPath);
        const cropFilename = `raw_${productId}_${ts}_crop.png`;
        const cropAbsPath = path.join(cropDir, cropFilename);

        const croppedBuffer = await sharp(rawAbsPath)
          .extract(cropDecision.box)
          .toBuffer();
        fs.writeFileSync(cropAbsPath, croppedBuffer);
        processInputPath = cropAbsPath;
        cropApplied = true;
        console.log(`[Photo Pipeline] Crop diterapkan:`, cropDecision.box);
      } else {
        console.log(`[Photo Pipeline] Crop dilewati:`, cropDecision.reason);
      }
    } catch (cropErr) {
      console.warn(`[Photo Pipeline] Smart Crop error (menggunakan raw asli):`, cropErr.message);
    }
  }

  // 2. AI Background Removal (Rembg / Imgly)
  let cleanPhotoPath = null;
  let bgError = false;
  const cleanFilename = `clean_${productId}_${ts}.jpg`;

  try {
    const cleanFn = createCleanProductShotFn || (await import('./bg-remover.js')).createCleanProductShot;
    cleanPhotoPath = await cleanFn(processInputPath, cleanFilename);
  } catch (err) {
    console.warn(`[Photo Pipeline] Hapus latar belakang gagal:`, err.message);
    bgError = true;
  }

  // 3. P4 Final Check pada Foto Clean
  let finalCheckResult = null;
  if (cleanPhotoPath && !bgError && typeof generateWithImageFn === 'function') {
    const cleanAbsPath = path.join(process.cwd(), 'public', cleanPhotoPath);
    finalCheckResult = await verifyCleanProductShot({
      cleanImagePath: cleanAbsPath,
      generateWithImageFn
    });
  }

  // 4. Tentukan Status Akhir Foto
  const photoDecision = decidePhotoStatus({
    pickerNeedsReview: Boolean(pickerNeedsReview),
    pickerReason: pickerReason || null,
    selectedCandidate: selectedCandidate || null,
    finalCheck: finalCheckResult,
    bgError,
    hasNewPhoto: true
  });

  return {
    success: !bgError,
    cropApplied,
    cleanPhotoPath,
    photoStatus: photoDecision.status,
    photoError: photoDecision.error,
    finalCheck: finalCheckResult,
    ts
  };
}
