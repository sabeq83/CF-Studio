# Usulan: Notifikasi Telegram CFA — "Video Siap Ditonton" dan "Sudah Tayang + Link Post"

> Tanggal: 17 Nov 2026 · Status: **BAGIAN CFA SUDAH DIKERJAKAN** (17 Nov 2026, 10.30 WIB) · bagian link Instagram di CF Studio **TERTUNDA**

## Status pengerjaan (17 Nov 2026)

**Sudah dipasang di Mac Mini (`~/cf-autopipeline`), dikerjakan Claude atas permintaan pengguna:**
- `bin/cfa_pantau.py` (baru): pemantau tayang. Dipanggil di awal `cfa_publish.py` (Opsi C). Selain job yang dibuat CFA, pemantau juga membaca job lain untuk video yang sama, sehingga jadwal yang diubah manual dari draft ke live tetap terbaca dengan benar.
- `bin/cfa_publish.py`: satu pesan per putaran dengan bagian 🎬 / ⚠️ / ⏳ / 📣 / 💤, label "Brand · Judul", jam singkat, dan link ▶️ Tonton. Link Tonton juga muncul untuk video yang tidak lolos QA.
- `bin/cfa_produksi.py`: pesan 💤 untuk putaran kosong.
- `bin/antrean.py`: status baru `tayang`, pesan panjang dipecah, kirim ulang sekali kalau gagal, dan hasil kirim dicatat di `log/<tanggal>.md` dengan tanda `[telegram]`.
- `bin/cfa_laporan_riset.py`: label status "Sudah tayang".
- Dokumen yang diperbarui: `KONTRAK.md`, `README.md`, serta skill `cfa-publish` dan `cfa-produksi`.
- Cadangan skrip lama: `~/cf-autopipeline/bin-cadangan-20261117-sebelum-notif-tayang/`.

**Hasil uji:**
- Dry-run tidak mengubah file antrean (dicek dengan checksum).
- 5 video yang sudah tayang terbaca lengkap dengan link post, termasuk Facebook pengganti dan HabitFolk yang diubah ke live.
- Satu pesan uji (berlabel UJI) terkirim ke Telegram dan tercatat di log.
- Putaran publish asli pertama (12:00) akan mengirim kabar "sudah tayang" untuk video 16–17 Nov yang slotnya kurang dari 24 jam lalu. Video yang lebih lama diperbarui tanpa notifikasi.

**Tertunda: link Instagram (bagian 6 no. 1, langkah 0).** Uji fitur Get Content Repliz memerlukan kunci Repliz yang tersimpan di database CF Studio. Akses membaca database itu ditolak oleh pengaman sistem Claude, sehingga uji belum dijalankan. Sementara ini notifikasi menampilkan "📸 Instagram ✓ (link menyusul)". Isi `publish.instagram_username` di jalur/brand untuk menampilkan link halaman Reels akun.
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

### 4c. KEPUTUSAN PENGGUNA (17 Nov 2026): **Opsi C, ikut `cfa-publish`**

Logika pemantau tidak dibuat sebagai skrip/jadwal terpisah, tetapi ditempel di awal `cfa_publish.py`. Setiap kali `cfa-publish` berjalan, urutannya: (1) cek item `terjadwal` yang sudah lewat jam slot → Pesan C; (2) cek item `diproduksi` → Pesan A untuk video yang baru jadi, lalu jadwalkan seperti biasa → Pesan B. Pesan A, B, dan C dari satu putaran digabung dalam **satu pesan Telegram** per putaran, dengan bagian 🎬 / 🗓️ / 📣.

**Akibatnya, dengan jadwal publish sekarang (06:00 & 12:00):**

| Slot tayang | Kabar "Sudah tayang" diterima |
|---|---|
| 05.30 (HabitFolk habit) | 06:00 hari itu |
| 08.15, 11.45 (NutriBake) | 12:00 hari itu |
| 14.45, 18.30 (NutriBake), 19.30 (HabitFolk food) | **06:00 besok paginya** |

- Kabar "Video siap ditonton" untuk produksi malam (21:00) baru datang pukul 06:00. Untuk HabitFolk habit yang tayang 05.30, **kabar "siap ditonton" datang setelah videonya tayang**.
- **Saran opsional (tanpa ubah kode, diatur sendiri di Claude Desktop):** tambah satu jam di tugas *CFA · Publish*, misalnya **22:30**. Putaran ini memberi kabar "video siap ditonton" malam itu juga (setelah produksi 21:00), menjadwalkan videonya lebih awal, dan sekaligus melaporkan video yang tayang sore/malam (14.45, 18.30, 19.30). Model Haiku, satu putaran ±8 detik, jadi tambahan tokennya kecil.

---

## 5. Perbaikan kecil yang ikut dikerjakan

| No | Masalah sekarang | Usulan |
|---|---|---|
| 1 | Putaran produksi/publish yang kosong tidak memberi kabar, sehingga Anda tidak bisa membedakan "tidak ada pekerjaan" dari "jadwal tidak jalan". | Satu pesan singkat harian, mis. "CFA · Produksi: tidak ada naskah malam ini" (bisa dimatikan di `config.json`). |
| 2 | Hasil kirim Telegram (terkirim/gagal) tidak dicatat di log harian. | Catat di `log/<tanggal>.md`, mis. `telegram terkirim` / `telegram gagal: TimeoutError`. Kalau gagal, coba kirim ulang sekali di putaran berikutnya. |
| 3 | Pesan memakai ID panjang dan format jam teknis. | Tampilkan "Brand · Topik" dan jam singkat (lihat Pesan B). |

---

## 6. Risiko dan hal yang perlu dicek

1. **Link Instagram RUSAK (sudah dikonfirmasi pengguna, 17 Nov 2026).** Repliz tidak mengirim link post, jadi CF Studio menyusunnya sendiri: `instagram.com/reel/<ID angka>/`. Angka itu adalah ID internal Instagram (Graph API), bukan kode pendek yang dipakai di link Instagram (`/reel/Cx1AbC.../`). Angka itu juga tidak bisa diubah menjadi kode pendek dengan rumus. Satu-satunya cara mendapatkan link resmi adalah bertanya ke Meta: `GET /<media-id>?fields=permalink`. CF Studio sebenarnya sudah melakukan ini di jalur publish langsung ke Meta (`lib/meta-publisher.js` ±baris 491–505), tetapi **tidak** di jalur Repliz (`lib/publishing-worker.js`, `buildPlatformPermalink`).
   - **Perbaikan utama (pekerjaan terpisah di CF Studio):** setelah Repliz melaporkan tayang di Instagram, minta permalink resmi ke Meta memakai token Meta tenant (kalau ada). Simpan hasilnya ke `external_permalink`.
   - **Cadangan sementara di CFA:** kalau link Instagram masih berupa angka, tampilkan link halaman Reels akun (`instagram.com/<username>/reels/`) dengan label "📸 Instagram (buka profil)".
2. **Link YouTube, TikTok, dan Facebook valid** (dicek 17 Nov 2026). YouTube dan TikTok dikonfirmasi lewat layanan oEmbed resmi masing-masing: video ditemukan, dengan judul dan akun yang benar. Facebook diarahkan otomatis ke alamat resmi post-nya (`facebook.com/61589848967120/posts/...`), yang menandakan post-nya ada. Isinya hanya terlihat setelah login, jadi perlu diklik sekali oleh pengguna.
3. **Kolom "waktu tayang" (`published_at`) di CF Studio kosong.** CFA memakai jam slot sebagai pengganti. Ini tidak menghalangi notifikasi.
4. **Video yang diulang produksinya** (`--ulang`) bisa punya dua set job. Pemantau hanya membaca job terbaru yang tersimpan di item.

---

## 7. Rincian teknis untuk eksekutor (Antigravity)

**File di Mac Mini (`~/cf-autopipeline`):**

| File | Perubahan |
|---|---|
| `bin/cfa_pantau.py` *(baru, berisi fungsi saja, tanpa jadwal sendiri; dipanggil dari `cfa_publish.py` sesuai keputusan Opsi C)* | Logika bagian 4a. Memakai `cfa_api.call("GET", "/api/v2/publishing/jobs/<id>", tenant)`. Tenant diambil dari jalur (`J["tenant"]`). Pemetaan status job: `published` → ✅ dengan `external_permalink`; `draft_created` → 📝; `failed`/`cancelled` → ❌ dengan `last_error_message`; `scheduled`/`processing`/`retry_wait` → tertunda. Untuk Pesan A: cek `ffmpeg_status == completed` dan ada `nextcloud_url`/`drive_link`, dengan pola yang sama seperti `cfa_publish.py` baris ±152. |
| `bin/antrean.py` | Tambah status `tayang` ke daftar status yang sah. Tambah pencatatan hasil `kirim_telegram()` ke log harian (perbaikan No. 2). |
| `bin/cfa_publish.py` | Ubah judul pesan menjadi "🗓️ CFA · Terjadwal (belum tayang)" dan ganti ID dengan label yang mudah dibaca (perbaikan No. 3). Jangan kirim Pesan A di sini kalau item sudah punya `notif.video_siap`. |
| `bin/cfa_produksi.py` + `bin/cfa_publish.py` | **Wajib (disetujui):** pesan putaran kosong (perbaikan No. 1). Kirim Telegram di jalur `return` "Tidak ada pekerjaan produksi" / "Tidak ada video untuk dicek", kecuali `--dry-run` atau `config.json` → `notifikasi.putaran_kosong` = `false`. |
| `KONTRAK.md`, `README.md` | Tambah status `tayang` dan field `notif` + `publish.hasil.link`. |
| `~/.claude/skills/cfa-publish/SKILL.md` | Perbarui kalimat notifikasi: skrip kini juga mengirim kabar "video siap ditonton" dan "sudah tayang + link post". Tidak ada skill atau jadwal baru (Opsi C). |
| `bin/cfa_publish.py` (tambahan Opsi C) | Panggil fungsi pemantau di awal `main()`. **Jangan berhenti** di "Tidak ada video untuk dicek" sebelum pengecekan item `terjadwal` selesai. Gabungkan Pesan A/B/C ke satu kiriman Telegram. Mode `--dry-run` tidak mengubah status dan tidak mengirim. |

**Field baru pada item:**

```json
"notif": { "video_siap": "2026-11-16T21:42:00+07:00", "tayang": "2026-11-17T08:30:00+07:00", "tertunda_2jam": null },
"publish": { "hasil": { "job_ids": ["..."], "status": "tayang",
  "link": { "youtube": "https://...", "facebook": "https://...", "instagram": "https://...", "tiktok": "https://..." } } }
```

**Uji sebelum aktif:** jalankan `cfa_pantau.py --dry-run` pada item 16 dan 17 Nov (sudah ada yang tayang dan yang dibatalkan), lalu pastikan isi pesan benar tanpa mengirim. Setelah itu kirim satu pesan uji ke Telegram dan klik setiap link.

---

## 8. Keputusan yang perlu Anda ambil

1. ~~Cara menjalankan pemantau~~. **Diputuskan: Opsi C (ikut cfa-publish)**, 17 Nov 2026. Opsional: tambah jam 22:30 pada tugas CFA · Publish (lihat 4c).
2. ~~Pesan putaran kosong~~. **Diputuskan: PAKAI** (17 Nov 2026). Berlaku di `cfa_produksi.py` dan `cfa_publish.py`, contohnya `💤 Tidak ada naskah untuk diproduksi malam ini (2 naskah menunggu tanggalnya)`. Bisa dimatikan lewat `config.json` → `notifikasi.putaran_kosong: false` (default `true`).
3. ~~Cek link Instagram~~. Sudah dicek: **rusak**. **Perbaikan di CF Studio DISETUJUI** (17 Nov 2026).
   - **Syarat yang belum terpenuhi (dicek 17 Nov 2026):** di CF Studio, semua akun publish (termasuk Instagram NutriBake ID, Dapur Botani, Ruang Akustik, dan lainnya) tersambung **lewat Repliz saja**. Belum ada satu pun akun yang tersambung langsung ke Meta (tidak ada token Meta dan tidak ada Instagram User ID). Akibatnya, CF Studio belum punya "kunci" untuk menanyakan link resmi ke Meta.
   - **TEMUAN BARU (17 Nov 2026), dari referensi API Repliz `https://api.repliz.com/public-json`:** Repliz punya endpoint **Get Content** (`GET /public/content?accountId=...` dan `GET /public/content/{contentId}?accountId=...`). Endpoint ini mengambil daftar post langsung dari akun yang tersambung (YouTube, Instagram, Facebook, TikTok, Threads, LinkedIn), dan **setiap post membawa field `url`**. Sebaliknya, endpoint jadwal (`GET /public/schedule/{id}`) yang dipakai CF Studio sekarang **tidak** mengembalikan link post. Itu sebabnya CF Studio selama ini menyusun link sendiri.
     - Kekurangannya, contoh di dokumentasi hanya untuk Facebook (`https://facebook.com/<pageid_postid>`). **Belum terbukti** apakah `url` untuk Instagram berisi link resmi berkode pendek (`/reel/Cx1AbC…`). Ini perlu diuji sekali dengan kredensial Repliz tenant: panggil Get Content untuk akun Instagram NutriBake ID, lalu cari post dengan `id` = `18182999632431163`.
     - **Kalau terbukti benar,** jalur ini **lebih baik daripada menyambungkan Meta**: tidak perlu token Meta, berlaku untuk semua brand, dan memakai sambungan Repliz yang sudah ada.
   - **Urutan kerja (diperbarui):**
     0. *Antigravity:* uji Get Content Repliz untuk satu akun Instagram (baca saja, tanpa mencetak kredensial). Kalau `url` Instagram valid, ubah `lib/publishing-worker.js` supaya setelah job Instagram `published`, CF Studio memanggil `GET /public/content/{postId}?accountId=<provider_account_id>` (atau mencarinya di `GET /public/content`) dan menyimpan `url` ke `external_permalink` + `permalink_instagram`. Kalau panggilan gagal, pakai link cadangan. **Langkah 1 dan 2 di bawah tidak diperlukan.**
     1. *Pengguna (hanya bila langkah 0 gagal):* sambungkan akun Instagram Business + Halaman Facebook tiap brand ke Meta di menu Publishing/Settings CF Studio. Fitur verifikasinya sudah ada (`verifyInstagramAccount`). Akun ini hanya dipakai untuk membaca link, sedangkan posting tetap lewat Repliz.
     2. *Antigravity (hanya bila langkah 0 gagal):* di `lib/publishing-worker.js`, setelah job Instagram berstatus `published` via Repliz, cari akun Meta dengan brand/akun Instagram yang sama di tenant tersebut. Kalau ada, panggil `GET /<media-id>?fields=permalink` (pola yang sama dengan `lib/meta-publisher.js` ±baris 491–505), lalu simpan hasilnya ke `external_permalink` dan `permalink_instagram` di ContentFlow. Kalau tidak ada akun Meta atau panggilan gagal, biarkan link cadangan dan jangan gagalkan job.
     3. Tambah skrip perbaikan sekali jalan untuk memperbarui link Instagram lama yang sudah tayang.
   - **Sampai langkah 1 selesai,** notifikasi CFA memakai link cadangan halaman Reels akun (lihat bagian 6 no. 1).
   - Kalau langkah 0 menunjukkan `url` Instagram dari Repliz juga berupa angka, tanyakan ke support Repliz, atau lanjut ke langkah 1–2 (sambung Meta).
