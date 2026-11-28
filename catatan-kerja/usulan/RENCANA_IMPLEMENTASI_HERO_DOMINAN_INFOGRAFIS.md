# Rencana Implementasi: Revisi 9 Template Poster Infografis (Hero Foto Dominan)

Tanggal: 28 November 2026  
Branch target: `fitur/recipe-labs-infografis`  
Referensi Mockup Interaktif:
- **Mockup 40% (Seimbang-Dominan):** `public/mockup_9_template_hero_40.html`
- **Mockup 55% (Ultra-Dominan):** `public/mockup_9_template_hero_55.html`
- **Pembanding Versi Lama:** `public/mockup_9_template_infografis.html`

---

## 1. Latar Belakang & Masalah Saat Ini

Pada implementasi aktif di `lib/recipe-infographic-renderer.js`, ukuran foto **Hero** pada mayoritas dari 9 template masih relatif kecil (**~6%–15% dari total luas kanvas** pada `4:5` `1080×1350`, tinggi hanya `220–375px`):
- Pada `layered_band_cards` (`255px`) dan `step_timeline_zigzag` (`220px`), foto Hero hampir seukuran kartu thumbnail langkah.
- Pada `centerpiece_spotlight`, Hero terjepit di tengah 3 kolom sempit (`0.82fr 1.08fr 1.1fr`) sehingga lingkaran hanya berdiameter ~`350px`.
- Pada `magazine_vertical_split` (`0.86fr 1.14fr`) dan `visual_ingredient_shelf` (`1.1fr 0.9fr`), kolom Hero justru lebih sempit daripada kolom teks/bahan.

Tujuan revisi ini adalah menjadikan **foto Hero sebagai focal point dominan** langsung saat poster dilihat di feed.

---

## 2. Pilihan Target Proporsi (Perlu Ditetapkan Sebelum Eksekusi)

| Aspek | Opsi A: **40% (Seimbang-Dominan)** *(Disarankan)* | Opsi B: **55% (Ultra-Dominan)** |
|---|---|---|
| **Luas Hero aktual** | **~38%–42%** kanvas (Polaroid ~34% foto / ~40% bingkai) | **~50%–56%** kanvas (Polaroid ~47% foto / ~54% bingkai) |
| **Kepadatan teks & bahan** | Nyaman dibaca; 6–7 poin bahan + 4–6 langkah muat lega | Padat; beberapa template menyingkat langkah & tinggi baris |
| **Kuota foto AI (`stepPhotoCount`)** | **Tidak berubah** (`getTemplateImageSpec` tetap `0 / 3 / 4 / 6` foto step) | Perlu keputusan untuk T1 & T6: padatkan ke 4 foto (`2×2`) atau pertahankan 6 micro-card (`3×2`) |
| **Dampak ke test kontrak** | `tests/recipe-infographic.test.js` tetap lulus tanpa mengubah kuota | Jika T1/T6 diubah ke 4 foto, `getTemplateImageSpec` & test baris 90–92 ikut diubah |

*(Alternatif teknis: jika dibutuhkan, `config` dapat mendukung `heroDominance: '40' | '55'` sebagai preset, namun menetapkan satu standar baku lebih disarankan agar pemeliharaan template tetap sederhana.)*

---

## 3. Rancangan Perubahan per File

### Tahap 1: `lib/recipe-infographic-renderer.js`
Perbarui fungsi `buildInfographicPosterHtml` untuk seluruh 9 template pada 4 rasio kanvas (`4:5` `1080×1350`, `3:4` `1080×1440`, `1:1` `1080×1080`, `9:16` `1080×1920`). Tambahkan atribut `data-hero="primary"` pada kontainer Hero setiap template agar bisa diuji otomatis.

#### Spesifikasi Tata Letak 9 Template (Opsi A — 40% vs Opsi B — 55%)

1. **`step_grid_classic` (T1)**
   - *40%:* Header judul + ribbon ringkas di atas; **Hero full-width (`flex: 0 0 43%`)**; area bawah 2 kolom (`0.74fr` Bahan + Meta Strip vs `1.26fr` Grid 6 foto step `3×2` untuk `3:4`/`4:5` atau 4 step `2×2` untuk `1:1`).
   - *55%:* **Hero full-width (`flex: 0 0 56–58%`)** dengan judul & ribbon di scrim kontras bawah; area bawah `0.84fr` Bahan vs `1.16fr` Grid step mini.

2. **`hero_right_editorial` (T2)**
   - *40%:* Grid atas `0.74fr : 1.26fr` (kolom kanan 63% lebar diisi penuh oleh Hero, foto Secondary menjadi **inset thumbnail 34% lebar** di pojok kanan bawah Hero); bawah 4 kartu langkah `4×1`.
   - *55%:* Grid atas `0.62fr : 1.38fr` (kolom Hero 69% lebar penuh tinggi, inset detail 30% lebar); baris 4 langkah bawah dibuat sangat ringkas (`padding` & line-clamp 2).

3. **`layered_band_cards` (T3)**
   - *40%:* **Hero full-width (`flex: 0 0 42–43%`)** dengan scrim judul + ribbon di bawah dan inset *Potongan Dalam* di pojok kanan atas; tengah 2–3 pita bahan sejajar; bawah 4 langkah `2×2`.
   - *55%:* **Hero full-width (`flex: 0 0 55–58%`)** + inset potongan; pita bahan maksimal 3 item/kolom; 4 langkah `2×2` ringkas.

4. **`centerpiece_spotlight` (T4)**
   - *40%:* Judul & ribbon terpusat di atas; **Hero Spotlight lebar (`flex: 0 0 42–43%`, sudut rounded besar `border-radius: 28px`)** agar luas foto tidak terbuang di sudut lingkaran; bawah `0.86fr` Bahan vs `1.14fr` 4 langkah.
   - *55%:* **Hero Spotlight besar (`flex: 0 0 56–58%`)** memuat judul di bagian atas & meta pill di bawah bingkai; bawah 2 kolom Bahan vs 4 Langkah.

5. **`magazine_vertical_split` (T5)**
   - *40%:* Balik kolom menjadi **`1.18fr : 0.82fr`** (kolom foto kiri 59% lebar); Hero `flex: 2.6` di atas **strip 3 thumbnail proses 1 baris** (`flex: 0.68`).
   - *55%:* Kolom **`1.38fr : 0.62fr`** (kolom foto 69% lebar); Hero `flex: 3.8` di atas strip 3 micro-thumbnail (`flex: 0.58`).

6. **`visual_ingredient_shelf` (T6)**
   - *40%:* Header judul ringkas; **Hero full-width (`flex: 0 0 42–43%`)**; bawah `0.74fr` Rak Bahan vertikal/2-kolom vs `1.26fr` Grid 6 foto step (`3×2`).
   - *55%:* **Hero full-width (`flex: 0 0 56–58%`)** dengan scrim judul; bawah `0.8fr` Rak Bahan vs `1.2fr` Grid step mini.

7. **`step_timeline_zigzag` (T7)**
   - *40%:* Header judul ringkas; **Hero full-width (`flex: 0 0 41–42%`)**; bawah 4 kartu timeline `2×2` (thumbnail `~80px` + caption ringkas) + strip bahan 2 kolom rapat.
   - *55%:* **Hero full-width (`flex: 0 0 55–58%`)** dengan scrim judul; bawah 4 kartu timeline `2×2` kompak + strip bahan 1 baris.

8. **`polaroid_scrapbook` (T8)**
   - *40%:* Judul atas terpusat; kolom **`1.22fr : 0.78fr`**; Polaroid Hero kiri `flex: 3.2` + 3 mini polaroid proses `flex: 0.58`.
   - *55%:* Kolom **`1.38fr : 0.62fr`** (judul masuk ke keterangan Polaroid Hero); Polaroid Hero `flex: 3.8` + 3 mini polaroid `flex: 0.55`.

9. **`compact_2col_cheat_sheet` (T9)**
   - *40%:* **Hero Banner full-width (`flex: 0 0 43–44%`)** dengan scrim judul & meta kontras tinggi di bawah; bawah `0.88fr` Bahan vs `1.12fr` 6 Langkah Cepat.
   - *55%:* **Hero Banner full-width (`flex: 0 0 57–60%`)**; bawah `0.85fr` Bahan vs `1.15fr` Langkah Cepat ringkas.

**Aturan Penjaga Kualitas Render:**
- Setiap overlay teks di atas foto Hero wajib memakai scrim gelap (`linear-gradient(180deg, rgba(16,10,6,0.08) 0%, rgba(16,10,6,0.9) 100%)`) agar kontras teks tetap memenuhi WCAG AA.
- Pertahankan dukungan `showBrandWatermark`, `brandWatermarkText`, dan `optional_product_name` chip tanpa bertabrakan dengan elemen footer (`[data-footer="infographic"]`).
- Terapkan `min-height: 0` dan `-webkit-line-clamp` adaptif per rasio (`1:1`, `4:5`, `3:4`, `9:16`) agar teks panjang tidak mendorong tinggi melewati batas kanvas.

---

### Tahap 2: `lib/scheduler-processors.js` & `lib/recipe-infographic-prompt.js`
1. **Penyelarasan Rasio Foto AI Hero di `processRecipeGLabs` (`lib/scheduler-processors.js` baris ~10713 & ~10762):**
   - Saat ini seluruh foto infografis digenerate dengan `aspect_ratio: '4:3'`.
   - Karena beberapa template sekarang memakai **Hero vertikal tinggi** (`hero_right_editorial`, `magazine_vertical_split`, `polaroid_scrapbook`), tambahkan helper pemetaan rasio Hero per template agar `object-fit: cover` tidak memotong hidangan:
     - Hero vertikal (`hero_right_editorial`, `magazine_vertical_split`, `polaroid_scrapbook`): generate foto Hero (`isHeroKey`) di **`3:4`** (atau `2:3` untuk `9:16`).
     - Hero banner lebar (`step_grid_classic`, `layered_band_cards`, `centerpiece_spotlight`, `visual_ingredient_shelf`, `step_timeline_zigzag`, `compact_2col_cheat_sheet`): generate foto Hero di **`4:3`** (atau `16:9` bila Opsi 40% menghasilkan frame wide `> 1.55:1`).
     - Foto step & secondary tetap **`4:3`** atau **`1:1`** sesuai proporsi kartu step.
2. **`lib/recipe-infographic-prompt.js`:**
   - Jika memilih **Opsi A (40%)**: tidak perlu mengubah `getTemplateImageSpec` (`stepPhotoCount` tetap sama).
   - Jika memilih **Opsi B (55%)** dan ingin mengurangi step T1/T6 dari 6 ke 4 foto: perbarui `getTemplateImageSpec` untuk `step_grid_classic` & `visual_ingredient_shelf` menjadi `stepPhotoCount: 4, textStepCount: 4` (opsi ini juga menghemat 2 panggilan G-Labs per poster).

---

### Tahap 3: `app/components/campaign-forms/RecipeInfographicControls.js`
1. Perbarui `desc` pada `TEMPLATE_OPTIONS` (baris 5–78) agar mencerminkan tata letak Hero dominan yang baru (mis. T3/T4/T6/T7 menjadi Hero banner dominan).
2. Perbarui wireframe mini pada `TemplateWireframe` (baris 94–255) agar proporsi kotak Hero (`blockBg` + border `accent`) pada tiap kartu pilihan template konsisten dengan hasil poster.
3. *(Bila Opsi B mengubah kuota foto T1/T6 ke 4 foto)* perbarui `badge` pada `TEMPLATE_OPTIONS`.

---

### Tahap 4: `tests/recipe-infographic.test.js`
Perluas test suite yang sudah ada (baris 267–299):
1. Uji seluruh **9 template** pada **4 rasio** (`3:4` `1080×1440`, `4:5` `1080×1350`, `1:1` `1080×1080`, `9:16` `1080×1920`) untuk memastikan:
   - `document.body.scrollHeight <= expectedH`
   - `wmBottom <= expectedH`
   - `ftBottom <= expectedH`
2. Tambahkan **asersi luas Hero (`[data-hero="primary"]`)**:
   - Hitung `(heroRect.width * heroRect.height) / (1080 * expectedH)`.
   - Pastikan nilainya memenuhi batas minimum sesuai opsi yang dipilih (mis. `>= 0.33` untuk Opsi 40%, atau `>= 0.45` untuk Opsi 55%).
3. Uji `renderRecipeInfographicPoster` menghasilkan JPEG valid berdimensi tepat (`1080×1350`, `1080×1440`, `1080×1080`).

---

## 4. Urutan Eksekusi & Verifikasi Akhir

1. **Konfirmasi pilihan** (Opsi A `40%` vs Opsi B `55%`, dan apakah rasio `step_grid_classic`/`visual_ingredient_shelf` tetap 6 foto atau 4 foto).
2. Implementasi perubahan pada `lib/recipe-infographic-renderer.js`, `lib/scheduler-processors.js` (+ `lib/recipe-infographic-prompt.js` bila kuota berubah), dan `app/components/campaign-forms/RecipeInfographicControls.js`.
3. Jalankan unit test & render test Playwright:
   ```bash
   PG_SEARCH_PATH=dev node --test tests/recipe-infographic.test.js
   ```
4. Uji render visual memakai aset foto resep nyata (1 batch sampel `3:4` & `4:5`) untuk mengecek tidak ada makanan terpotong oleh `object-fit: cover` atau teks menabrak scrim/watermark.
5. Jalankan build produksi lokal:
   ```bash
   DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build
   ```
6. Commit ke branch `fitur/recipe-labs-infografis` dan deploy ke Dev (`5020`).
