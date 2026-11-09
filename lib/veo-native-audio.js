/**
 * Central Google Veo 3.1 Native Audio Director & Persona Catalog
 * File: lib/veo-native-audio.js
 * 
 * Provides vocal direction compilation, persona catalog, and foley/ambience prompt builders
 * for Google Veo 3.1 Joint Audio-Visual Diffusion generation.
 */

const PERSONAS_LIST = [
  {
    id: 'Kore',
    name: 'Kore',
    gender: 'female',
    style: 'Tenang & Lembut',
    avatar: '👩',
    desc: 'Perempuan (Tenang & Lembut)',
    tone: 'warm, calm, articulate, gentle Indonesian feminine voice with natural conversational cadence',
    descriptionEn: 'Warm, calm, articulate, and gentle feminine voice with natural conversational cadence',
    delivery: 'natural warm conversational cadence with soft studio acoustics'
  },
  {
    id: 'Charon',
    name: 'Charon',
    gender: 'male',
    style: 'Dalam & Berwibawa',
    avatar: '👨',
    desc: 'Laki-laki (Dalam & Berwibawa)',
    tone: 'deep, mature, authoritative, grounded masculine voice with calm clinical confidence',
    descriptionEn: 'Deep, mature, authoritative, grounded masculine voice with calm confidence',
    delivery: 'confident, steady, professional broadcasting tone with deep chest resonance'
  },
  {
    id: 'Aoede',
    name: 'Aoede',
    gender: 'female',
    style: 'Ekspresif & Hangat',
    avatar: '👩',
    desc: 'Perempuan (Ekspresif & Hangat)',
    tone: 'expressive, vibrant, cheerful, engaging female voice with dynamic inflection',
    descriptionEn: 'Expressive, vibrant, cheerful, and engaging female voice',
    delivery: 'upbeat, warm, and highly engaging conversational delivery'
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    gender: 'male',
    style: 'Berat & Dramatis',
    avatar: '👨',
    desc: 'Laki-laki (Berat & Dramatis)',
    tone: 'commanding, intense, dramatic masculine voice with deep resonant presence',
    descriptionEn: 'Commanding, intense, dramatic masculine voice with deep resonant presence',
    delivery: 'bold, resonant, and serious cinematic narration delivery'
  },
  {
    id: 'Puck',
    name: 'Puck',
    gender: 'male',
    style: 'Playful & Muda',
    avatar: '🎭',
    desc: 'Playful & Muda',
    tone: 'playful, youthful, energetic, casual modern storytelling pace',
    descriptionEn: 'Playful, youthful, energetic voice with casual modern storytelling pace',
    delivery: 'lively, spontaneous, casual modern storytelling pace'
  },
  {
    id: 'Zephyr',
    name: 'Zephyr',
    gender: 'male',
    style: 'Cepat & Berenergi',
    avatar: '👨',
    desc: 'Laki-laki (Cepat & Berenergi)',
    tone: 'swift, clear, dynamic, articulate modern masculine voice',
    descriptionEn: 'Swift, clear, dynamic, and articulate modern masculine voice',
    delivery: 'fast-paced, crisp, and informative explanatory cadence'
  },
  {
    id: 'Orus',
    name: 'Orus',
    gender: 'male',
    style: 'Tegas & Jelas',
    avatar: '👨',
    desc: 'Laki-laki (Tegas & Jelas)',
    tone: 'firm, clear, direct, professional male anchor tone',
    descriptionEn: 'Firm, clear, direct, and professional male anchor tone',
    delivery: 'structured, formal yet accessible journalistic delivery'
  },
  {
    id: 'Despina',
    name: 'Despina',
    gender: 'female',
    style: 'Ceria & Ramah',
    avatar: '👩',
    desc: 'Perempuan (Ceria & Ramah)',
    tone: 'bright, cheerful, sweet, inviting feminine voice with smiling delivery',
    descriptionEn: 'Bright, cheerful, sweet, and inviting feminine voice with smiling delivery',
    delivery: 'friendly, smiling, and optimistic conversational cadence'
  },
  {
    id: 'Callirrhoe',
    name: 'Callirrhoe',
    gender: 'female',
    style: 'Cerdas & Ringan',
    avatar: '👩',
    desc: 'Perempuan (Cerdas & Ringan)',
    tone: 'smart, articulate, lively educational female voice',
    descriptionEn: 'Smart, articulate, and lively educational female voice',
    delivery: 'intelligent, witty, and engaging explanation style'
  },
  {
    id: 'Iapetus',
    name: 'Iapetus',
    gender: 'male',
    style: 'Santai & Kasual',
    avatar: '👨',
    desc: 'Laki-laki (Santai & Kasual)',
    tone: 'relaxed, authentic, approachable guy-next-door masculine voice',
    descriptionEn: 'Relaxed, authentic, and approachable guy-next-door masculine voice',
    delivery: 'casual, laid-back conversational delivery'
  },
  {
    id: 'Leda',
    name: 'Leda',
    gender: 'female',
    style: 'Serius & Lugas',
    avatar: '👩',
    desc: 'Perempuan (Serius & Lugas)',
    tone: 'poised, serious, articulate, professional female voice',
    descriptionEn: 'Poised, serious, articulate, and professional female voice',
    delivery: 'deliberate, steady, and credible explanatory delivery'
  },
  {
    id: 'Autonoe',
    name: 'Autonoe',
    gender: 'female',
    style: 'Artikulatif',
    avatar: '👩',
    desc: 'Perempuan (Artikulatif)',
    tone: 'precise, articulate, crystal-clear instructional feminine voice',
    descriptionEn: 'Precise, articulate, and crystal-clear instructional feminine voice',
    delivery: 'clear, measured, step-by-step instructional delivery'
  },
  {
    id: 'Enceladus',
    name: 'Enceladus',
    gender: 'male',
    style: 'Narasi Sinematik',
    avatar: '👨',
    desc: 'Laki-laki (Narasi Sinematik)',
    tone: 'rich, deep, cinematic documentary narrator voice',
    descriptionEn: 'Rich, deep, cinematic documentary narrator voice',
    delivery: 'rich, atmospheric, contemplative documentary tone'
  },
  {
    id: 'Umbriel',
    name: 'Umbriel',
    gender: 'male',
    style: 'Misterius & Teduh',
    avatar: '👨',
    desc: 'Laki-laki (Misterius & Teduh)',
    tone: 'soft, intimate, low-register masculine voice',
    descriptionEn: 'Soft, intimate, and low-register masculine voice',
    delivery: 'whisper-adjacent, calm, reflective, intimate close-mic delivery'
  }
];

export const GOOGLE_VOICE_PERSONAS = Object.assign(
  [...PERSONAS_LIST],
  Object.fromEntries(PERSONAS_LIST.map(p => [p.id, p]))
);

/**
 * Validasi apakah persona Google Voice valid
 * @param {string} personaId 
 * @returns {boolean}
 */
export function isValidGoogleVoicePersona(personaId) {
  return Boolean(personaId && GOOGLE_VOICE_PERSONAS[personaId]);
}

/**
 * Mendapatkan persona Google Voice default berdasarkan bahasa target
 * @param {string} language 
 * @returns {string} ID persona
 */
export function getDefaultGoogleVoicePersona(language = 'id-ID') {
  const isEn = String(language || '').toLowerCase().startsWith('en');
  return isEn ? 'Puck' : 'Kore';
}

/**
 * Kompilasi arahan audio terintegrasi ke dalam prompt visual Veo 3.1
 * @param {object} params
 * @param {string} params.basePrompt - Prompt visual murni
 * @param {string} [params.narrationText] - Naskah percakapan / narasi untuk adegan ini
 * @param {string} [params.persona] - Persona Google Voice terpilih (e.g. 'Kore', 'Charon')
 * @param {string} [params.language] - Target bahasa naskah ('id-ID' | 'en-US')
 * @param {boolean} [params.withSfx=true] - Apakah menyertakan foley/SFX fisik produk
 * @param {boolean} [params.withAmbience=true] - Apakah menyertakan room tone/suasana latar
 * @param {boolean} [params.antiMusic=true] - Apakah menyertakan guardrail anti-musik acak
 * @returns {string} Prompt Veo lengkap dengan blok Audio direction:
 */
export function compileVeoNativeAudioPrompt({
  basePrompt,
  narrationText = '',
  persona = 'Kore',
  language = 'id-ID',
  withSfx = true,
  withAmbience = true,
  antiMusic = true
}) {
  if (!basePrompt) return '';
  // Bersihkan blok Audio direction yang sudah ada sebelumnya jika ada
  const cleanBase = basePrompt.replace(/\s*Audio direction:[\s\S]*$/i, '').trim();
  const profile = GOOGLE_VOICE_PERSONAS[persona] || GOOGLE_VOICE_PERSONAS.Kore;

  const audioDirectives = [];
  if (narrationText && narrationText.trim()) {
    const cleanText = narrationText.replace(/["\n\r]/g, ' ').trim();
    audioDirectives.push(`[SPEECH / DIALOGUE] ${profile.name} speaks in a ${profile.tone}, saying: "${cleanText}"`);
  }

  if (withSfx) {
    audioDirectives.push(`[SFX] Sound event: crisp natural physical interaction, product foley, and tactile sound effects corresponding to visible movements; intensity natural; centered.`);
  }

  if (withAmbience) {
    audioDirectives.push(`[AMBIENCE] Ambience: quiet bright indoor studio room tone with subtle organic atmosphere.`);
  }

  if (antiMusic) {
    audioDirectives.push(`Do not add background music, singing, or instrumental melody. Speech must remain clear, clean, and sync naturally with on-screen action.`);
  }

  if (audioDirectives.length === 0) {
    return cleanBase;
  }

  return `${cleanBase}\n\nAudio direction:\n${audioDirectives.join('\n')}`;
}

