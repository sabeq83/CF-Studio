/**
 * Client+Server pure subtitle chunking & protected phrase extractor (Revisi 03, R15).
 * Zero Node-only dependencies (safe for Next.js Client Components, Playwright timelines, and Sharp fallback).
 */

export const SUBTITLE_CONNECTOR_WORDS = new Set([
  // ID (tanpa 'ini' / 'itu' — R15.4: "Di titik ini," tetap utuh)
  'dan', 'atau', 'di', 'ke', 'dari', 'per', 'untuk', 'yang', 'dengan', 'saat',
  'karena', 'agar', 'serta', 'tanpa', 'jadi', 'sebelum', 'sesudah', 'seperti',
  'tapi', 'kalau',
  // EN
  'and', 'or', 'the', 'to', 'of', 'in', 'for', 'with'
]);

const GENERIC_NUMBER_TOKENS = new Set([
  'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh',
  'sebelas', 'seratus', 'seribu', 'sejuta', 'setengah', 'separuh',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'half'
]);

const GENERIC_UNIT_TOKENS = new Set([
  'persen', 'percent', 'ribu', 'juta', 'miliar', 'kali', 'menit', 'detik', 'jam',
  'hari', 'minggu', 'bulan', 'tahun', 'derajat', 'gram', 'gr', 'kg', 'ml', 'liter',
  'watt', 'rupiah', 'cm', 'mm', 'meter', 'x'
]);

const PHRASE_NOISE_WORDS = new Set([
  ...SUBTITLE_CONNECTOR_WORDS,
  'ini', 'itu', 'adalah', 'ialah', 'bisa', 'dapat', 'akan', 'sudah', 'lebih', 'sangat',
  'yang', 'yg', 'nya', 'ini,', 'itu,'
]);

export const SUBTITLE_STYLE_LAYOUT = {
  floating_white_yellow: {
    baseCqw: 7.6,
    minSingleWordCqw: 6.0,
    gapCqw: 2.2,
    padCqw: 0.75, // outer stroke margin allowance
    uppercase: true,
    fontFile: 'Montserrat-Black.ttf'
  },
  floating_black_on_white: {
    baseCqw: 7.0,
    minSingleWordCqw: 6.0,
    gapCqw: 1.8,
    padCqw: 6.4, // .pill horizontal padding (3.2cqw * 2)
    uppercase: true,
    fontFile: 'Montserrat-Black.ttf'
  },
  minimal_white: {
    baseCqw: 6.8,
    minSingleWordCqw: 6.0,
    gapCqw: 2.0,
    padCqw: 0,
    uppercase: false,
    fontFile: 'Montserrat-ExtraBold.ttf'
  }
};

export function normalizeSubtitleToken(word) {
  return String(word || '')
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}%]+|[^\p{L}\p{N}%]+$/gu, '');
}

function normalizePhraseTokens(raw) {
  return String(raw || '')
    .replace(/[()[\]{}"'“”‘’]/g, ' ')
    .trim()
    .split(/\s+/)
    .map(normalizeSubtitleToken)
    .filter(Boolean);
}

/**
 * Extracts normalized 2..4-word protected phrases from structured render-path inputs (R15.5)
 * without hardcoding brand or product-specific vocabulary.
 */
export function collectProtectedSubtitlePhrases({
  brand = null,
  productData = null,
  productCard = null,
  finishingPlan = null,
  planCheck = null,
  recipe = null,
  extraPhrases = []
} = {}) {
  const out = new Set();

  const registerExactPhrase = (tokens) => {
    if (!Array.isArray(tokens)) return;
    if (tokens.length >= 2 && tokens.length <= 4) {
      out.add(tokens.join(' '));
    }
  };

  const addPhrase = (raw, { addSubWindows = false, stripLeadingQty = false } = {}) => {
    if (!raw || typeof raw !== 'string') return;
    const segments = raw.split(/[,;|/•\n]+/).map((s) => s.trim()).filter(Boolean);
    for (const seg of segments) {
      let cleanSeg = seg;
      if (stripLeadingQty) {
        cleanSeg = cleanSeg
          .replace(/^\d+(?:[.,/-]\d+)?\s*(?:gram|gr|g|kg|ml|l|liter|sdm|sdt|ruas|siung|batang|lembar|butir|buah|cup|potong|ikat|ons|pcs|pack|sachet)?\b\s*/i, '')
          .trim();
      }
      const tokens = normalizePhraseTokens(cleanSeg);
      if (tokens.length < 2) continue;
      if (tokens.length <= 4) {
        registerExactPhrase(tokens);
      }
      if (addSubWindows) {
        for (let size = 2; size <= Math.min(3, tokens.length); size++) {
          for (let i = 0; i <= tokens.length - size; i++) {
            const win = tokens.slice(i, i + size);
            const hasSubstantive = win.every((t) => !PHRASE_NOISE_WORDS.has(t));
            if (hasSubstantive) {
              registerExactPhrase(win);
            }
          }
        }
      }
    }
  };

  // 1. Brand & product / material names
  if (brand && typeof brand === 'object') {
    addPhrase(brand.name || brand.brandName || brand.brand_name, { addSubWindows: true });
  }
  if (productCard && typeof productCard === 'object') {
    addPhrase(productCard.name || productCard.tag, { addSubWindows: true });
  }
  if (productData && typeof productData === 'object') {
    addPhrase(productData.product_name || productData.nama_produk || productData.name || productData.title, { addSubWindows: true });
    addPhrase(productData.spesifikasi_produk || productData.material || productData.materials, { addSubWindows: true });
    if (Array.isArray(productData.tags)) {
      for (const tag of productData.tags) addPhrase(String(tag || ''), { addSubWindows: true });
    } else if (typeof productData.tags === 'string') {
      addPhrase(productData.tags, { addSubWindows: true });
    }
  }

  // 2. Validated finishing_plan fields (preferred: planCheck.validated or planCheck)
  const plan = planCheck?.validated || planCheck || finishingPlan || {};
  if (plan && typeof plan === 'object') {
    const punches = Array.isArray(plan.punches) ? plan.punches : [];
    for (const p of punches) {
      if (p?.phrase) addPhrase(p.phrase);
    }

    const callouts = Array.isArray(plan.callouts) ? plan.callouts : [];
    for (const c of callouts) {
      if (c?.trigger) addPhrase(c.trigger);
    }

    const numbers = Array.isArray(plan.numbers) ? plan.numbers : [];
    for (const n of numbers) {
      if (n?.trigger) addPhrase(n.trigger);
    }

    const timingBadges = Array.isArray(plan.timingBadges)
      ? plan.timingBadges
      : (Array.isArray(plan.timing_badges) ? plan.timing_badges : []);
    for (const tb of timingBadges) {
      if (tb?.trigger) addPhrase(tb.trigger);
      if (tb?.label) addPhrase(tb.label);
    }

    const compareList = Array.isArray(plan.compare)
      ? plan.compare
      : (plan.compare && typeof plan.compare === 'object' ? [plan.compare] : []);
    for (const cmp of compareList) {
      if (cmp?.left?.title) addPhrase(cmp.left.title);
      if (cmp?.right?.title) addPhrase(cmp.right.title);
      if (cmp?.trigger) addPhrase(cmp.trigger);
    }
  }

  // 3. Recipe ingredients labels
  const ingredientItems = Array.isArray(recipe?.ingredients?.items)
    ? recipe.ingredients.items
    : (Array.isArray(recipe?.ingredients) ? recipe.ingredients : []);
  for (const ing of ingredientItems) {
    const rawLabel = typeof ing === 'string' ? ing : (ing?.label || ing?.name || '');
    if (rawLabel) {
      addPhrase(rawLabel, { stripLeadingQty: true, addSubWindows: true });
    }
  }

  // 4. Caller-supplied extras (still 2..4 normalized words)
  if (Array.isArray(extraPhrases) || extraPhrases instanceof Set) {
    for (const ep of extraPhrases) {
      addPhrase(String(ep || ''));
    }
  }

  return Array.from(out);
}

/**
 *Fallback calibrated glyph width estimator in px when FreeType measureTextWidth is unavailable (browser preview).
 */
export function estimateTextWidthPxFallback(text, fontSizePx, uppercase = false) {
  const s = uppercase ? String(text || '').toUpperCase() : String(text || '');
  let emUnits = 0;
  for (const ch of s) {
    if (ch === ' ') emUnits += 0.28;
    else if ('ilI|!.,:;\'"'.includes(ch)) emUnits += 0.30;
    else if ('MWwm@#%&'.includes(ch)) emUnits += 0.88;
    else if ('frtjs'.includes(ch)) emUnits += 0.48;
    else if (/[A-Z0-9]/.test(ch)) emUnits += 0.66;
    else emUnits += 0.56;
  }
  // Slightly conservative factor for Montserrat Black / ExtraBold
  return emUnits * fontSizePx * 1.06;
}

export function measureChunkWidthCqw(items, {
  style = 'floating_white_yellow',
  width = 720,
  fontCqw = null,
  measureTextWidth = null
} = {}) {
  if (!Array.isArray(items) || items.length === 0) return 0;
  const spec = SUBTITLE_STYLE_LAYOUT[style] || SUBTITLE_STYLE_LAYOUT.floating_white_yellow;
  const parsedFontCqw = fontCqw !== null && fontCqw !== undefined ? Number(fontCqw) : NaN;
  const activeCqw = Number.isFinite(parsedFontCqw) && parsedFontCqw > 0 ? parsedFontCqw : spec.baseCqw;
  const fontSizePx = (width * activeCqw) / 100;

  let textPx = 0;
  for (const item of items) {
    const rawWord = String(item?.word ?? item?.w ?? '').trim();
    if (!rawWord) continue;
    const renderStr = spec.uppercase ? rawWord.toUpperCase() : rawWord;
    if (typeof measureTextWidth === 'function') {
      textPx += measureTextWidth(spec.fontFile, fontSizePx, renderStr, 0);
    } else {
      textPx += estimateTextWidthPxFallback(renderStr, fontSizePx, spec.uppercase);
    }
  }

  const gapCqw = Math.max(0, items.length - 1) * spec.gapCqw;
  const textCqw = (textPx / Math.max(1, width)) * 100;
  return textCqw + gapCqw + spec.padCqw;
}

function isNumericUnitGlue(tokA, tokB) {
  if (!tokA || !tokB) return false;
  const isNum = /^\d+(?:[.,]\d+)?$/.test(tokA) || GENERIC_NUMBER_TOKENS.has(tokA);
  return isNum && GENERIC_UNIT_TOKENS.has(tokB);
}

function buildProtectedAnchorMap(normalizedWords, protectedPhraseSet) {
  // Returns Map<startIdx, endIdx> for maximal non-crossing protected spans within the same clip
  const spans = new Map();
  const n = normalizedWords.length;
  for (let i = 0; i < n; i++) {
    const clipI = normalizedWords[i].clipIndex;
    let bestEnd = -1;
    // Try longest phrase match 4 down to 2
    for (let len = 4; len >= 2; len--) {
      if (i + len > n) continue;
      let sameClip = true;
      const parts = [];
      for (let k = 0; k < len; k++) {
        if (normalizedWords[i + k].clipIndex !== clipI) {
          sameClip = false;
          break;
        }
        parts.push(normalizedWords[i + k].norm);
      }
      if (!sameClip) continue;
      if (protectedPhraseSet.has(parts.join(' '))) {
        bestEnd = i + len - 1;
        break;
      }
    }
    if (bestEnd === -1 && i + 1 < n && normalizedWords[i + 1].clipIndex === clipI) {
      if (isNumericUnitGlue(normalizedWords[i].norm, normalizedWords[i + 1].norm)) {
        bestEnd = i + 1;
      }
    }
    if (bestEnd > i) {
      spans.set(i, bestEnd);
    }
  }
  return spans;
}

function chunkBreakInsideProtected(chunk, spanStartMap) {
  // Check whether slicing chunk or leaving prefix creates split inside active protected span
  const idxs = chunk.map((x) => x.internalIdx);
  const firstIdx = idxs[0];
  const lastIdx = idxs[idxs.length - 1];
  for (const [ps, pe] of spanStartMap.entries()) {
    // Span starts inside chunk (not at end) or ends beyond lastIdx
    if (ps >= firstIdx && ps <= lastIdx && pe > lastIdx) {
      return ps;
    }
  }
  return -1;
}

function enforcesWidthSplitOnChunk(chunk, opts) {
  const { style, width, maxWidthCqw, measureTextWidth, spanMap } = opts;
  const spec = SUBTITLE_STYLE_LAYOUT[style] || SUBTITLE_STYLE_LAYOUT.floating_white_yellow;
  const wCqw = measureChunkWidthCqw(chunk, { style, width, measureTextWidth });
  if (wCqw <= maxWidthCqw) {
    return [chunk];
  }

  if (chunk.length === 1) {
    // Only single word exceeding maxWidthCqw may downscale, floor at 6cqw (R15.7)
    const textOnlyCqw = measureChunkWidthCqw(chunk, { style, width, measureTextWidth }) - spec.padCqw;
    const availTextCqw = Math.max(1, maxWidthCqw - spec.padCqw);
    const scaled = Math.max(
      spec.minSingleWordCqw,
      Math.floor(((spec.baseCqw * availTextCqw) / Math.max(0.1, textOnlyCqw)) * 100) / 100
    );
    const tagged = chunk.map((item) => ({ ...item, singleWordFontCqw: scaled }));
    tagged.fontCqw = scaled;
    return [tagged];
  }

  // Choose best split index i (1..chunk.length-1):
  // Prefer left side <= maxWidthCqw and without leaving a connector dangling at end of left.
  let bestSplit = -1;
  let bestScore = Infinity;
  for (let s = 1; s < chunk.length; s++) {
    const left = chunk.slice(0, s);
    const right = chunk.slice(s);
    const leftW = measureChunkWidthCqw(left, { style, width, measureTextWidth });
    const rightW = measureChunkWidthCqw(right, { style, width, measureTextWidth });
    const overPenalty = (leftW > maxWidthCqw ? (leftW - maxWidthCqw) * 10 : 0) +
      (rightW > maxWidthCqw ? (rightW - maxWidthCqw) * 10 : 0);
    const leftTail = left[left.length - 1];
    const connectorPenalty = SUBTITLE_CONNECTOR_WORDS.has(normalizeSubtitleToken(leftTail.word)) ? 25 : 0;
    // Also discourage cutting a protected phrase if a non-cutting split exists
    const protectCut = chunkBreakInsideProtected(left, spanMap) !== -1 ? 15 : 0;
    const balance = Math.abs(leftW - rightW) * 0.25;
    const score = overPenalty + connectorPenalty + protectCut + balance;
    if (score < bestScore) {
      bestScore = score;
      bestSplit = s;
    }
  }

  if (bestSplit <= 0) bestSplit = 1;
  const leftPart = chunk.slice(0, bestSplit);
  const rightPart = chunk.slice(bestSplit);
  return [
    ...enforcesWidthSplitOnChunk(leftPart, opts),
    ...enforcesWidthSplitOnChunk(rightPart, opts)
  ];
}

/**
 * Breaks aligned words into natural 1-3 word (<=16 chars) subtitle chunks (Revisi 03, R15),
 * honoring connector boundaries, protected phrases (up to 4 words), <0.45s neighbor merges,
 * and >88cqw width splitting.
 */
export function chunkCaptionWords(words = [], options = {}) {
  if (!Array.isArray(words) || words.length === 0) return [];

  const {
    protectedPhrases = [],
    style = 'floating_white_yellow',
    width = 720,
    maxWidthCqw = 88,
    enforceWidthSplit = true,
    measureTextWidth = null,
    sanitizeWord = null
  } = options || {};

  const protectedSet = new Set();
  for (const rawP of protectedPhrases || []) {
    const toks = normalizePhraseTokens(rawP);
    if (toks.length >= 2 && toks.length <= 4) {
      protectedSet.add(toks.join(' '));
    }
  }

  const normalizedWords = [];
  for (let i = 0; i < words.length; i++) {
    const rawItem = typeof words[i] === 'string'
      ? { w: words[i], s: i * 0.35, e: (i + 1) * 0.35, c: 0 }
      : (words[i] || {});
    const rawText = String(rawItem.w ?? rawItem.word ?? '').trim();
    const cleanedWord = typeof sanitizeWord === 'function' ? String(sanitizeWord(rawText) || '').trim() : rawText;
    if (!cleanedWord) continue;
    const s = Number(rawItem.s ?? rawItem.start ?? 0);
    const e = Number(rawItem.e ?? rawItem.end ?? 0);
    const c = rawItem.c ?? rawItem.clipIndex ?? 0;
    normalizedWords.push({
      w: cleanedWord,
      s,
      e,
      c,
      word: cleanedWord,
      start: s,
      end: e,
      clipIndex: c,
      originalIndex: Number.isInteger(rawItem.originalIndex) ? rawItem.originalIndex : i,
      internalIdx: normalizedWords.length,
      norm: normalizeSubtitleToken(cleanedWord)
    });
  }
  if (normalizedWords.length === 0) return [];

  const spanMap = buildProtectedAnchorMap(normalizedWords, protectedSet);

  const chunks = [];
  let cur = [];
  const flush = () => {
    if (cur.length > 0) {
      chunks.push(cur);
      cur = [];
    }
  };
  const txt = (arr) => arr.map((x) => x.word).join(' ');

  // Helper: check if word index i is continuation of a protected span that started in cur
  const findProtectedStartInCur = (i) => {
    if (cur.length === 0) return null;
    const curStartInternal = cur[0].internalIdx;
    for (let pos = 0; pos < cur.length; pos++) {
      const pStart = cur[pos].internalIdx;
      const pEnd = spanMap.get(pStart);
      if (pEnd !== undefined && i > pStart && i <= pEnd) {
        return { posInCur: pos, pStart, pEnd, ownsWholeCur: pStart === curStartInternal };
      }
    }
    return null;
  };

  for (let i = 0; i < normalizedWords.length; i++) {
    const x = normalizedWords[i];
    if (!x.word) continue;

    const cand = cur.length ? `${txt(cur)} ${x.word}` : x.word;
    const sameClip = cur.length === 0 || cur[0].clipIndex === x.clipIndex;
    const protectHit = sameClip ? findProtectedStartInCur(i) : null;

    const startsPhrase = SUBTITLE_CONNECTOR_WORDS.has(x.norm) && cur.length >= 2;
    const clipChange = cur.length > 0 && !sameClip;
    const standardBreak = cur.length > 0 && (
      cur.length >= 3 ||
      cand.length > 16 ||
      clipChange ||
      startsPhrase
    );

    if (protectHit) {
      if (protectHit.ownsWholeCur && sameClip && cur.length < 4) {
        // Protected phrase already starts this chunk: allow up to 4 words without breaking mid-phrase
      } else if (standardBreak) {
        // Move start of protected phrase cleanly into a fresh chunk
        const moved = cur.splice(protectHit.posInCur);
        flush();
        cur = moved;
      }
    } else if (standardBreak) {
      flush();
    }

    cur.push(x);

    const isFinalInOwnedProtected = protectHit && protectHit.ownsWholeCur && cur[0].internalIdx + (cur.length - 1) < protectHit.pEnd;
    const endsOnConnector = SUBTITLE_CONNECTOR_WORDS.has(x.norm);
    const hasPunc = /[,.?!:]$/.test(x.word);
    if (hasPunc && !endsOnConnector && !isFinalInOwnedProtected) {
      flush();
    }
  }
  flush();

  // Pass 2: Pull trailing connector at end of chunk[k] to start of chunk[k+1] if safe (R15.4)
  for (let k = 0; k < chunks.length - 1; k++) {
    const curChunk = chunks[k];
    const nextChunk = chunks[k + 1];
    if (curChunk.length <= 1) continue;
    const last = curChunk[curChunk.length - 1];
    if (!SUBTITLE_CONNECTOR_WORDS.has(last.norm)) continue;
    if (/[,.?!:]$/.test(last.word)) continue;
    if (last.clipIndex !== nextChunk[0].clipIndex) continue;
    if (nextChunk.length >= 3) continue;
    // Do not detach tail if it finishes a protected phrase inside curChunk
    const prevInternal = curChunk[curChunk.length - 2].internalIdx;
    const prevSpanEnd = spanMap.get(prevInternal);
    if (prevSpanEnd !== undefined && prevSpanEnd >= last.internalIdx) continue;

    const combinedLen = `${last.word} ${txt(nextChunk)}`.length;
    if (combinedLen <= 16) {
      curChunk.pop();
      nextChunk.unshift(last);
    }
  }

  // Pass 3: Merge short chunks < 0.45s within same clip (next neighbor first, then prev) (R15.6)
  let changed = true;
  while (changed) {
    changed = false;
    for (let k = 0; k < chunks.length; k++) {
      const ck = chunks[k];
      const dur = ck[ck.length - 1].end - ck[0].start;
      if (dur >= 0.45) continue;

      const tryMerge = (j) => {
        if (j < 0 || j >= chunks.length) return false;
        const a = Math.min(k, j);
        const b = Math.max(k, j);
        const merged = chunks[a].concat(chunks[b]);
        if (merged[0].clipIndex !== merged[merged.length - 1].clipIndex) return false;
        const tinySingle = ck.length === 1 && dur < 0.3;
        if (merged.length > (tinySingle ? 4 : 3)) return false;
        if (txt(merged).length > 18) return false;
        chunks.splice(a, 2, merged);
        return true;
      };

      if (tryMerge(k + 1) || tryMerge(k - 1)) {
        changed = true;
        break;
      }
    }
  }

  // Pass 4: Enforce <= 88cqw rendered width (R15.7)
  let finalChunks = chunks;
  if (enforceWidthSplit) {
    finalChunks = [];
    const splitOpts = { style, width, maxWidthCqw, measureTextWidth, spanMap };
    for (const ck of chunks) {
      finalChunks.push(...enforcesWidthSplitOnChunk(ck, splitOpts));
    }
  }

  return finalChunks;
}
