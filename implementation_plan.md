# Implementation Plan — Fitur Scraper Foto Galeri & Rubrik E-Commerce (Revisi 02 Bagian B)

Tanggal: 17 November 2026 · Branch: `fitur/scraper-foto-galeri-r02` · Basis: `main` (`v2.50.4` / `b73ebd2`)  
Dokumen Panduan: [antigravity_scraper_foto_produk_revisi_02.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/instruksi-agent/antigravity_scraper_foto_produk_revisi_02.md)  
Target Deployment: Server **Dev** Mac Mini (`100.95.245.55:5020`)

---

## 1. Ringkasan Tujuan (S5–S9 & Perbaikan Kecil)

1. **S5 (Galeri Lengkap ≥ 5 Kandidat ≥ 600px)**:
   - Pada `scrapeUrlPlaywright()` di `lib/playwright-scraper.js`: tambahkan interaksi thumbnail galeri (hover/klik hingga 8 thumbnail), tunggu `currentSrc` foto utama berganti untuk menangkap URL beresolusi tinggi dengan signature valid.
   - Pemicu scroll galeri agar gambar lazy-load termuat.
   - Eksperimen varian resolusi aman (coba `:700:0`/`:1200:0` atau `/img/cache/900/` hanya jika HTTP 200 dan Sharp membaca ≥ 600px; fallback ke `currentSrc`).
   - Saring kandidat < 600px kecuali kandidat ≥ 600px kurang dari 2.
   - Catat jumlah kandidat dan resolusi di log job dan data audit.

2. **S6 (Rubrik Photo Picker Lebih Longgar untuk E-Commerce Indonesia)**:
   - Tambahkan field schema `text_area_pct` (integer 0–100) dan `is_collage` (boolean) di `PHOTO_PICKER_SCHEMA`.
   - Perbarui `PHOTO_PICKER_PROMPT` dengan contoh praktis e-commerce: label spesifikasi kecil ("750ml", "1000ML", "SU304"), garis dimensi, logo brand kecil di pojok, dan latar polos tidak menggugurkan jika produk utuh.
   - Di `evaluateCandidateScores`: tolak hanya jika `has_person`, `is_collage`, `!product_visible`, atau (`is_infographic` dan `text_area_pct > 30`). `text_overlay` saja tidak lagi menggugurkan.
   - Tambahkan fixture tes `tests/fixtures/photo_picker_cuculemon_eval.json` (Cuculemon lolos, banner berwajah Habarlic tetap ditolak).

3. **S7 (Penanganan Kandidat Ditolak → Tetap Hasilkan Foto Clean untuk Ditinjau)**:
   - Jika semua kandidat tertolak di rubrik ketat, tetapi ada kandidat **tanpa orang** dengan skor ≥ 70: pilih yang tertinggi, jalankan crop + rembg + final check, status `needs_review` dengan pesan `photo_error: "dipilih otomatis, perlu ditinjau"` (operator cukup klik "Setujui Foto").
   - Jika semua kandidat memuat orang atau skor < 70: simpan raw saja tanpa clean, status `needs_review` (`"tidak ada foto layak, ganti foto manual"`).
   - Lewati G-Labs untuk status `needs_review`.

4. **S8 (Margin Spatial Crop 10% & Bypass Rembg Latar Putih)**:
   - Ubah padding crop di `computeCropBox()` dari 6% menjadi **10%** per sisi (dibatasi 0–1000).
   - Implementasikan fungsi murni `isPlainWhiteBackground(buffer)`: periksa strip tepi 4% di tiap sisi. Jika ≥ 95% piksel tepi memiliki luminansi ≥ 245 dan saturasi rendah, lewati rembg (cukup ratakan kanvas putih dengan sharp). Mencegah bagian kemasan putih terhapus.

5. **S9 (Enrichment Gagal Kuota: Jelas dan Bisa Diulang)**:
   - Di `lib/product-bulk-worker.js`: tangkap error kuota/rate limit/503 dan beri prefix `QUOTA_EXHAUSTED (dapat diulang): `.
   - Di `app/api/v2/products/[id]/route.js`: tambahkan field dinamis `enrichment_retryable: true` dan hint retry jika error kuota.
   - Verifikasi antrean ulang di `/api/v2/products/re-enrich` (`cf_enrich_product`).
   - Buat/perbarui mockup UI untuk menampilkan badge retry kuota dan sinkronkan ke Mac Mini Staging untuk review.

6. **Perbaikan Kecil**:
   - Pastikan label trace Gemini pada crop dan final check menggunakan `traceContext: { stage: 'product_photo_crop' }` dan `product_photo_final_check` (bukan default `start_frame_visual_qc`).

---

## 2. Before & After Code Snippets

### 2.1. `lib/product-photo-picker.js` (S6 & S7)

#### Sebelum (Current/Before):
```javascript
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

// Di evaluateCandidateScores:
const isAcceptable = !hasPerson && !isInfographic && textOverlay !== 'heavy' && productVisible;
```

#### Sesudah (Proposed/After):
```javascript
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
          text_area_pct: { type: 'integer' },
          is_infographic: { type: 'boolean' },
          is_collage: { type: 'boolean' },
          product_visible: { type: 'boolean' },
          score: { type: 'integer' }
        },
        required: ['index', 'has_person', 'text_overlay', 'text_area_pct', 'is_infographic', 'is_collage', 'product_visible', 'score']
      }
    }
  },
  required: ['best_index', 'candidates']
};

// Di evaluateCandidateScores:
const isAcceptable = !hasPerson && !isCollage && productVisible && !(isInfographic && textAreaPct > 30);

// S7 Fallback jika acceptable.length === 0:
const eligibleWithoutPerson = evaluated.filter(c => !c.has_person && c.product_visible && c.score >= 70);
if (eligibleWithoutPerson.length > 0) {
  eligibleWithoutPerson.sort((a, b) => b.score - a.score || (b.w * b.h) - (a.w * a.h));
  const fallback = eligibleWithoutPerson[0];
  return {
    selectedIndex: fallback.index,
    selectedCandidate: fallback,
    needsReview: true,
    reason: 'dipilih otomatis, perlu ditinjau',
    shouldAttemptClean: true,
    evaluated
  };
}
```

---

### 2.2. `lib/product-photo-picker.js` (S8 Padding 10%)

#### Sebelum (Current/Before):
```javascript
  const normW = Math.max(0, coords.xmax - coords.xmin);
  const normH = Math.max(0, coords.ymax - coords.ymin);
  const padX = Math.round(normW * 0.06);
  const padY = Math.round(normH * 0.06);
```

#### Sesudah (Proposed/After):
```javascript
  const normW = Math.max(0, coords.xmax - coords.xmin);
  const normH = Math.max(0, coords.ymax - coords.ymin);
  const padX = Math.round(normW * 0.10);
  const padY = Math.round(normH * 0.10);
```

---

### 2.3. `lib/bg-remover.js` (S8 Bypass Rembg Latar Putih)

#### Sebelum (Current/Before):
```javascript
// Langsung panggil rembg atau imgly tanpa cek warna latar belakang
```

#### Sesudah (Proposed/After):
```javascript
export async function isPlainWhiteBackground(bufferOrPath) {
  // Cek piksel tepi 4% menggunakan Sharp raw
  // Jika >= 95% piksel memiliki luminansi >= 245 dan deviasi warna (max - min) <= 15 -> return true
}

// Di createCleanProductShot:
if (await isPlainWhiteBackground(inputImagePath)) {
  // Lewati rembg, ratakan ke kanvas putih dengan sharp
  await sharp(inputImagePath)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 90 })
    .toFile(finalOutputPath);
  return `/uploads/products/clean/${outputFilename}`;
}
```

---

### 2.4. `lib/product-bulk-worker.js` & `app/api/v2/products/[id]/route.js` (S9)

#### Sebelum (Current/Before):
```javascript
// Di worker:
await pgQuery(`
  UPDATE product_extractions
  SET enrichment_status = 'failed',
      enrichment_error = $1,
...
`, [err.message.slice(0, 500), id, tenantId]);

// Di GET /api/v2/products/[id]:
return NextResponse.json({ success: true, data: product });
```

#### Sesudah (Proposed/After):
```javascript
// Di worker:
let enrichmentError = err.message.slice(0, 500);
const msgLower = err.message.toLowerCase();
if (msgLower.includes('quota') || msgLower.includes('rate limit') || msgLower.includes('resource_exhausted') || msgLower.includes('429') || msgLower.includes('503')) {
  enrichmentError = `QUOTA_EXHAUSTED (dapat diulang): ${err.message}`.slice(0, 500);
}
...

// Di GET /api/v2/products/[id]:
const errText = (product.enrichment_error || '').toLowerCase();
const isQuota = errText.includes('quota') || errText.includes('rate limit') || errText.includes('resource_exhausted') || errText.includes('429') || errText.includes('503');
if (product.enrichment_status === 'failed' && isQuota) {
  product.enrichment_retryable = true;
  product.enrichment_retry_hint = 'Jalankan cf_enrich_product untuk mengulang';
}
return NextResponse.json({ success: true, data: product });
```

---

## 3. Execution Task List

- [x] **Task 1: S8 — Margin Crop 10% & Bypass Rembg Latar Putih**
  - [x] Ubah padding crop di `computeCropBox()` dari 6% menjadi 10%
  - [x] Implementasikan `isPlainWhiteBackground()` di `lib/bg-remover.js`
  - [x] Integrasikan `isPlainWhiteBackground()` ke dalam `createCleanProductShot()`
  - [x] Buat tes unit `tests/product-photo-crop-rembg.test.js`

- [x] **Task 2: S6 & S7 — Rubrik Picker E-Commerce & Fallback Clean Needs Review**
  - [x] Perbarui `PHOTO_PICKER_SCHEMA` dengan `text_area_pct` dan `is_collage`
  - [x] Perbarui `PHOTO_PICKER_PROMPT` dengan instruksi & contoh e-commerce Indonesia
  - [x] Perbarui `evaluateCandidateScores()` dengan aturan pelonggaran teks overlay
  - [x] Tambahkan logika cabang S7: fallback skor ≥ 70 tanpa orang tetap clean `needs_review` (`shouldAttemptClean: true`), vs semua memuat orang/skor < 70 (`shouldAttemptClean: false`)
  - [x] Integrasikan `shouldAttemptClean` di `lib/scheduler-processors.js`
  - [x] Buat fixture `tests/fixtures/photo_picker_cuculemon_eval.json` dan tes unit `tests/product-photo-rubric.test.js`

- [x] **Task 3: S5 — Galeri Lengkap Playwright Scraper (≥ 5 Kandidat ≥ 600px)**
  - [x] Tambahkan interaksi thumbnail galeri (hover/klik hingga 8 thumbnail) di `lib/playwright-scraper.js`
  - [x] Trigger scroll galeri dan tangkap `currentSrc` foto utama
  - [x] Tambahkan validasi ukuran varian CDN (`:700:0`, `:1200:0`, `/cache/900/`) dengan fallback aman
  - [x] Filter kandidat < 600px jika kandidat ≥ 600px sudah mencukupi (≥ 2)
  - [x] Catat metrik jumlah kandidat dan resolusi pada log job dan audit

- [x] **Task 4: S9 — Enrichment Gagal Kuota Jelas & Retryable + Mockup UI**
  - [x] Tambahkan penanganan `QUOTA_EXHAUSTED (dapat diulang)` di `lib/product-bulk-worker.js`
  - [x] Tambahkan field turunan `enrichment_retryable` dan hint di `app/api/v2/products/[id]/route.js`
  - [x] Buat tes unit `tests/product-enrichment-retryable.test.js`
  - [x] Perbarui mockup UI `public/mockup_foto_produk_review.html` untuk mendemonstrasikan badge retry kuota dan sinkronkan ke Staging Mac Mini

- [x] **Task 5: Perbaikan Kecil — Trace Context Stage**
  - [x] Berikan `traceContext: { stage: 'product_photo_crop' }` pada smart crop
  - [x] Berikan `traceContext: { stage: 'product_photo_final_check' }` pada final check
  - [x] Berikan `traceContext: { stage: 'product_photo_picker' }` pada photo picker

- [x] **Task 6: Verifikasi Lokal Penuh**
  - [x] Jalankan seluruh unit test (`node --test tests/*.test.js`)
  - [x] Jalankan `npm run test:product-catalog` dan `npm run test:mcp`
  - [x] Jalankan `npm run build` (Next.js kompilasi)

- [x] **Task 7: Push & Deploy ke Dev Mac Mini**
  - [x] Commit dan push branch `fitur/scraper-foto-galeri-r02` ke remote
  - [x] Deploy ke server Dev: `npm run deploy:dev:atomic -- --ref <full-sha> --apply --confirm-dev`
  - [x] Verifikasi Dev online (Port 5020 UI, Port 7020 API)
  - [x] Sajikan laporan ringkas, link Dev, dan checklist uji singkat untuk pengguna
