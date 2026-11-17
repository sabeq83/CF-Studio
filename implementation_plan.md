# Implementation Plan: Model AI Terpusat di Settings

> Referensi tugas: [antigravity_ai_terpusat_TERPADU.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/instruksi-agent/antigravity_ai_terpusat_TERPADU.md) & [antigravity_model_ai_terpusat_instructions.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/instruksi-agent/antigravity_model_ai_terpusat_instructions.md)  
> Branch aktif: `fitur/model-ai-terpusat` (dibuat dari `fitur/hapus-instant-sheets` @ `e731b1f`)

## Ringkasan Tujuan

1. Memusatkan seluruh pemanggilan Gemini teks & vision ke pengaturan tenant (`Settings`), tanpa penimpaan diam-diam ke model yang sudah mati (`gemini-1.5-flash-8b`, `gemini-1.5-flash`).
2. Menyediakan satu fungsi pemilih terpusat `resolveModelChain({ role, taskType, modelOverride })` dengan 3 peran (`primary`, `light`, `vision`) serta key settings baru `gemini_model_light`.
3. Memastikan setiap pemanggilan memakai rantai cadangan (`makeModelResilient` / `generateContentFlexible` / loop REST) tanpa duplikat dan membedakan `MODEL_BUSY` (503) dari `QUOTA_EXHAUSTED` (429 harian).
4. Mencatat kuota pool key sesuai model aktual yang dipanggil, bukan model utama tenant secara membabi buta.
5. Menyediakan mockup HTML Settings (`public/mockup_settings_model_ai.html`) untuk review pengguna sebelum mengubah UI React `app/settings/page.js`.

---

## Execution Task List

- [x] **Langkah 0**: Amankan perubahan di `fitur/hapus-instant-sheets` (`e731b1f`) dan buat branch `fitur/model-ai-terpusat`.
- [x] **Audit Awal**: Inventarisasi pemanggil Gemini di `lib/` & `app/` serta verifikasi bukti error `gemini-1.5-flash-8b` pada tenant `tnt_mas-ibnu_e0eb25` di `staging.product_extractions`.
- [x] **Mockup HTML UI Settings**: Buat `public/mockup_settings_model_ai.html` dengan semantic CSS tokens (Light & Dark mode).
- [x] **Langkah 1 (`lib/gemini.js`)**: Implementasi `KNOWN_GEMINI_MODELS`, `DEFAULT_TEXT_MODEL`, `resolveModelChain`, pembersihan `MODULE_MODEL_MATRIX` & cascade dari model mati, pembaruan `resolveModelForTask`, `getResolvedGeminiModels` (termasuk string arg `'compliance_audit'`), `resolveStartFrameQcModel`, dan `generateWithImages`.
- [x] **Langkah 2 & 3 (Pemanggil & Pencatatan Kuota/`MODEL_BUSY`)**: Perbarui `makeModelResilient`, `executeContentGeneration`, `executeWithKeyPool`, `lib/product-bulk-worker.js`, `app/api/v2/products/[id]/route.js`, `app/api/v2/brand-profiles/extract/route.js`, `lib/threads-series-generator.js`, `lib/re-recomm-engine.js`, `lib/universe-ai-builder.js`, `lib/visual-identity-ai-builder.js`, `lib/universe-ai-repository.js`, `lib/tenant-admin.js`, `lib/scheduler-processors.js`, `app/api/keys/route.js`, `lib/db.js`, dan `app/api/settings/route.js`.
- [x] **Langkah 5a (Tes Otomatis)**: Tambah `tests/gemini-model-resolver.test.js` (termasuk penjaga `git grep` literal `gemini-<angka>`).
- [x] **Langkah 5b (Skrip Dry-Run)**: Buat `scripts/report-effective-gemini-models.mjs` (`--schema dev|staging`, read-only) untuk tabel model sebelum vs sesudah per tenant.
- [x] **Langkah 5c (Verifikasi & Deploy Dev)**: Jalankan semua tes + `npm run build`, deploy ke Dev (`5020`/`7020`), uji enrichment nyata & ubah model di Dev untuk verifikasi `[GEMINI_CALL]`, serta pasang UI Settings & rilis ke Staging sesuai persetujuan pengguna.

---

## Rencana Perubahan Kode (Before & After Snippets)

### 1. [lib/gemini.js](file:///Users/sabeqmmursyid/_cfstudio/lib/gemini.js)

**Code Sebelum (Current/Before):**
```javascript
export const GEMINI_CASCADE_ORDER_PAID = [
  'gemini-2.5-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-flash-latest'
];

export const MODULE_MODEL_MATRIX = {
  SCRAPER: { paid: 'gemini-1.5-flash-8b', free: 'gemini-3.6-flash', useKB: false },
  ...
};
```

**Code Sesudah (Proposed/After):**
```javascript
export const DEFAULT_TEXT_MODEL = 'gemini-3.6-flash';
export const DEFAULT_FALLBACK_MODEL = 'gemini-3.6-flash';
export const KNOWN_GEMINI_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest'
];

export const MODULE_MODEL_MATRIX = {
  SCRAPER: { role: 'light', useKB: false },
  PRODUCT_ENRICHMENT: { role: 'light', useKB: false },
  OCR_EXTRACTION: { role: 'light', useKB: false },
  BRAND_EXTRACTION: { role: 'light', useKB: false },
  COMPLIANCE: { role: 'light', useKB: false },
  DECONSTRUCT: { role: 'light', useKB: false },
  START_FRAME_QC: { role: 'vision', useKB: false },
  CAMPAIGN_PLANNER: { role: 'primary', useKB: true },
  ...
};

export async function resolveModelChain({ role = null, taskType = null, modelOverride = null, explicitTier = null } = {}) {
  // Membaca gemini_api_tier, gemini_smart_routing, gemini_model_primary,
  // gemini_model_fallback, gemini_model_light, start_frame_visual_qc_model
  // dan mengembalikan { model, chain, role, useKB, tier, primaryModel, fallbackModel, lightModel }
}
```

### 2. Error `MODEL_BUSY` vs `QUOTA_EXHAUSTED` & Tracking Pool Model di [lib/gemini.js](file:///Users/sabeqmmursyid/_cfstudio/lib/gemini.js)

**Code Sebelum (Current/Before):**
```javascript
// makeModelResilient & executeContentGeneration akhir loop:
throw new Error(`QUOTA_EXHAUSTED: Semua model Gemini tidak tersedia setelah ${MAX_WATERFALL_CYCLES} putaran. Error terakhir: ${baseMsg}`);

// executeWithKeyPool akhir loop:
throw new Error('QUOTA_EXHAUSTED: Semua API Key yang dicoba dalam pool gagal karena rate limit atau high demand.');
```

**Code Sesudah (Proposed/After):**
```javascript
// Membedakan 503/high demand/overloaded dari 429 kuota harian:
if (allFailuresWereBusy503) {
  const err = new Error(`MODEL_BUSY (dapat diulang): model ${lastTriedModel} sedang sibuk`);
  err.code = 'MODEL_BUSY';
  err.retryable = true;
  err.status = 503;
  err.geminiModel = lastTriedModel;
  throw err;
}
```

### 3. [lib/product-bulk-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-bulk-worker.js) & [app/api/v2/products/[id]/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/products/%5Bid%5D/route.js)

**Code Sebelum (Current/Before):**
```javascript
    const rawResponse = await executeWithKeyPool(1, async (apiKey) => {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const { getResolvedGeminiModels } = await import('./gemini.js');
      const { resolvedPrimary } = await getResolvedGeminiModels({ taskType: 'SCRAPER' });
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: resolvedPrimary,
        generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
      });
      const result = await model.generateContent([{ text: prompt }]);
      return result.response.text();
    });
```

**Code Sesudah (Proposed/After):**
```javascript
    const resolved = await resolveModelChain({ role: 'light', taskType: 'PRODUCT_ENRICHMENT' });
    const rawResponse = await runWithGeminiTrace({ stage: 'product_enrichment', item_id: id }, () =>
      executeWithKeyPool(1, async (apiKey) => {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: resolved.model,
          generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
        });
        const resilientModel = makeModelResilient(model, apiKey, resolved.model, true, null, {
          role: 'light',
          taskType: 'PRODUCT_ENRICHMENT'
        });
        const result = await resilientModel.generateContent([{ text: prompt }]);
        return result.response.text();
      }, { modelName: resolved.model })
    );
```
Serta pada `GET /api/v2/products/[id]` dan helper produk, menambahkan field terhitung `enrichment_retryable` yang bernilai `true` untuk `MODEL_BUSY` dan `QUOTA_EXHAUSTED` / 503 / 429.

### 4. Pemanggil Langsung Lainnya
- [app/api/v2/brand-profiles/extract/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/brand-profiles/extract/route.js): ganti `'gemini-2.5-flash'` menjadi `resolveModelChain({ role: 'light', taskType: 'BRAND_EXTRACTION' })` + `makeModelResilient`.
- [lib/threads-series-generator.js](file:///Users/sabeqmmursyid/_cfstudio/lib/threads-series-generator.js): gunakan `resolveModelChain({ role: 'primary', taskType: 'THREADS_SERIES' })` & `makeModelResilient` (hapus fallback tertulis `'gemini-2.5-flash'`).
- [lib/re-recomm-engine.js](file:///Users/sabeqmmursyid/_cfstudio/lib/re-recomm-engine.js): loop REST grounding mengikuti `chain` dari `resolveModelChain({ role: 'primary', taskType: 'RE_CAMPAIGN' })` tanpa `GEMINI_MODELS.PRIMARY` / `gemini-flash-latest` polos.
- [lib/universe-ai-builder.js](file:///Users/sabeqmmursyid/_cfstudio/lib/universe-ai-builder.js), [lib/visual-identity-ai-builder.js](file:///Users/sabeqmmursyid/_cfstudio/lib/visual-identity-ai-builder.js), [lib/universe-ai-repository.js](file:///Users/sabeqmmursyid/_cfstudio/lib/universe-ai-repository.js): isi `meta.model` dengan model aktual yang berhasil dipakai (`result.actualModel`).
- [lib/tenant-admin.js](file:///Users/sabeqmmursyid/_cfstudio/lib/tenant-admin.js): hapus `gemini_model: 'gemini-2.5-flash'`, salin pengaturan model Gemini (`gemini_api_tier`, `gemini_model_primary`, `gemini_model_fallback`, `gemini_model_light`, `gemini_smart_routing`, `gemini_context_caching`) dari `default_tenant`.
- [lib/scheduler-processors.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js), [app/api/keys/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/keys/route.js), [lib/db.js](file:///Users/sabeqmmursyid/_cfstudio/lib/db.js): gunakan `resolveModelChain` / `DEFAULT_TEXT_MODEL` terpusat.
- [app/api/settings/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/settings/route.js): dukung baca & simpan `gemini_model_light` (kosong = `""`). UI `app/settings/page.js` dipasang setelah pengguna menyetujui mockup `public/mockup_settings_model_ai.html`.
