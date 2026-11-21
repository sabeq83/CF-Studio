# Implementation Plan: Layout Mobile CF Studio — Tahap 1 (Fondasi Bersama)

**Branch**: `fitur/layout-mobile`  
**Penyusun**: Antigravity  
**Dasar Usulan**: `catatan-kerja/usulan/USULAN_LAYOUT_MOBILE_CFSTUDIO.md` & `catatan-kerja/instruksi-agent/antigravity_layout_mobile_tahap1_instructions.md`  
**Filter Desain**: `antislop-layoutmobile` + `antislop` (core, Mode DURING)

---

## 1. Ringkasan & Ruang Lingkup

Tahap 1 berfokus pada **lapisan fondasi bersama** agar CF Studio nyaman digunakan pada perangkat bergerak (HP dan tablet) tanpa merusak tampilan desktop (>1024px) dan tanpa menyentuh file halaman bisnis satu per satu (49 halaman).

### Batasan Ketat:
- **Desktop (>1024px)**: Tidak boleh berubah sama sekali (100% identik dengan sebelum perubahan).
- **Database, API, & Logika Bisnis**: Tidak disentuh.
- **Warna & Tampilan**: Wajib menggunakan Semantic CSS Tokens dari `app/theme.css` (harmonis di mode gelap dan terang, tanpa hex/rgb statis baru).
- **Target Deploy**: Berhenti di server **Dev** (`http://100.95.245.55:5020`). Tidak ada rilis ke Staging atau Prod sebelum uji Dev disetujui pengguna.
- **Tahap 1**: CSS Global + Komponen Menu Bersama (`MobileNav.js` di dalam `Sidebar.js`). Perbaikan khusus per-halaman masuk ke Tahap 2.

---

## 2. Keputusan Arsitektur & Titik Patah (3 Tingkat)

| Tingkat | Rentang Lebar | Perilaku & Keputusan Desain |
|---|---|---|
| **HP** | $\le 640\text{px}$ | Satu kolom, bilah atas (52px) + bilah bawah (56px), sidebar desktop disembunyikan (`display: none`), modal tampil sebagai bottom sheet (`92dvh`), padding konten dirapatkan, grid inline menumpuk ke 1 kolom kecuali kalender 7 hari & stats mini. |
| **Tablet** | $641\text{px} - 1024\text{px}$ | Sidebar desktop disembunyikan di belakang tombol Menu di bilah atas (menggunakan drawer `MobileNav` yang sama), maksimal 2 kolom konten, tidak ada bilah bawah untuk memaksimalkan ruang kerja tabel/editor. |
| **Desktop** | $> 1024\text{px}$ | **Identik 100% dengan kondisi saat ini**. Sidebar tetap 260px di sisi kiri, bilah atas & bawah mobile disembunyikan (`display: none`). |

> **Penjelasan Pilihan Tablet**:  
> Menyembunyikan sidebar di belakang tombol Menu drawer (sama dengan pola drawer HP) dipilih karena jauh lebih aman dan bersih daripada menciutkan sidebar menjadi ikon sempit. Sidebar CF Studio memuat banyak teks navigasi bertingkat, accordion 5 section, pemilih akun brand, dan status autentikasi yang rumit bila dipaksakan menjadi ikon tanpa teks pada tablet. Drawer memberikan ruang kerja penuh untuk dashboard, tabel, dan editor di tablet.

---

## 3. Strategi Pelindung CSS Global (`app/globals.css`)

1. **Grid Inline Menumpuk di HP**:
   - Terdapat ~140 grid inline di 61 file (`'1fr 1fr'`, `'1fr 1fr 1fr'`, dll.).
   - Di $\le 640\text{px}$, selektor atribut `[style*="grid-template-columns"]` memaksa `grid-template-columns: 1fr !important`.
   - **Pengecualian Terkontrol**:
     - Kalender 7 hari: `[style*="repeat(7,"]` dikecualikan via `:not([style*="repeat(7,"])`, tetap 7 kolom (`repeat(7, minmax(0, 1fr)) !important`).
     - Statistik Mini: `.stats-grid` dipertahankan 2 kolom (`grid-template-columns: 1fr 1fr !important`).
     - Kelas pelindung eksplisit: elemen dengan kelas `.keep-grid` tidak dipaksa 1 kolom.
2. **Pencegahan Meluap (Zero Horizontal Scroll Leak)**:
   - `img, video, canvas, svg { max-width: 100%; height: auto; }`.
   - `overflow-wrap: anywhere; word-break: break-word;` untuk string panjang.
   - `min-width: 0;` pada anak elemen flex/grid.
   - Pembungkus tabel `.table-scroll-container, .ideas-table` dengan `overflow-x: auto; -webkit-overflow-scrolling: touch;`.
3. **Modal sebagai Lembar Bawah (Bottom Sheet)**:
   - Di $\le 640\text{px}$, `.modal-backdrop` menggunakan `align-items: flex-end;`.
   - `.modal` menjadi lebar 100%, `max-height: 92dvh`, sudut bawah siku (`border-bottom-left-radius: 0; border-bottom-right-radius: 0; border-bottom: none;`), padding 16px, dan animasi `slideUp`.
4. **Target Ketuk (Touch Targets) & Form Input**:
   - Pada `@media (pointer: coarse)` dan $\le 640\text{px}$, tombol dan link aksi memiliki tinggi/area sentuh minimal $44\text{px}\times 44\text{px}$.
   - Input, textarea, dan select di HP memiliki `font-size: 16px` (mencegah zoom otomatis pada Safari iOS).
5. **Rangka Viewport & 100dvh**:
   - Fallback `100vh` diikuti `100dvh` pada `.app-layout` dan `.main-content`.
   - Di $\le 640\text{px}$, `.main-content` memiliki `margin-left: 0; padding-top: var(--top-nav-h); padding-bottom: calc(var(--bottom-nav-h) + env(safe-area-inset-bottom, 16px));`.

---

## 4. Code Sebelum vs Code Sesudah (Planned Diffs)

### 4.1 `app/theme.css`
Menambahkan variabel skala HP di root dan media query $\le 640\text{px}$.

#### Code Sebelum:
```css
:root,
[data-theme='dark'] {
  color-scheme: dark;
  --radius: 12px;
  --radius-xs: 6px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --sidebar-w: 260px;
  --transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
...
```

#### Code Sesudah:
```css
:root,
[data-theme='dark'] {
  color-scheme: dark;
  --radius: 12px;
  --radius-xs: 6px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --sidebar-w: 260px;
  --transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  /* Fondasi Skala Responsif & Tata Letak Mobile */
  --top-nav-h: 52px;
  --bottom-nav-h: 56px;
  --page-padding: 32px;
  --card-padding: 24px;
  --modal-padding: 28px;
  --header-gap: 32px;
  --header-title-size: 1.8rem;
...
}

@media (max-width: 640px) {
  :root {
    --page-padding: 16px;
    --card-padding: 16px;
    --modal-padding: 16px;
    --header-gap: 16px;
    --header-title-size: clamp(1.25rem, 5vw, 1.45rem);
  }
}
```

---

### 4.2 `app/globals.css`
Memperbarui viewport height, mengganti aturan responsive lama (`@media (max-width: 768px)`), dan memasang aturan pelindung 3 breakpoint.

#### Code Sebelum:
```css
/* Line 17 */
.app-layout { display: flex; height: 100vh; }
...
/* Line 172-178 */
.main-content {
  flex: 1;
  margin-left: var(--sidebar-w);
  overflow-y: auto;
  height: 100vh;
  background: var(--bg-primary);
}

.page-container { max-width: 1200px; margin: 0 auto; padding: 32px; }
.page-header { margin-bottom: 32px; }
.page-header h2 { font-size: 1.8rem; font-weight: 700; letter-spacing: -0.03em; margin-bottom: 6px; }
...
/* Line 651-657 */
/* ===== RESPONSIVE ===== */
@media (max-width: 768px) {
  .sidebar { display: none; }
  .main-content { margin-left: 0; }
  .form-grid, .form-grid-3 { grid-template-columns: 1fr; }
  .stats-grid { grid-template-columns: 1fr 1fr; }
}
```

#### Code Sesudah:
```css
/* Layout dasar dengan 100dvh & fallback */
.app-layout {
  display: flex;
  height: 100vh;
  height: 100dvh;
}
...
.main-content {
  flex: 1;
  margin-left: var(--sidebar-w);
  overflow-y: auto;
  height: 100vh;
  height: 100dvh;
  background: var(--bg-primary);
}

.page-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--page-padding);
}
.page-header {
  margin-bottom: var(--header-gap);
}
.page-header h2 {
  font-size: var(--header-title-size);
  font-weight: 700;
  letter-spacing: -0.03em;
  margin-bottom: 6px;
}
...
/* ===== SISTEM TITIK PATAH RESPONSIVE (3 TINGKAT) ===== */

/* Desktop (>1024px): Bilah mobile disembunyikan sepenuhnya */
@media (min-width: 1025px) {
  .mobile-top-bar,
  .mobile-bottom-bar,
  .mobile-nav-backdrop,
  .mobile-nav-drawer {
    display: none !important;
  }
}

/* Tablet (641px - 1024px) */
@media (max-width: 1024px) and (min-width: 641px) {
  .sidebar { display: none; }
  .mobile-bottom-bar { display: none !important; }
  .mobile-top-bar { display: flex; }
  .main-content {
    margin-left: 0;
    padding-top: var(--top-nav-h);
  }
  .form-grid-3 { grid-template-columns: repeat(2, 1fr); }
}

/* HP (<= 640px) */
@media (max-width: 640px) {
  .sidebar { display: none; }
  .mobile-top-bar { display: flex; }
  .mobile-bottom-bar { display: flex; }

  .main-content {
    margin-left: 0;
    padding-top: var(--top-nav-h);
    padding-bottom: calc(var(--bottom-nav-h) + env(safe-area-inset-bottom, 16px));
  }

  /* Pelindung Grid Inline: paksa 1 kolom kecuali kalender 7 hari dan stats mini */
  [style*="grid-template-columns"]:not([style*="repeat(7,"]):not(.keep-grid) {
    grid-template-columns: 1fr !important;
  }
  [style*="repeat(7,"] {
    grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
    gap: 4px !important;
  }
  .stats-grid {
    grid-template-columns: 1fr 1fr !important;
    gap: 10px !important;
  }
  .form-grid, .form-grid-3 {
    grid-template-columns: 1fr !important;
  }

  /* Pelindung Elemen Meluap */
  img, video, canvas, svg {
    max-width: 100%;
    height: auto;
  }
  .page-container, .main-content {
    overflow-x: hidden;
  }

  /* Pelindung Pembungkus Tabel */
  .table-scroll-container,
  .ideas-table {
    display: block;
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* Modal Lembar Bawah (Bottom Sheet) */
  .modal-backdrop {
    align-items: flex-end !important;
    padding: 0 !important;
  }
  .modal {
    width: 100% !important;
    max-width: 100% !important;
    max-height: 92dvh !important;
    border-bottom-left-radius: 0 !important;
    border-bottom-right-radius: 0 !important;
    border-bottom: none !important;
    padding: var(--modal-padding) !important;
    margin: 0 !important;
    animation: slideUpMobile 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
  }
}

/* Sentuhan Coarse (HP & Tablet Layar Sentuh) */
@media (pointer: coarse) {
  button,
  a.btn,
  .btn,
  .nav-item,
  .mobile-bottom-item {
    min-height: 44px;
    min-width: 44px;
  }
  input, select, textarea {
    font-size: 16px !important; /* cegah iOS auto-zoom */
  }
}

@keyframes slideUpMobile {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
```

---

### 4.3 `app/components/Sidebar.js`
Menyematkan `<MobileNav>` di dalam `SidebarContent` dibungkus Fragment (`<> ... </>`), menyalurkan state autentikasi, bagian menu, dan hak akses yang sama.

#### Code Sebelum:
```javascript
export default function Sidebar() {
  return (
    <Suspense fallback={<aside className="sidebar"><div style={{ padding: '1rem', color: 'var(--text-muted)' }}>Loading...</div></aside>}>
      <SidebarContent />
    </Suspense>
  );
}
```

#### Code Sesudah:
```javascript
import MobileNav from './MobileNav';

function SidebarContent() {
  ...
  return (
    <>
      <aside className="sidebar">
        ... (sidebar desktop utuh tanpa perubahan)
      </aside>

      <MobileNav
        user={user}
        groupedSections={groupedSections}
        pathname={pathname}
        currentAccount={currentAccount}
        userBrandAccounts={userBrandAccounts}
        handleLogout={handleLogout}
      />
    </>
  );
}
```

---

### 4.4 `app/components/MobileNav.js` (Komponen Baru)
Komponen client-side mandiri yang merender Bilah Atas (52px), Panel Drawer Navigasi (100dvh), dan Bilah Bawah (56px) untuk layar $\le 1024\text{px}$.

#### Fitur Utama `MobileNav.js`:
1. **Bilah Atas**: Logo CF Studio, nama brand/tenant aktif, dan tombol `Menu` (ikon + teks).
2. **Drawer Navigasi**:
   - Slide-in dari kiri dengan backdrop blur `var(--overlay-backdrop)`.
   - Menggunakan akordeon section (PLANNING, WORKFLOW, PUBLISHING, TOOLS, SYSTEM).
   - Penanda rute aktif (`var(--action-primary)`).
   - Pengalih Tema (`ThemeToggle`) dan tombol Keluar (`Logout`).
   - Aksesibilitas: menutup saat rute berganti (`pathname`), tombol Esc, klik backdrop, dan kunci scroll body (`overflow: hidden`).
3. **Bilah Bawah**: 4 tujuan utama (**Dashboard**, **Auto Pipeline**, **ContentFlow Hub**, **Menu**).
4. Semua target ketuk $\ge 44\text{px}\times 44\text{px}$.

---

### 4.5 `app/layout.js` (Viewport Config)
Menambahkan ekspor `viewport` standar Next.js 16 untuk memastikan rasio skala mobile tepat dan mendukung notch (`viewportFit: 'cover'`).

#### Code Sebelum:
```javascript
export const metadata = {
  metadataBase: new URL('https://contentflow-stg.ast402.my.id'),
...
};

export default function RootLayout({ children }) {
...
```

#### Code Sesudah:
```javascript
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata = {
  metadataBase: new URL('https://contentflow-stg.ast402.my.id'),
...
};

export default function RootLayout({ children }) {
...
```

---

## 5. Execution Task List

- [x] Task 1: Buat dan periksa branch git `fitur/layout-mobile` dari `main`
- [x] Task 2: Susun rencana pelaksanaan lengkap di `implementation_plan.md`
- [x] Task 3: Buat Mockup HTML Mandiri (`public/mockup_layout_mobile.html`) dengan token tema terang/gelap, bilah atas, drawer, bilah bawah, modal bottom-sheet, kalender 7 kolom, dan tabel responsif
- [x] Task 4: Sinkronkan mockup ke Mac mini Staging (`http://100.95.245.55:5010/mockup_layout_mobile.html`)
- [x] Task 5: **STOP & REVIEW** — Laporkan link mockup ke pengguna dan tunggu konfirmasi/persetujuan sebelum mengedit kode React/CSS
- [x] Task 6: Terapkan token skala HP di `app/theme.css`
- [x] Task 7: Terapkan aturan 3 titik patah, pelindung grid inline, tabel, modal, dan touch target di `app/globals.css`
- [x] Task 8: Tambahkan ekspor `viewport` di `app/layout.js`
- [x] Task 9: Buat komponen `app/components/MobileNav.js` dan sematkan ke `app/components/Sidebar.js`
- [x] Task 10: Jalankan verifikasi lokal (build Next.js, test regression desktop, tes overflow)
- [x] Task 11: Commit dan push branch `fitur/layout-mobile` ke GitHub origin
- [x] Task 12: Deploy ke Server Dev (`http://100.95.245.55:5020`) via `npm run deploy:dev:atomic -- --ref <full-sha> --apply --confirm-dev`
- [x] Task 13: Verifikasi hasil di Dev dan sajikan laporan akhir beserta checklist uji HP kepada pengguna
