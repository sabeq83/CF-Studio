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
 * Converts ElevenLabs character-level alignment payload into clean word-level timing spans [{ w, s, e }].
 */
export function extractWordTimingsFromElevenLabsAlignment(alignment) {
  if (!alignment || !Array.isArray(alignment.characters) || alignment.characters.length === 0) {
    return [];
  }
  const chars = alignment.characters;
  const starts = alignment.character_start_times_seconds || [];
  const ends = alignment.character_end_times_seconds || [];
  const words = [];

  let curChars = [];
  let curStart = null;
  let curEnd = null;

  for (let i = 0; i < chars.length; i++) {
    const ch = String(chars[i] || '');
    const st = Number(starts[i]);
    const en = Number(ends[i]);

    if (!ch || /^\s+$/.test(ch)) {
      if (curChars.length > 0) {
        const wordText = curChars.join('').trim();
        if (wordText && curStart !== null && curEnd !== null) {
          words.push({
            w: wordText,
            s: Number(Math.max(0, curStart).toFixed(4)),
            e: Number(Math.max(curStart + 0.03, curEnd).toFixed(4))
          });
        }
        curChars = [];
        curStart = null;
        curEnd = null;
      }
      continue;
    }

    curChars.push(ch);
    if (curStart === null && Number.isFinite(st)) {
      curStart = st;
    }
    if (Number.isFinite(en)) {
      curEnd = Math.max(curEnd ?? en, en);
    } else if (Number.isFinite(st)) {
      curEnd = Math.max(curEnd ?? st, st + 0.04);
    }
  }

  if (curChars.length > 0) {
    const wordText = curChars.join('').trim();
    if (wordText && curStart !== null && curEnd !== null) {
      words.push({
        w: wordText,
        s: Number(Math.max(0, curStart).toFixed(4)),
        e: Number(Math.max(curStart + 0.03, curEnd).toFixed(4))
      });
    }
  }

  return words;
}

/**
 * Generates speech using ElevenLabs API and attempts /with-timestamps first for Tier 1 word alignment.
 * Writes a <outputPath>.timings.json sidecar when word timestamps are returned.
 * @returns {Promise<{ outputPath: string, wordTimings: Array, source: string }>}
 */
export async function generateElevenLabsVOWithTimestamps(text, voicePersona, outputPath, config = {}) {
  let apiKey = config.apiKey || getSetting('elevenlabs_api_key', false) || process.env.ELEVENLABS_API_KEY;
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

  const payload = {
    text,
    model_id: targetModel,
    voice_settings: {
      stability,
      similarity_boost: similarityBoost,
      speed
    }
  };

  const targetDir = path.dirname(outputPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const headersBase = {
    'xi-api-key': String(apiKey).trim(),
    'Content-Type': 'application/json'
  };

  // Tier 1 attempt: /with-timestamps
  if (config.withTimestamps !== false) {
    try {
      const tsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`;
      const tsRes = await fetch(tsUrl, {
        method: 'POST',
        headers: { ...headersBase, 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (tsRes.ok) {
        const tsJson = await tsRes.json();
        if (tsJson?.audio_base64) {
          const audioBuffer = Buffer.from(tsJson.audio_base64, 'base64');
          fs.writeFileSync(outputPath, audioBuffer);
          const rawAlign = tsJson.normalized_alignment || tsJson.alignment;
          const wordTimings = extractWordTimingsFromElevenLabsAlignment(rawAlign);
          const source = wordTimings.length > 0 ? 'elevenlabs_timestamps' : 'elevenlabs_no_alignment';
          if (wordTimings.length > 0) {
            try {
              fs.writeFileSync(`${outputPath}.timings.json`, JSON.stringify({ source, words: wordTimings }), 'utf8');
            } catch (_) {}
          }
          return { outputPath, wordTimings, source };
        }
      } else {
        console.warn(`[ElevenLabs] /with-timestamps HTTP ${tsRes.status}, falling back to standard endpoint.`);
      }
    } catch (tsErr) {
      console.warn(`[ElevenLabs] /with-timestamps fallback triggered: ${tsErr.message}`);
    }
  }

  // Standard fallback: /v1/text-to-speech/{voiceId}
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { ...headersBase, 'Accept': 'audio/mpeg' },
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
  fs.writeFileSync(outputPath, audioBuffer);
  return { outputPath, wordTimings: [], source: 'elevenlabs_standard' };
}

/**
 * Generates speech using ElevenLabs API (backward-compatible signature returning outputPath string).
 */
export async function generateElevenLabsVO(text, voicePersona, outputPath, config = {}) {
  const res = await generateElevenLabsVOWithTimestamps(text, voicePersona, outputPath, config);
  return res.outputPath;
}

