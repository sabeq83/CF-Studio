# Instruksi Antigravity: Uji Insight Facebook 2 Halaman (Hanya Membaca)

Tanggal: 16 Nov 2026 · Dari: Claude · Untuk: Antigravity
Bagian dari: [analitik_mingguan_implementation_plan.md](analitik_mingguan_implementation_plan.md) (Fase 0 + bagian 3A)

## Tujuan

Memastikan apakah data performa Facebook **Dapur Botani** dan **NutriBake ID** bisa diambil lewat:
- **A.** app Meta milik pengguna yang sudah terhubung ke CF Studio, dan
- **B.** Repliz (sebagai pembanding).

Ini **uji baca saja**. Hasilnya menentukan desain pengambil data analitik.

## ⛔ Batasan

- **Tidak mengubah** database, setting, akun, jadwal, atau kode aplikasi. Tidak membuat tabel. Tidak commit atau deploy.
- Skrip uji boleh dibuat di `scripts/test-meta-insights-readonly.mjs` dan **tidak di-commit** sebelum ada persetujuan.
- Jalankan di **server Staging Mac Mini** (`ssh masbenu@100.95.245.55`, folder `~/maknaflow-staging-atomic/current`), karena kunci enkripsi token ada di `.env.local` server. Schema DB: `staging`.
- **Jangan mencetak, menyimpan, atau menyalin token** (Meta maupun Repliz) ke konsol, file, atau laporan. Tampilkan hanya hasil (ada/tidak, angka, nama izin).
- Batasi panggilan API: maksimal ±40 panggilan total.

## Target

| Akun CF Studio (provider `meta`) | Page ID | Pasangan akun Repliz |
|---|---|---|
| `acc_facebook_1786756995700_b27da3` Dapur Botani | 1030799026791337 | `acc_repliz_facebook_1787150716394_6b7b8c` (Repliz `_id` 6a85a5db62caae1e04fe828f) |
| `acc_facebook_1786756995685_71ed15` NutriBake ID | 1071656722705640 | `acc_repliz_facebook_1787150716403_901b0a` (Repliz `_id` 6a85a5d862caae1e04fe8286) |

## Langkah

### A. App Meta (Graph API)

Gunakan `decryptSecret` (`lib/encrypted-secret.js`), `getGraphBaseUrl()`, dan `resolvePageAccessToken()` (`lib/meta-publisher.js`).

1. **Izin token:** cek jenis token (user/page) dan izinnya (`/me/permissions`, atau `/debug_token` bila app token tersedia). Catat ada/tidaknya `read_insights`, `pages_read_engagement`, `pages_show_list`, `pages_manage_posts`.
2. **Insight halaman 7 hari** (`/{page-id}/insights`, `period=day`). Coba metrik satu per satu dan catat mana yang berhasil dan mana yang error (beserta pesan errornya): `page_media_view`, `page_views_total`, `page_post_engagements`, `page_follows`, `page_daily_follows_unique`, `page_impressions_unique`.
3. **Ambil 3 posting Facebook terbaru per halaman** yang dipublish lewat Repliz, dari `staging.publishing_jobs` (status published, `external_post_id` terisi, akun = pasangan Repliz di atas).
4. Untuk tiap posting:
   - `/{post-id}?fields=id,created_time,permalink_url,shares,comments.summary(true).limit(0),reactions.summary(true).limit(0)`
   - `/{post-id}/insights` dengan metrik satu per satu: `post_media_view`, `post_total_media_view_unique`, `post_clicks`, `post_reactions_by_type_total`, `post_impressions_unique`
   - Bila posting berupa Reels/video: cari `video_id` (field `attachments` atau `object_id`), lalu `/{video-id}/video_insights`. Catat metrik yang tersedia, misalnya `blue_reels_play_count`, `post_video_avg_time_watched`, `post_video_view_time`.

### B. Repliz (pembanding)

5. `GET /public/account/{repliz_id}/statistic` → apakah `summary` terisi.
6. `GET /public/content/{external_post_id}/statistic?accountId={repliz_id}` untuk posting yang sama → status 200/404, apakah `insight` terisi.

## Laporan (kirim ke pengguna, bahasa sederhana)

1. **Kesimpulan satu kalimat per halaman:** "Bisa diambil lewat app Meta: ya/tidak" dan "Bisa lewat Repliz: ya/tidak".
2. **Tabel izin token app Meta:** izin yang ada dan yang kurang.
3. **Tabel metrik yang berhasil:** halaman, posting, dan Reels, beserta versi Graph yang dipakai.
4. **Satu video, dua sumber berdampingan:** views, jangkauan, klik, reaksi, komentar, share, durasi tonton (bila ada) dari app Meta vs Repliz.
5. **Kecocokan ID:** apakah `external_post_id` dari Repliz langsung bisa dipakai di Graph API.
6. **Bila gagal:** pesan error Meta apa adanya dan saran langkah yang harus dilakukan pengguna (mis. izin yang perlu dicentang di app).

Setelah melapor, **berhenti** dan tunggu arahan. Jangan lanjut ke Fase 1.
