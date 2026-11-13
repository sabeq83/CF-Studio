import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

import {
  hasLeakedOverlayMarkup,
  stripTtsMarkupTags,
  sanitizeOverlayTextStrict
} from '../lib/tts-text-sanitizer.js';
import {
  isHerbalMedicalClaimPhrase,
  resolveIsHerbalProduct,
  resolvePreRenderFinishingMeta
} from '../lib/tiktok-compliance-service.js';
import {
  ensureMotionFontsRegistered,
  measureFontTextWidth
} from '../lib/motion-font-loader.js';
import {
  chunkCaptionWords,
  cleanHookCardTitle,
  fitHookCard,
  renderGlobalTimelineOverlay
} from '../lib/motion-text-engine.js';
import {
  alignClipWordsTier3,
  buildGlobalTimelineWords
} from '../lib/word-alignment-engine.js';

const FFMPEG_BIN = (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH))
  ? process.env.FFMPEG_PATH
  : (fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg');

function writePcmWav(filePath, sampleRate, samplesFloat) {
  const numSamples = samplesFloat.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samplesFloat[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filePath, buffer);
}

test('F0-T2: strict overlay sanitizer strips leaked pause & stage tags', () => {
  assert.equal(hasLeakedOverlayMarkup('Rolled Oat <#1.0#> 100% murni'), true);
  assert.equal(hasLeakedOverlayMarkup('Rolled Oat &lt;#1.0#&gt; 100% murni'), true);
  assert.equal(hasLeakedOverlayMarkup('Minum pagi (breath) [pause] setiap hari'), true);

  assert.equal(
    stripTtsMarkupTags('Kuncinya pakai Rolled Oat <#1.0#> 100% murni'),
    'Kuncinya pakai Rolled Oat 100% murni'
  );
  assert.equal(
    sanitizeOverlayTextStrict('Kuncinya pakai Rolled Oat &lt;#1.0#&gt; (breath) [pause]'),
    'Kuncinya pakai Rolled Oat'
  );
  assert.equal(hasLeakedOverlayMarkup(sanitizeOverlayTextStrict('Tes <#0.8#> (sigh) normal')), false);
});

test('F0-T2: herbal classification defaults conservative & medical claim blocker works', async () => {
  assert.equal(isHerbalMedicalClaimPhrase('Hasil lab kolesterol naik lagi padahal sudah jaga makan?'), true);
  assert.equal(isHerbalMedicalClaimPhrase('Rahasia Tubuh Hangat Alami'), false);

  assert.equal(resolveIsHerbalProduct({}), true);
  assert.equal(resolveIsHerbalProduct({ category: 'Kesehatan & Minuman Herbal' }), true);
  assert.equal(resolveIsHerbalProduct({ category: 'Peralatan Dapur', productName: 'Wajan Anti Lengket' }), false);

  const meta = await resolvePreRenderFinishingMeta({
    item: {
      yt_title: 'Hasil lab kolesterol naik lagi padahal sudah jaga makan?'
    },
    campaign: {
      name: 'Kempen Minuman Herbal'
    }
  });
  assert.equal(meta.isHerbalProduct, true);
  assert.equal(meta.hookTitle, 'Hasil lab kolesterol naik lagi padahal sudah jaga makan?');
});

test('F0-T1 & F0-T3: OFL fonts measure distinctly & fitHookCard enforces medical claim + width/line guards', () => {
  ensureMotionFontsRegistered();
  const antonWidth = measureFontTextWidth('Anton-Regular.ttf', 100, 'SARAPAN SEHAT', 2);
  const montWidth = measureFontTextWidth('Montserrat-Black.ttf', 100, 'SARAPAN SEHAT', 0);
  assert.ok(antonWidth > 450 && antonWidth < 700, `Expected Anton width ~580-630, got ${antonWidth}`);
  assert.ok(montWidth > antonWidth + 150, `Expected Montserrat Black wider than Anton, got ${montWidth} vs ${antonWidth}`);

  // Regression opc_2117: medical claim + >38 chars -> blocked (null)
  assert.equal(
    fitHookCard('Hasil lab kolesterol naik lagi padahal sudah jaga makan?', {
      isHerbalProduct: true,
      width: 720,
      height: 1280
    }),
    null
  );

  // Regression opc_2117 even if shorter but still medical claim under herbal product -> null
  assert.equal(
    fitHookCard('Cara cepat turunkan kolesterol', {
      isHerbalProduct: true,
      width: 720,
      height: 1280
    }),
    null
  );

  // Regression mul_261113_qt67yl: strip #Shorts & block >38 chars -> null
  assert.equal(
    cleanHookCardTitle('Bikin Brownies Tanpa Gula Cuma 3 Bahan Lembut Banget #Shorts'),
    'Bikin Brownies Tanpa Gula Cuma 3 Bahan Lembut Banget'
  );
  assert.equal(
    fitHookCard('Bikin Brownies Tanpa Gula Cuma 3 Bahan Lembut Banget #Shorts', {
      isHerbalProduct: false,
      width: 720,
      height: 1280
    }),
    null
  );

  // Valid short hook wraps cleanly into <= 2 lines within 88% canvas width (633.6px)
  const validHook = fitHookCard('Rahasia Tubuh Hangat Alami #Shorts', {
    isHerbalProduct: true,
    width: 720,
    height: 1280
  });
  assert.ok(validHook, 'Expected valid hook card layout');
  assert.ok(validHook.lineCount >= 1 && validHook.lineCount <= 2);
  assert.ok(validHook.l1Ratio >= 0.08 && validHook.l1Ratio <= 0.13);
  assert.ok(!validHook.l1.includes('#SHORTS') && !validHook.l2.includes('#SHORTS'));
  const w1 = measureFontTextWidth('Anton-Regular.ttf', validHook.l1FontSize, validHook.l1, validHook.l1FontSize * 0.01);
  assert.ok(w1 <= 720 * 0.88 + 1);
  if (validHook.l2) {
    const w2 = measureFontTextWidth('Anton-Regular.ttf', validHook.l2FontSize, validHook.l2, validHook.l2FontSize * 0.01) + 720 * 0.06;
    assert.ok(w2 <= 720 * 0.88 + 1);
  }
});

test('F0-T3: chunkCaptionWords creates 2-4 word chunks without leaked tags', () => {
  const words = [
    { w: 'Kuncinya', s: 0.0, e: 0.3, c: 0 },
    { w: 'pakai', s: 0.3, e: 0.55, c: 0 },
    { w: '<#1.0#>', s: 0.55, e: 0.6, c: 0 },
    { w: 'Rolled', s: 0.6, e: 0.9, c: 0 },
    { w: 'Oat', s: 0.9, e: 1.1, c: 0 },
    { w: 'murni,', s: 1.1, e: 1.4, c: 0 },
    { w: 'tanpa', s: 1.5, e: 1.8, c: 1 },
    { w: 'campuran.', s: 1.8, e: 2.2, c: 1 }
  ];
  const chunks = chunkCaptionWords(words);
  assert.ok(chunks.length >= 2);
  for (const ch of chunks) {
    assert.ok(ch.length >= 1 && ch.length <= 4);
    for (const item of ch) {
      assert.equal(hasLeakedOverlayMarkup(item.w), false);
    }
  }

  // Long 4-word Indonesian phrase must split cleanly before exceeding ~16 chars so edges never clip
  const longPhraseChunks = chunkCaptionWords([
    { w: 'madu', s: 0, e: 0.4, c: 2 },
    { w: 'mentah', s: 0.4, e: 0.8, c: 2 },
    { w: 'dan', s: 0.8, e: 1.1, c: 2 },
    { w: 'bawang', s: 1.1, e: 1.5, c: 2 },
    { w: 'lanang', s: 1.5, e: 1.9, c: 2 },
    { w: 'pilihan', s: 1.9, e: 2.3, c: 2 }
  ]);
  for (const ch of longPhraseChunks) {
    assert.ok(ch.map(x => x.w).join(' ').length <= 16, `Chunk too wide: ${ch.map(x => x.w).join(' ')}`);
  }
});

test('F0-T3: alignClipWordsTier3 splits around ffmpeg silencedetect gaps & applies weights', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f0-align-'));
  try {
    const wavPath = path.join(tmpDir, 'two_clauses.wav');
    const sr = 16000;
    const totalSec = 2.6;
    const samples = new Float32Array(Math.floor(sr * totalSec));
    // Speech island 1: 0.05s - 0.95s
    for (let i = Math.floor(0.05 * sr); i < Math.floor(0.95 * sr); i++) {
      samples[i] = 0.25 * Math.sin((2 * Math.PI * 220 * i) / sr);
    }
    // Silence gap: 0.95s - 1.55s (0.60s > 0.08s)
    // Speech island 2: 1.55s - 2.50s
    for (let i = Math.floor(1.55 * sr); i < Math.floor(2.50 * sr); i++) {
      samples[i] = 0.25 * Math.sin((2 * Math.PI * 330 * i) / sr);
    }
    writePcmWav(wavPath, sr, samples);

    const aligned = await alignClipWordsTier3({
      audioPath: wavPath,
      text: 'Kuncinya pakai <#1.0#> oat, tanpa campuran!',
      duration: totalSec
    });

    assert.equal(aligned.source, 'silencedetect_tier3');
    assert.equal(aligned.words.length, 5);
    assert.deepEqual(
      aligned.words.map((w) => w.w),
      ['Kuncinya', 'pakai', 'oat,', 'tanpa', 'campuran!']
    );
    // Clause 1 ('Kuncinya pakai oat,') should stay before/near the silence gap, Clause 2 ('tanpa campuran!') should sit in island 2
    assert.ok(aligned.words[2].e <= 1.15, `Expected clause 1 end <= 1.15, got ${aligned.words[2].e}`);
    assert.ok(aligned.words[3].s >= 1.4, `Expected clause 2 start >= 1.4, got ${aligned.words[3].s}`);

    const { wordEvents } = buildGlobalTimelineWords({
      clips: [
        { duration: totalSec, words: aligned.words },
        { duration: 1.0, words: [{ w: 'mantap', s: 0.0, e: 0.9 }] }
      ],
      xfadeOverlapSec: 0
    });
    assert.equal(wordEvents[wordEvents.length - 1].c, 1);
    assert.ok(wordEvents[wordEvents.length - 1].s >= totalSec - 0.01);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('F0-T3 & F0-T4: renderGlobalTimelineOverlay + ffmpeg overlay + EBU R128 loudnorm (-14 LUFS)', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'f0-render-'));
  try {
    const baseVid = path.join(tmpDir, 'base.mp4');
    const finalVid = path.join(tmpDir, 'final.mp4');
    const overlayDir = path.join(tmpDir, 'ov');

    // Generate 2s silent-ish loud tone base video (720x1280 @ 30fps, 440Hz tone @ -3dBFS)
    execFileSync(FFMPEG_BIN, [
      '-y',
      '-f', 'lavfi', '-i', 'color=c=0x1e293b:s=720x1280:r=30:d=2',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=2',
      '-af', 'volume=-3dB',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k',
      baseVid
    ], { stdio: 'ignore' });

    const hookCard = fitHookCard('Rahasia Tubuh Hangat Alami', {
      isHerbalProduct: true,
      width: 720,
      height: 1280
    });
    const overlayRes = await renderGlobalTimelineOverlay({
      outputDir: overlayDir,
      wordEvents: [
        { w: 'Minum', s: 0.0, e: 0.5, clipIndex: 0 },
        { w: 'hangat', s: 0.5, e: 1.0, clipIndex: 0 },
        { w: 'setiap', s: 1.0, e: 1.5, clipIndex: 0 },
        { w: 'pagi', s: 1.5, e: 2.0, clipIndex: 0 }
      ],
      hookCard,
      hookDuration: 1.75,
      width: 720,
      height: 1280,
      fps: 30,
      totalDuration: 2.0
    });

    assert.ok(overlayRes.success && overlayRes.uniquePngCount >= 2);
    assert.ok(fs.existsSync(overlayRes.ffconcatPath));

    execFileSync(FFMPEG_BIN, [
      '-y',
      '-i', baseVid,
      '-f', 'concat', '-safe', '0', '-i', overlayRes.ffconcatPath,
      '-filter_complex', `[1:v]fps=30,format=rgba[ov];[0:v][ov]overlay=0:0:shortest=1[vout];[0:a]loudnorm=I=-14:TP=-1.0:LRA=11[aout]`,
      '-map', '[vout]', '-map', '[aout]',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      finalVid
    ], { stdio: 'ignore' });

    assert.ok(fs.existsSync(finalVid));

    // Measure final integrated loudness with ffmpeg loudnorm measurement pass
    const measure = spawnSync(FFMPEG_BIN, [
      '-i', finalVid,
      '-af', 'loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json',
      '-f', 'null', '-'
    ], { encoding: 'utf8' });
    const stderr = measure.stderr || '';
    const jsonMatch = stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
    assert.ok(jsonMatch, `Expected loudnorm JSON output, got:\n${stderr}`);
    const stats = JSON.parse(jsonMatch[0]);
    const measuredLufs = Number(stats.input_i);
    assert.ok(
      measuredLufs >= -15.5 && measuredLufs <= -12.5,
      `Expected loudness near -14 LUFS (-15.5..-12.5), got ${measuredLufs}`
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
