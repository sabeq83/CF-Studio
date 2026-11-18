process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.PG_SEARCH_PATH = process.env.PG_SEARCH_PATH || 'dev';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  acquireProductionSlot,
  isProductionActive,
  getRenderSlotDir,
  RenderYieldError
} from '../lib/render-slot.js';

test('Fase 4: RenderYieldError has proper name and message', () => {
  const err = new RenderYieldError('Yield test');
  assert.equal(err.name, 'RenderYieldError');
  assert.equal(err.message, 'Yield test');
});

test('Fase 4: acquireProductionSlot creates lock and isProductionActive returns true', async () => {
  // Use a temporary slot directory for this test
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-slot-test-'));
  process.env.RENDER_SLOT_DIR = tempDir;

  try {
    assert.equal(isProductionActive(), false);

    const slot = await acquireProductionSlot({
      env: 'test',
      jobRef: 'job_123',
      type: 're_campaign'
    });

    assert.equal(isProductionActive(), true);

    const files = fs.readdirSync(tempDir);
    assert.equal(files.length, 1);
    assert.match(files[0], /^production-job_123-\d+\.lock$/);

    const content = JSON.parse(fs.readFileSync(path.join(tempDir, files[0]), 'utf8'));
    assert.equal(content.jobRef, 'job_123');
    assert.equal(content.type, 're_campaign');
    assert.ok(content.expiresAt > Date.now());

    await slot.release();
    assert.equal(isProductionActive(), false);
    assert.equal(fs.existsSync(path.join(tempDir, files[0])), false);
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
    delete process.env.RENDER_SLOT_DIR;
  }
});

test('Fase 4: Stale lock file is ignored by isProductionActive', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-slot-test-stale-'));
  process.env.RENDER_SLOT_DIR = tempDir;

  try {
    const staleLockFile = path.join(tempDir, 'production-stale-1.lock');
    fs.writeFileSync(staleLockFile, JSON.stringify({
      id: 'production-stale-1.lock',
      pid: process.pid,
      env: 'test',
      jobRef: 'stale_1',
      type: 're_campaign',
      startedAt: Date.now() - 60000,
      updatedAt: Date.now() - 60000,
      expiresAt: Date.now() - 1000 // Expired 1 second ago
    }), 'utf8');

    assert.equal(isProductionActive(), false);
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
    delete process.env.RENDER_SLOT_DIR;
  }
});

test('Fase 4: acquireProductionSlot never throws even if slot directory is invalid', async () => {
  // Point to a file so mkdirSync / writing fails
  const tempFile = path.join(os.tmpdir(), `invalid-slot-dir-${Date.now()}`);
  fs.writeFileSync(tempFile, 'not-a-directory', 'utf8');
  process.env.RENDER_SLOT_DIR = tempFile;

  try {
    const slot = await acquireProductionSlot({
      env: 'test',
      jobRef: 'job_fail',
      type: 're_campaign'
    });

    assert.ok(slot);
    assert.equal(typeof slot.release, 'function');
    await assert.doesNotReject(async () => {
      await slot.release();
    });
  } finally {
    try { fs.unlinkSync(tempFile); } catch (_) {}
    delete process.env.RENDER_SLOT_DIR;
  }
});

test('Fase 4: triggerFfmpegStudioQueue does not process jobs when isProductionActive is true', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-slot-test-queue-'));
  process.env.RENDER_SLOT_DIR = tempDir;

  const { createFfmpegStudioJob, getFfmpegStudioJob } = await import('../lib/db.js');
  const { triggerFfmpegStudioQueue } = await import('../lib/video-studio-processor.js');

  const jobId = `fsj_slot_test_${Date.now()}`;
  await createFfmpegStudioJob({
    id: jobId,
    video_source_type: 'upload',
    video_path: JSON.stringify(['public/temp/test.mp4']),
    audio_source_type: 'upload',
    audio_path: 'public/temp/test.mp3',
    sync_option: 'shortest',
    bgm_path: null,
    status: 'pending'
  });

  const slot = await acquireProductionSlot({
    env: 'test',
    jobRef: 'active_prod_job',
    type: 're_campaign'
  });

  try {
    assert.equal(isProductionActive(), true);
    await triggerFfmpegStudioQueue();

    const job = await getFfmpegStudioJob(jobId);
    assert.equal(job.status, 'pending');
  } finally {
    await slot.release();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
    delete process.env.RENDER_SLOT_DIR;
  }
});

test.after(async () => {
  setTimeout(() => process.exit(0), 500).unref();
});

