# Implementation Plan — Hotfix Scraper: Perbaikan `normalizeUrl is not defined` pada Scraper Produk

- **Branch Kerja**: `hotfix/scraper-normalize-url` (dibuat dari `main` @ `v2.57.0` `fb89bb9918c93d8ea8317ec3fc3f84236e7540b3`)
- **Tujuan**: Memperbaiki `ReferenceError: normalizeUrl is not defined` pada `lib/scheduler-processors.js` saat memproses penambahan produk baru ke Database Produk (`product_extractions`), menambahkan test regresi, merilis patch `v2.57.1`, mendeploy ke server Staging, dan memulihkan promosi untuk produk VITAMEAL dan ecentio.
- **SOP Acuan**:
  - `sot/global/AGENTS.md` (SOP Alur Branch Dev vs Staging — Alur 2 Hotfix)
  - `sot/global/AGENTS.md` (SOP Rilis & Auto Git Sync MAKNA Flow)
  - `sot/global/GIT_BASED_ATOMIC_DEPLOYMENT.md` (SOP Git-Based Atomic Deployment Mac Mini)
- **Perubahan Database (Migrasi)**: Tidak ada.
- **Perubahan UI**: Tidak ada.

---

## Execution Task List

### Tahap 1 — Branching & Perbaikan Kode
- [x] Buat branch `hotfix/scraper-normalize-url` dari `main` terbaru
- [x] Ganti `normalizeUrl` menjadi `normalizeProductUrl` di `lib/scheduler-processors.js` (baris 9757 & 9759)
- [x] Verifikasi tidak ada pemanggilan `normalizeUrl` tanpa definisi di seluruh codebase (`git grep "normalizeUrl("`)

### Tahap 2 — Test Regresi Lokal
- [x] Buat file unit test `tests/product-scraper-affiliate-normalize.test.js` untuk memverifikasi pemetaan `url_affiliates_map` dengan `normalizeProductUrl` tanpa ReferenceError
- [x] Jalankan unit test dan pastikan pass 100%
- [x] Perbarui kartu menu `sot/menus/kartu/products.md` dan `sot/menus/kartu/product-radar.md` (catatan regresi v2.57.1)

### Tahap 3 — Merge, Rilis Patch & Deployment Staging
- [ ] Checkout ke `main`, merge `--no-ff` dari branch `hotfix/scraper-normalize-url`
- [ ] Jalankan `npm run release-non-interactive -- --type patch --title "Perbaikan ReferenceError normalizeUrl pada Scraper Produk" --points "Memperbaiki ReferenceError normalizeUrl menjadi normalizeProductUrl saat menyimpan produk baru ke Database Produk"`
- [ ] Deploy release patch `v2.57.1` ke Staging via `npm run deploy:staging -- --ref <full-sha> --apply --confirm-staging`
- [ ] Verifikasi kesehatan Staging (symlink `current`, PM2 online, UI 5010 HTTP 200, API 7010 /health HTTP 200, `PG_SEARCH_PATH=staging`, `PGPOOL_MAX=3`)
- [ ] Hapus branch `hotfix/scraper-normalize-url` lokal dan remote

### Tahap 4 — Verifikasi Pemulihan Produk di Staging
- [ ] Jalankan retry promosi untuk kedua kandidat:
  - `VITAMEAL Mix Berry 1 Box` (`prc_427f8d35-ad45-4d34-b2b5-c248625f0751`)
  - `ecentio Tumbler Stainless Vacuum 900ml` (`prc_9cb64e5e-c856-4b55-ab4c-4fa75fdf8a1a`)
- [ ] Pantau job scraping hingga selesai dan pastikan keduanya berhasil masuk ke tabel `product_extractions` di Staging
- [ ] Laporkan bukti keberhasilan kepada pengguna

---

## Rancangan Perubahan Kode (Before & After)

### 1. `lib/scheduler-processors.js` (Baris 9755–9762)

**Code Sebelum (Current/Before):**
```javascript
        affiliate_link: (() => {
          if (!payload?.url_affiliates_map) return '';
          const normalizedScraped = normalizeUrl(scrapedItem.url);
          const foundKey = Object.keys(payload.url_affiliates_map).find(
            k => normalizeUrl(k) === normalizedScraped
          );
          return foundKey ? payload.url_affiliates_map[foundKey] : '';
        })(),
```

**Code Sesudah (Proposed/After):**
```javascript
        affiliate_link: (() => {
          if (!payload?.url_affiliates_map) return '';
          const normalizedScraped = normalizeProductUrl(scrapedItem.url);
          const foundKey = Object.keys(payload.url_affiliates_map).find(
            k => normalizeProductUrl(k) === normalizedScraped
          );
          return foundKey ? payload.url_affiliates_map[foundKey] : '';
        })(),
```
