import test from 'node:test';
import assert from 'node:assert/strict';
import { closePgPool } from '../lib/db-pg.js';
import { getDb } from '../lib/db.js';
import { resolveEffectiveVisualMode } from '../lib/operator-presets.js';
import { createDraftContentPlanner } from '../lib/content-planner-engine.js';
import { ingestPlannerToPillarCampaign } from '../lib/pillar-campaign-ingest.js';

test.after(async () => {
  try {
    const { stopCampaignScheduler } = await import('../lib/campaign-scheduler.js');
    stopCampaignScheduler();
  } catch (_) {}
  await new Promise(resolve => setTimeout(resolve, 500));
  await closePgPool();
  process.exit(0);
});

test('Universal Visual Mode Preset Resolution & Hybrid Lock Invariant Suite', async (t) => {

  await t.test('1. resolveEffectiveVisualMode enforces strict hybrid_lock on product & recipe', async () => {
    // Product campaign focus
    assert.equal(
      resolveEffectiveVisualMode({ campaignFocus: 'product_campaign', requestedVisualMode: 'pure_t2v' }),
      'hybrid_lock',
      'product_campaign must always be hybrid_lock even if pure_t2v is requested'
    );

    // Has product reference
    assert.equal(
      resolveEffectiveVisualMode({ hasProductReference: true, requestedVisualMode: 'pure_t2v' }),
      'hybrid_lock',
      'hasProductReference must always be hybrid_lock'
    );

    // Recipe campaign focus
    assert.equal(
      resolveEffectiveVisualMode({ campaignFocus: 'recipe_campaign', presetVisualMode: 'pure_t2v' }),
      'hybrid_lock',
      'recipe_campaign must always be hybrid_lock'
    );

    // Content kind recipe_campaign
    assert.equal(
      resolveEffectiveVisualMode({ contentKind: 'recipe_campaign', requestedVisualMode: 'pure_t2v' }),
      'hybrid_lock',
      'contentKind recipe_campaign must always be hybrid_lock'
    );

    // Cartoon Universe
    assert.equal(
      resolveEffectiveVisualMode({ isCartoonUniverse: true, requestedVisualMode: 'pure_t2v' }),
      'hybrid_lock',
      'cartoon universe must always be hybrid_lock'
    );
  });

  await t.test('2. resolveEffectiveVisualMode honors preset for editorial and other campaign kinds', async () => {
    // Brand editorial with pure_t2v
    assert.equal(
      resolveEffectiveVisualMode({ campaignFocus: 'brand_editorial', presetVisualMode: 'pure_t2v' }),
      'pure_t2v',
      'brand_editorial must honor preset pure_t2v'
    );

    // Brand editorial with hybrid_lock
    assert.equal(
      resolveEffectiveVisualMode({ campaignFocus: 'brand_editorial', presetVisualMode: 'hybrid_lock' }),
      'hybrid_lock',
      'brand_editorial must honor preset hybrid_lock'
    );

    // Editorial campaign with pure_t2v
    assert.equal(
      resolveEffectiveVisualMode({ campaignFocus: 'editorial_campaign', requestedVisualMode: 'pure_t2v' }),
      'pure_t2v',
      'editorial_campaign must honor requested pure_t2v'
    );

    // Re-campaign with pure_t2v
    assert.equal(
      resolveEffectiveVisualMode({ campaignFocus: 're_campaign', presetVisualMode: 'pure_t2v' }),
      'pure_t2v',
      're_campaign must honor preset pure_t2v'
    );

    // Fallback default
    assert.equal(
      resolveEffectiveVisualMode({ campaignFocus: 'general_pillar' }),
      'hybrid_lock',
      'default fallback must be hybrid_lock'
    );
  });

  await t.test('3. Ingest Product Campaign in full_autopilot stays hybrid_lock & start_frame pending', async () => {
    const db = getDb();
    const tenantId = 'default_tenant';

    // 1. Create a draft product planner
    const draft = await createDraftContentPlanner({
      title: 'Test Visual Mode Product Invariant',
      account_name: 'dapurbotani',
      brand_id: 'df382ce8-2145-4464-ae63-79375ff3aff2',
      product_id: 'pe_1793545394035_6698',
      product_name: 'Garlibee Test',
      product_description: 'Madu fermentasi bawang lanang',
      tenant_id: tenantId,
      planner_focus: 'product_campaign',
      target_language: 'id-ID',
      planner_count: 1
    });

    const plannerId = draft.id;
    assert.ok(plannerId, 'Draft planner ID should be generated');

    const rowId = `row_vm_prod_${Date.now()}`;
    await db.prepare(`
      INSERT INTO content_planner_rows (
        id, planner_id, sequence, video_id, pillar, category_cep, ws_matrix, context, vfo, strategic_angle, narrative_mode, hook, visual_action, content_subject, product_reference, commercial_intent, cta_type, product, selling_intent, validation_status, is_locked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      rowId, plannerId, 1, 'VID_PROD_001', 'Pilar GarliBee', 'Routine Based', 'When Morning', 'Sarapan', 'Concrete', 'The Life Hack', 'Storytelling', 'Rutinitas 1 sendok madu di pagi hari', 'Tuang madu ke sendok kayu', 'GarliBee Madu', 'GarliBee', 'soft_sell', 'direct_order', 'GarliBee', 'Edukasi Produk', 'valid'
    );

    // 2. Ingest with full_autopilot and deliberately pass visual_mode: pure_t2v
    const ingestRes = await ingestPlannerToPillarCampaign({
      plannerId,
      campaignName: 'Test Product Autopilot Hybrid Lock Enforcement',
      globalSettings: {
        execution_mode: 'full_autopilot',
        visual_mode: 'pure_t2v', // Deliberate attempt to set pure_t2v
        target_product_id: 'pe_1793545394035_6698'
      }
    });

    const campaignId = ingestRes.campaignId || ingestRes.campaign_id;
    assert.ok(campaignId, 'Ingest should return campaignId');

    try {
      const campaign = await db.prepare('SELECT visual_mode, execution_mode FROM pillar_campaigns WHERE id = ?').get(campaignId);
      assert.equal(
        campaign.visual_mode,
        'hybrid_lock',
        'Product campaign visual_mode MUST be hybrid_lock even when autopilot or pure_t2v was passed'
      );

      const items = await db.prepare('SELECT id, row_creative_payload, start_frame_status FROM pillar_campaign_items WHERE campaign_id = ?').all(campaignId);
      assert.ok(items.length > 0, 'Campaign should have items');
      for (const item of items) {
        const payload = JSON.parse(item.row_creative_payload || '{}');
        assert.equal(payload.visual_mode, 'hybrid_lock', 'Item payload visual_mode must be hybrid_lock');
        assert.equal(item.start_frame_status, 'pending', 'Item start_frame_status must be pending for hybrid_lock');
      }
    } finally {
      // Clean up test data
      await db.prepare('DELETE FROM pillar_campaign_items WHERE campaign_id = ?').run(campaignId);
      await db.prepare('DELETE FROM pillar_campaigns WHERE id = ?').run(campaignId);
      await db.prepare('DELETE FROM content_planner_rows WHERE planner_id = ?').run(plannerId);
      await db.prepare('DELETE FROM content_planners WHERE id = ?').run(plannerId);
    }
  });

  await t.test('4. Ingest Editorial Campaign respects preset pure_t2v on full_autopilot', async () => {
    const db = getDb();
    const tenantId = 'default_tenant';

    // 1. Create a draft editorial planner (no product)
    const draft = await createDraftContentPlanner({
      title: 'Test Visual Mode Editorial Preset Passthrough',
      account_name: 'dapurbotani',
      brand_id: 'df382ce8-2145-4464-ae63-79375ff3aff2',
      tenant_id: tenantId,
      planner_focus: 'brand_editorial',
      brand_context: 'Edukasi dan kesadaran gaya hidup sehat alami bagi keluarga Indonesia.',
      pillars: ['Edukasi Kesehatan'],
      target_language: 'id-ID',
      planner_count: 3
    });

    const plannerId = draft.id;
    assert.ok(plannerId, 'Draft planner ID should be generated');

    const rowId = `row_vm_edit_${Date.now()}`;
    await db.prepare(`
      INSERT INTO content_planner_rows (
        id, planner_id, sequence, video_id, pillar, category_cep, ws_matrix, context, vfo, strategic_angle, narrative_mode, hook, visual_action, content_subject, product_reference, commercial_intent, cta_type, product, selling_intent, validation_status, is_locked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      rowId, plannerId, 1, 'VID_EDIT_001', 'Pilar Edukasi', 'Knowledge Based', 'Why Important', 'Gaya Hidup', 'Concept', 'Thought Leadership', 'Storytelling', 'Mengapa hidup sehat itu penting?', 'Pemandangan alam fajar', 'Filosofi Hidup Sehat', null, 'awareness', 'engagement', null, 'Edukasi Murni', 'valid'
    );

    // 2. Ingest with full_autopilot where preset wants pure_t2v
    const ingestRes = await ingestPlannerToPillarCampaign({
      plannerId,
      campaignName: 'Test Editorial Preset pure_t2v',
      globalSettings: {
        execution_mode: 'full_autopilot',
        campaign_focus: 'brand_editorial',
        visual_mode: 'pure_t2v' // Preset wants pure_t2v
      }
    });

    const campaignId = ingestRes.campaignId || ingestRes.campaign_id;
    assert.ok(campaignId, 'Ingest should return campaignId');

    try {
      const campaign = await db.prepare('SELECT visual_mode, execution_mode FROM pillar_campaigns WHERE id = ?').get(campaignId);
      assert.equal(
        campaign.visual_mode,
        'pure_t2v',
        'Editorial campaign visual_mode must honor preset pure_t2v'
      );

      const items = await db.prepare('SELECT id, row_creative_payload, start_frame_status FROM pillar_campaign_items WHERE campaign_id = ?').all(campaignId);
      assert.ok(items.length > 0, 'Campaign should have items');
      for (const item of items) {
        const payload = JSON.parse(item.row_creative_payload || '{}');
        assert.equal(payload.visual_mode, 'pure_t2v', 'Item payload visual_mode must be pure_t2v');
        assert.equal(item.start_frame_status, 'skipped', 'Item start_frame_status must be skipped for pure_t2v');
      }
    } finally {
      // Clean up test data
      await db.prepare('DELETE FROM pillar_campaign_items WHERE campaign_id = ?').run(campaignId);
      await db.prepare('DELETE FROM pillar_campaigns WHERE id = ?').run(campaignId);
      await db.prepare('DELETE FROM content_planner_rows WHERE planner_id = ?').run(plannerId);
      await db.prepare('DELETE FROM content_planners WHERE id = ?').run(plannerId);
    }
  });

});
