# Laporan Pelaksanaan: Truth Berbahasa Inggris (Bagian A) & Mockup Kartu Produk (Bagian B)

- **Tanggal**: 17 November 2026
- **Instruksi Sumber**: [antigravity_kartu_produk_enrich_foto_truth_instructions.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/instruksi-agent/antigravity_kartu_produk_enrich_foto_truth_instructions.md)

---

## Bagian A — `hotfix/truth-bahasa-inggris` (Sudah Jalan & Diuji di Dev `5020`)

### 1. Apa yang Berubah untuk Pengguna
- Saat AI memperkaya data produk baru atau *re-enrich* produk lama, kolom **Product Truth** (3–4 kalimat tampilan luar kemasan untuk kunci gambar T2I) dan **Geometric Truth** (2–3 kalimat bentuk 3D & material wadah untuk kunci video I2V) sekarang **selalu dihasilkan dalam Bahasa Inggris**.
- Kolom **USP** (*Unique Selling Point*) dan **Kategori** tetap dihasilkan dalam **Bahasa Indonesia** karena dipakai langsung untuk menyusun naskah voice-over.
- Sistem dilengkapi penjaga bahasa otomatis (`looksIndonesian`): bila hasil AI terlanjur berbahasa Indonesia, sistem otomatis melakukan satu kali terjemahan cadangan ke Bahasa Inggris tanpa membuat enrichment gagal bila terjadi error terjemahan.
- Di modal Detail/Edit produk, di bawah kolom *Product Truth* dan *Geometric Truth*, kini ada keterangan kecil: *"Ditulis dalam Bahasa Inggris — dipakai langsung untuk prompt gambar/video."*
- Definisi kedua Truth disatukan ke satu konstanta bersama (`PRODUCT_TRUTH_DEFINITIONS` di `lib/product-truth-language.js`) yang dipakai bersama oleh `buildBatchProductTruthsPrompt` (`lib/prompts.js`) dan `buildEnrichmentPrompt` (`lib/product-bulk-worker.js`).

### 2. Contoh Truth Sebelum → Sesudah
- **Sebelum (Dry-run data lama Staging — *Black Garlic Honey Madu Bawang Hitam Tunggal*, `default_tenant`)**:
  - Product Truth: *"Superfood herbal alami berbasis fermentasi bawang tunggal dan madu murni yang kaya antioksidan serta nyaman dikonsumsi…"*
  - Geometric Truth: *"Bulir-bulir bawang hitam tunggal berbentuk bulat lonjong terendam dalam cairan madu kental berwarna cokelat keemasan ge…"*
- **Sesudah terjemahan skrip (`scripts/translate-product-truths.mjs --schema staging --limit 5`, mode dry-run)**:
  - Product Truth: *"Natural herbal superfood based on fermented single garlic and pure honey, rich in antioxidants and suitable for daily c…"*
  - Geometric Truth: *"Oval-shaped single black garlic cloves submerged in a thick, dark golden-brown honey liquid."*
- **Uji Live Enrichment Dev (`5020`, `default_tenant`, `Botol Spray Serbaguna NutriClean 250ml`)**:
  - USP (tetap Bahasa Indonesia): *"Formulasi herbal alami yang aman dan ramah lingkungan untuk area dapur"*, dst.
  - Kategori (tetap Bahasa Indonesia): `"Pembersih Dapur"`
  - Product Truth (Inggris): *"The product is a 250ml matte white plastic spray bottle featuring a white and blue trigger mechanism at the top. A distinct green label is positioned centrally on the front face, prominently displaying the main text 'NutriClean'. The visual aesthetic combines opaque white with fresh green and blue accent colors. The logo and text remain crisp and clearly legible against the label background."*
  - Geometric Truth (Inggris): *"The container consists of an upright cylindrical plastic bottle body topped with a mechanical spray trigger head. The body features a matte plastic material finish with low specularity and smooth light diffusion across its curved vertical surface. The rigid structure maintains its defined shape under movement with realistic light interaction."*

### 3. Hasil Tes & Ringkasan Dry-Run Staging (`--schema staging`, Read-Only)
- **Tes Unit & Produk** (dijalankan pasca-edit Bagian A):
  - [product-truth-language.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/product-truth-language.test.js): **3/3 lulus** (`looksIndonesian`, `buildEnrichmentPrompt` & shared `PRODUCT_TRUTH_DEFINITIONS`, penjaga terjemah `ensureEnglishProductTruths` 1x untuk Indonesia & 0x untuk Inggris).
  - [gemini-model-resolver.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/gemini-model-resolver.test.js): **5/5 lulus**.
  - Tes produk/foto/scraper (`product-photo-flow.test.js`, `product-photo-picker.test.js`, `product-scraper-tenant.test.js`): **10/10 lulus**.
  - `npm run test:product-catalog`: **lulus**.
  - `npm run build`: Next.js compile & build lulus saat deployment atomic Dev (`deployment_success=true`, HTTP `200` di `/login` dan `/health`).
- **Ringkasan Dry-Run Staging (`node scripts/translate-product-truths.mjs --schema staging --limit 5`, tanpa mengubah DB Staging)**:
  - Total baris diperiksa: **281** | Terdeteksi Truth Bahasa Indonesia: **252** (`Diperbarui ke DB: 0`)
  - Rincian per tenant:
    - `default_tenant`: **225** produk
    - `tnt_sy-dodot_4ba27b`: **17** produk
    - `tnt_mas-ibnu_e0eb25`: **7** produk
    - `test_tenant_a_msnyh6em_2x62sm`: **1** produk
    - `test_tenant_a_msnyhznt_jbsms3`: **1** produk
    - `test_tenant_a_msnyiea4_sppzv0`: **1** produk

### 4. Branch, SHA & Daftar Cek Uji Dev (Bagian A)
- **Branch**: `hotfix/truth-bahasa-inggris`
- **Full SHA**: `6ee8388487ef6e552a16a666ec689b20ec70f002`
- **Link Dev**: `http://100.95.245.55:5020` (API `http://100.95.245.55:7020`)
- **Daftar Cek Uji Dev**:
  1. Buka `/products` di Dev (`http://100.95.245.55:5020/products`), tambah atau *re-enrich* satu produk → cek di detail modal bahwa *Product Truth* dan *Geometric Truth* terisi dalam Bahasa Inggris, sementara *USP* dan *Kategori* tetap Bahasa Indonesia.
  2. Cek di modal Edit produk bahwa keterangan *"Ditulis dalam Bahasa Inggris — dipakai langsung untuk prompt gambar/video."* tampil rapi di bawah kolom Truth (light & dark mode).
  3. *(Opsional Dev)* Jalankan `node scripts/translate-product-truths.mjs --schema dev --apply` bila ingin menerjemahkan 229 data lama di DB Dev secara penuh.

---

## Bagian B — `hotfix/kartu-produk-foto-enrich` (Tahap B0: Mockup Menunggu Persetujuan)

### 1. Apa yang Dirancang untuk Pengguna (Mockup)
- Mengembalikan tombol **🧠 Enrich AI** di setiap kartu produk (berubah menjadi *spinner* **Enriching…** saat diproses, dan **🧠 Coba lagi** bila gagal *retryable* seperti `MODEL_BUSY`).
- Thumbnail kartu otomatis menampilkan foto **Hasil AI** secara bawaan jika tersedia (atau foto **Asli** bila belum ada), dilengkapi label status (*Perlu ditinjau* / *Disetujui* / *Sedang dibuat*) dan sakelar tampilan cepat **Asli | Hasil AI**.
- Mengklik thumbnail atau tombol **✅ Setujui** membuka **jendela banding** berdampingan (*Asli* vs *Hasil AI*, sumber G-Labs/Gemini, status, tanggal `updated_at`, catatan AI, serta tombol **Setujui**, **Ganti Foto**, dan **Ulangi Generate**).
- Di tab foto modal Edit produk, foto *Asli* dan *Hasil AI* tersimpan ditampilkan hanya-baca di atas kolom unggah foto mentah.

### 2. Mockup & Status Aplikasi
- **Branch**: `hotfix/kartu-produk-foto-enrich` (dibuat dari `main` @ `82c21ff`)
- **Full SHA**: `b489ffcd105c3b1a4b976295b144b0102eef8965`
- **File Mockup**: [mockup_kartu_produk_foto_enrich.html](file:///Users/sabeqmmursyid/_cfstudio/public/mockup_kartu_produk_foto_enrich.html) (memperlihatkan 3 keadaan kartu, jendela banding interaktif, tab foto modal Edit, serta toggle Light & Dark Mode menggunakan 100% token semantik).
- **Catatan Akses HTTP Staging**: Penyalinan ke `~/maknaflow-staging-atomic/current/public/mockup_kartu_produk_foto_enrich.html` diuji dan menghasilkan HTTP `404` karena proses `next start` Next.js 16 di Staging hanya menyajikan berkas `public/` yang terindeks saat build/startup (bukan berarti berkas rusak; file mockup dibersihkan kembali dari release Staging agar tree tetap steril). Mockup dapat dibuka langsung dari file lokal [mockup_kartu_produk_foto_enrich.html](file:///Users/sabeqmmursyid/_cfstudio/public/mockup_kartu_produk_foto_enrich.html) atau dideploy sementara ke Dev `5020` bila disetujui.
- **UI React aplikasi (`app/products/page.js`, `ProductDatabaseModal.js`) untuk B1–B4 belum diubah** menunggu persetujuan mockup dari pengguna.

---

## Pertanyaan Izin untuk Langkah Selanjutnya

1. **Bagian B (UI)**: Apakah mockup [mockup_kartu_produk_foto_enrich.html](file:///Users/sabeqmmursyid/_cfstudio/public/mockup_kartu_produk_foto_enrich.html) sudah disetujui untuk langsung dipasang ke React (`B1`–`B4`), dites, dan dideploy ke Dev?
2. **Bagian B5 (Kolom Database Baru — Opsional)**: *"Boleh tambah kolom foto sebelumnya?"* (`previous_clean_photo_url` di `product_extractions` + tombol *"Tolak, pakai foto sebelumnya"* — catatan: menambah kolom mengubah struktur database dan rollback file tidak mengembalikan kolom database).
3. **Bagian A (`hotfix/truth-bahasa-inggris`)**:
   - *"Boleh naik ke staging?"* (setelah uji Dev disetujui)
   - *"Boleh jalankan terjemah data lama di staging?"* (`node scripts/translate-product-truths.mjs --schema staging --apply` untuk 252 produk).
