# Gaya: Promo Produk & Iklan
> Iklan jualan yang terasa mahal: produk jadi bintang di bawah cahaya sungguhan, kalimat dihentak per kata, harga turun di depan mata, lalu jari mengetuk "Pesan". Rasanya seperti klip iklan kami sendiri: promo kelas Motion Course (sebelum/sesudah), HP yang dibanjiri notifikasi, grafik pengikut yang melesat.

## Cocok untuk · tidak cocok untuk
**Cocok:** promo produk UMKM (makanan, minuman, skincare, fashion, kerajinan), iklan produk 15–30 dtk, flash sale/diskon 10 dtk, pengumuman launching, promo aplikasi/SaaS (layar HP atau laptop), testimoni pelanggan jadi video, iklan jasa (produknya = kartu layanan atau hasil kerja).
**Tidak cocok:** explainer edukasi panjang, cerita bertokoh, berita/fakta serius, konten nasihat atau islami. Pakai gaya lain untuk itu.

## Langkah 0 · baca brand murid dulu (wajib, sebelum menulis kode)
1. Lihat `assets/gambar/`: `logo.png`, `produk.png` (PNG latar transparan), screenshot aplikasi. Yang belum ada → tanyakan **sekali** dalam satu pesan: logo, foto produk, bentuk kemasan, harga & penawaran, batas waktu promo, rating/jumlah terjual (asli), handle/nomor/link pesan. Murid hanya bilang "promo/iklan" tanpa gaya → itu jenis, bukan gaya: pakai gaya ini, arah visual direkomendasikan dari jenis brand (jangan menunggu murid memilih).
   **Jangan pernah mengarang angka.** Harga normal, rating, jumlah terjual, testimoni, batas waktu: hanya dari murid. Tidak ada data → bukti diganti keunggulan ("Renyah · tanpa pengawet"), kartu memakai pola `promo` (lihat Ciri wajib 7), hitung mundur dihapus.
2. Ambil warna dari logo (butuh ffmpeg, sudah wajib untuk mf.py):
   ```bash
   ffmpeg -loglevel error -i assets/gambar/logo.png -vf "scale=6:6:flags=area" -f rawvideo -pix_fmt rgba - | python3 -c "import sys;b=sys.stdin.buffer.read();print(sorted({'#%02X%02X%02X'%tuple(b[i:i+3]) for i in range(0,len(b),4) if b[i+3]>200}))"
   ```
   Lalu LIHAT logonya sendiri (Read) untuk memastikan; hasil perintah hanya bantuan.
3. Bagi jadi 5 peran (nama variabel CSS di contoh): `--tua` (warna tergelap brand, atau warna brand digelapkan sampai ±15% terang), `--krem` (netral terang, latar kartu), `--aksen` (warna utama brand: sorot kata, tombol), `--aksen2` (warna kedua: pil promo, tombol sukses), `--emas` (sorotan di atas latar gelap). Teks selalu krem di atas tua atau tua di atas krem. Warna brand terlalu pucat untuk teks → pakai sebagai blok/sorot saja.
4. Pilih **arah visual** dari jenis brand (tabel di bawah). Arah menentukan cahaya, permukaan, dan tekstur; **warna tetap dari brand**.
5. Tulis "kartu brand" di atas `naskah.md`, tunjukkan ke murid sebelum membangun:
   ```
   Brand    : Kopi Teras (@kopiteras)          Arah: hangat lokal
   Warna    : tua #2A1A12 · krem #F8EBD8 · aksen #E2913A · aksen2 #3E6B4A · emas #FFD08A
   Font     : Caprasimo (judul, harga) + Plus Jakarta Sans (kalimat, UI)
   Produk   : Es Kopi Susu Gula Aren (foto: assets/gambar/produk.png)
   Masalah  : ngantuk jam 2 siang      Bukti: ★ 4,9 · 2.300+ gelas terjual (dari murid)
   Penawaran: Rp28.000 → Rp18.000, minggu ini      CTA: pesan di @kopiteras
   ```

## Ciri wajib
1. **Produk = bintang.** Ada foto murid → foto. Tidak ada foto → pilih `PRODUK.bentuk` yang paling mirip (`gelas` minuman · `kantong` snack/kopi bubuk/keripik · `botol` minuman botol/sambal/serum · `kotak` kue/skincare/obat herbal) + `warna` kemasan dari brand + `tulisan` dua baris; jangan biarkan gelas kopi contoh tampil untuk produk lain. Saat adegan produk tingginya ≥ 40% layar (contoh: gelas + sedotan ±800 px dari 1920). Tidak pernah tempel datar: selalu bayangan kontak + bayangan panjang ke arah jauh dari jendela + pantulan samar di permukaan mengilap + kilau menyapu 2–3 kali + putar 2.5D ±13° (`perspective(1800px) rotateY`) + cahaya latar yang ikut jatuh di produk.
2. **Kamera 3 lapis paralaks:** latar (faktor 0,35), dunia/produk (1), depan (layar, tetap). Hook = close-up ×2 yang sudah bergerak sejak frame 0; lalu tarik mundur cepat 0,6 dtk dengan blur 9 px; sesudahnya merayap 3–5% dan bergoyang halus `nz()`.
3. **Cahaya bercerita.** Masalah = dingin redup (latar biru abu `#10171E`→`#27333E`, dunia `saturate(.62) brightness(.8)`). Produk muncul = cahaya hangat masuk (contoh: sinar matahari lewat jendela nako, pola bilah + bayang daun bergoyang). Pola cahaya yang sama jatuh di produk (`source-atop`, 20%).
4. **Layar padat, berlapis, tidak pernah polos:** dinding + pola cahaya + debu melayang di sinar + permukaan bertekstur (tegel kunci, kayu, marmer, kain) + bahan produk mengorbit (depan tajam-kabur, belakang redup) + benda kabur di depan (daun, bokeh) + butiran film 0,16 + vinyet.
5. **Tipografi (1080×1920), besar sejak awal** (revisi pertama murid hampir selalu "teksnya kurang gede"): font display berkarakter + font UI. Contoh: **Caprasimo** (hook 170 px, nama produk 124/144 px, harga 230 px, "GRATIS 1" 168 px, ajakan 104 px) + **Plus Jakarta Sans** 600–800 (pengantar 72 px, handle 64 px, pil 44 px, label 46 px, teks kecil & UI di HP ≥ 30 px). Judul display diberi kontur 2 px + bayangan dua lapis (keras 6 px + lembut 34 px).
6. **Kata kunci dihentak:** kalimat masuk per kata (`wIn`, jeda 0,07–0,1), kata kunci masuk dari skala 2,3→1 dalam 0,3 dtk + blok warna aksen yang menyapu di belakangnya + guncang kamera kecil.
7. **Penawaran (`PENAWARAN` di bagian 1), dua pola:**
   - `jenis:'harga'` — kartu krem bersudut 52 px; harga lama (`lama`) dicoret garis merah `#C0392B` yang menggambar sendiri, harga baru menghitung turun 0,5 dtk dengan blur lalu berdenyut; lencana bintang bergerigi berputar "HEMAT xx%" (`hemat`); pil hitung mundur yang berdetak (`batas`). Setiap bagian yang `null` hilang sendiri: tanpa `lama` tidak ada coretan & hitungan.
   - `jenis:'promo'` — untuk "beli 2 gratis 1", "gratis ongkir", "diskon 20%" tanpa harga normal: baris `atas` ("Beli 2"), kata `besar` dihentak ("GRATIS 1"), baris `bawah` opsional (harga satuan dari murid), lencana opsional ("PROMO").
   Format Indonesia: `Rp28.000`, `18rb`, `4,9`.
8. **Bukti & CTA:** pil gelap rating/terjual/kutipan (angka asli dari murid, jangan mengarang). CTA = HP mockup dari HTML naik dari bawah, produk terbang masuk kartu menu, jari (lingkaran putih) mengetuk tombol, tombol berubah warna + lencana troli, logo + handle.
9. **Subtitle:** promo tanpa VO → `sub:{gaya:'mati'}`, teks kinetik adalah pesannya. Dengan VO → `gaya:'pil'`, `y:.80`, `maks:3`, `kunci:` nama produk & angka harga; teks kinetik besar tetap ada hanya untuk kata kunci.
10. **Zona aman:** semua teks & tombol HP di dalam `AMAN` (atas 180, bawah 1620, kiri 70, kanan 930). Badan HP boleh lewat bawah layar.

## Yang boleh berubah per video (tiga arah visual)
| Arah | Brand yang cocok | Latar, cahaya, permukaan | Palet awal (ganti dgn brand) | Font | Tanda gerak |
|---|---|---|---|---|---|
| **Hangat lokal** (contoh `scene.html`) | kopi, makanan rumahan, kue, batik, kerajinan, warung | dinding terakota, sinar jendela nako + bayang daun, meja tegel kunci atau kayu jati, daun monstera kabur di depan | tua `#2A1A12` · krem `#F8EBD8` · aksen `#E2913A` · hijau `#3E6B4A` · emas `#FFD08A` | Caprasimo + Plus Jakarta Sans | lampu "menyala" saat produk muncul |
| **Bersih premium** | skincare, parfum, gadget, klinik, jasa profesional, SaaS B2B | studio putih hangat, podium silinder, sorot lembut + kaustik kaca/air, bayang tajam, kabut tipis | latar `#F4F1EC` · tinta `#1D1D1F` · perak `#C9CCD1` · aksen = brand | Instrument Serif + Onest | produk naik dari podium, kilau lambat panjang |
| **Pop berani** | flash sale, snack, fashion anak muda, event, aplikasi konsumen | blok warna jenuh berganti di ketukan, halftone/garis miring, stiker, bayangan keras bergeser 18 px | kuning `#FFE14D` · magenta `#FF3D7F` · biru `#2D5BFF` · hitam `#141414` | Bagel Fat One + Sofia Sans Extra Condensed (angka) | produk memantul (squash & stretch), layar terbelah warna |

Aturan supaya tidak kembar antar video: ganti minimal 3 dari (palet, font, permukaan, pola cahaya, tanda gerak). Permukaan lain: kayu jati, anyaman rotan, kain batik, marmer, beton, kertas kraft. Pola cahaya lain: kerai bambu, lampu gantung, neon toko, sinar pagi dari pintu.

**Aplikasi/SaaS:** produknya HP (atau laptop untuk 16:9). Cara kerjanya:
- Isi layar **dibangun ulang dari screenshot dengan HTML** di dalam `.layar` (tetap tajam saat di-zoom), diisi data contoh. Nama akun, email, dan angka asli diganti contoh yang saling cocok.
- Screenshot hanya lewat sekilas → cukup `<img src="assets/gambar/layar.png" style="width:100%">` di dalam `.layar`.
- Hook = layar masalah (chat berantakan, tabel penuh merah, notifikasi menumpuk).
- Produk = UI yang bekerja: angka berhitung, baris masuk satu per satu (jeda 0,055 dtk), kursor/jari mengklik, satu angka hasil di-zoom.
- Penawaran = harga paket / "gratis 14 hari"; CTA = tombol unduh/daftar diketuk.
- Dalam layar HP: maksimal satu aksi per 1,5 dtk, supaya penonton sempat mengikuti.

## Kerangka adegan Shorts 30 dtk (9:16)
| Detik | Adegan | Kamera | Isi |
|---|---|---|---|
| 0–2 | Hook: masalah / pertanyaan / angka | close-up ×2 sudah bergerak, guncang di kata kunci | kata pertama ≤ 0,1 dtk, kata kunci dihentak; detail produk ekstrem (cipratan, tekstur, uap) |
| 2–3 | Buka | tarik mundur cepat + blur | cahaya hangat masuk, produk utuh |
| 3–9 | Produk | putar 2.5D, merayap | nama produk 2 baris, bahan mengorbit, 2 label |
| 9–15 | 3 keunggulan | potong per ketukan, tiap keunggulan satu bidikan dekat | satu keunggulan = satu kata besar + satu detail produk |
| 15–20 | Bukti (rentang tenang ±2 dtk) | hampir diam, kilau pelan | rating, kutipan pelanggan per kata, foto pelanggan dalam kartu |
| 20–25 | Penawaran | produk melayang naik | coret, hitung turun, lencana, hitung mundur |
| 25–30 | CTA | HP naik, sedikit maju | produk masuk HP, jari mengetuk, logo + handle, tahan 0,8 dtk |

Variasi panjang:
- **15 dtk:** cukup ganti satu baris `WAKTU = {hook:0, kunci:.5, buka:1.6, produk:2.2, bukti:5.5, tawar:8.5, cta:12, dur:15}` (semua detik lain di scene dihitung dari WAKTU).
- **Flash sale 10 dtk** (pola contoh `scene.html`): hook 0–1,6 · produk + bukti 1,6–5 · harga 5–7,4 · CTA 7,4–9,6. Untuk flash sale murni, hook-nya angka diskon raksasa ("−35%") yang dihentak.
- **60 dtk:** tambah "cara pakai/cara pesan" (3 langkah bernomor) dan testimoni kedua.
- **Testimoni:** kutipan pelanggan = kalimat hook (per kata, kata kunci disorot), produk di belakangnya kabur, nama + kota di pil kecil, bintang menyala satu per satu.

Naskah contoh (adegan pembuka di `scene.html`, tanpa VO, teks layar saja):
| # | Yang terlihat | Teks layar | Detik |
|---|---|---|---|
| 1 | close-up gelas, es jatuh, cipratan, lampu dingin | Jam 2 siang, / masih **ngantuk?** | 0–1,6 |
| 2 | kamera ditarik, sinar jendela masuk, gelas di meja tegel | Es Kopi Susu / Gula Aren · ★ 4,9 · 2.300+ gelas terjual | 1,6–5 |
| 3 | gelas melayang, kartu harga, lencana | PROMO MINGGU INI · ~~Rp28.000~~ Rp18rb · berakhir dalam 02:14:xx | 5–7,4 |
| 4 | HP naik, gelas masuk menu, jari mengetuk | Pesan sekarang di @kopiteras | 7,4–9,6 |
**16:9:** produk di sepertiga kiri, teks & kartu harga di kanan; HP diganti laptop atau HP miring 12°; label boleh ke samping karena ruang lebar. Hook tetap close-up. Contoh ditulis untuk 1080×1920: ubah juga ukuran `.lapis`, kanvas latar/bayang/depan/UI, dan posisi `#meja`, `#kartu`, `#hp`.

## Gerak & transisi
- Masuk: blur 12–18 px → tajam, `back.out`, 0,3–0,45 dtk. Keluar lebih cepat: 0,2–0,3 dtk, `power2.in`. Tidak ada yang hanya fade.
- Pindah bagian dengan **benda yang sama berpindah** (produk di meja → melayang → terbang masuk HP), bukan potong ke latar baru. Potongan keras hanya di ketukan musik.
- Produk tidak pernah diam: putar sinus ±13°, melayang ±10 px, kilau terjadwal (bukan acak).
- Bagian cepat: ada hal baru tiap ≤ 0,7 dtk. Bagian bukti: tenang ±2 dtk supaya terbaca.
- Angka: hitung dengan blur + getar 6 px, lalu denyut skala 1,14 saat mengunci.
- Ada musik → ukur BPM; potongan, hentakan kata, dan ketukan jari jatuh di ketukan.

## Suara
- **Default promo, flash sale, launching: tanpa VO** (pola seri kami: promo/SaaS/opener cukup musik + SFX). Murid minta VO (iklan produk 15–30 dtk) → ElevenLabs `eleven_v4`, suara ramah-yakin, kalimat ≤ 8 kata. Tag: `[excited]` di hook, `[warm]` di produk, `[pause]` tepat sebelum harga, `[confident]` di harga & ajakan. Audisi 1 kalimat dulu (hemat kredit).
- **Musik:** hangat lokal = gitar akustik/lo-fi 90–105 BPM · premium = piano/ambient pulse 80–95 · pop = funk/hip-hop ringan 110–124 dengan drop di penawaran. Volume 0,15–0,2 di bawah VO, 0,45–0,55 tanpa VO.
- **SFX:** satu bunyi per momen, ditaruh di jeda VO, paling banyak satu tiap ±1,5 dtk, volume 0,3–0,5. Label dan pil tidak perlu bunyi.

| Momen (detik di contoh) | SFX (prompt ElevenLabs singkat) |
|---|---|
| es jatuh ke gelas (0,3) | "ice cube dropping into iced coffee, small splash, close" |
| kamera ditarik, cahaya masuk (1,6) | "soft airy whoosh, warm" |
| kilau pertama (2,3) | "single soft sparkle" |
| harga dicoret (5,6) | "quick marker strike on paper" |
| harga turun (5,9–6,4) | "fast mechanical counter ticking, short" |
| lencana HEMAT (6,1) | "bubbly pop" |
| jari mengetuk tombol (8,5) | "phone screen tap, then bright cash register ding" |
| Tanpa VO: musik masuk tepat di potongan pertama (1,6), bukan di detik 0 | — |

## Cara membangun
```bash
python3 scripts/mf.py baru <proyek> --dasar promo-produk     # salin contoh 9,6 dtk
# isi BAGIAN 1 di @SCRIPT (MEREK, TEKS, PRODUK, PENAWARAN, LATAR, WAKTU) + variabel CSS di @HEAD
# foto murid (opsional): <proyek>/assets/gambar/produk.png (+ logo.png). Tanpa foto: PRODUK.bentuk
python3 scripts/mf.py potret <proyek> --t 0.3,1.0,3.5         # cek, lalu lanjut
```
Peta `scene.html` (judul bagian `== n.` di `@SCRIPT`):
| Bagian | Isi | Yang diganti untuk produk baru |
|---|---|---|
| `@HEAD` CSS | variabel `--tua --krem --aksen --aksen2 --emas` di `#stage`, gaya teks, kartu, HP | warna brand, font (link Google Fonts) |
| `@BODY` | wadah kosong; teks diisi dari `TEKS` oleh `isiTeks()` | tidak perlu diubah |
| 1. Isi | `MEREK`, `TEKS`, `PRODUK` {bentuk, hook, isi, tulisan, warna, titik}, `PENAWARAN`, `LATAR` {dingin, hangat, cahaya, meja}, `WAKTU`, `BOX` | **produk baru = ubah bagian ini saja** |
| 3. Produk | `gelasKode` `kantongKode` `botolKode` `kotakKode`, `fotoProduk()`, `efekHook()` ('es' / 'remah' / 'kilau'), `kilau()` | hanya bila bentuk kemasan sangat lain |
| 4. Latar & meja | `gambarLatar()` dinding + jendela nako + daun; `meja()` tegel/kayu | pola cahaya baru (kerai, lampu gantung) |
| 5. Bahan | `sprite()` biji, aren, es, keripik, daun, tetes | tambah jenis bila perlu (cabai, bunga, koin) |
| 6. Kamera | `kamera(t)` → `pasangLapis()`, `keLayar()` | jarang diubah; atur waktu tarik |
| 7. HP | `#hp` HTML + `lapisDepan()` (bokeh, daun depan, benda melintas) | isi menu/aplikasi |
| 8. SCENE | `build(tl)` waktu teks, `frame(t)` semua gerak | waktu tiap bagian |

Memakai foto: setel `PRODUK.titik` (pecahan kanvas 1000×1700; `puncak` = target hook) ke bibir/puncak produk (target hook & cipratan) dan dua titik label. Potret detik 3,5, lihat di mana titik label jatuh, geser, potret lagi. Foto berlatar putih → minta murid menghapus latar (Canva/remove.bg); jangan memakai foto berkotak.

Inti teknik (sudah ada di contoh; salin polanya bila membuat adegan baru):
```js
// produk tajam saat di-zoom: kanvas 1,4x, gambar tetap dalam satuan 1000x1700
px.setTransform(1.4,0,0,1.4,0,0); px.clearRect(0,0,1000,1700); FOTO ? fotoProduk() : BENTUK[PRODUK.bentuk](t,rot);
// kilau & cahaya hanya di piksel produk
px.globalCompositeOperation='source-atop'; px.drawImage(CH,...); /* atau gradien miring yang digeser oleh t */
// putar 2.5D + posisi dunia
box.style.transform=`translate(${cx-310}px,${top}px) scale(${sc}) perspective(1800px) rotateY(${ry}deg)`;
// harga turun
hb.textContent=Math.round(lerp(P.lama,P.baru,E.out(seg(t,T.tawar+.9,T.tawar+1.4))))+P.satuan;
// produk terbang ke HP: gambar SALINAN di kanvas layar (#cvUI) supaya tidak tertutup HP
ux.drawImage(PC,x-w/2,y,w,w*1.7);
```
**Semua detik ditulis relatif ke `WAKTU`** (`T.tawar + .62`, bukan `5.62`); detik mentah baru = bug saat durasi diubah. Memperpanjang ke 30 dtk: tambah titik di `WAKTU` (mis. `unggul: 9`), buat bagian baru sebagai rentang `seg(t,a,b)` di `frame()` dan baris `wIn/pop` di `build()`. Jangan menyalin seluruh adegan; pakai ulang produk, kamera, dan lapis yang sama supaya benda berpindah, bukan berganti.

## Gambar uji adegan 1 (wajib lolos sebelum suara)
`mf.py potret <proyek> --t 0.3,1.0,3.5`, buka `lembar.jpg` dan potret ukuran penuh:
- **0,3 dtk:** frame sudah sibuk dan bergerak (cipratan/kilau, benda melintas), close-up produk tajam, nuansa dingin, kata pertama muncul.
- **1,0 dtk:** kalimat hook utuh, kata kunci tersorot warna aksen, terbaca di HP, di dalam AMAN, tidak menutupi produk.
- **3,5 dtk:** cahaya hangat, produk utuh dengan bayangan + pantulan + logo terbaca, nama produk 2 baris, 2 label tidak saling tindih dan tidak terbalik sisi, warna sesuai kartu brand.
Ada yang gagal → perbaiki dulu. Nol error JS.

## Jebakan yang sudah pernah terjadi → perbaikan
- **Layar kosong / satu objek kecil di latar polos** (paling tidak disukai pemilik brand) → lapisi: pola cahaya, permukaan bertekstur, bahan mengorbit, benda kabur di depan, debu.
- **Terlihat seperti vektor datar / kotak sederhana / "PPT"** → produk diberi kaca, embun, gradien, bayangan, pantulan, kilau; kamera selalu bergerak.
- **Hook murni visual tanpa teks sampai 0,8 dtk terasa lambat** → kata pertama ≤ 0,1 dtk.
- **Teks di dalam UI HP tidak terbaca di bidikan lebar** → semua teks UI ≥ 30 px, harga & tombol ≥ 38 px; teks yang tidak muat diringkas, bukan dikecilkan.
- **Angka/rating karangan** → hanya angka dari murid. Nama orang di notifikasi/testimoni: pakai nama dari murid atau samarkan (pil abu), jangan karang. Tanpa logo Instagram/TikTok/GoFood asli; pakai UI generik.
- **Produk buram saat close-up** → kanvas produk 1,4× (bukan memperbesar CSS gambar kecil). Foto murid kecil (< 800 px) → minta yang lebih besar.
- **Label bertumpuk atau diam-diam pindah sisi** → `label()` memperkirakan lebar 0,58 × ukuran per huruf dan membalik sisi tanpa kabar bila teks tidak muat; teks ≤ 10 huruf pada 46 px, letakkan teks di area meja (`dy` 140–300, `dx` kecil 20–40), potret ulang setiap kali teks label diubah.
- **Komentar `//` menelan kode** → komentar di tengah ekspresi satu baris (`const fy = a  // catatan + nz(...)`) mematikan sisa ekspresi tanpa error (pernah membuat goyang kamera mati). Komentar hanya setelah `;` atau di baris sendiri.
- **Tanpa foto, produk lain tampil sebagai gelas kopi** → setel `PRODUK.bentuk`, `warna`, `tulisan`, `isi`, `hook` dan `LATAR` (warna dinding contoh = terakota kopi).
- **Data penawaran tidak ada** → jangan mengarang harga normal/hitung mundur; pakai `jenis:'promo'` atau isi `null`.
- **Blok sorot tertinggal setelah kata keluar** → padamkan `--k` sebelum `wOut`. **Teks hook masih terlihat saat kamera ditarik** → `wOut` ≥ 0,2 dtk sebelum tarik.
- **Produk terbang tertutup HP** → salinan di `#cvUI` (z di atas HP) selama terbang, lalu serah-terima ke `#thumb` dalam 0,1 dtk.
- **Tepi latar terlihat saat kamera bergeser/berputar** → kanvas latar lebih besar dari layar (contoh: 1240×2140 di −80/−110).
- **Elemen muncul sebelum waktunya** → `fromTo` di `build()` langsung menerapkan keadaan awal; elemen yang awalnya terlihat beri `opacity:0` di CSS dan `immediateRender:false`.
- **Foto tidak muncul** → nama file persis `assets/gambar/produk.png` (huruf kecil), PNG RGBA, buka `index.html` dari folder proyek.

## Revisi cepat
- "Teksnya kurang gede / kurang nendang" → semua ukuran teks ×1,3, kontur display 2→4 px, kata kunci masuk dari skala 3,2 (bukan 2,3), guncang kamera ×2, lalu potret ulang dan cek sisi label.
- "Kurang menjual / kurang wah" → perbesar produk (`BOX.sc` 1,1→1,25), tambah satu kilau, hentak kata kunci + guncang, harga 230→260 px, potong bagian lambat.
- "Terlalu ramai" → buang bahan mengorbit dan daun depan, maksimal 2 warna aksen, satu fokus per adegan.
- "Warnanya bukan brand-ku" → jalankan ekstraksi warna, ganti `MEREK` + variabel CSS + `LATAR.hangat` + `PRODUK.warna`, cek kontras teks (krem di atas tua).
- "Foto produknya kelihatan tempelan" → bayangan kontak lebih gelap, pantulan, cahaya `source-atop`, putar kecil, warna lampu belakang mendekati warna produk.
- "Teks susah dibaca di HP" → kurangi kata, perbesar, beri pil gelap, jauhkan dari pola cahaya terang.
- "Mau 15 dtk / 16:9 / 1:1" → ubah `WAKTU`; `mf.py baru <proyek> --rasio 16:9 --dasar promo-produk` lalu tata ulang posisi (produk kiri, teks kanan).
