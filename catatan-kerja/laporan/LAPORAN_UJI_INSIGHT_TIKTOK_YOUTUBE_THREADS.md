# Laporan Uji Insight TikTok, YouTube, dan Threads via Repliz API (Hanya Membaca)

Tanggal: 22 November 2026  
Pelaksana: Antigravity  
Berdasarkan: [antigravity_analitik_mingguan_instructions.md](../instruksi-agent/antigravity_analitik_mingguan_instructions.md) (Persiapan Fase 1 Analitik Mingguan)  
Lingkungan Uji: Server Staging Mac Mini (`100.95.245.55`, `~/maknaflow-staging-atomic/current`, schema: `staging`)  
Kredensial: Repliz API Paket Gold (dibaca dari `staging.tenant_settings` via `decryptSecret`, tanpa kebocoran secret)

---

## 1. Ringkasan Hasil

Pengujian baca (*read-only*) statistik akun dan statistik postingan untuk platform TikTok, YouTube, dan Threads melalui Repliz API berhasil dilaksanakan dengan data riil:

* **TikTok**: **BERHASIL**. Data metrik akun terisi (4.043 followers, 19.228 likes, 653 video). Data metrik postingan video menyajikan informasi mendalam: tayangan (views), likes, favorit (saves), rata-rata durasi tonton (13,21 detik), tingkat tonton penuh (*full watched rate* 29,17%), kurva retensi per detik, serta sumber penayangan (91,6% dari FYP).
* **YouTube**: **BERHASIL**. Data statistik akun 30 hari terisi (80 subscribers, 70.063 total views, summary 51.648 views, 7.065 menit tonton). Data posting video mencakup penayangan (views), likes, komentar, dan metrik penonton.
* **Threads**: **BERHASIL**. Data statistik akun terisi (22 followers, 23 total views dengan grafik per hari). Data posting menyajikan jumlah penayangan (views: 10) dan balasan (replies: 1).

Semua data statistik pada ketiga platform ini berstatus aktif dan siap dinormalisasi oleh `lib/repliz-metrics-normalizer.js`.

---

## 2. Rincian Metrik per Platform

### A. TikTok (Sampel Akun: NutriBake ID - `6a85a58462caae1e04fe81a0`)

* **Statistik Akun (`GET /public/account/{id}/statistic`)**:
  * `followersCount`: 4.043
  * `totalLikes`: 19.228
  * `videosCount`: 653
  * `metrics`: Aktivitas penonton berdasarkan jam (`audienceActivity`), klik alamat, dan unduhan aplikasi.
* **Statistik Konten Video (`GET /public/content/{id}/statistic`)**:
  * Contoh Konten: Video ID `7710834251222207765`
  * `views`: 42 tayangan
  * `like`: 3 suka
  * `favourite` (saves): 1 simpanan
  * `watched`: 634 detik total tonton
  * `averageWatched`: 13,21 detik
  * `fullWatchedRate`: 0,2917 (29,17% selesai tonton)
  * `retention`: Array retensi detik ke-0 (100%) hingga detik ke-23 (31%)
  * `impressionSources`: For You (91,6%), Personal Profile (6,3%), Others (2,1%)
  * `audienceTypes`: Penonton baru vs pengikut (46% pengikut, 54% non-pengikut)

### B. YouTube (Sampel Akun: NutriBake ID - `6ad077c062caae1e047c1ecd`)

* **Statistik Akun (`GET /public/account/{id}/statistic`)**:
  * `subscribersCount`: 80
  * `viewsCount`: 70.063
  * `videosCount`: 89
  * `likesCount`: 561
  * `summary` 30 Hari: `views`: 51.648, `estimatedMinutesWatched`: 7.065, `averageViewDuration`: 18 detik, `subscribersGained`: 63, `subscribersLost`: 6, `likes`: 419, `shares`: 29, `comments`: 3
  * `metrics`: Rincian harian penayangan dan menit tonton
* **Statistik Konten Video (`GET /public/content/{id}/statistic`)**:
  * Contoh Konten: Video ID `n9ZoKzexVjY` ("Selai Kacang Berminyak di Atas?")
  * `views`: 269
  * `like`: 1
  * `comment`: 0
  * `insight`: Rincian menit tonton dan sumber trafik harian

### C. Threads (Sampel Akun: NutriBake ID - `6af3032ffc43f81b78728090`)

* **Statistik Akun (`GET /public/account/{id}/statistic`)**:
  * `followersCount`: 22
  * `views.total`: 23
  * `views.graphs`: 30 hari data grafik penayangan harian
* **Statistik Konten (`GET /public/content/{id}/statistic`)**:
  * Contoh Konten: Post ID `18133486840835790`
  * `views`: 10
  * `replies`: 1
  * `like`: 0
  * `repost`: 0
  * `quotes`: 0

---

## 3. Catatan Integrasi untuk Normalizer (`lib/repliz-metrics-normalizer.js`)

1. **Pemetaan Kolom TikTok**:
   * Simpanan / bookmark: gunakan field `favourite`.
   * Durasi tonton rata-rata: gunakan `averageWatched` (sudah dalam satuan detik).
   * Tingkat selesai tonton: gunakan `fullWatchedRate` (angka desimal 0 - 1).
2. **Pemetaan Kolom YouTube**:
   * Penayangan: `views`.
   * Durasi tonton rata-rata: `insight.averageViewDuration` (satuan detik).
   * Persentase tonton rata-rata: `insight.averageViewPercentage`.
   * Menit tonton total: `insight.estimatedMinutesWatched`.
3. **Pemetaan Kolom Threads**:
   * Penayangan: `views` (pada postingan berupa angka, pada akun berupa objek `{ total, graphs }`).
   * Komentar / interaksi: `replies` dipetakan ke kolom `comments`.
   * Bagikan: `repost` + `share` dipetakan ke kolom `shares`.

---

*Laporan pengujian selesai. Sampel data nyata ini menjadi acuan spesifikasi unit test untuk `lib/repliz-metrics-normalizer.js`.*
