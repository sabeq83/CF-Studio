# Usulan Perbaikan Kualitas Fotografi AI Poster Infografis Resep

Tanggal: 28 November 2026  
Branch: `fitur/recipe-labs-infografis`  
Referensi Gambar Temuan: Poster `brownies fudgy dari ubi` (`nutribake`)

---

## Ringkasan Analisa Masalah dari Hasil Render Nyata

Dari hasil render poster `brownies fudgy dari ubi` di server Dev, teks resep, susunan grid, dan ketepatan bahan sudah rapi, tetapi sisi **fotografi AI** menunjukkan 3 hal yang perlu diperbaiki:

1. **Inkonsistensi lengan, baju, dan aksesori antar-foto** (`hero` dan `Step 1-6`):
   - **Hero**: pergelangan tangan dengan gelang tali kepang.
   - **Step 1**: dua lengan bawah polos.
   - **Step 2 & 4**: lengan sweter rajut warna krem.
   - **Step 3**: kemeja linen terang + celemek.
   - *Akar masalah di kode*: [lib/recipe-infographic-prompt.js](../../lib/recipe-infographic-prompt.js) masih memakai `SHARED_PHOTO_GUARDRAIL` dengan kalimat `"at most hands/forearms from elbow down"`, sehingga G-Labs bebas menggambar lengan & pakaian yang berbeda-beda di setiap panggilan gambar.
2. **Pencahayaan terlalu gelap / bayangan berat untuk makanan berwarna gelap** (seperti brownies/cokelat):
   - Default environment masih `'Rustic Warm Tabletop & Artisanal Kitchen'` (cahaya jendela samping di atas meja kayu tua gelap).
   - Selain itu, di [lib/scheduler-processors.js](../../lib/scheduler-processors.js#L10176) kata kunci `'macrophotography'` tercatat sebagai alias dari `'dark_moody'` (`Deep rich shadows`), sehingga instruksi makro justru menarik pencahayaan ke arah gelap.
3. **Framing terlalu lebar**:
   - Karena kamera ditarik cukup jauh untuk memperlihatkan meja dan lengan, objek makanan/tekstur bahan di kotak kecil `Step 1-6` terlihat kurang fokus dan porsi tepi lengan ikut masuk frame.

---

## Usulan Solusi (Menunggu Persetujuan Pengguna)

### 1. Kebijakan Tangan & Pakaian (`objects_only` vs `wrist_only`)
- **Rekomendasi Utama — Mode `Tanpa Tangan / Objek Saja` (Default)**:
  - Seluruh foto Hero dan Step (`1-6`) difokuskan **100% ke objek makanan & alat dapur saja** (*still-life food photography*): mangkuk bahan, whisk berdiri/mengaduk di mangkuk, adonan di panci tim, ayakan di atas loyang, brownies sudah terpotong rapi di talenan tanpa tangan.
  - Guardrail prompt secara eksplisit melarang tangan/lengan/pakaian (`Object-only still-life food photography: show only cookware, utensils, ingredients, and dish; omit hands, arms, wrists, sleeves, and human figures`).
  - **Keunggulan**: 0% risiko inkonsistensi warna baju/lengan atau anomali jari antar-langkah, sekaligus membuat foto step jauh lebih fokus ke bahan dan tekstur masakan.
- **Opsi Sekunder (Jika tetap ingin menampilkan aksi tangan pada kasus tertentu)**:
  - Sediakan pilihan UI **Subjek Tangan (Opsional)**:
    - `Obyek Saja Tanpa Tangan (Rekomendasi Default)`
    - `Tangan Minimal (Pergelangan ke Jari Saja, Tanpa Lengan Baju)`
  - Jika mode tangan minimal dipilih, kamera dipaksa *tight close-up* dengan aturan: maksimal pergelangan hingga jari tangan telanjang konsisten (*warm tan Indonesian skin, clean bare wrist from wrist-down only, tight crop on dish rim so zero sleeves, shirts, watches, or bracelets appear*).

### 2. Pencahayaan Macro Photography Jelas & Cerah
- Memperbarui instruksi prompt di [lib/recipe-infographic-prompt.js](../../lib/recipe-infographic-prompt.js) agar setiap `hero_prompt`, `secondary_prompt`, dan `steps[].t2i_prompt` menyertakan gaya **Macro Commercial Studio Lighting**:
  - Zoom lebih dekat (*tight close-up macro food photography framing focusing tightly on bowl/plate and texture*).
  - Cahaya studio terang merata dengan shadow terangkat (*high-key bright diffused dual-softbox studio illumination, crisp clarity, lifted soft shadows so dark chocolate/brown ingredients remain clearly textured, sharp focus on crumbs/glaze/droplets*).
- Memindahkan alias `'macrophotography'` di `PHOTOGRAPHY_ENVIRONMENT_BLUEPRINTS` ([lib/scheduler-processors.js](../../lib/scheduler-processors.js)) dari `'dark_moody'` ke `'modern_nordic'` agar tidak lagi memicu nuansa gelap secara tidak sengaja.

### 3. Default Gaya Environment: `Modern Minimalist Nordic Studio`
- Mengganti nilai default `visual_style` dari `'Rustic Warm Tabletop & Artisanal Kitchen'` menjadi **`'Modern Minimalist Nordic Studio'`** pada seluruh titik masuk Recipe Labs & Auto Pipeline:
  - `app/auto-pipeline/page.js` (Tab 1 state awal, reset/edit Modal Jadwal)
  - `app/components/campaign-forms/RecipeLabsConfigurationForm.js`
  - `lib/autonomous-engine.js` (`executeAutonomousRecipeLabsPipeline`)
  - `lib/auto-pipeline-scheduler-runner.js`
- Permukaan meja batu marmer/keramik terang khas Nordic Studio akan otomatis membantu makanan berwarna pekat (cokelat, rendang, kue) tampil kontras dan bersih.

### 4. Penyempurnaan Kecil Renderer Poster (Sekalian Dirapikan)
Dari poster `brownies fudgy dari ubi` terlihat 2 detail visual minor:
- **Title Casing**: judul huruf kecil dari database di-format otomatis ke Title Case yang rapi (`Brownies Fudgy dari Ubi`).
- **Margin Watermark Bawah**: badge watermark brand (`@nutribake`) diberi jarak aman dari tepi bawah agar tidak terasa mepet/terpotong frame bawah.

---

## Keputusan yang Dibutuhkan Sebelum Eksekusi

1. **Mode Tangan untuk Foto Resep**:
   - **Opsi A (Direkomendasikan)**: Jadikan **Obyek Saja (Tanpa Tangan)** sebagai default, dengan dropdown opsional *Tangan Minimal (Pergelangan ke Jari)* bila dibutuhkan.
   - **Opsi B**: Tetap tampilkan tangan di sebagian langkah, tetapi dipaksa crop pergelangan tanpa lengan baju & perhiasan.
2. **Pencahayaan & Zoom**:
   - Setuju menerapkan *tight macro framing + bright lifted-shadow studio lighting* dan menjadikan **Modern Minimalist Nordic Studio** sebagai default.
3. **Perapian Minor Poster** (Title Case judul + jarak aman watermark bawah):
   - Setuju sekalian diterapkan bersama perubahan fotografi di atas.
