import { getActiveTenantId } from './tenant-context.js';
import { normalizeBridgePayload } from './bridging/bridge-plan.js';

/**
 * Build shared strategy and workflow fields from an operator preset so editorial
 * and product pipelines preserve audio segments, G-Labs toggle, approval mode, and pause gates.
 */
export function buildPresetHydratedGlobalFields({ effectivePresetKey, presetConfig, executionMode, overrides }) {
  const audioMode = overrides?.audio_engine_mode
    || presetConfig?.workflow?.audio_engine_mode
    || presetConfig?.basic_strategy?.audio_engine_mode
    || ((overrides?.enable_tts === false || overrides?.enable_tts === 0 || presetConfig?.workflow?.enable_tts === false || presetConfig?.workflow?.enable_tts === 0) ? 'native_veo' : 'minimax_tts');
  const isTtsDisabledByMode = audioMode === 'no_vo' || audioMode === 'native_veo';
  const noVoAudioBed = overrides?.no_vo_audio_bed
    || presetConfig?.workflow?.no_vo_audio_bed
    || presetConfig?.basic_strategy?.no_vo_audio_bed
    || 'native_sfx_ambience';
  const onScreenTextMode = overrides?.on_screen_text_mode
    || presetConfig?.workflow?.on_screen_text_mode
    || presetConfig?.basic_strategy?.on_screen_text_mode
    || 'short_caption_overlay';
  const resolvedEnableTts = isTtsDisabledByMode
    ? 0
    : (overrides?.enable_tts !== undefined
      ? (overrides.enable_tts ? 1 : 0)
      : (presetConfig?.workflow?.enable_tts !== undefined ? (presetConfig.workflow.enable_tts ? 1 : 0) : 1));
  return {
    operator_preset_key: effectivePresetKey,
    preset_key: effectivePresetKey,
    audio_engine_mode: audioMode,
    no_vo_audio_bed: noVoAudioBed,
    on_screen_text_mode: onScreenTextMode,
    enable_tts: resolvedEnableTts,
    enable_audio_segment: audioMode === 'no_vo'
      ? 0
      : (overrides?.enable_audio_segment !== undefined
        ? (overrides.enable_audio_segment ? 1 : 0)
        : (presetConfig?.basic_strategy?.enable_audio_segment ? 1 : 0)),
    sfx_setting: overrides?.sfx_setting || presetConfig?.basic_strategy?.sfx_setting || 'without_sfx',
    enable_vo_audit: overrides?.enable_vo_audit !== undefined
      ? Number(overrides.enable_vo_audit)
      : Number(presetConfig?.basic_strategy?.enable_vo_audit ?? 0),
    nextcloud_parent_folder: overrides?.nextcloud_parent_folder || presetConfig?.basic_strategy?.nextcloud_parent_folder || '/MAKNA_Assets',
    approval_mode: overrides?.approval_mode || presetConfig?.workflow?.approval_mode || (executionMode === 'full_autopilot' ? 'none' : 'creative'),
    enable_glabs: overrides?.enable_glabs !== undefined
      ? (overrides.enable_glabs ? 1 : 0)
      : (presetConfig?.workflow?.enable_glabs !== undefined ? (presetConfig.workflow.enable_glabs ? 1 : 0) : 1),
    scheduler_pause_at: overrides?.scheduler_pause_at ?? presetConfig?.workflow?.scheduler_pause_at ?? null,
    ...(overrides?.voice_cast_json !== undefined
      ? { voice_cast_json: overrides.voice_cast_json }
      : (presetConfig?.basic_strategy?.voice_cast_json ? { voice_cast_json: presetConfig.basic_strategy.voice_cast_json } : {}))
  };
}

export function validateAndNormalizePresetProductBridging(config = {}) {
  if (!config || typeof config !== 'object' || !config.product_bridging || typeof config.product_bridging !== 'object') {
    return { error: null, errors: [], product_bridging: config?.product_bridging };
  }
  const pb = config.product_bridging;
  const ve = config.visual_engine || {};
  if (!pb.is_bridging_active) {
    return { error: null, errors: [], product_bridging: pb };
  }
  const norm = normalizeBridgePayload(pb, ve, {
    targetClips: ve?.target_clips_count || null,
    defaultActive: true,
    singleZoneOnly: ve?.visual_style === 'investigative_faceless'
  });
  if (norm.errors.length > 0) {
    return { error: norm.errors[0], errors: norm.errors, product_bridging: pb };
  }
  return {
    error: null,
    errors: [],
    product_bridging: {
      ...pb,
      is_bridging_active: true,
      bridging_mode: norm.bridgingMode || pb.bridging_mode || 'select_existing',
      vo_product_mention: norm.voProductMention || 'full',
      bridge_at_clip: norm.legacy.bridge_at_clip,
      bridge_duration_clips: norm.legacy.bridge_duration_clips,
      bridge_segments: norm.segments
    }
  };
}

function normalizePresetProductBridging(productBridging, visualEngine) {
  if (!productBridging || typeof productBridging !== 'object') return productBridging;
  const norm = normalizeBridgePayload(productBridging, visualEngine, {
    targetClips: visualEngine?.target_clips_count || null,
    defaultActive: Boolean(productBridging.is_bridging_active),
    singleZoneOnly: visualEngine?.visual_style === 'investigative_faceless'
  });
  return {
    ...productBridging,
    is_bridging_active: norm.active,
    bridging_mode: norm.bridgingMode || productBridging.bridging_mode || 'select_existing',
    vo_product_mention: norm.voProductMention || 'full',
    bridge_at_clip: norm.legacy.bridge_at_clip,
    bridge_duration_clips: norm.legacy.bridge_duration_clips,
    ...(norm.active ? { bridge_segments: norm.segments } : {})
  };
}

const CUSTOM_PRESET_CACHE = globalThis.__operatorPresetCache || {};
globalThis.__operatorPresetCache = CUSTOM_PRESET_CACHE;

const PRESETS = {
  brand_editorial_campaign: {
    schema_version: '2',
    label: 'Brand Editorial Campaign',
    campaign_kinds: ['brand_editorial'],
    planner_defaults: {
      target_audience: '',
      content_goal: 'Authority, brand awareness, saves, dan engagement.'
    },
    basic_strategy: {
      narrative_mode: 'Storytelling',
      audio_engine_mode: 'minimax_tts',
      google_voice_persona: 'Kore',
      voice_provider: 'minimax',
      voice_persona: 'Indonesian_professional_anchor_vv2',
      voice_speed: 1.0,
      voice_volume: 1.0,
      tts_model_quality: 'speech-2.8-turbo',
      target_language: 'id-ID',
      target_demographic: 'ibu_rumah_tangga',
      target_demographic_custom: '',
      promotion_style: 'Softselling',
      enable_audio_segment: false,
      sfx_setting: 'without_sfx',
      enable_vo_audit: 1,
      nextcloud_parent_folder: '/MAKNA_Assets',
      ai_directive: 'Konten edukasi dan narasi brand berkualitas; fokus pada storytelling dan nilai tanpa klaim berlebihan.',
      mandatory_outro_line: ''
    },
    visual_engine: {
      visual_style: 'Cinematic',
      visual_mode: 'hybrid_lock',
      video_model: 'veo_31_lite',
      clip_duration: 8,
      face_visibility: 'Faceless',
      target_clips_count: 4,
      words_per_clip: '17-19 kata',
      aspect_ratio: '9:16'
    },
    product_bridging: {
      is_bridging_active: false,
      bridging_mode: 'select_existing',
      bridge_at_clip: 3,
      bridge_duration_clips: 1
    },
    visual_swap: {
      is_vso_active: true,
      character_concept: 'faceless',
      subject_demographic: 'syari_classic',
      wardrobe_style: 'sequential',
      wardrobe_style_custom: '',
      lighting_style: 'window_daylight',
      lighting_style_custom: '',
      visual_style_preset: '3d_claymation_cozy',
      visual_identity_preset_id: 'hands_only_muslimah_sage_kitchen',
      visual_identity_inline_config: null,
      visual_overrides_json: null
    },
    workflow: {
      approval_mode: 'storyboard',
      enable_tts: true,
      audio_engine_mode: 'minimax_tts',
      google_voice_persona: 'Kore',
      enable_native_sfx: true,
      enable_native_ambience: true,
      anti_music_guardrail: true,
      enable_glabs: true,
      enable_ffmpeg: true,
      ffmpeg_sync_option: 'smart_sync',
      ffmpeg_video_scale: 1.0,
      ffmpeg_sfx_volume: 0.0,
      ffmpeg_bgm_volume: 0.0,
      enable_motion_text: true,
      motion_text_style: 'floating_white_yellow',
      motion_text_position: 'bottom',
      video_transition: 'cut',
      transition_duration: 0.5,
      finishing_template: 'none',
      caption_mode: 'hybrid',
      loudness_target: -14,
      vo_content_contract: 'off',
      vo_quality_gate: 'off',
      enable_social_post: false,
      upload_markdown: true,
      upload_spreadsheet: false,
      auto_sync_contentflow: true
    }
  },
  product_campaign: {
    schema_version: '2',
    label: 'Product Campaign',
    campaign_kinds: ['product_campaign'],
    planner_defaults: {
      target_audience: '',
      content_goal: 'Conversion, product education, dan qualified engagement.'
    },
    basic_strategy: {
      narrative_mode: 'auto',
      audio_engine_mode: 'minimax_tts',
      google_voice_persona: 'Kore',
      voice_provider: 'minimax',
      voice_persona: 'Indonesian_casual_reporter_vv2',
      voice_speed: 1.0,
      voice_volume: 1.0,
      tts_model_quality: 'speech-2.8-turbo',
      target_language: 'id-ID',
      target_demographic: 'custom',
      target_demographic_custom: '',
      promotion_style: 'Softselling',
      enable_audio_segment: false,
      sfx_setting: 'without_sfx',
      enable_vo_audit: 1,
      nextcloud_parent_folder: '/MAKNA_Assets',
      ai_directive: 'Gunakan hanya fakta, USP, dan klaim yang tersedia pada snapshot produk.',
      mandatory_outro_line: ''
    },
    visual_engine: {
      visual_style: 'UGC',
      visual_mode: 'hybrid_lock',
      video_model: 'veo_31_lite',
      clip_duration: 8,
      face_visibility: 'POV',
      target_clips_count: 4,
      words_per_clip: '17-19 kata',
      aspect_ratio: '9:16'
    },
    product_bridging: {
      is_bridging_active: true,
      bridging_mode: 'select_existing',
      bridge_at_clip: 3,
      bridge_duration_clips: 1
    },
    visual_swap: {
      is_vso_active: false,
      character_concept: 'faceless',
      subject_demographic: 'syari_classic',
      wardrobe_style: 'amber_terracotta',
      wardrobe_style_custom: '',
      lighting_style: 'window_daylight',
      lighting_style_custom: '',
      visual_style_preset: '3d_claymation_cozy',
      visual_identity_preset_id: null,
      visual_identity_inline_config: null,
      visual_overrides_json: null
    },
    workflow: {
      approval_mode: 'start_frames',
      enable_tts: true,
      audio_engine_mode: 'minimax_tts',
      google_voice_persona: 'Kore',
      enable_native_sfx: true,
      enable_native_ambience: true,
      anti_music_guardrail: true,
      enable_glabs: true,
      enable_ffmpeg: true,
      ffmpeg_sync_option: 'smart_sync',
      ffmpeg_video_scale: 1.0,
      ffmpeg_sfx_volume: 0.0,
      ffmpeg_bgm_volume: 0.0,
      enable_motion_text: true,
      motion_text_style: 'floating_white_yellow',
      motion_text_position: 'bottom',
      video_transition: 'cut',
      transition_duration: 0.5,
      finishing_template: 'none',
      caption_mode: 'hybrid',
      loudness_target: -14,
      vo_content_contract: 'off',
      vo_quality_gate: 'off',
      enable_social_post: false,
      upload_markdown: true,
      upload_spreadsheet: false,
      auto_sync_contentflow: true
    }
  },
  recipe_campaign: {
    schema_version: '2',
    label: 'Recipe Campaign Default',
    campaign_kinds: ['recipe_campaign'],
    planner_defaults: {
      target_audience: 'genz_casual',
      content_goal: 'Practical culinary inspiration, high sensory reward, and engagement.'
    },
    basic_strategy: {
      narrative_mode: 'Storytelling',
      audio_engine_mode: 'minimax_tts',
      google_voice_persona: 'Puck',
      voice_provider: 'minimax',
      voice_persona: 'English_causual_narrator_vv1',
      voice_speed: 1.0,
      voice_volume: 1.0,
      tts_model_quality: 'speech-2.8-turbo',
      target_language: 'en-US',
      target_demographic: 'genz_casual',
      target_demographic_custom: '',
      promotion_style: 'Softselling',
      enable_audio_segment: false,
      sfx_setting: 'without_sfx',
      enable_vo_audit: 1,
      nextcloud_parent_folder: '/MAKNA_Assets',
      ai_directive: 'Resep masakan lezat dan praktis; visual fokus pada makanan dan alat masak terkunci.',
      mandatory_outro_line: 'Want more recipes? Link in bio!'
    },
    visual_engine: {
      visual_style: 'Food Porn',
      visual_mode: 'hybrid_lock',
      video_model: 'omni_flash',
      clip_duration: 4,
      face_visibility: 'Faceless',
      target_clips_count: 6,
      words_per_clip: '8-9 kata',
      aspect_ratio: '9:16'
    },
    product_bridging: {
      is_bridging_active: false,
      bridging_mode: 'select_existing',
      bridge_at_clip: 2,
      bridge_duration_clips: 1
    },
    visual_swap: {
      is_vso_active: true,
      character_concept: 'faceless',
      subject_demographic: 'custom',
      wardrobe_style: 'custom',
      wardrobe_style_custom: '',
      lighting_style: 'window_daylight',
      lighting_style_custom: '',
      visual_style_preset: 'culinary_cinematic',
      visual_identity_preset_id: 'vi_habitfolk_macro_craft',
      visual_identity_inline_config: null,
      visual_overrides_json: null
    },
    workflow: {
      approval_mode: 'storyboard',
      enable_tts: true,
      audio_engine_mode: 'minimax_tts',
      google_voice_persona: 'Puck',
      enable_native_sfx: true,
      enable_native_ambience: true,
      anti_music_guardrail: true,
      enable_glabs: true,
      enable_ffmpeg: true,
      ffmpeg_sync_option: 'smart_sync',
      ffmpeg_video_scale: 1.0,
      ffmpeg_sfx_volume: 0.0,
      ffmpeg_bgm_volume: 0.0,
      enable_motion_text: true,
      motion_text_style: 'floating_white_yellow',
      motion_text_position: 'bottom',
      video_transition: 'slideleft',
      transition_duration: 0.5,
      finishing_template: 'none',
      caption_mode: 'hybrid',
      loudness_target: -14,
      vo_content_contract: 'off',
      vo_quality_gate: 'off',
      enable_social_post: false,
      upload_markdown: true,
      upload_spreadsheet: false,
      auto_sync_contentflow: true
    }
  },
  multiplier_deconstruct_remix: {
    schema_version: '2',
    label: 'Multiplier Deconstruct Remix',
    campaign_kinds: ['multiplier_campaign'],
    planner_defaults: {
      target_audience: '',
      content_goal: 'Viral hook testing, multiple angle variation, direct engagement.'
    },
    basic_strategy: {
      narrative_mode: 'Storytelling',
      audio_engine_mode: 'minimax_tts',
      google_voice_persona: 'Kore',
      voice_provider: 'minimax',
      voice_persona: 'Indonesian_professional_anchor_vv2',
      voice_speed: 1.0,
      voice_volume: 1.0,
      tts_model_quality: 'speech-2.8-turbo',
      target_language: 'id-ID',
      target_demographic: 'general_adult',
      target_demographic_custom: '',
      promotion_style: 'Softselling',
      enable_audio_segment: false,
      sfx_setting: 'without_sfx',
      enable_vo_audit: 1,
      nextcloud_parent_folder: '/MAKNA_Multiplier',
      ai_directive: 'Remix angle dan hook viral dari blueprint referensi; hasilkan variasi hook 0-3 detik yang mengikat audiens.',
      mandatory_outro_line: ''
    },
    visual_engine: {
      visual_style: 'Realistic',
      visual_mode: 'hybrid_lock',
      video_model: 'veo_31_lite',
      clip_duration: 5,
      face_visibility: 'Faceless',
      target_clips_count: 5,
      words_per_clip: '15-18 kata',
      aspect_ratio: '9:16'
    },
    product_bridging: {
      is_bridging_active: true,
      bridging_mode: 'select_existing',
      bridge_at_clip: 4,
      bridge_duration_clips: 1
    },
    visual_swap: {
      is_vso_active: true,
      character_concept: 'faceless',
      subject_demographic: 'general',
      wardrobe_style: 'modern_casual',
      wardrobe_style_custom: '',
      lighting_style: 'studio_clean',
      lighting_style_custom: '',
      visual_style_preset: 'photorealistic_clean',
      visual_identity_preset_id: null,
      visual_identity_inline_config: null,
      visual_overrides_json: null
    },
    workflow: {
      approval_mode: 'storyboard',
      enable_tts: true,
      audio_engine_mode: 'minimax_tts',
      google_voice_persona: 'Puck',
      enable_native_sfx: true,
      enable_native_ambience: true,
      anti_music_guardrail: true,
      enable_glabs: true,
      enable_ffmpeg: true,
      ffmpeg_sync_option: 'smart_sync',
      ffmpeg_video_scale: 1.0,
      ffmpeg_sfx_volume: 0.0,
      ffmpeg_bgm_volume: 0.0,
      enable_motion_text: true,
      motion_text_style: 'floating_white_yellow',
      motion_text_position: 'bottom',
      video_transition: 'slideleft',
      transition_duration: 0.5,
      finishing_template: 'none',
      caption_mode: 'hybrid',
      loudness_target: -14,
      vo_content_contract: 'off',
      vo_quality_gate: 'off',
      enable_social_post: false,
      upload_markdown: true,
      upload_spreadsheet: false,
      auto_sync_contentflow: true
    }
  },
  recipe_labs_editorial_food: {
    schema_version: '2',
    label: 'Recipe Labs Editorial Food (Teks & Foto)',
    campaign_kinds: ['recipe_labs'],
    planner_defaults: {
      target_audience: '',
      content_goal: 'Artikel resep Facebook komprehensif, saves resep, dan foto sajian makanan komposit HD.'
    },
    basic_strategy: {
      narrative_mode: 'Instructional',
      voice_provider: 'minimax',
      voice_persona: 'Indonesian_warm_motherly_vv1',
      voice_speed: 1.0,
      voice_volume: 1.0,
      tts_model_quality: 'speech-2.8-turbo',
      target_language: 'id-ID',
      target_demographic: 'ibu_rumah_tangga',
      target_demographic_custom: '',
      promotion_style: 'Softselling',
      enable_audio_segment: false,
      sfx_setting: 'without_sfx',
      enable_vo_audit: 1,
      nextcloud_parent_folder: '/MAKNA_Recipes',
      ai_directive: 'Naskah resep lengkap dengan bahan, takaran, langkah demi langkah, tips anti-gagal, dan caption engagement Facebook.',
      mandatory_outro_line: ''
    },
    visual_engine: {
      visual_style: 'Food Porn',
      visual_mode: 'composite_grid',
      images_per_recipe: 4,
      selected_layout_id: '4_editorial_split',
      grid_gap_size: 12,
      grid_border_radius: 16,
      grid_outer_padding: 16,
      grid_bg_color: '#0d0d12',
      aspect_ratio: '1:1'
    },
    workflow: {
      approval_mode: 'auto',
      enable_gemini_article: true,
      enable_glabs_images: true,
      enable_grid_composite: true,
      enable_facebook_post: true,
      upload_markdown: true,
      upload_spreadsheet: true,
      auto_sync_contentflow: true,
      finishing_template: 'none',
      caption_mode: 'hybrid',
      loudness_target: -14,
      vo_content_contract: 'off',
      vo_quality_gate: 'off'
    }
  },
  brand_explainer_remotion: {
    schema_version: '2',
    label: 'Brand Explainer (Remotion React Engine)',
    campaign_kinds: ['brand_editorial', 'product_campaign'],
    planner_defaults: {
      target_audience: 'Masyarakat umum & keluarga peduli kesehatan',
      content_goal: 'Edukasi kebiasaan sehat, product knowledge, dan konversi TikTok cek keranjang.'
    },
    basic_strategy: {
      narrative_mode: 'Explainer',
      audio_engine_mode: 'minimax_tts',
      google_voice_persona: 'Kore',
      voice_provider: 'minimax',
      voice_persona: 'Indonesian_professional_anchor_vv2',
      voice_speed: 1.0,
      voice_volume: 1.0,
      tts_model_quality: 'speech-2.8-turbo',
      target_language: 'id-ID',
      target_demographic: 'ibu_rumah_tangga',
      target_demographic_custom: '',
      promotion_style: 'Softselling',
      enable_audio_segment: false,
      sfx_setting: 'without_sfx',
      enable_vo_audit: 1,
      nextcloud_parent_folder: '/MAKNA_Assets',
      ai_directive: 'Video explainer edukatif berbasis kode Remotion. Narasi lugas, hangat, fokus pada keseimbangan pola hidup sehat dan fermentasi alami tanpa klaim obat berlebihan.',
      mandatory_outro_line: 'GarliBee, teman rutinitas sehatmu.'
    },
    visual_engine: {
      visual_style: 'Explainer 2D Motion',
      visual_mode: 'code_remotion',
      video_model: 'remotion_explainer_v1',
      clip_duration: 6,
      face_visibility: 'Faceless',
      target_clips_count: 5,
      words_per_clip: '15-18 kata',
      aspect_ratio: '9:16'
    },
    product_bridging: {
      is_bridging_active: false,
      bridging_mode: 'select_existing',
      bridge_at_clip: 3,
      bridge_duration_clips: 1
    },
    visual_swap: {
      is_vso_active: false,
      character_concept: 'faceless',
      subject_demographic: 'custom',
      wardrobe_style: 'custom',
      wardrobe_style_custom: '',
      lighting_style: 'window_daylight',
      lighting_style_custom: '',
      visual_style_preset: 'editorial_graphic_novel',
      visual_identity_preset_id: null,
      visual_identity_inline_config: null,
      visual_overrides_json: null
    },
    workflow: {
      approval_mode: 'storyboard',
      enable_tts: true,
      audio_engine_mode: 'minimax_tts',
      google_voice_persona: 'Kore',
      enable_native_sfx: false,
      enable_native_ambience: false,
      anti_music_guardrail: true,
      enable_glabs: false,
      enable_ffmpeg: false,
      ffmpeg_sync_option: 'smart_sync',
      ffmpeg_video_scale: 1.0,
      ffmpeg_sfx_volume: 0.0,
      ffmpeg_bgm_volume: 0.0,
      enable_motion_text: false,
      motion_text_style: 'floating_white_yellow',
      motion_text_position: 'bottom',
      video_transition: 'cut',
      transition_duration: 0.5,
      finishing_template: 'none',
      caption_mode: 'hybrid',
      loudness_target: -14,
      vo_content_contract: 'off',
      vo_quality_gate: 'off',
      enable_social_post: false,
      upload_markdown: true,
      upload_spreadsheet: false,
      auto_sync_contentflow: true
    }
  },
  multiplier_home_living_no_vo_asmr: {
    schema_version: '2',
    label: 'Home & Living Zero-Human Tanpa VO (ASMR / Visual)',
    campaign_kinds: ['multiplier_campaign', 'product_campaign'],
    planner_defaults: {
      target_audience: 'Penghuni rumah & apartemen modern yang suka inspirasi dekorasi estetik, bersih, dan tenang',
      content_goal: 'Showcase produk & penataan ruang tanpa wajah/tangan manusia dan tanpa voiceover, mengandalkan ASMR ruang & teks layar singkat.'
    },
    basic_strategy: {
      narrative_mode: 'Storytelling',
      audio_engine_mode: 'no_vo',
      no_vo_audio_bed: 'native_sfx_ambience',
      on_screen_text_mode: 'short_caption_overlay',
      google_voice_persona: 'Kore',
      voice_provider: 'minimax',
      voice_persona: 'Indonesian_professional_anchor_vv2',
      voice_speed: 1.0,
      voice_volume: 1.0,
      tts_model_quality: 'speech-2.8-turbo',
      target_language: 'id-ID',
      target_demographic: 'ibu_rumah_tangga',
      target_demographic_custom: '',
      promotion_style: 'Softselling',
      enable_audio_segment: false,
      sfx_setting: 'with_sfx',
      enable_vo_audit: 0,
      nextcloud_parent_folder: '/MAKNA_Assets',
      ai_directive: 'Zero-human interior & product showcase without voiceover. Translate human actions into smooth camera glides, light beams, and natural object dynamics with crisp ASMR foley and concise 3-6 word screen captions.',
      mandatory_outro_line: ''
    },
    visual_engine: {
      visual_style: 'Cinematic',
      visual_mode: 'hybrid_lock',
      video_model: 'veo_31_lite',
      clip_duration: 6,
      face_visibility: 'Zero-Human (Environment & Object Only)',
      target_clips_count: 5,
      words_per_clip: '0 kata',
      aspect_ratio: '9:16'
    },
    product_bridging: {
      is_bridging_active: true,
      bridging_mode: 'select_existing',
      bridge_at_clip: 3,
      bridge_duration_clips: 2
    },
    visual_swap: {
      is_vso_active: true,
      character_concept: 'environment_object_only',
      subject_demographic: 'not_applicable',
      wardrobe_style: 'not_applicable',
      wardrobe_style_custom: '',
      lighting_style: 'window_daylight',
      lighting_style_custom: '',
      visual_style_preset: 'cinematic_realistic',
      visual_identity_preset_id: 'home_living_serene_interior',
      visual_identity_inline_config: null,
      visual_overrides_json: null
    },
    workflow: {
      approval_mode: 'none',
      enable_tts: false,
      audio_engine_mode: 'no_vo',
      no_vo_audio_bed: 'native_sfx_ambience',
      on_screen_text_mode: 'short_caption_overlay',
      google_voice_persona: 'Kore',
      enable_native_sfx: true,
      enable_native_ambience: true,
      anti_music_guardrail: true,
      enable_glabs: true,
      enable_ffmpeg: true,
      ffmpeg_sync_option: 'shortest',
      ffmpeg_video_scale: 1.0,
      ffmpeg_sfx_volume: 0.0,
      ffmpeg_bgm_volume: 0.0,
      enable_motion_text: true,
      motion_text_style: 'floating_white_yellow',
      motion_text_position: 'bottom',
      video_transition: 'cut',
      transition_duration: 0.5,
      finishing_template: 'none',
      caption_mode: 'hybrid',
      loudness_target: -14,
      vo_content_contract: 'off',
      vo_quality_gate: 'off',
      enable_social_post: false,
      upload_markdown: true,
      upload_spreadsheet: false,
      auto_sync_contentflow: true
    }
  },
  shopee_2clip_showcase_vo: {
    schema_version: '2',
    label: 'Shopee 2 Klip Direct Showcase (Dengan VO — Omni Flash)',
    campaign_kinds: ['multiplier_campaign', 'product_campaign'],
    planner_defaults: {
      target_audience: 'Pembeli Shopee aktif yang mencari unboxing jujur atau try-on cepat sebelum checkout',
      content_goal: 'Instant product reveal sejak detik ke-1, detail bukti pemakaian, dan CTA checkout Shopee.'
    },
    basic_strategy: {
      narrative_mode: 'Direct_Showcase',
      audio_engine_mode: 'minimax_tts',
      google_voice_persona: 'Kore',
      voice_provider: 'minimax',
      voice_persona: 'Indonesian_casual_reporter_vv2',
      voice_speed: 1.0,
      voice_volume: 1.0,
      tts_model_quality: 'speech-2.8-turbo',
      target_language: 'id-ID',
      target_demographic: 'general_adult',
      target_demographic_custom: '',
      promotion_style: 'Softselling',
      enable_audio_segment: false,
      sfx_setting: 'without_sfx',
      enable_vo_audit: 1,
      nextcloud_parent_folder: '/MAKNA_Assets',
      ai_directive: 'Direct 2-clip Shopee showcase: product appears directly in Clip 1 (unboxing or try-on fit check) and Clip 2 focuses on physical proof and soft Shopee CTA.',
      mandatory_outro_line: 'Cek keranjang sekarang ya!'
    },
    visual_engine: {
      visual_style: 'UGC',
      visual_mode: 'hybrid_lock',
      video_model: 'omni_flash',
      clip_duration: 4,
      face_visibility: 'Faceless',
      target_clips_count: 2,
      words_per_clip: '8-12 kata',
      aspect_ratio: '9:16'
    },
    product_bridging: {
      is_bridging_active: true,
      bridging_mode: 'select_existing',
      bridge_at_clip: 1,
      bridge_duration_clips: 2,
      bridge_segments: [{ at_clip: 1, duration_clips: 2, role: 'intro' }]
    },
    visual_swap: {
      is_vso_active: true,
      character_concept: 'faceless',
      subject_demographic: 'custom',
      wardrobe_style: 'custom',
      wardrobe_style_custom: '',
      lighting_style: 'window_daylight',
      lighting_style_custom: '',
      visual_style_preset: 'commercial_product_cinematic',
      visual_identity_preset_id: 'shopee_unboxing_pov_hands',
      visual_identity_inline_config: null,
      visual_overrides_json: null
    },
    workflow: {
      approval_mode: 'storyboard',
      enable_tts: true,
      audio_engine_mode: 'minimax_tts',
      no_vo_audio_bed: 'native_sfx_ambience',
      on_screen_text_mode: 'short_caption_overlay',
      google_voice_persona: 'Kore',
      enable_native_sfx: true,
      enable_native_ambience: true,
      anti_music_guardrail: true,
      enable_glabs: true,
      enable_ffmpeg: true,
      ffmpeg_sync_option: 'smart_sync',
      ffmpeg_video_scale: 1.0,
      ffmpeg_sfx_volume: 0.0,
      ffmpeg_bgm_volume: 0.0,
      enable_motion_text: true,
      motion_text_style: 'floating_white_yellow',
      motion_text_position: 'bottom',
      video_transition: 'cut',
      transition_duration: 0.5,
      finishing_template: 'none',
      caption_mode: 'hybrid',
      loudness_target: -14,
      vo_content_contract: 'off',
      vo_quality_gate: 'off',
      enable_social_post: false,
      upload_markdown: true,
      upload_spreadsheet: false,
      auto_sync_contentflow: true
    }
  },
  shopee_2clip_showcase_no_vo: {
    schema_version: '2',
    label: 'Shopee 2 Klip Direct Showcase (Tanpa VO / ASMR — Omni Flash)',
    campaign_kinds: ['multiplier_campaign', 'product_campaign'],
    planner_defaults: {
      target_audience: 'Pembeli Shopee aktif yang suka review visual ASMR / fit-check estetik dengan teks layar singkat',
      content_goal: 'Instant product reveal sejak detik ke-1 tanpa VO, andalkan foley unboxing/tekstur dan teks layar 3-6 kata.'
    },
    basic_strategy: {
      narrative_mode: 'Direct_Showcase',
      audio_engine_mode: 'no_vo',
      no_vo_audio_bed: 'native_sfx_ambience',
      on_screen_text_mode: 'short_caption_overlay',
      google_voice_persona: 'Kore',
      voice_provider: 'minimax',
      voice_persona: 'Indonesian_casual_reporter_vv2',
      voice_speed: 1.0,
      voice_volume: 1.0,
      tts_model_quality: 'speech-2.8-turbo',
      target_language: 'id-ID',
      target_demographic: 'general_adult',
      target_demographic_custom: '',
      promotion_style: 'Softselling',
      enable_audio_segment: false,
      sfx_setting: 'with_sfx',
      enable_vo_audit: 0,
      nextcloud_parent_folder: '/MAKNA_Assets',
      ai_directive: 'Direct 2-clip Shopee showcase without voiceover: focus on crisp unboxing foley or silent aesthetic fit-check plus concise 3-6 word on-screen text.',
      mandatory_outro_line: ''
    },
    visual_engine: {
      visual_style: 'UGC',
      visual_mode: 'hybrid_lock',
      video_model: 'omni_flash',
      clip_duration: 4,
      face_visibility: 'Faceless',
      target_clips_count: 2,
      words_per_clip: '0 kata',
      aspect_ratio: '9:16'
    },
    product_bridging: {
      is_bridging_active: true,
      bridging_mode: 'select_existing',
      bridge_at_clip: 1,
      bridge_duration_clips: 2,
      bridge_segments: [{ at_clip: 1, duration_clips: 2, role: 'intro' }]
    },
    visual_swap: {
      is_vso_active: true,
      character_concept: 'faceless',
      subject_demographic: 'custom',
      wardrobe_style: 'custom',
      wardrobe_style_custom: '',
      lighting_style: 'window_daylight',
      lighting_style_custom: '',
      visual_style_preset: 'commercial_product_cinematic',
      visual_identity_preset_id: 'shopee_unboxing_pov_hands',
      visual_identity_inline_config: null,
      visual_overrides_json: null
    },
    workflow: {
      approval_mode: 'storyboard',
      enable_tts: false,
      audio_engine_mode: 'no_vo',
      no_vo_audio_bed: 'native_sfx_ambience',
      on_screen_text_mode: 'short_caption_overlay',
      google_voice_persona: 'Kore',
      enable_native_sfx: true,
      enable_native_ambience: true,
      anti_music_guardrail: true,
      enable_glabs: true,
      enable_ffmpeg: true,
      ffmpeg_sync_option: 'shortest',
      ffmpeg_video_scale: 1.0,
      ffmpeg_sfx_volume: 0.0,
      ffmpeg_bgm_volume: 0.0,
      enable_motion_text: true,
      motion_text_style: 'floating_white_yellow',
      motion_text_position: 'bottom',
      video_transition: 'cut',
      transition_duration: 0.5,
      finishing_template: 'none',
      caption_mode: 'hybrid',
      loudness_target: -14,
      vo_content_contract: 'off',
      vo_quality_gate: 'off',
      enable_social_post: false,
      upload_markdown: true,
      upload_spreadsheet: false,
      auto_sync_contentflow: true
    }
  }
};

export const PRESET_ALIASES = {
  brand_editorial_v1: 'brand_editorial_campaign',
  nutribake_editorial_v1: 'brand_editorial_campaign',
  product_campaign_v1: 'product_campaign',
  product_education_v1: 'product_campaign',
  product_problem_solution_v1: 'product_campaign',
  dapurbotani_kampanye_produk_4_klip: 'product_campaign',
  recipe_campaign_v1: 'recipe_campaign'
};

const CAMPAIGN_KINDS = ['brand_editorial', 'product_campaign', 'recipe_campaign', 'multiplier_campaign', 'recipe_labs'];

export function normalizePresetCampaignKinds(value, { legacyDefault = ['brand_editorial'] } = {}) {
  const kinds = Array.isArray(value) ? [...new Set(value.map(String))] : legacyDefault;
  if (!kinds.length || kinds.some(kind => !CAMPAIGN_KINDS.includes(kind))) {
    const error = new Error('campaign_kinds preset tidak valid.');
    error.status = 400;
    throw error;
  }
  return kinds;
}

export function resolvePresetCampaignKinds(preset) {
  const config = preset?.config || preset || {};
  if (Array.isArray(config.campaign_kinds)) {
    return { kinds: normalizePresetCampaignKinds(config.campaign_kinds), source: preset?.is_system ? 'system' : 'explicit' };
  }
  if (config.product_bridging?.is_bridging_active === true) {
    return { kinds: ['product_campaign'], source: 'inferred', reason: 'product_bridging_active' };
  }
  const identity = `${preset?.key || ''} ${preset?.label || config.label || ''}`.toLowerCase();
  if (/multiplier/.test(identity)) {
    return { kinds: ['multiplier_campaign'], source: 'inferred', reason: 'multiplier_identity' };
  }
  if (/recipe[ _-]?labs|recipe_labs|foto/.test(identity)) {
    return { kinds: ['recipe_labs'], source: 'inferred', reason: 'recipe_labs_identity' };
  }
  if (/recipe[ _-]?campaign|recipe|resep/.test(identity)) {
    return { kinds: ['recipe_campaign'], source: 'inferred', reason: 'recipe_campaign_identity' };
  }
  if (/product[ _-]?campaign/.test(identity)) {
    return { kinds: ['product_campaign'], source: 'inferred', reason: 'product_campaign_identity' };
  }
  return { kinds: ['brand_editorial'], source: 'inferred', reason: 'legacy_default' };
}

export function isOperatorPresetCompatible(preset, campaignKind, tenantId = getActiveTenantId()) {
  const target = typeof preset === 'string' ? (getOperatorPresetConfig(preset, tenantId) || { key: preset }) : preset;
  return resolvePresetCampaignKinds(target).kinds.includes(campaignKind);
}

function merge(...values) {
  return values.reduce((result, value) => {
    for (const [key, next] of Object.entries(value || {})) {
      result[key] = next && typeof next === 'object' && !Array.isArray(next)
        ? merge(result[key] || {}, next)
        : next;
    }
    return result;
  }, {});
}

function readCustomPresets(tenantId = getActiveTenantId()) {
  const effectiveTenantId = tenantId || getActiveTenantId() || 'default_tenant';
  return CUSTOM_PRESET_CACHE[effectiveTenantId] || {};
}

export function getCustomOperatorPresets(tenantId = getActiveTenantId()) {
  return readCustomPresets(tenantId);
}

export function isSystemOperatorPreset(key) {
  return Boolean(PRESETS[key]);
}

export function getOperatorPresetConfig(key, tenantId = getActiveTenantId()) {
  if (!key) return null;
  const custom = readCustomPresets(tenantId);
  if (custom[key]) return custom[key];
  if (PRESETS[key]) return PRESETS[key];
  const alias = PRESET_ALIASES[key];
  if (alias) {
    if (custom[alias]) return custom[alias];
    if (PRESETS[alias]) return PRESETS[alias];
  }
  return null;
}

export async function getOperatorPresetConfigAsync(key, tenantId = getActiveTenantId(), { forceFresh = false } = {}) {
  const effectiveTenantId = tenantId || getActiveTenantId() || 'default_tenant';

  if (!forceFresh) {
    const syncRes = getOperatorPresetConfig(key, effectiveTenantId);
    if (syncRes) return syncRes;
  }

  try {
    const { pgQuery } = await import('./db-pg.js');
    const res = await pgQuery(
      'SELECT setting_value FROM tenant_settings WHERE tenant_id = $1 AND setting_key = $2',
      [effectiveTenantId, 'operator_presets_json']
    );
    if (res.rows?.[0]?.setting_value) {
      hydrateOperatorPresetCache(effectiveTenantId, res.rows[0].setting_value);
      return getOperatorPresetConfig(key, effectiveTenantId);
    }
  } catch (_) {}
  return getOperatorPresetConfig(key, effectiveTenantId);
}

export function listOperatorPresets(tenantId = getActiveTenantId()) {
  const custom = readCustomPresets(tenantId);
  return [
    ...Object.entries(PRESETS).map(([key, value]) => ({
      key,
      label: value.label,
      schema_version: value.schema_version,
      is_system: true,
      revision: 1,
      config: value
    })),
    ...Object.entries(custom).map(([key, value]) => ({
      key,
      label: value.label,
      schema_version: value.schema_version || '2',
      is_system: false,
      revision: value.revision || 1,
      config: value
    }))
  ].map(preset => {
    const resolved = resolvePresetCampaignKinds(preset);
    return {
      ...preset,
      campaign_kinds: resolved.kinds,
      campaign_kinds_source: resolved.source,
      campaign_kinds_reason: resolved.reason || null,
      config: { ...preset.config, campaign_kinds: resolved.kinds }
    };
  });
}

export function resolveOperatorPreset(presetKey, overrides = {}, tenantId = getActiveTenantId()) {
  if (!presetKey) return merge({}, overrides);
  const custom = readCustomPresets(tenantId);
  const aliasKey = PRESET_ALIASES[presetKey] || presetKey;
  const preset = custom[presetKey] || PRESETS[presetKey] || custom[aliasKey] || PRESETS[aliasKey];

  if (!preset) {
    const error = new Error(`Preset OPC tidak ditemukan: ${presetKey}`);
    error.code = 'OPERATOR_PRESET_NOT_FOUND';
    error.status = 400;
    throw error;
  }
  const merged = merge({}, preset, overrides);
  if (merged.product_bridging) {
    merged.product_bridging = normalizePresetProductBridging(merged.product_bridging, merged.visual_engine);
  }
  return merged;
}

export function hydrateOperatorPresetCache(tenantId, value) {
  const effectiveTenantId = tenantId || 'default_tenant';
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value || '{}') : value;
    CUSTOM_PRESET_CACHE[effectiveTenantId] = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    CUSTOM_PRESET_CACHE[effectiveTenantId] = {};
  }
  return CUSTOM_PRESET_CACHE[effectiveTenantId];
}

export function matchesBrand(preset, brandIdentifier) {
  if (!brandIdentifier) return false;
  const target = `${preset?.key || ''} ${preset?.label || ''} ${preset?.config?.label || ''}`.toLowerCase();
  const rawBrand = String(brandIdentifier).toLowerCase().trim();
  if (!rawBrand) return false;

  // 1. Direct substring match
  if (target.includes(rawBrand)) return true;

  // 2. Slug match (ignore spaces, hyphens, underscores)
  const cleanTarget = target.replace(/[\s\-_]+/g, '');
  const cleanBrand = rawBrand.replace(/[\s\-_]+/g, '');
  if (cleanBrand.length >= 3 && cleanTarget.includes(cleanBrand)) return true;

  // 3. Significant word match (>= 4 chars)
  const words = rawBrand.split(/[\s\-_]+/).filter(w => w.length >= 4);
  for (const word of words) {
    if (cleanTarget.includes(word)) return true;
  }
  return false;
}

export function listRecipeOperatorPresetsForBrand(brandIdentifier = '', tenantId = getActiveTenantId()) {
  return listOperatorPresetsForCampaignKind('recipe_campaign', brandIdentifier, tenantId);
}

export function listOperatorPresetsForCampaignKind(campaignKind = 'recipe_campaign', brandIdentifier = '', tenantId = getActiveTenantId()) {
  const allPresets = listOperatorPresets(tenantId);
  const normalizedKind = campaignKind === 'editorial_campaign' ? 'brand_editorial' : campaignKind;
  let matchingPresets = allPresets.filter(p => {
    const kinds = p.campaign_kinds || [];
    return kinds.includes(normalizedKind) || (normalizedKind === 'brand_editorial' && kinds.includes('editorial_campaign'));
  });

  // Sertakan juga preset brand yang kompatibel dengan jenis kampanye target
  if (brandIdentifier) {
    const brandPresets = allPresets.filter(p => {
      const kinds = p.campaign_kinds || [];
      const isKindCompatible = kinds.includes(normalizedKind) || (normalizedKind === 'brand_editorial' && kinds.includes('editorial_campaign'));
      return isKindCompatible && matchesBrand(p, brandIdentifier);
    });
    for (const bp of brandPresets) {
      if (!matchingPresets.some(p => p.key === bp.key)) {
        matchingPresets.push(bp);
      }
    }
  }

  if (matchingPresets.length === 0) {
    matchingPresets = allPresets;
  }

  // Tandai is_brand_match dan urutkan preset brand ke bagian paling atas
  const result = matchingPresets.map(p => ({
    ...p,
    is_brand_match: Boolean(brandIdentifier && matchesBrand(p, brandIdentifier))
  }));

  result.sort((a, b) => {
    if (a.is_brand_match && !b.is_brand_match) return -1;
    if (!a.is_brand_match && b.is_brand_match) return 1;
    return (a.label || a.key).localeCompare(b.label || b.key);
  });

  return result;
}

/**
 * Resolves the effective visual mode based on strict domain rules:
 * 1. Product Video, Recipe Video, and Cartoon Universe MUST ALWAYS be 'hybrid_lock' (demands visual consistency).
 * 2. All other campaign types (editorial, re-campaign, general) follow the operator preset as the single source of truth.
 *    (Autopilot must NEVER force pure_t2v).
 */
export function resolveEffectiveVisualMode({
  campaignFocus = null,
  contentKind = null,
  hasProductReference = false,
  isCartoonUniverse = false,
  presetVisualMode = null,
  requestedVisualMode = null
} = {}) {
  const isProduct =
    campaignFocus === 'product_campaign' ||
    contentKind === 'product_campaign' ||
    Boolean(hasProductReference);
  const isRecipe =
    campaignFocus === 'recipe_campaign' ||
    contentKind === 'recipe_campaign';

  // 1. Strict Exception: Product, Recipe, and Cartoon Universe MUST ALWAYS be hybrid_lock
  if (isProduct || isRecipe || isCartoonUniverse) {
    return 'hybrid_lock';
  }

  // 2. Universal Rule: Follow preset / requested settings as Single Source of Truth
  const targetMode = requestedVisualMode || presetVisualMode;
  if (targetMode === 'pure_t2v' || targetMode === 'hybrid_lock') {
    return targetMode;
  }

  return 'hybrid_lock';
}

