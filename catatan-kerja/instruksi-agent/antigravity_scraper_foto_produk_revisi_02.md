# Revisi 02: Scraper Foto Produk (setelah v2.49.2, diuji 17 Nov 2026 di staging v2.50.3)

> Berlaku untuk `antigravity_scraper_foto_produk_instructions.md` dan `antigravity_scraper_foto_produk_revisi_01.md` (folder ini). Baca keduanya dulu. Jika bertentangan, **dokumen ini yang berlaku**.

## Mandat

Revisi 01 dirilis di v2.49.2 (`7cc37d2`, `c7c4573`). Staging sekarang berjalan di v2.50.3 (`c0b5516`), yang masih memuat kode scraper yang sama. Uji 16–17 Nov menemukan **satu bug fatal** (S1), beberapa bug data (S2–S5), dan perbaikan kualitas foto (S6–S9). Kerjakan sesuai pembagian branch di bawah. Tetap di lingkup scraper/foto/katalog produk.

## Bukti uji (staging, tenant `default_tenant`)

| Produk | Waktu | Hasil |
|---|---|---|
| Habarlic `pe_1794803911352_653` | 16 Nov 12:55 (**v2.49.1**, sebelum Revisi 01) | ✅ Picker memilih `b6b4581b…` (1200px), crop jalan, P4 `has_person=false`, `approved`, G-Labs berhasil. Catatan: crop mepet (571×580) dan sisi putih kotak ikut terhapus oleh rembg. |
| Texania `pe_1794894490699_828` | 17 Nov 05:48 | ❌ URL Tokopedia sudah **404** (`raw_description`: "Waduh, tujuanmu nggak ada! …"). Produk **tetap disimpan**. Gemini mengarang USP dan `geometric_truth` ("hitam matte", padahal produk berwarna cream). `scraped_image_url = "https://images.tokopedia.net"` (domain saja, tanpa path). |
| Cuculemon `pe_1794900810596_563` | 17 Nov 14:34 | ⚠️ Halaman valid, tapi `needs_review` "semua kandidat memuat orang/teks", **tanpa foto clean**. Hanya 5 kandidat: 1 DOM 700px, og:image 700px, 3 thumbnail regex 200px (`resize-jpeg:200:0`). Enrichment gagal `QUOTA_EXHAUSTED`. Disimpan ke `default_tenant` padahal sesi MCP sudah `cf_switch_tenant` ke PT GIM Sosmed. |

Lokasi data di Mac mini (`masbenu@100.95.245.55`, **hanya baca**):
- Log: `~/maknaflow-staging-atomic/shared/logs/staging-ui.out.log` dan **`staging-ui.err.log`**. `console.warn`/`console.error` masuk ke `.err.log`.
- Kandidat Cuculemon: `~/maknaflow-staging-atomic/shared/public/uploads/products/candidates/pe_1794900810596_563/` (`cand_0.jpg`, `cand_1.jpg`, `cand_3.webp`, `cand_4.webp`, `cand_5.webp`).

---

## Pembagian branch (SOP baru `AGENTS.md`: Alur Branch Dev vs Staging)

Cek `git branch --show-current` sebelum mulai. Jangan kerja langsung di `main`.

| Branch | Isi | Jalur |
|---|---|---|
| `hotfix/scraper-foto-r02` | S1, S2, S3, S4 (bug di staging) | Lolos uji lokal → laporkan → **minta izin** → merge ke `main` → `release-non-interactive --type patch` → deploy staging. |
| `fitur/scraper-foto-galeri-r02` | S5–S9 (kualitas & fitur), dibuat dari `main` **setelah** hotfix digabung | Commit + push branch (tanpa release) → deploy **Dev** (`deploy:dev:atomic`, 5020) → pengguna menguji → naik ke staging hanya setelah pengguna menyatakan lolos (SOP pintu 1 hari). |

---

## Bagian A: Hotfix (`hotfix/scraper-foto-r02`)

### S1. FATAL: `processCleanInputPath is not defined`, sehingga crop dan hapus latar selalu gagal

**Bukti** (`staging-ui.err.log`, Cuculemon 14:34:14–15):
```
AI Smart Cropping failed (using original): processCleanInputPath is not defined
Gagal download/proses gambar produk: processCleanInputPath is not defined
Gagal hapus background: processCleanInputPath is not defined
```
`lib/scheduler-processors.js` (`processProductScraper`) memakai `processCleanInputPath` di baris ~10748, 10751, 10756, 10760, dan 10779, tetapi variabel itu **tidak pernah dideklarasikan**. Akibatnya, sejak v2.49.2 **setiap** scrape baru dan `refresh_photo` gagal crop **dan** gagal hapus latar: produk tersimpan tanpa foto clean dan berstatus `needs_review`. Inilah sebab Cuculemon tidak punya foto clean. Alasan aslinya juga tertutup oleh alasan picker (lihat S1.3).

**Perbaikan:**
1. Deklarasikan `let processCleanInputPath = null;` di awal loop per produk (bersama `rawPhotoPath`, `cleanPhotoPath`).
2. Bungkus logika foto (download → crop → clean → final check → status) ke fungsi yang bisa dites. Fungsi `processProductPhotoFromRaw()` sudah ada di `lib/product-photo-picker.js`; pakai ulang dari scraper agar tidak ada dua salinan logika.
3. `decidePhotoStatus()`: **gabungkan** semua alasan ke `photo_error` (mis. `"semua kandidat ditolak; hapus latar belakang gagal"`), jangan hanya alasan pertama.
4. **Tes wajib:** jalankan alur foto scraper end-to-end dengan Playwright, Gemini, rembg, dan download di-mock (fixture gambar kecil). Pastikan foto clean terbentuk dan tidak ada `ReferenceError`. Tes ini juga menjaga regresi serupa.
5. Cek ulang semua produk yang di-scrape/refresh sejak v2.49.2 di staging (dry-run, hanya baca): daftar produk dengan `raw_photo_url` terisi tetapi `cleaned_photo_url` kosong, dibuat setelah 16 Nov 16:16. Laporkan daftarnya. **Jangan** memprosesnya ulang tanpa izin. Setelah hotfix live, pengguna bisa memakai "Ganti Foto → Ambil Ulang Otomatis" atau `refresh_photo`.

### S2. Halaman 404 / produk tidak ada tetap disimpan

**Perbaikan** di `lib/url-scraper.js` (`scrapeUrl`, cabang Playwright) dan `lib/playwright-scraper.js`:
1. Kembalikan HTTP status dari `page.goto()` (`response.status()`) di hasil `scrapeUrlPlaywright`.
2. Fungsi murni `detectNotFoundPage({ httpStatus, title, bodyText })` → `{ notFound: boolean, reason }`. Tanda 404:
   - `httpStatus` 404/410;
   - teks: "tujuanmu nggak ada", "halaman tidak ditemukan", "produk tidak ditemukan", "produk ini tidak tersedia", "page not found" (Shopee: "produk tidak ditemukan", "produk ini tidak ada");
   - halaman tanpa harga (`Rp`) **dan** tanpa tanda detail produk ("Detail produk", "Spesifikasi", "Deskripsi produk").
3. Jika `notFound`: lempar error khusus `code: 'PRODUCT_NOT_FOUND'`, **tanpa** fallback AI Search Grounding (fallback itu yang membuka jalan untuk Gemini mengarang).
4. Di `processProductScraper()`: URL `PRODUCT_NOT_FOUND` masuk `scrapeErrors[url] = 'Produk tidak ditemukan (404): <reason>'`, **tidak** diekstrak dan **tidak** disimpan.
5. Hasil job: `{ processed: true, results, errors, status_summary }` dengan `status_summary` = `'failed'` (semua URL gagal), `'partial'`, atau `'ok'`. **Jangan** mengubah logika retry scheduler umum (`lib/scheduler.js`, `lib/db.js`). 404 itu permanen dan tidak boleh diulang otomatis.
6. **Agar agen bisa melihat hasilnya:** `cf_scrape_product_url` sekarang hanya mengembalikan `job_ids`, dan `cf_get_job_status` tidak membaca job scheduler produk (id numerik diarahkan ke ringkasan storyboard). Tambahkan:
   - `GET /api/v2/products/scrape/jobs/[jobId]` (tenant-scoped): `status` job, `status_summary`, `results` (`product_id`, `product_name`), `errors` per URL.
   - Tool MCP baru `cf_get_scrape_status({ job_id })` yang memanggil endpoint itu. Jangan mengubah `cf_get_job_status`.
7. **Tes:** `detectNotFoundPage` dengan fixture `tests/fixtures/tokopedia_404_2026.html` (teks "Waduh, tujuanmu nggak ada!", tanpa harga), satu fixture halaman produk valid (harus `notFound=false`), dan kasus `httpStatus=404`. Ditambah tes processor: URL 404 tidak memanggil `createProductExtraction` dan muncul di `errors`.
8. **Data Texania:** jangan dihapus. Buat skrip dry-run `scripts/flag-not-found-products.mjs --schema staging` yang mendaftar produk dengan `raw_description` berisi tanda 404 di atas. Opsi `--apply` hanya mengisi `enrichment_status = 'failed'`, `enrichment_error = 'Sumber produk 404: data dikarang, jangan dipakai'`, `photo_status = 'needs_review'`, `photo_error = 'sumber produk 404'`. Jalankan `--apply` hanya dengan izin pengguna.

### S3. Kandidat foto hanya domain (`https://images.tokopedia.net`)

1. `parseHtml` → `addCandidate`: tolak URL yang path-nya kosong atau `/`, atau yang tidak tampak seperti gambar. Syarat lolos: path mengandung ekstensi gambar (`.jpg|.jpeg|.png|.webp|.avif`), `~tplv-`, atau `/img/`.
2. Pakai validator yang sama untuk `scraped_image_url` dari ekstraksi Gemini (cadangan) dan di `pickBestProductPhoto` sebelum mengunduh.
3. **Decode entitas HTML** di URL hasil regex (`&amp;` → `&`). Bukti: kandidat regex Cuculemon memuat `&amp;x-expires=…&amp;x-signature=…`, sehingga parameter tanda tangan rusak.
4. **Tes:** `https://images.tokopedia.net` dan `https://images.tokopedia.net/` ditolak; URL dengan `&amp;` keluar sebagai `&`; URL `images.tokopedia.net/img/cache/700/…jpeg.webp` tetap lolos.

### S4. Tenant sesi MCP tidak sampai ke job

**Sebab:** MCP sudah mengirim header `x-tenant-override` (`apps/mcp/tools.mjs` ~296–350), dan route berjalan dalam `withTenantContext`. Tetapi `createJob('product_scraper', …)` di `app/api/v2/products/scrape/route.js` (~186) **tidak** menyertakan `tenant_id` di payload. Scheduler (`lib/scheduler.js` ~266–287) menjalankan job dengan `payload.tenant_id` atau jatuh ke `default_tenant`. Hal yang sama terjadi pada `createJob` di `app/api/v2/products/[id]/photo-replace/route.js` (~62, ~139, ~183).

**Perbaikan:**
1. Semua `createJob` di dua route itu menyertakan `tenant_id: getActiveTenantId()`.
2. Pencarian produk lama di processor (`allProducts`, ~10420) dan `findExistingProduct` di route: pastikan **dibatasi ke tenant aktif**. Cek apakah adapter DB sudah otomatis memfilter; jika belum, tambahkan `WHERE tenant_id = ?`. Satu URL yang sama boleh ada di dua tenant.
3. `createProductExtraction` menyimpan `tenant_id` dari konteks job. Verifikasi dengan tes.
4. **Tes:** payload job berisi `tenant_id` dari konteks; produk dengan URL sama di tenant lain tidak dianggap "sudah ada".
5. **Data:** skrip dry-run `scripts/move-product-tenant.mjs --schema staging --ids <id,...> --to <tenant_id>` yang menampilkan rencana pemindahan (produk + relasi yang ikut, mis. link brand). Jangan menjalankan `--apply`. **Pengguna yang memutuskan** produk mana yang dipindah (kandidat: produk bertag `riset-mingguan` / `teleradar` / `uji-scraper` tanggal 16–17 Nov, termasuk Cuculemon). Jangan menghapus apa pun.

---

## Bagian B: Fitur (`fitur/scraper-foto-galeri-r02`, deploy ke Dev dulu)

### S5. Galeri belum terkumpul lengkap (target ≥ 5 kandidat ≥ 600px)

Di `scrapeUrlPlaywright()`:
1. Cari thumbnail galeri (mis. `img[alt^="Product detail media"]` dan elemen thumbnail di sekitar foto utama). Untuk tiap thumbnail (maks 8): klik atau hover, tunggu foto utama berganti, lalu ambil `currentSrc` foto utama. Ini cara paling andal untuk mendapat URL besar yang sudah bertanda tangan sah.
2. Scroll galeri agar gambar lazy-load ikut termuat sebelum membaca `img`.
3. Varian ukuran: untuk `~tplv-…-resize-jpeg:200:0`, coba varian `:700:0`/`:1200:0` **hanya** bila hasil unduhan valid (HTTP 200, sharp bisa membaca, lebar ≥ 600). Jika tanda tangan menolak, pakai `currentSrc` dari langkah 1. Untuk `images.tokopedia.net/img/cache/700/…`, coba `/img/cache/900/` dengan validasi yang sama.
4. Kandidat < 600px hanya dipakai jika jumlah kandidat ≥ 600px kurang dari 2.
5. Catat jumlah kandidat dan resolusi di log job serta audit.
6. **Uji Dev:** Cuculemon menghasilkan ≥ 5 kandidat ≥ 600px.

### S6. Longgarkan rubrik Photo Picker

`PHOTO_PICKER_PROMPT` dan `evaluateCandidateScores()` di `lib/product-photo-picker.js`:
1. **Tidak menggugurkan** (boleh lolos jika produk utuh terlihat di latar polos/sederhana, karena smart crop akan memotong ke produk): label spesifikasi kecil, angka kapasitas ("750ml", "1000ML"), kode model ("SU304"), garis dimensi, logo brand di pojok, latar warna polos (mis. pink).
2. **Menggugurkan:** ada orang/wajah/tangan; infografis dominan (teks/diagram > ±30% area); kolase multi-panel; produk tidak terlihat utuh.
3. Tambah field schema `text_area_pct` (0–100) dan `is_collage` (boolean). Aturan di kode: tolak jika `has_person`, `is_collage`, `!product_visible`, atau (`is_infographic` **dan** `text_area_pct > 30`). `text_overlay` saja tidak lagi menggugurkan.
4. Tambahkan dua contoh ke prompt (tanpa nama brand asli):
   - *"Satu botol di latar putih dengan label kecil '750ml' dan garis dimensi tipis → layak (has_person=false, is_infographic=false, text_area_pct≈10)."*
   - *"Tiga botol di latar pink dengan teks '1000ML' besar di pojok → layak bila botol utuh terlihat (text_area_pct≈20)."*
5. **Tes** dengan fixture `tests/fixtures/photo_picker_cuculemon_eval.json`: JSON penilaian AI tiruan yang meniru kasus Cuculemon (cand_0 satu botol + label kecil, cand_1 tiga botol + teks 1000ML, thumbnail 200px). Hasil yang diharapkan: cand_0 atau cand_1 terpilih, `needsReview=false`. Kasus Habarlic (banner berwajah) tetap ditolak. **Jangan** menyimpan foto produk asli seller ke repo; cukup JSON penilaian.
6. Opsional (Dev): skrip `scripts/test-scraper-photo-pick.mjs --from-dir <folder>` untuk menilai ulang file kandidat lokal dengan rubrik baru (salin kandidat Cuculemon dari staging ke folder `scratch/` lokal, tidak di-commit).

### S7. Semua kandidat ditolak → tetap hasilkan foto clean untuk ditinjau

Dengan S1 diperbaiki, crop + rembg seharusnya jalan untuk kandidat fallback. Pastikan aturannya eksplisit:
1. Semua kandidat ditolak, tetapi ada kandidat **tanpa orang** dengan skor ≥ 70 → pilih yang tertinggi, jalankan crop + rembg + final check, status `needs_review` (`photo_error`: "dipilih otomatis, perlu ditinjau"). Operator tinggal klik **Setujui Foto**.
2. Semua kandidat memuat orang, atau skor < 70 → simpan raw saja, tanpa clean, status `needs_review` ("tidak ada foto layak, ganti foto manual").
3. G-Labs tetap dilewati untuk `needs_review`.
4. **Tes:** kedua cabang.

### S8. Margin crop dan sisi putih kemasan hilang

1. Padding crop di `computeCropBox()`: dari 6% menjadi **10%** per sisi (tetap dibatasi tepi gambar). Perbarui tes.
2. **Lewati rembg bila latar sudah putih:** fungsi `isPlainWhiteBackground(buffer)` yang mengecek strip tepi (mis. 4% dari tiap sisi). Jika ≥ 95% piksel tepi berluminansi ≥ 245 dan saturasi rendah, jangan jalankan rembg; cukup ratakan ke kanvas putih dengan padding. Ini mencegah bagian putih kemasan ikut terhapus (kasus kotak Habarlic).
3. **Tes:** gambar sintetis latar putih + kotak putih bergaris abu → rembg dilewati; gambar latar pink → rembg jalan.

### S9. Enrichment gagal kuota: jelas dan bisa diulang

`QUOTA_EXHAUSTED` adalah masalah **konfigurasi kunci API**, bukan kode. **Jangan mengubah pool kunci, model, atau pengaturan kuota.** Yang diminta:
1. Di `lib/product-bulk-worker.js` (catch enrichment, ~195): bila pesan mengandung `QUOTA_EXHAUSTED`/rate limit/503, isi `enrichment_error = 'QUOTA_EXHAUSTED (dapat diulang): ' + pesan`.
2. Respons `GET /api/v2/products/[id]` (dipakai `cf_get_product_detail`) menambahkan field turunan `enrichment_retryable: true` dan `enrichment_retry_hint: "Jalankan cf_enrich_product untuk mengulang"` bila `enrichment_status = 'failed'` dan error termasuk kategori kuota. Tanpa kolom DB baru.
3. Pastikan `cf_enrich_product` (→ `/api/v2/products/re-enrich`) mengantrekan ulang produk `failed` dengan benar (sudah set `pending`; verifikasi dengan tes).
4. UI katalog: badge "Enrichment gagal (kuota) · Ulangi" yang memanggil re-enrich. Ini perubahan UI kecil, jadi buat/perbarui mockup dulu sesuai SOP (boleh menambah ke `public/mockup_foto_produk_review.html`).
5. Opsional: satu kali ulang otomatis 15 menit kemudian untuk error kuota, dengan penanda di `enrichment_error` agar tidak berulang terus.

### Kecil (boleh di branch fitur)
- Label trace Gemini untuk crop dan final check memakai `traceContext.stage` = `'product_photo_crop'` / `'product_photo_final_check'` (sekarang tercatat sebagai `start_frame_visual_qc`, yang mengacaukan laporan token).

---

## Tes yang wajib (ringkas)

Bagian A: tes end-to-end alur foto (mock), `decidePhotoStatus` gabung alasan, `detectNotFoundPage` (3 fixture), processor tidak menyimpan URL 404, validator kandidat domain-kosong + decode `&amp;`, `tenant_id` di payload job + pencarian produk tenant-scoped.
Bagian B: rubrik baru (fixture JSON Cuculemon + Habarlic), dua cabang S7, padding 10%, `isPlainWhiteBackground`, field `enrichment_retryable`.
Selalu jalankan: `node --test tests/url-scraper-tokopedia-images.test.js tests/product-photo-picker.test.js tests/base64-image-reference.test.js` + tes baru, `npm run test:product-catalog`, `npm run test:mcp`, `npm run build`.

## Kriteria selesai

**Hotfix (lokal → staging setelah izin):**
- [ ] Tes Bagian A lulus, build berhasil.
- [ ] Dry-run lokal Cuculemon: foto clean terbentuk, tidak ada `processCleanInputPath is not defined` di log.
- [ ] Dry-run URL Texania: tidak ada produk tersimpan, error `Produk tidak ditemukan (404)`.
- [ ] Laporan daftar produk staging yang terdampak S1 (dry-run) dan hasil dry-run skrip S2/S4.
- [ ] Setelah izin dan deploy: scrape lewat MCP di tenant PT GIM tersimpan di tenant itu; `cf_get_scrape_status` menampilkan hasil/error; log `.err.log` bersih dari `ReferenceError`.

**Fitur (Dev 5020 → staging setelah pengguna menyatakan lolos):**
- [ ] Cuculemon di Dev: ≥ 5 kandidat ≥ 600px, satu foto terpilih tanpa `needs_review`, foto clean rapi.
- [ ] Habarlic di Dev (`refresh_photo`): tetap foto botol+kotak, margin cukup, sisi putih kotak utuh.
- [ ] Produk dengan enrichment gagal kuota menampilkan "dapat diulang" di `cf_get_product_detail` dan di UI.

## Larangan (yang lama tetap berlaku)

- **Ikuti SOP branch baru:** tidak ada commit fitur langsung ke `main`; `release-non-interactive` hanya dari `main`; staging hanya menerima SHA `main`.
- **Jangan rilis, merge ke `main`, deploy staging, atau menjalankan skrip `--apply` tanpa izin eksplisit pengguna di chat.** Staging dipakai untuk produksi konten. Deploy Dev untuk branch fitur boleh.
- Jangan menghapus produk (termasuk Texania dan Cuculemon) atau file foto. Hanya tandai/pindahkan lewat skrip yang sudah disetujui.
- Jangan mengubah konfigurasi kunci API, model Gemini, kuota, atau logika retry scheduler umum.
- Jangan menyimpan foto produk asli seller ke repo. Fixture berupa HTML/JSON sintetis.
- Jangan polling SSH berulang. Akses staging hanya baca (log, file kandidat, query `SELECT`).
- Production dilarang.

## Format laporan balik

Bahasa Indonesia sederhana untuk marketer:
1. Ringkasan 3–5 kalimat. Sebut bug S1 dengan jelas: sejak v2.49.2 foto clean tidak terbentuk untuk produk baru.
2. Status S1–S9 (selesai / sebagian / belum + alasan satu baris), dipisah per branch.
3. Hasil tes, build, dan dry-run (Cuculemon, Texania, Habarlic).
4. Daftar produk staging terdampak S1, hasil dry-run skrip S2 (produk 404), dan S4 (rencana pindah tenant).
5. Branch, commit, dan SHA. Untuk branch fitur: link Dev dan daftar cek uji singkat.
6. Pertanyaan izin, dipisah:
   - *"Boleh hotfix digabung ke main, dirilis patch, dan dideploy ke staging?"*
   - *"Produk mana saja yang dipindah ke tenant PT GIM, dan boleh tandai produk 404?"*
   Tunggu jawaban.
