# Usulan Hotfix Konsistensi Visual Antara Foto Hero, Proses Langkah, & Foto Hasil Akhir

Tanggal: 28 November 2026  
Branch: `fitur/recipe-labs-infografis`  
Studi Kasus: Poster `Sourdough Coffee Brownie Bliss` (`rcp_def_c3284659e6f1`)

---

## 1. Jawaban & Hasil Audit Penyebab Inkonsistensi

Dari pemeriksaan langsung data `curated_recipes` (`rcp_def_c3284659e6f1`) dan kode [lib/recipe-library-picker.js](../../lib/recipe-library-picker.js), [lib/recipe-infographic-prompt.js](../../lib/recipe-infographic-prompt.js), serta [lib/scheduler-processors.js](../../lib/scheduler-processors.js):

1. **Apakah langkah memasak pada Recipe Library dijadikan acuan?**
   - **Ya**, langkah memasak dari `curated_recipes` (`polished_instructions` / `original_instructions`) benar dijadikan acuan untuk Step 1–6 (autolisis, choco starter, pasta cokelat, stretch & fold choco chips, coil fold, cold retard + scoring + panggang).
   - **Yang terlewat adalah judul asli (`original_title`)**: di database, `original_title` resep ini adalah **`"Coffee Brownie Sourdough Bread"`** (roti sourdough rasa cokelat kopi), namun AI Polisher di Recipe Library mengubah `polished_title` menjadi `"Sourdough Coffee Brownie Bliss: Perpaduan..."` (kata **`Bread`** hilang). Karena `formatCuratedRecipeSourceContext` hanya mengirim `polished_title`, Gemini mengira hidangan utamanya adalah **kue brownies kotak**, lalu menulis `hero_prompt` brownies kotak — sementara pada `steps` ia membaca kata `coil fold`, `banneton`, `cold retard`, `scoring` dan menulis `step 6` berupa **roti sourdough bulat**.
2. **Kenapa warna adonan Step 4–5 terlihat putih polos (tidak cokelat seperti Step 2–3)?**
   - Tiap prompt `steps[].t2i_prompt` ditulis terpisah per langkah tanpa membawa *akumulasi status bahan* dari langkah sebelumnya. Karena kata *"pasta cokelat"* hanya disebut di Step 3, pada Step 4 (`stretch and fold`) dan Step 5 (`coil fold`) model G-Labs menggambar adonan roti putih biasa.
3. **Kenapa foto Hasil Akhir (Step terakhir / Secondary Detail) bisa berbeda bentuk dengan Hero?**
   - Pada `processRecipeGLabs` di `lib/scheduler-processors.js`, seluruh gambar (`image_1`..`image_7`) dikirim paralel secara independen tanpa acuan visual (`reference_images`) dari `Hero` ke gambar hasil akhir.

---

## 2. Usulan Hotfix 4 Lapis (Menjamin Konsistensi Total)

### Lapis 1: Kunci Bentuk Fisik Sejati dari Recipe Library (`original_title` + `polished_summary`)
- Perbarui `formatCuratedRecipeSourceContext` di `lib/recipe-library-picker.js` dan `buildInfographicRecipeSystemPrompt` di `lib/recipe-infographic-prompt.js` untuk menyertakan `original_title` beserta ringkasan (`summary`) ke Gemini.
- Tambahkan kolom **`dish_visual_identity`** di JSON prompt Gemini: sebelum menulis `hero_prompt` maupun `steps[].t2i_prompt`, AI wajib mengunci 1 deskripsi fisik final hidangan berdasarkan `original_title + all instructions` (misalnya: *"round artisan dark-chocolate sourdough boule bread baked golden-brown with wheat scoring and cocoa crumb"*, bukan kue brownies kotak).

### Lapis 2: Penguncian Akumulasi Warna & Bahan Lintas-Langkah (*Sequential State Lock*)
- Pada instruksi `steps[].t2i_prompt`, Gemini wajib meneruskan **keadaan adonan kumulatif** dari step sebelumnya (misal setelah pasta cokelat/matcha/pandan masuk di Step 2–3, maka Step 4, 5, dan 6 wajib mendeskripsikan *"rich dark chocolate-brown dough"* sehingga tidak pernah kembali menjadi adonan putih polos).

### Lapis 3: Foto Hasil Akhir Terkunci ke Hero (`2 Pilihan Mode`)
Pada `processRecipeGLabs` (`lib/scheduler-processors.js`), ubah generasi gambar untuk mode `recipe_infographic` menjadi **2 tahap**:
1. **Tahap 1 — Render Hero (`image_1`) lebih dulu**, unduh ke lokal (`image_1.jpg`).
2. **Tahap 2 — Kunci Hasil Akhir & Proses**:
   - **Untuk foto proses tengah (`Step 1` s.d. `Step N-1`)**: tetap T2I murni agar adonan mentah di mangkuk tidak bocor gambar roti matang dari Hero, tetapi dikunci kuat oleh **Lapis 1 + Lapis 2** (bentuk, warna adonan, dan wadah).
   - **Untuk Foto Hasil Akhir (`Step Terakhir` bila menggambarkan hidangan matang/siap saji, serta `secondary_prompt` pada layout 2-foto)**:
     - **Opsi A (I2I Reference Lock G-Labs — Rekomendasi)**: kirim `generateImage` dengan **`reference_images: [heroBase64]`** beserta prompt yang menegaskan hidangan, kerak, potongan, dan piring/talenan harus sama persis dengan gambar referensi Hero (hanya variasi sudut close-up / di dalam loyang atau talenan).
     - **Opsi B (100% Hero Detail Crop — Paling Ekonomis & Pasti Sama)**: gunakan crop/zoom detail dari `image_1.jpg` (Hero) langsung ke slot foto Step terakhir (jika step terakhir memang menampilkan makanan matang). Hemat 1 kuota G-Labs per poster dan dijamin 100% identik objek & warnanya dengan Hero.

---

## Keputusan yang Dibutuhkan
1. **Strategi Foto Hasil Akhir (Step Terakhir / Detail)**: pilih **Opsi A** (*generate ulang dengan `reference_images` Hero agar variasi angle tetap terlihat hidup & sama*) atau **Opsi B** (*pakai zoom/crop dari foto Hero langsung — hemat kuota & 100% sama persis*), atau gabungan (I2I `reference_images` Hero, dengan fallback Hero crop bila provider gagal/lewat batas)?
2. Setuju menerapkan **Lapis 1 (`original_title` + `dish_visual_identity`)** dan **Lapis 2 (*Sequential State Lock* warna/wujud adonan antar-step)**?
