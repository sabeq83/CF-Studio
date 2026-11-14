import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSceneBrief } from '../lib/scene-brief.js';
import { analyzeCampaignDiversity } from '../lib/scene-diversity-guard.js';

test('Diversity Guard flags uniform batch (>=3 identical sequence / >70% dominant location) in report_only mode', () => {
  const items = [1, 2, 3, 4].map(idx => {
    const row = {
      context: 'Pagi hari di dapur rumah menyiapkan sarapan sehat',
      ws_matrix: 'When: Pagi hari | Where: Di dapur rumah',
      strategic_angle: 'The Life Hack'
    };
    const sceneBrief = buildSceneBrief(row);
    return {
      id: idx,
      sceneBrief,
      row_creative_payload: row,
      parsed: {
        storyboard: Array.from({ length: 6 }, (_, i) => ({ scene: i + 1, visual_description: `Scene ${i + 1} kitchen` })),
        t2i_prompts: [{ clip: 1, prompt: 'Macro culinary shot on kitchen slate counter' }]
      }
    };
  });

  const report = analyzeCampaignDiversity(items);
  assert.equal(report.mode, 'report_only');
  assert.equal(report.status, 'warning');
  assert.ok(report.warnings.some(w => w.code === 'DOMINANT_LOCATION_OVERUSE'));
  assert.ok(report.warnings.some(w => w.code === 'REPEATED_BEAT_SEQUENCE'));
});

test('Diversity Guard returns ok on varied opc_261108_8618kc batch (6 distinct situations)', () => {
  const rows = [
    { context: 'Malam hari di ruang keluarga duduk santai', ws_matrix: 'When: Malam', strategic_angle: 'The Rebel Choice' },
    { context: 'Di dapur rumah menyiapkan sarapan', ws_matrix: 'Where: dapur', strategic_angle: 'The Second Chance' },
    { context: 'Saat jam istirahat siang di ruang makan', ws_matrix: 'When: Siang', strategic_angle: 'The Intellectual Flex' },
    { context: 'Pagi hari di meja pantry dapur bersama suami', ws_matrix: 'When: Pagi', strategic_angle: 'The Life Hack' },
    { context: 'Malam hari di kamar tidur sunyi', ws_matrix: 'When: Malam', strategic_angle: 'The Minimalist' },
    { context: 'Sore hari di teras rumah asri', ws_matrix: 'Where: teras rumah', strategic_angle: 'The Caregiver' }
  ];

  const items = rows.map((row, idx) => ({
    id: 2051 + idx,
    sceneBrief: buildSceneBrief(row),
    row_creative_payload: row,
    parsed: {
      storyboard: Array.from({ length: 6 }, (_, i) => ({ scene: i + 1, visual_description: `Distinct scene ${idx}-${i}` })),
      t2i_prompts: [{ clip: 1, prompt: `Unique hook scene ${idx}` }]
    }
  }));

  const report = analyzeCampaignDiversity(items);
  assert.equal(report.mode, 'report_only');
  assert.equal(report.status, 'ok');
  assert.equal(report.warnings.length, 0);
  assert.ok(report.stats.dominant_location_ratio <= 0.34);
});

