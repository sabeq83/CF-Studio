# Analisa & Usulan Perbaikan: Scrape Produk di Dev Terlihat Diam >3 Menit (Macet di Waterfall Gemini 180 Detik)

Tanggal analisa: 18 November 2026  
Lingkungan diuji: Dev (`http://100.95.245.55:5020/products`, branch `fitur/aktifkan-batch-scraper`)  
Contoh kasus: Job `#334` (`pe_1794965321596_109`) — URL Tokopedia Set Wajan Anti Lengket

---

## Ringkasan Eksekutif (Bahasa Singkat)

Playwright **tidak macet** dan server **tidak diam**. Pengambilan halaman Tokopedia selesai hanya dalam **21 detik** (`HTTP 200`).

Penyebab utama layar terlihat tidak terjadi apa-apa selama lebih dari 3–13 menit adalah:
1. **Model AI utama di Dev (`gemini-3.6-flash` dan `gemini-3.5-flash`) sedang hang di sisi Google** dan baru menyerah setelah **180 detik (3 menit) per model**.
2. **Satu kali scrape produk memanggil Gemini berkali-kali** (ekstrak data teks → pilih foto → crop foto → cek akhir foto), dan **setiap tahap selalu mengulang waterfall dari awal lagi** (`gemini-3.6-flash` → `3.5-flash` → `3.7-flash` → `3.8-flash`) sebelum akhirnya sampai ke `gemini-3.5-flash-lite` yang menjawab dalam **2,5–3,1 detik**.
3. **Pengaturan model AI di Dev tertinggal dari Staging** (Staging sudah memakai `gemini-3.5-flash-lite` sebagai primary & `gemini-3.1-flash-lite` untuk Vision QC, sedangkan Dev masih `gemini-3.6-flash`).
4. **Selama semua tahap belum selesai, kartu produk belum masuk tabel katalog** dan banner biru hanya menampilkan tulisan statis tanpa progres tahap, sehingga pengguna mengira sistem tidak bekerja.

---

## Bukti Kronologi Nyata dari Log Server Dev (`Job #334`)

Diambil langsung dari `dev-ui.out.log` dan database `dev.scheduler_jobs` / `dev.product_extractions`:

| Waktu (WIB) | Durasi Tahap | Kejadian di Server Dev |
|---|---:|---|
| `08:28:41` | 0 dtk | URL dikirim ke antrean (`scheduler_jobs` id `#334`, status `pending`) |
| `08:28:50` | +9 dtk | Scheduler mulai memproses `Job #334` (`product_scraper`) |
| `08:28:55` | +5 dtk | Halaman Tokopedia berhasil dibuka (`HTTP 200`) |
| `08:29:11` | +16 dtk | Playwright selesai baca halaman; kirim teks produk ke Gemini (`stage=general_ai`) |
| `08:32:11` | **180 dtk** | `gemini-3.6-flash` hang → **timeout 180s** (`180004 ms`) |
| `08:35:11` | **180 dtk** | `gemini-3.5-flash` hang → **timeout 180s** (`180003 ms`) |
| `08:35:18–31` | 20 dtk | `gemini-3.7-flash` (`503` x2) lalu `gemini-3.8-flash` (`503` x2) |
| `08:35:34` | **3,15 dtk** | `gemini-3.5-flash-lite` **BERHASIL** (`3150 ms`) |
| `08:35:34–38` | 4 dtk | 6 kandidat foto dari CDN Tokopedia selesai diunduh; mulai Photo Picker |
| `08:38:38` | **180 dtk** | Tahap Photo Picker (`product_photo_picker`): `gemini-3.6-flash` **timeout lagi 180s** (`179995 ms`) |
| `08:38:46–50` | ~12 dtk | `gemini-3.5-flash` (`503` x2), `gemini-3.7-flash` (`503` x2), `gemini-3.8-flash` (`503` x2) |
| `08:39:53` | **2,54 dtk** | `gemini-3.5-flash-lite` **BERHASIL** (`2541 ms`), memilih foto `#5` |
| `08:39:53+` | berjalan | Masuk tahap `processProductPhotoFromRaw` (`start_frame_visual_qc`): **kembali mencoba `gemini-3.6-flash` & `3.5-flash` dari awal lagi** |

Pada pengecekan terakhir (`08:42:35` WIB, **13+ menit** sejak submit), `Job #334` masih berstatus `running` dan `pe_1794965321596_109` di tabel `dev.product_extractions` masih **0 baris** (belum tampil di UI).

---

## Analisa Akar Masalah (4 Faktor Gabungan)

1. **Konfigurasi Model Dev Masih Mengarah ke Model yang Sedang Bermasalah**
   - Di database `dev.tenant_settings` (`default_tenant`): `gemini_model_primary = 'gemini-3.6-flash'`, `gemini_model_fallback = 'gemini-3.6-flash'`, sedangkan `gemini_model_light` dan `start_frame_visual_qc_model` kosong.
   - Sebaliknya di `staging.tenant_settings` sudah diatur `gemini_model_primary = 'gemini-3.5-flash-lite'` dan `start_frame_visual_qc_model = 'gemini-3.1-flash-lite'`.
   - Karena `gemini_model_light` dan `start_frame_visual_qc_model` kosong di Dev, `resolveModelChain` di [lib/gemini.js](file:///Users/sabeqmmursyid/_cfstudio/lib/gemini.js) jatuh kembali ke `primaryModel` (`gemini-3.6-flash`), sehingga semua tugas ringan scraper & foto dipaksa antre di model yang sedang lambat/hang.

2. **Tidak Ada "Ingatan Sementara" (Cooldown) untuk Model yang Baru Saja Timeout/503**
   - Di [lib/gemini.js](file:///Users/sabeqmmursyid/_cfstudio/lib/gemini.js), `makeModelResilient` dan `executeContentGeneration` hanya mencatat kuota key API (`rateLimitedKeys` untuk 429), tetapi **tidak mencatat model yang baru saja timeout 180s atau gagal 503**.
   - Akibatnya, ketika dalam 1 job yang sama scraper selesai membuang 6 menit di tahap teks lalu 4 menit kemudian masuk ke tahap `product_photo_picker`, `start_frame_visual_qc` (crop), dan `verifyCleanProductShot` (cek akhir), sistem dengan polos mencoba lagi dari `gemini-3.6-flash` dari awal setiap kali.

3. **Batas Timeout `180 detik` Terlalu Panjang untuk Tugas Ringan Scraper & Vision**
   - `callWithTimeout` pada `makeModelResilient` dan `executeContentGeneration` memakai default `180000 ms` (3 menit) untuk **semua** jenis panggilan AI, termasuk tugas JSON singkat scraper dan pemilihan foto.
   - Jika 2 model berurutan hang (misalnya `3.6-flash` dan `3.5-flash`), satu tahap saja langsung membakar **6 menit**, jauh melampaui batas sabar pengguna (apalagi 1 produk punya 3–4 panggilan Gemini).

4. **Umpan Balik UI Tidak Menampilkan Tahap Proses yang Sedang Berjalan**
   - Di [app/api/v2/products/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/products/route.js) hanya mengirim angka `scraping_count`, dan di [app/products/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/products/page.js) banner hanya menampilkan teks umum: `"Scraper aktif di latar belakang: ... sedang dianalisis..."`.
   - Produk juga baru di-`INSERT` ke `product_extractions` di akhir [lib/scheduler-processors.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js) setelah seluruh rangkaian foto selesai. Jadi selama 3–13 menit itu, di daftar produk tidak ada tanda kehidupan selain banner yang tidak berubah.

*(Temuan sampingan di log Dev: `Campaign Scheduler` item `#293` terus-terusan melakukan polling `pillar_glabs_poll` setiap menit dan gagal `fetch failed` ke worker G-Labs. Ini tidak memblokir antrean `product_scraper`, tetapi memenuhi file log error Dev dan membuat diagnosa lebih ramai.)*

---

## Usulan Perbaikan (Urutan Prioritas dari Paling Cepat & Berdampak Besar)

### 1. Perbaikan Instan Tanpa Ubah Kode (Konfigurasi Settings Dev) — *Bisa Langsung Diterapkan*
- Samakan setting model AI Dev dengan Staging melalui menu **Settings** (atau sinkronkan `dev.tenant_settings`):
  - Set `gemini_model_light` (Model Tugas Ringan / Scraper) ke `gemini-3.5-flash-lite` (atau `gemini-3.1-flash-lite`).
  - Set `start_frame_visual_qc_model` (Model Vision QC / Foto) ke `gemini-3.1-flash-lite` atau `gemini-3.5-flash-lite`.
  - Pertimbangkan mengubah `gemini_model_primary` di Dev menjadi `gemini-3.5-flash-lite` agar sama dengan Staging.
- **Dampak langsung:** Waktu tunggu 1 produk turun dari **>13 menit** menjadi sekitar **30–60 detik** total.

### 2. Tambahkan "Cooldown Model Bermasalah" di `lib/gemini.js` (Perbaikan Inti Sistem)
- Tambahkan cache memori berumur pendek (misalnya **5 menit**) pada `lib/gemini.js` untuk mencatat model yang baru saja gagal karena **timeout (408)** atau **503 habis 1 putaran** pada tier tersebut.
- Saat panggilan berikutnya masuk dalam rentang 5 menit itu, `resolveModelChain` otomatis **menggeser model yang sedang cooldown ke bagian paling belakang** (atau melewatinya sementara ke model berikutnya yang sehat seperti `gemini-3.5-flash-lite`).
- Bila model berikutnya berhasil, tahap lanjutan (`product_photo_picker`, `start_frame_visual_qc`, `verifyCleanProductShot`) langsung memakai model yang sehat tanpa buang waktu 3–6 menit lagi.

### 3. Timeout Khusus Tugas Ringan & Foto Scraper (`30–45 detik`, bukan `180 detik`)
- Tambahkan dukungan opsi `timeoutMs` di `makeModelResilient` (`generateWithImages` / `generateWithImage`) dan gunakan batas timeout lebih pendek untuk tugas scraper:
  - Ekstraksi JSON teks scraper (`taskType: 'SCRAPER'`, `role: 'light'`): `timeoutMs: 35000`–`45000` (35–45 detik).
  - Evaluasi foto picker / smart crop / final check scraper: `timeoutMs: 45000` (45 detik).
  - Tugas berat (riset / storyboard / deconstruct video) tetap memakai default `180000 ms` (3 menit).
- Pastikan juga di [lib/scheduler-processors.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js) fungsi ekstraksi data produk menggunakan `traceContext: { stage: 'product_scraper_extract' }` agar jejak log-nya tidak tertulis generik sebagai `stage=general_ai`.

### 4. Progres Nyata di Banner Scraper Halaman `/products` (UX & Transparansi)
- Simpan progres tahap ringkas di job (`scheduler_jobs` kolom `result` atau status progres ringan saat berjalan, misalnya: `step: "Buka URL (1/1)"` → `"Ekstrak Data AI"` → `"Pilih & Bersihkan Foto"` → `"Menyimpan Produk"` + `elapsed_seconds`).
- Tampilkan tahap aktif & waktu berjalan di banner biru halaman `/products` (contoh: *"Sedang memproses 1 produk: Pilih & Bersihkan Foto (berjalan 42 detik)..."*), sehingga pengguna langsung tahu proses hidup dan sedang di tahap mana tanpa membuka log server.

---

## Rekomendasi Langkah Eksekusi

1. **Segera (sekarang):** Terapkan poin #1 (update model ringan/vision di Dev Settings) agar uji Batch Scraper di Dev hari ini berjalan lancar tanpa menunggu lama.
2. **Berikutnya (perbaikan kode terpisah atau satu paket dengan pemolesan Batch Scraper):** Implementasikan poin #2 (cooldown model timeout/503), poin #3 (timeout 45 detik untuk tugas ringan & scraper), dan poin #4 (indikator tahap & durasi di banner `/products`) dengan persetujuan pengguna terlebih dahulu.
