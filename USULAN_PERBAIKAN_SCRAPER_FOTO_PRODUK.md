# Usulan: Perbaikan Scraper Foto Produk (pilih foto produk saja)

Tanggal: 16 Nov 2026 · Status: usulan, belum dikerjakan · Rilis: v2.49.0 (`f5bbea3`) di staging Mac mini (dipakai untuk produksi)

---

## Ringkasan untuk pengguna

Scraper produk (`cf_scrape_product_url` → job `product_scraper`) **sekarang sudah jalan** untuk Tokopedia. Error lama di log Agustus 2026 (Chromium Playwright tidak ada, model `gemini-2.0-flash` sudah dihapus) tidak muncul lagi. Masalahnya sekarang ada di **foto**: scraper selalu mengambil foto utama listing. Kalau foto utamanya berupa **banner promo bergambar orang**, foto latar putih yang dihasilkan **tetap memuat orang itu**, dan statusnya tetap `approved`.

Kasus uji: Habarlic 5 in 1 (`pe_1794803911352_653`). Foto utamanya banner berwajah endorser (Ustadz Hanan Attaki). Hasil `clean_photo` tetap memuat endorser tersebut. Di galeri listing yang sama ada foto botol dan kotak tanpa orang (1200px), tapi scraper tidak pernah melihatnya.

Bukti (di Mac pengguna): `~/Documents/Shopee Aff/02_Riset_Produk/foto_uji/`
- `cf_raw.png`, `cf_clean.jpg`: hasil scraper (700px, ada endorser)
- `habarlic_2.jpg`: foto galeri yang seharusnya dipilih (1200px, produk saja)
- `habarlic_utama.jpg`, `habarlic_3.jpg`: foto galeri lain (banner, infografis)

**Kenapa ini penting:** foto ini menjadi referensi video AI. Wajah tokoh publik yang ikut terbawa berisiko hukum dan merusak hasil konten.

---

## Akar masalah (4 titik)

### 1. Daftar kandidat foto hanya berisi `og:image` (domain CDN Tokopedia baru tidak dikenali)
`lib/url-scraper.js` → `parseHtml()` (sekitar baris 237–255)

```js
const cdnRegex = /(https:\/\/(?:images\.tokopedia\.net|cf\.shopee\.co\.id|down-id-id\.img\.susercontent\.com|...|ecs7\.tokopedia\.net)[^\s"'<>\\}]*)/gi;
```

Tokopedia sekarang memakai `https://p16-images-sign-sg.tokopedia-static.net/tos-alisg-i-aphluv4xwc-sg/<hash>~tplv-...` (juga `p19-`). Pola ini **tidak cocok** dengan regex, jadi `GAMBAR PRODUK DITEMUKAN` hanya berisi `og:image`, yaitu foto utama versi 700px. Gemini tidak punya pilihan lain.

Contoh URL galeri yang terlewat (Habarlic):
- utama: `…/b20735c4cedc46ec9e846da67d5363e9~tplv-aphluv4xwc-white-pad-v1:1600:1600.jpeg` (banner)
- galeri 1: `…/b6b4581bdb0b432a8a6756e451d8a093~tplv-aphluv4xwc-resize-jpeg:1200:0.jpeg` (produk saja ✅)
- galeri 2: `…/8ed457e613404b679a76290f07ec42e1~tplv-aphluv4xwc-resize-jpeg:1200:0.jpeg` (infografis)

Di browser, gambar galeri punya `alt="Product detail media - N"`, dan gambar utama punya `alt="Gambar <judul>"`.

### 2. Gemini memilih foto hanya dari teks URL (tidak melihat gambarnya)
`lib/scheduler-processors.js` sekitar baris 10500–10540 (`responseSchema.scraped_image_url`), prompt di `lib/prompts.js` baris ~571/1717/3770/3799 ("Temukan URL gambar utama produk…"). Model memilih berdasarkan string URL, jadi tidak mungkin tahu foto mana yang berisi orang atau teks.

### 3. Smart crop dilewati untuk produk BARU karena `repair_mode` default `true`
- `app/api/v2/products/scrape/route.js:31` → `repair_mode = true` (default)
- `lib/scheduler-processors.js:10331` → `const repairMode = payload?.repair_mode ?? true;`
- `lib/scheduler-processors.js:10612` → `const runSpatialCrop = !repairMode;`

MCP `cf_scrape_product_url` (`apps/mcp/tools.mjs:1413`) tidak mengirim `repair_mode`, jadi **setiap** scrape lewat MCP masuk repair mode, termasuk produk yang belum ada sama sekali. Log Habarlic: `Skipping Gemini Spatial Crop (Repair/Budget mode active).` Prompt crop-nya juga belum menyebut "jangan sertakan orang, wajah, tangan, teks".

### 4. Tidak ada pengecekan manusia/wajah sebelum foto berstatus `approved`
`rembg` (`lib/bg-remover.js`, `createCleanProductShot`) membuang latar belakang tapi mempertahankan semua objek depan, termasuk orang. `photo_status` default `'approved'` (`lib/db-pg.js:1179`), jadi foto bermasalah langsung dianggap siap.

### Bug sampingan: G-Labs Generative Polish selalu gagal
Log: `[Product Scraper Job] G-Labs Generative Polish failed: Format reference image T2I tidak valid.` (11:18 dan 11:38, 16 Nov).
`scheduler-processors.js` (~baris 10690) mengirim `reference_images: [cleanedBase64]` berupa base64 polos, padahal `lib/base64-image-reference.js:88` (`inspectBase64ImageReference`) mewajibkan data URI (`data:image/jpeg;base64,…`). Akibatnya `generated_photo_url` tidak pernah terisi.

---

## Usulan perbaikan (urut prioritas)

### P1. Kumpulkan semua foto galeri dari DOM (Playwright)
Di `lib/playwright-scraper.js` (`scrapeUrlPlaywright`, sebelum `return { title, html, bodyText }` ~baris 162), tambahkan `page.evaluate` yang mengembalikan `images: [{src, w, h, alt}]` untuk `img` dengan `naturalWidth >= 300` (urut sesuai galeri, maksimal 10). Teruskan ke `parseHtml`/`fullText` dan simpan sebagai array kandidat.
Tambahkan juga `tokopedia-static\.net` (pola `p\d+-images-sign-sg\.tokopedia-static\.net`) ke `cdnRegex` sebagai cadangan.
Normalisasi resolusi: untuk URL Tokopedia `~tplv-…-resize-jpeg:700:0` → minta varian 1200 (pola galeri sudah `resize-jpeg:1200:0`; ini perlu dicek karena URL bertanda tangan `x-signature` mungkin tidak bisa diubah, kalau begitu ambil langsung dari `currentSrc` DOM).

### P2. Pilih foto dengan Gemini **vision**, bukan teks
Unduh maksimal 6 kandidat (via context Playwright, karena CDN butuh cookie/referer), kirim sebagai gambar ke Gemini (`generateWithImage` yang sudah ada) dengan schema:
```json
{ "best_index": 0, "candidates": [{ "index": 0, "has_person": false, "text_overlay": "none|light|heavy", "is_infographic": false, "product_visible": true, "score": 0 }] }
```
Aturan: tolak kandidat dengan `has_person`, `is_infographic`, atau `text_overlay = heavy`. Utamakan produk utuh dengan kemasan terlihat. Kalau semua tertolak, pilih skor terbaik **dan** set `photo_status = 'needs_review'`.
`scraped_image_url` dikeluarkan dari schema ekstraksi teks (atau hanya dipakai sebagai cadangan).

### P3. Pisahkan "repair" dari "budget", selalu crop produk baru
- `runSpatialCrop` = `!existing || !budgetMode`, jangan bergantung pada `repairMode`. Produk baru (`existing == null`) selalu di-crop.
- Atau ubah default `repair_mode` di route menjadi `false` untuk URL yang belum ada di DB. Pilihan pertama lebih aman.
- Perbarui prompt crop: *"…the product package only. Exclude any people, faces, hands, models, logos/badges and promotional text. If a person is holding the product, box only the product."*

### P4. Pemeriksa akhir sebelum `approved`
Setelah `createCleanProductShot`, cek dengan Gemini vision: `{ has_person, has_heavy_text }`. Kalau ada yang true, set `photo_status = 'needs_review'` dan `photo_error = 'foto memuat orang/teks'`. Jangan `approved`. Tampilkan juga di respons MCP `cf_get_product_detail`.

### P5. Perbaiki format reference G-Labs
Bungkus menjadi data URI: `` `data:image/jpeg;base64,${cleanedBase64}` `` (sesuai mime file), atau pakai helper dari `lib/base64-image-reference.js`.

### P6 (nice to have). Kembalikan `product_id` dari scrape
`/api/v2/products/scrape` saat ini hanya mengembalikan `enqueued_count`. Kembalikan `job_id` dan, untuk produk baru, `product_id` yang direservasi, supaya agen (skill TeleRadar / cfa) tidak perlu mencari ulang lewat `cf_search_catalog`.

### Di luar lingkup tapi perlu dicatat
Hasil enrichment memuat klaim berlebihan untuk produk herbal, misalnya Laxing: `product_truth` "terbukti efektif…" dan USP "…yang aman", serta Habarlic: "100% herbal alami aman". Perlu aturan kepatuhan klaim di prompt enrichment (`lib/prompts.js`, `buildBatchProductExtractionPrompt`).

---

## Rencana uji (wajib, di staging, karena staging = produksi)

1. **Unit:** `parseHtml` dengan fixture HTML Tokopedia baru harus menghasilkan ≥3 URL `tokopedia-static.net`.
2. **Uji ulang Habarlic:** jalankan scrape dengan mode perbaikan foto (`needsRaw/needsClean`) pada `pe_1794803911352_653`. Yang diharapkan: raw = foto galeri botol+kotak (`b6b4581b…`), tanpa orang, minimal 1000px; `clean_photo` tanpa orang; `photo_status = approved`.
3. **Kasus negatif:** listing yang semua fotonya memuat model/orang → `photo_status = needs_review`, bukan `approved`.
4. **Laxing** (`pe_1794802696381_879`, foto utama sudah produk saja) tidak boleh memburuk.
5. **G-Labs polish:** log tidak lagi menampilkan "Format reference image T2I tidak valid", dan `generated_photo_url` terisi.
6. Cek biaya: pemilihan vision maksimal 1 panggilan per produk (semua kandidat dalam satu request).

## Data uji di staging
- `pe_1794802696381_879`: Laxing Kapsul Herbal Detoks (SOHO), foto OK
- `pe_1794803911352_653`: Habarlic 5 in 1. **Foto memuat wajah endorser, jangan dipakai untuk konten** sampai fotonya diperbaiki atau diganti.

Keduanya dibuat tanpa sengaja saat pengujian pada 16 Nov 2026 (tenant `default_tenant`).

## Terkait
- `USULAN_RISET_PRODUK_MINGGUAN_CFA.md`: usulan riset produk (sumber Shopee) dari sesi lain
- Skill **TeleRadar** (`~/.claude/skills/teleradar` di Mac mini): saat ini sengaja **tidak** memakai scraper karena masalah di atas. Setelah P1–P4 selesai, TeleRadar bisa beralih ke scraper.
