/**
 * Shared helpers for MiniMax micro-acting/pause tag gating and VO/subtitle sanitization.
 */

const MINIMAX_PAUSE_TAG_RE = /<#\s*\d+(?:\.\d+)?s?\s*#>/gi;
const MINIMAX_INTERJECTION_TAG_RE = /\((?:breath|sighs?|laughs?|laughter|chuckles?|emm+|lip-smacking|coughs?|clears?[-_\s]?throat|groans?|pants?|inhale|exhale|gasps?|sniffs?|snorts?|burps?|humming|hissing|sneezes?|yawns?)\)/gi;

/**
 * Determines whether MINIMAX_MICRO_ACTING_MANDATE (<#x#> & vocal interjections)
 * may be injected into prompts or retained in TTS text.
 * Disabled across 1-Click & Schedule autopipeline defaults (speech-2.8-turbo);
 * active only when explicitly running MiniMax with speech-2.8-hd.
 */
export function shouldInjectMinimaxMicroActing({
  enableTts = true,
  voiceProvider = 'minimax',
  ttsModelQuality = 'speech-2.8-turbo'
} = {}) {
  return Boolean(enableTts)
    && String(voiceProvider || '').trim().toLowerCase() === 'minimax'
    && String(ttsModelQuality || '').trim().toLowerCase() === 'speech-2.8-hd';
}

/**
 * Removes MiniMax inline pause markers (<#1.0#>) and non-verbal interjection tags
 * so subtitles, review displays, markdown exports, and non-MiniMax TTS stay clean.
 */
export function stripTtsMarkupTags(text) {
  if (typeof text !== 'string') return text ?? '';
  return text
    .replace(MINIMAX_PAUSE_TAG_RE, ' ')
    .replace(MINIMAX_INTERJECTION_TAG_RE, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Prepares VO text for a specific target TTS provider/model.
 * Always strips MiniMax markup when sending to non-HD MiniMax, Gemini, ElevenLabs, or fallback paths.
 */
export function prepareTtsSpeechText(text, {
  provider = 'minimax',
  modelQuality = 'speech-2.8-turbo'
} = {}) {
  if (typeof text !== 'string') return text ?? '';
  const allowMarkup = shouldInjectMinimaxMicroActing({
    enableTts: true,
    voiceProvider: provider,
    ttsModelQuality: modelQuality
  });
  return allowMarkup ? text.trim() : stripTtsMarkupTags(text);
}

/**
 * Sanitizes narration/VO fields across an array of storyboard/voiceover items
 * unless MiniMax speech-2.8-hd micro-acting is explicitly active.
 */
export function sanitizeVoiceoverItems(items = [], opts = {}) {
  if (!Array.isArray(items)) return items;
  if (shouldInjectMinimaxMicroActing(opts)) return items;

  return items.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    const next = { ...entry };
    for (const key of ['narration', 'narration_transcript', 'voiceover', 'voice_over', 'new_vo']) {
      if (typeof next[key] === 'string') {
        next[key] = stripTtsMarkupTags(next[key]);
      }
    }
    if (Array.isArray(next.voice_segments)) {
      next.voice_segments = next.voice_segments.map((seg) =>
        seg && typeof seg.text === 'string'
          ? { ...seg, text: stripTtsMarkupTags(seg.text) }
          : seg
      );
    }
    return next;
  });
}
