# Implementation Plan - Sinkronisasi Kurasi Radar Produk ke Database Produk

**Tanggal**: 20 November 2026  
**Branch Target**: `fitur/sync-kurasi-radar-ke-produk`  
**Tujuan**: Memastikan nama, deskripsi, dan USP yang dikurasi kurator di menu Radar Produk (`/product-radar`) otomatis terbawa ke Database Produk (`product_extractions`), terlindungi dari penimpaan AI Enrichment latar belakang, dan tersinkronisasi saat diedit ulang.

---

## Proposed Changes & Code Snippets

### 1. `lib/product-research-promotion-service.js`
Mengekstrak teks kurasi (`name`, `description`, `usp`) dan meneruskannya sebagai `metadata_overrides` ke `enqueueProductScrape()`.

#### Code Sebelum (Current/Before):
```javascript
  const enqueueFn = deps.enqueueProductScrapeFn || enqueueProductScrape;
  const targetCategory = candidate.curated_data?.category || candidate.research_data?.category || '';

  try {
    const enqueueResult = await enqueueFn({
      urls: [effectiveUrl],
      category: targetCategory,
      repair_mode: false,
      refresh_photo: false,
      reserved_ids: { [effectiveUrl]: claim.reservedProductId }
    }, deps);
```

#### Code Sesudah (Proposed/After):
```javascript
  const enqueueFn = deps.enqueueProductScrapeFn || enqueueProductScrape;
  const targetCategory = candidate.curated_data?.category || candidate.research_data?.category || '';

  const curatedName = candidate.curated_data?.name?.trim() || candidate.research_data?.name?.trim() || '';
  const curatedDesc = candidate.curated_data?.description?.trim() || candidate.research_data?.description?.trim() || '';
  const curatedUsp = candidate.curated_data?.usp?.trim() || candidate.research_data?.usp?.trim() || '';

  const metadataOverrides = {
    [effectiveUrl]: {
      product_name: curatedName || undefined,
      product_description: curatedDesc || undefined,
      unique_selling_point: curatedUsp || undefined,
      candidate_id: candidate.id
    }
  };

  try {
    const enqueueResult = await enqueueFn({
      urls: [effectiveUrl],
      category: targetCategory,
      repair_mode: false,
      refresh_photo: false,
      reserved_ids: { [effectiveUrl]: claim.reservedProductId },
      metadata_overrides: metadataOverrides
    }, deps);
```

---

### 2. `lib/product-catalog-service.js`
Menerima `metadata_overrides` pada `enqueueProductScrape` dan menyertakannya ke payload job `product_scraper`.

#### Code Sebelum (Current/Before):
```javascript
export async function enqueueProductScrape({
  urls,
  csv_data,
  category,
  tags,
  repair_mode = true,
  refresh_photo = false,
  reserved_ids: suppliedReservedIds = null
} = {}, deps = {}) {
...
  for (let i = 0; i < urlsToScrape.length; i += batchSize) {
    const chunk = urlsToScrape.slice(i, i + batchSize);
    const created = await createJobFn('product_scraper', {
      tenant_id: activeTenant,
      urls: chunk,
      category,
      tags,
      url_affiliates_map: urlAffiliatesMap,
      repair_mode,
      refresh_photo: Boolean(refresh_photo),
      reserved_ids: reservedIds
    });
```

#### Code Sesudah (Proposed/After):
```javascript
export async function enqueueProductScrape({
  urls,
  csv_data,
  category,
  tags,
  repair_mode = true,
  refresh_photo = false,
  reserved_ids: suppliedReservedIds = null,
  metadata_overrides = null
} = {}, deps = {}) {
...
  for (let i = 0; i < urlsToScrape.length; i += batchSize) {
    const chunk = urlsToScrape.slice(i, i + batchSize);
    const created = await createJobFn('product_scraper', {
      tenant_id: activeTenant,
      urls: chunk,
      category,
      tags,
      url_affiliates_map: urlAffiliatesMap,
      repair_mode,
      refresh_photo: Boolean(refresh_photo),
      reserved_ids: reservedIds,
      metadata_overrides: metadata_overrides || undefined
    });
```

---

### 3. `lib/scheduler-processors.js`
Menginjeksi metadata kurator saat `processProductScraper` membuat record di `product_extractions`, serta menandai `raw_response.usp_source = 'manual'`.

#### Code Sebelum (Current/Before):
```javascript
    let finalUsp = '';
    if (productData.usp) {
      finalUsp = typeof productData.usp === 'string'
        ? productData.usp
        : JSON.stringify(productData.usp);
    }

    // Tentukan photo_url utama berdasarkan pointer active_photo
    localPhotoPath = generatedPhotoPath || cleanPhotoPath || rawPhotoPath;

    const data = {
      product_name: productData.product_name || scrapedItem.scraped.title || 'Produk Tanpa Nama',
      product_description: scrapedItem.scraped.description || scrapedItem.scraped.title || '',
      unique_selling_point: finalUsp,
      target_audience: '',
      pain_point_solved: '',
      key_visuals_extracted: JSON.stringify([]),
      raw_response: JSON.stringify({
        ...productData,
        photo_selection_audit: photoPickerResult?.evaluation || null,
        photo_final_check: finalCheckResult || null,
        studio_polish: studioPolish
      }),
```

#### Code Sesudah (Proposed/After):
```javascript
    const metadataOverrides = payload?.metadata_overrides || {};
    const metaOverride = metadataOverrides[scrapedItem.url] || (productId ? metadataOverrides[productId] : null);

    const curatedName = metaOverride?.product_name?.trim();
    const curatedDesc = metaOverride?.product_description?.trim();
    const curatedUsp = metaOverride?.unique_selling_point?.trim();

    let finalUsp = '';
    if (curatedUsp) {
      finalUsp = curatedUsp;
    } else if (productData.usp) {
      finalUsp = typeof productData.usp === 'string'
        ? productData.usp
        : JSON.stringify(productData.usp);
    }

    // Tentukan photo_url utama berdasarkan pointer active_photo
    localPhotoPath = generatedPhotoPath || cleanPhotoPath || rawPhotoPath;

    const data = {
      product_name: curatedName || productData.product_name || scrapedItem.scraped.title || 'Produk Tanpa Nama',
      product_description: curatedDesc || scrapedItem.scraped.description || scrapedItem.scraped.title || '',
      unique_selling_point: finalUsp,
      target_audience: '',
      pain_point_solved: '',
      key_visuals_extracted: JSON.stringify([]),
      raw_response: JSON.stringify({
        ...productData,
        photo_selection_audit: photoPickerResult?.evaluation || null,
        photo_final_check: finalCheckResult || null,
        studio_polish: studioPolish,
        usp_source: curatedUsp ? 'manual' : 'scraper',
        curated_from_radar: Boolean(metaOverride)
      }),
```

---

### 4. `lib/product-bulk-worker.js`
Menambahkan `isUspManualLocked(job)` agar background AI Enrichment tidak menimpa USP yang sudah dikurasi kurator atau diedit manual.

#### Code Sebelum (Current/Before):
```javascript
async function enrichProduct(job) {
  const { id, product_name, raw_description, product_description, is_url, raw_response, packaging_status, packaging_type, is_in_packaging, tenantId } = job;
  const { imagePath, imageBuffer, mimeType } = resolveEnrichmentImageInput(job);
  const hasManualPackaging = isPackagingManualLocked({ is_url, raw_response, packaging_status, packaging_type, is_in_packaging });
  logToBulk(`[Enrichment] Memulai untuk "${product_name}" (${id})${imagePath ? ` [Vision: ${imagePath}]` : ' [Text-only]'}`, tenantId);

  const description = raw_description || product_description || '';
  const prompt = buildEnrichmentPrompt([{
    id,
    product_name,
    raw_description: description,
    packaging_status: hasManualPackaging ? packaging_status : null,
    packaging_type: hasManualPackaging ? packaging_type : null,
    has_attached_image: Boolean(imageBuffer)
  }]);
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
          packaging_type = COALESCE($6, packaging_type),
          is_in_packaging = COALESCE($7, is_in_packaging),
          packaging_status = COALESCE($8, packaging_status),
          raw_response = COALESCE($9, raw_response),
          enrichment_status = 'completed',
          enrichment_error = NULL,
          extraction_status = 'completed',
          updated_at = NOW()
      WHERE id = $10 AND tenant_id = $11
    `, [
      JSON.stringify(item.unique_selling_point || []),
```

#### Code Sesudah (Proposed/After):
```javascript
export function isUspManualLocked(job) {
  const parsedRaw = parseRawResponseSafe(job?.raw_response);
  if (parsedRaw?.usp_source === 'manual') return true;
  if (parsedRaw?.curated_from_radar && job?.unique_selling_point && String(job.unique_selling_point).trim() !== '') return true;
  return false;
}
...
async function enrichProduct(job) {
  const { id, product_name, raw_description, product_description, unique_selling_point, is_url, raw_response, packaging_status, packaging_type, is_in_packaging, tenantId } = job;
  const { imagePath, imageBuffer, mimeType } = resolveEnrichmentImageInput(job);
  const hasManualPackaging = isPackagingManualLocked({ is_url, raw_response, packaging_status, packaging_type, is_in_packaging });
  const hasManualUsp = isUspManualLocked({ raw_response, unique_selling_point });
  logToBulk(`[Enrichment] Memulai untuk "${product_name}" (${id})${imagePath ? ` [Vision: ${imagePath}]` : ' [Text-only]'}`, tenantId);

  const description = raw_description || product_description || '';
  const prompt = buildEnrichmentPrompt([{
    id,
    product_name,
    raw_description: description,
    packaging_status: hasManualPackaging ? packaging_status : null,
    packaging_type: hasManualPackaging ? packaging_type : null,
    unique_selling_point: hasManualUsp ? unique_selling_point : null,
    has_attached_image: Boolean(imageBuffer)
  }]);
...
    const finalUsp = hasManualUsp ? unique_selling_point : JSON.stringify(item.unique_selling_point || []);
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
          packaging_status = COALESCE($8, packaging_status),
          raw_response = COALESCE($9, raw_response),
          enrichment_status = 'completed',
          enrichment_error = NULL,
          extraction_status = 'completed',
          updated_at = NOW()
      WHERE id = $10 AND tenant_id = $11
    `, [
      finalUsp,
```

---

### 5. `lib/product-research-repository.js`
Menyinkronkan perubahan edit kurator langsung ke `product_extractions` bila kandidat sudah terhubung ke katalog (`existing.cf_product_id`).

#### Code Sebelum (Current/Before):
```javascript
    const updatedRes = await client.query(
      `UPDATE product_research_candidates
       SET curated_data = $1::jsonb,
           url_status = $2,
           normalized_url = $3,
           curation_status = $4,
           revision = revision + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND tenant_id = $6
       RETURNING *`,
      [
        JSON.stringify(nextCuratedData),
        nextUrlStatus,
        nextNormalizedUrl,
        nextCurationStatus,
        candidateId,
        tenantId
      ]
    );

    return updatedRes.rows[0];
```

#### Code Sesudah (Proposed/After):
```javascript
    const updatedRes = await client.query(
      `UPDATE product_research_candidates
       SET curated_data = $1::jsonb,
           url_status = $2,
           normalized_url = $3,
           curation_status = $4,
           revision = revision + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND tenant_id = $6
       RETURNING *`,
      [
        JSON.stringify(nextCuratedData),
        nextUrlStatus,
        nextNormalizedUrl,
        nextCurationStatus,
        candidateId,
        tenantId
      ]
    );

    // Sinkronkan ke katalog jika kandidat sudah memiliki cf_product_id
    if (existing.cf_product_id) {
      const prodSets = [];
      const prodParams = [];
      let pIdx = 1;

      if (curatedData?.name && curatedData.name.trim()) {
        prodSets.push(`product_name = $${pIdx++}`);
        prodParams.push(curatedData.name.trim());
      }
      if (curatedData?.description !== undefined && curatedData.description !== null) {
        prodSets.push(`product_description = $${pIdx++}`);
        prodParams.push(curatedData.description.trim());
      }
      if (curatedData?.usp !== undefined && curatedData.usp !== null) {
        prodSets.push(`unique_selling_point = $${pIdx++}`);
        prodParams.push(curatedData.usp.trim());
        prodSets.push(`raw_response = jsonb_set(COALESCE(raw_response::jsonb, '{}'::jsonb), '{usp_source}', '"manual"')`);
      }

      if (prodSets.length > 0) {
        prodSets.push(`updated_at = NOW()`);
        prodParams.push(existing.cf_product_id, tenantId);
        await client.query(
          `UPDATE product_extractions SET ${prodSets.join(', ')} WHERE id = $${pIdx++} AND tenant_id = $${pIdx++}`,
          prodParams
        );
      }
    }

    return updatedRes.rows[0];
```

---

## Execution Task List

- [x] Task 1: Update `lib/product-research-promotion-service.js` (Ekstrak & teruskan `metadata_overrides`)
- [x] Task 2: Update `lib/product-catalog-service.js` (Dukungan `metadata_overrides` pada `enqueueProductScrape`)
- [x] Task 3: Update `lib/scheduler-processors.js` (Injeksi metadata kurator & label `usp_source: 'manual'`)
- [x] Task 4: Update `lib/product-bulk-worker.js` (Proteksi `isUspManualLocked` pada AI Enrichment)
- [x] Task 5: Update `lib/product-research-repository.js` (Sinkronisasi edit kurator ke `product_extractions`)
- [x] Task 6: Tambahkan pengujian otomatis di `tests/product-research/promotion-and-scrape-contract.test.js` dan jalankan test
- [x] Task 7: Verifikasi seluruh suite test `npm test tests/product-research/`
- [ ] Task 8: Commit & push ke remote branch `fitur/sync-kurasi-radar-ke-produk`
- [ ] Task 9: Deploy ke server Dev Mac Mini (`npm run deploy:dev:atomic -- --ref <full-sha> --apply --confirm-dev`) dan verifikasi status online
