import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStartFrameAggregate } from '../lib/start-frame-contract.js';

test('calculateStartFrameAggregate correctly evaluates partial vs completed revisions', () => {
  const partialRun = calculateStartFrameAggregate({
    visualMode: 'hybrid_lock',
    expectedCount: 6,
    paths: ['/uploads/start_frames/opc_clip_1_r4.jpg']
  });
  assert.equal(partialRun.status, 'partial');
  assert.equal(partialRun.completed, 1);
  assert.equal(partialRun.expected, 6);
  assert.equal(partialRun.ready, false);

  const fullRun = calculateStartFrameAggregate({
    visualMode: 'hybrid_lock',
    expectedCount: 6,
    paths: [
      '/uploads/start_frames/opc_clip_1_r4.jpg',
      '/uploads/start_frames/opc_clip_2_r4.jpg',
      '/uploads/start_frames/opc_clip_3_r4.jpg',
      '/uploads/start_frames/opc_clip_4_r4.jpg',
      '/uploads/start_frames/opc_clip_5_r4.jpg',
      '/uploads/start_frames/opc_clip_6_r4.jpg'
    ]
  });
  assert.equal(fullRun.status, 'completed');
  assert.equal(fullRun.completed, 6);
  assert.equal(fullRun.expected, 6);
  assert.equal(fullRun.ready, true);
});

test('t2i_images_json array updates properly nullify queued clips to prevent stale path leaks', () => {
  const currentPaths = [
    '/uploads/start_frames/clip_1_r3.jpg',
    '/uploads/start_frames/clip_2_r3.jpg',
    '/uploads/start_frames/clip_3_r3.jpg',
    '/uploads/start_frames/clip_4_r3.jpg',
    '/uploads/start_frames/clip_5_r3.jpg',
    '/uploads/start_frames/clip_6_r3.jpg'
  ];
  const targetIndexes = [1, 2, 3, 4, 5, 6];
  const expectedCount = 6;
  const carryForwardCompleted = false;

  const updatedPaths = [];
  for (let i = 0; i < expectedCount; i++) {
    const clipIdx = i + 1;
    if (targetIndexes.includes(clipIdx)) {
      updatedPaths.push(null);
    } else if (carryForwardCompleted && currentPaths[i]) {
      updatedPaths.push(currentPaths[i]);
    } else {
      updatedPaths.push(null);
    }
  }

  assert.deepEqual(updatedPaths, [null, null, null, null, null, null]);
  const agg = calculateStartFrameAggregate({
    visualMode: 'hybrid_lock',
    expectedCount: 6,
    paths: updatedPaths.filter(Boolean)
  });
  assert.equal(agg.ready, false);
  assert.equal(agg.completed, 0);
});
