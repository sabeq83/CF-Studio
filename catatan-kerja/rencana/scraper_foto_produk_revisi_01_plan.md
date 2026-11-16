# Implementation Plan: Revisi 01 Scraper Foto Produk & Tinjau/Ganti Foto UI

**Target Versi**: Patch lanjutan setelah `v2.49.1`  
**Dokumen Acuan**: [antigravity_scraper_foto_produk_revisi_01.md](file:///Users/sabeqmmursyid/_cfstudio/antigravity_scraper_foto_produk_revisi_01.md)

---

## 1. Analisis & Sasaran Perbaikan

Berdasarkan review hasil rilis `v2.49.1`, ditemukan 4 celah teknis backend dan 1 masalah visual crop (R1–R5), serta kebutuhan 2 fitur UI baru di katalog produk (R6 & R7):

1. **R1 (Audit Bloat)**: `raw_response` membengkak hingga 2,5 MB per produk karena buffer biner gambar kandidat ikut tersimpan di `photo_selection_audit.evaluated[]`. Diperbaiki dengan whitelist fields via `toAuditCandidate()`, penyimpanan kandidat ke disk di `public/uploads/products/candidates/<id>/cand_<idx>.<ext>`, serta skrip data-fix `scripts/fix-photo-audit-bloat.mjs`.
2. **R2 (Status Gagal)**: Kondisi kegagalan (semua kandidat ditolak, gagal download, hapus latar belakang gagal, atau final check kosong) masih keliru ditandai `approved`. Diperbaiki di `decidePhotoStatus()` agar selalu menghasilkan `needs_review` dengan `photo_error` yang akurat.
3. **R3 (Preservasi Foto Lama & Timestamp)**: Mode `refresh_photo` tidak boleh mengosongkan foto lama jika download gagal. Nama file baru diberi akhiran timestamp `_<yyyymmddHHMMss>`. Disediakan pure function `buildRefreshPhotoUpdates()`.
4. **R4 (Isolasi Repair Biasa)**: Pada repair data biasa tanpa foto baru, status `needs_review` yang sudah ada tidak boleh ditimpa menjadi `approved`, dan G-Labs polish tidak dijalankan.
5. **R5 (Kualitas Crop Kemasan Utuh)**: Prompt crop diperbarui untuk kemasan utuh (botol + kotak). Ditambahkan padding 6% via pure function `computeCropBox()`, lewati crop jika < 800 px atau < 25% area, dan simpan file crop terpisah `_crop.png`.
6. **R6 (UI & Backend Persetujuan Foto)**: Endpoint `POST /api/v2/products/[id]/photo-review` untuk menyetujui foto `needs_review` tanpa menghapus prompt. Filter "Perlu ditinjau (N)" dan badge peringatan.
7. **R7 (UI & Backend Ganti Foto)**: Endpoint `POST /api/v2/products/[id]/photo-replace` dengan 3 opsi (Pilih dari listing, Unggah sendiri, Ambil ulang otomatis) dan job `product_photo_replace`. Pembuatan mockup HTML mandiri terlebih dahulu untuk persetujuan pengguna.

---

## 2. Execution Task List

### Tahap 1: Mockup HTML & Persiapan UI (SOP Mockup)
- [ ] Buat file standalone [public/mockup_foto_produk_review.html](file:///Users/sabeqmmursyid/_cfstudio/public/mockup_foto_produk_review.html) lengkap dengan semantic tokens dari `theme.css`.
- [ ] Sinkronkan file mockup ke Mac Mini Staging via `scp` ke `~/maknaflow-staging-atomic/current/public/mockup_foto_produk_review.html`.
- [ ] Tampilkan tautan HTTP staging `http://100.95.245.55:5010/mockup_foto_produk_review.html` kepada pengguna untuk review.

### Tahap 2: Backend R1 – Pencegahan Audit Bloat & Kandidat Storage
- [ ] Tambahkan helper `toAuditCandidate(cand)` di [lib/product-photo-picker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-photo-picker.js).
- [ ] Di `evaluateCandidateScores`, hapus spread `...cand` dan gunakan pemetaan ringkas.
- [ ] Di `pickBestProductPhoto`, simpan kandidat gambar yang diunduh ke `public/uploads/products/candidates/<productId>/cand_<index>.<ext>` dan catat `local_path` di audit.
- [ ] Buat skrip perbaikan data [scripts/fix-photo-audit-bloat.mjs](file:///Users/sabeqmmursyid/_cfstudio/scripts/fix-photo-audit-bloat.mjs) (default dry-run, `--apply`, `--schema dev|staging`, tolak `public`).

### Tahap 3: Backend R2 – Validasi Status Kegagalan Foto
- [ ] Perbarui `decidePhotoStatus()` di [lib/product-photo-picker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-photo-picker.js): jika `pickerNeedsReview === true`, selalu `needs_review` dengan `photo_error = pickerReason`.
- [ ] Tangani kondisi `finalCheck` kosong/gagal pada foto baru dan `bgError` dari rembg.

### Tahap 4: Backend R3 – Preservasi Refresh Foto & Timestamp Suffix
- [ ] Buat dan export fungsi murni `buildRefreshPhotoUpdates({ existing, newRaw, newClean, newGenerated, status, error, targetImageUrl, rawResponse })` di [lib/product-photo-picker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-photo-picker.js).
- [ ] Terapkan akhiran timestamp `raw_<id>_<ts>.png`, `clean_<id>_<ts>.jpg`, `generated_<id>_<ts>.jpg` di [lib/scheduler-processors.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js).

### Tahap 5: Backend R4 – Isolasi Repair Biasa
- [ ] Di [lib/scheduler-processors.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js), pastikan pada repair biasa tanpa foto baru (`!needsRaw && !needsClean`), `photo_status` dan `photo_error` tidak dimasukkan ke payload update.
- [ ] Lewati G-Labs polish jika status lama adalah `needs_review` dan tidak ada foto baru.

### Tahap 6: Backend R5 – Kualitas Crop & Preservasi Kemasan Utuh
- [ ] Buat dan export fungsi murni `computeCropBox({ coords, width, height })` di [lib/product-photo-picker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-photo-picker.js) dengan padding 6% dan aturan skip < 800 px atau < 25% luas.
- [ ] Perbarui `cropPrompt` di [lib/scheduler-processors.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js).
- [ ] Simpan hasil crop ke file terpisah `_crop.png` tanpa menimpa file raw asli.

### Tahap 7: Backend R6 & R7 – Endpoint & Shared Photo Pipeline
- [ ] Buat endpoint baru `POST /api/v2/products/[id]/photo-review` di [app/api/v2/products/[id]/photo-review/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/products/[id]/photo-review/route.js).
- [ ] Buat fungsi bersama `processProductPhotoFromRaw({ productId, rawAbsPath, runCrop, origin })` di [lib/product-photo-picker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-photo-picker.js).
- [ ] Buat endpoint baru `POST /api/v2/products/[id]/photo-replace` di [app/api/v2/products/[id]/photo-replace/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/products/[id]/photo-replace/route.js).
- [ ] Daftarkan processor job `product_photo_replace` di [lib/scheduler-processors.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js).
- [ ] Perbarui [lib/product-catalog-service.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-catalog-service.js) dan [app/api/v2/products/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/products/route.js) untuk mendukung filter & counter `needs_review`.

### Tahap 8: Pengujian Unit Test Komprehensif
- [ ] Tambahkan unit test baru di [tests/product-photo-revisi.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/product-photo-revisi.test.js) mencakup R1, R2, R3, R4, R5, R6, R7.
- [ ] Jalankan seluruh suite test (`tests/url-scraper-tokopedia-images.test.js`, `tests/product-photo-picker.test.js`, `tests/base64-image-reference.test.js`, `tests/product-photo-revisi.test.js`).
- [ ] Jalankan `npm run test:product-catalog` dan `npm run test:mcp`.
- [ ] Jalankan `npm run build` lokal.

### Tahap 9: Dry-Run Nyata & Skrip Data-Fix
- [ ] Uji dry-run Habarlic (audit < 20 KB, kemasan utuh, sisi terpanjang ≥ 1000 px).
- [ ] Uji dry-run skrip `scripts/fix-photo-audit-bloat.mjs` di database staging (mode dry-run tanpa write).

### Tahap 10: Commit Lokal & Laporan Review Mockup (STOP)
- [ ] Commit lokal pada branch `main`.
- [ ] **STOP & LAPORKAN**: Tampilkan link mockup staging, hasil tes, hasil dry-run, dan minta persetujuan pengguna sebelum rilis/deploy.

---

## 3. Code Sebelum & Sesudah (Before & After)

### 3.1 `lib/product-photo-picker.js` (R1 Audit Helper & Evaluate)
#### Code Sebelum (Current):
```js
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
```

#### Code Sesudah (Proposed):
```js
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

// In evaluateCandidateScores:
  const evaluated = candidates.map((cand, idx) => {
    const aiItem = aiList.find(c => Number(c.index) === idx) || {};
    const hasPerson = Boolean(aiItem.has_person);
    const isInfographic = Boolean(aiItem.is_infographic);
    const textOverlay = aiItem.text_overlay || 'none';
    const productVisible = aiItem.product_visible !== false;
    const score = Number.isFinite(aiItem.score) ? Number(aiItem.score) : 50;
    const isAcceptable = !hasPerson && !isInfographic && textOverlay !== 'heavy' && productVisible;
    const resScore = (Number(cand.w) || 0) * (Number(cand.h) || 0);

    return toAuditCandidate({
      index: idx,
      url: cand.url,
      source: cand.source,
      w: cand.w,
      h: cand.h,
      has_person: hasPerson,
      is_infographic: isInfographic,
      text_overlay: textOverlay,
      product_visible: productVisible,
      score,
      resScore,
      isAcceptable,
      local_path: cand.local_path || null
    });
  });
```

### 3.2 `lib/product-photo-picker.js` (R2 decidePhotoStatus)
#### Code Sebelum (Current):
```js
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

  if (selectedCandidate?.has_person) {
    return {
      status: 'needs_review',
      error: 'foto mentah memuat orang/model'
    };
  }

  if (selectedCandidate?.product_visible === false) {
    return {
      status: 'needs_review',
      error: 'foto mentah tidak memuat produk utuh'
    };
  }

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
```

#### Code Sesudah (Proposed):
```js
export function decidePhotoStatus({
  pickerNeedsReview = false,
  pickerReason = null,
  selectedCandidate = null,
  finalCheck = null,
  bgError = false,
  hasNewPhoto = false
} = {}) {
  // 1. Jika picker menandai review, SELALU needs_review
  if (pickerNeedsReview) {
    return {
      status: 'needs_review',
      error: pickerReason || 'foto memuat orang/teks'
    };
  }

  // 2. Jika penghapusan latar belakang gagal
  if (bgError) {
    return {
      status: 'needs_review',
      error: 'hapus latar belakang gagal'
    };
  }

  // 3. Jika ada pemrosesan foto baru pada run ini tapi finalCheck kosong/null
  if (hasNewPhoto && !finalCheck) {
    return {
      status: 'needs_review',
      error: 'pemeriksaan akhir foto tidak berjalan'
    };
  }

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

  if (selectedCandidate?.has_person) {
    return {
      status: 'needs_review',
      error: 'foto mentah memuat orang/model'
    };
  }

  if (selectedCandidate?.product_visible === false) {
    return {
      status: 'needs_review',
      error: 'foto mentah tidak memuat produk utuh'
    };
  }

  return {
    status: 'approved',
    error: null
  };
}
```

### 3.3 `lib/scheduler-processors.js` (R5 Prompt & Crop Box Computation)
#### Code Sebelum (Current):
```js
const cropPrompt = `Analyze this product photo. There might be multiple variants of the same product. Box the product package only. Exclude any people, faces, hands, models, logos/badges and promotional text. If a person is holding the product, box only the product. Return the bounding box coordinates [ymin, xmin, ymax, xmax] for only that ONE item. Return coordinates as normalized integers from 0 to 1000 representing [ymin, xmin, ymax, xmax]. For example, [0, 0, 1000, 1000] would be the entire image.`;
```

#### Code Sesudah (Proposed):
```js
const cropPrompt = `Analyze this product photo. Box the complete product package set shown (for example the bottle together with its box). If several identical variants appear side by side, box only one complete set. Exclude any people, faces, hands, models, logos/badges and promotional text. If a person is holding the product, box only the product set. Return the bounding box coordinates [ymin, xmin, ymax, xmax] as normalized integers from 0 to 1000.`;
```
Dan menggunakan fungsi `computeCropBox({ coords, width, height })` dengan padding 6% dan pengecekan resolusi/luas.

---
