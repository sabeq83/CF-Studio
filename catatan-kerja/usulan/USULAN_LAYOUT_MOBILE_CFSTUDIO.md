# Usulan: Layout Mobile CF Studio (nyaman dipakai di HP)

Tanggal: 21 November 2026 · Status: **usulan, menunggu persetujuan** (belum ada kode diubah)
Acuan: skill `antislop-layoutmobile` (aturan R-03, R-05, R-35 dari antislop core)

## 1. Kondisi sekarang (hasil pemeriksaan kode)

| Temuan | Bukti | Dampak di HP |
|---|---|---|
| **Tidak ada menu sama sekali** | `globals.css` baris 652: di layar ≤768px `.sidebar { display: none }`, tanpa pengganti | Pengguna HP tidak bisa pindah halaman kecuali lewat tautan di dalam halaman |
| Hanya **1 titik patah** (768px) | 1 `@media` di `globals.css`, 1 di `theme.css`, **0** di seluruh file halaman | Tablet/layar sedang tidak punya tata letak sendiri |
| Grid kolom tetap tidak menumpuk | 94× `'1fr 1fr'`, 14× `'1fr 1fr 1fr'`, 7× `repeat(7, 1fr)` (kalender) di inline style, tersebar di 61 file | Kolom menyempit, teks terpotong, elemen bertabrakan |
| Tabel lebar | 36 file memakai `<table`; hanya 31 file memakai `overflowX` (belum tentu sama file) | Halaman bisa bergeser ke samping |
| Tinggi `100vh` | 34× `100vh`, `.app-layout` & `.main-content` memakai `100vh` | Bagian bawah halaman tertutup bar browser HP |
| Padding desktop | `.page-container` padding 32px, `.card` 24px, `.modal` 28px, judul 1.8rem | Ruang konten sempit, terasa sesak |
| Halaman raksasa | `auto-pipeline` 9.182 baris, `re-campaigns/[id]` 4.896, `pillar-campaigns/[id]` 4.623, `products` 3.350, dst. (total ±72 ribu baris) | Memperbaiki halaman satu per satu berisiko besar |

Intinya: tampilan HP saat ini adalah **desktop yang disempitkan**, bukan tata letak HP (pola "Desktop-Only Layout" dan "Nav That Stays Desktop" di skill).

## 2. Prinsip usulan

Perbaikan dilakukan **dari lapisan bersama dulu** (1 file CSS + 1 komponen), supaya 49 halaman ikut membaik sekaligus tanpa mengutak-atik halaman raksasa satu per satu. Halaman dikerjakan per prioritas sesudahnya.

## 3. Rencana bertahap

### Tahap 1: Fondasi bersama (dampak terbesar, risiko rendah)

1. **Menu HP** (komponen baru, mis. `MobileNav`):
   - Bilah atas ringkas (tinggi ±52px): logo + tombol berlabel **"Menu"** (bukan hamburger polos).
   - Menu terbuka sebagai panel penuh dari kiri berisi 5 bagian yang sama dengan sidebar (PLANNING, WORKFLOW, PUBLISHING, TOOLS, SYSTEM), memakai data `lib/sidebar-nav.js` yang sama, jadi menu tidak perlu dikelola dua kali.
   - Bilah bawah **hanya 4 tujuan utama** (usulan: Dashboard, Auto Pipeline, ContentFlow Hub, Menu), tinggi ±56px, dengan ruang cadangan agar konten terakhir tidak tertutup + `safe-area-inset-bottom`.
   - Tombol tutup dan item menu minimal 44×44px, ada jarak antar item.
2. **Rangka halaman**: ganti `100vh` dengan `100dvh`; di HP `.main-content` mendapat padding atas/bawah sesuai tinggi bilah.
3. **Tiga tingkat titik patah** (bukan dua): ≤640px (HP, satu kolom), 641–1024px (tablet, maks. dua kolom, sidebar bisa diciutkan jadi ikon), >1024px (desktop seperti sekarang).
4. **Skala HP** lewat variabel di `theme.css`: padding halaman 32→16px, kartu 24→16px, judul 1.8rem→`clamp()` ±1.35rem, jarak antar blok lebih rapat.
5. **Aturan pelindung global** di `globals.css`:
   - Grid inline `1fr 1fr` / `1fr 1fr 1fr` / `repeat(2|3, 1fr)` dipaksa 1 kolom di HP lewat selektor atribut (`[style*="grid-template-columns"]`), tanpa mengubah 61 file. Pengecualian terkontrol untuk kalender 7 hari (tetap 7 kolom tapi sel diperkecil) dan kelompok statistik (2 kolom).
   - `img, video, canvas { max-width: 100% }`; kata panjang `overflow-wrap: anywhere`.
   - Tabel: pembungkus gulir mendatar yang terlihat jelas (bayangan tepi), bukan membuat seluruh halaman bergeser.
   - `.modal`: di HP menjadi **lembar penuh dari bawah** (lebar 100%, tinggi maks `92dvh`, tombol aksi menempel di bawah), bukan kotak melayang.
   - Target ketuk: `button, a, input, select` mendapat tinggi minimal 44px di layar sentuh (`@media (pointer: coarse)`); interaksi `onMouseEnter` (19 tempat) dicek agar punya padanan ketuk.
   - Input: font minimal 16px agar iPhone tidak memperbesar layar saat mengetik.

### Tahap 2: Halaman prioritas (urutan usulan, berdasarkan kemungkinan dipakai di HP)

| Urutan | Halaman | Alasan |
|---|---|---|
| 1 | Dashboard | Pintu masuk, dicek paling sering lewat HP |
| 2 | ContentFlow Hub (kalender & jadwal) | Memantau/menyetujui tayang dari HP |
| 3 | Auto Pipeline (antrean, tinjau, setujui) | Pemantauan produksi; hanya **tampilan pantau & setujui** dulu, bukan form panjang |
| 4 | Radar Produk, Threads Labs | Kurasi & persetujuan balasan ringan |
| 5 | Sisanya (form kampanye, Settings, editor) | Tetap dapat dipakai lewat pelindung global; poles menyusul |

Catatan jujur: editor berat (Video Studio, form kampanye panjang) memang lebih nyaman di desktop. Targetnya di HP: **bisa dibaca, bisa dipantau, bisa disetujui, bisa dikerjakan darurat**, bukan menyamai kenyamanan desktop.

### Tahap 3: Pemeriksaan

- Cek lebar 360, 390, 430, 768, 1024, 1280 px, tema terang dan gelap.
- Cek 10 butir daftar periksa antislop-layoutmobile (tidak ada geser samping, target ≥44px, menu tidak menutup konten, dst.).
- Semua warna memakai token `theme.css` (tanpa warna statis), sesuai SOP.

## 4. Cara kerja & keamanan

- Sesuai SOP: ini **fitur UI**, jadi dikerjakan di branch `fitur/layout-mobile`, **mockup HTML dulu** (`public/mockup_layout_mobile.html`, bisa dibuka di `http://100.95.245.55:5010/mockup_layout_mobile.html`), baru kode.
- Setelah kode: deploy ke **Dev (5020)** untuk Anda uji di HP sungguhan, baru naik Staging setelah Anda nyatakan lolos.
- Tidak mengubah database, tidak mengubah logika bisnis, hanya tampilan.
- Risiko utama: aturan global bisa mengubah halaman desktop secara tidak sengaja. Mitigasi: semua aturan baru dibungkus media query HP/tablet, tampilan desktop dibandingkan sebelum/sesudah.

## 5. Perkiraan

- Tahap 1 (fondasi): 1 siklus kerja, mencakup mockup, `MobileNav`, `globals.css`, `theme.css`.
- Tahap 2: 1 siklus per 1–2 halaman prioritas.
- Rilis berkala per tahap (v2.58.0 untuk Tahap 1, patch untuk halaman berikutnya).

## 6. Keputusan yang saya butuhkan

1. Setuju urutan: **mockup HTML Tahap 1 dulu**?
2. Empat tujuan di bilah bawah: Dashboard, Auto Pipeline, ContentFlow Hub, Menu. Apakah sudah sesuai kebiasaan Anda membuka CF Studio di HP?
