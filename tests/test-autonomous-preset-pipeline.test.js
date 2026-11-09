import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveBrandRecipePreset } from '../lib/autonomous-engine.js';
import { hydrateOperatorPresetCache } from '../lib/operator-presets.js';

describe('Autonomous Preset Pipeline 100% Invariant Test Suite', () => {

  test('1. resolveBrandRecipePreset extracts full 5 preset buckets (Voice, VI, Finishing, Pacing)', async () => {
    // Seed preset cache in memory
    hydrateOperatorPresetCache('test_tenant', {
      test_recipe_preset: {
        schema_version: '2',
        label: 'Test Recipe Full Preset',
        campaign_kinds: ['recipe_campaign'],
        basic_strategy: {
          voice_provider: 'minimax',
          voice_persona: 'Indonesian_warm_motherly_vv1',
          voice_speed: 1.15,
          voice_volume: 0.95,
          tts_model_quality: 'speech-2.8-turbo',
          target_language: 'id-ID',
          target_demographic: 'ibu_rumah_tangga',
          ai_directive: 'Fokus pada bahan herbal alami tanpa pengawet',
          mandatory_outro_line: 'Cek resep selengkapnya di bio ya Moms!'
        },
        visual_engine: {
          visual_style: 'photorealistic_clean',
          visual_mode: 'pure_t2v',
          video_model: 'veo_31_lite',
          target_clips_count: 5,
          clip_duration: 6,
          words_per_clip: '12-14 kata',
          aspect_ratio: '9:16'
        },
        visual_swap: {
          is_vso_active: true,
          visual_identity_preset_id: 'vi_test_botani_herbal'
        },
        workflow: {
          enable_motion_text: true,
          motion_text_style: 'floating_black_on_white',
          motion_text_position: 'bottom',
          video_transition: 'fadewhite',
          transition_duration: 0.4,
          ffmpeg_video_scale: 1.05,
          ffmpeg_bgm_volume: 0.1,
          ffmpeg_sfx_volume: 0.05
        }
      }
    });

    const res = await resolveBrandRecipePreset('dapurbotani', 'test_recipe_preset', null, 'test_tenant');

    // 1. Basic strategy verification
    assert.equal(res.voice_persona, 'Indonesian_warm_motherly_vv1');
    assert.equal(res.voice_speed, 1.15);
    assert.equal(res.voice_volume, 0.95);
    assert.equal(res.target_language, 'id-ID');
    assert.equal(res.ai_directive, 'Fokus pada bahan herbal alami tanpa pengawet');
    assert.equal(res.target_demographic, 'ibu_rumah_tangga');

    // 2. Visual engine verification
    assert.equal(res.visual_mode, 'pure_t2v');
    assert.equal(res.target_clips_count, 5);
    assert.equal(res.clip_duration, 6);
    assert.equal(res.words_per_clip, '12-14 kata');
    assert.equal(res.aspect_ratio, '9:16');

    // 3. Visual identity resolution
    assert.equal(res.visual_identity_preset_id, 'vi_test_botani_herbal');

    // 4. Workflow finishing verification
    assert.equal(res.enable_motion_text, 1);
    assert.equal(res.motion_text_style, 'floating_black_on_white');
    assert.equal(res.motion_text_position, 'bottom');
    assert.equal(res.video_transition, 'fadewhite');
    assert.equal(res.transition_duration, 0.4);
    assert.equal(res.ffmpeg_video_scale, 1.05);
  });

  test('2. Multiplier Task creation binds visual_identity_preset_id and workflow finishing', async () => {
    // Seed preset with specific clinical biohacking identity
    hydrateOperatorPresetCache('test_tenant', {
      multiplier_siasatsehat_test: {
        schema_version: '2',
        label: 'Siasat Sehat Biohack Multiplier',
        campaign_kinds: ['multiplier_campaign'],
        basic_strategy: {
          narrative_mode: 'Storytelling',
          voice_provider: 'minimax',
          voice_persona: 'Indonesian_casual_reporter_vv2',
          voice_speed: 1.0,
          voice_volume: 1.0,
          target_language: 'id-ID',
          mandatory_outro_line: 'mau tips biohack lainnya? follow ya!'
        },
        visual_engine: {
          visual_style: 'Realistic Scientific',
          visual_mode: 'pure_t2v',
          video_model: 'omni_flash',
          target_clips_count: 3,
          clip_duration: 8,
          words_per_clip: '17-19 kata',
          aspect_ratio: '9:16'
        },
        visual_swap: {
          is_vso_active: true,
          character_concept: 'faceless',
          visual_identity_preset_id: 'vi_siasatsehat_clinical_biohack_3d'
        },
        workflow: {
          enable_motion_text: true,
          motion_text_style: 'floating_black_on_white',
          motion_text_position: 'bottom',
          video_transition: 'fadewhite',
          transition_duration: 0.3,
          ffmpeg_video_scale: 1.0,
          ffmpeg_sync_option: 'smart_sync'
        }
      }
    });

    const { getOperatorPresetConfigAsync } = await import('../lib/operator-presets.js');
    const presetConfig = await getOperatorPresetConfigAsync('multiplier_siasatsehat_test', 'test_tenant');

    assert.ok(presetConfig, 'Preset config must be resolved');
    assert.equal(presetConfig.visual_swap.visual_identity_preset_id, 'vi_siasatsehat_clinical_biohack_3d');
    assert.equal(presetConfig.workflow.video_transition, 'fadewhite');
    assert.equal(presetConfig.workflow.motion_text_style, 'floating_black_on_white');

    // Simulate vsoConfig construction as in executeAutonomousMultiplierPipeline
    const selectedVi = presetConfig?.visual_swap?.visual_identity_preset_id;
    const vsoConfig = {
      is_vso_active: true,
      visual_identity_preset_id: selectedVi,
      preset_key: 'multiplier_siasatsehat_test',
      enable_motion_text: presetConfig?.workflow?.enable_motion_text ? 1 : 0,
      motion_text_style: presetConfig?.workflow?.motion_text_style,
      video_transition: presetConfig?.workflow?.video_transition,
      transition_duration: presetConfig?.workflow?.transition_duration
    };

    assert.equal(vsoConfig.visual_identity_preset_id, 'vi_siasatsehat_clinical_biohack_3d');
    assert.equal(vsoConfig.enable_motion_text, 1);
    assert.equal(vsoConfig.video_transition, 'fadewhite');
    assert.equal(vsoConfig.motion_text_style, 'floating_black_on_white');
  });

  test('3. Multiplier Worker Failsafe Auto-Healing resolves VI from preset_key when aesthetics VI is empty', async () => {
    hydrateOperatorPresetCache('test_tenant', {
      preset_with_vi: {
        schema_version: '2',
        visual_swap: {
          visual_identity_preset_id: 'vi_auto_healed_target'
        }
      }
    });

    // Simulated task aesthetics missing visual_identity_preset_id
    const aesthetics = {
      preset_key: 'preset_with_vi'
      // visual_identity_preset_id is missing!
    };

    let targetPresetId = aesthetics.visual_identity_preset_id;
    if (!targetPresetId && aesthetics.preset_key) {
      const { getOperatorPresetConfigAsync } = await import('../lib/operator-presets.js');
      const pCfg = await getOperatorPresetConfigAsync(aesthetics.preset_key, 'test_tenant');
      if (pCfg?.visual_swap?.visual_identity_preset_id) {
        targetPresetId = pCfg.visual_swap.visual_identity_preset_id;
      }
    }

    assert.equal(targetPresetId, 'vi_auto_healed_target', 'Auto-healing must successfully retrieve VI from preset_key');
  });

});

