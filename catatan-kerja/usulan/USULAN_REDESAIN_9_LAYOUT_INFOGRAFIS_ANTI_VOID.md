# Usulan Redesain 9 Layout Infografis Resep (Editorial Bento + Anti-Ruang Kosong)

Tanggal: 28 November 2026  
Branch: `fitur/recipe-labs-infografis`  
Referensi Gambar Evaluasi: `Sourdough Coffee Brownie` (`3:4`, `step_grid_classic`)  
Referensi Riset Desain: Pinterest Editorial Recipe Poster & Modular Bento Grid (vertical hierarchy, 8–12% balanced negative space, dual-typography display pairing, tonal bento tiles, full-bleed / proportional photo framing).

---

## 1. Audit Visual Hasil Saat Ini (`step_grid_classic`)

Dari hasil render nyata `Sourdough Coffee Brownie` (`1080x1440`):
- **Yang sudah bagus**: Foto makro Nordic sudah cerah & bebas inkonsistensi tangan, Hero & Step 6 cocok 100%, judul ringkas 1 baris, dan watermark brand `nutribake` utuh.
- **Tiga sumber "ruang kosong" yang membuat desain masih terasa hambar/kosong**:
  1. **Bagian bawah kartu `Bahan-bahan` kosong ~45%**: Grid baris atas memakai `align-items: stretch`, sehingga kartu bahan dengan 7 poin dipaksa ikut setinggi kolom Hero + Header, menyisakan ruang putih polos raksasa di bawah poin ke-7.
  2. **Jurang kosong krem ~220px antara grid `Cara Membuat` dan blok `Tips`**: Baris foto Step 1–6 punya tinggi tetap (`154px`), sedangkan `footer` terdorong ke bawah dengan `margin-top: auto`. Sisa ruang kanvas vertikal menumpuk menjadi ruang kosong di tengah-bawah.
  3. **Kurang elemen visual pengikat**: Latar belakang polos tanpa tekstur lembut, pill header tanpa ikon SVG kuliner, dan foto Hero terlihat kurang dominan dibanding referensi poster majalah kuliner / Pinterest editorial.

---

## 2. Prinsip Desain Baru untuk Seluruh 9 Template

Mengacu pada prinsip *Pinterest Editorial Food Poster* + *Modular Bento Grid*:
1. **Zero Dead-Void Proportion (Proporsi Kanvas 88–92% Terisi Seimbang)**:
   - Setiap blok langkah / grid utama (`Cara Membuat` / *Timeline* / *Columns*) wajib memakai `flex: 1; min-height: 0;` dengan `grid-auto-rows: 1fr` sehingga **ukuran kartu & foto langkah otomatis membesar mengisi ruang vertikal** tanpa menyisakan celah kosong di atas `Tips`.
   - Saat daftar `Bahan-bahan` sedikit (`<= 8` item), sisa kolom kartu bahan otomatis diisi **Bento Meta Strip** (`⏱ Persiapan`, `🔥 Masak`, `🍽 Porsi`, atau `Cat. Sajian`) + garis pembatas halus, dan saat item `> 9` otomatis dibagi 2 kolom padat.
2. **Hero Lebih Dominan & Header Terstruktur**:
   - Memperlebar proporsi Hero atau menjadikan Header (Judul + Ribbon + Meta Strip) terpisah rapi di atas Bento 2 kolom (`Hero Besar` + `Kartu Bahan Sejajar`), sehingga foto Hero jauh lebih mencolok seperti poster kuliner profesional.
3. **Ikon Kuliner SVG + Tekstur Latar Subtle**:
   - Menambahkan tekstur titik/kertas halus (`radial-gradient`) beropasitas rendah di latar poster agar tidak terasa polos datar, serta ikon SVG garis bersih pada badge `Bahan-bahan`, `Cara Membuat`, dan `Tips`.
4. **Keseimbangan Footer + Watermark**:
   - Footer (`Tips` + `Yuk Recook!` + `@brand`) menyatu rapat dengan tepi bawah kartu langkah terakhir (hanya berjarak `12–14px` gutter standar, tidak terlempar jauh ke bawah).

---

## 3. Rencana Redesain Detail per Template (1 s.d. 9)

| Kode | Nama Template | Masalah Lama | Perbaikan Desain Baru (Editorial Bento + Anti-Void) |
|---|---|---|---|
| **T1** | `step_grid_classic` | Void bawah kartu `Bahan` + void ~220px di atas `Tips` | **Top Editorial Banner** (Judul + Ribbon + Meta Strip penuh di atas) -> **Bento Tengah** (Hero Jumbo ~56% kiri + Kartu Bahan ber-chip Meta penuh di kanan sejajar) -> **Grid Langkah `flex: 1; grid-auto-rows: 1fr`** (foto Step 1–6 membesar otomatis ke ~190–210px mengisi tinggi hingga tepat di atas Footer). |
| **T2** | `hero_right_editorial` | Kiri terkadang lebih pendek dari 2 foto kanan; ruang langkah bawah kurang mengisi | **Kiri**: Header Serif/Display tegas + Kartu Bahan + **3 Tile Bento Meta (`Prep`, `Cook`, `Yield`)** mengisi tinggi persis sama dengan 2 foto jumbo di kanan (`64%` Hero + `36%` Detail). **Bawah**: 4 Kartu Langkah `flex: 1` ber-bar penuh ke Footer. |
| **T3** | `layered_band_cards` | Celah antar pita komponen bahan & kolom foto detail kanan kurang tinggi | Hero melebar dengan overlay Meta & Hook di sudut foto; 2–3 pita komponen bahan memakai latar tonal hangat berbeda (`surface tint`) sejajar penuh; **kolom Langkah + Foto Potongan Detail (`flex: 1`)** meregang vertikal utuh sampai Footer. |
| **T4** | `centerpiece_spotlight` | Sudut sekitar foto bulat tengah terasa kosong; 4 langkah bawah terlalu pendek | Header terpusat bergaya sampul majalah; foto bulat/arch centerpiece diperbesar (`430px`) diapit penuh oleh **Kartu Info/Meta Kiri** & **Kartu Bahan Kanan** bersudut lembut; **2x2 / 2x3 Kartu Langkah (`flex: 1`)** memenuhi sisa tinggi poster. |
| **T5** | `magazine_vertical_split` | Rasio 1 kolom foto vs kolom kanan bisa tidak seimbang bila bahan sedikit | Kolom kiri (`45%`) menampilkan **1 Foto Hero Vertikal Besar (50%) + 3 Foto Proses (50%)** penuh; kolom kanan (`55%`) membagi ruang menjadi Header Editorial + Kartu Bahan + Kartu Langkah (`flex: 1`) + Tips menyatu rapat sejajar dasar foto kiri. |
| **T6** | `visual_ingredient_shelf` | Kartu rak bahan memanjang satu kolom vs foto hero; grid step bawah kurang tinggi | Header atas berbingkai + **Bento 2-Kolom** (`Rak Bahan 2-kolom tile` + `Hero Panorama` sama tinggi); **Grid Step 2x3/2x2 (`flex: 1; grid-auto-rows: 1fr`)** meregang mengisi vertikal sampai pas di atas Footer. |
| **T7** | `step_timeline_zigzag` | Kartu timeline tinggi tetap, meninggalkan ruang kosong di strip bahan bawah | **4 Baris Timeline (`grid-template-rows: repeat(4, 1fr)`, `flex: 1`)** dengan garis vertikal konektor penghubung nomor langkah 1 -> 2 -> 3 -> 4 + thumbnail foto proporsional lebih besar, dipasangkan **Strip Bahan 2-kolom padat** tepat di atas Footer. |
| **T8** | `polaroid_scrapbook` | Kolom Polaroid kiri sering lebih tinggi/pendek dari catatan kanan | Latar meja/kertas scrapbook bertekstur halus + **Polaroid Hero Jumbo + 3 Polaroid proses** mengisi 100% kolom kiri; kolom kanan menata Kertas Bahan + Kertas Langkah (`flex: 1`) agar sejajar penuh tanpa jurang kosong. |
| **T9** | `compact_2col_cheat_sheet` | Daftar bahan & 6 langkah teks menyisakan ruang kosong bawah di rasio `3:4` | **Hero Banner Jumbo Atas (`34%` tinggi)** menampilkan Judul Editorial Besar + Foto Sajian lebar penuh; bawahnya **2 Kolom Majalah (`flex: 1`)**: Kiri berisi Bahan + Bento Meta Strip (`Prep/Cook/Servings/Tag`), Kanan berisi 6 Langkah bernomor besar + Tip Ringkas yang memenuhi kanvas proporsional. |

---

## 4. Langkah Implementasi yang Diusulkan

1. **(Opsional / Disarankan) Buat 1 Mockup HTML Galeri Redesain 9 Layout (`public/mockup_9_template_redesigned.html`)** memakai contoh nyata resep (`Sourdough Coffee Brownie` + foto nyata) atau langsung preview interaktif rasio `3:4`, `4:5`, `1:1` di `http://127.0.0.1:4199/` untuk disetujui secara visual.
2. **Perbarui [lib/recipe-infographic-renderer.js](../../lib/recipe-infographic-renderer.js)** untuk menerapkan seluruh tata letak Anti-Void & Editorial Bento pada 9 template di atas (termasuk ikon SVG bersih, tekstur kertas halus, `grid-auto-rows: 1fr`, bento meta strip pengisi ruang bahan, & `renderFooterBlock` yang proporsional).
3. **Verifikasi**: render uji Playwright seluruh 9 template ke JPEG (`3:4`, `4:5`, `1:1`), cek zero overflow & zero dead-void, build lokal, lalu deploy ke Dev (`5020`).

---

## Keputusan Pengguna
Apakah Anda ingin:
- **Pilihan 1**: Langsung saya buatkan **Mockup HTML interaktif (`http://127.0.0.1:4199/`)** berisi pratinjau visual **seluruh 9 template hasil redesain baru** supaya bisa Anda lihat langsung sebelum saya ubah kode renderer utama?
- **Pilihan 2**: Langsung eksekusi redesain 9 template ke [lib/recipe-infographic-renderer.js](../../lib/recipe-infographic-renderer.js) dan deploy ke Dev (`5020`) untuk diuji langsung?
