# Instruksi Antigravity: Uji Insight Instagram 2 Akun (Hanya Membaca)

Tanggal: 22 Nov 2026 · Dari: Claude · Untuk: Antigravity
Lanjutan dari: [LAPORAN_UJI_INSIGHT_FACEBOOK_2_HALAMAN.md](../laporan/LAPORAN_UJI_INSIGHT_FACEBOOK_2_HALAMAN.md)
Bagian dari: `analitik_mingguan_implementation_plan.md` (Fase 0, bagian 3A)

## Tujuan

Memastikan apakah statistik Instagram **@dapur_botani** dan **@nutribake_id** bisa diambil lewat:
- **A.** App Meta milik pengguna (Instagram Graph API, memakai token halaman Facebook yang tertaut), dan
- **B.** Repliz (pembanding).

Hasilnya menentukan apakah Instagram ikut jalur Meta atau tetap lewat Repliz.

## Batasan (sama seperti uji Facebook)

- **Hanya membaca.** Tidak mengubah database, setting, akun, jadwal, atau kode aplikasi. Tidak commit, tidak deploy.
- Skrip uji boleh dibuat di `scripts/test-meta-insights-readonly.mjs` (tambahkan bagian Instagram) dan tidak di-commit sebelum ada persetujuan.
- Jalankan di server Staging Mac Mini (schema `staging`).
- **Jangan mencetak atau menyimpan token** (Meta maupun Repliz).
- Maksimal ±40 panggilan API.

## Target

| Akun | IG user ID | Halaman FB tertaut | Akun CF Studio (provider `meta`) | Akun Repliz (`_id`) |
|---|---|---|---|---|
| @dapur_botani | 17841439243921276 | 1030799026791337 | `acc_instagram_1786756995708_7d6d9e` | `acc_repliz_instagram_1787150716369_f10af8` (6a85a5f962caae1e04fe8301) |
| @nutribake_id | 17841479686815774 | 1071656722705640 | `acc_instagram_1786756995693_d72e37` | `acc_repliz_instagram_1787150716356_3747ac` (6a85ad8a62caae1e04fe975e) |

## Langkah

### A. Instagram lewat Meta Graph API (v25.0)

1. **Cek izin yang kurang (paling penting).** Laporan Facebook mencantumkan `instagram_basic` dan `instagram_content_publish`, tetapi **tidak** mencantumkan `instagram_manage_insights`, izin yang umumnya diperlukan untuk statistik Instagram. Lewat `/debug_token`, catat apakah `instagram_manage_insights` ada atau tidak, dan apakah daftar izin lain ada yang terlewat di laporan sebelumnya.
2. **Profil akun:** `GET /{ig-user-id}?fields=username,followers_count,follows_count,media_count`.
3. **Insight akun 7 hari** (`GET /{ig-user-id}/insights`). Coba satu metrik per panggilan dan catat berhasil/gagal beserta pesan error Meta apa adanya:
   - `reach`, `views`, `accounts_engaged`, `total_interactions` dengan `period=day&metric_type=total_value&since=&until=`
   - `follower_count` dengan `period=day`
4. **Daftar media:** `GET /{ig-user-id}/media?fields=id,media_product_type,permalink,timestamp,like_count,comments_count&limit=15`.
   - Pilih 3 Reels terbaru per akun. Utamakan yang tayang lewat Repliz (cocokkan permalink/waktu dengan `staging.publishing_jobs`, platform instagram, status published).
   - Catat bagaimana ID posting Instagram dari Repliz (`provider_state_json->>'postId'` atau `external_post_id`) dibandingkan dengan `media id` Graph. Apakah langsung sama, atau perlu pencocokan lewat permalink/waktu?
5. **Insight tiap media** (`GET /{media-id}/insights`), satu metrik per panggilan:
   - `views`, `reach`, `saved`, `shares`, `likes`, `comments`, `total_interactions`
   - khusus Reels: `ig_reels_avg_watch_time`, `ig_reels_video_view_total_time`
   - Catat metrik mana yang berhasil dan mana yang ditolak untuk tipe media tersebut.

### B. Instagram lewat Repliz (pembanding)

6. `GET /public/account/{repliz_id}/statistic` → catat apakah angka terisi (followers, total 30 hari, `metrics` harian) atau semuanya 0 seperti pada Facebook.
7. `GET /public/content?accountId={repliz_id}` satu halaman → catat format `id` Instagram.
8. `GET /public/content/{id}/statistic?accountId={repliz_id}` untuk 3 Reels yang sama → catat `views`, `reach`, `saved`, `share`, `averageWatchTime`, `watchTime`, `skipRate`, dan apakah nilainya riil atau semuanya 0.

## Laporan (simpan di `catatan-kerja/laporan/LAPORAN_UJI_INSIGHT_INSTAGRAM.md`, bahasa sederhana)

1. **Kesimpulan satu kalimat per akun:** "Bisa lewat app Meta: ya/tidak" dan "Bisa lewat Repliz: ya/tidak".
2. **Izin:** ada tidaknya `instagram_manage_insights`. Bila tidak ada, tulis persis apa yang harus dilakukan pengguna (izin apa ditambahkan di mana, apakah token halaman harus dibuat ulang) **tanpa mengubah apa pun sendiri**.
3. **Tabel metrik** yang berhasil dan yang ditolak, untuk akun dan untuk Reels.
4. **Satu Reels, dua sumber berdampingan:** views, jangkauan, simpan, share, like, komentar, durasi tonton rata-rata, durasi tonton total, skip rate.
5. **Kecocokan ID** posting Instagram antara data Repliz dan Graph API.
6. **Rekomendasi sumber Instagram:** Meta, Repliz, atau gabungan, berikut alasannya.

Setelah melapor, **berhenti** dan tunggu arahan. Jangan lanjut ke Fase 1.
