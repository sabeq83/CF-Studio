import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  sortClipsByClipIndex,
  parseClipNumberFromPath,
  verifyClipPairIntegrity
} from '../lib/clip-pair-guard.js';
import {
  FINISHING_TEMPLATE_REGISTRY,
  FINISHING_TEMPLATE_IDS,
  getFinishingTemplateMeta,
  resolveFinishingTemplateFile,
  isRichFinishingTemplate,
  suggestFinishingTemplate
} from '../lib/finishing-template-registry.js';
import { resolveFinishingTemplatePath } from '../lib/finishing-overlay-renderer.js';
import { suggestFinishingTemplate as extractorSuggest } from '../lib/finishing-data-extractor.js';
import { processTtsStudioMuxing } from '../lib/video-studio-processor.js';
import { createCfStudioServer } from '../apps/mcp/tools.mjs';

const FFMPEG_BIN = (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH))
  ? process.env.FFMPEG_PATH
  : (fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg');

test('F2c0-T1 & T4 (R10): parseClipNumberFromPath ignores .mp3/.mp4 extension digits & handles real naming', () => {
  assert.equal(parseClipNumberFromPath('proj_audio_clip_01.mp3'), 1);
  assert.equal(parseClipNumberFromPath('proj_audio_clip_11.mp3'), 11);
  assert.equal(parseClipNumberFromPath('proj_audio_clip_21.mp3'), 21);
  for (let i = 1; i <= 12; i++) {
    assert.equal(parseClipNumberFromPath(`/tmp/test_video_clip_${i}.mp4`), i);
  }
  assert.equal(parseClipNumberFromPath('vid_scene_c01.mp4'), 1);
  assert.equal(parseClipNumberFromPath('vid_vo_c01.mp3'), 1);
  assert.equal(parseClipNumberFromPath('opc_glabs_2117_clip_0.mp4'), 0);
  assert.equal(parseClipNumberFromPath('mult_clip_abc_9.mp4?token=123'), 9);
  assert.equal(parseClipNumberFromPath('audio_tanpa_nomor.mp3'), null);
  assert.equal(parseClipNumberFromPath('video_clean.mp4'), null);
});

test('F2c0-T1 & T4 (R10): sortClipsByClipIndex sorts 10+ clips numerically even with string clip_index', () => {
  const shuffled = [
    { clip_index: '10', source_text: 'sepuluh' },
    { clip_index: 2, source_text: 'dua' },
    { clip_index: '21', source_text: 'dua satu' },
    { clip_index: 0, source_text: 'nol' },
    { clip_index: '11', source_text: 'sebelas' },
    { clip_index: 1, source_text: 'satu' }
  ];
  const sorted = sortClipsByClipIndex(shuffled);
  assert.deepEqual(sorted.map((c) => Number(c.clip_index)), [0, 1, 2, 10, 11, 21]);
});

test('F2c0-T2 & T4 (R10): verifyClipPairIntegrity passes valid 12-clip & scene_c01/vo_c01 sets and blocks mismatches', () => {
  // 1. Valid 12-clip archive naming (1-based files vs 0-based DB clip_index)
  const videos12 = Array.from({ length: 12 }, (_, i) => `/temp/brand_video_clip_${i + 1}.mp4`);
  const clips12 = Array.from({ length: 12 }, (_, i) => ({
    clip_index: i,
    audio_path: `/temp/brand_audio_clip_${String(i + 1).padStart(2, '0')}.mp3`,
    source_text: `Narasi klip ${i + 1}`,
    duration: 4.0
  }));
  const durations12 = Array(12).fill(4.15);
  const ok12 = verifyClipPairIntegrity({
    videoPaths: videos12,
    completedClips: clips12,
    voiceoverTexts: clips12.map((c) => c.source_text),
    probedAudioDurations: durations12
  });
  assert.equal(ok12.ok, true);
  assert.equal(ok12.videoOffset, 1);
  assert.equal(ok12.audioOffset, 1);

  // 2. Valid *_scene_c01.mp4 + *_vo_c01.mp3
  const okScene = verifyClipPairIntegrity({
    videoPaths: ['/tmp/demo_scene_c01.mp4', '/tmp/demo_scene_c02.mp4'],
    completedClips: [
      { clip_index: 0, audio_path: '/tmp/demo_vo_c01.mp3', source_text: 'Satu' },
      { clip_index: 1, audio_path: '/tmp/demo_vo_c02.mp3', source_text: 'Dua' }
    ]
  });
  assert.equal(okScene.ok, true);

  // 3. Lexicographical bug guard: *_audio_clip_01, _11, _21 paired against clip_index 0, 1, 2
  const badLex = verifyClipPairIntegrity({
    videoPaths: ['/tmp/clip_01.mp4', '/tmp/clip_02.mp4', '/tmp/clip_03.mp4'],
    completedClips: [
      { clip_index: 0, audio_path: '/tmp/proj_audio_clip_01.mp3', source_text: 'A' },
      { clip_index: 1, audio_path: '/tmp/proj_audio_clip_11.mp3', source_text: 'B' },
      { clip_index: 2, audio_path: '/tmp/proj_audio_clip_21.mp3', source_text: 'C' }
    ]
  });
  assert.equal(badLex.ok, false);
  assert.ok(badLex.reason.includes('proj_audio_clip_11.mp3'));

  // 4. Probed duration divergence > 0.3s fails safely
  const badDur = verifyClipPairIntegrity({
    videoPaths: ['/tmp/c0.mp4'],
    completedClips: [{ clip_index: 0, audio_path: '/tmp/a0.mp3', source_text: 'Test', duration: 3.0 }],
    probedAudioDurations: [3.45]
  });
  assert.equal(badDur.ok, false);
  assert.ok(badDur.reason.includes('recorded=3.00s'));

  // 5. VO text count mismatch fails safely
  const badVoCount = verifyClipPairIntegrity({
    videoPaths: ['/tmp/c0.mp4', '/tmp/c1.mp4'],
    completedClips: [
      { clip_index: 0, audio_path: '/tmp/a0.mp3', source_text: 'Satu' },
      { clip_index: 1, audio_path: '/tmp/a1.mp3', source_text: 'Dua' }
    ],
    voiceoverTexts: ['Satu']
  });
  assert.equal(badVoCount.ok, false);
  assert.ok(badVoCount.reason.includes('voTexts=1'));
});

test('F2c0-T2 & T4 (R10): processTtsStudioMuxing skips finishing (never fails total) when clip pairs mismatch', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f2c0-r10-'));
  try {
    const vid1 = path.join(tmpDir, 'bad_video_clip_01.mp4');
    const vid2 = path.join(tmpDir, 'bad_video_clip_10.mp4'); // Mismatch vs clip_index 1!
    const aud1 = path.join(tmpDir, 'bad_audio_clip_01.wav');
    const aud2 = path.join(tmpDir, 'bad_audio_clip_02.wav');
    const outPath = path.join(tmpDir, 'rendered_no_finishing.mp4');

    execFileSync(FFMPEG_BIN, ['-y', '-f', 'lavfi', '-i', 'color=c=navy:s=360x640:d=1.2:r=24', '-c:v', 'libx264', vid1], { stdio: 'ignore' });
    execFileSync(FFMPEG_BIN, ['-y', '-f', 'lavfi', '-i', 'color=c=maroon:s=360x640:d=1.2:r=24', '-c:v', 'libx264', vid2], { stdio: 'ignore' });
    execFileSync(FFMPEG_BIN, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1.2', aud1], { stdio: 'ignore' });
    execFileSync(FFMPEG_BIN, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=520:duration=1.2', aud2], { stdio: 'ignore' });

    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...args) => {
      warnings.push(args.join(' '));
      origWarn(...args);
    };

    try {
      const res = await processTtsStudioMuxing({
        id: 'test_r10_skip_finishing',
        videoPath: JSON.stringify([vid1, vid2]),
        batchId: 'test_r10_batch',
        syncOption: 'shortest',
        outputPath: outPath,
        enableMotionText: 1,
        finishingTemplate: 'calm_wellness',
        enablePlaywrightOverlay: false,
        batchDataOverride: {
          id: 'test_r10_batch',
          clips: [
            { clip_index: 1, status: 'completed', audio_path: aud2, source_text: 'Klip kedua', duration: 1.2 },
            { clip_index: 0, status: 'completed', audio_path: aud1, source_text: 'Klip pertama', duration: 1.2 }
          ]
        }
      });

      assert.equal(res, outPath);
      assert.equal(fs.existsSync(outPath), true);
      assert.ok(fs.statSync(outPath).size > 5000);
      assert.ok(
        warnings.some((w) => w.includes('[Clip Pair Guard]') && w.includes('bad_video_clip_10.mp4')),
        'Must warn with exact mismatched filename details'
      );
    } finally {
      console.warn = origWarn;
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('F2c0-T3 & T4 (R11): centralized registry drives extractor, renderer, UI Presets, & MCP Zod enums', () => {
  // 1. Existing IDs & registry alignment match cleanly
  assert.deepEqual(FINISHING_TEMPLATE_IDS, FINISHING_TEMPLATE_REGISTRY.map((entry) => entry.id));
  for (const baseId of ['none', 'calm_wellness', 'recipe_pop']) {
    assert.ok(FINISHING_TEMPLATE_IDS.includes(baseId));
  }
  assert.equal(resolveFinishingTemplateFile('calm_wellness'), 'calm-wellness.html');
  assert.equal(resolveFinishingTemplateFile('recipe_pop'), 'recipe-pop.html');
  assert.equal(isRichFinishingTemplate('none'), false);
  assert.equal(isRichFinishingTemplate('calm_wellness'), true);
  assert.equal(path.basename(resolveFinishingTemplatePath('recipe_pop')), 'recipe-pop.html');

  // 2. R11 fix: suggestFinishingTemplate returns null when no template matches (not calm_wellness!)
  assert.equal(suggestFinishingTemplate({}), null);
  assert.equal(suggestFinishingTemplate({ campaign_kind: 'unknown', new_caption: 'Random' }), null);
  assert.equal(suggestFinishingTemplate({ preset_key: 'product_hard_sell' }), null);
  assert.equal(extractorSuggest({ campaign_kind: 'brand_editorial' }), 'calm_wellness');
  assert.equal(extractorSuggest({ campaign_kind: 'recipe_campaign' }), 'recipe_pop');

  // 3. Adding 1 dummy entry to a cloned registry automatically flows through registry APIs
  const extendedRegistry = [
    ...FINISHING_TEMPLATE_REGISTRY,
    {
      id: 'dummy_test_template',
      file: 'dummy-test.html',
      label: 'Dummy Test Template',
      description: 'Dummy registry entry test.',
      layers: { recipe: false, product: true, cameraMotion: false, sharedBrand: true },
      finishingPlanFields: ['hook', 'punches', 'dummy_field'],
      suggestFor: [{ campaignKinds: ['dummy_campaign'], patterns: [/dummy_niche/i] }],
      compatibilityCampaignKinds: ['dummy_campaign'],
      compliance: { strictClaims: true }
    }
  ];
  assert.equal(getFinishingTemplateMeta('dummy_test_template', extendedRegistry).file, 'dummy-test.html');
  assert.equal(resolveFinishingTemplateFile('dummy_test_template', extendedRegistry), 'dummy-test.html');
  assert.equal(isRichFinishingTemplate('dummy_test_template', extendedRegistry), true);
  assert.equal(suggestFinishingTemplate({ campaign_kind: 'dummy_campaign' }, extendedRegistry), 'dummy_test_template');

  // 4. Verify UI Presets page imports and renders dynamically from finishing-template-registry
  const presetsPageSrc = fs.readFileSync(path.join(process.cwd(), 'app', 'settings', 'presets', 'page.js'), 'utf8');
  assert.ok(presetsPageSrc.includes("from '@/lib/finishing-template-registry'"));
  assert.ok(presetsPageSrc.includes('FINISHING_TEMPLATE_REGISTRY.map('));
  assert.ok(!presetsPageSrc.includes('<option value="calm_wellness">'), 'UI Presets must not hardcode template <option> tags');

  // 5. Verify MCP tools register finishing_template directly from FINISHING_TEMPLATE_IDS (zero hardcoded enum arrays)
  const mcpSrc = fs.readFileSync(path.join(process.cwd(), 'apps', 'mcp', 'tools.mjs'), 'utf8');
  assert.ok(mcpSrc.includes('FINISHING_TEMPLATE_IDS'));
  assert.ok(!mcpSrc.includes("z.enum(['none', 'calm_wellness', 'recipe_pop'])"), 'MCP tools must not hardcode template z.enum');

  // Mutating FINISHING_TEMPLATE_IDS transiently proves newly registered tools accept a new registry ID
  FINISHING_TEMPLATE_IDS.push('dummy_runtime_tpl');
  try {
    const server = createCfStudioServer(async () => ({}));
    const productSchema = server._registeredTools['cf_create_product_video']?.inputSchema?.shape;
    assert.ok(productSchema?.finishing_template, 'cf_create_product_video must expose finishing_template schema');
    assert.equal(productSchema.finishing_template.safeParse('dummy_runtime_tpl').success, true);
    assert.equal(productSchema.finishing_template.safeParse('non_existent_tpl').success, false);
  } finally {
    FINISHING_TEMPLATE_IDS.pop();
  }
});

