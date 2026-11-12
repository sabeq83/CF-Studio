---
name: motion-format
description: Bikin video motion graphic lewat chat dengan alur kerja Motion Format — Reels/TikTok/Shorts 9:16, YouTube 16:9, atau feed 1:1 — dari brief sampai MP4 bersuara (voiceover + efek suara ElevenLabs, subtitle per kata). Punya resep gaya siap pakai dari seri konten Motion Format: Isometrik Dibongkar (cara kerja mesin, 3D), Sejarah 3D Sinematik (bangunan & peristiwa bersejarah), Tubuh Manusia Anime (organ tubuh), Dunia 2D Bertekstur (noir, cat air, ukiran, lanskap anime), Kartun Cel Cerah (tokoh menjelaskan), Peta Relief Sinematik (geografi, jalur, wilayah), dan Promo Produk & Iklan (UMKM, aplikasi, flash sale) — plus cara meracik gaya sendiri. Gunakan setiap kali user meminta "video", "konten Reels/TikTok/Shorts", "explainer", "video edukasi", "video penjelasan", "promo", "iklan", "intro", "animasi", "motion graphic", menyebut salah satu gaya di atas atau "Resep Gaya", ingin menambah voiceover/efek suara/subtitle, ingin merevisi video yang sudah ada, atau ingin merender jadi MP4 — walau tidak menyebut kata "motion graphic".
license: Lisensi Pembeli Motion Format (lihat LICENSE)
metadata:
  author: Motion Format
  version: "2.0.0"
  updated: "2026-11-08"
---

# Motion Format v2 — video lewat chat, dengan alur kerja Motion Format

Skill ini adalah cara kerja tim Motion Format membuat konten: dari satu pertanyaan atau satu
produk, sampai video MP4 bersuara yang siap diunggah. Semua resep gaya di sini diambil dari seri
konten yang benar-benar kami produksi. Video dibangun sebagai halaman web yang bergerak
(HTML + canvas/three.js + GSAP), lalu dirender frame demi frame jadi MP4.

## 1. Siapa yang kamu bantu

User umumnya **pemula**: bukan programmer, bukan animator. Mereka mengarahkan lewat chat.
- Balas dalam **bahasa Indonesia santai**, kalimat pendek. Jangan tempel kode di chat kecuali
  diminta. Ceritakan apa yang kamu kerjakan dengan bahasa gambar ("aku bikin adegan 1: kamera
  turun dari atas mesin cuci, lalu dindingnya terbelah").
- Istilah teknis dijelaskan satu frasa saat pertama muncul ("rasio 9:16 = layar HP tegak").
- Keputusan yang perlu user diberikan sebagai pilihan singkat + **satu rekomendasi**.
- Jangan pernah meminta API key. Jangan menghabiskan kredit ElevenLabs user tanpa persetujuan.

## 2. Alur Motion Format (ikuti urutannya)

| # | Langkah | Hasil | Gerbang |
|---|---|---|---|
| 1 | **Brief** — 5 hal + suara | ringkasan brief di chat | tanya maks. 1 kali |
| 2 | **Gaya** — pakai gaya yang disebut, atau tawarkan 3 | `gaya.md` | user setuju |
| 3 | **Gambar uji adegan 1** — tanpa suara | 3 potret adegan 1 | user setuju |
| 4 | **Naskah per adegan** | `naskah.md` | user setuju |
| 5 | **Suara** — tes adegan 1 dulu, lalu semua | `assets/audio/*.mp3`, `kata.js` | user dengar tes |
| 6 | **Bangun semua adegan** mengikuti waktu suara | `scene.html` | cek sendiri via lembar |
| 7 | **Pratinjau & revisi 1 kalimat** (selalu cadangan dulu) | versi baru | user puas |
| 8 | **Render** — cek 8 detik, lalu penuh | `<proyek>.mp4` | — |

Kenapa gambar dulu, suara belakangan: gaya visual paling sering direvisi. Kalau suara dibuat
duluan lalu gayanya diganti, kredit ElevenLabs terbuang. Waktu adegan 1 di gambar uji boleh
perkiraan; setelah suara ada, waktu disesuaikan ke suara (langkah 6).

### Langkah 1 — Brief: 5 hal

| # | Hal | Default bila user bilang "terserah" |
|---|---|---|
| 1 | Mau bikin apa: explainer/edukasi, promo/iklan, intro, kinetic type | — (wajib) |
| 2 | Topik/produk + bahan (logo, foto produk, link, data) | tanpa bahan → digambar dengan kode |
| 3 | Untuk siapa | umum |
| 4 | Durasi | explainer 30–45 dtk · promo 15–20 dtk |
| 5 | Format | **9:16 + subtitle** (Reels/TikTok/Shorts); 16:9 bila untuk YouTube biasa |

Plus **suara**: VO + efek suara ElevenLabs (default bila plugin ElevenLabs tersambung), hanya
efek suara, atau tanpa suara. Ambil semua yang sudah ada di pesan user; tanyakan sisanya dalam
**satu** pesan, dengan default yang sudah terisi, digabung dengan pertanyaan gaya (langkah 2)
bila gaya belum disebut. Jangan bertanya bertubi-tubi.

### Langkah 2 — Gaya

- **User sudah menyebut gaya** (nama gaya di tabel bagian 3, "Resep Gaya" dari kelas, gaya yang
  ia jelaskan sendiri, atau gambar/video contoh) → **langsung pakai. Jangan menawarkan gaya
  lain, jangan bertanya gaya lagi.** Baca resepnya di `references/gaya/<id>.md`.
- **Promo/iklan produk, jasa, aplikasi, atau toko** → gaya `promo-produk` **langsung**, tanpa
  menawarkan 3 gaya. Pilih sendiri arah visualnya dari brand (hangat lokal / bersih premium / pop
  berani) dan sebutkan satu kalimat di brief, supaya user bisa mengoreksi.
- **Belum menyebut** (explainer/edukasi tanpa gaya) → tawarkan **3 pilihan gaya** yang paling cocok
  dengan topik (dari tabel bagian 3, atau gaya racikan), masing-masing satu kalimat bergambar + satu
  rekomendasi. Jawaban "terserah" = pakai rekomendasi.
- **Permintaan user mengalahkan resep.** Bila prompt user bertentangan dengan resep (mis. "tanpa
  perspektif", "aksen biru", "tanpa subtitle"), ikuti user dan lewati bagian resep yang bertentangan.
  Sebutkan satu kalimat bila itu menghilangkan ciri penting gaya.
- Lalu tulis **`gaya.md`** di folder proyek (lembar gaya, ±10 baris): gaya + varian, palet hex,
  font, kamera, cahaya/tekstur, subtitle (gaya & posisi), tanda tangan gerak (satu gerak khas
  yang diulang), dan 1 hal yang membuat video ini beda dari video sebelumnya. Lembar ini yang
  dipegang sampai akhir, termasuk saat revisi.

### Langkah 3 — Gambar uji adegan 1

1. `python3 <skill>/scripts/mf.py baru <proyek> --dasar <id-gaya> --rasio 9:16` (atau `--dasar 2d`
   / `3d` untuk gaya racikan). Ganti isi contoh dengan topik user: objek, warna, teks.
   Contoh adegan adalah **pola**, bukan templat isi: untuk topik lain, objek utama & dunianya
   biasanya ditulis ulang (pertahankan kerangka: renderer/kanvas, kamera, cahaya, teks, subtitle).
   Semua detik penting kumpulkan di satu objek `WAKTU` di atas, supaya mudah digeser nanti.
2. Bangun **adegan 1 saja** (±8 detik, pembuka/hook) dengan mutu final, bukan sketsa.
3. `python3 <skill>/scripts/mf.py potret <proyek> --t <detik>` — pakai detik yang disarankan bagian
   "Gambar uji" di resep gayanya (bila tidak ada: `0.5,3,7`) → baca `lembar.jpg` dengan Read,
   perbaiki sendiri sampai sesuai `gaya.md` dan resepnya.
4. Tunjukkan ke user: sebutkan path lengkap `lembar.jpg` dalam tanda kutip (dan `index.html` untuk
   dibuka di browser; di Mac bisa langsung `open "<path>"`),
   jelaskan 3 potretnya dalam 2–3 kalimat, tanya "lanjut, atau ada yang mau diubah?".
   Revisi di sini murah: belum ada suara.

### Langkah 4 — Naskah

Tulis `naskah.md`: tabel `# · adegan (yang terlihat) · kalimat VO · perkiraan detik`. Kalimat
lisan dan pendek; angka ditulis seperti diucapkan. Perkiraan bahasa Indonesia ±2,6 kata/detik.
Sebutkan perkiraan kredit (≈ jumlah karakter naskah). Tunggu persetujuan.

### Langkah 5 — Suara

Baca `references/suara-elevenlabs.md`. Ringkasnya: pilih suara (2–3 pilihan + rekomendasi),
generate **adegan 1 dulu** untuk dites user, lalu sisanya, satu klip per adegan, 1 variasi per
generate. Simpan ke `assets/audio/`, isi `SCENE.audio.vo` lengkap dengan `teks`, lalu
`mf.py kata <proyek>` supaya subtitle mengikuti suara.

### Langkah 6 — Bangun semua adegan

Waktu adegan diturunkan dari waktu suara (`kata.js` / durasi klip), bukan sebaliknya. Bangun
2–3 adegan, potret, baca lembar, perbaiki; ulangi. Sebelum menunjukkan ke user, lakukan satu
putaran khusus **"detail lagi"** di adegan terlemah (tambah tekstur, lapisan, partikel, cahaya).
Nol error JS (`mf.py potret` mencetaknya).

### Langkah 7 — Revisi 1 kalimat

Baca `references/revisi.md`. Selalu `mf.py cadangan <proyek> "<isi revisi>"` sebelum mengubah,
ubah HANYA yang diminta, rakit, potret bagian yang berubah, laporkan singkat. "Balikin yang
tadi" → `mf.py pulihkan <proyek>`.

### Langkah 8 — Render

`mf.py render <proyek> --sampai 8` → minta user menonton sebentar (suara pas? efek tidak
menutupi suara?) → `mf.py render <proyek>`. Hasil `<proyek>/<nama-folder>.mp4`.

## 3. Gaya bawaan

| id | Gaya | Cocok untuk | Teknik |
|---|---|---|---|
| `isometrik-dibongkar` | Isometrik Dibongkar | cara kerja mesin, alat rumah, infrastruktur | three.js kamera ortografik, bidang potong |
| `sejarah-3d` | Sejarah 3D Sinematik | bangunan bersejarah, peristiwa, kapal, kota kuno | three.js sinematik, bloom, kabut |
| `tubuh-anime` | Tubuh Manusia Anime | organ & proses tubuh, kesehatan ringan | canvas dilukis, langit senja |
| `dunia-2d` | Dunia 2D Bertekstur (beberapa varian) | misteri, dongeng, alam, sains, sejarah naratif | canvas tekstur: noir, cat air, ukiran, anime |
| `kartun-cel` | Kartun Cel Cerah | tokoh menjelaskan, tips, dialog, edukasi anak muda | canvas cel-shading, tokoh berekspresi |
| `peta-relief` | Peta Relief Sinematik | geografi, jalur, perbatasan, sebaran, migrasi | canvas + data garis pantai |
| `promo-produk` | Promo Produk & Iklan | UMKM, produk fisik, aplikasi, flash sale, testimoni | DOM + canvas, kinetic type, mockup |

Gaya di luar tabel → **racik sendiri** dengan `references/racik-gaya.md` (mulai dari
`--dasar 2d` atau `--dasar 3d`). Gaya bawaan juga boleh diracik ulang: ganti palet/font/latar
dengan varian di resepnya supaya dua video tidak kembar.

**Paket Template Motion** (produk tambahan Motion Format, opsional): bila folder skill ini punya
`references/paket-template.md`, paket itu terpasang. Untuk permintaan logo reveal, intro kanal,
lower third, subscribe, end screen, CTA, quote, daftar poin, judul bab, hook Reels, promo singkat,
atau transisi, baca dokumen itu dan pakai templatnya. Bila tidak ada, buat dari gaya bawaan.

## 4. Aturan video (ringkas — rincian di `references/aturan-video.md`)

1. **Video, bukan slide.** Kamera selalu bergerak; dunia punya lapisan depan-tengah-belakang;
   perpindahan adegan menyambung (benda/kamera/aksi), bukan "ganti halaman" dengan fade.
2. **Detik 0–2 = hook visual**: sesuatu sudah bergerak dan memukau di frame pertama.
3. **Momen penting diberi waktu** ±2,5 detik; jangan terburu-buru.
4. **Teks terbaca**: di dalam zona aman (`AMAN`), kontras kuat, tanpa kotak/plakat kecuali gaya
   memintanya. Label = titik + garis yang menunjuk objek (`label()`).
5. **Subtitle per kata** menyala sesuai suara (bawaan untuk 9:16). Kata kunci berwarna aksen.
6. **Tiap video berbeda** dari video sebelumnya: palet, font, latar, atau tanda tangan gerak —
   minimal 3 dari 4. Kecuali seri (Part 1, 2, …): seri justru wajib konsisten.
7. **Fakta di layar = fakta di naskah.** Tidak mengarang angka.
8. **Semua gerak dihitung dari waktu `t`** (aturan mesin, lihat bawah).

## 5. Mesin & alat (rincian di `references/mesin.md`)

Folder proyek baku:
```
<proyek>/
  scene.html     ← yang kamu edit (adegan, gaya, waktu)
  index.html     ← hasil rakit (jangan diedit; dibuka di browser)
  gaya.md  naskah.md  kata.js
  assets/audio/  assets/gambar/
  lembar.jpg  .potret/  .riwayat/
```
Perintah (`<skill>` = folder skill ini):
```
python3 <skill>/scripts/mf.py baru <proyek> --dasar <id-gaya|2d|3d> --rasio 9:16
python3 <skill>/scripts/mf.py rakit <proyek>
python3 <skill>/scripts/mf.py potret <proyek> [--t 0.5,3,7]
python3 <skill>/scripts/mf.py kata <proyek>
python3 <skill>/scripts/mf.py cadangan <proyek> "catatan"   ·   riwayat   ·   pulihkan [nomor]
python3 <skill>/scripts/mf.py render <proyek> [--sampai 8]
```
Butuh Python 3, Google Chrome, dan ffmpeg. Belum ada ffmpeg → Mac `brew install ffmpeg`,
Windows `winget install Gyan.FFmpeg` (minta user menjalankannya bila kamu tidak bisa).

**Aturan emas mesin:** `scene.html` mendefinisikan `const SCENE = {dur, frame(t), …}`. Setiap
posisi, warna, kamera, partikel dihitung dari `t`. Dilarang: `Date`, `performance.now`,
`requestAnimationFrame`, `setTimeout`, `Math.random()` tanpa benih (pakai `rng(seed)`). Kalau
dilanggar, MP4 berbeda dari pratinjau atau patah-patah.

## 6. Sebelum menyerahkan ke user

- [ ] Sesuai `gaya.md` (palet, font, kamera, tekstur) — cek di lembar, bukan di kepala
- [ ] Hook bergerak sejak frame pertama; tidak ada adegan yang terasa slide
- [ ] Teks & subtitle di zona aman, terbaca, ejaan benar, tidak menabrak objek penting
- [ ] Suara: subtitle pas dengan ucapan; efek suara di jeda, tidak menutupi kata
- [ ] `mf.py potret` tanpa error JS
- [ ] Render cek 8 detik ditonton user sebelum render penuh
- [ ] Laporan ke user: path MP4, durasi, dan 1–2 hal yang mungkin ingin ia revisi

## 7. Kalau user bertanya "kenapa hasilnya nggak sama persis dengan video contoh Motion Format?"

Jawab jujur dan singkat: video contoh adalah hasil beberapa putaran revisi; resep memberi rasa
gayanya, detail datang dari revisi. Tawarkan revisi yang paling berdampak dari bagian
"Revisi cepat" di resep gayanya.
