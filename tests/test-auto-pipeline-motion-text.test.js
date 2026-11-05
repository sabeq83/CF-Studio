import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../lib/db.js';
import { ingestRecipePlannerToPillarCampaign } from '../lib/recipe-campaign-ingest.js';

test('ingestRecipePlannerToPillarCampaign stores motion text parameters correctly in database', async () => {
  const db = getDb();

  // Ensure content_planner_consumptions table exists
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS content_planner_consumptions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'default_tenant',
      planner_id TEXT NOT NULL,
      owner_type TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'consumed',
      snapshot_sha256 TEXT,
      metadata_json JSONB DEFAULT '{}'::jsonb,
      consumed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const baseTimestamp = Date.now();

  async function createPlanner(suffix) {
    const pId = `pln_test_mt_${baseTimestamp}_${suffix}`;
    await db.prepare(`
      INSERT INTO content_planners (id, title, account_name, brand_id, planner_focus, target_language, created_at)
      VALUES (?, ?, 'habitfolk', 'brand_test_123', 'recipe_campaign', 'en-US', ?)
    `).run(pId, `Test Planner Motion Text ${suffix}`, new Date().toISOString());

    await db.prepare(`
      INSERT INTO content_planner_rows (id, planner_id, sequence, title, hook, visual_action, recipe_idea_json)
      VALUES (?, ?, 1, 'Air Fryer Herb Butter Potato', 'Tender and crispy!', 'Chef slicing potato', ?)
    `).run(`row_${pId}_1`, pId, JSON.stringify({
      title: 'Air Fryer Herb Butter Potato',
      ingredients: ['Potato', 'Butter', 'Rosemary'],
      instructions: ['Cut potato', 'Airfry at 200C']
    }));

    return pId;
  }

  // Test Case A: Custom Style & Center Position (ON) + Transition
  const plannerA = await createPlanner('a');
  const resultA = await ingestRecipePlannerToPillarCampaign({
    plannerId: plannerA,
    globalSettings: {
      account_name: 'habitfolk',
      enable_motion_text: 1,
      motion_text_style: 'floating_black_on_white',
      motion_text_position: 'center',
      video_transition: 'fadewhite',
      transition_duration: 0.8,
      execution_mode: 'manual_review'
    },
    tenantId: 'default_tenant'
  });

  assert.ok(resultA.campaign_id, 'Campaign ID A should be generated');

  const campaignA = await db.prepare(
    'SELECT id, enable_motion_text, motion_text_style, motion_text_position, video_transition, transition_duration FROM pillar_campaigns WHERE id = ?'
  ).get(resultA.campaign_id);

  assert.ok(campaignA, 'Campaign A must exist in database');
  assert.equal(campaignA.enable_motion_text, 1, 'enable_motion_text should be 1');
  assert.equal(campaignA.motion_text_style, 'floating_black_on_white', 'motion_text_style should match');
  assert.equal(campaignA.motion_text_position, 'center', 'motion_text_position should match');
  assert.equal(campaignA.video_transition, 'fadewhite', 'video_transition should be fadewhite');
  assert.equal(Number(campaignA.transition_duration), 0.8, 'transition_duration should be 0.8');

  // Test Case B: Clean Video Mode (OFF)
  const plannerB = await createPlanner('b');
  const resultB = await ingestRecipePlannerToPillarCampaign({
    plannerId: plannerB,
    globalSettings: {
      account_name: 'habitfolk',
      enable_motion_text: 0,
      motion_text_style: 'minimal_white',
      motion_text_position: 'top',
      execution_mode: 'manual_review'
    },
    tenantId: 'default_tenant'
  });

  const campaignB = await db.prepare(
    'SELECT id, enable_motion_text, motion_text_style, motion_text_position FROM pillar_campaigns WHERE id = ?'
  ).get(resultB.campaign_id);

  assert.ok(campaignB, 'Campaign B must exist in database');
  assert.equal(campaignB.enable_motion_text, 0, 'enable_motion_text should be 0 for clean video');

  // Test Case C: Default Fallback
  const plannerC = await createPlanner('c');
  const resultC = await ingestRecipePlannerToPillarCampaign({
    plannerId: plannerC,
    globalSettings: {
      account_name: 'habitfolk',
      execution_mode: 'manual_review'
    },
    tenantId: 'default_tenant'
  });

  const campaignC = await db.prepare(
    'SELECT id, enable_motion_text, motion_text_style, motion_text_position, video_transition, transition_duration FROM pillar_campaigns WHERE id = ?'
  ).get(resultC.campaign_id);

  assert.ok(campaignC, 'Campaign C must exist in database');
  assert.equal(campaignC.enable_motion_text, 1, 'Default enable_motion_text should be 1');
  assert.equal(campaignC.motion_text_style, 'floating_white_yellow', 'Default motion_text_style should be floating_white_yellow');
  assert.equal(campaignC.motion_text_position, 'bottom', 'Default motion_text_position should be bottom');
  assert.equal(campaignC.video_transition, 'fade', 'Default video_transition should be fade');
  assert.equal(Number(campaignC.transition_duration), 0.5, 'Default transition_duration should be 0.5');

  setTimeout(() => process.exit(0), 100);
});
