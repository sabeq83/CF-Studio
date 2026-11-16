process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.PG_SEARCH_PATH = process.env.PG_SEARCH_PATH || 'dev';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('triggerFfmpegStudioQueue source code verifies await on getPendingFfmpegStudioJob and updateFfmpegStudioJob', () => {
  const fileContent = fs.readFileSync('lib/video-studio-processor.js', 'utf8');
  
  // 1. Verify getPendingFfmpegStudioJob is awaited
  assert.match(
    fileContent,
    /const\s+job\s*=\s*await\s+getPendingFfmpegStudioJob\(\)/,
    'getPendingFfmpegStudioJob must be awaited in triggerFfmpegStudioQueue'
  );

  // 2. Verify updateFfmpegStudioJob to processing is awaited
  assert.match(
    fileContent,
    /await\s+updateFfmpegStudioJob\(\s*job\.id\s*,\s*\{\s*status:\s*['"]processing['"]\s*\}\s*\)/,
    'updateFfmpegStudioJob(job.id, { status: "processing" }) must be awaited'
  );

  // 3. Verify updateFfmpegStudioJob to completed is awaited
  assert.match(
    fileContent,
    /await\s+updateFfmpegStudioJob\(\s*job\.id\s*,\s*\{[\s\S]*?status:\s*['"]completed['"][\s\S]*?\}\s*\)/,
    'updateFfmpegStudioJob to completed must be awaited'
  );

  // 4. Verify updateFfmpegStudioJob to failed is awaited
  assert.match(
    fileContent,
    /await\s+updateFfmpegStudioJob\(\s*job\.id\s*,\s*\{[\s\S]*?status:\s*['"]failed['"][\s\S]*?\}\s*\)/,
    'updateFfmpegStudioJob to failed must be awaited'
  );
});

test('triggerFfmpegStudioQueue terminates cleanly when no pending job', async () => {
  const { triggerFfmpegStudioQueue } = await import('../lib/video-studio-processor.js');
  // Ensure queue processor loop terminates when no jobs pending in dev DB
  await triggerFfmpegStudioQueue();
  assert.ok(true, 'Queue terminated cleanly without hanging');
});
