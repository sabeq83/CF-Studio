/**
 * lib/custom-storyboard-pipeline.js
 *
 * Pipeline Engine untuk menerima Custom Storyboard langsung dari AI eksternal
 * (Claude, ChatGPT, Gemini, dll.) atau API, mem-bypass generator internal,
 * dan langsung memasukkan naskah + visual prompts ke antrean produksi (TTS, Veo, FFmpeg).
 */

import { v4 as uuidv4 } from 'uuid';
import { getDb, createPillarCampaign, createPillarCampaignItem, updatePillarCampaignItem } from './db.js';
import { startCampaignScheduler } from './campaign-scheduler.js';
import { approvePillarCampaignItemUnchanged } from './pillar-campaign-approval.js';
import { stripCtaAndHashtags, buildPlatformAdaptiveCaptions } from './smart-affiliate-package-builder.js';

/**
 * Validasi dan eksekusi custom storyboard ke dalam pipeline produksi CF Studio.
 *
 * @param {Object} params
 * @param {Object} params.storyboard - Payload storyboard terstruktur
 * @param {string} [params.tenantId='default_tenant'] - ID Tenant aktif
 * @param {string} [params.executionMode='full_autopilot'] - 'full_autopilot' atau 'creative_review'
 * @returns {Promise<Object>} Status dan ID campaign yang telah didaftarkan
 */
export async function executeCustomStoryboardPipeline({
  storyboard,
  tenantId = 'default_tenant',
  executionMode = 'full_autopilot'
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

  // 2. Video DNA & Konfigurasi Visual
  const dna = storyboard.video_dna || {};
  const aspectRatio = ['9:16', '16:9', '1:1'].includes(dna.aspect_ratio) ? dna.aspect_ratio : '9:16';
  const visualStyle = dna.visual_style || 'Cinematic';
  const visualMode = dna.visual_mode || 'hybrid_lock';
  const targetAiEngine = dna.target_ai_engine || 'Google Veo (8s)';
  const voicePersona = dna.voice_persona || 'Aoede';
  const voiceSpeed = Number(dna.speed_control || 2.5);

  const campaignId = `cst_${uuidv4().replace(/-/g, '').slice(0, 12)}`;

  // 3. Normalisasi Scenes ke format new_video_plan_json & voiceover list
  const scenes = rawScenes.map((s, idx) => {
    const clipIndex = s.scene_index || (idx + 1);
    const voText = String(s.voiceover_text || '').trim();
    const visualPrompt = String(s.visual_prompt || s.visual_description || '').trim();
    const motionPrompt = String(s.i2v_prompt || s.camera_movement || 'Cinematic subtle motion').trim();
    const duration = Number(s.duration_seconds || 4);

    return {
      clip_index: clipIndex,
      visual_action: visualPrompt,
      new_vo: voText,
      t2i_prompt: visualPrompt,
      t2v_prompt: visualPrompt,
      i2v_prompt: motionPrompt,
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
    matched_product: matchedProduct
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
    account_name: brandName,
    source_planner_id: null,
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
    is_bridging_active: 0,
    target_clips_count: scenes.length,
    bridge_at_clip: 1,
    bridge_duration_clips: 1,
    bridging_mode: 'select_existing',
    target_product_id: null,
    ephemeral_product_data: null,
    aspect_ratio: aspectRatio,
    target_ai: targetAiEngine,
    video_model: 'veo_31_lite',
    visual_mode: visualMode,
    product_ref_image_path: null,
    product_filename_declare: null,
    visual_overrides_json: null,
    visual_identity_preset_id: dna.visual_identity_preset_id || null,
    visual_identity_preset_version: 1,
    enable_tts: 1,
    enable_glabs: 1,
    enable_ffmpeg: 1,
    enable_social_post: 0,
    post_facebook_draft: 0,
    facebook_page_id: null,
    facebook_server_url: null,
    voice_provider: 'gemini',
    voice_persona: voicePersona,
    words_per_clip: 12,
    clip_duration: 8,
    upload_markdown: 1,
    upload_spreadsheet: 0,
    target_spreadsheet_id: null,
    target_markdown_url: null,
    local_scheduler: 0,
    scheduler_pause_at: executionMode === 'full_autopilot' ? null : 'tts',
    is_mass_production: 0,
    tts_model_quality: 'standard',
    voice_speed: voiceSpeed,
    voice_volume: 1.0,
    target_language: dna.target_language || 'id-ID',
    ffmpeg_sync_option: 'stretch',
    ffmpeg_video_scale: 1.0,
    ffmpeg_sfx_volume: 0.8,
    ffmpeg_bgm_volume: 0.15,
    nextcloud_parent_folder: null,
    fb_draft_mode: 'none',
    sfx_setting: 'subtle_ambient',
    enable_vo_audit: 0,
    enable_audio_segment: 0,
    voice_cast_json: null,
    target_demographic: 'genz_casual',
    target_demographic_custom: null,
    approval_mode: executionMode === 'full_autopilot' ? 'none' : 'creative',
    auto_sync_contentflow: 0,
    enable_motion_text: dna.enable_motion_text !== false ? 1 : 0,
    motion_text_style: dna.motion_text_style || 'floating_white_yellow',
    motion_text_position: dna.motion_text_position || 'bottom',
    motion_hook_effect: 'pop_bounce',
    motion_story_effect: 'typewriter',
    motion_cta_effect: 'pop_bounce',
    video_transition: dna.video_transition || 'fade',
    transition_duration: Number(dna.transition_duration || 0.5)
  });

  // 6. Buat Item dengan generation_status: 'completed'
  const creativePayload = {
    content_kind: 'custom_storyboard',
    title,
    scenes_count: scenes.length,
    video_dna: dna
  };

  const createItemResult = await createPillarCampaignItem({
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
    production_stages: ['tts', 'visuals', 'ffmpeg'],
    message: executionMode === 'full_autopilot'
      ? `Custom Storyboard "${title}" (${scenes.length} scenes) berhasil diterima dan langsung masuk antrean rendering TTS & Video!`
      : `Custom Storyboard "${title}" (${scenes.length} scenes) berhasil didaftarkan dan menunggu review persetujuan.`
  };
}
