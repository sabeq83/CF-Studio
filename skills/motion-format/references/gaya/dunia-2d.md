# Gaya: Dunia 2D Bertekstur

> Dunia 2D yang dilukis ulang setiap frame di canvas: berlapis-lapis, kaya tekstur dan cahaya (kabut, sinar dewa, pendar, butiran kertas), kamera tidak pernah diam. Contoh dari seri asli kami: "Kenapa seminggu 7 hari?" (manuskrip iluminasi emas), "Umur Bumi = 24 jam" (diorama kertas lightbox), "Kapal tanpa awak" (novel grafis noir), "Gua Kristal Naica" (anime dua suhu cahaya), "Danau Toba" (lanskap anime sinar dewa).

Ini satu **keluarga** gaya dengan **tiga tombol** di blok `[1] PILIH GAYA` pada `scene.html`:
- `VARIAN`: cara melukis. Pilihannya `anime`, `noir`, `catair`, atau `ukiran`. Semuanya memakai kuas yang sama (`cat()`), tetapi cara melukisnya beda.
- `SUASANA`: palet dan cahaya. Pilihan anime: `fajar`, `siang`, `malam`. Pilihan cat air: `pagi`, `siang`. Noir hanya `malam`, ukiran hanya `kertas`.
- `DIAGRAM`: `true` untuk menampilkan contoh "diagram di dalam dunia" (topik sains).

Dunianya disusun dari **daftar lapisan generik** (`[6] DAFTAR DUNIA`: bukit, gunung, dataran, danau, kota, pohon, tokoh). Topik baru cukup mengganti daftar itu; menulis ulang mesin tidak perlu. Manuskrip Emas dan Poster Gouache ditulis sebagai resep saja.

## Cocok untuk · tidak cocok untuk
- **Cocok:** sejarah, legenda, alam, geografi, asal-usul, misteri, sains yang punya "tempat" (gunung, laut, gua, kota tua, langit). Pokoknya topik yang bisa dijawab dengan "kita pergi ke sana".
- **Cocok juga:** pembuka atau penutup video gaya lain yang butuh suasana.
- **Tidak cocok:** perbandingan angka yang padat, tutorial aplikasi, daftar 10 tips, anatomi mesin (pakai gaya diagram/isometrik). Hindari juga tampilan 3D primitif atau tanah liat polos: penonton kami tidak menyukainya. Tetap 2D berlapis.

## Ciri wajib
1. **Kamera 2,5D yang selalu bergerak.** Tiap lapisan punya faktor paralaks `p` (langit 0,03 → kaki depan 1,15). Gerak dasarnya dolly-in pelan ditambah goyang `nz()` 6–8 px. Tidak ada frame yang diam.
2. **Minimal 6 lapisan kedalaman:** langit → benda jauh → punggung jauh → medan tengah → subjek → punggung dekat + tokoh → rumput/daun depan. Tambahkan pita **kabut** di kaki setiap kelompok gunung.
3. **Perspektif udara:** makin jauh, makin pucat dan makin dekat ke warna langit. Makin dekat, makin gelap dan kontras. Atur ini di palet, bukan dengan opacity.
4. **Satu sumber cahaya yang jelas** (matahari, bulan, atau lampu), posisinya diatur `PAL.surya`. Rim terang dan sisi bayangan gunung **otomatis** mengikuti sisi cahaya (`KIRI`/`RX`), begitu juga arah sinar dewa. Di varian gelap, cahaya hangat hanya boleh **satu warna**.
5. **Tekstur permukaan per varian** (kertas, granulasi, raster titik, arsiran, butiran). Teksturnya ikut lapisan, bukan stiker yang ditempel di layar.
6. **Tipografi berkarakter dan hangat.** Judul memakai serif atau display dari varian, ukuran 84–150 px di 1080×1920. Subtitle 56–62 px, tebal 700–800. **Jangan** pakai font teknis, kondensed, atau monospace (Rajdhani, Share Tech Mono, dan sejenisnya).
7. **Subtitle per kata** (`SCENE.kata`, frasa 2–4 kata) di y ≈ 0,79 H (±1520 px), di atas punggung dekat yang gelap. Kata kunci diberi warna aksen. Bentuknya menyesuaikan varian: teks polos berbayang (anime), kotak komik (noir), sobekan kertas (cat air), label bingkai ganda (ukiran).
8. **Label penunjuk** `label()` menunjuk benda yang sedang disebut VO, muncul saat kata itu diucapkan, dan ikut bergerak bersama kamera (`layar(x,y,p)`).
9. **Tokoh = siluet tanpa wajah** dengan rim cahaya. Ukurannya kecil, berfungsi sebagai pembanding skala.
10. **Hook 2 detik pertama:** sesuatu yang menutup lalu tersibak (lautan awan, kabut, tirai, cipratan) sambil kamera turun atau mundur, ditambah sinar atau pendar.

## Varian (pilih satu per video; palet & font bisa diganti dengan set alternatif)
| id | Nama | Palet inti | Font judul + subtitle | Tekstur & cahaya | Subtitle |
|---|---|---|---|---|---|
| `anime` | **Lanskap Anime Fajar** | langit #1E2753→#B97498→#FFDDA4 · gunung #44556B #5D5677 #8A84B3 · kabut #F6D2C2 · rim #FFBF86 · aksen #FFD27A | Shippori Mincho B1 800 + Zen Maru Gothic 700 | cel 2 nada + rim, sinar dewa, bloom, noda soft-light, butiran 0,14 | polos, bayangan lembut, kunci kuning |
| `noir` | **Noir Novel Grafis** | tinta #04060B · malam #0A1426 #11223B #1E2F49 · kabut #6A83A0 · bulan #EEF2F5 · **satu hangat #FFC84A** | Eczar 800 + Bitter 800 | siluet tinta, garis kuas bertirus, raster titik heksagonal, butiran 0,28 | kotak komik putih, garis 5 px, bayangan offset 11 px, kunci distabilo kuning |
| `catair` | **Cat Air Pagi** | kertas #F4EFE4 · biru #7F9CC8 #5B77AE · hijau #6D8C7B · oker #DCC29C · tinta #2B2B35 · aksen #A4553A | Gilda Display + Alegreya Sans 800 | sapuan transparan + rembesan, tepi basah, granulasi `noda()`, kertas multiply | sobekan kertas krem |
| `ukiran` | **Ukiran Tembaga** | kertas #E9DCC0 · tinta #2B1D14 · abu-sepia #8E8272 #5C5247 · **vermilion #B5442A** | IM Fell English SC + Spectral 700 | arsiran garis (silang bila gelap), langit bergaris, bercak foxing | label krem bingkai ganda |
| — | **Manuskrip Emas** (resep) | perkamen #EADBB6 · lapis #1E3A94 #101F55 · emas daun · vermilion #C23A22 · malakit #2E8A62 · tinta #2B1A10 | Aref Ruqaa / Cormorant Garamond + Crimson Pro 700 | daun emas: topeng → tekstur lembar + retak + **pita kilau menyapu**, debu emas | pita banderol perkamen berbingkai emas |
| — | **Poster Gouache** (resep) | langit berpita #2C6A9A→#EDE6C9 · air #79B6C8 · hijau #5C8A3E · krem #F7EAD0 · oranye cetak #D9542B · tinta #1C2430 | Ultra (bayangan cetak offset) + Cabin 700 | 2–3 nada per bentuk, tepi kuas kering, belang sapuan ikut lapisan, kertas poster | sapuan tinta indigo, kunci #FFC54D |

### Suasana = palet siap pakai (`PALET['varian-suasana']`)
| kunci | langit | darat & subjek | cahaya | kapan dipakai |
|---|---|---|---|---|
| `anime-fajar` | #1E2753→#B97498→#FFDDA4 | ungu-biru #6F6A9D #44556B, kabut #F6D2C2 | matahari rendah kiri, sinar kuat 1,1, bloom 0,32 | pembuka megah, legenda, perjalanan |
| `anime-siang` | #2A64B8→#93C4EC→#DDF0F8 | hijau #5E93A6 #4E7A5E #2F5D45, pasir #C9B48F, air #3F86C4 | matahari tinggi kiri, sinar 0,55, bloom 0,16, vinyet navy tipis | **sains sehari-hari**, alam, cuaca, edukasi |
| `anime-malam` | #070B1E→#26305E→#3E4878 | biru-ungu gelap #2D3664 #1B2342 | bulan kanan, bintang, lampu #FFC870 | malam, bintang, kota, misteri ringan |
| `noir-malam` | #04060B→#1E2F49 | siluet tinta, pasir #3B4F6C | bulan kiri, satu hangat #FFC84A | misteri, kriminal, kapal hantu |
| `catair-pagi` / `catair-siang` | kertas #F4EFE4 / #F5F1E8 | pastel biru-hijau-oker | matahari blot oker | puitis, kesehatan, musim |
| `ukiran-kertas` | garis ukir di kertas #E9DCC0 | arsiran sepia | matahari vermilion #B5442A | sejarah, sains klasik |

Cahaya **bukan** dikunci di kode. `sinarKuat`, `mekar`, `noda`, `vin`, `surya`, `bulan`, dan `bintang` adalah isi palet. Suasana baru cukup ditambahkan sebagai baris di `PALET`: salin yang paling mirip, lalu ganti warnanya.

### Cara melukis tiap varian (isi cabang `cat()` / `pasca()`)
**Lanskap Anime Fajar**
- Bentuk diisi dengan warna rim, lalu bentuk yang sama digeser (14, 5) diisi warna dasar. Hasilnya pita terang hanya di sisi yang menghadap cahaya.
- Sisi bayangan memakai poligon `o.gelap` dengan tinta 28 %. Kaki gunung memudar ke warna kabut (gradien 380 px).
- Awan: dasar = campuran `awan` dan `awanG` 50 %, rim = `awan`, ditambah gradien `awanG` di sepertiga bawah sebagai volume.
- Pasca: `sinarDewa` (15 berkas, goyang `nz`, diklip di atas punggung dekat) → `mekar(.32)` → `noda` soft-light 0,5 → vinyet ungu.

**Noir Novel Grafis**
- Sama seperti anime, ditambah `kuas()` bertirus di sepanjang punggung (lebar 3–7 px, tekanan acak berbenih).
- Awan diberi garis tepi tinta gabungan. Ini diperoleh dengan `stroke` lebih dulu, lalu `fill`.
- Pasca: sinar bulan → `rasterTitik(c, 7)`. Luminans layar dikecilkan, lalu titik multiply di grid heksagonal. Titik membesar di nada tengah dan hilang di hitam pekat maupun terang.
- Lalu vinyet kuat, dan terakhir pendar hangat (lampu kepala, lampu jip) yang tidak terkena raster.

**Cat Air Pagi**
- Isi bentuk dengan alpha 0,86, lalu isi sekali lagi bergeser (4, −5) dengan alpha 0,22 sebagai rembesan.
- Di dalam klip bentuk, tempel `noda()` multiply 0,55 untuk granulasi, lalu gradien ke warna kertas di bagian bawah (basah memudar).
- Tepi basah: punggung digaris dua kali (9 px α 0,1 dan 2,4 px α 0,45) dengan warna bentuk yang lebih tua.
- Langit: gradien α 0,75 + noda 0,28. Pasca: kertas multiply + vinyet cokelat lembut.

**Ukiran Tembaga**
- Bentuk diisi kertas yang sedikit diwarnai, lalu `arsir()`. Nada `1 − lum(warna)` mengatur tebal garis. Bila nada > 0,5, ditambah arah silang 60°. Garis sedikit melengkung (`bengkok`).
- Punggung diberi garis tinta 2,6 px. Langit berupa garis mendatar yang menipis ke cakrawala. Matahari berupa lingkaran + jari-jari vermilion.
- Awan: garis tepi gabungan, arsiran hanya di bulan sabit bawah tiap gumpal (arsir semua, lalu tutup elips yang digeser ke atas dengan warna kertas).

**Manuskrip Emas** (belum ada di contoh; begini membuatnya)
- Gambar semua benda emas sebagai topeng di kanvas terpisah.
- `source-in` dengan tekstur daun emas yang dipanggang sekali: lembar persegi dengan sambungan, retak halus, goresan burnish, gradien #8C6A2F → #F6DC8A → #B8862E.
- Tiap frame tambahkan pita kilau diagonal `screen` yang bergeser `x = (t*260) % 2400`, bayangan timbul (offset 3 px tinta 40 %), dan pendar.
- Bidang lapis: biru bergranul (`noda` multiply di atas #1E3A94). Ornamen jalinan digambar progresif dengan `setLineDash` + `lineDashOffset`.
- Teks muncul seperti tinta mengalir: blur 6 → 0 px ditambah tepi basah.

**Poster Gouache** (belum ada di contoh; begini membuatnya)
- Tiap bentuk 3 nada: dasar, sisi terang (digeser ke arah cahaya), dan sisi teduh.
- Tepi kuas kering: `setLineDash([18, 7, 4, 9])` pada garis tepi warna dasar α 0,5.
- Belang sapuan: pola goresan pendek (dipanggang) di-`clip` ke bentuk dan **ikut transform lapisan**.
- Langit 7 pita bergelombang. Judul memakai bayangan cetak offset 2 warna (oranye 6 px, indigo 12 px).

**Cara memilih varian dari topik:**
- Misteri, kriminal, kejadian malam, kapal, dan cerita yang "dingin" → `noir`.
- Alam, pagi, legenda, perjalanan, sesuatu yang megah tapi hangat → `anime` + `fajar`.
- Sains sehari-hari (langit, pelangi, hujan, angin, tumbuhan) → `anime` + `siang` + `DIAGRAM = true`.
- Topik puitis seperti cuaca, aroma, musim, kesehatan, alam lembut → `catair`.
- Sejarah abad 17–19, bencana lama, penjelajah, peta, sains klasik → `ukiran`.
- Agama, kalender, astronomi kuno, aksara → **Manuskrip Emas**.
- Wisata, geografi daerah, kota, angka besar yang ceria → **Poster Gouache**.

**Supaya video tidak kembar** (ganti minimal 2 dari palet, font, gerak khas, transisi):
- Anime "Senja Ungu" (baris baru di `PALET`): langit #2B1E3F→#E0607E→#FFB36B, font Kaisei Decol + Zen Kaku Gothic New. Untuk anime siang, font bisa diganti Zen Old Mincho + M PLUS Rounded 1c 800.
- Noir B "Hujan Kota": tambahkan hujan dua lapis, aksen merah neon #FF5A4E sebagai satu-satunya warna hangat, font Alfa Slab One + Bitter.
- Cat Air B "Senja Basah": #F2E6D8 + ungu #8A6FA8 + jingga #E89A5B, font Fraunces + Nunito 800.
- Ukiran B "Biru Prusia": tinta #1F3550 di kertas #EEE6D3, aksen oker #C98A3B, font Cinzel + EB Garamond 700.

## Kerangka adegan Shorts 30–60 dtk
| Detik | Adegan | Kamera | Isi |
|---|---|---|---|
| 0–2,5 | Hook: dunia tersingkap | turun/mundur dari langit, awan/kabut tersibak | sinar atau pendar menyala, judul 2 baris masuk per kata bersama kalimat VO pertama (subtitle mati) |
| 2,5–9 | Tempatnya | dolly-in pelan + geser | subtitle mulai, 1–2 label menunjuk benda yang disebut |
| 9–20 | Masuk ke mekanisme | transisi menyambung, lalu menyelam atau menembus objek (penampang, malam ke siang, zaman lampau) | angka besar berdiri di dunia, label |
| 20–35 | Puncak | gerak paling besar: guncang, derek naik, kilat | satu momen wow + satu bunyi |
| 35–45 | Jawaban | tarik mundur memperlihatkan semuanya | kalimat inti, aksen warna |
| 45–55 | Penutup | mundur jauh, sinar atau lentera menjadi titik "?" | pertanyaan ke penonton, judul kecil |

**Versi 16:9:** pakai `--rasio 16:9`. Geser subjek ke sepertiga kanan, letakkan judul di kiri. Perlebar punggung dan langit sampai x ≥ W+700 (`punggung(..., x1 = 2700)`), karena contoh dibuat untuk lebar 1080. Subtitle di y 0,84 H. Kurangi tinggi langit.

## Gerak & transisi
- Semua gerak ditulis sebagai fungsi `t`: awan `x = x0 + t*laju`, asap lahir terus dengan `frac(t*laju + k/n)`, lentera berayun `sin`. Kamera memakai `kamera(t)` dengan `E.io/E.s`.
- **Transisi khas per varian** (`tutup(c,p,t)`, p 0→1): anime = hembusan pasir/cahaya menyapu dari kanan · noir = cipratan tinta menutup · cat air = satu tetes cat mekar · ukiran = tirai arsiran turun bergaris vermilion · manuskrip = sapuan debu emas atau balik halaman · gouache = sapuan penampang.
- Transisi menyambung lainnya: menyelam menembus benda (medali, kawah, jendela), whip pan + blur, benda besar lewat di depan lensa, match cut bentuk (lentera → titik tanda tanya).
- Setelah layar tertutup penuh, adegan baru langsung dibuka dalam ≤0,2 dtk. Jangan biarkan layar putih atau polos lama.

## Suara
- **VO (ElevenLabs v4):** pencerita hangat dan pelan seperti mendongeng, ±15–17 huruf per detik, jeda "…" sebelum fakta kejutan. Untuk noir, suara lebih rendah dan berbisik ([whispers] secukupnya).
- **Musik:** ambient sinematik (pad, piano, cello, celesta). Noir memakai cello rendah + kontrabas pizzicato, anime memakai strings + celesta, ukiran/manuskrip memakai harpa + paduan suara lembut. Volume 0,25–0,32, di-duck oleh VO.
- **SFX pelan dan jarang:** satu bunyi per momen, ditaruh di jeda VO. Contohnya whoosh lembut saat awan tersibak, glow/chime saat sinar menyala atau label emas muncul, swish saat transisi, thump saat cap atau angka mendarat. Ambience loop sangat pelan (angin gunung, ombak, jangkrik) 0,06–0,1. Jangan ada bunyi pena atau spidol.

## Cara membangun
1. `python3 scripts/mf.py baru <proyek> --dasar dunia-2d`. Semua kode inline, tanpa file data.
2. Atur tiga tombol di blok `[1]`. Di browser, `index.html?v=anime&s=siang&diagram=1` menampilkan kombinasi lain. `mf.py potret` tidak meneruskan `?`, jadi untuk memotret ubah nilai bawaannya di `[1]`.
3. **Cari blok lewat penandanya** (`/* ==== [6] DAFTAR DUNIA`), jangan lewat nomor baris:
   - `[1]` tombol · `[2]` PALET · `[3]` warna & noise · `[4]` tekstur & kuas (`cat()`, `gumpal()`, `bantu()`, `pendar()` …)
   - `[5]` bentuk generik + `GAMBAR[jenis]` · **`[6]` DAFTAR DUNIA** (bagian yang diganti) · `[7]` kamera
   - `[8]` langit, `dunia()`, awan pembuka, `pasca()`, `tutup()` · `[9]` diagram · `[10]` teks · `[11]` SCENE
   - Blok `[3] [4] [5] [8] [9]` dipakai apa adanya.
4. **Topik baru = ganti daftar `[6]`.** Satu baris adalah satu lapisan, urut belakang → depan. Contoh untuk topik danau/kota:
```js
const DUNIA = [
  {jenis: 'langit', p: .03},
  {jenis: 'bukit', p: .1, warna: 'bukitJauh', y: 1000, amp: 70, sd: 2, kabut: [1060, 70, 2, .8]},
  {jenis: 'kota', p: .22, warna: 'bukitTengah', y: 1150, tinggi: 260, x0: 300, x1: 1300},
  {jenis: 'danau', p: .3, y: 1150},
  {jenis: 'bukit', p: .7, warna: 'dekat', y: 1430, amp: 55, sd: 41, pudar: false,
    pohon: [{x: 800, h: 300, jenis: 'bulat'}, {x: 900, h: 380}]},
  {jenis: 'batu', p: .85, titik: [[-40, 1520], [70, 1382], [262, 1392], [330, 1560]], tokoh: TOKOH},
  {jenis: 'rumput', p: 1.15, y: 1790}
];
```
   Jenis yang tersedia beserta parameternya:
   - `bukit` {y, amp, fr, sd, miring, rim, semak, pohon}
   - `gunung` {cx, puncak, kaki, lebar, cekung, kawah, alur:{n,dari}, asap:{n,laju,naik,geser,r0,r1}}
   - `dataran` {y, riak}
   - `danau` {y, kilauX}
   - `kota` {y, tinggi, lebar, x0, x1}; jendela menyala di suasana malam
   - `batu` {titik, tokoh:{x,y,s,pose:'berdiri'|'menunjuk'}}
   - `rumput` {y}

   Tambahan untuk semua lapisan: `kabut: [y, tebal, benih, kuat, laju]` dan `ekstra: (c, t) => {...}` untuk benda khusus (contoh: `jip()` di Bromo). Warna ditulis sebagai nama kunci palet (`'dekat'`) atau hex.
5. Jenis baru (misalnya `laut`, `gua`, `sawah`) ditambahkan sebagai fungsi di `GAMBAR` (blok `[5]`). Isinya: buat Path2D, lalu `cat(c, P, warna, {rim, garis, bb, gelap})`. Varian akan mengurus rim, arsir, tepi basah, atau garis tinta.
6. Kelompok bentuk **transparan** (asap, awan) digambar opak di `bantu(c, alpha, b => …)`, lalu ditempel sekali.
7. **Cahaya hangat** dibuat dengan `pendar()`. Pendar digambar **setelah** pasca, jadi tidak dimakan raster/kertas. `GLK` meredupkannya selama awan pembuka masih menutup.
8. Label yang menempel ke benda: `label({...})` + posisi `layar(x, y, p)` dengan p yang **sama** dengan lapisan bendanya (lihat `LBL` di `[10]`).
9. Varian baru (Manuskrip Emas, Gouache): tambah baris `PALET`, lalu cabang di `cat()`, `pasca()`, dan `tutup()`.
10. Benda rumit dipanggang sekali (`sekali(L, '_kunci', fn)` atau di luar `frame()`). Target ≤0,3 dtk per frame (contoh: ±0,11 dtk).

## Diagram di dalam dunia (topik sains) — blok `[9]`
Penjelasan sains harus **terlihat** di dalam dunia. Kalau cuma diceritakan VO, penonton tidak menangkapnya. Fungsi siap pakai, semuanya di koordinat layar, digambar setelah pasca (tidak terkena tekstur):
- `berkasCahaya(c, x0, y0, x1, y1, t, {k, lebar:34})`: berkas tebal bergaris tepi gelap, dengan denyut putih berjalan. `k` 0→1 = berkas tumbuh.
- `molekul(c, x, y, s, t, a)`: dua atom r 32×s bergaris tepi tebal, bergoyang.
- `titikJelas(c, x, y, r, warna, a)`: partikel yang terbaca di latar apa pun (pendar + isi + garis gelap + cincin putih + kilau).
- `pencar(c, x, y, t, t0, {n, jeda, umur, laju, r})`: gelombang partikel memencar ke segala arah, berekor, berulang.
- `panahEnergi(c, titik[], t, {k, tebal:16, warna})`: panah tebal yang tergambar sepanjang jalur. Bergaris tepi, ada kepala panah, ada denyut.
- Contoh lengkap: `diagramContoh()` ("kenapa langit biru": matahari → molekul → biru memencar → panah ke mata tokoh yang menunjuk).

**Aturan terbaca:**
- Partikel r ≥ 14 px, atom r ≥ 30 px, panah tebal ≥ 14 px.
- Selalu pakai garis tepi gelap `dgGaris` dan cincin putih.
- Warnanya kontras dengan latar: di langit biru, biru diberi cincin putih dan panahnya oranye.
- Bergerak, bukan titik diam.
- Paling banyak 3 jenis benda diagram sekaligus, dan setiap benda diberi label.
- Muncul **setelah** judul keluar (judul selesai ±3,3 dtk), supaya tidak bertabrakan.

## Gambar uji adegan 1 (wajib sebelum suara)
**Detik potret yang disarankan:** `mf.py potret <proyek> --t 0.3,1.5,4,6,9`. Artinya: hook, judul, diagram/label pertama, subjek + subtitle, dan transisi. Untuk video penuh, tambahkan `--n 12`. Buka `lembar.jpg` dan beberapa potret ukuran penuh (di Mac: `open "<proyek>/lembar.jpg"`; path berspasi wajib diberi tanda kutip). Periksa:
- **0,3 dtk:** hook sudah memikat. Ada bentuk besar yang menutup atau tersingkap, cahaya (matahari/bulan + sinar), dan minimal 3 kedalaman terlihat. Bukan layar kosong atau satu warna.
- **1,5 dtk:** judul terbaca jelas (kontras dengan langit), kamera jelas sudah berpindah dari 0,3, subjek utama mulai tampak.
- **6 dtk:** subjek utama dan labelnya jelas, perspektif udara terasa (jauh pucat, dekat gelap), tekstur varian terlihat di potret ukuran penuh (raster/arsir/kertas), subtitle terbaca di atas latar gelap, tidak ada teks di luar zona aman (atas 180, bawah 1620, kanan 930).
- **4 dtk (bila ada diagram):** benda penjelas terbaca dari jarak HP, artinya besar, bergaris tepi, dan berlabel.
- **9 dtk:** transisi khas varian sedang menutup layar dengan rapi (di video penuh: detik transisi tiap adegan).
- Konsol: `error halaman: tidak ada`.

## Jebakan yang sudah pernah terjadi → perbaikannya
- **Lingkaran transparan bertumpuk** (asap/awan) memperlihatkan "jahitan" dan terlihat seperti sosis → gambar opak di `bantu()`, lalu pudarkan bagian atas kolom dengan `destination-out`.
- **Rim terang di semua tepi** terlihat seperti garis luar → geser rim ke arah sumber cahaya (`rx 14, ry 5`) dan beri sisi gelap `o.gelap`.
- **Pendar lampu melayang di atas awan pembuka** → pendar dikali `GLK` (0 selama awan menutup).
- **Sinar dewa menyapu kaki depan** yang seharusnya gelap → klip sinar di atas punggung dekat.
- **Kabut di semua lapisan** membuat lapisan dekat ikut pucat → `pudar:false` untuk lapisan dekat. Perspektif udara hanya untuk lapisan jauh.
- **Asap noir bergaris luar** jadi terlihat seperti per spiral → asap noir tanpa garis (`garisAwan:0`).
- **Font teknis/mono** dinilai dingin oleh penonton → pakai pasangan font varian.
- **Titik putih kecil di langit biru** (serbuk, dandelion, kilau) terbaca sebagai **salju/bintang** → hapus, atau pakai daun/kelopak berwarna ≥ 10 px yang bergerak menyamping. Jangan menebar titik kecil di langit siang.
- **Diagram terlalu kecil**: titik biru 6 px di langit pucat tidak terbaca → pakai fungsi blok `[9]` (r ≥ 14, garis tepi gelap).
- **Siang jadi pucat** karena sinar, bloom, dan vinyet berwatak fajar → pakai `anime-siang`. Sinar dan bloomnya sudah lebih lemah, vinyetnya navy.
- **Menyunting lewat nomor baris** ternyata meleset karena baris panjang dan bergeser → cari penanda blok `/* ==== [N]`, lalu ganti teks yang unik.
- **Menulis ulang dunia dari nol** untuk topik non-gunung → cukup ganti daftar `[6]`; mesin `[5]` sudah generik.
- **Tampilan 3D clay primitif di siang terik datar** tidak disukai → tetap 2D berlapis dengan cahaya miring.
- **Layar memutih ±0,3 dtk** saat kepulan transisi → buka adegan baru maksimal 0,2 dtk setelah layar tertutup penuh.
- **Adegan dirancang pada VO perkiraan**, lalu VO asli bergeser → simpan waktu adegan di satu tabel (detik desain ↔ kata VO), lalu petakan ulang. Jangan menggeser angka satu per satu.
- **Butiran + partikel membuat MP4 besar** → turunkan butiran (≤0,2) di varian terang, atau render dengan CRF lebih tinggi.
- **Tokoh/adegan sensitif**: tanpa darah, tanpa jenazah. Korban digambarkan sebagai siluet yang memudar atau larut menjadi titik cahaya/tinta.
- **Fakta di layar** hanya yang ada di naskah. Untuk legenda, tulis "cerita rakyat" atau "konon".

## Detail lagi (daftar khusus dunia-2d; pilih 3–5 per putaran)
- Satu benda yang **bergerak di setiap lapisan**: awan hanyut (langit), asap/burung (jauh), perahu/jip berdebu (tengah), rumput/daun bergoyang (depan).
- **Bayangan kontak** di bawah tokoh, batu, dan pohon (elips gelap pipih α 0,3).
- **Pohon jauh** kecil sebagai siluet di punggung jauh untuk memberi skala (`pohon` di lapisan p 0,12, h 60–90).
- **Pantulan** di air: kilau matahari (`danau` sudah ada), dibalik untuk lampu kota/bulan.
- **Bayangan awan** melintas di dataran (elips gelap α 0,12 yang bergerak bersama awan).
- **Rim + aksesori tokoh**: syal/rambut berkibar, ransel, lampu kepala (malam).
- **Kabut kedua** di kaki subjek utama, ditambah sinar yang menembus kabut.
- Daun/kelopak **berwarna** ≥ 10 px melayang menyamping (BUKAN titik putih kecil).
- Tekstur terlihat di potret ukuran penuh: naikkan `PAL.noda` (anime), raster (noir), noda (cat air), arsir (ukiran).

## Revisi cepat
- Kalau hasilnya **"datar seperti vektor"** → tambah 1–2 lapisan antara + pita kabut, naikkan `o.rim`, beri `o.gelap` pada gunung, dan tambah `mekar()` atau noda soft-light.
- Kalau **"terlalu gelap / tidak terbaca"** (noir) → terangkan `pasir/kabut` satu tingkat, besarkan sinar bulan, dan pastikan satu warna hangat ada di dekat subjek.
- Kalau **"kotor / keruh"** (cat air, ukiran) → kurangi alpha `noda` dan kertas, kurangi foxing, jarangkan arsir (`jarak` 7 → 9).
- Kalau **"judul tenggelam"** → tambah bayangan teks 2 lapis (keras + lembut) atau ganti warna j2 ke aksen. Jangan menambah kotak di belakang judul.
- Kalau **"kurang hidup"** → tambah satu benda yang selalu bergerak di setiap lapisan (awan hanyut, asap, jip, rumput, burung), plus goyang kamera `nz()`.
- Kalau **"kembar dengan video lain"** → ganti varian atau set alternatif, ganti transisi khas, dan pindahkan sumber cahaya ke sisi lain.
