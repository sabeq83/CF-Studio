# Implementation Plan — Hotfix Scraper Foto Produk (Revisi 02 Bagian A)

Tanggal: 17 November 2026 · Branch: `hotfix/scraper-foto-r02` · Basis: `main` (`8370981`)
Dokumen Panduan: [antigravity_scraper_foto_produk_revisi_02.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/instruksi-agent/antigravity_scraper_foto_produk_revisi_02.md)

---

## 1. Ringkasan Tujuan

Menyelesaikan perbaikan bug pada scraper foto produk di server Staging (S1–S4):
- **S1 (FATAL)**: Memperbaiki `ReferenceError: processCleanInputPath is not defined` yang menyebabkan crop dan penghapusan latar belakang selalu gagal pada produk baru sejak v2.49.2. Mengintegrasikan kembali pipeline foto ke `processProductPhotoFromRaw()` serta menggabungkan seluruh alasan ke `photo_error` di `decidePhotoStatus()`.
- **S2**: Mengembalikan HTTP status dari Playwright, mendeteksi halaman 404/produk tidak ditemukan dengan fungsi murni `detectNotFoundPage()`, menolak fallback AI Search Grounding jika halaman 404, tidak menyimpan produk 404 ke database, menambahkan ringkasan status job (`status_summary`), membuat endpoint `GET /api/v2/products/scrape/jobs/[jobId]`, dan menyediakan tool MCP `cf_get_scrape_status`.
- **S3**: Memvalidasi URL kandidat gambar (menolak domain-only seperti `https://images.tokopedia.net` tanpa path gambar yang sah) serta men-decode entitas HTML (`&amp;` -> `&`) pada URL regex.
- **S4**: Menyertakan `tenant_id: getActiveTenantId()` pada seluruh payload `createJob('product_scraper', ...)` dan `createJob('product_photo_replace', ...)`, serta memastikan query produk lama dibatasi pada tenant aktif (`WHERE tenant_id = ?`).

---

## 2. Before & After Code Snippets

### 2.1. `lib/scheduler-processors.js` (S1, S2, S4)

#### Sebelum (Current/Before):
```javascript
// Baris ~10420
const allProducts = await db.prepare('SELECT id, input_source, source_url, raw_photo_url, cleaned_photo_url, generated_photo_url, unique_selling_point, packaging_type, scraped_image_url, raw_description, t2i_prompt, i2v_action_prompt, product_name FROM product_extractions').all();

// ... di dalam loop produk (baris ~10645)
    let localPhotoPath = null;
    let rawPhotoPath = null;
    let cleanPhotoPath = null;
    let generatedPhotoPath = null;

// Baris ~10748, 10751, 10756, 10760, 10779 (processCleanInputPath tidak dideklarasikan)
    processCleanInputPath = cropAbsPath;
...
    const cleanInputAbsPath = processCleanInputPath || path.join(process.cwd(), 'public', rawPhotoPath);

// Baris ~10998
  return {
    processed: true,
    results,
    errors: Object.keys(scrapeErrors).length > 0 ? scrapeErrors : undefined
  };
```

#### Sesudah (Proposed/After):
```javascript
// Filter tenant aktif
const activeTenant = getActiveTenantId();
const allProducts = await db.prepare('SELECT id, input_source, source_url, raw_photo_url, cleaned_photo_url, generated_photo_url, unique_selling_point, packaging_type, scraped_image_url, raw_description, t2i_prompt, i2v_action_prompt, product_name FROM product_extractions WHERE tenant_id = ?').all(activeTenant);

// ... deklarasikan processCleanInputPath di awal loop
    let localPhotoPath = null;
    let rawPhotoPath = null;
    let cleanPhotoPath = null;
    let generatedPhotoPath = null;
    let processCleanInputPath = null;

// Integrasi aman dengan fallback path dan penanganan error terisolasi
// S2: Deteksi error 404 agar tidak disimpan ke database
// S2: Ringkasan status job
  const totalUrls = urlList.length;
  const successCount = results.length;
  const errorCount = Object.keys(scrapeErrors).length;
  let statusSummary = 'ok';
  if (successCount === 0 && errorCount > 0) {
    statusSummary = 'failed';
  } else if (errorCount > 0) {
    statusSummary = 'partial';
  }

  return {
    processed: true,
    results,
    errors: Object.keys(scrapeErrors).length > 0 ? scrapeErrors : undefined,
    status_summary: statusSummary
  };
```

---

### 2.2. `lib/product-photo-picker.js` (S1 & S3)

#### Sebelum (Current/Before):
```javascript
export function decidePhotoStatus({
  pickerNeedsReview = false,
  pickerReason = null,
  selectedCandidate = null,
  finalCheck = null,
  bgError = false,
  hasNewPhoto = false
} = {}) {
  // 1. Jika picker menandai review (apapun alasannya), SELALU needs_review
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
...
```

#### Sesudah (Proposed/After):
```javascript
export function decidePhotoStatus({
  pickerNeedsReview = false,
  pickerReason = null,
  selectedCandidate = null,
  finalCheck = null,
  bgError = false,
  hasNewPhoto = false
} = {}) {
  const reasons = [];

  if (pickerNeedsReview) {
    reasons.push(pickerReason || 'foto memuat orang/teks');
  }

  if (bgError) {
    reasons.push('hapus latar belakang gagal');
  }

  if (hasNewPhoto && !finalCheck) {
    reasons.push('pemeriksaan akhir foto tidak berjalan');
  } else if (finalCheck?.error) {
    reasons.push('pemeriksaan foto gagal');
  } else if (finalCheck && (finalCheck.has_person || finalCheck.has_heavy_text)) {
    reasons.push('foto memuat orang/teks');
  }

  if (selectedCandidate?.has_person) {
    reasons.push('foto mentah memuat orang/model');
  }

  if (selectedCandidate?.product_visible === false) {
    reasons.push('foto mentah tidak memuat produk utuh');
  }

  if (reasons.length > 0) {
    // Deduping reasons
    const uniqueReasons = [...new Set(reasons)];
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
```

---

### 2.3. `lib/url-scraper.js` & `lib/playwright-scraper.js` (S2 & S3)

#### Sebelum (Current/Before):
```javascript
// playwright-scraper.js
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
...
return { title, html, bodyText, images };

// url-scraper.js
  const addCandidate = (imgUrl, { w = 0, h = 0, alt = '', source = 'regex' } = {}) => {
    if (!imgUrl || typeof imgUrl !== 'string') return;
    const cleanUrl = imgUrl.replace(/\\/g, '').replace(/[.,;:]$/, '').trim();
    if (!cleanUrl.startsWith('http')) return;
```

#### Sesudah (Proposed/After):
```javascript
// playwright-scraper.js
const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
const httpStatus = response ? response.status() : 200;
...
return { title, html, bodyText, images, httpStatus };

// url-scraper.js
export function isValidProductImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    const pathname = (parsed.pathname || '').toLowerCase();
    if (!pathname || pathname === '/' || pathname === '') return false;
    const hasImageExt = /\.(?:jpg|jpeg|png|webp|avif)(?:[?#]|$)/i.test(pathname);
    const hasPattern = pathname.includes('~tplv-') || pathname.includes('/img/');
    return hasImageExt || hasPattern;
  } catch (_) {
    return false;
  }
}

export function detectNotFoundPage({ httpStatus = 200, title = '', bodyText = '', html = '' } = {}) {
  if (httpStatus === 404 || httpStatus === 410) {
    return { notFound: true, reason: `HTTP status ${httpStatus}` };
  }
  const text = `${title} ${bodyText} ${html}`.toLowerCase();
  const notFoundPatterns = [
    'tujuanmu nggak ada',
    'halaman tidak ditemukan',
    'produk tidak ditemukan',
    'produk ini tidak tersedia',
    'page not found',
    'produk ini tidak ada'
  ];
  for (const pattern of notFoundPatterns) {
    if (text.includes(pattern)) {
      return { notFound: true, reason: `Teks "${pattern}" terdeteksi di halaman` };
    }
  }

  // Cek jika halaman tidak memiliki harga DAN tidak memiliki tanda detail produk
  const hasPrice = /(?:rp|idr)\s*[\d.,]+/i.test(text);
  const hasDetailMarker = /(?:detail produk|spesifikasi|deskripsi produk|informasi produk)/i.test(text);
  if (!hasPrice && !hasDetailMarker && text.length < 500) {
    return { notFound: true, reason: 'Halaman kosong tanpa indikator harga maupun detail produk' };
  }

  return { notFound: false, reason: null };
}

// Di parseHtml:
const decodedUrl = imgUrl.replace(/&amp;/g, '&');
if (!isValidProductImageUrl(decodedUrl)) return;
```

---

### 2.4. `app/api/v2/products/scrape/route.js` & `app/api/v2/products/[id]/photo-replace/route.js` (S4)

#### Sebelum (Current/Before):
```javascript
// scrape/route.js:
const allProducts = await db.prepare('SELECT id, input_source, source_url...').all();
...
const created = await createJob('product_scraper', { 
  urls: chunk, 
  category, 
  tags, 
  url_affiliates_map: urlAffiliatesMap, 
  repair_mode,
  refresh_photo: Boolean(refresh_photo),
  reserved_ids: reservedIds
});
```

#### Sesudah (Proposed/After):
```javascript
// scrape/route.js:
const activeTenant = getActiveTenantId();
const allProducts = await db.prepare('SELECT id, input_source, source_url, raw_photo_url, cleaned_photo_url, generated_photo_url, unique_selling_point, packaging_type FROM product_extractions WHERE tenant_id = ?').all(activeTenant);
...
const created = await createJob('product_scraper', { 
  tenant_id: activeTenant,
  urls: chunk, 
  category, 
  tags, 
  url_affiliates_map: urlAffiliatesMap, 
  repair_mode,
  refresh_photo: Boolean(refresh_photo),
  reserved_ids: reservedIds
});
```

---

## ## Execution Task List

- [x] **Task 1: Perbaikan S1 (Fatal processCleanInputPath is not defined & multi-reason decidePhotoStatus)**
  - [x] Deklarasikan `let processCleanInputPath = null;` di awal per-product loop `lib/scheduler-processors.js`
  - [x] Integrasikan kembali alur foto produk ke fungsi yang terisolasi dan aman (`processProductPhotoFromRaw`)
  - [x] Perbarui `decidePhotoStatus()` di `lib/product-photo-picker.js` agar menggabungkan semua alasan ke `photo_error`
  - [x] Buat unit test alur pemrosesan foto end-to-end dengan mock di `tests/product-photo-flow.test.js`

- [x] **Task 2: Perbaikan S2 (Deteksi 404 & Scraping Job Status)**
  - [x] Kembalikan `httpStatus` di `lib/playwright-scraper.js`
  - [x] Buat fungsi murni `detectNotFoundPage` di `lib/url-scraper.js`
  - [x] Tolak AI Search Grounding fallback jika `PRODUCT_NOT_FOUND`
  - [x] Lewati penyimpanan database di `processProductScraper` untuk URL 404 dan catat ke `errors`
  - [x] Tambahkan `status_summary` (`failed`, `partial`, `ok`) pada hasil job
  - [x] Buat endpoint route `app/api/v2/products/scrape/jobs/[jobId]/route.js`
  - [x] Daftarkan tool MCP `cf_get_scrape_status` di `apps/mcp/tools.mjs`
  - [x] Tambahkan fixture `tests/fixtures/tokopedia_404_2026.html` dan unit test di `tests/url-scraper-not-found.test.js`
  - [x] Buat skrip dry-run `scripts/flag-not-found-products.mjs`

- [x] **Task 3: Perbaikan S3 (Validasi URL Kandidat & Decode Entitas HTML)**
  - [x] Tambahkan `isValidProductImageUrl` di `lib/url-scraper.js` (tolak URL domain-only dan non-image)
  - [x] Terapkan decode `&amp;` -> `&` pada URL hasil regex
  - [x] Terapkan validasi `isValidProductImageUrl` di `pickBestProductPhoto` dan cadangan ekstraksi
  - [x] Buat unit test validasi URL di `tests/url-scraper-tokopedia-images.test.js`

- [x] **Task 4: Perbaikan S4 (Tenant Sesi MCP Sampai ke Job & Tenant-Scoped Isolation)**
  - [x] Tambahkan `tenant_id: getActiveTenantId()` di route `app/api/v2/products/scrape/route.js`
  - [x] Tambahkan `tenant_id: getActiveTenantId()` di seluruh `createJob` pada `app/api/v2/products/[id]/photo-replace/route.js`
  - [x] Batasi pencarian produk eksisting di route dan di `processProductScraper` dengan `WHERE tenant_id = ?`
  - [x] Pastikan `createProductExtraction` menyimpan `tenant_id` dari konteks job
  - [x] Buat skrip dry-run `scripts/move-product-tenant.mjs`
  - [x] Tambahkan unit test isolasi tenant scraper di `tests/product-scraper-tenant.test.js`

- [x] **Task 5: Verifikasi Menyeluruh & Laporan**
  - [x] Jalankan seluruh suite tes: `node --test tests/*.test.js`, `npm run test:product-catalog`, `npm run test:mcp` (23 unit tests pass, product catalog pass, MCP 11 tests pass)
  - [x] Jalankan `npm run build` (Next.js 16 build sukses)
  - [x] Jalankan dry-run lokal Cuculemon (foto clean terbentuk, tidak ada ReferenceError) dan Texania (terdeteksi 404 tanpa fallback Gemini)
  - [x] Jalankan skrip dry-run S1, S2, S4 untuk Staging
  - [x] Susun laporan komprehensif ke pengguna dan minta izin untuk langkah rilis
