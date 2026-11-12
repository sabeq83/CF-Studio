# Gaya: Kartun Cel Cerah

> Kartun ala anime siang hari: garis tinta tegas, bayangan cel 3 nada bertepi keras, warna jenuh, latar berlapis paralaks, dan tokoh remaja/dewasa yang menjelaskan lewat balon kata dengan mulut bergerak mengikuti suara. Akar dari seri asli kami: Reels dialog "Kiamat zombie 2" (tokoh anime aksi, balon kata, lip-sync) dan "Bunglon tidak sedang menyamar" (anime pagi cerah).

## Cocok untuk · tidak cocok untuk
**Cocok:** "kenapa …?" sains sehari-hari yang dibawakan tokoh (kenapa bawang bikin nangis, kenapa kuping berdenging), mitos vs fakta, dialog dua tokoh (yang satu salah paham, yang satu menjelaskan), tips hidup, cerita lucu dengan pelajaran, edukasi SMP–dewasa.

**Tidak cocok:** berita duka, bencana, kriminal, politik (tokoh ceria terasa meremehkan) · data rumit penuh angka (pakai gaya grafis data) · mesin yang harus dibongkar bagian per bagian (pakai isometrik) · peta · konten iklan yang wajib tanpa wajah/tokoh.

## Ciri wajib
1. **Garis & cel.** Tokoh dan benda yang disentuh tokoh memakai garis tinta plum `#2B1A3F` 5 px (pada skala 1). Bayangan = gradien dengan stop ganda (tepi keras), 3 nada: terang | tengah | gelap, cahaya dari **kiri-atas**. **Latar tanpa garis** (bidang 3 nada + kabut biru) supaya tokoh menonjol.
2. **Tokoh ±6 kepala, BUKAN chibi bulat** (user menolak tokoh bulat). Wajah 3/4 berdagu lancip, mata anime tinggi dengan iris bergradasi + 2 titik kilau, alis tipis bersudut, poni bergerigi, ahoge (helai mencuat), pipi berarsir merah muda. Tangan bersudut, lengan baju digulung.
3. **Palet siang (set A):** langit `#2B9BF4 → #7CC8FF → #D4F1FF`, awan `#FFFFFF/#DCEBFF/#A9C3EE`, dinding mint `#CBF2E5`, kayu `#E9A563`, lemari biru `#44A1EE`, aksen koral `#FF4F64` + biru `#2EC5FF`, kulit `#FFD6B6/#ECA77F/#BC7253`. Jangan pakai navy + krem + kuning (itu gaya rumah, tidak dibagikan).
4. **Kamera selalu bergerak + paralaks 7 lapis** lewat `pasang(ctx,cam,d)`: langit d .04, matahari .06, awan .12, bukit/kota .22, pohon .4, dinding .88, tokoh & meja 1, daun depan kabur 1.35. Satu **zoom kejut** (0,3 dtk) ke wajah per 10–15 dtk + garis fokus.
5. **Cahaya:** sinar matahari diagonal (mode `screen`), debu cahaya melayang, bayangan tokoh lembut di dinding, vinyet biru ≤ .22, butiran `grainOn(.05)`.
6. **Tipografi (1080×1920):** judul **Dela Gothic One** 3 baris — baris 1 & 3 74 px, kata kunci 158 px berwarna — putih/warna dengan `-webkit-text-stroke` 13 px tinta + bayangan 11 px. Balon kata **Kanit 800 56 px**. Chip/label Kanit 800 38–52 px. Label nama Dela Gothic One 40 px di pita warna tokoh, miring −3°.
7. **Subtitle = balon kata** (bukan subtitle bawaan; `SCENE.sub={gaya:'mati'}`): kotak putih, garis tinta 7 px, bayangan tinta geser (8,12), lebar 860 (x 70–930), dasar di `AMAN.bawah` (y 1620). Ekor pendek (≤95 px) mengarah ke mulut pembicara. Kata yang diucapkan menyala koral, kata berikutnya pudar 32 %, maksimal 8 kata per balon.
8. **Mulut lip-sync** dari amplop VO pada 15 fps (patah-patah ala kartun), kedip otomatis tiap ±3 dtk, napas (naik-turun 3 px), kepala mengangguk saat bicara.
9. **Efek anime:** tanda "!" + 3 garis kaget, bintang kilau 4 sudut, mata "> <" saat perih/malu, aliran air mata, garis fokus radial, impact strokes saat benda dipukul/dipotong.
10. **Penjelas visual:** `label()` mesin (Kanit 52 px, warna aksen) untuk menunjuk benda, dan **lensa pembesar** bundar bergaris tinta 12 px dengan chip judul di atas & chip hasil di bawah untuk dunia mikro.

## Yang boleh berubah per video
Ganti minimal 3 dari: palet, font, lokasi, tokoh, waktu hari. Tiga set siap pakai:

| Set | Suasana | Palet inti | Font judul + balon |
|---|---|---|---|
| A "Dapur pagi" (contoh) | jendela, sinar pagi | mint `#CBF2E5`, koral `#FF4F64`, biru `#2EC5FF` | Dela Gothic One + Kanit 800 |
| B "Sore keemasan" | teras/taman, sore | langit `#FF9F6B → #FFD2A1`, dinding `#FFE4CF`, tinta `#3A1F2B`, aksen ungu `#7A4DFF` | Reggae One + M PLUS 1p 800 |
| C "Kelas sains" | ruang kelas/lab, lampu neon | dinding `#E6ECFF`, papan hijau `#2F6B57`, aksen magenta `#FF4FD8` + cyan `#16D3F0` | Bangers + Rubik 800 |

Tokoh baru = entri baru di `TOKOH` (3 nada untuk kulit/rambut/baju/celemek/celana/sepatu, `iris`, `jepit`, `potongan:'bob'|'cepak'`). Ganti celemek dengan warna seragam/jaket sesuai lokasi.

## Kerangka adegan Shorts 30–60 dtk

| Detik | Adegan | Kamera | Isi |
|---|---|---|---|
| 0–2 | Hook aksi | dekat ke tangan/benda (zoom 2), lalu crane naik | tokoh melakukan sesuatu yang dikenal semua orang + judul 3 baris |
| 2–5 | Masalah muncul | sedang, goyang halus | ekspresi berubah (kaget → perih/bingung), tanda "!", balon pertama |
| 5–6 | Punchline emosi | **zoom kejut** ke wajah + garis fokus | mata "> <", air mata/keringat, bintang kilau |
| 6–16 | Penjelasan 1 | tarik balik lebar | tokoh menunjuk, **lensa pembesar** ke dunia mikro, label |
| 16–28 | Penjelasan 2 | whip pan ke lokasi/diagram kedua | proses langkah demi langkah dalam cel; tokoh kedua boleh menyela |
| 28–40 | Bukti / angka | dorong pelan | chip angka besar, perbandingan sebelum/sesudah |
| 40–50 | Solusi / tips | sedang | tokoh mempraktikkan tipsnya, ekspresi senang |
| 50–60 | Penutup | crane mundur | kalimat pamungkas di balon + kartu akhir "Kamu tim …?" |

**Format dialog (2 tokoh):** satu tokoh salah paham/panik, satu lagi kalem dan tahu jawabannya. Giliran bicara 1–2 kalimat, kamera mendorong ke yang sedang bicara, yang mendengar tetap bereaksi (lirikan, alis, keringat). Selipkan b-roll layar penuh (close-up benda, lensa mikro) setiap 10–15 dtk supaya tidak hanya "dua kepala bicara". Penutup berupa pertanyaan ke penonton ("Kamu tim galon atau tim mi?").

**Versi 16:9:** tokoh di sepertiga kiri, lensa/diagram di kanan; balon kata selebar ±1100 px di bawah tengah; dialog dua tokoh = kiri-kanan dengan kamera bergantian mendorong ke pembicara (shot/reverse-shot). Semua posisi di contoh ditulis untuk 9:16, jadi tata ulang angka `x,y` tokoh, meja, `KAM`, dan lensa.

## Gerak & transisi
- Tokoh tidak pernah diam: napas, kedip, rambut bergoyang (`goy`), angguk saat bicara, satu ganti pose tiap 1–2 dtk.
- Ganti pose lewat `kunci()` 0,3–0,4 dtk (E.io); ganti ekspresi 0,12–0,3 dtk; pose kaget boleh 0,18 dtk.
- Kamera: crane/dolly lambat + zoom kejut 0,3 dtk → tahan ±0,6 dtk → tarik balik 0,45 dtk. Getar kecil 5 px saat benturan.
- Muncul (chip, lensa, tanda "!"): `E.back` 0,25–0,45 dtk. Judul: `wIn` per kata dengan `ease:'back.out(2.2)'`.
- Transisi antar-adegan: whip pan + garis kecepatan, daun/benda melintas lensa, kilat putih, zoom menembus ke lensa (match cut), atau wajah close-up → lebar.
- Hindari: fade silang lambat, benda meluncur lurus tanpa easing, tokoh berpindah tanpa langkah.

## Suara
- **VO ElevenLabs v4** sebagai *suara tokoh*, bukan narator dokumenter: hangat, ekspresif, sedikit lucu. Tag tulis tangan: `[surprised]`, `[sniffs]`, `[laughs]`, `[curious]`, `[pause]`. Dua tokoh = dua suara berbeda (pria/wanita). **Satu generasi per baris** → buang jeda > 0,3 dtk → tempo 1,05–1,1 → loudnorm −18.
- Dialog lebih panjang dari dugaan: ±13 huruf/dtk. Shorts 30 dtk ≈ 400 huruf naskah.
- Contoh naskah adegan pembuka (tag ditulis tangan, satu baris = satu file):
  ```
  01-A  [sniffs] [surprised] Aduh... kok mataku perih?!
  02-A  [curious] Pisau memecah sel bawang. [pause] Isinya bercampur, lalu jadi gas yang menyengat mata.
  ```
- **Musik:** pop anime/lo-fi ceria instrumental, vol .12–.18, fade-in 1,5 dtk supaya kata pertama tidak tertutup. Musik generasi ±30 dtk sering punya ending sendiri di ±28 dtk → sambung di ketukan.
- **SFX pelan & jarang, satu bunyi per momen, di jeda VO:** "tok" pisau/benturan (cukup 2 dari 5 potongan), "ting" kilau saat lensa muncul, "boing" kecil untuk tanda "!", whoosh pendek untuk zoom kejut, pop untuk chip. Vol .3–.5. Potong SFX panjang agar tidak menimpa kata kunci.

## Cara membangun
Mulai: `MF_PORT=<port> python3 scripts/mf.py baru <proyek> --dasar kartun-cel` → buka `<proyek>/index.html?debug=1`.

**Peta `scene.html`** (cari `== n.`):
1 PALET & TOKOH · 2 ALAT CEL (`cel`, `isi`, `kapsul`, `ik`) · 3 TOKOH (`tokoh`, `POSE`, `EKSPRESI`, `kunci`) · 4 MULUT (`bukaMulut`) · 5 KAMERA (`KAM`, `pasang`, `keLayar`) · 6 LATAR (luar jendela, dinding, meja) · **7 ALAT PERAGA TOPIK** (bawang, pisau, gas, lensa) · 8 EFEK ANIME · 9 BALON KATA · 10 SCENE (`T`, `kata`, urutan gambar).

**Topik baru:** ganti bagian 7 (benda topik + isi lensa), `T` (detik kejadian), `KAM`, daftar `kunci()` pose/ekspresi di `frame`, `SCENE.kata`, teks `#judul`. Bagian 2–5 dan 8–9 biasanya tetap. Lokasi baru = ganti isi `luarJendela/dinding/meja` dengan bidang 3 nada tanpa garis.

**Memanggil tokoh** (titik = kaki di dunia; `s:1.4` = kepala ±240 px):
```js
const pose=kunci(t,[[0,'iris'],[1.8,'kaget',.18],[2.2,'usap',.35],[4.4,'tunjuk',.4]],POSE);
const eks =kunci(t,[[0,'senang'],[1.8,'kaget',.12],[2.0,'perih',.25],[4.5,{...EKSPRESI.yakin,airmata:.35}]],EKSPRESI);
const A={x:470,y:1938,s:1.4,t,pose,ekspresi:eks,warna:TOKOH.A,bicara:bukaMulut(t,'A'),raih:{jauh:[780,1180]}};
pasang(c,cam,1);ANK.A=tokoh(c,{...A,lapis:'badan'});   // di belakang meja: badan dulu
meja(c,cam,t);                                         // lalu meja + benda di atasnya
pasang(c,cam,1);tokoh(c,{...A,lapis:'lengan',pegang:{dekat:'pisau',sudut:.42}});  // lalu lengan di atas meja
```
Pose & ekspresi yang sudah tersedia:

| `POSE` | dipakai saat | `EKSPRESI` | tampilan |
|---|---|---|---|
| `diri` | berdiri santai, mendengar | `netral` | mata terbuka, senyum tipis |
| `iris` | bekerja di meja (tangan di benda) | `senang` | mata "^ ^", pipi merona |
| `kaget` | satu tangan terangkat | `kaget` | mata lebar, alis naik, mulut "o" |
| `usap` | mengusap mata/pipi | `perih` | mata "> <", air mata mengalir |
| `nangis` | dua kepalan di dada | `sedih` | alis cemas, mata turun |
| `tunjuk` | menunjuk ke atas-depan, satu tangan di pinggang | `yakin` | alis naik, senyum, lirik ke benda |
| `angkat` | dua tangan ke atas (sorak) | `marah` | alis turun ke tengah |
| `pikir` | tangan di dagu | — | gabungkan: `{...EKSPRESI.yakin,airmata:.3}` |

- `raih` = titik DUNIA untuk tangan (`dekat` = tangan sisi penonton, `jauh` = tangan seberang); tanpa `raih` tangan ikut `POSE`.
- **Pose baru:** tambah ke `POSE` dalam koordinat lokal (x maju, y negatif ke atas; kaki 0, bahu ≈ −786, wajah ≈ −935, meja nyaman ≈ −620). `kD/kJ` = arah siku (+1/−1): coba dua-duanya, pilih yang sikunya ke bawah/luar.
- **Ekspresi baru:** salin entri `EKSPRESI` lalu ubah angka (`buka` 0,4–1,3, `pejam` > .5 = mata "> <", `mataSenyum` > .5 = "^ ^", `alis`, `cemas`, `senyum` −1..1, `airmata`, `pipi`, `lx/ly` arah lirikan).
- **Tokoh kedua (dialog):** tambah `TOKOH.B` (`potongan:'cepak'` untuk rambut pendek), gambar dengan `arah:-1`, simpan `ANK.B=tokoh(...)`, dan beri `s:'B'` pada kata-katanya → label nama, warna pita, dan ekor balon pindah otomatis.

**Mulut dari suara (amplop).** Tanpa VO, mulut bergerak sinus sebanyak suku kata di `KATA` (cukup untuk pratinjau). Setelah VO jadi, buat `amplop.js` di folder proyek — jalankan sekali per file VO (satu baris dialog = satu file):
```bash
python3 - <<'PY'
import subprocess, array, json
SRC, MULAI, SIAPA = 'assets/audio/vo-01.mp3', 0.4, 'A'   # MULAI = 'at' file ini di SCENE.audio.vo
raw = subprocess.check_output(['ffmpeg','-v','error','-i',SRC,'-ac','1','-ar','16000','-f','s16le','-'])
x = array.array('h', raw); hop = 16000 // 30; nilai = []
for i in range(0, len(x), hop):
    s = x[i:i+hop]; nilai.append(round(min(1, (sum(v*v for v in s) / max(1, len(s))) ** .5 / 32768 * 6.5), 3))
open('amplop.js', 'a').write('window.AMPLOP=window.AMPLOP||{};(window.AMPLOP.%s=window.AMPLOP.%s||[]).push(%s);\n'
                             % (SIAPA, SIAPA, json.dumps({'fps': 30, 'mulai': MULAI, 'nilai': nilai})))
PY
```
Hapus `amplop.js` dulu bila membuat ulang. `scene.html` sudah memuatnya (`<script src="amplop.js" onerror=…>`). Waktu kata subtitle: `mf.py kata <proyek>` → `kata.js`, lalu koreksi manual kata yang meleset dan tambahkan `s:'B'` untuk tokoh kedua.

**Benda topik:** gambar dengan `isi(c,titik,P.warna3nada,5)` (bergaris) bila disentuh tokoh, atau `c.fill()` polos 3 lapis bila latar. Benda kecil yang penting (bawang, gelas, HP) ukurannya ≥ 1/4 lebar layar saat adegan dekat.

## Gambar uji adegan 1
`MF_PORT=<port> python3 scripts/mf.py potret <proyek> --t 0.3,2.0,4.0` lalu buka `lembar.jpg`. Wajib terlihat sebelum lanjut ke suara:
- **0,3 dtk:** aksi dekat terbaca dalam sekejap (benda topik besar, ada gerak/benturan), judul tidak menutupi wajah, warna cerah jenuh.
- **2,0 dtk:** wajah tokoh utuh dan ekspresinya terbaca di ukuran lembar kecil; balon kata di bawah tidak menutupi wajah/benda utama; ekor balon mengarah ke mulut; garis tinta ada di tokoh, tidak di latar.
- **4,0 dtk:** zoom kejut — wajah ≥ 35 % lebar layar, garis fokus, tidak ada teks terpotong.
- Tokoh tidak bulat/chibi, siku tidak menembus meja, `error halaman: tidak ada`.

Sebelum render penuh, potret juga detik-detik peralihan (mis. tepat saat lensa/chip mulai muncul, saat zoom kejut, saat balon berganti) — error sering hanya terjadi di skala kecil atau di satu frame peralihan. Lalu `mf.py render <proyek> --sampai 8` untuk cek gerak sebelum render penuh.

**Contoh bawaan (`--dasar kartun-cel`):** "Kenapa iris bawang bikin nangis?", 9,6 dtk, 1 tokoh (LARAS), dapur pagi. Urutannya: 0–1,7 tangan mengiris bawang dekat (impact strokes) + judul → 1,7 crane naik, pita gas naik ke wajah, "!" → 2,0 balon "Aduh… kok mataku perih?!" → 3,4 zoom kejut, mata "> <", air mata → 4,4 tarik balik, tokoh menunjuk lensa "SEL BAWANG": pisau memotong sel, isinya bercampur jadi gelembung gas, chip "bercampur → gas". Fakta: saat sel bawang rusak, enzim bertemu senyawa belerang dan membentuk gas iritan (syn-propanethial-S-oxide) yang merangsang saraf mata sehingga air mata keluar.

## Jebakan yang sudah pernah terjadi → perbaikannya
- **Tokoh bulat/chibi ditolak user** → proporsi 6 kepala, dagu lancip, sendi bersudut (gaya "anime aksi").
- **Meja setinggi dada → siku menembus meja** → letakkan permukaan meja ±1,6 kepala di bawah bahu (contoh: bahu y 820, meja y 1200 pada `s:1.4`).
- **Tangan di atas meja tertutup meja** → gambar tiga tahap: `lapis:'badan'` → meja → `lapis:'lengan'`.
- **Gas/asap jadi gumpalan hijau menutupi wajah (terbaca muntah)** → pita meliuk tipis 3 nada yang berhenti di hidung, dan dipudarkan saat close-up.
- **Judul 116 px terbungkus jadi 4 baris** → 3 baris; hanya kata kunci yang raksasa; cek lebar ≤ 860 px.
- **Ekor balon panjang menusuk badan tokoh** → ekor ≤ 95 px; siapa yang bicara cukup ditunjukkan label nama.
- **Dialog 2 suara lebih panjang dari perkiraan** → hitung ±13 huruf/dtk sebelum membuat suara.
- **SFX menutupi kata penting** (pernah: bunyi tas menutupi "mi instan") → potong SFX jadi < 0,8 dtk, taruh di jeda, cek ulang dengan transkripsi.
- **Baris VO terengah tidak terbaca transkripsi** → isi waktu kata baris itu manual di `kata.js`.
- **Musik menutupi kata pertama** → fade-in musik 1,5 dtk dari hening.
- **Lensa error saat muncul** (radius elips negatif ketika skala kecil) → selalu `Math.max(1, r)` untuk radius yang dikurangi.
- **Benda melingkar (ekor, kabel) menimpa kaki** → urutan gambar: belakang → depan, cek di potret saat pose ekstrem.

## Revisi cepat
- Kalau hasilnya **"kurang anime"** → besarkan mata (`eh` .4h), tambah zoom kejut + garis fokus, pakai "> <", kilau bintang, pipi berarsir.
- Kalau **tokoh terasa kaku** → tambah kunci pose tiap 1–1,5 dtk, angguk saat bicara, lirikan mata (`lx/ly`) ke benda yang dibahas.
- Kalau **terlalu ramai** → kurangi isi rak/latar, pakai hanya 2 nada dinding, perbesar tokoh (`s` 1.5) dan geser kamera lebih dekat.
- Kalau **teks tertutup/terpotong** → dasar balon tetap `AMAN.bawah`, chip di luar lensa, `label()` diberi `dx` ke sisi yang kosong.
- Kalau **mulut tidak pas suara** → samakan `MULAI` amplop dengan `at` VO, naikkan pengali (6,5 → 8) bila mulut jarang terbuka, turunkan bila selalu menganga.
- Kalau **warna kusam** → langit lebih jenuh, vinyet ≤ .2, matikan `grainOn`, perbesar bidang terang di `cel(...,s1)`.
