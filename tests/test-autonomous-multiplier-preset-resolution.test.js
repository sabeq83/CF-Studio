import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../lib/db.js';
import { closePgPool } from '../lib/db-pg.js';
import { stopCampaignScheduler } from '../lib/campaign-scheduler.js';
import {
  executeAutonomousMultiplierPipeline as executeMultiplierNew,
  executeAutonomousRecipePipeline as executeRecipeNew
} from '../lib/autonomous-engine.js';
import {
  executeAutonomousMultiplierPipeline as executeMultiplierFacade,
  executeAutonomousRecipePipeline as executeRecipeFacade
} from '../lib/autonomous-recipe-engine.js';
import { hydrateOperatorPresetCache } from '../lib/operator-presets.js';

test.after(async () => {
  stopCampaignScheduler();
  await new Promise(resolve => setTimeout(resolve, 500));
  await closePgPool();
  process.exit(0);
});

test('Autonomous Engine & Multiplier Preset Resolution Suite', async (t) => {
  const db = getDb();

  await t.test('1. Backward Compatibility Facade re-exports identical functions', () => {
    assert.strictEqual(
      typeof executeMultiplierFacade,
      'function',
      'executeAutonomousMultiplierPipeline must be exported by facade'
    );
    assert.strictEqual(
      executeMultiplierFacade,
      executeMultiplierNew,
      'Facade function must be strictly identical to autonomous-engine.js'
    );
    assert.strictEqual(
      executeRecipeFacade,
      executeRecipeNew,
      'Recipe pipeline function must be strictly identical to autonomous-engine.js'
    );
  });

  await t.test('2. Multiplier Pipeline resolves 6 scenes from preset into task bridging config', async () => {
    const tenantId = 'default_tenant';

    // Hydrate sample multiplier preset with 6 scenes
    hydrateOperatorPresetCache(tenantId, {
      multiplier_siasatsehat: {
        schema_version: '2',
        label: 'Multiplier - Siasat Sehat (6 Scenes)',
        campaign_kinds: ['multiplier_campaign'],
        basic_strategy: {
          voice_provider: 'minimax',
          voice_persona: 'Indonesian_professional_anchor_vv2',
          target_language: 'id-ID',
          mandatory_outro_line: 'Temukan siasat sehat lainnya hanya di Siasat Sehat.'
        },
        visual_engine: {
          visual_style: 'photorealistic_clean',
          visual_mode: 'pure_t2v',
          clip_duration: 8,
          target_clips_count: 6,
          words_per_clip: '16-19 kata'
        },
        product_bridging: {
          is_bridging_active: false
        }
      }
    });

    // Ensure we have at least one blueprint reference for test
    let bp = await db.prepare('SELECT id FROM re_deconstructed_assets LIMIT 1').get();
    let createdDummyBp = false;
    if (!bp) {
      const dummyId = `bp_test_${Date.now()}`;
      await db.prepare(`
        INSERT INTO re_deconstructed_assets (id, tenant_id, title, original_storyboard_json)
        VALUES (?, ?, ?, ?)
      `).run(dummyId, tenantId, 'Test Blueprint', JSON.stringify([{ scene: 1 }]));
      bp = { id: dummyId };
      createdDummyBp = true;
    }

    const result = await executeMultiplierNew({
      brandId: 'siasatsehat',
      deconstructAssetId: bp.id,
      presetKey: 'multiplier_siasatsehat',
      executionMode: 'manual_approval', // do not auto-poll in test
      selectedAngle: {
        title: 'Rahasia Metabolisme Pagi',
        hook_text: 'Satu sendok ini bisa ubah pencernaanmu!'
      },
      tenantId
    });

    assert.ok(result.success, 'Pipeline must succeed');
    assert.ok(result.task_id, 'Task ID must be returned');

    // Query task from database
    const task = await db.prepare('SELECT * FROM re_multiplier_tasks WHERE id = ?').get(result.task_id);
    assert.ok(task, 'Task must exist in database');

    const bridgingConfig = JSON.parse(task.bridging_config_json || '{}');
    const audioConfig = JSON.parse(task.audio_config_json || '{}');
    const vsoConfig = JSON.parse(task.vso_config_json || '{}');

    // CRITICAL ASSERTION: targetClipsCount MUST BE 6 (not default 4)
    assert.strictEqual(
      bridgingConfig.targetClipsCount,
      6,
      'bridgingConfig.targetClipsCount must match preset visual_engine.target_clips_count (6)'
    );
    assert.strictEqual(
      bridgingConfig.target_clips_count,
      6,
      'bridgingConfig.target_clips_count must also match 6'
    );
    assert.strictEqual(
      bridgingConfig.mandatoryOutroLine,
      'Temukan siasat sehat lainnya hanya di Siasat Sehat.',
      'Mandatory outro must be resolved from basic_strategy'
    );

    // Audio config assertions
    assert.strictEqual(
      audioConfig.voice_persona,
      'Indonesian_professional_anchor_vv2',
      'Audio voice_persona must match preset'
    );

    // VSO config assertions
    assert.strictEqual(
      vsoConfig.words_per_clip,
      '16-19 kata',
      'VSO words_per_clip must match preset'
    );

    // Cleanup test task
    await db.prepare('DELETE FROM re_multiplier_tasks WHERE id = ?').run(result.task_id);
    if (createdDummyBp) {
      await db.prepare('DELETE FROM re_deconstructed_assets WHERE id = ?').run(bp.id);
    }
  });
});
