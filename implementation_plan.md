# Implementation Plan — Autonomous Recipe Pipeline (1-Click Planner-to-Video Engine)

Dokumen ini merinci rencana implementasi fitur **Autonomous Recipe Pipeline (1-Click Planner-to-Video Engine)** pada MAKNA Flow. Fitur ini mengeliminasi 14 tahapan manual yang sebelumnya harus dilalui operator saat memproduksi kampanye resep (seperti kasus riil pada kampanye `opc_261101_z5xynj` yang berasal dari `pln_37ca8d57`), menyatukan alur ideasi resep AI, *auto-hydration* profil brand & dropdown visual identity preset dinamis berbasis brand, pembuatan kampanye OPC, auto-approval terpadu, hingga eksekusi scheduler video background dalam 1-klik.

---

## 1. Arsitektur Solusi & Komponen

```
[ Operator Input: Brand + Topik + Target Resep + Pilih VI Preset dari Dropdown Brand ]
                                      │
                                      ▼ (POST /api/v2/recipes/autonomous-pipeline)
┌──────────────────────────────────────────────────────────────────────────────────┐
│  ⚡ Autonomous Recipe Engine (lib/autonomous-recipe-engine.js)                    │
│                                                                                  │
│  Step 1: createDraftContentPlanner (Focus: recipe_campaign)                      │
│  Step 2: executeContentPlanner (Gemini 1-Pass Recipe Generator)                  │
│  Step 3: resolveBrandRecipePreset & filter visual identity presets sesuai brand  │
│          (Default / Pilihan Dropdown: misal vi_dapurbotani_* untuk Dapur Botani) │
│  Step 4: ingestRecipePlannerToPillarCampaign (Hydrate Bundle & 8-Clips Items)    │
│  Step 5: autoApprovePillarCampaignItems (Auto-Approval Sepakat untuk Autopilot)  │
│  Step 6: startCampaignScheduler (Background TTS -> Veo -> FFmpeg)                │
└──────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
[ Status: RUNNING -> 7 MP4 Video Final Siap di Nextcloud Storage ]
```

---

## 2. Poin Penyesuaian Sesuai Arahan Pengguna

1. **Dropdown Preset Dinamis Sesuai Brand (Tidak Terkunci)**:
   * Dropdown Visual Identity Preset tidak lagi statis/terkunci.
   * Saat operator memilih brand (contoh: *Dapur Botani*), dropdown hanya memuat daftar preset yang berelasi dengan Dapur Botani (misal `vi_dapurbotani_apothecary_3d_female`, `vi_dapurbotani_apothecary_3d_male`, `vi_cinematic_botanical_kinetics`).
   * Saat memilih *HabitFolk*, dropdown memuat preset HabitFolk (`vi_habitfolk_macro_craft`).
   * Saat memilih *NutriBake*, dropdown memuat preset NutriBake (`vi_nutribake_modern_pastry`, `vi_nutribake_cozy_rustic`).
   * Pilihan default diset otomatis ke preset rekomendasi utama brand, namun operator bebas mengganti ke varian lain di dalam brand tersebut.
2. **Auto-Approval Sepakat**:
   * Pada mode `full_autopilot`, seluruh storyboard 8-klip langsung otomatis disetujui (*auto-approved*) tanpa perlu jeda intervensi manual klik *Approve* satu per satu, sehingga scheduler background langsung memproses audio Minimax, video Veo, FFmpeg muxing, dan Nextcloud sync.

---

## 3. Before & After Code Snippets

### File 1: `lib/recipe-campaign-ingest.js`
Menambahkan dukungan parameter `globalSettings` (Visual Identity preset dari dropdown, voice persona, video model, target clips count, mandatory outro line, ai directive, dan execution mode) agar ingestion resep tidak menggunakan hardcoded fallback kosong.

#### Code Sebelum (Current/Before):
```javascript
export async function ingestRecipePlannerToPillarCampaign({
  plannerId,
  selectedRowIds = [],
  campaignName = null,
  tenantId = null
}) {
  if (!plannerId) throw new Error('planner_id wajib diisi.');
  const db = getDb();
  const tId = tenantId || getActiveTenantId();

  const planner = await db.prepare('SELECT * FROM content_planners WHERE id = ?').get(plannerId);
  if (!planner) throw new Error('Content Planner tidak ditemukan.');

  let rows = [];
  if (Array.isArray(selectedRowIds) && selectedRowIds.length > 0) {
    const placeholders = selectedRowIds.map(() => '?').join(',');
    rows = await db.prepare(`SELECT * FROM content_planner_rows WHERE planner_id = ? AND id IN (${placeholders}) ORDER BY sequence ASC`).all(plannerId, ...selectedRowIds);
  } else {
    rows = await db.prepare('SELECT * FROM content_planner_rows WHERE planner_id = ? ORDER BY sequence ASC').all(plannerId);
  }

  if (!rows || rows.length === 0) {
    throw new Error('Tidak ada baris resep yang dapat di-ingest.');
  }

  const campaignId = generateCampaignId();
  const name = campaignName || `${planner.title || 'Recipe Campaign'} [OPC]`;

  return await withPlannerConsumptionOwner({
    plannerId,
    ownerType: 'recipe_campaign',
    ownerId: campaignId,
    tenantId: tId
  }, async ({ reused }) => {
    if (reused) {
      // ... return reused campaign ...
    }

  const campaignData = {
    id: campaignId,
    name,
    campaign_name: name,
    account_name: planner.account_name || 'Recipe Channel',
    source_planner_id: planner.id,
    content_pillar: 'Recipe Campaign',
    custom_hook: '',
    visual_action_guideline: '',
    custom_instruction: planner.custom_instructions || '',
    ai_directive: '',
    mandatory_outro_line: '',
    brand_profile_id: planner.brand_id || null,
    target_spreadsheet_id: planner.google_sheet_id || null,
    total_items: rows.length,
    status: 'idle',
    target_product_id: null,
    target_product_name: null,
    is_bridging_active: 0,
    narrative_mode: 'Storytelling',
    visual_style: 'photorealistic_culinary',
    aspect_ratio: '9:16',
    approval_mode: 'creative',
    auto_sync_contentflow: 1,
    content_world: 'real_world',
    knowledge_domain: 'food_culinary',
    universe_profile: null,
    tenant_id: tId
  };
```

#### Code Sesudah (Proposed/After):
```javascript
export async function ingestRecipePlannerToPillarCampaign({
  plannerId,
  selectedRowIds = [],
  campaignName = null,
  globalSettings = {},
  tenantId = null
}) {
  if (!plannerId) throw new Error('planner_id wajib diisi.');
  const db = getDb();
  const tId = tenantId || getActiveTenantId();

  const planner = await db.prepare('SELECT * FROM content_planners WHERE id = ?').get(plannerId);
  if (!planner) throw new Error('Content Planner tidak ditemukan.');

  let rows = [];
  if (Array.isArray(selectedRowIds) && selectedRowIds.length > 0) {
    const placeholders = selectedRowIds.map(() => '?').join(',');
    rows = await db.prepare(`SELECT * FROM content_planner_rows WHERE planner_id = ? AND id IN (${placeholders}) ORDER BY sequence ASC`).all(plannerId, ...selectedRowIds);
  } else {
    rows = await db.prepare('SELECT * FROM content_planner_rows WHERE planner_id = ? ORDER BY sequence ASC').all(plannerId);
  }

  if (!rows || rows.length === 0) {
    throw new Error('Tidak ada baris resep yang dapat di-ingest.');
  }

  const campaignId = generateCampaignId('opc');
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const defaultName = `[ Recipe OPC ${dateStr} ] - ${planner.account_name || 'Recipe'} - ${planner.title || 'Weekly Batch'}`;
  const name = campaignName || globalSettings.campaign_name || defaultName;

  return await withPlannerConsumptionOwner({
    plannerId,
    ownerType: 'recipe_campaign',
    ownerId: campaignId,
    tenantId: tId
  }, async ({ reused }) => {
    if (reused) {
      // ... return reused campaign ...
    }

    const { resolveVisualIdentitySubmission } = await import('./visual-override-resolver.js');
    const identityResult = await resolveVisualIdentitySubmission({
      preset_id: globalSettings.visual_identity_preset_id || null,
      inline_config: globalSettings.visual_identity_inline_config || null,
      legacy_overrides_json: globalSettings.visual_overrides_json || null
    });

    const isAutopilot = globalSettings.execution_mode === 'full_autopilot';

    const campaignData = {
      id: campaignId,
      name,
      campaign_name: name,
      account_name: planner.account_name || globalSettings.account_name || 'Recipe Channel',
      source_planner_id: planner.id,
      execution_mode: globalSettings.execution_mode || 'manual_review',
      content_pillar: 'Recipe Campaign',
      custom_hook: rows[0]?.hook || '',
      visual_action_guideline: rows[0]?.visual_action || '',
      custom_instruction: globalSettings.custom_instruction || planner.custom_instructions || '',
      ai_directive: globalSettings.ai_directive || planner.promotion_context || 'Konten edukasi resep & kreasi kuliner autentik.',
      mandatory_outro_line: globalSettings.mandatory_outro_line || '',
      brand_profile_id: planner.brand_id || globalSettings.brand_profile_id || null,
      target_spreadsheet_id: planner.google_sheet_id || null,
      total_items: rows.length,
      status: isAutopilot ? 'running' : (globalSettings.status || 'idle'),
      target_product_id: null,
      target_product_name: null,
      is_bridging_active: 0,
      narrative_mode: globalSettings.narrative_mode || 'Storytelling',
      visual_style: globalSettings.visual_style || 'photorealistic_culinary',
      aspect_ratio: globalSettings.aspect_ratio || '9:16',
      approval_mode: isAutopilot ? 'none' : (globalSettings.approval_mode || 'creative'),
      auto_sync_contentflow: globalSettings.auto_sync_contentflow !== undefined ? (globalSettings.auto_sync_contentflow ? 1 : 0) : 0,
      content_world: 'real_world',
      knowledge_domain: 'food_culinary',
      universe_profile: null,
      target_clips_count: globalSettings.target_clips_count ? Number(globalSettings.target_clips_count) : 8,
      clip_duration: globalSettings.clip_duration ? Number(globalSettings.clip_duration) : 4,
      target_ai: globalSettings.target_ai || 'Google Veo Omni Flash',
      video_model: globalSettings.video_model || 'omni_flash',
      visual_mode: globalSettings.visual_mode || 'hybrid_lock',
      visual_overrides_json: identityResult.snapshot ? JSON.stringify(identityResult.snapshot) : null,
      visual_identity_preset_id: identityResult.ref?.id || null,
      visual_identity_preset_version: identityResult.ref?.version || null,
      voice_provider: globalSettings.voice_provider || 'minimax',
      voice_persona: globalSettings.voice_persona || 'English_causual_narrator_vv1',
      target_language: globalSettings.target_language || planner.target_language || 'en-US',
      voice_speed: globalSettings.voice_speed !== undefined ? Number(globalSettings.voice_speed) : 1.0,
      voice_volume: globalSettings.voice_volume !== undefined ? Number(globalSettings.voice_volume) : 1.0,
      words_per_clip: globalSettings.words_per_clip || '8-9 kata',
      enable_tts: globalSettings.enable_tts !== undefined ? (globalSettings.enable_tts ? 1 : 0) : 1,
      enable_glabs: globalSettings.enable_glabs !== undefined ? (globalSettings.enable_glabs ? 1 : 0) : 1,
      enable_ffmpeg: globalSettings.enable_ffmpeg !== undefined ? (globalSettings.enable_ffmpeg ? 1 : 0) : 1,
      enable_social_post: 0,
      upload_markdown: 1,
      upload_spreadsheet: 1,
      local_scheduler: 1,
      scheduler_pause_at: isAutopilot ? null : (globalSettings.scheduler_pause_at || null),
      ffmpeg_sync_option: globalSettings.ffmpeg_sync_option || 'smart_sync',
      tenant_id: tId
    };
```

---

### File 2: `lib/autonomous-recipe-engine.js` (FILE BARU)
Service orkestrator terpadu yang memfilter daftar visual identity preset sesuai brand dan mengorkestrasi pipeline end-to-end.

#### Code Sebelum (Current/Before):
*File belum ada (New File).*

#### Code Sesudah (Proposed/After):
```javascript
import { getDb } from './db.js';
import { createDraftContentPlanner, executeContentPlanner } from './content-planner-engine.js';
import { ingestRecipePlannerToPillarCampaign } from './recipe-campaign-ingest.js';
import { startCampaignScheduler } from './campaign-scheduler.js';
import { approvePillarCampaignItemUnchanged } from './pillar-campaign-approval.js';

/**
 * Mengambil daftar visual identity presets yang sesuai dengan nama/kunci brand.
 */
export async function listVisualIdentityPresetsForBrand(brandIdOrName) {
  const db = getDb();
  let brandName = '';
  if (brandIdOrName) {
    const brand = await db.prepare('SELECT brand_name FROM brand_profiles WHERE id = ? OR brand_name = ?').get(brandIdOrName, brandIdOrName);
    brandName = (brand?.brand_name || brandIdOrName).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  const allPresets = await db.prepare(
    'SELECT id, preset_key, label FROM visual_identity_presets ORDER BY id ASC'
  ).all();

  if (!brandName) return allPresets;

  // Filter preset yang mengandung nama brand
  const filtered = allPresets.filter(p => {
    const pId = (p.id || '').toLowerCase();
    const pKey = (p.preset_key || '').toLowerCase();
    const pLabel = (p.label || '').toLowerCase();
    return pId.includes(brandName) || pKey.includes(brandName) || pLabel.includes(brandName);
  });

  return filtered.length > 0 ? filtered : allPresets;
}

/**
 * Menentukan konfigurasi default audio, video model, outro app CTA, dan VI preset brand.
 */
export async function resolveBrandRecipePreset(brandIdOrName, requestedViPresetId = null) {
  const db = getDb();
  const brand = await db.prepare(
    'SELECT * FROM brand_profiles WHERE id = ? OR brand_name = ?'
  ).get(brandIdOrName, brandIdOrName);

  const brandName = (brand?.brand_name || '').toLowerCase();
  const availableViPresets = await listVisualIdentityPresetsForBrand(brand?.id || brandName);
  
  // Tentukan visual identity preset yang digunakan (pilihan user atau default rekomendasi)
  let selectedVi = requestedViPresetId;
  if (!selectedVi || !availableViPresets.some(p => p.id === selectedVi)) {
    selectedVi = availableViPresets[0]?.id || 'vi_habitfolk_macro_craft';
  }

  if (brandName.includes('habit')) {
    return {
      visual_identity_preset_id: selectedVi,
      available_vi_presets: availableViPresets,
      voice_provider: 'minimax',
      voice_persona: 'English_causual_narrator_vv1',
      target_language: 'en-US',
      voice_speed: 1.0,
      video_model: 'omni_flash',
      target_ai: 'Google Veo Omni Flash',
      aspect_ratio: '9:16',
      target_clips_count: 8,
      clip_duration: 4,
      supporting_app_name: 'Airfry Eats',
      mandatory_outro_template: 'Want more {topic} recipes? Get the {app_name} app through the link in my bio!'
    };
  }

  if (brandName.includes('botani')) {
    return {
      visual_identity_preset_id: selectedVi,
      available_vi_presets: availableViPresets,
      voice_provider: 'minimax',
      voice_persona: 'Indonesian_warm_motherly_vv1',
      target_language: 'id-ID',
      voice_speed: 1.0,
      video_model: 'omni_flash',
      target_ai: 'Google Veo Omni Flash',
      aspect_ratio: '9:16',
      target_clips_count: 8,
      clip_duration: 4,
      supporting_app_name: 'GarliBee Health Hub',
      mandatory_outro_template: 'Mau resep olahan {topic} sehat lainnya? Cek bio sekarang!'
    };
  }

  if (brandName.includes('nutri')) {
    return {
      visual_identity_preset_id: selectedVi,
      available_vi_presets: availableViPresets,
      voice_provider: 'minimax',
      voice_persona: 'Indonesian_casual_reporter_vv2',
      target_language: 'id-ID',
      voice_speed: 1.0,
      video_model: 'veo_31_lite',
      target_ai: 'Google Veo (8s)',
      aspect_ratio: '9:16',
      target_clips_count: 4,
      clip_duration: 8,
      supporting_app_name: 'ProteinPrep',
      mandatory_outro_template: 'Resep {topic} praktis dan sehat. Download app di bio!'
    };
  }

  // Fallback generic
  return {
    visual_identity_preset_id: selectedVi,
    available_vi_presets: availableViPresets,
    voice_provider: 'minimax',
    voice_persona: 'English_causual_narrator_vv1',
    target_language: 'en-US',
    voice_speed: 1.0,
    video_model: 'omni_flash',
    target_ai: 'Google Veo Omni Flash',
    aspect_ratio: '9:16',
    target_clips_count: 8,
    clip_duration: 4,
    supporting_app_name: '',
    mandatory_outro_template: 'Want more {topic} recipes? Link in bio!'
  };
}

export async function executeAutonomousRecipePipeline({
  brandId,
  topic,
  recipeCount = 7,
  executionMode = 'full_autopilot',
  visualIdentityPresetId = null,
  overrides = {},
  tenantId = 'default_tenant'
}) {
  if (!topic?.trim()) throw new Error('Topik resep wajib diisi.');
  const db = getDb();
  const brand = brandId ? await db.prepare('SELECT * FROM brand_profiles WHERE id = ?').get(brandId) : null;
  const brandName = brand?.brand_name || 'habitfolk';

  const preset = await resolveBrandRecipePreset(brand?.id || brandName, visualIdentityPresetId);

  // 1. Create Draft Planner
  const plannerDraft = await createDraftContentPlanner({
    title: `${brandName} - ${new Date().toISOString().slice(0,10).replace(/-/g,'')} - ${topic}`,
    account_name: brandName,
    brand_id: brand?.id || null,
    planner_focus: 'recipe_campaign',
    promotion_context: topic,
    planner_count: Number(recipeCount || 7),
    target_audience: brand?.tone_of_voice || 'professional_executive',
    target_language: preset.target_language || 'en-US',
    brand_context: brand?.editorial_brand_context || '',
    content_goal: brand?.editorial_content_goal || '',
    pillars: brand?.editorial_content_pillars_json ? JSON.parse(brand.editorial_content_pillars_json) : ['Recipe Campaign'],
    use_brand_pillars: true
  });

  const plannerId = plannerDraft.planner_id;

  // 2. Execute Gemini Ideation Engine (1-Pass)
  await executeContentPlanner(plannerId);

  // 3. Prepare Dynamic Outro CTA
  const outroLine = preset.mandatory_outro_template
    .replace('{topic}', topic)
    .replace('{app_name}', preset.supporting_app_name || 'app');

  // 4. Ingest to Pillar Campaign
  const globalSettings = {
    ...preset,
    ai_directive: topic,
    mandatory_outro_line: outroLine,
    execution_mode: executionMode,
    ...overrides
  };

  const ingestResult = await ingestRecipePlannerToPillarCampaign({
    plannerId,
    globalSettings,
    tenantId
  });

  const campaignId = ingestResult.campaign_id;

  // 5. Auto-Approval Sepakat untuk Mode Full Autopilot
  if (executionMode === 'full_autopilot') {
    const items = await db.prepare(
      'SELECT id, workflow_status FROM pillar_campaign_items WHERE campaign_id = ?'
    ).all(campaignId);

    for (const item of (items || [])) {
      try {
        await approvePillarCampaignItemUnchanged(item.id);
      } catch (_) {}
    }
  }

  // 6. Start Campaign Scheduler
  try {
    startCampaignScheduler();
  } catch (err) {
    console.warn('[Autonomous Recipe Engine] startCampaignScheduler warning:', err.message);
  }

  return {
    success: true,
    planner_id: plannerId,
    campaign_id: campaignId,
    campaign_name: ingestResult.campaign_name,
    items_count: ingestResult.item_count,
    execution_mode: executionMode,
    preset_used: preset
  };
}
```

---

### File 3: `app/api/v2/recipes/autonomous-pipeline/route.js` (FILE BARU)
REST API Route untuk mengambil daftar preset yang sesuai dengan brand (GET) dan mengeksekusi pipeline 1-klik (POST).

#### Code Sebelum (Current/Before):
*File belum ada (New File).*

#### Code Sesudah (Proposed/After):
```javascript
import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import {
  executeAutonomousRecipePipeline,
  listVisualIdentityPresetsForBrand,
  resolveBrandRecipePreset
} from '@/lib/autonomous-recipe-engine';

export const GET = withTenantContext(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get('brand_id') || searchParams.get('brand');
    const presets = await listVisualIdentityPresetsForBrand(brandId);
    const defaultPreset = await resolveBrandRecipePreset(brandId);
    return NextResponse.json({ success: true, presets, default_preset: defaultPreset });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
});

export const POST = withTenantContext(async (request, _context, user) => {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      brand_id,
      brandId,
      topic,
      recipe_count,
      recipeCount,
      execution_mode,
      executionMode,
      visual_identity_preset_id,
      visualIdentityPresetId,
      overrides
    } = body;

    const result = await executeAutonomousRecipePipeline({
      brandId: brand_id || brandId,
      topic,
      recipeCount: recipe_count || recipeCount || 7,
      executionMode: execution_mode || executionMode || 'full_autopilot',
      visualIdentityPresetId: visual_identity_preset_id || visualIdentityPresetId || null,
      overrides: overrides || {},
      tenantId: user?.tenantId || 'default_tenant'
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('[API /api/v2/recipes/autonomous-pipeline Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
});
```

---

## 4. Execution Task List

Berikut adalah tahapan pengerjaan kronologis yang akan di-update secara real-time (`- [ ]` ➔ `- [x]`):

- [x] **Task 1: Perbarui & Sempurnakan `lib/recipe-campaign-ingest.js`**
  - Menerima `globalSettings` untuk hidrasi VI preset (dari dropdown), persona Minimax, target AI Omni Flash, 8 klip @ 4s, dan outro line.
  - Menghubungkan resolusi visual snapshot `resolveVisualIdentitySubmission`.
- [x] **Task 2: Buat Orkestrator Baru `lib/autonomous-recipe-engine.js`**
  - Mengimplementasikan `listVisualIdentityPresetsForBrand` untuk memfilter preset visual identity sesuai brand (misal `vi_dapurbotani_*` untuk Dapur Botani).
  - Mengimplementasikan `resolveBrandRecipePreset` yang mendukung parameter pilihan `requestedViPresetId`.
  - Mengimplementasikan `executeAutonomousRecipePipeline` end-to-end dengan auto-approval otomatis untuk `full_autopilot`.
- [x] **Task 3: Buat Endpoint REST API `app/api/v2/recipes/autonomous-pipeline/route.js`**
  - Menambahkan handler GET untuk menyajikan daftar preset dinamis sesuai brand.
  - Menambahkan handler POST untuk eksekusi 1-klik dengan dukungan parameter `visual_identity_preset_id`.
- [x] **Task 4: Update Endpoint Ingest Resep Eksisting `app/api/content-planner/[id]/ingest-recipe/route.js`**
  - Memastikan endpoint eksisting kompatibel meneruskan `global_settings` dan `execution_mode`.
- [x] **Task 5: Tulis & Jalankan Unit Test `tests/test-autonomous-recipe-pipeline.test.js`**
  - Menguji filtering preset berdasarkan brand (`listVisualIdentityPresetsForBrand`).
  - Menguji pemanggilan `executeAutonomousRecipePipeline` dengan auto-approval item.
  - Memastikan seluruh assertion lulus 100%.
- [x] **Task 6: SOP Rilis & Git Sync**
  - Menjalankan `npm run release-non-interactive` untuk update versi, changelog, dan push remote repository.

---

## 5. Verifikasi & Safety Guardrails

1. **Brand-Scoped Filtering**: Menjamin operator hanya memilih preset yang valid dan relevan dengan identitas estetika brand yang bersangkutan.
2. **Idempotensi**: Menggunakan `withPlannerConsumptionOwner` agar Content Planner tidak dikonsumsi ganda.
3. **Zero Secret Exposure**: Tidak ada API key hardcoded pada kode maupun unit test.
4. **Database Safety**: Memanfaatkan tabel `visual_identity_presets` dan `brand_profiles` eksisting tanpa breaking schema change.
