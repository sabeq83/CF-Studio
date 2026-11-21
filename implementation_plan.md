# Implementation Plan: Layout Mobile CF Studio — Tahap 3 (Finalisasi Seluruh 16 Menu Tersisa)

**Branch**: `fitur/layout-mobile-tahap3`  
**Penyusun**: Antigravity  
**Dasar Usulan**: `catatan-kerja/usulan/USULAN_LAYOUT_MOBILE_TAHAP3.md` & `catatan-kerja/instruksi-agent/antigravity_layout_mobile_tahap3_instructions.md`  
**Filter Desain**: `antislop-layoutmobile` + `antislop` (core, Mode DURING)

---

## 1. Ringkasan & Ruang Lingkup

Tahap 3 merupakan **finalisasi menyeluruh** dari proyek Layout Mobile CF Studio, memoles 16 menu tersisa agar 100% halaman nyaman digunakan di layar HP ($\le 640\text{px}$) dan tablet ($641 - 1024\text{px}$):

- **Grup 1: PLANNING**:
  1. Content Planner (`app/content-planner/page.js`)
  2. Recipe Library (`app/recipe-library/page.js`)
  3. Deconstruct Lab (`app/deconstruct/page.js`)
  4. Preset Manager (`app/settings/presets/page.js`)
  5. Visual Identity (`app/settings/visual-identities/page.js`)
  6. Universe Manager (`app/settings/universes/page.js`)
  7. Brand Profile Manager (`app/settings/brand-profiles/page.js`)
- **Grup 2: WORKFLOW**:
  8. Threads Labs (`app/threads-labs/page.js`)
  9. RE Campaign (`app/re-campaigns/page.js`) & Detail (`app/re-campaigns/[id]/page.js`)
  10. Pillar Campaign (`app/pillar-campaigns/page.js`) & Detail (`app/pillar-campaigns/[id]/page.js`)
  11. Recipe Labs (`app/recipe-labs/page.js`)
  12. Multiplier Labs (`app/multiplier-lab/page.js`) & Detail (`app/multiplier-lab/[id]/page.js`)
  13. Product Bridging (`app/product-bridge-inject/page.js`)
- **Grup 3: TOOLS & PUBLISHING**:
  14. Recipe Exporter (`app/recipe-exporter/page.js`)
  15. Video Studio (`app/video-studio/page.js`)
  16. TTS Studio (`app/tts-studio/page.js`)
- **Grup 4: SYSTEM**:
  17. System Settings (`app/settings/page.js`)
  18. User Management (`app/settings/users/page.js`)
  19. Tenant Management (`app/settings/tenants/page.js`)

---

## 2. Execution Task List

- [x] Task 1: Buat branch git `fitur/layout-mobile-tahap3` dari `main`
- [x] Task 2: Susun dokumen usulan dan instruksi agen Tahap 3 di `catatan-kerja/`
- [x] Task 3: Susun rencana pelaksanaan lengkap di `implementation_plan.md`
- [x] Task 4: Buat Mockup HTML Mandiri (`public/mockup_layout_mobile_tahap3.html`) mencakup 4 grup modul (Planning, Workflow, Tools, System)
- [x] Task 5: Sinkronkan mockup ke Mac mini Staging (`http://100.95.245.55:5010/mockup_layout_mobile_tahap3.html`)
- [x] Task 6: **STOP & REVIEW** — Laporkan tautan mockup ke pengguna dan tunggu konfirmasi/persetujuan sebelum mengedit kode React (Disetujui Pengguna)
- [x] Task 7: Implementasi penguatan aturan CSS sistemik di `app/globals.css`
- [x] Task 8: Terapkan penyesuaian mobile di modul PLANNING (Content Planner, Recipe Library, Deconstruct, Presets, VI, Universe, Brand Profiles)
- [x] Task 9: Terapkan penyesuaian mobile di modul WORKFLOW (Threads Labs, RE Campaign, Pillar Campaign, Recipe Labs, Multiplier, Bridging)
- [x] Task 10: Terapkan penyesuaian mobile di modul TOOLS & PUBLISHING (Recipe Exporter, Video Studio, TTS Studio)
- [x] Task 11: Terapkan penyesuaian mobile di modul SYSTEM (Settings, Users, Tenants)
- [x] Task 12: Jalankan verifikasi lokal (build Next.js, cluster health)
- [ ] Task 13: Commit dan push branch `fitur/layout-mobile-tahap3` ke GitHub origin
- [ ] Task 14: Deploy ke Server Dev (`http://100.95.245.55:5020`) via `npm run deploy:dev:atomic -- --ref <full-sha> --apply --confirm-dev`
- [ ] Task 15: Verifikasi hasil di Dev dan sajikan laporan akhir beserta checklist uji HP kepada pengguna
