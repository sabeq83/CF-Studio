import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

import {
  DEFAULT_HERBAL_DISCLAIMER,
  truncateWordBoundary,
  parseRecipeSections,
  extractRecipeOverlayData,
  extractProductCardData,
  resolveCtaAndSavePrompt,
  suggestFinishingTemplate
} from '../lib/finishing-data-extractor.js';
import {
  buildCameraZoomExpressions,
  buildCameraMotionFilterChain
} from '../lib/camera-motion-engine.js';
import {
  resolveFinishingTemplatePath,
  buildPhase1Timeline,
  renderPlaywrightOverlay,
  buildPlaywrightAudioMix
} from '../lib/finishing-overlay-renderer.js';
import { resolvePreRenderFinishingMeta } from '../lib/tiktok-compliance-service.js';
import {
  listOperatorPresets,
  resolveOperatorPreset
} from '../lib/operator-presets.js';

const FFMPEG_BIN = (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH))
  ? process.env.FFMPEG_PATH
  : (fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg');

test('F2-T1: extractRecipeOverlayData enforces <=4 chips + "+N bahan lain", <=22/<=16 char limits, and empty recipe hiding', () => {
  const sampleCaption = [
    'Menu hangat praktis untuk keluarga!',
    '',
    '📋 BAHAN-BAHAN:',
    '1. Oatmeal instan premium tekstur lembut 60 gram',
    '2. Telur ayam kampung segar 2 butir',
    '3. Wortel manis parut halus 30 gram',
    '4. Daun bawang iris tipis secukupnya',
    '5. Bawang putih cincang halus 2 siung',
    '6. Kaldu jamur alami non msg',
    '7. Minyak wijen murni 1 sendok teh',
    '8. Lada putih bubuk sejumput',
    '',
    '👩‍🍳 LANGKAH PEMBUATAN:',
    '1. Aduk seluruh bahan utama sampai merata sempurna di mangkuk',
    '2. Panaskan wajan antilengket api kecil merata',
    '3. Tuang adonan dan masak perlahan hingga keemasan',
    '4. Balik sisi satunya lalu diamkan sebentar',
    '5. Angkat dan tata di piring saji hangat',
    '6. Sajikan selagi hangat dengan saus favorit',
    '',
    '#resepsehat #menuharian'
  ].join('\n');

  const parsed = parseRecipeSections({ caption: sampleCaption });
  assert.equal(parsed.ingredients.length, 8);
  assert.equal(parsed.steps.length, 6);

  // Empty recipe case -> must hide slots
  const emptyRes = extractRecipeOverlayData({
    campaign: { description: 'Tips hidup sehat tanpa resep sama sekali.' },
    clipOffsets: [
      { start: 0, duration: 3 },
      { start: 3, duration: 3 },
      { start: 6, duration: 3 },
      { start: 9, duration: 3 }
    ],
    totalDuration: 12
  });
  assert.equal(emptyRes.hasRecipe, false);
  assert.equal(emptyRes.ingredients.items.length, 0);
  assert.equal(emptyRes.steps.length, 0);

  // Dynamic variations across 4, 6, and 8 clips
  for (const clipCount of [4, 6, 8]) {
    const clipOffsets = Array.from({ length: clipCount }, (_, i) => ({
      start: i * 2.5,
      duration: 2.5
    }));
    const totalDuration = clipCount * 2.5;
    const recipe = extractRecipeOverlayData({
      item: { new_caption: sampleCaption },
      clipOffsets,
      wordEvents: [
        { w: 'Oatmeal', s: 0.4, e: 0.8 },
        { w: 'Telur', s: 1.4, e: 1.8 },
        { w: 'Wortel', s: 2.8, e: 3.1 },
        { w: 'Daun', s: 4.1, e: 4.5 }
      ],
      totalDuration
    });

    assert.equal(recipe.hasRecipe, true);
    assert.equal(recipe.ingredients.items.length, 4, `clipCount=${clipCount} must show max 4 chips`);
    assert.equal(recipe.ingredients.overflowLabel, '+4 bahan lain');
    assert.ok(recipe.ingredients.until < clipOffsets[clipCount - 1].start + 0.01);
    for (const item of recipe.ingredients.items) {
      assert.ok(item.label.length <= 22, `Chip "${item.label}" exceeded 22 chars`);
    }
    assert.ok(recipe.steps.length <= clipCount);
    for (const st of recipe.steps) {
      assert.match(st.badge, /^LANGKAH \d+\/\d+$/);
      assert.ok(st.t.length <= 16, `Step "${st.t}" exceeded 16 chars`);
      assert.ok(st.e > st.s);
    }

    const timeline = buildPhase1Timeline({
      finishingTemplate: 'recipe_pop',
      clipOffsets,
      totalDuration,
      wordEvents: [
        { w: 'Oatmeal', s: 0.4, e: 0.8 },
        { w: 'hangat', s: 2.0, e: 2.5 },
        { w: 'link', s: totalDuration - 1.5, e: totalDuration - 1.0 }
      ],
      recipe
    });
    assert.equal(timeline.config.finishingTemplate, 'recipe_pop');
    assert.ok(timeline.sfx.some((c) => c.k === 'tick'), 'Expected tick SFX cue on chip/step reveal');

    const cam = buildCameraZoomExpressions({ clipOffsets, punchTimestamps: [1.0, 5.0], totalDuration });
    assert.equal(cam.cutTimestamps.length, clipCount - 1);
  }
});

test('F2-T1: extractProductCardData & resolveCtaAndSavePrompt stay 100% metadata-driven', () => {
  const missingProd = extractProductCardData({ product: null, totalDuration: 15 });
  assert.equal(missingProd, null);

  const nonHerbal = extractProductCardData({
    product: {
      product_name: 'Kopi Tubruk Nusantara Single Origin 250gr',
      netto: '250 gram Roast Medium',
      category: 'MINUMAN KOPI'
    },
    isHerbalProduct: false,
    hasRecipe: false,
    clipOffsets: [
      { start: 0, duration: 4 },
      { start: 4, duration: 4 },
      { start: 8, duration: 4 }
    ],
    totalDuration: 12
  });
  assert.ok(nonHerbal);
  assert.equal(nonHerbal.name, truncateWordBoundary('Kopi Tubruk Nusantara Single Origin 250gr', 40));
  assert.equal(nonHerbal.disclaimer, '');
  assert.equal(nonHerbal.tag, 'MINUMAN KOPI');

  const herbal = extractProductCardData({
    product: {
      product_name: 'Ekstrak Kunyit Asam Harian Botol Kaca',
      packaging: 'Botol Kaca 350ml'
    },
    isHerbalProduct: true,
    hasRecipe: true,
    clipOffsets: [
      { start: 0, duration: 4 },
      { start: 4, duration: 4 },
      { start: 8, duration: 4 }
    ],
    totalDuration: 12
  });
  assert.ok(herbal);
  assert.equal(herbal.disclaimer, DEFAULT_HERBAL_DISCLAIMER);
  assert.equal(herbal.tag, 'BAHAN KUNCI');

  const { cta, savePrompt } = resolveCtaAndSavePrompt({
    cleanVoiceoverClips: ['Yuk langsung cek keranjang kuning sebelum kehabisan.'],
    wordEvents: [{ w: 'keranjang', s: 9.2, e: 9.6 }],
    clipOffsets: [
      { start: 0, duration: 4 },
      { start: 4, duration: 4 },
      { start: 8, duration: 4 }
    ],
    hasRecipe: true,
    platform: 'tiktok',
    totalDuration: 12
  });
  assert.equal(cta.text, 'CEK KERANJANG KUNING');
  assert.ok(savePrompt && savePrompt.titleText.includes('Resep'));
});

test('F2-T2 & F2-T3: Zero hardcoded strings (R6.6) in templates & E2E camera motion + Playwright render for calm_wellness and recipe_pop', async () => {
  assert.ok(fs.existsSync(path.join(process.cwd(), 'public', 'sfx', 'tick.wav')), 'tick.wav must exist');

  const calmHtml = fs.readFileSync(resolveFinishingTemplatePath('calm_wellness'), 'utf8');
  const recipeHtml = fs.readFileSync(resolveFinishingTemplatePath('recipe_pop'), 'utf8');
  const forbiddenPatterns = [
    /garlibee/i,
    /madu\s+bawang/i,
    /tepung\s+oat/i,
    /jahe\s+parut/i,
    /p-irt/i,
    /bpom/i,
    /cek\s+keranjang\s+kuning/i,
    /simpan\s+resep\s+ini/i,
    /#f2b632/i,
    /#b88928/i,
    /gala\s+malam/i
  ];
  for (const [tplName, html] of [['calm-wellness.html', calmHtml], ['recipe-pop.html', recipeHtml]]) {
    for (const rx of forbiddenPatterns) {
      assert.equal(rx.test(html), false, `${tplName} must not contain hardcoded literal matching ${rx}`);
    }
    // Check TikTok safe-zone rules presence
    assert.ok(/right:\s*15cqw/.test(html), `${tplName} should keep elements out of TikTok right bar (>=86cqw)`);
  }

  // Test full render + 3x upscale zoompan + tick/pop/whoosh audio mix on both templates
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f2-e2e-'));
  try {
    const baseVid = path.join(tmpDir, 'base.mp4');
    const finalOut = path.join(tmpDir, 'final.mp4');
    const dur = 4.0;
    const clipOffsets = [
      { start: 0, duration: 2.0 },
      { start: 2.0, duration: 2.0 }
    ];

    // Generate muxed base video (video + audio at index 0, matching runFinalMasterPass input order)
    execFileSync(FFMPEG_BIN, [
      '-y',
      '-f', 'lavfi', '-i', `color=c=#223344:s=720x1280:r=30:d=${dur}`,
      '-f', 'lavfi', '-i', `sine=frequency=240:duration=${dur}`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k',
      baseVid
    ], { stdio: 'pipe' });

    const recipe = extractRecipeOverlayData({
      campaign: {
        description: 'BAHAN-BAHAN:\n1. Beras kencur segar\n2. Madu hutan asli\nLANGKAH PEMBUATAN:\n1. Seduh air hangat\n2. Aduk merata'
      },
      clipOffsets,
      wordEvents: [
        { w: 'Seduh', s: 0.5, e: 0.9 },
        { w: 'hangat', s: 2.3, e: 2.7 }
      ],
      totalDuration: dur
    });

    const timeline = buildPhase1Timeline({
      finishingTemplate: 'recipe_pop',
      finishingPlan: {
        hook_card: { title: 'Racikan Sore Praktis', eyebrow: 'TIPS RINGKAS' },
        punches: [{ text: 'SEDUH HANGAT', anchor: 'hangat', level: 'primary' }],
        accent_color: '#4ade80'
      },
      captionMode: 'hybrid',
      clipOffsets,
      totalDuration: dur,
      wordEvents: [
        { w: 'Seduh', s: 0.5, e: 0.9 },
        { w: 'air', s: 1.1, e: 1.4 },
        { w: 'hangat', s: 2.3, e: 2.7 },
        { w: 'praktis', s: 3.1, e: 3.5 }
      ],
      recipe,
      productCard: {
        name: 'Serbuk Kencur Organik',
        specLine: 'Kemasan 100g',
        tag: 'BAHAN KUNCI',
        disclaimer: '',
        s: 2.0,
        e: 3.8
      },
      savePrompt: {
        titleText: 'Simpan Tips Ini',
        subtitleText: 'Ringkasan ada di caption ⬇️',
        s: 2.2,
        e: 3.1
      },
      cta: {
        text: 'LINK DI BIO',
        arrowDir: '▼',
        s: 3.15,
        e: dur
      }
    });

    const ovDir = path.join(tmpDir, 'ov_recipe');
    const ovRes = await renderPlaywrightOverlay({ outputDir: ovDir, timeline });
    assert.ok(ovRes.imagePattern && fs.existsSync(ovRes.imagePattern.replace('%05d', '00001')));

    // Also render calm_wellness template timeline
    const calmTimeline = {
      ...timeline,
      config: { ...timeline.config, finishingTemplate: 'calm_wellness' }
    };
    const calmDir = path.join(tmpDir, 'ov_calm');
    const calmRes = await renderPlaywrightOverlay({ outputDir: calmDir, timeline: calmTimeline });
    assert.ok(calmRes.imagePattern && fs.existsSync(calmRes.imagePattern.replace('%05d', '00001')));

    const camChain = buildCameraMotionFilterChain({
      inputLabel: '0:v',
      outputLabel: 'cam',
      width: 720,
      height: 1280,
      fps: 30,
      upscaleFactor: 3,
      clipOffsets,
      punchTimestamps: [2.3],
      totalDuration: dur
    });
    assert.ok(camChain.filter.includes('scale=2160:3840:flags=lanczos'));
    assert.ok(camChain.filter.includes('zoompan='));

    const audioMix = buildPlaywrightAudioMix({
      sfxCues: timeline.sfx,
      totalDuration: dur,
      loudnessTarget: -14
    });

    const inputs = ['-y', '-i', baseVid, '-framerate', '30', '-i', ovRes.imagePattern];
    for (const sfxPath of audioMix.extraAudioInputs) {
      inputs.push('-i', sfxPath);
    }
    const filterComplex = [
      camChain.filter,
      '[1:v]format=rgba[ov]',
      '[cam][ov]overlay=0:0:eof_action=pass:format=auto,format=yuv420p[vout]',
      audioMix.audioFilterComplex
    ].join(';');

    execFileSync(FFMPEG_BIN, [
      ...inputs,
      '-filter_complex', filterComplex,
      '-map', '[vout]',
      '-map', audioMix.audioOutLabel,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k',
      '-t', String(dur),
      finalOut
    ], { stdio: 'pipe' });

    assert.ok(fs.existsSync(finalOut));
    const ebur = spawnSync(FFMPEG_BIN, [
      '-i', finalOut, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'
    ], { encoding: 'utf8' });
    const match = (ebur.stderr || '').match(/I:\s*(-?\d+(?:\.\d+)?)\s*LUFS/);
    assert.ok(match, `Expected Integrated LUFS in stderr, got: ${(ebur.stderr || '').slice(-300)}`);
    const lufs = Number(match[1]);
    assert.ok(lufs >= -15.5 && lufs <= -12.5, `Expected -14 ± 1.5 LUFS, got ${lufs}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('F2-T4: Operator presets default finishing_template=none, caption_mode=hybrid, loudness_target=-14 without forbidden style literals & propagate cleanly', async () => {
  const presets = listOperatorPresets();
  assert.ok(presets.length >= 5);
  const forbiddenWorkflowKeys = ['accentColor', 'accent_color', 'ctaText', 'cta_text', 'isHerbalProduct', 'is_herbal_product', 'brandText'];
  for (const p of presets) {
    const wf = p?.config?.workflow || {};
    assert.equal(wf.finishing_template, 'none', `Preset ${p.key} must default finishing_template='none'`);
    assert.equal(wf.caption_mode, 'hybrid', `Preset ${p.key} must default caption_mode='hybrid'`);
    assert.equal(wf.loudness_target, -14, `Preset ${p.key} must default loudness_target=-14`);
    for (const fk of forbiddenWorkflowKeys) {
      assert.equal(Object.prototype.hasOwnProperty.call(wf, fk), false, `Preset ${p.key}.workflow must NOT define ${fk}`);
    }
  }

  // Override precedence: override -> preset -> default
  const resolvedPreset = resolveOperatorPreset(presets[0].key, {
    workflow: { finishing_template: 'recipe_pop', caption_mode: 'keyword_only', loudness_target: -16 }
  });
  assert.equal(resolvedPreset.workflow.finishing_template, 'recipe_pop');
  assert.equal(resolvedPreset.workflow.caption_mode, 'keyword_only');
  assert.equal(resolvedPreset.workflow.loudness_target, -16);

  // Legacy NULL fallback stays 'full', explicit finishing_template propagates
  const preLegacy = await resolvePreRenderFinishingMeta({
    campaign: { caption_mode: null, finishing_template: null }
  });
  assert.equal(preLegacy.captionMode, 'full');
  assert.equal(preLegacy.finishingTemplate, 'none');

  const preOverride = await resolvePreRenderFinishingMeta({
    campaign: { caption_mode: 'hybrid', finishing_template: 'calm_wellness', loudness_target: -16 },
    item: { new_caption: 'Deskripsi campaign' }
  });
  assert.equal(preOverride.captionMode, 'hybrid');
  assert.equal(preOverride.finishingTemplate, 'calm_wellness');
  assert.equal(preOverride.loudnessTarget, -16);
  assert.equal(preOverride.captionText, 'Deskripsi campaign');

  assert.equal(suggestFinishingTemplate({ finishing_template: 'none' }), 'none');
  assert.equal(suggestFinishingTemplate({ preset_key: 'product_hard_sell', generate_recipe: 1 }), 'calm_wellness');
  assert.equal(suggestFinishingTemplate({ campaign_kind: 'recipe_campaign' }), 'recipe_pop');

  // Verify 7 R8.3 pipeline paths contain parameter propagation
  const r83Paths = [
    'lib/autonomous-engine.js',
    'lib/recipe-campaign-ingest.js',
    'lib/pillar-campaign-ingest.js',
    'lib/pillar-campaign-approval.js',
    'lib/custom-storyboard-pipeline.js',
    'lib/auto-pipeline-scheduler-runner.js',
    'app/api/v2/recipes/autonomous-pipeline/route.js',
    'apps/mcp/tools.mjs',
    'app/settings/presets/page.js'
  ];
  for (const rel of r83Paths) {
    const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
    assert.ok(src.includes('finishing_template'), `${rel} must propagate finishing_template`);
    assert.ok(src.includes('caption_mode'), `${rel} must propagate caption_mode`);
    assert.ok(src.includes('loudness_target'), `${rel} must propagate loudness_target`);
  }
});
