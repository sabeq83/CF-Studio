# Kartu Menu: Performa Konten

Terakhir dicek: 22 November 2026 &bull; Versi aplikasi: Gelombang 1 (`fitur/analitik-performa`)
Alamat: `/performance` &bull; Kelompok: PUBLISHING &bull; Kunci izin menu: `content_flow`

## Fungsi
Pusat analitik dan pelaporan performa konten multi-platform. Menampilkan statistik harian akun dan video postingan yang dihasilkan oleh CF Studio dan dipublikasikan ke media sosial, membandingkan performa antar-pekan, serta menghitung skor keterlibatan untuk mengidentifikasi video yang menang atau lemah.

## Cakupan Platform Gelombang 1
- **Facebook**: Diambil langsung via App Meta (Graph API v25.0) untuk halaman yang ditautkan (Dapur Botani & NutriBake ID). Mengambil metrik halaman harian (views, reach, follows) dan penayangan Reels/video.
- **Instagram, TikTok, YouTube, Threads**: Diambil via Repliz API (Paket Gold) yang menyediakan metrik riil lengkap (views, reach, interaksi, retensi, durasi tonton rata-rata, dan skip rate).

## Alur Pakai
1. Buka menu **Performa Konten** di sidebar navigation kelompok **PUBLISHING**.
2. Gunakan filter rentang pekan (7d, 14d, 30d), brand, jenis video, atau platform.
3. Amati kartu ringkasan (Views, Reach, Interaksi, Pengikut Baru) beserta persentase pertumbuhannya vs periode sebelumnya.
4. Tinjau peringkat video di tabel performa: amati skor keterlibatan, durasi tonton, dan label status (`🏆 Menang`, `Standar`, `⏳ Belum Matang <72j`).
5. Klik tombol **Ambil Data Sekarang** untuk memicu pengumpulan metrik terbaru secara manual jika diperlukan.

## Terhubung Dengan
- Database: tabel `account_metric_daily`, `post_metric_snapshots`, dan kolom `publishing_accounts.insights_status`.
- API Server:
  - `GET /api/v2/analytics/accounts`: agregat metrik akun dan pertumbuhan.
  - `GET /api/v2/analytics/posts`: daftar performa video dan skor keterlibatan.
  - `GET /api/v2/analytics/health`: status koneksi kredensial dan akun publishing.
  - `POST /api/v2/analytics/collect`: trigger pengumpulan metrik manual.
- Scheduler: `lib/campaign-scheduler.js` (pengambil harian berkala jam 03:00 WIB, default saklar MATI).
- Perintah MCP: `cf_get_account_metrics`, `cf_get_post_metrics`, `cf_collect_metrics_now`.

## Lokasi (untuk Agent)
- Halaman: `app/performance/page.js`
- Modul Inti: `lib/meta-insights-client.js`, `lib/repliz-metrics-normalizer.js`, `lib/metrics-collector.js`
- Mockup Acuan: `public/mockup_analitik_performa.html`

## Aturan Penting & Jebakan
1. Halaman Facebook tanpa Page Token di App Meta akan berstatus `Perlu Ditautkan` (bukan angka 0 palsu).
2. Data Repliz menerapkan aturan nol mencurigakan (K3): jika video > 24 jam bernilai 0 di seluruh metrik, disimpan sebagai NULL dengan status `insight_available = false`.
3. Durasi tonton selalu dinormalisasi ke satuan detik (K8).
