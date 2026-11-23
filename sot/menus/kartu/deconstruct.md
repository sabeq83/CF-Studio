# Kartu Menu: Deconstruct Lab

Terakhir dicek: 23 November 2026 · Versi aplikasi: v2.58.0 (fitur/smart-matcher-2plus2)
Alamat: `/deconstruct` · Kelompok: PLANNING · Kunci izin menu: `deconstruct_lab`

## Fungsi
Laboratorium pembedahan video viral. Memasukkan URL video TikTok/Reels/YouTube, lalu AI mengurai strukturnya menjadi blueprint: hook, narasi per klip, transisi, gaya visual, ritme, serta mengindeks kecocokan produk per brand (`blueprint_product_matches`: Alat Dapur & Bahan Resep). Blueprint ini menjadi bahan Multiplier Labs untuk membuat versi produk sendiri.

## Alur pakai
1. Tempel URL video viral → sistem mengunduh dan memproses.
2. AI menganalisis klip per klip, menghasilkan `re_deconstructed_assets` dan otomatis mengindeks kecocokan produk per brand (`indexBlueprintMatchesForAsset`).
3. Tinjau hasil; saring berdasarkan **Brand Fit** dan **Jenis Bridging** (`alat_dapur` / `bahan_resep`) atau jalankan **Sinkron Indeks Matcher**.
4. Buka Multiplier Labs, pilih blueprint ini sebagai dasar.

## Terhubung dengan
- Hasilnya dipakai oleh: Multiplier Labs, Auto Pipeline.
- Perintah MCP: `cf_ingest_viral_video`, `cf_list_deconstructed_assets` (mendukung filter `brand_id` & `promo_role`), `cf_get_deconstructed_blueprint`, `cf_search_blueprints` (mendukung filter `brand_id` & `promo_role`).

## Lokasi (untuk agent)
- Halaman: `app/deconstruct/page.js`, `app/deconstruct/[id]/page.js`
- API: `app/api/v2/deconstruct/` (`route`, `[id]`, `assets`, `matches`, `process`, `scheduler-control`)
- Logika Smart Matcher: `lib/blueprint-product-matcher.js`, `lib/blueprint-product-matcher-shared.js`
- Tabel data: `re_deconstruct_batches`, `re_deconstructed_assets`, `blueprint_product_matches`

## Aturan penting & jebakan
1. Video harus bisa diakses publik; video privat atau berumur tidak bisa diunduh.
2. Proses deconstruct memakan waktu; status bisa `processing` beberapa menit.
3. Blueprint yang dihasilkan adalah template cerita, bukan skrip kata per kata.

## Belum ada / batasan
- Belum mendukung video dari platform selain TikTok, Instagram Reels, YouTube Shorts.

## Dokumen lengkap
`sot/menus/deconstruct.md`
