import { getDb } from './db.js';
import { createDraftContentPlanner, executeContentPlanner } from './content-planner-engine.js';
import { ingestRecipePlannerToPillarCampaign } from './recipe-campaign-ingest.js';
import { startCampaignScheduler } from './campaign-scheduler.js';
import { approvePillarCampaignItemUnchanged } from './pillar-campaign-approval.js';
import { getOperatorPresetConfig, listRecipeOperatorPresetsForBrand } from './operator-presets.js';

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
 * Mengambil preferensi dari Operator Preset jika disediakan atau terdaftar di DB.
 * @param {string} brandIdOrName
 * @param {string|null} requestedPresetKey
 * @param {string|null} requestedViPresetId
 * @param {string} tenantId
 */
export async function resolveBrandRecipePreset(
  brandIdOrName,
  requestedPresetKey = null,
  requestedViPresetId = null,
  tenantId = 'default_tenant'
) {
  const db = getDb();
  const brand = brandIdOrName ? await db.prepare(
    'SELECT * FROM brand_profiles WHERE id = ? OR brand_name = ?'
  ).get(brandIdOrName, brandIdOrName) : null;

  const brandName = (brand?.brand_name || brandIdOrName || '').toLowerCase();
  const availableViPresets = await listVisualIdentityPresetsForBrand(brand?.id || brandName);
  
  // 1. Ambil config dari Operator Preset jika diminta atau cari preset resep untuk brand
  let operatorPreset = null;
  let activePresetKey = requestedPresetKey;

  if (activePresetKey) {
    operatorPreset = getOperatorPresetConfig(activePresetKey, tenantId);
  }

  // Jika belum ada requestedPresetKey atau tidak ditemukan, coba cari yang cocok untuk brand
  if (!operatorPreset) {
    const brandPresets = listRecipeOperatorPresetsForBrand(brand?.brand_name || brandName, tenantId);
    if (brandPresets && brandPresets.length > 0) {
      activePresetKey = brandPresets[0].key;
      operatorPreset = brandPresets[0].config || brandPresets[0];
    }
  }

  // Jika tetap tidak ditemukan, coba ambil default system recipe preset
  if (!operatorPreset) {
    operatorPreset = getOperatorPresetConfig('recipe_campaign_default', tenantId);
    if (operatorPreset) {
      activePresetKey = 'recipe_campaign_default';
    }
  }

  // 2. Tentukan visual identity preset yang digunakan
  let selectedVi = requestedViPresetId;
  const presetViId = operatorPreset?.visual_swap?.visual_identity_preset_id;
  if (!selectedVi && presetViId && availableViPresets.some(p => p.id === presetViId)) {
    selectedVi = presetViId;
  }
  if (!selectedVi || !availableViPresets.some(p => p.id === selectedVi)) {
    selectedVi = availableViPresets[0]?.id || presetViId || 'vi_habitfolk_macro_craft';
  }

  if (operatorPreset) {
    const ve = operatorPreset.visual_engine || {};
    const bs = operatorPreset.basic_strategy || {};
    const wf = operatorPreset.workflow || {};

    const videoModel = ve.video_model || 'omni_flash';
    const targetAi = videoModel === 'veo_31_lite' ? 'Google Veo (8s)' : 'Google Veo Omni Flash';

    return {
      preset_key: activePresetKey,
      preset_label: operatorPreset.label || activePresetKey,
      campaign_kinds: operatorPreset.campaign_kinds || ['recipe_campaign'],
      visual_identity_preset_id: selectedVi,
      available_vi_presets: availableViPresets,
      voice_provider: bs.voice_provider || 'minimax',
      voice_persona: bs.voice_persona || (brandName.includes('botani') ? 'Indonesian_warm_motherly_vv1' : 'English_causual_narrator_vv1'),
      target_language: bs.target_language || (brandName.includes('botani') ? 'id-ID' : 'en-US'),
      voice_speed: Number(bs.voice_speed || 1.0),
      voice_volume: Number(bs.voice_volume || 1.0),
      video_model: videoModel,
      target_ai: targetAi,
      aspect_ratio: ve.aspect_ratio || '9:16',
      target_clips_count: Number(ve.target_clips_count || 6),
      clip_duration: Number(ve.clip_duration || 4),
      words_per_clip: ve.words_per_clip || '8-9 kata',
      supporting_app_name: bs.supporting_app_name || (brandName.includes('habit') ? 'Airfry Eats' : (brandName.includes('botani') ? 'GarliBee Health Hub' : '')),
      mandatory_outro_template: bs.mandatory_outro_line || (brandName.includes('habit') 
        ? 'Want more {topic} recipes? Get the {app_name} app through the link in my bio!' 
        : (brandName.includes('botani') 
          ? 'Mau resep olahan {topic} sehat lainnya? Cek bio sekarang!' 
          : 'Want more {topic} recipes? Link in bio!')),
      enable_motion_text: wf.enable_motion_text !== undefined ? (wf.enable_motion_text ? 1 : 0) : 1,
      motion_text_style: wf.motion_text_style || 'floating_white_yellow',
      motion_text_position: wf.motion_text_position || 'bottom',
      video_transition: wf.video_transition || 'fade',
      transition_duration: Number(wf.transition_duration !== undefined ? wf.transition_duration : 0.5)
    };
  }

  // Fallback generic
  return {
    preset_key: null,
    preset_label: 'Default Recipe Template',
    campaign_kinds: ['recipe_campaign'],
    visual_identity_preset_id: selectedVi,
    available_vi_presets: availableViPresets,
    voice_provider: 'minimax',
    voice_persona: brandName.includes('botani') ? 'Indonesian_warm_motherly_vv1' : 'English_causual_narrator_vv1',
    target_language: brandName.includes('botani') ? 'id-ID' : 'en-US',
    voice_speed: 1.0,
    video_model: 'omni_flash',
    target_ai: 'Google Veo Omni Flash',
    aspect_ratio: '9:16',
    target_clips_count: 6,
    clip_duration: 4,
    supporting_app_name: brandName.includes('habit') ? 'Airfry Eats' : '',
    mandatory_outro_template: 'Want more {topic} recipes? Link in bio!',
    enable_motion_text: 1,
    motion_text_style: 'floating_white_yellow',
    motion_text_position: 'bottom',
    video_transition: 'fade',
    transition_duration: 0.5
  };
}

/**
 * Orkestrasi Autonomous Recipe Pipeline (1-Click Planner-to-Video Engine)
 */
export async function executeAutonomousRecipePipeline({
  brandId,
  presetKey = null,
  preset_key = null,
  topic,
  category = 'makanan_utama',
  recipeCount = 1,
  executionMode = 'full_autopilot',
  visualIdentityPresetId = null,
  enableMotionText,
  motionTextStyle,
  motionTextPosition,
  videoTransition,
  transitionDuration,
  overrides = {},
  tenantId = 'default_tenant'
}) {
  if (!topic || !topic.trim()) throw new Error('Topik resep wajib diisi.');
  const db = getDb();
  const brand = brandId ? await db.prepare('SELECT * FROM brand_profiles WHERE id = ?').get(brandId) : null;
  const brandName = brand?.brand_name || 'habitfolk';

  const selectedPresetKey = presetKey || preset_key || null;
  const preset = await resolveBrandRecipePreset(brand?.id || brandName, selectedPresetKey, visualIdentityPresetId, tenantId);

  // 1. Create Draft Planner
  const plannerDraft = await createDraftContentPlanner({
    title: `${brandName} - ${new Date().toISOString().slice(0, 10).replace(/-/g, '')} - ${topic}`,
    account_name: brandName,
    brand_id: brand?.id || null,
    tenant_id: tenantId,
    planner_focus: 'recipe_campaign',
    recipe_config: { category: category || 'makanan_utama' },
    recipe_category: category || 'makanan_utama',
    promotion_context: topic,
    planner_count: Number(recipeCount || 1),
    target_audience: brand?.tone_of_voice || 'professional_executive',
    target_language: preset.target_language || 'en-US',
    brand_context: brand?.editorial_brand_context || '',
    content_goal: brand?.editorial_content_goal || '',
    pillars: brand?.editorial_content_pillars_json ? JSON.parse(brand.editorial_content_pillars_json) : ['Recipe Campaign'],
    use_brand_pillars: true
  });

  const plannerId = plannerDraft.planner_id;

  // 2. Execute Gemini Ideation Engine (1-Pass)
  await executeContentPlanner(plannerId, null, tenantId);

  // 3. Prepare Dynamic Outro CTA
  const outroLine = (preset.mandatory_outro_template || '')
    .replace('{topic}', topic)
    .replace('{app_name}', preset.supporting_app_name || 'app');

  // 4. Ingest to Pillar Campaign
  const effectiveEnableMotionText = enableMotionText !== undefined
    ? (enableMotionText ? 1 : 0)
    : (preset.enable_motion_text !== undefined ? preset.enable_motion_text : 1);
  const effectiveMotionTextStyle = motionTextStyle || preset.motion_text_style || 'floating_white_yellow';
  const effectiveMotionTextPosition = motionTextPosition || preset.motion_text_position || 'bottom';
  const effectiveVideoTransition = videoTransition || preset.video_transition || 'fade';
  const effectiveTransitionDuration = Number(
    transitionDuration !== undefined ? transitionDuration : (preset.transition_duration !== undefined ? preset.transition_duration : 0.5)
  );

  const globalSettings = {
    ...preset,
    ai_directive: topic,
    mandatory_outro_line: outroLine,
    execution_mode: executionMode,
    auto_sync_contentflow: 1,
    enable_motion_text: effectiveEnableMotionText,
    motion_text_style: effectiveMotionTextStyle,
    motion_text_position: effectiveMotionTextPosition,
    video_transition: effectiveVideoTransition,
    transition_duration: effectiveTransitionDuration,
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

