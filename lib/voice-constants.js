/**
 * Katalog Suara Sentral untuk MiniMax dan Gemini TTS (Universal Voice Registry)
 * File: lib/voice-constants.js
 */

export const MINIMAX_VOICES = [
  { id: 'Indonesian_casual_reporter_vv2', name: 'Casual Reporter', avatar: '🎙️', desc: 'Laki-laki (Casual Reporter - Vv2)' },
  { id: 'Indonesian_compelling_storyteller_vv2', name: 'Compelling Storyteller', avatar: '📖', desc: 'Laki-laki (Compelling Storyteller - Vv2)' },
  { id: 'Indonesian_expressive_podcaster_vv2', name: 'Expressive Podcaster', avatar: '🎧', desc: 'Laki-laki (Expressive Podcaster - Vv2)' },
  { id: 'Indonesian_energetic_streamer_vv2', name: 'Energetic Streamer', avatar: '⚡', desc: 'Laki-laki (Energetic Streamer - Vv2)' },
  { id: 'Indonesian_intellectual_commentator_vv2', name: 'Intellectual Commentator', avatar: '🧐', desc: 'Laki-laki (Intellectual Commentator - Vv2)' },
  { id: 'Indonesian_professional_anchor_vv2', name: 'Professional Anchor', avatar: '👔', desc: 'Perempuan (Professional Anchor - Vv2)' },
  { id: 'Indonesian_crisp_reporter_vv2', name: 'Crisp Reporter', avatar: '👩', desc: 'Perempuan (Crisp Reporter - Vv2)' }
];

export const OFFICIAL_MINIMAX_ENGLISH_VOICES = [
  // ── FEMALE VOICES (19 Suara Resmi) ──
  { id: 'English_radiant_girl', name: 'Radiant Girl', gender: 'Female', avatar: '👩', desc: 'Female (Radiant & Energetic - Lifestyle/Food)', category: 'Lifestyle' },
  { id: 'English_compelling_lady1', name: 'Compelling Lady', gender: 'Female', avatar: '👩', desc: 'Female (Persuasive & Elegant - Affiliate/Sales)', category: 'Commercial' },
  { id: 'English_captivating_female1', name: 'Captivating Female', gender: 'Female', avatar: '👩', desc: 'Female (Captivating & Dynamic - Storytelling)', category: 'Storytelling' },
  { id: 'English_Upbeat_Woman', name: 'Upbeat Woman', gender: 'Female', avatar: '👩', desc: 'Female (Upbeat & Optimistic)', category: 'General' },
  { id: 'English_CalmWoman', name: 'Calm Woman', gender: 'Female', avatar: '👩', desc: 'Female (Calm & Soothing - Educational)', category: 'Educational' },
  { id: 'English_Whispering_girl', name: 'Whispering Girl', gender: 'Female', avatar: '👩', desc: 'Female (Soft Whispering - ASMR/Aesthetic)', category: 'ASMR' },
  { id: 'English_Graceful_Lady', name: 'Graceful Lady', gender: 'Female', avatar: '👩', desc: 'Female (Graceful & Classy - Luxury)', category: 'Commercial' },
  { id: 'English_PlayfulGirl', name: 'Playful Girl', gender: 'Female', avatar: '👩', desc: 'Female (Playful & Casual - Gen-Z)', category: 'Lifestyle' },
  { id: 'English_MaturePartner', name: 'Mature Partner', gender: 'Female', avatar: '👩', desc: 'Female (Mature & Supportive)', category: 'General' },
  { id: 'English_MatureBoss', name: 'Bossy Lady', gender: 'Female', avatar: '👩', desc: 'Female (Authoritative & Executive)', category: 'Professional' },
  { id: 'English_LovelyGirl', name: 'Lovely Girl', gender: 'Female', avatar: '👩', desc: 'Female (Sweet & Friendly)', category: 'Lifestyle' },
  { id: 'English_Wiselady', name: 'Wise Lady', gender: 'Female', avatar: '👩', desc: 'Female (Wise & Mature)', category: 'Educational' },
  { id: 'English_SentimentalLady', name: 'Sentimental Lady', gender: 'Female', avatar: '👩', desc: 'Female (Warm & Emotional)', category: 'Storytelling' },
  { id: 'English_ImposingManner', name: 'Imposing Queen', gender: 'Female', avatar: '👩', desc: 'Female (Dominant & Royal)', category: 'Dramatic' },
  { id: 'English_Soft-spokenGirl', name: 'Soft-Spoken Girl', gender: 'Female', avatar: '👩', desc: 'Female (Soft & Gentle)', category: 'ASMR' },
  { id: 'English_SereneWoman', name: 'Serene Woman', gender: 'Female', avatar: '👩', desc: 'Female (Serene & Peaceful)', category: 'Relaxing' },
  { id: 'English_ConfidentWoman', name: 'Confident Woman', gender: 'Female', avatar: '👩', desc: 'Female (Confident & Modern)', category: 'Commercial' },
  { id: 'English_BossyLeader', name: 'Bossy Leader', gender: 'Female', avatar: '👩', desc: 'Female (Strong Leader & Directive)', category: 'Professional' },
  { id: 'English_UpsetGirl', name: 'Upset Girl', gender: 'Female', avatar: '👩', desc: 'Female (Dramatic & Emotional)', category: 'Dramatic' },

  // ── MALE VOICES (19 Suara Resmi) ──
  { id: 'English_expressive_narrator', name: 'Expressive Narrator', gender: 'Male', avatar: '👨', desc: 'Male (Expressive Storyteller - Hook/Story)', category: 'Storytelling' },
  { id: 'English_magnetic_voiced_man', name: 'Magnetic-Voiced Male', gender: 'Male', avatar: '👨', desc: 'Male (Deep Charismatic - Commercial/Promo)', category: 'Commercial' },
  { id: 'English_Trustworth_Man', name: 'Trustworthy Man', gender: 'Male', avatar: '👨', desc: 'Male (Credible & Warm - Review/Facts)', category: 'Review' },
  { id: 'English_Gentle-voiced_man', name: 'Gentle-Voiced Man', gender: 'Male', avatar: '👨', desc: 'Male (Gentle & Warm)', category: 'Lifestyle' },
  { id: 'English_Aussie_Bloke', name: 'Aussie Bloke', gender: 'Male', avatar: '👨', desc: 'Male (Australian Accent - Casual/Upbeat)', category: 'Specialty' },
  { id: 'English_Diligent_Man', name: 'Diligent Man', gender: 'Male', avatar: '👨', desc: 'Male (Diligent & Straightforward)', category: 'Professional' },
  { id: 'English_ReservedYoungMan', name: 'Reserved Young Man', gender: 'Male', avatar: '👨', desc: 'Male (Polite & Articulate)', category: 'General' },
  { id: 'English_ManWithDeepVoice', name: 'Man With Deep Voice', gender: 'Male', avatar: '👨', desc: 'Male (Deep Bass & Authoritative)', category: 'Dramatic' },
  { id: 'English_FriendlyPerson', name: 'Friendly Guy', gender: 'Male', avatar: '👨', desc: 'Male (Friendly & Conversational)', category: 'Lifestyle' },
  { id: 'English_Debator', name: 'Male Debater', gender: 'Male', avatar: '👨', desc: 'Male (Sharp & Argumentative)', category: 'Professional' },
  { id: 'English_Steadymentor', name: 'Reliable Mentor', gender: 'Male', avatar: '👨', desc: 'Male (Wise Mentor & Steady)', category: 'Educational' },
  { id: 'English_Deep-VoicedGentleman', name: 'Deep-Voiced Gentleman', gender: 'Male', avatar: '👨', desc: 'Male (Sophisticated & Classic)', category: 'Luxury' },
  { id: 'English_CaptivatingStoryteller', name: 'Captivating Storyteller', gender: 'Male', avatar: '👨', desc: 'Male (Dynamic Storyteller)', category: 'Storytelling' },
  { id: 'English_DecentYoungMan', name: 'Decent Young Man', gender: 'Male', avatar: '👨', desc: 'Male (Natural & Pleasant)', category: 'General' },
  { id: 'English_PassionateWarrior', name: 'Passionate Warrior', gender: 'Male', avatar: '👨', desc: 'Male (High Energy & Passionate)', category: 'Dramatic' },
  { id: 'English_WiseScholar', name: 'Wise Scholar', gender: 'Male', avatar: '👨', desc: 'Male (Scholarly & Academic)', category: 'Educational' },
  { id: 'English_PatientMan', name: 'Patient Man', gender: 'Male', avatar: '👨', desc: 'Male (Patient & Instructional)', category: 'Educational' },
  { id: 'English_Comedian', name: 'Comedian', gender: 'Male', avatar: '👨', desc: 'Male (Humorous & Lively)', category: 'Entertainment' },
  { id: 'English_SadTeen', name: 'Teen Boy', gender: 'Male', avatar: '👨', desc: 'Male (Youthful & Melancholic)', category: 'Dramatic' }
];

export const LEGACY_MINIMAX_ENGLISH_VOICE_ALIASES = {
  'English_Resonant_Man': 'English_ManWithDeepVoice',
  'English_causual_narrator_vv1': 'English_expressive_narrator',
  'English_causual_podcast_vv1': 'English_magnetic_voiced_man',
  'English_expressive_host__vv1': 'English_expressive_narrator',
  'English_instructive_professor_vv1': 'English_Wiselady',
  'English_nursery_teacher_vv2': 'English_radiant_girl'
};

const LEGACY_FALLBACK_VOICE_ENTRIES = [
  { id: 'English_Resonant_Man', name: 'Resonant Man (Legacy)', gender: 'Male', avatar: '👨', desc: 'English Resonant Man', category: 'Legacy' },
  { id: 'English_causual_narrator_vv1', name: 'Casual Narrator (Legacy)', gender: 'Male', avatar: '👨', desc: 'English Casual Narrator', category: 'Legacy' },
  { id: 'English_causual_podcast_vv1', name: 'Casual Podcast (Legacy)', gender: 'Male', avatar: '👨', desc: 'English Casual Podcast', category: 'Legacy' },
  { id: 'English_expressive_host__vv1', name: 'Expressive Host (Legacy)', gender: 'Male', avatar: '👨', desc: 'English Expressive Host', category: 'Legacy' },
  { id: 'English_instructive_professor_vv1', name: 'Instructive Professor (Legacy)', gender: 'Female', avatar: '👩', desc: 'English Instructive Professor', category: 'Legacy' },
  { id: 'English_nursery_teacher_vv2', name: 'Nursery Teacher (Legacy)', gender: 'Female', avatar: '👩', desc: 'English Nursery Teacher', category: 'Legacy' }
];

export const MINIMAX_ENGLISH_VOICES = [
  ...OFFICIAL_MINIMAX_ENGLISH_VOICES,
  ...LEGACY_FALLBACK_VOICE_ENTRIES
];

export const GEMINI_VOICES = [
  { id: 'Kore', name: 'Kore', avatar: '👩', desc: 'Perempuan (Tenang & Lembut)' },
  { id: 'Orus', name: 'Orus', avatar: '👨', desc: 'Laki-laki (Tegas & Jelas)' },
  { id: 'Despina', name: 'Despina', avatar: '👩', desc: 'Perempuan (Ceria & Ramah)' },
  { id: 'Aoede', name: 'Aoede', avatar: '👩', desc: 'Perempuan (Ekspresif & Hangat)' },
  { id: 'Charon', name: 'Charon', avatar: '👨', desc: 'Laki-laki (Dalam & Berwibawa)' },
  { id: 'Callirrhoe', name: 'Callirrhoe', avatar: '👩', desc: 'Perempuan (Cerdas & Ringan)' },
  { id: 'Iapetus', name: 'Iapetus', avatar: '👨', desc: 'Laki-laki (Santai & Kasual)' },
  { id: 'Leda', name: 'Leda', avatar: '👩', desc: 'Perempuan (Serius & Lugas)' },
  { id: 'Zephyr', name: 'Zephyr', avatar: '👨', desc: 'Laki-laki (Cepat & Berenergi)' },
  { id: 'Fenrir', name: 'Fenrir', avatar: '👨', desc: 'Laki-laki (Berat & Dramatis)' },
  { id: 'Puck', name: 'Puck', avatar: '🎭', desc: 'Playful & Muda' },
  { id: 'Autonoe', name: 'Autonoe', avatar: '👩', desc: 'Perempuan (Artikulatif)' },
  { id: 'Enceladus', name: 'Enceladus', avatar: '👨', desc: 'Laki-laki (Narasi Sinematik)' },
  { id: 'Umbriel', name: 'Umbriel', avatar: '👨', desc: 'Laki-laki (Misterius & Teduh)' }
];

export const ELEVENLABS_MODELS = [
  { id: 'eleven_multilingual_v2', name: 'Multilingual v2 (Rekomendasi ID/EN)', desc: 'Kualitas tertinggi, natural, aksen lokal otentik' },
  { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5 (Ultra-Fast 300ms)', desc: 'Kecepatan tinggi, latensi sangat rendah' },
  { id: 'eleven_flash_v2_5', name: 'Flash v2.5 (Super Ringan)', desc: 'Efisien dan hemat karakter' }
];

export const ELEVENLABS_ID_VOICES = [
  // ── PRIA (7 Suara) ──
  { id: 'zmqLb9Ysr8fUvDD7hXK8', name: 'Zan', gender: 'Male', avatar: '👨', category: 'Conversational', desc: 'Laki-laki (Conversational, hangat, serak natural)' },
  { id: 'TMvmhlKUioQA4U7LOoko', name: 'Andi', gender: 'Male', avatar: '👨‍💼', category: 'Friendly', desc: 'Laki-laki (Jelas, ramah, tenang & engaging)' },
  { id: 'q8qwd1jY2jS3AWOBeq25', name: 'Pratama', gender: 'Male', avatar: '⚡', category: 'Confident', desc: 'Laki-laki (Percaya diri, energik & tegas)' },
  { id: 'X8n8hOy3e8VLQnHTUcc5', name: 'Bram', gender: 'Male', avatar: '📖', category: 'Storyteller', desc: 'Laki-laki (Hangat, narasi buku & storytelling)' },
  { id: 'plgKUYgnlZ1DCNh54DwJ', name: 'Dakocan', gender: 'Male', avatar: '🎙️', category: 'Expressive', desc: 'Laki-laki (Ekspresif, ceria, podcast & TikTok)' },
  { id: 'd888tBvGmQT2u05J1xTv', name: 'Ahmad', gender: 'Male', avatar: '👔', category: 'Professional', desc: 'Laki-laki (Profesional, jelas & terstruktur)' },
  { id: 'ACRfKVNOAnzVitkYerdl', name: 'Mizan', gender: 'Male', avatar: '🎬', category: 'Deep Bass', desc: 'Laki-laki (Deep bass, tenang & sinematik)' },

  // ── WANITA (7 Suara) ──
  { id: 'I7sakys8pBZ1Z5f0UhT9', name: 'Putri Maharani', gender: 'Female', avatar: '🧕', category: 'Storytelling', desc: 'Perempuan (Ekspresif, kisah inspiratif & budaya)' },
  { id: 'U3dExJoUNcmTY5H6GMuG', name: 'Maya', gender: 'Female', avatar: '👩‍🦰', category: 'Marketing', desc: 'Perempuan (Cerah, ramah, marketing & iklan)' },
  { id: 'zd0hd2egR1Q6EzSLTzCp', name: 'Naya', gender: 'Female', avatar: '🌸', category: 'Soothing', desc: 'Perempuan (Lembut, empati tinggi & self-care)' },
  { id: 'o5s6XRBkPSTD4syv6mZg', name: 'Arunika', gender: 'Female', avatar: '👩‍💼', category: 'News Anchor', desc: 'Perempuan (Penyiar TV nasional, tajam & kredibel)' },
  { id: 'RbNgJzKAV7jpYJNtCBpj', name: 'Citra', gender: 'Female', avatar: '👩', category: 'Gentle', desc: 'Perempuan (Lembut, ramah, resep dapur & kuliner)' },
  { id: 'LcvlyuBGMjj1h4uAtQjo', name: 'Ratih', gender: 'Female', avatar: '✨', category: 'Natural', desc: 'Perempuan (Santai, natural, unboxing & review)' },
  { id: 'vkW2LzXraZVeZ5G7Yv7c', name: 'Dila', gender: 'Female', avatar: '🎙️', category: 'Presenter', desc: 'Perempuan (Gaya presenter, energik & menjaga atensi)' }
];

export const ELEVENLABS_EN_VOICES = [
  // ── MALE (7 Suara) ──
  { id: 'UgBBYS2sOqTuMpoF3BR0', name: 'Mark', gender: 'Male', avatar: '🧑', category: 'Conversational', desc: 'Male (Conversational young adult American male)' },
  { id: 'NOpBlnGInO9m6vDvFkFC', name: 'Grandpa Spuds', gender: 'Male', avatar: '👴', category: 'Mature Wisdom', desc: 'Male (Wise, warm older male storyteller)' },
  { id: 'IRHApOXLvnW57QJPQH2P', name: 'Adam (Brooding)', gender: 'Male', avatar: '🕶️', category: 'Dark Dramatic', desc: 'Male (Dark, intense dramatic trailer narrator)' },
  { id: 'EkK5I93UQWFDigLMpZcX', name: 'JM', gender: 'Male', avatar: '🎧', category: 'Deep Bass', desc: 'Male (Husky deep bass, audiobooks & documentaries)' },
  { id: 'wBXNqKUATyqu0RtYt25i', name: 'Adam (Classic)', gender: 'Male', avatar: '📻', category: 'Broadcast', desc: 'Male (Commanding, rich broadcast tone)' },
  { id: 'yl2ZDV1MzN4HbQJbMihG', name: 'Alex', gender: 'Male', avatar: '⚡', category: 'Upbeat Creator', desc: 'Male (Upbeat YouTube & TikTok shorts creator)' },
  { id: 'ZthjuvLPty3kTMaNKVKb', name: 'Jackson', gender: 'Male', avatar: '🧔', category: 'Credible', desc: 'Male (Confident, reliable narration)' },

  // ── FEMALE (7 Suara) ──
  { id: 'r1KmysJdVYZjJCm4mL3b', name: 'Jessica', gender: 'Female', avatar: '👩', category: 'Conversational', desc: 'Female (Classic conversational American female)' },
  { id: 'tnSpp4vdxKPjI9w0GnoV', name: 'Hope', gender: 'Female', avatar: '✨', category: 'Upbeat Bright', desc: 'Female (Upbeat, cheerful, bright social media)' },
  { id: '56AoDkrOh6qfVPDXZ7Pt', name: 'Cassidy', gender: 'Female', avatar: '🎯', category: 'Crisp Direct', desc: 'Female (Crisp, direct, clear business tips)' },
  { id: 'kPzsL2i3teMYv0FxEYQ6', name: 'Brittney', gender: 'Female', avatar: '🌸', category: 'Vibrant Youth', desc: 'Female (Young, vibrant, fashion & youth culture)' },
  { id: 'Z3R5wn05IrDiVCyEkUrK', name: 'Arabella', gender: 'Female', avatar: '🎭', category: 'Emotive Narrator', desc: 'Female (Emotive, storytelling, warm narration)' },
  { id: 'lxYfHSkYm1EzQzGhdbfc', name: 'Jessica Anne Bogart', gender: 'Female', avatar: '🎙️', category: 'VO Pro', desc: 'Female (VO Pro, confident commercial & luxury)' },
  { id: 'DODLEQrClDo8wCz460ld', name: 'Lauren B', gender: 'Female', avatar: '☕', category: 'Comforting', desc: 'Female (Comforting, friendly, healthcare & guides)' }
];

/**
 * Mengambil daftar suara berdasarkan provider dan bahasa target
 * @param {string|object} providerOrOptions
 * @param {string} [language]
 */
export function getAvailableVoices(providerOrOptions = 'minimax', language = 'id-ID') {
  let provider = providerOrOptions;
  let targetLang = language;

  if (typeof providerOrOptions === 'object' && providerOrOptions !== null) {
    provider = providerOrOptions.provider || 'minimax';
    targetLang = providerOrOptions.language || 'id-ID';
  }

  const isEn = String(targetLang || '').toLowerCase().startsWith('en');

  if (provider === 'elevenlabs') {
    return isEn ? ELEVENLABS_EN_VOICES : ELEVENLABS_ID_VOICES;
  }
  if (provider === 'gemini') {
    return GEMINI_VOICES;
  }
  return isEn ? MINIMAX_ENGLISH_VOICES : MINIMAX_VOICES;
}

/**
 * Mendapatkan persona suara default berdasarkan provider dan target bahasa
 * @param {string} provider - 'minimax' | 'gemini' | 'elevenlabs'
 * @param {string} language - 'id-ID' | 'en-US'
 * @returns {string} ID persona suara
 */
export function getDefaultVoicePersona(provider = 'minimax', language = 'id-ID') {
  const isEn = String(language || '').toLowerCase().startsWith('en');
  if (provider === 'elevenlabs') {
    return isEn ? 'UgBBYS2sOqTuMpoF3BR0' : 'zmqLb9Ysr8fUvDD7hXK8';
  }
  if (provider === 'gemini') {
    return isEn ? 'Puck' : 'Kore';
  }
  return isEn ? 'English_radiant_girl' : 'Indonesian_casual_reporter_vv2';
}

