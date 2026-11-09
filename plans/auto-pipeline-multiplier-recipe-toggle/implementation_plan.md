# Rencana Implementasi: Kontrol Ekstraksi Resep Lengkap Video Multiplier pada Auto Pipeline (`resep-multiplier`)

## Ringkasan Eksekutif
Berdasarkan dokumen usulan dan audit lapangan [resep-multiplier.md](file:///Users/sabeqmmursyid/_cfstudio/resep-multiplier.md), pembuatan video Multiplier otomatis melalui **Auto Pipeline (1-Klik & Skedul Rutin)** belum menyertakan kontrol `generate_recipe`. Hal ini menyebabkan task seperti `mul_261108_s6so1p` kehilangan teks resep/racikan lengkap di caption media sosial (hanya memuat hook, cerita pendek, dan CTA Shopee).

> [!NOTE]
> **Koreksi Arsitektur (Clarification on Scope)**:
> **Content Planner BUKAN titik masuk Multiplier Lab**. Content Planner memproduksi kampanye orisinal (`product_campaign`, `editorial_campaign`, atau modul mandiri `recipe_campaign`) dan di-ingest ke pipeline OPC. Multiplier Lab secara eksklusif memproses **Blueprint Video dari Deconstruct Lab** (`re_deconstructed_assets` -> `re_multiplier_tasks`). Oleh karena itu, kontrol Multiplier Resep ini difokuskan 100% pada 2 Entry Point Multiplier yang sebenarnya di Auto Pipeline.

Rencana implementasi ini bertujuan untuk:
1. Menyediakan **toggle switch ON/OFF** `🍳 Hasilkan Resep / Racikan Lengkap di Caption (Bahan, Takaran & Langkah)` pada 2 titik masuk Video Multiplier:
   - **Tab 1 Auto Pipeline**: 1-Klik Launch Video Multiplier (`app/auto-pipeline/page.js`).
   - **Tab 2 Auto Pipeline**: Modal Skedul Penjadwalan Rutin Multiplier (`app/auto-pipeline/page.js`).
2. Menghubungkan alur parameter `generate_recipe` secara *end-to-end* melalui API (`app/api/v2/recipes/autonomous-pipeline/route.js`), Autonomous Engine (`lib/autonomous-engine.js`), dan Scheduler Runner (`lib/auto-pipeline-scheduler-runner.js`) hingga tersimpan ke database `re_multiplier_tasks`.
3. Menyelaraskan (*harmonize*) prompt Gemini AI di `lib/prompts.js` agar saat kontrol resep aktif, **teks resep lengkap (Bahan, Takaran, Langkah 1-N, Tips)** hadir utuh baik pada postingan Facebook (diikuti CTA link Shopee aktif) maupun non-Facebook (diikuti arahan Link di Bio).

### Simulasi Mockup HTML Acuan:
Sesuai SOP Mockup MAKNA Flow, file simulasi interaktif standalone telah diperbarui dengan 100% token semantik dari `app/theme.css`:
* **Path File**: [public/mockup_auto_pipeline_recipe_toggle.html](file:///Users/sabeqmmursyid/_cfstudio/public/mockup_auto_pipeline_recipe_toggle.html)
* **Local Live URL**: `http://localhost:5020/mockup_auto_pipeline_recipe_toggle.html` (atau port web app yang sedang aktif)

---

## Execution Task List
- [x] **Task 1: Perbarui Payload API Autonomous Pipeline untuk Menangkap `generate_recipe`** (`app/api/v2/recipes/autonomous-pipeline/route.js`)
- [x] **Task 2: Integrasikan Resolusi `generate_recipe` pada Mesin Autonomous Multiplier** (`lib/autonomous-engine.js`)
- [x] **Task 3: Teruskan Konfigurasi `generate_recipe` pada Auto Pipeline Scheduler Runner** (`lib/auto-pipeline-scheduler-runner.js`)
- [x] **Task 4: Harmonisasi Prompt Gemini AI Phase 2 untuk Resep Utuh + Smart Affiliate CTA** (`lib/prompts.js`)
- [x] **Task 5: Tambahkan Kontrol Switch Toggle di UI Auto Pipeline 1-Klik & Modal Skedul** (`app/auto-pipeline/page.js`)
- [x] **Task 6: Buat & Jalankan Unit Test Suite Otomatis** (`tests/auto-pipeline-multiplier-recipe.test.js`)
- [x] **Task 7: Verifikasi Cluster Health, Build Produksi Lokal, dan SOP Rilis Non-Interaktif**

---

## Before & After Code Snippets

### 1. `app/api/v2/recipes/autonomous-pipeline/route.js`
Menangkap `generate_recipe` dari request body dan mengoperkannya ke `overrides`.

#### Code Sebelum (Current/Before):
```javascript
    const isAffiliateEnabled = body.enable_affiliate_injection !== undefined
      ? Boolean(body.enable_affiliate_injection)
      : (body.post_link_affiliate !== undefined ? Boolean(body.post_link_affiliate) : true);

    const affiliateOverride = {
      enable_affiliate_injection: isAffiliateEnabled,
      post_link_affiliate: isAffiliateEnabled,
      affiliate_enabled: isAffiliateEnabled,
      is_bridging_active: isAffiliateEnabled
    };

    let result;
```

#### Code Sesudah (Proposed/After):
```javascript
    const isAffiliateEnabled = body.enable_affiliate_injection !== undefined
      ? Boolean(body.enable_affiliate_injection)
      : (body.post_link_affiliate !== undefined ? Boolean(body.post_link_affiliate) : true);

    const isRecipeEnabled = body.generate_recipe !== undefined
      ? Boolean(body.generate_recipe)
      : (body.generateRecipe !== undefined ? Boolean(body.generateRecipe) : undefined);

    const affiliateOverride = {
      enable_affiliate_injection: isAffiliateEnabled,
      post_link_affiliate: isAffiliateEnabled,
      affiliate_enabled: isAffiliateEnabled,
      is_bridging_active: isAffiliateEnabled
    };

    const recipeOverride = isRecipeEnabled !== undefined ? { generate_recipe: isRecipeEnabled } : {};

    let result;
```

---

### 2. `lib/autonomous-engine.js`
Mengekstrak `generate_recipe` di `executeAutonomousMultiplierPipeline` dan menyimpannya ke `re_multiplier_tasks` serta `bridgingConfig`.

#### Code Sebelum (Current/Before):
```javascript
  const bridgingConfig = {
    is_bridging_active: Boolean(product || presetConfig?.product_bridging?.is_bridging_active),
    productName: product?.product_name || '',
    productUrl: product?.product_url || '',
    targetProductId: product?.id || null,
    angleTitle: chosenAngle.title,
    hookText: chosenAngle.hook_text,
    targetClipsCount: effectiveTargetClipsCount,
    target_clips_count: effectiveTargetClipsCount,
    mandatoryOutroLine: effectiveMandatoryOutro,
    mandatory_outro_line: effectiveMandatoryOutro,
    visualMode: effectiveVisualMode,
    visual_mode: effectiveVisualMode,
    preset_key: presetKey,
    ...overrides.bridging
  };

  // ...

  await createMultiplierTask({
    id: taskId,
    batch_id: taskId,
    tenant_id: tenantId,
    deconstruct_asset_id: targetBlueprintId,
    target_product_id: product?.id || null,
    target_product_url: product?.product_url || '',
    vso_config_json: JSON.stringify(vsoConfig),
    bridging_config_json: JSON.stringify(bridgingConfig),
    audio_config_json: JSON.stringify(audioConfig),
    status: executionMode === 'full_autopilot' ? 'pending_resolution' : 'pending_review',
    enable_vo_audit: 1,
    campaign_name: `${brandName} - Multiplier: ${chosenAngle.title}`,
    brand_profile_id: brand?.id || null,
    account_name: brandName
  });
```

#### Code Sesudah (Proposed/After):
```javascript
  const effectiveGenerateRecipe = overrides.generate_recipe !== undefined
    ? (overrides.generate_recipe ? 1 : 0)
    : (presetConfig?.basic_strategy?.generate_recipe ? 1 : 0);

  const bridgingConfig = {
    is_bridging_active: Boolean(product || presetConfig?.product_bridging?.is_bridging_active),
    productName: product?.product_name || '',
    productUrl: product?.product_url || '',
    targetProductId: product?.id || null,
    angleTitle: chosenAngle.title,
    hookText: chosenAngle.hook_text,
    targetClipsCount: effectiveTargetClipsCount,
    target_clips_count: effectiveTargetClipsCount,
    mandatoryOutroLine: effectiveMandatoryOutro,
    mandatory_outro_line: effectiveMandatoryOutro,
    visualMode: effectiveVisualMode,
    visual_mode: effectiveVisualMode,
    preset_key: presetKey,
    generate_recipe: effectiveGenerateRecipe === 1,
    ...overrides.bridging
  };

  // ...

  await createMultiplierTask({
    id: taskId,
    batch_id: taskId,
    tenant_id: tenantId,
    deconstruct_asset_id: targetBlueprintId,
    target_product_id: product?.id || null,
    target_product_url: product?.product_url || '',
    vso_config_json: JSON.stringify(vsoConfig),
    bridging_config_json: JSON.stringify(bridgingConfig),
    audio_config_json: JSON.stringify(audioConfig),
    status: executionMode === 'full_autopilot' ? 'pending_resolution' : 'pending_review',
    enable_vo_audit: 1,
    campaign_name: `${brandName} - Multiplier: ${chosenAngle.title}`,
    brand_profile_id: brand?.id || null,
    account_name: brandName,
    generate_recipe: effectiveGenerateRecipe
  });
```

---

### 3. `lib/auto-pipeline-scheduler-runner.js`
Meneruskan konfigurasi `generate_recipe` dari jadwal rutin ke `executeAutonomousMultiplierPipeline`.

#### Code Sebelum (Current/Before):
```javascript
  if (pType === 'multiplier_campaign') {
    const cfg = pipelineConfig;

    return await executeAutonomousMultiplierPipeline({
      brandId: schedule.brand_id,
      deconstructAssetId: schedule.target_item_id || cfg.deconstruct_asset_id || null,
      productId: cfg.product_id || null,
      presetKey: schedule.preset_key || 'multiplier_deconstruct_remix',
      executionMode: 'full_autopilot',
      tenantId
    });
  }
```

#### Code Sesudah (Proposed/After):
```javascript
  if (pType === 'multiplier_campaign') {
    const cfg = pipelineConfig;

    return await executeAutonomousMultiplierPipeline({
      brandId: schedule.brand_id,
      deconstructAssetId: schedule.target_item_id || cfg.deconstruct_asset_id || null,
      productId: cfg.product_id || null,
      presetKey: schedule.preset_key || 'multiplier_deconstruct_remix',
      executionMode: 'full_autopilot',
      tenantId,
      overrides: {
        generate_recipe: cfg.generate_recipe !== undefined ? Boolean(cfg.generate_recipe) : undefined,
        ...(cfg.overrides || {})
      }
    });
  }
```

---

### 4. `lib/prompts.js`
Menjamin bahwa saat `isRecipeActive` bernilai `true`, `caption_facebook` dan `caption_bio` memuat teks resep lengkap sebelum CTA Shopee / Bio.

#### Code Sebelum (Current/Before):
```javascript
  "caption": "${isRecipeActive ? 'Teks resep/racikan lengkap (Bahan & Takaran, Langkah Pembuatan, Khasiat, Tips, CTA & Hashtags) yang 100% SINKRON dengan bahan adegan visual di atas dengan format emoji rapi (Bahasa ' + (targetLanguage === 'en-US' ? 'Inggris' : 'Indonesia') + ').' : 'Teks caption media sosial baru yang menarik dengan hashtag...'}",
  "caption_facebook": "Teks naskah caption lengkap khusus Facebook di mana tepat sebelum deretan hashtag disematkan CTA rekomendasi produk: '🛒 Rekomendasi Bahan/Produk Resmi:\\nBeli bahan/produk asli di Shopee resmi kami di sini:\\n{{AFFILIATE_LINK}}'",
  "caption_bio": "Teks naskah caption lengkap khusus platform selain Facebook (Instagram/TikTok/Shorts) di mana tepat sebelum deretan hashtag disematkan CTA ke bio: '👉 Info Bahan/Produk:\\nBahan & produk rekomendasi yang mimin pakai bisa kamu cek di Link di Bio ya! ✨'",
```

#### Code Sesudah (Proposed/After):
```javascript
  "caption": "${isRecipeActive ? 'Teks resep/racikan lengkap (Bahan & Takaran, Langkah Pembuatan, Khasiat, Tips, CTA & Hashtags) yang 100% SINKRON dengan bahan adegan visual di atas dengan format emoji rapi (Bahasa ' + (targetLanguage === 'en-US' ? 'Inggris' : 'Indonesia') + ').' : 'Teks caption media sosial baru yang menarik dengan hashtag...'}",
  "caption_facebook": "${isRecipeActive ? 'Teks naskah caption lengkap memuat seluruh teks resep (Bahan & Takaran, Langkah Pembuatan urut nomor, Khasiat & Tips) khusus Facebook di mana tepat sebelum deretan hashtag disematkan CTA rekomendasi produk: \\'🛒 Rekomendasi Bahan/Produk Resmi:\\\\nBeli bahan/produk asli di Shopee resmi kami di sini:\\\\n{{AFFILIATE_LINK}}\\' (Bahasa ' + (targetLanguage === 'en-US' ? 'Inggris' : 'Indonesia') + ').' : 'Teks naskah caption khusus Facebook di mana tepat sebelum deretan hashtag disematkan CTA rekomendasi produk: \\'🛒 Rekomendasi Bahan/Produk Resmi:\\\\nBeli bahan/produk asli di Shopee resmi kami di sini:\\\\n{{AFFILIATE_LINK}}\\'.'}",
  "caption_bio": "${isRecipeActive ? 'Teks naskah caption lengkap memuat seluruh teks resep (Bahan & Takaran, Langkah Pembuatan urut nomor, Khasiat & Tips) khusus platform selain Facebook (Instagram/TikTok/Shorts) di mana tepat sebelum deretan hashtag disematkan CTA ke bio: \\'👉 Info Bahan/Produk:\\\\nBahan & produk rekomendasi yang mimin pakai bisa kamu cek di Link di Bio ya! ✨\\' (Bahasa ' + (targetLanguage === 'en-US' ? 'Inggris' : 'Indonesia') + ').' : 'Teks naskah caption khusus platform selain Facebook di mana tepat sebelum deretan hashtag disematkan CTA ke bio: \\'👉 Info Bahan/Produk:\\\\nBahan & produk rekomendasi yang mimin pakai bisa kamu cek di Link di Bio ya! ✨\\'.'}",
```

---

### 5. `app/auto-pipeline/page.js`
Menambahkan state `instantGenerateRecipe` dan `schedGenerateRecipe`, kontrol checkbox di UI Tab 1 dan Modal Skedul, serta pengiriman parameter ke API.

#### Code Sebelum (Current/Before):
```javascript
  const [instantPostAffiliateLink, setInstantPostAffiliateLink] = useState(true);
  const [schedPostAffiliateLink, setSchedPostAffiliateLink] = useState(true);
```

#### Code Sesudah (Proposed/After):
```javascript
  const [instantPostAffiliateLink, setInstantPostAffiliateLink] = useState(true);
  const [schedPostAffiliateLink, setSchedPostAffiliateLink] = useState(true);
  const [instantGenerateRecipe, setInstantGenerateRecipe] = useState(true);
  const [schedGenerateRecipe, setSchedGenerateRecipe] = useState(true);
```

Dan pada `handleLaunchNow`:
```javascript
        body: JSON.stringify({
          pipeline_type: instantCampaignType,
          // ...
          post_link_affiliate: instantPostAffiliateLink,
          generate_recipe: (instantCampaignType === 'multiplier_campaign' || instantCampaignType === 'recipe_campaign') ? instantGenerateRecipe : undefined
        })
```

Serta pada boks kontrol Multiplier Tab 1 & Modal Skedul, menyematkan elemen switch:
```jsx
{(instantCampaignType === 'multiplier_campaign' || instantCampaignType === 'recipe_campaign') && (
  <div style={{
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.65rem',
    background: 'var(--surface-raised)',
    padding: '0.75rem 1rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-subtle)',
    marginBottom: '0.65rem'
  }}>
    <input
      type="checkbox"
      id="instantRecipeCheck"
      checked={instantGenerateRecipe}
      onChange={(e) => setInstantGenerateRecipe(e.target.checked)}
      style={{ width: '18px', height: '18px', accentColor: 'var(--status-purple)', cursor: 'pointer', marginTop: '2px' }}
    />
    <div>
      <label htmlFor="instantRecipeCheck" style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer', display: 'block' }}>
        🍳 Hasilkan Resep / Racikan Lengkap di Caption (Bahan, Takaran & Langkah)
      </label>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4, display: 'block', marginTop: '2px' }}>
        Saat aktif, AI akan menyusun teks resep terperinci (bahan, takaran presisi, langkah pembuatan, khasiat sehat) yang sinkron dengan video referensi dekonstruksi.
      </span>
    </div>
  </div>
)}
```
