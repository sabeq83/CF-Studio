# Gaya: Tubuh Manusia Anime

> Organ tubuh dilukis dengan kode seperti ilustrasi anime yang hangat: berkilau, bervolume, melayang di depan langit senja ungu-peach, lalu kamera masuk ke dalamnya mengikuti narasi. Contoh seri asli kami: **Seri Tubuh Manusia Part 1–9** (jantung, lambung, mata, gigi, otak, telinga, kulit, rambut, tubuh) di YouTube Shorts @motionformat.

## Cocok untuk · tidak cocok untuk

**Cocok:** biologi & anatomi (organ, indra, sel, jaringan), "cara kerja tubuh", fakta unik tubuh, sains untuk pelajar, seri edukasi bernomor (Part 1, 2, 3 …), hewan atau tumbuhan yang dijelaskan dari dalam (daun, akar, sengat lebah) dengan cara lukis yang sama.

**Tidak cocok:** berita, sejarah, data/angka murni (pakai gaya data), cerita bertokoh dengan wajah dan dialog, topik penyakit atau pengobatan (gaya ini sengaja tidak menyentuh klaim medis), apa pun yang butuh darah, luka, atau operasi.

**Sudah pernah dicoba lalu ditolak:**
- Organ chibi bermata besar dengan tangan, kaki, dan ikat kepala (anime lucu). Ditolak karena organ jadi maskot dan terasa kekanakan.
- Kartun datar berwajah dengan latar sinar radial. Ditolak karena murahan dan mirip stiker.
- Diagram vektor rapi di latar navy dengan grid titik. Ditolak karena "seperti buku pelajaran" dan kurang hidup.

Yang dipilih ("aku pengen style ini") adalah lukisan anime yang **realistis tanpa wajah**: bentuk anatomi benar, cahaya dan kilau seperti adegan film anime.

## Ciri wajib

1. **Dilukis dengan kode di `<canvas>` 2D**, bukan gambar AI dan bukan SVG datar. Setiap organ dibuat dari `Path2D` lalu diwarnai dengan kuas `organ()`. Kuas ini memberi gradasi 3 warna, pita bayangan inti bertepi tegas (cel), bayangan tepi tergelap, pita terang di sisi cahaya, pantulan hangat dari bawah, dan rim light. Jadi tiap organ punya **minimal 5 nada**. Garis tepinya berwarna tua dari keluarga warna organ (mis. `#4A1034`), tidak pernah hitam. Garis ini tebal di sisi bayangan dan tipis di sisi terang, sekitar 2–4 px di layar.
2. **Cahaya selalu sama arahnya.** Cahaya utama datang dari kiri atas. Rim light peach `#FFE4C4` tipis menyala di tepi kanan. Pantulan hangat `#FF9878` datang dari bawah (dari awan senja). Tambahkan 2–3 guratan kilau basah yang **pendek** di sisi terang, ditambah bintang kilau 4 sudut yang berkedip bergiliran.
3. **Organ tanpa wajah, mata, tangan, atau kaki.** Anatomi digambar tampak depan dengan proporsi benar. Kiri layar = sisi KANAN pemilik tubuh. Tanpa manusia utuh (siluet hologram boleh), tanpa darah menetes, luka, atau gore. Warna boleh merah-merah muda, asal bersih dan cerah.
4. **Latar langit senja**, dilukis sekali lalu digeser pelan:
   - gradasi atas→bawah `#120D36 · #2A2270 · #563A96 · #9A58A6 · #E07F9C · #FFB289 · #FFDCAE`;
   - bintang halus di sepertiga atas;
   - matahari rendah di kiri bawah dengan 8 sinar senja;
   - awan kumulus 3 lapis: jauh (ungu), tengah, depan (buram). Awannya **bergumpal bulat dengan tepi atas terang**, bagian bawahnya memudar;
   - debu cahaya yang naik pelan.
5. **Kamera tidak pernah diam.** Video dibuka dengan close-up dinding organ (skala ±3,2) di sisi bayangan + rim light, dengan langit kelihatan di sebelahnya. Dalam ±3 dtk kamera tarik mundur ke organ utuh (skala ±0,9), lalu terus mendorong pelan. Organnya juga harus "hidup": bernapas, berdenyut, mengaduk, atau bergetar.
6. **Aliran = partikel bercahaya** (titik inti + halo) yang menempuh jalur sungguhan: udara lewat trakea→bronkus→cabang, darah lewat pembuluh, makanan lewat saluran. Warnanya menunjukkan makna, mis. biru-muda `160,236,255` untuk udara masuk dan peach `255,200,150` untuk udara keluar, atau ungu-biru untuk darah vena dan merah untuk arteri. Partikel memudar dan mengecil saat masuk cabang kecil.
7. **Tipografi** (ukuran untuk 1080×1920):
   - judul **RocknRoll One** 138–150 px, gradasi teks `#FFFFFF → #FFF3E4 → #FFC39E`, bayangan keras ungu `0 6px 0` + pendar peach, huruf masuk satu per satu dengan blur;
   - chip fakta **Murecho** 800 50 px di pil gelap `rgba(40,12,52,.66)` berbingkai peach;
   - kata kunci dan angka berwarna `#FFD27A`.
8. **Subtitle pil gelap.** Pilnya `rgba(36,10,46,.78)` dengan bingkai peach tipis. Teks Murecho 800 54 px, maksimal 4 kata, posisi `y:.775` (±1490 px), kata kunci `#FFD27A`. Kata yang belum diucapkan tampil redup (sudah bawaan mesin untuk gaya `pil`). Organ, label, dan angka harus berada **di atas y ±1420** supaya pita subtitle bersih.
9. **Label** berupa pil gelap, Murecho 800 **46 px** (jangan di bawah 44 px; lebih kecil tak terbaca di HP), dengan titik warna di kiri dan garis putih tipis yang tumbuh ke titik organ dan menempel walaupun kamera bergerak. Maksimal 3 label sekaligus, di zona aman (x 70–930). **Pil tidak boleh menimpa organ**: susun di celah kosong (di contoh: 2 baris y ±560 dan ±655 di antara chip judul dan puncak paru, kiri/kanan trakea); yang menunjuk ke organ cukup garisnya. Kalau celah kurang, perkecil skala kamera 5 %.
10. **Penutup seri:** organ utuh berdenyut di tengah, nama organ besar (RocknRoll One), pil "Seri Tubuh Manusia · **Part N**", lalu @akun. Pakai ini di setiap video supaya terasa satu seri.

## Yang boleh berubah per video

Ganti satu set per video supaya video dalam satu seri tidak kembar, tetapi cara lukis organnya tetap sama.

| Set | Langit | Aksen | Font judul + teks | Cocok untuk |
|---|---|---|---|---|
| **A · Senja** (bawaan) | ungu tua → magenta → peach (ciri 4) | `#FFD27A` | RocknRoll One + Murecho | organ hangat: jantung, lambung, paru, kulit |
| **B · Malam berbintang** | `#070B2C · #16205E · #3A2F86 · #7B4A9E · #D0739A · #FFAE86`, bintang lebih banyak + bintang jatuh | `#FFD36A` + biru `#9FD2FF` | Dela Gothic One + Zen Maru Gothic | mata, otak, telinga (organ "dingin", sinyal listrik) |
| **C · Fajar lembut** | `#2B2A5E · #5B6FB0 · #9FC6D8 · #FFE0C8 · #FFF3E2`, awan putih-mint | `#7FF0D2` | Mochiy Pop One + M PLUS Rounded 1c | gigi, tulang, rambut, sel (organ terang) |

Palet organ yang sudah terbukti (urutan: terang · dasar · gelap · bayangan 1 · bayangan 2):
- **jantung/otot** `#F46A70 #CF3446 #9A1A3C #7A0F36 #3C0626`, rim `#E2B8FF`;
- **vena/pembuluh biru** `#8384F2 #4B47C4 #28237F #2A2384 #181255`;
- **paru/lambung** `#FFC1C9 #F27393 #B8406E #922F6C #4E1248`;
- **lemak/kuning** `#FFF2B8 #F1C35C #C98C34 #C27A30 #8A4C20`;
- **tulang rawan/gigi** `#FFE6EA #F2B2C2 #CF7C9C #A25486 #5E2A62` (gigi lebih krem: `#FFF8EC #EBDCC0 …`).

## Kerangka adegan Shorts 30–60 dtk

| Detik | Adegan | Kamera | Isi |
|---|---|---|---|
| 0–2,5 | Hook | close-up dinding organ (skala 3+), drift pelan | permukaan berkilau + rim light + gerak organ; subtitle pertanyaan ("Tahu nggak…?") |
| 2,5–6 | Organ utuh | tarik mundur mulus (E.io, 3 dtk) | judul organ + chip satu angka ("ratusan juta kantong udara") |
| 6–14 | Kenalan bagian | dorong pelan, sedikit geser | 2–4 label bergiliran, aliran partikel mulai |
| 14–28 | Masuk ke dalam | zoom MENEMBUS permukaan → penampang/jaringan | lapisan berlabel, partikel bercahaya, kamera ikut aliran |
| 28–42 | Inti jawaban | close-up level sel/jaringan, lalu keluar lagi | proses utama + angka besar yang menghitung naik |
| 42–50 | Rangkuman | tarik jauh ke organ utuh | organ berdenyut/bernapas, satu kalimat pengikat |
| 50–55 | Penutup | dorong pelan | nama organ + "Seri … · Part N" + @akun |

**Versi 16:9:** organ di sepertiga kiri atau kanan, judul dan label di sisi yang kosong. Skala kamera dikali ±0,8 karena bidangnya lebih pendek. Subtitle `y:.86`. Awan cukup 2 lapis di bawah. Close-up pembuka tetap dipakai.

## Gerak & transisi

- Satu gerak kamera per adegan dari tabel `KAM` (detik, skala, fokus, putar), di-ease `E.io`, plus goyang halus `nz()` ±6 px. Jangan potong keras.
- Transisi yang dipakai seri asli:
  - **zoom menembus**: kamera mendekat terus sampai tekstur dinding memenuhi layar, lalu adegan jaringan memudar masuk;
  - **ikuti aliran**: kamera berjalan sepanjang pembuluh/saluran;
  - **match cut** bentuk: penampang ke organ utuh;
  - **tarik jauh**: dari sel kembali ke organ.
- Organ selalu hidup: napas (periode ±4,6 dtk, mengembang 3–6 %), detak (±0,86 dtk dengan "lub" lalu "dub"), atau gelombang remasan.
- Teks masuk per huruf/kata dengan blur → tajam (0,5 dtk). Chip memantul kecil (`E.back`). Label: garis tumbuh dulu, pil menyusul 0,2 dtk kemudian.
- Kilau berkedip bergiliran (`sin(π·fase)³`), tidak bersamaan. Awan dan debu bergerak dengan kecepatan berbeda per lapis.

## Suara

- **VO ElevenLabs v4**: narasi edukasi santai, ramah, tidak menggurui. Pakai tag `[curious]` di kalimat pembuka, `[pause]` sebelum fakta penting, `[awe]` di kalimat penutup. Pakai suara berbeda per Part supaya seri tidak monoton. Kalimat pendek. Angka diucapkan dengan kata ("delapan puluh enam miliar") tapi ditulis dengan angka di layar. Panjang VO ±45–55 dtk untuk Shorts 55–60 dtk.
- **Musik**: instrumental piano lembut + strings + pad, ±70 BPM, tanpa vokal, satu musik untuk seluruh seri. Mesin otomatis meredam musik di bawah VO dan SFX (`music.duck` bawaan aktif), jadi `vol` ±0,25–0,3 sudah aman.
- **SFX**: pelan dan jarang, maksimal 5 per video, volume 0,18–0,3. Satu bunyi per momen, diletakkan di jeda VO, tidak menimpa kata. Jangan pakai bunyi beruntun untuk deretan label. Contoh:
  - dengung lembut di detik 0;
  - shimmer saat judul muncul;
  - whoosh saat zoom menembus;
  - napas/detak (lub-dub) saat organ pertama kali bergerak besar;
  - klik halus saat katup/pintu menutup.

## Cara membangun

```bash
MF_PORT=9333 python3 scripts/mf.py baru proyek-paru --dasar tubuh-anime
MF_PORT=9333 python3 scripts/mf.py potret proyek-paru --t 0.3,1.5,5
```

Peta `scene.html` contoh (cari judul `== N.` di dalam file):
1. **PALET**: warna organ, langit, awan, partikel. Ganti di sini dulu.
2. **LATAR LANGIT**: `awanSprite()` dan daftar `AWAN` = [sprite, x, y, kecepatan, lapis]. Biasanya tidak perlu diubah.
3. **KUAS ANIME**: `band() organ() pipa() kilau() bintang()`. Jangan dibongkar, cukup dipanggil.
4. **BENTUK ORGAN**: ganti bagian ini untuk topik baru.
5. **ALIRAN**: `RUTE` = daftar titik jalur; partikel maju/mundur mengikuti `napas(t)`.
6. **KAMERA**: tabel `KAM`.
7. **LABEL**: `LAB` = {el, p: titik lokal organ, dx, dy, a: detik muncul}.
8. **frame(t)**: urutan langit → awan → organ → pendar → aliran → bloom → kilau → awan depan → label → vignet → judul.
9. **SCENE**: dur, contoh `kata`, `sub`, `audio`.

**Mengganti organ.** Gambar bentuk di koordinat lokal dengan (0,0) di tengah organ dan tinggi ±800 unit. Pakai kurva `C`, cukup 6–12 segmen per bentuk. Saluran dan pembuluh dibuat dengan `pipa([x0,y0,c1x,c1y,c2x,c2y,x1,y1], lebarAwal, lebarAkhir)`. Contoh ginjal:

```js
const GINJAL=P2('M 0 -300 C 170 -300 250 -150 240 0 C 230 170 140 300 0 300 C -90 300 -120 220 -70 150 C -30 90 -40 -80 -80 -140 C -120 -220 -90 -300 0 -300 Z');
const ARTERI=pipa([-60,-20,-160,-30,-260,-40,-360,-40],46,40);
// di paru(t,C) → ganti isinya:
T=T0.translate(0,0).scale(1+.01*Math.sin(t*6));                 // denyut kecil
organ(GINJAL,{lit:'#ffb3a8',base:'#d8576a',dark:'#9c2c50',sh1:'#7a1e4a',sh2:'#40102e',rim:'#ffe0c8',bounce:'#ff9878',hi:'#fff0ee'},
  {k:80,g:[-200,-300,200,300],tex:.18,isi:c=>kilau(c,[[60,-200,10,5,-.8]],[[30,-240,90,-250,140,-210,12]])});
```

Aturan `organ(path, palet, {k, g, tex, isi, lw})`:
- `k` = lebar bayangan dalam unit lokal (±15 % tinggi organ);
- `g` = garis gradasi [x0,y0 terang → x1,y1 gelap];
- `tex` = kekuatan tekstur noise (0,15–0,22);
- `isi(c)` = detail yang otomatis ter-clip di dalam organ (tekstur, celah lobus, pembuluh halus, kilau).

Gambar organ dari belakang ke depan, karena urutan panggilan `organ()` = urutan lapisan. Detail yang hanya perlu terlihat saat close-up (pori, lobulus, serat) diberi alpha ≤ 0,15 dan blur kecil, supaya tetap samar saat kamera jauh.

**Banyak adegan.** Buat satu fungsi gambar per adegan (`adeganHook(t,C)`, `adeganPenampang(t,C)` …). Di `frame(t)`, pilih adegan dengan `seg(t,a,b)`. Saat pindah adegan, gambar dua adegan sekaligus selama 0,4–0,8 dtk dan campur dengan `globalAlpha`, sambil kamera terus maju (zoom menembus). Simpan semua waktu di satu objek `B={hook:[0,2.5],utuh:[2.5,6],…}` supaya gampang digeser setelah VO jadi.

**Subtitle** memakai `SCENE.sub` bawaan mesin (`gaya:'pil'`, kata belum diucapkan otomatis redup). CSS di HEAD hanya menyamakan warna pil dengan gaya. **Label** diatur di `LAB` (`p` = titik organ, `kiri` = sisi pil, `y` = baris di layar).

## Gambar uji adegan 1

Sebelum membuat suara, kirim 3 potret (`--t 0.3,1.5,5`). Wajib terlihat:
- **0,3 dtk**: close-up dinding organ yang jelas organik (tepi organ + rim light peach + langit/awan di sebelahnya), ada kilau dan bintang kilau. Bukan bola/gelembung berjajar, bukan bidang datar polos.
- **1,5 dtk**: kamera sedang mundur. Bentuk organ mulai terbaca, partikel/debu bergerak, subtitle pil gelap tampil dengan kata kunci kuning.
- **5 dtk**: organ utuh di tengah dengan bayangan cel yang jelas (sisi kanan-bawah lebih gelap bertepi tegas), judul RocknRoll One + chip angka, minimal 1 label ≥44 px yang tidak menimpa organ, awan bergumpal di bawah, subtitle tidak menimpa organ.
- `mf.py potret` melaporkan "error halaman: tidak ada". Satu frame dirender < 1,5 dtk (contoh ini ±0,12 dtk/frame).

## Jebakan yang sudah pernah terjadi → perbaikannya

| Yang terjadi | Perbaikan |
|---|---|
| Tanpa resep, hasilnya vektor kartun mengkilap / "diagram buku" | Wajib pakai `organ()` (pita cel + rim + pantulan), minimal 5 nada, garis tepi tebal-tipis |
| Close-up pembuka jadi bola-bola atau telur berjajar | Close-up = **dinding organ** dengan tepi organ dan langit kelihatan, tekstur samar di permukaan |
| Awan jadi pita kabur atau ada kotak keras di dasar awan | Pakai `awanSprite()`: siluet gabungan gumpal bulat, tepi atas terang, bawah memudar. Jangan `fillRect` di dasar awan |
| Tekstur lobulus/sel tampak seperti kaca retak atau jaring kawat | Alpha ≤ 0,15, blur `0,9·SS`, garis tak beraturan (sebagian sambungan dibuang) |
| Partikel tampak seperti manik/lampu natal berderet | Partikel kecil (3–6 px), memudar setelah setengah jalur, jangan terlalu banyak (±100) |
| Cabang pohon (bronkus/saraf) tampak zig-zag tajam | Pakai kurva `quadraticCurveTo` dengan titik kontrol acak berbenih |
| Rim/pantulan terlalu tebal → organ seperti stiker berbingkai putih | Rim ≤ `k*.06`; pita terang dibuat lebar dan lemah (alpha ±0,2), bukan pita tepi |
| Guratan kilau jadi garis putih panjang seperti goresan | Guratan pendek (±60 unit), tebal 9–12, blur `2,4·SS` |
| Kulit dan rambut terasa diagram (balok penampang) | Makro permukaan, cahaya samping, partikel, kamera menembus lapisan; balok penampang hanya jembatan singkat |
| Subtitle menutupi organ atau label | Organ di atas y ±1420. Bila adegan butuh bagian bawah, pindahkan subtitle ke atas (`y:.15`) khusus adegan itu |
| Kanvas mendadak kosong di render | Path dengan ratusan busur + `filter: blur` membebani GPU. Batasi ±150 titik per path |
| `SyntaxError` di `-(x/s)**2` | Tulis `-((x/s)**2)` |
| Halaman tidak pernah siap, error aneh `null.style` | Ada tulisan penanda bagian (at-HEAD/at-BODY/at-SCRIPT) di komentar sebelum penanda aslinya, dan perakit memotong di kemunculan pertama. Jangan tulis penanda di komentar |
| Label & chip terlalu kecil di HP, atau pil label menimpa organ | Label 46 px, chip 50 px; susun pil di celah kosong (baris di atas organ / sisi kosong), hanya garisnya yang masuk ke organ |
| Fakta terlalu pasti | Pakai "sekitar", "ratusan juta", "diperkirakan" bila sumbernya rentang (mis. alveolus ±274–790 juta → "ratusan juta"). Tanpa klaim medis, tanpa "kamu sakit…" |

## Revisi cepat

- **"Masih seperti diagram buku"** → naikkan `k` organ 20 %, perjelas pita bayangan inti (alpha 0,9), tambah 1 guratan kilau + bintang kilau, kurangi garis tegas di dalam organ, dan pastikan kamera sedang bergerak.
- **"Latar menyaingi organ"** → turunkan alpha sinar senja dan awan tengah, tambah blur awan depan, perkuat pendar di belakang organ. Organ harus jadi bagian paling terang dan paling tajam.
- **"Terasa seram"** → kurangi merah tua (`sh2` lebih ungu, bukan merah gelap), naikkan pantulan peach, jangan ada cairan menetes atau tekstur berdenyut cepat. Akurasi tetap.
- **"Kurang hidup / kayak gambar diam"** → tambah gerak organ (napas/detak), denyut cahaya berjalan di pembuluh/cabang, debu depan yang buram, dan dorongan kamera 5–8 % per adegan.
- **"Mau lebih dalam"** → di kalimat VO yang dimaksud, zoom menembus ke jaringan/sel. Tampilkan bagian itu berkilau dengan 1–2 label, lalu tarik keluar lagi ke organ utuh.
- **"Subtitle/label menutupi organ"** → geser fokus kamera ke atas (`fy` −40) atau perkecil skala 5 %. Label pindah ke sisi yang kosong (`dx` negatif).
