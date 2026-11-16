# Kartu Menu: Deconstruct Lab

Terakhir dicek: 17 November 2026 · Versi aplikasi: v2.50.0
Alamat: `/deconstruct` · Kelompok: PLANNING · Kunci izin menu: `deconstruct_lab`

## Fungsi
Laboratorium pembedahan video viral. Memasukkan URL video TikTok/Reels/YouTube, lalu AI mengurai strukturnya menjadi blueprint: hook, narasi per klip, transisi, gaya visual, ritme. Blueprint ini menjadi bahan Multiplier Labs untuk membuat versi produk sendiri.

## Alur pakai
1. Tempel URL video viral → sistem mengunduh dan memproses.
2. AI menganalisis klip per klip, menghasilkan `re_deconstructed_assets` dan blueprint.
3. Tinjau hasil; tandai blueprint yang layak dipakai.
4. Buka Multiplier Labs, pilih blueprint ini sebagai dasar.

## Terhubung dengan
- Hasilnya dipakai oleh: Multiplier Labs.
- Perintah MCP: `cf_ingest_viral_video`, `cf_list_deconstructed_assets`, `cf_get_deconstructed_blueprint`, `cf_search_blueprints`.

## Lokasi (untuk agent)
- Halaman: `app/deconstruct/page.js`, `app/deconstruct/[id]/page.js`
- API: `app/api/v2/deconstruct/` (route, [id], assets, process, scheduler-control)
- Tabel data: `re_deconstruct_batches`, `re_deconstructed_assets`

## Aturan penting & jebakan
1. Video harus bisa diakses publik; video privat atau berumur tidak bisa diunduh.
2. Proses deconstruct memakan waktu; status bisa `processing` beberapa menit.
3. Blueprint yang dihasilkan adalah template cerita, bukan skrip kata per kata.

## Belum ada / batasan
- Belum mendukung video dari platform selain TikTok, Instagram Reels, YouTube Shorts.

## Dokumen lengkap
`sot/menus/deconstruct.md`
