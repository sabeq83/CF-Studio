import { sanitizeOverlayTextStrict } from './tts-text-sanitizer.js';
import { isHerbalMedicalClaimPhrase } from './tiktok-compliance-service.js';
import { fitHookCard } from './motion-text-engine.js';
import { normAlignmentWord } from './word-alignment-engine.js';

export const ALLOWED_CAPTION_MODES = new Set(['hybrid', 'keyword_only', 'full']);
export const ALLOWED_PUNCH_TYPES = new Set(['benefit', 'result', 'warning', 'hook']);

export const FINISHING_PLAN_PROMPT_APPENDIX = `
### OPSIONAL — FINISHING PASS TIMELINE PLAN ("finishing_plan"):
Sertakan key opsional "finishing_plan" di root JSON untuk overlay finishing video:
- "hook": teks singkat Hook Card Frame 0-1.75s maksimal 2 baris (<= 34 karakter total, dilarang klaim medis mengobati/menurunkan penyakit untuk produk herbal).
- "punches": maksimal 2 frasa kunci per klip; SETIAP "phrase" WAJIB berupa **substring kata persis** dari naskah VO klip tersebut (2-4 kata pendek, tanpa mengarang kata baru), bertipe "benefit" | "result" | "warning" | "hook".`.trim();

/**
 * Resolves effective caption_mode for finishing pass.
 * Legacy campaigns where campaign.caption_mode is NULL/empty default to 'full'.
 */
export function resolveCampaignCaptionMode(campaign = {}, explicitOverride = null) {
  const candidate = explicitOverride ?? campaign?.caption_mode;
  if (candidate === null || candidate === undefined || String(candidate).trim() === '') {
    return 'full';
  }
  const normalized = String(candidate).trim().toLowerCase();
  return ALLOWED_CAPTION_MODES.has(normalized) ? normalized : 'full';
}

function findContiguousTokenMatchIndex(haystackTokens, needleTokens) {
  if (!haystackTokens.length || !needleTokens.length || needleTokens.length > haystackTokens.length) {
    return -1;
  }
  for (let i = 0; i <= haystackTokens.length - needleTokens.length; i++) {
    let matched = true;
    for (let k = 0; k < needleTokens.length; k++) {
      if (haystackTokens[i + k] !== needleTokens[k]) {
        matched = false;
        break;
      }
    }
    if (matched) return i;
  }
  return -1;
}

/**
 * Strictly validates Gemini's optional `finishing_plan` against clean voiceover scripts
 * and herbal medical claim compliance rules. Invalid entries are skipped safely with warnings.
 */
export function validateFinishingPlan(rawPlan, {
  cleanVoiceoverClips = [],
  isHerbalProduct = true,
  width = 720,
  height = 1280
} = {}) {
  const warnings = [];
  if (!rawPlan || typeof rawPlan !== 'object') {
    return { hookCard: null, hookText: '', punches: [], warnings };
  }

  let parsed = rawPlan;
  if (typeof rawPlan === 'string') {
    try {
      parsed = JSON.parse(rawPlan);
    } catch (_) {
      return { hookCard: null, hookText: '', punches: [], warnings: ['finishing_plan_invalid_json'] };
    }
  }

  // 1. Validate Hook Card
  let hookCard = null;
  let hookText = '';
  const rawHook = typeof parsed.hook === 'string' ? sanitizeOverlayTextStrict(parsed.hook) : '';
  if (rawHook) {
    const fitted = fitHookCard(rawHook, { isHerbalProduct, width, height });
    if (fitted) {
      hookCard = fitted;
      hookText = fitted.text;
    } else {
      warnings.push(`finishing_plan.hook rejected by fitHookCard/compliance guard: "${rawHook}"`);
    }
  }

  // Prepare normalized VO token arrays per clip
  const clipTokenLists = (Array.isArray(cleanVoiceoverClips) ? cleanVoiceoverClips : []).map((text) => {
    const clean = sanitizeOverlayTextStrict(String(text || ''));
    return clean.split(/\s+/).map(normAlignmentWord).filter(Boolean);
  });

  // 2. Validate Keyword Punches (exact VO substring, max 2/clip, herbal medical block)
  const rawPunches = Array.isArray(parsed.punches) ? parsed.punches : [];
  const validPunches = [];
  const clipPunchCounts = new Map();

  for (const entry of rawPunches) {
    if (!entry) continue;
    const rawPhrase = Array.isArray(entry)
      ? String(entry[0] || '')
      : String(entry.phrase || entry.text || '');
    const rawType = Array.isArray(entry)
      ? String(entry[1] || 'benefit')
      : String(entry.type || 'benefit');

    const cleanPhrase = sanitizeOverlayTextStrict(rawPhrase);
    if (!cleanPhrase) continue;

    if (cleanPhrase.length > 34) {
      warnings.push(`finishing_plan.punch skipped (>34 chars): "${cleanPhrase}"`);
      continue;
    }

    const needleTokens = cleanPhrase.split(/\s+/).map(normAlignmentWord).filter(Boolean);
    if (needleTokens.length === 0 || needleTokens.length > 4) {
      warnings.push(`finishing_plan.punch skipped (word count ${needleTokens.length}): "${cleanPhrase}"`);
      continue;
    }

    if (isHerbalProduct && isHerbalMedicalClaimPhrase(cleanPhrase)) {
      warnings.push(`finishing_plan.punch blocked (herbal medical claim): "${cleanPhrase}"`);
      continue;
    }

    let matchedClipIndex = -1;
    let matchedWordOffset = -1;
    const hintIdxRaw = entry.clip_index !== undefined
      ? Number(entry.clip_index)
      : (entry.scene !== undefined
          ? Number(entry.scene) - 1
          : (entry.clip !== undefined ? Number(entry.clip) - 1 : -1));

    if (clipTokenLists.length > 0) {
      if (hintIdxRaw >= 0 && hintIdxRaw < clipTokenLists.length) {
        const idx = findContiguousTokenMatchIndex(clipTokenLists[hintIdxRaw], needleTokens);
        if (idx >= 0) {
          matchedClipIndex = hintIdxRaw;
          matchedWordOffset = idx;
        }
      }
      if (matchedClipIndex < 0) {
        for (let ci = 0; ci < clipTokenLists.length; ci++) {
          const idx = findContiguousTokenMatchIndex(clipTokenLists[ci], needleTokens);
          if (idx >= 0) {
            matchedClipIndex = ci;
            matchedWordOffset = idx;
            break;
          }
        }
      }
      if (matchedClipIndex < 0) {
        warnings.push(`finishing_plan.punch skipped (not an exact VO substring): "${cleanPhrase}"`);
        continue;
      }
    } else {
      matchedClipIndex = Math.max(0, Number.isFinite(hintIdxRaw) ? hintIdxRaw : 0);
    }

    const countForClip = clipPunchCounts.get(matchedClipIndex) || 0;
    if (countForClip >= 2) {
      warnings.push(`finishing_plan.punch skipped (>2 punches in clip ${matchedClipIndex}): "${cleanPhrase}"`);
      continue;
    }

    const punchType = ALLOWED_PUNCH_TYPES.has(rawType.toLowerCase()) ? rawType.toLowerCase() : 'benefit';
    clipPunchCounts.set(matchedClipIndex, countForClip + 1);
    validPunches.push({
      phrase: cleanPhrase,
      type: punchType,
      clipIndex: matchedClipIndex,
      wordOffsetInClip: matchedWordOffset
    });
  }

  return {
    hookCard,
    hookText,
    punches: validPunches,
    warnings
  };
}
