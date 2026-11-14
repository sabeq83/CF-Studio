process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  START_FRAME_QC_BATCH_SETTING_KEY,
  resolveStartFrameQcBatchMode,
  isStartFrameQcBatchEnabled,
  deriveQcContext,
  buildStartFrameQcPrompt,
  buildStartFrameBatchQcPrompt,
  evaluateQcChecklistVerdict,
  evaluateBatchStartFramesQc,
  evaluateStartFrameRetryWithReference,
  mergeBatchStartFrameQcTelemetry,
  compareBatchVsPerClipQc
} from '../lib/start-frame-visual-qc.js';

after(() => {
  setTimeout(() => process.exit(0), 50);
});

function createTempImages(count = 6) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'k7-qc-'));
  const entries = [];
  const fakePng = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
  for (let i = 1; i <= count; i++) {
    const filePath = path.join(dir, `clip_${i}.png`);
    fs.writeFileSync(filePath, fakePng);
    entries.push({ clipIndex: i, imagePath: filePath });
  }
  return { dir, entries };
}

test('K7.9: start_frame_visual_qc_batch defaults off and supports shadow & on modes', () => {
  assert.equal(START_FRAME_QC_BATCH_SETTING_KEY, 'start_frame_visual_qc_batch');
  assert.equal(resolveStartFrameQcBatchMode('off'), 'off');
  assert.equal(resolveStartFrameQcBatchMode('shadow'), 'shadow');
  assert.equal(resolveStartFrameQcBatchMode('on'), 'on');
  assert.equal(isStartFrameQcBatchEnabled('off'), false);
  assert.equal(isStartFrameQcBatchEnabled('shadow'), true);
  assert.equal(isStartFrameQcBatchEnabled('on'), true);
});

test('K7.9: evaluateBatchStartFramesQc audits 6 clips in 1 Vision call, flags wardrobe/location outliers, and supports safe fallback', async () => {
  const { dir, entries } = createTempImages(6);
  try {
    const campaign = {
      id: 50,
      is_bridging_active: 1,
      bridge_at_clip: 4,
      bridge_duration_clips: 2,
      target_clips_count: 6,
      product_name: 'Garlibee',
      resolved_scene_brief: {
        environment_policy: 'planner_driven',
        location_en: 'Indonesian home kitchen counter',
        time_key: 'night',
        props: ['ceramic cup', 'wooden spoon']
      },
      resolved_metaphor_policy: {
        active: true,
        mode: 'hook_only',
        environmentPolicy: 'planner_driven',
        handsPolicy: 'modest_hands_active'
      }
    };
    const item = {
      id: 2133,
      result_json: JSON.stringify({
        resolved_wardrobe_color: { key: 'sage', label: 'Deep Sage Linen' },
        resolved_scene_brief: campaign.resolved_scene_brief,
        resolved_metaphor_policy: campaign.resolved_metaphor_policy
      })
    };

    let visionCalls = 0;
    const res = await evaluateBatchStartFramesQc({
      clipEntries: entries,
      campaign,
      item,
      mode: 'enforce',
      visionFn: async (images) => {
        visionCalls += 1;
        assert.equal(images.length, 6);
        return JSON.stringify({
          clips: [1, 2, 3, 4, 5, 6].map(idx => ({
            clip_index: idx,
            hand_count: idx === 1 ? 0 : 2,
            awkward_anatomy: false,
            visible_face: false,
            exposed_forearm: false,
            wardrobe_color_match: idx !== 3,
            pre_bridge_product: false,
            foreign_objects: false,
            weird_text_watermark: false,
            time_of_day_mismatch: idx === 2,
            metaphor_alignment_score: 0.9,
            reasons: [],
            correction_hint: idx === 3 ? 'wear solid Deep Sage Linen long sleeves matching sibling clips' : ''
          })),
          cross_clip_consistency: {
            wardrobe_color_same_all_clips: false,
            wardrobe_outlier_clips: [3],
            location_consistent: true,
            location_outlier_clips: [],
            consistency_notes: 'Clip 3 switched sleeve color'
          }
        });
      }
    });

    assert.equal(visionCalls, 1);
    assert.equal(res.ok, true);
    assert.equal(res.callsUsed, 1);
    assert.equal(res.verdictsByClip[1].pass, true);
    assert.equal(res.verdictsByClip[2].pass, true); // time_of_day_mismatch is report_only
    assert.equal(res.verdictsByClip[2].metrics.time_of_day_mismatch, true);
    assert.equal(res.verdictsByClip[3].pass, false);
    assert.equal(res.verdictsByClip[3].metrics.wardrobe_mismatch, true);
    assert.equal(res.verdictsByClip[4].pass, true);

    const telemetry = mergeBatchStartFrameQcTelemetry({}, {
      mode: 'enforce',
      verdictsByClip: res.verdictsByClip,
      crossClipConsistency: res.crossClipConsistency,
      callsUsed: res.callsUsed
    });
    assert.equal(telemetry.start_frame_qc.batch_enabled, true);
    assert.equal(telemetry.start_frame_qc.calls, 1);
    assert.equal(telemetry.start_frame_qc.passed_count, 5);
    assert.equal(telemetry.start_frame_qc.failed_count, 1);

    // Fallback check on Vision failure
    const failRes = await evaluateBatchStartFramesQc({
      clipEntries: entries,
      campaign,
      item,
      mode: 'enforce',
      visionFn: async () => {
        throw new Error('429 rate limit');
      }
    });
    assert.equal(failRes.ok, false);
    assert.equal(failRes.fallbackRequired, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('K7.9: evaluateStartFrameRetryWithReference compares retried clip against passing reference clip', async () => {
  const { dir, entries } = createTempImages(4);
  try {
    let seenImages = 0;
    const verdict = await evaluateStartFrameRetryWithReference({
      clipIndex: 3,
      imagePath: entries[2].imagePath,
      referenceClipIndex: 2,
      referenceClipPath: entries[1].imagePath,
      campaign: {
        resolved_metaphor_policy: { active: true, handsPolicy: 'modest_hands_active', mode: 'hook_only' }
      },
      item: {
        id: 2139,
        result_json: JSON.stringify({
          resolved_wardrobe_color: { key: 'navy', label: 'Deep Navy Cotton' }
        })
      },
      mode: 'enforce',
      visionFn: async (images, prompt) => {
        seenImages = images.length;
        assert.ok(prompt.includes('Passing Reference Clip #2'));
        return JSON.stringify({
          hand_count: 2,
          awkward_anatomy: false,
          visible_face: false,
          exposed_forearm: false,
          wardrobe_color_match: true,
          pre_bridge_product: false,
          foreign_objects: false,
          weird_text_watermark: false,
          metaphor_alignment_score: 0.92,
          reasons: [],
          correction_hint: ''
        });
      }
    });

    assert.equal(seenImages, 2);
    assert.equal(verdict.compared_against_clip, 2);
    assert.equal(verdict.pass, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('K7.9: compareBatchVsPerClipQc computes shadow diff across #2133, #2139, #2140 fixtures', () => {
  const perClip = {
    '1': { pass: true, reasons: [] },
    '2': { pass: true, reasons: [] },
    '3': { pass: true, reasons: [] }, // single-clip missed outlier wardrobe on #2139
    '4': { pass: true, reasons: [] },
    '5': { pass: false, reasons: ['Awkward hand anatomy'] },
    '6': { pass: true, reasons: [] }
  };
  const batch = {
    '1': { pass: true, reasons: [] },
    '2': { pass: true, reasons: [] },
    '3': { pass: false, reasons: ['wardrobe_mismatch: differs from sibling clips'] },
    '4': { pass: true, reasons: [] },
    '5': { pass: false, reasons: ['Awkward hand anatomy'] },
    '6': { pass: true, reasons: [] }
  };

  const diff = compareBatchVsPerClipQc({ perClipVerdicts: perClip, batchVerdicts: batch });
  assert.equal(diff.clips_compared, 6);
  assert.equal(diff.agreement_count, 5);
  assert.equal(diff.disagreement_count, 1);
  assert.equal(diff.disagreements[0].clip_index, 3);
});

test('K7.7 & K7.5: Planner-Driven QC Rubric accepts planned home room props & background screen faces while blocking foreground defects', () => {
  const campaign = {
    is_bridging_active: 1,
    bridge_at_clip: 4,
    bridge_duration_clips: 2,
    target_clips_count: 6,
    resolved_scene_brief: {
      environment_policy: 'planner_driven',
      location_en: 'Indonesian family living room with TV console and wall frames',
      time_key: 'night',
      props: ['ceramic cup', 'warm indoor bedside or table lamp', 'opaque drawn dark night curtains']
    },
    resolved_metaphor_policy: {
      active: true,
      mode: 'hook_only',
      environmentPolicy: 'planner_driven',
      handsPolicy: 'modest_hands_active'
    }
  };
  const ctxClip2 = deriveQcContext({
    campaign,
    item: { id: 2140, result_json: JSON.stringify({ resolved_scene_brief: campaign.resolved_scene_brief, resolved_wardrobe_color: { key: 'sage', label: 'Deep Sage Linen' } }) },
    clipIndex: 2
  });
  assert.equal(ctxClip2.environmentPolicy, 'planner_driven');
  const prompt = buildStartFrameQcPrompt(ctxClip2);
  assert.ok(prompt.includes('framed wall photos, TV screens, or laptop screens'));
  assert.ok(prompt.includes('NEVER mark them as foreign_objects'));
  assert.ok(prompt.includes('time_of_day_mismatch (report_only)'));

  const batchPrompt = buildStartFrameBatchQcPrompt({ clipContexts: [ctxClip2], campaign, item: {} });
  assert.ok(batchPrompt.includes('PLANNER_DRIVEN_ROOM'));

  // Clean frame with report_only time_of_day_mismatch passes QC enforce while logging warning
  const nightReportVerdict = evaluateQcChecklistVerdict({
    hand_count: 2,
    awkward_anatomy: false,
    visible_face: false,
    exposed_forearm: false,
    wardrobe_color_match: true,
    pre_bridge_product: false,
    foreign_objects: false,
    weird_text_watermark: false,
    time_of_day_mismatch: true,
    metaphor_alignment_score: 0.88,
    reasons: []
  }, ctxClip2);
  assert.equal(nightReportVerdict.pass, true);
  assert.equal(nightReportVerdict.metrics.time_of_day_mismatch, true);
  assert.ok(nightReportVerdict.reasons.some(r => r.includes('time_of_day_mismatch')));

  // Exposed forearm still fails strictly
  const failForearm = evaluateQcChecklistVerdict({
    hand_count: 2,
    awkward_anatomy: false,
    visible_face: false,
    exposed_forearm: true,
    wardrobe_color_match: true,
    pre_bridge_product: false,
    foreign_objects: false,
    weird_text_watermark: false,
    metaphor_alignment_score: 0.85,
    reasons: []
  }, ctxClip2);
  assert.equal(failForearm.pass, false);
});

