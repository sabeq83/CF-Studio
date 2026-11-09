/**
 * tests/test-custom-storyboard-mcp.test.js
 *
 * Unit test suite untuk fitur Custom Storyboard Submission via MCP:
 * Memverifikasi validasi skema payload, sanitasi naskah, dan injeksi pipeline langsung
 * ke tahap produksi (TTS, Video, FFmpeg).
 */

process.env.NODE_ENV = 'test';

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { executeCustomStoryboardPipeline } from '../lib/custom-storyboard-pipeline.js';
import { getDb } from '../lib/db.js';

after(() => {
  setTimeout(() => process.exit(0), 100);
});

test('1. executeCustomStoryboardPipeline rejects invalid or empty payloads', async () => {
  await assert.rejects(
    async () => executeCustomStoryboardPipeline({ storyboard: null }),
    /Storyboard payload wajib berupa objek JSON/
  );

  await assert.rejects(
    async () => executeCustomStoryboardPipeline({ storyboard: { title: 'Test', scenes: [] } }),
    /Storyboard wajib memiliki minimal 1 scene/
  );
});

test('2. executeCustomStoryboardPipeline correctly injects a 3-scene custom storyboard', async () => {
  const customStoryboard = {
    title: 'Trik Ngopi Pagi Tanpa Jantung Berdebar',
    video_dna: {
      aspect_ratio: '9:16',
      visual_style: 'Cinematic',
      visual_mode: 'hybrid_lock',
      voice_persona: 'Aoede',
      speed_control: 2.5,
      target_ai_engine: 'Google Veo (8s)',
      enable_motion_text: true,
      motion_text_style: 'floating_white_yellow'
    },
    scenes: [
      {
        scene_index: 1,
        voiceover_text: 'Pernah nggak sih baru ngopi setengah cangkir tapi dada udah berdebar nggak karuan?',
        visual_prompt: 'Cinematic close-up of a rustic coffee cup steaming on a wooden table, morning light --ar 9:16',
        camera_movement: 'Slow zoom in',
        duration_seconds: 4
      },
      {
        scene_index: 2,
        voiceover_text: 'Ternyata kuncinya ada di proses roasting biji kopi arabika single origin ini.',
        visual_prompt: 'Macro slow motion shot of freshly roasted golden brown coffee beans cascading --ar 9:16',
        camera_movement: 'Top-down tilt',
        duration_seconds: 4
      },
      {
        scene_index: 3,
        voiceover_text: 'Cobain deh racikan kopi rendah asam ini, lambung dan jantung kamu bakal berterima kasih!',
        visual_prompt: 'Satisfying pour of smooth crema espresso into glass cup, serene ambiance --ar 9:16',
        camera_movement: 'Static lock',
        duration_seconds: 4
      }
    ],
    social_media_package: {
      caption: 'Pernah ngalamin dada berdebar pas ngopi pagi? Simak rahasianya di sini!',
      hashtags: ['#KopiSehat', '#TipsNgopi', '#ArabikaPilihan']
    }
  };

  const result = await executeCustomStoryboardPipeline({
    storyboard: customStoryboard,
    tenantId: 'default_tenant',
    executionMode: 'full_autopilot'
  });

  assert.equal(result.success, true);
  assert.ok(result.campaign_id.startsWith('cst_'), 'Campaign ID must start with cst_');
  assert.equal(result.total_scenes, 3);
  assert.equal(result.status, 'production_processing');
  assert.deepEqual(result.production_stages, ['tts', 'visuals', 'ffmpeg']);

  // Verifikasi database entry
  const db = getDb();
  const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id = ?').get(result.campaign_id);
  assert.ok(campaign, 'Campaign row must exist in database');
  assert.equal(Number(campaign.target_clips_count), 3);
  assert.equal(campaign.aspect_ratio, '9:16');
  assert.equal(campaign.voice_persona, 'Aoede');

  const item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id = ?').get(result.item_id);
  assert.ok(item, 'Item row must exist in database');
  assert.equal(item.generation_status, 'completed', 'Generation status must be completed (bypassed AI generator)');
  assert.equal(item.tts_status, 'pending', 'TTS status must be pending');
  assert.equal(item.visual_status, 'pending', 'Visual status must be pending');
  assert.equal(item.ffmpeg_status, 'pending', 'FFmpeg status must be pending');

  const videoPlan = JSON.parse(item.new_video_plan_json);
  assert.equal(videoPlan.length, 3, 'new_video_plan_json must have 3 clips');
  assert.equal(videoPlan[0].new_vo, 'Pernah nggak sih baru ngopi setengah cangkir tapi dada udah berdebar nggak karuan?');
  assert.equal(videoPlan[0].t2i_prompt, 'Cinematic close-up of a rustic coffee cup steaming on a wooden table, morning light --ar 9:16');
  assert.equal(videoPlan[1].new_vo, 'Ternyata kuncinya ada di proses roasting biji kopi arabika single origin ini.');

  const resultData = JSON.parse(item.result_json);
  assert.equal(resultData.voiceover.length, 3);
  assert.equal(resultData.social_media_package.hashtags.length, 3);
  assert.ok(resultData.social_media_package.caption.includes('Pernah ngalamin dada berdebar'));
});

test('3. executeCustomStoryboardPipeline supports creative_review mode without auto-approval', async () => {
  const customStoryboard = {
    title: 'Review Mode Storyboard',
    scenes: [
      {
        scene_index: 1,
        voiceover_text: 'Scene 1 voiceover text for manual approval test.',
        visual_prompt: 'Cinematic visual scene 1 --ar 9:16'
      }
    ]
  };

  const result = await executeCustomStoryboardPipeline({
    storyboard: customStoryboard,
    tenantId: 'default_tenant',
    executionMode: 'creative_review'
  });

  assert.equal(result.success, true);
  assert.equal(result.status, 'ready_for_review');

  const db = getDb();
  const item = await db.prepare('SELECT workflow_status FROM pillar_campaign_items WHERE id = ?').get(result.item_id);
  assert.equal(item.workflow_status, 'ready_for_review');
});
