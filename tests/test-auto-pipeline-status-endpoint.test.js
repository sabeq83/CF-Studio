import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../lib/db.js';
import { activeSessionsCache } from '../lib/auth.js';

// Setup mock session for withTenantContext
activeSessionsCache['test_visualizer_token'] = {
  id: 'usr_test_vis',
  username: 'test_admin',
  role: 'admin',
  tenantId: 'default_tenant',
  status: 'active'
};

test('Status API endpoint aggregates 7 stages correctly from database', async () => {
  const db = getDb();
  const testCampaignId = `opc_test_${Date.now()}`;
  const testItemId = Math.floor(Math.random() * 80000) + 10000;

  // 1. Insert test campaign & item
  await db.prepare(`
    INSERT INTO pillar_campaigns (id, campaign_name, status, content_pillar, source_planner_id, created_at)
    VALUES (?, ?, 'running', 'Recipe Campaign', 'pln_test_123', ?)
  `).run(testCampaignId, 'Test Recipe Campaign Visualizer', new Date().toISOString());

  await db.prepare(`
    INSERT INTO pillar_campaign_items (
      id, campaign_id, row_creative_payload, generation_status, 
      start_frame_status, start_frame_expected_count, start_frame_completed_count,
      tts_status, visual_status, ffmpeg_status, ffmpeg_output_path,
      drive_link, contentflow_sync_status, new_video_plan_json
    ) VALUES (?, ?, ?, 'completed', 'completed', 8, 8, 'completed', 'completed', 'completed', '/test/video.mp4', 'http://cloud.test/s/abc', 'completed', ?)
  `).run(
    testItemId, 
    testCampaignId, 
    JSON.stringify({ title: 'Air Fryer Potato' }),
    JSON.stringify(Array(8).fill({ clip_index: 1, t2i_prompt: 'test' }))
  );

  // 2. Call GET endpoint
  const { GET } = await import('../app/api/v2/recipes/autonomous-pipeline/status/route.js');
  const req = new Request(`http://localhost:3000/api/v2/recipes/autonomous-pipeline/status?campaign_id=${testCampaignId}`, {
    headers: { 'Authorization': 'Bearer test_visualizer_token' }
  });
  const res = await GET(req);
  const data = await res.json();
  if (!data.success) {
    console.error('API Error in test 1:', data);
  }

  assert.equal(data.success, true, 'Status API should succeed');
  assert.equal(data.campaign.id, testCampaignId, 'Campaign ID should match');
  assert.ok(data.stages, 'Stages object should exist');

  // Verify all 7 stages
  const { s1, s2, s3, s4, s5, s6, s7 } = data.stages;

  assert.equal(s1.step, 1);
  assert.equal(s1.status, 'completed');
  assert.equal(s1.title, 'Planner Creation');

  assert.equal(s2.step, 2);
  assert.equal(s2.status, 'completed');
  assert.equal(s2.title, 'Storyboard Creation');

  assert.equal(s3.step, 3);
  assert.equal(s3.status, 'completed');
  assert.equal(s3.title, 'Start Frame Generation');

  assert.equal(s4.step, 4);
  assert.equal(s4.status, 'completed');
  assert.equal(s4.title, 'TTS Generation');

  assert.equal(s5.step, 5);
  assert.equal(s5.status, 'completed');
  assert.equal(s5.title, 'Video Generation');

  assert.equal(s6.step, 6);
  assert.equal(s6.status, 'completed');
  assert.equal(s6.title, 'FFmpeg Processing');

  assert.equal(s7.step, 7);
  assert.equal(s7.status, 'completed');
  assert.equal(s7.title, 'Cloud & Sync');

  assert.equal(data.is_completed, true, 'Overall pipeline should be completed');
  assert.ok(data.telemetry?.message, 'Telemetry message should exist');
  assert.ok(data.telemetry?.timestamp, 'Telemetry timestamp should exist');

  // Clean up test rows
  try {
    await db.prepare('DELETE FROM pillar_campaign_items WHERE id = ?').run(testItemId);
    await db.prepare('DELETE FROM pillar_campaigns WHERE id = ?').run(testCampaignId);
  } catch (_) {}
});

test('Status API reflects in-progress stages accurately', async () => {
  const db = getDb();
  const testCampaignId = `opc_test_prog_${Date.now()}`;
  const testItemId = Math.floor(Math.random() * 80000) + 10000;

  // Insert item paused at video generation (step 5)
  await db.prepare(`
    INSERT INTO pillar_campaigns (id, campaign_name, status, content_pillar, source_planner_id, created_at)
    VALUES (?, ?, 'running', 'Recipe Campaign', 'pln_prog_456', ?)
  `).run(testCampaignId, 'Test In Progress Recipe', new Date().toISOString());

  await db.prepare(`
    INSERT INTO pillar_campaign_items (
      id, campaign_id, row_creative_payload, generation_status, 
      start_frame_status, start_frame_expected_count, start_frame_completed_count,
      tts_status, visual_status, visual_clip_paths, ffmpeg_status, drive_link, contentflow_sync_status, new_video_plan_json
    ) VALUES (?, ?, ?, 'completed', 'completed', 8, 8, 'completed', 'processing', ?, 'pending', null, 'pending', ?)
  `).run(
    testItemId, 
    testCampaignId, 
    JSON.stringify({ title: 'In Progress Dish' }),
    JSON.stringify(['/clip1.mp4', '/clip2.mp4', '/clip3.mp4']), // 3 clips ready
    JSON.stringify(Array(8).fill({ clip_index: 1, t2i_prompt: 'test' }))
  );

  const { GET } = await import('../app/api/v2/recipes/autonomous-pipeline/status/route.js');
  const req = new Request(`http://localhost:3000/api/v2/recipes/autonomous-pipeline/status?campaign_id=${testCampaignId}`, {
    headers: { 'Authorization': 'Bearer test_visualizer_token' }
  });
  const res = await GET(req);
  const data = await res.json();

  assert.equal(data.success, true);
  assert.equal(data.stages.s1.status, 'completed');
  assert.equal(data.stages.s2.status, 'completed');
  assert.equal(data.stages.s3.status, 'completed');
  assert.equal(data.stages.s4.status, 'completed');
  assert.equal(data.stages.s5.status, 'processing', 'Step 5 should be processing');
  assert.equal(data.stages.s5.badge, 'Veo 3/8', 'Should reflect 3/8 video clips rendered');
  assert.equal(data.stages.s6.status, 'idle', 'Step 6 should be idle');
  assert.equal(data.stages.s7.status, 'idle', 'Step 7 should be idle');
  assert.equal(data.is_completed, false, 'Should not be marked completed yet');

  // Clean up
  try {
    await db.prepare('DELETE FROM pillar_campaign_items WHERE id = ?').run(testItemId);
    await db.prepare('DELETE FROM pillar_campaigns WHERE id = ?').run(testCampaignId);
  } catch (_) {}
});

