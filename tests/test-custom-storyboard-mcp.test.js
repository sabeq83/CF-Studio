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
import { executeCustomStoryboardPipeline, executeCustomStoryboardBatch } from '../lib/custom-storyboard-pipeline.js';
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

test('4. executeCustomStoryboardPipeline binds product+photo, opens ElevenLabs video_dna, enables social+contentflow sync, and enforces idempotencyKey', async () => {
  const db = getDb();
  const prodId = `prd_test_cs_${Date.now()}`;
  const cleanPhotoPath = `/uploads/products/default_tenant/clean/${prodId}.png`;
  const createdCampaignIds = [];

  await db.prepare(`
    INSERT INTO product_extractions (id, tenant_id, product_name, clean_photo_url, affiliate_link)
    VALUES (?, 'default_tenant', ?, ?, ?)
  `).run(prodId, 'Serum Matcha Test', cleanPhotoPath, 'https://shopee.co.id/test-product');

  try {
    const idemKey = `idem_cs_${Date.now()}`;
    const payload = {
      title: 'Storyboard Produk ElevenLabs E2E',
      product_id: prodId,
      require_product_photo: true,
      enable_social_post: true,
      auto_sync_contentflow: true,
      video_dna: {
        aspect_ratio: '9:16',
        visual_mode: 'hybrid_lock',
        voice_provider: 'elevenlabs',
        voice_persona: 'putri_maharani',
        elevenlabs_model: 'eleven_multilingual_v2',
        elevenlabs_stability: 0.6,
        elevenlabs_similarity_boost: 0.85,
        target_language: 'id-ID',
        words_per_clip: 16,
        clip_duration: 6
      },
      scenes: [
        {
          scene_index: 1,
          voiceover_text: 'Lihat hasil pemakaian serum matcha selama 7 hari.',
          visual_prompt: 'Hand holding Serum Matcha bottle cleanly on bright studio desk --ar 9:16',
          duration_seconds: 6
        }
      ]
    };

    const res1 = await executeCustomStoryboardPipeline({
      storyboard: payload,
      tenantId: 'default_tenant',
      executionMode: 'creative_review',
      idempotencyKey: idemKey
    });
    createdCampaignIds.push(res1.campaign_id);

    assert.equal(res1.success, true);
    assert.equal(res1.product_id, prodId);
    assert.equal(res1.product_ref_image_path, cleanPhotoPath);
    assert.equal(res1.voice_provider, 'elevenlabs');
    assert.equal(res1.auto_sync_contentflow, true);
    assert.equal(res1.enable_social_post, true);

    const campaign = await db.prepare('SELECT * FROM pillar_campaigns WHERE id = ?').get(res1.campaign_id);
    assert.equal(campaign.target_product_id, prodId);
    assert.equal(campaign.product_ref_image_path, cleanPhotoPath);
    assert.equal(Number(campaign.is_bridging_active), 1);
    assert.equal(Number(campaign.enable_social_post), 1);
    assert.equal(Number(campaign.auto_sync_contentflow), 1);
    assert.equal(campaign.voice_provider, 'elevenlabs');
    assert.equal(campaign.voice_persona, 'putri_maharani');

    const res2 = await executeCustomStoryboardPipeline({
      storyboard: payload,
      tenantId: 'default_tenant',
      executionMode: 'creative_review',
      idempotencyKey: idemKey
    });
    assert.equal(res2.idempotent, true);
    assert.equal(res2.campaign_id, res1.campaign_id);
  } finally {
    for (const cid of createdCampaignIds) {
      await db.prepare('DELETE FROM pillar_campaign_items WHERE campaign_id = ?').run(cid);
      await db.prepare('DELETE FROM pillar_campaigns WHERE id = ?').run(cid);
    }
    await db.prepare('DELETE FROM product_extractions WHERE id = ?').run(prodId);
  }
});

test('5. executeCustomStoryboardPipeline enforces photo guard and batch max 12 limit', async () => {
  await assert.rejects(
    async () => executeCustomStoryboardPipeline({
      storyboard: {
        title: 'No Photo Guard',
        require_product_photo: true,
        scenes: [{ voiceover_text: 'Hi', visual_prompt: 'Test --ar 9:16' }]
      },
      tenantId: 'default_tenant'
    }),
    /require_product_photo aktif/
  );

  const thirteen = Array.from({ length: 13 }, (_, idx) => ({
    title: `Item ${idx + 1}`,
    scenes: [{ voiceover_text: 'Hi', visual_prompt: 'Test --ar 9:16' }]
  }));
  await assert.rejects(
    async () => executeCustomStoryboardBatch({ items: thirteen, tenantId: 'default_tenant' }),
    /Maksimal 12 custom storyboard/
  );
});
