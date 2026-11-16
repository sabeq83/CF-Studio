# Usulan: Analitik & Laporan Mingguan + Rencana Konten Pekan Depan

Tanggal: 16 Nov 2026 · Status: usulan (belum dikerjakan)

---

## Ringkasan untuk pengguna

Alur yang diusulkan, sekali seminggu (Senin pagi):

1. **Web app CF Studio** setiap hari mengambil angka performa video yang sudah tayang (views, like, komentar, share, simpan, klik link) dan menyimpannya.
2. **Skrip ringan** (tanpa AI) merangkum angka per brand dan per jenis video, lalu menandai video yang bagus dan yang lemah.
3. **Skill Claude `cfa-analitik`** membaca rangkuman itu, mencari pola ("hook pertanyaan menang di NutriBake", "video resep jam 19.00 lebih tinggi"), lalu menyusun:
   - **Laporan statistik pekan lalu per brand**, dan
   - **Rencana konten pekan depan** per brand untuk 4 jenis: multiplier, produk, resep, editorial.
4. Rencana masuk ke antrean CFA sebagai **draft**. Pengguna menyetujui, lalu `cfa-riset` dan agent lain menjalankannya seperti biasa.

**Satu hal harus dipastikan dulu:** di kode sekarang, CF Studio **belum mengambil data performa apa pun dari Repliz**. Yang disimpan baru status tayang, ID posting, dan link posting. Langkah pertama adalah memastikan apakah Repliz menyediakan data performa lewat API (lihat Fase 0).

---

## 1. Kondisi sekarang

| Komponen | Kondisi |
|---|---|
| `lib/repliz-client.js` | Hanya: daftar akun, buat/cek/ulang/hapus jadwal, cari konten Threads, komentar. **Tidak ada endpoint performa/insight** |
| Tabel `publishing_jobs` | Menyimpan `external_post_id`, `external_permalink`, status. **Tidak ada kolom angka performa** |
| `publishing-repository.js` "metrics" | Hanya hitungan operasional (terjadwal, tayang hari ini, gagal), bukan performa |
| CFA (`~/cf-autopipeline`) | Tahu jalur, brand, jenis, preset, produk, topik, sudut pandang tiap item. Ini bekal bagus untuk menjelaskan **kenapa** sebuah video menang |

Jadi bahan untuk "menjelaskan" sudah ada. Yang belum ada adalah **angka hasil**.

---

## 2. Sumber data performa (Fase 0, wajib dicek dulu)

Urutan pilihan, dari yang paling diharapkan:

| Opsi | Cara | Kelebihan | Kekurangan |
|---|---|---|---|
| A. API Repliz | Cek dokumentasi/dukungan Repliz: adakah endpoint statistik per posting atau per akun | Satu pintu untuk FB, IG, YouTube, TikTok, Threads | Belum terkonfirmasi ada. Pencarian web saya tidak menemukan dokumentasi publiknya |
| B. API platform langsung | Facebook/Instagram lewat Meta Graph API (insight video/reels), YouTube Analytics API | Data paling lengkap (retensi, durasi tonton) | Perlu token per halaman/kanal dan izin aplikasi Meta, pekerjaan setup lebih besar |
| C. Ekspor manual mingguan | Man power ekspor CSV dari Meta Business Suite / YouTube Studio tiap Senin, unggah ke CF Studio | Bisa jalan minggu ini, tanpa izin API | Tergantung orang, rawan lupa |

**Rekomendasi:** mulai dengan **C** agar laporan pertama bisa keluar cepat, sambil memastikan **A**. Kalau A tidak tersedia, rencanakan **B** untuk Facebook (kanal utama).

Struktur penyimpanan di bawah dibuat sama untuk ketiga opsi, jadi sumber bisa diganti tanpa mengubah laporan.

---

## 3. Rancangan

### 3.1 Web app: tabel angka performa

Tabel baru `post_metric_snapshots` (per tenant, per schema dev/staging/public):

| Kolom | Isi |
|---|---|
| `tenant_id`, `publishing_job_id`, `platform`, `account_id` | Penghubung ke posting |
| `external_post_id`, `permalink` | |
| `captured_at`, `age_hours` | Kapan diambil, umur posting saat itu |
| `views`, `reach`, `likes`, `comments`, `shares`, `saves`, `link_clicks` | Angka utama (boleh kosong bila platform tidak memberi) |
| `avg_watch_sec`, `completion_rate` | Bila tersedia |
| `source` | `repliz` / `meta_api` / `youtube_api` / `csv_upload` |

Ditambah:
- **Pengambil harian** (worker terjadwal di web app): ambil angka untuk posting berumur 1–14 hari. Snapshot disimpan di umur ±24 jam, **72 jam**, dan 7 hari.
- **Unggah CSV** di halaman Publishing (untuk opsi C), dicocokkan ke posting lewat ID posting atau link.
- **Tool MCP baru** `cf_get_post_metrics` (filter: tenant, brand, rentang tanggal). Mengembalikan angka + metadata konten (brand, jenis, preset, template finishing, judul/hook, produk, jam tayang).

### 3.2 Cara menilai "video bagus" (adil antar video)

- **Pakai angka di umur 72 jam** sebagai pembanding utama. Video tayang Minggu malam tidak kalah hanya karena baru berumur beberapa jam. Video yang belum mencapai 72 jam saat laporan dibuat **ditandai "belum matang"** dan dinilai di laporan pekan berikutnya.
- **Skor keterlibatan**: `(like + 2×komentar + 3×share + 3×simpan) ÷ views`. Simpan dan share diberi bobot lebih karena paling menandakan konten berguna.
- **Dibandingkan di dalam kelompoknya** (brand × jenis video), bukan antar brand. Video resep NutriBake dibandingkan dengan video resep NutriBake.
- **Kategori**: 20% teratas = *Menang*, 20% terbawah = *Lemah*, sisanya *Rata-rata*. Kalau kelompoknya kurang dari 5 video, cukup dilaporkan tanpa label (sampel terlalu kecil).

### 3.3 Skrip ringan `cfa_analitik.py` (tanpa AI)

Di `~/cf-autopipeline/bin/`, pola sama dengan `cfa_token.py` dan `cfa_laporan_riset.py`:
- Tarik data pekan lalu (Senin–Minggu) lewat API CF Studio.
- Gabungkan dengan data item CFA (jalur, topik, sudut pandang, produk, jenis hook).
- Hitung: total & perubahan dibanding pekan sebelumnya per brand, peringkat video, rata-rata per dimensi (jenis video, jam tayang, hari, preset, template finishing, jenis hook, produk).
- Keluarkan `analitik/minggu-YYYY-WW.json` (ringkas, hemat token untuk Claude) dan halaman HTML laporan.

### 3.4 Skill `cfa-analitik` (Claude)

Tugas Claude hanya bagian yang butuh penalaran:
1. Baca JSON ringkasan (bukan data mentah, agar hemat token).
2. Tulis **temuan** per brand: 3 hal yang berhasil, 2 yang tidak, dengan bukti angka.
3. Susun **rencana pekan depan** per brand dengan pola alokasi **70 / 20 / 10**:
   - 70% mengulang pola yang menang (topik/sudut/hook/jam serupa),
   - 20% variasi dari pola menang,
   - 10% percobaan baru.
4. Untuk tiap jenis video:

| Jenis | Isi rencana |
|---|---|
| Multiplier | Video menang mana yang dibuat ulang dengan sudut baru, berapa variasi |
| Produk | Produk mana yang dipertahankan, mana yang diganti (terhubung ke usulan Riset Produk Mingguan) |
| Resep | Tema resep, produk yang dipakai, panjang ideal |
| Editorial | Topik & sudut pandang edukasi, jenis hook |

5. Simpan rencana ke antrean CFA sebagai **draft** (lewat helper `antrean.py`, perintah baru mis. `antrean.py rencana-minggu <file>`). Tidak ada yang diproduksi sebelum pengguna bilang "setuju".

### 3.5 Format laporan (contoh isi)

```
NutriBake · Pekan 46 (9–15 Nov)
Tayang 14 video · Views 48.200 (+18%) · Skor keterlibatan 4,1% (+0,6)
Menang: "Brownies tanpa mixer" (resep, 12.400 views, 310 simpan)
Lemah: 3 video produk dengan hook manfaat umum (<800 views)
Pola: hook pertanyaan 2,3× lebih tinggi dari hook pernyataan; jam 19.00 terbaik
Rencana pekan 47: 5 resep (3 ulang pola brownies), 3 produk (ganti 1), 2 multiplier dari "Brownies tanpa mixer", 2 editorial
```

---

## 4. Jadwal mingguan

| Hari/jam | Kegiatan | Pelaku |
|---|---|---|
| Setiap hari | Ambil angka performa | Web app (otomatis) |
| Senin 07.00 | `cfa_analitik.py` lalu skill `cfa-analitik` | Tugas terjadwal Claude Desktop (diatur pengguna sendiri lewat UI) |
| Senin pagi | Pengguna baca laporan, setujui/ubah rencana | Pengguna |
| Senin siang | Rencana masuk ke jalur, `cfa-riset` berjalan seperti biasa | CFA |

Untuk opsi C (CSV), man power mengunggah CSV paling lambat Senin 06.30.

---

## 5. Tahapan kerja

| Fase | Isi | Eksekutor |
|---|---|---|
| 0 | Pastikan apakah Repliz punya API performa. Tentukan opsi A/B/C | Pengguna + Claude |
| 1 | Tabel `post_metric_snapshots`, unggah CSV, tool MCP `cf_get_post_metrics` | Antigravity |
| 2 | `cfa_analitik.py` + halaman HTML laporan | Claude (skrip CFA) |
| 3 | Skill `cfa-analitik` + perintah `antrean.py rencana-minggu` | Claude |
| 4 | Pengambil harian otomatis (Repliz atau Meta/YouTube API) | Antigravity |
| 5 | Uji 2 pekan berjalan, sesuaikan bobot skor | Bersama |

## 6. Risiko & catatan

- **Sampel kecil.** Satu brand bisa hanya 5–15 video per pekan, jadi pola harus dibaca hati-hati. Laporan wajib menyebut jumlah video tiap kelompok, dan Claude tidak boleh menyimpulkan dari kurang dari 3 video.
- **Views Facebook bisa naik turun karena distribusi algoritme**, bukan kualitas konten. Karena itu skor keterlibatan lebih penting daripada views mentah.
- **Klik link afiliasi** paling dekat ke penjualan. Bila memakai link Shopee berkode, data klik/komisi dari dasbor Shopee Affiliate bisa ditambahkan nanti sebagai kolom `link_clicks`/`orders`.
- Biaya token kecil karena Claude hanya membaca ringkasan, bukan data per posting.
