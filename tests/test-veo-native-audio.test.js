import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GOOGLE_VOICE_PERSONAS,
  compileVeoNativeAudioPrompt,
  isValidGoogleVoicePersona,
  getDefaultGoogleVoicePersona
} from '../lib/veo-native-audio.js';
import {
  listOperatorPresets,
  getOperatorPresetConfig,
  resolveOperatorPreset
} from '../lib/operator-presets.js';
import { resolveBrandRecipePreset } from '../lib/autonomous-engine.js';

test('1. Google Voice Personas Catalog Verification', () => {
  assert.ok(Array.isArray(GOOGLE_VOICE_PERSONAS), 'Catalog should be an array');
  assert.ok(GOOGLE_VOICE_PERSONAS.length >= 8, 'Should contain at least 8 official personas');

  const kore = GOOGLE_VOICE_PERSONAS.find(p => p.id === 'Kore');
  assert.ok(kore, 'Persona Kore must exist');
  assert.equal(kore.gender, 'female');
  assert.ok(kore.descriptionEn.toLowerCase().includes('warm'), 'Kore should be warm');

  const charon = GOOGLE_VOICE_PERSONAS.find(p => p.id === 'Charon');
  assert.ok(charon, 'Persona Charon must exist');
  assert.equal(charon.gender, 'male');
  assert.ok(charon.descriptionEn.toLowerCase().includes('deep'), 'Charon should be deep authoritative');

  // Helper validation
  assert.equal(isValidGoogleVoicePersona('Kore'), true);
  assert.equal(isValidGoogleVoicePersona('Charon'), true);
  assert.equal(isValidGoogleVoicePersona('NonExistentVoice'), false);
  assert.equal(getDefaultGoogleVoicePersona('id-ID'), 'Kore');
  assert.equal(getDefaultGoogleVoicePersona('en-US'), 'Puck');
});

test('2. Veo Native Audio Prompt Compilation', () => {
  const basePrompt = 'Cinematic close up of healthy smoothie being poured into a tall glass, warm studio lighting';
  const narration = 'Awali harimu dengan segelas nutrisi murni untuk energi maksimal.';

  const compiled = compileVeoNativeAudioPrompt({
    basePrompt,
    narrationText: narration,
    persona: 'Kore',
    language: 'id-ID',
    withSfx: true,
    withAmbience: true,
    antiMusic: true
  });

  assert.ok(compiled.includes(basePrompt), 'Compiled prompt must include base visual prompt');
  assert.ok(compiled.includes('Audio direction:'), 'Compiled prompt must contain Audio direction block');
  assert.ok(compiled.includes('[SPEECH / DIALOGUE]'), 'Compiled prompt must specify speech/dialogue block');
  assert.ok(compiled.includes(narration), 'Compiled prompt must include exact narration speech');
  assert.ok(compiled.includes('Indonesian feminine voice'), 'Compiled prompt should recognize Indonesian tone');
  assert.ok(compiled.includes('[SFX]'), 'Compiled prompt must contain Foley SFX instructions');
  assert.ok(compiled.includes('[AMBIENCE]'), 'Compiled prompt must contain Ambience instructions');
  assert.ok(compiled.toLowerCase().includes('background music'), 'Compiled prompt must contain anti-music guardrail');
});

test('3. Operator Preset Schema Verification with Mode 2 Fields', () => {
  // Test default operator presets contain audio engine keys
  const defaultPreset = getOperatorPresetConfig('brand_editorial_campaign');
  assert.ok(defaultPreset, 'Default brand_editorial_campaign must exist');
  assert.equal(defaultPreset.workflow.audio_engine_mode, 'minimax_tts');
  assert.equal(defaultPreset.workflow.google_voice_persona, 'Kore');
  assert.equal(defaultPreset.workflow.enable_native_sfx, true);
  assert.equal(defaultPreset.workflow.enable_native_ambience, true);
  assert.equal(defaultPreset.workflow.anti_music_guardrail, true);

  // Test resolving operator preset with custom Mode 2 override
  const resolved = resolveOperatorPreset('product_campaign', {
    audio_engine_mode: 'native_veo',
    google_voice_persona: 'Charon'
  });
  assert.ok(resolved, 'Resolved preset should not be null');
});

test('4. Autonomous Engine Preset Resolution for Mode 2', async () => {
  // Resolve preset for a brand recipe
  const resolved = await resolveBrandRecipePreset('habitfolk');
  assert.ok(resolved, 'Resolved preset should not be null');
  assert.ok('audio_engine_mode' in resolved, 'Resolved object must have audio_engine_mode');
  assert.ok('google_voice_persona' in resolved, 'Resolved object must have google_voice_persona');
  assert.ok('enable_native_sfx' in resolved, 'Resolved object must have enable_native_sfx');
  assert.ok('enable_native_ambience' in resolved, 'Resolved object must have enable_native_ambience');
  assert.ok('anti_music_guardrail' in resolved, 'Resolved object must have anti_music_guardrail');
});
