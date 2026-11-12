import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_BRIDGE_SEGMENTS,
  normalizeBridgeSegments,
  readBridgeInputs,
  resolveBridgePlan,
  describeBridgePlan,
  formatProductClipRanges
} from '../lib/bridging/bridge-plan.js';
import { buildBridgeZoningContract } from '../lib/bridging/bridge-prompt-zones.js';

test('Legacy single-segment fields match old formulas: N=2 X=1, N=3 X=2, N=2 X=0', () => {
  const planA = resolveBridgePlan({ targetClips: 4, isBridgingActive: true, bridgeAtClip: 2, bridgeDurationClips: 1 });
  assert.equal(planA.active, true);
  assert.deepEqual(planA.productClips, [2]);
  assert.equal(planA.firstBridgeClip, 2);
  assert.equal(planA.zoneOf(1), 'pre');
  assert.equal(planA.zoneOf(2), 'intro');
  assert.equal(planA.zoneOf(3), 'post');
  assert.equal(planA.zoneOf(4), 'post');
  assert.deepEqual(planA.legacy, { bridge_at_clip: 2, bridge_duration_clips: 1 });

  const planB = resolveBridgePlan({ targetClips: 6, isBridgingActive: true, bridgeAtClip: 3, bridgeDurationClips: 2 });
  assert.deepEqual(planB.productClips, [3, 4]);
  assert.equal(planB.zoneOf(1), 'pre');
  assert.equal(planB.zoneOf(2), 'pre');
  assert.equal(planB.zoneOf(3), 'intro');
  assert.equal(planB.zoneOf(4), 'intro');
  assert.equal(planB.zoneOf(5), 'post');
  assert.equal(planB.zoneOf(6), 'post');

  const planC = resolveBridgePlan({ targetClips: 6, isBridgingActive: true, bridgeAtClip: 2, bridgeDurationClips: 0 });
  assert.deepEqual(planC.productClips, [2, 3, 4, 5, 6]);
  assert.equal(planC.zoneOf(1), 'pre');
  assert.equal(planC.zoneOf(2), 'intro');
  assert.equal(planC.zoneOf(6), 'intro');
  assert.deepEqual(planC.legacy, { bridge_at_clip: 2, bridge_duration_clips: 0 });
});

test('Multi-segment [2/1, 6/1] on 7 clips resolves pre(1) intro(2) gap(3-5) recall(6) post(7)', () => {
  const plan = resolveBridgePlan({
    targetClips: 7,
    isBridgingActive: true,
    segments: [
      { at_clip: 2, duration_clips: 1, role: 'intro' },
      { at_clip: 6, duration_clips: 1, role: 'recall' }
    ]
  });

  assert.equal(plan.active, true);
  assert.deepEqual(plan.productClips, [2, 6]);
  assert.equal(plan.isProductClip(1), false);
  assert.equal(plan.isProductClip(2), true);
  assert.equal(plan.isProductClip(4), false);
  assert.equal(plan.isProductClip(6), true);
  assert.equal(plan.isSegmentStart(2), true);
  assert.equal(plan.isSegmentStart(6), true);
  assert.equal(plan.zoneOf(1), 'pre');
  assert.equal(plan.zoneOf(2), 'intro');
  assert.equal(plan.zoneOf(3), 'gap');
  assert.equal(plan.zoneOf(4), 'gap');
  assert.equal(plan.zoneOf(5), 'gap');
  assert.equal(plan.zoneOf(6), 'recall');
  assert.equal(plan.zoneOf(7), 'post');
  assert.deepEqual(
    plan.zones.map(z => ({ zone: z.zone, start: z.start, end: z.end })),
    [
      { zone: 'pre', start: 1, end: 1 },
      { zone: 'intro', start: 2, end: 2 },
      { zone: 'gap', start: 3, end: 5 },
      { zone: 'recall', start: 6, end: 6 },
      { zone: 'post', start: 7, end: 7 }
    ]
  );
  assert.equal(describeBridgePlan(plan), 'Klip 2, 6');
  assert.equal(formatProductClipRanges(plan, { style: 'prose' }), 'Klip 2 dan 6');
});

test('Validation: adjacent segments auto-merge, overlapping flagged, out-of-order sorted', () => {
  // Out-of-order + adjacent: {at_clip: 3, duration: 1} and {at_clip: 2, duration: 1}
  const adj = normalizeBridgeSegments(
    [
      { at_clip: 3, duration_clips: 1, role: 'recall' },
      { at_clip: 2, duration_clips: 1, role: 'intro' },
      { at_clip: 6, duration_clips: 1, role: 'recall' }
    ],
    7
  );
  assert.equal(adj.errors.length, 0);
  assert.equal(adj.segments.length, 2);
  assert.equal(adj.segments[0].start, 2);
  assert.equal(adj.segments[0].end, 3);
  assert.equal(adj.segments[0].role, 'intro');
  assert.equal(adj.segments[1].start, 6);
  assert.equal(adj.segments[1].role, 'recall');
  assert.ok(adj.warnings.some(w => w.includes('digabung otomatis')));

  // Overlapping rejected in errors list
  const overlap = normalizeBridgeSegments(
    [
      { at_clip: 2, duration_clips: 3, role: 'intro' },
      { at_clip: 4, duration_clips: 1, role: 'recall' }
    ],
    7
  );
  assert.ok(overlap.errors.some(e => e.includes('tumpang tindih')));
});

test('Validation: duration 0 on non-last segment produces validation error, valid on last segment', () => {
  const bad = normalizeBridgeSegments(
    [
      { at_clip: 2, duration_clips: 0, role: 'intro' },
      { at_clip: 6, duration_clips: 1, role: 'recall' }
    ],
    7
  );
  assert.ok(bad.errors.some(e => e.includes('durasi 0')));
  // Runtime clamped safely to 1 clip so second segment still runs
  assert.equal(bad.segments.length, 2);
  assert.equal(bad.segments[0].end, 2);

  const okTail = normalizeBridgeSegments(
    [
      { at_clip: 2, duration_clips: 1, role: 'intro' },
      { at_clip: 5, duration_clips: 0, role: 'recall' }
    ],
    7
  );
  assert.equal(okTail.errors.length, 0);
  assert.equal(okTail.segments[1].start, 5);
  assert.equal(okTail.segments[1].end, 7);
});

test('Validation: truncates overflowing duration, drops out-of-range segments, caps at 3', () => {
  const norm = normalizeBridgeSegments(
    [
      { at_clip: 1, duration_clips: 1, role: 'intro' },
      { at_clip: 3, duration_clips: 1, role: 'recall' },
      { at_clip: 5, duration_clips: 5, role: 'recall' },
      { at_clip: 9, duration_clips: 1, role: 'recall' }
    ],
    6
  );
  assert.ok(norm.warnings.some(w => w.includes(`Maksimal ${MAX_BRIDGE_SEGMENTS}`)));
  assert.equal(norm.segments.length, 3);
  assert.equal(norm.segments[2].end, 6);

  const dropOut = normalizeBridgeSegments(
    [
      { at_clip: 2, duration_clips: 1, role: 'intro' },
      { at_clip: 9, duration_clips: 1, role: 'recall' }
    ],
    6
  );
  assert.equal(dropOut.segments.length, 1);
  assert.ok(dropOut.warnings.some(w => w.includes('dibuang')));
});

test('Inactive bridging yields empty productClips and all clips in pre zone', () => {
  const plan = resolveBridgePlan({
    targetClips: 6,
    isBridgingActive: false,
    segments: [{ at_clip: 2, duration_clips: 1, role: 'intro' }]
  });
  assert.equal(plan.active, false);
  assert.deepEqual(plan.productClips, []);
  for (let c = 1; c <= 6; c++) {
    assert.equal(plan.isProductClip(c), false);
    assert.equal(plan.zoneOf(c), 'pre');
  }
  assert.equal(describeBridgePlan(plan), 'Nonaktif');
});

test('readBridgeInputs normalizes snake_case and camelCase equivalently', () => {
  const snakePlan = resolveBridgePlan(readBridgeInputs({
    target_clips_count: 7,
    is_bridging_active: 1,
    bridge_at_clip: 2,
    bridge_duration_clips: 1,
    bridge_segments: JSON.stringify([
      { at_clip: 2, duration_clips: 1, role: 'intro' },
      { at_clip: 6, duration_clips: 1, role: 'recall' }
    ])
  }));
  const camelPlan = resolveBridgePlan(readBridgeInputs({
    targetClipsCount: 7,
    isBridgingActive: true,
    bridgeAtClip: 2,
    bridgeDurationClips: 1,
    bridgeSegments: [
      { atClip: 2, durationClips: 1, role: 'intro' },
      { atClip: 6, durationClips: 1, role: 'recall' }
    ]
  }));
  assert.deepEqual(snakePlan.productClips, camelPlan.productClips);
  assert.deepEqual(snakePlan.zones, camelPlan.zones);
});

test('buildBridgeZoningContract emits multi-segment PRE -> INTRO -> GAP -> RECALL -> POST rules', () => {
  const plan = resolveBridgePlan({
    targetClips: 7,
    isBridgingActive: true,
    segments: [
      { at_clip: 2, duration_clips: 1, role: 'intro' },
      { at_clip: 6, duration_clips: 1, role: 'recall' }
    ]
  });
  const contract = buildBridgeZoningContract(plan, {
    mode: 'multiplier',
    productName: 'GarliBee',
    productUsp: 'Madu fermentasi alami',
    mandatoryOutroLine: 'Cek keranjang kuning sekarang.'
  });
  assert.ok(contract.includes('ZONA PRE-BRIDGING (Klip #1)'));
  assert.ok(contract.includes('ZONA INTRO PRODUK'));
  assert.ok(contract.includes('ZONA GAP / JEDA CERITA MURNI (KLIP #3 s.d. KLIP #5'));
  assert.ok(contract.includes('ZONA RECALL PRODUK'));
  assert.ok(contract.includes('DILARANG MEMPERKENALKAN ULANG'));
  assert.ok(contract.includes('ZONA POST-BRIDGING / PENUTUP (Klip #7)'));
  assert.ok(contract.includes('Cek keranjang kuning sekarang.'));
});

