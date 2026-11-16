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
 * Aturan logika penentuan status foto akhir
 */
export function decidePhotoStatus({
  pickerNeedsReview = false,
  pickerReason = null,
  selectedCandidate = null,
  finalCheck = null
} = {}) {
  if (finalCheck?.error) {
    return {
      status: 'needs_review',
      error: 'pemeriksaan foto gagal'
    };
  }

  if (finalCheck && (finalCheck.has_person || finalCheck.has_heavy_text)) {
    return {
      status: 'needs_review',
      error: 'foto memuat orang/teks'
    };
  }

  // Jika kandidat terpilih memuat orang
  if (selectedCandidate?.has_person) {
    return {
      status: 'needs_review',
      error: 'foto mentah memuat orang/model'
    };
  }

  // Jika kandidat terpilih tidak memuat wujud produk fisik yang jelas
  if (selectedCandidate?.product_visible === false) {
    return {
      status: 'needs_review',
      error: 'foto mentah tidak memuat produk utuh'
    };
  }

  // Jika picker error/fallback (misal API timeout atau tanpa kandidat)
  if (pickerNeedsReview && (!selectedCandidate || pickerReason === 'pemilihan foto otomatis gagal' || pickerReason === 'tidak ada kandidat gambar')) {
    return {
      status: 'needs_review',
      error: pickerReason || 'foto memuat orang/teks'
    };
  }

  return {
    status: 'approved',
    error: null
  };
}

/**
 * Evaluasi skor dan kelayakan kandidat foto produk
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

    return {
      ...cand,
      index: idx,
      has_person: hasPerson,
      is_infographic: isInfographic,
      text_overlay: textOverlay,
      product_visible: productVisible,
      score,
      resScore,
      isAcceptable
    };
  });

  const acceptable = evaluated.filter(c => c.isAcceptable);

  if (acceptable.length > 0) {
    // Urutkan dari skor AI tertinggi, jika seri pilih resolusi terbesar
    acceptable.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.resScore - a.resScore;
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
    return b.resScore - a.resScore;
  });

  const fallback = evaluated[0];
  return {
    selectedIndex: fallback ? fallback.index : 0,
    selectedCandidate: fallback || candidates[0],
    needsReview: true,
    reason: 'semua kandidat memuat orang/teks',
    evaluated
  };
}

/**
 * Memilih foto produk terbaik menggunakan Gemini Vision (1 call multi-image)
 */
export async function pickBestProductPhoto({
  candidates = [],
  downloadFn,
  generateWithImagesFn,
  tempDir = path.join(process.cwd(), 'public', 'temp', 'photo_picker')
} = {}) {
  if (!candidates || candidates.length === 0) {
    return {
      selectedUrl: null,
      needsReview: true,
      reason: 'tidak ada kandidat gambar',
      evaluation: null
    };
  }

  // Ambil maksimal 6 kandidat teratas
  const pool = candidates.slice(0, 6);

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
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
          downloaded.push({ ...cand, localPath: tempFile, buffer: buf, mimeType: detectedMime });
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

  // Bersihkan file temporary setelah selesai di-buffer
  const cleanupTempFiles = () => {
    for (const item of downloaded) {
      if (item.localPath && fs.existsSync(item.localPath)) {
        try { fs.unlinkSync(item.localPath); } catch (_) {}
      }
    }
  };

  if (visionImages.length === 0) {
    console.warn('[Photo Picker] Tidak ada gambar kandidat yang berhasil diunduh. Menggunakan kandidat pertama sebagai cadangan.');
    const firstCand = pool[0];
    return {
      selectedUrl: firstCand.url,
      selectedCandidate: firstCand,
      needsReview: true,
      reason: 'gagal mengunduh semua kandidat gambar',
      evaluation: null
    };
  }

  // Jika hanya 1 kandidat yang berhasil diunduh dan tidak ada pembanding
  if (visionImages.length === 1 && pool.length === 1) {
    cleanupTempFiles();
    return {
      selectedUrl: downloaded[0].url,
      selectedCandidate: downloaded[0],
      needsReview: false,
      reason: null,
      evaluation: null
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
      selectedCandidate: evaluation.selectedCandidate || pool[0],
      needsReview: evaluation.needsReview,
      reason: evaluation.reason,
      evaluation
    };
  } catch (visionErr) {
    console.error('[Photo Picker] Error panggilan Gemini Vision:', visionErr.message);
    cleanupTempFiles();
    // Fallback: pilih kandidat DOM/OG pertama
    const safeFallback = pool.find(c => c.source === 'dom' || c.source === 'og') || pool[0];
    return {
      selectedUrl: safeFallback.url,
      selectedCandidate: safeFallback,
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
