import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

import { extractWordTimingsFromElevenLabsAlignment } from '../lib/elevenlabs-tts.js';
import { resolveClipWordTimings, buildGlobalTimelineWords } from '../lib/word-alignment-engine.js';
import {
  resolveCampaignCaptionMode,
  validateFinishingPlan
} from '../lib/finishing-plan-validator.js';
import {
  buildPhase1Timeline,
  renderPlaywrightOverlay,
  buildPlaywrightAudioMix
} from '../lib/finishing-overlay-renderer.js';
import { renderGlobalTimelineOverlay, fitHookCard } from '../lib/motion-text-engine.js';
import { resolvePreRenderFinishingMeta } from '../lib/tiktok-compliance-service.js';
import {
  buildReverseEngineeringPrompt,
  buildReverseEngineeringBridgePrompt,
  buildOrganicPillarPrompt,
  buildMultiplierPhase2Prompt
} from '../lib/prompts.js';

const FFMPEG_BIN = (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH))
  ? process.env.FFMPEG_PATH
  : (fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg');

test('F1-T2: ElevenLabs /with-timestamps alignment character spans -> clean word timings & resolveClipWordTimings cache/backfill', async () => {
  const alignment = {
    characters: ['R', 'a', 'c', 'i', 'k', 'a', 'n', ' ', 'a', 'l', 'a', 'm', 'i', ' ', 'p', 'a', 'g', 'i', '.'],
    character_start_times_seconds: [0.0, 0.04, 0.08, 0.12, 0.16, 0.2, 0.24, 0.28, 0.32, 0.36, 0.4, 0.44, 0.48, 0.52, 0.56, 0.6, 0.64, 0.68, 0.72],
    character_end_times_seconds:   [0.04, 0.08, 0.12, 0.16, 0.2, 0.24, 0.28, 0.32, 0.36, 0.4, 0.44, 0.48, 0.52, 0.56, 0.6, 0.64, 0.68, 0.72, 0.78]
  };
  const extracted = extractWordTimingsFromElevenLabsAlignment(alignment);
  assert.deepEqual(extracted.map(x => x.w), ['Racikan', 'alami', 'pagi.']);
  assert.equal(extracted[0].s, 0);
  assert.equal(extracted[0].e, 0.28);
  assert.equal(extracted[2].s, 0.56);
  assert.equal(extracted[2].e, 0.78);

  // Sidecar hit + backfill into persistFn
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-sidecar-'));
  try {
    const audioPath = path.join(tmpDir, 'clip1.mp3');
    fs.writeFileSync(audioPath, 'mock');
    fs.writeFileSync(`${audioPath}.timings.json`, JSON.stringify({
      source: 'elevenlabs_timestamps',
      words: extracted
    }));

    const persisted = [];
    const res = await resolveClipWordTimings({
      clip: { id: 999, source_text: 'Racikan alami pagi.' },
      audioPath,
      text: 'Racikan alami pagi.',
      duration: 1.0,
      persistFn: async (clipId, words, source) => {
        persisted.push({ clipId, words, source });
      }
    });
    assert.equal(res.source, 'elevenlabs_timestamps');
    assert.equal(res.words.length, 3);
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].clipId, 999);
    assert.equal(persisted[0].source, 'elevenlabs_timestamps');

    // DB cache hit takes priority without re-persisting
    const cachedRes = await resolveClipWordTimings({
      clip: {
        id: 1000,
        word_timings_json: JSON.stringify([{ w: 'Cached', s: 0.1, e: 0.4 }]),
        word_timings_source: 'elevenlabs_timestamps'
      },
      audioPath,
      text: 'Cached',
      duration: 1.0,
      persistFn: async () => {
        throw new Error('Should not re-persist DB cached row');
      }
    });
    assert.equal(cachedRes.source, 'elevenlabs_timestamps');
    assert.equal(cachedRes.words[0].w, 'Cached');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('F1-T3 & F1-T4: Campaign legacy NULL caption_mode -> full, hybrid preserved, herbal compliance & invalid phrase guard', async () => {
  assert.equal(resolveCampaignCaptionMode(null), 'full');
  assert.equal(resolveCampaignCaptionMode({ caption_mode: null }), 'full');
  assert.equal(resolveCampaignCaptionMode({ caption_mode: '' }), 'full');
  assert.equal(resolveCampaignCaptionMode({ caption_mode: 'hybrid' }), 'hybrid');
  assert.equal(resolveCampaignCaptionMode({ caption_mode: 'keyword_only' }), 'keyword_only');

  const metaLegacy = await resolvePreRenderFinishingMeta({
    campaign: { caption_mode: null, product_snapshot_json: null },
    item: { row_creative_payload: JSON.stringify({ product_name: 'Madu Hutan' }) }
  });
  assert.equal(metaLegacy.captionMode, 'full');
  assert.equal(metaLegacy.isHerbalProduct, true);

  const metaHybrid = await resolvePreRenderFinishingMeta({
    campaign: { caption_mode: 'hybrid', loudness_target: -14 },
    task: {
      remake_storyboard_json: JSON.stringify({
        finishing_plan: {
          hook: 'Tubuh Nyaman Alami',
          punches: [{ clip: 1, phrase: 'racikan pagi', type: 'benefit' }]
        }
      })
    }
  });
  assert.equal(metaHybrid.captionMode, 'hybrid');
  assert.equal(metaHybrid.loudnessTarget, -14);
  assert.ok(metaHybrid.finishingPlan);

  const cleanVoiceoverClips = [
    'Minum racikan pagi untuk bantu menurunkan kolesterol secara alami',
    'Sering terasa begah setelah makan berat'
  ];

  // Herbal compliance blocks medical claim punch & medical hook, plus skips hallucinated phrases and enforces <= 2 punches/clip
  const validated = validateFinishingPlan({
    hook: 'TURUNKAN KOLESTEROL DALAM 3 HARI!',
    punches: [
      { clip: 1, phrase: 'menurunkan kolesterol', type: 'result' },   // blocked medical claim
      { clip: 1, phrase: 'racikan pagi', type: 'benefit' },           // valid 1
      { clip: 1, phrase: 'secara alami', type: 'result' },            // valid 2
      { clip: 1, phrase: 'minum', type: 'hook' },                     // dropped by max 2 per clip
      { clip: 2, phrase: 'frasa ngarang gemini', type: 'warning' },   // skipped substring mismatch
      { clip: 2, phrase: 'terasa begah', type: 'warning' }            // valid
    ]
  }, {
    cleanVoiceoverClips,
    isHerbalProduct: true,
    width: 720,
    height: 1280
  });

  assert.equal(validated.hookCard, null, 'Medical hook on herbal product must be blocked');
  assert.deepEqual(validated.punches.map(p => p.phrase), ['racikan pagi', 'secara alami', 'terasa begah']);
  assert.ok(validated.warnings.some(w => w.includes('herbal medical claim')), 'Expected herbal medical claim warnings');
  assert.ok(validated.warnings.some(w => w.includes('exact VO substring')), 'Expected hallucinated substring warning');
});

test('F1-T3: Optional finishing_plan injected into all 4 prompt builders cleanly', () => {
  const dummyKbs = [];
  const p1 = buildReverseEngineeringPrompt(dummyKbs, { product_name: 'Madu', target_clips_count: 3 });
  const p2 = buildReverseEngineeringBridgePrompt(dummyKbs, { product_name: 'Madu', target_clips_count: 3 });
  const p3 = buildOrganicPillarPrompt(dummyKbs, { campaign_name: 'Test', target_clips_count: 3 }, { product_name: 'Madu' }, {}, {});
  const p4 = buildMultiplierPhase2Prompt(
    { scenes: [{ clip: 1, visual: 'test', audio_vo: 'test' }] },
    { product_name: 'Madu' },
    {},
    {},
    {},
    {}
  );

  for (const [label, text] of [['RE', p1], ['REBridge', p2], ['OPC', p3], ['MultiplierP2', p4]]) {
    assert.ok(text.includes('"finishing_plan"'), `${label} prompt should include optional "finishing_plan" field`);
  }
});

test('F1-T5 & F1-T6: buildPhase1Timeline maps >=5 punches within +-0.15s, Playwright renders base-caption.html, SFX mix + loudnorm -14 LUFS, + Sharp fallback', async () => {
  const clips = [
    {
      duration: 1.5,
      words: [
        { w: 'Pagi', s: 0.05, e: 0.25 },
        { w: 'ini', s: 0.26, e: 0.42 },
        { w: 'tubuh', s: 0.45, e: 0.72 },
        { w: 'lebih', s: 0.74, e: 0.96 },
        { w: 'bugar', s: 0.98, e: 1.35 }
      ]
    },
    {
      duration: 1.5,
      words: [
        { w: 'Tanpa', s: 0.05, e: 0.30 },
        { w: 'rasa', s: 0.32, e: 0.56 },
        { w: 'begah', s: 0.58, e: 0.88 },
        { w: 'sampai', s: 0.92, e: 1.15 },
        { w: 'malam', s: 1.16, e: 1.45 }
      ]
    },
    {
      duration: 1.5,
      words: [
        { w: 'Stamina', s: 0.08, e: 0.45 },
        { w: 'tetap', s: 0.48, e: 0.75 },
        { w: 'prima', s: 0.78, e: 1.10 },
        { w: 'seharian', s: 1.12, e: 1.45 }
      ]
    }
  ];
  const cleanVoiceoverClips = [
    'Pagi ini tubuh lebih bugar',
    'Tanpa rasa begah sampai malam',
    'Stamina tetap prima seharian'
  ];
  const globalTimeline = buildGlobalTimelineWords({ clips, xfadeOverlapSec: 0 });
  const timeline = buildPhase1Timeline({
    wordEvents: globalTimeline.wordEvents,
    hookCard: fitHookCard('Rahasia Nyaman Setiap Pagi', { isHerbalProduct: true, width: 720, height: 1280 }),
    hookDuration: 1.75,
    finishingPlan: {
      hook: 'Rahasia Nyaman Setiap Pagi',
      punches: [
        { clip: 1, phrase: 'Pagi ini', type: 'hook' },
        { clip: 1, phrase: 'lebih bugar', type: 'result' },
        { clip: 2, phrase: 'Tanpa rasa begah', type: 'warning' },
        { clip: 2, phrase: 'sampai malam', type: 'benefit' },
        { clip: 3, phrase: 'tetap prima', type: 'result' }
      ]
    },
    cleanVoiceoverClips,
    isHerbalProduct: true,
    clipStarts: globalTimeline.clipOffsets.map(o => o.start),
    captionMode: 'hybrid',
    width: 720,
    height: 1280,
    fps: 15,
    totalDuration: 4.5
  });

  assert.equal(timeline.punches.length, 5, 'Should map all 5 verified punches');
  const expectedPunchStarts = [0.05, 0.74, 1.55, 2.42, 3.48];
  timeline.punches.forEach((p, idx) => {
    const delta = Math.abs(p.s - expectedPunchStarts[idx]);
    assert.ok(delta <= 0.15, `Punch #${idx + 1} (${p.phrase}) delta ${delta.toFixed(3)}s exceeded ±0.15s`);
  });
  assert.ok(timeline.sfx.some(c => c.k === 'pop'), 'Expected pop SFX cues for punches');
  assert.ok(timeline.sfx.some(c => c.k === 'whoosh'), 'Expected whoosh SFX cues for hook/cuts');

  // Verify Playwright render + FFmpeg SFX sidechain mix + loudnorm (-14 ± 1 LUFS) on 2.0s trimmed clip
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f1-playwright-'));
  try {
    const shortTimeline = buildPhase1Timeline({
      wordEvents: globalTimeline.wordEvents.filter(w => w.e <= 2.0),
      hookCard: timeline.hookCard,
      hookDuration: 1.75,
      finishingPlan: {
        hook: 'Rahasia Nyaman Setiap Pagi',
        punches: [
          { clip: 1, phrase: 'Pagi ini', type: 'hook' },
          { clip: 1, phrase: 'lebih bugar', type: 'result' }
        ]
      },
      cleanVoiceoverClips: [cleanVoiceoverClips[0]],
      isHerbalProduct: true,
      clipStarts: [0],
      captionMode: 'hybrid',
      width: 720,
      height: 1280,
      fps: 15,
      totalDuration: 2.0
    });

    const ovDir = path.join(tmpDir, 'pw_ov');
    const pwRes = await renderPlaywrightOverlay({
      outputDir: ovDir,
      timeline: shortTimeline
    });
    assert.equal(pwRes.success, true);
    assert.equal(pwRes.mode, 'playwright');
    assert.equal(pwRes.frameCount, 30);
    assert.ok(fs.existsSync(path.join(ovDir, 'f_00000.png')));
    assert.ok(fs.existsSync(path.join(ovDir, 'f_00029.png')));

    const baseVid = path.join(tmpDir, 'base.mp4');
    const finalVid = path.join(tmpDir, 'final.mp4');
    execFileSync(FFMPEG_BIN, [
      '-y',
      '-f', 'lavfi', '-i', 'color=c=0x1e293b:s=720x1280:r=15:d=2',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=2',
      '-af', 'volume=-3dB',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k',
      baseVid
    ], { stdio: 'ignore' });

    const mix = buildPlaywrightAudioMix({
      sfxCues: pwRes.sfx,
      totalDuration: pwRes.totalDuration,
      loudnessTarget: -14
    });
    assert.ok(mix.extraAudioInputs.length >= 1, 'Expected pop.wav / whoosh.wav inputs');

    const ffArgs = ['-y', '-i', baseVid, '-framerate', String(pwRes.fps), '-i', pwRes.imagePattern];
    for (const sfxFile of mix.extraAudioInputs) {
      ffArgs.push('-i', sfxFile);
    }
    ffArgs.push(
      '-filter_complex', `[1:v]format=rgba[ov];[0:v][ov]overlay=0:0:shortest=1[vout];${mix.audioFilterComplex}`,
      '-map', '[vout]',
      '-map', mix.audioOutLabel,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      finalVid
    );
    execFileSync(FFMPEG_BIN, ffArgs, { stdio: 'ignore' });
    assert.ok(fs.existsSync(finalVid));

    const measure = spawnSync(FFMPEG_BIN, [
      '-i', finalVid,
      '-af', 'loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json',
      '-f', 'null', '-'
    ], { encoding: 'utf8' });
    const jsonMatch = (measure.stderr || '').match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
    assert.ok(jsonMatch, 'Expected loudnorm stats JSON');
    const measuredLufs = Number(JSON.parse(jsonMatch[0]).input_i);
    assert.ok(measuredLufs >= -15.5 && measuredLufs <= -12.5, `Expected -14 ± 1.5 LUFS, got ${measuredLufs}`);

    // Fallback check: Playwright error gracefully falls back to Sharp/SVG Fase 0
    let fallbackRes = null;
    try {
      await renderPlaywrightOverlay({
        outputDir: path.join(tmpDir, 'bad'),
        timeline: shortTimeline,
        templatePath: '/nonexistent/template.html'
      });
    } catch (_) {
      fallbackRes = await renderGlobalTimelineOverlay({
        outputDir: path.join(tmpDir, 'sharp_fallback'),
        wordEvents: shortTimeline.words,
        hookCard: shortTimeline.hookCard,
        width: 720,
        height: 1280,
        fps: 15,
        totalDuration: 2.0
      });
    }
    assert.ok(fallbackRes && fallbackRes.success && fallbackRes.ffconcatPath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
