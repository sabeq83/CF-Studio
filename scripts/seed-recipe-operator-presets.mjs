import { Pool } from 'pg';

export const RECIPE_OPERATOR_PRESETS = {
  habitfolk_6clips_quick: {
    schema_version: '2',
    label: 'HabitFolk — Quick Snack & Reels (6 Klip @ 4s)',
    campaign_kinds: ['recipe_campaign'],
    planner_defaults: {
      target_audience: 'Busy home cooks, foodies, and air fryer lovers',
      content_goal: 'Quick saves, viral snack reels, and Airfry Eats app downloads.'
    },
    basic_strategy: {
      narrative_mode: 'Storytelling',
      voice_provider: 'minimax',
      voice_persona: 'English_causual_narrator_vv1',
      voice_speed: 1.0,
      voice_volume: 1.0,
      tts_model_quality: 'speech-2.8-turbo',
      target_language: 'en-US',
      target_demographic: 'food_enthusiasts',
      target_demographic_custom: '',
      promotion_style: 'Softselling',
      enable_audio_segment: false,
      sfx_setting: 'without_sfx',
      enable_vo_audit: 1,
      nextcloud_parent_folder: '/MAKNA_Assets',
      supporting_app_name: 'Airfry Eats',
      ai_directive: 'Fast-paced delicious air fryer snack recipe for foodies and busy home cooks.',
      mandatory_outro_line: 'Want more {topic} recipes? Get the {app_name} app through the link in my bio!'
    },
    visual_engine: {
      visual_style: 'photorealistic_culinary',
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
      bridge_at_clip: 5,
      bridge_duration_clips: 1
    },
    visual_swap: {
      is_vso_active: true,
      character_concept: 'faceless',
      subject_demographic: 'caucasian_male',
      wardrobe_style: 'fixed',
      wardrobe_style_custom: '',
      lighting_style: 'window_daylight',
      lighting_style_custom: '',
      visual_style_preset: 'photorealistic_culinary',
      visual_identity_preset_id: 'vi_habitfolk_macro_craft',
      visual_identity_inline_config: null,
      visual_overrides_json: null
    },
    workflow: {
      approval_mode: 'storyboard',
      enable_tts: true,
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
      transition_duration: 0.5
    }
  },
  habitfolk_8clips_deep: {
    schema_version: '2',
    label: 'HabitFolk — Full Comfort Feast (8 Klip @ 4s)',
    campaign_kinds: ['recipe_campaign'],
    planner_defaults: {
      target_audience: 'Comfort food enthusiasts, culinary perfectionists, and air fryer chefs',
      content_goal: 'Deep engagement, recipe saves, and brand authority.'
    },
    basic_strategy: {
      narrative_mode: 'Storytelling',
      voice_provider: 'minimax',
      voice_persona: 'English_causual_narrator_vv1',
      voice_speed: 1.0,
      voice_volume: 1.0,
      tts_model_quality: 'speech-2.8-turbo',
      target_language: 'en-US',
      target_demographic: 'food_enthusiasts',
      target_demographic_custom: '',
      promotion_style: 'Softselling',
      enable_audio_segment: false,
      sfx_setting: 'without_sfx',
      enable_vo_audit: 1,
      nextcloud_parent_folder: '/MAKNA_Assets',
      supporting_app_name: 'Airfry Eats',
      ai_directive: 'Deep detailed comfort food recipe with sizzling ASMR cues and cinematic plating.',
      mandatory_outro_line: 'Want more {topic} recipes? Get the {app_name} app through the link in my bio!'
    },
    visual_engine: {
      visual_style: 'photorealistic_culinary',
      visual_mode: 'hybrid_lock',
      video_model: 'omni_flash',
      clip_duration: 4,
      face_visibility: 'Faceless',
      target_clips_count: 8,
      words_per_clip: '8-9 kata',
      aspect_ratio: '9:16'
    },
    product_bridging: {
      is_bridging_active: false,
      bridging_mode: 'select_existing',
      bridge_at_clip: 7,
      bridge_duration_clips: 1
    },
    visual_swap: {
      is_vso_active: true,
      character_concept: 'faceless',
      subject_demographic: 'caucasian_male',
      wardrobe_style: 'fixed',
      wardrobe_style_custom: '',
      lighting_style: 'window_daylight',
      lighting_style_custom: '',
      visual_style_preset: 'photorealistic_culinary',
      visual_identity_preset_id: 'vi_habitfolk_macro_craft',
      visual_identity_inline_config: null,
      visual_overrides_json: null
    },
    workflow: {
      approval_mode: 'storyboard',
      enable_tts: true,
      enable_glabs: true,
      enable_ffmpeg: true,
      ffmpeg_sync_option: 'smart_sync',
      ffmpeg_video_scale: 1.0,
      ffmpeg_sfx_volume: 0.0,
      ffmpeg_bgm_volume: 0.0,
      enable_motion_text: true,
      motion_text_style: 'minimal_white',
      motion_text_position: 'bottom',
      video_transition: 'fade',
      transition_duration: 0.5
    }
  },
  dapurbotani_4clips_healthy: {
    schema_version: '2',
    label: 'DapurBotani — Herbal & Wellness Recipe (4 Klip @ 8s)',
    campaign_kinds: ['recipe_campaign'],
    planner_defaults: {
      target_audience: 'Keluarga Indonesia, pecinta hidup sehat, pegiat herbal alami',
      content_goal: 'Edukasi resep sehat, engagement, dan pengenalan GarliBee Health Hub.'
    },
    basic_strategy: {
      narrative_mode: 'Storytelling',
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
      nextcloud_parent_folder: '/MAKNA_Assets',
      supporting_app_name: 'GarliBee Health Hub',
      ai_directive: 'Resep herbal & infused honey alami keluarga Indonesia dengan bahan organik.',
      mandatory_outro_line: 'Mau resep olahan {topic} sehat lainnya? Cek bio sekarang!'
    },
    visual_engine: {
      visual_style: 'photorealistic_culinary',
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
      wardrobe_style: 'fixed',
      wardrobe_style_custom: '',
      lighting_style: 'window_daylight',
      lighting_style_custom: '',
      visual_style_preset: 'photorealistic_culinary',
      visual_identity_preset_id: 'vi_habitfolk_macro_craft',
      visual_identity_inline_config: null,
      visual_overrides_json: null
    },
    workflow: {
      approval_mode: 'storyboard',
      enable_tts: true,
      enable_glabs: true,
      enable_ffmpeg: true,
      ffmpeg_sync_option: 'smart_sync',
      ffmpeg_video_scale: 1.0,
      ffmpeg_sfx_volume: 0.0,
      ffmpeg_bgm_volume: 0.0,
      enable_motion_text: true,
      motion_text_style: 'floating_white_yellow',
      motion_text_position: 'bottom',
      video_transition: 'fadewhite',
      transition_duration: 0.6
    }
  }
};

export async function seedRecipeOperatorPresets(targetSchema = 'dev') {
  const connectionConfig = {
    host: process.env.PGHOST || '100.78.186.123',
    port: parseInt(process.env.PGPORT || '5432', 10),
    database: process.env.PGDATABASE || 'maknaflow_db',
    user: process.env.PGUSER || 'makna_user',
    password: process.env.PGPASSWORD || 'maknagridpass',
    ssl: false,
    connectionTimeoutMillis: 10000
  };

  const pool = new Pool(connectionConfig);
  const client = await pool.connect();

  try {
    console.log(`📡 Connecting to PostgreSQL (Schema: ${targetSchema})...`);
    await client.query(`SET search_path TO ${targetSchema}, public`);

    const tenantId = 'default_tenant';
    const selectQuery = `
      SELECT setting_value 
      FROM tenant_settings 
      WHERE tenant_id = $1 AND setting_key = 'operator_presets_json'
    `;
    const res = await client.query(selectQuery, [tenantId]);

    let existingPresets = {};
    if (res.rows.length > 0 && res.rows[0].setting_value) {
      try {
        existingPresets = JSON.parse(res.rows[0].setting_value);
      } catch (err) {
        console.warn(`[Warning] Could not parse existing presets in ${targetSchema}, initializing fresh.`);
      }
    }

    const updatedPresets = {
      ...existingPresets,
      ...RECIPE_OPERATOR_PRESETS
    };

    const upsertQuery = `
      INSERT INTO tenant_settings (tenant_id, setting_key, setting_value)
      VALUES ($1, 'operator_presets_json', $2)
      ON CONFLICT (tenant_id, setting_key) 
      DO UPDATE SET
        setting_value = EXCLUDED.setting_value
      RETURNING tenant_id, setting_key;
    `;

    await client.query(upsertQuery, [tenantId, JSON.stringify(updatedPresets)]);
    console.log(`✅ [Success] Successfully seeded recipe presets to "${targetSchema}.tenant_settings":`);
    for (const key of Object.keys(RECIPE_OPERATOR_PRESETS)) {
      console.log(`   - ${key} (${RECIPE_OPERATOR_PRESETS[key].label})`);
    }

    return true;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1]?.endsWith('seed-recipe-operator-presets.mjs')) {
  const schemaArg = process.argv[2] || process.env.TARGET_SCHEMA || 'dev';
  seedRecipeOperatorPresets(schemaArg)
    .then(() => {
      console.log(`✨ Seeding finished successfully for ${schemaArg}.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Seeding error:', err);
      process.exit(1);
    });
}
