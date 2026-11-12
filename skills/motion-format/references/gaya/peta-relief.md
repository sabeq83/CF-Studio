# Gaya: Peta Relief Sinematik

> Peta timbul yang terasa seperti dokumenter: garis pantai asli, gunung yang bayangannya jatuh, laut bergradasi kedalaman, dan kamera yang terbang dari bola dunia sampai ke selat. Contoh di seri kami: "Dulu bisa jalan kaki ke Kalimantan" (Sundaland zaman es), "Letusan supervulkan Toba", "Cincin Api Indonesia".

## Cocok untuk · tidak cocok untuk
- **Cocok:** sejarah dan geografi (selat, pulau, gunung api, zaman es, muka laut naik-turun), jalur dagang/migrasi/penerbangan, "kenapa kota X ada di situ", perbandingan ukuran wilayah, bencana yang punya lokasi (tsunami, letusan, banjir rob).
- **Cocok juga:** angka yang menempel ke tempat ("90.000 kapal lewat sini"), rute yang bergerak, titik-titik yang menyala berantai.
- **Tidak cocok:** topik tanpa lokasi (cara kerja kulkas, tips keuangan), cerita tokoh/dialog, proses di dalam benda. Pakai gaya lain.
- **Tidak cocok:** peta skala kota/jalan. Data yang dibawa skill adalah Natural Earth 1:50 juta. Selat, pulau besar, dan teluk aman. Pulau < ±8 km dan pelabuhan sempit tidak ada.

## Ciri wajib
1. **Data nyata, bukan gambar tangan.** Garis pantai SELALU dari `daratan-50m.js` (Natural Earth, domain publik). Gunung, paparan dangkal, dan rute ditambahkan sebagai koordinat lon/lat, dan nilainya diperkirakan dengan jujur.
2. **Kamera terbang terus, tidak pernah diam.** Pola baku: bola dunia berputar → kamera menukik → menembus awan (awan bertekstur kelabu-biru dengan bagian gelap + dip ke biru laut gelap; **tidak boleh kilatan putih**) → peta relief tegak-lurus (lihat dari atas) → crane turun menjadi miring 40–50°, menyusuri objek. Gunakan field of view 30° (lensa panjang = terasa "dokumenter"). Kunci kamera dihaluskan Catmull-Rom.
3. **Cahaya sore dari barat daya.** Matahari rendah (`MATAHARI=[-.55,.62,.56]`). Bayangan bukit + bayangan jatuh + AO dipanggang sekali. Relief dilebih-lebihkan ±15–20×, dan lereng untuk bayangan dipertajam ×2,2 supaya pegunungan "terbaca" di HP.
4. **Palet dasar "siang tropis":**
   - Hutan `#2b5226`/`#41702d`, kebun `#8a9450`, sawah `#9aa65a`, dataran tinggi `#6d6447`, batu `#8c8270`, pasir `#d8c99a`.
   - Laut dangkal `#4fb7bd` → paparan `#1f7f9c` → dalam `#0f3c66` → palung `#0a2547`, dengan buih pantai `#d9f4ee`.
   - Langit/kabut: gradasi `#3d6680 → #86a6b0 → #c5c8b8 → #d6c6a2`.
   - Teks krem `#fffaf0`/`#fff6e6`, aksen emas `#ffc76e`, garis emas `#c98a2c`, bayangan navy `rgba(6,20,32,.6)`.
5. **Laut bercerita.** Warna laut ikut kedalaman, ada 3 "gema" garis pantai tipis (gaya atlas), dan garis pantai bercahaya (fwidth di shader, tetap tajam saat zoom). Ada kilau matahari yang bergerak dan bayangan awan yang hanyut pelan.
6. **Lapisan sinematik:** tilt-shift (blur atas–bawah lewat `backdrop-filter`), vignette, butiran film `grainOn(.16)`, kabut udara di kejauhan, dan kabut tipis yang lewat di depan lensa.
7. **Tipografi (ukuran di 1080×1920):**
   - Font Google **Pathway Extreme** untuk kicker (700, 40 px, spasi .12em, garis emas di bawahnya), judul (900, 94 px, font-stretch 90%), angka (800, 168 px), dan subtitle (800, 70 px).
   - Font **Radio Canada** untuk nama wilayah (700, 50 px, HURUF BESAR, spasi .22em), keterangan angka (600, 54 px, emas), dan nama laut (italic 600, 46 px).
   - Semua teks memakai bayangan navy, tanpa kotak.
8. **Subtitle:** tanpa kotak atau pita, potongan 1–3 kata (`maks:3`), muncul per kata dengan "pop", dan kata kunci berwarna emas. **Posisi berpindah per frasa ke ruang kosong**: fungsi `slotSub()` memilih slot yang terjauh dari label, judul, dan penghitung pada detik frasa itu muncul.
9. **Label menempel ke peta:**
   - Nama wilayah ditempel ke titik lon/lat (`tempel()`), lalu dijepit ke zona aman.
   - Kota/titik penting memakai `label()` mesin (titik + garis + teks) yang mengikuti proyeksi kamera.
   - Pelabuhan/kota = cahaya hangat berdenyut.
10. **Rute = garis emas bercahaya:** halo lebar, garis putus-putus yang mengalir (`lineDashOffset = -t*60`), dan "kapal/pejalan" berupa kapsul terang dengan jejak buih. Muncul bertahap mengikuti waktu.

## Yang boleh berubah per video (supaya tidak kembar)
| Set | Rasa | Palet inti | Font | Catatan |
|---|---|---|---|---|
| **A · Siang tropis** (bawaan contoh) | cerah, dokumenter | hijau hutan, laut toska → navy, emas | Pathway Extreme + Radio Canada | selat, pulau, jalur dagang |
| **B · Malam bercahaya** | dramatis, "peta perang" | darat arang-biru `#1e2a3a`/`#2c3b4f`, laut `#050d1c → #0d2340`, pendar `#ff8a3d`/`#ffd27a` | Bebas Neue + Oswald 600 | gunung api, gempa, titik menyala berantai. Matikan `WARNA.kebun/sawah`, naikkan gema pantai |
| **C · Senja membara** | tegang lalu lega | langit indigo `#2b2350` → jingga `#e9925a`, cahaya keemasan `MATAHARI` lebih rendah (y .35) | Mona Sans (900 lebar + italic) | letusan, perubahan zaman. Ganti palet di tengah video (senja → pagi) |
| **D · Atlas pagi** | ringan, edukatif | laut `#7cc4d0 → #2f7fa8`, darat `#9db37a`, teks navy `#16324a` di atas krem | Fraunces 800 + Instrument Sans | anak sekolah, perbandingan ukuran |
- Ubah juga **arah matahari** (pagi dari timur = `[.6,.55,.4]`), **sudut akhir kamera**, dan **rute** (garis emas → putih putus-putus untuk migrasi, merah untuk ancaman).
- Jangan mengganti palet + font + gerak sekaligus dalam satu video. Satu set per video.

## Kerangka adegan Shorts 30–60 dtk
| Detik | Adegan | Kamera | Isi |
|---|---|---|---|
| 0–2,5 | **Hook bola dunia** | bola berputar ke lokasi, jarak 7,2 → 1,45 (menukik) | kicker 1 baris + rute dunia yang menyatu ke satu titik bercahaya + label nama tempat |
| 2,2–3,0 | Tembus awan | awan membesar ke luar layar | awan bergradasi + dip biru gelap; ganti adegan di baliknya |
| 3–8 | Peta relief dari atas | tegak lurus → miring | judul besar, nama wilayah, rute digambar |
| 8–20 | Masalah/fakta 1 | menyusuri rute, crane turun | angka besar menghitung naik, kapal/titik bergerak, cincin "titik penting" |
| 20–35 | Fakta 2–3 | terbang ke lokasi kedua (geser ±3–6°) | label kota (`label()`), perubahan peta (laut surut, titik menyala, wilayah diwarnai) |
| 35–50 | Puncak / "aha" | mundur lebar atau orbit | semua rute/titik menyala bersamaan, bandingkan sebelum ↔ sesudah |
| 50–60 | Penutup | crane naik pelan, tahan | satu kalimat kesimpulan, keadaan akhir stabil (bisa di-loop) |
- **Versi 16:9:**
  - Scene sudah aman rasio: kanvas mengikuti W×H, penghitung dan scrim memakai `AMAN`, dan slot subtitle berubah sendiri.
  - Pada 16:9 kamera melihat lebih lebar. Naikkan `miring` 5–8°, kecilkan `jarak` ±20%, dan cek ulang label wilayah yang bisa menabrak judul.
  - Judul boleh 96 px.

## Gerak & transisi
- **Pindah adegan = gerak kamera yang menyambung:** menembus awan, menyusuri rute, terbang ke timur, mengorbit. Tidak ada potongan keras atau fade hitam.
- Kunci kamera medan: `[t, lon, lat, jarak, arah°, miring°]`.
  - Arah 0 = menghadap utara, −45 = barat laut.
  - Miring 86 = hampir tegak lurus. Jangan 90, karena arah atas kamera jadi tak tentu.
- Kunci bola: `[t, lon, lat, jarak]`. Jarak bola turun secara eksponensial (zoom terasa konstan).
- **Teks:**
  - Kicker dan judul masuk per kata (`wIn`, blur 12–16).
  - Nama wilayah naik 24 px sambil memudar dalam 0,6 dtk.
  - Angka menghitung dengan `E.out` selama 1,5–2 dtk, lalu "+" muncul di akhir.
- Goyang halus kamera `nz()` maksimal ±0,6° arah dan ±0,5° miring. Lebih dari itu terasa mabuk.
- Rute muncul `E.io` 1,5–2 dtk. Kapal muncul sesudah rute separuh jadi.
- Awan transisi: tutupan naik 1,7→2,2, puncak sampai 2,5, terbuka 2,5→3,0. Gumpalan dipanggang dengan bawah gelap kebiruan + atas terang tipis, di atas selubung biru laut gelap (maks 90%). Jangan pernah mengisi layar dengan putih/abu terang: aturan seri melarang kilatan putih.
- Teks kepala (kicker, judul) dijepit ke lebar `AMAN` (kiri 70 – kanan 930). Judul panjang: kecilkan atau pecah 2 baris, jangan sampai tepi layar.

## Suara
- **VO (ElevenLabs v4):** suara pria/wanita hangat ala narator dokumenter, tempo sedang (±2,7 kata/dtk), nada "cerita rahasia". Pakai tag gaya seperlunya: `[curious]` di hook, `[serious]` di angka, `[warm]` di penutup. Kalimat pendek dan angka dieja sebagai kata ("sembilan puluh ribu").
- **Musik:** ambient sinematik pelan (pad + perkusi lembut), volume 0,25–0,3, turun saat VO (duck).
- **SFX:** satu bunyi per momen, pelan (vol 0,15–0,22), dan diletakkan di jeda VO:
  - angin/whoosh lembut saat kamera menembus awan;
  - "swish" saat rute tergambar;
  - "tick" kecil saat angka mulai menghitung;
  - deru rendah saat wilayah menyatu atau laut surut;
  - ombak loop pelan saat kapal muncul (vol 0,12).
- Jangan menaruh SFX setiap kali label muncul. Lebih jarang lebih baik.

## Cara membangun
1. Buat proyek. `mf.py baru` otomatis ikut menyalin `daratan-50m.js` ke folder proyek; perintah `cp` di bawah hanya perlu bila file itu terhapus atau proyek dibuat dari `--dasar 2d/3d`:
   ```bash
   MF_PORT=9444 python3 <folder-skill>/scripts/mf.py baru <proyek> --dasar peta-relief
   cp "<folder-skill>/assets/gaya/peta-relief/daratan-50m.js" "<proyek>/"
   MF_PORT=9444 python3 <folder-skill>/scripts/mf.py potret <proyek>
   ```
   Kalau file ini tidak ada, layar menampilkan pesan "daratan-50m.js belum ada" dan `potret` mencetak error. File 275 KB, berisi seluruh dunia, cukup disalin sekali per proyek.
2. **Peta bagian scene.html** (lihat komentar kepala):
   - **[A] TOPIK** adalah bagian yang hampir selalu diganti:
     - `WIL` = kotak relief. Maksimal ±15°×15°, dan `ppd` 80–110 (GW×GH ≤ 2,5 juta piksel supaya panggang < 1 dtk).
     - `PUNGGUNG` = garis pegunungan `[titik, tinggi m, lebar °]`; `GUNUNG` = `[lon, lat, tinggi m]`.
     - `PAPARAN` = poligon laut dangkal. Kosongkan `[]` bila semua laut dalam.
     - `JALUR`/`CABANG` = rute; `TITIK` = jangkar label; `PELABUHAN` = titik cahaya; `DUNIA` = rute di bola.
   - **[B]** baca data + noise + jarak. **[C]** panggang. **[D]/[E]** three.js. Bagian-bagian ini jarang disentuh.
   - **[F] KAMERA:** ganti `KB` (bola) dan `KM` (medan).
   - **[G]** rute, kapal, dan awan. **[H]** teks, waktu, subtitle, dan `frame(t)`.
   - Teks tetap di `@BODY`: kicker, judul, nama wilayah, penghitung.
3. **Topik baru, urutannya:**
   1. Isi `WIL`.
   2. Lihat dari atas dulu dengan `KM` sementara `[[0, lonTengah, latTengah, 26, 0, 89.5],[9, …sama…]]`, lalu potret. Pastikan bentuk pulau benar.
   3. Isi gunung, rute, dan titik.
   4. Susun kunci kamera.
   5. Pasang teks dan waktu.
4. **Cek titik di darat/laut** sebelum memasang gunung atau kapal (data 1:50 jt bisa meleset 1–5 km):
   ```js
   // di konsol index.html?debug=1 :
   [[101.26,-1.7],[103.8,1.15]].map(([lo,la]) => tinggiDi(lo,la) > 0 ? 'darat' : 'laut')
   ```
5. **Pola penting (sudah ada di contoh, tinggal pakai):**
   ```js
   // kamera medan dari kunci (Catmull-Rom, tidak berhenti di kunci)
   const KM = [[2.3, 100.6, 3.2, 24, -20, 86], [4.6, 101.4, 2.7, 15, -34, 66], [9, 103.5, 1.5, 6.6, -52, 43]];
   // tempel nama wilayah ke peta: tempel(el, lon, lat, t, muncul, hilang)
   tempel($('#pSum'), 101.9, 1.0, t, 4.0, 99);
   // titik kota dengan garis penunjuk dari mesin, ikut kamera
   const sg = layar(keDunia(103.82, 1.33, .01)); L_SG.atur(t, 6.0, 99, sg.x, sg.y);
   ```
   - Warna peta diubah di objek `WARNA`.
   - Untuk efek "muka laut turun": tambahkan uniform level di shader medan, lalu warnai piksel dengan `kedalaman < level` sebagai daratan baru. Tinggi laut sudah tersimpan di `hm` saat panggang (negatif = kedalaman).
6. **Bujur di lintang tinggi** sudah dikoreksi `KX = cos(lintang tengah)`. Eropa/Jepang tidak gepeng.
7. Ukuran: scene.html ±43 KB. Satu frame dirender ±0,05–0,15 dtk. Panggang ±0,5–1 dtk saat halaman dibuka.

## Gambar uji adegan 1 (wajib dicek sebelum lanjut ke suara)
Jalankan `mf.py potret <proyek> --t 0.6,1.5,3.0,6.0,<akhir>`, buka `lembar.jpg`, lalu periksa:
1. **Detik ±0,6 (bola):**
   - Benua terbaca dan lokasi topik ada di sisi yang menghadap kamera.
   - Tidak ada garis lurus melintang di bola.
   - Kicker terbaca di atas angkasa gelap.
2. **Detik ±3,0 (peta dari atas):**
   - Bentuk pulau/selat cocok dengan peta sungguhan. Bandingkan dengan ingatanmu: Sumatra di kiri bawah, semenanjung di kanan.
   - Gunung punya sisi terang/gelap yang jelas.
   - Laut dangkal lebih terang daripada laut dalam.
3. **Detik akhir (miring):**
   - Objek utama (selat, kota, rute) ada di tengah sepertiga atas–tengah.
   - Judul, label, penghitung, dan subtitle tidak saling menimpa.
   - Kapal/titik terlihat sebagai benda, bukan debu.
   - Tepi kotak relief tidak terlihat.
- Selain itu: `error halaman: tidak ada`, dan tidak ada potret yang putih/terang penuh (termasuk di detik awan), dan teks kepala tidak menyentuh tepi kiri–kanan.

## Jebakan yang sudah pernah terjadi → perbaikannya
- **Garis hitam berkedip (z-fighting) di tampilan jauh** → `near`/`far` kamera dihitung dari jarak (`near = jarak*.03`, `far = jarak*6`). Jangan pakai angka tetap.
- **Kamera tersendat di setiap kunci** → jangan pakai `E.io` per segmen. Pakai `kurva()` (Catmull-Rom) melintasi semua kunci.
- **Relief lunak/berbintik saat close-up** (tekstur panggang terlalu kecil) → naikkan `ppd` (maksimal ±110 untuk kotak 15°), atau perkecil `WIL`. Relief mikro di shader menambah ketajaman. Garis pantai tetap tajam karena digambar dengan `fwidth`.
- **Pulau kecil hilang atau titik gunung api tampil di laut** (data skala kecil) → cek dengan `tinggiDi()`, geser titik ke darat terdekat, dan jangan menyebut nama pulau yang tidak terlihat.
- **Garis lurus melintang di bola** (cincin melewati garis 180°, misalnya Fiji dan Chukotka) → cincin diputus bila loncatan bujur > 180° (sudah ada di `teksturBola`).
- **Tepi kotak relief tampak sebagai pinggir terpotong** → ada laut luar raksasa + kabut. Bila masih tampak, kecilkan `jarak` atau naikkan `miring`, atau perluas `WIL`.
- **Halaman "tidak pernah siap" tanpa error** → ada error di `frame(0)` yang tertelan janji (promise). Buka index.html, lalu di konsol jalankan `MF.seek(0)` untuk melihat pesannya. Contoh kasus: fungsi menggambar yang mengembalikan `undefined` di detik 0.
- **Label wilayah keluar layar / menabrak judul** → `tempel()` menjepit x ke `AMAN`. Pilih jangkar label di daratan yang terlihat pada detik label itu muncul, bukan di pusat pulau.
- **Subtitle menimpa label** → slot dipilih otomatis oleh `slotSub()`. Kalau masih menimpa, tambahkan titik penghalang di `halangan(t)` (jangkar label baru + detik munculnya), atau ubah daftar `SLOT`. Slot dihitung sekali untuk semua frasa, jadi hasil render selalu sama.
- **Subtitle pakai kotak gelap** → dilarang di seri ini. Keterbacaan dari bayangan teks + scrim gradasi di atas dan di bawah.
- **Ilustrasi datar (hewan, kapal kartun) terasa "ditempel" di peta 3D** → ukur dari proyeksi kamera, beri bayangan kontak, dan ikut goyang kamera. Lebih aman: kapsul cahaya sederhana seperti di contoh.
- **Fakta di layar meleset** → setiap angka/tanggal di layar harus punya sumber. Tulis sumbernya di `naskah.md`. Bentuk gunung, sungai purba, dan garis paparan adalah perkiraan, jadi jangan diklaim presisi.

## Revisi cepat
- **Kalau peta terasa datar/kusam** → naikkan `SKALA_TINGGI` (.0002) atau `LERENG_BAYANG` (2,8), turunkan `MATAHARI` y ke .5, dan naikkan kontras `WARNA.hutan` vs `WARNA.kebun`.
- **Kalau terasa seperti Google Maps (terlalu rata dan atas)** → akhiri di `miring` 38–45° dengan `jarak` lebih kecil, tambah tilt-shift, dan pastikan kamera masih bergerak di detik terakhir.
- **Kalau teks sulit terbaca di atas daratan** → tebalkan scrim atas (`#scrimA`) atau scrim penghitung (`#scrimB`), pindahkan subtitle ke laut lewat `SLOT`, dan jangan pakai kotak.
- **Kalau kapal/titik tidak kelihatan di HP** → naikkan batas bawah ukuran kapal (`clamp(..., 7, 26)` → 10), tambah halo, dan kurangi jumlah supaya tidak jadi debu.
- **Kalau transisi awan jadi kilatan terang** → turunkan alpha lapisan terang di `PUFF` (.34 → .25) dan naikkan selubung biru gelap di `gambarAwan()`. Geser `tutup` bila terlalu lama.
- **Kalau user minta "lebih detail"** → tambah lapisan, bukan efek:
  - sungai utama sebagai garis biru tipis di panggang (kanvas, seperti PAPARAN);
  - kota kecil sebagai titik cahaya;
  - awan tipis kedua;
  - 1–2 label laut italic;
  - gema garis pantai keempat.
