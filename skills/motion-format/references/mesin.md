# Mesin adegan Motion Format

## 1. Cara kerjanya

Kamu menulis `scene.html`. `mf.py rakit` menggabungkannya dengan `assets/mesin/core.html` jadi
`index.html`. Browser memutar `index.html` otomatis dan berulang. `mf.py render` membuka halaman
yang sama di Chrome tanpa layar, melompat ke tiap frame (`MF.seek(t)`), memotretnya, lalu
menggabungkan frame + suara jadi MP4.

## 2. Susunan scene.html

```html
<!--@TITLE Judul video-->
<!--@RASIO 9:16-->            ← 9:16 · 16:9 · 1:1 · 4:5
<!--@HEAD-->
  <link ... Google Fonts>      ← font gaya
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>  ← hanya bila 3D
  <style> ... </style>
<!--@BODY-->
  <div id="dunia"></div> <div class="judul" id="tJudul">...</div>
<!--@SCRIPT-->
  const SCENE = { dur: 32, frame(t){...}, ... };
```

`SCENE`:
| kunci | wajib | isi |
|---|---|---|
| `dur` | ya | durasi detik |
| `frame(t)` | ya | gambar seluruh dunia pada detik `t` |
| `build(tl)` | – | animasi teks GSAP (`wIn`, `wOut`, `tl.to(...)`) pada timeline `tl` |
| `audio` | – | `{vo:[{src,at,teks,vol}], sfx:[{src,at,vol}], music:{src,vol}, loops:[{src,a,b,vol}]}` |
| `kata` | – | waktu kata `[{w,t0,t1}]`; bila kosong dipakai `kata.js` (dari `mf.py kata`) |
| `sub` | – | `{gaya:'polos'|'pil'|'mati', font, warna, aksen, kunci:[], maks:4, y:.68 | (t,frasa)=>({x,y})}` |
| `muat()` | – | Promise yang ditunggu sebelum mulai (mis. memuat gambar `assets/gambar/*.png`) |
| `siap(t)` | – | Promise yang ditunggu setelah tiap seek (jarang perlu) |

## 3. Perkakas yang tersedia di scene

| nama | guna |
|---|---|
| `W H RASIO TEGAK` | ukuran panggung (1080×1920 untuk 9:16), `TEGAK` = layar tegak |
| `AMAN` | `{atas,bawah,kiri,kanan}` batas zona aman teks |
| `$ $$ mk(tag,cls,parent,html) svgEl(tag,attrs,parent) kanvas(w,h,parent)` | DOM/SVG/canvas |
| `lerp clamp sstep seg(t,a,b) E.{out,in,io,s,ox,back,pegas}` | hitungan gerak |
| `nz(t,benih)` | goyang halus -1..1 (kamera handheld, daun, air) |
| `rng(benih)` `hash(n)` | angka acak berbenih (selalu sama tiap render) |
| `wIn(tl,el,at,{y,x,b,d,st})` `wOut(...)` | teks masuk/keluar per kata dengan blur berarah |
| `label({x,y,dx,dy,teks,warna,ukuran,font})` → `L.atur(t,muncul,hilang[,x,y])` | label penunjuk |
| `grainOn(opacity)` | butiran film (bergerak otomatis) |

Pola waktu yang baik: hitung semua dari `t` di `frame(t)`:
```js
const k = E.io(seg(t, 3.0, 4.2));           // 0→1 antara detik 3 dan 4,2 dengan percepatan halus
obj.style.transform = `translateY(${lerp(80, 0, k)}px)`;
```
Ambil detik dari kata: `const T = w => (window.KATA||[]).find(k => k.w.toLowerCase().startsWith(w))?.t0 ?? 0;`
lalu `seg(t, T('mesin') - .2, T('mesin') + .5)`.

## 4. Canvas 2D

- Satu canvas penuh (`kanvas(W,H,$('#dunia'))`), digambar ulang tiap frame dari `t`.
- Tekstur berat (kertas, noise, batu) dibuat **sekali** ke canvas lain, lalu ditempel
  (`drawImage`) tiap frame. Jangan membuat ribuan titik acak tiap frame.
- Partikel: daftar dibuat sekali dengan `rng`, posisi dihitung analitis dari `t` (mis.
  `y = (y0 + t*v) % H`).

## 5. three.js (r128)

- Muat `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` di `@HEAD`.
- `new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true})` — **preserveDrawingBuffer
  wajib**, tanpa itu potret/MP4 hitam.
- `REN.outputEncoding = THREE.sRGBEncoding; REN.toneMapping = THREE.ACESFilmicToneMapping;`
  warna hex lewat `new THREE.Color(hex).convertSRGBToLinear()`.
- Render di dalam `frame(t)` (`REN.render(scene, cam)`), bukan di loop sendiri.
- Elemen berulang (batu, jendela, pohon, baut) → `InstancedMesh`.
- Label menempel ke titik 3D: `v.set(x,y,z).project(cam)` → layar `((v.x+1)/2*W, (1-v.y)/2*H)` →
  `L.atur(t, a, b, sx, sy)`.
- Jebakan r128 yang sudah terjadi: `PMREMGenerator.fromScene` bisa menghasilkan hitam (pakai
  lampu hemisfer + environment sederhana); bidang air/kaca yang terlihat dari dua sisi butuh
  `side: THREE.DoubleSide`; benda yang harus "terbelah" pakai `material.clippingPlanes` +
  `REN.localClippingEnabled = true`; render target pasca-proses (bloom) harus `HalfFloatType`;
  shader dengan `pow()` basis negatif → garis putih/NaN, `clamp` dulu.
- Lapisan penampang yang berdempet berkedip (z-fighting) → beri celah ±0,01 antar lapis.
- Kinerja: satu frame idealnya < 1 detik saat render. Bayangan 2048 cukup; jangan ratusan lampu.

## 6. Jebakan JavaScript yang sudah terjadi

- **Komentar `//` di tengah ekspresi atau objek satu baris** menelan sisa baris
  (`const y = a + b // goyang + nz(t)` → `nz(t)` hilang; di objek → NaN, layar hitam tanpa error).
  Taruh komentar di baris sendiri atau pakai `/* … */`.
- **Nama yang sama dengan perkakas mesin** (`label`, `seg`, `E`, `W`, `H`, `AMAN`) menimpa perkakas
  itu. Pakai nama lain (mesin juga menyediakan `MFlabel`).
- Waktu tertulis tersebar di banyak tempat → sulit memperpanjang video. Kumpulkan di `const WAKTU = {...}`.

## 7. Gambar dari user

Taruh di `assets/gambar/` (logo, foto produk). Muat lewat `SCENE.muat`:
```js
const IMG = {}; const muatGambar = (k, src) => new Promise(r => { const i = new Image(); i.onload = () => { IMG[k] = i; r(); }; i.onerror = r; i.src = src; });
const SCENE = { muat: () => Promise.all([muatGambar('produk', 'assets/gambar/produk.png')]), ... };
```
Foto berlatar → minta versi PNG transparan bila perlu memotong, atau beri bingkai/kartu yang
cocok dengan gaya. Gambar AI (bila user memakai generator gambar sendiri) diperlakukan sama:
taruh di `assets/gambar/` lalu digerakkan (paralaks, zoom, lapisan cahaya).

## 8. Cek sendiri sebelum menunjukkan

- `mf.py potret <proyek>` → baca `lembar.jpg` dengan Read. Untuk detail: `--t 3.2,3.6` lalu buka
  `.potret/00.jpg` dst.
- Error JS tercetak di akhir `potret`. Nol error sebelum lanjut.
- Pratinjau di browser: buka `index.html`; `?debug=1` memunculkan penggeser waktu, `?t=4.2`
  berhenti di detik 4,2.
- Render lambat (> 2 dtk/frame)? kurangi bayangan, partikel, atau ukuran tekstur.
