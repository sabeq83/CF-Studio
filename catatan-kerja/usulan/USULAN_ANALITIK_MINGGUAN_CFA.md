# Usulan: Analitik & Laporan Mingguan + Rencana Konten Pekan Depan

Tanggal: 16 Nov 2026 · Versi 2.1 (disempurnakan setelah mempelajari dokumentasi API Repliz `https://api.repliz.com/public-json`) · Status: usulan disetujui arah, **paket Repliz sudah Gold** → Tingkat 1 + Tingkat 2 dikerjakan sekaligus

Rencana teknis: [analitik_mingguan_implementation_plan.md](analitik_mingguan_implementation_plan.md) · Instruksi agent: [antigravity_analitik_mingguan_instructions.md](antigravity_analitik_mingguan_instructions.md)

> **Pembaruan 16 Nov 2026: reconnect Repliz gagal.** Reconnect NutriBake & Dapur Botani di Repliz memunculkan error izin Facebook (`pages_read_engagement`). Jalan keluarnya: data **Facebook** diambil langsung lewat **app Meta milik pengguna** yang sudah terhubung ke CF Studio (Dapur Botani, NutriBake ID, Sedekah Al-Quran + IG keduanya). Platform lain tetap lewat Repliz, dan posting tetap lewat Repliz. Halaman lain cukup ditambahkan sekali lewat login ulang app Meta (centang semua halaman), tidak perlu reconnect satu per satu di Repliz. Detail: bagian 3A di rencana teknis.

---

## Ringkasan untuk pengguna

**Kabar baik:** Repliz **sudah menyediakan data performa**, jadi kita tidak perlu ekspor manual atau izin Meta sendiri. Ada dua jenis data:

| Data | Isinya | Paket Repliz minimal |
|---|---|---|
| **Statistik per halaman/akun** | Total 28 hari terakhir + angka harian: views, jangkauan, interaksi, pengikut baru, views video | **Standard** |
| **Statistik per video** | Per posting: views, jangkauan, klik, reaksi, komentar, share (Facebook). Lebih lengkap untuk YouTube, TikTok, Instagram Reels | **Gold** |

**Dua syarat sebelum mulai:**
1. **Halaman Facebook yang terhubung ke Repliz sebelum 13 Nov 2026 harus disambungkan ulang sekali** (Reconnect di Repliz) agar izin membaca insight aktif. Kalau tidak, views, jangkauan, dan klik akan kosong. Yang tersisa hanya like, komentar, share.
2. **Cek paket Repliz.** Laporan per brand bisa jalan di paket Standard ke atas. Untuk memetakan **video mana yang bagus**, dibutuhkan paket **Gold**.

Alurnya tetap sama: web app mengumpulkan angka setiap hari, skrip merangkum, skill Claude menganalisa dan menyusun rencana pekan depan, lalu Anda menyetujui.

---

## 1. Temuan dari dokumentasi Repliz

### 1.1 Endpoint yang relevan

| Endpoint | Fungsi | Paket |
|---|---|---|
| `GET /public/account/{accountId}/statistic` | Statistik halaman: pengikut, total 28 hari (views, reach, engagement, profileViews, newFollows, unfollows, videoViews) + angka harian | Standard+ |
| `GET /public/content?accountId=` | Daftar semua posting di halaman (id, judul, caption, tipe, link, tanggal). Termasuk posting yang **bukan** dari CF Studio | Gold+ |
| `GET /public/content/{contentId}/statistic?accountId=` | Statistik satu posting, langsung dari platform | Gold+ |
| `GET /public/schedule/{id}` | Sudah dipakai CF Studio. Memberi ID posting setelah tayang | Premium+ |

`contentId` = ID posting di platform. CF Studio **sudah menyimpannya** di `publishing_jobs.external_post_id`, jadi menghubungkan angka ke video yang kita produksi tinggal dicocokkan.

### 1.2 Angka yang tersedia per platform (statistik per posting)

| Platform | Angka |
|---|---|
| **Facebook** | like, comment, share + insight: **views, reach (penonton unik), clicks, reaction** (total & per jenis). Tidak ada data simpan (save) dan durasi tonton |
| **YouTube** | views, like, comment + **rata-rata durasi tonton, % ditonton, menit tonton, subscriber +/-, share, sumber trafik (SHORTS, pencarian, dll.)**, angka harian 28 hari. Cache 6 jam |
| **TikTok** | views, like, comment, share, favourite, **rata-rata ditonton, rasio tonton penuh, retensi per detik**, sumber tayangan, profil penonton |
| **Instagram Reels** | views, reach, like, comment, share, saved, **rata-rata durasi tonton, skip rate 3 detik pertama** |
| **Threads** | views, like, replies, repost, quotes, share |

### 1.3 Catatan penting lain

- **Shopee addon** (`/public/addon/shopee/product`) hanya menampilkan produk **toko sendiri** yang terhubung, bukan produk terlaris pasar. Tidak bisa dipakai untuk riset produk (relevan untuk usulan Riset Produk).
- Repliz punya endpoint **riset TikTok & Threads** (paket Gold+): cari hashtag, video, dan konten pengguna. Ini bisa jadi sumber ide topik tambahan, di luar cakupan usulan ini.
- Autentikasi memakai Access Key + Secret Key yang sudah tersimpan di pengaturan tenant. Tidak perlu kredensial baru.

---

## 2. Rancangan yang disempurnakan

### 2.1 Dua tingkat laporan, sesuai paket

| Tingkat | Butuh | Isi laporan |
|---|---|---|
| **Tingkat 1: Laporan brand** | Paket Standard+ (bisa langsung) | Per brand/halaman pekan lalu vs pekan sebelumnya: views, jangkauan, interaksi, views video, pengikut baru/hilang. Hari terbaik dalam pekan. Jumlah video tayang dari CF Studio |
| **Tingkat 2: Peta video** | Paket Gold | Semua di atas + peringkat tiap video, pola yang menang (jenis video, hook, jam tayang, produk, template), dan rencana konten pekan depan berbasis video menang |

Kalau paket belum Gold, Tingkat 1 tetap jalan dan rencana pekan depan disusun dari tren halaman + data produksi CFA. Hasilnya kurang tajam, tapi tetap berguna.

### 2.2 Web app CF Studio (dikerjakan Antigravity)

1. **`lib/repliz-client.js`**: tambah fungsi `getReplizAccountStatistic`, `listReplizContent`, `getReplizContentStatistic`.
2. **Tabel baru:**
   - `account_metric_daily`: angka harian per akun (dari statistik akun), satu baris per akun per hari.
   - `post_metric_snapshots`: angka per posting pada umur tertentu (kolom umum: `views`, `reach`, `clicks`, `reactions`, `comments`, `shares`, `saves`, `avg_watch_sec`, `view_pct`, `full_watch_rate`, `skip_rate`, plus `raw_json` untuk angka khusus platform).
3. **Pengambil otomatis harian** (mis. pukul 03.00):
   - Statistik akun untuk semua akun Repliz aktif → `account_metric_daily`.
   - (Gold) Untuk posting berumur 1–14 hari dari `publishing_jobs`: ambil statistik, simpan snapshot di umur **±24 jam, 72 jam, 7 hari**.
   - (Gold, opsional) `GET /public/content` untuk mencatat posting di luar CF Studio sebagai pembanding.
   - Jeda antar panggilan dan batasi jumlah per jalan agar tidak membebani Repliz (dokumentasi tidak menyebut batas pemakaian, jadi tetap hemat).
4. **Deteksi masalah koneksi:** bila `insight` Facebook bernilai kosong, tandai akun "**Perlu reconnect di Repliz**" dan tampilkan di halaman Publishing.
5. **Tool MCP baru** `cf_get_post_metrics` dan `cf_get_account_metrics` (filter tenant, brand, rentang tanggal). Hasil sudah digabung dengan data konten: brand, jenis video, preset, template finishing, hook, produk, jam tayang.
6. **Halaman ringkas** "Performa" di web app (opsional, fase akhir): tabel per brand dan daftar video teratas.

### 2.3 Cara menilai video (disesuaikan dengan data Facebook)

Karena Facebook tidak memberi data simpan dan durasi tonton, skor dibedakan per platform:

| Platform | Skor keterlibatan | Skor klik (penting untuk afiliasi) |
|---|---|---|
| Facebook | `(reaksi + 2×komentar + 3×share) ÷ reach` | `clicks ÷ reach` |
| YouTube | `% ditonton` + `(like + 2×komentar + 3×share) ÷ views` | – |
| TikTok / IG Reels | `rasio tonton penuh` / `1 − skip rate` + interaksi ÷ views | klik website (TikTok) |

Aturan yang tetap:
- Dibandingkan pada **umur 72 jam**. Video yang belum 72 jam saat laporan dibuat ditandai "belum matang" dan dinilai pekan depan.
- Dibandingkan **di dalam kelompoknya** (brand × jenis video).
- 20% teratas = *Menang*, 20% terbawah = *Lemah*. Kelompok kurang dari 5 video tidak diberi label.
- Untuk Facebook, **reach lebih penting dari views** (views bisa terhitung berulang dari orang yang sama).

### 2.4 Skrip `cfa_analitik.py` dan skill `cfa-analitik`

Tidak berubah dari versi 1, dengan penyesuaian:
- Skrip menarik data lewat tool MCP/API CF Studio (bukan langsung ke Repliz), jadi kunci Repliz tetap hanya di server.
- Ringkasan JSON memuat dua bagian: `brand_summary` (Tingkat 1) dan `video_ranking` + `patterns` (Tingkat 2, bila ada).
- Skill menulis laporan + rencana pekan depan dengan pola **70% ulang pola menang / 20% variasi / 10% percobaan**, untuk multiplier, produk, resep, dan editorial. Rencana masuk antrean CFA sebagai **draft** dan menunggu persetujuan Anda.
- Untuk video produk, skor klik dipakai menentukan produk **lanjut** atau **diganti** (terhubung ke usulan Riset Produk).

### 2.5 Contoh isi laporan

```
NutriBake · Pekan 46 (9–15 Nov)
Halaman: views 48.200 (+18%) · jangkauan 31.500 (+12%) · pengikut baru 214
Video CF Studio tayang: 14 (resep 6, produk 4, multiplier 2, editorial 2)

Menang
- "Brownies tanpa mixer" (resep) · jangkauan 9.800 · 41 share · klik 2,1%
- "3 kesalahan bikin cookies" (editorial) · jangkauan 6.200 · 63 komentar
Lemah
- 3 video produk dengan hook manfaat umum · jangkauan < 900

Pola
- Hook pertanyaan: jangkauan 2,3× hook pernyataan (8 vs 6 video)
- Tayang 19.00: terbaik untuk resep; 12.00: terbaik untuk produk
- Template Recipe Pop: klik lebih tinggi dari tanpa template

Rencana pekan 47 (draft)
- Resep 5: 3 mengulang pola "tanpa mixer", 1 variasi, 1 baru
- Produk 3: pertahankan Premix Cocoa, ganti 2 produk klik rendah
- Multiplier 2: dari "Brownies tanpa mixer"
- Editorial 2: format "kesalahan umum"
```

---

## 3. Jadwal mingguan

| Waktu | Kegiatan | Pelaku |
|---|---|---|
| Setiap hari 03.00 | Ambil statistik akun (+ per video bila Gold) | Web app |
| Senin 07.00 | `cfa_analitik.py` lalu skill `cfa-analitik` | Tugas terjadwal Claude Desktop (diatur sendiri oleh pengguna lewat UI) |
| Senin pagi | Baca laporan, setujui/ubah rencana | Pengguna |
| Senin siang | Rencana masuk jalur, `cfa-riset` berjalan | CFA |

---

## 4. Tahapan kerja

| Fase | Isi | Pelaku |
|---|---|---|
| 0a | **Reconnect** semua halaman Facebook di Repliz (yang terhubung sebelum 13 Nov 2026) | Pengguna / man power |
| 0b | ~~Cek paket Repliz~~ → **sudah Gold** (16 Nov 2026) | Selesai |
| 0c | Uji 1 halaman: panggil statistik akun & 1 posting, pastikan `insight` terisi | Antigravity |
| 1 | Fungsi Repliz baru, tabel `account_metric_daily`, pengambil harian, tool MCP `cf_get_account_metrics` → **Laporan Tingkat 1 bisa jalan** | Antigravity |
| 2 | `cfa_analitik.py` + skill `cfa-analitik` versi Tingkat 1 | Claude |
| 3 | (Gold) Tabel `post_metric_snapshots`, snapshot 24j/72j/7h, tool `cf_get_post_metrics`, penanda "perlu reconnect" | Antigravity |
| 4 | Skill versi Tingkat 2: peringkat video, pola, rencana 70/20/10, kirim draft ke antrean | Claude |
| 5 | Uji 2 pekan berjalan, sesuaikan bobot skor | Bersama |

## 5. Risiko & catatan

- **Tanpa reconnect**, angka utama Facebook kosong. Ini langkah paling penting dan paling mudah terlewat.
- **Tanpa paket Gold**, tidak ada peringkat per video. Laporan tetap ada, tapi rencana pekan depan kurang tajam.
- **Sampel kecil:** satu brand bisa hanya 5–15 video per pekan. Laporan wajib menyebut jumlah video tiap kelompok, dan pola dari kurang dari 3 video tidak boleh disimpulkan.
- **Klik Facebook** mencakup semua klik di posting (bukan hanya link afiliasi). Untuk angka penjualan nyata, nanti bisa ditambah data klik/pesanan dari dasbor Shopee Affiliate.
- Biaya token kecil: Claude hanya membaca ringkasan, bukan data mentah.
