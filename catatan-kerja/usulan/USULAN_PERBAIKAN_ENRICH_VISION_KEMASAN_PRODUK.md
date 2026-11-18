# Analisa & Usulan Perbaikan: Enrich AI & Scraper Salah Menebak Kemasan Produk (`pe_1795007715441_445`)

Tanggal analisa: 19 November 2026  
Kasus uji (Dev DB `dev.product_extractions`): `pe_1795007715441_445` (*Timur Tengah Grainnola Dark Chocolate*)  
Masalah yang dilaporkan: Foto produk nyata adalah **plastic jar (toples plastik)**, tetapi di database tertulis `jenis kemasan: Kardus Kotak`, sedangkan `product_truth` dan `geometric_truth` hasil Enrich AI mendeskripsikannya sebagai **rectangular standing pouch dengan zip lock**.

---

## Ringkasan Eksekutif (Kenapa Bisa Terjadi?)

Singkatnya: **AI saat scrape awal maupun saat Enrich AI sama-sama "buta" terhadap foto produk.** Keduanya hanya membaca **teks** halaman Tokopedia, lalu menebak-nebak bentuk kemasannya masing-masing:

1. **Scraper awal menebak `"Kardus Kotak"` tanpa melihat foto** → karena di teks Tokopedia hanya tertulis *"Granola / Sereal"*, AI mengira kemasan sereal pada umumnya berbentuk kotak kardus.
2. **Enrich AI (`lib/product-bulk-worker.js`) tidak mengirim foto ke Gemini** → meskipun foto raw/clean/generated sudah tersimpan di server, fungsi `enrichProduct()` hanya memanggil Gemini dalam mode teks saja (`[{ text: prompt }]`), sehingga Gemini tidak pernah melihat bahwa wujud aslinya adalah **plastic jar**.
3. **Gemini di Enrich AI mengabaikan `packaging_type` & mengarang `"standing pouch"`** → saat `gemini-3.5-flash-lite` melihat kata *"Granola 125 gr / 250 gr / 500 gr"* tanpa melihat foto, ia mengarang bentuk kemasan granola paling populer (*standing pouch coklat ber-ziplock*), mengabaikan nilai `"Kardus Kotak"` dari input, sekaligus tidak pernah memperbarui kolom `packaging_type`.

---

## Bukti Nyata dari Database & Kode (`pe_1795007715441_445`)

### 1. Jejak Data & Log Server Dev
- **Record DB (`dev.product_extractions` id `pe_1795007715441_445`):**
  - `product_name`: `Timur Tengah Grainnola Dark Chocolate`
  - `source_url` tersimpan: `.../timur-tengah-grainnola-dark-chocolate-500-gr-...-1732196407335748705` (varian default Tokopedia `Dark Chocolate 250 gr`; URL di halaman ini mencakup ukuran `125 gr`, `250 gr`, `500 gr` dengan banyak rasa)
  - `is_in_packaging`: `1` · `packaging_type`: `Kardus Kotak` · `packaging_status`: *(kosong / null)*
  - Foto sudah ada lengkap dan `photo_status = approved`:
    - `raw_photo_url`: `/uploads/products/raw/raw_pe_1795007715441_445_20261118131557.png`
    - `clean_photo_url`: `/uploads/products/clean/clean_pe_1795007715441_445_20261118131626.jpg`
    - `generated_photo_url`: `/uploads/products/generated/generated_pe_1795007715441_445_20261118131557.jpg` (Nano Banana 2, `studio_polish: completed`)
- **Isi `raw_description` (teks Tokopedia):**
  - Tidak ada satu pun kata *"jar"*, *"toples"*, *"kotak"*, atau *"pouch"* di judul maupun deskripsi produk. Yang ada hanya berat (`125 - 500 gr`), komposisi, dan manfaat.
- **Log Eksekusi (`dev-ui.out.log`):**
  - `20:16:26–20:18:22` WIB: Scraper menyimpan produk (mengisi `packaging_type: "Kardus Kotak"` dan `i2v_action_prompt: "Camera panning around the box... unboxing lid opening"`).
  - `20:18:46–20:18:49` WIB: `[Product Bulk Worker] [Enrichment]` memanggil `gemini-3.5-flash-lite` selama `2638 ms`, lalu menimpa `product_truth`, `geometric_truth`, dan `clean_photo_t2i_prompt` menjadi *"rectangular standing pouch ... resealable zip lock mechanism"*.

### 2. Celah di Kode Saat Ini

1. **Tahap 1 — Ekstraksi Scraper Awal hanya memakai teks ([lib/prompts.js](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js#L3787-L3815)):**
   `buildBatchProductExtractionPrompt` hanya menerima `id` dan `raw_description` (teks halaman). Foto baru dipilih *setelah* tahap ekstraksi JSON teks selesai ([lib/scheduler-processors.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js#L9403)). Jadi `physical_state.packaging_type` dan `i2v_action_prompt` murni hasil tebakan tanpa gambar.
2. **Tahap 2 — Enrich AI tidak pernah mengirim gambar ke Gemini Vision ([lib/product-bulk-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-bulk-worker.js#L67-L165)):**
   - Query antrean (`claimEnrichmentJobs`, baris 67) bahkan tidak mengambil `clean_photo_url` / `cleaned_photo_url` / `generated_photo_url`.
   - Di `enrichProduct` (baris 156), `raw_photo_url` ikut didestrukturisasi (`const { ..., raw_photo_url, tenantId } = job;`) tetapi **sama sekali tidak dipakai** di `buildEnrichmentPrompt` maupun di `generateProductEnrichmentWithGemini`.
   - Pemanggilan AI pada baris 149 murni teks: `model.generateContent([{ text: prompt }])`.
3. **Aturan Prompt Mengandung Kata Pemicu + Tidak Mengoreksi `packaging_type` ([lib/product-bulk-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-bulk-worker.js#L176-L255)):**
   - Baris 254 menulis larangan eksplisit *"Jangan pernah mengubah tipe kemasan atau mengasumsikannya menjadi bentuk lain (**seperti pouch berdiri**)"*, dan `PRODUCT_TRUTH_DEFINITIONS` di [lib/product-truth-language.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-truth-language.js#L28) memberi contoh `rectangular pouch/tube`. Model ringan tanpa gambar mudah terpengaruh (*pink elephant effect*) dan tetap menebak pouch berdasarkan nama *"Granola 125–500 gr"*.
   - Query `UPDATE product_extractions` di `enrichProduct` (baris 176–198) juga tidak menyentuh kolom `packaging_type` maupun `i2v_action_prompt`, sehingga kolom `packaging_type` (`"Kardus Kotak"`) dan `product_truth`/`geometric_truth` (`"standing pouch"`) terus saling bertentangan.

---

## Dampak ke Video Kampanye

Jika dibiarkan, saat video kampanye dibuat:
- Gambar acuan produk menampilkan **plastic jar** (toples plastik),
- T2I/I2V prompt menerima `product_truth` dan `geometric_truth` tentang **standing pouch zip lock** (plus `packaging_type = Kardus Kotak` & `i2v_action_prompt` tentang membuka tutup kardus).
- Hasilnya: AI generator gambar/video bingung dan berisiko mengubah bentuk wadah (morphing dari toples menjadi kantong pouch atau kotak) atau membuat gerakan kamera/tangan yang salah.

---

## Usulan Perbaikan

### 1. Ubah Enrich AI Menjadi **Multimodal (Baca Foto + Teks)** — *Prioritas Utama*
- Di `claimEnrichmentJobs` dan `enrichProduct` ([lib/product-bulk-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-bulk-worker.js#L64-L200)):
  - Ambil jalur foto terbaik yang tersedia dengan urutan prioritas: `cleaned_photo_url || clean_photo_url || raw_photo_url || generated_photo_url`.
  - Baca buffer gambar lokal (helper `readLocalImageToBuffer` sudah ada di file yang sama) dan kirim ke Gemini Vision via `generateWithImage` (atau `inlineData` + `text: prompt` dengan waterfall `role: 'vision'` / `role: 'light'`). Jika produk belum punya file foto lokal sama sekali, baru fallback ke mode teks.
- Tambahkan instruksi tegas **Visual Grounding** pada `buildEnrichmentPrompt`:
  - Bentuk kemasan, jenis tutup, warna dominan, material, dan teks label utama untuk `product_truth`, `geometric_truth`, dan `clean_photo_t2i_prompt` **wajib diambil dari foto produk terlampir**, bukan ditebak dari nama atau kategori produk.
  - Dilarang mengarang fitur kemasan yang tidak tampak di foto (misal *zip lock*, *box lid*, *matte foil*) bila pada gambar terlihat toples plastik bening/tutup ulir.

### 2. Koreksi `packaging_type` Berbasis Vision + Hormati Editan Manual Pengguna
- Tambahkan field opsional `detected_packaging_type` dan `is_in_packaging` ke output JSON Enrich AI (yang diamati langsung dari foto).
- **Aturan prioritas yang aman:**
  - Bila `packaging_type` saat ini berasal dari tebakan scraper awal (`packaging_status` masih kosong/null — belum pernah diedit manual oleh pengguna), izinkan hasil Enrich Vision **mengoreksi `packaging_type`** secara otomatis (mis. mengubah `"Kardus Kotak"` → `"Jar Plastik"`) sekaligus menyelaraskan `is_in_packaging` bila perlu.
  - Bila pengguna **sudah mengisi/mengubah `packaging_type` secara manual** lewat UI ([ProductDatabaseModal.js](file:///Users/sabeqmmursyid/_cfstudio/app/products/ProductDatabaseModal.js#L1055-L1080) — di mana `packaging_status = 'packaged'` dan `packaging_type` diisi user, atau dengan menandai flag sumber manual), pertahankan `packaging_type` pilihan pengguna dan jadikan pengunci keras untuk `geometric_truth`.

### 3. Sekalian Deteksi Bentuk Kemasan Saat Photo Picker di Scraper Awal
- Pada tahap scraper ([lib/scheduler-processors.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js#L9500-L9590) / [lib/product-photo-picker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-photo-picker.js)), **Photo Picker** sudah mengirim gambar kandidat ke Gemini Vision.
- Tambahkan 1 field ringan `packaging_type` (misal `"Jar Plastik"`, `"Botol"`, `"Standing Pouch"`, `"Kardus Kotak"`, `"Kaleng"`, `"Tanpa Kemasan"`) di skema evaluasi kandidat terpilih, lalu pakai nilainya untuk menimpa tebakan teks awal `physical_state.packaging_type` sebelum produk disimpan ke database.
- Dengan begitu, sejak pertama kali produk masuk dari scraper (bahkan sebelum Enrich AI berjalan), `packaging_type` dan `i2v_action_prompt` sudah akurat sesuai foto yang terpilih.

### 4. Rapikan Contoh di Prompt Agar Tidak Memancing Halusinasi
- Hapus penyebutan spesifik *"seperti pouch berdiri"* dari aturan larangan di [lib/product-bulk-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-bulk-worker.js#L254). Ganti dengan instruksi netral berbasis pengamatan gambar:
  *"Amati foto terlampir terlebih dahulu untuk menentukan bentuk wadah fisik yang sebenarnya sebelum menulis `product_truth` dan `geometric_truth`. Jika foto dan teks deskripsi berbeda (misal produk punya banyak varian ukuran/kemasan di e-commerce), ikuti bentuk fisik pada foto."*

### 5. Penanganan Produk Lama di Database (Seperti `pe_1795007715441_445`)
- Setelah perbaikan #1–#4 diterapkan:
  - Pengguna cukup edit `Jenis Kemasan` menjadi `Jar Plastik` di modal edit atau langsung klik tombol **🧠 Enrich AI** ulang pada kartu produk `pe_1795007715441_445`.
  - Karena Enrich Vision membaca foto toples plastik yang sudah tersimpan (`clean_pe_1795007715441_445_20261118131626.jpg`), `packaging_type`, `product_truth`, dan `geometric_truth` akan otomatis selaras menjadi *plastic jar*.

---

## Perkiraan Dampak & Risiko

- **Kompleksitas perubahan kecil–sedang** (terfokus di `lib/product-bulk-worker.js`, `lib/product-photo-picker.js`, `lib/scheduler-processors.js`, tanpa migrasi struktur tabel database bila memanfaatkan kolom `packaging_status` atau `raw_response`).
- **Biaya token Vision tambahan sangat ringan:** setiap kali Enrich AI per produk hanya menambahkan 1 gambar bersih terkompresi (~20–80 KB JPEG) pada panggilan `product_enrichment`.
