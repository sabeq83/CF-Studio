# Analisa & Usulan: Konten NutriBake 18 Nov 2026 Tidak Tayang — Produksi Bertahap, Pemulihan Otomatis, Notifikasi URGENT

Tanggal: 18 November 2026 · Revisi 4 (ide pengguna: jeda 10–15 menit per video, auto-retry, notifikasi URGENT per video, cek produksi per jam; fakta jeda prompt T2I/I2V 10–20 detik & bridging eksklusif) · Status: usulan, belum ada perubahan kode

---

## 1. Ringkasan Masalah

Keempat video NutriBake 18 Nov **tidak pernah sampai ke Repliz** karena macet di CF Studio pada tahap paling awal: pembuatan gambar awal tiap klip (*start frame*).

- **17 Nov 15:14**: CFA mengirim 7 naskah ke CF Studio **pada detik yang sama**.
- Kelima video (4 NutriBake dan 1 Habitfolk) berebut **satu jalur pembuat gambar G-Labs**. Akibatnya ada dua error:
  - database saling mengunci (*deadlock*);
  - klip produk menunggu antrean lebih dari 5 menit lalu dibatalkan (*timeout*).
- Tiap video hanya punya 5 dari 6 gambar (video oat 0/6). CF Studio **tidak mencoba ulang**, sehingga video berhenti di tahap itu.
- **18 Nov 06:12**: `cfa-publish` baru menyerah pada putaran pagi (batas `BATAS_JAM` 8 jam; saat dicek video sudah berumur 15 jam) dan menandai "perlu review", hanya lewat satu pesan ringkasan Telegram.

Kiriman 18 Nov 15:14 (untuk tayang 19 Nov) **terulang dengan pola yang sama**. Pemulihan manual untuk #2257, #2259, dan #2260 sedang dijalankan.

Ini sejalan dengan pengalaman Anda: saat jadwal Auto Pipeline diberi jarak minimal 15 menit per video, kegagalan jarang terjadi. Masalahnya bukan pada naskah atau produk, tetapi pada **pengiriman serentak**.

| Item CFA | Item CF Studio | Gambar awal | Klip hilang |
|---|---|---|---|
| nutribake cocoa (18 Nov) | #2244 | 5/6 | 6 |
| nutribake darkchoco (18 Nov) | #2245 | 5/6 | 4 |
| nutribake oat (18 Nov) | #2246 | 0/6 | semua |
| nutribake peanutbutter (18 Nov) | #2247 | 5/6 | 4 |
| habitfolk food (18 Nov) | #2248 | 6/8 | 3, 6 |

### Temuan tambahan (18 Nov 16:20): penjadwal kampanye CF Studio Staging berhenti

Sejak **18 Nov 15:42** penjadwal kampanye Staging tidak menjalankan langkah apa pun. Tidak ada satu pun langkah baru yang dimulai, dan pekerja gambar awal tidak mengambil antrean. (Pesan `[Campaign Scheduler] Already running.` setiap 10 detik ternyata suara normal, bukan tanda macet. Penyebab yang lebih mungkin: pekerja gambar awal dan penjadwal tidak punya batas waktu, sehingga satu proses yang menggantung menghentikan antrean.) Sementara itu tidak ada kunci jalur G-Labs yang tertahan, dan tidak ada query database yang menggantung. Akibatnya regenerasi yang diantrekan (#2257, #2262) diam di `queued 0/6`, dan **semua** video untuk 19 Nov selain NutriBake darkchoco (#2258) belum jadi, termasuk Dapur Botani #2263 dan Habitfolk #2261/#2262.

Ini kegagalan jenis kedua: bukan satu gambar yang gagal, tetapi mesin produksinya sendiri yang berhenti. Kemungkinan besar terkait error *uncaughtException* koneksi database di atas. Pemulihan saat ini: restart proses `maknaflow-staging-ui`.

---

## 2. Usulan Perbaikan (3 lapis)

```
 Lapis 1: CEGAH            Lapis 2: PULIHKAN SENDIRI         Lapis 3: PANGGIL MANUSIA
 Kirim bertahap      ──▶   CFA mendeteksi macet & coba   ──▶  🚨 URGENT Telegram
 (jarak 5–10 menit)        ulang otomatis (maks. 3 langkah)    satu pesan per video
```

### Lapis 1 — Produksi Bertahap (jawaban ide no. 1, disepakati 10–15 menit)

**Cara CF Studio mengirim pekerjaan ke G-Labs dalam satu video produk** (fakta dari pengguna, cocok dengan log):

| Tahap | Cara kirim | Tujuan |
|---|---|---|
| Gambar awal (T2I) klip **non-bridging** | prompt T2I dikirim bergiliran, **jeda 10–20 detik** per prompt (jalur gambar *bersama*) | tidak menumpuk di G-Labs |
| Gambar awal (T2I) klip **bridging** (klip produk) | dikirim **khusus** (jalur gambar *eksklusif*) dan **ditunggu sampai selesai** | konsistensi produk di G-Labs |
| Video klip (I2V) | prompt I2V dikirim bergiliran, **jeda 10–20 detik** per prompt | tidak terjadi penumpukan threading di G-Labs |

Contoh nyata satu video yang berjalan relatif sendiri (Dapur Botani #2250, 17 Nov):

```
15:14  dikirim CFA → naskah diolah Gemini
15:20  referensi pakaian (wardrobe) dibuat
15:25  T2I non-bridging klip 1,2,3,5 dikirim bergiliran (±15 dtk)  → jadi 15:26
15:29  T2I bridging klip 4 (eksklusif, ditunggu)                     → jadi 15:30
15:34  T2I bridging klip 6 (eksklusif, ditunggu)                     → jadi 15:35
15:36  suara (TTS) selesai dalam ±12 dtk
15:36  I2V 6 klip dikirim bergiliran (±15 dtk per prompt)            → terkirim 15:37
15:39  semua klip video selesai dari G-Labs
15:42  render akhir (FFmpeg) selesai → video jadi
```

Masa satu video **memakai G-Labs**: dari T2I pertama sampai klip I2V terakhir selesai. Bila berjalan sendirian, sekitar **10–14 menit** (#2250 lebih lama karena berebut dengan 4 video lain). Uji regenerasi 18 Nov sore: gambar awal saja ±6 menit bila sendirian (#2260), ±11 menit bila berbagi dengan 1 video lain (#2257).

**Kenapa pengiriman serentak merusak aturan itu**: aturan jeda 10–20 detik dan jalur eksklusif hanya mengatur antrean **di dalam satu video**. Antar-video tidak ada pengatur. Pada 17 Nov 15:14, lima video sekaligus mengirim prompt T2I dan I2V-nya masing-masing ke G-Labs:
- Penumpukan threading yang ingin dicegah oleh jeda 10–20 detik tetap terjadi, karena lima video × jeda 10–20 detik = ±1 prompt setiap 2–4 detik.
- Klip bridging menunggu jalur eksklusif, yang baru kosong saat **tidak ada** video lain memakai jalur gambar. Dengan lima video bergantian, giliran itu tidak datang dalam 5 menit, sehingga klip 4/6 dibatalkan.

Jadi aturan per video sudah benar. Yang kurang adalah **jarak antar-video**. Pada jadwal Auto Pipeline biasa, jarak 15 menit membuat tiap video sempat menuntaskan T2I (termasuk bridging) dan pengiriman I2V-nya sendirian.

**Usulan jeda: 10–15 menit per video** (sesuai pengalaman Auto Pipeline, dan pas dengan masa pakai G-Labs ±10–14 menit per video):
- **Jeda pintar** di dalam rentang itu:
  - Tunggu **minimal 10 menit** setelah kiriman sebelumnya.
  - Setelah 10 menit, kirim video berikutnya **segera setelah video sebelumnya selesai memakai G-Labs**, yaitu gambar awal lengkap (termasuk bridging) **dan** semua klip I2V sudah selesai dari G-Labs (`visual_status = completed`). Tahap suara dan render akhir tidak memakai G-Labs, jadi tidak perlu ditunggu.
  - Bila sampai **15 menit** video sebelumnya belum selesai, tetap kirim berikutnya, supaya antrean malam tidak molor tanpa batas. Video yang lambat itu otomatis masuk pantauan Lapis 2.
- Dengan cara ini, pada satu waktu hanya ada **satu video yang mengirim prompt ke G-Labs**, persis kondisi yang dirancang oleh jeda 10–20 detik dan jalur eksklusif.
- Perkiraan waktu: 7 video × 10–15 menit = **±70–105 menit**. Produksi 21.00 selesai terkirim sekitar **22.10–22.45**, dan video terakhir jadi sekitar **23.00**. Masih jauh sebelum jam tayang pagi.
- Bila suatu hari jumlah video naik (mis. 15 video → ±2,5–3,5 jam), pertimbangkan memajukan jam produksi (mis. 19.00) daripada memperpendek jeda.

**Catatan penting soal cara jalan**: tugas `cfa-produksi` dijalankan oleh sesi Claude terjadwal. Agar sesi Claude tidak perlu "menunggu" selama satu jam (boros dan berisiko terputus), skrip produksi **melepas dirinya ke latar belakang** di Mac Mini:

1. Claude menjalankan `cfa_produksi.py`.
2. Skrip menyusun antrean malam itu, menyalakan "pengantar bertahap" di latar belakang, lalu langsung melapor "7 video diantrekan, dikirim bertahap mulai 21.14".
3. Sesi Claude selesai (hemat token). Pengantar bertahap terus jalan sendiri dan mengirim ringkasan Telegram setelah video terakhir terkirim.

Pengaman tambahan:
- **Kunci tunggal**: bila pengantar bertahap masih berjalan, putaran produksi berikutnya tidak menyalakan pengantar kedua.
- **Urutan prioritas**: video yang jam tayangnya paling pagi dikirim lebih dulu.
- **Sadar jalur lain**: sebelum mengirim, cek apakah ada video lain (PT GIM, Editorial, Multiplier, Auto Pipeline biasa) yang sedang membuat gambar awal **atau sedang mengirim/menunggu klip I2V**, karena semuanya memakai G-Labs yang sama. Bila ada, tunggu dulu (tetap dalam batas 15 menit).
- **Berlaku juga untuk kiriman siang**: PT GIM (`plan-today`/`plan-minggu`) pernah mengirim 4 video dalam satu menit (17 Nov 11:12). Aturan jeda yang sama dipakai di semua jalur CFA, bukan hanya NutriBake.

Pengaturan di `config.json` (bisa diubah tanpa ubah kode):

```json
"produksi_bertahap": {
  "aktif": true,
  "jeda_min_menit": 10,
  "jeda_maks_menit": 15,
  "tunggu_glabs_selesai": true,
  "cek_jalur_lain": true
}
```

### Lapis 2 — Pemulihan Otomatis (jawaban ide no. 2)

Kabar baiknya, **CF Studio sudah punya semua tombol "ulangi"** yang dibutuhkan. CFA tinggal memakainya secara otomatis, jadi **tidak perlu mengubah CF Studio** untuk tahap ini.

**Kapan dianggap macet** (dicek tiap 10 menit oleh pengantar bertahap, lalu di tiap putaran publish):

| Gejala | Dianggap macet bila |
|---|---|
| Gambar awal `partial` / `failed` | jumlah gambar jadi tidak bertambah selama **20 menit** |
| Suara / video / render `failed` | langsung |
| Tahap apa pun tidak bergerak | **90 menit** sejak dikirim tanpa kemajuan |

**Tangga pemulihan** (dijalankan satu video sekali waktu, supaya tidak menimbulkan tabrakan baru):

| Langkah | Tindakan | Tombol CF Studio yang dipakai | Tunggu |
|---|---|---|---|
| 1 | Buat ulang **semua gambar awal** video itu (sementara; nanti cukup klip yang kosong setelah perbaikan CF Studio poin 6) | `regenerate-start-frames` | 20 menit |
| 2 | Ulangi langkah 1 sekali lagi, **setelah** tidak ada video lain yang sedang memakai G-Labs (T2I maupun I2V) | `regenerate-start-frames` | 30 menit |
| 3 | **Kirim ulang naskah** sebagai produksi baru (hanya bila waktu tayang masih ≥ 3 jam lagi) | `cfa_produksi.py --id <item> --ulang` | 45 menit |
| — | Tahap suara/video/render yang gagal: ulangi tahap itu saja (maks. 2×) | `trigger` (step `tts` / `visuals` / `ffmpeg`) | 20 menit |

> ⚠️ **Hasil uji 18 Nov (#2260)**: tombol per klip (`regenerate-t2i`) **belum bisa dipakai untuk langkah 1**. Endpoint itu membuat revisi baru yang hanya berisi klip yang diulang. Klip lain yang sudah jadi tidak ikut terbawa, sehingga hitungan turun dari 5/6 menjadi 1/6 dan video tetap tidak lanjut. Sampai CF Studio diperbaiki (lihat bagian 3 poin 6), langkah 1 memakai `regenerate-start-frames` (buat ulang semua). Cara ini terbukti berhasil pada #2257 dan #2262 (±6–10 menit per video).

Setiap langkah dicatat di log harian CFA dan di item (`pemulihan: [{langkah, waktu, hasil}]`), sehingga laporan bisa menunjukkan "pulih otomatis di langkah 1".

Bila pulih, video lanjut normal dan dijadwalkan oleh `cfa-publish` seperti biasa. Bila pulih **setelah** jam tayangnya lewat, `cfa-publish` menjadwalkannya ke **slot kosong berikutnya di hari yang sama** (atau besok pagi bila sudah malam), lalu menyebutkannya di laporan.

**Siapa yang menjalankan pemulihan?** Lihat bagian berikut.

### Jadwal Cek Produksi per Jam — perlu atau tidak?

**Jawaban: perlu, sebagai jaring pengaman, tetapi bukan sebagai pekerja utama.**

Pembagian peran yang diusulkan:

| Penjaga | Kapan | Tugas | Kekuatan | Kelemahan |
|---|---|---|---|---|
| **Pengantar bertahap** (Lapis 1, latar belakang) | sejak produksi dikirim sampai semua video malam itu selesai (maks. 4 jam) | kirim bertahap, cek tiap 10 menit, jalankan tangga pemulihan | cepat tanggap, tanpa token Claude | ikut mati bila Mac Mini restart, proses terhenti, atau CF Studio berhenti |
| **CFA · Cek Produksi** (jadwal baru, tiap jam) | lihat jam di bawah | cek semua video berstatus `diproduksi`, lanjutkan tangga pemulihan bila macet, cek detak mesin CF Studio, kirim 🚨 URGENT bila perlu | tetap jalan walau pengantar mati; menangkap kiriman siang (PT GIM) | butuh sedikit token per putaran |
| **CFA · Publish** (06.00 & 12.00, sudah ada) | 2× sehari | menjadwalkan video jadi ke Repliz, pengecekan terakhir | sudah ada | terlalu jarang untuk deteksi dini |

Kejadian 18 Nov 15:42 (mesin CF Studio berhenti dan baru ketahuan ±40 menit kemudian karena kebetulan sedang dianalisa) menunjukkan bahwa penjaga di latar belakang saja **tidak cukup**. Butuh pemeriksa independen yang berjalan rutin.

**Rancangan "CFA · Cek Produksi"**:
- **Jam**: setiap jam **pada menit ke-30**, pukul **07.30–23.30**, ditambah **01.30 dan 03.30** pada malam hari. Total ±19 putaran per hari. Menit ke-30 dipilih agar tidak bertabrakan dengan tugas lain di menit 00 (publish 06.00/12.00, produksi 21.00, dll.).
  - Alternatif lebih hemat: tiap 2 jam (±10 putaran per hari). Deteksi lebih lambat, tetapi tetap jauh lebih cepat dari sekarang (8 jam).
- **Isi**: satu perintah skrip, mis. `python3 ~/cf-autopipeline/bin/cfa_pemulih.py`. Tanpa AI berat, model **Haiku**, sama seperti `cfa-publish`.
- **Diam bila sehat**: tidak ada pesan Telegram bila semua normal atau tidak ada video yang sedang diproduksi. Ringkasan rutin tetap dari tugas lain, supaya Telegram tidak ramai 19× sehari.
- **Bicara bila perlu**: ⚠️ singkat saat memulai pemulihan otomatis (cukup tercatat di log, tampil di ringkasan publish), 🚨 URGENT per video bila tangga habis atau jam tayang tinggal < 3 jam, 🚨 "mesin CF Studio berhenti" bila detak mesin hilang, ✅ PULIH bila beres.
- **Tidak bertabrakan dengan pengantar**: memakai kunci yang sama. Bila pengantar bertahap sedang aktif dan sehat, cek produksi hanya memeriksa detak mesin lalu selesai.
- **Biaya token**: kecil, karena tiap putaran hanya menjalankan satu skrip dan menyalin hasilnya (setara satu putaran `cfa-publish` dengan Haiku). Angka nyata bisa dilihat di laporan `cfa-token` setelah seminggu.

**Cara memasang**: sesuai kebiasaan Anda, jadwal dibuat sendiri lewat menu **Scheduled** di Claude Desktop Mac Mini. Setelah skripnya siap, akan disiapkan isian tugas (nama, jam, model, perintah) dan baris tambahan untuk `JADWAL_CFA.md`. Agen tidak mengaktifkan jadwal sendiri.

`BATAS_JAM` 8 jam di `cfa_publish.py` diganti oleh aturan di atas.

**Bila mesin produksinya yang berhenti** (lihat temuan 16:20): tangga pemulihan tidak akan menolong, karena perintah "ulangi" hanya masuk antrean dan tidak pernah diproses. Karena itu pemulih juga memeriksa **detak mesin**: bila ada ≥ 2 video yang sama sekali tidak bergerak (termasuk regenerasi `queued` > 20 menit), CFA **tidak** menumpuk perintah ulang lagi. CFA langsung mengirim satu 🚨 URGENT "Mesin produksi CF Studio Staging berhenti — perlu restart", lalu melanjutkan tangga setelah mesin jalan kembali. (Restart otomatis oleh CFA **tidak** diusulkan, karena Staging adalah lingkungan konten aktif.)

### Lapis 3 — Notifikasi 🚨 URGENT per Video (jawaban ide no. 3)

Bila tangga pemulihan habis dan tetap gagal, CFA mengirim **satu pesan Telegram terpisah untuk tiap video**, tidak digabung dengan ringkasan, supaya langsung terlihat.

Contoh pesan:

```
🚨 URGENT · CFA · NutriBake
Video: Oatmeal untuk Diet (produk: Oat)
Jadwal tayang: Kam 19 Nov, 09.30 WIB (⏳ 7 jam lagi)
Masalah: gambar awal klip 4 gagal dibuat (antrean G-Labs penuh)
Sudah dicoba otomatis:
  1. ulang klip kosong — gagal
  2. ulang semua gambar — gagal
  3. kirim ulang naskah — gagal
Yang perlu dilakukan: buka halaman review lalu cek gambar / Regenerate Start Frames
▶️ Buka di CF Studio
ID: 20261119-nutribake-produk-oat-menu-diet-sarapan
```

Aturan:
- **Satu video = satu pesan.** Ringkasan rutin tetap terkirim terpisah.
- **Tidak spam**: pesan URGENT untuk video yang sama dikirim **sekali**. Pengingat ulang hanya bila jam tayang tinggal ≤ 2 jam dan masih belum beres.
- **Kabar baik juga dikirim**: bila video yang sudah di-URGENT-kan kemudian pulih (manual atau otomatis), kirim `✅ PULIH · <judul> — dijadwalkan <jam>`.
- **Tingkat peringatan**:
  - ⚠️ *Perhatian*: pemulihan otomatis sedang berjalan (cukup tercantum di ringkasan, bukan pesan sendiri).
  - 🚨 *URGENT*: pemulihan otomatis habis, atau jam tayang tinggal < 3 jam dan video belum jadi.
- **Telegram gagal terkirim**: dicoba ulang (sudah ada di `kirim_telegram`). Bila tetap gagal, ditulis ke log harian dengan tanda `URGENT-TIDAK-TERKIRIM` agar terbaca di laporan berikutnya.

---

## 3. Perbaikan di CF Studio (akar masalah, menyusul lewat `hotfix/*`)

Lapis 1–3 di CFA sudah cukup untuk mencegah dan menangani kasus ini tanpa menyentuh CF Studio. Tetapi akar masalahnya tetap ada dan bisa mengenai menu lain (Editorial, Multiplier, PT GIM). Usulan lanjutan:

1. **Coba ulang otomatis di dalam CF Studio**: klip yang kosong karena timeout jalur atau deadlock diulangi otomatis (maks. 2×) sebelum status dianggap `partial`.
2. **Tangani deadlock database** (`40P01`) saat menyimpan gambar awal, dan perbaiki pelepasan koneksi ganda (`Release called on client…`) yang membuat server mencatat *uncaughtException*.
3. **Timeout jalur eksklusif** (`maxWaitMs = 300000`, `lib/glabs-image-lane-service.js`): jangan langsung gagal permanen, kembalikan klip ke antrean.
4. **Penjaga item macet** di server: tugas berkala yang mengantrekan ulang klip kosong pada item `partial` lebih dari 30 menit.
6. **Regenerasi per klip membawa klip lain**: `regenerate-t2i` (via `queueSingleStartFrameRevision`) harus membawa klip yang sudah `completed` dari revisi sebelumnya ke revisi baru (seperti `carryForwardCompleted` pada regenerasi massal). Sebaliknya, regenerasi massal dengan `carryForwardCompleted` sebaiknya hanya mengantrekan klip yang kosong. Saat ini keenam klip dibuat ulang, sehingga kuota G-Labs terbuang.
7. **Penjaga penjadwal (watchdog)**: bila satu putaran `Campaign Scheduler` berjalan lebih dari 15 menit tanpa langkah selesai, catat langkah yang menggantung, lepaskan kuncinya, dan beri batas waktu pada setiap langkah. Temuan 18 Nov 15:42 menunjukkan penjadwal bisa berhenti diam-diam.

Bila poin 1 dan 4 sudah jalan di CF Studio, Lapis 2 di CFA jarang terpakai dan berfungsi sebagai cadangan.

---

## 4. Urutan Pengerjaan yang Disarankan

| Urutan | Pekerjaan | Lokasi | Perkiraan | Dampak |
|---|---|---|---|---|
| 1 | Pemulihan manual video 19 Nov (#2257 ✅, #2260 ✅, #2262 ✅, #2263, #2259, #2261 berjalan bergiliran) | CF Studio Staging | hari ini | konten 19 Nov tayang |
| 2 | **Lapis 1**: produksi bertahap (jeda pintar 10–15 menit, berjalan di latar, semua jalur CFA) | `cfa_produksi.py` + `config.json` | ½ hari | mencegah sebagian besar kasus |
| 3 | **Lapis 3**: notifikasi URGENT per video + ✅ PULIH | `antrean.py` (fungsi kirim) + `cfa_publish.py` | ½ hari | tidak ada lagi kegagalan diam-diam |
| 4 | **Lapis 2**: deteksi macet, detak mesin, tangga pemulihan | modul baru `cfa_pemulih.py`, dipanggil dari pengantar & publish | 1 hari | pulih tanpa campur tangan |
| 5 | **Jadwal CFA · Cek Produksi** (tiap jam, menit ke-30) dipasang pengguna via menu Scheduled | Claude Desktop Mac Mini | 10 menit | jaring pengaman bila pengantar/mesin mati |
| 6 | Perbaikan CF Studio (bagian 3) | branch `hotfix/start-frame-retry` → Dev → Staging | 1–2 hari | akar masalah hilang untuk semua menu |

Lapis 3 sengaja didahulukan sebelum Lapis 2: lebih cepat dibuat, dan langsung menjamin Anda **tahu** saat ada masalah, sementara pemulihan otomatis sedang disiapkan.

### Uji yang disarankan sebelum dipakai harian
- `cfa_produksi.py --dry-run --bertahap`: tampilkan rencana jam kirim tiap video tanpa benar-benar mengirim.
- Simulasi macet: jalankan pemulih terhadap satu item uji (`uji: true`) yang sengaja dibuat partial. Pastikan langkah 1→3 berjalan berurutan dan pesan URGENT terkirim **sekali** per video.
- Satu malam pertama: pantau ringkasan Telegram. Jarak kirim harus 10–15 menit dan tidak ada error deadlock/timeout di log CF Studio.
- Cek produksi per jam: biarkan berjalan satu hari. Pastikan tidak ada pesan Telegram saat normal, dan laporan `cfa-token` menunjukkan biaya per putaran yang kecil.

---

## 5. Bukti Teknis (rujukan)

- Log CFA Mac Mini: `~/cf-autopipeline/log/2026-11-17.md`, `2026-11-18.md`
- Status DB: `staging.pillar_campaign_items` id 2244–2262 (`start_frame_status`, `t2i_images_json`)
- Log CF Studio: `~/maknaflow-staging-atomic/shared/logs/staging-ui.err.log`, rentang 17 Nov 15:19–15:28 dan 18 Nov 15:19–15:33 (deadlock, `Timeout waiting for G-Labs image lane (exclusive)`)
- Kode CFA: `cfa_produksi.py` (loop kirim tanpa jeda, `maks_produksi_per_putaran: 8`), `cfa_publish.py` (`BATAS_JAM` 8 jam, deteksi hanya `failed`), `antrean.py:kirim_telegram`
- Endpoint CF Studio yang dipakai pemulihan (sudah ada): `POST /api/v2/pillar-campaigns/items/<id>/regenerate-t2i`, `…/regenerate-start-frames`, `…/trigger` (step `tts|visuals|ffmpeg`), `…/re-ffmpeg`
- Kode CF Studio: `lib/glabs-image-lane-service.js:300-325` (timeout jalur), `lib/start-frame-contract.js:5` (status partial), `lib/pillar-start-frame-service.js:153` (antrean regenerasi)
