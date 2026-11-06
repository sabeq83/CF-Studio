import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBrandRecipePreset } from '../lib/autonomous-engine.js';
import {
  listRecipeOperatorPresetsForBrand,
  getOperatorPresetConfig,
  hydrateOperatorPresetCache
} from '../lib/operator-presets.js';
import { RECIPE_OPERATOR_PRESETS } from '../scripts/seed-recipe-operator-presets.mjs';

test('Auto Pipeline Preset Integration Suite', async (t) => {
  // Hidrasi cache operator preset untuk pengujian lokal
  hydrateOperatorPresetCache('default_tenant', RECIPE_OPERATOR_PRESETS);

  await t.test('1. Helper listRecipeOperatorPresetsForBrand memfilter hanya recipe_campaign', () => {
    const presets = listRecipeOperatorPresetsForBrand('habitfolk', 'default_tenant');
    assert.ok(Array.isArray(presets), 'Harus berupa array');
    assert.ok(presets.length >= 2, 'Harus memiliki minimal 2 preset untuk HabitFolk');
    
    // Verifikasi semua preset memiliki campaign_kinds recipe_campaign
    for (const p of presets) {
      assert.ok(p.campaign_kinds.includes('recipe_campaign'), `Preset ${p.key} harus bertipe recipe_campaign`);
    }

    // Verifikasi HabitFolk berada di urutan teratas karena brandIdentifier = habitfolk
    assert.ok(presets[0].key.includes('habitfolk'), 'Preset pertama harus cocok dengan habitfolk');
  });

  await t.test('2. getOperatorPresetConfig mengembalikan konfigurasi lengkap finishing video', () => {
    const quickConfig = getOperatorPresetConfig('habitfolk_6clips_quick', 'default_tenant');
    assert.ok(quickConfig, 'Preset habitfolk_6clips_quick harus ditemukan');
    assert.equal(quickConfig.visual_engine.target_clips_count, 6);
    assert.equal(quickConfig.visual_engine.clip_duration, 4);
    assert.equal(quickConfig.workflow.video_transition, 'slideleft');
    assert.equal(quickConfig.workflow.transition_duration, 0.5);
    assert.equal(quickConfig.workflow.motion_text_style, 'floating_white_yellow');
    assert.equal(quickConfig.workflow.enable_motion_text, true);

    const deepConfig = getOperatorPresetConfig('habitfolk_8clips_deep', 'default_tenant');
    assert.ok(deepConfig, 'Preset habitfolk_8clips_deep harus ditemukan');
    assert.equal(deepConfig.visual_engine.target_clips_count, 8);
    assert.equal(deepConfig.visual_engine.clip_duration, 4);
    assert.equal(deepConfig.workflow.video_transition, 'fade');
    assert.equal(deepConfig.workflow.motion_text_style, 'minimal_white');

    const botaniConfig = getOperatorPresetConfig('dapurbotani_4clips_healthy', 'default_tenant');
    assert.ok(botaniConfig, 'Preset dapurbotani_4clips_healthy harus ditemukan');
    assert.equal(botaniConfig.visual_engine.target_clips_count, 4);
    assert.equal(botaniConfig.visual_engine.clip_duration, 8);
    assert.equal(botaniConfig.visual_engine.video_model, 'veo_31_lite');
    assert.equal(botaniConfig.workflow.video_transition, 'fadewhite');
  });

  await t.test('3. resolveBrandRecipePreset dinamis menyelesaikan 6 klip untuk habitfolk_6clips_quick', async () => {
    const resolved = await resolveBrandRecipePreset('HabitFolk', 'habitfolk_6clips_quick', null, 'default_tenant');
    assert.equal(resolved.target_clips_count, 6, 'Jumlah klip harus 6');
    assert.equal(resolved.clip_duration, 4, 'Durasi per klip harus 4s');
    assert.equal(resolved.video_model, 'omni_flash');
    assert.equal(resolved.video_transition, 'slideleft', 'Transisi harus slideleft');
    assert.equal(resolved.transition_duration, 0.5);
    assert.equal(resolved.motion_text_style, 'floating_white_yellow');
    assert.equal(resolved.enable_motion_text, 1);
    assert.equal(resolved.supporting_app_name, 'Airfry Eats');
  });

  await t.test('4. resolveBrandRecipePreset dinamis menyelesaikan 8 klip untuk habitfolk_8clips_deep', async () => {
    const resolved = await resolveBrandRecipePreset('HabitFolk', 'habitfolk_8clips_deep', null, 'default_tenant');
    assert.equal(resolved.target_clips_count, 8, 'Jumlah klip harus 8');
    assert.equal(resolved.clip_duration, 4, 'Durasi per klip harus 4s');
    assert.equal(resolved.video_transition, 'fade', 'Transisi harus fade');
    assert.equal(resolved.motion_text_style, 'minimal_white');
  });

  await t.test('5. resolveBrandRecipePreset dinamis menyelesaikan 4 klip @ 8s untuk Dapur Botani', async () => {
    const resolved = await resolveBrandRecipePreset('Dapur Botani', 'dapurbotani_4clips_healthy', null, 'default_tenant');
    assert.equal(resolved.target_clips_count, 4, 'Jumlah klip harus 4');
    assert.equal(resolved.clip_duration, 8, 'Durasi per klip harus 8s');
    assert.equal(resolved.video_model, 'veo_31_lite');
    assert.equal(resolved.target_ai, 'Google Veo (8s)');
    assert.equal(resolved.target_language, 'id-ID');
    assert.equal(resolved.supporting_app_name, 'GarliBee Health Hub');
    assert.equal(resolved.video_transition, 'fadewhite');
  });

  setTimeout(() => process.exit(0), 100);
});
