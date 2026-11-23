/**
 * Shared helpers for MiniMax micro-acting/pause tag gating and VO/subtitle sanitization.
 */

const MINIMAX_PAUSE_TAG_RE = /<#\s*\d+(?:\.\d+)?s?\s*#>/gi;
const ESCAPED_MINIMAX_PAUSE_TAG_RE = /&lt;#\s*\d+(?:\.\d+)?s?\s*#&gt;/gi;
const RESIDUAL_ANGLE_HASH_TAG_RE = /<#|#>|&lt;#|#&gt;|‹#|#›/gi;
const SQUARE_BRACKET_STAGE_NOTE_RE = /\[[^\]\n]{1,60}\]/g;
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
 * Detects leaked MiniMax pause markers (<#...#>, &lt;#...#&gt;), stage-note brackets,
 * or non-verbal vocal interjection tags before rendering overlays.
 */
export function hasLeakedOverlayMarkup(text) {
  if (typeof text !== 'string' || !text) return false;
  if (/<#|#>|&lt;#|#&gt;|‹#|#›|\[|\]/i.test(text)) return true;
  return new RegExp(MINIMAX_INTERJECTION_TAG_RE.source, 'i').test(text);
}

/**
 * Removes MiniMax inline pause markers (<#1.0#>) and non-verbal interjection tags
 * so subtitles, review displays, markdown exports, and non-MiniMax TTS stay clean.
 */
export function stripTtsMarkupTags(text) {
  if (typeof text !== 'string') return text ?? '';
  return text
    .replace(ESCAPED_MINIMAX_PAUSE_TAG_RE, ' ')
    .replace(MINIMAX_PAUSE_TAG_RE, ' ')
    .replace(MINIMAX_INTERJECTION_TAG_RE, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Strict pre-render overlay sanitization catching escaped tags, orphan delimiters,
 * and stage notes in square brackets.
 */
export function sanitizeOverlayTextStrict(text) {
  const base = stripTtsMarkupTags(String(text ?? ''));
  return base
    .replace(RESIDUAL_ANGLE_HASH_TAG_RE, ' ')
    .replace(SQUARE_BRACKET_STAGE_NOTE_RE, ' ')
    .replace(/[[\]]/g, '')
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

const SCENE_VO_KEYS_DEFAULT = [
  'narration_transcript',
  'narrating_transcript',
  'narration',
  'voiceover',
  'voice_over',
  'narration_text',
  'voiceover_text',
  'vo_text',
  'script',
  'new_vo'
];

const SCENE_VO_KEYS_EDITED = [
  'narration',
  ...SCENE_VO_KEYS_DEFAULT.filter(k => k !== 'narration')
];

/**
 * Extracts non-empty VO narration text from a storyboard scene, tolerating AI key typos
 * (e.g. `narrating_transcript`) and UI-edited `narration` fields.
 */
export function extractSceneVoText(entry, { preferEdited = false } = {}) {
  if (!entry || typeof entry !== 'object') return '';
  const keys = preferEdited ? SCENE_VO_KEYS_EDITED : SCENE_VO_KEYS_DEFAULT;
  for (const key of keys) {
    const val = entry[key];
    if (typeof val === 'string' && val.trim()) {
      return val.trim();
    }
  }
  return '';
}

/**
 * Normalizes storyboard items so `narration_transcript` and `narration` are always synced
 * and AI typo keys (such as `narrating_transcript`) are cleaned up.
 */
export function normalizeStoryboardVoFields(items = [], { preferEdited = false } = {}) {
  if (!Array.isArray(items)) return [];
  return items.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    const vo = extractSceneVoText(entry, { preferEdited });
    const { narrating_transcript: _typoKey, ...rest } = entry;
    return {
      ...rest,
      narration_transcript: vo,
      narration: vo,
      ...(typeof entry.voiceover === 'string' ? { voiceover: vo } : {})
    };
  });
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
    for (const key of ['narration', 'narration_transcript', 'narrating_transcript', 'voiceover', 'voice_over', 'new_vo']) {
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

