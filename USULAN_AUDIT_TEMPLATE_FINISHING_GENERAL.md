# Usulan: Template Finishing Lebih General, Lebih Bersih

Tanggal: 16 Nov 2026 · Status: usulan & rencana (belum dikerjakan) · Eksekutor: Antigravity

---

## Ringkasan untuk pengguna

Ada tiga masalah, dan ketiganya berasal dari cara template dibuat, bukan dari videonya:

1. **Template masih "milik brand".** Pemilihan template otomatis masih mencari nama brand (Sasyahouse, Siasat Sehat, NutriBlend, Dapur Botani, Ruang Akustik, Solusi Thermal). Warnanya juga tertanam di tiap template (kuning + cokelat hangat). Satu-satunya yang bisa diganti hanya satu warna aksen.
2. **Teks bahan terasa terlalu besar** karena huruf tebal, chip panjang (sampai 22 huruf), dan semuanya tampil sekaligus dalam satu tumpukan.
3. **Teks menumpuk.** Di template resep, sampai **6 blok teks bisa tampil bersamaan**: daftar bahan, label langkah, kartu produk, ajakan simpan, subtitle, dan watermark. Daftar bahan juga **bertahan sampai ±78% durasi video**.

Usulan intinya:

- **Pisahkan "tata letak" dari "gaya".** Template = tata letak (resep, tips, mitos-fakta, dll). Gaya = paket warna + font + bentuk kartu (mis. *Pop Kuning*, *Bersih Putih*, *Hangat Earthy*, *Gelap Tegas*, *Pastel Lembut*, *Editorial Serif*). Brand cukup memilih gaya di profilnya, dan semua template ikut.
- **Aturan "Satu Fokus".** Di satu waktu paling banyak **1 kartu info + subtitle**. Kartu bahan, langkah, produk, dan ajakan simpan tampil bergiliran, tidak bertumpuk.
- **Ukuran huruf diturunkan dan disamakan** lewat satu skala ukuran untuk semua template.

---

## 1. Hasil audit (berdasar kode)

File yang diaudit: `lib/finishing-template-registry.js`, `lib/finishing-data-extractor.js`, `templates/finishing/*.html` (8 template), `templates/finishing/shared-layers.js`.

### 1.1 Keterikatan ke brand

| Temuan | Lokasi |
|---|---|
| Aturan saran template memakai nama brand: `sasyahouse`, `siasat\s+sehat`, `nutriblend`, `dapur\s+botani`, `ruang\s+akustik`, `solusi\s*thermal` | `finishing-template-registry.js` baris 86, 109, 133, 158 |
| Warna tertanam di CSS tiap template (`--accent: #ffcc3d`, chip krem `#fff8ee`, teks cokelat `#2a1a10`, kartu putih, pill hitam) | semua `templates/finishing/*.html` |
| Yang bisa di-override hanya `accentColor` dan `activeWordColor` | `recipe-pop.html` baris 402–408 |
| Semua template memakai 3 font yang sama (Anton, Montserrat, Inter) | blok `@font-face` di tiap template |

Akibatnya brand baru otomatis jatuh ke template generik atau salah pilih, dan semua brand terlihat "keluarga kuning" yang sama.

### 1.2 Ukuran huruf (template `recipe_pop`, kanvas 720 px lebar)

| Elemen | Ukuran sekarang | Kira-kira di 1080p | Catatan |
|---|---|---|---|
| Chip bahan | 3,3cqw tebal 800 | ±36 px | label sampai 22 karakter, `nowrap`, lebar maks 44% layar |
| Judul "BAHAN 3/7" | 2,9cqw tebal 900, huruf kapital | ±31 px | |
| Lingkaran centang | 4,6cqw | ±50 px | lebih besar dari teksnya |
| Teks langkah | 3,1cqw kapital + garis tepi hitam | ±33 px | |
| Subtitle | 7,6cqw kapital + garis tepi 0,75cqw | ±82 px | elemen terbesar kedua dan selalu tampil |
| Punch (kata kunci) | 15,5cqw | ±167 px | |
| Hook baris 2 | 11cqw | ±119 px | |

Masalahnya bukan satu angka, tapi tidak ada hierarki: chip bahan tebal, kapital, panjang, lalu bersaing dengan subtitle kapital 82 px di bawahnya. `ramuan_ritual` punya pola yang sama (chip 3,15cqw, judul 2,8cqw).

> Perlu dicek satu kali dengan potongan frame dari video nyata (lihat Fase 0) untuk memastikan persepsi "terlalu besar" juga tidak datang dari salah skala render.

### 1.3 Teks menumpuk: aturan tampil sekarang

Logika di `recipe-pop.html` fungsi `renderAt` baris 486–609:

| Lapisan | Kapan tampil | Disembunyikan oleh |
|---|---|---|
| Hook | 0 – 1,75 dtk | tidak ada |
| Punch | sesuai jadwal punch | tidak ada |
| **Daftar bahan** | dari bahan pertama sampai **awal klip penutup** (`ingUntil`, ±78% durasi), chip **menumpuk** sampai 4 + judul + "+N bahan lain" | hanya hook |
| Label langkah | tiap klip | punch, hook. **Tidak** disembunyikan oleh daftar bahan |
| Kartu produk | sesuai jadwal | punch, hook. **Tidak** disembunyikan oleh daftar bahan atau langkah |
| Ajakan simpan | menjelang akhir | punch. **Tidak** disembunyikan oleh bahan/langkah/produk |
| Subtitle | selalu (mode default `full`) | hanya di mode `hybrid` saat punch tampil |
| Watermark/brand patch | sepanjang video | – |

Skenario nyata di detik ke-8 video resep 20 detik: **daftar bahan (6 baris) di kiri atas + label langkah di kanan atas + kartu produk melintang di 28% tinggi layar (bertabrakan fisik dengan daftar bahan) + subtitle kapital + watermark.** Itulah kesan "penuh dan kurang profesional".

Penyebab utamanya: setiap lapisan punya aturan sendiri dan **tidak ada pengatur giliran pusat**.

---

## 2. Usulan perbaikan

### 2.1 Pisahkan tata letak (template) dan gaya (skin)

**Template** tetap 8 tata letak yang ada. **Skin** baru adalah paket token visual:

```
skin = {
  id, label,
  accent, accentInk,          // warna aksen & teks di atas aksen
  card, cardInk, cardMuted,   // kartu info
  chip, chipInk,              // chip bahan/material
  stroke, shadow,             // garis tepi teks & bayangan
  fontDisplay, fontBody, fontUi,
  radius: 'pill' | 'soft' | 'square',
  textCase: 'upper' | 'sentence',
  strokeText: true | false    // teks bergaris tepi (gaya pop) atau bersih (gaya editorial)
}
```

Usulan 6 skin awal:

| Skin | Kesan | Cocok untuk |
|---|---|---|
| `pop_kuning` | gaya sekarang, energik | resep, tips cepat |
| `bersih_putih` | kartu putih tipis, teks gelap, tanpa garis tepi, huruf kecil-kapital biasa | brand premium, produk |
| `hangat_earthy` | krem, terakota, hijau zaitun | herbal, ramuan, dapur rumahan |
| `gelap_tegas` | kartu gelap transparan, aksen neon | B2B/material, angka & banding |
| `pastel_lembut` | pastel, sudut bulat | ibu & anak, wellness |
| `editorial_serif` | judul serif, minimal | edukasi, mitos-fakta |

Aturan:
- Template HTML **tidak boleh** lagi menulis warna langsung. Semua warna lewat variabel CSS (`var(--fx-accent)`, `var(--fx-card)`, dst.) yang diisi dari skin. Prinsipnya sama dengan SOP Semantic Token di web app.
- Skin dipilih di **Brand Profile / Visual Identity** (`finishing_skin`), bisa ditimpa per campaign. Kalau kosong, pakai `pop_kuning` (perilaku lama tetap).
- `accentColor` brand tetap boleh menimpa `accent` skin.
- Pemilihan template otomatis **dibersihkan dari nama brand**. Template dipilih berdasar sinyal konten (`campaign_kind`, preset, pola teks "resep/ramuan/mitos/tips/banding"). Brand yang ingin template tetap cukup mengisi `finishing_template` default di profilnya.

### 2.2 Aturan "Satu Fokus" (pengatur giliran)

Buat satu fungsi pusat **penjadwal lapisan** yang menghitung kapan tiap lapisan boleh tampil sebelum timeline dikirim ke template. Template hanya menggambar apa yang dijadwalkan, tanpa logika saling-sembunyi sendiri.

**Zona layar:**
- Zona Atas (12–40% tinggi): **satu** kartu info saja (bahan / langkah / produk / babak / tip).
- Zona Tengah (40–60%): hook atau punch.
- Zona Bawah (64–76%): subtitle.
- Kanan 15% tetap kosong untuk tombol platform (sudah ada).

**Aturan giliran:**

| No | Aturan |
|---|---|
| R1 | Maksimal **2 blok teks** tampil bersamaan: 1 di Zona Atas atau Tengah + subtitle. Watermark kecil tidak dihitung |
| R2 | Prioritas bila bentrok: Hook > Punch > Produk > Ajakan simpan/CTA > Langkah > Bahan |
| R3 | Saat hook atau punch tampil, kartu Zona Atas disembunyikan dan subtitle dipendekkan (mode hybrid) |
| R4 | Setiap kartu tampil minimal **1,2 dtk** dan ada jeda **0,25 dtk** antar kartu (tidak berkedip) |
| R5 | Satu kartu maksimal **3,5 dtk**, kecuali label langkah yang mengikuti panjang klip |

**Daftar bahan diubah dari "tumpukan" menjadi "bergiliran":**
- Fase bahan hanya di bagian awal (klip 1–2), **maksimal 4 dtk**, bukan sampai klip penutup.
- Tampil **paling banyak 3 chip sekaligus** sebagai jendela bergulir: chip baru masuk, chip paling lama keluar.
- Setelah fase bahan selesai, kartu bahan hilang dan label langkah mulai. Ringkasan lengkap tetap di "Bahan lengkap ada di caption".
- Label chip maksimal 16 karakter. Takaran ditulis lebih kecil dan tipis di belakang nama ("Tepung terigu · 200 g").

**Subtitle:**
- Default resep & ramuan menjadi **`hybrid`** (bukan `full`).
- Saat ada kartu info di Zona Atas, subtitle maksimal **1 baris / 4 kata**.

### 2.3 Skala ukuran huruf seragam

Satu skala untuk semua template (dalam cqw, kanvas 9:16):

| Peran | Sekarang (resep) | Usulan |
|---|---|---|
| Display (hook/punch) | 11–15,5 | 9–12,5 (punch panjang turun otomatis ke 9) |
| Subtitle | 7,6 kapital + stroke | 6,2 (skin pop) / 5,6 tanpa stroke (skin bersih) |
| Judul kartu ("BAHAN", "LANGKAH 2/5") | 2,9 kapital tebal | 2,4, huruf renggang, tebal 700 |
| Isi kartu / chip | 3,1–3,3 tebal 800–900 | 2,7 tebal 600, huruf biasa (bukan kapital) |
| Keterangan kecil (takaran, disclaimer) | 2,0–2,5 | 2,0–2,2 |
| Ikon centang | 4,6 | sama tinggi dengan teks (±3,2) |

Skala ini ditaruh di `shared-layers.js` sebagai variabel (`--fx-size-display`, `--fx-size-sub`, `--fx-size-label`, `--fx-size-body`, `--fx-size-meta`) dan dipakai semua template.

### 2.4 Penjaga otomatis (validator)

Tambahkan cek di `lib/finishing-plan-validator.js`: sampel timeline setiap 0,1 dtk, lalu gagalkan atau beri peringatan bila:
- lebih dari 2 blok teks aktif bersamaan (R1),
- ada kartu tampil kurang dari 1,2 dtk (R4),
- dua kartu Zona Atas bertumpuk,
- daftar bahan tampil lebih dari 4 dtk.

Hasil cek tampil di halaman review job (mis. "Kepadatan teks: OK / 3 titik padat di 6,2 dtk, 8,0 dtk, 11,4 dtk").

---

## 3. Rencana kerja untuk Antigravity

Sesuai SOP: **mockup HTML dulu**, disinkronkan ke Staging 5010, direview pengguna, baru coding.

| Fase | Isi | Hasil yang bisa dicek |
|---|---|---|
| 0. Bukti awal | Ambil 1 video resep & 1 ramuan terbaru, potong frame per 0,5 dtk, tandai titik dengan ≥3 blok teks | Lembar "sebelum" untuk pembanding |
| 1. Mockup | `public/mockup_finishing_satu_fokus.html`: template resep dengan penjadwal baru, pemilih 6 skin, slider waktu, penghitung "blok teks aktif" | Link `http://100.95.245.55:5010/mockup_finishing_satu_fokus.html` |
| 2. Skin & token | Ganti semua warna tertanam di 8 template dengan `var(--fx-*)`. Tambah `lib/finishing-skin-registry.js` (pure JS, seperti template registry). Default `pop_kuning` = tampilan sekarang | Render lama tidak berubah bila skin kosong |
| 3. Skala huruf | Variabel ukuran di `shared-layers.js`, terapkan ke semua template | |
| 4. Penjadwal lapisan | Fungsi `scheduleOverlayLayers(timeline)` di `lib/` (dipanggil `finishing-preview-builder.js` dan `finishing-overlay-renderer.js`). Ubah `extractRecipeOverlayData` jadi fase bahan ≤4 dtk dengan jendela 3 chip. Hapus logika saling-sembunyi di tiap template | |
| 5. Lepas dari brand | Hapus nama brand dari `suggestFor`. Tambah kolom `finishing_skin` (+ opsional `finishing_template` default) di brand profile/VI, UI di halaman Preset/Brand, dan dukungan di MCP (`cf_update_brand_profile`) | Brand baru bisa pilih skin tanpa ubah kode |
| 6. Validator | Cek kepadatan teks di `finishing-plan-validator.js` + tampil di review | |
| 7. Uji & rilis | Render ulang 2 video Fase 0 dengan 3 skin berbeda, bandingkan frame sebelum/sesudah. Rilis patch + deploy Staging | Pengguna review manual |

### Kriteria selesai

- Tidak ada warna hex tertanam di `templates/finishing/*.html` (kecuali transparan/hitam garis tepi yang memang lewat token).
- Tidak ada nama brand di `finishing-template-registry.js`.
- Pada video uji, **tidak ada satu frame pun dengan lebih dari 2 blok teks** (di luar watermark).
- Daftar bahan tampil maksimal 4 dtk, maksimal 3 chip sekaligus.
- Video lama tanpa skin tetap terlihat sama (kompatibel).

### Risiko

- Mengubah 8 template sekaligus berisiko regresi. Kerjakan per template, mulai `recipe_pop` dan `ramuan_ritual` (yang dikeluhkan), lalu sisanya.
- Video yang sedang di antrean render memakai timeline lama. Penjadwal baru hanya berlaku untuk job baru.
