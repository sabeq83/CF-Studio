# Implementation Plan — Enrich AI Multimodal Vision & Deteksi Kemasan Akurat

Tanggal: 19 November 2026 (Asia/Jakarta)  
Dasar analisa: [USULAN_PERBAIKAN_ENRICH_VISION_KEMASAN_PRODUK.md](file:///Users/sabeqmmursyid/_cfstudio/catatan-kerja/usulan/USULAN_PERBAIKAN_ENRICH_VISION_KEMASAN_PRODUK.md)  
Status: **DIARSIPKAN — selesai, lolos uji Dev, digabung ke `main` & dirilis v2.55.0 (19 November 2026)**  
Aturan branch (SOP): Dikerjakan di branch baru `fitur/enrich-vision-kemasan` yang dibuat dari `main` terbaru (`v2.54.1`) agar tidak tercampur dengan branch `fitur/scraper-foto-galeri-r02`. Tidak ada perubahan UI maupun migrasi struktur database.

---

## Ringkasan Perubahan

1. **Enrich AI Multimodal Vision ([lib/product-bulk-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-bulk-worker.js))**:
   - Mengambil kolom foto (`cleaned_photo_url`, `clean_photo_url`, `raw_photo_url`, `generated_photo_url`) di `claimPendingEnrichmentProducts`.
   - Memilih foto lokal terbaik (`cleaned_photo_url || clean_photo_url || raw_photo_url || generated_photo_url`) dan mengirimkannya ke Gemini bersama prompt (`inlineData` + `text`) lewat `generateProductEnrichmentWithGemini`. Bila tidak ada foto lokal, fallback aman ke teks saja.
   - Menghapus kata pemicu *"seperti pouch berdiri"* dari prompt, menambahkan instruksi wajib **Visual Grounding** (baca bentuk wadah, tutup, warna, dan label langsung dari foto), serta mengembalikan `detected_packaging_type` & `detected_is_in_packaging`.
   - **Aturan prioritas kemasan aman:** jika `packaging_status` masih kosong (berasal dari tebakan scraper awal, belum pernah diedit manual di modal produk), hasil pengamatan foto Vision ikut memperbarui `packaging_type` dan `is_in_packaging`; jika `packaging_status` sudah terisi manual (`'packaged'` / `'unpackaged'`), `packaging_type` pilihan pengguna tetap dipertahankan.
2. **Deteksi Kemasan di Photo Picker Scraper Awal ([lib/product-photo-picker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-photo-picker.js) & [lib/scheduler-processors.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js))**:
   - Menambahkan field opsional `detected_packaging_type` dan `is_in_packaging` ke `PHOTO_PICKER_SCHEMA` & `PHOTO_PICKER_PROMPT` saat Gemini Vision sudah menilai gambar kandidat.
   - Menyelaraskan `packaging_type` & `is_in_packaging` hasil scraper dari foto kandidat terpilih sebelum disimpan ke database (menggantikan tebakan teks buta seperti `"Kardus Kotak"`).
3. **Pengujian Otomatis (`tests/product-enrich-vision.test.js`)**:
   - Menguji pengiriman `inlineData` foto di `generateProductEnrichmentWithGemini` & fallback teks saat foto tidak tersedia.
   - Menguji aturan prioritas `packaging_type` (otomatis terupdate bila `packaging_status` kosong; terlindungi bila sudah diset manual).
   - Menguji penerusan `detected_packaging_type` dari `pickBestProductPhoto` (`toAuditCandidate` / `selectedCandidate`).

---

## Before & After Code Snippets

### 1. `lib/product-bulk-worker.js` — Ambil Foto, Kirim Multimodal Vision, Prompt Anti-Halusinasi, & Koreksi `packaging_type`

#### 1a. `claimPendingEnrichmentProducts`
**Code Sebelum (Current/Before):**
```js
    const res = await client.query(`
      SELECT id, product_name, raw_description, product_description, packaging_status, packaging_type, raw_photo_url, photo_provider
      FROM product_extractions
      WHERE tenant_id = $1
        AND enrichment_status = 'pending'
      ORDER BY created_at ASC
      LIMIT $2
      FOR UPDATE SKIP LOCKED
    `, [tenantId, limit]);
```

**Code Sesudah (Proposed/After):**
```js
    const res = await client.query(`
      SELECT id, product_name, raw_description, product_description,
             packaging_status, packaging_type, is_in_packaging,
             raw_photo_url, clean_photo_url, cleaned_photo_url, generated_photo_url, photo_provider
      FROM product_extractions
      WHERE tenant_id = $1
        AND enrichment_status = 'pending'
      ORDER BY created_at ASC
      LIMIT $2
      FOR UPDATE SKIP LOCKED
    `, [tenantId, limit]);
```

#### 1b. `generateProductEnrichmentWithGemini` & `enrichProduct`
**Code Sebelum (Current/Before):**
```js
export async function generateProductEnrichmentWithGemini(prompt, { itemId = null, tenantId = null } = {}) {
  const resolved = await resolveModelChain({ role: 'light', taskType: 'PRODUCT_ENRICHMENT' });
  return await runWithGeminiTrace(
    { stage: 'product_enrichment', item_id: itemId, tenant_id: tenantId },
    () => executeWithKeyPool(1, async (apiKey) => {
      const { model } = await createResilientGeminiModel({
        apiKey,
        role: 'light',
        taskType: 'PRODUCT_ENRICHMENT',
        modelName: resolved.model,
        generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
        isExplicitKey: true
      });
      const result = await model.generateContent([{ text: prompt }]);
      return result.response.text();
    }, { modelName: resolved.model, role: 'light', taskType: 'PRODUCT_ENRICHMENT' })
  );
}

async function enrichProduct(job) {
  const { id, product_name, raw_description, product_description, packaging_status, packaging_type, raw_photo_url, tenantId } = job;
  logToBulk(`[Enrichment] Memulai untuk "${product_name}" (${id})`, tenantId);

  const description = raw_description || product_description || '';
  const prompt = buildEnrichmentPrompt([{ id, product_name, raw_description: description, packaging_status, packaging_type }]);

  try {
    const rawResponse = await generateProductEnrichmentWithGemini(prompt, { itemId: id, tenantId });
...
    await pgQuery(`
      UPDATE product_extractions
      SET unique_selling_point = $1,
          product_truth = $2,
          geometric_truth = $3,
          clean_photo_t2i_prompt = $4,
          t2i_prompt = NULL,
          i2v_action_prompt = NULL,
          category = COALESCE($5, category),
          enrichment_status = 'completed',
          enrichment_error = NULL,
          extraction_status = 'completed',
          updated_at = NOW()
      WHERE id = $6 AND tenant_id = $7
    `, [
      JSON.stringify(item.unique_selling_point || []),
      item.product_truth || null,
      item.geometric_truth || null,
      item.clean_photo_t2i_prompt || null,
      item.category || null,
      id,
      tenantId
    ]);
```

**Code Sesudah (Proposed/After):**
```js
export function resolveEnrichmentImageInput(job, readBufferFn = readLocalImageToBuffer, detectMimeFn = detectImageMime) {
  const candidates = [
    job?.cleaned_photo_url,
    job?.clean_photo_url,
    job?.raw_photo_url,
    job?.generated_photo_url
  ].filter(Boolean);

  for (const relPath of candidates) {
    const buf = readBufferFn(relPath);
    if (buf && buf.length > 0) {
      return {
        imagePath: relPath,
        imageBuffer: buf,
        mimeType: detectMimeFn(buf) || 'image/jpeg'
      };
    }
  }
  return { imagePath: null, imageBuffer: null, mimeType: null };
}

export function resolveEnrichmentPackagingUpdates(job, aiItem) {
  const isManualLocked = Boolean(job?.packaging_status && String(job.packaging_status).trim() !== '');
  if (isManualLocked) {
    return {
      packagingType: job.packaging_type || null,
      isInPackaging: job.is_in_packaging ?? (job.packaging_status === 'packaged' ? 1 : 0)
    };
  }
  const detectedType = String(aiItem?.detected_packaging_type || '').trim();
  const hasDetectedBool = typeof aiItem?.detected_is_in_packaging === 'boolean';
  return {
    packagingType: detectedType || job?.packaging_type || null,
    isInPackaging: hasDetectedBool ? (aiItem.detected_is_in_packaging ? 1 : 0) : (job?.is_in_packaging ?? null)
  };
}

export async function generateProductEnrichmentWithGemini(prompt, { itemId = null, tenantId = null, imageBuffer = null, mimeType = 'image/jpeg' } = {}) {
  const resolved = await resolveModelChain({ role: 'light', taskType: 'PRODUCT_ENRICHMENT' });
  const parts = [];
  if (imageBuffer && Buffer.isBuffer(imageBuffer) && imageBuffer.length > 0) {
    parts.push({
      inlineData: {
        data: imageBuffer.toString('base64'),
        mimeType: mimeType || 'image/jpeg'
      }
    });
  }
  parts.push({ text: prompt });

  return await runWithGeminiTrace(
    { stage: 'product_enrichment', item_id: itemId, tenant_id: tenantId },
    () => executeWithKeyPool(1, async (apiKey) => {
      const { model } = await createResilientGeminiModel({
        apiKey,
        role: 'light',
        taskType: 'PRODUCT_ENRICHMENT',
        modelName: resolved.model,
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
        isExplicitKey: true
      });
      const result = await model.generateContent(parts);
      return result.response.text();
    }, { modelName: resolved.model, role: 'light', taskType: 'PRODUCT_ENRICHMENT' })
  );
}

async function enrichProduct(job) {
  const { id, product_name, raw_description, product_description, packaging_status, packaging_type, is_in_packaging, tenantId } = job;
  const { imagePath, imageBuffer, mimeType } = resolveEnrichmentImageInput(job);
  const hasManualPackaging = Boolean(packaging_status && String(packaging_status).trim() !== '');
  logToBulk(`[Enrichment] Memulai untuk "${product_name}" (${id})${imagePath ? ` [Vision: ${imagePath}]` : ' [Text-only]'}`, tenantId);

  const description = raw_description || product_description || '';
  const prompt = buildEnrichmentPrompt([{
    id,
    product_name,
    raw_description: description,
    packaging_status,
    packaging_type: hasManualPackaging ? packaging_type : null,
    has_attached_image: Boolean(imageBuffer)
  }]);

  try {
    const rawResponse = await generateProductEnrichmentWithGemini(prompt, { itemId: id, tenantId, imageBuffer, mimeType });
    const enriched = JSON.parse(rawResponse);
    const rawItem = (enriched.products || [enriched])[0];
    if (!rawItem) throw new Error('Gemini tidak mengembalikan data produk');

    const item = await ensureEnglishProductTruths(rawItem, {
      itemId: id,
      tenantId,
      productName: product_name,
      logger: (msg) => logToBulk(msg, tenantId)
    });
    const pkgUpdates = resolveEnrichmentPackagingUpdates({ packaging_status, packaging_type, is_in_packaging }, rawItem);

    await pgQuery(`
      UPDATE product_extractions
      SET unique_selling_point = $1,
          product_truth = $2,
          geometric_truth = $3,
          clean_photo_t2i_prompt = $4,
          t2i_prompt = NULL,
          i2v_action_prompt = NULL,
          category = COALESCE($5, category),
          packaging_type = COALESCE($6, packaging_type),
          is_in_packaging = COALESCE($7, is_in_packaging),
          enrichment_status = 'completed',
          enrichment_error = NULL,
          extraction_status = 'completed',
          updated_at = NOW()
      WHERE id = $8 AND tenant_id = $9
    `, [
      JSON.stringify(item.unique_selling_point || []),
      item.product_truth || null,
      item.geometric_truth || null,
      item.clean_photo_t2i_prompt || null,
      item.category || null,
      pkgUpdates.packagingType,
      pkgUpdates.isInPackaging,
      id,
      tenantId
    ]);
```

#### 1c. `buildEnrichmentPrompt`
**Code Sebelum (Current/Before):**
```js
export function buildEnrichmentPrompt(products) {
  return `Anda adalah expert E-commerce Copywriter dan Branding Strategist.
Analisis produk berikut dan kembalikan JSON valid (tanpa markdown):
${JSON.stringify(products, null, 2)}

Definisi baku Product Truth & Geometric Truth:
${PRODUCT_TRUTH_DEFINITIONS}

Format output:
{
  "products": [
    {
      "id": "ID produk asli",
      "unique_selling_point": ["USP 1 (Bahasa Indonesia)", "USP 2 (Bahasa Indonesia)", "USP 3 (Bahasa Indonesia)"],
      "product_truth": "WAJIB Bahasa Inggris (English), 3-4 kalimat deskripsi tampilan luar produk/kemasan (warna dominan, letak logo, teks utama kemasan, jenis tutup, aksen warna) untuk mengunci T2I",
      "geometric_truth": "WAJIB Bahasa Inggris (English), 2-3 kalimat bentuk 3D wadah & material/permukaan (silinder tegak, plastik doff, kaca bening, dll.) untuk I2V",
      "category": "Kategori produk (Bahasa Indonesia)",
      "clean_photo_t2i_prompt": "Prompt Bahasa Inggris untuk foto produk clean berlatar putih — deskripsi produk, studio light, white background"
    }
  ]
}
Aturan & Ketentuan Khusus:
1. JSON wajib valid sesuai schema di atas.
2. ID harus sesuai dengan input.
3. "product_truth", "geometric_truth", dan "clean_photo_t2i_prompt" WAJIB ditulis sepenuhnya dalam Bahasa Inggris (English). Sebaliknya, "unique_selling_point" dan "category" WAJIB tetap dalam Bahasa Indonesia (karena dipakai untuk naskah voice-over).
4. PENTING: Jika properti 'packaging_type' tersedia di input data produk (seperti 'Jar plastik' atau 'Botol Spray'), Anda WAJIB mematuhinya untuk menyusun 'geometric_truth' dan 'clean_photo_t2i_prompt'. Jangan pernah mengubah tipe kemasan atau mengasumsikannya menjadi bentuk lain (seperti pouch berdiri) jika tipe kemasan sudah dispesifikasikan oleh pengguna.`;
}
```

**Code Sesudah (Proposed/After):**
```js
export function buildEnrichmentPrompt(products) {
  return `Anda adalah expert E-commerce Copywriter, Visual Product Analyst, dan Branding Strategist.
Analisis produk berikut (BESERTA FOTO PRODUK TERLAMPIR jika tersedia) dan kembalikan JSON valid (tanpa markdown):
${JSON.stringify(products, null, 2)}

Definisi baku Product Truth & Geometric Truth:
${PRODUCT_TRUTH_DEFINITIONS}

Format output:
{
  "products": [
    {
      "id": "ID produk asli",
      "unique_selling_point": ["USP 1 (Bahasa Indonesia)", "USP 2 (Bahasa Indonesia)", "USP 3 (Bahasa Indonesia)"],
      "detected_packaging_type": "Jenis kemasan fisik utama dalam Bahasa Indonesia sesuai pengamatan foto (contoh: 'Jar Plastik', 'Botol Kaca', 'Standing Pouch', 'Kardus Kotak', 'Kaleng', atau 'Tanpa Kemasan')",
      "detected_is_in_packaging": true,
      "product_truth": "WAJIB Bahasa Inggris (English), 3-4 kalimat deskripsi tampilan luar produk/kemasan sesuai foto (warna dominan, letak logo, teks label aktual yang terlihat di foto, jenis tutup, aksen warna) untuk mengunci T2I",
      "geometric_truth": "WAJIB Bahasa Inggris (English), 2-3 kalimat bentuk 3D wadah & material/permukaan sesuai foto (silinder tegak, plastik bening/doff, tutup ulir, kaca tebal, dll.) untuk I2V",
      "category": "Kategori produk (Bahasa Indonesia)",
      "clean_photo_t2i_prompt": "Prompt Bahasa Inggris untuk foto produk clean berlatar putih — wajib akurat dengan foto produk, studio light, white background"
    }
  ]
}
Aturan & Ketentuan Khusus:
1. JSON wajib valid sesuai schema di atas.
2. ID harus sesuai dengan input.
3. "product_truth", "geometric_truth", dan "clean_photo_t2i_prompt" WAJIB ditulis sepenuhnya dalam Bahasa Inggris (English). Sebaliknya, "unique_selling_point" dan "category" WAJIB tetap dalam Bahasa Indonesia, dan "detected_packaging_type" juga ditulis dalam Bahasa Indonesia.
4. VISUAL GROUNDING KETAT: Bila foto terlampir (has_attached_image = true), amati foto terlebih dahulu sebelum menulis deskripsi. Bentuk wadah, tutup, warna dominan, dan material pada 'product_truth', 'geometric_truth', 'detected_packaging_type', dan 'clean_photo_t2i_prompt' WAJIB sesuai dengan foto terlampir, bukan ditebak dari nama atau kategori teks. Dilarang mengarang detail kemasan yang tidak terlihat pada foto.
5. Bila 'packaging_type' sudah terisi pada input (dari edit manual pengguna), WAJIB patuhi jenis kemasan tersebut untuk menyusun 'geometric_truth' dan 'clean_photo_t2i_prompt'.`;
}
```

---

### 2. `lib/product-photo-picker.js` & `lib/scheduler-processors.js` — Deteksi Kemasan Saat Photo Picker Scraper Awal

#### 2a. `lib/product-photo-picker.js` (`PHOTO_PICKER_SCHEMA`, `PHOTO_PICKER_PROMPT`, `toAuditCandidate`)
**Code Sebelum (Current/Before):**
```js
export const PHOTO_PICKER_SCHEMA = {
  type: 'object',
  properties: {
    best_index: { type: 'integer' },
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          has_person: { type: 'boolean' },
          text_overlay: { type: 'string', enum: ['none', 'light', 'heavy'] },
          text_area_pct: { type: 'integer' },
          is_infographic: { type: 'boolean' },
          is_collage: { type: 'boolean' },
          product_visible: { type: 'boolean' },
          score: { type: 'integer' }
        },
        required: ['index', 'has_person', 'text_overlay', 'text_area_pct', 'is_infographic', 'is_collage', 'product_visible', 'score']
      }
    }
  },
  required: ['best_index', 'candidates']
};
```

**Code Sesudah (Proposed/After):**
```js
export const PHOTO_PICKER_SCHEMA = {
  type: 'object',
  properties: {
    best_index: { type: 'integer' },
    selected_packaging_type: { type: 'string' },
    selected_is_in_packaging: { type: 'boolean' },
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          has_person: { type: 'boolean' },
          text_overlay: { type: 'string', enum: ['none', 'light', 'heavy'] },
          text_area_pct: { type: 'integer' },
          is_infographic: { type: 'boolean' },
          is_collage: { type: 'boolean' },
          product_visible: { type: 'boolean' },
          score: { type: 'integer' }
        },
        required: ['index', 'has_person', 'text_overlay', 'text_area_pct', 'is_infographic', 'is_collage', 'product_visible', 'score']
      }
    }
  },
  required: ['best_index', 'candidates']
};
```
*(Dilengkapi tambahan 1 baris panduan di `PHOTO_PICKER_PROMPT` untuk mengisi `selected_packaging_type` dan `selected_is_in_packaging` sesuai wujud fisik kandidat `best_index`, lalu meneruskan `detectedPackagingType` & `detectedIsInPackaging` di `pickBestProductPhoto`.)*

#### 2b. `lib/scheduler-processors.js` (`processProductScraper` saat menyimpan `physical_state`)
**Code Sebelum (Current/Before):**
```js
      // Edge Cases Kemasan & Prompt
      is_in_packaging: productData.physical_state?.is_in_packaging ? 1 : 0,
      packaging_type: productData.physical_state?.packaging_type || null,
```

**Code Sesudah (Proposed/After):**
```js
      // Edge Cases Kemasan & Prompt (prioritaskan deteksi visual Photo Picker daripada tebakan teks awal)
      is_in_packaging: typeof photoPickerResult?.detectedIsInPackaging === 'boolean'
        ? (photoPickerResult.detectedIsInPackaging ? 1 : 0)
        : (productData.physical_state?.is_in_packaging ? 1 : 0),
      packaging_type: photoPickerResult?.detectedPackagingType || productData.physical_state?.packaging_type || null,
```

---

## Execution Task List

- [x] Buat branch baru `fitur/enrich-vision-kemasan` dari `main` terbaru (`v2.54.1`) setelah diverifikasi `git branch --show-current`.
- [x] Implementasikan `resolveEnrichmentImageInput`, `resolveEnrichmentPackagingUpdates`, dukungan `inlineData` di `generateProductEnrichmentWithGemini`, pembaruan `claimPendingEnrichmentProducts` + `enrichProduct` + `buildEnrichmentPrompt` di [lib/product-bulk-worker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-bulk-worker.js).
- [x] Implementasikan `selected_packaging_type` & `selected_is_in_packaging` di [lib/product-photo-picker.js](file:///Users/sabeqmmursyid/_cfstudio/lib/product-photo-picker.js) dan sambungkan ke [lib/scheduler-processors.js](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js).
- [x] Buat unit test `tests/product-enrich-vision.test.js` dan jalankan bersama `tests/gemini-model-resolver.test.js`, `tests/product-truth-language.test.js`, `tests/product-photo-picker.test.js`, dan `DISABLE_AUTO_MIGRATIONS=true npm run build`.
- [x] Commit, push branch `fitur/enrich-vision-kemasan`, deploy ke Dev (`http://100.95.245.55:5020`), dan verifikasi ulang dengan mengklik **Enrich AI** pada produk `pe_1795007715441_445` (*Timur Tengah Grainnola*) hingga `packaging_type`, `product_truth`, dan `geometric_truth` cocok dengan *plastic jar*.
