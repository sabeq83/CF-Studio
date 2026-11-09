import { getDb } from './db.js';
import { createDraftContentPlanner, executeContentPlanner } from './content-planner-engine.js';
import { ingestRecipePlannerToPillarCampaign } from './recipe-campaign-ingest.js';
import { ingestPlannerToPillarCampaign } from './pillar-campaign-ingest.js';
import { startCampaignScheduler } from './campaign-scheduler.js';
import { approvePillarCampaignItemUnchanged } from './pillar-campaign-approval.js';
import { getOperatorPresetConfig, getOperatorPresetConfigAsync, listRecipeOperatorPresetsForBrand } from './operator-presets.js';

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

  // 2. Tentukan visual identity preset yang digunakan (Prioritas: requested -> presetConfig -> fallback brand)
  const presetViId = operatorPreset?.visual_swap?.visual_identity_preset_id;
  let selectedVi = requestedViPresetId || presetViId;
  if (!selectedVi) {
    selectedVi = availableViPresets[0]?.id || 'vi_habitfolk_macro_craft';
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
      tts_model_quality: bs.tts_model_quality || 'speech-2.8-turbo',
      ai_directive: bs.ai_directive || '',
      target_demographic: bs.target_demographic || '',
      video_model: videoModel,
      target_ai: targetAi,
      aspect_ratio: ve.aspect_ratio || '9:16',
      visual_mode: ve.visual_mode || 'hybrid_lock',
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
      transition_duration: Number(wf.transition_duration !== undefined ? wf.transition_duration : 0.5),
      ffmpeg_video_scale: Number(wf.ffmpeg_video_scale || 1.0),
      ffmpeg_bgm_volume: Number(wf.ffmpeg_bgm_volume || 0.0),
      ffmpeg_sfx_volume: Number(wf.ffmpeg_sfx_volume || 0.0)
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
    voice_volume: 1.0,
    tts_model_quality: 'speech-2.8-turbo',
    ai_directive: '',
    target_demographic: '',
    video_model: 'omni_flash',
    target_ai: 'Google Veo Omni Flash',
    aspect_ratio: '9:16',
    visual_mode: 'hybrid_lock',
    target_clips_count: 6,
    clip_duration: 4,
    supporting_app_name: brandName.includes('habit') ? 'Airfry Eats' : '',
    mandatory_outro_template: 'Want more {topic} recipes? Link in bio!',
    enable_motion_text: 1,
    motion_text_style: 'floating_white_yellow',
    motion_text_position: 'bottom',
    video_transition: 'fade',
    transition_duration: 0.5,
    ffmpeg_video_scale: 1.0,
    ffmpeg_bgm_volume: 0.0,
    ffmpeg_sfx_volume: 0.0
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

  const combinedAiDirective = preset.ai_directive
    ? `${preset.ai_directive}\nTopik: ${topic}`
    : topic;

  const globalSettings = {
    ...preset,
    ai_directive: overrides?.ai_directive || combinedAiDirective,
    mandatory_outro_line: overrides?.mandatory_outro_line || outroLine,
    execution_mode: executionMode,
    auto_sync_contentflow: 1,
    enable_motion_text: effectiveEnableMotionText,
    motion_text_style: effectiveMotionTextStyle,
    motion_text_position: effectiveMotionTextPosition,
    video_transition: effectiveVideoTransition,
    transition_duration: effectiveTransitionDuration,
    visual_mode: overrides?.visual_mode || preset.visual_mode || 'hybrid_lock',
    voice_speed: overrides?.voice_speed !== undefined ? Number(overrides.voice_speed) : preset.voice_speed,
    voice_volume: overrides?.voice_volume !== undefined ? Number(overrides.voice_volume) : preset.voice_volume,
    tts_model_quality: overrides?.tts_model_quality || preset.tts_model_quality || 'speech-2.8-turbo',
    ffmpeg_video_scale: overrides?.ffmpeg_video_scale !== undefined ? Number(overrides.ffmpeg_video_scale) : preset.ffmpeg_video_scale,
    ffmpeg_bgm_volume: overrides?.ffmpeg_bgm_volume !== undefined ? Number(overrides.ffmpeg_bgm_volume) : preset.ffmpeg_bgm_volume,
    ffmpeg_sfx_volume: overrides?.ffmpeg_sfx_volume !== undefined ? Number(overrides.ffmpeg_sfx_volume) : preset.ffmpeg_sfx_volume,
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

/**
 * Eksekusi Autonomous Product Campaign Pipeline
 * (Mengambil produk dari product_extractions, menghasilkan Storyboard showcase produk 1-pass, dan ingest ke Pillar Campaign)
 */
export async function executeAutonomousProductPipeline({
  brandId,
  productId,
  productTitle,
  promotionContext = null,
  selectedCep = null,
  presetKey = 'product_campaign',
  tenantId = 'default_tenant',
  executionMode = 'full_autopilot',
  overrides = {}
}) {
  const db = getDb();
  let brand = null;
  if (brandId) {
    brand = await db.prepare(
      'SELECT * FROM brand_profiles WHERE (id = ? OR brand_name = ?) AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = \'default_tenant\')'
    ).get(brandId, brandId, tenantId);
  }
  const brandName = brand?.brand_name || 'Brand';
  
  // 0. Resolve Operator Preset & VI Presets di awal sebelum pembuatan draf planner
  const effectivePresetKey = presetKey || 'product_campaign';
  let presetConfig = null;
  try {
    presetConfig = await getOperatorPresetConfigAsync(effectivePresetKey, tenantId);
    if (!presetConfig) {
      presetConfig = getOperatorPresetConfig(effectivePresetKey, tenantId);
    }
  } catch (err) {
    console.warn('[Autonomous Product Pipeline] getOperatorPresetConfig notice:', err.message);
  }

  // Tentukan target bahasa yang tepat: prioritas overrides -> presetConfig -> fallback id-ID
  const effectiveTargetLanguage =
    overrides?.audio?.targetLanguage ||
    overrides?.target_language ||
    presetConfig?.basic_strategy?.target_language ||
    (brand?.tone_of_voice?.toLowerCase().includes('english') ? 'en-US' : 'id-ID');

  const effectiveTargetAudience =
    overrides?.target_audience ||
    presetConfig?.planner_defaults?.target_audience ||
    presetConfig?.basic_strategy?.target_demographic_custom ||
    brand?.target_audience ||
    null;

  const effectiveContentGoal =
    overrides?.content_goal ||
    brand?.editorial_content_goal ||
    presetConfig?.planner_defaults?.content_goal ||
    '';

  // Resolusi VI Preset Terpilih: Samakan persis dengan recipe_campaign (fallback ke vi_habitfolk_macro_craft)
  let availableViPresets = [];
  try {
    const { listVisualIdentities } = await import('./visual-identity-repository.js');
    availableViPresets = await listVisualIdentities();
  } catch (_) {
    availableViPresets = await listVisualIdentityPresetsForBrand(brand?.id || brandName);
  }

  let selectedVi = overrides?.visual_identity_preset_id || presetViId;
  if (!selectedVi) {
    selectedVi = availableViPresets.find(p => p.id === 'vi_habitfolk_macro_craft')?.id
      || availableViPresets[0]?.id
      || 'vi_habitfolk_macro_craft';
  }

  // Ambil data produk katalog (Tenant-Safe)
  let product = null;
  if (productId) {
    product = await db.prepare(
      'SELECT * FROM product_extractions WHERE id = ? AND (tenant_id = ? OR tenant_id = \'default_tenant\')'
    ).get(productId, tenantId);
  }
  const productName = product?.product_name || productTitle || 'Featured Product';
  const productDesc = product?.product_description || product?.raw_description || product?.unique_selling_point || `Koleksi produk unggulan ${productName}`;
  const productUsp = product?.unique_selling_point || '';
  const productUrl = product?.source_url || product?.input_source || '';
  const affiliateUrl = product?.affiliate_link || '';

  const effectiveSelectedCep = selectedCep || overrides?.selected_cep || null;
  const isCustomCep = Boolean(effectiveSelectedCep && effectiveSelectedCep !== 'auto');
  const cepSelectionMode = isCustomCep ? 'custom' : 'sequential';
  const selectedCeps = isCustomCep ? [effectiveSelectedCep] : null;

  const effectivePromotionContext = promotionContext || overrides?.promotion_context || overrides?.topic || null;

  console.log(`[Autonomous Product Pipeline] 🛍️ Generating pipeline for "${productName}" (Brand: ${brandName}, Preset: ${effectivePresetKey}, VI: ${selectedVi}, Lang: ${effectiveTargetLanguage}, CEP: ${effectiveSelectedCep || 'Auto'}, Context: ${effectivePromotionContext || 'None'})...`);

  // 1. Create Draft Content Planner dengan target bahasa dari preset terpilih (id-ID)
  // [Fix User Guidance]: Exclude brand editorial pillars (use_brand_pillars: false, pillars: [])
  // Ini mengaktifkan native 100% CEP-Driven Mode pada MAKNA Flow sehingga AI murni fokus pada
  // Category Entry Point (CEP), W's Matrix, Visual Focus Objective (VFO), Strategic Angle, dan Product Truth.
  const plannerDraft = await createDraftContentPlanner({
    title: `${brandName} - Product: ${productName}${isCustomCep ? ` [${effectiveSelectedCep}]` : ''}`,
    account_name: brandName,
    brand_id: brand?.id || null,
    product_id: product?.id || productId || null,
    product_name: productName,
    product_description: productDesc,
    product_usp: productUsp,
    product_url: productUrl,
    affiliate_url: affiliateUrl,
    tenant_id: tenantId,
    planner_focus: 'product_campaign',
    target_language: effectiveTargetLanguage,
    target_audience: effectiveTargetAudience,
    brand_context: brand?.editorial_brand_context || '',
    content_goal: effectiveContentGoal,
    promotion_context: effectivePromotionContext,
    planner_count: 1,
    use_brand_pillars: false,
    pillars: [],
    cep_selection_mode: cepSelectionMode,
    selected_ceps: selectedCeps
  });

  const plannerId = plannerDraft.planner_id;

  // 2. Execute 1-Pass Gemini Engine (Mematuhi BAHASA INDONESIA sesuai target_language)
  console.log(`[Autonomous Product Pipeline] 🤖 Executing 1-Pass AI planner for ID: ${plannerId}...`);
  await executeContentPlanner(plannerId, null, tenantId);

  // 3. Susun globalSettings lengkap dengan Visual Identity & Product Bridging Preset yang tersinkronisasi
  const { bridging: overrideBridging, ...restOverrides } = overrides || {};
  const globalSettings = {
    ...restOverrides,
    preset_key: effectivePresetKey,
    execution_mode: executionMode,
    auto_sync_contentflow: 1,
    target_product_id: product?.id || productId || null,
    target_clips_count: overrides?.aesthetics?.targetClipsCount || overrides?.target_clips_count || presetConfig?.visual_engine?.target_clips_count || 6,
    clip_duration: overrides?.aesthetics?.clipDuration || overrides?.clip_duration || presetConfig?.visual_engine?.clip_duration || 4,
    words_per_clip: overrides?.aesthetics?.wordsPerClip || overrides?.words_per_clip || presetConfig?.visual_engine?.words_per_clip || '8-9 kata',
    voice_provider: overrides?.audio?.voiceProvider || overrides?.voice_provider || presetConfig?.basic_strategy?.voice_provider || 'minimax',
    voice_persona: overrides?.audio?.voicePersona || overrides?.voice_persona || presetConfig?.basic_strategy?.voice_persona || 'Indonesian_professional_anchor_vv2',
    voice_speed: Number(overrides?.audio?.voiceSpeed || overrides?.audio?.voice_speed || overrides?.voice_speed || presetConfig?.basic_strategy?.voice_speed || 1.0),
    voice_volume: Number(overrides?.audio?.voiceVolume || overrides?.audio?.voice_volume || overrides?.voice_volume || presetConfig?.basic_strategy?.voice_volume || 1.0),
    tts_model_quality: overrides?.audio?.tts_model_quality || overrides?.tts_model_quality || presetConfig?.basic_strategy?.tts_model_quality || 'speech-2.8-turbo',
    target_language: effectiveTargetLanguage,
    mandatory_outro_line: overrides?.audio?.mandatoryOutroLine || overrides?.mandatory_outro_line || presetConfig?.basic_strategy?.mandatory_outro_line || '',
    ai_directive: overrides?.ai_directive || presetConfig?.basic_strategy?.ai_directive || null,
    target_demographic: overrides?.target_demographic || presetConfig?.basic_strategy?.target_demographic || null,
    target_demographic_custom: overrides?.target_demographic_custom || presetConfig?.basic_strategy?.target_demographic_custom || null,
    narrative_mode: overrides?.aesthetics?.narrativeMode || overrides?.narrative_mode || presetConfig?.basic_strategy?.narrative_mode || 'auto',
    visual_style: overrides?.aesthetics?.visualStyle || overrides?.visual_style || presetConfig?.visual_engine?.visual_style || 'photorealistic_culinary',
    visual_mode: overrides?.visual_mode || overrides?.bridging?.visualMode || presetConfig?.visual_engine?.visual_mode || 'hybrid_lock',
    video_model: overrides?.video_model || presetConfig?.visual_engine?.video_model || 'omni_flash',
    // Product Bridging dari Preset / Overrides
    is_bridging_active: overrideBridging?.isBridgingActive !== undefined
      ? (overrideBridging.isBridgingActive ? 1 : 0)
      : (overrides?.is_bridging_active !== undefined
          ? (overrides.is_bridging_active ? 1 : 0)
          : (presetConfig?.product_bridging?.is_bridging_active !== undefined
              ? (presetConfig.product_bridging.is_bridging_active ? 1 : 0)
              : 1)),
    bridge_at_clip: Number(
      overrideBridging?.bridgeAtClip ||
      overrides?.bridge_at_clip ||
      presetConfig?.product_bridging?.bridge_at_clip ||
      5
    ),
    bridge_duration_clips: Number(
      overrideBridging?.bridgeDurationClips !== undefined
        ? overrideBridging.bridgeDurationClips
        : (overrides?.bridge_duration_clips !== undefined
            ? overrides.bridge_duration_clips
            : (presetConfig?.product_bridging?.bridge_duration_clips !== undefined
                ? presetConfig.product_bridging.bridge_duration_clips
                : 1))
    ),
    bridging_mode: overrideBridging?.bridgingMode ||
      overrides?.bridging_mode ||
      presetConfig?.product_bridging?.bridging_mode ||
      'select_existing',
    // Visual Identity Preset Binding (selalu ID konkret seperti vi_habitfolk_macro_craft)
    visual_identity_preset_id: selectedVi,
    // Motion Text & Transitions dari Preset Workflow
    enable_motion_text: overrides?.enable_motion_text !== undefined ? (overrides.enable_motion_text ? 1 : 0) : (presetConfig?.workflow?.enable_motion_text !== undefined ? (presetConfig.workflow.enable_motion_text ? 1 : 0) : 1),
    motion_text_style: overrides?.motion_text_style || presetConfig?.workflow?.motion_text_style || 'floating_white_yellow',
    motion_text_position: overrides?.motion_text_position || presetConfig?.workflow?.motion_text_position || 'bottom',
    video_transition: overrides?.video_transition || presetConfig?.workflow?.video_transition || 'fade',
    transition_duration: Number(overrides?.transition_duration !== undefined ? overrides.transition_duration : (presetConfig?.workflow?.transition_duration !== undefined ? presetConfig.workflow.transition_duration : 0.5)),
    ffmpeg_video_scale: Number(presetConfig?.workflow?.ffmpeg_video_scale || 1.0),
    ffmpeg_bgm_volume: Number(presetConfig?.workflow?.ffmpeg_bgm_volume || 0.0),
    ffmpeg_sfx_volume: Number(presetConfig?.workflow?.ffmpeg_sfx_volume || 0.0),
    ffmpeg_sync_option: presetConfig?.workflow?.ffmpeg_sync_option || 'smart_sync'
  };

  const ingestResult = await ingestPlannerToPillarCampaign({
    plannerId,
    campaignName: `[Product Campaign] ${brandName} - ${productName}`,
    globalSettings
  });

  const campaignId = ingestResult.campaignId || ingestResult.campaign_id;

  // 4. Auto-Approval Sepakat untuk Mode Full Autopilot
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
        console.warn(`[Autonomous Product Pipeline] Auto-approve warning for item ${item.id}:`, approveErr.message);
      }
    }
  }

  // 5. Start Campaign Scheduler
  try {
    startCampaignScheduler();
  } catch (err) {
    console.warn('[Autonomous Product Pipeline] startCampaignScheduler warning:', err.message);
  }

  return {
    success: true,
    planner_id: plannerId,
    campaign_id: campaignId,
    campaign_name: ingestResult.campaignName || ingestResult.campaign_name,
    items_count: ingestResult.ingestedCount || ingestResult.item_count || 1,
    execution_mode: executionMode,
    pipeline_type: 'product_campaign'
  };
}

/**
 * Eksekusi Autonomous Brand Editorial Pipeline
 * (Mengambil pilar dari target_item_title / brand_profiles, menghasilkan Storyboard tension 1-pass, dan ingest ke Pillar Campaign)
 */
export async function executeAutonomousEditorialPipeline({
  brandId,
  pillarTitle,
  presetKey = 'brand_editorial_campaign',
  tenantId = 'default_tenant',
  executionMode = 'full_autopilot',
  overrides = {}
}) {
  const db = getDb();
  const brand = brandId ? await db.prepare(
    'SELECT * FROM brand_profiles WHERE (id = ? OR brand_name = ?) AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = \'default_tenant\')'
  ).get(brandId, brandId, tenantId) : null;
  const brandName = brand?.brand_name || 'Brand';
  const effectivePillar = pillarTitle || 'Eat Better, Not Perfect';

  // 0. Resolve Operator Preset & VI Presets di awal sebelum pembuatan draf planner
  const effectivePresetKey = presetKey || 'brand_editorial_campaign';
  let presetConfig = null;
  try {
    presetConfig = await getOperatorPresetConfigAsync(effectivePresetKey, tenantId);
    if (!presetConfig) {
      presetConfig = getOperatorPresetConfig(effectivePresetKey, tenantId);
    }
  } catch (err) {
    console.warn('[Autonomous Editorial Pipeline] getOperatorPresetConfig notice:', err.message);
  }

  // Tentukan target bahasa
  const effectiveTargetLanguage =
    overrides?.audio?.targetLanguage ||
    overrides?.target_language ||
    presetConfig?.basic_strategy?.target_language ||
    (brand?.tone_of_voice?.toLowerCase().includes('english') ? 'en-US' : 'id-ID');

  const effectiveTargetAudience =
    overrides?.target_audience ||
    presetConfig?.planner_defaults?.target_audience ||
    presetConfig?.basic_strategy?.target_demographic_custom ||
    brand?.target_audience ||
    null;

  const effectiveContentGoal =
    overrides?.content_goal ||
    brand?.editorial_content_goal ||
    presetConfig?.planner_defaults?.content_goal ||
    '';

  // Resolusi VI Preset Terpilih: Samakan persis dengan recipe_campaign (fallback ke vi_habitfolk_macro_craft)
  let availableViPresets = [];
  try {
    const { listVisualIdentities } = await import('./visual-identity-repository.js');
    availableViPresets = await listVisualIdentities();
  } catch (_) {
    availableViPresets = await listVisualIdentityPresetsForBrand(brand?.id || brandName);
  }

  let selectedVi = overrides?.visual_identity_preset_id || presetViId;
  if (!selectedVi) {
    selectedVi = availableViPresets.find(p => p.id === 'vi_habitfolk_macro_craft')?.id
      || availableViPresets[0]?.id
      || 'vi_habitfolk_macro_craft';
  }

  console.log(`[Autonomous Editorial Pipeline] 📖 Generating pipeline for pillar "${effectivePillar}" (Brand: ${brandName}, Preset: ${effectivePresetKey}, VI: ${selectedVi}, Lang: ${effectiveTargetLanguage})...`);

  // 1. Create Draft Content Planner (Focus: brand_editorial)
  const plannerDraft = await createDraftContentPlanner({
    title: `${brandName} - Editorial: ${effectivePillar}`,
    account_name: brandName,
    brand_id: brand?.id || null,
    tenant_id: tenantId,
    planner_focus: 'brand_editorial',
    pillars: [effectivePillar],
    use_brand_pillars: true,
    target_language: effectiveTargetLanguage,
    target_audience: effectiveTargetAudience,
    brand_context: brand?.editorial_brand_context || '',
    content_goal: effectiveContentGoal,
    planner_count: 1
  });

  const plannerId = plannerDraft.planner_id;

  // 2. Execute 1-Pass Gemini Engine
  console.log(`[Autonomous Editorial Pipeline] 🤖 Executing 1-Pass AI planner for ID: ${plannerId}...`);
  await executeContentPlanner(plannerId, null, tenantId);

  // 3. Susun globalSettings lengkap dengan VI Preset dan Workflow
  const globalSettings = {
    preset_key: effectivePresetKey,
    execution_mode: executionMode,
    auto_sync_contentflow: 1,
    target_clips_count: overrides?.aesthetics?.targetClipsCount || overrides?.target_clips_count || presetConfig?.visual_engine?.target_clips_count || 4,
    clip_duration: overrides?.aesthetics?.clipDuration || overrides?.clip_duration || presetConfig?.visual_engine?.clip_duration || 8,
    words_per_clip: overrides?.aesthetics?.wordsPerClip || overrides?.words_per_clip || presetConfig?.visual_engine?.words_per_clip || '17-19 kata',
    voice_provider: overrides?.audio?.voiceProvider || overrides?.voice_provider || presetConfig?.basic_strategy?.voice_provider || 'minimax',
    voice_persona: overrides?.audio?.voicePersona || overrides?.voice_persona || presetConfig?.basic_strategy?.voice_persona || 'Indonesian_professional_anchor_vv2',
    voice_speed: Number(overrides?.audio?.voiceSpeed || overrides?.audio?.voice_speed || overrides?.voice_speed || presetConfig?.basic_strategy?.voice_speed || 1.0),
    voice_volume: Number(overrides?.audio?.voiceVolume || overrides?.audio?.voice_volume || overrides?.voice_volume || presetConfig?.basic_strategy?.voice_volume || 1.0),
    tts_model_quality: overrides?.audio?.tts_model_quality || overrides?.tts_model_quality || presetConfig?.basic_strategy?.tts_model_quality || 'speech-2.8-turbo',
    target_language: effectiveTargetLanguage,
    mandatory_outro_line: overrides?.audio?.mandatoryOutroLine || overrides?.mandatory_outro_line || presetConfig?.basic_strategy?.mandatory_outro_line || '',
    ai_directive: overrides?.ai_directive || presetConfig?.basic_strategy?.ai_directive || null,
    target_demographic: overrides?.target_demographic || presetConfig?.basic_strategy?.target_demographic || null,
    target_demographic_custom: overrides?.target_demographic_custom || presetConfig?.basic_strategy?.target_demographic_custom || null,
    narrative_mode: overrides?.aesthetics?.narrativeMode || overrides?.narrative_mode || presetConfig?.basic_strategy?.narrative_mode || 'Storytelling',
    visual_style: overrides?.aesthetics?.visualStyle || overrides?.visual_style || presetConfig?.visual_engine?.visual_style || 'Cinematic',
    visual_mode: overrides?.bridging?.visualMode || overrides?.visual_mode || presetConfig?.visual_engine?.visual_mode || 'hybrid_lock',
    video_model: overrides?.video_model || presetConfig?.visual_engine?.video_model || 'veo_31_lite',
    // Visual Identity Preset Binding (selalu ID konkret seperti vi_habitfolk_macro_craft)
    visual_identity_preset_id: selectedVi,
    // Motion Text & Transitions dari Preset Workflow
    enable_motion_text: overrides?.enable_motion_text !== undefined ? (overrides.enable_motion_text ? 1 : 0) : (presetConfig?.workflow?.enable_motion_text !== undefined ? (presetConfig.workflow.enable_motion_text ? 1 : 0) : 1),
    motion_text_style: overrides?.motion_text_style || presetConfig?.workflow?.motion_text_style || 'floating_white_yellow',
    motion_text_position: overrides?.motion_text_position || presetConfig?.workflow?.motion_text_position || 'bottom',
    video_transition: overrides?.video_transition || presetConfig?.workflow?.video_transition || 'fade',
    transition_duration: Number(overrides?.transition_duration !== undefined ? overrides.transition_duration : (presetConfig?.workflow?.transition_duration !== undefined ? presetConfig.workflow.transition_duration : 0.5)),
    ffmpeg_video_scale: Number(presetConfig?.workflow?.ffmpeg_video_scale || 1.0),
    ffmpeg_bgm_volume: Number(presetConfig?.workflow?.ffmpeg_bgm_volume || 0.0),
    ffmpeg_sfx_volume: Number(presetConfig?.workflow?.ffmpeg_sfx_volume || 0.0),
    ffmpeg_sync_option: presetConfig?.workflow?.ffmpeg_sync_option || 'smart_sync',
    ...overrides
  };

  const ingestResult = await ingestPlannerToPillarCampaign({
    plannerId,
    campaignName: `[Brand Editorial] ${brandName} - ${effectivePillar}`,
    globalSettings
  });

  const campaignId = ingestResult.campaignId || ingestResult.campaign_id;

  // 4. Auto-Approval Sepakat untuk Mode Full Autopilot
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
        console.warn(`[Autonomous Editorial Pipeline] Auto-approve warning for item ${item.id}:`, approveErr.message);
      }
    }
  }

  // 5. Start Campaign Scheduler
  try {
    startCampaignScheduler();
  } catch (err) {
    console.warn('[Autonomous Editorial Pipeline] startCampaignScheduler warning:', err.message);
  }

  return {
    success: true,
    planner_id: plannerId,
    campaign_id: campaignId,
    campaign_name: ingestResult.campaignName || ingestResult.campaign_name,
    items_count: ingestResult.ingestedCount || ingestResult.item_count || 1,
    execution_mode: executionMode,
    pipeline_type: 'editorial_campaign'
  };
}

/**
 * Eksekusi Autonomous Multiplier Pipeline
 * (Remix angle dan hook dari blueprint pemenang Deconstruct Lab, anti-duplikasi excluded_history, dan buat task video klip)
 */
export async function executeAutonomousMultiplierPipeline({
  brandId,
  deconstructAssetId,
  productId = null,
  presetKey = 'multiplier_deconstruct_remix',
  executionMode = 'full_autopilot',
  selectedAngle = null,
  tenantId = 'default_tenant',
  overrides = {}
}) {
  const db = getDb();

  // 1. Resolve Brand
  const brand = brandId ? await db.prepare(
    'SELECT * FROM brand_profiles WHERE (id = ? OR brand_name = ?) AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = \'default_tenant\')'
  ).get(brandId, brandId, tenantId) : null;
  const brandName = brand?.brand_name || 'Brand';

  // 1b. Resolve Operator Preset Async (Tenant-Safe & Reliable)
  let presetConfig = null;
  if (presetKey) {
    try {
      const { getOperatorPresetConfigAsync, getOperatorPresetConfig } = await import('./operator-presets.js');
      presetConfig = await getOperatorPresetConfigAsync(presetKey, tenantId);
      if (!presetConfig) presetConfig = getOperatorPresetConfig(presetKey, tenantId);
    } catch (err) {
      console.warn(`[Autonomous Multiplier Pipeline] Warning resolving preset ${presetKey}:`, err.message);
    }
  }

  // 1c. Resolusi Visual Identity Otoritatif
  let selectedVi = overrides?.visual_identity_preset_id;
  const presetViId = presetConfig?.visual_swap?.visual_identity_preset_id;
  if (!selectedVi && presetViId) {
    selectedVi = presetViId;
  }
  if (!selectedVi && brand?.id) {
    try {
      const { listVisualIdentityPresetsForBrand } = await import('./visual-override-resolver.js');
      const brandVis = await listVisualIdentityPresetsForBrand(brand.id);
      if (brandVis?.length > 0) selectedVi = brandVis[0].id;
    } catch (_) {}
  }

  // 1d. Resolusi Finishing Subtitel (Motion Text) & Transisi Video
  const effectiveEnableMotionText = overrides?.enable_motion_text !== undefined
    ? (overrides.enable_motion_text ? 1 : 0)
    : (presetConfig?.workflow?.enable_motion_text !== undefined ? (presetConfig.workflow.enable_motion_text ? 1 : 0) : 1);
  const effectiveMotionTextStyle = overrides?.motion_text_style || presetConfig?.workflow?.motion_text_style || 'floating_white_yellow';
  const effectiveMotionTextPosition = overrides?.motion_text_position || presetConfig?.workflow?.motion_text_position || 'bottom';
  const effectiveVideoTransition = overrides?.video_transition || presetConfig?.workflow?.video_transition || 'fade';
  const effectiveTransitionDuration = Number(
    overrides?.transition_duration !== undefined ? overrides.transition_duration : (presetConfig?.workflow?.transition_duration !== undefined ? presetConfig.workflow.transition_duration : 0.5)
  );

  const effectiveTargetClipsCount = Number(
    overrides?.bridging?.targetClipsCount ||
    overrides?.bridging?.target_clips_count ||
    overrides?.targetClipsCount ||
    presetConfig?.visual_engine?.target_clips_count ||
    4
  );

  const effectiveVoicePersona =
    overrides?.audio?.voice_persona ||
    overrides?.audio?.voicePersona ||
    presetConfig?.basic_strategy?.voice_persona ||
    'Indonesian_professional_anchor_vv2';

  const effectiveVoiceProvider =
    overrides?.audio?.voice_provider ||
    overrides?.audio?.voiceProvider ||
    presetConfig?.basic_strategy?.voice_provider ||
    'minimax';

  const effectiveTargetLanguage =
    overrides?.audio?.target_language ||
    overrides?.audio?.targetLanguage ||
    presetConfig?.basic_strategy?.target_language ||
    'id-ID';

  const effectiveMandatoryOutro =
    overrides?.audio?.mandatoryOutroLine ||
    overrides?.audio?.mandatory_outro_line ||
    overrides?.bridging?.mandatoryOutroLine ||
    overrides?.bridging?.mandatory_outro_line ||
    presetConfig?.basic_strategy?.mandatory_outro_line ||
    '';

  const effectiveClipDuration = Number(
    overrides?.aesthetics?.clipDuration ||
    overrides?.aesthetics?.clip_duration ||
    presetConfig?.visual_engine?.clip_duration ||
    8
  );

  const effectiveNarrativeMode =
    overrides?.aesthetics?.narrativeMode ||
    overrides?.aesthetics?.narrative_mode ||
    presetConfig?.basic_strategy?.narrative_mode ||
    'Storytelling';

  const effectiveWordsPerClip =
    overrides?.aesthetics?.wordsPerClip ||
    overrides?.aesthetics?.words_per_clip ||
    presetConfig?.visual_engine?.words_per_clip ||
    '17-19 kata';

  const effectiveVisualStyle =
    overrides?.aesthetics?.visualStyle ||
    overrides?.aesthetics?.visual_style ||
    presetConfig?.visual_engine?.visual_style ||
    'photorealistic_clean';

  const effectiveVisualMode =
    overrides?.bridging?.visualMode ||
    overrides?.bridging?.visual_mode ||
    overrides?.visual_mode ||
    presetConfig?.visual_engine?.visual_mode ||
    'hybrid_lock';

  // 2. Resolve Blueprint Referensi
  let targetBlueprintId = deconstructAssetId;
  if (!targetBlueprintId) {
    const latestBp = await db.prepare(
      'SELECT id FROM re_deconstructed_assets WHERE (tenant_id = ? OR tenant_id IS NULL OR tenant_id = \'default_tenant\') ORDER BY created_at DESC LIMIT 1'
    ).get(tenantId);
    targetBlueprintId = latestBp?.id;
  }
  if (!targetBlueprintId) {
    const anyBp = await db.prepare('SELECT id FROM re_deconstructed_assets ORDER BY created_at DESC LIMIT 1').get();
    targetBlueprintId = anyBp?.id;
  }
  if (!targetBlueprintId) {
    throw new Error('Tidak ada referensi Blueprint Deconstruct yang tersedia. Silakan lakukan dekonstruksi video terlebih dahulu di Deconstruct Lab.');
  }

  // 3. Resolve Angle (Menggunakan selectedAngle atau Auto-Generate Rank #1)
  let chosenAngle = selectedAngle;
  if (!chosenAngle || typeof chosenAngle !== 'object' || !chosenAngle.title) {
    const { generateDynamicMultiplierAngles } = await import('./multiplier-angle-generator.js');
    const angles = await generateDynamicMultiplierAngles({
      blueprintId: targetBlueprintId,
      angleCount: 3,
      tenantId
    });
    chosenAngle = angles && angles.length > 0 ? angles[0] : {
      title: 'Viral Hook Angle Remix',
      hook_text: 'Trik rahasia yang jarang diketahui orang!',
      vo_preview: 'Trik rahasia yang jarang diketahui orang untuk hasil maksimal setiap hari.'
    };
  }

  // 4. Resolve Product jika ada
  let product = null;
  if (productId) {
    product = await db.prepare(
      'SELECT * FROM product_extractions WHERE (id = ? OR product_name = ?) AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = \'default_tenant\')'
    ).get(productId, productId, tenantId);
  }

  // 5. Buat Task Multiplier
  const { generateCampaignId } = await import('./id-generator.js');
  const taskId = generateCampaignId('mul');
  const { createMultiplierTask } = await import('./db.js');

  const vsoConfig = {
    is_vso_active: true,
    visual_identity_preset_id: selectedVi,
    character_concept: 'faceless',
    visual_style_preset: effectiveVisualStyle,
    visualStyle: effectiveVisualStyle,
    execution_mode: executionMode,
    approval_mode: executionMode === 'full_autopilot' ? 'auto' : 'manual',
    clip_duration: effectiveClipDuration,
    clipDuration: effectiveClipDuration,
    narrative_mode: effectiveNarrativeMode,
    narrativeMode: effectiveNarrativeMode,
    words_per_clip: effectiveWordsPerClip,
    wordsPerClip: effectiveWordsPerClip,
    mandatoryOutroLine: effectiveMandatoryOutro,
    preset_key: presetKey,
    enable_motion_text: effectiveEnableMotionText,
    motion_text_style: effectiveMotionTextStyle,
    motion_text_position: effectiveMotionTextPosition,
    video_transition: effectiveVideoTransition,
    transition_duration: effectiveTransitionDuration,
    ai_directive: overrides?.ai_directive || presetConfig?.basic_strategy?.ai_directive || null,
    target_demographic: overrides?.target_demographic || presetConfig?.basic_strategy?.target_demographic || null,
    target_demographic_custom: overrides?.target_demographic_custom || presetConfig?.basic_strategy?.target_demographic_custom || null,
    ...overrides.vso
  };

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

  const audioConfig = {
    voice_provider: effectiveVoiceProvider,
    voice_persona: effectiveVoicePersona,
    voice_speed: Number(overrides?.audio?.voiceSpeed || overrides?.audio?.voice_speed || overrides?.voice_speed || presetConfig?.basic_strategy?.voice_speed || 1.0),
    voice_volume: Number(overrides?.audio?.voiceVolume || overrides?.audio?.voice_volume || overrides?.voice_volume || presetConfig?.basic_strategy?.voice_volume || 1.0),
    tts_model_quality: overrides?.audio?.tts_model_quality || overrides?.tts_model_quality || presetConfig?.basic_strategy?.tts_model_quality || 'speech-2.8-turbo',
    target_language: effectiveTargetLanguage,
    targetLanguage: effectiveTargetLanguage,
    mandatoryOutroLine: effectiveMandatoryOutro,
    enableTts: 1,
    enableGlabs: 1,
    enable_glabs: true,
    enableFfmpeg: 1,
    enable_ffmpeg: true,
    preset_key: presetKey,
    enable_motion_text: effectiveEnableMotionText,
    motion_text_style: effectiveMotionTextStyle,
    motion_text_position: effectiveMotionTextPosition,
    video_transition: effectiveVideoTransition,
    transition_duration: effectiveTransitionDuration,
    ffmpeg_video_scale: Number(presetConfig?.workflow?.ffmpeg_video_scale || 1.0),
    ffmpeg_sync_option: presetConfig?.workflow?.ffmpeg_sync_option || 'smart_sync',
    ffmpeg_bgm_volume: Number(presetConfig?.workflow?.ffmpeg_bgm_volume || 0.0),
    ffmpeg_sfx_volume: Number(presetConfig?.workflow?.ffmpeg_sfx_volume || 0.0),
    ...overrides.audio
  };

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

  // 6. Start Scheduler loop agar task langsung diproses
  try {
    startCampaignScheduler();
  } catch (err) {
    console.warn('[Autonomous Multiplier Pipeline] startCampaignScheduler warning:', err.message);
  }

  return {
    success: true,
    campaign_id: taskId,
    task_id: taskId,
    campaign_name: `${brandName} - Multiplier: ${chosenAngle.title}`,
    angle_title: chosenAngle.title,
    hook_text: chosenAngle.hook_text,
    items_count: 1,
    pipeline_type: 'multiplier_campaign',
    execution_mode: executionMode
  };
}

/**
 * Eksekusi Autonomous Recipe Labs Pipeline
 * (Artikel FB mendalam + Layout Grid 12-Slot Presisi dari Foto AI)
 */
export async function executeAutonomousRecipeLabsPipeline({
  brandId,
  category = 'Makanan',
  topic = 'Resep Praktis Sehat',
  visualStyle = 'Food Porn',
  imagesPerRecipe = 4,
  selectedLayoutId = '4_editorial_split',
  gridGapSize = 12,
  gridBorderRadius = 16,
  gridOuterPadding = 16,
  gridBgColor = '#0d0d12',
  postToFacebook = true,
  tenantId = 'default_tenant',
  overrides = {}
}) {
  const db = getDb();

  // 1. Resolve Brand
  const brand = brandId ? await db.prepare(
    'SELECT * FROM brand_profiles WHERE (id = ? OR brand_name = ?) AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = \'default_tenant\')'
  ).get(brandId, brandId, tenantId) : null;
  const brandName = brand?.brand_name || 'Brand Kuliner';

  // 2. Generate Campaign ID
  const { generateCampaignId } = await import('./id-generator.js');
  const campaignId = generateCampaignId('recipe');

  // 3. Create Campaign di recipe_campaigns
  const { createRecipeCampaign, createRecipeItem } = await import('./db.js');

  await createRecipeCampaign({
    id: campaignId,
    tenant_id: tenantId,
    category: category || 'Makanan',
    custom_category: topic,
    visual_style: visualStyle || 'Food Porn',
    nextcloud_parent_folder: 'MAKNA_Recipes',
    post_to_facebook: postToFacebook ? 1 : 0,
    enable_glabs: 1,
    target_recipe_count: 1,
    images_per_recipe: Number(imagesPerRecipe) || 4,
    selected_layout_id: selectedLayoutId || '4_editorial_split',
    grid_gap_size: Number(gridGapSize !== undefined ? gridGapSize : 12),
    grid_border_radius: Number(gridBorderRadius !== undefined ? gridBorderRadius : 16),
    grid_outer_padding: Number(gridOuterPadding !== undefined ? gridOuterPadding : 16),
    grid_bg_color: gridBgColor || '#0d0d12',
    status: 'processing',
    campaign_type: 'static',
    brand_profile_id: brand?.id || null,
    config_json: JSON.stringify({
      topic,
      brand_name: brandName,
      ...overrides
    })
  });

  // 4. Create Recipe Item dengan status pending_gemini
  const itemId = `rcitem_${campaignId}_1`;
  await createRecipeItem({
    id: itemId,
    campaign_id: campaignId,
    tenant_id: tenantId,
    status: 'pending_gemini'
  });

  // 5. Start Scheduler agar generator memproses naskah teks & gambar grid
  try {
    startCampaignScheduler();
  } catch (err) {
    console.warn('[Autonomous Recipe Labs Pipeline] startCampaignScheduler warning:', err.message);
  }

  return {
    success: true,
    campaign_id: campaignId,
    item_id: itemId,
    campaign_name: `${brandName} - Resep: ${topic}`,
    topic,
    layout_id: selectedLayoutId,
    images_per_recipe: imagesPerRecipe,
    items_count: 1,
    pipeline_type: 'recipe_labs'
  };
}

// Export custom storyboard pipeline engine
export { executeCustomStoryboardPipeline } from './custom-storyboard-pipeline.js';


