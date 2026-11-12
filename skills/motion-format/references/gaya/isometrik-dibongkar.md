# Gaya: Isometrik Dibongkar

> Benda sehari-hari dilihat dari pojok atas seperti maket, lalu kamera menyelam lewat lingkaran zoom, bendanya dibelah dengan bidang lurus, dan cara kerjanya mengalir sebagai cahaya. Rasanya seperti "anatomi mesin" yang rapi dan tenang. Seri asli kami: mesin jet, kincir angin, PLTA, lift, roda kereta, baterai HP, kompor gas, kapal selam, rice cooker, dan meter air PDAM, semua 9:16 dengan pola "jauh → zoom → bongkar → belah → cara kerja".

Contoh siap pakai: `assets/gaya/isometrik-dibongkar/scene.html` (10 dtk, "Gimana mesin cuci memeras baju?").

## Cocok untuk · tidak cocok untuk
**Cocok:** cara kerja benda & mesin (mesin cuci, kulkas, dispenser, pompa air, kipas, printer, kunci pintu, pembangkit), isi bangunan/infrastruktur (saluran, gardu, menara), penjelasan produk fisik, "apa yang terjadi di dalam …".
**Tidak cocok:** cerita bertokoh/emosi (gaya ini tanpa manusia & wajah), sejarah/peristiwa, data & angka abstrak tanpa benda, topik yang isinya tidak bisa dibelah (opini, tips umum). Untuk itu pilih gaya lain.

## Pilih mode dulu (satu baris di contoh: `const MODE='zoom'|'ortho'`)
- **`'zoom'` (bawaan, pola seri asli):** dunia ortografik → lingkaran zoom → studio close-up perspektif sempit + peta kecil.
- **`'ortho'` (isometrik murni):** pakai bila murid menulis "tanpa perspektif", "isometrik murni", "satu kamera", atau melarang lingkaran zoom. SATU kamera ortografik saja: lewati studio, lingkaran zoom, dan peta kecil. Kamera dunia mendorong ke benda (bingkai berhenti di tinggi benda ÷ 0,5), benda di dunia itu sendiri yang dilepas panelnya & dibelah, aliran dipasang di benda dunia, benda di depannya (`DEPAN`) disembunyikan saat mendekat. Jejak lokasi & angka ×N tetap ada (×1 → ×3).
- **`LEPAS=false`:** murid minta "irisan langsung" → panel tidak dilepas, benda langsung dibelah (panel ikut berpenampang).
- Aturan yang ditulis murid selalu menang atas ciri di bawah (warna, sudut, ada/tidaknya studio).

## Ciri wajib
1. **Dua dunia, dua kamera (mode `zoom`).**
   - DUNIA = diorama isometrik, three.js r128 `OrthographicCamera` (tanpa perspektif), azimut 45–49° dari pojok depan-kanan, elevasi ±30°, garis tegak tetap tegak.
   - STUDIO = close-up benda di renderer kedua, `PerspectiveCamera` sempit (fov 20–24°), azimut turun pelan 47° → ±27°, elevasi 30° → ±15°.
   - Kamera selalu bergerak pelan (dorong/orbit), tidak pernah diam.
2. **Diorama terpotong.** Dunia berdiri di atas blok lantai/tanah yang sisinya (+x dan +z) memperlihatkan lapisan (mis. keramik → adukan → beton → pasir urug → tanah). Dinding dipotong rendah (±1,5 m) dan bidang potongnya digambar sebagai bata + plester. Lingkungan lengkap & hidup: perabot, pipa, kabel, tanaman, satu-dua gerakan kecil (baju bergoyang, tetes air, kendaraan).
3. **Penampang berwarna beda.**
   - Benda dibelah dengan SATU bidang lurus (`THREE.Plane` + `clippingPlanes`) yang menyapu dari depan ke tengah, ditandai bingkai garis bercahaya.
   - Permukaan potong diwarnai rata dan hangat sehingga tebal dinding terbaca: kabinet logam `#F28C4A`, plastik/tabung `#F2C14E`, baja `#DBE3E8`, beton `#A8A39A`, tembaga/lilitan `#D9773A`, karet `#6A6F75`.
   - Bagian dalam dibuat padat (punya ketebalan), bukan kulit tipis. Bagian di depan bidang (pintu, kaca) ikut hilang.
4. **Aliran bercahaya.**
   - Air/listrik/udara/gas = butir bercahaya (InstancedMesh) + strip mengalir di dalam selang/kabel tembus pandang yang terisi bertahap.
   - Warna aliran jenuh supaya terbaca di atas putih maupun gelap: 3D `#29B6FF`, UI/label `#8FDCFF`.
   - Tebal ≥ 10 px di layar, ditaruh di tempat yang tidak tertutup bagian lain (dekat bidang potong).
5. **Cahaya & bahan.**
   - Dunia: langit gradasi `#D9E6E4 → #ECE6D6 → #E6DCC6`, matahari hangat `#FFECCF` kuat (intensitas ±3) dari kanan-atas + hemisphere lemah (±0,4) supaya bayangan tegas, bayangan lembut PCF, ACES, exposure ±0,86.
   - Warna dunia natural agak redup: lantai ubin `#C9BCA6`, cat dinding `#EADCC2`, ubin dinding `#9FC4B8`, bata potong `#C4673F` + plester `#EFE6D6`.
   - Studio: latar `radial #34505C → #1D2F37 → #0F1A20` + grid tipis 72 px, lampu kunci hangat + lampu tepi biru `#9FD2FF`, lantai bayangan kontak.
   - Bahan PBR dengan peta pantul buatan canvas: logam metalness 0,75–1, cat roughness ±0,3, karet 0,85, kain 0,95.
   - Semua tekstur dilukis dengan canvas (ubin, bata, anyaman, lubang logam, beton, kain) — tanpa gambar luar.
6. **Tipografi (1080×1920, ukuran minimum agar terbaca di HP).** Google Fonts **Overpass** (600/800/900) + **Overpass Mono** (500/700).
   - Nama bagian (label): Overpass Mono 700 **44 px** HURUF BESAR, jarak huruf .03em; baris kedua Overpass 600 **32 px** huruf kecil, 2–4 kata.
   - Label "cara kerja" besar: Overpass 900 **64 px** warna aksen + baris kedua **34 px**.
   - Angka zoom ×N: Overpass 900 **76 px**; jejak lokasi Overpass Mono **30 px** putih, kata terakhir kuning `#FFE2A8`; angka berjalan (rpm) **70 px** + keterangan **30 px**; teks peta kecil **30 px**.
   - Tidak ada teks di layar di bawah 30 px.
7. **Label tanpa kotak.**
   - Titik bercahaya warna aliran, atau warna AKSEN untuk bagian penting (`am:1`) + garis lurus + teks bergaris bawah; baris kedua = fungsi bagian dalam 2–4 kata.
   - Garis menggambar dulu, teks menyusul. Muncul pas kata itu diucapkan VO.
   - Maksimal 2–3 label sekaligus (ganti tahap = label lama hilang), teks dijaga di y 520–1330 dan di dalam AMAN (kanan ≤ 930 px), tidak menimpa pusat aksi atau angka rpm.
8. **Subtitle.** Kata per kata bawaan mesin, tanpa kotak, Overpass 900 66 px putih + bayangan, kata kunci warna `#9FE0FF`, posisi `y:.755` (±1450 px), maks 4 kata per frasa.
9. **UI zoom bertingkat.**
   - Kiri atas: jejak lokasi ("RUANG CUCI › MESIN CUCI › DIBELAH") + angka **×1 → ×9** yang naik tiap masuk lebih dalam.
   - Di bawahnya (bila ada): satu angka besar yang berjalan, mis. "1.000 PUTARAN / MENIT", warna `#FFE2A8`.
   - Kanan atas (setelah studio terbuka): peta kecil bulat 220 px (salinan kanvas dunia) dengan titik kuning + nama tempat 30 px di bawahnya ("RUANG CUCI").
   - Pindah dunia → studio SELALU lewat lingkaran zoom bercincin putih bercahaya (±0,9 dtk).
10. **Tanpa manusia, wajah, merek, logo.** Angka/fakta di layar harus benar; kalau ragu pakai pernyataan umum.

## Yang boleh berubah per video (supaya tidak kembar)
Di contoh, ganti `const PAL=GAYA_ISO.teal` ke salah satu set ini (warna aliran 3D ada di `alir3d`):

| Set | Langit dunia | Studio | Aliran UI / 3D | Aksen | Font (judul + label) |
|---|---|---|---|---|---|
| **teal** (bawaan) | `#D9E6E4 #ECE6D6 #E6DCC6` | `#34505C #1D2F37 #0F1A20` | `#8FDCFF` / `#29B6FF` | `#FFC35A` | Overpass + Overpass Mono |
| **grafit** | `#E4E4DF #EEEDE6 #D9D6CB` | `#3B4045 #24282C #111315` | `#7CF0C8` / `#19E0A0` | `#FF9A4A` | Space Grotesk 700 + JetBrains Mono 600 |
| **terakota** | `#EFE2CF #F4EBDC #E6CFAE` | `#4B3A31 #2B211C #17110E` | `#62E3EA` / `#14C8D6` | `#FFD166` | Archivo 800 + IBM Plex Mono 600 |

**Aksen = warna yang diminta murid.** Kuning `#FFC35A` hanya bawaan. Bila murid minta "1 aksen biru es", isi `aks` DAN `alir`/`alir3d`/`tb` dengan keluarga biru es itu (mis. `#9FE3FF` / `#2FB4F0`), dan ganti kuning `ta` (jejak, angka rpm) ke putih `#FFFFFF` supaya tetap satu aksen.

Ganti font = ganti link Google Fonts di `@HEAD` + variabel CSS `--fj`/`--fm` + `SCENE.sub.font`. Hal lain yang boleh digeser: arah pojok kamera (45° atau 49°, atau dari pojok kiri −45° bila benda menghadap kanan), warna lantai/dinding dunia sesuai tempat, warna penampang (asal tetap hangat dan beda dari bahan luar), bentuk lingkaran zoom (lingkaran ↔ persegi membulat). Jangan ubah: kamera ortografik dunia, bidang potong lurus, aliran bercahaya, label tanpa kotak.

## Kerangka adegan Shorts 30–60 dtk
Contoh 45 dtk. Tiap baris = satu kalimat VO; geser angka mengikuti `kata.js`.

| Detik | Adegan | Kamera | Isi |
|---|---|---|---|
| 0–3 | Hook di dunia | ortografik h≈56 → 42, dorong pelan | pertanyaan di subtitle; 1–2 label nama benda; gerakan kecil lingkungan |
| 3–5 | Menyelam | h 42 → 15 ke benda; lingkaran zoom terbuka 0,9 dtk | jejak "TEMPAT › BENDA", ×1 → ×5 |
| 5–9 | Benda utuh | studio, orbit pelan az 47° → 39° | detail luar terbaca (baut, panel, kenop, kabel); peta kecil muncul |
| 9–13 | Bongkar | studio menjauh sedikit | panel luar terangkat/bergeser & memudar; 4–6 label bagian sesuai kata VO |
| 13–15 | Belah | bidang potong menyapu dari depan ke tengah (garis bercahaya) | penampang berwarna muncul; jejak "› DIBELAH" |
| 15–32 | Cara kerja 1–3 | studio pelan mendekat ke pusat aksi | butir/strip bercahaya, putaran, angka berjalan (rpm/suhu/liter), label besar cara kerja |
| 32–38 | Zoom tingkat 2 (opsional) | lingkaran zoom kedua ke bagian kecil | ×9 → ×20: pompa, katup, sensor, bantalan |
| 38–45 | Penutup | lingkaran menutup kembali ke dunia, h naik ke 50 | ×1, kalimat penutup/fakta unik; aliran tetap hidup di dunia |

**Versi 16:9:** dunia ortografik muat lebar (h ≈ 30–36), benda di kiri-tengah dan label di kanan; studio fov 24°, label boleh dua sisi; subtitle `y:.84`, jejak lokasi tetap kiri atas, peta kecil kanan atas. Zona label y 120–900.

## Gerak & transisi
- Semua gerak fungsi `t` (tanpa waktu jam, tanpa acak tak berbenih; pakai `hash(i)`).
- Kunci kamera disimpan di tabel `[detik, target, …]` dan diinterpolasi smootherstep (berhenti lembut di tiap kunci).
- Tinggi bingkai ortografik diinterpolasi secara log (zoom terasa rata, tidak melambat di akhir).
- Kamera dunia diberi goyang halus `nz()` ±0,05 satuan; studio orbit pelan. Tidak ada potong keras: dunia → studio lewat lingkaran (`clip-path: circle()` + cincin putih), studio → dunia lewat lingkaran yang menutup.
- Urutan bongkar: lepas (0,7 dtk, `E.io`) → jeda 0 → belah (1 dtk). Bagian yang dilepas bergeser menjauh ±4–5 satuan sambil memudar.
- Bagian berputar: kecepatan tampak dibatasi ±7 rad/dtk; kecepatan sungguhan ditulis sebagai angka di layar ("1.000 PUTARAN / MENIT"). Di atas ambang, tekstur lubang diganti tekstur kabur (motion blur murah).
- Label muncul bergiliran 0,3 dtk; hilang serempak saat ganti tahap.

## Suara
- **VO** ElevenLabs `eleven_v4`, nada tenang-penasaran ala dosen muda yang ramah, tempo sedang. Tag jarang: `[curious]` di kalimat pertama, `[thoughtful]` sebelum cara kerja. Kalimat pendek, sebut nama bagian persis seperti label. ±30 dtk ≈ 70–80 kata.
- **Musik** instrumental lembut (marimba/kalimba atau synth pluck), 90–100 BPM, volume ±0,12, diredam saat VO.
- **SFX** pelan & jarang, satu bunyi per momen, diletakkan di jeda VO: whoosh lembut saat lingkaran zoom; klik plastik kecil saat panel lepas; "sret" tipis saat bidang potong menyapu; tik halus hanya untuk 1–2 label penting (bukan setiap label); dengung motor naik saat putaran mulai; gemericik saat air mengalir di selang. Volume 0,2–0,35.
- Buat suara setelah gambar adegan 1 disetujui. Isi `SCENE.audio={vo:[{src,at}],sfx:[{src,at,vol}],music:{src,vol}}`, lalu `mf.py kata` untuk subtitle.

## Contoh naskah VO (mesin cuci, ±30 dtk)
```
[curious] Gimana mesin cuci memeras baju? Kita belah mesinnya.
Di dalamnya ada dua tabung: tabung luar yang diam dan menampung air, dan tabung dalam yang berlubang.
Di atasnya ada pemberat beton, di bawahnya motor yang memutar tabung lewat sabuk.
[thoughtful] Saat memeras, tabung dalam diputar kencang, sekitar seribu putaran per menit.
Baju terdorong menempel ke dinding, airnya terlempar keluar lewat lubang-lubang kecil.
Air jatuh ke dasar tabung luar, lalu pompa membuangnya lewat selang.
```
Nama bagian di VO = teks label. Angka di layar hanya yang pasti benar (mis. 1.000 rpm adalah kecepatan peras yang umum).

## Detail kecil per jenis benda (pilih yang sesuai)
- **Mesin/peralatan listrik:** sekrup kabinet, kabel merah-hitam diikat, kenop + layar angka, kaki karet, pegas, peredam, lilitan tembaga di penampang motor.
- **Pipa/air:** klem selang, sambungan berulir, katup, saringan, selang tembus pandang dengan strip air, saluran lantai berkisi.
- **Bangunan/infrastruktur:** lapisan tanah & beton di sisi blok, tulangan besi di penampang beton, bata + plester di potongan dinding, tutup bak kontrol.
- **Dunia sekitar:** 6–10 benda pendukung bertema (keranjang anyam, ember, rak + botol tanpa merek, jemuran, tanaman pot, keset bergaris).

## Cara membangun
1. `python3 scripts/mf.py baru <proyek> --dasar isometrik-dibongkar` → `scene.html` contoh mesin cuci sudah jalan. `mf.py potret <proyek>` untuk melihat.
2. Peta `scene.html` (urutan bagian di file): **0 PALET** · **0b MODE** (`MODE`, `LEPAS`) · **8 WAKTU** (semua detik penting di satu objek) · **1 ALAT 3D** (`C`, `bhn`, `tutupM`, `pasang`, `kotak`, `bubut`, `bubutZ`, `selang`, `batang`, `lapisDinding`, `Pegas`, `petaPantul`, `rendererBaru`) · **2 TEKSTUR** canvas · **3 BENDA** `mesinCuci(par,klip)` · **4 DUNIA** (blok berlapis, `dinding()`, perabot) · **5 STUDIO** (lampu, bayangan kontak, bidang potong bercahaya, butir & strip aliran) · **6 KAMERA** `KD_KUNCI`, `KM_KUNCI` · **7 LABEL** `tanda()` · **9 SCENE**.
3. Ganti topik:
   - tulis `bendaku(par,klip)` dengan pola yang sama; contoh memanggilnya untuk dunia (`klip` hanya true di mode ortho) dan studio (`klip=true`); `BENDA` menunjuk benda yang dibelah;
   - satuan 1 = 10 cm, lantai y=0, depan = +z (bidang potong membuang z > `POT.constant`);
   - kembalikan pegangan: grup yang dilepas, grup yang berputar, titik jalur aliran, dan `gerak(t,…)`;
   - ganti isi DUNIA sesuai tempat (dapur, halaman, gardu, kamar mandi);
   - ganti teks `tanda()`, `JEJAK`, `ZOOM`, `SCENE.kata`, dan angka di `WAKTU`.
   - Durasi panjang: tambah kunci ke `KD_KUNCI`/`KM_KUNCI` dan tahap baru di `WAKTU`, jangan menulis detik di banyak tempat.
4. **Framing 9:16.** Lebar bingkai ortografik = 0,56 × tingginya, jadi benda selebar L butuh bingkai tinggi ≥ 1,9 × L. Subtitle (`y:.755`, ±1410–1490 px) dan batas bawah label (1330 px) menutup sepertiga bawah layar, maka:
   - benda biasa: arahkan target kamera ke ±40% tinggi benda (bukan tengahnya) supaya dasarnya berhenti di ±1330 px;
   - **benda tinggi (> 15 satuan / 1,5 m: kulkas, lemari, menara)**: bingkai ≥ tinggi ÷ 0,62, target di ±45% tinggi, ATAU pindahkan subtitle ke `y:.82` dan zona label ke y 420–1400, ATAU pakai dua kunci kamera (atas dulu, lalu turun ke ruang mesin di bawah) — jangan biarkan bagian penting di bawah 1330 px.
5. Setiap bagian dalam yang terbelah diberi warna penampang lewat `pasang(geo, bahan, induk, posisi, '#warnaPotong')`. Bagian yang hanya dilepas (panel) TIDAK diberi warna potong.

Potongan inti yang sering salah:
```js
// bidang potong + penampang: sisi dalam benda padat digambar rata (BackSide), tanpa tone mapping
const POT=new THREE.Plane(new THREE.Vector3(0,0,-1),99);          // simpan z <= POT.constant
renderer.localClippingEnabled=true;
const bahan=new THREE.MeshStandardMaterial({color:C('#b9bdb9'),clippingPlanes:[POT]});
const tutup=new THREE.MeshBasicMaterial({color:C('#F2C14E'),side:THREE.BackSide,clippingPlanes:[POT],toneMapped:false});
const m=new THREE.Mesh(geo,bahan); m.add(new THREE.Mesh(geo,tutup));
// di frame(t): POT.constant=lerp(3.8, .15, E.io(seg(t,5.3,6.3)));

// tabung/cincin berlubang dari profil bubut: titik [r,h] berurutan BERLAWANAN jarum jam
// (naik di sisi luar, turun di sisi dalam), lalu diputar supaya sumbunya = z
bubutZ([[2.1,-2.1],[2.2,-2.1],[2.2,1.75],[1.5,1.75],[1.5,1.63],[2.1,1.63],[2.1,-2.1]], bahan, induk, '#DBE3E8');

// benda BERDINDING (kulkas, oven, dispenser, rice cooker): dinding berlapis luar -> dalam, celah 0,01 antar lapis
lapisDinding(induk,[x0,x1,y0,y1,z0,z1],[
  [.08, bhn('#e3e6e8',{metalness:.5,roughness:.35},true), '#F28C4A'],   // kulit baja
  [.55, bhn('#f2d16b',{roughness:.95},true),              '#F2C14E'],   // busa isolasi
  [.06, bhn('#f4f1e8',{roughness:.5},true),               '#E9E1CF']]); // lapisan dalam (liner)
// depan dibiarkan terbuka untuk pintu; pintu dibuat sendiri dengan lapis yang sama

// strip aliran di dalam selang tembus pandang: terisi bertahap + motif bergerak
geo.setDrawRange(0, Math.floor(isi*60)*8*6);   // TubeGeometry(kurva,60,r,8)
tekstur.offset.x = -t*1.8;
```

## Gambar uji adegan 1
**Detik potret yang disarankan (pakai ini, satu set saja): `mf.py potret <proyek> --t 1.5,4.0,8.4`** untuk adegan pembuka 8–10 dtk. Bila adegan 1-mu lebih pendek/panjang, pakai ±15% (dunia), ±40% (benda utuh), ±85% (dibelah + cara kerja) dari durasinya. Periksa ketiga potret:
- **1,5 dtk (dunia):** sudut benar-benar isometrik (garis tegak tegak, tanpa perspektif), blok lantai memperlihatkan ≥4 lapisan di sisi depan-kanan, dinding terpotong dengan bata kelihatan, ≥6 benda pendukung bertekstur (bukan kotak polos), bayangan jatuh, label nama benda + subtitle terbaca.
- **4,0 dtk (benda utuh):** mode zoom: latar studio gelap bergrid + peta kecil; mode ortho: benda besar di dunia, benda di depannya sudah tersembunyi. Keduanya: detail kecil terbaca (baut, kenop, layar, engsel, kabel), bayangan kontak, jejak lokasi ×N.
- **8,4 dtk (dibelah + cara kerja):** penampang berwarna hangat jelas berbeda dari bahan luar, tebal dinding terlihat, bagian dalam padat, aliran bercahaya berwarna jenuh dan tidak tertutup, 2–4 label tidak bertumpuk, semua teks di dalam AMAN.
Dan: `error halaman: tidak ada`, satu frame < 1,5 dtk.

## Jebakan yang sudah pernah terjadi → perbaikannya
- **Hasil jadi "diorama polos low-poly"** (temuan uji murid) → bahan wajib bertekstur canvas + peta pantul + bayangan lembut + bayangan kontak; benda dibentuk dengan bubut/extrude/tabung, bukan kotak semua.
- **Hanya mengangkat panel, tidak membelah** → pakai bidang potong lurus lewat tengah benda + warna penampang; panel dilepas DULU baru dibelah.
- **Logam "disikat" jadi goresan acak** → garis disikat tipis (alpha ≤ 0,18) searah putaran, ditambah peta pantul; bukan coretan acak.
- **Peta pantul hitam** di r128 bila memakai `PMREMGenerator.fromScene` → lukis gambar equirect di canvas lalu `fromEquirectangular`.
- **Warna pucat/meleset** → hex selalu lewat `new THREE.Color(hex).convertSRGBToLinear()` (fungsi `C()`). Dunia terlalu putih karena lingkungan pantul → bahan dunia `envMapIntensity:.3`, exposure ±0,9.
- **`material.clone()` ikut menyalin bidang potong** → set ulang `clippingPlanes` sesudah clone. Air/kaca transparan perlu `side:THREE.DoubleSide` (bahan utama benda padat JANGAN DoubleSide: penampang jadi rusak).
- **Penampang terbalik/hilang** → profil bubut harus berlawanan jarum jam dan tertutup; tutup penampang `toneMapped:false` supaya warnanya tidak kusam.
- **Panel yang dilepas tampak oranye** (warna potong ikut terlihat saat memudar) → bagian yang dilepas tidak diberi tutup penampang.
- **Kain/benda lengkung jadi bertangga** (ExtrudeGeometry bersegi) → pakai `LatheGeometry` sebagian lingkaran + `computeVertexNormals()`.
- **Aliran tak kelihatan:** strip di dalam selang buram → selang studio dibuat tembus pandang (opacity ±0,38); butir aditif berubah putih di atas permukaan terang → warna jenuh `alir3d` blending normal; butir jauh di belakang tertutup tabung → sebagian besar butir ditaruh dekat bidang potong.
- **Lubang berkedip saat berputar cepat** → batasi kecepatan tampak, ganti ke tekstur kabur di atas ambang, tulis rpm sebagai angka.
- **Kamera close-up terlalu dekat**, benda terpotong sisi 9:16 → jarak awal 44 (fov 22), cek potret; benda utuh harus muat dengan ruang label.
- **Label terlalu kecil untuk HP** (versi awal 22–30 px) → nama ≥ 44 px, baris kedua ≥ 32 px, teks UI ≥ 30 px; perpendek teks supaya muat.
- **Label menimpa jejak/angka/peta kecil/pusat aksi** → maks 2–3 label sekaligus, batasi ke y 520–1330 dan x di dalam AMAN; atur `o:[dx,dy]` supaya tiap label punya sudut sendiri dan tidak menutup bagian yang sedang bergerak.
- **Penampang berkedip/bergaris (z-fighting)** saat lapisan berimpit (kulit, busa, liner pada bidang yang sama) → beri celah 0,01 antar lapis (`lapisDinding` sudah melakukannya); jangan buat dua benda berbagi permukaan.
- **Komponen di belakang-kanan tidak kelihatan**: dari pojok kanan-depan, dinding kanan dan bagian depan menutupinya → taruh kompresor/motor/pompa/pipa penting di sisi KIRI-belakang atau di tengah yang dilintasi bidang potong; atau lepas panel kanan (`LEPAS`).
- **Garis semu berulang** di logam disikat/ubin: garis yang dilukis tepat di tepi kanvas tekstur ikut berulang jadi garis lurus panjang → jangan lukis garis di tepi kanvas (kecuali nat ubin yang memang disengaja), sebar garis acak di tengah.
- **Benda hilang total di penampang:** bagian yang harus tampil berpenampang wajib MELINTASI bidang potong (rentang z-nya mencakup posisi akhir `POT`); yang seluruhnya di depan bidang terbuang, yang seluruhnya di belakang tidak berwarna potong.
- **Bagian bawah benda tinggi tertutup subtitle/label** → lihat aturan framing 9:16 di "Cara membangun".
- **Titik dunia dari objek di dalam grup meleset** → `grup.updateMatrixWorld(true)` sebelum `localToWorld`, atau simpan titik dalam koordinat benda lalu tambah posisi grup (`keDunia()`).
- **Bentrok nama global dengan mesin** (`W H E seg label kanvas mk AMAN SUB q split` dll.) → beri nama sendiri (`tanda`, `KD`, `KM`, `POT`…).
- **Peta kecil kosong** → renderer dunia wajib `preserveDrawingBuffer:true` dan dirender di frame yang sama sebelum `drawImage`.

## Revisi cepat
- **Kalau hasilnya masih polos/mainan** → tambah 10–20 detail kecil: baut di sambungan, kabel berwarna, klem selang, pegas, tekstur beton/anyaman, bayangan kontak; ganti kotak dengan bubut/extrude ber-bevel. Ukuran minimum: baut/sekrup jari-jari ≥ 0,1 satuan, kabel ≥ 0,045, dan tiap detail harus ≥ 20 px di layar pada bingkai AKHIR adegan (cek potret terakhir). Taruh di area yang tetap terlihat di akhir: tepi potongan, sekitar pusat aksi, sisi yang menghadap kamera — bukan di belakang, di bawah subtitle, atau di balik meja/panel.
- **Kalau penampang kurang terbaca** → warna potong lebih hangat & kontras (oranye/kuning di atas abu), tebalkan dinding benda (≥ 0,1 satuan), buang semua yang ada di depan bidang potong (pintu, kaca).
- **Kalau aliran tidak jelas** → perbesar butir (r 0,06, panjang 0,45), pindahkan ke dekat bidang potong, jadikan selang tembus pandang, tambah strip yang terisi bertahap + label besar "AIR …" berwarna aksen.
- **Kalau belum terasa isometrik / murid melarang perspektif** → `MODE='ortho'`: satu `OrthographicCamera`, azimut 45–49°, elevasi ±30°, tanpa orbit miring, tanpa studio.
- **Kalau label sesak** → maksimal 2–3 label sekaligus, sebagian diganti label besar "cara kerja", pakai baris kedua untuk penjelasan, geser waktu `a/b` mengikuti kata VO.
- **Kalau mau tingkat zoom ke-2** → salin pola `langkahIris` dengan titik baru (mis. pompa), naikkan `ZOOM` ke ×20, tambahkan model bagian kecil itu di studio dengan detail lebih tinggi.
