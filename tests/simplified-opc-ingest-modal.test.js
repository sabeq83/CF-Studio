import test from 'node:test';
import assert from 'node:assert/strict';
import { ingestPlannerToPillarCampaign } from '../lib/pillar-campaign-ingest.js';
import { getDb } from '../lib/db.js';
import { closePgPool } from '../lib/db-pg.js';

test.after(async () => {
  await closePgPool();
});

test('Simplified OPC Ingest: Auto-hydrates operator_preset_key with 100% config inheritance', async () => {
  const db = getDb();
  const testPlannerId = `test_simp_ingest_${Date.now()}`;
  const testTenantId = 'default_tenant';

  // 1. Insert test content planner
  await db.prepare(`
    INSERT INTO content_planners (
      id, title, account_name, planner_focus, status, target_audience, tenant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    testPlannerId,
    'Cerita Dokter - Edukasi Herbal & Imun',
    'Cerita Dokter',
    'brand_editorial',
    'planned',
    'General',
    testTenantId
  );

  // 2. Insert test rows
  const row1Id = `cpr_sim_${Date.now()}_1`;
  const row2Id = `cpr_sim_${Date.now()}_2`;

  await db.prepare(`
    INSERT INTO content_planner_rows (
      id, planner_id, sequence, pillar, strategic_angle, hook, visual_action, cta, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row1Id,
    testPlannerId,
    1,
    'Mitos vs Fakta',
    'Meluruskan Mitos',
    'Kerokan bikin sembuh atau bahaya? dr. Aisyah bongkar faktanya!',
    'dr. Aisyah di apotek herbal memegang grafik 3D',
    'Tulis di komentar ya',
    'planned'
  );

  await db.prepare(`
    INSERT INTO content_planner_rows (
      id, planner_id, sequence, pillar, strategic_angle, hook, visual_action, cta, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row2Id,
    testPlannerId,
    2,
    'Sinyal Tubuh',
    'Deteksi Dini',
    'Leher sering kaku? Waspada alarm kolesterol!',
    'dr. Aisyah menjelaskan miniatur organ pembuluh darah 3D',
    'Cek kesehatan keluargamu sekarang',
    'planned'
  );

  // 3. Test Ingest with Operator Preset Key and Draft Status
  const ingestResult = await ingestPlannerToPillarCampaign({
    plannerId: testPlannerId,
    selectedRowIds: [row1Id, row2Id],
    campaignName: 'OPC - Cerita Dokter - Test Simplified Ingest',
    globalSettings: {
      operator_preset_key: 'brand_editorial_campaign',
      status: 'draft'
    }
  });

  assert.ok(ingestResult.campaignId, 'Campaign ID should be generated');
  assert.equal(ingestResult.ingestedCount, 2, 'Should ingest 2 rows');
  assert.equal(ingestResult.status, 'draft', 'Status should be draft');

  // 4. Verify in DB that campaign inherited settings from brand_editorial_campaign
  const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id = ?').get(ingestResult.campaignId);
  assert.ok(campaign, 'Campaign must exist in DB');
  assert.equal(campaign.status, 'draft');
  assert.equal(campaign.video_model, 'veo_31_lite');
  assert.equal(campaign.clip_duration, 8);
  assert.equal(campaign.voice_provider, 'minimax');
  assert.equal(campaign.aspect_ratio, '9:16');
  assert.ok(campaign.visual_identity_preset_id, 'Visual Identity preset should be auto-hydrated from preset');

  // 5. Cleanup test data
  await db.prepare('DELETE FROM pillar_campaign_items WHERE campaign_id = ?').run(ingestResult.campaignId);
  await db.prepare('DELETE FROM pillar_campaigns WHERE id = ?').run(ingestResult.campaignId);
  await db.prepare('DELETE FROM content_planner_rows WHERE planner_id = ?').run(testPlannerId);
  await db.prepare('DELETE FROM content_planners WHERE id = ?').run(testPlannerId);
});
