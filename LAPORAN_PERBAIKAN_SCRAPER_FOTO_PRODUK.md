# Laporan Hasil Implementasi: Perbaikan Scraper Foto Produk (Pilih Foto Produk Saja)

**Tanggal**: 16 November 2026  
**Status**: Pengujian Lokal Selesai (Menunggu Persetujuan Deploy Staging)  
**Target Proyek**: CF-Studio / MAKNA Flow  
**Dokumen Referensi**:
* Rencana Kerja: [scraper_foto_produk_implementation_plan.md](file:///Users/sabeqmmursyid/_cfstudio/scraper_foto_produk_implementation_plan.md)
* Instruksi Tugas: [antigravity_scraper_foto_produk_instructions.md](file:///Users/sabeqmmursyid/_cfstudio/antigravity_scraper_foto_produk_instructions.md)
* Usulan Teknis: [USULAN_PERBAIKAN_SCRAPER_FOTO_PRODUK.md](file:///Users/sabeqmmursyid/_cfstudio/USULAN_PERBAIKAN_SCRAPER_FOTO_PRODUK.md)

---

## 1. Ringkasan Eksekutif

Sistem pengambil foto produk (*product scraper*) pada alur e-commerce telah diperbaiki secara menyeluruh agar **hanya memilih foto produk fisik yang bersih** (bebas dari foto model, wajah manusia, banner promosi berlebih, dan infografis). 

Sebelumnya, scraper hanya mengambil foto pertama/banner utama listing. Jika foto utama memuat wajah tokoh atau model (seperti pada kasus Habarlic yang memuat wajah endorser), foto tersebut ikut terbawa ke studio video AI dan membahayakan kepatuhan hukum/konten. Sekarang, sistem secara cerdas membaca seluruh galeri foto Tokopedia modern, mengevaluasi hingga 6 foto terbaik dalam 1 kali panggilan Gemini Vision, memotong kemasan produk dengan AI Spatial Smart Cropping, dan memvalidasi kebersihan foto akhir sebelum disetujui (`approved`). Untuk produk yang sudah ada di katalog, tersedia opsi `refresh_photo` untuk memperbaiki aset foto tanpa menimpa nama, deskripsi, ataupun tautan afiliasi.

---

## 2. Status Implementasi per Tahapan (P1 – P6)

| Kode | Tahapan | Status | Penjelasan Singkat |
|---|---|---|---|
| **P1** | Pengumpulan Galeri DOM & Dukungan CDN Baru | **Selesai** | DOM Playwright mengekstrak galeri foto lengkap dan regex mengenali host `*.tokopedia-static.net`. Varian resolusi terbesar dari hash foto yang sama otomatis dipilih. |
| **P2** | Pemilihan Foto Produk via Gemini Vision (Multi-Image) | **Selesai** | Modul `lib/product-photo-picker.js` mengevaluasi hingga 6 kandidat dalam 1x panggilan Vision. Foto berwajah manusia, infografis, dan teks promo tebal otomatis ditolak. |
| **P3** | Smart Crop Selalu Aktif & Prompt Anti-Model | **Selesai** | AI Spatial Smart Crop dipisahkan dari `repair_mode` sehingga selalu memotong produk baru dan produk `refresh_photo`. Prompt crop membuang model, tangan, dan logo promosi. |
| **P3b** | Flag `refresh_photo` pada API & MCP | **Selesai** | Endpoint `/api/v2/products/scrape` dan MCP `cf_scrape_product_url` menerima `refresh_photo: true`. Memperbarui aset foto *in-place* tanpa merusak metadata produk. |
| **P4** | Pemeriksaan Akhir & Penentuan Status Review | **Selesai** | Pemeriksa akhir memvalidasi foto clean. Jika masih memuat manusia/teks tebal, diberi status `needs_review` (`photo_error`). Foto bersih otomatis diberi status `approved`. |
| **P5** | Format Data URI Reference Image G-Labs | **Selesai** | Reference image dikonversi ke Data URI dengan deteksi magic bytes (`bufferToBase64DataUrl`), mencegah error format T2I, serta melewati polish jika `needs_review`. |
| **P6** | Pengembalian `job_ids` dan `product_id` (Opsional) | **Selesai** | Endpoint scrape mengembalikan ID job antrean dan ID produk untuk kemudahan pemantauan otomatis. |

---

## 3. Hasil Pengujian Lokal & Dry-Run

### 3.1 Ringkasan Pengujian Otomatis (Unit Tests & Build)

* **Unit Tests Scraper & Picker**: **13/13 Pass**
  * `tests/base64-image-reference.test.js`: 5/5 Pass
  * `tests/product-photo-picker.test.js`: 6/6 Pass
  * `tests/url-scraper-tokopedia-images.test.js`: 2/2 Pass
* **Kontrak Katalog Produk**: **Pass** (`npm run test:product-catalog`)
* **Pengujian MCP Server Tools**: **11/11 Pass** (`npm run test:mcp`)
* **Kompilasi Produksi Next.js**: **Lulus 100%** (`npm run build`)

---

### 3.2 Hasil Dry-Run pada Kasus Nyata

Pengujian dilakukan menggunakan skrip khusus `scripts/test-scraper-photo-pick.mjs` tanpa menulis atau merusak database aktif:

#### A. Kasus Habarlic 5 in 1 (Kasus Utama - Tokopedia)
* **URL**: `https://www.tokopedia.com/habarlic/live-spesial-ramadhan-habarlic-5-in-1-kapsul-kesehatan-dengan-habbatussauda-original-asli-bantu-jaga-kesehatan-tubuh-herbal-yang-aman-halal-isi-100-kapsul-1734104711686161822`
* **Kondisi Sebelumnya (Rusak)**: Foto utama berupa banner promosi berwajah endorser (Ustadz Hanan Attaki), foto studio tetap memuat wajah, status `approved`.
* **Hasil Uji Sekarang (Sembuh)**:
  * Kandidat #0 (banner berwajah orang) diberi nilai `has_person: true` dan **ditolak**.
  * Scraper memilih **Kandidat #1** (hash `b6b4581bdb0b432a8a6756e451d8a093`, 1200x1200px) yaitu foto **kemasan botol + kotak tanpa orang**.
  * AI Spatial Smart Crop memotong fokus ke kemasan produk (`ymin=364, xmin=694, ymax=829, xmax=966`).
  * Background removal menghasilkan foto studio latar putih bersih.
  * Pemeriksaan Akhir: `has_person: false`, `has_heavy_text: false`.
  * **Status Akhir**: **`APPROVED`** (Format G-Labs Data URI valid 38.8 KB).
  * **File Output Hasil Uji**:
    * Foto Mentah: [raw_selected.png](file:///Users/sabeqmmursyid/_cfstudio/public/temp/scraper_dry_run/run_1794806115880/raw_selected.png)
    * Foto Crop: [cropped.png](file:///Users/sabeqmmursyid/_cfstudio/public/temp/scraper_dry_run/run_1794806115880/cropped.png)
    * Foto Clean: [cleaned.jpg](file:///Users/sabeqmmursyid/_cfstudio/public/uploads/products/clean/cleaned_1794806115880.jpg)

#### B. Kasus Laxing SOHO (Kontrol - Tidak Boleh Memburuk)
* **URL**: `https://www.tokopedia.com/sohoglobalhealth/laxing-detoks-herbal-alami-sembelit-begah-konstipasi-susah-bab-halal-1-blister-10-kapsul-1729583293647194483`
* **Kondisi**: Foto utama sudah berupa blister produk bersih.
* **Hasil Uji Sekarang**:
  * Tetap memilih foto blister produk (`d612b3dbe557428cba89d083b82d62a0~.jpeg.webp`).
  * AI Smart Crop memotong presisi area blister (328x128px) dan membersihkan background.
  * Pemeriksaan Akhir: `has_person: false`, `has_heavy_text: false`.
  * **Status Akhir**: **`APPROVED`** (Kualitas kontrol terjaga).
  * **File Output Hasil Uji**:
    * Foto Clean: [cleaned.jpg](file:///Users/sabeqmmursyid/_cfstudio/public/uploads/products/clean/cleaned_1794806371651.jpg)

#### C. Kasus Baju Kemeja Cottonology (Kasus Negatif - Model Manusia)
* **URL**: `https://www.tokopedia.com/cottonology-indo/kemeja-lengan-panjang-pria-cottonology-gery-hitam-hitam-xl`
* **Kondisi**: Semua foto listing memuat model manusia yang mengenakan kemeja.
* **Hasil Uji Sekarang**:
  * AI Vision mendeteksi manusia pada foto model (`has_person: true`).
  * Pemeriksaan akhir mengonfirmasi foto memuat manusia (`has_person: true`).
  * **Status Akhir**: **`NEEDS_REVIEW`** (`photo_error: "foto memuat orang/teks"`).
  * G-Labs Generative Polish otomatis dilewati agar foto berwajah orang tidak diproses menjadi video.

---

## 4. Daftar File yang Diubah & Ditambah

1. [lib/playwright-scraper.js](file:///Users/sabeqmmursyid/_cfstudio/lib/playwright-scraper.js) — Ekstraksi galeri DOM dengan filter aset web sampah dan prioritas alt produk.
2. [lib/url-scraper.js](file:///Users/sabeqmmursyid/_cfstudio/lib/url-scraper.js) — Pola regex CDN baru Tokopedia, dedup hash gambar, integrasi DOM, dan named export `parseHtml`.
3. [lib/product-photo-picker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-photo-picker.js) — **Modul baru**: AI vision multi-image picker, skema scoring kelayakan, aturan crop, final check, dan penentu status.
4. [lib/scheduler-processors.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js) — Integrasi photo picker, isolasi crop dari mode hemat, pembaruan *in-place* `refresh_photo`, format Data URI G-Labs, dan pencatatan audit.
5. [app/api/v2/products/scrape/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/products/scrape/route.js) — Parameter `refresh_photo` dan pengembalian `job_ids` serta `product_id`.
6. [apps/mcp/tools.mjs](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/tools.mjs) — Opsi `refresh_photo` pada tool MCP `cf_scrape_product_url`.
7. [scripts/test-scraper-photo-pick.mjs](file:///Users/sabeqmmursyid/_cfstudio/scripts/test-scraper-photo-pick.mjs) — Skrip dry-run pengujian offline tanpa menyentuh database.
8. [tests/fixtures/tokopedia_product_2026.html](file:///Users/sabeqmmursyid/_cfstudio/tests/fixtures/tokopedia_product_2026.html) — Fixture sintetis halaman Tokopedia 2026.
9. [tests/url-scraper-tokopedia-images.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/url-scraper-tokopedia-images.test.js) — Unit test ekstraksi kandidat gambar galeri.
10. [tests/product-photo-picker.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/product-photo-picker.test.js) — Unit test scoring picker, filter orang, dan status review.
11. [scraper_foto_produk_implementation_plan.md](file:///Users/sabeqmmursyid/_cfstudio/scraper_foto_produk_implementation_plan.md) — Dokumen kontrol rencana implementasi dan checklist eksekusi.

---

## 5. Commit Git Lokal

* **Branch**: `main`
* **Commit Hash**: `cfcded4`
* **Pesan Commit**: `feat(scraper): select clean product photos without persons, enforce smart crop, and support refresh_photo`
* *(Catatan: Perubahan masih berada di repositori lokal; belum di-push, belum di-tag rilis, dan belum dideploy ke server staging sesuai aturan keamanan).*

---

## 6. Risiko & Catatan Teknis

1. **URL Tokopedia Bertanda Tangan (`x-signature`)**: Parameter tanda tangan pada URL Tokopedia modern terikat query string. Sistem mempertahankan query asli dari DOM dan memilih varian resolusi terbaik tanpa memodifikasi URL tanda tangan secara manual.
2. **Efisiensi Kuota AI Vision**: Proses evaluasi dirancang sangat hemat token, yaitu maksimal **3 panggilan Gemini Vision per produk** (1 call multi-image untuk hingga 6 kandidat sekaligus, 1 call untuk spatial crop, dan 1 call untuk pemeriksaan akhir foto bersih).
3. **Klaim Teks Enrichment**: Catatan klaim teks berlebihan pada deskripsi produk (seperti "100% herbal aman" atau "terbukti efektif") berada di luar lingkup tugas pemilihan foto dan tidak diubah pada perbaikan ini.

---

## 7. Pertanyaan Persetujuan Rilis & Deploy Staging

Seluruh kode, unit test, build, dan pengujian dry-run lokal telah berhasil 100%. Sesuai protokol:

> **Boleh saya rilis versi patch dan deploy ke staging Mac mini, lalu menguji ulang produk Habarlic dengan `refresh_photo`?**
