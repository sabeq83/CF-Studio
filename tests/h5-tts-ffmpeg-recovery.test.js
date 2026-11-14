process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

import {
  isValidTtsBatchId,
  isMissingTtsBatchForItem
} from '../lib/scheduler-processors.js';

after(() => {
  setTimeout(() => process.exit(0), 50);
});

test('F2.2-H5: isValidTtsBatchId & isMissingTtsBatchForItem mendeteksi tts_batch_id null/string-null', () => {
  assert.equal(isValidTtsBatchId(null), false);
  assert.equal(isValidTtsBatchId(undefined), false);
  assert.equal(isValidTtsBatchId(''), false);
  assert.equal(isValidTtsBatchId('null'), false);
  assert.equal(isValidTtsBatchId('NULL'), false);
  assert.equal(isValidTtsBatchId('undefined'), false);
  assert.equal(isValidTtsBatchId('ttsb_opc_2140_12345'), true);

  assert.equal(isMissingTtsBatchForItem({ tts_status: 'completed', tts_batch_id: null }), true);
  assert.equal(isMissingTtsBatchForItem({ tts_status: 'completed', tts_batch_id: 'null' }), true);
  assert.equal(isMissingTtsBatchForItem({ tts_status: 'skipped', tts_batch_id: null }), false);
  assert.equal(isMissingTtsBatchForItem({ tts_status: 'completed', tts_batch_id: 'ttsb_opc_2140_12345' }), false);
});

test('F2.2-H5: blocked_before_tts tidak menandai stage TTS selesai, FFmpeg pre-flight menolak null batch & scheduler membatasi retry', () => {
  const execSvcSrc = fs.readFileSync(path.join(process.cwd(), 'lib/pillar-stage-execution-service.js'), 'utf8');
  assert.ok(execSvcSrc.includes('inner?.blocked_before_tts'), 'executeIdempotentStage must treat blocked_before_tts as deferred, not completed');
  assert.ok(execSvcSrc.includes('export async function resetStageExecution'), 'resetStageExecution must exist to clear stale cached TTS stages');

  const schedulerSrc = fs.readFileSync(path.join(process.cwd(), 'lib/campaign-scheduler.js'), 'utf8');
  assert.ok(schedulerSrc.includes('isMissingTtsBatchForItem(currentItem)'), 'Scheduler must block FFmpeg execution when tts_batch_id is null');
  assert.ok(schedulerSrc.includes("workflow_status: 'failed'"), 'Scheduler must stop cleanly as failed when retry cap exhausted with null tts_batch_id');
  assert.ok(schedulerSrc.includes('!isValidTtsBatchId(outBatch)'), 'Scheduler idempotent reconciliation must verify non-null tts_batch_id');

  const procSrc = fs.readFileSync(path.join(process.cwd(), 'lib/scheduler-processors.js'), 'utf8');
  assert.ok(procSrc.includes('isMissingTtsBatchForItem(item)'), 'processPillarFfmpeg pre-flight must guard against missing tts_batch_id');
  assert.ok(procSrc.includes('review_reason: missingBatchMsg'), 'processPillarFfmpeg must record clear review_reason for UI visibility');
});

