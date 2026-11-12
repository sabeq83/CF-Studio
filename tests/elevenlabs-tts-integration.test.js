import test from 'node:test';
import assert from 'node:assert/strict';
import { TENANT_STRICT_SECRETS, getSetting, setSetting, getDb } from '../lib/db.js';
import { closePgPool } from '../lib/db-pg.js';
import {
  ELEVENLABS_ID_VOICES,
  ELEVENLABS_EN_VOICES,
  ELEVENLABS_MODELS,
  getAvailableVoices,
  getDefaultVoicePersona
} from '../lib/voice-constants.js';
import { resolveElevenLabsVoice } from '../lib/elevenlabs-tts.js';

test.after(async () => {
  await closePgPool();
});

test('ElevenLabs Integration: Multi-Tenant Secret Isolation', async () => {
  assert.ok(TENANT_STRICT_SECRETS.has('elevenlabs_api_key'), 'elevenlabs_api_key must be registered in TENANT_STRICT_SECRETS');
});

test('ElevenLabs Integration: 28 Official Voice Personas Catalog Verification', () => {
  // 1. Indonesian Catalog (14 Voices: 7 Pria & 7 Wanita)
  assert.equal(ELEVENLABS_ID_VOICES.length, 14, 'Indonesian catalog must have exactly 14 voices');
  const idMaleVoices = ELEVENLABS_ID_VOICES.filter(v => v.gender === 'Male');
  const idFemaleVoices = ELEVENLABS_ID_VOICES.filter(v => v.gender === 'Female');
  assert.equal(idMaleVoices.length, 7, 'Must have 7 Indonesian male voices');
  assert.equal(idFemaleVoices.length, 7, 'Must have 7 Indonesian female voices');

  const expectedIdMaleIds = [
    'zmqLb9Ysr8fUvDD7hXK8',
    'TMvmhlKUioQA4U7LOoko',
    'q8qwd1jY2jS3AWOBeq25',
    'X8n8hOy3e8VLQnHTUcc5',
    'plgKUYgnlZ1DCNh54DwJ',
    'd888tBvGmQT2u05J1xTv',
    'ACRfKVNOAnzVitkYerdl'
  ];
  expectedIdMaleIds.forEach(id => {
    assert.ok(idMaleVoices.some(v => v.id === id), `Missing Indonesian male voice: ${id}`);
  });

  const expectedIdFemaleIds = [
    'I7sakys8pBZ1Z5f0UhT9',
    'U3dExJoUNcmTY5H6GMuG',
    'zd0hd2egR1Q6EzSLTzCp',
    'o5s6XRBkPSTD4syv6mZg',
    'RbNgJzKAV7jpYJNtCBpj',
    'LcvlyuBGMjj1h4uAtQjo',
    'vkW2LzXraZVeZ5G7Yv7c'
  ];
  expectedIdFemaleIds.forEach(id => {
    assert.ok(idFemaleVoices.some(v => v.id === id), `Missing Indonesian female voice: ${id}`);
  });

  // 2. English Catalog (14 Voices: 7 Male & 7 Female)
  assert.equal(ELEVENLABS_EN_VOICES.length, 14, 'English catalog must have exactly 14 voices');
  const enMaleVoices = ELEVENLABS_EN_VOICES.filter(v => v.gender === 'Male');
  const enFemaleVoices = ELEVENLABS_EN_VOICES.filter(v => v.gender === 'Female');
  assert.equal(enMaleVoices.length, 7, 'Must have 7 English male voices');
  assert.equal(enFemaleVoices.length, 7, 'Must have 7 English female voices');

  const expectedEnMaleIds = [
    'UgBBYS2sOqTuMpoF3BR0',
    'NOpBlnGInO9m6vDvFkFC',
    'IRHApOXLvnW57QJPQH2P',
    'EkK5I93UQWFDigLMpZcX',
    'wBXNqKUATyqu0RtYt25i',
    'yl2ZDV1MzN4HbQJbMihG',
    'ZthjuvLPty3kTMaNKVKb'
  ];
  expectedEnMaleIds.forEach(id => {
    assert.ok(enMaleVoices.some(v => v.id === id), `Missing English male voice: ${id}`);
  });

  const expectedEnFemaleIds = [
    'r1KmysJdVYZjJCm4mL3b',
    'tnSpp4vdxKPjI9w0GnoV',
    '56AoDkrOh6qfVPDXZ7Pt',
    'kPzsL2i3teMYv0FxEYQ6',
    'Z3R5wn05IrDiVCyEkUrK',
    'lxYfHSkYm1EzQzGhdbfc',
    'DODLEQrClDo8wCz460ld'
  ];
  expectedEnFemaleIds.forEach(id => {
    assert.ok(enFemaleVoices.some(v => v.id === id), `Missing English female voice: ${id}`);
  });

  // 3. Models
  assert.ok(ELEVENLABS_MODELS.some(m => m.id === 'eleven_multilingual_v2'));
  assert.ok(ELEVENLABS_MODELS.some(m => m.id === 'eleven_turbo_v2_5'));
  assert.ok(ELEVENLABS_MODELS.some(m => m.id === 'eleven_flash_v2_5'));
});

test('ElevenLabs Integration: Voice Helper Functions', () => {
  // getAvailableVoices
  const idVoices = getAvailableVoices('elevenlabs', 'id-ID');
  assert.equal(idVoices.length, 14);

  const enVoices = getAvailableVoices('elevenlabs', 'en-US');
  assert.equal(enVoices.length, 14);

  // getDefaultVoicePersona
  assert.equal(getDefaultVoicePersona('elevenlabs', 'id-ID'), 'zmqLb9Ysr8fUvDD7hXK8');
  assert.equal(getDefaultVoicePersona('elevenlabs', 'en-US'), 'UgBBYS2sOqTuMpoF3BR0');

  // resolveElevenLabsVoice
  assert.equal(resolveElevenLabsVoice('Zan', 'id-ID'), 'zmqLb9Ysr8fUvDD7hXK8');
  assert.equal(resolveElevenLabsVoice('Putri Maharani', 'id-ID'), 'I7sakys8pBZ1Z5f0UhT9');
  assert.equal(resolveElevenLabsVoice('Mark', 'en-US'), 'UgBBYS2sOqTuMpoF3BR0');
  assert.equal(resolveElevenLabsVoice('Jessica', 'en-US'), 'r1KmysJdVYZjJCm4mL3b');

  // Custom Voice ID passthrough
  const customId = 'custom_voice_id_cloned_12345';
  assert.equal(resolveElevenLabsVoice(customId, 'id-ID'), customId);
});

