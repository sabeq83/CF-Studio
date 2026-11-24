# Kartu Menu: RE Campaign

Terakhir dicek: 24 November 2026 · Versi aplikasi: v2.60.0
Alamat: `/re-campaigns` · Kelompok: WORKFLOW · Kunci izin menu: `re_campaign`

## Fungsi
Mesin kampanye video produk berbasis reverse engineering. Mengambil blueprint dari Deconstruct Lab atau Instant Factory, memasukkan produk brand, lalu menghasilkan video lengkap dengan visual AI, narasi VO, dan finishing template. Ini adalah pipeline produksi utama untuk iklan produk.

## Alur pakai
1. Buat kampanye baru: pilih blueprint/sumber, produk, brand, preset, Visual Identity.
2. Sistem menghasilkan naskah per klip, gambar awal (start frame), dan audio TTS.
3. Tinjau dan setujui tiap item; perbaiki naskah atau gambar bila perlu.
4. Jalankan render final; hasil masuk ContentFlow Hub untuk dijadwalkan tayang.

## Terhubung dengan
- Butuh data dari: Deconstruct Lab (blueprint), Product Database, Brand Profile, Visual Identity, Preset.
- Hasilnya ke: ContentFlow Hub, Video Studio (bisa dipakai sebagai sumber video).
- Perintah MCP: `cf_get_job_status`, `cf_get_job_review`, `cf_approve_job`.

## Lokasi (untuk agent)
- Halaman: `app/re-campaigns/page.js`, `app/re-campaigns/[id]/page.js`
- API: `app/api/v2/re-campaigns/` (route, [id], angle-render, angle-variants, bulk, items, scheduler-control)
- Logika inti: `lib/scheduler-processors.js` (± 10.000+ baris — **jangan dibaca utuh**, cari fungsi dengan kata kunci)
- Tabel data: `re_campaigns`, `instant_campaigns`, `unified_production_json`

## Aturan penting & jebakan
1. `lib/scheduler-processors.js` menangani RE Campaign, Instant Factory, dan pipeline produksi lainnya — file sangat panjang, cari fungsi spesifik dengan `grep`.
2. Render final memakai slot produksi (`lib/render-slot.js`); Video Studio mengalah saat RE Campaign merender.
3. Status item: `pending` → `processing` → `completed` / `failed`. Jangan re-render item `completed` tanpa alasan.
4. Mendukung konfigurasi `audio_engine_mode` (`minimax_tts` / `no_vo`), `no_vo_audio_bed`, dan `on_screen_text_mode`, serta guard polling G-Labs (`lib/glabs-poll-guard.js`) dengan timeout unduhan 15 detik dan batas retry jaringan.

## Belum ada / batasan
- Render massal (bulk render) tersedia tapi membutuhkan antrian; tidak instan.

## Dokumen lengkap
`sot/menus/re-campaigns.md`
