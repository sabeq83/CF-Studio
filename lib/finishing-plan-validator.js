import { sanitizeOverlayTextStrict } from './tts-text-sanitizer.js';
import { isHerbalMedicalClaimPhrase } from './tiktok-compliance-service.js';
import { fitHookCard } from './motion-text-engine.js';
import { normAlignmentWord } from './word-alignment-engine.js';
import { hasStrictTemplateCompliance } from './finishing-template-registry.js';

export const ALLOWED_CAPTION_MODES = new Set(['hybrid', 'keyword_only', 'full']);
export const ALLOWED_PUNCH_TYPES = new Set(['benefit', 'result', 'warning', 'hook', 'number', 'problem']);
export const ALLOWED_PATCH_ANCHORS = new Set(['top_right', 'top_left', 'bottom_left', 'bottom_right']);

export function validateBrandPatchSpec(rawPatch, { clipCount = 0, isHerbalProduct = true, strictClaims = false, warnings = [] } = {}) {
  if (!rawPatch || typeof rawPatch !== 'object') return null;
  const clipIdxRaw = rawPatch.clip_index ?? rawPatch.clipIndex ?? (rawPatch.clip !== undefined ? Number(rawPatch.clip) - 1 : undefined);
  const clipIndex = Number(clipIdxRaw);
  if (!Number.isInteger(clipIndex) || clipIndex < 0 || (clipCount > 0 && clipIndex >= clipCount)) {
    warnings.push(`finishing_plan.brand_patch skipped (invalid clip_index: ${clipIdxRaw})`);
    return null;
  }
  const anchorRaw = String(rawPatch.anchor || 'top_right').trim().toLowerCase();
  const anchor = ALLOWED_PATCH_ANCHORS.has(anchorRaw) ? anchorRaw : 'top_right';
  const label = rawPatch.label ? sanitizeOverlayTextStrict(String(rawPatch.label)).slice(0, 32) : '';
  if (label && (isHerbalProduct || strictClaims) && isHerbalMedicalClaimPhrase(label, { strict: strictClaims })) {
    warnings.push(`finishing_plan.brand_patch skipped (medical claim label: "${label}")`);
    return null;
  }
  const rect = rawPatch.rect && typeof rawPatch.rect === 'object' ? {
    left: Number(rawPatch.rect.left),
    top: Number(rawPatch.rect.top),
    width: Number(rawPatch.rect.width),
    height: Number(rawPatch.rect.height)
  } : undefined;
  return { clipIndex, anchor, label, ...(rect ? { rect } : {}) };
}

export const FINISHING_PLAN_PROMPT_APPENDIX = `
### OPSIONAL — FINISHING PASS TIMELINE PLAN ("finishing_plan"):
Sertakan key opsional "finishing_plan" di root JSON untuk overlay finishing video:
- "hook": teks singkat Hook Card Frame 0-1.75s maksimal 2 baris (<= 34 karakter total, dilarang klaim medis mengobati/menurunkan penyakit untuk produk herbal).
- "punches": maksimal 2 frasa kunci per klip; SETIAP "phrase" WAJIB berupa **substring kata persis** dari naskah VO klip tersebut (2-4 kata pendek, tanpa mengarang kata baru), bertipe "benefit" | "result" | "warning" | "hook".`.trim();

/**
 * Generates the finishing_plan JSON snippet injected into prompt schemas.
 * Preserves the exact Phase 1 schema unless a specialized Phase 2c template requires extra fields (R12.2).
 */
export function buildFinishingPlanPromptJson(finishingTemplate = 'none', indent = '  ') {
  const tpl = String(finishingTemplate || 'none').trim().toLowerCase();
  const baseLines = [
    `${indent}"finishing_plan": {`,
    `${indent}  "hook": "(Opsional) Teks Hook Card singkat Frame 0-1.75s max 2 baris (<=34 huruf, hindari klaim medis herbal).",`
  ];

  if (tpl === 'tips_listicle') {
    baseLines.push(
      `${indent}  "punches": [`,
      `${indent}    { "clip_index": 0, "phrase": "frasa persis dari narasi VO klip", "type": "benefit | result | warning | hook | number | problem", "punch_display": "(Opsional) Format angka/simbol setara makna mis. '10%' untuk 'sepuluh persen'" }`,
      `${indent}  ],`,
      `${indent}  "tips": [`,
      `${indent}    { "clip_index": 0, "text": "Ringkasan tip singkat <= 6 kata dari VO klip terkait" }`,
      `${indent}  ]`
    );
  } else if (tpl === 'ramuan_ritual') {
    baseLines.push(
      `${indent}  "punches": [`,
      `${indent}    { "clip_index": 0, "phrase": "frasa persis dari narasi VO klip (DILARANG klaim: lemak, metabolisme, detoks, ginjal, gula darah, kolesterol, visceral)", "type": "benefit | result | warning | hook" }`,
      `${indent}  ],`,
      `${indent}  "timing_badges": [`,
      `${indent}    { "clip_index": 0, "trigger": "frasa pemicu persis dari narasi VO klip", "emoji": "🌙", "title": "SEBELUM TIDUR | PAGI PERUT KOSONG | DIAMKAN 15 MENIT", "sub": "(Opsional) Keterangan singkat non-klaim max 28 huruf" }`,
      `${indent}  ]`
    );
  } else if (tpl === 'problem_solution') {
    baseLines.push(
      `${indent}  "punches": [`,
      `${indent}    { "clip_index": 0, "phrase": "frasa persis dari narasi VO klip", "type": "problem | benefit | result | hook" }`,
      `${indent}  ],`,
      `${indent}  "chapters": [`,
      `${indent}    { "clip_index": 0, "phase": "MASALAH | PENYEBAB | SOLUSI | HASIL" }`,
      `${indent}  ],`,
      `${indent}  "callouts": [`,
      `${indent}    { "clip_index": 2, "trigger": "frasa material/titik masalah persis dari VO", "text": "NAMA MATERIAL / TITIK MASALAH (kapital max 24 huruf, WAJIB ada di VO)", "sub": "(Opsional) Keterangan singkat max 28 huruf dari VO", "x": 50, "y": 27 }`,
      `${indent}  ]`
    );
  } else {
    baseLines.push(
      `${indent}  "punches": [`,
      `${indent}    { "clip_index": 0, "phrase": "frasa persis dari narasi VO klip", "type": "benefit | result | warning | hook" }`,
      `${indent}  ]`
    );
  }

  baseLines.push(`${indent}}`);
  return baseLines.join('\n');
}

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

const NUMBER_WORD_ALIASES = {
  nol: ['0'], zero: ['0'],
  satu: ['1'], one: ['1'],
  dua: ['2'], two: ['2'],
  tiga: ['3'], three: ['3'],
  empat: ['4'], four: ['4'],
  lima: ['5'], five: ['5'],
  enam: ['6'], six: ['6'],
  tujuh: ['7'], seven: ['7'],
  delapan: ['8'], eight: ['8'],
  sembilan: ['9'], nine: ['9'],
  sepuluh: ['10'], ten: ['10'],
  seratus: ['100'], hundred: ['100']
};

function expandComparisonTokens(tokens = []) {
  const out = new Set();
  for (const tok of tokens) {
    if (!tok) continue;
    out.add(tok);
    if (tok.length >= 4) out.add(tok.slice(0, 4));
    const aliases = NUMBER_WORD_ALIASES[tok];
    if (aliases) aliases.forEach((a) => out.add(a));
    for (const [word, nums] of Object.entries(NUMBER_WORD_ALIASES)) {
      if (nums.includes(tok)) out.add(word);
    }
  }
  return out;
}

function hasVoTokenGrounding(candidateText, clipTokens = []) {
  if (!Array.isArray(clipTokens) || clipTokens.length === 0) return true;
  const candTokens = String(candidateText || '')
    .split(/[\s/%.,!?:-]+/)
    .map(normAlignmentWord)
    .filter((t) => t && t.length >= 2);
  if (candTokens.length === 0) return false;
  const clipSet = expandComparisonTokens(clipTokens);
  const candSet = expandComparisonTokens(candTokens);
  for (const tk of candSet) {
    if (tk.length >= 3 || /^\d+$/.test(tk)) {
      if (clipSet.has(tk)) return true;
    }
  }
  return false;
}

export function validateTipsList(rawTips, { clipTokenLists = [], isHerbalProduct = true, warnings = [] } = {}) {
  if (!Array.isArray(rawTips) || rawTips.length === 0) return [];
  const valid = [];
  const seenClips = new Set();

  for (const entry of rawTips) {
    if (!entry || typeof entry !== 'object') continue;
    const rawClipIdx = entry.clip_index ?? entry.clipIndex ?? (entry.scene !== undefined ? Number(entry.scene) - 1 : (entry.clip !== undefined ? Number(entry.clip) - 1 : -1));
    const clipIndex = Number(rawClipIdx);
    if (!Number.isInteger(clipIndex) || clipIndex < 0 || (clipTokenLists.length > 0 && clipIndex >= clipTokenLists.length)) {
      warnings.push(`finishing_plan.tips skipped (invalid clip_index: ${rawClipIdx})`);
      continue;
    }
    if (seenClips.has(clipIndex)) {
      warnings.push(`finishing_plan.tips skipped (duplicate clip_index ${clipIndex})`);
      continue;
    }

    const cleanText = sanitizeOverlayTextStrict(String(entry.text || ''));
    if (!cleanText) continue;

    const words = cleanText.split(/\s+/).filter(Boolean);
    if (words.length > 6) {
      warnings.push(`finishing_plan.tips skipped (>6 words): "${cleanText}"`);
      continue;
    }
    if (cleanText.length > 52) {
      warnings.push(`finishing_plan.tips skipped (>52 chars): "${cleanText}"`);
      continue;
    }
    if (isHerbalProduct && isHerbalMedicalClaimPhrase(cleanText)) {
      warnings.push(`finishing_plan.tips blocked (herbal medical claim): "${cleanText}"`);
      continue;
    }

    if (clipTokenLists.length > 0 && !hasVoTokenGrounding(cleanText, clipTokenLists[clipIndex])) {
      warnings.push(`finishing_plan.tips skipped (not grounded in clip ${clipIndex} VO): "${cleanText}"`);
      continue;
    }

    seenClips.add(clipIndex);
    valid.push({ clipIndex, text: cleanText });
    if (valid.length >= 8) break;
  }

  valid.sort((a, b) => a.clipIndex - b.clipIndex);
  const total = valid.length;
  return valid.map((item, idx) => ({
    ...item,
    n: idx + 1,
    total
  }));
}

const ALLOWED_TIMING_TITLE_RE = /^(?:SEBELUM TIDUR|PAGI PERUT KOSONG|PAGI HARI|MALAM HARI|SEBELUM MAKAN|SETELAH MAKAN|DIAMKAN\b[^|]{0,20}|REBUS\b[^|]{0,20}|SEDUH\b[^|]{0,20}|SAAT HANGAT|MINUM HANGAT|HANGAT ATAU DINGIN|BEFORE BED|MORNING FASTING|BEFORE MEAL|AFTER MEAL|STEEP\b[^|]{0,20}|SIMMER\b[^|]{0,20}|WHILE WARM)$/i;

const TIMING_EMOJI_WHITELIST = new Set(['🌙', '🌅', '☀️', '⏱️', '⏱', '🍵', '🫗', '🌿', '🍯', '🍋']);

function normalizeTimingEmoji(rawEmoji) {
  const txt = String(rawEmoji || '').trim();
  for (const em of TIMING_EMOJI_WHITELIST) {
    if (txt.includes(em)) return em;
  }
  return '⏱️';
}

/**
 * Validates `finishing_plan.timing_badges` for `ramuan_ritual`:
 * - `trigger` must be an exact contiguous VO phrase
 * - `title` must match the fixed timing whitelist or be token-grounded in `recipeTexts`
 * - Strict medical/wellness claims are blocked from `trigger`, `title`, and `sub`
 */
export function validateTimingBadges(rawBadges, {
  clipTokenLists = [],
  recipeTexts = [],
  strictClaims = true,
  isHerbalProduct = true,
  warnings = []
} = {}) {
  if (!Array.isArray(rawBadges) || rawBadges.length === 0) return [];
  const recipeTokenLists = (Array.isArray(recipeTexts) ? recipeTexts : [])
    .map((line) => sanitizeOverlayTextStrict(String(line || '')).split(/[\s/%.,!?:-]+/).map(normAlignmentWord).filter(Boolean))
    .filter((toks) => toks.length > 0);

  const valid = [];
  const seenKeys = new Set();

  for (const entry of rawBadges) {
    if (!entry || typeof entry !== 'object') continue;
    const rawTrigger = sanitizeOverlayTextStrict(String(entry.trigger || entry.phrase || ''));
    const rawTitle = sanitizeOverlayTextStrict(String(entry.title || entry.label || ''));
    const rawSub = sanitizeOverlayTextStrict(String(entry.sub || entry.subtitle || ''));
    if (!rawTrigger || !rawTitle) {
      warnings.push('finishing_plan.timing_badges skipped (missing trigger or title)');
      continue;
    }

    const cleanTitle = rawTitle.toUpperCase().slice(0, 28).trim();
    const cleanSub = rawSub ? rawSub.slice(0, 28).trim() : '';

    if ((isHerbalProduct || strictClaims) && (
      isHerbalMedicalClaimPhrase(rawTrigger, { strict: strictClaims })
      || isHerbalMedicalClaimPhrase(cleanTitle, { strict: strictClaims })
      || (cleanSub && isHerbalMedicalClaimPhrase(cleanSub, { strict: strictClaims }))
    )) {
      warnings.push(`finishing_plan.timing_badges blocked (strict claim): "${cleanTitle}"`);
      continue;
    }

    const needleTokens = rawTrigger.split(/\s+/).map(normAlignmentWord).filter(Boolean);
    if (needleTokens.length === 0 || needleTokens.length > 5) {
      warnings.push(`finishing_plan.timing_badges skipped (invalid trigger token count): "${rawTrigger}"`);
      continue;
    }

    const isTitleAllowed = ALLOWED_TIMING_TITLE_RE.test(cleanTitle)
      || recipeTokenLists.some((rTokens) => hasVoTokenGrounding(cleanTitle, rTokens));
    if (!isTitleAllowed) {
      warnings.push(`finishing_plan.timing_badges skipped (title outside whitelist/recipe): "${cleanTitle}"`);
      continue;
    }

    let matchedClipIndex = -1;
    let matchedWordOffset = -1;
    const hintIdxRaw = entry.clip_index !== undefined
      ? Number(entry.clip_index)
      : (entry.clip !== undefined ? Number(entry.clip) - 1 : -1);

    if (clipTokenLists.length > 0) {
      if (Number.isInteger(hintIdxRaw) && hintIdxRaw >= 0 && hintIdxRaw < clipTokenLists.length) {
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
        warnings.push(`finishing_plan.timing_badges skipped (trigger not found in VO): "${rawTrigger}"`);
        continue;
      }
    } else {
      matchedClipIndex = Math.max(0, Number.isFinite(hintIdxRaw) ? hintIdxRaw : 0);
      matchedWordOffset = 0;
    }

    const dedupKey = `${matchedClipIndex}:${cleanTitle}`;
    if (seenKeys.has(dedupKey)) continue;
    seenKeys.add(dedupKey);

    valid.push({
      clipIndex: matchedClipIndex,
      wordOffsetInClip: matchedWordOffset,
      trigger: rawTrigger,
      wordCount: needleTokens.length,
      emoji: normalizeTimingEmoji(entry.emoji),
      title: cleanTitle,
      sub: cleanSub
    });

    if (valid.length >= 4) break;
  }

  return valid;
}

export const CHAPTER_PHASE_META = {
  problem: { n: 1, phaseKey: 'problem', color: '#e5484d', id: 'MASALAH', en: 'PROBLEM' },
  cause: { n: 2, phaseKey: 'cause', color: '#f2850d', id: 'PENYEBAB', en: 'CAUSE' },
  solution: { n: 3, phaseKey: 'solution', color: '#1f9d55', id: 'SOLUSI', en: 'SOLUTION' },
  result: { n: 4, phaseKey: 'result', color: '#2f7fe0', id: 'HASIL', en: 'RESULT' }
};

function normalizeChapterPhase(rawPhase) {
  const txt = String(rawPhase || '').trim().toLowerCase();
  if (!txt) return null;
  if (/^(problem|masalah|isu|keluhan)$/.test(txt)) return CHAPTER_PHASE_META.problem;
  if (/^(cause|penyebab|alasan|akar|kenapa)$/.test(txt)) return CHAPTER_PHASE_META.cause;
  if (/^(solution|solusi|material|cara|treatment)$/.test(txt)) return CHAPTER_PHASE_META.solution;
  if (/^(result|hasil|efek|dampak|after)$/.test(txt)) return CHAPTER_PHASE_META.result;
  return null;
}

/**
 * Validates `finishing_plan.chapters` for `problem_solution`:
 * maps clips strictly to MASALAH/PENYEBAB/SOLUSI/HASIL (or localized equivalents).
 */
export function validateChapters(rawChapters, {
  clipCount = 0,
  targetLanguage = 'id-ID',
  isHerbalProduct = false,
  strictClaims = false,
  warnings = []
} = {}) {
  if (!Array.isArray(rawChapters) || rawChapters.length === 0) return [];
  const isEn = String(targetLanguage || '').trim().toLowerCase().startsWith('en');
  const seenClips = new Set();
  const valid = [];

  for (const entry of rawChapters) {
    if (!entry || typeof entry !== 'object') continue;
    const rawIdx = entry.clip_index ?? entry.clipIndex ?? (entry.scene !== undefined ? Number(entry.scene) - 1 : (entry.clip !== undefined ? Number(entry.clip) - 1 : -1));
    const clipIndex = Number(rawIdx);
    if (!Number.isInteger(clipIndex) || clipIndex < 0 || (clipCount > 0 && clipIndex >= clipCount)) {
      warnings.push(`finishing_plan.chapters skipped (invalid clip_index: ${rawIdx})`);
      continue;
    }
    if (seenClips.has(clipIndex)) {
      warnings.push(`finishing_plan.chapters skipped (duplicate clip_index ${clipIndex})`);
      continue;
    }

    const phaseMeta = normalizeChapterPhase(entry.phase || entry.label || entry.name);
    if (!phaseMeta) {
      warnings.push(`finishing_plan.chapters skipped (unknown phase: "${entry.phase || entry.label || ''}")`);
      continue;
    }
    const label = isEn ? phaseMeta.en : phaseMeta.id;
    if ((isHerbalProduct || strictClaims) && isHerbalMedicalClaimPhrase(label, { strict: strictClaims })) {
      warnings.push(`finishing_plan.chapters blocked (claim): "${label}"`);
      continue;
    }

    seenClips.add(clipIndex);
    valid.push({
      clipIndex,
      n: phaseMeta.n,
      phaseKey: phaseMeta.phaseKey,
      label,
      color: phaseMeta.color
    });
    if (valid.length >= 4) break;
  }

  return valid.sort((a, b) => a.clipIndex - b.clipIndex);
}

/**
 * Validates `finishing_plan.callouts` for `problem_solution`:
 * - `trigger` must match contiguous VO words
 * - `text` (<= 26 chars) must be grounded in VO tokens of the matched clip (no fabricated material names)
 */
export function validateCallouts(rawCallouts, {
  clipTokenLists = [],
  isHerbalProduct = false,
  strictClaims = false,
  warnings = []
} = {}) {
  if (!Array.isArray(rawCallouts) || rawCallouts.length === 0) return [];
  const valid = [];
  const seenKeys = new Set();

  for (const entry of rawCallouts) {
    if (!entry || typeof entry !== 'object') continue;
    const rawTrigger = sanitizeOverlayTextStrict(String(entry.trigger || entry.phrase || ''));
    const rawText = sanitizeOverlayTextStrict(String(entry.text || entry.label || ''));
    const rawSub = sanitizeOverlayTextStrict(String(entry.sub || entry.subtitle || ''));
    if (!rawTrigger || !rawText) {
      warnings.push('finishing_plan.callouts skipped (missing trigger or text)');
      continue;
    }

    const cleanText = rawText.toUpperCase().slice(0, 26).trim();
    const cleanSub = rawSub ? rawSub.slice(0, 32).trim() : '';

    if ((isHerbalProduct || strictClaims) && (
      isHerbalMedicalClaimPhrase(rawTrigger, { strict: strictClaims })
      || isHerbalMedicalClaimPhrase(cleanText, { strict: strictClaims })
      || (cleanSub && isHerbalMedicalClaimPhrase(cleanSub, { strict: strictClaims }))
    )) {
      warnings.push(`finishing_plan.callouts blocked (claim): "${cleanText}"`);
      continue;
    }

    const needleTokens = rawTrigger.split(/\s+/).map(normAlignmentWord).filter(Boolean);
    if (needleTokens.length === 0 || needleTokens.length > 5) {
      warnings.push(`finishing_plan.callouts skipped (invalid trigger word count): "${rawTrigger}"`);
      continue;
    }

    let matchedClipIndex = -1;
    let matchedWordOffset = -1;
    const hintIdxRaw = entry.clip_index !== undefined
      ? Number(entry.clip_index)
      : (entry.clip !== undefined ? Number(entry.clip) - 1 : -1);

    if (clipTokenLists.length > 0) {
      if (Number.isInteger(hintIdxRaw) && hintIdxRaw >= 0 && hintIdxRaw < clipTokenLists.length) {
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
        warnings.push(`finishing_plan.callouts skipped (trigger not found in VO): "${rawTrigger}"`);
        continue;
      }
      if (!hasVoTokenGrounding(cleanText, clipTokenLists[matchedClipIndex])) {
        warnings.push(`finishing_plan.callouts skipped (text not grounded in clip ${matchedClipIndex} VO): "${cleanText}"`);
        continue;
      }
    } else {
      matchedClipIndex = Math.max(0, Number.isFinite(hintIdxRaw) ? hintIdxRaw : 0);
      matchedWordOffset = 0;
    }

    const dedupKey = `${matchedClipIndex}:${cleanText}`;
    if (seenKeys.has(dedupKey)) continue;
    seenKeys.add(dedupKey);

    const xNum = Number(entry.x);
    const yNum = Number(entry.y);
    const lineNum = Number(entry.line);
    const x = Number.isFinite(xNum) ? Math.min(74, Math.max(22, xNum)) : 50;
    const y = Number.isFinite(yNum) ? Math.min(42, Math.max(18, yNum)) : 27;
    const line = Number.isFinite(lineNum) ? Math.min(18, Math.max(8, lineNum)) : 13;

    valid.push({
      clipIndex: matchedClipIndex,
      wordOffsetInClip: matchedWordOffset,
      trigger: rawTrigger,
      wordCount: needleTokens.length,
      text: cleanText,
      sub: cleanSub,
      x,
      y,
      line
    });
    if (valid.length >= 4) break;
  }

  return valid;
}

/**
 * Strictly validates Gemini's optional `finishing_plan` against clean voiceover scripts
 * and herbal medical claim compliance rules. Invalid entries are skipped safely with warnings.
 */
export function validateFinishingPlan(rawPlan, {
  cleanVoiceoverClips = [],
  isHerbalProduct = true,
  finishingTemplate = 'none',
  strictClaims = false,
  recipeTexts = [],
  targetLanguage = 'id-ID',
  width = 720,
  height = 1280
} = {}) {
  const warnings = [];
  if (!rawPlan || typeof rawPlan !== 'object') {
    return { hookCard: null, hookText: '', punches: [], tips: [], timingBadges: [], chapters: [], callouts: [], brandPatch: null, warnings };
  }

  let parsed = rawPlan;
  if (typeof rawPlan === 'string') {
    try {
      parsed = JSON.parse(rawPlan);
    } catch (_) {
      return { hookCard: null, hookText: '', punches: [], tips: [], timingBadges: [], chapters: [], callouts: [], brandPatch: null, warnings: ['finishing_plan_invalid_json'] };
    }
  }

  const normalizedTpl = String(finishingTemplate || 'none').trim().toLowerCase();
  const useStrictClaims = Boolean(strictClaims || hasStrictTemplateCompliance(normalizedTpl));
  const effectiveHerbal = Boolean(isHerbalProduct || useStrictClaims);

  // 1. Validate Hook Card
  let hookCard = null;
  let hookText = '';
  const rawHook = typeof parsed.hook === 'string' ? sanitizeOverlayTextStrict(parsed.hook) : '';
  if (rawHook) {
    const fitted = fitHookCard(rawHook, { isHerbalProduct: effectiveHerbal, strictClaims: useStrictClaims, width, height });
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

    if (effectiveHerbal && isHerbalMedicalClaimPhrase(cleanPhrase, { strict: useStrictClaims })) {
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
    const rawDisplay = Array.isArray(entry)
      ? (entry[2] || '')
      : (entry.punch_display || entry.punchDisplay || entry.display || '');
    let displayText = '';
    if (rawDisplay) {
      const cleanDisplay = sanitizeOverlayTextStrict(String(rawDisplay)).slice(0, 28);
      if (cleanDisplay && effectiveHerbal && isHerbalMedicalClaimPhrase(cleanDisplay, { strict: useStrictClaims })) {
        warnings.push(`finishing_plan.punch_display blocked (herbal medical claim): "${cleanDisplay}"`);
      } else if (cleanDisplay) {
        displayText = cleanDisplay;
      }
    }

    clipPunchCounts.set(matchedClipIndex, countForClip + 1);
    validPunches.push({
      phrase: cleanPhrase,
      type: punchType,
      clipIndex: matchedClipIndex,
      wordOffsetInClip: matchedWordOffset,
      ...(displayText ? { displayText } : {})
    });
  }

  const rawBrandPatch = parsed.brand_patch || parsed.brandPatch || null;
  const brandPatch = rawBrandPatch
    ? validateBrandPatchSpec(rawBrandPatch, {
        clipCount: clipTokenLists.length,
        isHerbalProduct: effectiveHerbal,
        strictClaims: useStrictClaims,
        warnings
      })
    : null;

  const tips = validateTipsList(parsed.tips, {
    clipTokenLists,
    isHerbalProduct: effectiveHerbal,
    warnings
  });

  const timingBadges = normalizedTpl === 'ramuan_ritual'
    ? validateTimingBadges(parsed.timing_badges || parsed.timingBadges, {
        clipTokenLists,
        recipeTexts,
        strictClaims: useStrictClaims,
        isHerbalProduct: effectiveHerbal,
        warnings
      })
    : [];

  const chapters = normalizedTpl === 'problem_solution'
    ? validateChapters(parsed.chapters, {
        clipCount: clipTokenLists.length,
        targetLanguage,
        isHerbalProduct: effectiveHerbal,
        strictClaims: useStrictClaims,
        warnings
      })
    : [];

  const callouts = normalizedTpl === 'problem_solution'
    ? validateCallouts(parsed.callouts, {
        clipTokenLists,
        isHerbalProduct: effectiveHerbal,
        strictClaims: useStrictClaims,
        warnings
      })
    : [];

  return {
    hookCard,
    hookText,
    punches: validPunches,
    tips,
    timingBadges,
    chapters,
    callouts,
    brandPatch,
    warnings
  };
}
