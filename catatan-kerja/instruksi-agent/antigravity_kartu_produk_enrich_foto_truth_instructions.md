# Instruksi Antigravity: Kartu Produk (Enrich & Foto G-Labs) + Truth Berbahasa Inggris

> Dasar analisa: `catatan-kerja/usulan/USULAN_PERBAIKAN_KARTU_PRODUK_ENRICH_FOTO_TRUTH.md`. Menu: Product Database. Baca dulu kartu `sot/menus/kartu/products.md`.

Ada dua pekerjaan terpisah. Kerjakan **A dulu**, lalu B.

---

## A. `hotfix/truth-bahasa-inggris` (tanpa UI)

Buat dari `main` terbaru: `git checkout main && git pull && git checkout -b hotfix/truth-bahasa-inggris`.

### A1. Perbaiki prompt enrichment
File: `lib/product-bulk-worker.js` → `buildEnrichmentPrompt` (~baris 214).

- `product_truth` dan `geometric_truth` **wajib Bahasa Inggris**.
- Definisi kedua Truth mengikuti `buildBatchProductTruthsPrompt` di `lib/prompts.js` (~4772):
  - **product_truth**: tampilan luar produk/kemasan untuk mengunci T2I. Isinya warna dominan, letak logo, teks utama di kemasan, jenis tutup, dan aksen warna. Panjang 3–4 kalimat.
  - **geometric_truth**: bentuk 3D wadah dan material/permukaan untuk I2V. Contoh: silinder tegak, plastik doff, kaca bening. Panjang 2–3 kalimat.
- `unique_selling_point` dan `category` **tetap Bahasa Indonesia**, karena dipakai naskah VO.
- Aturan wajib patuh `packaging_type` tetap berlaku.
- Jangan mengubah bagian prompt lain.
- Bila `buildBatchProductTruthsPrompt` memang tidak dipakai di mana pun, pindahkan isi definisinya ke satu konstanta bersama yang dipakai keduanya, atau hapus fungsi mati itu. Pilih salah satu, lalu sebutkan pilihannya di laporan.

### A2. Penjaga bahasa
- Buat fungsi kecil `looksIndonesian(text)` di `lib/product-truth-language.js`. Fungsi ini menghitung kata umum Indonesia: `dan, yang, dengan, berbentuk, kemasan, berwarna, terbuat, untuk, dari, berisi`. Teks dianggap Indonesia bila ada **≥3 kata** tersebut, atau rasionya **>8%**.
- Setelah enrichment, bila salah satu Truth terdeteksi Indonesia, lakukan **satu** panggilan terjemah ke Inggris:
  - Pakai `resolveModelChain({ role: 'light', taskType: 'PRODUCT_ENRICHMENT' })` dan pembungkus cadangan yang sudah ada.
  - Jangan memakai nama model tertulis langsung.
- Bila terjemahan gagal, simpan hasil apa adanya dan catat peringatan di log. Enrichment tidak boleh gagal hanya karena urusan bahasa.

### A3. Skrip data lama (dry-run dulu)
Buat `scripts/translate-product-truths.mjs`:
- Argumen: `--schema <dev|staging>` (wajib), `--tenant <id>` (opsional), dan `--apply` (opsional; default **dry-run**).
- Hanya memproses produk yang Truth-nya terdeteksi Indonesia.
- Hanya mengubah kolom `product_truth` dan `geometric_truth`. Jangan menyentuh USP, kategori, prompt foto, maupun foto.
- Dry-run mencetak tabel per produk: nama, tenant, Truth sebelum → sesudah (dipotong 120 karakter), dan jumlah total.
- Mode `--apply` hanya boleh dijalankan di **Dev** oleh agen. Di **staging**, `--apply` hanya dijalankan setelah pengguna menyatakan setuju di chat.
- Kunci API dibaca dari pool atau env. Jangan menulis kunci di skrip.

### A4. Keterangan di form
Di `app/products/ProductDatabaseModal.js`, tambahkan teks bantu kecil di bawah kolom Product Truth dan Geometric Truth: *"Ditulis dalam Bahasa Inggris — dipakai langsung untuk prompt gambar/video."* Gunakan token `var(--text-muted)`. Perubahan ini hanya teks, jadi tidak perlu mockup.

### A5. Tes
- Tes unit `looksIndonesian`: kalimat Indonesia → true; kalimat Inggris → false; teks kosong → false.
- Tes prompt: hasil `buildEnrichmentPrompt` memuat aturan Bahasa Inggris untuk kedua Truth.
- Tes penjaga: hasil mock berbahasa Indonesia → fungsi terjemah dipanggil satu kali. Hasil mock Inggris → fungsi terjemah tidak dipanggil.
- `npm run build` dan `npm run test:product-catalog` harus lulus, begitu juga tes produk yang sudah ada.

### A6. Uji Dev
1. Deploy branch ke Dev (`npm run deploy:dev:atomic -- --ref <full-sha> --apply --confirm-dev`).
2. Enrich satu produk uji di Dev, lalu tunjukkan bahwa Truth-nya berbahasa Inggris.
3. Jalankan dry-run skrip A3 untuk `--schema staging` (hanya baca), lalu lampirkan ringkasannya di laporan.

---

## B. `hotfix/kartu-produk-foto-enrich` (UI)

Buat dari `main` terbaru. Jika A sudah digabung ke `main`, mulai dari `main` yang baru.

### B0. Mockup dulu (wajib SOP)
- Buat `public/mockup_kartu_produk_foto_enrich.html` (standalone, berisi token desain sendiri, mendukung light/dark).
- Sinkronkan ke staging 5010 lalu kirim linknya: `http://100.95.245.55:5010/mockup_kartu_produk_foto_enrich.html`.
- Mockup memperlihatkan kartu dalam 3 keadaan:
  1. needs_review + hasil G-Labs
  2. approved
  3. enrichment gagal (retryable)
- Mockup juga memperlihatkan jendela banding dan tab foto di modal Edit.
- **Pasang ke aplikasi hanya setelah pengguna menyetujui mockup.**

### B1. Tombol Enrich di kartu
- Di baris tombol kartu `app/products/page.js` (dekat ✅ Setujui / 🔄 Ganti Foto / Edit, ~baris 1740–1800), tambahkan tombol **"🧠 Enrich AI"** yang memanggil `handleReEnrichProduct(p.id)`. Fungsi ini sudah ada (~555) dan saat ini tidak dipakai.
- Saat `reEnrichingId === p.id` atau `enrichment_status` bernilai `pending`/`processing`, tombol berbunyi "Enriching…" dengan spinner dan tidak bisa diklik.
- Bila `enrichment_status === 'failed'` dan `enrichment_retryable === true`, label tombol menjadi **"🧠 Coba lagi"**. Pastikan data daftar produk memuat field ini. Bila daftar (`GET /api/v2/products`) belum mengirimnya, tambahkan perhitungan yang sama seperti di `[id]/route.js`.
- Contoh tombol lama ada di commit `700d077^` (`git show '700d077^:app/products/page.js'`, cari `handleReEnrichProduct(p.id)`). Ganti variabel warnanya dengan token semantik.

### B2. Thumbnail kartu menampilkan hasil terbaru
Logika foto di ~baris 1353 diganti menjadi:
- Default tab = **`cleaned`** bila `clean_photo_url`/`cleaned_photo_url` ada. Selain itu `raw`. Default ini **tidak lagi bergantung pada `active_photo`**.
- Tambahkan label kecil di pojok thumbnail:
  - `needs_review` → "Perlu ditinjau" (`--status-warning-soft` / `--status-warning`)
  - `approved` → "Disetujui" (`--status-success-soft` / `--status-success`)
  - `processing`/`pending` → "Sedang dibuat"
- Tambahkan sakelar kecil **Asli | Hasil AI** di bawah thumbnail. Sakelar ini memakai state `viewTabs` yang sudah ada dan hanya mengubah tampilan, tanpa menyimpan ke database.
- Klik thumbnail membuka **jendela banding** (B3), menggantikan zoom biasa.

### B3. Jendela banding
- Isi: foto **Asli** (`raw_photo_url`) dan **Hasil AI** (`cleaned_photo_url || clean_photo_url`) berdampingan, masing-masing minimal 320px dan bisa diperbesar. Di mobile, susunannya bertumpuk.
- Keterangan: sumber (`photo_provider`: G-Labs/Gemini), status, dan tanggal `updated_at`.
- Tombol:
  - **Setujui**: hanya tampil saat `needs_review`. Memakai endpoint `POST /api/v2/products/[id]/photo-review` yang sudah ada.
  - **Ganti Foto**: membuka modal ganti foto yang sudah ada.
  - **Ulangi Generate**: memanggil `POST /api/v2/products/regenerate-photos` dengan `{ ids: [p.id] }` setelah konfirmasi.
- Tombol ✅ Setujui di kartu ikut membuka jendela ini. Gantikan modal review kecil yang lama. Catatan peninjauan AI tetap ditampilkan.

### B4. Modal Edit produk
Di `app/products/ProductDatabaseModal.js`, di bagian/tab foto, tampilkan foto **Asli** dan **Hasil AI** yang sedang tersimpan. Tampilan ini hanya baca, bisa diperbesar, dan diletakkan di atas kolom unggah foto mentah. Bila belum ada foto, tampilkan "Belum ada".

### B5. Opsional, butuh izin pengguna (jangan dikerjakan tanpa izin)
Kolom baru `previous_clean_photo_url` diisi sebelum hasil G-Labs/Gemini menimpa foto clean di `saveAndCommitCleanPhoto` (`lib/product-bulk-worker.js`). Ditambah tombol "Tolak, pakai foto sebelumnya". Ini **mengubah struktur database**, jadi **tanyakan dulu ke pengguna** dan sebutkan bahwa rollback tidak mengembalikan database.

### B6. Tes & uji Dev
- `npm run build`, `npm run test:product-catalog`, dan tes produk/foto yang ada harus lulus.
- Tes unit fungsi pemilih foto default kartu: ada clean → `cleaned`; tidak ada clean → `raw`.
- Deploy ke Dev, lalu buat daftar cek uji untuk pengguna:
  1. Tombol Enrich ada di kartu dan berjalan.
  2. Produk `needs_review` menampilkan hasil AI beserta labelnya.
  3. Sakelar Asli/Hasil AI berfungsi.
  4. Jendela banding: Setujui, Ganti Foto, dan Ulangi Generate berfungsi.
  5. Modal Edit menampilkan kedua foto.
  6. Tampilan benar di light dan dark mode.

---

## Larangan (A dan B)

- Gunakan hanya token CSS semantik. Jangan menulis warna hex/rgb.
- Jangan menghapus produk atau file foto. Jangan mengubah data staging, kecuali `--apply` skrip A3 setelah izin pengguna.
- Jangan mengubah `tenant_settings`, API key, atau pool.
- Jangan menulis nama model atau kunci API langsung di kode.
- Jangan merge ke `main`, rilis, atau deploy staging tanpa izin eksplisit pengguna. Production dilarang.
- Perbarui `sot/menus/kartu/products.md` saat rilis.

## Laporan balik (Bahasa Indonesia sederhana, untuk marketer)

Tulis di `catatan-kerja/laporan/` dan daftarkan di `_DAFTAR_ISI.md`. Untuk masing-masing A dan B:
1. 3–5 kalimat tentang apa yang berubah bagi pengguna.
2. Contoh Truth sebelum → sesudah (A), atau link mockup dan link Dev (B).
3. Hasil tes dan ringkasan dry-run staging (jumlah produk yang akan diterjemahkan per tenant).
4. Branch, SHA, dan daftar cek uji Dev.
5. Pertanyaan izin:
   - *"Boleh naik ke staging?"*
   - (A) *"Boleh jalankan terjemah data lama di staging?"*
   - (B, bila relevan) *"Boleh tambah kolom foto sebelumnya?"*
