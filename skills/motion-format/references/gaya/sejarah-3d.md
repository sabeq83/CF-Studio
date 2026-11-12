# Gaya: Sejarah 3D Sinematik

> Cuplikan dokumenter 3D kelas film: kapal/bangunan bersejarah dibangun dari kode dengan skala nyata dan detail yang bisa dihitung, kamera tak pernah diam, matahari rendah dari satu arah, kabut bergulung, lalu kulit objek ditembus pandang ala sinar-x. Contoh dari seri asli kami (Seri Sejarah 3D, Shorts 40–45 dtk): Titanic, Piramida Giza, Menara Eiffel, Menara Pisa, Colosseum, Stonehenge, Machu Picchu, Tembok Besar, Chichen Itza.

## Cocok untuk · tidak cocok untuk
- **Cocok:** sejarah kapal, bangunan, monumen, kota kuno; "kenapa X begini?"; dulu vs sekarang; rahasia teknik (sekat kedap air, fondasi, rangka); misteri singkat. Paling kuat kalau objeknya **satu benda fisik** yang tersusun dari bagian berulang (balok, batang, jendela, layar, bata).
- **Tidak cocok:** biografi tokoh (butuh wajah), konsep abstrak tanpa benda, banyak grafik/angka, humor kartun, tutorial aplikasi, cerita yang butuh manusia dekat kamera. Untuk itu pilih gaya lain.

## Ciri wajib
1. **Kamera perspektif selalu bergerak.** three.js r128, FOV 45–55 di 9:16. Tiap adegan punya satu gerak utama (dolly, crane, orbit, FPV) ditambah goyang genggam kecil `nz()` (±0,2 m). **Hook 0–2 dtk:** kamera rendah (1–3 m dari air/tanah) dekat objek, dengan lapisan depan yang bergerak (ombak, rumput, kabut).
2. **Framing tegak.** Objek harus terlihat UTUH minimal sekali (biasanya detik 3–8). Ambil sudut serong 3/4 yang agak tinggi supaya bagian yang tinggi (tiang, menara, layar, kubah) mengisi tinggi layar. Benda panjang mendatar (kapal, tembok) jangan diambil dari samping lurus, karena akan jadi garis kecil di tengah layar.
3. **Cahaya dari satu arah.** Matahari `DirectionalLight` 3,5–4,5 dengan elevasi rendah 8–25°, bayangan PCFSoft 4096 yang kotak bayangannya hanya meliputi objek (±60 m). Pasang cahaya isi dingin 0,6–0,9 dari sisi gelap, dan `HemisphereLight` paling besar 0,45. Kunci hangat lawan isi dingin. Satu sisi objek harus terlihat jelas lebih gelap.
4. **Atmosfer berlapis.** Kabut tinggi: makin dekat tanah makin pekat, dan warnanya menghangat ke arah matahari (chunk fog ditambal). Tambahkan gumpalan kabut billboard di 3 lapis (depan, di belakang objek, cakrawala), langit shader berawan, dan partikel (percik, debu, burung). Siluet jauh (pulau, gunung, kota) dimakan kabut.
5. **Material bertekstur, tidak polos.** Semua permukaan besar memakai tekstur kanvas prosedural (papan, batu, kain, genteng) ditambah `bumpMap`, variasi warna per elemen, dan noda usia. Elemen berulang dibuat dengan `InstancedMesh` (ratusan sampai ribuan). Skala dunia dalam meter dan benar (kapal 72 m, menara 56 m).
6. **Pasca-proses film** (renderer dibiarkan linear; tone mapping di shader akhir):
   - render ke `WebGLMultisampleRenderTarget` HalfFloat, 4 sampel;
   - bloom 2 tingkat (¼ dan ⅛ resolusi, ambang 1,0);
   - god-ray radial bila kamera menghadap matahari;
   - shader akhir: ACES + gamma + split-tone (bayangan teal, sorot hangat) + tilt-shift halus 0,4–0,55 + vinyet 0,45 + aberasi kromatik tipis;
   - grain `grainOn(.06)`.
7. **Palet 5–7 hex per video** dalam satu objek `PAL`: langit/kabut, warna objek utama, satu aksen hangat (lampu/teks), satu aksen dingin (sinar-x/sinyal).
8. **Tipografi.** Judul memakai serif display dari Google Fonts yang belum pernah dipakai video lain. Ukuran di 1080×1920: angka/tahun 220–250 px, nama 90–110 px, label 56–64 px. Letter-spacing merapat dari .16em ke .07em saat masuk. Subtitle memakai sans 800, 58–64 px. **Teks tanpa kotak/pil**: kontras dari text-shadow berlapis dan "selubung" gradien radial gelap lokal di belakang teks.
9. **Subtitle per kata dekat objek.** `SCENE.kata`, frasa paling banyak 4 kata (pecah di koma). Letaknya di bawah garis air/kaki objek mengikuti proyeksi 3D, tetap di dalam `AMAN`. Kata kunci (angka, tempat) berwarna aksen. Isi `aksen` dengan warna aksen palet video.
10. **Label = titik bercahaya + garis siku + teks serif** (`label()`), menempel ke titik 3D lewat `project()`. Satu label per momen, muncul pada kata kuncinya. Angka hanya yang ada di naskah. Manusia hanya siluet kecil di kejauhan, tanpa wajah. **Sinar-x**: kulit memudar, cangkang fresnel aditif, bagian dalam bercahaya.

## Yang boleh berubah per video
Pilih satu set, lalu ubah waktu (fajar/siang/senja/malam) dan sudut matahari. Catat set yang dipakai di `naskah.md` supaya video berikutnya tidak kembar.

| Set | Suasana | Palet | Font judul + subtitle |
|---|---|---|---|
| A (contoh) | Fajar laut berkabut | langit #203556→#EDB58C, kabut #B9A3A0, kayu #3A2418, lak #A3291C, layar #93402A, aksen #FFC27A, sinar-x #9FE8FF | Marcellus + Hanken Grotesk 800 |
| B | Batu siang → senja (candi, benteng, piramida) | batu #D9C3A0, bayangan #5E4330, langit #8DB4D6→#F2A66B, rumput #4E6B34, aksen #F0B35A | Cormorant Garamond 600 + Figtree 800 |
| C | Malam biru + lampu hangat (kapal malam, kota, menara) | navy #0A1424, es #CFE6F2, lampu #FFC86B, logam #8C6A4A, aksen dingin #7FE3FF | Instrument Serif + Onest 800 |
| D | Kabut pegunungan hijau | granit #9C9A92, hijau #4E7A3A, awan #E8EEF2, langit #5E8FC8, aksen #FFD08A | Gloock + Schibsted Grotesk 800 |

Font yang sudah dipakai seri kami (hindari): Italiana, Aboreto, Federo, Della Respira, Rosarivo, Castoro, Sorts Mill Goudy, Gowun Batang, Zen Old Mincho.

## Kerangka adegan Shorts 30–60 dtk
| Detik | Adegan | Kamera | Isi |
|---|---|---|---|
| 0–2 | Hook | rendah dekat objek, dolly maju/serong | objek muncul dari kabut; judul tahun/nama besar |
| 2–8 | Reveal | crane naik + mundur sampai objek UTUH | konteks (armada, kota, lembah); label angka pertama |
| 8–16 | Latar sejarah | orbit lambat / time-lapse | dibangun bertahap, dulu vs sekarang |
| 16–26 | Inti mekanisme | dolly masuk → sinar-x / penampang | bagian dalam bercahaya, 1–2 label |
| 26–36 | Peristiwa | gerak dramatis (whip, guncang kecil, menyelam) | gempa/tabrakan/perang/badai |
| 36–45+ | Penutup | crane mundur / orbit, cahaya emas | fakta pengait; dip ke gelap |

`dur` = akhir kata terakhir + ±2 dtk. **16:9:** FOV 30–35, objek di sepertiga kiri/kanan, judul 150–170 px, subtitle 52 px (posisi bawaan 0,84H). Tes contoh dengan `--rasio 16:9` sudah jalan tanpa ubahan; tinggal rapikan komposisi.

## Gerak & transisi
- Kamera = daftar titik kunci `[detik, posisi, sasaran]`, catmull-rom + easing `E.s`. Satu segmen ≥2,5 dtk dan geraknya pelan. Yang cepat hanya whip transisi.
- Transisi harus menyambung: kamera menembus objek, whip pan, match cut (bentuk sama), atau **dip ke gelap**. Jangan kilat putih/abu-abu.
- Judul masuk per kata dari blur ke tajam (`wIn`) sambil letter-spacing merapat, lalu keluar (`wOut`) sebelum frasa kedua.
- Momen penting (angka, label, sinar-x) tampil di layar ±2,5 dtk.
- Dunia tetap hidup: bendera, layar, kain, air, kabut, dan burung bergerak dari `t`, kapal sedikit mengangguk. Setiap ±2 dtk harus ada perubahan yang terlihat.

## Suara
- **VO ElevenLabs v4:** narator dokumenter yang hangat dan tenang, tempo sedang. Tag `[serious]`/`[curious]` di awal bagian, `[pause]` antar-bagian. Satu suara per video. Naskah TTS menulis angka sebagai kata ("seribu empat ratus lima"), sedangkan teks layar memakai digit. VO mulai 0,6 dtk.
- Contoh nada: "[curious] Tahun seribu empat ratus lima… [pause] lebih dari tiga ratus kapal berlayar…". Kalimat pendek, satu fakta per kalimat.
- **Musik:** orkestra ambient/drone hangat yang pelan, vol 0,35–0,4 dengan ducking di bawah VO.
- **SFX:** satu bunyi singkat per momen, diletakkan di **jeda VO** (cari jeda dengan `silencedetect`). Jangan ada SFX beruntun, dan jangan menimpa kata. Vol 0,25–0,55. Contoh: dentum rendah saat judul, whoosh saat crane, kayu berderit (kapal), shimmer saat sinar-x. Loop ambience (ombak/angin) vol 0,08–0,14.

## Cara membangun
Mulai dengan: `MF_PORT=<port> python3 scripts/mf.py baru <proyek> --dasar sejarah-3d`. Contohnya adalah pembuka 10 dtk "Armada Cheng Ho 1405". Semuanya inline, tanpa file data. Peta bagian di `scene.html` (cari `[n]`):

| Bagian | Isi | Untuk topik baru |
|---|---|---|
| [0] NASKAH & WAKTU | `KATA`, `kt('kata')`, `MOMEN` | ganti dengan kata.js; semua momen diturunkan dari kata |
| [1] PALET & FONT | `PAL`, `FONT`, `ARAH_MATAHARI` | ganti; ubah juga link Google Fonts di @HEAD |
| [2] RENDERER + PASCA | HalfFloat, bloom, god-ray, `AKHIR` | jarang diubah; atur `ex/bl/tilt` di `gambar()` |
| [3] KABUT & LANGIT | `UK` (kepadatan `uKd`, tinggi `uKh`), langit shader | sesuaikan pekat & warna |
| [4] LAUT | shader gelombang, kilau, buih di lambung | topik darat: ganti dengan tanah (lihat potongan B) |
| [5] OBJEK UTAMA | lambung loft, tekstur kanvas, kastil, tiang, layar | **ganti seluruhnya** |
| [6] ELEMEN BERULANG | armada `InstancedMesh`, jejak buih, burung, percik | ganti (pohon, rumah, batu, penonton) |
| [7] ATMOSFER | gumpalan kabut billboard 3 lapis | atur posisi lapis mengikuti arah pandang |
| [8] SINAR-X | cangkang fresnel + sekat | pakai untuk "bagian dalam" topikmu |
| [9] KAMERA | `KUNCI` | tulis ulang per adegan |
| [10] TEKS | `label()`, `proyeksi()`, `subY` | ganti teks & titik 3D sasaran |
| [11] SCENE | `gambar(t)` + `SCENE` | rangkaian per frame |

Urutan kerja:
1. Tulis naskah + fakta + sumber di `naskah.md`. Tempel timing ke `KATA` (nanti dari `mf.py kata`). Turunkan semua `MOMEN` dari kata lewat `kt('kata')`, jangan angka tulisan tangan.
2. Pilih set palet + font, lalu ganti `PAL`, `FONT`, link Google Fonts, dan `ARAH_MATAHARI`.
3. Bangun objek [5] lebih dulu, dengan kamera sementara yang melihat objek utuh. Potret sampai objek meyakinkan: bentuk benar, skala meter, detail yang bisa dihitung.
4. Dunia [3][4][6][7]: tanah/laut, siluet jauh, elemen berulang, kabut 3 lapis.
5. Kamera [9]: hook rendah, lalu reveal utuh, lalu satu gerak per adegan.
6. Teks [10]: judul, label pada kata kunci, subtitle mengikuti objek.
7. Potret, periksa, perbaiki: minimal 3 putaran, putaran terakhir khusus "detail lagi" (tambah detail di potret terlemah, bukan sekadar membereskan bug).

Jangan memakai nama global yang sudah dipakai mesin: `q W8 SUB E label split seg AMAN W H lerp clamp nz rng hash mk kanvas`.

**A. Objek dari "loft" (lambung, kubah, menara bulat).** Sebuah fungsi `titik(u,s)` mengembalikan [x,y,z]: `u` berjalan sepanjang benda, `s` mengelilingi penampang. Grid lalu diubah jadi segitiga. Bentuk diatur oleh 2–3 fungsi kecil:
```js
const lebarL = u => 1.5 + 11.5 * Math.pow(Math.sin(Math.PI * (.1 + .85 * u)), .55);   // setengah lebar
function titikL(u, s) { const a = Math.abs(s), y = lerp(lunas(u), atasL(u), Math.pow(a, 1.25));
  return [X0 + u * PJ, y, Math.sign(s) * lebarL(u) * (1 - Math.pow(1 - a, 3))]; }
// loftGeo(64, 14, titikL) → normal dipastikan menghadap keluar (arahkanKeluar); tutupGeo(u) menutup ujung
```
**B. Topik darat.** Hapus [4] dan ganti dengan tanah. Kabut tetap jalan karena memakai chunk:
```js
const tanah = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({map: texTanah, bumpMap: texTanah, bumpScale: .05, roughness: .95}));
tanah.rotation.x = -Math.PI / 2; tanah.receiveShadow = true; S.add(tanah);   // texTanah: kanvas 1024, repeat [60,60], variasi bercak
```
**C0. Kamera titik kunci.** Satu baris per titik. Hook rendah dulu, lalu naik sampai objek utuh:
```js
const KUNCI = [[0, [86, 2.3, 24], [28, 8, 2]],      // hook: 2 m di atas ombak, serong haluan
  [2.4, [64, 6, 40], [10, 14, -4]],                   // menyusur sisi
  [5.4, [118, 66, 74], [-16, 22, -14]],               // crane tinggi serong haluan: kapal UTUH + armada di belakang
  [7.2, [114, 62, 71], [-14, 21, -12]],
  [10, [110, 57, 68], [-10, 18, -8]]];                // dolly masuk pelan; kapal tetap utuh saat sinar-x
// cek bingkai: proyeksi(ujung buritan) & proyeksi(ujung haluan) harus di x ±200–900 dari 1080
```
Sasaran kamera dinaikkan (y ±20, bukan pusat lambung) supaya kapal duduk di tengah-bawah: armada & langit di atas, laut di bawah untuk subtitle. Saat mendekat untuk sinar-x, cukup **dolly pelan** dari jauh; jangan sampai haluan/buritan keluar layar.
**C. Elemen berulang.** Satu geometri (boleh hasil `gabung()` beberapa bagian berwarna), satu `InstancedMesh`, posisi diisi lewat `Object3D`. Bila bergerak, matriksnya diperbarui di `gambar(t)` lalu `instanceMatrix.needsUpdate = true`.

**D. Label menempel objek.** `const [x, y] = proyeksi(X, Y, Z); L.atur(t, muncul, hilang, x, y);` Cek dengan potret bahwa titik sasaran tidak tertutup objek utama.

**E. Sinar-x.** `kx = sstep(a, a + .9, t)`. Kulit `opacity = 1 - .72*kx` (material `transparent:true` sejak awal, supaya tidak dikompilasi ulang). Cangkang memakai shader fresnel aditif dengan `depthTest:false` (bagian di bawah air/tanah ikut terlihat). Bagian dalam memakai garis + isi aditif tipis yang muncul berurutan.

**F. Subtitle ikut objek.** `SCENE.sub.y = () => ({x: W/2, y: subY})`, dengan `subY = clamp(proyeksi titik garis-air terbawah + 150, .6H, AMAN.bawah - 70)`.

## Gambar uji adegan 1 (sebelum suara)
Jalankan `MF_PORT=<port> python3 scripts/mf.py potret <proyek> --t 0.3,1.5,<detik objek utuh>`, lalu buka `lembar.jpg`. Ketiga potret wajib menunjukkan:
1. **0,3 dtk (hook):** kamera rendah dengan lapisan depan (ombak/rumput/kabut). Objek boleh terpotong tapi jelas benda apa. Cahaya satu arah: ada sisi gelap dan ada kabut di belakang objek.
2. **1,5 dtk:** judul serif besar terbaca di atas selubung gelap, tanpa kotak. Subtitle kata pertama di dekat objek dan di dalam zona aman.
3. **Objek utuh:** seluruh objek masuk bingkai tegak dengan detail yang bisa dihitung (jendela, tali, pagar, papan), lapisan kabut/latar di belakangnya, dan label titik+garis yang menunjuk benda nyata.

Selain itu: `error halaman: tidak ada`, dan satu frame dirender < 1,5 dtk (contoh: ±0,1 dtk). Kirim 3 potret ke user. Suara baru dibuat setelah gambar disetujui.

## Jebakan yang sudah pernah terjadi → perbaikannya
- **Cahaya datar, lambung gelap polos** (uji resep pertama) → hemisphere ≤0,45, matahari ≥3,5 rendah dari samping, tambah isi dingin dari sisi gelap, tekstur papan dengan bump.
- **Objek kecil/terpotong di 9:16** (kapal dari samping jadi garis tipis) → sudut serong 3/4 dari haluan + crane naik. Bagian tinggi yang mengisi layar; cek objek utuh di potret.
- **Kabut tak terlihat** (hanya fog halus) → gumpalan billboard berlapis + kabut tinggi; pita kabut harus terlihat jelas di BELAKANG objek.
- **Kabut/billboard terpotong garis lurus oleh laut/tanah** → alpha memudar ke bawah (`smoothstep(0., 7., y)`) dan memudar dekat kamera.
- **Kapal/bangunan jauh tampak seperti kotak/kota** → bentuk asli versi sederhana (layar kipas, atap) + warna asli + jejak buih/jendela. Kotak polos selalu terbaca sebagai gedung.
- **Pohon low-poly kartun** → batang bercabang + banyak gumpalan daun bertekstur, variasi warna & ukuran, bergoyang.
- **Efek bola padat seperti planet** (gelombang radio) → cincin/pita tipis atau partikel.
- **Konsep melayang di latar hitam polos** → letakkan di dunia nyata yang menyambung.
- **Kilat putih saat transisi** → dip ke gelap, whip, atau match cut.
- **Bloom berlebih, muka bidang putih rata** → ambang bloom 1,0, tekstur dan sambungan, variasi warna, gradasi kabut.
- **Bloom/target 8-bit memunculkan kotak gelap & banding** → semua render target `HalfFloatType`.
- **Garis putih/bloom meledak** → `pow()` dengan basis negatif menghasilkan NaN di shader; selalu `max(x, 0.)` dulu.
- **Momen penting <1,5 dtk** → beri ±2,5 dtk.
- **Manusia seperti manekin dekat kamera** → hanya siluet kecil di kejauhan.
- **Label menunjuk benda yang tertutup objek lain** → ukur posisi layar beberapa kandidat di beberapa detik, pilih yang terlihat.
- **Ujung loft berlubang/cekung** → pusat tutup = rata-rata cincin, dan tutup juga sisi atasnya.
- **Kapal terpotong kiri-kanan saat bidikan armada/sinar-x** (contoh ini sendiri, versi awal: kamera terlalu dekat & menyamping) → kamera lebih jauh dan serong dari haluan, sedikit lebih tinggi; ukur x layar ujung haluan & buritan dengan `proyeksi()`.
- **Label/subtitle salah waktu karena komentar `//` di objek satu-baris** (mis. `MOMEN`) → sisa properti ikut jadi komentar → `NaN`, layar hitam tanpa error. Pakai `/* */`.
- **Frasa subtitle terlalu panjang** → frasa ≤4 kata, pecah di koma.
- **Laut jauh berpola cincin di 16:9** (grid vertex tak cukup rapat) → kurangi gelombang kecil di vertex, pindahkan ke normal detail fragment.
- **Komentar `//` di tengah baris panjang** menelan sisa kode, lalu muncul `Unexpected end of input` → pakai `/* */` di kode satu-baris dan cek dengan `node --check`.

## Revisi cepat
- **"Kurang sinematik / datar"** → hemisphere 0,35–0,45, matahari 4+ di elevasi 10–20°, tambah satu lapis kabut di belakang objek, kamera diberi dolly pelan + goyang genggam.
- **"Kelihatan seperti mainan"** → tambah detail skala nyata yang bisa dihitung (pagar, tali, lentera, paku, noda usia), cek skala meter, dan **turunkan tilt-shift** (tilt-shift kuat = efek miniatur).
- **"Objeknya terpotong"** → mundurkan/naikkan kamera dan arahkan sasaran ke pusat objek. Tunjukkan objek utuh dulu, baru mendekat.
- **"Teks susah dibaca"** → selubung lebih pekat (.62 → .75) atau pindahkan subtitle ke area gelap (air, bayangan). Jangan menambah kotak.
- **"Terlalu gelap / silau"** → `ex` di `AKHIR` 1,0–1,25, ambang/kekuatan bloom (`th`, `bl`), `vig`.
- **"Terasa lambat"** → cek potret tiap 2 dtk. Kalau dua potret berurutan mirip, tambah gerak kamera yang berbeda, label, atau transisi.

Fakta contoh: pelayaran pertama Cheng Ho 1405, 317 kapal (Ming Shi; Britannica "Zheng He"). Lambung jung bersekat kedap air (Needham, *Science and Civilisation in China* 4.3). Untuk video sungguhan, cek ulang semua angka dan tulis sumbernya di chat.
