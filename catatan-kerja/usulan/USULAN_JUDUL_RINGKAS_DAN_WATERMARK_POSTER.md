# Usulan Perbaikan: Judul Ringkas Poster & Anti-Terpotong Watermark Brand

Tanggal: 28 November 2026  
Branch: `fitur/recipe-labs-infografis`  
Referensi Temuan: Poster `Sourdough Coffee Brownie Bliss...` rasio `3:4` (`1080x1440`)

---

## Analisa Dua Masalah Utama

### 1. Kenapa Nama Brand Tidak Tampil / Terpotong di Rasio `3:4`?
Dari gambar hasil render (`1080x1440`):
1. **Judul sangat panjang (4 baris, `~190px`)** memakan ruang vertikal kolom atas secara berlebihan, mendorong foto hero dan baris `Cara Membuat` ke bawah.
2. **Caption langkah cukup panjang (3-4 baris per kotak)** ditambah tinggi 2 baris kotak foto langkah (`stepImgH: 175px`) membuat total tinggi konten melebihi tinggi kanvas `1440px`.
3. Di [lib/recipe-infographic-renderer.js](../../lib/recipe-infographic-renderer.js), badge watermark brand (`watermarkHtml`) masih ditaruh **di dalam aliran footer normal paling bawah di bawah badge CTA** (`Simpan & Coba Resep Ini!` yang juga wrap menjadi 2 baris). Ketika tinggi total `> 1440px`, aturan `body { height: 1440px; overflow: hidden }` memotong bagian terbawah halaman: daftar `Tips` baris ke-2/3 terpotong separuh, dan badge watermark brand hilang keluar batas bawah kanvas.

### 2. Kenapa Judul Terlalu Panjang dari Recipe Library?
Data di `curated_recipes` menyimpan judul lengkap gaya artikel SEO/blog (misal: *"Sourdough Coffee Brownie Bliss: Perpaduan Aroma Kopi dan Kelezatan Cokelat yang Menggoda!"*). Bila diletakkan utuh menjadi `<h1 class="title-outline">` ukuran `42-54px` di kolom kiri poster, tampilannya mendominasi layout hingga 4 baris dan mengganggu harmoni tipografi.

---

## Usulan Solusi (Agar Selalu Harmonis & Anti-Terpotong)

### A. Pemisahan `poster_title` (Ringkas 2-5 Kata) vs `full_title` (Artikel & Caption)
1. **Instruksi Gemini + Auto-Shortener (`shortenPosterTitle`)**:
   - **Di Poster (`title`)**: wajib ringkas **2-5 kata (maks ~34 karakter)** hanya menyebut nama inti masakan. Contoh: `"Sourdough Coffee Brownie Bliss: Perpaduan Aroma Kopi..."` -> **`"Sourdough Coffee Brownie"`**.
   - **Di `normalizeInfographicPayload`**: tambahkan penyaring otomatis bila LLM masih mengirim judul panjang:
     - Pangkas anak kalimat setelah pemisah `:`, ` - `, atau ` | `.
     - Pangkas klausa penghubung panjang (`yang ...`, `untuk ...`) atau batasi hingga 4-5 kata yang bersih.
     - Judul lengkap Recipe Library tetap dipakai utuh pada **Caption Facebook / Instagram** dan `content_md` agar detail SEO/cerita tidak hilang.
2. **Skala Font Adaptif + Batas Maksimal 2 Baris**:
   - Skala font otomatis di `.title-outline`: `<= 18 huruf` (`52px`), `19-28 huruf` (`42px`), `29+ huruf` (`34px`), serta pengaman `-webkit-line-clamp: 2` agar judul **maksimal 2 baris** di seluruh 9 template.

### B. Watermark Brand Dijamin Selalu Tampil Utuh (`100% Anti-Clip`)
- **Posisi Watermark**: ubah kontainer `body` menjadi `position: relative` dan pasang pill badge `@NamaBrand` sebagai layer tetap di pojok kanan bawah poster (`position: absolute; right: 24px; bottom: 18px; z-index: 20`) atau pojok kanan atas foto hero (khusus untuk `compact` jika diperlukan), dengan memberi ruang kosong kanan-bawah pada footer (`padding-bottom: 58px` atau blok footer yang ringkas) sehingga:
  - Badge nama brand **mustahil terdorong keluar kanvas** di rasio `3:4`, `4:5`, maupun `1:1` serta seluruh 9 template.
- **Perapian Tinggi Blok Bawah (`Tips` + `CTA` + `Step Grid`)**:
  - `cta_badge` dibatasi 2-3 kata (`"Yuk Recook!"` / `"Selamat Mencoba!"`) dengan `white-space: nowrap` agar selalu **1 baris** (tidak wrap seperti *"Simpan & Coba / Resep Ini!"*).
  - `steps[].caption` dibatasi prompt **6-11 kata** dan CSS `-webkit-line-clamp: 3`, serta `tips` dibatasi **2 tips singkat** (1 baris per poin) dan tinggi `stepImgH` dikalibrasi untuk `3:4` (`150px`), `4:5` (`134px`), dan `1:1` (`105px`).
  - Hasilnya: `Hero`, `Bahan`, `Langkah 1-6`, `Tips`, `CTA`, dan `Brand Watermark` selalu muat utuh dalam kanvas `1080x1440` (`3:4`), `1080x1350` (`4:5`), dan `1080x1080` (`1:1`) dengan napas visual yang seimbang.

---

## Keputusan yang Dibutuhkan
Apakah setuju dengan rancangan ini:
1. Judul poster diringkas menjadi **nama inti hidangan (2-5 kata, maks 2 baris)**, sementara judul lengkap Recipe Library tetap tampil di Caption sosmed?
2. Watermark brand dikunci posisinya (**anti-overflow**, selalu tampil utuh di pojok kanan bawah) + teks `CTA`, `Tips`, & tinggi `stepImgH` diseimbangkan agar semua bagian footer terbaca utuh tanpa terpotong?
