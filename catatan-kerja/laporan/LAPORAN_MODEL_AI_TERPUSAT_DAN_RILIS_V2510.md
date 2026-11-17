# Laporan Pelaksanaan: Model AI Terpusat di Settings & Rilis v2.51.0 (Staging 5010)

- **Tanggal**: 17 November 2026
- **Versi Rilis**: `v2.51.0`
- **Commit / Tag di `main`**: `9700eee917047c8de1d65ae241aa948efb47ca54` (`tag: v2.51.0`)
- **Lingkup Gabungan**: `fitur/hapus-instant-sheets` (`e731b1f`) + `fitur/model-ai-terpusat` (`09b2e06`, `4c7a3d3`) → digabung (`merge --no-ff`) ke `main`
- **Status Staging (`5010`/`7010`)**: `deployment_success=true`, `health=passed` (`release_id=20261117T123231Z-9700eee91704`)
- **Referensi Instruksi**:
  - [antigravity_ai_terpusat_TERPADU.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/instruksi-agent/antigravity_ai_terpusat_TERPADU.md)
  - [antigravity_model_ai_terpusat_instructions.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/instruksi-agent/antigravity_model_ai_terpusat_instructions.md)

---

## 1. Latar Belakang & Bukti Masalah Awal

1. Pada `lib/gemini.js`, `MODULE_MODEL_MATRIX` sebelumnya menimpa model dari Settings dengan nama model statis, sehingga tenant tier `paid` pada tugas ringan (`SCRAPER`, `OCR_EXTRACTION`) diarahkan ke `gemini-1.5-flash-8b` yang sudah mati (`404`).
2. Bukti nyata ditemukan di `staging.product_extractions` pada tenant **Mas Ibnu (`tnt_mas-ibnu_e0eb25`, `gemini_api_tier = paid`, `gemini_model_primary = gemini-3.8-flash`)**: 7 produk (*Rockwool Blanket*, *Rockwool Pipa*, *Busa Piramid Perdam Suara*, *Gypsum Akustik Sounerbel*, *Busa Peredam Telur*, *Gypsum Soundstop*, *Rockwool Slab Merk Rockwool*) gagal `404 models/gemini-1.5-flash-8b is not found`.
3. `lib/product-bulk-worker.js` memanggil `genAI.getGenerativeModel({ model: resolvedPrimary })` secara langsung tanpa `makeModelResilient`, dan kegagalan `503` (model sibuk) pada waterfall/key-pool selalu dibungkus pesan `QUOTA_EXHAUSTED`.
4. `executeWithKeyPool` masih menerima default `gemini_model_primary` saat pemanggil tidak mengirim `options.modelName`, serta beberapa file lain masih menulis nama model langsung (`app/api/v2/brand-profiles/extract/route.js`, `lib/threads-series-generator.js`, `lib/re-recomm-engine.js`, `lib/tenant-admin.js`, `lib/universe-ai-builder.js`, `lib/visual-identity-ai-builder.js`).

---

## 2. Ringkasan Implementasi

### 2.1 Satu Sumber Resolver & Rantai Cadangan (`lib/gemini.js`)
- Menambahkan `resolveModelChain({ role, taskType, modelOverride, explicitTier, explicitFallback })` dengan 3 peran yang membaca Settings tenant:
  - `primary`: `gemini_model_primary` (tugas kreatif: storyboard, naskah, OPC, RE, Multiplier, Recipe, Threads, YouTube Studio, Builder).
  - `light`: `gemini_model_light` (baru; bila kosong atau `gemini_smart_routing === 'off'`, memakai `primary`) untuk tugas kecil (`SCRAPER`, `PRODUCT_ENRICHMENT`, `OCR_EXTRACTION`, `BRAND_EXTRACTION`, `COMPLIANCE`, `COMPLIANCE_AUDIT`, `DECONSTRUCT`).
  - `vision`: `start_frame_visual_qc_model` (bila kosong, turun ke `light` lalu `primary`).
- Membangun `chain` bebas duplikat (`startModel → explicitFallback → gemini_model_fallback → gemini_model_primary → cascadePool`) dan menyaring `DEAD_GEMINI_MODELS` (`gemini-1.5-flash`, `gemini-1.5-flash-8b`).
- Membersihkan `MODULE_MODEL_MATRIX` sehingga hanya memetakan `{ role, useKB }`.
- Memperbarui `resolveModelForTask`, `getModelWaterfallChain`, `getResolvedGeminiModels` (termasuk dukungan argumen string seperti `'compliance_audit'`), `resolveStartFrameQcModel`, dan `generateWithImages` agar semuanya melalui `resolveModelChain`.
- Menambahkan `DEFAULT_TEXT_MODEL`, `DEFAULT_FALLBACK_MODEL`, `KNOWN_GEMINI_MODELS`, `createResilientGeminiModel`, dan `isRetryableGeminiError`.

### 2.2 Migrasi Pemanggil Langsung
- [lib/product-bulk-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-bulk-worker.js): `generateProductEnrichmentWithGemini` memakai `resolveModelChain({ role: 'light', taskType: 'PRODUCT_ENRICHMENT' })` + `createResilientGeminiModel` (`makeModelResilient`) di dalam `executeWithKeyPool`.
- [app/api/v2/products/[id]/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/products/%5Bid%5D/route.js): menambahkan field terhitung `enrichment_retryable` (`isRetryableGeminiError(product.enrichment_error)`) sehingga mengenali `MODEL_BUSY` maupun `QUOTA_EXHAUSTED`.
- [app/api/v2/brand-profiles/extract/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/brand-profiles/extract/route.js): migrasi dari `'gemini-2.5-flash'` langsung ke peran `light` (`BRAND_EXTRACTION`) + cadangan penuh.
- [lib/threads-series-generator.js](file:///Users/sabeqmmursyid/_cfstudio/lib/threads-series-generator.js): menghapus fallback tertulis `'gemini-2.5-flash'`, mengganti dengan `resolveModelChain({ role: 'primary', taskType: 'THREADS_SERIES' })` + `getGeminiModel` + `executeWithKeyPool`.
- [lib/re-recomm-engine.js](file:///Users/sabeqmmursyid/_cfstudio/lib/re-recomm-engine.js): mengganti `GEMINI_MODELS.PRIMARY` dan fallback manual `'gemini-flash-latest'` dengan loop REST berurutan mengikuti `resolveModelChain({ role: 'primary', taskType: 'RE_CAMPAIGN' })`.
- [lib/universe-ai-builder.js](file:///Users/sabeqmmursyid/_cfstudio/lib/universe-ai-builder.js), [lib/visual-identity-ai-builder.js](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-identity-ai-builder.js), [lib/universe-ai-repository.js](file:///Users/sabeqmmursyid/_cfstudio/lib/universe-ai-repository.js): mencatat `meta.model` sesuai model aktual yang berhasil (`result?.actualModel || resolved.model`).
- [lib/tenant-admin.js](file:///Users/sabeqmmursyid/_cfstudio/lib/tenant-admin.js): menghapus `gemini_model: 'gemini-2.5-flash'`; tenant baru menyalin konfigurasi model Gemini dari `default_tenant` lewat `buildProvisionTenantDefaultSettings`.
- [lib/scheduler-processors.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js), [app/api/keys/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/keys/route.js), [lib/db.js](file:///Users/sabeqmmursyid/_cfstudio/lib/db.js): menyatukan default `DEFAULT_POOL_MODEL` & pemanggil scheduler ke `resolveModelChain` / `DEFAULT_TEXT_MODEL`.

*(Di luar lingkup dan tidak diubah: model TTS `gemini-2.5-flash-preview-tts`, model gambar `lib/product-photo-providers/gemini.js`, `product_photo_gemini_model`, embedding, serta `staging.tenant_settings`).*

### 2.3 Pencatatan Kuota & Error `MODEL_BUSY` vs `QUOTA_EXHAUSTED`
- `executeWithKeyPool`, `makeModelResilient`, dan `executeContentGeneration` di [lib/gemini.js](file:///Users/sabeqmmursyid/_cfstudio/lib/gemini.js) melacak `poolCtx.lastModel`, mencatat pemakaian key ke model yang benar-benar dipanggil, dan melempar **`MODEL_BUSY (dapat diulang): model <x> sedang sibuk`** (`code: 'MODEL_BUSY'`, `retryable: true`, `status: 503`) bila seluruh percobaan gagal karena 503 — hanya 429 harian/kuota habis yang menghasilkan `QUOTA_EXHAUSTED`.

### 2.4 Menu Settings UI & Dokumentasi
- Mockup disetujui pengguna via [mockup_settings_model_ai.html](file:///Users/sabeqmmursyid/_cfstudio/public/mockup_settings_model_ai.html).
- [app/api/settings/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/settings/route.js) dan [app/settings/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/settings/page.js): menambah dropdown **"Model ringan (tugas kecil)"** (opsi default kosong *"Sama dengan model utama"*), dropdown **Model Cadangan Utama**, keterangan baru Smart Routing (*"Aktif: tugas kecil memakai Model ringan. Mati: semua memakai Model utama."*), serta menghapus model mati `gemini-1.5-flash-8b` dan `gemini-1.5-flash`.
- [app/reports/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/reports/page.js): mengganti `gemini-1.5-flash-8b` pada simulator biaya dengan `gemini-3.5-flash-lite`.
- Memperbarui kartu menu & peta menu ([settings.md](file:///Users/sabeqmmursyid/_cfstudio/sot/menus/kartu/settings.md), [products.md](file:///Users/sabeqmmursyid/_cfstudio/sot/menus/kartu/products.md), [auto-pipeline.md](file:///Users/sabeqmmursyid/_cfstudio/sot/menus/kartu/auto-pipeline.md), [_PETA_MENU.md](file:///Users/sabeqmmursyid/_cfstudio/sot/menus/_PETA_MENU.md)) serta [changelog.md](file:///Users/sabeqmmursyid/_cfstudio/sot/global/changelog.md) ke `V2.51.0`.

---

## 3. Tabel Dry-Run Model Sebelum → Sesudah (`staging`, Read-Only)

Dihasilkan oleh `node scripts/report-effective-gemini-models.mjs --schema staging` (seluruh baris `Model ringan` mengikuti `Model Utama` selama tenant belum mengisi `gemini_model_light`):

| Tenant | Tier | Smart Routing | Tugas | Model Sebelum | Model Sesudah | Status |
|---|---|---|---|---|---|---|
| **tnt_mas-ibnu_e0eb25 (Mas Ibnu)** | paid | on | Kampanye / Storyboard (`primary`) | `gemini-3.8-flash` | `gemini-3.8-flash` | Sama |
| **tnt_mas-ibnu_e0eb25 (Mas Ibnu)** | paid | on | Enrichment Produk (`light`) | `gemini-1.5-flash-8b` | **`gemini-3.8-flash`** | BERUBAH |
| **tnt_mas-ibnu_e0eb25 (Mas Ibnu)** | paid | on | Scraper Produk (`light`) | `gemini-1.5-flash-8b` | **`gemini-3.8-flash`** | BERUBAH |
| **tnt_mas-ibnu_e0eb25 (Mas Ibnu)** | paid | on | Compliance / Deconstruct (`light`) | `gemini-2.5-flash` | **`gemini-3.8-flash`** | BERUBAH |
| **tnt_mas-ibnu_e0eb25 (Mas Ibnu)** | paid | on | Ekstrak Brand Profile (`light`) | `gemini-2.5-flash` *(hardcoded)* | **`gemini-3.8-flash`** | BERUBAH |
| **tnt_mas-ibnu_e0eb25 (Mas Ibnu)** | paid | on | RE Grounding Sourcing (`primary`) | `gemini-3.6-flash` *(GEMINI_MODELS.PRIMARY)* | **`gemini-3.8-flash`** | BERUBAH |
| **tnt_mas-ibnu_e0eb25 (Mas Ibnu)** | paid | on | Start-Frame Visual QC (`vision`) | `gemini-3.6-flash` | **`gemini-3.8-flash`** | BERUBAH |
| `default_tenant` (Local Staging) | free | on | Tugas `light` / Brand / RE | `gemini-3.6-flash` / `2.5-flash` | **`gemini-3.5-flash-lite`** | BERUBAH |
| `tnt_pt-gim-sosmed_62d0d9` | free | on | Tugas `light` / RE / Vision QC | `gemini-3.6-flash` / `2.5-flash` | **`gemini-2.5-flash`** | BERUBAH |
| `tnt_sy-benu_415f99` | free | on | Ekstrak Brand / RE | `gemini-2.5-flash` / `3.6-flash` | **`gemini-3.6-flash`** | BERUBAH |
| `tnt_sy-dodot_4ba27b` | free | on | Ekstrak Brand / RE | `gemini-2.5-flash` / `3.6-flash` | **`gemini-3.6-flash`** | BERUBAH |
| `tnt_test_a_*` & `tnt_test_b_*` | paid(default) | on(default) | Enrichment & Scraper (`light`) | `gemini-1.5-flash-8b` | **`gemini-3.6-flash`** | BERUBAH |

---

## 4. Hasil Pengujian & Verifikasi Server

### 4.1 Tes Otomatis
- [gemini-model-resolver.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/gemini-model-resolver.test.js): **5/5 lulus** (`resolveModelChain`, waterfall 503 + `MODEL_BUSY`, kuota `executeWithKeyPool`, `buildProvisionTenantDefaultSettings`, dan penjaga `git grep`).
- [test-gemini-settings-precedence.mjs](file:///Users/sabeqmmursyid/_cfstudio/tests/test-gemini-settings-precedence.mjs): **3/3 lulus** (dijalankan pada tahap verifikasi backend sebelum pemasangan UI `app/settings/page.js`).
- `npm run test:mcp`: **11/11 lulus** (dijalankan ulang pasca-edit UI).
- `npm run test:product-catalog`: **lulus** (dijalankan ulang pasca-edit UI).
- Suite produk/scraper/eksperimen (`experiment-settings.test.js`, `product-photo-flow.test.js`, `product-photo-picker.test.js`, `product-scraper-tenant.test.js`, `start-frame-model-selection.test.js`, `youtube-start-frame-model.test.js`): **24/24 lulus** (dijalankan ulang pasca-edit UI).
- `npm run test:product-import`: **gagal** karena memerlukan `.env.staging.local`.

### 4.2 Uji Nyata Dev (`5020`/`7020`, `default_tenant`, SHA `09b2e066`)
- Enrichment produk uji (`Madu Herbal NutriTest`) berhasil `completed` pada `gemini-3.5-flash-lite`.
- Dengan `gemini_model_light` kosong (`primary = gemini-3.6-flash`), panggilan live yang mengalami `503` pada `gemini-3.6-flash` → `gemini-3.5-flash` → `gemini-3.7-flash` → `gemini-3.8-flash` otomatis berhasil `status=200 ok=true` pada `gemini-3.5-flash-lite`.
- Setelah mengubah `gemini_model_light` menjadi `gemini-2.5-flash`, log langsung menunjukkan `[GEMINI_CALL] ... model=gemini-2.5-flash ... status=200 ok=true`.
- Data produk & setting sementara uji Dev sudah dibersihkan kembali (`residual_test_products: 0`, `residual_light_setting: 0`).

### 4.3 Verifikasi Deploy Atomic Staging (`v2.51.0` / `9700eee9`)
- Build remote Next.js & aktivasi atomic Staging berhasil (`deployment_success=true`, `health=passed`).
- Symlink aktif: `current` → `/Users/masbenu/maknaflow-staging-atomic/releases/20261117T123231Z-9700eee91704`, dengan `.env.local`, `data`, `logs`, `public/uploads`, `public/temp` mengarah ke `shared/`.
- PM2: `maknaflow-staging-ui`, `maknaflow-staging-api`, dan `maknaflow-staging-mcp` berstatus `online` pada direktori release baru (`PG_SEARCH_PATH=staging`, `PGPOOL_MAX=3` pada UI dan API).
- HTTP endpoint: `/login` (`5010`) = `200`, `/settings` (`5010`) = `307`, `/health` (`7010`) = `200`, `/mockup_settings_model_ai.html` (`5010`) = `200`.
