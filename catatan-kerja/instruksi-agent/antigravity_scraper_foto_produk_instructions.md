# Instruksi Antigravity: Perbaikan Scraper Foto Produk (pilih foto produk saja, tanpa orang)

> **Revisi 01 berlaku (setelah v2.49.1):** baca `antigravity_scraper_foto_produk_revisi_01.md`. Isinya: perbaikan 4 celah backend (audit 2,5 MB, status gagal tetap approved, refresh mengosongkan foto, repair membatalkan needs_review), kualitas crop, tombol Setujui Foto, dan fitur Ganti Foto di UI.

> **Revisi 02 berlaku (uji staging 17 Nov 2026, v2.50.3):** baca `antigravity_scraper_foto_produk_revisi_02.md`. Isinya: bug fatal `processCleanInputPath is not defined` (foto clean tidak terbentuk sejak v2.49.2), deteksi halaman 404, filter kandidat domain-kosong, tenant MCP ke job, galeri lengkap, rubrik picker lebih longgar, margin crop 10% dan latar putih tanpa rembg, serta enrichment gagal kuota yang bisa diulang. Dibagi ke branch `hotfix/*` dan `fitur/*` sesuai SOP baru.

## Mandat

Kerjakan usulan di `USULAN_PERBAIKAN_SCRAPER_FOTO_PRODUK.md` (root repo), bagian P1–P5 (P6 opsional), agar scraper produk (`cf_scrape_product_url` → job `product_scraper`) memilih **foto produk saja** (tanpa orang/wajah, tanpa banner promo) dan tidak lagi menandai foto bermasalah sebagai `approved`.

Batas kerja: **hanya alur scraper produk**. Jangan menyentuh alur lain (OPC, RE, Multiplier, Recipe, finishing, publishing, enrichment, UI katalog), kecuali yang tertulis eksplisit di dokumen ini.

## Konteks singkat

Scraper sudah jalan untuk Tokopedia (Playwright + Gemini). Masalahnya di foto: scraper selalu mengambil foto utama listing. Kalau foto utama berupa banner berwajah orang, foto latar putih hasilnya tetap memuat orang itu, dan statusnya `approved`. Foto ini dipakai sebagai referensi video AI, jadi wajah tokoh publik yang ikut terbawa berisiko hukum dan merusak konten.

### Kasus uji di staging (tenant `default_tenant`, dibuat 16 Nov 2026)

| ID | Produk | Kondisi |
|---|---|---|
| `pe_1794803911352_653` | Habarlic 5 in 1 (Tokopedia) | **Rusak.** Foto utama banner berwajah endorser (Ustadz Hanan Attaki). `raw` dan `clean_photo` memuat wajah itu, status `approved`. Di galeri yang sama ada foto botol + kotak tanpa orang (1200px) yang tidak pernah dilihat scraper. **Jangan dipakai untuk konten.** |
| `pe_1794802696381_879` | Laxing Kapsul Herbal Detoks (SOHO) | **Kontrol.** Foto utama sudah produk saja. Hasil tidak boleh memburuk. |

URL galeri Habarlic (host `p16-images-sign-sg.tokopedia-static.net`, path `tos-alisg-i-aphluv4xwc-sg/…`):
- utama: `…/b20735c4cedc46ec9e846da67d5363e9~tplv-aphluv4xwc-white-pad-v1:1600:1600.jpeg` (banner, ada orang)
- galeri 1: `…/b6b4581bdb0b432a8a6756e451d8a093~tplv-aphluv4xwc-resize-jpeg:1200:0.jpeg` (**produk saja, ini yang seharusnya dipilih**)
- galeri 2: `…/8ed457e613404b679a76290f07ec42e1~tplv-aphluv4xwc-resize-jpeg:1200:0.jpeg` (infografis)

Di DOM, gambar galeri punya `alt="Product detail media - N"`, gambar utama punya `alt="Gambar <judul>"`. Pengguna menyimpan foto pembanding di Mac-nya (`~/Documents/Shopee Aff/02_Riset_Produk/foto_uji/`: `cf_raw.png`, `cf_clean.jpg` = hasil scraper; `habarlic_2.jpg` = foto yang benar). Folder ini tidak ada di server; minta pengguna jika perlu.

### Akar masalah (sudah dicek ulang terhadap kode `main` @ `dd5b403`)

| # | Masalah | Lokasi sekarang |
|---|---|---|
| 1 | Kandidat foto hanya `og:image` karena regex CDN tidak mengenali `*.tokopedia-static.net` | `lib/url-scraper.js` → `parseHtml()` baris 213; `cdnRegex` baris 245; daftar masuk ke `fullText` sebagai `GAMBAR PRODUK DITEMUKAN` baris 294 |
| 1b | Playwright hanya mengembalikan `{ title, html, bodyText }`, tidak ada daftar gambar DOM | `lib/playwright-scraper.js` → `scrapeUrlPlaywright()` baris 61, `return` baris 162 |
| 2 | Gemini memilih foto dari teks URL (`scraped_image_url` di schema ekstraksi teks) | `lib/scheduler-processors.js` schema baris 10520 & `required` baris 10532; prompt `lib/prompts.js` baris 571, 1717, 3770, 3799 |
| 3 | Smart crop dilewati karena `repair_mode` default `true`, termasuk untuk produk baru | `app/api/v2/products/scrape/route.js:31` (`repair_mode = true`); `lib/scheduler-processors.js:10331` (`?? true`); `:10612` (`runSpatialCrop = !repairMode`); prompt crop baris ~10618 |
| 3b | MCP tidak mengirim `repair_mode` | `apps/mcp/tools.mjs:1412–1422` (`cf_scrape_product_url`) |
| 4 | Tidak ada cek orang/wajah; `photo_status` default `'approved'` dan scraper tidak pernah mengisinya | `lib/bg-remover.js:14` (`createCleanProductShot`, rembg mempertahankan orang); `lib/db-pg.js:1179`; objek `data` di `lib/scheduler-processors.js` ~10763–10786 |
| 5 | G-Labs polish selalu gagal: "Format reference image T2I tidak valid." | `lib/scheduler-processors.js:10696` (`toString('base64')` polos) dan `:10703` (`reference_images: [cleanedBase64]`); validator `lib/base64-image-reference.js:85` (`inspectBase64ImageReference`) wajib data URI **dan** MIME harus cocok dengan magic bytes |

Catatan tambahan hasil cek ulang (belum ada di usulan):
- **Produk yang sudah ada tidak bisa di-scrape ulang fotonya.** Di route (`route.js` ~121–135), produk lama yang komponennya lengkap langsung `skippedCount++`. Di processor (~10401–10433), `needsRaw`/`needsClean` hanya true jika file hilang, dan kalau `scraped_image_url` sudah ada, scraping browser dilewati (`canSkipScrape`) sehingga URL lama (banner) dipakai lagi. Jadi uji ulang Habarlic butuh flag baru (lihat P3b).
- Helper yang bisa dipakai ulang: `generateWithImages(images[], prompt, schema)` di `lib/gemini.js:1264` (banyak gambar + label dalam **satu** request), `generateWithImage` di `:1322`, `bufferToBase64DataUrl(buffer, path)` di `lib/base64-image-reference.js:28` (mendeteksi MIME dari magic bytes), `downloadImagePlaywright` di `lib/playwright-scraper.js:178`, `downloadECommerceImage` di `lib/url-scraper.js:138`.
- Status `needs_review` sudah dipakai di `app/api/v2/products/image/route.js:142`. GET `/api/v2/products/[id]` (dipakai `cf_get_product_detail`) sudah mengembalikan seluruh baris produk, jadi `photo_status`/`photo_error` seharusnya ikut tampil. Verifikasi, jangan diasumsikan.
- Fungsi `parseHtml` belum di-export. Untuk unit test, export sebagai named export tanpa mengubah perilakunya.

## Urutan wajib

1. Baca `AGENTS.md`, `USULAN_PERBAIKAN_SCRAPER_FOTO_PRODUK.md`, dan dokumen ini sampai habis.
2. Jalankan `git status`. Jangan menimpa perubahan pengguna (saat ini ada file untracked `USULAN_PERBAIKAN_SCRAPER_FOTO_PRODUK.md` dan dokumen ini, biarkan saja).
3. Jika menyentuh route Next.js, baca dulu panduan terkait di `node_modules/next/dist/docs/`.
4. Buat `scraper_foto_produk_implementation_plan.md` di root repo berisi `## Execution Task List` (checkbox) dan **Code Sebelum / Code Sesudah** untuk setiap file yang diubah.
5. Kerjakan P1 → P5 berurutan (P6 hanya jika semua sebelumnya selesai). Centang task hanya setelah diverifikasi.
6. Uji lokal (unit test + skrip dry-run). **Berhenti dan laporkan ke pengguna sebelum rilis/deploy** (lihat bagian Larangan).

## Langkah kerja

### P1. Kumpulkan semua foto galeri (DOM + regex cadangan)

**File:** `lib/playwright-scraper.js`, `lib/url-scraper.js`

1. Di `scrapeUrlPlaywright()`, setelah scroll dan sebelum `page.close()`, tambahkan `page.evaluate` yang mengembalikan daftar gambar:
   ```js
   const images = await page.evaluate(() => {
     const out = []; const seen = new Set();
     for (const img of document.querySelectorAll('img')) {
       const src = img.currentSrc || img.src;
       if (!src || !src.startsWith('http') || seen.has(src)) continue;
       if ((img.naturalWidth || 0) < 300) continue;
       seen.add(src);
       out.push({ src, w: img.naturalWidth, h: img.naturalHeight, alt: (img.alt || '').slice(0, 120) });
       if (out.length >= 10) break;
     }
     return out;
   });
   return { title, html, bodyText, images };
   ```
   Urutan mengikuti urutan DOM (galeri). Prioritaskan gambar dengan `alt` diawali `Gambar ` atau `Product detail media` bila ada; buang ikon, logo toko, avatar, dan rekomendasi produk lain (biasanya `alt` kosong/judul produk lain atau ukuran kecil).
2. Di `lib/url-scraper.js`:
   - Tambahkan host Tokopedia baru ke `cdnRegex` (baris 245), mis. `p\d+-images-sign-sg\.tokopedia-static\.net` (pertimbangkan pola umum `[a-z0-9-]+\.tokopedia-static\.net`). Batasi ke URL gambar (`.jpeg|.jpg|.png|.webp` atau `~tplv-`).
   - `parseHtml(html, url, domImages = [])`: gabungkan `domImages` (prioritas pertama), lalu `og:image`, lalu hasil regex. Dedup berdasarkan **hash gambar** (bagian sebelum `~tplv-`), karena satu foto bisa muncul dengan beberapa varian ukuran; simpan varian dengan resolusi terbesar.
   - Kembalikan field baru `imageCandidates: [{ url, w, h, alt, source: 'dom'|'og'|'regex' }]` (maks 10) di objek hasil, selain `title/description/bodyText/fullText` yang sudah ada. `fullText` tetap boleh memuat daftar URL untuk cadangan.
   - Di `scrapeUrl()`, teruskan `result.images` ke `parseHtml`.
   - `export { parseHtml }` untuk test.
3. **Resolusi:** URL Tokopedia bertanda tangan (`x-signature`/`x-expires`) kemungkinan tidak bisa diubah ukurannya. Jangan mengutak-atik query bertanda tangan. Ambil `currentSrc` dari DOM apa adanya; boleh mencoba varian `resize-jpeg:1200:0` **hanya** jika URL tanpa signature dan hasil unduhan valid (HTTP 200, gambar terbaca sharp). Catat temuanmu di laporan.

### P2. Pilih foto dengan Gemini vision (satu panggilan per produk)

**File:** modul baru `lib/product-photo-picker.js` (disarankan), dipanggil dari `processProductScraper()` di `lib/scheduler-processors.js` sebelum tahap download raw (~10596).

1. Unduh maksimal **6** kandidat teratas dari `imageCandidates` ke folder temp (pakai `downloadImagePlaywright` atau `downloadECommerceImage`; CDN butuh cookie/referer). Lewati yang gagal atau < 300px.
2. Kirim semua kandidat dalam **satu** request ke `generateWithImages()` (`lib/gemini.js:1264`), tiap gambar diberi label `Kandidat #<index>`. Schema:
   ```json
   {
     "type": "object",
     "properties": {
       "best_index": { "type": "integer" },
       "candidates": {
         "type": "array",
         "items": {
           "type": "object",
           "properties": {
             "index": { "type": "integer" },
             "has_person": { "type": "boolean" },
             "text_overlay": { "type": "string", "enum": ["none", "light", "heavy"] },
             "is_infographic": { "type": "boolean" },
             "product_visible": { "type": "boolean" },
             "score": { "type": "integer" }
           },
           "required": ["index", "has_person", "text_overlay", "is_infographic", "product_visible", "score"]
         }
       }
     },
     "required": ["best_index", "candidates"]
   }
   ```
   Contoh prompt:
   > Kamu memilih foto referensi produk untuk katalog. Ada N kandidat foto dari listing yang sama. Untuk setiap kandidat, nilai: apakah ada manusia/wajah/tangan/model (`has_person`), seberapa banyak teks promosi di atas gambar (`text_overlay`: none/light/heavy), apakah berupa infografis/tabel/kolase (`is_infographic`), apakah kemasan produk terlihat jelas dan utuh (`product_visible`), lalu skor 0–100 untuk kelayakan sebagai foto produk bersih. Utamakan foto produk utuh dengan kemasan terlihat, latar polos, tanpa orang dan tanpa teks besar. Kembalikan `best_index` = kandidat terbaik.
3. Aturan pilih di **kode** (jangan percaya `best_index` mentah):
   - Tolak kandidat dengan `has_person === true`, `is_infographic === true`, `text_overlay === 'heavy'`, atau `product_visible === false`.
   - Dari yang lolos, ambil skor tertinggi (seri → resolusi terbesar).
   - Jika **semua** tertolak: pakai skor tertinggi, dan tandai `photoNeedsReview = true` dengan alasan (mis. `'semua kandidat memuat orang/teks'`).
   - Jika panggilan vision gagal/timeout: pakai kandidat pertama yang `source: 'dom'` atau `og:image`, dan tandai `photoNeedsReview = true` (`'pemilihan foto otomatis gagal'`). Scrape tidak boleh gagal total karena ini.
4. `scraped_image_url` di schema ekstraksi teks (~10520/10532) dijadikan **opsional** (hapus dari `required`) dan hanya dipakai sebagai cadangan terakhir bila `imageCandidates` kosong (mis. jalur fallback AI Search Grounding). Simpan URL hasil P2 ke kolom `scraped_image_url` produk. Jangan mengubah bagian lain prompt di `lib/prompts.js` selain kalimat tentang `scraped_image_url` (baris 3770/3799 dan contoh JSON terkait), bila memang perlu.
5. Simpan ringkasan penilaian (index, url, flag, skor) ke log job dan ke `raw_response` produk (atau field JSON yang sudah ada) agar bisa diaudit. Jangan membuat kolom DB baru untuk ini.

### P3. Selalu smart crop produk baru; pisahkan "repair" dari "budget"

**File:** `lib/scheduler-processors.js`

1. Ganti `const runSpatialCrop = !repairMode;` (baris 10612) menjadi logika yang tidak bergantung pada `repairMode`:
   ```js
   const budgetMode = payload?.budget_mode === true;
   const runSpatialCrop = !scrapedItem.isRepair || refreshPhoto || !budgetMode;
   ```
   Produk baru (`isRepair === false`) **selalu** di-crop. Pesan log "Skipping Gemini Spatial Crop" hanya muncul bila `budget_mode` aktif pada produk lama.
2. Perbarui `cropPrompt` (~10618): tambahkan kalimat
   > Box the product package only. Exclude any people, faces, hands, models, logos/badges and promotional text. If a person is holding the product, box only the product.
3. Jangan ubah default `repair_mode` di route. Perilaku melewati produk lama yang sudah lengkap tetap sama.

### P3b. Flag `refresh_photo` untuk mengulang foto produk yang sudah ada

Dibutuhkan agar Habarlic bisa diperbaiki tanpa menghapus produk.

**File:** `app/api/v2/products/scrape/route.js`, `lib/scheduler-processors.js`, `apps/mcp/tools.mjs`

1. Route: terima `refresh_photo` (boolean, default `false`). Jika true dan produk sudah ada, masukkan ke `urlsToScrape` walau komponennya lengkap, dan teruskan `refresh_photo` di payload `createJob('product_scraper', …)`.
2. Processor: jika `payload.refresh_photo === true` dan produk ada → `needsRaw = needsClean = needsStudio = true`, **abaikan** `canSkipScrape` (wajib scrape ulang browser agar dapat galeri baru), dan jangan memanggil ekstraksi metadata ulang bila metadata sudah lengkap (hemat token). Update hanya kolom foto (`raw_photo_url`, `cleaned_photo_url`, `clean_photo_url`, `generated_photo_url`, `photo_url`, `active_photo`, `scraped_image_url`, `photo_status`, `photo_error`). Jangan menimpa nama, USP, prompt, kategori, tag, atau link afiliasi.
3. MCP `cf_scrape_product_url`: tambahkan parameter opsional `refresh_photo: z.boolean().optional()` dengan deskripsi singkat ("ulang pilih & proses foto untuk produk yang sudah ada"). Jangan mengubah tool MCP lain.

### P4. Pemeriksa akhir sebelum `approved`

**File:** `lib/scheduler-processors.js` (atau `lib/product-photo-picker.js`)

1. Setelah `createCleanProductShot` berhasil (~10678), kirim foto clean ke `generateWithImage` dengan schema `{ has_person: boolean, has_heavy_text: boolean }` (prompt pendek: "Apakah gambar ini memuat manusia/wajah/tangan, atau teks promosi besar?").
2. Isi `data.photo_status` dan `data.photo_error` secara eksplisit di objek `data` (~10763):
   - `has_person` atau `has_heavy_text` true, atau `photoNeedsReview` dari P2 → `photo_status = 'needs_review'`, `photo_error = 'foto memuat orang/teks'` (atau alasan dari P2).
   - Selain itu → `photo_status = 'approved'`, `photo_error = null`.
   - Jika pemeriksa gagal (error API) → `needs_review` dengan `photo_error = 'pemeriksaan foto gagal'`. Lebih baik ditinjau manusia daripada lolos.
3. Pastikan `cf_get_product_detail` menampilkan `photo_status` dan `photo_error` (cek respons GET `/api/v2/products/[id]`). Jika belum tampil, tambahkan seminimal mungkin.
4. Biaya: P2 + P4 total maksimal **2 panggilan vision per produk** (+1 crop yang memang sudah ada). Jangan memanggil vision per kandidat.

### P5. Perbaiki format reference G-Labs

**File:** `lib/scheduler-processors.js` ~10696–10703

```js
// Sebelum
const cleanedBase64 = fs.readFileSync(cleanedAbsPath).toString('base64');
...
reference_images: [cleanedBase64]

// Sesudah
const { bufferToBase64DataUrl } = await import('./base64-image-reference.js');
const cleanedDataUrl = bufferToBase64DataUrl(fs.readFileSync(cleanedAbsPath), cleanedAbsPath);
...
reference_images: [cleanedDataUrl]
```

Pakai helper yang mendeteksi MIME dari isi file (validator menolak jika label MIME tidak cocok dengan magic bytes, dan file `clean_*.jpg` belum tentu benar-benar JPEG). Jika foto berstatus `needs_review`, **jangan** jalankan G-Labs polish (hemat kuota, dan jangan memoles foto yang memuat orang).

### P6 (opsional). Kembalikan `job_id` dan `product_id` dari scrape

`/api/v2/products/scrape` sekarang hanya mengembalikan hitungan. Kembalikan `job_ids` dan, untuk URL tunggal, `product_id` (untuk produk lama: ID yang ada; untuk produk baru: ID yang direservasi di route lalu diteruskan lewat payload, mis. `reserved_ids: { [url]: id }`, dan dipakai processor menggantikan `pe_${Date.now()}…` baris ~10586). Kerjakan hanya jika P1–P5 selesai dan teruji.

## Tes yang wajib ditambahkan

Pakai `node --test`, file di `tests/`, fixture di `tests/fixtures/`.

1. **`tests/fixtures/tokopedia_product_2026.html`**: HTML minimal sintetis (jangan menyimpan halaman asli yang memuat cookie, token, atau data pengguna) berisi `og:image` foto utama Habarlic, ≥3 tag `<img>`/string JSON dengan URL `https://p16-images-sign-sg.tokopedia-static.net/tos-alisg-i-aphluv4xwc-sg/<hash>~tplv-…` (pakai tiga hash di atas, plus satu duplikat ukuran berbeda), dan satu URL `p19-…` .
2. **`tests/url-scraper-tokopedia-images.test.js`**:
   - `parseHtml(fixture)` menghasilkan `imageCandidates` berisi **≥3 URL `tokopedia-static.net`** dengan hash unik (duplikat ukuran tergabung jadi satu).
   - `domImages` yang diberikan muncul paling depan.
   - URL Shopee/`images.tokopedia.net` lama masih terdeteksi (regresi).
3. **`tests/product-photo-picker.test.js`** (Gemini di-mock, tanpa jaringan):
   - kandidat 0 `has_person: true` skor 95, kandidat 1 bersih skor 80 → terpilih kandidat 1, `needsReview = false`.
   - semua kandidat `has_person: true` → terpilih skor tertinggi, `needsReview = true`.
   - vision melempar error → cadangan kandidat pertama, `needsReview = true`.
   - `text_overlay: 'heavy'` dan `is_infographic: true` ditolak.
4. **Tes keputusan crop & status** (fungsi murni yang diekstrak, mis. `shouldRunSpatialCrop({ isRepair, refreshPhoto, budgetMode })` dan `decidePhotoStatus({ pickerNeedsReview, finalCheck })`): produk baru selalu crop; pemeriksa gagal → `needs_review`.
5. **Tes P5**: data URI hasil helper lolos `inspectBase64ImageReference` untuk file JPEG dan PNG (boleh menambah kasus di `tests/base64-image-reference.test.js`).
6. **Skrip dry-run** `scripts/test-scraper-photo-pick.mjs <url>`: scrape + P1 + P2 + crop + P4 **tanpa menulis ke DB**, simpan kandidat, foto terpilih, dan JSON penilaian ke folder temp, lalu cetak ringkasannya. Ini dipakai untuk uji lokal URL Habarlic dan Laxing sebelum menyentuh staging.

Jalankan juga test yang sudah ada yang terkait (`tests/base64-image-reference.test.js`, `npm run test:product-catalog`, `npm run test:mcp`) dan `npm run build`.

## Kriteria selesai (bisa dicek)

Lokal (sebelum minta izin rilis):
- [ ] Semua test baru dan test terkait lulus; `npm run build` berhasil.
- [ ] Dry-run URL Habarlic: foto terpilih = hash `b6b4581bdb0b432a8a6756e451d8a093` (botol + kotak), tanpa orang, lebar ≥ 1000px; pemeriksa akhir `has_person: false`.
- [ ] Dry-run URL Laxing: foto terpilih tetap foto produk (tidak memburuk dibanding foto utama sekarang).
- [ ] Dry-run listing yang semua fotonya berisi model/orang (cari satu contoh di Tokopedia, catat URL-nya) → hasil `needs_review`.
- [ ] Log tidak memuat "Format reference image T2I tidak valid" pada uji G-Labs (boleh uji lokal ke worker G-Labs jika tersedia; jika tidak, cukup unit test P5 dan catat di laporan).
- [ ] Jumlah panggilan vision per produk ≤ 2 (+1 crop), terlihat di log.

Staging (**hanya setelah pengguna menyetujui deploy**):
- [ ] `cf_scrape_product_url` dengan `refresh_photo: true` untuk URL Habarlic memperbarui `pe_1794803911352_653`: raw = foto `b6b4581b…`, `clean_photo` tanpa orang, `photo_status = approved`, `generated_photo_url` terisi. Nama, USP, link afiliasi tidak berubah.
- [ ] `pe_1794802696381_879` (Laxing) tidak berubah kecuali di-refresh, dan jika di-refresh hasilnya tetap produk saja.
- [ ] Scrape produk baru lewat MCP menjalankan smart crop (log "AI Smart Cropping successfully applied").

## Larangan

- **Jangan rilis (`npm run release-non-interactive`), push, tag, atau deploy ke staging Mac mini tanpa persetujuan eksplisit pengguna.** Staging dipakai untuk produksi konten harian. Untuk tugas ini, aturan "rilis otomatis setelah verifikasi" di `AGENTS.md` **ditunda**: selesaikan kode + uji lokal, commit lokal di branch kerja, lalu laporkan dan tunggu izin. Production tetap dilarang.
- **Jangan menghapus produk** dari database (termasuk Habarlic dan Laxing) dan jangan menghapus file foto lama di `public/uploads/products/`. Perbaikan dilakukan lewat `refresh_photo` (update in place).
- **Jangan mengubah alur lain** di luar scraper: prompt enrichment/storyboard, preset, OPC/RE/Multiplier/Recipe, finishing, publishing, worker foto lain (`regenerate-photos`, `image/route.js`), skema DB (tidak perlu kolom baru; `photo_status` dan `photo_error` sudah ada).
- Jangan mengubah default `repair_mode` di route.
- Jangan menulis API key/secret asli di kode, test, fixture, atau dokumen. Test memakai mock (`'TEST_MOCK_API_KEY'`).
- Jangan menyimpan halaman Tokopedia asli utuh ke repo (bisa memuat token/cookie). Fixture harus sintetis dan minimal.
- Jangan polling SSH berulang. Jangan menyentuh server sebelum ada izin.
- Klaim berlebihan di hasil enrichment (Laxing "terbukti efektif", Habarlic "100% herbal alami aman") **di luar lingkup** tugas ini. Cukup sebutkan di laporan sebagai catatan, jangan diperbaiki di sini.

## Format laporan balik ke pengguna

Tulis dalam **Bahasa Indonesia sederhana** (pengguna adalah marketer, bukan developer). Urutan:

1. **Ringkasan 3–5 kalimat**: apa yang sudah diperbaiki dan apa dampaknya untuk foto produk.
2. **Status per langkah**: P1, P2, P3, P3b, P4, P5, (P6) → selesai / sebagian / tidak dikerjakan, satu baris alasan.
3. **Hasil uji lokal**: daftar test (lulus/gagal), hasil build, dan hasil dry-run Habarlic, Laxing, dan kasus negatif (foto terpilih + flag penilaian; sertakan path file foto terpilih di folder temp).
4. **File yang diubah/ditambah** (daftar singkat) dan link ke `scraper_foto_produk_implementation_plan.md`.
5. **Commit lokal** (hash + branch). Belum dirilis/dideploy.
6. **Risiko & catatan**: mis. URL bertanda tangan tidak bisa di-resize, kasus listing yang tetap `needs_review`, biaya vision per produk, catatan klaim enrichment.
7. **Pertanyaan persetujuan**: "Boleh saya rilis versi patch dan deploy ke staging Mac mini, lalu uji ulang Habarlic dengan `refresh_photo`?" Tunggu jawaban sebelum melakukan apa pun di server.

Setelah pengguna setuju dan deploy dilakukan, kirim laporan kedua: versi, commit, tag, hasil uji staging (checklist bagian Staging di atas, dengan tautan foto raw/clean/generated Habarlic), dan status PM2/health.
