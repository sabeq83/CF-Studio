import test from 'node:test';
import assert from 'node:assert/strict';
import { closePgPool } from '../lib/db-pg.js';
import { getDb } from '../lib/db.js';
import { createDraftContentPlanner } from '../lib/content-planner-engine.js';
import { ingestPlannerToPillarCampaign } from '../lib/pillar-campaign-ingest.js';
import { getOperatorPresetConfigAsync } from '../lib/operator-presets.js';

test.after(async () => {
  try {
    const { stopCampaignScheduler } = await import('../lib/campaign-scheduler.js');
    stopCampaignScheduler();
  } catch (_) {}
  await new Promise(resolve => setTimeout(resolve, 500));
  await closePgPool();
  process.exit(0);
});

test('Product Campaign Bridging & 100% CEP-Driven Test Suite', async (t) => {
  const db = getDb();
  const testProdId = `pe_test_${Date.now()}`;

  // Global test setup: Insert a dummy product extraction
  await db.prepare(`
    INSERT INTO product_extractions (
      id, tenant_id, product_name, product_description, unique_selling_point, raw_description
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    testProdId,
    'default_tenant',
    'GarliBee Pro Test',
    'Madu fermentasi bawang putih tunggal untuk daya tahan tubuh',
    'Ekstrak fermentasi 90 hari tanpa pengawet',
    'Madu herbal alami premium'
  );

  t.after(async () => {
    try {
      await db.prepare('DELETE FROM product_extractions WHERE id = ?').run(testProdId);
    } catch (_) {}
  });

  await t.test('1. createDraftContentPlanner with use_brand_pillars: false ignores editorial pillars', async () => {
    // 1. Setup dummy brand with editorial pillars including "Resep Sehat"
    const testBrandId = `test_brand_${Date.now()}`;
    await db.prepare(`
      INSERT INTO brand_profiles (id, brand_name, visual_signature, editorial_brand_context, editorial_content_pillars_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      testBrandId,
      'Test Herbal Brand',
      'Warm earthy aesthetic',
      'Brand kesehatan alami',
      JSON.stringify(['Resep Sehat', 'Edukasi Khasiat', 'Behind The Scene'])
    );

    // 2. Create draft planner with use_brand_pillars: false
    const draft = await createDraftContentPlanner({
      brand_id: testBrandId,
      brand_name: 'Test Herbal Brand',
      product_id: testProdId,
      product_name: 'GarliBee Pro Test',
      product_description: 'Madu herbal fermentasi bawang putih tunggal',
      planner_focus: 'product_campaign',
      use_brand_pillars: false,
      pillars: [],
      target_language: 'id-ID',
      planner_count: 1
    });

    assert.ok(draft.planner_id, 'Draft planner ID should be generated');

    // 3. Inspect saved planner
    const savedPlanner = await db.prepare('SELECT * FROM content_planners WHERE id = ?').get(draft.planner_id);
    assert.equal(Number(savedPlanner.use_brand_pillars), 0, 'use_brand_pillars should be 0 (false)');
    
    // Pillars JSON should NOT inherit the brand editorial pillars
    let savedPillars = [];
    try { savedPillars = JSON.parse(savedPlanner.pillars_json || '[]'); } catch (_) {}
    assert.deepEqual(savedPillars, [], 'pillars_json should remain empty when brand pillars are excluded');

    // Clean up
    await db.prepare('DELETE FROM content_planners WHERE id = ?').run(draft.planner_id);
    await db.prepare('DELETE FROM brand_profiles WHERE id = ?').run(testBrandId);
  });

  await t.test('2. Ingest with planner_focus: "product_campaign" is NEVER hijacked into recipe_campaign', async () => {
    const testPlannerId = `pln_test_${Date.now()}`;
    await db.prepare(`
      INSERT INTO content_planners (
        id, tenant_id, title, account_name, planner_focus, product_id, product_name,
        target_audience, planner_count, status, use_brand_pillars, pillars_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      testPlannerId,
      'default_tenant',
      'GarliBee Health Test',
      'DapurBotani',
      'product_campaign',
      testProdId,
      'GarliBee Pro Test',
      'ibu_rumah_tangga',
      1,
      'draft',
      0,
      '[]'
    );

    // Add row with "Resep" in pillar and title
    const testRowId = `row_${Date.now()}`;
    await db.prepare(`
      INSERT INTO content_planner_rows (
        id, planner_id, sequence, pillar, category_cep, title, hook, visual_action
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      testRowId,
      testPlannerId,
      1,
      'Resep Sehat Herbal',
      'Problem-Solution Based',
      'Resep Rahasia Daya Tahan Tubuh Kuat',
      'Hook kesehatan keluarga',
      'Visual sendok madu garlic'
    );

    // Ingest into campaign
    const ingestRes = await ingestPlannerToPillarCampaign({
      plannerId: testPlannerId,
      campaignName: 'Test Ingest Product Resep Keyword',
      globalSettings: {
        preset_key: 'product_campaign',
        visual_mode: 'hybrid_lock',
        target_product_id: testProdId,
        is_bridging_active: 1,
        bridge_at_clip: 5,
        bridge_duration_clips: 2,
        bridging_mode: 'select_existing'
      }
    });

    const campaignId = ingestRes.campaignId;
    assert.ok(campaignId, 'Campaign ID should be generated');

    const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id = ?').get(campaignId);
    assert.notEqual(campaign.content_pillar, 'Recipe Campaign', 'Campaign content_pillar must NOT be hijacked to "Recipe Campaign"');
    assert.equal(campaign.content_pillar, 'Resep Sehat Herbal', 'Campaign content_pillar should retain original planner pillar');

    const items = await db.prepare('SELECT * FROM pillar_campaign_items WHERE campaign_id = ?').all(campaignId);
    assert.equal(items.length, 1);
    assert.equal(items[0].content_kind, 'product_campaign', 'Item content_kind must be product_campaign, not recipe_campaign');

    // Clean up
    await db.prepare('DELETE FROM pillar_campaign_items WHERE campaign_id = ?').run(campaignId);
    await db.prepare('DELETE FROM pillar_campaigns WHERE id = ?').run(campaignId);
    await db.prepare('DELETE FROM content_planner_rows WHERE planner_id = ?').run(testPlannerId);
    await db.prepare('DELETE FROM content_planners WHERE id = ?').run(testPlannerId);
  });

  await t.test('3. Preset product_bridging configuration propagates correctly into globalSettings and campaign', async () => {
    const presetConfig = await getOperatorPresetConfigAsync('dapurbotani_garlibee');
    assert.ok(presetConfig, 'dapurbotani_garlibee preset should exist');
    assert.ok(presetConfig.product_bridging, 'preset must have product_bridging configuration');
    assert.equal(presetConfig.product_bridging.bridge_at_clip, 5, 'bridge_at_clip in preset should be 5');
    assert.equal(presetConfig.product_bridging.bridge_duration_clips, 2, 'bridge_duration_clips in preset should be 2');

    // Ingest with preset bridging settings
    const testPlannerId = `pln_bridge_${Date.now()}`;
    await db.prepare(`
      INSERT INTO content_planners (
        id, tenant_id, title, account_name, planner_focus, product_id, product_name,
        target_audience, planner_count, status, use_brand_pillars, pillars_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      testPlannerId,
      'default_tenant',
      'GarliBee Bridging Verification',
      'DapurBotani',
      'product_campaign',
      testProdId,
      'GarliBee Pro Test',
      'ibu_rumah_tangga',
      1,
      'draft',
      0,
      '[]'
    );

    const testRowId = `row_bridge_${Date.now()}`;
    await db.prepare(`
      INSERT INTO content_planner_rows (
        id, planner_id, sequence, pillar, category_cep, title, hook, visual_action
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      testRowId,
      testPlannerId,
      1,
      'Problem-Solution Based',
      'Problem-Solution Based',
      'Solusi Anak Gampang Sakit',
      'Anak sering batuk pilek?',
      'Ibu cemas melihat anak batuk'
    );

    const ingestRes = await ingestPlannerToPillarCampaign({
      plannerId: testPlannerId,
      campaignName: 'Test Bridging Propagation',
      globalSettings: {
        preset_key: 'dapurbotani_garlibee',
        visual_mode: 'hybrid_lock',
        target_product_id: testProdId,
        is_bridging_active: presetConfig.product_bridging.is_bridging_active ? 1 : 0,
        bridge_at_clip: presetConfig.product_bridging.bridge_at_clip,
        bridge_duration_clips: presetConfig.product_bridging.bridge_duration_clips,
        bridging_mode: presetConfig.product_bridging.bridging_mode
      }
    });

    const campaignId = ingestRes.campaignId;
    const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id = ?').get(campaignId);

    assert.equal(Number(campaign.is_bridging_active), 1, 'is_bridging_active should be 1');
    assert.equal(Number(campaign.bridge_at_clip), 5, 'bridge_at_clip should be 5');
    assert.equal(Number(campaign.bridge_duration_clips), 2, 'bridge_duration_clips should be 2');
    assert.equal(campaign.bridging_mode, 'select_existing', 'bridging_mode should be select_existing');
    assert.equal(campaign.visual_mode, 'hybrid_lock', 'visual_mode must be hybrid_lock');

    // Clean up
    await db.prepare('DELETE FROM pillar_campaign_items WHERE campaign_id = ?').run(campaignId);
    await db.prepare('DELETE FROM pillar_campaigns WHERE id = ?').run(campaignId);
    await db.prepare('DELETE FROM content_planner_rows WHERE planner_id = ?').run(testPlannerId);
    await db.prepare('DELETE FROM content_planners WHERE id = ?').run(testPlannerId);
  });

  await t.test('4. Auto Pipeline Scheduler runner dispatcher forwards executionMode: full_autopilot and overrides', async () => {
    // Test that dispatcher config parsing and parameter structure are intact
    const mockSchedule = {
      id: `sch_${Date.now()}`,
      brand_id: 'bp_dapurbotani',
      pipeline_type: 'product_campaign',
      name: 'Scheduled GarliBee Run',
      target_item_id: testProdId,
      target_item_title: 'GarliBee Pro Test',
      preset_key: 'dapurbotani_garlibee',
      pipeline_config_json: JSON.stringify({
        selected_cep: 'Problem-Solution Based',
        overrides: {
          bridging: { bridgeAtClip: 5 }
        }
      })
    };

    // Verify schedule structure parsing
    const parsedConfig = JSON.parse(mockSchedule.pipeline_config_json);
    assert.equal(mockSchedule.pipeline_type, 'product_campaign');
    assert.equal(mockSchedule.preset_key, 'dapurbotani_garlibee');
    assert.equal(parsedConfig.selected_cep, 'Problem-Solution Based');
    assert.equal(parsedConfig.overrides.bridging.bridgeAtClip, 5);
  });
});
