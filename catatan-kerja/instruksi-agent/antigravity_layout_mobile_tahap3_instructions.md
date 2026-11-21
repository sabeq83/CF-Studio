# Instruksi Antigravity — Layout Mobile CF Studio, Tahap 3 (Finalisasi 16 Menu Tersisa)

Tanggal: 21 November 2026 · Penyusun: Antigravity  
Dasar: `catatan-kerja/usulan/USULAN_LAYOUT_MOBILE_TAHAP3.md`  
Skill acuan: `antislop-layoutmobile` + `antislop` (core, Mode DURING)

## 0. Tujuan & Batas

**Tujuan:** Memoles seluruh 16 menu kerja tersisa CF Studio agar nyaman digunakan di HP ($\le 640\text{px}$) dan tablet ($641 - 1024\text{px}$):
1. **PLANNING**: Content Planner, Recipe Library, Deconstruct Lab, Presets, Visual Identity, Universe, Brand Profiles.
2. **WORKFLOW**: Threads Labs, RE Campaign, Pillar Campaign, Recipe Labs, Multiplier Labs, Product Bridging.
3. **TOOLS & PUBLISHING**: Recipe Exporter, Video Studio, TTS Studio.
4. **SYSTEM**: Settings, Users, Tenants.

**Batasan Wajib:**
- **Tampilan Desktop (>1024px)**: DILARANG berubah sama sekali.
- **Backend & Database**: DILARANG mengubah skema PostgreSQL, endpoint API, atau logika server.
- **Warna & Desain**: Wajib memakai Semantic CSS Tokens dari `app/theme.css`.
- **Alur Kerja**: Mockup HTML dulu (`public/mockup_layout_mobile_tahap3.html`), sinkronkan ke Staging, **STOP & TUNGGU PERSETUJUAN PENGGUNA**, baru edit kode halaman React. Deploy hasil awal ke **Dev (port 5020)**.

## 1. Alur Pelaksanaan Wajib (SOP)

1. Branch git: `fitur/layout-mobile-tahap3` (bercabang dari `main`).
2. Buat `implementation_plan.md` real-time task list.
3. Buat Mockup HTML Mandiri: `public/mockup_layout_mobile_tahap3.html` dengan 4 tab modul (Planning, Workflow, Tools, System).
4. Salin ke Staging (`http://100.95.245.55:5010/mockup_layout_mobile_tahap3.html`).
5. **STOP & TUNGGU KONFIRMASI PENGGUNA**.
6. Implementasi aturan CSS di `app/globals.css` dan penyesuaian JSX.
7. Jalankan build lokal `npm run build` dan `test-cluster-health.js`.
8. Commit, push, dan deploy ke Dev (`http://100.95.245.55:5020`).
9. Lapor ke pengguna dan tunggu konfirmasi sebelum rilis ke Staging.
