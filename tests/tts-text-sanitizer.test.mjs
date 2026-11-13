process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  shouldInjectMinimaxMicroActing,
  stripTtsMarkupTags,
  prepareTtsSpeechText,
  sanitizeVoiceoverItems
} from '../lib/tts-text-sanitizer.js';
import {
  buildMultiplierPhase2Prompt,
  buildNarrationAgentPrompt,
  buildReverseEngineeringPrompt
} from '../lib/prompts.js';
import { generateMotionTextFrames } from '../lib/motion-text-engine.js';

after(() => {
  setTimeout(() => process.exit(0), 50);
});

test('shouldInjectMinimaxMicroActing hanya aktif jika enableTts && minimax && speech-2.8-hd', () => {
  assert.equal(shouldInjectMinimaxMicroActing(), false);
  assert.equal(
    shouldInjectMinimaxMicroActing({ enableTts: true, voiceProvider: 'minimax', ttsModelQuality: 'speech-2.8-turbo' }),
    false
  );
  assert.equal(
    shouldInjectMinimaxMicroActing({ enableTts: true, voiceProvider: 'gemini', ttsModelQuality: 'speech-2.8-hd' }),
    false
  );
  assert.equal(
    shouldInjectMinimaxMicroActing({ enableTts: true, voiceProvider: 'elevenlabs', ttsModelQuality: 'speech-2.8-hd' }),
    false
  );
  assert.equal(
    shouldInjectMinimaxMicroActing({ enableTts: false, voiceProvider: 'minimax', ttsModelQuality: 'speech-2.8-hd' }),
    false
  );
  assert.equal(
    shouldInjectMinimaxMicroActing({ enableTts: true, voiceProvider: 'minimax', ttsModelQuality: 'speech-2.8-hd' }),
    true
  );
});

test('stripTtsMarkupTags menghapus <#x#> dan interjeksi MiniMax sambil mempertahankan tanda kurung normal', () => {
  const sample = 'Kuncinya pakai Rolled Oat Premium Sahabat <#1.0#> 100% murni tanpa campuran bahan kimia apapun.';
  assert.equal(
    stripTtsMarkupTags(sample),
    'Kuncinya pakai Rolled Oat Premium Sahabat 100% murni tanpa campuran bahan kimia apapun.'
  );

  const mixed = '(breath) Campurkan oat (100 gram) lalu diamkan, <#0.5#> hasilnya lembut banget (laughs)!';
  assert.equal(
    stripTtsMarkupTags(mixed),
    'Campurkan oat (100 gram) lalu diamkan, hasilnya lembut banget!'
  );
});

test('prepareTtsSpeechText dan sanitizeVoiceoverItems mematikan tag di turbo/non-MiniMax dan mempertahankan hanya di speech-2.8-hd', () => {
  const raw = 'Halo Bunda, <#1.0#> cobain resep oat (100 gram) ini ya (sighs).';

  assert.equal(
    prepareTtsSpeechText(raw, { provider: 'minimax', modelQuality: 'speech-2.8-turbo' }),
    'Halo Bunda, cobain resep oat (100 gram) ini ya.'
  );
  assert.equal(
    prepareTtsSpeechText(raw, { provider: 'gemini', modelQuality: 'speech-2.8-hd' }),
    'Halo Bunda, cobain resep oat (100 gram) ini ya.'
  );
  assert.equal(
    prepareTtsSpeechText(raw, { provider: 'elevenlabs', modelQuality: 'speech-2.8-turbo' }),
    'Halo Bunda, cobain resep oat (100 gram) ini ya.'
  );
  assert.equal(
    prepareTtsSpeechText(raw, { provider: 'minimax', modelQuality: 'speech-2.8-hd' }),
    raw
  );

  const items = [
    {
      clip_number: 1,
      narration: 'Teks satu <#0.8#> (breath)',
      voice_over: 'Teks dua <#1.0#>',
      voice_segments: [{ text: 'Segmen satu <#0.5#> (laughs)' }]
    }
  ];

  const cleaned = sanitizeVoiceoverItems(items, {
    enableTts: true,
    voiceProvider: 'minimax',
    ttsModelQuality: 'speech-2.8-turbo'
  });
  assert.equal(cleaned[0].narration, 'Teks satu');
  assert.equal(cleaned[0].voice_over, 'Teks dua');
  assert.equal(cleaned[0].voice_segments[0].text, 'Segmen satu');

  const preserved = sanitizeVoiceoverItems(items, {
    enableTts: true,
    voiceProvider: 'minimax',
    ttsModelQuality: 'speech-2.8-hd'
  });
  assert.equal(preserved[0].narration, 'Teks satu <#0.8#> (breath)');
});

test('buildMultiplierPhase2Prompt & prompt builders lain menonaktifkan MINIMAX_MICRO_ACTING_MANDATE di turbo dan hanya aktif di speech-2.8-hd', () => {
  const product = {
    id: 'prod_test',
    product_name: 'Rolled Oat Premium',
    unique_selling_point: '100% murni tanpa campuran bahan kimia',
    product_truth: 'Glass jar of rolled oats'
  };

  const turboPrompt = buildMultiplierPhase2Prompt(
    [{ scene: 1, visual: 'Pour oats', voice_over: 'Pakai oat murni' }],
    product,
    { clip_duration: 4, words_per_clip: '8-9 kata' },
    { is_bridging_active: false, target_clips_count: 4 },
    { isVsoActive: false },
    { enable_tts: true, voice_provider: 'minimax' }
  );
  assert.equal(turboPrompt.includes('ATURAN MICRO-ACTING & PAUSE VOICEOVER (MANDATORY)'), false);
  assert.equal(turboPrompt.includes('<#detik#>'), false);

  const hdPrompt = buildMultiplierPhase2Prompt(
    [{ scene: 1, visual: 'Pour oats', voice_over: 'Pakai oat murni' }],
    product,
    { clip_duration: 4, words_per_clip: '8-9 kata' },
    { is_bridging_active: false, target_clips_count: 4 },
    { isVsoActive: false },
    { enable_tts: true, voice_provider: 'minimax', tts_model_quality: 'speech-2.8-hd' }
  );
  assert.equal(hdPrompt.includes('ATURAN MICRO-ACTING & PAUSE VOICEOVER (MANDATORY)'), true);
  assert.equal(hdPrompt.includes('<#detik#>'), true);

  const narrationTurbo = buildNarrationAgentPrompt(
    [],
    { topik: 'Sarapan Oat', core_conflict: 'Lapar cepat', hook_strategy: 'Fakta oat' },
    { enable_tts: true, voice_provider: 'minimax', tts_model_quality: 'speech-2.8-turbo' }
  );
  assert.equal(narrationTurbo.includes('ATURAN MICRO-ACTING & PAUSE VOICEOVER (MANDATORY)'), false);

  const narrationHd = buildNarrationAgentPrompt(
    [],
    { topik: 'Sarapan Oat', core_conflict: 'Lapar cepat', hook_strategy: 'Fakta oat' },
    { enable_tts: true, voice_provider: 'minimax', tts_model_quality: 'speech-2.8-hd' }
  );
  assert.equal(narrationHd.includes('ATURAN MICRO-ACTING & PAUSE VOICEOVER (MANDATORY)'), true);

  const reTurbo = buildReverseEngineeringPrompt([], {
    target_clips_count: 4,
    enable_tts: true,
    voice_provider: 'minimax',
    tts_model_quality: 'speech-2.8-turbo'
  });
  assert.equal(reTurbo.includes('ATURAN MICRO-ACTING & PAUSE VOICEOVER (MANDATORY)'), false);

  const reHd = buildReverseEngineeringPrompt([], {
    target_clips_count: 4,
    enable_tts: true,
    voice_provider: 'minimax',
    tts_model_quality: 'speech-2.8-hd'
  });
  assert.equal(reHd.includes('ATURAN MICRO-ACTING & PAUSE VOICEOVER (MANDATORY)'), true);
});

test('generateMotionTextFrames membersihkan tag TTS dari teks motion subtitle', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-text-sanitize-'));
  try {
    const onlyTagResult = await generateMotionTextFrames({
      outputDir: tmpDir,
      text: '  <#1.0#> (breath)  ',
      duration: 1,
      fps: 2
    });
    assert.deepEqual(onlyTagResult, { success: false, reason: 'Empty text' });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
