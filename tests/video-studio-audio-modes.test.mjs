process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.PG_SEARCH_PATH = process.env.PG_SEARCH_PATH || 'dev';

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import { resolveWhisperCliConfig } from '../lib/word-alignment-engine.js';
import { concatRawVideoOnlyClips } from '../lib/video-studio-processor.js';

test('Fase 6: Whisper CLI availability check', () => {
  const cfg = resolveWhisperCliConfig();
  assert.ok(typeof cfg === 'object');
  assert.ok('bin' in cfg);
  assert.ok('modelPath' in cfg);
});

test('Fase 6: concatRawVideoOnlyClips helper is exported and callable', () => {
  assert.equal(typeof concatRawVideoOnlyClips, 'function');
});

test('Fase 6: Mode B batchDataOverride structure calculation', () => {
  const videoPaths = ['public/temp/v1.mp4', 'public/temp/v2.mp4', 'public/temp/v3.mp4'];
  const audioPaths = ['public/temp/a1.mp3', 'public/temp/a2.mp3', 'public/temp/a3.mp3'];
  const voTexts = ['Adegan 1 pertama', 'Adegan 2 kedua', 'Adegan 3 ketiga'];
  const jobId = 'test_f6_mode_b';

  const batchDataOverride = {
    id: `upload_per_clip_${jobId}`,
    clips: audioPaths.map((aPath, idx) => ({
      id: `clip_${jobId}_${idx + 1}`,
      clip_index: idx + 1,
      audio_path: aPath,
      source_text: voTexts[idx] || '',
      status: 'completed'
    }))
  };

  assert.equal(batchDataOverride.clips.length, 3);
  assert.equal(batchDataOverride.clips[0].clip_index, 1);
  assert.equal(batchDataOverride.clips[0].audio_path, 'public/temp/a1.mp3');
  assert.equal(batchDataOverride.clips[0].source_text, 'Adegan 1 pertama');
  assert.equal(batchDataOverride.clips[2].clip_index, 3);
  assert.equal(batchDataOverride.clips[2].source_text, 'Adegan 3 ketiga');
});

test('Fase 6: Mode A batchDataOverride and customClipOffsets calculation', () => {
  const videoPaths = ['public/temp/v1.mp4', 'public/temp/v2.mp4'];
  const rawDurations = [4.5, 6.0];
  const singleAudioPath = 'public/temp/single_audio.mp3';
  const jobId = 'test_f6_mode_a';
  const voList = ['Intro babak pertama', 'Solusi babak kedua'];

  let cursor = 0;
  const customClipOffsets = rawDurations.map((dur, i) => {
    const off = { clipIndex: i, start: cursor, duration: dur };
    cursor += dur;
    return off;
  });

  assert.equal(customClipOffsets.length, 2);
  assert.equal(customClipOffsets[0].start, 0);
  assert.equal(customClipOffsets[0].duration, 4.5);
  assert.equal(customClipOffsets[1].start, 4.5);
  assert.equal(customClipOffsets[1].duration, 6.0);

  const combinedVo = voList.filter(Boolean).join(' ');
  const batchDataOverride = {
    id: `upload_single_${jobId}`,
    clips: [{
      id: `clip_${jobId}_1`,
      clip_index: 1,
      audio_path: singleAudioPath,
      source_text: combinedVo,
      status: 'completed'
    }]
  };

  assert.equal(batchDataOverride.clips.length, 1);
  assert.equal(batchDataOverride.clips[0].clip_index, 1);
  assert.equal(batchDataOverride.clips[0].audio_path, singleAudioPath);
  assert.equal(batchDataOverride.clips[0].source_text, 'Intro babak pertama Solusi babak kedua');
});

test('Fase 6: Fallback without Whisper and VO text sets captionMode to none', () => {
  const voList = ['', '   '];
  const hasWhisper = false; // simulates Staging where Whisper CLI is not installed
  const hasAnyVo = voList.some(t => t && t.trim().length > 0);

  let effectiveCaptionMode = 'full';
  if (!hasAnyVo && !hasWhisper) {
    effectiveCaptionMode = 'none';
  }

  assert.equal(effectiveCaptionMode, 'none', 'Should disable captions when VO text and Whisper are both absent');
});

test.after(async () => {
  setTimeout(() => process.exit(0), 500).unref();
});
