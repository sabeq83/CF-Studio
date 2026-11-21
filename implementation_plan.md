# Implementation Plan: Layout Mobile CF Studio — Tahap 2 (Prioritas 1 & 2)

**Branch**: `fitur/layout-mobile-tahap2`  
**Penyusun**: Antigravity  
**Dasar Usulan**: `catatan-kerja/usulan/USULAN_LAYOUT_MOBILE_TAHAP2.md` & `catatan-kerja/instruksi-agent/antigravity_layout_mobile_tahap2_instructions.md`  
**Filter Desain**: `antislop-layoutmobile` + `antislop` (core, Mode DURING)

---

## 1. Ringkasan & Ruang Lingkup

Tahap 2 berfokus pada **pemolesan interior 5 halaman kerja utama** CF Studio:
- **Prioritas 1**:
  1. `app/dashboard/page.js` (Dashboard Eksekutif & Launchpad)
  2. `app/auto-pipeline/page.js` (Wizard Auto Pipeline & Antrean)
- **Prioritas 2**:
  3. `app/content-flow/page.js` (ContentFlow Publishing Tracker Hub)
  4. `app/product-radar/page.js` (Radar Produk & Kurasi TeleRadar)
  5. `app/products/page.js` (Database Katalog Produk & Modal Foto)

### Batasan Ketat:
- **Desktop (>1024px)**: Tidak boleh berubah sama sekali (100% identik).
- **Backend & Logika Bisnis**: Tidak disentuh.
- **Warna & Tampilan**: Wajib menggunakan Semantic CSS Tokens dari `app/theme.css`.
- **Alur Kerja**: Mockup HTML dulu (`public/mockup_layout_mobile_tahap2.html`), sinkronkan ke Staging, **BERHENTI & TUNGGU PERSETUJUAN PENGGUNA**, baru kemudian mengedit kode halaman React.

---

## 2. Rencana Perbaikan Per Halaman

### 2.1 Dashboard (`/dashboard`)
- Ganti inline padding `padding: '32px 36px'` pada container utama agar menggunakan CSS class `.page-container` atau responsive padding `var(--page-padding)`.
- 4 Executive Metric Cards diatur menjadi 2 kolom padat di HP ($\le 640\text{px}$) via kelas khusus `.dashboard-metrics-grid`.
- Quick Action Launchpad: 4 kartu pintasan diatur 2 kolom dengan target sentuh $\ge 44\text{px}$.
- Global Brand Overview: pembungkus grid akun dan badge platform TikTok, FB, IG yang pas tanpa overflow.
- 5 Konten Terbaru & Platform Readiness: ditumpuk rapi 1 kolom vertikal.

### 2.2 Auto Pipeline (`/auto-pipeline`)
- Stepper Wizard (Step 1 s/d 5): diberi wadah gulir horizontal fleksibel dengan snap sentuh `.stepper-scroll-track`.
- Form kontrol dan selector preset diberi padding sentuh $\ge 44\text{px}$ dan font input 16px.
- Antrean batch & riwayat video terakhir ditampilkan dalam format kartu ringkas (*summary card*).

### 2.3 ContentFlow Hub (`/content-flow`)
- Filter Bar & Sub-tab Akun Brand diubah menjadi *horizontal scrolling chip bar* (`.contentflow-chips-bar`).
- Mobile Card View: item video di HP ditampilkan sebagai kartu vertikal dengan hook, platform pills yang interaktif, dan tombol aksi mudah diketuk.
- Floating Bulk Action Bar diletakkan di atas bilah bawah (`bottom: calc(var(--bottom-nav-h) + 12px)`).

### 2.4 Radar Produk (`/product-radar`)
- Filter bar TeleRadar menjadi horizontal scrollable chip bar.
- Kartu Kandidat: foto produk persegi (1:1), judul & skor viralitas, omset badge, tombol verifikasi $\ge 44\text{px}$.
- CandidateDetailDrawer: full bottom sheet modal di HP (`max-height: 92dvh`).

### 2.5 Product Database (`/products`)
- Kartu Produk di HP: foto di atas dengan tombol switch Clean/Raw 44px, badge USP tersusun rapi.
- Modal Ganti Foto Produk & Add/Edit Product: bottom sheet penuh di layar HP.

---

## 3. Execution Task List

- [x] Task 1: Buat branch git `fitur/layout-mobile-tahap2` dari `main`
- [x] Task 2: Susun dokumen usulan dan instruksi agen Tahap 2 di `catatan-kerja/`
- [x] Task 3: Susun rencana pelaksanaan lengkap di `implementation_plan.md`
- [x] Task 4: Buat Mockup HTML Mandiri (`public/mockup_layout_mobile_tahap2.html`) mencakup 5 tab pratinjau halaman
- [x] Task 5: Sinkronkan mockup ke Mac mini Staging (`http://100.95.245.55:5010/mockup_layout_mobile_tahap2.html`)
- [x] Task 6: **STOP & REVIEW** — Laporkan tautan mockup ke pengguna dan tunggu konfirmasi/persetujuan sebelum mengedit kode React (Disetujui pengguna)
- [x] Task 7: Implementasi kelas penolong mobile di `app/globals.css`
- [x] Task 8: Terapkan penyesuaian mobile di `app/dashboard/page.js`
- [x] Task 9: Terapkan penyesuaian mobile di `app/auto-pipeline/page.js`
- [x] Task 10: Terapkan penyesuaian mobile di `app/content-flow/page.js`
- [x] Task 11: Terapkan penyesuaian mobile di `app/product-radar/page.js` & `product-radar.module.css`
- [x] Task 12: Terapkan penyesuaian mobile di `app/products/page.js` & `app/products/ProductDatabaseModal.js`
- [x] Task 13: Jalankan verifikasi lokal (build Next.js, test regression desktop, cluster health)
- [x] Task 14: Commit dan push branch `fitur/layout-mobile-tahap2` ke GitHub origin (`65e8a05b`)
- [x] Task 15: Deploy ke Server Dev (`http://100.95.245.55:5020`) via `npm run deploy:dev:atomic -- --ref <full-sha> --apply --confirm-dev` (Release: `20261121T051556Z-65e8a05b5c9e`)
- [x] Task 16: Verifikasi hasil di Dev dan sajikan laporan akhir beserta checklist uji HP kepada pengguna
