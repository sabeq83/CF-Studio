import test from 'node:test';
import assert from 'node:assert/strict';
import { closePgPool } from '../lib/db-pg.js';
import { getDb } from '../lib/db.js';
import { getOperatorPresetConfigAsync } from '../lib/operator-presets.js';
import { createDraftContentPlanner } from '../lib/content-planner-engine.js';
import { ingestPlannerToPillarCampaign } from '../lib/pillar-campaign-ingest.js';
import { listVisualIdentities } from '../lib/visual-identity-repository.js';

test.after(async () => {
  await new Promise(resolve => setTimeout(resolve, 500));
  await closePgPool();
  process.exit(0);
});

test('Autonomous Product Pipeline Preset & Language Integration Suite', async (t) => {

  await t.test('1. Preset dapurbotani_garlibee exists with id-ID and hydraulic VI preset', async () => {
    const preset = await getOperatorPresetConfigAsync('dapurbotani_garlibee', 'default_tenant');
    assert.ok(preset, 'Preset dapurbotani_garlibee must exist in tenant_settings');
    assert.strictEqual(preset.basic_strategy?.target_language, 'id-ID');
    assert.strictEqual(preset.visual_swap?.visual_identity_preset_id, 'hydraulic_pipeline_metaphor');
  });

  await t.test('2. Draft planner with Indonesian preset inherits target_language: id-ID', async () => {
    const preset = await getOperatorPresetConfigAsync('dapurbotani_garlibee', 'default_tenant');
    const effectiveLang = preset?.basic_strategy?.target_language || 'id-ID';

    const draft = await createDraftContentPlanner({
      tenant_id: 'default_tenant',
      title: 'GarliBee Indonesian Preset Test',
      planner_focus: 'product_campaign',
      planner_count: 1,
      product_id: 'pe_1793545394035_6698',
      product_name: 'GarliBee Madu Bawang Lanang',
      product_description: 'Madu fermentasi bawang lanang',
      target_language: effectiveLang,
      cep_selection_mode: 'custom',
      selected_ceps: ['Problem-Solution Based'],
      topic_hint: 'GarliBee'
    });

    assert.ok(draft, 'Draft must be created');
    assert.strictEqual(draft.target_language, 'id-ID');
    assert.strictEqual(draft.planner?.target_language, 'id-ID');

    const db = getDb();
    const plannerRecord = await db.prepare('SELECT target_language FROM content_planners WHERE id = ?').get(draft.id);
    assert.strictEqual(plannerRecord.target_language, 'id-ID');
  });

  await t.test('3. Ingest with preset dapurbotani_garlibee sets visual_identity_preset_id properly', async () => {
    const preset = await getOperatorPresetConfigAsync('dapurbotani_garlibee', 'default_tenant');
    const draft = await createDraftContentPlanner({
      tenant_id: 'default_tenant',
      title: 'GarliBee VI Ingest Test',
      planner_focus: 'product_campaign',
      planner_count: 1,
      product_id: 'pe_1793545394035_6698',
      product_name: 'GarliBee Madu Bawang Lanang',
      product_description: 'Madu fermentasi bawang lanang',
      target_language: 'id-ID',
      cep_selection_mode: 'custom',
      selected_ceps: ['Routine Based'],
      topic_hint: 'GarliBee'
    });

    const db = getDb();
    const rowId = `row_vi_test_${Date.now()}`;
    await db.prepare(`
      INSERT INTO content_planner_rows (
        id, planner_id, sequence, video_id, pillar, category_cep, ws_matrix, context, vfo, strategic_angle, narrative_mode, hook, visual_action, content_subject, product_reference, commercial_intent, cta_type, product, selling_intent, validation_status, is_locked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      rowId, draft.id, 1, 'VID_001', 'Pilar GarliBee', 'Routine Based', 'When Morning', 'Sarapan', 'Concrete', 'The Life Hack', 'Storytelling', 'Rutinitas 1 sendok madu di pagi hari', 'Tuang madu ke sendok kayu', 'GarliBee Madu', 'GarliBee', 'soft_sell', 'direct_order', 'GarliBee', 'Edukasi Produk', 'valid'
    );

    const availableVi = await listVisualIdentities();
    const presetViId = preset?.visual_swap?.visual_identity_preset_id;
    let selectedVi = presetViId;
    if (!selectedVi || !availableVi.some(p => p.id === selectedVi || p.preset_key === selectedVi)) {
      selectedVi = availableVi.find(p => p.id === 'vi_habitfolk_macro_craft')?.id || 'vi_habitfolk_macro_craft';
    }

    const ingested = await ingestPlannerToPillarCampaign({
      plannerId: draft.id,
      campaignName: 'Test Ingest GarliBee Preset VI',
      globalSettings: {
        brand_id: 'df382ce8-2145-4464-ae63-79375ff3aff2',
        target_product_id: 'pe_1793545394035_6698',
        campaign_type: 'product_campaign',
        preset_key: 'dapurbotani_garlibee',
        visual_identity_preset_id: selectedVi
      }
    });

    assert.ok(ingested.campaignId, 'Must return campaignId');
    const createdCampaign = await db.prepare('SELECT visual_identity_preset_id FROM pillar_campaigns WHERE id = ?').get(ingested.campaignId);
    assert.strictEqual(createdCampaign.visual_identity_preset_id, 'hydraulic_pipeline_metaphor');
  });

  await t.test('4. Ingest with null/unspecified VI preset falls back to vi_habitfolk_macro_craft (matching other campaign types)', async () => {
    const draft = await createDraftContentPlanner({
      tenant_id: 'default_tenant',
      title: 'GarliBee Fallback VI Ingest Test',
      planner_focus: 'product_campaign',
      planner_count: 1,
      product_id: 'pe_1793545394035_6698',
      product_name: 'GarliBee Madu Bawang Lanang',
      product_description: 'Madu fermentasi bawang lanang',
      target_language: 'id-ID',
      cep_selection_mode: 'custom',
      selected_ceps: ['Problem-Solution Based'],
      topic_hint: 'GarliBee'
    });

    const db = getDb();
    const rowId = `row_fallback_vi_${Date.now()}`;
    await db.prepare(`
      INSERT INTO content_planner_rows (
        id, planner_id, sequence, video_id, pillar, category_cep, ws_matrix, context, vfo, strategic_angle, narrative_mode, hook, visual_action, content_subject, product_reference, commercial_intent, cta_type, product, selling_intent, validation_status, is_locked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      rowId, draft.id, 1, 'VID_002', 'Pilar GarliBee', 'Problem-Solution Based', 'When Tired', 'Kelelahan', 'Concrete', 'The Problem', 'Storytelling', 'Sering merasa lelah?', 'Macro shot madu', 'GarliBee Madu', 'GarliBee', 'soft_sell', 'direct_order', 'GarliBee', 'Edukasi Produk', 'valid'
    );

    // Fallback logic exactly matching other campaigns:
    const availableVi = await listVisualIdentities();
    const fallbackVi = availableVi.find(p => p.id === 'vi_habitfolk_macro_craft')?.id || 'vi_habitfolk_macro_craft';

    const ingested = await ingestPlannerToPillarCampaign({
      plannerId: draft.id,
      campaignName: 'Test Ingest Fallback VI',
      globalSettings: {
        brand_id: 'df382ce8-2145-4464-ae63-79375ff3aff2',
        target_product_id: 'pe_1793545394035_6698',
        campaign_type: 'product_campaign',
        preset_key: 'product_campaign',
        visual_identity_preset_id: fallbackVi
      }
    });

    assert.ok(ingested.campaignId, 'Must return campaignId');
    const createdCampaign = await db.prepare('SELECT visual_identity_preset_id FROM pillar_campaigns WHERE id = ?').get(ingested.campaignId);
    assert.strictEqual(createdCampaign.visual_identity_preset_id, 'vi_habitfolk_macro_craft');
    assert.notStrictEqual(createdCampaign.visual_identity_preset_id, 'inline');
  });

});
