# Instruksi Antigravity — Layout Mobile CF Studio, Tahap 1 (Fondasi Bersama)

Tanggal: 21 November 2026 · Penyusun: Claude (reviewer/planner) · Pelaksana: Antigravity
Dasar: [USULAN_LAYOUT_MOBILE_CFSTUDIO.md](../usulan/USULAN_LAYOUT_MOBILE_CFSTUDIO.md) (baca dulu, terutama bagian 1 dan 3)
Skill acuan: `antislop-layoutmobile` + `antislop` (core). Muat keduanya sebelum mulai.

> Baca `AGENTS.md` dan baca panduan terkait di `node_modules/next/dist/docs/` sebelum menulis kode: Next.js di proyek ini bukan versi yang biasa Anda kenal.

## 0. Tujuan & batas

**Tujuan:** CF Studio nyaman dipakai di HP: ada menu, tidak ada geser samping, tombol mudah diketuk, popup tidak sesak. Tahap 1 hanya **lapisan bersama** (CSS global + 1 komponen menu). **Jangan** menyentuh halaman raksasa satu per satu (`auto-pipeline/page.js`, `re-campaigns/[id]`, dll.).

**Dilarang:**
- Mengubah tampilan desktop (>1024px). Semua aturan baru wajib dibungkus media query layar kecil/sedang. Bandingkan sebelum/sesudah.
- Mengubah database, API, atau logika bisnis. Ini murni tampilan.
- Warna statis (hex/rgb). Pakai token `app/theme.css` saja (SOP Semantic CSS Tokens), harus harmonis di mode terang dan gelap.
- `npm run release`, deploy Staging, atau deploy Production. Pekerjaan berhenti di **Dev**.

## 1. Alur kerja wajib (SOP Branch)

1. `git branch --show-current`. Jika `main`: `git checkout main && git pull && git checkout -b fitur/layout-mobile`.
2. Susun `implementation_plan.md` (folder utama) berisi `## Execution Task List` (checkbox) dan, untuk **setiap file yang diubah**, potongan **Code Sebelum** dan **Code Sesudah**. Centang `- [x]` real-time.
3. **Mockup HTML dulu** (SOP Mockup): `public/mockup_layout_mobile.html`, mandiri (token warna disalin ke dalam file, terang/gelap), berisi: bilah atas + panel Menu + bilah bawah, kartu satu kolom, modal sebagai lembar bawah, kalender 7 hari, tabel dengan gulir mendatar. Sinkronkan ke Staging agar bisa dibuka di `http://100.95.245.55:5010/mockup_layout_mobile.html`. **Berhenti, lapor ke pengguna, tunggu persetujuan mockup** sebelum menulis kode React/CSS.
4. Setelah mockup disetujui: kerjakan Bagian 2. Commit, `git push -u origin fitur/layout-mobile`.
5. Deploy ke Dev: `npm run deploy:dev:atomic -- --ref <full-git-sha> --apply --confirm-dev`. Lapor ke pengguna (`http://100.95.245.55:5020`) beserta daftar cek uji (Bagian 4). Jangan polling SSH tiap 10-15 detik; tunggu 60-120 detik.
6. Naik ke Staging hanya atas pernyataan eksplisit pengguna bahwa lolos uji di Dev (SOP Alur 1 langkah 5-7).

## 2. Pekerjaan (setelah mockup disetujui)

### 2.1 Titik patah (tiga tingkat, bukan dua)

| Tingkat | Lebar | Perilaku |
|---|---|---|
| HP | ≤ 640px | satu kolom, bilah atas + bilah bawah, tanpa sidebar |
| Tablet | 641-1024px | sidebar diciutkan jadi ikon atau disembunyikan di belakang tombol Menu (pilih satu yang paling sederhana dan aman, jelaskan pilihan di rencana), maksimal dua kolom |
| Desktop | > 1024px | **persis seperti sekarang** |

Aturan lama `@media (max-width: 768px)` di `app/globals.css` (sekitar baris 652) diganti, bukan ditambah di bawahnya. Pastikan tidak ada dua aturan yang saling tindih.

### 2.2 Menu HP: `app/components/MobileNav.js` (baru)

Fakta penting: **setiap halaman merender `<Sidebar />` sendiri** (contoh `app/dashboard/page.js` baris 3 dan 59). Maka pasang `MobileNav` **di dalam `Sidebar.js`** (bungkus keluaran dengan fragment `<>…</>`), supaya 49 halaman ikut tanpa diedit satu per satu.

- **Satu sumber data menu:** pakai logika pengelompokan, hak akses, dan `NEXT_PUBLIC_ENABLED_MENUS` yang **sudah ada di `Sidebar.js`** (user, `groupedSections`, `menuKeyMap`). Jangan menyalin daftar menu. Ekstrak ke fungsi/hook bersama bila perlu, tetapi perilaku sidebar desktop tidak boleh berubah. Menu HP wajib menampilkan item yang sama persis dengan yang boleh dilihat pengguna itu.
- **Bilah atas (≤640px):** tinggi ±52px, logo (`ContentFlowLogo`, ukuran kecil) + tombol berlabel **"Menu"** (ikon + teks, bukan hamburger polos). `position: sticky`/fixed, kompak.
- **Panel Menu:** terbuka dari kiri, tinggi `100dvh`, latar gelap (`var(--overlay-backdrop)`) di belakang, tutup dengan: tombol Tutup, ketuk latar, tombol Esc, dan otomatis saat pindah halaman (pantau `pathname`). Isi: 5 bagian (PLANNING, WORKFLOW, PUBLISHING, TOOLS, SYSTEM) dengan akordeon yang sama, penanda halaman aktif, pemilih brand/tenant dan tombol keluar bila ada di sidebar. Kunci gulir halaman di belakang saat panel terbuka. Fokus berpindah ke panel dan kembali ke tombol Menu saat tertutup.
- **Bilah bawah (≤640px):** empat tujuan: **Dashboard, Auto Pipeline, ContentFlow Hub, Menu**. Tinggi ±56px, `padding-bottom: env(safe-area-inset-bottom)`. Item yang tidak boleh diakses pengguna (hak akses menu) disembunyikan; "Menu" selalu ada. Tombol "Menu" di sini membuka panel yang sama.
- Semua target ketuk ≥ 44×44px dengan jarak antar target.
- Bilah atas/bawah dan panel hanya tampil di ≤640px (dan tablet bila Anda memilih pola itu); di desktop tidak boleh ada di DOM yang terlihat.

### 2.3 Rangka halaman

- `.app-layout` dan `.main-content`: ganti `100vh` dengan `100dvh` (sediakan fallback `100vh` di baris sebelumnya).
- Di HP: `.main-content { margin-left: 0; padding-top: <tinggi bilah atas>; padding-bottom: calc(<tinggi bilah bawah> + env(safe-area-inset-bottom)); }` agar konten terakhir tidak tertutup bilah.
- Pastikan ada `viewport` yang benar (`width=device-width, initial-scale=1`; bila perlu `viewport-fit=cover`) lewat mekanisme Next.js versi proyek ini (cek dokumentasi di `node_modules/next/dist/docs/`, mungkin `export const viewport`).

### 2.4 Skala HP (token di `app/theme.css`)

Tambah variabel skala yang berubah di ≤640px, lalu pakai di `globals.css`:
- `.page-container` padding 32px → 16px; `.card` 24px → 16px; `.modal` 28px → 16px; `.page-header` margin bawah lebih rapat.
- Judul `.page-header h2` 1.8rem → `clamp()` ±1.35rem.
- Jarak/gap antar blok mengecil (kira-kira setengah dari desktop).
- Jangan mengecilkan target ketuk di bawah 44px.

### 2.5 Aturan pelindung global (`app/globals.css`, hanya di layar kecil/sedang)

1. **Grid inline menumpuk di HP.** Ada ±140 grid inline (`'1fr 1fr'` 94×, `'1fr 1fr 1fr'` 14×, `repeat(2|3, 1fr)`, `repeat(7, 1fr)`) di 61 file. Tanpa mengedit file-file itu, paksa satu kolom di ≤640px lewat selektor atribut, mis. `[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }` (inline style React menjadi `grid-template-columns` di DOM; **verifikasi di DOM nyata**, `!important` diperlukan karena inline). **Pengecualian terkontrol** yang tidak boleh ikut tumpuk:
   - kalender 7 hari (`repeat(7, 1fr)`): tetap 7 kolom, sel diperkecil, teks sel aman;
   - grup statistik/KPI kecil: dua kolom;
   - `repeat(auto-fit/auto-fill, minmax(...))`: **jangan disentuh** (sudah fluid). Pastikan `minmax` minimum ≤ lebar HP (mis. 320px di layar 360px dengan padding 16px akan meluap; tangani dengan `min(100%, 320px)` lewat aturan global bila perlu).
   Buat pengecualian dengan atribut/kelas yang jelas dan dokumentasikan di rencana; jangan menebak, daftar dulu varian grid yang benar-benar ada (`grep gridTemplateColumns`) dan putuskan per varian.
2. **Tabel** (36 file): pembungkus gulir mendatar yang terlihat (bayangan tepi). Karena tabel tersebar, mulai dari kelas global `.ideas-table` + wadah umum; untuk tabel inline lainnya, cari pembungkus bersama terlebih dahulu. Tujuannya: **halaman tidak pernah bergeser ke samping**; hanya tabel yang boleh digulir di dalam wadahnya.
3. **Meluap:** `img, video, canvas, svg { max-width: 100%; height: auto }` (hati-hati dengan kanvas/pemutar Remotion: uji), `overflow-wrap: anywhere` untuk teks panjang, `min-width: 0` untuk anak grid/flex yang meluap.
4. **Modal** (`.modal-backdrop`, `.modal`, juga modal inline di komponen): di ≤640px menjadi **lembar penuh dari bawah**: `align-items: flex-end`, lebar 100%, `max-height: 92dvh`, sudut atas membulat, tombol aksi menempel di bawah bila memungkinkan. Modal inline yang tidak memakai `.modal` didaftar dan ditangani pola yang sama atau dicatat sebagai sisa pekerjaan Tahap 2.
5. **Target ketuk & input:** `@media (pointer: coarse)`: `button, a.btn, input, select, textarea` tinggi minimal 44px; font input minimal 16px (cegah zoom otomatis iPhone). Buat `:active` yang terlihat.
6. **Hover-only:** 19 pemakaian `onMouseEnter`/`:hover`. Periksa satu per satu: jika membuka sesuatu hanya lewat hover, beri padanan ketuk. Daftar di rencana.
7. **`100vh` lain:** ada 34× `100vh` + varian `90vh/92vh/85vh`. Di Tahap 1 hanya ganti yang di rangka global dan `.modal`. Sisanya cukup didaftar di laporan sebagai sisa pekerjaan Tahap 2 (jangan sapu bersih semua file).

## 3. Yang sengaja BUKAN bagian Tahap 1

Pekerjaan per halaman (Dashboard, ContentFlow Hub, Auto Pipeline, Radar Produk, Threads Labs) dan pemolesan form kampanye/Settings/Video Studio adalah **Tahap 2**, diusulkan terpisah setelah Tahap 1 lolos uji. Jika menemukan halaman yang masih rusak parah setelah aturan global, **catat** di laporan, jangan diperbaiki sekarang.

## 4. Kriteria selesai & daftar cek uji (untuk pengguna di HP)

Verifikasi sendiri di lebar **360, 390, 430, 768, 1024, 1280px**, tema terang dan gelap, lalu laporkan hasil nyata (bukan asumsi). Karena SOP menyatakan uji UI dilakukan manual oleh pengguna, uji otomatis cukup ringan, tetapi **cek geser samping dan overlap wajib dilakukan** (mis. skrip kecil yang membandingkan `document.documentElement.scrollWidth` dengan `innerWidth` pada halaman utama).

Daftar cek (10 butir antislop-layoutmobile, disesuaikan):
- [ ] HP punya tata letak sendiri (bukan desktop disempitkan).
- [ ] Ada tiga keadaan lebar; tablet tidak berupa tumpukan melar atau grid terjepit.
- [ ] Ukuran (judul, padding, jarak) memakai skala HP.
- [ ] Grid multi-kolom menumpuk, kecuali kalender 7 hari dan statistik kecil.
- [ ] Tidak ada geser samping di Dashboard, ContentFlow Hub, Auto Pipeline, Products, Settings.
- [ ] Target ketuk ≥44px dan berjarak; input tidak memicu zoom iPhone.
- [ ] Interaksi hover punya padanan ketuk.
- [ ] Menu HP memuat item yang sama dengan sidebar sesuai hak akses; bilah bawah menampilkan 4 tujuan.
- [ ] Bilah atas/bawah tidak menutup konten terakhir; aman di notch/home indicator.
- [ ] **Tampilan desktop (>1024px) identik dengan sebelumnya** (bandingkan tangkapan layar sebelum/sesudah di 3 halaman).
- [ ] Semua warna memakai token; terang dan gelap sama-sama kontras.
- [ ] `node scripts/test-cluster-health.js` tidak terdampak; build lulus; tidak ada galat konsol baru.

## 5. Laporan akhir ke pengguna

Tulis ringkas dan bahasa sederhana (pengguna marketer, tanpa istilah teknis): apa yang sekarang bisa dilakukan di HP, tautan Dev (`http://100.95.245.55:5020`), SHA yang di-deploy, daftar cek uji singkat untuk dicoba di HP, daftar sisa pekerjaan Tahap 2 (halaman yang masih kurang nyaman, `100vh` yang tersisa, tabel/modal yang belum tertangani), dan konfirmasi bahwa tampilan desktop tidak berubah.

## 6. Pembaruan dokumen saat rilis (setelah lolos Dev dan disetujui naik Staging)

- Perbarui `sot/global/changelog.md` lewat `npm run release-non-interactive` dari `main` (bukan dari branch fitur).
- Perbarui kartu menu yang perilakunya berubah (minimal `sot/menus/kartu/dashboard.md`, plus kartu halaman yang disentuh) dalam commit yang sama.
- Pastikan `catatan-kerja/_DAFTAR_ISI.md` memuat file baru bila ada.
