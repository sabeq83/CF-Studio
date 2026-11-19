# Usulan Perbaikan: Penanganan Bug `normalizeUrl is not defined` pada Promosi Radar Produk ke Database Produk

**Tanggal**: 19 November 2026  
**Status**: Usulan Solusi & Analisis Bug Staging  
**Lingkungan Terdampak**: Server Staging (`http://100.95.245.55:5010`), Tenant Default (`default_tenant`)  
**Produk Kasus**:
1. `VITAMEAL Mix Berry 1 Box` (Kandidat: `prc_427f8d35-ad45-4d34-b2b5-c248625f0751`, No 37)
2. `ecentio Tumbler Stainless Vacuum 900ml` (Kandidat: `prc_9cb64e5e-c856-4b55-ab4c-4fa75fdf8a1a`, No 17)

---

## 1. Latar Belakang & Gejala

Pengguna mencoba melakukan kurasi pada menu **PLANNING → Radar Produk** (`/product-radar`) di server Staging dengan menekan tombol **"Masukkan ke Database Produk"** untuk 2 kandidat produk:
- *VITAMEAL Mix Berry 1 Box*
- *ecentio Tumbler Stainless Vacuum 900ml*

Namun, setelah beberapa waktu, kedua produk tersebut **tidak pernah muncul di menu Database Produk** (`/products`).

---

## 2. Temuan Hasil Investigasi di Server Staging

Berdasarkan pengecekan langsung pada database PostgreSQL pusat (schema `staging`) dan runtime log PM2 Mac Mini Staging:

### A. Status Data di Tabel `product_research_candidates` & `product_research_imports`
Kedua produk tercatat dalam tabel dengan status gagal:

```json
[
  {
    "candidate_id": "prc_9cb64e5e-c856-4b55-ab4c-4fa75fdf8a1a",
    "name": "ecentio Tumbler Stainless Vacuum 900ml Tahan Dingin 24 Jam (live/official)",
    "job_id": "11",
    "import_status": "failed",
    "process_status": "failed",
    "error": "normalizeUrl is not defined"
  },
  {
    "candidate_id": "prc_427f8d35-ad45-4d34-b2b5-c248625f0751",
    "name": "VITAMEAL Mix Berry 1 Box",
    "job_id": "12",
    "import_status": "failed",
    "process_status": "failed",
    "error": "normalizeUrl is not defined"
  }
]
```

### B. Bukti Log PM2 Staging (`staging-ui.err.log`)
Pada saat scheduler scraper mengeksekusi job #11 dan job #12, Playwright berhasil mengunduh dan mengekstrak data dari listing Tokopedia, namun proses terhenti seketika sebelum penyimpanan ke database:
```
2026-11-19 12:16:15 +07:00: [Scheduler] product_scraper job #11 failed: normalizeUrl is not defined
2026-11-19 12:18:32 +07:00: [Scheduler] product_scraper job #12 failed: normalizeUrl is not defined
```

---

## 3. Analisis Akar Masalah (Root Cause)

Akar masalah ditemukan pada file [lib/scheduler-processors.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js) baris **9757** dan **9759** di dalam fungsi worker `processProductScraperJob`:

Di bagian atas file, fungsi yang diimpor dari modul normalisasi URL adalah:
```javascript
import { normalizeProductUrl } from './product-url-normalizer.js';
```

Namun pada saat menyusun payload produk baru yang akan disimpan ke database `product_extractions` (blok penentuan `affiliate_link`):
```javascript
// lib/scheduler-processors.js baris 9755-9762
affiliate_link: (() => {
  if (!payload?.url_affiliates_map) return '';
  const normalizedScraped = normalizeUrl(scrapedItem.url); // <-- TYPO: normalizeUrl is not defined!
  const foundKey = Object.keys(payload.url_affiliates_map).find(
    k => normalizeUrl(k) === normalizedScraped              // <-- TYPO: normalizeUrl is not defined!
  );
  return foundKey ? payload.url_affiliates_map[foundKey] : '';
})(),
```

### Dampak:
1. `payload.url_affiliates_map` selalu dikirimkan oleh `enqueueProductScrape` (berupa object `{}` untuk scrape non-CSV).
2. Ketika kode mengevaluasi `normalizeUrl(scrapedItem.url)`, Node.js melempar `ReferenceError: normalizeUrl is not defined`.
3. Pemanggilan `await createProductExtraction(newData)` pada baris 9768 tidak pernah tercapai.
4. Job scraping ditandai `failed`, dan status di Radar Produk berubah menjadi `failed` dengan pesan `"normalizeUrl is not defined"`.

---

## 4. Usulan Solusi & Rencana Perbaikan (Hotfix)

### A. Perbaikan Kode
Ganti pemanggilan `normalizeUrl` menjadi `normalizeProductUrl` pada `lib/scheduler-processors.js`:

```diff
--- a/lib/scheduler-processors.js
+++ b/lib/scheduler-processors.js
@@ -9754,9 +9754,9 @@ export async function processProductScraperJob(job) {
         source_url: scrapedItem.url,
         affiliate_link: (() => {
           if (!payload?.url_affiliates_map) return '';
-          const normalizedScraped = normalizeUrl(scrapedItem.url);
+          const normalizedScraped = normalizeProductUrl(scrapedItem.url);
           const foundKey = Object.keys(payload.url_affiliates_map).find(
-            k => normalizeUrl(k) === normalizedScraped
+            k => normalizeProductUrl(k) === normalizedScraped
           );
           return foundKey ? payload.url_affiliates_map[foundKey] : '';
         })(),
```

### B. Pengujian Regresi
Buat unit test otomatis di `tests/product-scraper-affiliate-normalize.test.js` untuk memverifikasi bahwa:
1. `processProductScraperJob` memetakan `url_affiliates_map` dengan `normalizeProductUrl` secara benar tanpa melempar `ReferenceError`.
2. URL dengan variasi query string, trailing slash, dan prefix protocol berhasil dicocokkan ke key `url_affiliates_map`.

### C. Alur Rilis Hotfix (Sesuai SOP Alur Branch Dev vs Staging)
Karena ini merupakan perbaikan bug langsung di Staging (Hotfix):
1. Buat branch hotfix dari `main`: `git checkout -b hotfix/radar-promote-normalize-url`.
2. Terapkan perbaikan dan jalankan test.
3. Merge ke `main`, rilis patch `v2.57.1`:
   ```bash
   npm run release-non-interactive -- --type patch --title "Perbaikan ReferenceError normalizeUrl pada Scraper Produk" --points "Memperbaiki ReferenceError normalizeUrl menjadi normalizeProductUrl saat menyimpan produk baru dari Radar Produk ke Database Produk"
   ```
4. Deploy ke Staging Mac Mini:
   ```bash
   npm run deploy:staging -- --ref <full-git-sha-main> --apply --confirm-staging
   ```
5. Verifikasi kesehatan Staging (HTTP 200 UI 5010 & API 7010).

---

## 5. Tindakan Pemulihan untuk Pengguna (Setelah Deploy)

Sistem Radar Produk sudah dilengkapi fitur pemulihan otomatis (`claimAction = 'retry'`):
1. Buka menu **PLANNING → Radar Produk** (`http://100.95.245.55:5010/product-radar`).
2. Saring dengan filter status **Gagal**.
3. Temukan baris **VITAMEAL Mix Berry 1 Box** dan **ecentio Tumbler Stainless Vacuum 900ml**.
4. Tombol pada kedua produk akan menampilkan **↻ Coba Lagi** (atau klik baris produk dan tekan **↻ Coba Lagi Masukkan ke Database** di panel detail).
5. Sistem akan mengirim ulang job ke scraper, job akan sukses dieksekusi tanpa error, dan kedua produk akan langsung masuk serta muncul di **Database Produk** (`/products`).
