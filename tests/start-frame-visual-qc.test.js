process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  START_FRAME_QC_MAX_RETRIES,
  resolveStartFrameQcMode,
  buildStartFrameQcPrompt,
  evaluateQcChecklistVerdict,
  deriveQcContext,
  inspectStartFrameFile,
  appendPositiveQcCorrectionHint,
  mergeStartFrameQcTelemetry
} from '../lib/start-frame-visual-qc.js';

after(() => {
  setTimeout(() => process.exit(0), 50);
});

test('Part G1: resolveStartFrameQcMode default off, validasi mode ketat & tanpa kredensial di prompt QC', () => {
  assert.equal(resolveStartFrameQcMode(null), 'off');
  assert.equal(resolveStartFrameQcMode(undefined), 'off');
  assert.equal(resolveStartFrameQcMode('invalid_mode'), 'off');
  assert.equal(resolveStartFrameQcMode('report_only'), 'report_only');
  assert.equal(resolveStartFrameQcMode('ENFORCE'), 'enforce');

  const promptPre = buildStartFrameQcPrompt({
    clipIndex: 1,
    totalClips: 6,
    isPreBridge: true,
    expectsProduct: false,
    expectsObjectOnly: true,
    handsPolicy: 'modest_hands_active',
    objectWorld: 'A clear glass bowl of oily soup on ceramic counter'
  });
  assert.ok(promptPre.includes('hand_count MUST be 0'));
  assert.ok(promptPre.includes('PRE-BRIDGE FRAME'));
  assert.ok(!/AIza|password|secret|Bearer/i.test(promptPre));
});

test('Part G2: evaluateQcChecklistVerdict mendeteksi extra hands, Clip 1 hands, bare arm, visible face, pre-bridge bottle, foreign objects & garbled text', () => {
  // Clean pass on Clip 1 object-only
  const cleanClip1 = evaluateQcChecklistVerdict({
    hand_count: 0,
    awkward_anatomy: false,
    visible_face: false,
    exposed_forearm: false,
    pre_bridge_product: false,
    foreign_objects: false,
    weird_text_watermark: false,
    metaphor_alignment_score: 0.92,
    reasons: [],
    correction_hint: ''
  }, { expectsObjectOnly: true, isPreBridge: true, handsPolicy: 'modest_hands_active' });
  assert.equal(cleanClip1.pass, true);
  assert.equal(cleanClip1.reasons.length, 0);

  // Fail: Clip 1 has hands
  const clip1WithHands = evaluateQcChecklistVerdict({
    hand_count: 1,
    awkward_anatomy: false,
    visible_face: false,
    exposed_forearm: false,
    pre_bridge_product: false,
    foreign_objects: false,
    weird_text_watermark: false,
    metaphor_alignment_score: 0.8,
    reasons: []
  }, { expectsObjectOnly: true, isPreBridge: true, handsPolicy: 'modest_hands_active' });
  assert.equal(clip1WithHands.pass, false);
  assert.ok(clip1WithHands.reasons.some(r => /hand/i.test(r)));

  // Fail: Clip 2 has >2 hands, bare forearm & pre-bridge bottle
  const clip2MultiDefect = evaluateQcChecklistVerdict({
    hand_count: 3,
    awkward_anatomy: true,
    visible_face: false,
    exposed_forearm: true,
    pre_bridge_product: true,
    foreign_objects: false,
    weird_text_watermark: false,
    metaphor_alignment_score: 0.5,
    reasons: []
  }, { expectsObjectOnly: false, isPreBridge: true, handsPolicy: 'modest_hands_active' });
  assert.equal(clip2MultiDefect.pass, false);
  assert.ok(clip2MultiDefect.reasons.length >= 4);

  // Fail: Low metaphor alignment score
  const driftedClip = evaluateQcChecklistVerdict({
    hand_count: 2,
    awkward_anatomy: false,
    visible_face: false,
    exposed_forearm: false,
    pre_bridge_product: false,
    foreign_objects: true,
    weird_text_watermark: false,
    metaphor_alignment_score: 0.35,
    reasons: []
  }, { expectsObjectOnly: false, isPreBridge: false, handsPolicy: 'modest_hands_active' });
  assert.equal(driftedClip.pass, false);
});

test('Part G3: inspectStartFrameFile skip saat off, jalan saat report_only/enforce & graceful fallback saat API error', async () => {
  const tmpFile = path.join(os.tmpdir(), `qc_test_${Date.now()}.png`);
  // Minimal PNG header bytes
  fs.writeFileSync(tmpFile, Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]));
  try {
    let called = 0;
    const skippedRes = await inspectStartFrameFile({
      imagePath: tmpFile,
      mode: 'off',
      visionFn: async () => { called += 1; return '{}'; }
    });
    assert.equal(skippedRes.skipped, true);
    assert.equal(skippedRes.pass, true);
    assert.equal(called, 0, 'QC off mode must make zero Vision calls');

    const enforceRes = await inspectStartFrameFile({
      imagePath: tmpFile,
      mode: 'enforce',
      clipIndex: 1,
      campaign: { visual_style: 'metaphoric_faceless', is_bridging_active: 1, bridge_at_clip: 3, target_clips_count: 6 },
      visionFn: async () => {
        called += 1;
        return JSON.stringify({
          hand_count: 1,
          awkward_anatomy: false,
          visible_face: false,
          exposed_forearm: true,
          pre_bridge_product: false,
          foreign_objects: false,
          weird_text_watermark: false,
          metaphor_alignment_score: 0.65,
          reasons: ['Bare arm holding cup in Clip 1'],
          correction_hint: 'tight macro framing focusing purely on unattended cup on clean wooden table'
        });
      }
    });
    assert.equal(called, 1);
    assert.equal(enforceRes.pass, false);
    assert.equal(enforceRes.mode, 'enforce');
    assert.ok(enforceRes.correction_hint.includes('tight macro'));

    // Non-fatal fallback on Vision exception
    const errRes = await inspectStartFrameFile({
      imagePath: tmpFile,
      mode: 'enforce',
      visionFn: async () => { throw new Error('Simulated 429 quota error'); }
    });
    assert.equal(errRes.skipped, true);
    assert.equal(errRes.pass, true);
    assert.match(errRes.error, /429/);
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
});

test('Part G4: retry hint positive hygiene + telemetry counter calls/retries/needs_review akurat', () => {
  assert.equal(START_FRAME_QC_MAX_RETRIES, 2);

  const hint1 = appendPositiveQcCorrectionHint('(VERTICAL 9:16) Carpet closeup', 'focus closely on plush fibers only');
  const hint2 = appendPositiveQcCorrectionHint(hint1, 'bright overhead lamp across fibers');
  assert.equal((hint2.match(/\[QC REFINEMENT:/g) || []).length, 1, 'Retry hint must replace previous hint cleanly without bloating');

  let rJson = {};
  rJson = mergeStartFrameQcTelemetry(rJson, {
    mode: 'enforce',
    clipIndex: 1,
    verdict: { pass: false, reasons: ['Hand detected in Clip 1'], correction_hint: 'macro focus on bowl' },
    attempt: 1,
    isRetry: false,
    needsReview: false
  });
  rJson = mergeStartFrameQcTelemetry(rJson, {
    mode: 'enforce',
    clipIndex: 1,
    verdict: { pass: true, reasons: [], correction_hint: '' },
    attempt: 2,
    isRetry: true,
    needsReview: false
  });
  rJson = mergeStartFrameQcTelemetry(rJson, {
    mode: 'enforce',
    clipIndex: 3,
    verdict: { pass: false, reasons: ['Awkward finger geometry'], correction_hint: 'calm two-hand hold' },
    attempt: 3,
    isRetry: true,
    needsReview: true
  });

  assert.equal(rJson.start_frame_qc.calls, 3);
  assert.equal(rJson.start_frame_qc.retries, 2);
  assert.equal(rJson.start_frame_qc.passed_count, 1);
  assert.equal(rJson.start_frame_qc.failed_count, 1);
  assert.deepEqual(rJson.start_frame_qc.needs_review_clips, [3]);

  const ctxHero = deriveQcContext({
    campaign: {
      visual_style: 'metaphoric_faceless',
      product_id: 'p1',
      is_bridging_active: 1,
      bridge_at_clip: 3,
      bridge_duration_clips: 1,
      target_clips_count: 6,
      resolved_metaphor_policy: { active: true, productEntry: 'inside_metaphor', handsPolicy: 'modest_hands_active' }
    },
    clipIndex: 6
  });
  assert.equal(ctxHero.expectsProduct, true);
  assert.equal(ctxHero.isPreBridge, false);
});

