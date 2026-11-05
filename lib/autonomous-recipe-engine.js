import { getDb } from './db.js';
import { createDraftContentPlanner, executeContentPlanner } from './content-planner-engine.js';
import { ingestRecipePlannerToPillarCampaign } from './recipe-campaign-ingest.js';
import { startCampaignScheduler } from './campaign-scheduler.js';
import { approvePillarCampaignItemUnchanged } from './pillar-campaign-approval.js';

/**
 * Mengambil daftar visual identity presets yang sesuai dengan nama/kunci brand.
 * @param {string} brandIdOrName - UUID brand atau nama brand
 * @returns {Promise<Array<{id: string, preset_key: string, label: string}>>}
 */
export async function listVisualIdentityPresetsForBrand(brandIdOrName) {
  const db = getDb();
  let brandName = '';
  if (brandIdOrName) {
    const brand = await db.prepare(
      'SELECT id, brand_name FROM brand_profiles WHERE id = ? OR brand_name = ?'
    ).get(brandIdOrName, brandIdOrName);
    brandName = brand?.brand_name || brandIdOrName;
  }

  const allPresets = await db.prepare(
    'SELECT id, preset_key, label FROM visual_identity_presets ORDER BY id ASC'
  ).all();

  if (!brandName || !allPresets || allPresets.length === 0) {
    return allPresets || [];
  }

  const cleanBrand = brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const tokens = brandName.toLowerCase().split(/[\s_-]+/).filter(t => t.length >= 3);

  // Filter preset yang mengandung nama brand atau kata kunci brand
  const filtered = allPresets.filter(p => {
    const text = `${p.id || ''} ${p.preset_key || ''} ${p.label || ''}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (text.includes(cleanBrand)) return true;
    return tokens.some(tok => text.includes(tok));
  });

  return filtered.length > 0 ? filtered : allPresets;
}

/**
 * Menentukan konfigurasi default audio, video model, outro app CTA, dan VI preset brand.
 * @param {string} brandIdOrName
 * @param {string|null} requestedViPresetId
 */
export async function resolveBrandRecipePreset(brandIdOrName, requestedViPresetId = null) {
  const db = getDb();
  const brand = brandIdOrName ? await db.prepare(
    'SELECT * FROM brand_profiles WHERE id = ? OR brand_name = ?'
  ).get(brandIdOrName, brandIdOrName) : null;

  const brandName = (brand?.brand_name || brandIdOrName || '').toLowerCase();
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

/**
 * Orkestrasi Autonomous Recipe Pipeline (1-Click Planner-to-Video Engine)
 */
export async function executeAutonomousRecipePipeline({
  brandId,
  topic,
  category = 'makanan_utama',
  recipeCount = 7,
  executionMode = 'full_autopilot',
  visualIdentityPresetId = null,
  overrides = {},
  tenantId = 'default_tenant'
}) {
  if (!topic || !topic.trim()) throw new Error('Topik resep wajib diisi.');
  const db = getDb();
  const brand = brandId ? await db.prepare('SELECT * FROM brand_profiles WHERE id = ?').get(brandId) : null;
  const brandName = brand?.brand_name || 'habitfolk';

  const preset = await resolveBrandRecipePreset(brand?.id || brandName, visualIdentityPresetId);

  // 1. Create Draft Planner
  const plannerDraft = await createDraftContentPlanner({
    title: `${brandName} - ${new Date().toISOString().slice(0, 10).replace(/-/g, '')} - ${topic}`,
    account_name: brandName,
    brand_id: brand?.id || null,
    planner_focus: 'recipe_campaign',
    recipe_config: { category: category || 'makanan_utama' },
    recipe_category: category || 'makanan_utama',
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
  const outroLine = (preset.mandatory_outro_template || '')
    .replace('{topic}', topic)
    .replace('{app_name}', preset.supporting_app_name || 'app');

  // 4. Ingest to Pillar Campaign
  const globalSettings = {
    ...preset,
    ai_directive: topic,
    mandatory_outro_line: outroLine,
    execution_mode: executionMode,
    auto_sync_contentflow: 1,
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
      'SELECT id, workflow_status, new_video_plan_json, review_revision FROM pillar_campaign_items WHERE campaign_id = ?'
    ).all(campaignId);

    for (const item of (items || [])) {
      try {
        if (item.new_video_plan_json && item.new_video_plan_json !== '[]') {
          await approvePillarCampaignItemUnchanged(item.id);
        } else {
          await db.prepare(`
            UPDATE pillar_campaign_items 
            SET workflow_status = 'production_processing',
                review_state = 'approved',
                review_reason = 'auto_approved_autopilot',
                approved_revision = COALESCE(review_revision, '1'),
                review_state_updated_at = ?
            WHERE id = ?
          `).run(new Date().toISOString(), item.id);
        }
      } catch (approveErr) {
        console.warn(`[Autonomous Recipe Pipeline] Auto-approve warning for item ${item.id}:`, approveErr.message);
      }
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

