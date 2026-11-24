import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  GLABS_MAX_POLL_NETWORK_RETRIES,
  GLABS_STALE_TASK_AGE_MS,
  evaluateGlabsPollFailure,
  evaluatePollRetryBudget,
  isTransientGlabsNetworkError,
  shouldSkipZombiePillarPoll,
} from '../lib/glabs-poll-guard.js';

const ROOT = process.cwd();

test('isTransientGlabsNetworkError identifies fetch failed, timeouts, and socket error codes', () => {
  assert.equal(isTransientGlabsNetworkError(new TypeError('fetch failed')), true);
  const errConn = new Error('connect');
  errConn.code = 'EHOSTUNREACH';
  assert.equal(isTransientGlabsNetworkError(errConn), true);
  assert.equal(isTransientGlabsNetworkError({ name: 'TimeoutError', message: 'aborted' }), true);
  assert.equal(isTransientGlabsNetworkError(new Error('invalid JSON payload')), false);
});

test('evaluateGlabsPollFailure marks stale (>24h) unreachable tasks and 404/410 as fatal', () => {
  const now = Date.parse('2026-11-24T11:00:00Z');
  const staleCreated = new Date(now - GLABS_STALE_TASK_AGE_MS - 60_000).toISOString();
  const freshCreated = new Date(now - 5 * 60_000).toISOString();

  const staleRes = evaluateGlabsPollFailure({
    err: new TypeError('fetch failed'),
    taskId: '43eccb56',
    taskCreatedAt: staleCreated,
    nowMs: now,
  });
  assert.equal(staleRes.fatal, true);
  assert.equal(staleRes.markGlabsFailed, true);

  const freshRes = evaluateGlabsPollFailure({
    err: new TypeError('fetch failed'),
    taskId: '84ba3b35',
    taskCreatedAt: freshCreated,
    nowMs: now,
  });
  assert.equal(freshRes.fatal, false);
  assert.equal(freshRes.isNetworkError, true);

  const http404 = evaluateGlabsPollFailure({
    err: Object.assign(new Error('Not Found'), { status: 404 }),
    taskId: 'deadbeef',
    taskCreatedAt: freshCreated,
    nowMs: now,
  });
  assert.equal(http404.fatal, true);
  assert.equal(http404.markGlabsFailed, true);
});

test('evaluatePollRetryBudget stops infinite polling loops after max consecutive network errors', () => {
  let retryCount = 0;
  for (let tick = 1; tick < GLABS_MAX_POLL_NETWORK_RETRIES; tick++) {
    const res = evaluatePollRetryBudget({ networkErrorsInTick: 2, currentRetryCount: retryCount });
    assert.equal(res.exceedLimit, false);
    assert.equal(res.nextRetryCount, tick);
    retryCount = res.nextRetryCount;
  }

  const finalRes = evaluatePollRetryBudget({ networkErrorsInTick: 1, currentRetryCount: retryCount });
  assert.equal(finalRes.exceedLimit, true);
  assert.equal(finalRes.nextRetryCount, GLABS_MAX_POLL_NETWORK_RETRIES);
});

test('shouldSkipZombiePillarPoll skips completed workflows stuck in visual_status=processing without blocking re-ffmpeg', () => {
  assert.equal(shouldSkipZombiePillarPoll({ workflow_status: 'completed', visual_status: 'processing', ffmpeg_status: 'pending' }), true);
  assert.equal(shouldSkipZombiePillarPoll({ workflow_status: 'production_processing', visual_status: 'processing' }), false);
  assert.equal(shouldSkipZombiePillarPoll({ workflow_status: 'completed', visual_status: 'completed', ffmpeg_status: 'pending' }), false);
});

test('scheduler-processors and campaign-scheduler integrate glabs poll guard cleanly', () => {
  const procSrc = fs.readFileSync(path.join(ROOT, 'lib/scheduler-processors.js'), 'utf8');
  assert.ok(procSrc.includes('GLABS_CLIP_DOWNLOAD_TIMEOUT_MS'));
  assert.ok(procSrc.includes('evaluateGlabsPollFailure'));
  assert.ok(procSrc.includes('evaluatePollRetryBudget'));

  const schedSrc = fs.readFileSync(path.join(ROOT, 'lib/campaign-scheduler.js'), 'utf8');
  assert.ok(schedSrc.includes('shouldSkipZombiePillarPoll'));
});
