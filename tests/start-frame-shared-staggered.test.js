process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.PG_SEARCH_PATH = process.env.PG_SEARCH_PATH || 'dev';

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { claimIsolatedStartFrameAsset } from '../lib/pillar-start-frame-service.js';
import { createStartFrameProviderAdapter } from '../lib/start-frame-provider-adapter.js';
import {
  validateProductRefLaneSettings,
  clampProductRefStaggerSec,
  normalizeProductRefLaneMode
} from '../lib/product-ref-lane-settings.js';
import { runStaggeredT2iBatch } from '../lib/t2i-staggered-runner.js';
import { approvePillarCampaignItem } from '../lib/pillar-campaign-approval.js';
import { shouldPauseBeforeTts } from '../lib/pillar-tts-gate.js';
import { pgQuery, closePgPool } from '../lib/db-pg.js';
import { tenantContext } from '../lib/tenant-context.js';
import { ensureSafeLocalTestDbEnv } from './helpers/db-test-guard.js';

ensureSafeLocalTestDbEnv();

const TENANT = `test_staggered_${crypto.randomUUID().slice(0, 8)}`;
const ITEM = `item_${Date.now()}`;

async function insertStartFrameAsset({
  clip,
  status = 'queued',
  critical = true,
  revision = 1
}) {
  const id = `pcia_s${crypto.randomUUID().replaceAll('-', '').slice(0, 15)}`;
  await pgQuery(
    `INSERT INTO pillar_campaign_item_assets
      (id, tenant_id, campaign_id, campaign_item_id, clip_index, asset_type, revision, status, attempt_count, reference_critical, created_at)
     VALUES ($1, $2, 'camp_stagger_test', $3, $4, 'start_frame', $5, $6, 0, $7, CURRENT_TIMESTAMP)`,
    [id, TENANT, ITEM, clip, revision, status, critical]
  );
  return id;
}

test.after(async () => {
  await pgQuery('DELETE FROM pillar_campaign_item_assets WHERE tenant_id = $1', [TENANT]).catch(() => {});
  await closePgPool().catch(() => {});
});

test('claimIsolatedStartFrameAsset blocks sibling provider_processing in exclusive mode, allows it in shared_staggered, and always blocks processing', async () => {
  await tenantContext.run(TENANT, async () => {
    await pgQuery('DELETE FROM pillar_campaign_item_assets WHERE tenant_id = $1', [TENANT]);

    // Clip 1 is actively waiting on G-Labs (provider_processing), Clip 2 is queued
    const clip1Id = await insertStartFrameAsset({ clip: 1, status: 'provider_processing', critical: true });
    const clip2Id = await insertStartFrameAsset({ clip: 2, status: 'queued', critical: true });

    // Exclusive mode: Clip 2 must be blocked by Clip 1 (provider_processing)
    // Make Clip 1 ineligible for claim itself via future next_attempt_at so we test Clip 2 claiming.
    await pgQuery(
      `UPDATE pillar_campaign_item_assets SET next_attempt_at = CURRENT_TIMESTAMP + INTERVAL '30 seconds' WHERE id = $1`,
      [clip1Id]
    );

    const exclusiveClaim = await claimIsolatedStartFrameAsset('worker-test', {
      leaseSeconds: 30,
      allowStaggeredProductRef: false
    });
    assert.equal(exclusiveClaim, null, 'Exclusive mode must block queued sibling while another critical clip is provider_processing');

    // Shared staggered mode: Clip 2 MUST be claimable while Clip 1 is provider_processing
    const staggeredClaim = await claimIsolatedStartFrameAsset('worker-test', {
      leaseSeconds: 30,
      allowStaggeredProductRef: true
    });
    assert.ok(staggeredClaim, 'shared_staggered mode must allow claiming queued sibling when another clip is provider_processing');
    assert.equal(staggeredClaim.id, clip2Id);
    assert.equal(staggeredClaim.status, 'processing');

    // Now Clip 2 is 'processing'. Even in shared_staggered mode, Clip 3 must wait while Clip 2 is 'processing'
    await insertStartFrameAsset({ clip: 3, status: 'queued', critical: true });
    const blockedWhileProcessing = await claimIsolatedStartFrameAsset('worker-test', {
      leaseSeconds: 30,
      allowStaggeredProductRef: true
    });
    assert.equal(blockedWhileProcessing, null, 'shared_staggered mode must still block when a sibling is actively processing');
  });
});

test('startFrameProviderAdapter.submit handles stagger cooldown and shared+skipDelay submission', async () => {
  const releasedReasons = [];
  const attachedTasks = [];
  const generatedPayloads = [];
  const laneModesRequested = [];
  const nextAllowedIso = new Date(Date.now() + 9000).toISOString();

  const baseDeps = {
    buildOpcStartFrameRequest: async () => ({
      providerRequest: {
        prompt: 'Produk test di meja dapur',
        model: 'nano_banana_2',
        aspect_ratio: '9:16',
        reference_images: [{ data: 'data:image/png;base64,AAAA', category: 'subject', name: 'prod.png' }]
      },
      audit: {
        requires_product_reference: true,
        requested_model: 'nano_banana_2',
        request_fingerprint: 'fp_test_1'
      }
    }),
    createStartFrameRequestAudit: async () => 'audit_1',
    updateStartFrameRequestAudit: async () => {},
    attachProviderTask: async (leaseId, taskId) => { attachedTasks.push({ leaseId, taskId }); },
    releaseImageLane: async (leaseId, reason) => { releasedReasons.push({ leaseId, reason }); return true; },
    requestImageLane: async ({ mode }) => {
      laneModesRequested.push(mode);
      return {
        acquired: true,
        id: 'lease_123',
        laneKey: 'lane_abc',
        lease: { id: 'lease_123', lane_key: 'lane_abc' }
      };
    },
    getSetting: (key) => {
      if (key === 'webhook_product_ref_lane_mode') return 'shared_staggered';
      if (key === 'webhook_product_ref_stagger_sec') return '15';
      return null;
    }
  };

  // Case 1: Cooldown active -> returns waiting_lane + nextAllowedAt, releases lease with 'stagger_wait'
  const adapterCooldown = createStartFrameProviderAdapter({
    ...baseDeps,
    reserveGlabsSubmitSlot: async () => ({
      allowed: false,
      waitMs: 9000,
      nextAllowedAt: nextAllowedIso
    }),
    generateImage: async (payload) => {
      generatedPayloads.push(payload);
      return { task_id: 'should_not_run' };
    }
  });

  const cooldownRes = await adapterCooldown.submit({
    assetId: 'asset_1',
    context: { clipIndex: 2, campaign: { id: 1, tenant_id: 't1' }, item: { id: 10 } }
  });

  assert.equal(laneModesRequested[0], 'shared');
  assert.equal(cooldownRes.status, 'waiting_lane');
  assert.equal(cooldownRes.laneMode, 'shared');
  assert.equal(cooldownRes.leaseId, null);
  assert.equal(cooldownRes.retryAfterMs, 9000);
  assert.equal(cooldownRes.nextAllowedAt, nextAllowedIso);
  assert.deepEqual(releasedReasons, [{ leaseId: 'lease_123', reason: 'stagger_wait' }]);
  assert.equal(generatedPayloads.length, 0);

  // Case 2: Slot available -> submits with mode='shared' and skipDelay=true
  const adapterSubmit = createStartFrameProviderAdapter({
    ...baseDeps,
    reserveGlabsSubmitSlot: async (_laneKey, sec) => {
      assert.equal(sec, 15);
      return { allowed: true, waitMs: 0, nextAllowedAt: null };
    },
    generateImage: async (payload) => {
      generatedPayloads.push(payload);
      return { task_id: 'glabs_task_999', effective_model: 'nano_banana_2' };
    }
  });

  const submitRes = await adapterSubmit.submit({
    assetId: 'asset_1',
    context: { clipIndex: 2, campaign: { id: 1, tenant_id: 't1' }, item: { id: 10 } }
  });

  assert.equal(submitRes.status, 'submitted');
  assert.equal(submitRes.laneMode, 'shared');
  assert.equal(submitRes.taskId, 'glabs_task_999');
  assert.equal(generatedPayloads.length, 1);
  assert.equal(generatedPayloads[0].skipDelay, true);
  assert.deepEqual(attachedTasks, [{ leaseId: 'lease_123', taskId: 'glabs_task_999' }]);
});

test('validateProductRefLaneSettings enforces whitelist and clamps stagger seconds (5..60)', () => {
  assert.equal(normalizeProductRefLaneMode('invalid'), 'exclusive');
  assert.equal(normalizeProductRefLaneMode('shared_staggered'), 'shared_staggered');
  assert.equal(clampProductRefStaggerSec(2), 5);
  assert.equal(clampProductRefStaggerSec(120), 60);
  assert.equal(clampProductRefStaggerSec(null), 12);

  const valid = validateProductRefLaneSettings({
    webhook_product_ref_lane_mode: 'shared_staggered',
    webhook_product_ref_stagger_sec: 99
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.laneMode, 'shared_staggered');
  assert.equal(valid.staggerSec, 60);

  const validLow = validateProductRefLaneSettings({
    webhook_product_ref_lane_mode: 'exclusive',
    webhook_product_ref_stagger_sec: 1
  });
  assert.equal(validLow.valid, true);
  assert.equal(validLow.laneMode, 'exclusive');
  assert.equal(validLow.staggerSec, 5);

  const invalidMode = validateProductRefLaneSettings({
    webhook_product_ref_lane_mode: 'turbo_yolo',
    webhook_product_ref_stagger_sec: 12
  });
  assert.equal(invalidMode.valid, false);
  assert.ok(invalidMode.errors.length > 0);

  const invalidSec = validateProductRefLaneSettings({
    webhook_product_ref_stagger_sec: 'abc'
  });
  assert.equal(invalidSec.valid, false);
});

test('runStaggeredT2iBatch submits sequentially via stagger gate with skipDelay=true and polls in parallel', async () => {
  const events = [];
  const pollCounts = new Map();

  const summary = await runStaggeredT2iBatch({
    tasks: [
      { clipIndex: 1, laneKey: 'lane_x', providerRequest: { prompt: 'clip 1' } },
      { clipIndex: 2, laneKey: 'lane_x', providerRequest: { prompt: 'clip 2' } }
    ],
    staggerSec: 12,
    pollIntervalMs: 1,
    maxAttempts: 5,
    sleepFn: async () => {},
    waitSlotFn: async (laneKey, sec) => {
      events.push(`slot:${laneKey}:${sec}`);
      return { allowed: true };
    },
    generateImageFn: async (req) => {
      events.push(`submit:${req.prompt}:skipDelay=${req.skipDelay}`);
      return { task_id: `task_${req.prompt.replace(/\s+/g, '_')}` };
    },
    getTaskStatusFn: async (taskId) => {
      const n = (pollCounts.get(taskId) || 0) + 1;
      pollCounts.set(taskId, n);
      if (taskId === 'task_clip_2' && n >= 1) {
        return { status: 'completed', results: ['clip2.png'] };
      }
      if (taskId === 'task_clip_1' && n >= 2) {
        return { status: 'completed', results: ['clip1.png'] };
      }
      return { status: 'pending' };
    },
    onCompleted: async ({ task, files }) => {
      events.push(`done:${task.clipIndex}:${files[0]}`);
    }
  });

  assert.equal(summary.length, 2);
  assert.ok(summary.every(s => s.completed));
  assert.deepEqual(events.slice(0, 4), [
    'slot:lane_x:12',
    'submit:clip 1:skipDelay=true',
    'slot:lane_x:12',
    'submit:clip 2:skipDelay=true'
  ]);
  assert.equal(events[4], 'done:2:clip2.png');
  assert.equal(events[5], 'done:1:clip1.png');
});

test('approvePillarCampaignItem clears scheduler_pause_at=tts and allows TTS scheduler progression', async () => {
  const campId = `camp_tts_gate_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
  let itemId = null;

  await tenantContext.run(TENANT, async () => {
    try {
      await pgQuery(
        `INSERT INTO pillar_campaigns
          (id, tenant_id, campaign_name, content_pillar, custom_hook, visual_action_guideline, status, execution_mode, approval_mode, scheduler_pause_at, enable_tts)
         VALUES ($1, $2, 'Test TTS Pause Release', 'edukasi', 'hook', 'visual', 'waiting_approval', 'manual_review', 'creative', 'tts', 1)`,
        [campId, TENANT]
      );
      const insertedItem = await pgQuery(
        `INSERT INTO pillar_campaign_items
          (campaign_id, generation_status, start_frame_status, tts_status, workflow_status, review_state, review_revision, result_json, new_video_plan_json)
         VALUES ($1, 'completed', 'completed', 'pending', 'ready_for_review', 'ready', 'rev_tts_1', '{}', '[]')
         RETURNING id`,
        [campId]
      );
      itemId = insertedItem.rows[0].id;

      await approvePillarCampaignItem(itemId, {
        new_video_plan: [{ clip_index: 1, new_vo: 'Narasi uji coba', t2i_prompt: 'Prompt uji coba' }],
        review_revision: 'rev_tts_1'
      });

      const campAfter = (await pgQuery(`SELECT status, scheduler_pause_at FROM pillar_campaigns WHERE id = $1`, [campId])).rows[0];
      const itemAfter = (await pgQuery(`SELECT review_state, workflow_status, tts_status FROM pillar_campaign_items WHERE id = $1`, [itemId])).rows[0];

      assert.equal(campAfter.scheduler_pause_at, null, 'approvePillarCampaignItem must clear scheduler_pause_at=tts');
      assert.equal(campAfter.status, 'running');
      assert.equal(itemAfter.review_state, 'approved');
      assert.equal(itemAfter.tts_status, 'pending');
      assert.equal(shouldPauseBeforeTts(campAfter.scheduler_pause_at, itemAfter.review_state), false);
      assert.equal(shouldPauseBeforeTts('tts', itemAfter.review_state), false, 'Scheduler must not hold approved item even if pauseAt is tts');
    } finally {
      if (itemId) {
        await pgQuery(`DELETE FROM pillar_campaign_items WHERE id = $1`, [itemId]).catch(() => {});
      }
      await pgQuery(`DELETE FROM pillar_campaigns WHERE id = $1`, [campId]).catch(() => {});
    }
  });
});
