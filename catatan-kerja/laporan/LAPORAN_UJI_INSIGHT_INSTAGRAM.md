# Laporan Uji Insight Instagram 2 Akun (Hanya Membaca)

Tanggal: 22 November 2026  
Pelaksana: Antigravity  
Berdasarkan: [antigravity_uji_insight_instagram.md](../instruksi-agent/antigravity_uji_insight_instagram.md) (Lanjutan Fase 0 Bagian 3A Analitik Mingguan)  
Lingkungan Uji: Server Staging Mac Mini (`100.95.245.55`, `~/maknaflow-staging-atomic/current`, schema: `staging`)  
Skrip Diagnostik: `scripts/test-meta-insights-readonly.mjs` (Read-only, tanpa mutasi database/konfigurasi)

---

## 1. Kesimpulan Utama

* **@dapur_botani (IG User ID: `17841439243921276`, Repliz: `6a85a5f962caae1e04fe8301`)**:
  * **Bisa lewat App Meta: TIDAK** untuk insight (Profil akun dan daftar media bisa dibaca, namun seluruh endpoint insight akun dan media ditolak dengan error `(#10) Application does not have permission for this action` karena token belum memiliki izin `instagram_manage_insights`).
  * **Bisa lewat Repliz: YA** (Statistik akun 30 hari terisi riil, metrik performa Reels lengkap mencakup 968 views, 719 reach, 13 likes, 5 saves, rata-rata durasi tonton 8,4 detik, dan skip rate 39,4%).
* **@nutribake_id (IG User ID: `17841479686815774`, Repliz: `6a85ad8a62caae1e04fe975e`)**:
  * **Bisa lewat App Meta: TIDAK** untuk insight (Profil akun dan daftar media bisa dibaca, namun seluruh endpoint insight akun dan media ditolak dengan error `(#10)` karena tidak adanya izin `instagram_manage_insights`).
  * **Bisa lewat Repliz: YA** (Statistik akun 30 hari terisi riil dengan total 2.302 views, 1.418 reach, dan breakdown metrik harian 30 hari penuh).

---

## 2. Status Izin Token Meta & Panduan untuk Pengguna

Hasil inspeksi token via endpoint `/debug_token` pada token akun Instagram yang tersimpan di database (`staging.publishing_accounts`):

| Parameter Token | Hasil Diagnostik |
|---|---|
| **Tipe Token** | `PAGE` (Page Access Token halaman Facebook tertaut) |
| **Status Token** | `is_valid: true` (Aktif dan tidak kedaluwarsa) |
| **Aplikasi Meta** | `ContentFlow` (App ID: `1028433602978235`) |
| **Izin yang Ada** | `read_insights`, `pages_show_list`, `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`, `pages_read_user_content`, `pages_manage_posts`, `pages_manage_engagement`, `public_profile` |
| **Izin `instagram_manage_insights`** | **TIDAK ADA (False)** |

### Panduan Langkah untuk Pengguna (Jika Ingin Mengaktifkan Jalur Meta Instagram)

Karena izin `instagram_manage_insights` belum terdaftar pada token saat ini, jika pengguna ingin mengambil insight Instagram lewat Meta Graph API, langkah berikut perlu dilakukan secara manual oleh pengguna (tanpa mengubah kode atau database secara sepihak):

1. Buka portal developer Meta di `https://developers.facebook.com/apps/1028433602978235/` (Aplikasi `ContentFlow`).
2. Masuk ke menu **Use cases** atau **App Review > Permissions and Features**.
3. Tambahkan izin **`instagram_manage_insights`**. (Jika aplikasi berada dalam mode *Development*, izin ini dapat langsung digunakan oleh akun Admin/Developer/Tester aplikasi tanpa menunggu App Review resmi dari Meta).
4. Buat ulang token (re-authorize / login ulang) untuk halaman Facebook yang menaungi Instagram Dapur Botani dan NutriBake ID, pastikan opsi wawasan Instagram dicentang.
5. Perbarui token baru tersebut di menu Settings / Publishing Accounts CF Studio.

---

## 3. Tabel Metrik yang Berhasil dan Ditolak

* **Versi Graph API**: `v25.0`
* **Base URL**: `https://graph.facebook.com/v25.0`

### A. Level Profil & Akun

| Sumber Data | Endpoint & Metrik | @dapur_botani | @nutribake_id | Status & Catatan |
|---|---|---|---|---|
| **Meta Graph API** | Profil Akun (`followers_count`, `media_count`) | 21.899 followers, 583 media | 37 followers, 558 media | **Berhasil** (HTTP 200) |
| **Meta Graph API** | `GET /{ig-id}/insights?metric=reach` | Error (#10) | Error (#10) | **Ditolak** (Butuh `instagram_manage_insights`) |
| **Meta Graph API** | `GET /{ig-id}/insights?metric=views` | Error (#10) | Error (#10) | **Ditolak** (Butuh `instagram_manage_insights`) |
| **Meta Graph API** | `GET /{ig-id}/insights?metric=accounts_engaged` | Error (#10) | Error (#10) | **Ditolak** (Butuh `instagram_manage_insights`) |
| **Meta Graph API** | `GET /{ig-id}/insights?metric=total_interactions` | Error (#10) | Error (#10) | **Ditolak** (Butuh `instagram_manage_insights`) |
| **Meta Graph API** | `GET /{ig-id}/insights?metric=follower_count` | Error (#10) | Error (#10) | **Ditolak** (Butuh `instagram_manage_insights`) |
| **Repliz API** | Ringkasan Akun 30 Hari | Followers: 21.899 | 2.302 views, 1.418 reach, 57 interaksi | **Berhasil** (HTTP 200) |
| **Repliz API** | `metrics` Harian Akun | 30 hari data reach | 30 hari data reach | **Berhasil** (HTTP 200) |

### B. Level Konten / Reels

| Sumber Data | Endpoint & Metrik | Hasil Dapur Botani | Hasil NutriBake ID | Status & Catatan |
|---|---|---|---|---|
| **Meta Graph API** | `GET /{ig-id}/media` (Daftar posting) | 15 media ditemukan | 15 media ditemukan | **Berhasil** (HTTP 200) |
| **Meta Graph API** | Field dasar posting (`like_count`, `comments_count`) | Terisi angka riil | Terisi angka riil | **Berhasil** (HTTP 200) |
| **Meta Graph API** | `GET /{media-id}/insights?metric=views` | Error (#10) | Error (#10) | **Ditolak** (Butuh `instagram_manage_insights`) |
| **Meta Graph API** | `GET /{media-id}/insights?metric=reach` | Error (#10) | Error (#10) | **Ditolak** (Butuh `instagram_manage_insights`) |
| **Meta Graph API** | `GET /{media-id}/insights?metric=saved,shares` | Error (#10) | Error (#10) | **Ditolak** (Butuh `instagram_manage_insights`) |
| **Meta Graph API** | `GET /{media-id}/insights?metric=ig_reels_avg_watch_time` | Error (#10) | Error (#10) | **Ditolak** (Butuh `instagram_manage_insights`) |
| **Meta Graph API** | `GET /{media-id}/insights?metric=ig_reels_video_view_total_time` | Error (#10) | Error (#10) | **Ditolak** (Butuh `instagram_manage_insights`) |
| **Repliz API** | `GET /public/content/{id}/statistic` | **Lengkap** (77-968 views) | **Lengkap** (Terisi data riil) | **Berhasil** (HTTP 200) |

---

## 4. Perbandingan Langsung: Satu Reels, Dua Sumber

* **Sampel Reels**: Dapur Botani (Post terbitan Repliz 21 Nov 2026)
* **ID Media Instagram**: `18158957920522388`
* **Tautan Konten**: `https://www.instagram.com/reel/DgBYjLGlIf_/`
* **Judul / Topik**: Premix Cocoa Powder Premium ("Stop minum boba malam-malam!")

| Parameter Metrik | Sumber A: Meta Graph API (v25.0) | Sumber B: Repliz API | Keterangan Evaluasi |
|---|---|---|---|
| **Views / Tayangan** | *Ditolak Error (#10)* | **968** tayangan | Repliz menyajikan data penayangan riil |
| **Jangkauan (Reach)** | *Ditolak Error (#10)* | **719** akun unik | Repliz menyajikan jumlah akun terjangkau |
| **Simpan (Saves)** | *Ditolak Error (#10)* | **5** kali disimpan | Repliz menyajikan data simpanan |
| **Share (Bagikan)** | *Ditolak Error (#10)* | **3** kali dibagikan | Repliz menyajikan data share |
| **Like** | 13 suka (via field media) | **13** suka | Data identik antara Meta dan Repliz |
| **Komentar** | 2 komentar (via field media) | **2** komentar | Data identik antara Meta dan Repliz |
| **Rata-rata Durasi Tonton** | *Ditolak Error (#10)* | **8,4 detik** | Disediakan oleh Repliz (`averageWatchTime`) |
| **Total Waktu Tonton** | *Ditolak Error (#10)* | **6.215 detik** (103,5 menit) | Disediakan oleh Repliz (`watchTime`) |
| **Skip Rate** | *Tidak ada metrik bawaan* | **39,4%** | Disediakan oleh Repliz (`skipRate`) |

---

## 5. Kecocokan ID Posting Instagram

1. **Format ID di Database CF Studio**:
   * Pada data `staging.publishing_jobs` yang dipublish lewat Repliz, field `provider_state_json->>'postId'` berisi ID angka murni (contoh: `18158957920522388` dan `18111897689524522`).
2. **Kecocokan dengan Meta Graph API**:
   * ID angka tersebut adalah **Instagram Media ID resmi yang sama persis** dengan yang dikembalikan oleh Meta Graph API pada endpoint `GET /{ig-user-id}/media`.
3. **Kecocokan dengan Repliz API**:
   * ID angka tersebut juga **sama persis** dengan field `id` pada daftar konten Repliz (`GET /public/content?accountId=...`) dan langsung diterima oleh endpoint statistik Repliz (`GET /public/content/{id}/statistic?accountId=...`).
4. **Kesimpulan**:
   * Kecocokan ID posting Instagram adalah **100% identik dan konsisten** di seluruh sistem tanpa memerlukan konversi atau pemetaan rumit.

---

## 6. Rekomendasi Sumber Analitik Instagram

### Rekomendasi: Gunakan REPLIZ untuk Instagram

**Alasan Utama**:
1. **Repliz Berfungsi 100% Siap Pakai untuk Instagram**:
   * Berbeda dengan Facebook di mana Repliz terhambat izin sehingga harus dialihkan ke Meta Graph API, untuk Instagram integrasi Repliz **sudah sangat matang dan aktif sempurna**.
   * Repliz mampu menyajikan metrik akun 30 hari lengkap beserta metrik video mendalam (views, reach, likes, comments, shares, saves, average watch time, total watch time, dan skip rate).
2. **Tidak Memerlukan Reconnect atau Pengubahan Konfigurasi Meta App**:
   * Menggunakan Repliz untuk Instagram tidak memerlukan penambahan izin `instagram_manage_insights` pada App Meta pengguna, sehingga pengembang dan pengguna tidak perlu melakukan login ulang token atau penyesuaian izin di Facebook Developer Portal saat ini.
3. **Arsitektur Hibrida yang Optimal**:
   * **Facebook**: Menggunakan **App Meta (Graph API)** milik pengguna karena izin Meta App pengguna untuk Facebook sudah lengkap, sedangkan Repliz Facebook terkendala.
   * **Instagram**: Menggunakan **Repliz API** karena izin Repliz untuk Instagram sudah lengkap, sedangkan Meta App pengguna untuk Instagram belum memiliki `instagram_manage_insights`.
   * **Platform Lain** (TikTok, YouTube, Threads): Tetap menggunakan **Repliz API**.
4. **Peluang Masa Depan Tanpa Risiko**:
   * Karena ID posting Instagram di Repliz dan Meta Graph API sama persis (`181589579...`), jika di kemudian hari pengguna menambahkan izin `instagram_manage_insights` pada App Meta, sistem dapat dengan mudah membaca data dari kedua sumber tanpa hambatan format ID.

---

*Laporan pengujian selesai disusun secara objektif dan akurat berdasarkan data eksekusi riil di server Staging.*
