process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.PG_SEARCH_PATH = process.env.PG_SEARCH_PATH || 'dev';

import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFinishingSource } from '../lib/video-studio-finishing-source.js';

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

test('Fase 3: resolveFinishingSource detects multi-campaign conflict for instant_factory', async () => {
  const rawPaths = JSON.stringify(['if::camp_a::scene1', 'if::camp_b::scene2']);
  const res = await resolveFinishingSource({
    videoSourceType: 'instant_factory',
    videoPath: rawPaths,
    db: {}
  });
  assert.equal(res.success, true);
  assert.equal(res.conflict, true);
  assert.match(res.message, /beberapa Instant Factory/i);
});

test('Fase 3: resolveFinishingSource rejects unsupported source type', async () => {
  const res = await resolveFinishingSource({
    videoSourceType: 'upload',
    videoPath: 'my_video.mp4',
    db: {}
  });
  assert.equal(res.success, false);
  assert.match(res.error, /tidak memiliki finishing source/i);
});

test('Fase 3: resolveFinishingSource resolves instant_factory with plan and tts clips', async () => {
  const fakeDb = {
    prepare(sql) {
      return {
        get(...args) {
          if (sql.includes('instant_campaigns')) {
            return {
              id: 'camp_test_1',
              product_name: 'Super Snack',
              brand_profile_id: 'bp_123',
              hook: 'Snack Enak Sehat',
              finishing_template: 'problem_solution'
            };
          }
          if (sql.includes('instant_campaign_outputs')) {
            return {
              unified_production_json: JSON.stringify({
                finishing_template: 'problem_solution',
                finishing_plan: {
                  hook: 'Snack Enak Sehat',
                  chapters: [
                    { title: 'Lapar Sore', clip_index: 0 },
                    { title: 'Snack Rendah Gula', clip_index: 1 }
                  ],
                  punches: ['lapar sore']
                },
                tts_batch_id: 'ttsb_mock_1',
                caption: 'Cobain snack enak ini guys #snack #sehat'
              })
            };
          }
          if (sql.includes('brand_profiles')) {
            return { finishing_skin: 'bold' };
          }
          return null;
        },
        all(...args) {
          if (sql.includes('tts_studio_clips')) {
            return [
              { source_text: 'Sering merasa lapar sore?' },
              { source_text: 'Ini dia snack rendah gula yang bikin kenyang.' }
            ];
          }
          return [];
        }
      };
    }
  };

  const res = await resolveFinishingSource({
    videoSourceType: 'instant_factory',
    videoPath: JSON.stringify(['if::camp_test_1::scene1', 'if::camp_test_1::scene2']),
    db: fakeDb
  });

  assert.equal(res.success, true);
  assert.equal(res.conflict, false);
  assert.equal(res.data.campaignId, 'camp_test_1');
  assert.equal(res.data.finishingTemplate, 'problem_solution');
  assert.equal(res.data.skin, 'bold');
  assert.equal(res.data.ttsBatchId, 'ttsb_mock_1');
  assert.equal(res.data.voiceoverTexts.length, 2);
  assert.equal(res.data.planValid, true);
});

setTimeout(() => process.exit(0), 100).unref();
