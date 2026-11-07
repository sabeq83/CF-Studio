import test from 'node:test';
import assert from 'node:assert/strict';
import { closePgPool } from '../lib/db-pg.js';
import { getDb } from '../lib/db.js';
import {
  PRODUCT_PLANNER_COUNTS,
  validatePlannerCount,
  buildDistributionPlan,
  PRODUCT_CEPS
} from '../lib/content-planner-contract.js';
import { createDraftContentPlanner } from '../lib/content-planner-engine.js';
import { ingestPlannerToPillarCampaign } from '../lib/pillar-campaign-ingest.js';

test.after(async () => {
  await new Promise(resolve => setTimeout(resolve, 500));
  await closePgPool();
  process.exit(0);
});

test('Autonomous Product Pipeline & CEP Selection Suite', async (t) => {

  await t.test('1. PRODUCT_PLANNER_COUNTS supports 1 (single campaign video)', () => {
    assert.ok(PRODUCT_PLANNER_COUNTS.includes(1), 'PRODUCT_PLANNER_COUNTS must include 1');
    const validated = validatePlannerCount('product_campaign', 1);
    assert.strictEqual(validated.count, 1);
    assert.strictEqual(validated.rowsPerPillar, null);
  });

  await t.test('2. validatePlannerCount still enforces valid counts', () => {
    assert.throws(() => {
      validatePlannerCount('product_campaign', 5);
    }, /Jumlah baris Product Campaign harus 1 \(single campaign\) atau mengikuti siklus CEP/);

    const valid6 = validatePlannerCount('product_campaign', 6);
    assert.strictEqual(valid6.count, 6);
  });

  await t.test('3. buildDistributionPlan respects custom single selectedCep', () => {
    const plan = buildDistributionPlan(1, null, 0, '', {
      focus: 'product_campaign',
      selectedCeps: ['Routine Based']
    });

    assert.strictEqual(plan.length, 1);
    assert.strictEqual(plan[0].category_cep, 'Routine Based');
    assert.strictEqual(plan[0].sequence, 1);

    const problemPlan = buildDistributionPlan(1, null, 0, '', {
      focus: 'product_campaign',
      selectedCeps: ['Problem-Solution Based']
    });
    assert.strictEqual(problemPlan.length, 1);
    assert.strictEqual(problemPlan[0].category_cep, 'Problem-Solution Based');
  });

  await t.test('4. createDraftContentPlanner succeeds with count=1 and custom CEP', async () => {
    const draft = await createDraftContentPlanner({
      tenant_id: 'default_tenant',
      title: 'GarliBee 1-Click Pipeline Test',
      planner_focus: 'product_campaign',
      planner_count: 1,
      product_id: 'pe_1793545394035_6698',
      product_name: 'GarliBee Madu Bawang Lanang',
      product_description: 'Madu herbal bawang lanang tunggal untuk imunitas dan vitalitas pria wanita',
      cep_selection_mode: 'custom',
      selected_ceps: ['Emotional Based'],
      topic_hint: 'GarliBee Madu Bawang Lanang'
    });

    assert.ok(draft, 'Draft must be created');
    assert.strictEqual(draft.planner?.planner_focus, 'product_campaign');
    assert.strictEqual(draft.planner?.planner_count, 1);

    const db = getDb();
    const plannerRecord = await db.prepare('SELECT * FROM content_planners WHERE id = ?').get(draft.id);
    assert.ok(plannerRecord, 'Planner must be stored in DB');
    assert.strictEqual(plannerRecord.planner_focus, 'product_campaign');
    assert.strictEqual(Number(plannerRecord.planner_count), 1);
    const meta = typeof plannerRecord.metadata_json === 'string'
      ? JSON.parse(plannerRecord.metadata_json || '{}')
      : (plannerRecord.metadata_json || {});
    assert.strictEqual(meta.cep_selection_mode, 'custom');
    assert.deepStrictEqual(meta.selected_ceps, ['Emotional Based']);
  });

  await t.test('5. ingestPlannerToPillarCampaign handles planner with single row', async () => {
    const draft = await createDraftContentPlanner({
      tenant_id: 'default_tenant',
      title: 'GarliBee Ingest Test',
      planner_focus: 'product_campaign',
      planner_count: 1,
      product_id: 'pe_1793545394035_6698',
      product_name: 'GarliBee Madu Bawang Lanang',
      product_description: 'Madu herbal bawang lanang tunggal',
      cep_selection_mode: 'custom',
      selected_ceps: ['Aspirational Based'],
      topic_hint: 'GarliBee'
    });

    const db = getDb();
    const rowId = `row_test_${Date.now()}`;
    await db.prepare(`
      INSERT INTO content_planner_rows (
        id, planner_id, sequence, video_id, pillar, category_cep, ws_matrix, context, vfo, strategic_angle, narrative_mode, hook, visual_action, content_subject, product_reference, commercial_intent, cta_type, product, selling_intent, validation_status, is_locked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      rowId, draft.id, 1, 'VID_001', 'Pilar GarliBee', 'Aspirational Based', 'When Morning', 'Sarapan', 'Concrete', 'The Life Hack', 'Storytelling', 'Pagi-pagi lemas?', 'Minum madu', 'GarliBee Madu', 'GarliBee', 'soft_sell', 'direct_order', 'GarliBee', 'Edukasi Produk', 'valid'
    );

    const ingested = await ingestPlannerToPillarCampaign({
      plannerId: draft.id,
      campaignName: 'Test Ingest GarliBee Single',
      globalSettings: {
        brand_id: 'ptgim',
        target_item_id: 'pe_1793545394035_6698',
        campaign_type: 'product_campaign',
        preset_key: 'product_campaign'
      }
    });

    assert.ok(ingested, 'Ingested result must exist');
    assert.strictEqual(ingested.ingestedCount, 1);
    assert.ok(ingested.campaignId, 'Must have campaignId');

    const item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE campaign_id = ?').get(ingested.campaignId);
    assert.ok(item, 'Pillar campaign item record must exist in DB');
    assert.strictEqual(item.content_kind, 'product_campaign');
  });

});
