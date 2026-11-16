# Instruksi Antigravity: Analitik Performa Konten via Repliz

Tanggal: 16 Nov 2026 · Dari: Claude (reviewer/planner) · Untuk: Antigravity (eksekutor)

Rencana lengkap, desain tabel, dan potongan kode sebelum/sesudah ada di
**[analitik_mingguan_implementation_plan.md](analitik_mingguan_implementation_plan.md)**. Baca seluruhnya sebelum mulai.
Latar belakang: [USULAN_ANALITIK_MINGGUAN_CFA.md](USULAN_ANALITIK_MINGGUAN_CFA.md) (v2.1). Paket Repliz pengguna: **Gold**.
Referensi API resmi: `https://api.repliz.com/public-json`.

---

## Bagian Anda

Anda mengerjakan **Fase 0–5 dan 7** (web app CF Studio). **Fase 6** (skrip `cfa_analitik.py` dan skill `cfa-analitik` di `~/cf-autopipeline`) dikerjakan Claude. Jangan mengubah folder `~/cf-autopipeline` atau `~/.claude/skills`.

## ⛔ Dua titik berhenti

1. **Setelah Fase 0 (uji baca API):** laporkan hasil ke pengguna. Kalau ID posting di `publishing_jobs.external_post_id` **tidak cocok** dengan `contentId` Repliz (statistik posting 404), **berhenti** dan tunggu arahan. Kalau cocok, boleh lanjut ke Fase 1.
2. **Sebelum coding UI (Fase 5):** buat mockup `public/mockup_analitik_performa.html`, deploy ke Staging, kirim link, **berhenti** sampai pengguna menyetujui di chat.

Setiap tahap selesai, ubah `- [ ]` menjadi `- [x]` di **Execution Task List** pada file rencana.

---

## Fase 0: Uji baca API (hanya membaca, tidak menulis DB)

- Buat `scripts/test-repliz-analytics-readonly.mjs`. Kunci Repliz dibaca dari `tenant_settings`/env lewat helper yang ada. **Jangan mencetak kunci** ke log/konsol.
- Untuk setiap tenant yang punya akun Repliz:
  - `GET /public/account/{id}/statistic` untuk akun Facebook → catat `summary` terisi atau null.
  - Ambil 3 `publishing_jobs` berstatus published terbaru → `GET /public/content/{external_post_id}/statistic?accountId={provider_account_id}` → catat 200/404 dan apakah `insight` terisi.
  - `GET /public/content?accountId=` satu halaman → bandingkan format `id` dengan `external_post_id`.
- **Uji jalur app Meta milik pengguna** (bagian 3A rencana). Reconnect di Repliz gagal karena error izin `pages_read_engagement`, jadi Facebook kemungkinan akan diambil dari app Meta yang sudah terhubung ke CF Studio:
  - Jalankan di **server Staging** (token didekripsi dengan `decryptSecret` di sana, karena kunci enkripsi ada di `.env` server). **Jangan mencetak atau menyalin token.**
  - Akun target: `acc_facebook_1786756995700_b27da3` (Dapur Botani, page 1030799026791337) dan `acc_facebook_1786756995685_71ed15` (NutriBake ID, page 1071656722705640).
  - Cek izin token (`read_insights`, `pages_read_engagement`), panggil insight halaman 7 hari, lalu insight 3 posting Facebook yang dipublish lewat Repliz (`external_post_id`), termasuk `video_insights` untuk Reels.
  - Catat nama metrik yang benar-benar berhasil di versi Graph yang dipakai.
- Laporan ke pengguna dalam bahasa sederhana:
  - Daftar halaman Facebook yang **perlu reconnect di Repliz** (summary/insight null).
  - Apakah ID posting cocok.
  - Contoh angka 1 video (views, jangkauan, klik, reaksi, komentar, share) dari **Repliz dan dari app Meta**, berdampingan.
  - Apakah token app Meta punya izin insight. Kalau tidak, sebutkan izin mana yang kurang.

## Fase 1–4: Data, pengambil harian, API & MCP

Ikuti bagian 4–5 dan Execution Task List di file rencana. Poin wajib:

- **Kode baru di file baru** (`lib/repliz-metrics-normalizer.js`, `lib/repliz-metrics-collector.js`). Perubahan di `lib/repliz-client.js` dan `lib/campaign-scheduler.js` hanya **menambah**, tidak mengubah fungsi yang ada.
- **Migrasi idempoten** untuk schema `dev`, `staging`, `public`. Build tetap `DISABLE_AUTO_MIGRATIONS=true` sesuai SOP. Daftarkan tabel baru di isolasi tenant.
- **Pengambil harian default MATI** (`analytics_collector_active` = off). Pengguna yang menyalakan setelah review.
- **Hemat panggilan:** jeda ±300 ms, maks 400 panggilan statistik per jalan, backoff untuk 429/5xx. Ambil per tag sekali saja (`h24`, `h72`, `d7`) + `latest`.
- **Angka kosong tetap kosong (null)**, jangan diisi 0 atau ditebak. `insight` Facebook null → `insight_available=false` dan akun ditandai `needs_reconnect`.
- **Kredensial per tenant:** pakai kunci tenant itu sendiri. Error per akun dicatat dan tidak menghentikan akun lain. Pesan error melewati `redactCredentials`.
- **Upsert** agar menjalankan ulang tidak membuat baris dobel (Meta bisa merevisi angka beberapa hari).
- Tool MCP baru: `cf_get_account_metrics`, `cf_get_post_metrics`, `cf_collect_metrics_now`.
- Uji di **Dev** dulu (schema `dev`), lalu isi data awal di **Staging** (Fase 4) dengan collect manual.

## Fase 5: UI (mockup dulu)

Mockup `public/mockup_analitik_performa.html`:
- **Standalone:** CSS/JS inline, token desain sendiri di `:root`, light & dark, rapi bila dibuka lokal. Data contoh **fiktif dan netral** (bukan angka atau nama halaman asli). Tanpa kunci/secret.
- Isi:
  1. **Ringkasan per brand** pekan terpilih vs pekan sebelumnya: views, jangkauan, interaksi, pengikut baru, jumlah video CF Studio tayang.
  2. **Tabel video:** judul, brand, jenis (multiplier/produk/resep/editorial), jam tayang, jangkauan, klik %, skor keterlibatan, label Menang/Lemah, status "belum matang" (< 72 jam).
  3. Filter: pekan, brand, jenis video, platform.
  4. Tombol "Ambil data sekarang" (simulasi).
  5. Kotak "**Perlu reconnect**" yang menampilkan halaman dengan insight mati + cara memperbaiki (Repliz → Accounts → Reconnect).
  6. Contoh badge reconnect di daftar akun Publishing.
- Sinkron ke Staging sesuai SOP: commit + push, `npm run deploy:staging -- --ref <full-git-sha> --apply --confirm-staging`, cek HTTP 200 `http://100.95.245.55:5010/mockup_analitik_performa.html`. Jangan polling SSH berulang.
- Kirim link + cara mencoba, lalu **berhenti**.
- Setelah disetujui: implementasi di app dengan **100% semantic token** dari `app/theme.css`, adaptif light/dark.

## Fase 7: Rilis

- Semua unit test lulus, cek statik bebas secret.
- `npm run release-non-interactive -- --type minor --title "Analitik Performa Repliz" --points "Statistik akun & posting dari Repliz|Pengambil harian (default off)|API & MCP analitik|Penanda reconnect insight Facebook|Halaman Performa"`
- Deploy **Staging** atomic dengan full SHA + verifikasi wajib (current, manifest, HTTP 200 UI/API, PM2 online, pm_cwd, PG_SEARCH_PATH, PGPOOL_MAX).
- **Dilarang deploy Production.**

## Kriteria selesai

- [ ] Fase 0 dilaporkan, ID posting terbukti cocok.
- [ ] Collect manual di Staging mengisi `account_metric_daily` (28 hari) dan `post_metric_snapshots` untuk posting 8 hari terakhir. Menjalankan 2× tidak menambah baris dobel.
- [ ] `cf_get_post_metrics` mengembalikan baris dengan brand, jenis video, jam tayang, dan skor.
- [ ] Akun tanpa insight muncul sebagai "perlu reconnect".
- [ ] Halaman Performa sesuai mockup yang disetujui.
- [ ] Tidak ada secret di kode, test, mockup, maupun log.

## Format laporan ke pengguna

Bahasa sederhana: apa yang sudah jalan, link untuk dicoba, apa yang perlu dilakukan pengguna (mis. reconnect halaman tertentu, menyalakan pengambil harian), dan apa yang belum.
