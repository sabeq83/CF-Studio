# Usulan: Jalur Konten Fleksibel untuk CF Autopipeline (CFA)

> Tanggal: 15 Nov 2026 · Status: **Tahap 1 + 2 sudah dibangun dan diuji tanpa kuota di Mac Mini (15 Nov 2026).** Tahap 3–5 belum.
> Video uji jalur produk (`cst_7411ed5d3aa6`) sudah sesuai harapan pengguna.
> Tujuan: satu sistem untuk semua brand, tenant, produk (afiliasi maupun bukan), preset, VI, dan jenis video, tanpa harus merakit jalur satu per satu.

---

## 1. Masalah sekarang

Saat ini satu brand berarti satu setelan tetap: satu preset, satu VI, satu jenis video, dan satu daftar akun. Akibatnya:
- Brand yang punya **lebih dari satu jenis konten** (misalnya NutriBake: video produk dan edukasi) tidak bisa diatur.
- **Produk tidak bisa dirotasi.** Satu brand hanya bisa satu produk.
- **Brand di tenant lain** (NutriBlend di `sy_dodot`) belum bisa ikut.
- Setiap brand baru harus "dirakit" lagi oleh Claude.

## 2. Ide utama: "Jalur" sebagai resep konten

Yang diatur bukan lagi **brand**, tapi **jalur**. Satu jalur adalah satu resep produksi yang berulang:

```
JALUR = brand + tenant + jenis video + preset + VI + sumber topik + (produk) + akun + frekuensi
```

Contoh:

| Jalur | Brand (tenant) | Jenis | Preset | Produk | Akun | Frekuensi |
|---|---|---|---|---|---|---|
| `habitfolk-resep` | HabitFolk (default) | Edukasi | habitfolk_8clips_deep | — | YT, FB | 1/hari |
| `nutribake-produk-cocoa` | NutriBake (default) | Produk | nutribake_video_produk_reveal2kali | Premix Cocoa | YT, FB, IG, TikTok | 1/hari |
| `nutribake-edukasi` | NutriBake (default) | Edukasi | (preset edukasi) | — | FB, IG | Sen, Rab, Jum |
| `dapurbotani-afiliasi` | Dapur Botani (default) | Produk | dapurbotani_produk_7klip_4s | **rotasi 5 produk** | FB, TikTok | 1/hari |
| `nutriblend-produk` | NutriBlend (sy_dodot) | Produk | (preset NutriBlend) | rotasi | TikTok | 1/hari |

- Satu brand boleh punya banyak jalur.
- Satu jalur bisa **merotasi banyak produk**, sama seperti kata kunci dirotasi.
- Menambah konten baru = menambah satu jalur, bukan menulis ulang sistem.

## 3. Yang dibaca otomatis dari CF Studio

Supaya file jalur tetap pendek, banyak hal **tidak perlu ditulis manual** karena sudah ada di CF Studio:

| Dari | Diambil otomatis |
|---|---|
| **Preset** | Jumlah klip, durasi, kata per VO, bahasa, suara, outro wajib, klip reveal produk, model video, VI default |
| **Brand profile** | Panduan brand, pilar konten, gaya visual, tone |
| **Katalog produk** | Deskripsi, USP, foto kemasan, **link afiliasi** (ada atau tidak) |
| **Akun Repliz** | Platform tiap akun (YT/FB/IG/TikTok) |

**Jenis video ditentukan dari preset.** Kalau preset punya reveal produk, jalurnya jenis "produk". Kalau tidak, jenis "edukasi".

## 4. Produk afiliasi dan non-afiliasi

Sistem membedakannya dari ada tidaknya **link afiliasi di Katalog**:

| | Produk afiliasi | Produk non-afiliasi (milik sendiri/brand) |
|---|---|---|
| CTA VO | Mengikuti outro preset ("produk ori ada di keranjang ya!") | Mengikuti outro preset (misalnya "cek di toko kami") |
| Caption FB | Link afiliasi langsung (bisa diklik) | Link toko atau ajakan DM |
| Caption IG/TikTok/YT | "Link di bio / keranjang kuning" | "Link di bio" |
| Klaim | **Hanya** dari deskripsi dan USP Katalog | Sama, ditambah data brand |

CF Studio sudah mendukung **caption berbeda per platform**, jadi tinggal dipakai.

## 5. Bentuk file jalur

Satu file per jalur di `~/cf-autopipeline/jalur/`. Isinya cukup pilihan, karena detailnya dibaca dari CF Studio:

```
jalur/nutribake-produk-cocoa.json
{
  "aktif": true,
  "brand": "nutribake",
  "tenant": "default_tenant",
  "preset": "nutribake_video_produk_reveal2kali",
  "vi": "vi_nutribake_modern_pastry",
  "produk": ["Premix Cocoa Powder Premium"],
  "topik": "kata_kunci/nutribake.txt",
  "sudut_wajib": "konteks diet / mengurangi gula",
  "akun": ["youtube", "facebook", "instagram", "tiktok"],
  "frekuensi": "harian",
  "jam_publish": "18:00",
  "mode_publish": "draft"
}
```

- `produk` boleh banyak dan akan dirotasi. Kalau kosong, artinya video tanpa produk.
- `akun` cukup ditulis nama platformnya. Sistem mencari akun Repliz brand itu sendiri.
- `sudut_wajib` adalah arahan copywriting tetap, misalnya "konteks diet" karena terbukti laku.

**Anda tidak perlu menulis file ini sendiri.** Lihat bagian 6.

## 6. Cara Anda mengelola jalur: skill `cfa-jalur`

Satu skill baru untuk mengatur jalur lewat chat biasa (di Claude Desktop Mac Mini maupun di sini):

- *"Tambah jalur NutriBlend video produk, preset X, produk A, B, C, posting ke TikTok."*
  → Claude mengecek ke CF Studio bahwa brand, preset, VI, produk, dan akun memang ada, lalu membuat file jalur.
- *"Jeda jalur dapurbotani-afiliasi."* → `aktif: false`
- *"Tambah produk Cokelat Bubuk 250 gr ke jalur nutribake."*
- *"Tampilkan semua jalur."* → tabel ringkas: jalur, produk berikutnya, sisa kata kunci, video terakhir

Kalau ada yang tidak ditemukan (produk belum ada fotonya, akun terputus, preset salah tenant), Claude langsung memberi tahu **sebelum** jalur dibuat.

## 7. Alur harian (sama untuk semua jalur)

```
05:00 Riset     → setiap jalur aktif yang jadwalnya hari ini: pilih topik + riset web
05:30 Naskah    → baca preset + produk → hook, VO, aksi visual, caption, judul YT
06:00 Produksi  → kirim ke CF Studio sesuai jenis (edukasi / produk)
09:00 & 13:00 Publish → cek selesai → QA → jadwal Repliz per platform
```

**Cukup 4–5 tugas terjadwal untuk semua brand**, bukan 4 tugas per brand. Setiap tugas menyapu semua jalur aktif. Kalau mau, satu brand tetap bisa dijalankan terpisah ("untuk jalur nutribake-produk-cocoa saja").

Cara kerja per jenis:

| Jenis | Naskah Claude | Mode prompt CF Studio | Produk |
|---|---|---|---|
| **Edukasi** (HabitFolk) | VO, aksi visual, **prompt gambar lengkap** | direct_passthrough | — |
| **Produk** (NutriBake) | VO, aksi visual, kamera, klip reveal | gemini_engineer (foto kemasan disisipkan mesin) | Dari Katalog, dirotasi |
| **Resep** (nanti) | Langkah resep, VO | gemini_engineer | Opsional |

## 8. Pengaman lintas brand

| Pengaman | Cara kerja |
|---|---|
| **Kunci tenant per jalur** | Setiap jalur dikunci ke tenant-nya sendiri, jadi NutriBlend (sy_dodot) tidak tercampur dengan default_tenant |
| **Batas kuota** | Batas global per hari (semua jalur), ditambah batas per jalur |
| **Prioritas** | Kalau kuota tidak cukup, jalur berprioritas tinggi dikerjakan dulu |
| **Produk tanpa foto** | Jalur produk dilewati dan Anda diberi peringatan Telegram |
| **Akun Repliz terputus** | Publish ke akun itu ditahan, platform lain tetap jalan |
| **Klaim** | Klaim produk hanya dari Katalog. Tanpa klaim kesehatan kecuali ada di data resmi |
| **Mode draft** | Jalur baru selalu mulai `draft` sampai Anda ubah ke `live` |

## 9. Judul dan caption per platform

| Platform | Isi yang dibuat Claude |
|---|---|
| **YouTube** | Judul high-CTR (±60 karakter) dan deskripsi. Dikirim sebagai jadwal terpisah karena judul di CF Studio satu untuk semua akun |
| **Facebook** | Caption dan link afiliasi yang bisa diklik (kalau produk afiliasi) |
| **Instagram/TikTok** | Caption pendek dan "link di bio / keranjang kuning" |

## 10. Rencana pembangunan bertahap

| Tahap | Isi | Hasil |
|---|---|---|
| **1. Fondasi jalur** | Folder `jalur/`, pembaca preset dan katalog otomatis, kunci tenant per jalur, migrasi HabitFolk menjadi jalur | HabitFolk tetap jalan, sekarang lewat sistem jalur |
| **2. Jenis produk** | Jalur produk (gemini_engineer, produk, reveal), rotasi produk, aturan afiliasi/non-afiliasi | NutriBake Premix Cocoa harian |
| **3. Publish per platform** | Judul YT terpisah, caption per platform, link afiliasi FB | Siap 4 platform |
| **4. Skill `cfa-jalur`** | Tambah, ubah, jeda, dan lihat jalur lewat chat, dengan validasi ke CF Studio | Anda bisa menambah brand/produk sendiri |
| **5. Tenant lain** | Uji NutriBlend di `sy_dodot` | Lintas tenant |

Setiap tahap diuji dengan dry-run dulu, lalu 1 video nyata sebelum masuk jadwal.

## 11. Yang perlu dicek atau diputuskan

1. **Hasil video uji NutriBake** (`cst_228a741fdcbe`). Ini penentu apakah jalur produk lewat Custom Storyboard layak dipakai.
2. **NutriBlend di tenant `sy_dodot`.** Perlu dicek bahwa token CFA boleh masuk tenant itu, dan preset serta produk NutriBlend ada di sana.
3. **Batas kuota G-Labs per hari** untuk semua jalur. Sekarang batasnya 3 video per hari.
4. **Preset edukasi** untuk brand yang belum punya, misalnya NutriBake edukasi.

## 12. Celah CF Studio yang ikut berpengaruh (untuk Antigravity)

- Judul publish satu untuk semua akun. Idealnya ada `platform_titles` seperti `platform_captions`.
- Laporan status storyboard terlalu besar (70–146 ribu karakter). Perlu mode ringkas.
- Daftar preset dan VI lewat MCP juga sangat besar (90–120 ribu karakter). Perlu filter per brand.
- Belum ada tool MCP untuk membatalkan `cst_*`.
