# Rencana Implementasi: Fitur Custom Storyboard Submission via MCP (Claude-to-CF Studio Pipeline)

> [!NOTE]
> Rencana implementasi ini memungkinkan **Claude (atau LLM eksternal lainnya)** merancang storyboard kreatif secara lengkap di sesi percakapan/chat, kemudian mengirimkannya langsung melalui MCP ke CF Studio untuk dieksekusi oleh mesin produksi (TTS $\rightarrow$ G-Labs AI Video $\rightarrow$ FFmpeg Assembly $\rightarrow$ Omnichannel Publishing).

---

## Ringkasan Eksekutif & Arsitektur

Saat ini, seluruh tool pembuatan video di MCP (`cf_create_product_video`, `cf_create_editorial_video`, `cf_create_recipe_video`, `cf_create_multiplier_video`, `cf_create_campaign`) bekerja dengan skema:
$$\text{User/Claude mengirimkan Brief} \longrightarrow \text{Gemini AI di CF Studio merancang Storyboard} \longrightarrow \text{Rendering}$$

Dengan fitur baru **Custom Storyboard Engine (`cf_submit_custom_storyboard`)**, alurnya menjadi:
$$\text{Claude merancang Storyboard di Chat} \longrightarrow \text{Kirim via MCP} \longrightarrow \text{Bypass Generator (Tahap 1)} \longrightarrow \text{TTS} \rightarrow \text{Veo Video} \rightarrow \text{FFmpeg} \rightarrow \text{Publish}$$

### Komponen Utama:
1. **Pipeline Service (`lib/custom-storyboard-pipeline.js`)**: Validasi struktur storyboard Claude, format naskah & prompt optical stack, pembuatan campaign & item di database, serta inisiasi worker.
2. **Autonomous Pipeline Endpoint (`app/api/v2/recipes/autonomous-pipeline/route.js`)**: Penambahan handler `pipeline_type: 'custom_storyboard'`.
3. **MCP Tool Registration (`apps/mcp/tools.mjs`)**: Registrasi tool `cf_submit_custom_storyboard` lengkap dengan skema Zod validasi.
4. **Dokumentasi MCP (`apps/mcp/README.md`)**: Panduan pemanggilan tool untuk Claude Desktop / Antigravity IDE.
5. **Unit Test Suite (`tests/test-custom-storyboard-mcp.test.js`)**: Verifikasi integritas skema storyboard dan pipeline execution.

---

## Execution Task List
- [x] **Task 1: Buat Pipeline Engine `lib/custom-storyboard-pipeline.js`** untuk memvalidasi dan memproses injeksi custom storyboard langsung ke status produksi.
- [x] **Task 2: Ekspor Engine di `lib/autonomous-engine.js`** untuk konsistensi ekosistem engine CF Studio.
- [x] **Task 3: Tambahkan Handler `custom_storyboard` pada Route `app/api/v2/recipes/autonomous-pipeline/route.js`**.
- [x] **Task 4: Daftarkan Tool `cf_submit_custom_storyboard` pada MCP Adapter `apps/mcp/tools.mjs`**.
- [x] **Task 5: Perbarui Dokumentasi MCP Server pada `apps/mcp/README.md`**.
- [x] **Task 6: Buat Unit Test Suite `tests/test-custom-storyboard-mcp.test.js`**.
- [x] **Task 7: Uji Coba Verifikasi, Build Check, dan Rilis Non-Interaktif**.

---

## Before & After Code Snippets

### 1. `lib/custom-storyboard-pipeline.js` (File Baru)

#### Code Sesudah (Proposed/After):
```javascript
import { v4 as uuidv4 } from 'uuid';
import { getDb } from './db.js';
import { startCampaignScheduler } from './scheduler.js';
import { approvePillarCampaignItemUnchanged } from './pillar-campaign-approval.js';

export async function executeCustomStoryboardPipeline({
  storyboard,
  tenantId = 'default_tenant',
  executionMode = 'full_autopilot'
}) {
  if (!storyboard || typeof storyboard !== 'object') {
    throw new Error('Storyboard payload wajib berupa objek JSON.');
  }

  const title = (storyboard.title || 'Untitled Custom Storyboard').trim();
  const scenes = Array.isArray(storyboard.scenes) ? storyboard.scenes : [];
  if (scenes.length === 0) {
    throw new Error('Storyboard wajib memiliki minimal 1 scene.');
  }

  const db = getDb();
  const campaignId = `cst_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
  const videoDna = storyboard.video_dna || {};
  const aspectRatio = videoDna.aspect_ratio || '9:16';
  const visualStyle = videoDna.visual_style || 'Cinematic';

  // 1. Ingest ke pillar_campaigns
  await db.prepare(`
    INSERT INTO pillar_campaigns (
      id, campaign_name, tenant_id, execution_mode, status, aspect_ratio, visual_style,
      target_ai_engine, voice_persona, speed_control, target_clips_count, created_at
    ) VALUES (?, ?, ?, ?, 'running', ?, ?, ?, ?, ?, ?, ?)
  `).run(
    campaignId,
    `[Custom Storyboard] ${title}`,
    tenantId,
    executionMode,
    aspectRatio,
    visualStyle,
    videoDna.target_ai_engine || 'Google Veo (8s)',
    videoDna.voice_persona || 'Aoede',
    videoDna.speed_control || 2.5,
    scenes.length,
    new Date().toISOString()
  );

  // 2. Format new_video_plan_json
  const newVideoPlan = scenes.map((s, idx) => ({
    clip_index: s.scene_index || (idx + 1),
    visual_action: s.visual_action || s.visual_prompt || '',
    new_vo: s.voiceover_text || '',
    t2i_prompt: s.visual_prompt || s.t2i_prompt || '',
    i2v_prompt: s.i2v_prompt || s.camera_movement || 'Cinematic subtle motion',
    duration: s.duration_seconds || 4
  }));

  const resultJson = {
    title,
    video_dna: videoDna,
    storyboard: scenes,
    social_media_package: storyboard.social_media_package || {}
  };

  // 3. Simpan item langsung dengan generation_status: 'completed'
  const insertItem = await db.prepare(`
    INSERT INTO pillar_campaign_items (
      campaign_id, sequence, generation_status, tts_status, visual_status, ffmpeg_status,
      workflow_status, new_video_plan_json, result_json, video_dna_json, created_at
    ) VALUES (?, 1, 'completed', 'pending', 'pending', 'pending', ?, ?, ?, ?, ?)
  `).run(
    campaignId,
    executionMode === 'full_autopilot' ? 'production_processing' : 'ready_for_review',
    JSON.stringify(newVideoPlan),
    JSON.stringify(resultJson),
    JSON.stringify(videoDna),
    new Date().toISOString()
  );

  const itemId = insertItem.lastInsertRowid;

  if (executionMode === 'full_autopilot' && itemId) {
    await approvePillarCampaignItemUnchanged(itemId).catch(() => {});
  }

  startCampaignScheduler();

  return {
    success: true,
    campaign_id: campaignId,
    item_id: itemId,
    campaign_name: title,
    status: 'production_processing',
    total_scenes: scenes.length
  };
}
```

---

### 2. `app/api/v2/recipes/autonomous-pipeline/route.js` — Penambahan Cabang `custom_storyboard`

#### Code Sebelum (Current/Before):
```javascript
    let result;
    if (pipelineType === 'product_campaign') {
      result = await executeAutonomousProductPipeline({
        brandId: body.brand_id || body.brandId,
        productId: body.product_id || body.productId,
...
    } else if (pipelineType === 'recipe_labs') {
      result = await executeAutonomousRecipeLabsPipeline({
...
      });
    } else {
      return NextResponse.json({ success: false, error: `pipeline_type '${pipelineType}' tidak didukung` }, { status: 400 });
    }
```

#### Code Sesudah (Proposed/After):
```javascript
    let result;
    if (pipelineType === 'custom_storyboard') {
      const { executeCustomStoryboardPipeline } = await import('../../../../../lib/custom-storyboard-pipeline.js');
      result = await executeCustomStoryboardPipeline({
        storyboard: body.storyboard || body,
        tenantId,
        executionMode: body.execution_mode || 'full_autopilot'
      });
    } else if (pipelineType === 'product_campaign') {
      result = await executeAutonomousProductPipeline({
        brandId: body.brand_id || body.brandId,
...
    } else if (pipelineType === 'recipe_labs') {
      result = await executeAutonomousRecipeLabsPipeline({
...
      });
    } else {
      return NextResponse.json({ success: false, error: `pipeline_type '${pipelineType}' tidak didukung` }, { status: 400 });
    }
```

---

### 3. `apps/mcp/tools.mjs` — Registrasi Tool `cf_submit_custom_storyboard`

#### Code Sebelum (Current/Before):
```javascript
  // Engine 5: Recipe Labs Text & Photo Post (recipe_labs)
  register(
    'cf_create_recipe_labs_post',
    'Create a Recipe Labs social media post: Facebook recipe article + 4 AI composite grid images (no video rendering).',
    {
...
    },
    false,
    ({ idempotency_key, ...args }) =>
      request('/api/v2/recipes/autonomous-pipeline', {
        key: idempotency_key,
        body: { pipeline_type: 'recipe_labs', ...args }
      })
  );
```

#### Code Sesudah (Proposed/After):
```javascript
  // Engine 5: Recipe Labs Text & Photo Post (recipe_labs)
  register(
    'cf_create_recipe_labs_post',
    'Create a Recipe Labs social media post: Facebook recipe article + 4 AI composite grid images (no video rendering).',
    {
...
    },
    false,
    ({ idempotency_key, ...args }) =>
      request('/api/v2/recipes/autonomous-pipeline', {
        key: idempotency_key,
        body: { pipeline_type: 'recipe_labs', ...args }
      })
  );

  // Engine 6: Custom Storyboard Submission (Claude-to-Video Engine)
  register(
    'cf_submit_custom_storyboard',
    'Submit a pre-crafted custom storyboard directly to CF Studio for physical rendering (TTS voiceover, AI video clips per scene, and FFmpeg assembly).',
    {
      idempotency_key: z.string().trim().min(1).max(128).optional(),
      brand_id: z.string().max(100).optional(),
      title: z.string().trim().min(1).max(300),
      video_dna: z.object({
        aspect_ratio: z.enum(['9:16', '16:9', '1:1']).default('9:16'),
        visual_style: z.string().default('Cinematic'),
        visual_mode: z.enum(['hybrid_lock', 'pure_t2v']).default('hybrid_lock'),
        voice_persona: z.string().default('Aoede'),
        speed_control: z.number().default(2.5),
        target_ai_engine: z.string().default('Google Veo (8s)')
      }).optional(),
      scenes: z.array(z.object({
        scene_index: z.number().int().min(1).max(12),
        voiceover_text: z.string().trim().min(1),
        visual_prompt: z.string().trim().min(1),
        i2v_prompt: z.string().optional(),
        camera_movement: z.string().optional(),
        duration_seconds: z.number().min(1).max(15).default(4)
      })).min(1).max(12),
      social_media_package: z.object({
        caption: z.string().optional(),
        hashtags: z.array(z.string()).optional(),
        caption_facebook: z.string().optional(),
        caption_bio: z.string().optional()
      }).optional(),
      execution_mode: z.enum(['full_autopilot', 'creative_review']).default('full_autopilot')
    },
    false,
    ({ idempotency_key, ...storyboard }) =>
      request('/api/v2/recipes/autonomous-pipeline', {
        key: idempotency_key,
        body: {
          pipeline_type: 'custom_storyboard',
          storyboard
        }
      })
  );
```
