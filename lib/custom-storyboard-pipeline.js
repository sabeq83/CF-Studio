/**
 * lib/custom-storyboard-pipeline.js
 *
 * Pipeline Engine untuk menerima Custom Storyboard langsung dari AI eksternal
 * (Claude, ChatGPT, Gemini, dll.) atau API, mem-bypass generator internal,
 * dan langsung memasukkan naskah + visual prompts ke antrean produksi (TTS, Veo, FFmpeg).
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb, createPillarCampaign, createPillarCampaignItem, updatePillarCampaignItem } from './db.js';
import { startCampaignScheduler } from './campaign-scheduler.js';
import { approvePillarCampaignItemUnchanged } from './pillar-campaign-approval.js';
import { stripCtaAndHashtags, buildPlatformAdaptiveCaptions } from './smart-affiliate-package-builder.js';
import { normalizeBridgePayload } from './bridging/bridge-plan.js';

function resolvePreferredProductPhoto(product) {
  if (!product) return null;
  if (product.active_photo === 'raw_photo_url' && product.raw_photo_url) return product.raw_photo_url;
  if (product.active_photo === 'clean_photo_url' && (product.clean_photo_url || product.cleaned_photo_url)) {
    return product.clean_photo_url || product.cleaned_photo_url;
  }
  return product.clean_photo_url || product.cleaned_photo_url || product.raw_photo_url || product.photo_url || product.generated_photo_url || null;
}

/**
 * Validasi dan eksekusi custom storyboard ke dalam pipeline produksi CF Studio.
 *
 * @param {Object} params
 * @param {Object} params.storyboard - Payload storyboard terstruktur
 * @param {string} [params.tenantId='default_tenant'] - ID Tenant aktif
 * @param {string} [params.executionMode='full_autopilot'] - 'full_autopilot' atau 'creative_review'
 * @param {string|null} [params.idempotencyKey=null] - Kunci idempotency opsional untuk mencegah duplikasi saat retry
 * @returns {Promise<Object>} Status dan ID campaign yang telah didaftarkan
 */
export async function executeCustomStoryboardPipeline({
  storyboard,
  tenantId = 'default_tenant',
  executionMode = 'full_autopilot',
  idempotencyKey = null
}) {
  if (!storyboard || typeof storyboard !== 'object') {
    throw new Error('Storyboard payload wajib berupa objek JSON.');
  }

  const title = String(storyboard.title || 'Untitled Custom Storyboard').trim();
  const rawScenes = Array.isArray(storyboard.scenes) ? storyboard.scenes : [];
  if (rawScenes.length === 0) {
    throw new Error('Storyboard wajib memiliki minimal 1 scene.');
  }
  if (rawScenes.length > 12) {
    throw new Error('Storyboard maksimal terdiri dari 12 scene.');
  }
  for (let i = 0; i < rawScenes.length; i++) {
    const s = rawScenes[i] || {};
    if (!String(s.voiceover_text || '').trim()) {
      throw new Error(`Scene #${i + 1} wajib mengisi voiceover_text.`);
    }
    if (!String(s.visual_action || s.visual_description || s.visual_prompt || '').trim()) {
      throw new Error(`Scene #${i + 1} wajib mengisi visual_action, visual_description, atau visual_prompt.`);
    }
  }

  const db = getDb();
  const effectiveIdemKey = idempotencyKey || storyboard.idempotency_key || null;
  const sourcePlannerId = effectiveIdemKey
    ? `idemp:${crypto.createHash('sha256').update(`${tenantId}:${effectiveIdemKey}`).digest('hex').slice(0, 32)}`
    : null;

  if (sourcePlannerId) {
    try {
      const existingCampaign = await db.prepare(
        'SELECT id, campaign_name, status, target_clips_count, aspect_ratio, target_ai, target_product_id, product_ref_image_path FROM pillar_campaigns WHERE source_planner_id = ? AND tenant_id = ? LIMIT 1'
      ).get(sourcePlannerId, tenantId);
      if (existingCampaign) {
        const existingItem = await db.prepare(
          'SELECT id, workflow_status FROM pillar_campaign_items WHERE campaign_id = ? ORDER BY id ASC LIMIT 1'
        ).get(existingCampaign.id);
        return {
          success: true,
          idempotent: true,
          campaign_id: existingCampaign.id,
          item_id: existingItem?.id || null,
          campaign_name: existingCampaign.campaign_name,
          execution_mode: executionMode,
          status: existingItem?.workflow_status || existingCampaign.status,
          total_scenes: Number(existingCampaign.target_clips_count || rawScenes.length),
          aspect_ratio: existingCampaign.aspect_ratio,
          target_ai_engine: existingCampaign.target_ai,
          product_id: existingCampaign.target_product_id || null,
          product_ref_image_path: existingCampaign.product_ref_image_path || null,
          production_stages: ['tts', 'visuals', 'ffmpeg'],
          message: `Idempotent hit: Custom Storyboard "${existingCampaign.campaign_name}" sudah terdaftar sebelumnya.`
        };
      }
    } catch (_) {}
  }

  // 1. Resolve Brand jika brand_id disediakan atau cari brand default di tenant
  let brandProfileId = storyboard.brand_id || null;
  let brandName = 'Custom Studio';
  let matchedProduct = null;

  if (brandProfileId) {
    const bp = await db.prepare(
      'SELECT id, brand_name FROM brand_profiles WHERE id = ? AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = \'default_tenant\')'
    ).get(brandProfileId, tenantId);
    if (bp) {
      brandProfileId = bp.id;
      brandName = bp.brand_name;
    }
  } else {
    const firstBrand = await db.prepare(
      'SELECT id, brand_name FROM brand_profiles WHERE (tenant_id = ? OR tenant_id IS NULL OR tenant_id = \'default_tenant\') ORDER BY id ASC LIMIT 1'
    ).get(tenantId);
    if (firstBrand) {
      brandProfileId = firstBrand.id;
      brandName = firstBrand.brand_name;
    }
  }

  // 1b. Resolve Product & Validate Photo Reference (P1-1: G1, G2, G5, G9)
  const requestedProductId = storyboard.product_id || null;
  const requestedProductName = storyboard.product_name ? String(storyboard.product_name).trim() : null;
  if (requestedProductId) {
    matchedProduct = await db.prepare(
      'SELECT * FROM product_extractions WHERE id = ? AND tenant_id = ? LIMIT 1'
    ).get(requestedProductId, tenantId);
  } else if (requestedProductName) {
    matchedProduct = await db.prepare(
      'SELECT * FROM product_extractions WHERE LOWER(product_name) LIKE LOWER(?) AND tenant_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(`%${requestedProductName}%`, tenantId);
  }

  const productRefImagePath = resolvePreferredProductPhoto(matchedProduct);
  const requireProductPhoto = storyboard.require_product_photo !== undefined
    ? Boolean(storyboard.require_product_photo)
    : Boolean(requestedProductId || requestedProductName);

  if ((requestedProductId || requestedProductName) && !matchedProduct) {
    throw new Error(`Produk tidak ditemukan di katalog tenant: ${requestedProductId || requestedProductName}`);
  }
  if (requireProductPhoto && (!matchedProduct || !productRefImagePath)) {
    throw new Error(
      matchedProduct
        ? `Produk "${matchedProduct.product_name}" (${matchedProduct.id}) belum memiliki foto produk (clean_photo_url/raw_photo_url). Upload foto terlebih dahulu via cf_upload_product_photo.`
        : 'require_product_photo aktif tetapi product_id / product_name tidak disertakan.'
    );
  }

  // 1c. Resolve Operator Preset (jika preset_key / presetKey disertakan)
  const requestedPresetKey = storyboard.preset_key || storyboard.presetKey || null;
  let presetConfig = null;
  if (requestedPresetKey) {
    try {
      const { getOperatorPresetConfigAsync, getOperatorPresetConfig } = await import('./operator-presets.js');
      presetConfig = await getOperatorPresetConfigAsync(requestedPresetKey, tenantId);
      if (!presetConfig) presetConfig = getOperatorPresetConfig(requestedPresetKey, tenantId);
    } catch (presetErr) {
      console.warn(`[Custom Storyboard] Warning resolving preset ${requestedPresetKey}:`, presetErr.message);
    }
    if (!presetConfig) {
      throw new Error(`Preset "${requestedPresetKey}" tidak ditemukan pada tenant "${tenantId}". Periksa daftar preset melalui cf_list_presets.`);
    }
  }

  const pBasic = presetConfig?.basic_strategy || {};
  const pVisual = presetConfig?.visual_engine || {};
  const pBridging = presetConfig?.product_bridging || {};
  const pVso = presetConfig?.visual_swap || {};
  const pWorkflow = presetConfig?.workflow || {};

  // 2. Video DNA & Konfigurasi Visual (Prioritas: Explicit Payload > Preset > System Fallback)
  const rawDna = storyboard.video_dna || {};
  const rawAspect = rawDna.aspect_ratio || pVisual.aspect_ratio || '9:16';
  const aspectRatio = ['9:16', '16:9', '1:1'].includes(rawAspect) ? rawAspect : '9:16';
  const visualStyle = rawDna.visual_style || pVisual.visual_style || 'Cinematic';
  const visualMode = rawDna.visual_mode || pVisual.visual_mode || 'hybrid_lock';
  const videoModel = rawDna.video_model || pVisual.video_model || 'veo_31_lite';
  const targetAiEngine = rawDna.target_ai_engine || pVisual.target_ai || (videoModel === 'veo_31_lite' ? 'Google Veo (8s)' : 'Google Veo Omni Flash');
  const promptMode = storyboard.prompt_mode === 'direct_passthrough' ? 'direct_passthrough' : 'gemini_engineer';
  const faceVisibility = rawDna.face_visibility || pVisual.face_visibility || 'Faceless';
  const narrativeMode = storyboard.narrative_mode || rawDna.narrative_mode || pBasic.narrative_mode || 'Storytelling';
  const contentPillar = String(storyboard.content_pillar || title || 'Custom AI Storyboard').trim();
  const creativeBrief = String(storyboard.creative_brief || '').trim();
  const enableAudioSegment = rawDna.enable_audio_segment !== undefined
    ? (rawDna.enable_audio_segment ? 1 : 0)
    : (pBasic.enable_audio_segment ? 1 : 0);

  const audioEngineMode = rawDna.audio_engine_mode || pWorkflow.audio_engine_mode || pBasic.audio_engine_mode || 'minimax_tts';
  const isNativeVeo = audioEngineMode === 'native_veo';

  const rawVoiceProvider = rawDna.voice_provider || pBasic.voice_provider || 'gemini';
  const voiceProvider = ['gemini', 'minimax', 'elevenlabs'].includes(rawVoiceProvider)
    ? rawVoiceProvider
    : 'gemini';
  const voicePersona = rawDna.voice_persona || pBasic.voice_persona || (voiceProvider === 'gemini' ? 'Aoede' : 'Indonesian_casual_reporter_vv2');
  const voiceSpeed = Number(rawDna.voice_speed ?? rawDna.speed_control ?? pBasic.voice_speed ?? (voiceProvider === 'gemini' ? 2.5 : 1.0));
  const voiceVolume = Number(rawDna.voice_volume ?? pBasic.voice_volume ?? 1.0);
  const ttsModelQuality = rawDna.tts_model_quality || pBasic.tts_model_quality || (voiceProvider === 'gemini' ? 'standard' : 'speech-2.8-turbo');
  const targetLanguage = rawDna.target_language || pBasic.target_language || 'id-ID';
  const targetDemographic = rawDna.target_demographic || pBasic.target_demographic || 'genz_casual';
  const targetDemographicCustom = rawDna.target_demographic_custom ?? pBasic.target_demographic_custom ?? null;
  const wordsPerClip = rawDna.words_per_clip ?? pVisual.words_per_clip ?? 12;
  const clipDuration = Number(rawDna.clip_duration ?? pVisual.clip_duration ?? 8);
  const visualIdentityPresetId = storyboard.visual_identity_preset_id || rawDna.visual_identity_preset_id || pVso.visual_identity_preset_id || null;

  const elevenlabsModel = rawDna.elevenlabs_model || pBasic.elevenlabs_model || pWorkflow.elevenlabs_model || null;
  const elevenlabsStability = rawDna.elevenlabs_stability ?? pBasic.elevenlabs_stability ?? pWorkflow.elevenlabs_stability;
  const elevenlabsSimilarity = rawDna.elevenlabs_similarity_boost ?? pBasic.elevenlabs_similarity_boost ?? pWorkflow.elevenlabs_similarity_boost;

  const enableSocialPost = storyboard.enable_social_post !== undefined
    ? (storyboard.enable_social_post ? 1 : 0)
    : (pWorkflow.enable_social_post !== undefined ? (pWorkflow.enable_social_post ? 1 : 0) : (matchedProduct ? 1 : 0));
  const autoSyncContentflow = storyboard.auto_sync_contentflow !== undefined
    ? (storyboard.auto_sync_contentflow === false ? 0 : 1)
    : (pWorkflow.auto_sync_contentflow !== undefined ? (pWorkflow.auto_sync_contentflow ? 1 : 0) : 1);

  const isBridgingActive = storyboard.is_bridging_active !== undefined
    ? (storyboard.is_bridging_active ? 1 : 0)
    : (matchedProduct ? 1 : (pBridging.is_bridging_active ? 1 : 0));
  const postLinkAffiliate = storyboard.post_link_affiliate !== undefined
    ? Boolean(storyboard.post_link_affiliate)
    : Boolean(matchedProduct);
  const rawBridgeAtClip = storyboard.bridge_at_clip ?? rawDna.bridge_at_clip ?? pBridging.bridge_at_clip ?? 1;
  const rawBridgeDurationClips = storyboard.bridge_duration_clips ?? rawDna.bridge_duration_clips ?? pBridging.bridge_duration_clips ?? rawScenes.length;
  const rawBridgeSegments = storyboard.bridge_segments ?? rawDna.bridge_segments ?? pBridging.bridge_segments ?? null;
  const hasExplicitSegments = Boolean(
    storyboard.bridge_segments ||
    rawDna.bridge_segments ||
    (Array.isArray(pBridging.bridge_segments) && pBridging.bridge_segments.length > 1)
  );
  const bridgeNorm = normalizeBridgePayload({
    is_bridging_active: Boolean(isBridgingActive),
    bridge_at_clip: rawBridgeAtClip,
    bridge_duration_clips: rawBridgeDurationClips,
    bridge_segments: rawBridgeSegments
  }, {}, {
    targetClips: hasExplicitSegments ? rawScenes.length : Math.max(rawScenes.length, Number(rawBridgeAtClip || 1)),
    defaultActive: Boolean(isBridgingActive),
    singleZoneOnly: visualStyle === 'investigative_faceless'
  });
  if (bridgeNorm.active && bridgeNorm.errors.length > 0) {
    throw new Error(bridgeNorm.errors[0]);
  }
  const bridgeAtClip = bridgeNorm.active ? bridgeNorm.legacy.bridge_at_clip : Number(rawBridgeAtClip || 1);
  const bridgeDurationClips = bridgeNorm.active ? bridgeNorm.legacy.bridge_duration_clips : Number(rawBridgeDurationClips ?? rawScenes.length);
  const bridgeSegmentsJson = bridgeNorm.storageJson;
  const bridgingMode = storyboard.bridging_mode || pBridging.bridging_mode || (matchedProduct ? 'select_existing' : 'none');

  const enableTts = isNativeVeo ? 0 : (pWorkflow.enable_tts !== undefined ? (pWorkflow.enable_tts ? 1 : 0) : 1);
  const enableGlabs = pWorkflow.enable_glabs !== undefined ? (pWorkflow.enable_glabs ? 1 : 0) : 1;
  const enableFfmpeg = pWorkflow.enable_ffmpeg !== undefined ? (pWorkflow.enable_ffmpeg ? 1 : 0) : 1;
  const enableMotionText = rawDna.enable_motion_text !== undefined
    ? (rawDna.enable_motion_text ? 1 : 0)
    : (pWorkflow.enable_motion_text !== undefined ? (pWorkflow.enable_motion_text ? 1 : 0) : 1);
  const motionTextStyle = rawDna.motion_text_style || pWorkflow.motion_text_style || 'floating_white_yellow';
  const motionTextPosition = rawDna.motion_text_position || pWorkflow.motion_text_position || 'bottom';
  const videoTransition = rawDna.video_transition || pWorkflow.video_transition || 'cut';
  const transitionDuration = Number(rawDna.transition_duration ?? pWorkflow.transition_duration ?? 0.5);
  const finishingTemplate = rawDna.finishing_template || pWorkflow.finishing_template || 'none';
  const captionMode = rawDna.caption_mode || pWorkflow.caption_mode || 'hybrid';
  const loudnessTarget = Number(rawDna.loudness_target ?? pWorkflow.loudness_target ?? -14);
  const voContentContract = (rawDna.vo_content_contract ?? pWorkflow.vo_content_contract) === 'on' ? 'on' : 'off';
  const rawCustomGate = rawDna.vo_quality_gate ?? pWorkflow.vo_quality_gate;
  const voQualityGate = ['off', 'warn', 'enforce'].includes(rawCustomGate) ? rawCustomGate : 'off';
  const ffmpegSyncOption = rawDna.ffmpeg_sync_option || pWorkflow.ffmpeg_sync_option || 'stretch';
  const ffmpegVideoScale = Number(rawDna.ffmpeg_video_scale ?? pWorkflow.ffmpeg_video_scale ?? 1.0);
  const ffmpegSfxVolume = Number(rawDna.ffmpeg_sfx_volume ?? pWorkflow.ffmpeg_sfx_volume ?? (rawDna.enable_sfx === false ? 0 : 0.8));
  const ffmpegBgmVolume = Number(rawDna.ffmpeg_bgm_volume ?? pWorkflow.ffmpeg_bgm_volume ?? (rawDna.enable_bgm === false ? 0 : 0.15));
  const sfxSetting = rawDna.enable_sfx === false ? 'without_sfx' : (rawDna.sfx_setting || pBasic.sfx_setting || 'subtle_ambient');

  const dna = {
    ...rawDna,
    ...(requestedPresetKey ? { preset_key: requestedPresetKey } : {}),
    prompt_mode: promptMode,
    aspect_ratio: aspectRatio,
    visual_style: visualStyle,
    visual_mode: visualMode,
    video_model: videoModel,
    target_ai_engine: targetAiEngine,
    voice_provider: voiceProvider,
    voice_persona: voicePersona,
    voice_speed: voiceSpeed,
    voice_volume: voiceVolume,
    tts_model_quality: ttsModelQuality,
    target_language: targetLanguage,
    words_per_clip: wordsPerClip,
    clip_duration: clipDuration,
    visual_identity_preset_id: visualIdentityPresetId,
    ...(elevenlabsModel ? { elevenlabs_model: elevenlabsModel } : {}),
    ...(elevenlabsStability !== undefined ? { elevenlabs_stability: Number(elevenlabsStability) } : {}),
    ...(elevenlabsSimilarity !== undefined ? { elevenlabs_similarity_boost: Number(elevenlabsSimilarity) } : {}),
    audio_engine_mode: audioEngineMode,
    google_voice_persona: rawDna.google_voice_persona || pWorkflow.google_voice_persona || pBasic.google_voice_persona || 'Kore',
    enable_native_sfx: rawDna.enable_native_sfx ?? pWorkflow.enable_native_sfx ?? pBasic.enable_native_sfx ?? true,
    enable_native_ambience: rawDna.enable_native_ambience ?? pWorkflow.enable_native_ambience ?? pBasic.enable_native_ambience ?? true,
    anti_music_guardrail: rawDna.anti_music_guardrail ?? pWorkflow.anti_music_guardrail ?? pBasic.anti_music_guardrail ?? true
  };

  const campaignId = `cst_${uuidv4().replace(/-/g, '').slice(0, 12)}`;

  // 3. Normalisasi Scenes (mendukung visual_action / visual_description / visual_prompt)
  const scenes = rawScenes.map((s, idx) => {
    const clipIndex = Number(s.scene_index || (idx + 1));
    const voText = String(s.voiceover_text || '').trim();
    const visualAction = String(s.visual_action || s.visual_description || s.visual_prompt || '').trim();
    const cameraMovement = String(s.camera_movement || '').trim();
    const motionPrompt = String(s.i2v_prompt || cameraMovement || 'Cinematic subtle motion').trim();
    const duration = Number(s.duration_seconds || clipDuration || 4);

    return {
      clip_index: clipIndex,
      scene_role: s.scene_role || null,
      setting_hint: s.setting_hint ? String(s.setting_hint).trim() : '',
      product_visible: typeof s.product_visible === 'boolean' ? s.product_visible : null,
      audio_mood: s.audio_mood ? String(s.audio_mood).trim() : '',
      camera_movement: cameraMovement,
      visual_action: visualAction,
      new_vo: voText,
      t2i_prompt: promptMode === 'direct_passthrough' ? visualAction : '',
      t2v_prompt: promptMode === 'direct_passthrough' ? visualAction : '',
      i2v_prompt: promptMode === 'direct_passthrough' ? motionPrompt : '',
      duration_seconds: duration,
      duration: duration
    };
  });

  const voiceoverList = scenes.map(s => ({
    scene: s.clip_index,
    narration: s.new_vo,
    duration: `${s.duration}s`
  }));

  // 4. Normalisasi Social Media Package (digunakan langsung di direct_passthrough atau fallback)
  const rawSocial = storyboard.social_media_package || {};
  const baseCaption = rawSocial.caption || rawSocial.caption_universal || scenes[0]?.new_vo || title;
  const rawTags = Array.isArray(rawSocial.hashtags) ? rawSocial.hashtags : [];

  const adaptedCaptions = buildPlatformAdaptiveCaptions({
    baseCaption,
    hashtags: rawTags,
    matchedProduct: postLinkAffiliate ? matchedProduct : null
  });

  const socialMediaPackage = {
    title: rawSocial.title || title,
    caption: adaptedCaptions.caption,
    caption_facebook: rawSocial.caption_facebook ? stripCtaAndHashtags(rawSocial.caption_facebook) : adaptedCaptions.caption_facebook,
    caption_bio: rawSocial.caption_bio ? stripCtaAndHashtags(rawSocial.caption_bio) : adaptedCaptions.caption_bio,
    caption_universal: adaptedCaptions.caption_universal,
    hashtags: adaptedCaptions.hashtags,
    matched_product: matchedProduct ? {
      id: matchedProduct.id,
      product_name: matchedProduct.product_name,
      affiliate_link: matchedProduct.affiliate_link || null,
      source_url: matchedProduct.source_url || null
    } : null
  };

  const completeResultJson = {
    title,
    video_dna: dna,
    storyboard: scenes.map(s => ({
      scene: s.clip_index,
      visual_description: s.visual_action,
      camera_movement: s.camera_movement || undefined,
      audio_mood: s.audio_mood || undefined,
      t2i_prompt: s.t2i_prompt,
      i2v_prompt: s.i2v_prompt,
      duration_seconds: s.duration
    })),
    voiceover: voiceoverList,
    t2i_prompts: scenes.map(s => ({ clip: s.clip_index, prompt: s.t2i_prompt })),
    i2v_prompts: scenes.map(s => ({ clip: s.clip_index, prompt: s.i2v_prompt })),
    t2v_prompts: scenes.map(s => ({ clip: s.clip_index, prompt: s.t2v_prompt })),
    social_media_package: socialMediaPackage,
    tiktok_caption: socialMediaPackage.caption_bio,
    ig_caption: socialMediaPackage.caption_bio
  };

  // 5. Ingest ke pillar_campaigns
  await createPillarCampaign({
    id: campaignId,
    tenant_id: tenantId,
    account_name: brandName,
    source_planner_id: sourcePlannerId,
    campaign_name: `[Custom Storyboard] ${title}`,
    status: 'running',
    execution_mode: executionMode,
    content_pillar: contentPillar,
    custom_hook: scenes[0]?.new_vo?.slice(0, 100) || '',
    visual_action_guideline: scenes[0]?.visual_action?.slice(0, 150) || '',
    custom_instruction: creativeBrief || 'Storyboarding by external creative intelligence',
    ai_directive: storyboard.ai_directive || pBasic.ai_directive || '',
    mandatory_outro_line: storyboard.mandatory_outro_line || pBasic.mandatory_outro_line || '',
    brand_profile_id: brandProfileId,
    narrative_mode: narrativeMode,
    visual_style: visualStyle,
    face_visibility: faceVisibility,
    is_bridging_active: isBridgingActive,
    target_clips_count: scenes.length,
    bridge_at_clip: bridgeAtClip,
    bridge_duration_clips: bridgeDurationClips,
    bridge_segments: bridgeSegmentsJson,
    bridging_mode: bridgingMode,
    target_product_id: matchedProduct?.id || null,
    ephemeral_product_data: null,
    aspect_ratio: aspectRatio,
    target_ai: targetAiEngine,
    video_model: videoModel,
    visual_mode: visualMode,
    product_ref_image_path: productRefImagePath,
    product_filename_declare: matchedProduct ? `${matchedProduct.product_name}` : null,
    visual_overrides_json: null,
    visual_identity_preset_id: visualIdentityPresetId,
    visual_identity_preset_version: 1,
    enable_tts: enableTts,
    enable_glabs: enableGlabs,
    enable_ffmpeg: enableFfmpeg,
    enable_social_post: enableSocialPost,
    post_facebook_draft: 0,
    facebook_page_id: null,
    facebook_server_url: null,
    voice_provider: voiceProvider,
    voice_persona: voicePersona,
    words_per_clip: wordsPerClip,
    clip_duration: clipDuration,
    upload_markdown: pWorkflow.upload_markdown !== undefined ? (pWorkflow.upload_markdown ? 1 : 0) : 1,
    upload_spreadsheet: pWorkflow.upload_spreadsheet !== undefined ? (pWorkflow.upload_spreadsheet ? 1 : 0) : 0,
    target_spreadsheet_id: null,
    target_markdown_url: null,
    local_scheduler: 0,
    scheduler_pause_at: executionMode === 'full_autopilot' ? null : 'tts',
    is_mass_production: 0,
    tts_model_quality: ttsModelQuality,
    voice_speed: voiceSpeed,
    voice_volume: voiceVolume,
    target_language: targetLanguage,
    ffmpeg_sync_option: ffmpegSyncOption,
    ffmpeg_video_scale: ffmpegVideoScale,
    ffmpeg_sfx_volume: ffmpegSfxVolume,
    ffmpeg_bgm_volume: ffmpegBgmVolume,
    nextcloud_parent_folder: storyboard.nextcloud_parent_folder || pBasic.nextcloud_parent_folder || null,
    fb_draft_mode: 'none',
    sfx_setting: sfxSetting,
    enable_vo_audit: pBasic.enable_vo_audit !== undefined ? Number(pBasic.enable_vo_audit) : 0,
    enable_audio_segment: enableAudioSegment,
    voice_cast_json: null,
    target_demographic: targetDemographic,
    target_demographic_custom: targetDemographicCustom,
    approval_mode: executionMode === 'full_autopilot' ? 'none' : 'creative',
    auto_sync_contentflow: autoSyncContentflow,
    enable_motion_text: enableMotionText,
    motion_text_style: motionTextStyle,
    motion_text_position: motionTextPosition,
    motion_hook_effect: 'pop_bounce',
    motion_story_effect: 'typewriter',
    motion_cta_effect: 'pop_bounce',
    video_transition: videoTransition,
    transition_duration: transitionDuration,
    finishing_template: finishingTemplate,
    caption_mode: captionMode,
    loudness_target: loudnessTarget,
    vo_content_contract: voContentContract,
    vo_quality_gate: voQualityGate
  });

  if (elevenlabsModel || elevenlabsStability !== undefined || elevenlabsSimilarity !== undefined) {
    try { db.prepare('ALTER TABLE pillar_campaigns ADD COLUMN IF NOT EXISTS elevenlabs_model TEXT DEFAULT NULL').run(); } catch (_) {}
    try { db.prepare('ALTER TABLE pillar_campaigns ADD COLUMN IF NOT EXISTS elevenlabs_stability REAL DEFAULT 0.5').run(); } catch (_) {}
    try { db.prepare('ALTER TABLE pillar_campaigns ADD COLUMN IF NOT EXISTS elevenlabs_similarity_boost REAL DEFAULT 0.75').run(); } catch (_) {}
    try {
      await db.prepare(
        'UPDATE pillar_campaigns SET elevenlabs_model = ?, elevenlabs_stability = ?, elevenlabs_similarity_boost = ? WHERE id = ?'
      ).run(
        elevenlabsModel || 'eleven_multilingual_v2',
        Number(elevenlabsStability ?? 0.5),
        Number(elevenlabsSimilarity ?? 0.75),
        campaignId
      );
    } catch (_) {}
  }

  // 6. Buat Item: mode default 'gemini_engineer' masuk antrean Stage 1 (generation_status: 'pending'),
  //    sedangkan 'direct_passthrough' mempertahankan behavior legacy (generation_status: 'completed').
  const initialGenerationStatus = promptMode === 'direct_passthrough' ? 'completed' : 'pending';
  const creativePayload = {
    content_kind: 'custom_storyboard',
    prompt_mode: promptMode,
    title,
    content_pillar: contentPillar,
    creative_brief: creativeBrief,
    post_link_affiliate: postLinkAffiliate,
    ...(requestedPresetKey ? { preset_key: requestedPresetKey } : {}),
    scenes_count: scenes.length,
    video_dna: dna,
    product_id: matchedProduct?.id || null,
    custom_storyboard: {
      title,
      content_pillar: contentPillar,
      creative_brief: creativeBrief,
      scenes,
      social_media_package: storyboard.social_media_package || null
    }
  };

  await createPillarCampaignItem({
    campaign_id: campaignId,
    row_creative_payload: JSON.stringify(creativePayload),
    generation_status: initialGenerationStatus,
    start_frame_status: visualMode === 'hybrid_lock' ? 'pending' : 'skipped',
    content_kind: 'custom_storyboard',
    recipe_revision: 1,
    result_json: promptMode === 'direct_passthrough' ? JSON.stringify(completeResultJson) : null,
    new_video_plan_json: promptMode === 'direct_passthrough' ? JSON.stringify(scenes) : '[]',
    tts_status: 'pending',
    visual_status: 'pending',
    ffmpeg_status: 'pending',
    upload_status: 'pending'
  });

  // Dapatkan ID item yang baru dibuat
  const insertedRow = await db.prepare(
    'SELECT id FROM pillar_campaign_items WHERE campaign_id = ? ORDER BY id DESC LIMIT 1'
  ).get(campaignId);
  const itemId = insertedRow?.id;

  if (itemId) {
    await updatePillarCampaignItem(itemId, {
      video_dna_json: JSON.stringify(dna),
      workflow_status: promptMode === 'direct_passthrough'
        ? (executionMode === 'full_autopilot' ? 'production_processing' : 'ready_for_review')
        : 'pending_generation'
    });

    if (promptMode === 'direct_passthrough' && executionMode === 'full_autopilot') {
      try {
        await approvePillarCampaignItemUnchanged(itemId);
      } catch (apprErr) {
        console.warn(`[Custom Storyboard] Auto-approve note for item ${itemId}:`, apprErr.message);
      }
    }
  }

  // 7. Picu Scheduler Background jika bukan di lingkungan test
  if (process.env.NODE_ENV !== 'test') {
    try {
      startCampaignScheduler();
    } catch (schedErr) {
      console.warn('[Custom Storyboard] startCampaignScheduler notice:', schedErr.message);
    }
  }

  const finalStatus = promptMode === 'direct_passthrough'
    ? (executionMode === 'full_autopilot' ? 'production_processing' : 'ready_for_review')
    : 'pending_generation';

  return {
    success: true,
    campaign_id: campaignId,
    item_id: itemId,
    campaign_name: title,
    brand_name: brandName,
    ...(requestedPresetKey ? { preset_key: requestedPresetKey } : {}),
    prompt_mode: promptMode,
    execution_mode: executionMode,
    status: finalStatus,
    total_scenes: scenes.length,
    aspect_ratio: aspectRatio,
    target_ai_engine: targetAiEngine,
    voice_provider: voiceProvider,
    voice_persona: voicePersona,
    visual_identity_preset_id: visualIdentityPresetId,
    bridge_at_clip: bridgeAtClip,
    bridge_duration_clips: bridgeDurationClips,
    bridge_segments: bridgeNorm.segments,
    product_id: matchedProduct?.id || null,
    product_ref_image_path: productRefImagePath,
    auto_sync_contentflow: Boolean(autoSyncContentflow),
    enable_social_post: Boolean(enableSocialPost),
    production_stages: promptMode === 'direct_passthrough'
      ? ['tts', 'visuals', 'ffmpeg']
      : ['gemini_prompt_engineer', 'start_frames', 'tts', 'visuals', 'ffmpeg'],
    message: promptMode === 'direct_passthrough'
      ? (executionMode === 'full_autopilot'
          ? `Custom Storyboard "${title}" (${scenes.length} scenes) berhasil diterima dan langsung masuk antrean rendering TTS & Video!`
          : `Custom Storyboard "${title}" (${scenes.length} scenes) berhasil didaftarkan dan menunggu review persetujuan.`)
      : `Custom Storyboard "${title}" (${scenes.length} scenes) berhasil disimpan dan masuk antrean Gemini AI Prompt Engineer untuk menyusun prompt T2I/I2V sebelum rendering.`
  };
}

/**
 * Eksekusi batch maksimal 12 custom storyboard per panggilan (P3).
 */
export async function executeCustomStoryboardBatch({
  items,
  brandId = null,
  presetKey = null,
  promptMode = null,
  tenantId = 'default_tenant',
  executionMode = 'full_autopilot',
  idempotencyKey = null
}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Batch items wajib berisi minimal 1 storyboard.');
  }
  if (items.length > 12) {
    throw new Error('Maksimal 12 custom storyboard per batch.');
  }

  const created = [];
  const errors = [];

  for (let i = 0; i < items.length; i++) {
    const raw = items[i] || {};
    const mergedStoryboard = {
      ...raw,
      brand_id: raw.brand_id || brandId || undefined,
      preset_key: raw.preset_key || raw.presetKey || presetKey || undefined,
      ...(promptMode && !raw.prompt_mode ? { prompt_mode: promptMode } : {})
    };
    const itemIdemKey = raw.idempotency_key || (idempotencyKey ? `${idempotencyKey}:item_${i}` : null);
    try {
      const res = await executeCustomStoryboardPipeline({
        storyboard: mergedStoryboard,
        tenantId,
        executionMode: raw.execution_mode || executionMode,
        idempotencyKey: itemIdemKey
      });
      created.push({ index: i, ...res });
    } catch (err) {
      errors.push({ index: i, title: raw.title || `Item #${i + 1}`, error: err.message });
    }
  }

  return {
    success: created.length > 0 && errors.length === 0,
    partial_success: created.length > 0 && errors.length > 0,
    count: created.length,
    total_requested: items.length,
    created,
    errors
  };
}
