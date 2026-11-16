# Rencana Implementasi Perbaikan Narasi VO End-to-End (Fase V0–V5)

**Dokumen Acuan**:
- [antigravity_vo_narasi_instructions.md](file:///Users/sabeqmmursyid/_cfstudio/antigravity_vo_narasi_instructions.md)
- [USULAN_PERBAIKAN_NARASI_VO_CFSTUDIO.md](file:///Users/sabeqmmursyid/_cfstudio/USULAN_PERBAIKAN_NARASI_VO_CFSTUDIO.md)
- [HASIL_UJI_PROMPT_VO.md](file:///Users/sabeqmmursyid/_cfstudio/plans/vo-narasi-reference/HASIL_UJI_PROMPT_VO.md)
- [newprompts.mjs](file:///Users/sabeqmmursyid/_cfstudio/plans/vo-narasi-reference/newprompts.mjs)
- [harness.mjs](file:///Users/sabeqmmursyid/_cfstudio/plans/vo-narasi-reference/harness.mjs)
- [score.py](file:///Users/sabeqmmursyid/_cfstudio/plans/vo-narasi-reference/score.py)
- Pola Referensi Rencana: [finishing_pass_implementation_plan.md](file:///Users/sabeqmmursyid/_cfstudio/finishing_pass_implementation_plan.md)

**Status Dokumen**: Diimplementasi di `v2.45.0`, belum di-deploy; koreksi `v2.45.1` (K1–K5) selesai diimplementasikan di branch `fix/vo-v2451` (menunggu review & persetujuan pengguna untuk merge/rilis/deploy).

---

## 0. Hasil Audit Awal & Temuan Read-Only (V0-3 & Produk Garlibee)

### 0.1. Hasil Audit Model Gemini per Tenant (V0-3 — Read-Only PostgreSQL `staging`)

Audit dilakukan secara baca-saja terhadap tabel `tenants`, `tenant_settings`, `settings` (global), dan `ai_token_usage_ledger` (20 generasi terakhir per tenant, diurutkan terbaru ke terlama) serta kode resolusi model pada [`lib/gemini.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/gemini.js).

#### A. Ringkasan Konfigurasi `tenant_settings` per Tenant (`staging`)

| `tenant_id` | Nama Tenant | `gemini_api_tier` | `gemini_model_primary` | `gemini_model_fallback` | `gemini_smart_routing` | `gemini_context_caching` | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `default_tenant` | Local Staging | `free` | **`gemini-3.5-flash-lite`** | `gemini-3.6-flash` | `on` | `off` | ⚠️ Primary di bawah standar (`flash-lite`) |
| `tnt_mas-ibnu_e0eb25` | Mas Ibnu | `paid` | `gemini-3.8-flash` | `gemini-3.6-flash` | `on` | `on` | ✅ Memadai |
| `tnt_pt-gim-sosmed_62d0d9` | PT GIM Sosmed | `free` | **`gemini-2.5-flash`** | **`gemini-3.5-flash-lite`** | `on` | `off` | 🚨 Primary & fallback lama/lemah |
| `tnt_sy-benu_415f99` | SY Benu | `free` | `gemini-3.6-flash` | `gemini-3.6-flash` | `on` | `off` | ✅ Primary memadai |
| `tnt_sy-dodot_4ba27b` | SY Dodot | `free` | `gemini-3.6-flash` | `gemini-3.6-flash` | `on` | `off` | ✅ Primary memadai |
| `tnt_test_a_1786778800665` | Tenant A | *(tidak ada row)* | — | — | — | — | ℹ️ Tenant uji tanpa aktivitas |
| `tnt_test_b_1786778800665` | Tenant B | *(tidak ada row)* | — | — | — | — | ℹ️ Tenant uji tanpa aktivitas |

*(Catatan: Tabel global `settings` pada schema `staging` memiliki **0 baris** untuk key pengaturan Gemini.)*

#### B. Distribusi Model pada 20 Generasi Terakhir (`ai_token_usage_ledger`)

| `tenant_id` | Jumlah Sampel | Rentang Waktu | Distribusi Model Aktual | `feature_name` Dominan |
| :--- | :--- | :--- | :--- | :--- |
| `default_tenant` | 20 | s/d `2026-11-13T22:34:13.618Z` | `gemini-3.5-flash-lite`: **20** | `BRAND_EDITORIAL_CREATIVE`, `PRODUCT_CAMPAIGN_CREATIVE` |
| `tnt_mas-ibnu_e0eb25` | 20 | `2026-11-08` – `2026-11-12` | `gemini-3.6-flash`: **9**, `gemini-3.8-flash`: **8**, `gemini-3.5-flash`: **2**, `gemini-2.5-flash`: **1** | `BRAND_EDITORIAL_CREATIVE` |
| `tnt_pt-gim-sosmed_62d0d9` | 20 | `2026-11-13T05:06Z` – `22:33Z` | `gemini-3.5-flash-lite`: **8**, `gemini-2.5-flash`: **7**, `gemini-3.6-flash`: **5** | `BRAND_EDITORIAL_CREATIVE` |
| `tnt_sy-benu_415f99` | 16 *(total)* | `2026-09-26` | `gemini-2.5-flash`: **16** | `general_ai` |
| `tnt_sy-dodot_4ba27b` | 20 | `2026-09-26` – `2026-10-05` | `gemini-3.6-flash`: **13**, `gemini-3.5-flash`: **5**, `gemini-3.7-flash`: **1**, `gemini-3.8-flash`: **1** | `PILLAR_CAMPAIGN`, `general_ai` |

#### C. Akar Masalah Kode Resolusi Model ([`lib/gemini.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/gemini.js))

1. Di `resolveModelForTask()` ([`lib/gemini.js#L116-L144`](file:///Users/sabeqmmursyid/_cfstudio/lib/gemini.js#L116-L144)), untuk `isCreativeTask`, kode mengembalikan `savedPrimary.trim()` **sebelum** memeriksa `MODULE_MODEL_MATRIX` (`gemini-3.6-flash`). Akibatnya meskipun `gemini_smart_routing = 'on'`, task kreatif pada `default_tenant` tetap memakai `gemini-3.5-flash-lite` dan `tnt_pt-gim-sosmed_62d0d9` memakai `gemini-2.5-flash` lalu turun ke fallback `gemini-3.5-flash-lite` saat 503/rate-limit.
2. Pada jalur Multiplier (`getGeminiModel()` di [`lib/gemini.js#L372-L391`](file:///Users/sabeqmmursyid/_cfstudio/lib/gemini.js#L372-L391)), pemanggil tidak selalu mengirimkan `taskType` spesifik dan `makeModelResilient()` ([`lib/gemini.js#L279-L370`](file:///Users/sabeqmmursyid/_cfstudio/lib/gemini.js#L279-L370)) tidak mencatat pemakaian ke `ai_token_usage_ledger`, sehingga penggunaan model di Multiplier belum terekam seragam di ledger.

#### D. Usulan Perbaikan V0-3 *(Menunggu Keputusan Pengguna sebelum Eksekusi)*

- **Opsi A (Konfigurasi Tenant Settings via Approval Pengguna)**:
  Ubah `gemini_model_primary = 'gemini-3.6-flash'` dan `gemini_model_fallback = 'gemini-3.8-flash'` (atau `'gemini-3.7-flash'`) pada `tenant_settings` untuk `default_tenant` dan `tnt_pt-gim-sosmed_62d0d9`.
- **Opsi B (Perbaikan Resolusi & Observabilitas di [`lib/gemini.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/gemini.js))**:
  1. Ketika `gemini_smart_routing === 'on'` dan task termasuk `isCreativeTask` (atau memiliki entri eksplisit di `MODULE_MODEL_MATRIX`), prioritaskan model matrix minimum (tidak turun ke `flash-lite` sebagai primary), atau tambahkan penanda `respect_smart_routing_matrix`.
  2. Teruskan `taskType` kreatif dari worker Multiplier dan catat pemakaian token Multiplier di `ai_token_usage_ledger` agar audit per tenant mencakup seluruh modul (OPC, Multiplier, Planner).

---

### 0.2. Hasil Audit Data Produk Garlibee (V5 — Read-Only `staging.product_extractions`)

- **Record Ditemukan**: `id = 'pe_1793545394035_6698'`, `tenant_id = 'default_tenant'`, `product_name = 'Garlibee Madu Bawang Lanang'`, `category = 'Makanan & Minuman Kesehatan'`, `tags = null`.
- **Fakta yang Sudah Ada pada `product_description` / `raw_description`**:
  - Nama & deskripsi: *"GarliBee — Honey Infused Solo Garlic"*
  - Proses produksi: *"fermentasi alami selama minimal 3 bulan"*
  - Saran konsumsi dasar: *"Nikmati 1 siung bawang dan 1 sendok madu setiap hari."*
  - Netto: *"300 gram"*
  - Komposisi: *"Madu mentah dan bawang putih tunggal."*
  - Penyimpanan: *"Simpan pada suhu ruang dan hindarkan dari sinar matahari langsung."*
- **Fakta yang Belum Terisi (`needs_data` untuk V5)**:
  1. Waktu konsumsi spesifik (mis. pagi sebelum/sesudah makan atau sebelum tidur).
  2. Aturan campur/takaran air (apakah langsung dimakan atau dilarutkan dengan air hangat, serta batas suhu air agar enzim madu terjaga).
  3. Detail `rasa_tekstur` yang lebih konkret (di luar deskripsi umum *"manisnya madu berpadu dengan karakter bawang tunggal yang semakin lembut"*).
  4. Kolom terstruktur `cara_pakai` dan `fakta_produksi` belum tersedia di skema tabel `product_extractions` maupun form UI modal produk.

---

### 0.3. Ringkasan Peta Codebase & Arsitektur Flag Baru

1. **Single-Source Flag Registry**: Mengikuti pola [`lib/finishing-template-registry.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-template-registry.js), akan dibuat satu modul tunggal [`lib/vo-contract-registry.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/vo-contract-registry.js) yang mendefinisikan enum, nilai default (`vo_content_contract: 'off'`, `vo_quality_gate: 'off'`), parser, validasi API/MCP, dan resolver fallback ke preset/campaign.
2. **Centralized Herbal Claim Filter**: [`lib/tiktok-compliance-service.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/tiktok-compliance-service.js) sudah memiliki `isHerbalMedicalClaimPhrase` yang dipakai oleh [`lib/finishing-plan-validator.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-plan-validator.js) dan `lib/motion-text-engine.js`. Modul ini akan menjadi satu-satunya sumber daftar token klaim herbal/kesehatan (`VO_CLAIM_TOKENS_ID_EN` / `findVoClaimViolations`).
3. **Validator Kualitas VO Tunggal**: Akan dibuat [`lib/vo-quality-validator.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/vo-quality-validator.js) untuk menyatukan metrik `score.py` + aturan V1/V2/V3/V5, sehingga OPC (`processPillarGenerator`), Recipe OPC (`processRecipeCampaignCreative`), Multiplier (`processMultiplierRemake`), dan API rewrite memakai satu fungsi validator yang identik.
4. **Mekanisme Penjagaan Gate (`enforce`) terhadap Auto-Publish**:
   - Di OPC ([`lib/scheduler-processors.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js)): jika `vo_quality_gate === 'enforce'` gagal setelah 1x rewrite otomatis, item diset `workflow_status = 'waiting_approval'` dan TTS/T2I/G-Labs dilewati. Karena [`lib/contentflow-ingest.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/contentflow-ingest.js) dan [`lib/auto-pipeline-scheduler-runner.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/auto-pipeline-scheduler-runner.js#L414-L420) hanya menerbitkan aset yang sudah `Completed` (dan memiliki file video akhir), item terblokir **tidak akan pernah masuk ContentFlow atau Repliz Auto-Publish**.
   - Di Multiplier ([`lib/re-multiplier-worker.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js)): jika `enforce` gagal setelah 1x rewrite otomatis, task diset `status = 'waiting_approval'` dan fase `'generating_audio'` dilewati (`status !== 'completed'` di [`lib/contentflow-ingest.js#L793`](file:///Users/sabeqmmursyid/_cfstudio/lib/contentflow-ingest.js#L793)).

---

## Execution Task List

Tracker eksekusi kronologis per fase. Centang `[x]` akan diperbarui real-time saat implementasi (setelah rencana disetujui):

### Fase V0 — Fondasi, Flag, Filter Klaim, & Audit Model
- [x] **V0-1a**: Buat [`lib/vo-contract-registry.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/vo-contract-registry.js) sebagai single source of truth untuk enum, parser, validator, & resolver `vo_content_contract` (`off` | `on`, default `off`) dan `vo_quality_gate` (`off` | `warn` | `enforce`, default `off`).
- [x] **V0-1b**: Tambahkan kolom migrasi `vo_content_contract` dan `vo_quality_gate` pada tabel `pillar_campaigns` dan `re_campaigns` di [`lib/db-pg.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js), serta perbarui query insert/update di [`lib/db.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/db.js).
- [x] **V0-1c**: Tambahkan `vo_content_contract` & `vo_quality_gate` di default preset workflow [`lib/operator-presets.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/operator-presets.js), UI pengaturan preset [`app/settings/presets/page.js`](file:///Users/sabeqmmursyid/_cfstudio/app/settings/presets/page.js), dan validasi API [`app/api/v2/operator-presets/[key]/route.js`](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/operator-presets/%5Bkey%5D/route.js) + [`app/api/v2/pillar-campaigns/[id]/route.js`](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/pillar-campaigns/%5Bid%5D/route.js).
- [x] **V0-1d**: Ekspos & teruskan kedua flag ke skema/handler MCP [`apps/mcp/tools.mjs`](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/tools.mjs) dan seluruh orkestrator ingest ([`lib/autonomous-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/autonomous-engine.js), [`lib/auto-pipeline-scheduler-runner.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/auto-pipeline-scheduler-runner.js), [`lib/custom-storyboard-pipeline.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/custom-storyboard-pipeline.js), [`lib/recipe-campaign-ingest.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/recipe-campaign-ingest.js), [`lib/pillar-campaign-ingest.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/pillar-campaign-ingest.js)).
- [x] **V0-2**: Konsolidasikan & perluas filter klaim herbal/kesehatan ID+EN pada [`lib/tiktok-compliance-service.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/tiktok-compliance-service.js) (`HERBAL_MEDICAL_CLAIM_TOKENS_RE`, `STRICT_RAMUAN_CLAIM_TOKENS_RE`, serta helper ekspor `findVoClaimViolations`).
- [ ] **V0-3**: Terapkan keputusan pengguna untuk resolusi model Gemini tenant (`Opsi A` update `tenant_settings` dan/atau `Opsi B` smart routing override + ledger logging Multiplier di [`lib/gemini.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/gemini.js)). *(Catatan: audit read-only selesai; setting model & API key dibiarkan utuh sesuai aturan.)*
- [x] **V0-4**: Perbaiki bug `selected_vo_version` & sinkronisasi field VO revisi (`narration_transcript`/`voiceover`) + cek klaim pasca-audit pada [`lib/re-multiplier-worker.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js).
- [x] **Verifikasi V0**: Buat & jalankan unit test untuk flag parser/propagation, filter klaim terpusat, dan regression test fix Multiplier compliance (`tests/vo-v0-compliance-and-flags.test.mjs`).

### Fase V1 — Kontrak Konten di Content Planner + Prompt VO v2 (`vo_content_contract = 'on'`)
- [x] **V1-1**: Tambahkan kolom `content_payload_json` & `content_contract_json` pada `content_planner_rows` di [`lib/db-pg.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js).
- [x] **V1-2**: Buat [`lib/vo-content-payload.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/vo-content-payload.js) dan perbarui [`lib/content-planner-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/content-planner-engine.js) + [`lib/content-planner-contract.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/content-planner-contract.js) agar menyusun & menyimpan `content_payload_json` (termasuk `needs_data`, `clip_plan` >5 klip, & filter klaim herbal) serta fallback 1-call Content Editor di [`lib/scheduler-processors.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js).
- [x] **V1-3**: Perbarui [`app/api/content-planner/[id]/rows/[rowId]/route.js`](file:///Users/sabeqmmursyid/_cfstudio/app/api/content-planner/%5Bid%5D/rows/%5BrowId%5D/route.js) & UI [`app/content-planner/[id]/page.js`](file:///Users/sabeqmmursyid/_cfstudio/app/content-planner/%5Bid%5D/page.js) agar `search_answer` dan `takeaways` (`content_payload_json`) bisa dilihat dan diedit manual per baris.
- [x] **V1-4**: Teruskan `content_payload` dari planner ke `row_creative_payload` di [`lib/pillar-campaign-ingest.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/pillar-campaign-ingest.js), serta set `narrative_mode = 'Tips/Tutorial'` pada Keyword Editorial (`vo_content_contract = 'on'`) di [`lib/autonomous-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/autonomous-engine.js) (`tests/vo-v1-content-payload.test.mjs` lulus 6/6).
- [x] **V1-5**: Implementasikan blok kontrak VO bahasa-sadar (`id-ID` dan `en-US`/Habitfolk) + `clip_plan` (>5 klip) + `Tips/Tutorial` mode & `KONTRAK RESEP SUMBER` secara terpusat di [`lib/prompts.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js) (`buildOrganicPillarPrompt`, `buildMultiplierPhase2Prompt`) serta integrasikan `on_screen_amounts` -> `finishing_plan` pada [`lib/re-multiplier-worker.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js) dan [`lib/finishing-plan-validator.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-plan-validator.js).
- [x] **Verifikasi V1**: Buat & jalankan snapshot test [`tests/vo-contract-prompt-snapshot.test.mjs`](file:///Users/sabeqmmursyid/_cfstudio/tests/vo-contract-prompt-snapshot.test.mjs) (`off` vs `on` byte-exact, `id-ID` vs `en-US`, `target_clips_count > 5`, dan Multiplier `KONTRAK RESEP SUMBER` — lulus 5/5).

### Fase V2 — Validator & Quality Gate (`vo_quality_gate = 'warn' | 'enforce'`)
- [x] **V2-1**: Buat [`lib/vo-quality-validator.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/vo-quality-validator.js) berisi `validateVoQuality` & `evaluateAndGateVoQuality` (menyatukan aturan `score.py`, `wmax`, `VAGUE`/`MARK`, `CLAIM`, `clip_count`, Keyword `search_answer` Klip 2, `source_recipe_lock` bahan, dan `en-US` hype check) + helper 1-call auto-rewrite `rewriteVoWithQualityFeedback`.
- [x] **V2-2**: Pasang validator + gate (`warn` vs `enforce`) pada worker OPC & Recipe OPC ([`lib/scheduler-processors.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js) dan [`lib/recipe-production-adapter.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/recipe-production-adapter.js)), termasuk fallback 1-call `result_json.content_payload` serta penjedaan `workflow_status = 'waiting_approval'` (`review_state = 'vo_quality_blocked'`) saat `enforce` tetap gagal setelah 1x rewrite.
- [x] **V2-3**: Pasang validator + gate (`warn` vs `enforce`) pada worker Multiplier ([`lib/re-multiplier-worker.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js)) sebelum masuk `'generating_t2i'` / `'generating_audio'`.
- [x] **V2-4**: Tambahkan cross-check klaim & konsistensi angka terhadap VO pada [`lib/finishing-plan-validator.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-plan-validator.js) (`validateFinishingOverlayAgainstVo`).
- [x] **Verifikasi V2**: Unit test validator (`pass`, `warn`, `enforce` rewrite pass, `enforce` hard-block stop) pada [`tests/vo-v4-quality-validator.test.mjs`](file:///Users/sabeqmmursyid/_cfstudio/tests/vo-v4-quality-validator.test.mjs) (lulus 4/4).

### Fase V3 — Hook, Closing, & Kepatuhan Jumlah Klip
- [x] **V3-1**: Terapkan filter anti-klaim & anti-klise khusus kalimat Hook + pencegahan pengulangan kata pembuka klip berurutan & >1 penanda transisi di `lib/vo-quality-validator.js` dan prompt builder (`lib/prompts.js`).
- [x] **V3-2**: Terapkan aturan penutup non-template (CTA spesifik dari kontrak, tolak *"Yuk coba sekarang"* / *"Don't walk, run"*) serta kewajiban schema `clip_plan` per klip bila `target_clips_count > 5`.
- [x] **Verifikasi V3**: Uji unit test `target_clips_count = 7` / mismatch klip, penolakan klaim, penolakan closing template generik, dan Multiplier `source_recipe_lock` (lulus di [`tests/vo-contract-prompt-snapshot.test.mjs`](file:///Users/sabeqmmursyid/_cfstudio/tests/vo-contract-prompt-snapshot.test.mjs) & [`tests/vo-v4-quality-validator.test.mjs`](file:///Users/sabeqmmursyid/_cfstudio/tests/vo-v4-quality-validator.test.mjs)).

### Fase V4 — Observabilitas, Laporan Per Brand, & UI Review
- [x] **V4-1**: Tambahkan kolom `vo_quality_score_json JSONB` dan `vo_quality_status TEXT` pada tabel `pillar_campaign_items` & `re_multiplier_tasks` di [`lib/db-pg.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js) dan simpan hasilnya dari worker OPC/Recipe/Multiplier.
- [x] **V4-2**: Buat endpoint agregasi mingguan per brand [`GET /api/v2/analytics/vo-quality`](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/analytics/vo-quality/route.js), endpoint aksi [`POST /api/v2/vo-quality/rewrite`](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/vo-quality/rewrite/route.js), dan MCP tool `cf_get_vo_quality_report` di [`apps/mcp/tools.mjs`](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/tools.mjs).
- [x] **V4-3**: Tampilkan badge status/skor VO, rincian alasan gagal, dan tombol `"Perbaiki VO Otomatis"` (berbasis token CSS `app/theme.css`) di [`app/pillar-campaigns/[id]/page.js`](file:///Users/sabeqmmursyid/_cfstudio/app/pillar-campaigns/%5Bid%5D/page.js) & [`app/multiplier-lab/[id]/page.js`](file:///Users/sabeqmmursyid/_cfstudio/app/multiplier-lab/%5Bid%5D/page.js).
- [x] **Verifikasi V4**: Unit test agregasi laporan mingguan per brand lulus di [`tests/vo-v4-quality-validator.test.mjs`](file:///Users/sabeqmmursyid/_cfstudio/tests/vo-v4-quality-validator.test.mjs) *(verifikasi visual UI manual oleh pengguna setelah deploy Staging sesuai SOP)*.

### Fase V5 — Kelengkapan Data Produk & Langkah Resep
- [x] **V5-1**: Tambahkan kolom `cara_pakai TEXT`, `takaran_label TEXT`, `penyimpanan TEXT`, `rasa_tekstur TEXT`, & `fakta_produksi TEXT` di tabel `product_extractions` ([`lib/db-pg.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js)), allowlist [`lib/product-repository.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/product-repository.js), validasi [`lib/product-validation.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/product-validation.js), endpoint [`app/api/v2/products/[id]/route.js`](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/products/%5Bid%5D/route.js), dan UI modal [`app/products/ProductDatabaseModal.js`](file:///Users/sabeqmmursyid/_cfstudio/app/products/ProductDatabaseModal.js).
- [x] **V5-2**: Hubungkan `cara_pakai`, `takaran_label`, `penyimpanan`, `rasa_tekstur`, & `fakta_produksi` ke `productInstruction` / konteks produk di [`lib/prompts.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js), [`lib/scheduler-processors.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js), dan [`lib/re-multiplier-worker.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js), dan laporkan `needs_data` pada produk yang masih kosong tanpa mengarang angka (termasuk Garlibee `pe_1793545394035_6698`).
- [x] **V5-3**: Perketat aturan parameter langkah resep (suhu/api, durasi menit/detik, takaran bahan terukur, tanda visual/sensorik matang, larangan filler transisi) di [`lib/content-format-constants.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/content-format-constants.js), [`lib/prompts.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js), dan [`lib/recipe-production-adapter.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/recipe-production-adapter.js).
- [x] **Verifikasi Final Unit Test**: Jalankan seluruh suite test `tests/vo-*.test.mjs`, `npm run test:operator-presets`, dan `npm run build` *(uji A/B live Staging `harness.mjs` / `score.py` dijalankan bertahap setelah preset uji diaktifkan manual oleh operator)*.

---

## 1. Detail Perubahan Fase V0 — Fondasi, Flag, Filter Klaim, & Audit Model

### 1.1. File Baru: `lib/vo-contract-registry.js` *(V0-1)*
**Tujuan**: Single source of truth untuk `vo_content_contract` dan `vo_quality_gate` (serupa dengan [`lib/finishing-template-registry.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-template-registry.js)).

**Code Sebelum (Current/Before)**:
*File baru — belum ada modul terpusat; tiap preset/worker hanya mengenal `finishing_template`, `caption_mode`, `loudness_target`.*

**Code Sesudah (Proposed/After)**:
```js
export const VO_CONTENT_CONTRACTS = Object.freeze(['off', 'on']);
export const VO_QUALITY_GATES = Object.freeze(['off', 'warn', 'enforce']);
export const DEFAULT_VO_CONTENT_CONTRACT = 'off';
export const DEFAULT_VO_QUALITY_GATE = 'off';

export function normalizeVoContentContract(value, fallback = DEFAULT_VO_CONTENT_CONTRACT) {
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  const normalized = String(value ?? '').trim().toLowerCase();
  if (VO_CONTENT_CONTRACTS.includes(normalized)) return normalized;
  return VO_CONTENT_CONTRACTS.includes(fallback) ? fallback : DEFAULT_VO_CONTENT_CONTRACT;
}

export function normalizeVoQualityGate(value, fallback = DEFAULT_VO_QUALITY_GATE) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (VO_QUALITY_GATES.includes(normalized)) return normalized;
  return VO_QUALITY_GATES.includes(fallback) ? fallback : DEFAULT_VO_QUALITY_GATE;
}

export function parseVoSettingsFields(input = {}) {
  const result = {};
  const errors = [];
  if (input.vo_content_contract !== undefined) {
    const raw = String(input.vo_content_contract ?? '').trim().toLowerCase();
    if (!VO_CONTENT_CONTRACTS.includes(raw) && typeof input.vo_content_contract !== 'boolean') {
      errors.push('vo_content_contract harus bernilai off atau on');
    } else {
      result.vo_content_contract = normalizeVoContentContract(input.vo_content_contract);
    }
  }
  if (input.vo_quality_gate !== undefined) {
    const raw = String(input.vo_quality_gate ?? '').trim().toLowerCase();
    if (!VO_QUALITY_GATES.includes(raw)) {
      errors.push('vo_quality_gate harus bernilai off, warn, atau enforce');
    } else {
      result.vo_quality_gate = normalizeVoQualityGate(input.vo_quality_gate);
    }
  }
  return { values: result, errors };
}

export function resolveEffectiveVoSettings({ overrides = {}, campaign = {}, preset = {} } = {}) {
  const wf = preset?.workflow || {};
  return {
    vo_content_contract: normalizeVoContentContract(
      overrides.vo_content_contract ?? campaign.vo_content_contract ?? wf.vo_content_contract,
      DEFAULT_VO_CONTENT_CONTRACT
    ),
    vo_quality_gate: normalizeVoQualityGate(
      overrides.vo_quality_gate ?? campaign.vo_quality_gate ?? wf.vo_quality_gate,
      DEFAULT_VO_QUALITY_GATE
    )
  };
}
```

### 1.2. Skema PostgreSQL: `lib/db-pg.js` *(V0-1, V1-1, V4-1, V5-1)*
**Code Sebelum (Current/Before)** — [`lib/db-pg.js#L317-L330`](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js#L317-L330), [`#L1087-L1103`](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js#L1087-L1103), [`#L1989-L2006`](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js#L1989-L2006):
```js
          ALTER TABLE pillar_campaigns
            ADD COLUMN IF NOT EXISTS caption_mode TEXT,
            ADD COLUMN IF NOT EXISTS finishing_template TEXT DEFAULT 'none',
            ADD COLUMN IF NOT EXISTS loudness_target DOUBLE PRECISION DEFAULT -14;
          ALTER TABLE re_campaigns
            ADD COLUMN IF NOT EXISTS caption_mode TEXT,
            ADD COLUMN IF NOT EXISTS finishing_template TEXT DEFAULT 'none',
            ADD COLUMN IF NOT EXISTS loudness_target DOUBLE PRECISION DEFAULT -14,
            ADD COLUMN IF NOT EXISTS enable_motion_text INTEGER DEFAULT 1,
...
```

**Code Sesudah (Proposed/After)**:
Tambahkan blok migrasi idempoten baru `migrateVoNarrationUpgrade()` di `lib/db-pg.js` untuk mencakup seluruh kolom V0–V5 secara terstruktur:
```js
    const migrateVoNarrationUpgrade = async () => {
      try {
        await pool.query(`
          ALTER TABLE pillar_campaigns
            ADD COLUMN IF NOT EXISTS vo_content_contract TEXT DEFAULT 'off',
            ADD COLUMN IF NOT EXISTS vo_quality_gate TEXT DEFAULT 'off';
          ALTER TABLE re_campaigns
            ADD COLUMN IF NOT EXISTS vo_content_contract TEXT DEFAULT 'off',
            ADD COLUMN IF NOT EXISTS vo_quality_gate TEXT DEFAULT 'off';
          ALTER TABLE pillar_campaign_items
            ADD COLUMN IF NOT EXISTS vo_quality_score_json JSONB,
            ADD COLUMN IF NOT EXISTS vo_quality_status TEXT;
          ALTER TABLE re_multiplier_tasks
            ADD COLUMN IF NOT EXISTS vo_quality_score_json JSONB,
            ADD COLUMN IF NOT EXISTS vo_quality_status TEXT;
          ALTER TABLE content_planner_rows
            ADD COLUMN IF NOT EXISTS content_contract_json JSONB;
          ALTER TABLE product_extractions
            ADD COLUMN IF NOT EXISTS cara_pakai TEXT,
            ADD COLUMN IF NOT EXISTS fakta_produksi TEXT;
        `);
      } catch (err) {
        console.warn('[PostgreSQL Auto-Migration Warning] VO Narration Upgrade:', err.message);
      }
    };
    migrateVoNarrationUpgrade();
```

### 1.3. Persistensi Campaign: `lib/db.js` *(V0-1)*
**Code Sebelum (Current/Before)** — [`lib/db.js#L2285-L2315`](file:///Users/sabeqmmursyid/_cfstudio/lib/db.js#L2285-L2315), [`#L2369-L2371`](file:///Users/sabeqmmursyid/_cfstudio/lib/db.js#L2369-L2371), [`#L1264-L1301`](file:///Users/sabeqmmursyid/_cfstudio/lib/db.js#L1264-L1301), [`#L1342-L1344`](file:///Users/sabeqmmursyid/_cfstudio/lib/db.js#L1342-L1344):
```js
    caption_mode: campaign.caption_mode !== undefined ? campaign.caption_mode : 'hybrid',
    finishing_template: campaign.finishing_template || 'none',
    loudness_target: campaign.loudness_target !== undefined ? Number(campaign.loudness_target) : -14
  };
```

**Code Sesudah (Proposed/After)**:
Tambahkan `vo_content_contract` (default `'off'`) dan `vo_quality_gate` (default `'off'`) pada `createPillarCampaign`, `updatePillarCampaign` (`allowed`), `createReCampaign`, `updateReCampaign` (`allowed`), serta tambahkan `vo_quality_score_json`, `vo_quality_status` pada whitelist `updatePillarCampaignItem` & `updateMultiplierTask`.
```js
    caption_mode: campaign.caption_mode !== undefined ? campaign.caption_mode : 'hybrid',
    finishing_template: campaign.finishing_template || 'none',
    loudness_target: campaign.loudness_target !== undefined ? Number(campaign.loudness_target) : -14,
    vo_content_contract: campaign.vo_content_contract === 'on' ? 'on' : 'off',
    vo_quality_gate: ['off', 'warn', 'enforce'].includes(campaign.vo_quality_gate) ? campaign.vo_quality_gate : 'off'
```

### 1.4. Preset, UI Presets, API, MCP, & Ingest Forwarding *(V0-1)*
Daftar file yang menerima penerusan identik (`vo_content_contract`, `vo_quality_gate`) menggunakan `resolveEffectiveVoSettings` / `parseVoSettingsFields` dari [`lib/vo-contract-registry.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/vo-contract-registry.js):

1. [`lib/operator-presets.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/operator-presets.js):
   - **Sebelum**: Blok `workflow` berisi `finishing_template: 'none'`, `caption_mode: 'hybrid'`, `loudness_target: -14`.
   - **Sesudah**: Tambahkan `vo_content_contract: 'off'`, `vo_quality_gate: 'off'` di default `workflow` preset.
2. [`app/settings/presets/page.js`](file:///Users/sabeqmmursyid/_cfstudio/app/settings/presets/page.js):
   - **Sebelum**: Section Finishing Pass menampilkan input `finishing_template`, `caption_mode`, `loudness_target`.
   - **Sesudah**: Tambahkan 2 `<select>` untuk `VO Content Contract` (`off` / `on`) dan `VO Quality Gate` (`off` / `warn` / `enforce`) dengan token semantik `var(--input-bg)`, `var(--border-subtle)`, `var(--text-primary)` dari `app/theme.css`.
3. [`app/api/v2/operator-presets/[key]/route.js`](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/operator-presets/%5Bkey%5D/route.js) & [`app/api/v2/pillar-campaigns/[id]/route.js`](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/pillar-campaigns/%5Bid%5D/route.js):
   - **Sebelum**: Memvalidasi field workflow finishing saja saat PUT/PATCH.
   - **Sesudah**: Panggil `parseVoSettingsFields(body.workflow || body)` — tolak nilai invalid (HTTP `400`) dan simpan nilai tervalidasi.
4. [`apps/mcp/tools.mjs`](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/tools.mjs):
   - **Sebelum**: Input schema `cf_create_product_video`, `cf_create_campaign`, `cf_create_editorial_video`, `cf_create_recipe_video`, `cf_create_multiplier_video`, `cf_create_preset`, `cf_update_preset` hanya mengekspos `finishing_template`, `caption_mode`, `loudness_target`.
   - **Sesudah**: Ekspos properti opsional `vo_content_contract` (`enum: ['off', 'on']`) & `vo_quality_gate` (`enum: ['off', 'warn', 'enforce']`) dan teruskan via `overrides` / `workflow`.
5. **Orkestrator & Ingest Pipeline** (`lib/autonomous-engine.js`, `lib/auto-pipeline-scheduler-runner.js`, `lib/custom-storyboard-pipeline.js`, `lib/recipe-campaign-ingest.js`, `lib/pillar-campaign-ingest.js`):

   **Code Sebelum — [`lib/autonomous-engine.js#L586-L593`](file:///Users/sabeqmmursyid/_cfstudio/lib/autonomous-engine.js#L586-L593)** *(Product Campaign; pola serupa ada di `#L268-L292`, `#L799-L805`, `#L923-L928`, `#L1130-L1138`)*:
   ```js
    finishing_template: overrides?.finishing_template ?? presetConfig?.workflow?.finishing_template ?? 'none',
    caption_mode: overrides?.caption_mode ?? presetConfig?.workflow?.caption_mode ?? 'hybrid',
    loudness_target: Number(overrides?.loudness_target !== undefined ? overrides.loudness_target : (presetConfig?.workflow?.loudness_target !== undefined ? presetConfig.workflow.loudness_target : -14)),
    ffmpeg_video_scale: Number(presetConfig?.workflow?.ffmpeg_video_scale || 1.0),
   ```

   **Code Sesudah — [`lib/autonomous-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/autonomous-engine.js)**:
   ```js
    finishing_template: overrides?.finishing_template ?? presetConfig?.workflow?.finishing_template ?? 'none',
    caption_mode: overrides?.caption_mode ?? presetConfig?.workflow?.caption_mode ?? 'hybrid',
    loudness_target: Number(overrides?.loudness_target !== undefined ? overrides.loudness_target : (presetConfig?.workflow?.loudness_target !== undefined ? presetConfig.workflow.loudness_target : -14)),
    ...resolveEffectiveVoSettings({ overrides, preset: presetConfig }),
    ffmpeg_video_scale: Number(presetConfig?.workflow?.ffmpeg_video_scale || 1.0),
   ```

   **Code Sebelum — [`lib/auto-pipeline-scheduler-runner.js#L218-L224`](file:///Users/sabeqmmursyid/_cfstudio/lib/auto-pipeline-scheduler-runner.js#L218-L224)**:
   ```js
    overrides: {
      ...(cfg.finishing_template !== undefined ? { finishing_template: cfg.finishing_template } : {}),
      ...(cfg.caption_mode !== undefined ? { caption_mode: cfg.caption_mode } : {}),
      ...(cfg.loudness_target !== undefined ? { loudness_target: cfg.loudness_target } : {}),
      ...(cfg.overrides || {})
    },
   ```

   **Code Sesudah — [`lib/auto-pipeline-scheduler-runner.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/auto-pipeline-scheduler-runner.js)**:
   ```js
    overrides: {
      ...(cfg.finishing_template !== undefined ? { finishing_template: cfg.finishing_template } : {}),
      ...(cfg.caption_mode !== undefined ? { caption_mode: cfg.caption_mode } : {}),
      ...(cfg.loudness_target !== undefined ? { loudness_target: cfg.loudness_target } : {}),
      ...(cfg.vo_content_contract !== undefined ? { vo_content_contract: cfg.vo_content_contract } : {}),
      ...(cfg.vo_quality_gate !== undefined ? { vo_quality_gate: cfg.vo_quality_gate } : {}),
      ...(cfg.overrides || {})
    },
   ```

   **Code Sebelum — [`lib/custom-storyboard-pipeline.js#L261-L263`](file:///Users/sabeqmmursyid/_cfstudio/lib/custom-storyboard-pipeline.js#L261-L263) & [`#L459-L462`](file:///Users/sabeqmmursyid/_cfstudio/lib/custom-storyboard-pipeline.js#L459-L462)**:
   ```js
  const finishingTemplate = rawDna.finishing_template || pWorkflow.finishing_template || 'none';
  const captionMode = rawDna.caption_mode || pWorkflow.caption_mode || 'hybrid';
  const loudnessTarget = Number(rawDna.loudness_target ?? pWorkflow.loudness_target ?? -14);
   ```

   **Code Sesudah — [`lib/custom-storyboard-pipeline.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/custom-storyboard-pipeline.js)**:
   ```js
  const finishingTemplate = rawDna.finishing_template || pWorkflow.finishing_template || 'none';
  const captionMode = rawDna.caption_mode || pWorkflow.caption_mode || 'hybrid';
  const loudnessTarget = Number(rawDna.loudness_target ?? pWorkflow.loudness_target ?? -14);
  const { vo_content_contract: voContentContract, vo_quality_gate: voQualityGate } = resolveEffectiveVoSettings({ overrides: rawDna, preset: { workflow: pWorkflow } });
  // ... diteruskan ke createPillarCampaign({ ..., vo_content_contract: voContentContract, vo_quality_gate: voQualityGate })
   ```

   **Code Sebelum — [`lib/recipe-campaign-ingest.js#L123-L125`](file:///Users/sabeqmmursyid/_cfstudio/lib/recipe-campaign-ingest.js#L123-L125) & [`lib/pillar-campaign-ingest.js#L312-L314`](file:///Users/sabeqmmursyid/_cfstudio/lib/pillar-campaign-ingest.js#L312-L314)**:
   ```js
      finishing_template: globalSettings.finishing_template || 'none',
      caption_mode: globalSettings.caption_mode || 'hybrid',
      loudness_target: globalSettings.loudness_target !== undefined ? Number(globalSettings.loudness_target) : -14,
   ```

   **Code Sesudah — [`lib/recipe-campaign-ingest.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/recipe-campaign-ingest.js) & [`lib/pillar-campaign-ingest.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/pillar-campaign-ingest.js)**:
   ```js
      finishing_template: globalSettings.finishing_template || 'none',
      caption_mode: globalSettings.caption_mode || 'hybrid',
      loudness_target: globalSettings.loudness_target !== undefined ? Number(globalSettings.loudness_target) : -14,
      ...resolveEffectiveVoSettings({ overrides: globalSettings }),
   ```

---

### 1.5. Filter Klaim Herbal/Kesehatan Terpusat: `lib/tiktok-compliance-service.js` *(V0-2)*
**Code Sebelum (Current/Before)** — [`lib/tiktok-compliance-service.js#L258-L261`](file:///Users/sabeqmmursyid/_cfstudio/lib/tiktok-compliance-service.js#L258-L261):
```js
const HERBAL_MEDICAL_CLAIM_TOKENS_RE = /\b(kolesterol|kolestrol|cholesterol|jantung|heart\s+disease|gula\s+darah|blood\s+sugar|diabetes|diabet|hipertensi|hypertension|darah\s+tinggi|asam\s+urat|kanker|cancer|tumor|stroke|wasir|ambeien|maag|lambung\s+akut|obat|medicine|mengobati|menyembuhkan|cure|terapi\s+penyakit|diagnosa|resep\s+dokter)\b/i;
const STRICT_RAMUAN_CLAIM_TOKENS_RE = /\b(lemak|metabolisme|metabolism|detoks|detox|ginjal|kidney|visceral|luntur\s+lemak|membakar\s+lemak|melangsingkan|menguruskan|pelangsing|perut\s+buncit|turun\s+berat)\b/i;
```

**Code Sesudah (Proposed/After)**:
```js
export const VO_HERBAL_MEDICAL_CLAIM_TOKENS_RE = /\b(kolesterol|kolestrol|cholesterol|jantung|heart\s+disease|gula\s+darah|blood\s+sugar|diabetes|diabet|hipertensi|hypertension|darah\s+tinggi|asam\s+urat|kanker|cancer|tumor|stroke|wasir|ambeien|maag|lambung\s+akut|paru-?paru|lungs|imun|immune|obat|medicine|mengobati|menyembuhkan|sembuh|cure|terapi\s+penyakit|diagnosa|resep\s+dokter)\b/i;
export const STRICT_RAMUAN_CLAIM_TOKENS_RE = /\b(lemak\s+visceral|visceral\s+fat|bakar\s+lemak|burn\s+fat|rontokkan\s+lemak|luntur\s+lemak|membakar\s+lemak|lemak|metabolisme|metabolism|detoks|detox|racun|toxins?|ginjal|kidney|visceral|melangsingkan|menguruskan|pelangsing|perut\s+buncit|turun\s+berat)\b/i;

export function findVoClaimViolations(text = '', { strict = true } = {}) {
  const source = String(text || '');
  if (!source.trim()) return [];
  const matches = new Set();
  const baseGlobal = new RegExp(VO_HERBAL_MEDICAL_CLAIM_TOKENS_RE.source, 'gi');
  for (const m of source.matchAll(baseGlobal)) matches.add(m[0].toLowerCase());
  if (strict) {
    const strictGlobal = new RegExp(STRICT_RAMUAN_CLAIM_TOKENS_RE.source, 'gi');
    for (const m of source.matchAll(strictGlobal)) matches.add(m[0].toLowerCase());
  }
  return Array.from(matches);
}
```
*(Catatan: `isHerbalMedicalClaimPhrase(text, strict)` & `auditScriptForTikTok()` di file yang sama langsung memanggil regex dan `resolveIsHerbalProduct` di atas agar hanya ada 1 sumber aturan di seluruh aplikasi.)*

---

### 1.6. Perbaikan Bug Auto-Audit Compliance Multiplier: `lib/re-multiplier-worker.js` *(V0-4)*
**Code Sebelum (Current/Before)** — [`lib/re-multiplier-worker.js#L607-L639`](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js#L607-L639) dan `L728–L741`:
- `auditScriptForTikTok(fullOriginalVo, captionText)` mengisi `voice_over` dan `tiktok_safe_voiceover` hasil revisi, tetapi menyimpan `selected_vo_version: 'original'`.
- Sementara itu, loop TTS ([`lib/re-multiplier-worker.js#L904`](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js#L904)) membaca `storyboard[c].narration_transcript || storyboard[c].voiceover || ''` sehingga VO aman TikTok tidak konsisten antara DB, UI (`clip.narration`), dan audio TTS.

**Code Sesudah (Proposed/After)**:
```js
const revisedLine = auditResult?.revised_script?.[idx];
const safeText = (typeof revisedLine === 'string' && revisedLine.trim())
  ? revisedLine.trim()
  : (scene.narration_transcript || scene.voiceover || '');

// Sinkronkan field narasi & ubah versi terpilih ke tiktok_safe bila ada revisi
const hasRevision = auditResult?.status === 'REVISE' || (typeof revisedLine === 'string' && revisedLine.trim() !== (scene.narration_transcript || scene.voiceover || '').trim());
if (hasRevision) {
  scene.voice_over = safeText;
  scene.tiktok_safe_vo = safeText;
  scene.narration_transcript = safeText;
  scene.voiceover = safeText;
}
// Setelah audit LLM selesai, verifikasi ulang pakai filter klaim terpusat
const remainingClaims = findVoClaimViolations(safeText, { strict: resolveIsHerbalProduct({ product: prodContext, caption: captionText }) });
...
selected_vo_version: hasRevision ? 'tiktok_safe' : 'original',
compliance_remaining_claims: remainingClaims
```

### 1.7. Resolusi Model Gemini (Opsi B Kode): `lib/gemini.js` *(V0-3 — Menunggu Keputusan Opsi A/B)*
**Code Sebelum (Current/Before)** — [`lib/gemini.js#L116-L144`](file:///Users/sabeqmmursyid/_cfstudio/lib/gemini.js#L116-L144) & [`#L372-L391`](file:///Users/sabeqmmursyid/_cfstudio/lib/gemini.js#L372-L391):
- `isCreativeTask` mengembalikan `savedPrimary.trim()` sebelum mengevaluasi `MODULE_MODEL_MATRIX` (`gemini-3.6-flash`).
- `getGeminiModel()` dipakai oleh Multiplier tanpa `taskType` matrix dan tanpa pencatatan `recordAiTokenUsage` ke `ai_token_usage_ledger`.

**Code Sesudah (Proposed/After — bila Opsi B disetujui)**:
```js
const matrixTarget = MODULE_MODEL_MATRIX[normalizedTask] || MODULE_MODEL_MATRIX.CREATIVE;
const smartRoutingEnabled = (savedSmartRouting || 'on').toLowerCase() === 'on';
// Cegah downgrade task kreatif ke model flash-lite / 2.5 ketika Smart Routing aktif
const isWeakSavedModel = /^(gemini-2\.|.*flash-lite)/i.test(String(savedPrimary || ''));
if (smartRoutingEnabled && isCreativeTask && matrixTarget && isWeakSavedModel) {
  return matrixTarget; // e.g., 'gemini-3.6-flash'
}
```
Dan di `makeModelResilient()` / `getGeminiModel()`: terima `taskType` / `featureName` opsional agar generasi Multiplier juga tercatat pada `ai_token_usage_ledger`.

---

## 2. Detail Perubahan Fase V1 — Kontrak Konten Planner & Prompt VO v2 (`vo_content_contract = 'on'`)

### 2.1. Kontrak Konten pada Planner Engine: `lib/content-planner-engine.js` *(V1-2)*
**Code Sebelum (Current/Before)** — [`lib/content-planner-engine.js#L720-L735`](file:///Users/sabeqmmursyid/_cfstudio/lib/content-planner-engine.js#L720-L735), [`#L842-L861`](file:///Users/sabeqmmursyid/_cfstudio/lib/content-planner-engine.js#L842-L861), [`#L948-L968`](file:///Users/sabeqmmursyid/_cfstudio/lib/content-planner-engine.js#L948-L968):
- Call 1 Skeleton & Call 2 Creative belum meminta field terstruktur `content_contract`.
- Baris ~950 meng-hardcode `'Storytelling'` pada kolom `narrative_mode` di row insert meskipun sudut konten bersifat edukatif.

**Code Sesudah (Proposed/After)**:
1. Tambahkan skema JSON `content_contract` pada prompt Call 2 Creative (`#L796-L861`):
   ```json
   "content_contract": {
     "angle": "Satu sudut pembahasan spesifik yang fokus & berbeda antar baris",
     "hook": "1 kalimat pendek pembuka (maks 12 kata, bebas klaim medis & klikbait klise)",
     "key_points": ["Poin fakta/mekanisme 1", "Poin fakta/langkah 2"],
     "target_claim": "Manfaat fungsional aman tanpa klaim menyembuhkan penyakit",
     "proof_point": "Angka/fakta konkret dari data produk (atau 'NEEDS_DATA' bila tidak ada di input)",
     "cta": "Ajakan alami terkait langkah/tindakan spesifik",
     "needs_data": false
   }
   ```
2. Hitung `resolvedNarrativeMode` berbasis `row.narrative_mode || autoDetectNarrativeMode(row)` (dari `lib/pillar-campaign-ingest.js`) daripada hardcode `'Storytelling'`.
3. Simpan `JSON.stringify(contentContract)` ke kolom `content_contract_json` pada query `INSERT INTO content_planner_rows` (`#L895-L968`) serta perbarui di `regeneratePlannerRow()` (`#L1025+`).

### 2.2. API & UI Edit `content_contract_json`: Planner Row *(V1-3)*
1. [`app/api/content-planner/[id]/rows/[rowId]/route.js`](file:///Users/sabeqmmursyid/_cfstudio/app/api/content-planner/%5Bid%5D/rows/%5BrowId%5D/route.js):
   - **Sebelum**: PATCH hanya menerima field dasar (`hook`, `visual_action`, `strategic_angle`, dll.).
   - **Sesudah**: Izinkan PATCH `content_contract_json` (validasi JSON object dengan `angle`, `hook`, `key_points`, `target_claim`, `proof_point`, `cta`, `needs_data`) dan simpan ke PostgreSQL.
2. [`app/content-planner/[id]/page.js`](file:///Users/sabeqmmursyid/_cfstudio/app/content-planner/%5Bid%5D/page.js#L892-L960):
   - **Sebelum**: Kolom Strategic Angle & Hook hanya menampilkan string tunggal tanpa melihat `proof_point` / status `needs_data`.
   - **Sesudah**: Tampilkan lencana `NEEDS DATA` (`var(--status-warning-soft)` / `var(--status-warning)`) saat `content_contract_json.needs_data === true` serta drawer/editor inline untuk mengedit `proof_point`, `key_points`, dan `cta` langsung dari tabel planner.

### 2.3. Propagasi `content_contract` & Jalur Keyword Editorial *(V1-4)*
1. [`lib/pillar-campaign-ingest.js#L317-L410`](file:///Users/sabeqmmursyid/_cfstudio/lib/pillar-campaign-ingest.js#L317-L410):
   - **Sebelum**: `row_creative_payload` berisi `hook`, `visual_action`, `strategic_angle`, `product`, `narrative_mode`, tanpa `content_contract`.
   - **Sesudah**: Parse `row.content_contract_json` secara aman dan sematkan ke `rowCreativePayload.content_contract`, plus pertahankan `narrative_mode` dari baris (`row.narrative_mode || autoDetectNarrativeMode(row)`).
2. [`lib/autonomous-engine.js#L729-L815`](file:///Users/sabeqmmursyid/_cfstudio/lib/autonomous-engine.js#L729-L815) (`executeAutonomousEditorialPipeline`):
   - **Sebelum**: Keyword Editorial menghasilkan planner/campaign item tanpa `content_contract` terstruktur.
   - **Sesudah**: Ketika `vo_content_contract === 'on'`, bangun `content_contract` default pada tiap item Keyword Editorial (`angle`, `hook`, `key_points`, `proof_point`, `cta`) dan sertakan pada `row_creative_payload`.

### 2.4. Prompt VO v2 Bahasa-Sadar (`id-ID` & `en-US`): `lib/prompts.js` & `lib/recipe-production-adapter.js` *(V1-5)*
**Code Sebelum (Current/Before)** — [`lib/prompts.js#L2921-L2934`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js#L2921-L2934), [`#L2993-L3011`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js#L2993-L3011), [`#L3691-L3694`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js#L3691-L3694), [`#L3826-L3854`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js#L3826-L3854), dan [`lib/recipe-production-adapter.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/recipe-production-adapter.js):
- Prompt VO membolehkan gaya puitis/metaforis longgar, belum memisahkan aturan `id-ID` vs `en-US` (Habitfolk), belum membawa kontrak `proof_point` / `needs_data`, dan belum memaksa `clip_plan` saat `target_clips_count > 5`.

**Code Sesudah (Proposed/After)**:
Buat satu fungsi pembangun blok prompt bersama `buildVoContentContractBlock({ voContentContract, targetLanguage, contentContract, targetClips, wordsPerClip, isHerbal, productMeta })` di [`lib/prompts.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js) yang disuntikkan ke:
- `buildPillarSharedPromptContext()` / `buildOrganicPillarPrompt()` (`vo_content_contract === 'on'`)
- `buildMultiplierPhase2Prompt()` (`vo_content_contract === 'on'`)
- `processRecipeCampaignCreative()` di [`lib/recipe-production-adapter.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/recipe-production-adapter.js)

Isi blok aturan ketika `vo_content_contract === 'on'`:
- **Mode `off`**: Kembalikan string kosong `""` (100% mempertahankan perilaku lama — diuji oleh snapshot test).
- **Aturan Universal (`on`)**:
  - Maksimal kata/klip sesuai `wordsPerClip` (hard ceiling mis. `19` kata untuk 8s, `11` kata untuk 4s/5s); maksimal **1 klausa utama** per kalimat VO.
  - Maksimal **1 metafora** per seluruh video.
  - **Anti-Fabrikasi (`needs_data`)**: Hanya boleh menyebut angka/takaran/durasi/fakta yang tertulis di `productMeta` atau `contentContract.proof_point`. Dilarang keras mengarang klaim klinis/statistik.
  - Jika `targetClips > 5`: wajib sertakan `clip_plan` eksplisit bernomor `1..N` (`clip_index`, `role`, `required_fact`, `max_words`) dan wajib output tepat `N` klip (tidak boleh menyusut jadi 4–5 klip).
- **Aturan `id-ID`**:
  - Dilarang 15 kata klise/kabur (`rahasia`, `tersembunyi`, `luar biasa`, `ajaib`, `dahsyat`, `ampuh`, `solusi tepat`, `sempurna`, `maksimal`, `optimal`, `alami 100%`, `mengubah hidup`, `terbukti ilmiah`, `wajib punya`, dll.) dan 7 pembuka filler (`Apakah kamu tahu`, `Tahukah kamu`, `Ternyata`, `Faktanya`, `Jujur ya`, `Percaya deh`, `Bayangkan`).
  - Khusus produk herbal/ramuan (`isHerbal`): terapkan daftar larangan klaim medis dari `lib/tiktok-compliance-service.js`.
- **Aturan `en-US` (Habitfolk & akun EN)**:
  - Dilarang frasa AI TikTok berulang (`"I just found"`, `"it literally feels"`, `"no gatekeeping"`, `"total game-changer"`, `"don't walk, run"`, `"run, don't walk"`, `"you need this"`, `"changed my life"`).
  - Wajib menyertakan minimal **1 mekanisme/ukuran konkret** (durasi, dimensi, bahan, suhu, atau langkah mikro nyata) dan **1 contoh perilaku spesifik** yang bisa langsung divisualisasikan.

---

## 3. Detail Perubahan Fase V2 — Validator & Quality Gate (`vo_quality_gate = 'warn' | 'enforce'`)

### 3.1. File Baru: `lib/vo-quality-validator.js` *(V2-1, V3-1, V3-2)*
Menyatukan logika scoring dari [`plans/vo-narasi-reference/score.py`](file:///Users/sabeqmmursyid/_cfstudio/plans/vo-narasi-reference/score.py), cek token dari [`plans/vo-narasi-reference/newprompts.mjs`](file:///Users/sabeqmmursyid/_cfstudio/plans/vo-narasi-reference/newprompts.mjs), dan `findVoClaimViolations()` dari [`lib/tiktok-compliance-service.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/tiktok-compliance-service.js):

```js
import { findVoClaimViolations } from './tiktok-compliance-service.js';

export const BANNED_CLICHE_PHRASES_ID = Object.freeze([
  'rahasia', 'tersembunyi', 'luar biasa', 'ajaib', 'dahsyat', 'ampuh',
  'solusi tepat', 'sempurna', 'maksimal', 'optimal', 'alami 100%',
  'tanpa efek samping', 'mengubah hidup', 'terbukti ilmiah', 'wajib punya'
]);

export const BANNED_FILLER_MARKERS_ID = Object.freeze([
  'apakah kamu tahu', 'tahukah kamu', 'ternyata', 'faktanya',
  'jujur ya', 'percaya deh', 'bayangkan'
]);

export const BANNED_AI_PHRASES_EN = Object.freeze([
  'i just found', 'it literally feels', 'no gatekeeping',
  'total game-changer', "don't walk, run", "run, don't walk",
  'you need this', 'changed my life', 'secret hack'
]);

export const TEMPLATED_CLOSINGS_RE = /\b(yuk coba sekarang|jangan lupa klik keranjang|buruan checkout sekarang|klik link di bio sekarang|don't walk,? run|link in bio)\b/i;

export function extractNormalizedVoClips(source = {}) {
  if (Array.isArray(source.voiceover) && source.voiceover.length > 0) {
    return source.voiceover.map((v, i) => ({
      clip_index: Number(v.scene || v.clip_index || i + 1),
      text: String(v.narration || v.narration_transcript || v.voiceover || v.text || '').trim()
    }));
  }
  const cp = source.content_payload || source.remake_storyboard_json || source.storyboard || [];
  if (Array.isArray(cp) && cp.length > 0) {
    return cp.map((c, i) => ({
      clip_index: Number(c.clip_index || c.scene || i + 1),
      text: String(c.narration_transcript || c.voiceover || c.new_vo || c.narration || '').trim()
    }));
  }
  return [];
}

export function validateAndScoreVo({
  clips = [],
  expectedClipCount = 4,
  maxWordsPerClip = 19,
  language = 'id-ID',
  isHerbal = false,
  contentContract = null,
  productMeta = null,
  mandatoryOutroLine = ''
} = {}) {
  // Hitung wmax, NUM, SPEC, VAGUE, MARK, CLAIM (via findVoClaimViolations),
  // EN AI-isms, kesesuaian jumlah klip, repetisi hook, & penutup template.
  // Kembalikan:
  // { status: 'pass' | 'warn' | 'fail', score: 0..100, metrics: { wmax, num, spec, vague, mark, claim, clip_count_ok, hook_ok, closing_ok }, reasons: [...] }
}

export async function rewriteVoWithQualityFeedback({
  model,
  clips,
  report,
  contentContract,
  language,
  productMeta,
  maxWordsPerClip
}) {
  // 1-call targeted rewrite hanya memperbaiki klip/poin pada report.reasons tanpa mengubah struktur scene.
}
```

### 3.2. Integrasi Validator + Gate pada Worker OPC, Recipe OPC, & Multiplier *(V2-2, V2-3)*

1. **OPC (`lib/scheduler-processors.js` — [`processPillarGenerator`](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js#L5745-L5765))**:
   - **Sebelum**: Setelah `parsed` dihasilkan, worker langsung masuk `auditScriptForTikTok` (bila `enable_vo_audit === 1`) lalu lanjut ke T2I (`shouldRunT2i`) dan `workflow_status = 'production_processing'`. Jika `parsed.voiceover` kosong pada beberapa struktur lama, `content_payload` belum diekstrak ulang.
   - **Sesudah**:
     - Setelah parsing `parsed` (dan compliance audit bila aktif), resolusikan flag efektif `voSettings = resolveEffectiveVoSettings({ campaign, preset })`.
     - Jika `voSettings.vo_quality_gate !== 'off'`, ekstrak klip menggunakan `extractNormalizedVoClips(parsed)` (memperbaiki fallback `result_json.content_payload` bila `parsed.voiceover` kosong) dan jalankan `validateAndScoreVo(...)`.
     - Simpan `vo_quality_score_json` dan `vo_quality_status` pada item (`updatePillarCampaignItem`).
     - Jika `vo_quality_gate === 'warn'`: catat skor/warning, lanjutkan pipeline seperti biasa.
     - Jika `vo_quality_gate === 'enforce'` dan `report.status === 'fail'`: jalankan **1 kali** `rewriteVoWithQualityFeedback()`, perbarui `parsed.voiceover` / `newVideoPlan`, dan validasi ulang. Jika **masih gagal**, set:
       ```js
       await updatePillarCampaignItem(item.id, {
         generation_status: 'completed',
         workflow_status: 'waiting_approval',
         review_state: 'vo_quality_blocked',
         review_reason: `VO Quality Gate gagal: ${recheck.reasons.join('; ')}`,
         vo_quality_score_json: JSON.stringify(recheck),
         vo_quality_status: recheck.status
       });
       return { processed: true, item_id: item.id, blocked_by_vo_gate: true };
       ```
       Dengan return lebih awal sebelum T2I/G-Labs, item berhenti di `waiting_approval` dan **tidak masuk ContentFlow maupun Repliz Auto-Publish**.

2. **Recipe OPC (`lib/recipe-production-adapter.js` — `processRecipeCampaignCreative`)**:
   - **Sebelum**: Memvalidasi panjang array JSON, lalu langsung meloloskan VO ke item.
   - **Sesudah**: Gunakan pola gate identik (`validateAndScoreVo` + cek langkah resep V5) sebelum menyimpan status akhir item; dalam mode `enforce`, lakukan 1x rewrite dan tahan di `waiting_approval` bila tetap gagal.

3. **Multiplier (`lib/re-multiplier-worker.js` — [`processMultiplierRemake`](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js#L715-L750))**:
   - **Sebelum**: Setelah remake + compliance audit, task berpindah status mengikuti approval/audio tanpa validasi kualitas VO.
   - **Sesudah**: Baca `voSettings` dari `audioConfig` / `vsoConfig` / preset. Jalankan `validateAndScoreVo` terhadap storyboard VO **setelah** fix compliance `selected_vo_version`. Simpan `vo_quality_score_json` dan `vo_quality_status`. Jika `vo_quality_gate === 'enforce'` dan tetap gagal setelah 1x rewrite -> paksa `status = 'waiting_approval'` (`error_message` berisi ringkasan kegagalan) dan jangan lanjut ke `'generating_audio'`.

### 3.3. Cross-Check Overlay Finishing: `lib/finishing-plan-validator.js` *(V2-4)*
**Code Sebelum (Current/Before)** — [`lib/finishing-plan-validator.js#L1-L260`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-plan-validator.js#L1-L260):
- Sudah memiliki `hasVoTokenGrounding` dan `isHerbalMedicalClaimPhrase`, tetapi belum memanggil `findVoClaimViolations` secara seragam saat produk bersifat herbal/kesehatan atau memblokir angka overlay yang bertentangan dengan VO akhir.

**Code Sesudah (Proposed/After)**:
- Impor dan panggil `findVoClaimViolations(line, { strict: isHerbal })` pada `validateTipsList()` dan validasi badge/hook overlay agar overlay finishing 100% sinkron dan tidak memasukkan kembali klaim yang sudah dibersihkan dari VO.

---

## 4. Detail Perubahan Fase V3 — Hook, Closing, & Kepatuhan Jumlah Klip

1. **Hook Compliance & Anti-Duplikasi** ([`lib/vo-quality-validator.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/vo-quality-validator.js) + [`lib/prompts.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js)):
   - Hook (klip #1) diperiksa terhadap `findVoClaimViolations`, pembuka filler (`BANNED_FILLER_MARKERS_ID` / `BANNED_AI_PHRASES_EN`), serta kemiripan kalimat (>70% token overlap terhadap batch kampanye yang sama).
2. **Penutup Non-Template**:
   - Aturan prompt + validator menolak penutup berulang `TEMPLATED_CLOSINGS_RE` kecuali eksplisit berasal dari `mandatory_outro_line` preset/brand; CTA harus selaras dengan `content_contract.cta`.
3. **Kepatuhan Jumlah Klip >5 (`clip_plan`)**:
   - Pada `buildOrganicPillarPrompt`, `buildMultiplierPhase2Prompt`, Keyword Editorial (`lib/autonomous-engine.js`), dan `lib/recipe-production-adapter.js`: saat `target_clips_count > 5`, skema output menyertakan array wajib `clip_plan` sebanyak tepat `target_clips_count` item sebelum penulisan naskah VO per klip, dan validator menjatuhkan hard-fail (`enforce`) jika `clips.length !== expectedClipCount`.

---

## 5. Detail Perubahan Fase V4 — Observabilitas, Laporan Per Brand, & UI Review

### 5.1. Endpoint Laporan Mingguan Per Brand & Rewrite *(V4-2)*
1. **File Baru `app/api/v2/analytics/vo-quality/route.js`**:
   - Query `GET` (dibungkus `withTenantContext`): agregasi 7 hari terakhir (atau parameter `days`) per `brand_profile_id` + `brand_name` atas tabel `pillar_campaign_items` JOIN `pillar_campaigns` dan `re_multiplier_tasks`, mengembalikan:
     - `total_generated`, `pass_count`, `warn_count`, `fail_count`, `avg_score`
     - `top_violations` (frekuensi `CLAIM`, `wmax`, `VAGUE`, `clip_count`, `EN_AI_PHRASE`)
     - `recent_blocked_items` (maks 20 item terbaru untuk ditinjau operator).
2. **File Baru `app/api/v2/vo-quality/rewrite/route.js`**:
   - Endpoint `POST` menerima `{ source_type: 'opc' | 'multiplier', item_id }` (dengan `withTenantContext`), memanggil `rewriteVoWithQualityFeedback` + `validateAndScoreVo` untuk item tersebut, dan memperbarui `result_json`/`new_video_plan_json`/`remake_storyboard_json` serta `vo_quality_score_json` dan `vo_quality_status`.
3. **MCP Tool `cf_get_vo_quality_report` di [`apps/mcp/tools.mjs`](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/tools.mjs)**:
   - Memanggil agregasi yang sama agar operator/agen dapat meninjau performa VO per brand mingguan dari terminal/MCP.

### 5.2. UI Review OPC & Multiplier *(V4-3)*
Mengikuti SOP Semantic CSS Tokens (`var(--status-success-soft)`, `var(--status-warning-soft)`, `var(--status-danger-soft)`, `var(--surface-interactive)`, `var(--border-subtle)`, `var(--action-primary)`, `var(--on-action-primary)`):

1. **[`app/pillar-campaigns/[id]/page.js#L2200-L2216`](file:///Users/sabeqmmursyid/_cfstudio/app/pillar-campaigns/%5Bid%5D/page.js#L2200-L2216)**:

   **Code Sebelum (Current/Before)**:
   ```jsx
        {/* TikTok Safe Compliance Report & VO Selector */}
        {campaign.enable_vo_audit === 1 && item.compliance_status && (
          <div style={{
            background: 'var(--bg-glass)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
   ```

   **Code Sesudah (Proposed/After)**:
   ```jsx
        {/* VO Quality Gate Report */}
        {item.vo_quality_status && (() => {
          let voReport = null;
          try { voReport = typeof item.vo_quality_score_json === 'string' ? JSON.parse(item.vo_quality_score_json) : item.vo_quality_score_json; } catch (_) {}
          return (
            <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>VO Quality Gate: {item.vo_quality_status.toUpperCase()} ({voReport?.score ?? '-'}/100)</strong>
                {item.vo_quality_status !== 'pass' && (
                  <button type="button" onClick={() => handleAutoRewriteVo(item.id)} style={{ background: 'var(--action-primary)', color: 'var(--on-action-primary)', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>
                    ♻️ Perbaiki VO Otomatis
                  </button>
                )}
              </div>
              {Array.isArray(voReport?.reasons) && voReport.reasons.length > 0 && (
                <ul style={{ margin: '8px 0 0 18px', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                  {voReport.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}
            </div>
          );
        })()}

        {/* TikTok Safe Compliance Report & VO Selector */}
        {campaign.enable_vo_audit === 1 && item.compliance_status && (
   ```

2. **[`app/multiplier-lab/[id]/page.js#L2008-L2028`](file:///Users/sabeqmmursyid/_cfstudio/app/multiplier-lab/%5Bid%5D/page.js#L2008-L2028)**:

   **Code Sebelum (Current/Before)**:
   ```jsx
                                    {/* Action buttons */}
                                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
                                      <button
                                        type="button"
                                        className="btn btn-secondary"
                                        disabled={actionLoading[task.id]}
                                        onClick={() => handleSaveChanges(task.id)}
                                      >
                                        💾 Simpan Perubahan
                                      </button>
                                      {task.status === 'waiting_approval' && (
   ```

   **Code Sesudah (Proposed/After)**:
   ```jsx
                                    {/* Action buttons */}
                                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: 16, marginTop: 16 }}>
                                      {task.vo_quality_status && task.vo_quality_status !== 'pass' && (
                                        <button
                                          type="button"
                                          className="btn btn-secondary"
                                          disabled={actionLoading[task.id]}
                                          onClick={() => handleAutoRewriteMultiplierVo(task.id)}
                                        >
                                          ♻️ Perbaiki VO Otomatis
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        className="btn btn-secondary"
                                        disabled={actionLoading[task.id]}
                                        onClick={() => handleSaveChanges(task.id)}
                                      >
                                        💾 Simpan Perubahan
                                      </button>
                                      {task.status === 'waiting_approval' && (
   ```

---

## 6. Detail Perubahan Fase V5 — Kelengkapan Data Produk & Langkah Resep

### 6.1. Repository, API, & Modal Produk: `cara_pakai` & `fakta_produksi` *(V5-1)*
1. **[`lib/product-repository.js#L5-L20`](file:///Users/sabeqmmursyid/_cfstudio/lib/product-repository.js#L5-L20)**:

   **Code Sebelum (Current/Before)**:
   ```js
   export const PRODUCT_IMPORT_COLUMNS = Object.freeze([
     'id', 'input_source', 'is_url', 'product_name', 'product_description',
   ...
     'photo_error', 'enrichment_error', 'enrichment_reviewed_at',
     'photo_reviewed_at', 'normalized_source_url', 'raw_photo_sha256'
   ]);
   ```

   **Code Sesudah (Proposed/After)**:
   ```js
   export const PRODUCT_IMPORT_COLUMNS = Object.freeze([
     'id', 'input_source', 'is_url', 'product_name', 'product_description',
     'cara_pakai', 'fakta_produksi',
   ...
     'photo_error', 'enrichment_error', 'enrichment_reviewed_at',
     'photo_reviewed_at', 'normalized_source_url', 'raw_photo_sha256'
   ]);
   ```

2. **[`app/api/v2/products/[id]/route.js`](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/products/%5Bid%5D/route.js)**:
   - **Sebelum**: Allowlist PUT hanya memproses field produk lama.
   - **Sesudah**: Teruskan `'cara_pakai'` dan `'fakta_produksi'` ke `updateProduct()`.

3. **[`app/products/ProductDatabaseModal.js#L36-L42`](file:///Users/sabeqmmursyid/_cfstudio/app/products/ProductDatabaseModal.js#L36-L42), [`#L84-L90`](file:///Users/sabeqmmursyid/_cfstudio/app/products/ProductDatabaseModal.js#L84-L90), [`#L195-L201`](file:///Users/sabeqmmursyid/_cfstudio/app/products/ProductDatabaseModal.js#L195-L201), [`#L640-L664`](file:///Users/sabeqmmursyid/_cfstudio/app/products/ProductDatabaseModal.js#L640-L664)**:

   **Code Sebelum (Current/Before)**:
   ```jsx
    unique_selling_point: product?.unique_selling_point || product?.usp || '',
    clean_photo_t2i_prompt: product?.clean_photo_t2i_prompt || '',
   ...
        unique_selling_point: formData.unique_selling_point.trim() || null,
        clean_photo_t2i_prompt: formData.clean_photo_t2i_prompt.trim() || null,
   ```

   **Code Sesudah (Proposed/After)**:
   Tambahkan `cara_pakai` dan `fakta_produksi` pada `formData`, hydrate `GET /api/v2/products/${activeProductId}`, `productPayload`, serta render 2 `<textarea>` dengan token `var(--input-bg)`, `var(--border-subtle)`, `var(--text-primary)` tepat di bawah blok USP:
   ```jsx
    unique_selling_point: product?.unique_selling_point || product?.usp || '',
    cara_pakai: product?.cara_pakai || '',
    fakta_produksi: product?.fakta_produksi || '',
    clean_photo_t2i_prompt: product?.clean_photo_t2i_prompt || '',
   ```

### 6.2. Pemakaian Data Produk & Parameter Langkah Resep Konkret *(V5-2, V5-3)*
1. [`lib/prompts.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js) (`productInstruction`) & [`lib/re-multiplier-worker.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js):
   - Suntikkan `cara_pakai` dan `fakta_produksi` ke konteks produk. Jika keduanya kosong, tandai `product_needs_cara_pakai = true` / `needs_data = true` agar LLM **dilarang mengarang** cara penyajian maupun detail proses produksi (termasuk untuk Garlibee `pe_1793545394035_6698` sampai waktu minum, air hangat, & profil rasa-tekstur diisi user).
2. [`lib/prompts.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/prompts.js), [`lib/recipe-production-adapter.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/recipe-production-adapter.js), [`lib/finishing-data-extractor.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/finishing-data-extractor.js):
   - Untuk kampanye resep (`food_culinary` / `generate_recipe`): tiap klip langkah memasak wajib menyertakan minimal 1 parameter numerik (`°C`/`°F`, `menit`/`detik`/`mins`, atau takaran bahan) plus 1 petunjuk visual/sensorik perubahan tekstur/warna, dan validator menolak kalimat transisi kosong tanpa aksi memasak ketika `vo_content_contract === 'on'`.

---

## 7. Strategi Verifikasi & Pengujian Bertahap (Safety Gate per Fase)

1. **Per Fase (V0–V5)**:
   - Jalankan unit test spesifik per modul dengan key mock non-sensitif (mematuhi SOP Zero Secret Exposure).
   - Pada V1, wajib lulus [`tests/vo-contract-prompt-snapshot.test.mjs`](file:///Users/sabeqmmursyid/_cfstudio/tests/vo-contract-prompt-snapshot.test.mjs) guna membuktikan flag default `off` tidak mengubah prompt/perilaku produksi saat ini sedikit pun.
2. **A/B Uji Coba Nyata pada Staging (Setelah seluruh Fase V0–V5 terpasang & disetujui deploy ke Staging)**:
   - Jalankan ulang benchmark menggunakan `node plans/vo-narasi-reference/harness.mjs` dan `python3 plans/vo-narasi-reference/score.py` terhadap 6 kasus referensi (Habitfolk EN, Garlibee Produk ID, Resep ID 6-klip, Keyword Editorial ID, Multiplier ID, & Custom Storyboard) untuk memverifikasi penurunan `VAGUE`, `MARK`, nol `CLAIM`, serta kepatuhan `wmax` dan jumlah klip.
   - Aktivasi bertahap hanya per **1–2 preset/brand uji coba** di Staging sambil memantau laporan mingguan `GET /api/v2/analytics/vo-quality` sebelum memperluas `vo_content_contract = 'on'` dan `vo_quality_gate = 'warn' -> 'enforce'`.

---

## 8. Tracker Koreksi Pasca-Audit `v2.45.1` (`fix/vo-v2451`)

- [x] **K1 — Flag Gate Content Editor Step di Content Planner** ([`lib/content-planner-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/content-planner-engine.js), [`lib/autonomous-engine.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/autonomous-engine.js)):
  - Ekstrak `runPlannerContentEditorStep()` dan selesaikan flag efektif lewat [`resolveEffectiveVoSettings()`](file:///Users/sabeqmmursyid/_cfstudio/lib/vo-contract-registry.js). Jika `vo_content_contract !== 'on'`, lakukan `0` Gemini call dan biarkan `content_payload_json = null`. Filter hook V0-2 tetap aktif untuk brand/produk herbal/kesehatan.
  - Propagasikan `vo_content_contract`, `vo_quality_gate`, dan `operator_preset_key` ke `createDraftContentPlanner()` di seluruh jalur `autonomous-engine.js`.
- [x] **K2 — Permukaan UI, Clear-on-Edit, dan Resume Alur Item Diblokir V0-2 & V4** ([`lib/vo-status-ui.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/vo-status-ui.js), [`app/api/v2/pillar-campaigns/items/[itemId]/voiceover/route.js`](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/pillar-campaigns/items/%5BitemId%5D/voiceover/route.js), [`lib/pillar-campaign-approval.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/pillar-campaign-approval.js), [`app/pillar-campaigns/[id]/page.js`](file:///Users/sabeqmmursyid/_cfstudio/app/pillar-campaigns/%5Bid%5D/page.js), [`app/pillar-campaigns/page.js`](file:///Users/sabeqmmursyid/_cfstudio/app/pillar-campaigns/page.js), [`app/api/v2/pillar-campaigns/route.js`](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/pillar-campaigns/route.js), [`app/api/v2/pillar-campaigns/[id]/route.js`](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/pillar-campaigns/%5Bid%5D/route.js), [`app/multiplier-lab/[id]/page.js`](file:///Users/sabeqmmursyid/_cfstudio/app/multiplier-lab/%5Bid%5D/page.js)):
  - Status `vo_claim_blocked`, `paused_compliance`, dan `vo_quality_blocked` kini tampil dengan label `🚫 Diblokir: klaim kesehatan` / `⚠️ VO di bawah standar`, alasan `review_reason` terlihat di row & detail/modal, naskah dapat diedit & disetujui, serta `PATCH .../voiceover` dan `approvePillarCampaignItem()` mereset `tts_status: 'pending'` dan membersihkan `review_state`/`review_reason`.
- [x] **K3 — Restorasi `autoDetectNarrativeMode()` saat `vo_content_contract` OFF** ([`lib/pillar-campaign-ingest.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/pillar-campaign-ingest.js)):
  - Saat `vo_content_contract` OFF, `autoDetectNarrativeMode()` hanya membaca `pillar`, `category_cep`, `vfo`, dan `strategic_angle` (identik dengan baseline `7e4d5b4`), tidak lagi ikut membaca `context` / `content_subject`.
- [x] **K4 — Penyeragaman & Penguatan Target Detektor Herbal/Kesehatan V0-2** ([`lib/tiktok-compliance-service.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/tiktok-compliance-service.js)):
  - Daftar keyword `HERBAL_HEALTH_TOKENS` dan `NON_HERBAL_PRODUCT_TOKENS` disatukan dengan substring match case-insensitive (tanpa `\b`) sehingga `'siasatsehat'`, `'Siasat Sehat'`, maupun `'Garlickys Bumbu Rempah Dapur'` terdeteksi, sementara produk cookware/alat dapur (`Oita Pengasah Pisau Dapur 4in1`) tidak false-positive meskipun bertag `'dapurbotani'`. Parameter `knowledgeDomain` dan `editorialPillars` ikut dihubungkan dari sumber yang sudah ada tanpa menambah kolom DB.
- [x] **K5 — Penyelarasan Dokumentasi Plan & Gate `bridging.finishing_plan`** ([`vo_narasi_implementation_plan.md`](file:///Users/sabeqmmursyid/_cfstudio/vo_narasi_implementation_plan.md), [`lib/tiktok-compliance-service.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/tiktok-compliance-service.js), [`lib/re-multiplier-worker.js`](file:///Users/sabeqmmursyid/_cfstudio/lib/re-multiplier-worker.js)):
  - Catatan perubahan scope: pada `v2.45.0`, fallback `bridging?.finishing_plan` di `resolvePreRenderFinishingMeta()` dan pengisian `bridging.finishing_plan` di `re-multiplier-worker.js` sempat aktif tanpa mengecek `vo_content_contract`. Pada `v2.45.1`, fallback dan pengisian `bridging.finishing_plan` dari V3 kini di-gate di `vo_content_contract === 'on'` dan didokumentasikan secara eksplisit di sini.
