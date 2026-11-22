# Laporan Uji Insight Facebook 2 Halaman (Hanya Membaca)

Tanggal: 22 November 2026  
Pelaksana: Antigravity  
Berdasarkan: [antigravity_uji_insight_2_halaman.md](../instruksi-agent/antigravity_uji_insight_2_halaman.md) (Bagian dari Fase 0 Implementation Plan Analitik Mingguan)  
Lingkungan Uji: Server Staging Mac Mini (`100.95.245.55`, `~/maknaflow-staging-atomic/current`, schema: `staging`)  
Skrip Diagnostik: `scripts/test-meta-insights-readonly.mjs` (Read-only, tanpa mutasi database/konfigurasi)

---

## 1. Kesimpulan Utama

* **Dapur Botani (Page ID: `1030799026791337`)**:
  * **Bisa diambil lewat App Meta (Graph API): YA.** Token terdaftar merupakan Page Access Token aktif dengan cakupan izin lengkap. Data insight halaman harian (7 hari), data insight posting, dan metrik penayangan Reels berhasil ditarik dengan angka riil.
  * **Bisa diambil lewat Repliz API: TIDAK.** Endpoint statistik akun dan statistik posting Repliz mengembalikan HTTP 200 tetapi data `summary` bernilai 0, `metrics` kosong, dan `insight` posting seluruhnya 0 karena akun Facebook di Repliz belum memiliki izin `read_insights`.
* **NutriBake ID (Page ID: `1071656722705640`)**:
  * **Bisa diambil lewat App Meta (Graph API): YA.** Data insight halaman harian, insight posting, hingga metrik video mendalam (play count Reels, rata-rata durasi tonton 11,36 detik, dan total waktu tonton 79,54 detik) berhasil ditarik secara akurat.
  * **Bisa diambil lewat Repliz API: TIDAK.** Sama seperti Dapur Botani, data statistik posting dan summary akun di Repliz bernilai 0 karena keterbatasan izin di sisi Repliz.

---

## 2. Tabel Izin Token App Meta (Graph API)

Pemeriksaan token pada database `staging.publishing_accounts` (`token_ciphertext`) menunjukkan token berjenis **Page Access Token** (`type: PAGE`, aplikasi `ContentFlow` dengan `app_id: 1028433602978235`). Hasil inspeksi endpoint `/debug_token`:

| Nama Izin (Scope) | Dapur Botani | NutriBake ID | Keterangan / Fungsi |
|---|---|---|---|
| `read_insights` | **ADA (Granted)** | **ADA (Granted)** | Membaca analitik performa halaman, posting, dan media video |
| `pages_read_engagement` | **ADA (Granted)** | **ADA (Granted)** | Membaca data keterlibatan konten, reaksi, dan interaksi |
| `pages_show_list` | **ADA (Granted)** | **ADA (Granted)** | Menampilkan dan memverifikasi daftar halaman |
| `pages_manage_posts` | **ADA (Granted)** | **ADA (Granted)** | Akses operasional postingan halaman |
| `pages_read_user_content` | **ADA (Granted)** | **ADA (Granted)** | Membaca konten kiriman pada halaman |
| `pages_manage_engagement` | **ADA (Granted)** | **ADA (Granted)** | Mengelola keterlibatan dan interaksi halaman |
| `instagram_basic` | **ADA (Granted)** | **ADA (Granted)** | Akses baca dasar akun Instagram terkait |
| `instagram_content_publish` | **ADA (Granted)** | **ADA (Granted)** | Akses publikasi konten Instagram terkait |
| `public_profile` | **ADA (Granted)** | **ADA (Granted)** | Profil publik dasar pengguna pengelola |

> **Evaluasi Izin yang Kurang**: **TIDAK ADA**. Semua izin yang dibutuhkan untuk mengambil analitik Facebook telah 100% aktif dan terotorisasi pada token App Meta milik pengguna.

---

## 3. Tabel Metrik yang Berhasil Diambil

* **Versi Graph API**: `v25.0`
* **Base URL**: `https://graph.facebook.com/v25.0`

| Tingkatan Objek | Endpoint & Metrik | Dapur Botani (Sampel Data Riil) | NutriBake ID (Sampel Data Riil) | Status Hasil |
|---|---|---|---|---|
| **Halaman (7 Hari)** | `page_media_view` | 1.190 tayangan media | 7.721 tayangan media | **Berhasil** |
| | `page_views_total` | 19 profil dilihat | 52 profil dilihat | **Berhasil** |
| | `page_post_engagements` | 18 keterlibatan posting | 192 keterlibatan posting | **Berhasil** |
| | `page_follows` | 28.653 total pengikut | 54.095 total pengikut | **Berhasil** |
| | `page_daily_follows_unique` | 1 pengikut baru harian | 41 pengikut baru harian | **Berhasil** |
| | `page_impressions_unique` | Data null (digantikan `page_media_view`) | Data null (digantikan `page_media_view`) | Respons HTTP 200 |
| **Postingan** | `post_media_view` | 18 tayangan | 9 tayangan | **Berhasil** |
| | `post_total_media_view_unique` | 0 pemirsa unik | 7 pemirsa unik | **Berhasil** |
| | `post_clicks` | 0 klik (Post 1), 1 klik (Post 2) | 0 klik | **Berhasil** |
| | `post_reactions_by_type_total`| `{}` (0 reaksi) | `{}` (0 reaksi) | **Berhasil** |
| | Field dasar (`reactions`, `comments`, `shares`) | Reaksi: 2 (Post 2), Komentar: 0, Share: 0 | Reaksi: 0, Komentar: 0, Share: 0 | **Berhasil** |
| **Reels / Video** | `blue_reels_play_count` | 17 putaran Reels | 7 putaran Reels | **Berhasil** |
| (`/{video-id}/video_insights`) | `post_video_avg_time_watched` | 0 ms | 11.362 ms (11,36 detik) | **Berhasil** |
| | `post_video_view_time` | 0 ms | 79.540 ms (79,54 detik) | **Berhasil** |

---

## 4. Perbandingan Langsung: Satu Video, Dua Sumber

* **Sampel Video**: NutriBake ID (Post 1 terbitan Repliz)
* **ID Postingan**: `1071656722705640_122119074963328298`
* **ID Reel / Video**: `1118944667637584`
* **Tautan Konten**: `https://www.facebook.com/reel/1118944667637584/`

| Parameter Metrik | Sumber A: App Meta (Graph API v25.0) | Sumber B: Repliz API | Keterangan |
|---|---|---|---|
| **Views / Tayangan** | **9** (media views) / **7** (reels plays) | 0 | Meta menyediakan angka riil penayangan |
| **Jangkauan (Reach / Unique Viewers)** | **7** pemirsa unik | 0 | Meta menyediakan jumlah orang unik yang menonton |
| **Klik** | 0 klik | 0 | Sama (belum ada klik pada postingan ini) |
| **Reaksi** | 0 reaksi | 0 | Sama |
| **Komentar** | 0 komentar | 0 | Sama |
| **Share** | 0 share | 0 | Sama |
| **Rata-rata Durasi Tonton** | **11,36 detik** (11.362 ms) | *Tidak tersedia* | Data eksklusif dari endpoint Graph API Meta |
| **Total Waktu Tonton** | **79,54 detik** (79.540 ms) | *Tidak tersedia* | Data eksklusif dari endpoint Graph API Meta |

---

## 5. Kecocokan ID Postingan

1. **Format ID dari Repliz**:
   * Pada data hasil publikasi Repliz, field `provider_state_json.postId` memiliki format gabungan `{page_id}_{post_id}` (contoh: `1030799026791337_122115671564434371` dan `1071656722705640_122119074963328298`).
2. **Kecocokan dengan Graph API Meta**:
   * Format `{page_id}_{post_id}` **langsung valid dan berfungsi 100%** saat dipanggil ke Graph API `GET /{page_id}_{post_id}` maupun `GET /{page_id}_{post_id}/insights`.
3. **Kecocokan dengan Repliz Content API**:
   * Format `{page_id}_{post_id}` juga merupakan ID yang diterima oleh endpoint Repliz `GET /public/content/{id}/statistic?accountId=...` dan mengembalikan HTTP 200.
4. **Catatan Teknis Database**:
   * Di tabel `staging.publishing_jobs`, kolom `external_post_id` saat ini terisi `NULL` untuk pekerjaan yang dipublish via Repliz, tetapi ID riil tersimpan aman di `provider_state_json->>'postId'`.
   * Pada implementasi agregator analitik mendatang, query data posting wajib menggunakan ekspresi: `COALESCE(external_post_id, provider_state_json->>'postId')`.

---

## 6. Temuan Teknis & Catatan Penanganan Error

1. **Edge `/me/permissions`**:
   * Panggilan `GET /me/permissions` mengembalikan `(#100) Tried accessing nonexisting field (permissions)`.
   * *Penjelasan*: Edge `/permissions` hanya berlaku untuk User node (`/{user-id}/permissions`). Karena token yang tersimpan di sistem adalah Page Access Token, pemeriksaan izin wajib menggunakan endpoint `GET /debug_token?input_token={token}&access_token={token}`.
2. **Field `tasks` pada Page**:
   * Panggilan `GET /{page-id}?fields=tasks` mengembalikan `(#100) Tried accessing nonexisting field (tasks)`.
   * *Penjelasan*: Pada Graph API v25.0, field `tasks` hanya dapat dilihat saat memanggil `/me/accounts` menggunakan User Access Token.
3. **Field `attachments` pada Postingan**:
   * Panggilan `GET /{post-id}?fields=attachments` mengembalikan `(#12) deprecate_post_aggregated_fields_for_attachement is deprecated for versions v3.3 and higher`.
   * *Solusi*: ID Video/Reel dapat diekstrak secara konsisten dari permalink postingan (pola `/reel/{video_id}`) atau field `object_id`. Setelah ID didapat, pemanggilan `GET /{video-id}/video_insights` berjalan mulus.
4. **Kondisi Repliz**:
   * Repliz mengembalikan HTTP 200 dengan nilai metrik nol karena akun halaman Facebook di Repliz belum mendapatkan izin `read_insights` (masalah reconnect Facebook di sisi Repliz).
   * *Kesimpulan Arsitektur*: Mengambil data Facebook langsung melalui **App Meta milik pengguna (Graph API)** adalah solusi paling tepat dan kokoh, sedangkan platform lainnya (TikTok, Instagram, YouTube, Threads) tetap menggunakan Repliz.

---

*Laporan selesai disusun. Pengujian berjalan murni secara baca (read-only) tanpa mengubah konfigurasi sistem.*
