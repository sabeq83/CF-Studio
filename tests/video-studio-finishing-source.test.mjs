process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.PG_SEARCH_PATH = process.env.PG_SEARCH_PATH || 'dev';

import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFinishingSource, validateVideoStudioSourceType } from '../lib/video-studio-finishing-source.js';

test('Video Studio render rejects video_source_type instant_factory with status 400 and clear error', () => {
  const res = validateVideoStudioSourceType('instant_factory');
  assert.equal(res.valid, false);
  assert.equal(res.status, 400);
  assert.match(res.error, /instant_factory.*tidak didukung/i);

  assert.equal(validateVideoStudioSourceType('re_campaign').valid, true);
  assert.equal(validateVideoStudioSourceType('upload').valid, true);
  assert.equal(validateVideoStudioSourceType('database').valid, true);
});

test('Fase 3: resolveFinishingSource missing parameters returns failure', async () => {
  const res = await resolveFinishingSource({ videoSourceType: null, videoPath: null, db: {} });
  assert.equal(res.success, false);
  assert.match(res.error, /wajib disertakan/i);
});

test('Fase 3: resolveFinishingSource detects multi-campaign conflict for re_campaign', async () => {
  const rawPaths = JSON.stringify(['re::101::clip0', 're::102::clip1']);
  const res = await resolveFinishingSource({
    videoSourceType: 're_campaign',
    videoPath: rawPaths,
    db: {}
  });
  assert.equal(res.success, true);
  assert.equal(res.conflict, true);
  assert.match(res.message, /beberapa campaign/i);
});

test('Fase 3: resolveFinishingSource rejects unsupported or removed source types (including instant_factory)', async () => {
  const resUpload = await resolveFinishingSource({
    videoSourceType: 'upload',
    videoPath: 'my_video.mp4',
    db: {}
  });
  assert.equal(resUpload.success, false);
  assert.match(resUpload.error, /tidak memiliki finishing source/i);

  const resInstant = await resolveFinishingSource({
    videoSourceType: 'instant_factory',
    videoPath: JSON.stringify(['if::camp_a::scene1']),
    db: {}
  });
  assert.equal(resInstant.success, false);
  assert.match(resInstant.error, /tidak memiliki finishing source/i);
});

setTimeout(() => process.exit(0), 100).unref();
