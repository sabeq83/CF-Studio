# Usulan Pengembangan: 9 Template Layout Poster Infografis Resep yang Variatif

Tanggal: 28 November 2026  
Branch Terkait: `fitur/recipe-labs-infografis`  
Status: **Usulan / Menunggu Persetujuan Pengguna**

---

## 1. Latar Belakang & Tujuan

Implementasi awal Poster Infografis Resep (`lib/recipe-infographic-renderer.js`) sudah berjalan baik di Dev (`5020`), namun saat ini baru memiliki **3 template layout** (`infographic_step_grid`, `infographic_text_steps`, `infographic_visual_ingredients`), yang semuanya masih memakai struktur atas-bawah yang cukup mirip (*top 2-col hero+bahan, bottom steps*).

Jika dipakai untuk produksi rutin harian di **Auto Pipeline** maupun batch di **Recipe Labs**, feed Facebook/Instagram berisiko terlihat seragam. Oleh karena itu diusulkan **9 template dengan komposisi spasial yang benar-benar berbeda**, dilengkapi **mode Auto-Rotasi Template** agar setiap postingan tampil variatif secara otomatis.

---

## 2. Daftar 9 Template Layout yang Diusulkan

Untuk menjaga kompatibilitas mundur (*backward compatibility*), 3 ID lama tetap dikenali sebagai alias ke 3 template pertama.

| No | Kode Template | Nama Tampilan | Komposisi Spasial Utama | Kebutuhan Foto G-Labs | Paling Cocok Untuk |
|---|---|---|---|---|---|
| 1 | `step_grid_classic` *(alias: `infographic_step_grid`)* | **Classic Step-Photo Grid** | Kiri atas: Judul + Hero dish. Kanan atas: Kartu Bahan. Bawah penuh: Grid 2×2 atau 3×2 foto langkah bernomor + Tips & badge bawah. | **5–7 foto** (1 Hero + 4–6 Step) | Minuman segar, camilan goreng, takjil (*Es Teler*, *Pilus Cikur*) |
| 2 | `hero_right_editorial` | **Editorial Kanan (Hero Vertikal)** | Kolom kiri (46%): Judul + pita + kartu bahan memanjang. Kolom kanan (54%): Foto Hero tinggi vertikal + foto detail kecil. Bawah: Strip 4 langkah horizontal. | **2 foto** (1 Hero + 1 Detail) *(Hemat Kuota)* | Kue kering, roti, dessert toples (*Matcha Almond Crispy*) |
| 3 | `layered_band_cards` *(alias: `infographic_text_steps`)* | **Multi-Layer / Kartu Bahan Kolom** | Atas: Banner Judul + Hero utuh. Tengah: 2–3 kolom kartu bahan terpisah (mis. Lapisan/Topping). Bawah: Kiri langkah teks 1–4, kanan foto potongan dalam. | **2 foto** (1 Hero + 1 Potongan/Slice) *(Hemat Kuota)* | Puding lapis, kue lapis, resep dengan komponen topping (*Puding Oreo Alpukat*) |
| 4 | `centerpiece_spotlight` | **Centerpiece Spotlight (Hero Tengah)** | Atas tengah: Judul & hook simetris. Tengah: Foto Hero membulat/spotlight diapit kartu Info Waktu/Porsi (kiri) & Bahan Ringkas (kanan). Bawah: Langkah 2 kolom + Tips. | **1–2 foto** (1 Hero utama) *(Paling Hemat)* | Hidangan utama sepiring penuh (Nasi goreng, ayam bakar, mie) |
| 5 | `magazine_vertical_split` | **Majalah 2-Kolom Penuh** | Kolom kiri penuh atas-bawah (42%): 1 Hero besar + 3 foto proses tersusun vertikal. Kolom kanan penuh (58%): Judul, Bahan, Langkah 1–4, Tips, & Watermark. | **4 foto** (1 Hero + 3 Proses) | Konten portrait feed (`4:5` / `3:4`) & Pinterest editorial |
| 6 | `visual_ingredient_shelf` *(alias: `infographic_visual_ingredients`)* | **Rak Bahan Visual + Grid Step** | Header lebar penuh di puncak. Tengah: Kiri kartu bahan berikon kategori/takar menonjol + produk opsional; Kanan foto Hero. Bawah: Grid foto langkah 1–4/6. | **5–7 foto** (1 Hero + 4–6 Step) | Resep "2–4 Bahan Praktis" (*Puding Krispi 2 Bahan*, camilan simpel) |
| 7 | `step_timeline_zigzag` | **Timeline Alur Memasak** | Header ringkas (Judul kiri, Hero kecil kanan). Tengah: Alur garis waktu (*timeline*) 4 langkah (tiap baris foto step + panah/konektor + instruksi). Bawah: Kartu Bahan + Tips. | **5 foto** (1 Hero + 4 Step) | Resep yang urutan & suhu/teksturnya krusial (karamel, tumisan) |
| 8 | `polaroid_scrapbook` | **Scrapbook Kartu Foto Dapur** | Gaya kartu resep rumahan: Hero & 3 foto proses berbingkai putih (*polaroid*) dengan sudut miring ringan natural + stiker angka. Kartu bahan & langkah bergaya kertas catatan di kanan/bawah. | **4 foto** (1 Hero + 3 Step) | Jajanan pasar, kue rumahan, resep nostalgia keluarga |
| 9 | `compact_2col_cheat_sheet` | **Cheat Sheet 1-Menit Baca** | Puncak: Banner Hero lebar penuh dengan judul kontras di atas scrim bawah. Badan utama: 2 panel sejajar 50:50 — Kiri `Bahan & Takaran + Produk`, Kanan `Langkah 1–6 + Tips`. | **1 foto** (1 Hero lebar) *(Paling Hemat)* | Resep harian padat teks untuk tombol *Save* tinggi di FB/IG |

---

## 3. Fitur Pendukung Variasi & Pengaman Produksi

1. **Opsi Auto-Rotasi Template (`auto_rotate`)**:
   - Selain memilih 1 dari 9 template secara manual, tersedia pilihan **Auto-Rotasi Variatif (`auto_rotate`)**:
     - Pada **Auto Pipeline Schedules**: Sistem memilih template berbeda di setiap eksekusi jadwal (menghindari pengulangan template dari `last_used_template` pada jadwal tersebut, atau rotasi deterministik harian).
     - Pada **Recipe Labs Batch** (`target_recipe_count > 1`): Resep ke-1..N otomatis menggunakan template berbeda secara berurutan (`templates[idx % 9]`).
2. **Efisiensi Kuota G-Labs Otomatis per Template**:
   - `lib/recipe-infographic-prompt.js` dan `processRecipeGLabs` otomatis menyesuaikan jumlah prompt gambar (`t2i_prompts_json`) berdasarkan kebutuhan template terpilih (1 foto untuk `compact_2col_cheat_sheet`, 2 foto untuk `hero_right_editorial`/`layered_band_cards`, 4 foto untuk `magazine_vertical_split`/`polaroid_scrapbook`, 5–7 foto untuk `step_grid_classic`/`visual_ingredient_shelf`/`step_timeline_zigzag`).
   - Jika pengguna mengaktifkan `auto_rotate`, sistem memetakan `infographic_template` terpilih terlebih dahulu pada `processRecipeGenerator` dan menyimpannya ke `seo_data_json.resolved_template`, lalu `processRecipeGLabs` & `processRecipeExporter` membaca `resolved_template` tersebut agar jumlah foto yang di-render dan template HTML selalu sinkron 100%.
3. **Pratinjau Wireframe Mini di UI**:
   - Pada komponen [RecipeInfographicControls.js](file:///Users/sabeqmmursyid/_cfstudio/app/components/campaign-forms/RecipeInfographicControls.js), pemilih 9 template dilengkapi **sketsa wireframe SVG kecil** pada setiap kartu tombol (menunjukkan posisi Hero, Bahan, dan Langkah) agar pengguna dapat membedakan 9 layout secara visual dalam sekali lihat.
4. **Dukungan Penuh Rasio & Tema Warna**:
   - Seluruh 9 template otomatis beradaptasi dengan rasio **`4:5` (`1080×1350`)**, **`3:4` (`1080×1440`)**, dan **`1:1` (`1080×1080`)**, 4 tema warna (`warm_cream`, `fresh_pandan`, `bakery_choco`, `pastel_playful`), **Watermark Nama Brand**, dan **Produk Opsional**.

---

## 4. Tahapan Implementasi yang Diusulkan (Sesuai SOP)

1. **Tahap 1 — Pembaruan Mockup HTML Interaktif** (`public/mockup_recipe_infographic.html`):
   - Menambahkan pemilih **9 Template + opsi `Auto-Rotasi`** beserta wireframe mini dan live preview untuk seluruh **9 layout berbeda** di server mockup port `4199` untuk Anda tinjau & setujui sebelum menyentuh codebase utama.
2. **Tahap 2 — Renderer 9 Template & Auto-Rotasi**:
   - Refaktor `lib/recipe-infographic-renderer.js` menjadi arsitektur modular per-layout (`INFOGRAPHIC_TEMPLATES` registry + 9 builder komposisi bersih) serta dukungan `resolveInfographicTemplate()` untuk `auto_rotate`.
   - Sinkronisasi jumlah prompt G-Labs (`1`, `2`, `4`, atau `5–7` gambar) di `lib/recipe-infographic-prompt.js` & `lib/scheduler-processors.js`.
3. **Tahap 3 — Pembaruan UI & Unit Test**:
   - Memperbarui [RecipeInfographicControls.js](file:///Users/sabeqmmursyid/_cfstudio/app/components/campaign-forms/RecipeInfographicControls.js) dengan grid 9 template ber-wireframe mini + opsi `auto_rotate`.
   - Menambah test otomatis di `tests/recipe-infographic.test.js` yang memverifikasi seluruh 9 template me-render HTML valid dan menghasilkan JPEG `1080×1350` tanpa error, lalu deploy uji ke Dev (`5020`).

---

## 5. Konfirmasi Sebelum Lanjut ke Mockup HTML
1. Apakah daftar **9 layout berbeda** di atas sudah sesuai selera variasi yang Anda inginkan (atau ada layout tertentu yang ingin diganti/diubah posisinya)?
2. Untuk **Auto-Rotasi (`auto_rotate`)**: apakah Anda ingin menjadikannya **default** di Auto Pipeline Schedules agar jadwal harian otomatis berganti-ganti layout dari 9 template tersebut?
