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

  // 2. Video DNA & Konfigurasi Visual (P1-2: G3, G4)
  const dna = storyboard.video_dna || {};
  const aspectRatio = ['9:16', '16:9', '1:1'].includes(dna.aspect_ratio) ? dna.aspect_ratio : '9:16';
  const visualStyle = dna.visual_style || 'Cinematic';
  const visualMode = dna.visual_mode || 'hybrid_lock';
  const targetAiEngine = dna.target_ai_engine || 'Google Veo (8s)';
  const voiceProvider = ['gemini', 'minimax', 'elevenlabs'].includes(dna.voice_provider)
    ? dna.voice_provider
    : 'gemini';
  const voicePersona = dna.voice_persona || (voiceProvider === 'gemini' ? 'Aoede' : 'Indonesian_casual_reporter_vv2');
  const voiceSpeed = Number(dna.voice_speed ?? dna.speed_control ?? (voiceProvider === 'gemini' ? 2.5 : 1.0));
  const voiceVolume = Number(dna.voice_volume ?? 1.0);
  const targetLanguage = dna.target_language || 'id-ID';
  const wordsPerClip = dna.words_per_clip ?? 12;
  const clipDuration = Number(dna.clip_duration || 8);
  const visualIdentityPresetId = storyboard.visual_identity_preset_id || dna.visual_identity_preset_id || null;
  const enableSocialPost = storyboard.enable_social_post !== undefined
    ? (storyboard.enable_social_post ? 1 : 0)
    : (matchedProduct ? 1 : 0);
  const autoSyncContentflow = storyboard.auto_sync_contentflow === false ? 0 : 1;

  const campaignId = `cst_${uuidv4().replace(/-/g, '').slice(0, 12)}`;

  // 3. Normalisasi Scenes ke format new_video_plan_json & voiceover list
  const scenes = rawScenes.map((s, idx) => {
    const clipIndex = s.scene_index || (idx + 1);
    const voText = String(s.voiceover_text || '').trim();
    const visualPrompt = String(s.visual_prompt || s.visual_description || '').trim();
    const motionPrompt = String(s.i2v_prompt || s.camera_movement || 'Cinematic subtle motion').trim();
    const duration = Number(s.duration_seconds || clipDuration || 4);

    return {
      clip_index: clipIndex,
      visual_action: visualPrompt,
      new_vo: voText,
      t2i_prompt: visualPrompt,
      t2v_prompt: visualPrompt,
      i2v_prompt: motionPrompt,
      duration_seconds: duration,
      duration: duration
    };
  });

  const voiceoverList = scenes.map(s => ({
    scene: s.clip_index,
    narration: s.new_vo,
    duration: `${s.duration}s`
  }));

  // 4. Normalisasi Social Media Package
  const rawSocial = storyboard.social_media_package || {};
  const baseCaption = rawSocial.caption || rawSocial.caption_universal || scenes[0]?.new_vo || title;
  const rawTags = Array.isArray(rawSocial.hashtags) ? rawSocial.hashtags : [];

  const adaptedCaptions = buildPlatformAdaptiveCaptions({
    baseCaption,
    hashtags: rawTags,
    matchedProduct
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
    content_pillar: 'Custom AI Storyboard',
    custom_hook: scenes[0]?.new_vo?.slice(0, 100) || '',
    visual_action_guideline: scenes[0]?.visual_action?.slice(0, 150) || '',
    custom_instruction: 'Storyboarding by external creative intelligence',
    ai_directive: '',
    mandatory_outro_line: '',
    brand_profile_id: brandProfileId,
    narrative_mode: 'Storytelling',
    visual_style: visualStyle,
    face_visibility: 'Faceless',
    is_bridging_active: matchedProduct ? 1 : (storyboard.is_bridging_active ? 1 : 0),
    target_clips_count: scenes.length,
    bridge_at_clip: Number(storyboard.bridge_at_clip || dna.bridge_at_clip || 1),
    bridge_duration_clips: Number(storyboard.bridge_duration_clips || dna.bridge_duration_clips || scenes.length),
    bridging_mode: storyboard.bridging_mode || (matchedProduct ? 'select_existing' : 'none'),
    target_product_id: matchedProduct?.id || null,
    ephemeral_product_data: null,
    aspect_ratio: aspectRatio,
    target_ai: targetAiEngine,
    video_model: dna.video_model || 'veo_31_lite',
    visual_mode: visualMode,
    product_ref_image_path: productRefImagePath,
    product_filename_declare: matchedProduct ? `${matchedProduct.product_name}` : null,
    visual_overrides_json: null,
    visual_identity_preset_id: visualIdentityPresetId,
    visual_identity_preset_version: 1,
    enable_tts: 1,
    enable_glabs: 1,
    enable_ffmpeg: 1,
    enable_social_post: enableSocialPost,
    post_facebook_draft: 0,
    facebook_page_id: null,
    facebook_server_url: null,
    voice_provider: voiceProvider,
    voice_persona: voicePersona,
    words_per_clip: wordsPerClip,
    clip_duration: clipDuration,
    upload_markdown: 1,
    upload_spreadsheet: 0,
    target_spreadsheet_id: null,
    target_markdown_url: null,
    local_scheduler: 0,
    scheduler_pause_at: executionMode === 'full_autopilot' ? null : 'tts',
    is_mass_production: 0,
    tts_model_quality: dna.tts_model_quality || (voiceProvider === 'gemini' ? 'standard' : 'speech-2.8-turbo'),
    voice_speed: voiceSpeed,
    voice_volume: voiceVolume,
    target_language: targetLanguage,
    ffmpeg_sync_option: dna.ffmpeg_sync_option || 'stretch',
    ffmpeg_video_scale: Number(dna.ffmpeg_video_scale ?? 1.0),
    ffmpeg_sfx_volume: Number(dna.ffmpeg_sfx_volume ?? (dna.enable_sfx === false ? 0 : 0.8)),
    ffmpeg_bgm_volume: Number(dna.ffmpeg_bgm_volume ?? (dna.enable_bgm === false ? 0 : 0.15)),
    nextcloud_parent_folder: null,
    fb_draft_mode: 'none',
    sfx_setting: dna.enable_sfx === false ? 'without_sfx' : (dna.sfx_setting || 'subtle_ambient'),
    enable_vo_audit: 0,
    enable_audio_segment: 0,
    voice_cast_json: null,
    target_demographic: 'genz_casual',
    target_demographic_custom: null,
    approval_mode: executionMode === 'full_autopilot' ? 'none' : 'creative',
    auto_sync_contentflow: autoSyncContentflow,
    enable_motion_text: dna.enable_motion_text !== false ? 1 : 0,
    motion_text_style: dna.motion_text_style || 'floating_white_yellow',
    motion_text_position: dna.motion_text_position || 'bottom',
    motion_hook_effect: 'pop_bounce',
    motion_story_effect: 'typewriter',
    motion_cta_effect: 'pop_bounce',
    video_transition: dna.video_transition || 'fade',
    transition_duration: Number(dna.transition_duration || 0.5)
  });

  if (dna.elevenlabs_model || dna.elevenlabs_stability !== undefined || dna.elevenlabs_similarity_boost !== undefined) {
    try { db.prepare('ALTER TABLE pillar_campaigns ADD COLUMN IF NOT EXISTS elevenlabs_model TEXT DEFAULT NULL').run(); } catch (_) {}
    try { db.prepare('ALTER TABLE pillar_campaigns ADD COLUMN IF NOT EXISTS elevenlabs_stability REAL DEFAULT 0.5').run(); } catch (_) {}
    try { db.prepare('ALTER TABLE pillar_campaigns ADD COLUMN IF NOT EXISTS elevenlabs_similarity_boost REAL DEFAULT 0.75').run(); } catch (_) {}
    try {
      await db.prepare(
        'UPDATE pillar_campaigns SET elevenlabs_model = ?, elevenlabs_stability = ?, elevenlabs_similarity_boost = ? WHERE id = ?'
      ).run(
        dna.elevenlabs_model || 'eleven_multilingual_v2',
        Number(dna.elevenlabs_stability ?? 0.5),
        Number(dna.elevenlabs_similarity_boost ?? 0.75),
        campaignId
      );
    } catch (_) {}
  }

  // 6. Buat Item dengan generation_status: 'completed'
  const creativePayload = {
    content_kind: 'custom_storyboard',
    title,
    scenes_count: scenes.length,
    video_dna: dna,
    product_id: matchedProduct?.id || null
  };

  await createPillarCampaignItem({
    campaign_id: campaignId,
    row_creative_payload: JSON.stringify(creativePayload),
    generation_status: 'completed',
    start_frame_status: visualMode === 'hybrid_lock' ? 'pending' : 'skipped',
    content_kind: 'custom_storyboard',
    recipe_revision: 1,
    result_json: JSON.stringify(completeResultJson),
    new_video_plan_json: JSON.stringify(scenes),
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
      workflow_status: executionMode === 'full_autopilot' ? 'production_processing' : 'ready_for_review'
    });

    if (executionMode === 'full_autopilot') {
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

  return {
    success: true,
    campaign_id: campaignId,
    item_id: itemId,
    campaign_name: title,
    brand_name: brandName,
    execution_mode: executionMode,
    status: executionMode === 'full_autopilot' ? 'production_processing' : 'ready_for_review',
    total_scenes: scenes.length,
    aspect_ratio: aspectRatio,
    target_ai_engine: targetAiEngine,
    voice_provider: voiceProvider,
    product_id: matchedProduct?.id || null,
    product_ref_image_path: productRefImagePath,
    auto_sync_contentflow: Boolean(autoSyncContentflow),
    enable_social_post: Boolean(enableSocialPost),
    production_stages: ['tts', 'visuals', 'ffmpeg'],
    message: executionMode === 'full_autopilot'
      ? `Custom Storyboard "${title}" (${scenes.length} scenes) berhasil diterima dan langsung masuk antrean rendering TTS & Video!`
      : `Custom Storyboard "${title}" (${scenes.length} scenes) berhasil didaftarkan dan menunggu review persetujuan.`
  };
}

/**
 * Eksekusi batch maksimal 12 custom storyboard per panggilan (P3).
 */
export async function executeCustomStoryboardBatch({
  items,
  brandId = null,
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
      brand_id: raw.brand_id || brandId || undefined
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
