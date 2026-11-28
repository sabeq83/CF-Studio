# Analisa & Usulan: Produksi Konten Foto Infografis Resep + Caption pada Recipe Labs & Auto Pipeline

Tanggal: 28 November 2026  
Status: **Usulan / Analisa Awal (Menunggu Review & Persetujuan)**

---

## 1. Hasil Pemeriksaan 7 Foto Referensi

Ketujuh contoh gambar yang dilampirkan (*Es Teler Creamy*, *Kacang Caramel Gula Putih*, *Puding Coklat Susu Oreo & Alpukat*, *Puding Krispi 2 Bahan*, *Stik Royco*, *Pilus Cikur Gurih*, dan *Matcha Almond Crispy*) adalah **Poster Infografis Resep Satu Halaman (Single-Image Culinary Infographic)** berorientasi portrait (~3:4 atau 4:5), berbahasa Indonesia, yang sangat optimal untuk umpan Facebook, Instagram, dan Pinterest.

### Pola Komposisi yang Ditemukan
1. **Header & Hero Visual (Bagian Atas)**:
   - Foto hidangan jadi (*hero dish*) berukuran besar dengan pencahayaan cerah dan menggugah selera.
   - Judul menu bergaya *playful* / *bold rounded* dengan outline putih/kontras, pita (*ribbon*) subjudul singkat (mis. `"Segar, Creamy, Enak Banget!"`), serta *hook badge* opsional.
2. **Kartu Bahan-Bahan (Kanan / Atas-Tengah)**:
   - Daftar takaran bahan yang ringkas dan mudah dibaca sekilas.
   - Terdapat 3 variasi penyajian bahan pada contoh:
     - **Daftar teks poin** (contoh: *Es Teler Creamy*, *Kacang Caramel*, *Stik Royco*, *Pilus Cikur*).
     - **Kartu multi-lapisan / sub-bagian** (contoh: *Puding Coklat Susu Oreo & Alpukat* dibagi 3 kotak lapisan, *Matcha Almond Crispy* dipisah `Bahan` & `Topping` + foto mangkuk kecil).
     - **Kartu bahan visual bergambar** (contoh: *Puding Krispi 2 Bahan* menampilkan gambar kemasan/bahan + takaran).
3. **Bagian "Cara Membuat" (Bagian Bawah)**:
   - **Varian A — Step-Photo Grid (4–7 Langkah)**: Setiap langkah memiliki kotak foto kecil bernomor `1, 2, 3...` disertai 1 kalimat instruksi pendek di bawahnya (*Es Teler Creamy*, *Kacang Caramel*, *Puding Krispi*, *Stik Royco*, *Pilus Cikur*).
   - **Varian B — Numbered Text Steps (4 Langkah)**: Daftar langkah bernomor dalam kotak teks bersih di samping foto hidangan (*Puding Oreo Alpukat*, *Matcha Almond Crispy*).
4. **Penutup (Pojok Bawah)**:
   - Kotak `Tips:` berisi 2–3 poin singkat dan stiker/badge `"Selamat Mencoba!"` (beberapa varian menyertakan ilustrasi koki kecil).

### Catatan Penting dari Sisi Teknis Gambar
Pada contoh yang dilampirkan terlihat ciri khas generasi teks langsung oleh AI (*all-in-one AI image generation*), seperti duplikasi baris `"100-120 ml air"` dua kali pada *Stik Royco* dan typo `"aluminium poil"` pada *Puding Krispi 2 Bahan*. Hal ini menjadi pertimbangan kunci dalam rancangan usulan di bawah agar CF Studio dapat menghasilkan visual semenarik contoh tersebut **tanpa risiko typo atau salah takaran**.

---

## 2. Analisa Kondisi Sistem Saat Ini (Gap Analysis)

Berdasarkan pemeriksaan langsung terhadap kode CF Studio saat ini:

### A. Recipe Labs & Auto Pipeline `recipe_labs` Saat Ini
- **Format Gambar Saat Ini Hanya Kolase Polos Tanpa Teks**:
  - `processRecipeGenerator` (`lib/scheduler-processors.js`) menghasilkan 3–6 prompt foto fotografi studio (`image_1` s.d. `image_6`).
  - `processRecipeGLabs` (`lib/scheduler-processors.js`) me-render tiap foto memakai G-Labs `nano_banana_pro` dengan `aspect_ratio: '1:1'`.
  - `createRecipeGrid` (`lib/recipe-grid-helper.js`) menempelkan 3–6 foto tersebut ke kanvas gelap (`#0d0d12`) menggunakan `sharp` menjadi `05_GRID_POSTER.jpg` (**murni gambar grid tanpa judul, tanpa daftar bahan, tanpa nomor langkah, tanpa teks instruksi, dan tanpa badge tips**).
- **Bahasa Default di Auto Pipeline**:
  - `lib/auto-pipeline-scheduler-runner.js` dan `app/api/v2/recipes/autonomous-pipeline/route.js` masih memakai default `target_language = 'en_US'` saat membuat jadwal/eksekusi `recipe_labs` apabila tidak diubah manual.

### B. Sumber Resep: Belum Terhubung ke Recipe Library
- **Recipe Library** (`/recipe-library`, tabel `curated_recipes`, repository `lib/curated-recipes-repository.js`) sudah menyimpan resep terkurasi lengkap (`original_title`, `polished_title`, `ingredients_raw`, `original_instructions`, `polished_instructions`, `prep_time`, `cook_time`, `servings`, `category`).
- Namun `curated_recipes` **belum terhubung sama sekali** ke `Recipe Labs` (`/recipe-labs` / `app/api/recipe-labs/route.js`) maupun ke `Auto Pipeline` (`recipe_labs`). Saat ini mesin hanya mendukung mode **AI bikin sendiri** berdasarkan `topic` / `category`.

### C. Caption & Social Media Package
- Saat ini `Recipe Labs` hanya menyimpan `recipe_markdown_text` dan memformatnya dengan `formatFacebookRecipeCaption()` (`lib/facebook-helper.js`) untuk draf Facebook langsung.
- Untuk jalur **ContentFlow Hub** (`lib/contentflow-ingest.js`), `caption` pada item `recipe` masih mengambil `item.recipe_markdown_text` mentah (mengandung simbol `#` dan `-` Markdown), dan `social_media_package_json` hanya berisi `{ title, caption }` sederhana tanpa optimasi caption per platform (Facebook, Instagram, Threads) maupun integrasi link affiliate/bio.

### D. Celah Publikasi Auto Pipeline → Repliz untuk Konten Foto (`image`)
Ditemukan 2 celah teknis apabila jadwal `recipe_labs` langsung dipublikasikan otomatis ke Repliz:
1. **`lib/auto-pipeline-scheduler-runner.js` (`dispatchDuePublishes`)**: Saat mengirim job ke `schedulePublishingJobs`, parameter `media_type` masih di-hardcode `'video'` — padahal untuk `recipe_labs` (`source_type === 'recipe'`) asetnya adalah gambar (`05_GRID_POSTER.jpg`), yang seharusnya mengirim `media_type: 'image'`.
2. **`lib/publishing-drive-staging.js` (`stageMediaToR2` & `stageMediaToDrive`)**:
   - Pada `stageMediaToR2`, jika sumber media berupa path lokal (`/uploads/recipes/...`), `contentType` bawaan masih `'video/mp4'` sehingga file gambar lokal terunggah ke R2 dengan ekstensi `.mp4` dan `Content-Type: video/mp4`.
   - Pada `stageMediaToDrive`, path lokal `/uploads/...` belum dikonversi/diunggah langsung sebagai file gambar lokal (berbeda dengan URL HTTP Nextcloud).

---

## 3. Usulan Solusi & Arsitektur Baru

Agar `Recipe Labs` dan `Auto Pipeline` (jenis **Resep Teks & Foto / `recipe_labs`**) mampu memproduksi konten foto infografis persis seperti contoh yang dilampirkan—lengkap dengan caption siap tayang dan pilihan asal resep—diusulkan peningkatan dalam **4 pilar**:

### Pilar 1: Mode "Infographic Poster" dengan 2 Pilihan Mesin Render

Diusulkan penambahan `output_style` baru pada `recipe_labs`:
- `photo_grid` *(lama — tetap dipertahankan untuk kompatibilitas)*
- **`recipe_infographic` *(baru — sesuai 7 foto contoh)***

Untuk menghasilkan `recipe_infographic`, tersedia dua pendekatan teknis yang bisa dipilih (atau dijalankan berpasangan):

| Aspek | Opsi A: **Hybrid (Foto AI + Template Infografis Presisi)** *(Direkomendasikan)* | Opsi B: **Full AI Single-Image (`nano_banana_pro` / `gpt_image_2`)** |
|---|---|---|
| **Cara Kerja** | 1. Gemini menyusun teks resep + caption.<br>2. G-Labs membuat foto bersih (1 Hero + 4–6 foto langkah tanpa teks).<br>3. Engine merender HTML/CSS poster ke PNG/JPG (1080×1350 / 1080×1440) dengan tipografi, ribbon, kartu bahan, nomor langkah, & tips. | Gemini menyusun 1 prompt super-lengkap (judul, daftar bahan, langkah, tips, tata letak) lalu dikirim 1× ke `nano_banana_pro` / `gpt_image_2` dengan rasio `3:4`. |
| **Akurasi Teks & Takaran** | **100% Bebas Typo & Bebas Duplikasi**. Takaran dari Recipe Library terjamin persis. | Berisiko typo / duplikasi baris / angka meleset khas AI image-text (seperti `"aluminium poil"` di contoh). |
| **Estetika & Variasi** | Rapi, konsisten antar hari, warna & watermark brand terkendali, bisa pilih tema warna (hangat/pastel/segar/cokelat). | Sangat organik dan menyatu (panah gambar tangan, stiker menyatu dengan latar). |
| **Konsumsi Kuota G-Labs** | 1 Hero + 4–6 Step Foto = 5–7 request gambar per resep (atau 1–2 request untuk varian *Text-Step* seperti *Matcha Almond Crispy* / *Puding Oreo*). | 1 request gambar per resep (+ retry jika QC mendeteksi typo). |

**Rekomendasi**:
- Jadikan **Opsi A (Hybrid: Foto AI + Template Infografis HTML-to-Image)** sebagai mode utama/default karena aman untuk produksi otomatis (*Auto Pipeline*) dan wajib untuk resep dari *Recipe Library* yang menuntut takaran akurat.
- Sediakan **3 Template Layout Infografis** meniru langsung 7 contoh referensi:
  1. `infographic_step_grid` — Hero atas + Kartu Bahan kanan + Grid 4–6 Foto Step bernomor + Tips + Badge *"Selamat Mencoba!"* (gaya *Es Teler Creamy*, *Kacang Caramel*, *Pilus Cikur*, *Stik Royco*).
  2. `infographic_text_steps` — Hero besar + Kartu Bahan/Topping (atau Multi-Lapisan) + Daftar Langkah Teks Bernomor 1–4 + Tips + Badge (gaya *Matcha Almond Crispy*, *Puding Coklat Susu Oreo & Alpukat*).
  3. `infographic_visual_ingredients` — Hero + Kartu Bahan dengan foto/ikon bahan per item + Grid Foto Step + Tips + Maskot/Badge (gaya *Puding Krispi 2 Bahan*).
- Opsi B (*Full AI 1-Shot*) dapat ditambahkan sebagai opsi eksperimental/alternatif hemat kuota jika pengguna menginginkan gaya ilustrasi bebas, dengan batasan jumlah kata ketat di prompt.

> **Kunci Konsistensi Visual Foto Step**: Pada Opsi A, prompt untuk Hero dan Step 1..N harus membawa *Shared Visual Anchor* (meja kayu hangat / marmer terang, mangkuk kaca bening / wajan stainless, pencahayaan siang lembut dari samping) dan *guardrail* faceless/clean food photography agar seluruh kotak foto dalam satu poster terlihat seperti difoto di dapur yang sama.

---

### Pilar 2: Pilihan Asal Resep (`Recipe Library` vs `AI Bikin Sendiri`)

Pada form **Recipe Labs**, **Auto Pipeline (1-Klik)**, dan **Auto Pipeline Schedules**, ditambahkan kontrol `recipe_source`:

1. **`ai_generated` — AI Bikin Sendiri**:
   - Pengguna mengisi Bahasa (`id_ID` / `en_US` / `bilingual`), Kategori, dan Topik/Menu (atau mode *Auto-Variasi* untuk jadwal berulang harian agar AI memutar ide menu berbeda dalam kategori tersebut dan memeriksa riwayat judul agar tidak duplikat).
2. **`recipe_library` — Ambil dari Recipe Library (`curated_recipes`)**:
   - **Mode Manual / 1-Klik**: Pemilih resep dengan pencarian & filter kategori dari `curated_recipes` (menampilkan judul, kategori, jumlah bahan, dan status sudah pernah dipakai/belum).
   - **Mode Jadwal Otomatis (`auto_library_rotation`)**: Di tab *Schedules*, jadwal otomatis memilih 1 resep dari `curated_recipes` (bisa difilter kategori tertentu) dengan prioritas `used_in_campaign_count` terendah / belum dipakai belakangan ini, lalu menaikkan `used_in_campaign_count` setelah sukses diproduksi.
   - **Aturan Fidelity Recipe Library**: Judul, daftar bahan + takaran (`ingredients_raw`), dan urutan langkah (`polished_instructions` / `original_instructions`) dikunci sebagai sumber kebenaran. AI hanya bertugas menyusun teks pendek ramah-infografis (tanpa mengubah angka takaran), menulis `subtitle_ribbon`, `tips`, prompt foto langkah, dan caption media sosial.

---

### Pilar 3: Generator Caption Sosial Media Terstruktur & Siap Tayang

Setiap produksi resep (baik dari *Recipe Library* maupun *AI Bikin Sendiri*) menghasilkan `social_media_package_json` yang lengkap untuk kebutuhan posting gambar:
1. **Hook Pembuka**: 1–2 kalimat pemikat (*"Bikin camilan renyah cuma modal bahan sederhana? Save dulu resepnya!"*).
2. **Ringkasan Resep Rapi (Non-Markdown)**: Bahan dan langkah dirapikan dengan emoji bersih tanpa tanda `#` atau `**` mentah yang mengganggu di Instagram/Facebook.
3. **Platform-Adaptive Caption**:
   - `caption_facebook`: Lebih detail, ramah dibaca/dishare di grup & halaman FB, mendukung injeksi **Smart Affiliate Link** bila toggle affiliate aktif & brand punya produk terkait (mis. toples, wajan, bahan kue).
   - `caption_bio` (Instagram / Threads): Lebih ringkas, CTA ke simpan (*Save*) & bagikan (*Share*), plus arahan Link di Bio bila relevan.
4. **Hashtag Relevan**: 5–10 hashtag kuliner Indonesia/niche sesuai menu.

---

### Pilar 4: Perbaikan Jalur Publish Konten Foto ke ContentFlow Hub & Repliz

Agar hasil infografis benar-benar bisa tayang otomatis dari Auto Pipeline / ContentFlow Hub ke Facebook Page, Instagram, dan Threads:
1. **ContentFlow Ingest (`lib/contentflow-ingest.js`)**:
   - Pastikan aset poster infografis (mis. `06_INFOGRAPHIC_POSTER.jpg` atau `05_GRID_POSTER.jpg`) terekam rapi sebagai media `image`, dan `caption` menggunakan `social_media_package_json` terformat (bukan Markdown mentah).
2. **Auto Pipeline Publisher (`lib/auto-pipeline-scheduler-runner.js`)**:
   - Ubah penentuan `media_type` pada `dispatchDuePublishes` agar **tidak selalu `'video'`**: jika `cfItem.source_type === 'recipe'` (atau `content_kind === 'recipe'` dari pipeline `recipe_labs`), kirim `media_type: 'image'`.
3. **Media Staging R2 & Google Drive (`lib/publishing-drive-staging.js`)**:
   - Perbaiki `stageMediaToR2` agar mendeteksi MIME type dari ekstensi file lokal (`.jpg`/`.jpeg` → `image/jpeg`, `.png` → `image/png`, `.webp` → `image/webp`) sehingga file gambar tidak terunggah sebagai `video/mp4`.
   - Perbaiki `stageMediaToDrive` agar mendukung unggah file lokal `/uploads/recipes/...` (bukan hanya URL HTTP Nextcloud) dengan ekstensi `.jpg`/`.png` yang sesuai.

---

## 4. Ringkasan Tahapan Implementasi yang Diusulkan (Jika Disetujui)

1. **Tahap 1 — Mockup HTML Interaktif** (`public/mockup_recipe_infographic.html`):
   - Simulasi UI konfigurasi di Auto Pipeline & Recipe Labs (pilihan `recipe_source`: Recipe Library vs AI Bikin Sendiri, pilihan `output_style`: Infographic Poster vs Grid Polos, pilihan 3 template infografis, tema warna, serta pratinjau hasil 3 layout infografis + caption).
2. **Tahap 2 — Mesin Renderer Infografis & Prompt Generator**:
   - Kontrak JSON terstruktur untuk infografis + caption di `lib/scheduler-processors.js` (atau modul terpisah `lib/recipe-infographic-generator.js`).
   - Integrasi `curated_recipes` (`recipe_source: 'library'`) + auto-rotasi jadwal.
   - Kompositor HTML/CSS-to-Image (`lib/recipe-infographic-renderer.js`) untuk 3 layout infografis (4:5 / 1080×1350 atau 3:4 / 1080×1440).
3. **Tahap 3 — Perbaikan Jalur Publish Gambar (Auto Pipeline → ContentFlow → Repliz)**:
   - Update `media_type: 'image'` di `lib/auto-pipeline-scheduler-runner.js` dan deteksi MIME gambar lokal di `lib/publishing-drive-staging.js`.
4. **Tahap 4 — Integrasi UI Recipe Labs & Auto Pipeline + Uji End-to-End di Dev (`5020`)**:
   - Integrasi UI sesuai mockup yang disetujui, uji produksi 1 resep dari *AI Bikin Sendiri* dan 1 resep dari *Recipe Library* hingga masuk ContentFlow Hub dan ter-stage sebagai `image`.

---

## 5. Pertanyaan / Keputusan Sebelum Lanjut ke Mockup & Implementasi

1. **Pendekatan Render Utama**: Apakah setuju memakai **Opsi A (Hybrid: Foto AI bersih + Template Infografis HTML-to-Image)** sebagai default agar 0% typo dan akurat mengikuti Recipe Library, atau ingin disediakan juga toggle **Opsi B (Full AI 1-Shot `nano_banana_pro` / `gpt_image_2`)**?
2. **Platform Target Utama**: Apakah konten foto infografis ini utamanya ditujukan untuk **Facebook Page & Instagram Feed (rasio 4:5 / 3:4)**, dan apakah perlu opsi menyertakan **watermark/nama akun brand** kecil di pojok poster?
3. **Kaitan Produk Affiliate**: Pada contoh *Puding Krispi 2 Bahan* dan *Stik Royco*, terdapat penyebutan merek/kemasan bahan (*Roma*, *Agarasa*, *Royco*). Apakah sistem perlu memiliki opsi opsional **"Sisipkan Produk dari Product Database"** di resep/caption (mis. produk bahan atau alat dapur dari katalog), atau murni konten resep organik?
