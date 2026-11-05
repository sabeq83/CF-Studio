import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../lib/db.js';
import { closePgPool } from '../lib/db-pg.js';
import { stopCampaignScheduler } from '../lib/campaign-scheduler.js';
import {
  listVisualIdentityPresetsForBrand,
  resolveBrandRecipePreset,
  executeAutonomousRecipePipeline
} from '../lib/autonomous-recipe-engine.js';
import { ingestRecipePlannerToPillarCampaign } from '../lib/recipe-campaign-ingest.js';
import { approvePillarCampaignItemUnchanged } from '../lib/pillar-campaign-approval.js';

test.after(async () => {
  stopCampaignScheduler();
  await new Promise(resolve => setTimeout(resolve, 800));
  await closePgPool();
  process.exit(0);
});

test('listVisualIdentityPresetsForBrand dynamically filters presets per brand', async () => {
  // Test 1: Brand Dapur Botani
  const botaniPresets = await listVisualIdentityPresetsForBrand('Dapur Botani');
  assert.ok(Array.isArray(botaniPresets), 'Must return an array of presets');
  assert.ok(botaniPresets.length > 0, 'Must have at least one preset for Dapur Botani');
  const botaniIds = botaniPresets.map(p => p.id);
  assert.ok(
    botaniIds.some(id => id.includes('botani') || id.includes('dapurbotani')),
    'Presets must contain botani-related presets'
  );

  // Test 2: Brand HabitFolk
  const habitPresets = await listVisualIdentityPresetsForBrand('habitfolk');
  assert.ok(Array.isArray(habitPresets));
  assert.ok(habitPresets.length > 0);
  assert.ok(habitPresets.some(p => p.id.includes('habitfolk')), 'Presets must contain habitfolk');

  // Test 3: Brand Nutribake
  const nutriPresets = await listVisualIdentityPresetsForBrand('nutribake');
  assert.ok(Array.isArray(nutriPresets));
  assert.ok(nutriPresets.length > 0);
  assert.ok(nutriPresets.some(p => p.id.includes('nutri')), 'Presets must contain nutri');

  // Test 4: Unknown brand falls back gracefully
  const unknownPresets = await listVisualIdentityPresetsForBrand('unknown_brand_xyz_999');
  assert.ok(Array.isArray(unknownPresets));
  assert.ok(unknownPresets.length > 0, 'Fallback returns preset catalog');
});

test('resolveBrandRecipePreset resolves brand defaults and respects chosen VI preset dropdown', async () => {
  // Habitfolk resolution
  const habitConfig = await resolveBrandRecipePreset('habitfolk');
  assert.equal(habitConfig.video_model, 'omni_flash');
  assert.equal(habitConfig.target_clips_count, 8);
  assert.equal(habitConfig.clip_duration, 4);
  assert.equal(habitConfig.target_language, 'en-US');
  assert.equal(habitConfig.supporting_app_name, 'Airfry Eats');
  assert.ok(habitConfig.available_vi_presets.length > 0);

  // Dapur Botani resolution
  const botaniConfig = await resolveBrandRecipePreset('dapur botani');
  assert.equal(botaniConfig.target_language, 'id-ID');
  assert.equal(botaniConfig.voice_persona, 'Indonesian_warm_motherly_vv1');
  assert.equal(botaniConfig.supporting_app_name, 'GarliBee Health Hub');

  // Respect user dropdown choice if valid for the brand
  const chosenPresetId = habitConfig.available_vi_presets[0]?.id;
  if (chosenPresetId) {
    const habitCustom = await resolveBrandRecipePreset('habitfolk', chosenPresetId);
    assert.equal(habitCustom.visual_identity_preset_id, chosenPresetId);
  }
});

test('executeAutonomousRecipePipeline rejects empty topic', async () => {
  await assert.rejects(async () => {
    await executeAutonomousRecipePipeline({ brandId: 'habitfolk', topic: '' });
  }, /Topik resep wajib diisi/);
});

test('ingestRecipePlannerToPillarCampaign hydrates 8 clips @ 4s, Omni Flash, and auto-approval', async () => {
  const db = getDb();
  const testPlannerId = `test_auto_pln_${Date.now()}`;
  const testTenantId = 'default_tenant';

  // 1. Setup test planner
  await db.prepare(`
    INSERT INTO content_planners (
      id, title, account_name, planner_focus, recipe_config_json, products_snapshot_json, status, target_audience, tenant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    testPlannerId,
    'HabitFolk - 20261105 - Air Fryer Salmon Bites',
    'habitfolk',
    'recipe_campaign',
    JSON.stringify({ category: 'makanan_utama' }),
    JSON.stringify([]),
    'planned',
    'genz_casual',
    testTenantId
  );

  // 2. Setup test rows
  const rowId1 = `cpr_salmon_${Date.now()}_1`;
  const idea1 = {
    title: 'Crispy Honey Mustard Salmon Bites',
    category: 'makanan_utama',
    hook: 'These honey mustard salmon bites take 12 minutes!',
    visual_highlight: 'Golden glazed salmon searing in air fryer'
  };

  await db.prepare(`
    INSERT INTO content_planner_rows (
      id, planner_id, sequence, title, hook, status, recipe_idea_json, product, product_id,
      pillar, category_cep, ws_matrix, context, vfo, strategic_angle, video_id, tenant_id, visual_action
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    rowId1, testPlannerId, 1, idea1.title, idea1.hook, 'planned', JSON.stringify(idea1),
    'Salmon', 'prod_salmon_1', 'Recipe Campaign', 'Dinner', 'Matrix A', 'Context A', 'VFO 1',
    'Quick Healthy', `vid_salmon_1`, testTenantId, idea1.visual_highlight
  );

  // 3. Ingest with global settings
  const ingestResult = await ingestRecipePlannerToPillarCampaign({
    plannerId: testPlannerId,
    globalSettings: {
      visual_identity_preset_id: 'vi_habitfolk_macro_craft',
      video_model: 'omni_flash',
      target_clips_count: 8,
      clip_duration: 4,
      target_ai: 'Google Veo Omni Flash',
      voice_persona: 'English_causual_narrator_vv1',
      mandatory_outro_line: 'Want more salmon recipes? Get the Airfry Eats app through the link in my bio!',
      execution_mode: 'full_autopilot',
      local_scheduler: 0,
      status: 'idle'
    },
    tenantId: testTenantId
  });

  assert.equal(ingestResult.success, true);
  assert.ok(ingestResult.campaign_id);
  assert.ok(ingestResult.campaign_id.startsWith('opc_'), `Campaign ID ${ingestResult.campaign_id} must start with opc_`);

  // 4. Verify campaign properties in DB
  const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id = ?').get(ingestResult.campaign_id);
  assert.ok(campaign);
  assert.equal(campaign.video_model, 'omni_flash');
  assert.equal(Number(campaign.target_clips_count), 8);
  assert.equal(Number(campaign.clip_duration), 4);
  assert.equal(campaign.voice_persona, 'English_causual_narrator_vv1');
  assert.equal(campaign.visual_identity_preset_id, 'vi_habitfolk_macro_craft');
  assert.equal(campaign.execution_mode, 'full_autopilot');
  assert.ok(campaign.mandatory_outro_line.includes('Airfry Eats'));

  // 5. Verify auto-approval with populated storyboard
  const items = await db.prepare('SELECT id, workflow_status FROM pillar_campaign_items WHERE campaign_id = ?').all(ingestResult.campaign_id);
  assert.equal(items.length, 1);

  // Set mock video plan
  await db.prepare(`
    UPDATE pillar_campaign_items
    SET new_video_plan_json = ?
    WHERE id = ?
  `).run(JSON.stringify([{ clip_index: 1, visual_action: 'Macro shot of salmon' }]), items[0].id);

  // Test approving item unchanged
  await approvePillarCampaignItemUnchanged(items[0].id);
  const updatedItem = await db.prepare('SELECT workflow_status FROM pillar_campaign_items WHERE id = ?').get(items[0].id);
  assert.equal(updatedItem.workflow_status, 'production_processing');

  // Clean up
  await db.prepare('DELETE FROM pillar_campaign_items WHERE campaign_id = ?').run(ingestResult.campaign_id);
  await db.prepare('DELETE FROM pillar_campaigns WHERE id = ?').run(ingestResult.campaign_id);
  await db.prepare('DELETE FROM content_planner_rows WHERE planner_id = ?').run(testPlannerId);
  await db.prepare('DELETE FROM content_planners WHERE id = ?').run(testPlannerId);
});

test('processPillarTts extracts voiceover from scenes or storyboard fallback to avoid no_audio error', async () => {
  const db = getDb();
  const { createPillarCampaignBundle } = await import('../lib/db.js');
  const testCampId = `test_tts_camp_${Date.now()}`;

  // Item result_json with storyboard scenes containing voice_over, but NO top-level voiceover field
  const mockResultJson = JSON.stringify({
    recipe: { title: 'Test Potato' },
    scenes: [
      { index: 1, voice_over: 'Crispy golden potato in air fryer.', duration_seconds: 4 },
      { index: 2, voice_over: 'Scoop and season with sea salt.', duration_seconds: 4 }
    ]
  });

  await createPillarCampaignBundle({
    campaign: {
      id: testCampId,
      campaign_name: 'Test TTS Campaign',
      content_pillar: 'Recipe Campaign',
      custom_hook: 'Crispy golden potato',
      visual_action_guideline: 'Macro 45',
      enable_tts: 1,
      voice_provider: 'minimax',
      voice_persona: 'English_causual_narrator_vv1',
      local_scheduler: 0
    },
    items: [
      {
        campaign_id: testCampId,
        generation_status: 'completed',
        start_frame_status: 'completed',
        tts_status: 'pending',
        result_json: mockResultJson,
        new_video_plan_json: JSON.stringify([
          { clip_index: 1, new_vo: 'Crispy golden potato in air fryer.' },
          { clip_index: 2, new_vo: 'Scoop and season with sea salt.' }
        ])
      }
    ]
  });

  const inserted = await db.prepare('SELECT id FROM pillar_campaign_items WHERE campaign_id = ?').all(testCampId);
  const testItemId = inserted[0].id;

  const { processPillarTts } = await import('../lib/scheduler-processors.js');
  const res = await processPillarTts({ item_id: testItemId }, { id: -1 });

  assert.ok(res.processed);
  assert.notEqual(res.tts_batch_id, 'no_audio', 'Must NOT be no_audio when scenes have narration');
  assert.ok(res.tts_batch_id.startsWith('ttsb_opc_'), 'Must create valid TTS batch');

  // Clean up
  await db.prepare('DELETE FROM tts_studio_clips WHERE batch_id = ?').run(res.tts_batch_id);
  await db.prepare('DELETE FROM tts_studio_batches WHERE id = ?').run(res.tts_batch_id);
  await db.prepare('DELETE FROM pillar_campaign_items WHERE id = ?').run(testItemId);
  await db.prepare('DELETE FROM pillar_campaigns WHERE id = ?').run(testCampId);
});
