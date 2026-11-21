# Instruksi Antigravity — Layout Mobile CF Studio, Tahap 2 (Prioritas 1 & 2)

Tanggal: 21 November 2026 · Penyusun: Antigravity  
Dasar: `catatan-kerja/usulan/USULAN_LAYOUT_MOBILE_TAHAP2.md`  
Skill acuan: `antislop-layoutmobile` + `antislop` (core, Mode DURING)

## 0. Tujuan & Batas

**Tujuan:** Memoles interior 5 halaman kerja utama CF Studio agar optimal di HP ($\le 640\text{px}$) dan tablet ($641 - 1024\text{px}$):
1. **Prioritas 1**:
   - `app/dashboard/page.js` (Dashboard Eksekutif & Launchpad)
   - `app/auto-pipeline/page.js` (Wizard Auto Pipeline & Antrean)
2. **Prioritas 2**:
   - `app/content-flow/page.js` (ContentFlow Publishing Tracker Hub)
   - `app/product-radar/page.js` (Radar Produk & Kurasi TeleRadar)
   - `app/products/page.js` (Database Katalog Produk & Modal Foto)

**Batasan Wajib:**
- **Tampilan Desktop (>1024px)**: DILARANG berubah. Semua aturan baru dibungkus media query layar kecil/sedang atau menggunakan kelas CSS spesifik mobile.
- **Logika Bisnis & Backend**: DILARANG mengubah skema database, endpoint API, atau fungsi fetch/state manajemen yang sudah ada. Ini murni tata letak tampilan.
- **Warna & Desain**: Wajib memakai token CSS semantik dari `app/theme.css`. Tidak boleh menambah hex/rgb baru.
- **Alur Kerja**: Mockup HTML dulu (`public/mockup_layout_mobile_tahap2.html`), sinkronkan ke Staging, **BERHENTI & TUNGGU PERSETUJUAN PENGGUNA**, baru kemudian mengedit kode halaman React. Deploy hasil hanya ke **Dev** terlebih dahulu.

## 1. Alur Kerja Wajib (SOP Tahap 2)

1. Branch git: `fitur/layout-mobile-tahap2` (bercabang dari `main`).
2. Buat `implementation_plan.md` dengan `## Execution Task List` real-time.
3. Buat Mockup HTML Mandiri: `public/mockup_layout_mobile_tahap2.html` yang memuat tab interaktif untuk meninjau kelima halaman.
4. Salin ke Staging (`http://100.95.245.55:5010/mockup_layout_mobile_tahap2.html`).
5. **STOP & MINTA PERSETUJUAN PENGGUNA**.
6. Setelah disetujui: implementasi perbaikan kode di CSS & JSX.
7. Jalankan build & pengujian internal.
8. Commit, push, dan deploy ke Dev (`http://100.95.245.55:5020`).
9. Lapor ke pengguna dan tunggu konfirmasi untuk rilis ke Staging.
