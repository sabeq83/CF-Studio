# Kartu Menu: ContentFlow Hub

Terakhir dicek: 17 November 2026 · Versi aplikasi: v2.50.0
Alamat: `/content-flow` · Kelompok: PUBLISHING · Kunci izin menu: `content_flow`

## Fungsi
Pusat staging dan penjadwalan konten jadi. Semua video dan artikel yang selesai diproduksi masuk ke sini dalam bentuk "slot" sebelum tayang. Pemasar bisa melihat kalender posting, mengatur waktu tayang per akun, dan memantau status tayang (antri, sudah tayang, gagal).

## Alur pakai
1. Konten selesai dari pipeline → otomatis masuk ContentFlow Hub sebagai slot baru.
2. Tinjau slot: edit caption, atur waktu tayang, pilih akun media sosial.
3. Konfirmasi jadwal; Repliz mengirim ke platform pada waktu yang ditentukan.
4. Pantau status di kalender atau daftar slot.

## Terhubung dengan
- Menerima konten dari: semua pipeline kampanye (RE Campaign, Auto Pipeline, Pillar, Video Studio, dll.).
- Mengirim ke: Repliz API (Instagram, TikTok, Facebook, YouTube, Threads, dll.).
- Perintah MCP: `cf_list_content_flow`, `cf_sync_content_flow`, `cf_list_publishing_accounts`, `cf_create_publishing_job`, `cf_publish_storyboard`, `cf_retry_publishing_job`, `cf_cancel_publishing_job`, `cf_list_publishing_jobs`.

## Lokasi (untuk agent)
- Halaman: `app/content-flow/page.js`, `app/content-flow/ContentFlowAnalytics.js`, `app/content-flow/PublishingScheduler.js`
- API: `app/api/v2/contentflow-studio/` (assets, batches, calendar, slots)
- Logika inti: `lib/contentflow-repository.js`, `lib/contentflow-ingest.js`, `lib/contentflow-studio-adapters.js`, `lib/contentflow-reporting.js`

## Aturan penting & jebakan
1. Dokumen `sot/menus/contentflow-studio.md` kemungkinan milik halaman **lama** (`/contentflow-studio`), bukan `/content-flow` yang sekarang aktif — perlu dicek kecocokannya.
2. Status slot: `draft` → `scheduled` → `published` / `failed`. Slot `failed` bisa di-retry.
3. Akun publishing harus sudah terhubung di Settings sebelum bisa menjadwalkan.

## Belum ada / batasan
- Kalender belum menampilkan konten dari platform lain yang posting manual (hanya yang lewat sistem ini).

## Dokumen lengkap
`sot/menus/contentflow-studio.md` — ⚠️ verifikasi apakah ini dokumen untuk `/content-flow` atau halaman lama.
