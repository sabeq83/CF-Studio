import { getSetting } from './db.js';
import { ELEVENLABS_ID_VOICES, ELEVENLABS_EN_VOICES, getDefaultVoicePersona } from './voice-constants.js';
import fs from 'fs';
import path from 'path';

/**
 * Resolves a given voice persona name or ID to an ElevenLabs voice ID
 * @param {string} persona 
 * @param {string} language - 'id-ID' | 'en-US'
 * @returns {string}
 */
export function resolveElevenLabsVoice(persona, language = 'id-ID') {
  if (!persona) {
    return getDefaultVoicePersona('elevenlabs', language);
  }

  const isEn = String(language || '').toLowerCase().startsWith('en');
  const catalog = isEn ? ELEVENLABS_EN_VOICES : ELEVENLABS_ID_VOICES;

  // 1. Check exact ID match in catalog
  const foundById = catalog.find(v => v.id === persona);
  if (foundById) return foundById.id;

  // 2. Check name match in catalog (case-insensitive)
  const pNorm = String(persona).trim().toLowerCase();
  const foundByName = catalog.find(v => v.name.toLowerCase() === pNorm);
  if (foundByName) return foundByName.id;

  // Check opposite catalog just in case
  const oppCatalog = isEn ? ELEVENLABS_ID_VOICES : ELEVENLABS_EN_VOICES;
  const foundInOpp = oppCatalog.find(v => v.id === persona || v.name.toLowerCase() === pNorm);
  if (foundInOpp) return foundInOpp.id;

  // 3. If it looks like a valid 20-character ElevenLabs Voice ID or custom VoiceLab ID, use directly
  if (typeof persona === 'string' && persona.trim().length >= 10 && !persona.includes(' ')) {
    return persona.trim();
  }

  // 4. Default fallback
  return getDefaultVoicePersona('elevenlabs', language);
}

/**
 * Generates speech using ElevenLabs API
 * @param {string} text - Voice-over narration text
 * @param {string} voicePersona - Voice ID or Name
 * @param {string} outputPath - Local filesystem target path (e.g. /renders/audio.mp3)
 * @param {object} config - Configuration options (speed, stability, similarity_boost, model)
 * @returns {Promise<string>} outputPath
 */
export async function generateElevenLabsVO(text, voicePersona, outputPath, config = {}) {
  let apiKey = getSetting('elevenlabs_api_key', false) || process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    try {
      const { getDb } = await import('./db.js');
      const db = getDb();
      const row = await db.prepare("SELECT setting_value FROM tenant_settings WHERE setting_key = 'elevenlabs_api_key'").get();
      apiKey = row?.setting_value;
    } catch (_) {}
  }

  if (!apiKey) {
    throw new Error('API Key ElevenLabs belum dikonfigurasi di Settings untuk tenant ini.');
  }

  const isEn = String(config.language || '').toLowerCase().startsWith('en');
  const targetLanguage = isEn ? 'en-US' : 'id-ID';
  const voiceId = resolveElevenLabsVoice(voicePersona, targetLanguage);

  const targetModel = config.model || config.tts_model_quality || 'eleven_multilingual_v2';
  const speed = config.speed !== undefined ? Number(config.speed) : 1.00;
  const stability = config.stability !== undefined ? Number(config.stability) : 0.50;
  const similarityBoost = config.similarity_boost !== undefined ? Number(config.similarity_boost) : 0.75;

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const payload = {
    text: text,
    model_id: targetModel,
    voice_settings: {
      stability: stability,
      similarity_boost: similarityBoost,
      speed: speed
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': String(apiKey).trim(),
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errJson = await response.json();
      errorDetail = errJson?.detail?.message || errJson?.message || JSON.stringify(errJson);
    } catch (_) {
      errorDetail = await response.text();
    }
    throw new Error(`ElevenLabs API Error (HTTP ${response.status}): ${errorDetail}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = Buffer.from(arrayBuffer);

  const targetDir = path.dirname(outputPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, audioBuffer);
  return outputPath;
}

