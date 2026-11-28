# Implementation Plan: Recipe Labs & Auto Pipeline Poster Infografis Resep + Caption

Branch: `fitur/recipe-labs-infografis`  
Referensi Analisa: [USULAN_RECIPE_LABS_INFOGRAFIS_DAN_SUMBER_RESEP.md](catatan-kerja/usulan/USULAN_RECIPE_LABS_INFOGRAFIS_DAN_SUMBER_RESEP.md)  
Keputusan Desain Pengguna:
1. **Engine Render Utama**: Opsi A (Hybrid: Foto AI bersih + Template Infografis HTML-to-Image via Playwright/Sharp) untuk akurasi 0% typo dan kesesuaian takaran Recipe Library.
2. **Identitas Brand di Poster**: Mendukung Nama Brand / Watermark pada sudut poster infografis (toggle ON/OFF + teks brand otomatis dari `brand_profiles` atau input kustom).
3. **Produk Opsional**: Mendukung opsi opsional penyisipan produk dari Product Database (`product_id` / mode tanpa produk) pada resep, kartu bahan/tips, dan caption affiliate.

---

## Execution Task List

- [x] **Tahap 0: Persiapan Branch & Perencanaan** — Membuat branch `fitur/recipe-labs-infografis` dari `main` dan menyusun `implementation_plan.md`.
- [x] **Tahap 1: Mockup HTML Interaktif** — Membuat `public/mockup_recipe_infographic.html` dengan semantic design tokens Light/Dark Mode, menayangkan di server lokal port `4199`, dan menunggu persetujuan pengguna.
- [x] **Tahap 2: Sumber Resep (`Recipe Library` vs `AI Bikin Sendiri`) & Generator JSON Infografis** — Membuat `lib/recipe-library-picker.js` (pilihan manual & auto-rotasi `curated_recipes`), memperbarui `processRecipeGenerator` & `processRecipeGLabs` di `lib/scheduler-processors.js` untuk kontrak infografis + caption + produk opsional.
- [x] **Tahap 3: Renderer Poster Infografis HTML-to-Image (3 Template + Brand Watermark)** — Membuat `lib/recipe-infographic-renderer.js` menggunakan Playwright headless Chromium + `sharp` untuk 3 layout (`infographic_step_grid`, `infographic_text_steps`, `infographic_visual_ingredients`), tema warna, dan rasio `4:5` / `3:4` / `1:1`, lalu menyambungkannya ke `processRecipeExporter`.
- [x] **Tahap 4: Perbaikan Jalur Caption, ContentFlow, & Auto-Publish Gambar (`image`)** — Memperbarui `lib/contentflow-ingest.js`, `lib/auto-pipeline-scheduler-runner.js` (`media_type: 'image'`), dan `lib/publishing-drive-staging.js` (deteksi MIME gambar lokal di R2 & Drive).
- [x] **Tahap 5: API & UI Integration** — Memperbarui `lib/autonomous-engine.js`, `app/api/recipe-labs/route.js`, `app/api/v2/recipes/autonomous-pipeline/route.js`, `app/auto-pipeline/page.js`, dan `app/components/campaign-forms/RecipeLabsConfigurationForm.js`.
- [x] **Tahap 6: Verifikasi Unit Test, Build Lokal, & Pembaruan Kartu Menu** — Membuat dan menjalankan `PG_SEARCH_PATH=dev node --test tests/recipe-infographic.test.js`, `DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build`, memperbarui `sot/menus/kartu/recipe-labs.md` & `sot/menus/kartu/auto-pipeline.md`, serta uji di Dev (`5020`).
- [x] **Tahap 7: Mockup 9 Layout Infografis & Perapian UI Auto Pipeline** — Membuat `public/mockup_9_template_infografis.html` dan mockup utuh `public/mockup_autopipeline_recipe_labs_clean.html` (disetujui pengguna).
- [x] **Tahap 8: Implementasi 9 Template Infografis & Auto-Rotasi** — Memperbarui `lib/recipe-infographic-renderer.js`, `lib/recipe-infographic-prompt.js`, dan `lib/scheduler-processors.js` untuk 9 layout berbeda + mode `auto_rotate` + kuota foto adaptif (`1` s.d. `7` foto).
- [x] **Tahap 9: Perapian UI Auto Pipeline (Hide Video Saat `recipe_labs`) & Wireframe 9 Template** — Memperbarui `app/components/campaign-forms/RecipeInfographicControls.js` (9 kartu wireframe mini + toggle `auto_rotate`) dan menyembunyikan seluruh UI pengaturan video pada Tab 1 & Modal Jadwal `app/auto-pipeline/page.js` saat tipe `recipe_labs` dipilih.
- [x] **Tahap 10: Verifikasi Unit Test 9 Template, Local Build, & Deploy Dev (`5020`)** — Memperluas `tests/recipe-infographic.test.js` untuk seluruh 9 template, menjalankan `npm run build`, commit & push `fitur/recipe-labs-infografis`, lalu `deploy:dev:atomic`.

---

## Rancangan Perubahan File (Before & After Code Snippets)

### 1. `lib/recipe-library-picker.js` *(File Baru)*
Menyediakan fungsi `resolveCuratedRecipeForPipeline({ tenantId, curatedRecipeId, category, selectionMode })`:
- Jika `selectionMode === 'manual'` dan `curatedRecipeId` diisi: ambil 1 resep dari `curated_recipes` via `getCuratedRecipeById`.
- Jika `selectionMode === 'auto_library_rotation'`: pilih resep berstatus `ready`/`polished` (atau fallback `draft`) dengan `used_in_campaign_count ASC, updated_at ASC`, opsional filter kategori.
- Menyediakan `markCuratedRecipeUsed(id, tenantId)` untuk menaikkan `used_in_campaign_count + 1` setelah produksi selesai.

### 2. `lib/recipe-infographic-renderer.js` *(File Baru)*
Merender poster infografis resolusi tinggi (`1080x1350` untuk `4:5`, `1080x1440` untuk `3:4`, `1080x1080` untuk `1:1`) dari JSON terstruktur + foto lokal (Hero + Step photos) menjadi file JPEG `06_INFOGRAPHIC_POSTER.jpg`:
- Mendukung 3 layout:
  1. `infographic_step_grid` (Hero atas + Kartu Bahan kanan + Grid 4-6 Foto Step bernomor + Tips + Badge + Brand Watermark).
  2. `infographic_text_steps` (Hero besar + Kartu Bahan/Multi-Layer/Topping + Daftar Langkah Teks 1-4 + Tips + Badge + Brand Watermark).
  3. `infographic_visual_ingredients` (Hero + Kartu Bahan Visual + Grid Foto Step + Tips + Badge + Brand Watermark).
- Menggunakan `playwright` Chromium (`deviceScaleFactor: 1`) + `sharp` untuk konversi final JPEG kualitas 94%.

### 3. `lib/scheduler-processors.js`
Menambahkan dukungan `output_style: 'recipe_infographic'`, `recipe_source: 'ai_generated' | 'recipe_library'`, `brand_watermark`, dan `product_id` opsional pada `processRecipeGenerator`, `processRecipeGLabs`, dan `processRecipeExporter`.

**Code Sebelum (Current/Before) — `lib/scheduler-processors.js` (baris 10292-10356 & 10550-10605 & 10982-11005):**
```javascript
    } else {
      const envObj = resolvePhotographyEnvironment(visualStyle);
      console.log(`[Recipe Generator Static] Generating static recipe text & prompts for item #${item.id}...`);
      const imgCount = campaign.images_per_recipe || 4;
      // ... promptsSchema 3-6 foto studio umum ...
    }
```
```javascript
        const glabsResult = await generateImage({
          prompt: promptText,
          model: 'nano_banana_pro',
          aspect_ratio: '1:1',
          webhookOverride: brandProfile
        });
```
```javascript
    const gridAbsPath = path.join(baseUploadDir, '05_GRID_POSTER.jpg');
    await createRecipeGrid(imgPaths, gridAbsPath, { ... });
```

**Code Sesudah (Proposed/After) — `lib/scheduler-processors.js`:**
```javascript
    } else if (config?.output_style === 'recipe_infographic') {
      // 1. Jika recipe_source === 'recipe_library', muat resep otoritatif dari curated_recipes
      // 2. Jika product_id opsional tersedia, muat detail produk dari product_extractions
      // 3. Susun prompt Gemini agar mengembalikan JSON terstruktur:
      //    title, subtitle_ribbon, hook_badge, ingredients_groups, steps (caption + t2i_prompt konsisten),
      //    tips[], cta_badge, social_media_package { caption_facebook, caption_bio, hashtags }, prompts { image_1..image_N }
      // 4. Simpan infographic_payload_json di seo_data_json serta social_media_package
    }
```
```javascript
    // Di processRecipeGLabs: dukung hero aspect_ratio (4:3 / 1:1) & step thumbnails (1:1 / 4:3)
    // Di processRecipeExporter: jika config?.output_style === 'recipe_infographic',
    // panggil renderRecipeInfographicPoster(...) ke 06_INFOGRAPHIC_POSTER.jpg dan simpan ke img_grid_path
```

### 4. `lib/autonomous-engine.js`
Meneruskan konfigurasi `output_style`, `infographic_template`, `infographic_theme`, `recipe_source`, `curated_recipe_id`, `library_selection_mode`, `show_brand_watermark`, `brand_watermark_text`, dan `product_id` ke `config_json` pada `executeAutonomousRecipeLabsPipeline`.

**Code Sebelum (Current/Before) — `lib/autonomous-engine.js` (baris 1327-1394):**
```javascript
export async function executeAutonomousRecipeLabsPipeline({
  brandId,
  category = 'Makanan',
  recipeClassification = null,
  targetLanguage = 'en_US',
  topic = 'Resep Praktis Sehat',
  aspectRatio = '3:4',
  visualStyle = 'Modern Minimalist Nordic Studio',
  imagesPerRecipe = 4,
  selectedLayoutId = '4_editorial_split',
  gridGapSize = 12,
  gridBorderRadius = 16,
  gridOuterPadding = 16,
  gridBgColor = '#0d0d12',
  postToFacebook = true,
  tenantId = 'default_tenant',
  overrides = {}
})
```

**Code Sesudah (Proposed/After) — `lib/autonomous-engine.js`:**
```javascript
export async function executeAutonomousRecipeLabsPipeline({
  brandId,
  category = 'Makanan',
  recipeClassification = null,
  targetLanguage = 'id_ID',
  topic = 'Resep Praktis Sehat',
  aspectRatio = '4:5',
  visualStyle = 'Warm Indonesian Home Kitchen',
  outputStyle = 'recipe_infographic',
  infographicTemplate = 'infographic_step_grid',
  infographicTheme = 'warm_cream',
  recipeSource = 'ai_generated',
  curatedRecipeId = null,
  librarySelectionMode = 'manual',
  showBrandWatermark = true,
  brandWatermarkText = null,
  productId = null,
  imagesPerRecipe = 4,
  selectedLayoutId = '4_editorial_split',
  gridGapSize = 12,
  gridBorderRadius = 16,
  gridOuterPadding = 16,
  gridBgColor = '#0d0d12',
  postToFacebook = true,
  tenantId = 'default_tenant',
  overrides = {}
})
```

### 5. `lib/auto-pipeline-scheduler-runner.js`
1. Pada `executeSchedulePipeline` (`pType === 'recipe_labs'`, baris 290-322): meneruskan parameter infografis, `recipe_source`, `brand_watermark`, dan `product_id` opsional (termasuk auto-pick dari Recipe Library saat `library_selection_mode === 'auto_library_rotation'`).
2. Pada `dispatchDuePublishes` (baris 662-687): menentukan `media_type` secara dinamis (`'image'` untuk item `recipe_labs` statis, `'video'` untuk video).

**Code Sebelum (Current/Before) — `lib/auto-pipeline-scheduler-runner.js` (baris 672-686):**
```javascript
            rawBody: {
              content_id: cfItem.id,
              account_ids: replizAccountIds,
              publish_mode: 'live',
              media_type: 'video',
              title: highCtrTitle,
```

**Code Sesudah (Proposed/After) — `lib/auto-pipeline-scheduler-runner.js`:**
```javascript
            const resolvedMediaType = cfItem.source_type === 'recipe' && !String(mediaUrl || '').toLowerCase().endsWith('.mp4')
              ? 'image'
              : 'video';
            rawBody: {
              content_id: cfItem.id,
              account_ids: replizAccountIds,
              publish_mode: 'live',
              media_type: resolvedMediaType,
              title: highCtrTitle,
```

### 6. `lib/contentflow-ingest.js`
Memprioritaskan caption rapi dari `social_media_package` (di dalam `seo_data_json`) dibandingkan `recipe_markdown_text` mentah agar caption yang masuk ke ContentFlow Hub siap tayang tanpa simbol Markdown `#` / `**`.

**Code Sebelum (Current/Before) — `lib/contentflow-ingest.js` (baris 935 & 964):**
```javascript
      const caption = item.recipe_markdown_text || item.recipe_title || '';
      // ...
      social_media_package_json: item.seo_data_json || (item.recipe_title ? JSON.stringify({ title: item.recipe_title, caption }) : null),
```

**Code Sesudah (Proposed/After) — `lib/contentflow-ingest.js`:**
```javascript
      let parsedSeo = {};
      try { if (item.seo_data_json) parsedSeo = JSON.parse(item.seo_data_json); } catch (_) {}
      const socialPkg = parsedSeo.social_media_package || (parsedSeo.caption ? parsedSeo : null);
      const caption = socialPkg?.caption_facebook || socialPkg?.caption || item.recipe_markdown_text || item.recipe_title || '';
      // ...
      social_media_package_json: socialPkg ? JSON.stringify(socialPkg) : (item.seo_data_json || (item.recipe_title ? JSON.stringify({ title: item.recipe_title, caption }) : null)),
```

### 7. `lib/publishing-drive-staging.js`
Memperbaiki deteksi MIME type gambar lokal di `stageMediaToR2` (agar `.jpg`/`.png`/`.webp` tidak menjadi `video/mp4`) serta mendukung pembacaan file lokal pada `stageMediaToDrive`.

**Code Sebelum (Current/Before) — `lib/publishing-drive-staging.js` (baris 504 & 538-542):**
```javascript
  let buffer;
  let contentType = 'video/mp4';
  // ...
    buffer = await readFile(resolved);
  }

  const ext = contentType.includes('image') ? 'jpg' : 'mp4';
```

**Code Sesudah (Proposed/After) — `lib/publishing-drive-staging.js`:**
```javascript
  let buffer;
  let contentType = job.media_type === 'image' ? 'image/jpeg' : 'video/mp4';
  // ...
    buffer = await readFile(resolved);
    const lowerPath = resolved.toLowerCase();
    if (lowerPath.endsWith('.png')) contentType = 'image/png';
    else if (lowerPath.endsWith('.webp')) contentType = 'image/webp';
    else if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) contentType = 'image/jpeg';
  }

  const ext = contentType.includes('png') ? 'png' : (contentType.includes('webp') ? 'webp' : (contentType.includes('image') ? 'jpg' : 'mp4'));
```

### 8. `app/api/recipe-labs/route.js` & `app/api/v2/recipes/autonomous-pipeline/route.js`
Menerima dan meneruskan parameter baru (`output_style`, `infographic_template`, `infographic_theme`, `recipe_source`, `curated_recipe_id`, `library_selection_mode`, `show_brand_watermark`, `brand_watermark_text`, `product_id`).

**Code Sebelum (Current/Before) — `app/api/v2/recipes/autonomous-pipeline/route.js` (baris 303-328):**
```javascript
    } else if (pipelineType === 'recipe_labs') {
      const recipeClass = body.recipe_classification || body.recipeClassification || body.category || 'Makanan';
      const targetLang = body.target_language || body.targetLanguage || 'en_US';
      const aspectRatio = body.aspect_ratio || body.aspectRatio || '3:4';
      result = await executeAutonomousRecipeLabsPipeline({
        brandId: body.brand_id || body.brandId,
        category: recipeClass,
        // ...
      });
```

**Code Sesudah (Proposed/After) — `app/api/v2/recipes/autonomous-pipeline/route.js`:**
```javascript
    } else if (pipelineType === 'recipe_labs') {
      const recipeClass = body.recipe_classification || body.recipeClassification || body.category || 'Makanan';
      const targetLang = body.target_language || body.targetLanguage || 'id_ID';
      const aspectRatio = body.aspect_ratio || body.aspectRatio || '4:5';
      result = await executeAutonomousRecipeLabsPipeline({
        brandId: body.brand_id || body.brandId,
        category: recipeClass,
        recipeClassification: recipeClass,
        targetLanguage: targetLang,
        topic: body.topic || 'Resep Praktis Pilihan',
        aspectRatio,
        outputStyle: body.output_style || 'recipe_infographic',
        infographicTemplate: body.infographic_template || 'infographic_step_grid',
        infographicTheme: body.infographic_theme || 'warm_cream',
        recipeSource: body.recipe_source || 'ai_generated',
        curatedRecipeId: body.curated_recipe_id || null,
        librarySelectionMode: body.library_selection_mode || 'manual',
        showBrandWatermark: body.show_brand_watermark !== false,
        brandWatermarkText: body.brand_watermark_text || null,
        productId: body.product_id || null,
        // ...
      });
```

### 9. `app/auto-pipeline/page.js` & `app/components/campaign-forms/RecipeLabsConfigurationForm.js`
Menambahkan kontrol UI sesuai mockup HTML yang disetujui pada **Tahap 1**:
- Pilihan `output_style`: **Poster Infografis** vs **Grid Kolase Polos**.
- Pilihan `recipe_source`: **AI Bikin Sendiri** vs **Ambil dari Recipe Library** (dengan pencarian & auto-rotasi pada tab Schedules).
- Pilihan 3 template infografis, tema warna, rasio `4:5` / `3:4` / `1:1`, toggle Nama Brand Watermark, dan pemilih Produk Opsional dari Product Database.
