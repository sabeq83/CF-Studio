# Usulan: Skill Riset Produk Mingguan (7–10 Produk Baru per Pekan)

Tanggal: 16 Nov 2026 · Status: usulan (belum dikerjakan)

---

## Ringkasan untuk pengguna

Alur yang diusulkan, setiap Jumat/Sabtu:

1. **Skill Claude `cfa-riset-produk`** mencari kandidat produk laris di kategori yang sesuai profil tiap brand.
2. Kandidat disaring (rating, penjualan, harga, kepatuhan klaim) lalu dipilih **7–10 produk terbaik**.
3. Data produk dilengkapi: deskripsi, **USP (keunggulan)**, spesifikasi, foto. USP hanya diambil dari halaman produk, tidak dikarang.
4. Produk disimpan ke **database produk CF Studio** dengan status **"Menunggu link afiliasi"**.
5. **Man power** cukup membuka satu daftar, menempelkan **link afiliasi Shopee**, dan mengecek foto. Setelah link terisi, produk otomatis siap diuji di jalur video produk pekan depan.
6. Pekan berikutnya, laporan analitik (usulan terpisah) menilai produk mana yang **lanjut** dan mana yang **diganti**.

**Satu hal harus diluruskan:** angka **"penjualan selama seminggu"** tidak tersedia terbuka di Shopee. Yang terlihat publik hanya total terjual (mis. "10RB+ terjual") atau perkiraan per bulan. Usulan di bawah memakai cara pengganti yang jujur (lihat bagian 2).

---

## 1. Yang sudah ada di CF Studio

| Komponen | Kegunaan |
|---|---|
| Tool MCP `cf_scrape_product_url`, `cf_enrich_product`, `cf_add_product`, `cf_update_product`, `cf_upload_product_photo`, `cf_regenerate_product_photo` | Ambil data dari link, lengkapi deskripsi/USP, simpan, kelola foto |
| Tabel `brand_products` | Sudah punya kolom **`affiliate_link`**, `tracking_code`, `cta_override` per brand. Tempat link afiliasi tidak perlu dibuat baru |
| Brand Profile | Kategori, audiens, gaya bahasa, dasar untuk memilih kategori riset |
| `cfa-jalur` (`antrean.py --tambah-produk`) | Memasukkan produk ke rotasi jalur video produk |

Jadi sebagian besar pipa sudah ada. Yang kurang: **pencarian kandidat**, **status uji produk**, dan **daftar tugas man power**.

---

## 2. Sumber data "produk laris" (perlu diputuskan)

| Opsi | Cara | Catatan |
|---|---|---|
| A. Shopee Affiliate (dasbor/daftar penawaran) | Man power atau Claude membuka daftar produk komisi/terlaris per kategori di akun Shopee Affiliate | Paling relevan karena produk pasti bisa diafiliasikan dan komisinya terlihat. Perlu login akun pengguna |
| B. Selisih "terjual" mingguan | Simpan angka "terjual" kandidat tiap pekan. Selisih pekan ini dan pekan lalu = perkiraan penjualan seminggu | Paling dekat ke "penjualan mingguan". Butuh 1 pekan data awal sebelum akurat |
| C. Halaman publik (Terlaris per kategori, pencarian kata kunci) | Claude membuka lewat browser | Shopee sering menampilkan captcha/blokir untuk akses otomatis. **Claude tidak boleh menembus captcha**, jadi opsi ini tidak bisa diandalkan penuh |
| D. Alat riset pihak ketiga (berbayar) | Ekspor data penjualan per kategori | Akurat, tapi ada biaya |

**Rekomendasi:** gabungan **A + B**. A untuk mencari kandidat (30–50 per pekan), B untuk membaca tren dari pekan ke pekan. Pekan pertama memakai "terjual per bulan" sebagai perkiraan, mulai pekan kedua memakai selisih mingguan.

Karena belum ada budget API, langkah membuka Shopee dilakukan lewat browser di Mac Mini oleh skill. Bila halaman meminta login atau captcha, skill berhenti dan meminta man power membantu, bukan memaksa.

---

## 3. Rancangan alur

### 3.1 Langkah skill `cfa-riset-produk`

| Langkah | Isi | Aturan |
|---|---|---|
| 1. Baca brand | Kategori, audiens, harga wajar, batasan kepatuhan dari Brand Profile | Brand tanpa kategori dilewati dan dilaporkan |
| 2. Kumpulkan kandidat | 30–50 kandidat per brand dari sumber A/B | Simpan link, nama, harga, rating, jumlah ulasan, terjual, komisi |
| 3. Buang duplikat | Bandingkan dengan produk yang sudah ada di database & yang pernah *Gagal uji* | Produk gagal tidak diusulkan lagi selama 8 pekan |
| 4. Saring | Rating ≥ 4,7, ulasan ≥ 100, toko Mall/Star bila ada, harga dalam rentang brand, komisi ≥ batas minimal | Angka batas disimpan di config CFA, bisa diubah |
| 5. Cek kepatuhan | Produk kesehatan/herbal/pangan wajib punya izin edar (BPOM/PIRT) di halaman produk. Produk dengan klaim menyembuhkan dibuang | Pakai aturan yang sama dengan skill compliance yang sudah ada |
| 6. Beri skor | Tren penjualan 40% · komisi 20% · kecocokan brand 20% · kemudahan dibuat video (visual menarik, bisa didemokan) 20% | Skor & alasannya ditulis, agar pengguna bisa menilai |
| 7. Pilih 7–10 | Per pekan untuk semua brand, dibagi sesuai jumlah jalur video produk aktif | Minimal 1 per brand yang punya jalur produk |
| 8. Lengkapi data | `cf_scrape_product_url` lalu `cf_enrich_product`: deskripsi singkat, 3–5 USP, spesifikasi, foto | **USP hanya dari halaman produk/ulasan.** Tiap USP diberi sumber. Tidak ada klaim karangan |
| 9. Simpan | `cf_add_product` + hubungkan ke brand di `brand_products` dengan `affiliate_link` kosong & status `menunggu_link` | |
| 10. Lapor | Halaman HTML: daftar produk, skor, alasan, foto, dan daftar tugas man power | Dikirim ke Telegram seperti laporan CFA lain |

### 3.2 Status uji produk (perlu ditambah di web app)

Tambah kolom `test_status` (dan `test_week`) di `brand_products`:

```
kandidat → menunggu_link → siap_uji → sedang_diuji → lanjut / gagal
```

| Status | Artinya | Siapa yang mengubah |
|---|---|---|
| `menunggu_link` | Disimpan skill, link afiliasi belum ada | Skill |
| `siap_uji` | Link afiliasi & foto sudah dicek | Otomatis saat man power mengisi link |
| `sedang_diuji` | Masuk rotasi jalur video produk pekan ini | `cfa-jalur` |
| `lanjut` / `gagal` | Hasil laporan analitik mingguan | Skill `cfa-analitik`, disetujui pengguna |

### 3.3 Halaman tugas man power

Satu halaman sederhana di CF Studio, mis. **Produk → Perlu Link Afiliasi**:
- Daftar produk berstatus `menunggu_link`: foto, nama, link Shopee asli, brand.
- Kolom isian **link afiliasi** + tombol **Simpan**.
- Cek otomatis: link harus berupa link Shopee (mis. `shope.ee/...` atau `s.shopee.co.id/...`) dan tidak boleh sama dengan produk lain.
- Centang **"Foto oke"**. Kalau foto jelek, tombol **"Buat ulang foto"** (`cf_regenerate_product_photo`).
- Batas waktu: **Minggu 20.00**. Produk yang belum ada linknya sampai Senin tidak masuk jadwal, dan dilaporkan.

### 3.4 Pemakaian di caption Facebook

- Saat `cfa-penulis` atau `cfa-publish` membuat caption video produk, link diambil dari `brand_products.affiliate_link` brand tersebut.
- **Pengaman:** video produk **tidak boleh dijadwalkan** bila link afiliasinya kosong. Lebih baik ditahan daripada tayang tanpa link (kehilangan komisi).
- Cek bahwa `cfa-publish` dan pembuat caption di web app sudah membaca `affiliate_link` (perlu dicek oleh Antigravity, belum saya pastikan).

---

## 4. Jadwal mingguan

| Hari/jam | Kegiatan | Pelaku |
|---|---|---|
| Jumat 20.00 | `cfa-riset-produk` berjalan, laporan dikirim | Tugas terjadwal (diatur pengguna lewat UI) |
| Sabtu–Minggu | Man power isi link afiliasi & cek foto | Man power |
| Minggu 20.00 | Batas pengisian link | |
| Senin | Analitik mingguan + rencana konten memakai produk `siap_uji` | `cfa-analitik` |
| Senin–Minggu | Produk diuji di jalur video produk | CFA |
| Senin berikutnya | Keputusan *lanjut* / *gagal* | `cfa-analitik` + pengguna |

---

## 5. Tahapan kerja

| Fase | Isi | Eksekutor |
|---|---|---|
| 0 | Putuskan sumber data (A/B/C/D). Pastikan akun Shopee Affiliate bisa diakses dari Mac Mini | Pengguna |
| 1 | Kolom `test_status` & `test_week` di `brand_products`, halaman "Perlu Link Afiliasi", pengaman "tanpa link = tidak dijadwalkan", update tool MCP `cf_add_product`/`cf_update_product` agar bisa mengisi status | Antigravity |
| 2 | Skill `cfa-riset-produk` + skrip pembantu (simpan riwayat "terjual" untuk opsi B, saring & skor tanpa AI) | Claude |
| 3 | Hubungkan ke `cfa-jalur` (produk `siap_uji` masuk rotasi otomatis) dan ke `cfa-analitik` (penilaian lanjut/gagal) | Claude |
| 4 | Uji 2 pekan: cek ketepatan kandidat, waktu man power, hasil tayang | Bersama |

## 6. Risiko & catatan

- **Data penjualan bukan angka pasti.** Laporan harus menyebut sumber angkanya ("perkiraan dari selisih terjual", "data dasbor affiliate").
- **Kepatuhan klaim.** Deskripsi & USP produk herbal/pangan paling berisiko. Aturan: USP wajib bersumber, tidak ada kata "menyembuhkan/mengobati", izin edar dicek.
- **Captcha/login Shopee.** Skill berhenti dan meminta bantuan. Tidak ada upaya menembus pengaman.
- **Beban token.** Riset 30–50 kandidat per brand bisa boros. Penyaringan angka (langkah 3–4) dikerjakan skrip, Claude hanya menilai kecocokan dan menulis USP untuk 7–10 produk terpilih.
- **Kelebihan produk.** 7–10 produk per pekan berarti ±40 per bulan. Produk `gagal` diarsipkan agar database dan rotasi jalur tetap rapi.
