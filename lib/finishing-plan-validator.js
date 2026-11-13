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
  } else if (tpl === 'angka_banding') {
    baseLines.push(
      `${indent}  "punches": [`,
      `${indent}    { "clip_index": 0, "phrase": "frasa persis dari narasi VO klip", "type": "problem | benefit | result | number | hook", "punch_display": "(Opsional) Format angka setara makna bila disebut di VO" }`,
      `${indent}  ],`,
      `${indent}  "compare": [`,
      `${indent}    { "clip_index": 1, "trigger": "frasa pembanding persis dari VO", "left": { "title": "SISI PRO (max 22 huruf dari VO)", "sub": "ringkasan singkat max 32 huruf", "good": true }, "right": { "title": "PEMBANDING", "sub": "ringkasan singkat max 32 huruf", "good": false } }`,
      `${indent}  ],`,
      `${indent}  "chips": [`,
      `${indent}    { "clip_index": 2, "trigger": "frasa pemicu awal dari VO", "items": [{ "trigger": "nama material persis di VO", "label": "NAMA MATERIAL" }], "foot": "(Opsional) frasa singkat dari VO" }`,
      `${indent}  ],`,
      `${indent}  "numbers": [`,
      `${indent}    { "clip_index": 0, "trigger": "frasa angka persis di VO", "from_value": 0, "value": 0, "unit": "", "label": "HANYA isi jika angka nyata disebut di VO/data produk; kosongkan [] jika tidak ada angka" }`,
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

const ID_NUM_BASE = {
  nol: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5,
  enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelah: 11, sebelas: 11
};
const ID_NUM_SCALE = {
  belas: 10,
  puluh: 10,
  ratus: 100,
  ribu: 1000,
  rb: 1000,
  juta: 1000000,
  jt: 1000000
};

/**
 * Extracts all numeric values from text while ignoring area-unit exponents like m² / m2.
 * Supports Indonesian grouped thousands (e.g. 150.000), decimals (12,5 / 12.5), multipliers (150 ribu), and word numbers (sepuluh -> 10).
 */
export function extractNumericValuesFromText(text = '') {
  const nums = [];
  if (!text) return nums;
  const cleaned = sanitizeOverlayTextStrict(String(text))
    .replace(/\b(?:m|cm|mm|km)\s*(?:2|²|3|³)\b/gi, ' unit_dim ')
    .replace(/\b(?:3d|2d|p3k|s1|s2)\b/gi, ' token_code ');

  const digitRe = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?(?:\s*(?:ribu|rb|juta|jt))?/gi;
  let m;
  while ((m = digitRe.exec(cleaned)) !== null) {
    const raw = m[0].trim().toLowerCase();
    const multMatch = raw.match(/(ribu|rb|juta|jt)$/);
    const baseStr = raw.replace(/\s*(ribu|rb|juta|jt)$/i, '').trim();
    let parsedNum;
    if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(baseStr)) {
      parsedNum = Number(baseStr.replace(/\./g, '').replace(',', '.'));
    } else if (/^\d+,\d+$/.test(baseStr)) {
      parsedNum = Number(baseStr.replace(',', '.'));
    } else {
      parsedNum = Number(baseStr);
    }
    if (!Number.isFinite(parsedNum)) continue;
    nums.push(parsedNum);
    if (multMatch) {
      const factor = (multMatch[1] === 'juta' || multMatch[1] === 'jt') ? 1000000 : 1000;
      nums.push(parsedNum * factor);
    }
  }

  const tokens = cleaned.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === 'seratus') nums.push(100);
    else if (tok === 'seribu') nums.push(1000);
    else if (tok === 'sejuta') nums.push(1000000);
    else if (Object.prototype.hasOwnProperty.call(ID_NUM_BASE, tok)) {
      const baseVal = ID_NUM_BASE[tok];
      nums.push(baseVal);
      const next = tokens[i + 1];
      if (next === 'belas') {
        nums.push(10 + baseVal);
      } else if (next && Object.prototype.hasOwnProperty.call(ID_NUM_SCALE, next)) {
        const scaled = baseVal * ID_NUM_SCALE[next];
        nums.push(scaled);
        const afterNext = tokens[i + 2];
        if (afterNext && Object.prototype.hasOwnProperty.call(ID_NUM_BASE, afterNext) && next === 'puluh') {
          nums.push(scaled + ID_NUM_BASE[afterNext]);
        }
      }
    }
  }

  return Array.from(new Set(nums.filter((n) => Number.isFinite(n))));
}

/**
 * Builds verified numeric set strictly from clean VO clips + structured product facts.
 */
export function buildVerifiedNumericSet(cleanVoiceoverClips = [], productData = null) {
  const verified = new Set();
  for (const vo of (Array.isArray(cleanVoiceoverClips) ? cleanVoiceoverClips : [])) {
    for (const n of extractNumericValuesFromText(String(vo || ''))) {
      verified.add(n);
    }
  }
  if (productData && typeof productData === 'object') {
    const allowedFields = [
      'price', 'harga', 'promo_price', 'discount_price', 'original_price',
      'netto', 'weight', 'berat', 'volume', 'specification', 'spec_line',
      'usp', 'unique_selling_point', 'description', 'product_description',
      'product_name', 'nama_produk', 'title', 'warranty', 'garansi', 'category'
    ];
    for (const key of allowedFields) {
      const val = productData[key];
      if (val !== undefined && val !== null && val !== '') {
        for (const n of extractNumericValuesFromText(String(val))) {
          verified.add(n);
        }
      }
    }
  }
  return verified;
}

function hasAnyUnverifiedNumber(text = '', verifiedNumericSet = new Set()) {
  const nums = extractNumericValuesFromText(text);
  if (nums.length === 0) return false;
  return nums.some((n) => !verifiedNumericSet.has(n));
}

function resolveTriggerClipAndOffset({ rawTrigger, hintClipRaw, clipTokenLists }) {
  const needleTokens = sanitizeOverlayTextStrict(String(rawTrigger || ''))
    .split(/\s+/)
    .map(normAlignmentWord)
    .filter(Boolean);
  if (needleTokens.length === 0) return { clipIndex: -1, wordOffsetInClip: 0, wordCount: 0 };
  const hintIdxRaw = Number.isInteger(Number(hintClipRaw)) ? Number(hintClipRaw) : -1;

  if (clipTokenLists.length === 0) {
    return { clipIndex: Math.max(0, hintIdxRaw >= 0 ? hintIdxRaw : 0), wordOffsetInClip: 0, wordCount: needleTokens.length };
  }
  if (hintIdxRaw >= 0 && hintIdxRaw < clipTokenLists.length) {
    const idx = findContiguousTokenMatchIndex(clipTokenLists[hintIdxRaw], needleTokens);
    if (idx >= 0) return { clipIndex: hintIdxRaw, wordOffsetInClip: idx, wordCount: needleTokens.length };
  }
  for (let ci = 0; ci < clipTokenLists.length; ci++) {
    const idx = findContiguousTokenMatchIndex(clipTokenLists[ci], needleTokens);
    if (idx >= 0) return { clipIndex: ci, wordOffsetInClip: idx, wordCount: needleTokens.length };
  }
  return { clipIndex: -1, wordOffsetInClip: -1, wordCount: needleTokens.length };
}

/**
 * Validates `finishing_plan.compare` cards for template `angka_banding`.
 * Enforces VO trigger match, content token grounding, and strict zero-fake-number guard.
 */
export function validateCompareList(rawCompare, {
  clipTokenLists = [],
  verifiedNumericSet = new Set(),
  productTokens = [],
  isHerbalProduct = false,
  strictClaims = false,
  warnings = []
} = {}) {
  if (!Array.isArray(rawCompare) || rawCompare.length === 0) return [];
  const valid = [];
  const allVoTokens = Array.from(new Set([...clipTokenLists.flat(), ...productTokens]));

  for (const entry of rawCompare) {
    if (!entry || typeof entry !== 'object') continue;
    const rawTrigger = sanitizeOverlayTextStrict(String(entry.trigger || ''));
    const hintIdxRaw = entry.clip_index !== undefined
      ? Number(entry.clip_index)
      : (entry.clip !== undefined ? Number(entry.clip) - 1 : -1);

    const loc = resolveTriggerClipAndOffset({ rawTrigger, hintClipRaw: hintIdxRaw, clipTokenLists });
    if (clipTokenLists.length > 0 && loc.clipIndex < 0) {
      warnings.push(`finishing_plan.compare skipped (trigger not found in VO): "${rawTrigger}"`);
      continue;
    }

    const leftObj = entry.left && typeof entry.left === 'object' ? entry.left : {};
    const rightObj = entry.right && typeof entry.right === 'object' ? entry.right : {};
    const leftTitle = sanitizeOverlayTextStrict(String(leftObj.title || '')).slice(0, 24);
    const rightTitle = sanitizeOverlayTextStrict(String(rightObj.title || '')).slice(0, 24);
    const leftSub = sanitizeOverlayTextStrict(String(leftObj.sub || '')).slice(0, 34);
    const rightSub = sanitizeOverlayTextStrict(String(rightObj.sub || '')).slice(0, 34);

    if (!leftTitle || !rightTitle) {
      warnings.push('finishing_plan.compare skipped (empty left or right title)');
      continue;
    }

    const combinedText = `${leftTitle} ${leftSub} ${rightTitle} ${rightSub}`;
    if (hasAnyUnverifiedNumber(combinedText, verifiedNumericSet)) {
      warnings.push(`finishing_plan.compare skipped (unverified/fabricated number not in VO/product): "${leftTitle} vs ${rightTitle}"`);
      continue;
    }
    if ((isHerbalProduct || strictClaims) && isHerbalMedicalClaimPhrase(combinedText, { strict: strictClaims })) {
      warnings.push(`finishing_plan.compare skipped (herbal claim guard): "${leftTitle} vs ${rightTitle}"`);
      continue;
    }
    if (allVoTokens.length > 0 && !hasVoTokenGrounding(combinedText, allVoTokens)) {
      warnings.push(`finishing_plan.compare skipped (not grounded in VO/product context): "${leftTitle} vs ${rightTitle}"`);
      continue;
    }

    valid.push({
      clipIndex: loc.clipIndex,
      wordOffsetInClip: loc.wordOffsetInClip,
      wordCount: Math.max(1, loc.wordCount),
      trigger: rawTrigger,
      left: {
        title: leftTitle,
        sub: leftSub,
        good: leftObj.good !== undefined ? Boolean(leftObj.good) : true
      },
      right: {
        title: rightTitle,
        sub: rightSub,
        good: rightObj.good !== undefined ? Boolean(rightObj.good) : false
      }
    });
    if (valid.length >= 2) break;
  }

  return valid;
}

/**
 * Strictly validates `finishing_plan.numbers` counter/meter entries for template `angka_banding`.
 * ONLY accepts numeric values that genuinely exist in clean VO or structured productData (zero fabrication).
 */
export function validateNumbersList(rawNumbers, {
  clipTokenLists = [],
  verifiedNumericSet = new Set(),
  isHerbalProduct = false,
  strictClaims = false,
  warnings = []
} = {}) {
  if (!Array.isArray(rawNumbers) || rawNumbers.length === 0) return [];
  if (verifiedNumericSet.size === 0) {
    warnings.push('finishing_plan.numbers skipped (no numeric values found in clean VO or product data)');
    return [];
  }

  const valid = [];
  for (const entry of rawNumbers) {
    if (!entry || typeof entry !== 'object') continue;
    const rawTrigger = sanitizeOverlayTextStrict(String(entry.trigger || ''));
    const hintIdxRaw = entry.clip_index !== undefined
      ? Number(entry.clip_index)
      : (entry.clip !== undefined ? Number(entry.clip) - 1 : -1);

    const loc = resolveTriggerClipAndOffset({ rawTrigger, hintClipRaw: hintIdxRaw, clipTokenLists });
    if (clipTokenLists.length > 0 && loc.clipIndex < 0) {
      warnings.push(`finishing_plan.numbers skipped (trigger not found in VO): "${rawTrigger}"`);
      continue;
    }

    const toRaw = entry.value ?? entry.to_value ?? entry.toValue;
    const fromRaw = entry.from_value ?? entry.fromValue;
    const cleanLabel = sanitizeOverlayTextStrict(String(entry.label || '')).slice(0, 32);
    const cleanUnit = sanitizeOverlayTextStrict(String(entry.unit || '')).slice(0, 12);

    const probeFrom = (fromRaw !== undefined && fromRaw !== null && Number(fromRaw) !== 0) ? fromRaw : '';
    const probeText = [toRaw, probeFrom, cleanUnit, cleanLabel].filter((v) => v !== undefined && v !== null && v !== '').join(' ');
    const foundNumbers = extractNumericValuesFromText(probeText);
    const targetNums = toRaw !== undefined && toRaw !== null ? extractNumericValuesFromText(String(toRaw)) : [];

    if (foundNumbers.length === 0) {
      warnings.push(`finishing_plan.numbers skipped (missing numeric value): "${cleanLabel || rawTrigger}"`);
      continue;
    }
    const unverified = foundNumbers.filter((n) => !verifiedNumericSet.has(n));
    if (unverified.length > 0) {
      warnings.push(`finishing_plan.numbers skipped (fabricated number not in VO/product: ${unverified.join(', ')}): "${probeText}"`);
      continue;
    }
    if (cleanLabel && (isHerbalProduct || strictClaims) && isHerbalMedicalClaimPhrase(cleanLabel, { strict: strictClaims })) {
      warnings.push(`finishing_plan.numbers skipped (herbal claim guard): "${cleanLabel}"`);
      continue;
    }

    const toNum = Number.isFinite(Number(toRaw)) ? Number(toRaw) : (targetNums[0] ?? foundNumbers[0]);
    const fromNums = fromRaw !== undefined && fromRaw !== null ? extractNumericValuesFromText(String(fromRaw)) : [];
    const fromNum = Number.isFinite(Number(fromRaw)) ? Number(fromRaw) : (fromNums[0] ?? 0);

    valid.push({
      clipIndex: loc.clipIndex,
      wordOffsetInClip: loc.wordOffsetInClip,
      wordCount: Math.max(1, loc.wordCount),
      trigger: rawTrigger,
      fromValue: fromNum,
      value: toNum,
      unit: cleanUnit,
      label: cleanLabel
    });
    if (valid.length >= 3) break;
  }

  return valid;
}

/**
 * Validates `finishing_plan.chips` material/feature chip sequences for template `angka_banding`.
 */
export function validateChipsList(rawChips, {
  clipTokenLists = [],
  verifiedNumericSet = new Set(),
  isHerbalProduct = false,
  strictClaims = false,
  warnings = []
} = {}) {
  if (!Array.isArray(rawChips) || rawChips.length === 0) return [];
  const valid = [];

  for (const group of rawChips) {
    if (!group || typeof group !== 'object' || !Array.isArray(group.items)) continue;
    const rawGroupTrigger = sanitizeOverlayTextStrict(String(group.trigger || ''));
    const hintIdxRaw = group.clip_index !== undefined
      ? Number(group.clip_index)
      : (group.clip !== undefined ? Number(group.clip) - 1 : -1);

    const validatedItems = [];
    let resolvedClip = hintIdxRaw >= 0 ? hintIdxRaw : 0;
    let firstOffset = 0;

    for (const item of group.items) {
      const rawLabel = typeof item === 'string' ? item : (item?.label || '');
      const cleanLabel = sanitizeOverlayTextStrict(String(rawLabel)).slice(0, 24);
      if (!cleanLabel) continue;
      if (hasAnyUnverifiedNumber(cleanLabel, verifiedNumericSet)) {
        warnings.push(`finishing_plan.chips item skipped (fabricated number): "${cleanLabel}"`);
        continue;
      }
      if ((isHerbalProduct || strictClaims) && isHerbalMedicalClaimPhrase(cleanLabel, { strict: strictClaims })) {
        warnings.push(`finishing_plan.chips item skipped (herbal claim guard): "${cleanLabel}"`);
        continue;
      }
      const itemTrigger = sanitizeOverlayTextStrict(String((typeof item === 'object' ? item?.trigger : '') || rawLabel));
      const loc = resolveTriggerClipAndOffset({ rawTrigger: itemTrigger, hintClipRaw: hintIdxRaw, clipTokenLists });
      if (clipTokenLists.length > 0 && loc.clipIndex < 0) {
        warnings.push(`finishing_plan.chips item skipped (not found in VO): "${cleanLabel}"`);
        continue;
      }
      if (validatedItems.length === 0) {
        resolvedClip = loc.clipIndex;
        firstOffset = loc.wordOffsetInClip;
      }
      validatedItems.push({
        label: cleanLabel,
        trigger: itemTrigger,
        clipIndex: loc.clipIndex,
        wordOffsetInClip: loc.wordOffsetInClip,
        wordCount: Math.max(1, loc.wordCount)
      });
      if (validatedItems.length >= 4) break;
    }

    if (validatedItems.length === 0) continue;

    let foot = '';
    const rawFoot = typeof group.foot === 'string' ? group.foot : (group.foot?.label || '');
    if (rawFoot) {
      const cleanFoot = sanitizeOverlayTextStrict(String(rawFoot)).slice(0, 32);
      if (cleanFoot && hasAnyUnverifiedNumber(cleanFoot, verifiedNumericSet)) {
        warnings.push(`finishing_plan.chips foot skipped (fabricated number): "${cleanFoot}"`);
      } else if (cleanFoot && clipTokenLists.length > 0 && !hasVoTokenGrounding(cleanFoot, clipTokenLists[resolvedClip] || [])) {
        warnings.push(`finishing_plan.chips foot skipped (not grounded in VO): "${cleanFoot}"`);
      } else if (cleanFoot) {
        foot = cleanFoot;
      }
    }

    const groupLoc = rawGroupTrigger
      ? resolveTriggerClipAndOffset({ rawTrigger: rawGroupTrigger, hintClipRaw: resolvedClip, clipTokenLists })
      : { clipIndex: resolvedClip, wordOffsetInClip: firstOffset };

    valid.push({
      clipIndex: groupLoc.clipIndex >= 0 ? groupLoc.clipIndex : resolvedClip,
      wordOffsetInClip: groupLoc.wordOffsetInClip >= 0 ? groupLoc.wordOffsetInClip : firstOffset,
      items: validatedItems,
      foot
    });
    if (valid.length >= 2) break;
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
  productData = null,
  targetLanguage = 'id-ID',
  width = 720,
  height = 1280
} = {}) {
  const warnings = [];
  if (!rawPlan || typeof rawPlan !== 'object') {
    return { hookCard: null, hookText: '', punches: [], tips: [], timingBadges: [], chapters: [], callouts: [], compare: [], numbers: [], chips: [], brandPatch: null, warnings };
  }

  let parsed = rawPlan;
  if (typeof rawPlan === 'string') {
    try {
      parsed = JSON.parse(rawPlan);
    } catch (_) {
      return { hookCard: null, hookText: '', punches: [], tips: [], timingBadges: [], chapters: [], callouts: [], compare: [], numbers: [], chips: [], brandPatch: null, warnings: ['finishing_plan_invalid_json'] };
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

  let compare = [];
  let numbers = [];
  let chips = [];
  if (normalizedTpl === 'angka_banding') {
    const verifiedNumericSet = buildVerifiedNumericSet(cleanVoiceoverClips, productData);
    const productTokens = productData && typeof productData === 'object'
      ? [
          productData.product_name, productData.nama_produk, productData.title,
          productData.specification, productData.spec_line, productData.usp,
          productData.description, productData.category
        ]
          .filter(Boolean)
          .map((s) => sanitizeOverlayTextStrict(String(s)))
          .join(' ')
          .split(/\s+/)
          .map(normAlignmentWord)
          .filter(Boolean)
      : [];

    compare = validateCompareList(parsed.compare, {
      clipTokenLists,
      verifiedNumericSet,
      productTokens,
      isHerbalProduct: effectiveHerbal,
      strictClaims: useStrictClaims,
      warnings
    });
    numbers = validateNumbersList(parsed.numbers, {
      clipTokenLists,
      verifiedNumericSet,
      isHerbalProduct: effectiveHerbal,
      strictClaims: useStrictClaims,
      warnings
    });
    chips = validateChipsList(parsed.chips, {
      clipTokenLists,
      verifiedNumericSet,
      isHerbalProduct: effectiveHerbal,
      strictClaims: useStrictClaims,
      warnings
    });
  }

  return {
    hookCard,
    hookText,
    punches: validPunches,
    tips,
    timingBadges,
    chapters,
    callouts,
    compare,
    numbers,
    chips,
    brandPatch,
    warnings
  };
}
