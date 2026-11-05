import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../lib/db.js';
import { closePgPool } from '../lib/db-pg.js';
import { stopCampaignScheduler } from '../lib/campaign-scheduler.js';
import { ingestRecipePlannerToPillarCampaign } from '../lib/recipe-campaign-ingest.js';

test.after(async () => {
  stopCampaignScheduler();
  await new Promise(resolve => setTimeout(resolve, 800));
  await closePgPool();
  process.exit(0);
});

test('Sidebar navigation: Auto Pipeline is placed at the top of WORKFLOW above YouTube Studio', () => {
  const sidebarPath = path.join(process.cwd(), 'app/components/Sidebar.js');
  const content = fs.readFileSync(sidebarPath, 'utf8');

  // Verify menu mapping
  assert.ok(content.includes("'/auto-pipeline': 'pillar_campaign'"), "menuKeyMap must contain '/auto-pipeline'");

  // Verify position above YouTube Studio
  const workflowIndex = content.indexOf("{ section: 'WORKFLOW' }");
  assert.ok(workflowIndex !== -1, "Sidebar must contain '{ section: \\'WORKFLOW\\' }'");

  const autoPipelineIndex = content.indexOf("{ label: 'Auto Pipeline', href: '/auto-pipeline', icon: '⚡' }", workflowIndex);
  assert.ok(autoPipelineIndex !== -1, "Auto Pipeline must be under WORKFLOW section");

  const ytStudioIndex = content.indexOf("{ label: 'YouTube Studio', href: '/youtube-studio', icon: '▶️' }", workflowIndex);
  assert.ok(ytStudioIndex !== -1, "YouTube Studio must be under WORKFLOW section");

  assert.ok(
    autoPipelineIndex < ytStudioIndex,
    `Auto Pipeline (index ${autoPipelineIndex}) must appear BEFORE YouTube Studio (index ${ytStudioIndex})`
  );
});

test('Recipe Campaign Ingest defaults auto_sync_contentflow to 1 for ContentFlow Hub integration', async () => {
  const db = getDb();
  const testPlannerId = `test_cf_sync_pln_${Date.now()}`;
  const testTenantId = 'default_tenant';

  // 1. Setup test planner
  await db.prepare(`
    INSERT INTO content_planners (
      id, title, account_name, planner_focus, recipe_config_json, products_snapshot_json, status, target_audience, tenant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    testPlannerId,
    'HabitFolk - ContentFlow Hub Sync Test',
    'habitfolk',
    'recipe_campaign',
    JSON.stringify({ category: 'makanan_utama' }),
    JSON.stringify([]),
    'planned',
    'genz_casual',
    testTenantId
  );

  // 2. Setup test row
  const rowId1 = `cpr_cf_sync_${Date.now()}`;
  const idea1 = {
    title: 'Honey Glazed Garlic Shrimp',
    category: 'makanan_utama',
    hook: 'Crispy shrimp in under 10 minutes!',
    visual_highlight: 'Garlic butter bubbling around plump pink shrimp'
  };

  await db.prepare(`
    INSERT INTO content_planner_rows (
      id, planner_id, sequence, title, hook, status, recipe_idea_json, product, product_id,
      pillar, category_cep, ws_matrix, context, vfo, strategic_angle, video_id, tenant_id, visual_action
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    rowId1, testPlannerId, 1, idea1.title, idea1.hook, 'planned', JSON.stringify(idea1),
    'Shrimp', 'prod_shrimp_1', 'Recipe Campaign', 'Dinner', 'Matrix A', 'Context A', 'VFO 1',
    'Quick Healthy', `vid_shrimp_1`, testTenantId, idea1.visual_highlight
  );

  // 3. Ingest without explicitly providing auto_sync_contentflow
  const ingestResult = await ingestRecipePlannerToPillarCampaign({
    plannerId: testPlannerId,
    globalSettings: {
      visual_identity_preset_id: 'vi_habitfolk_macro_craft',
      video_model: 'omni_flash',
      target_clips_count: 8,
      clip_duration: 4,
      target_ai: 'Google Veo Omni Flash',
      voice_persona: 'English_causual_narrator_vv1',
      local_scheduler: 0,
      status: 'idle'
    },
    tenantId: testTenantId
  });

  assert.equal(ingestResult.success, true);

  // 4. Verify in database: auto_sync_contentflow MUST default to 1 (True)
  const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id = ?').get(ingestResult.campaign_id);
  assert.ok(campaign);
  assert.equal(
    Number(campaign.auto_sync_contentflow),
    1,
    'Campaign auto_sync_contentflow must default to 1 for automatic ContentFlow Hub sync'
  );

  // Clean up
  await db.prepare('DELETE FROM pillar_campaign_items WHERE campaign_id = ?').run(ingestResult.campaign_id);
  await db.prepare('DELETE FROM pillar_campaigns WHERE id = ?').run(ingestResult.campaign_id);
  await db.prepare('DELETE FROM content_planner_rows WHERE planner_id = ?').run(testPlannerId);
  await db.prepare('DELETE FROM content_planners WHERE id = ?').run(testPlannerId);
});

