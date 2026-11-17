# Laporan Pelaksanaan Bagian B: Perbaikan Kartu Produk, Jendela Banding & Penyimpanan Foto Sebelumnya (B1–B6)

- **Tanggal**: 17 November 2026
- **Branch Kerja**: `hotfix/kartu-produk-foto-enrich`
- **Commit Implementasi**: `a810fc6ec69b7e03d3f28bd066e3b1a82685e4a5`
- **Target Dev**: `http://100.95.245.55:5020/products` (Release ID `20261117T134452Z-a810fc6ec69b`)
- **Status Staging**: Belum disentuh (`main` / `v2.51.0`), menunggu konfirmasi lolos uji Dev sebelum penggabungan Bagian A (`hotfix/truth-bahasa-inggris`) + Bagian B ke `main`.

---

## 1. Ringkasan Perubahan (B1–B6)

| Kode | Lingkup | File Terkait | Status |
|---|---|---|---|
| **B1** | Tombol `🧠 Enrich AI` / `Enriching…` / `🧠 Coba lagi` + pesan gagal enrichment + `enrichment_retryable` di API list | [app/products/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/products/page.js), [app/api/v2/products/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/products/route.js), [lib/product-card-photo-view.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-card-photo-view.js) | Selesai & Deploy Dev |
| **B2** | Default thumbnail ke foto bersih (`resolveDefaultCardPhotoTab`), badge pojok status foto, sakelar `Asli \| Hasil AI`, klik thumbnail membuka Jendela Banding | [app/products/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/products/page.js), [lib/product-card-photo-view.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-card-photo-view.js) | Selesai & Deploy Dev |
| **B3** | Jendela Banding (`Asli` vs `Hasil AI` berdampingan, responsif mobile, klik zoom `zIndex: 1200`, metadata provider & `updated_at`, tombol `Setujui`, `Ganti Foto`, `Ulangi Generate`) | [app/products/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/products/page.js) | Selesai & Deploy Dev |
| **B4** | Pratinjau hanya-baca foto `Asli` & `Hasil AI` (klik untuk perbesar) di Tab `Foto & AI` modal detail produk | [app/products/ProductDatabaseModal.js](file:///Users/sabeqmmursyid/_cfstudio/app/products/ProductDatabaseModal.js) | Selesai & Deploy Dev |
| **B5** | Kolom DB `previous_clean_photo_url`, snapshot clean lama di `saveAndCommitCleanPhoto`, proxy URL API, aksi `revert_previous` & tombol `↩️ Tolak, pakai foto sebelumnya` | [lib/db-pg.js](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js), [lib/product-repository.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-repository.js), [lib/product-bulk-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-bulk-worker.js), [app/api/v2/products/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/products/route.js), [app/api/v2/products/[id]/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/products/[id]/route.js), [app/api/v2/products/[id]/photo-review/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/products/[id]/photo-review/route.js) | Selesai & Deploy Dev |
| **B6** | Unit test helper & kolom B5, suite produk, build production Next.js, serta verifikasi deploy & skema Dev | [tests/product-card-photo-view.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/product-card-photo-view.test.js) | Selesai |

---

## 2. Hasil Verifikasi Teknis

1. **Pengecekan Token Warna Semantik**: Zero hardcoded hex/rgb pada diff UI (`app/products/page.js` & `app/products/ProductDatabaseModal.js`).
2. **Unit Test & Kontrak Katalog Produk**:
   - `tests/product-card-photo-view.test.js` (6 tes), `tests/gemini-model-resolver.test.js` (5 tes), `tests/product-active-photo-contract.test.js`, `tests/product-photo-flow.test.js` (2 tes), `tests/product-photo-picker.test.js` (6 tes), `tests/product-photo-revisi.test.js` (15 tes), `tests/product-scraper-tenant.test.js` (2 tes): **37/37 pass, 0 fail**.
   - `npm run test:product-catalog`: **Passed**.
3. **Production Build**: `npm run build` selesai dengan exit code `0`.
4. **Atomic Deploy Dev (`5020`/`7020`)**:
   - `npm run deploy:dev:atomic -- --ref a810fc6ec69b7e03d3f28bd066e3b1a82685e4a5 --apply --confirm-dev` -> `deployment_success=true`, `release_id=20261117T134452Z-a810fc6ec69b`.
   - `http://100.95.245.55:5020/products` (`-L`) HTTP `200`, `http://100.95.245.55:7020/health` HTTP `200`.
   - PM2 `maknaflow-dev-ui` & `maknaflow-dev-api` status `online` dengan `pm_cwd=/Users/masbenu/maknaflow-dev-atomic/releases/20261117T134452Z-a810fc6ec69b`, `PG_SEARCH_PATH=dev`, `PGPOOL_MAX=3`.
   - Skema PostgreSQL `dev.product_extractions` terverifikasi memiliki kolom `previous_clean_photo_url` (`text`).

---

## 3. Daftar Cek Uji Pengguna di Dev (`http://100.95.245.55:5020/products`)

1. Buka menu **Products** di Dev (`http://100.95.245.55:5020/products`) dan pastikan kartu produk yang punya foto bersih langsung menampilkan **Hasil AI** sebagai thumbnail default dengan badge pojok status (*Perlu ditinjau*, *Disetujui*, atau *Sedang dibuat*).
2. Klik sakelar **Asli | Hasil AI** di bawah thumbnail untuk memastikan pratinjau berpindah antar foto tanpa memuat ulang atau menyimpan ke database.
3. Klik thumbnail produk untuk membuka **Jendela Banding**, lalu periksa tampilan side-by-side **Foto Asli** vs **Hasil AI**, metadata sumber/waktu pembaruan, zoom gambar saat diklik, serta tombol **Setujui** (khusus `needs_review`), **Ganti Foto**, dan **Ulangi Generate**.
4. Klik **🧠 Enrich AI** (atau **🧠 Coba lagi** jika ada produk dengan status enrichment gagal retryable) di footer kartu, pastikan indikator loading **Enriching…** muncul lalu memicu background worker.
5. Jika melakukan **Ulangi Generate** pada produk yang sudah punya foto clean sebelumnya, buka **Jendela Banding** setelah foto baru selesai diproses dan uji tombol **↩️ Tolak, pakai foto sebelumnya** untuk memulihkan versi clean sebelumnya.
6. Buka **⚙️ Detail** → tab **Foto & AI** untuk memastikan pratinjau **Foto Asli** & **Hasil AI** (hanya baca + klik zoom, atau *"Belum ada"*) tampil sebelum form unggah foto raw, baik dalam **Light Mode** maupun **Dark Mode**.

> [!WARNING]
> Bagian B5 menambahkan kolom baru `previous_clean_photo_url` pada tabel `product_extractions`. Jika kode nanti dinaikkan ke Staging dan dilakukan rollback ke rilis lama, rollback kode tidak mengembalikan/menghapus kolom database tersebut.
