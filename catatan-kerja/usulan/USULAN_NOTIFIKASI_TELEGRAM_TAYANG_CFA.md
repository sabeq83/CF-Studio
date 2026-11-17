# Usulan: Notifikasi Telegram CFA — "Video Siap Ditonton" dan "Sudah Tayang + Link Post"

> Tanggal: 17 Nov 2026 · Status: **USULAN** (belum dikerjakan)
> Berlaku untuk: CF Autopipeline di Mac Mini (`masbenu@100.95.245.55`, folder `~/cf-autopipeline`). Skripnya ada di Mac Mini, bukan di repo CF Studio.
> Disusun oleh: Claude (reviewer/planner) · Eksekutor: Antigravity, setelah disetujui pengguna

---

## 1. Ringkasan

Saat ini Telegram hanya memberi kabar kalau video **sudah dijadwalkan** ke Repliz. Pengguna belum dikabari saat:

1. **Video selesai diproduksi dan siap ditonton.** Kabar ini baru datang bersama laporan publish pagi (06:00), padahal video sudah jadi sejak malam.
2. **Video benar-benar tayang di sosmed.** Belum ada link post per platform (YouTube, Facebook, Instagram, TikTok).

Usulan ini menambah dua notifikasi tersebut **tanpa memakai token AI**, karena dikerjakan oleh skrip, dan **tanpa mengubah CF Studio**. Data link post sudah tersedia di CF Studio dan tinggal dibaca.

---

## 2. Penjelasan alur video setelah produksi

### 2a. Urutan perjalanan satu video

```
[CFA · Produksi 21:00]  naskah dikirim ke CF Studio
        │
        ▼
[CF Studio]  gambar awal → suara VO → klip video → gabung (ffmpeg) → upload ke Nextcloud
        │                                                    (= VIDEO JADI, file ada di Cloud)
        ▼
[CFA · Publish 06:00/12:00]  QA mekanis → sinkron ContentFlow → buat job di Repliz
        │                                                    (= TERJADWAL, belum tayang)
        ▼
[Repliz, pada jam slot]  memposting ke YouTube / Facebook / Instagram / TikTok
        │
        ▼
[CF Studio publishing worker]  menanyakan Repliz tiap ±15 detik → simpan status "published"
                               + link post asli per platform        (= SUDAH TAYANG)
```

### 2b. Arti istilah: apakah "upload ke Nextcloud" sama dengan "dipublish"?

**Tidak.** Ada tiga keadaan yang berbeda:

| Keadaan | Artinya | Status di CFA | Sudah dikabari Telegram? |
|---|---|---|---|
| **Video jadi** | File MP4 selesai dan sudah di-upload ke Nextcloud (link "Cloud"). Video bisa ditonton, tetapi **belum ada di sosmed**. | masih `diproduksi` | Belum (baru ikut pesan publish pagi) |
| **Terjadwal** | CFA sudah menitipkan video ke Repliz dengan jam tayang tertentu. **Belum tayang.** | `terjadwal` | ✅ Ya, pesan "CFA · Publish" |
| **Sudah tayang** | Repliz sudah memposting, dan link post tiap sosmed tersedia. | *(belum ada status)* | ❌ Belum ada |

Jadi pesan yang Anda terima pagi ini:

```
CFA · Publish
✅ 20261117-nutribake-produk-darkchoco-dark-chocolate-drink: dijadwalkan 2026-11-17T08:15:00+07:00 (live) ke 4 akun ... · Cloud >>> LINK <<<
```

artinya **"video sudah jadi (link Cloud = file di Nextcloud) DAN sudah dijadwalkan tayang pukul 08.15"**. Pesan itu **belum** berarti video sudah tayang. Kata "CFA · Publish" diambil dari nama tahapnya, sehingga mudah dikira sudah tayang.

### 2c. Bukti bahwa link post sudah tersedia di CF Studio

Saya mengecek langsung pada 17 Nov 2026 pukul 08.27 WIB (hanya membaca). Item `20261117-nutribake-produk-darkchoco-dark-chocolate-drink` yang dijadwalkan 08.15:

| Platform | Status di CF Studio | Link post |
|---|---|---|
| YouTube | published | `youtube.com/watch?v=F9a9SXaQ61o` |
| Facebook | published | `facebook.com/1071656722705640/posts/…` |
| Instagram | published | `instagram.com/reel/18182999632431163/` |
| TikTok | published | `tiktok.com/@nutribake_id/video/7708942739039161608` |

Item kemarin (16 Nov) juga lengkap: 3 tayang, dan 1 Facebook **dibatalkan** dengan alasan "Link afiliasi diganti ke link brand NutriBake". Artinya data yang dibutuhkan sudah ada. CFA cukup membacanya lewat `GET /api/v2/publishing/jobs/<id>`, karena ID job-nya sudah tersimpan di setiap item (`publish.hasil.job_ids`).

---

## 3. Usulan: tiga jenis pesan Telegram

### Pesan A — 🎬 Video siap ditonton (BARU)

Dikirim sekali per video, begitu CF Studio selesai menggabung dan meng-upload video ke Nextcloud. Biasanya tiba 15–60 menit setelah produksi malam, jadi Anda bisa menonton dan menilai sebelum tayang besok.

```
🎬 CFA · Video siap ditonton
NutriBake · Dark Chocolate Drink
Produk: Nutrifarm Dark Chocolate Powder
Rencana tayang: Selasa 17 Nov, 08.15 WIB (live) → YT, FB, IG, TikTok
Tonton: ▶️ Cloud  ·  📁 Drive
```

Kalau ada beberapa video dalam satu pengecekan, semuanya digabung dalam satu pesan supaya Telegram tidak ramai.

### Pesan B — 🗓️ Terjadwal (YANG SEKARANG, bahasanya diperjelas)

Isinya tetap, hanya judul dan kalimatnya diperjelas supaya tidak terbaca "sudah tayang":

```
🗓️ CFA · Terjadwal (belum tayang)
✅ NutriBake · Dark Chocolate Drink — tayang 17 Nov 08.15 (live) ke YT, FB, IG, TikTok
⚠️ NutriBake · Coklat Keto — video belum jadi setelah 15 jam, perlu dicek
```

Usulan tambahan: tampilkan **judul yang mudah dibaca** (brand · topik) dan jam singkat, bukan ID panjang seperti `20261117-nutribake-produk-...` dan format `2026-11-17T08:15:00+07:00`. ID lengkap tetap tercatat di log.

### Pesan C — 📣 Sudah tayang + link post (BARU)

Dikirim satu kali per video, setelah semua platform selesai (tayang, gagal, atau dibatalkan):

```
📣 CFA · Sudah tayang
NutriBake · Dark Chocolate Drink (08.15 WIB)
▶️ YouTube   ·  📘 Facebook  ·  📸 Instagram  ·  🎵 TikTok
```

Setiap nama platform bisa diklik dan langsung membuka post-nya.

Kalau sebagian platform bermasalah:

```
📣 CFA · Tayang sebagian
NutriBake · Dark Choco Hangat (08.15 WIB)
▶️ YouTube  ·  📸 Instagram  ·  🎵 TikTok
❌ Facebook: dibatalkan — Link afiliasi diganti ke link brand NutriBake
```

Kalau lewat **2 jam** dari jam slot dan masih ada platform yang belum selesai, kirim pesan sementara: `⏳ Facebook belum tayang 2 jam setelah jadwal — cek Repliz`. Pesan final tetap dikirim nanti.

Untuk jalur mode **draft** (mis. HabitFolk), isinya berbunyi `📝 Draft sudah masuk Repliz — perlu Anda tekan publish manual`, tanpa link post.

---

## 4. Cara kerja yang diusulkan (hemat token)

### 4a. Satu skrip pemantau baru, tanpa AI: `cfa_pantau.py`

Skrip ini hanya membaca status lalu mengirim Telegram. Tidak ada Claude yang ikut, sehingga **0 token**.

Tugasnya:

1. Item berstatus `diproduksi` yang videonya sudah selesai dan belum pernah dikabari → kirim **Pesan A**, lalu tandai `notif.video_siap`.
2. Item berstatus `terjadwal` yang jam slotnya sudah lewat → baca setiap job di CF Studio:
   - semua platform selesai → kirim **Pesan C**, ubah status item menjadi **`tayang`** (status baru), lalu simpan link per platform di `publish.hasil.link`;
   - lewat 2 jam dan masih ada yang tertunda → kirim pesan ⏳ sekali saja;
   - lewat 24 jam dan masih tertunda → ubah status menjadi `perlu_review`.
3. Setiap pesan ditandai di item supaya **tidak pernah terkirim dua kali**.

Alur status CFA menjadi:

```
dijadwalkan → riset_selesai → naskah_siap → diproduksi → terjadwal → tayang (BARU)
```

### 4b. Kapan skrip pemantau berjalan — pilih salah satu

| Pilihan | Cara | Biaya token | Catatan |
|---|---|---|---|
| **A. Jadwal sistem Mac (launchd), setiap 15 menit** *(disarankan)* | Skrip langsung dijalankan oleh macOS | **0** | Hanya membaca dan mengirim pesan, tidak memanggil Claude. Tidak bentrok dengan jadwal Claude Desktop karena tugasnya berbeda. |
| B. Tugas terjadwal Claude Desktop (Haiku), setiap 30 menit | "Jalankan skill cfa-pantau" | Kecil, tetapi ±48 putaran/hari | Konsisten dengan aturan "penjadwal resmi Claude Desktop", tetapi boros untuk pekerjaan yang hanya mengecek status. |
| C. Ditempel ke `cfa-publish` yang sudah ada (06:00 & 12:00) | Tanpa jadwal baru | 0 tambahan | Paling sederhana, tetapi kabar terlambat. Video 08.15 baru dikabari tayang pukul 12:00, dan kabar "video siap" baru datang pagi hari. |

Catatan: jadwal tetap **Anda aktifkan sendiri**. Claude dan Antigravity hanya menyiapkan skrip dan petunjuknya.

---

## 5. Perbaikan kecil yang ikut dikerjakan

| No | Masalah sekarang | Usulan |
|---|---|---|
| 1 | Putaran produksi/publish yang kosong tidak memberi kabar, sehingga Anda tidak bisa membedakan "tidak ada pekerjaan" dari "jadwal tidak jalan". | Satu pesan singkat harian, mis. "CFA · Produksi: tidak ada naskah malam ini" (bisa dimatikan di `config.json`). |
| 2 | Hasil kirim Telegram (terkirim/gagal) tidak dicatat di log harian. | Catat di `log/<tanggal>.md`, mis. `telegram terkirim` / `telegram gagal: TimeoutError`. Kalau gagal, coba kirim ulang sekali di putaran berikutnya. |
| 3 | Pesan memakai ID panjang dan format jam teknis. | Tampilkan "Brand · Topik" dan jam singkat (lihat Pesan B). |

---

## 6. Risiko dan hal yang perlu dicek

1. **Link Instagram mungkin tidak bisa dibuka.** Repliz tidak mengirim link post, jadi CF Studio menyusunnya sendiri dari ID post. Untuk Instagram, hasilnya `instagram.com/reel/<angka panjang>/`. Instagram biasanya memakai kode pendek seperti `/reel/Cx1AbC.../`, bukan angka, sehingga link ini **berpotensi tidak terbuka**. Mohon klik link Instagram di tabel bagian 2c untuk mengecek. Kalau tidak terbuka, perbaikannya ada di CF Studio (`lib/publishing-worker.js`, fungsi `buildPlatformPermalink`) dan menjadi pekerjaan terpisah. Sementara itu CFA bisa menampilkan link profil akun Instagram sebagai cadangan.
2. **Facebook memakai format `/<page>/posts/<id>`.** Biasanya bisa dibuka, tetapi perlu diuji sekali.
3. **Kolom "waktu tayang" (`published_at`) di CF Studio kosong.** CFA memakai jam slot sebagai pengganti. Ini tidak menghalangi notifikasi.
4. **Video yang diulang produksinya** (`--ulang`) bisa punya dua set job. Pemantau hanya membaca job terbaru yang tersimpan di item.

---

## 7. Rincian teknis untuk eksekutor (Antigravity)

**File di Mac Mini (`~/cf-autopipeline`):**

| File | Perubahan |
|---|---|
| `bin/cfa_pantau.py` *(baru)* | Logika bagian 4a. Memakai `cfa_api.call("GET", "/api/v2/publishing/jobs/<id>", tenant)`. Tenant diambil dari jalur (`J["tenant"]`). Pemetaan status job: `published` → ✅ dengan `external_permalink`; `draft_created` → 📝; `failed`/`cancelled` → ❌ dengan `last_error_message`; `scheduled`/`processing`/`retry_wait` → tertunda. Untuk Pesan A: cek `ffmpeg_status == completed` dan ada `nextcloud_url`/`drive_link`, dengan pola yang sama seperti `cfa_publish.py` baris ±152. |
| `bin/antrean.py` | Tambah status `tayang` ke daftar status yang sah. Tambah pencatatan hasil `kirim_telegram()` ke log harian (perbaikan No. 2). |
| `bin/cfa_publish.py` | Ubah judul pesan menjadi "🗓️ CFA · Terjadwal (belum tayang)" dan ganti ID dengan label yang mudah dibaca (perbaikan No. 3). Jangan kirim Pesan A di sini kalau item sudah punya `notif.video_siap`. |
| `bin/cfa_produksi.py` | Opsional: pesan putaran kosong (perbaikan No. 1). |
| `KONTRAK.md`, `README.md` | Tambah status `tayang` dan field `notif` + `publish.hasil.link`. |
| `launchd-nonaktif/` → plist baru `com.cfa.pantau.plist` | Hanya kalau pengguna memilih opsi A. Disiapkan saja, **diaktifkan oleh pengguna**. |
| `~/.claude/skills/cfa-publish/SKILL.md` | Perbarui kalimat notifikasi. Kalau pengguna memilih opsi B, buat skill `cfa-pantau`. |

**Field baru pada item:**

```json
"notif": { "video_siap": "2026-11-16T21:42:00+07:00", "tayang": "2026-11-17T08:30:00+07:00", "tertunda_2jam": null },
"publish": { "hasil": { "job_ids": ["..."], "status": "tayang",
  "link": { "youtube": "https://...", "facebook": "https://...", "instagram": "https://...", "tiktok": "https://..." } } }
```

**Uji sebelum aktif:** jalankan `cfa_pantau.py --dry-run` pada item 16 dan 17 Nov (sudah ada yang tayang dan yang dibatalkan), lalu pastikan isi pesan benar tanpa mengirim. Setelah itu kirim satu pesan uji ke Telegram dan klik setiap link.

---

## 8. Keputusan yang perlu Anda ambil

1. **Cara menjalankan pemantau:** A (launchd, 0 token, disarankan), B (Claude Desktop), atau C (ikut cfa-publish)?
2. **Pesan putaran kosong:** perlu atau tidak?
3. **Cek link Instagram** di tabel bagian 2c: bisa dibuka atau tidak? Jawabannya menentukan apakah perlu perbaikan terpisah di CF Studio.
