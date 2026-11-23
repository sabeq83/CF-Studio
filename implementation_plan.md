# Implementation Plan: Blueprint–Product Smart Matcher & Kuota Harian 2+2 Video Multiplier

**Branch Kerja:** `fitur/smart-matcher-2plus2` *(dibuat dari `main` terbaru sesuai SOP Dev vs Staging)*  
**Rujukan Usulan:** [USULAN_SMART_MATCHER_DAN_KUOTA_2PLUS2_MULTIPLIER.md](catatan-kerja/usulan/USULAN_SMART_MATCHER_DAN_KUOTA_2PLUS2_MULTIPLIER.md)  
**Target Brand:** `nutribake` (`75` produk), `dapurbotani` (`135` produk), `siasatsehat` (`24` produk — termasuk 7 alat dapur yang baru ditautkan pengguna).  
**Target Kuota:** 4 video Multiplier/hari/brand = 12 video/hari (**2 Alat Dapur + 2 Bahan Resep**).

> [!IMPORTANT]
> **Kontrol Database & Deployment (SOP Wajib):**
> 1. Semua perubahan UI React/Next.js **dilarang** dikerjakan sebelum mockup interaktif `public/mockup_smart_matcher_2plus2.html` disinkronkan ke Staging (`http://100.95.245.55:5010/mockup_smart_matcher_2plus2.html`) dan direview pengguna.
> 2. Fitur mengubah struktur database (`promo_role` di `product_extractions` + tabel `blueprint_product_matches`), sehingga wajib diuji terlebih dahulu di **Dev (5020/7020)** sebelum naik ke `main`/Staging.
> 3. **Catatan Data Katalog:** 7 alat dapur eksisting (`pe_1780712278685`, `pe_1784449324420_841`, `pe_1781420171521_196`, `pe_1781360120731_877`, `pe_1795244192996_846`, `pe_1781420173223_989`, `pe_1782648834064_82`) sudah terkonfirmasi aktif pada ketiga brand, sementara `pe_1795092448042_8649` sudah terhapus. Sebanyak 30 alat dapur baru hasil Apify (`pe_1795430545113_749` s/d `pe_1795430743937_7057`) sudah berada di `default_tenant` dan dapat ikut ditautkan ke `brand_products` bila ingin masuk rotasi otomatis.

---

## Execution Task List

- [x] Buat branch `fitur/smart-matcher-2plus2` dari `main` terbaru
- [x] **Tahap 1 (Mockup UI)**: Buat mockup interaktif `public/mockup_smart_matcher_2plus2.html` (Deconstruct Lab filter & badge, Product Database `promo_role`, Multiplier/Auto Pipeline Smart Recommendations, Wizard Jadwal 2+2), sinkronkan ke Staging `5010`, dan minta review pengguna
- [x] **Tahap 2 (Skema DB)**: Tambah kolom `promo_role` di `product_extractions` + tabel indeks `blueprint_product_matches` di `lib/db-pg.js` dan backfill nilai awal `promo_role`
- [x] **Tahap 3 (Engine Matcher)**: Buat `lib/blueprint-product-matcher.js` (klasifikasi `promo_role`, ekstraksi aksi/bahan blueprint, penanda `is_food_safe`, skoring per brand, dan backfill 213 blueprint) + hook otomatis saat deconstruct selesai di `lib/scheduler-processors.js`
- [x] **Tahap 4 (API & Repo)**: Perluas `lib/product-repository.js`, `lib/product-catalog-service.js`, `lib/product-validation.js`, `app/api/v2/products/route.js`, `app/api/v2/products/[id]/route.js`, `lib/db.js`, `app/api/v2/deconstruct/route.js`, serta tambah `app/api/v2/deconstruct/matches/route.js`
- [x] **Tahap 5 (Autopilot 2+2 & MCP)**: Tambah mode `auto_smart_match` + `target_promo_role` (`alat_dapur`/`bahan_resep`) + anti-duplikat (14 hari blueprint, 4 hari produk) di `lib/auto-pipeline-scheduler-runner.js` & `lib/autonomous-engine.js`, serta perluas tool `apps/mcp/tools.mjs`
- [x] **Tahap 6 (UI React/Next.js — pasca persetujuan mockup)**: Implementasikan perubahan UI di `app/deconstruct/page.js`, `app/products/page.js`, `app/products/ProductDatabaseModal.js`, `app/components/campaign-forms/MultiplierConfigurationForm.js`, dan `app/auto-pipeline/page.js` (100% Semantic CSS Tokens)
- [ ] **Tahap 7 (Verifikasi & Deploy Dev)**: Tambah unit test `tests/blueprint-product-matcher.test.mjs`, jalankan `PG_SEARCH_PATH=dev node --test tests/blueprint-product-matcher.test.mjs`, `DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build`, backfill indeks di Dev, perbarui kartu menu di `sot/menus/kartu/`, push branch `fitur/smart-matcher-2plus2`, dan deploy ke **Dev (`5020/7020`)**

---

## Rincian Perubahan Kode (Before & After)

### 1. Skema Database (`lib/db-pg.js`)

**Code Sebelum (Current/Before)** *(baris 1173–1196 & 1942–1957)*:
```js
await client.query(`
  ALTER TABLE product_extractions
  ADD COLUMN IF NOT EXISTS page TEXT,
  ...
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
`);
await client.query(`CREATE INDEX IF NOT EXISTS idx_product_extractions_enrichment_status ON product_extractions(tenant_id, enrichment_status, created_at);`);
```
`product_extractions` belum memiliki kolom peran promosi (`promo_role`), dan belum ada tabel cache hasil pencocokan blueprint × produk.

**Code Sesudah (Proposed/After)**:
```js
await client.query(`
  ALTER TABLE product_extractions
  ADD COLUMN IF NOT EXISTS promo_role TEXT;
`);
await client.query(`
  CREATE INDEX IF NOT EXISTS idx_product_extractions_promo_role
  ON product_extractions(tenant_id, promo_role);
`);

await client.query(`
  CREATE TABLE IF NOT EXISTS blueprint_product_matches (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
    deconstruct_asset_id TEXT NOT NULL REFERENCES re_deconstructed_assets(id) ON DELETE CASCADE,
    brand_profile_id TEXT NOT NULL,
    product_id TEXT NOT NULL REFERENCES product_extractions(id) ON DELETE CASCADE,
    promo_role TEXT NOT NULL,
    match_score INTEGER NOT NULL DEFAULT 0,
    match_reason TEXT,
    matched_keywords_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_food_safe BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
await client.query(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_blueprint_product_matches_uniq
  ON blueprint_product_matches(tenant_id, deconstruct_asset_id, brand_profile_id, product_id);
`);
await client.query(`
  CREATE INDEX IF NOT EXISTS idx_blueprint_product_matches_lookup
  ON blueprint_product_matches(tenant_id, brand_profile_id, promo_role, is_food_safe, match_score DESC);
`);
```

---

### 2. Engine Klasifikasi & Pencocokan (`lib/blueprint-product-matcher.js` — *Baru*)

**Code Sebelum (Current/Before):**
Belum ada modul pencocokan blueprint × produk; hanya tersedia `lib/recipe-product-matcher-shared.js` khusus untuk topik resep (`scoreCatalogProductForRecipe`).

**Code Sesudah (Proposed/After):**
Membuat modul baru `lib/blueprint-product-matcher.js` (dengan helper pure JS yang juga aman di-import unit test & UI bila di-split ke `lib/blueprint-product-matcher-shared.js`):
1. `classifyProductPromoRole(product)`: mengembalikan `'alat_dapur' | 'bahan_resep' | 'lainnya'` berdasarkan kata kunci nama/kategori/tags, dengan menghormati `product.promo_role` jika sudah di-set manual.
2. `analyzeBlueprintProfile(asset)`: mengekstrak `methods` (mis. `blender`, `oven`, `steamer`, `kettle_rebus`, `skillet_pan`, `chopper`, `frother`, `saringan`, `pemeras`, `timbangan`, `parutan`, `wadah_kaca`), `ingredients` (`matcha`, `cocoa`, `oat`, `chia`, `kunyit`, `jahe`, `kayu_manis`, `madu`, `kopi`, `peanut_butter`, `yogurt`, `stevia`), serta `isFoodSafe` (`false` jika niche `Skincare` / `Home Care` / topik topikal luar).
3. `scoreBlueprintAgainstProduct(bpProfile, product, { brandId, hasCleanPhoto, hasProductTruth, hasBrandAffiliateLink })`: menghitung skor kecocokan `0–100` beserta `matchReason` singkat (contoh: `"Cocok aksi blender/jus + foto studio siap"`).
4. `indexBlueprintMatchesForAsset(assetId, tenantId)` & `backfillBlueprintProductMatches(tenantId)`: menghitung dan meng-upsert top-N kecocokan per `(brand_profile_id, promo_role)` ke `blueprint_product_matches`.
5. `pickNextSmartMatchPair({ tenantId, brandId, targetPromoRole = 'alat_dapur', lookbackBlueprintDays = 14, lookbackProductDays = 4 })`: memilih pasangan `(deconstruct_asset_id, product_id)` untuk kuota harian 2+2 dengan menghindari blueprint yang sudah terpakai dalam 14 hari terakhir dan produk yang sudah terpakai dalam 4 hari terakhir untuk brand tersebut.

---

### 3. Hook Otomatis Pasca-Dekonstruksi (`lib/scheduler-processors.js`)

**Code Sebelum (Current/Before)** *(baris 9986–10002)*:
```js
    await updateDeconstructAsset(asset.id, {
      original_storyboard_json: JSON.stringify(parsed.storyboard || []),
      product_ideas_json: JSON.stringify(parsed.product_ideas || {}),
      ...
      status: 'deconstructed',
      deconstructed_at: new Date(),
      error_message: null,
    });

    // Step 5: Update batch progress
    const progress = await updateDeconstructBatchProgress(asset.batch_id);
```

**Code Sesudah (Proposed/After)**:
```js
    await updateDeconstructAsset(asset.id, {
      original_storyboard_json: JSON.stringify(parsed.storyboard || []),
      product_ideas_json: JSON.stringify(parsed.product_ideas || {}),
      ...
      status: 'deconstructed',
      deconstructed_at: new Date(),
      error_message: null,
    });

    try {
      const { indexBlueprintMatchesForAsset } = await import('./blueprint-product-matcher.js');
      await indexBlueprintMatchesForAsset(asset.id, tenantId);
    } catch (matchErr) {
      console.warn(`[DECONSTRUCT] ${label} Smart matcher indexing warning:`, matchErr.message);
    }

    // Step 5: Update batch progress
    const progress = await updateDeconstructBatchProgress(asset.batch_id);
```

---

### 4. Product API, Repository & Katalog (`promo_role`)

**File terdampak:** `lib/product-repository.js`, `lib/product-validation.js`, `lib/product-catalog-service.js`, `app/api/v2/products/route.js`, `app/api/v2/products/[id]/route.js`.

**Code Sebelum (Current/Before)**:
- `lib/product-repository.js` baris 18–22: `PRODUCT_IMPORT_COLUMNS` tidak menyertakan `'promo_role'`.
- `app/api/v2/products/[id]/route.js` baris 136–148: `ALLOWED_UPDATE_FIELDS` tidak menyertakan `'promo_role'`.
- `lib/product-catalog-service.js` baris 53–88: `listProductCatalog` tidak memiliki filter `promoRole`.

**Code Sesudah (Proposed/After)**:
1. Tambahkan `'promo_role'` ke `PRODUCT_IMPORT_COLUMNS` dan `ALLOWED_UPDATE_FIELDS`.
2. Validasi `promo_role` di `validateSingleProductCreate` / `validateSingleProductUpdate` hanya menerima `['alat_dapur', 'bahan_resep', 'lainnya']` (atau `null` untuk auto-detect).
3. Saat `POST /api/v2/products` menyimpan produk baru tanpa `promo_role` eksplisit, isi otomatis via `classifyProductPromoRole(productData)`.
4. Tambah parameter query `promo_role` (`all | alat_dapur | bahan_resep | lainnya`) di `GET /api/v2/products` → `listProductCatalog({ ..., promoRole })`.

---

### 5. Deconstruct API & Endpoint Rekomendasi (`app/api/v2/deconstruct/route.js`, `lib/db.js`, `app/api/v2/deconstruct/matches/route.js`)

**Code Sebelum (Current/Before)** *(baris 18–75 `app/api/v2/deconstruct/route.js`)*:
```js
    if (searchParams.get('assets') === 'true') {
      const q = searchParams.get('q') || '';
      const niche = searchParams.get('niche') || '';
      const limit = Number(searchParams.get('limit') || 20);
      ...
      return NextResponse.json({ success: true, assets });
    }
```
Belum ada filter `brand_id` / `promo_role`, belum mengembalikan hitungan/rekomendasi produk cocok, dan belum ada endpoint backfill matcher.

**Code Sesudah (Proposed/After)**:
1. Perluas `GET /api/v2/deconstruct` (`?assets=true` dan `listDeconstructAssets` di `lib/db.js`) menerima parameter opsional `brand_id` dan `promo_role` (`alat_dapur | bahan_resep`) serta `include_matches=true` untuk melampirkan `match_summary` (jumlah alat dapur & bahan resep cocok per brand + top 5 `recommended_products` dengan `match_score` & `match_reason`).
2. Buat `app/api/v2/deconstruct/matches/route.js`:
   - `GET`: ambil top-match terstruktur untuk pasangan `(blueprint_id, brand_id, promo_role)` bagi UI Multiplier Labs & Auto Pipeline.
   - `POST`: jalankan `backfillBlueprintProductMatches(tenantId)` (atau untuk satu `blueprint_id` / satu `product_id` baru).

---

### 6. Autopilot Kuota 2+2 Harian (`lib/auto-pipeline-scheduler-runner.js`, `lib/autonomous-engine.js`, `app/api/v2/recipes/auto-pipeline-schedules/route.js`)

**Code Sebelum (Current/Before)** *(baris 135–163 `lib/auto-pipeline-scheduler-runner.js`)*:
```js
  if (pType === 'multiplier_campaign') {
    const cfg = pipelineConfig || {};
    const hasPairedProduct = Boolean(cfg.product_id) && cfg.bridging_mode !== 'none';

    return await executeAutonomousMultiplierPipeline({
      brandId: schedule.brand_id,
      deconstructAssetId: schedule.target_item_id || cfg.deconstruct_asset_id || cfg.blueprint_id || null,
      productId: hasPairedProduct ? cfg.product_id : null,
      ...
```

**Code Sesudah (Proposed/After)**:
```js
  if (pType === 'multiplier_campaign') {
    const cfg = pipelineConfig || {};
    const isSmartMatchMode = cfg.selection_mode === 'auto_smart_match';
    let resolvedBlueprintId = schedule.target_item_id || cfg.deconstruct_asset_id || cfg.blueprint_id || null;
    let resolvedProductId = cfg.product_id || null;
    let resolvedBridgingMode = cfg.bridging_mode || 'select_existing';

    if (isSmartMatchMode && (!resolvedBlueprintId || !resolvedProductId || cfg.product_id === 'auto')) {
      const { pickNextSmartMatchPair } = await import('./blueprint-product-matcher.js');
      const smartPair = await pickNextSmartMatchPair({
        tenantId,
        brandId: schedule.brand_id,
        targetPromoRole: cfg.target_promo_role || 'alat_dapur',
        lookbackBlueprintDays: Number(cfg.lookback_blueprint_days || 14),
        lookbackProductDays: Number(cfg.lookback_product_days || 4)
      });
      if (!smartPair?.deconstruct_asset_id || !smartPair?.product_id) {
        throw new Error(`Smart Matcher tidak menemukan pasangan blueprint + ${cfg.target_promo_role || 'produk'} yang memenuhi kuota anti-duplikat untuk brand ini.`);
      }
      resolvedBlueprintId = resolvedBlueprintId || smartPair.deconstruct_asset_id;
      resolvedProductId = smartPair.product_id;
      resolvedBridgingMode = 'select_existing';
    }

    const hasPairedProduct = Boolean(resolvedProductId) && resolvedBridgingMode !== 'none';
    return await executeAutonomousMultiplierPipeline({
      brandId: schedule.brand_id,
      deconstructAssetId: resolvedBlueprintId,
      productId: hasPairedProduct ? resolvedProductId : null,
      ...
```
Dan di `app/api/v2/recipes/auto-pipeline-schedules/route.js` tambahkan aksi opsional `{ action: 'setup_multiplier_2plus2_quota', brand_ids: [...], preset_key, ... }` (hanya membuat 4 slot recurring per brand bila diminta eksplisit pengguna; 42 jadwal lama tidak disentuh otomatis tanpa konfirmasi).

---

### 7. Dukungan MCP (`apps/mcp/tools.mjs`)

**Code Sebelum (Current/Before)** *(baris 1898–1931 & 1357–1373)*:
- `cf_list_deconstructed_assets` hanya menerima `{ q, niche, limit }`.
- `cf_search_blueprints` hanya menerima `{ query, niche, limit }`.
- `scheduleExtendedFields` hanya menerima `{ blueprint_id, deconstruct_asset_id, bridging_mode, ... }` tanpa `selection_mode` dan `target_promo_role`.

**Code Sesudah (Proposed/After)**:
1. Tambahkan parameter opsional `brand_id`, `promo_role: z.enum(['all', 'alat_dapur', 'bahan_resep']).optional()`, dan `include_matches: z.boolean().optional()` pada `cf_list_deconstructed_assets` & `cf_search_blueprints`.
2. Tambahkan `selection_mode: z.enum(['manual', 'auto_smart_match']).optional()` dan `target_promo_role: z.enum(['alat_dapur', 'bahan_resep', 'any']).optional()` ke `scheduleExtendedFields` serta teruskan ke `pipeline_config_json` saat membuat/mengubah jadwal.

---

### 8. Perubahan UI React/Next.js *(Hanya setelah review Mockup HTML di Staging `5010`)*

1. **`app/deconstruct/page.js`**: Tambah dropdown `Brand Fit` & `Jenis Bridging (Alat Dapur / Bahan Resep)`, serta kolom/badge ringkasan produk cocok pada baris tabel `assets.map(...)`.
2. **`app/products/ProductDatabaseModal.js` & `app/products/page.js`**: Tambah field pilihan `Peran Promosi (promo_role)` pada form edit/buat dan pill filter cepat `Alat Dapur` / `Bahan Resep` di daftar produk.
3. **`app/components/campaign-forms/MultiplierConfigurationForm.js`**: Tambah filter `Brand Fit` / `Jenis Bridging` di kartu blueprint (baris 1161) serta seksi **"⭐ Direkomendasikan untuk Blueprint Ini"** (Alat Dapur Cocok vs Bahan Resep Cocok) di pemilih produk (baris 1754).
4. **`app/auto-pipeline/page.js`**:
   - Tambah filter & ranking **"⭐ Rekomendasi Blueprint"** pada Instant Run (`baris 4304 & 4530`) dan Schedule Modal (`baris 7838 & 8060`).
   - Tambah opsi **"⚡ Auto Smart Match (Rotasi 2+2 Anti-Duplikat)"** pada modal jadwal Multiplier + tombol pembantu buat 4 slot harian (`06:15` Alat #1, `11:30` Bahan #1, `16:15` Alat #2, `19:30` Bahan #2).
   - Semua komponen wajib 100% memakai Semantic CSS Tokens dari `app/theme.css` tanpa hardcoded hex/rgb.

---

## Rencana Verifikasi

1. **Review Mockup HTML (Tahap 1):** Buka `http://100.95.245.55:5010/mockup_smart_matcher_2plus2.html` (Light & Dark Mode) bersama pengguna.
2. **Unit Test Backend (Tahap 7):**
   - `PG_SEARCH_PATH=dev node --test tests/blueprint-product-matcher.test.mjs` — menguji klasifikasi `promo_role`, deteksi `is_food_safe` (blokir Skincare/Home Care untuk NutriBake), skoring aksi/bahan, serta rotasi anti-duplikat 14 hari/4 hari.
3. **Build & Deploy Dev:**
   - `DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build`
   - `git push -u origin fitur/smart-matcher-2plus2`
   - `npm run deploy:dev:atomic -- --ref <full-git-sha> --apply --confirm-dev`
4. **Backfill & Smoke Test di Dev (`5020/7020`):**
   - Jalankan backfill 213+ blueprint di Dev dan cek komposisi match untuk `nutribake`, `dapurbotani`, dan `siasatsehat`.
