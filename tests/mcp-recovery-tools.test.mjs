import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  IN_PROGRESS_STUCK_STATUSES,
  resolveMultiplierStageRetryTarget,
} from '../lib/multiplier-artifacts.js';
import { getContentAutomationNotificationRuntime } from '../lib/content-automation-notification-worker.js';

function loadGetContentAutomationRuntimeWithState(state) {
  const src = fs.readFileSync(path.join(process.cwd(), 'lib/content-automation-worker.js'), 'utf8');
  const match = src.match(/export function getContentAutomationRuntime\(\)[^\n]*/);
  assert.ok(match, 'getContentAutomationRuntime function must exist');
  const fnSource = match[0].replace(/^export\s+/, '');
  const context = { state };
  vm.runInNewContext(`${fnSource}; this.fn = getContentAutomationRuntime;`, context);
  return context.fn;
}

test('resolveMultiplierStageRetryTarget maps stages and enforces artifact prerequisites', () => {
  const baseTask = { id: 'mul_test_1', status: 'failed' };

  const ttsTarget = resolveMultiplierStageRetryTarget(baseTask, 'tts', []);
  assert.equal(ttsTarget.ok, true);
  assert.equal(ttsTarget.nextStatus, 'generating_audio');

  const t2iTarget = resolveMultiplierStageRetryTarget(baseTask, 't2i', []);
  assert.equal(t2iTarget.ok, true);
  assert.equal(t2iTarget.nextStatus, 'generating_t2i');

  const ffmpegRejected = resolveMultiplierStageRetryTarget(baseTask, 'ffmpeg', []);
  assert.equal(ffmpegRejected.ok, false);
  assert.equal(ffmpegRejected.statusCode, 409);

  const cloudRejected = resolveMultiplierStageRetryTarget(baseTask, 'cloud', []);
  assert.equal(cloudRejected.ok, false);
  assert.equal(cloudRejected.statusCode, 409);

  const invalidStage = resolveMultiplierStageRetryTarget(baseTask, 'unknown_stage', []);
  assert.equal(invalidStage.ok, false);
  assert.equal(invalidStage.statusCode, 400);

  assert.equal(IN_PROGRESS_STUCK_STATUSES.has('generating_t2i'), true);
  assert.equal(IN_PROGRESS_STUCK_STATUSES.has('completed'), false);
  assert.equal(IN_PROGRESS_STUCK_STATUSES.has('waiting_approval'), false);
});

test('runtime getters strip circular Timeout/interval objects so JSON.stringify succeeds', () => {
  const circularTimer = { _idlePrev: null };
  circularTimer._idleNext = circularTimer;

  const getAutoRuntime = loadGetContentAutomationRuntimeWithState({
    interval: circularTimer,
    running: false,
    lastTick: '2026-11-25T12:00:00.000Z',
    lastError: null,
  });

  const prevNotif = globalThis.__contentAutomationNotificationWorker;
  try {
    prevNotif.interval = circularTimer;
    prevNotif.lastTick = '2026-11-25T12:00:01.000Z';

    const autoRuntime = getAutoRuntime();
    const notifRuntime = getContentAutomationNotificationRuntime();

    assert.equal(autoRuntime.running, true);
    assert.equal('interval' in autoRuntime, false);
    assert.doesNotThrow(() => JSON.stringify(autoRuntime));

    assert.equal(notifRuntime.running, true);
    assert.equal('interval' in notifRuntime, false);
    assert.doesNotThrow(() => JSON.stringify(notifRuntime));
  } finally {
    prevNotif.interval = null;
  }
});
