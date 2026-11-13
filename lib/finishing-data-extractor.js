import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { sanitizeOverlayTextStrict } from './tts-text-sanitizer.js';
import { normAlignmentWord } from './word-alignment-engine.js';

export const DEFAULT_HERBAL_DISCLAIMER = 'Produk herbal & pangan olahan, bukan pengganti obat dokter';

export function truncateWordBoundary(text, maxChars = 22) {
  const clean = sanitizeOverlayTextStrict(String(text || ''))
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return '';
  if (clean.length <= maxChars) return clean;
  const sliced = clean.slice(0, Math.max(1, maxChars - 1));
  const lastSpace = sliced.lastIndexOf(' ');
  const cut = lastSpace >= Math.floor(maxChars * 0.45) ? sliced.slice(0, lastSpace) : sliced;
  return `${cut.replace(/[,.;:!?-]+$/g, '').trim()}…`;
}

function safeJsonParse(val) {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch (_) {
    return null;
  }
}

function cleanListLine(line) {
  return sanitizeOverlayTextStrict(
    String(line || '')
      .replace(/^\s*(?:[-*•✅✔▪▫➤➢▸▹]|(?:\d{1,2}|[a-zA-Z])[.)])\s+/, '')
      .trim()
  );
}

/**
 * Parses structured ingredient & step lists from Indonesian/English captions or JSON objects.
 */
export function parseRecipeSections({ caption = '', structured = null } = {}) {
  const rawIngredients = [];
  const rawSteps = [];

  if (structured && typeof structured === 'object') {
    const ingArr = structured.ingredients || structured.bahan || structured.recipe?.ingredients || [];
    const stArr = structured.steps || structured.langkah || structured.recipe?.steps || [];
    if (Array.isArray(ingArr)) {
      for (const x of ingArr) {
        const t = cleanListLine(typeof x === 'string' ? x : (x?.label || x?.name || x?.text || ''));
        if (t) rawIngredients.push(t);
      }
    }
    if (Array.isArray(stArr)) {
      for (const x of stArr) {
        const t = cleanListLine(typeof x === 'string' ? x : (x?.text || x?.label || x?.title || ''));
        if (t) rawSteps.push(t);
      }
    }
  }

  if (rawIngredients.length === 0 || rawSteps.length === 0) {
    const lines = String(caption || '').split(/\r?\n/);
    let mode = null;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        if (mode && (rawIngredients.length > 0 || rawSteps.length > 0)) {
          // Keep mode across single blank lines only if next lines are list bullets
        }
        continue;
      }

      if (/^(?:[📋🥗🥣🥘🧂]*\s*)?(?:BAHAN[\s-]*BAHAN|BAHAN UTAMA|INGREDIENTS)\s*[:\-]?$/i.test(line) ||
          /(?:📋\s*BAHAN-BAHAN|BAHAN-BAHAN\s*:)/i.test(line)) {
        mode = 'ing';
        const inlineRest = line.replace(/^.*?:\s*/, '').trim();
        if (inlineRest && inlineRest !== line && !/BAHAN/i.test(inlineRest)) {
          const cleaned = cleanListLine(inlineRest);
          if (cleaned) rawIngredients.push(cleaned);
        }
        continue;
      }

      if (/^(?:[👩‍🍳👨‍🍳🥣🍳🔥⏱️]*\s*)?(?:LANGKAH[\s-]*(?:PEMBUATAN|MEMBUAT)?|CARA\s+(?:MEMBUAT|BUAT|PENYAJIAN)|STEPS?|METHOD)\s*[:\-]?$/i.test(line) ||
          /(?:👩‍🍳\s*LANGKAH|LANGKAH PEMBUATAN\s*:)/i.test(line)) {
        mode = 'step';
        const inlineRest = line.replace(/^.*?:\s*/, '').trim();
        if (inlineRest && inlineRest !== line && !/LANGKAH|CARA/i.test(inlineRest)) {
          const cleaned = cleanListLine(inlineRest);
          if (cleaned) rawSteps.push(cleaned);
        }
        continue;
      }

      if (/^#|^(?:💬|🔗|📌|⚠️|CATATAN|HASHTAG|LINK|CHECKOUT|KERANJANG)/i.test(line)) {
        mode = null;
        continue;
      }

      const cleaned = cleanListLine(line);
      if (!cleaned) continue;
      if (mode === 'ing' && rawIngredients.length < 16) {
        rawIngredients.push(cleaned);
      } else if (mode === 'step' && rawSteps.length < 16) {
        rawSteps.push(cleaned);
      }
    }
  }

  return {
    ingredients: rawIngredients,
    steps: rawSteps
  };
}

function findBestWordTimestamp(phrase, wordEvents, minTime = 0, maxTime = Infinity) {
  const tokens = String(phrase || '')
    .split(/\s+/)
    .map(normAlignmentWord)
    .filter((t) => t.length >= 3);
  if (tokens.length === 0 || !Array.isArray(wordEvents) || wordEvents.length === 0) {
    return null;
  }

  for (const w of wordEvents) {
    if (w.s < minTime || w.s > maxTime) continue;
    const nw = normAlignmentWord(w.w);
    if (!nw) continue;
    if (tokens.some((tok) => nw === tok || (tok.length >= 4 && nw.includes(tok)))) {
      return Number(w.s);
    }
  }
  return null;
}

/**
 * Extracts real recipe ingredients (max 4 chips + "+N bahan lain") and step badges (3..8+ clips).
 */
export function extractRecipeOverlayData({
  item = null,
  task = null,
  campaign = null,
  recipeData = null,
  clipOffsets = [],
  wordEvents = [],
  totalDuration = 0
} = {}) {
  const rowPayload = safeJsonParse(item?.row_creative_payload) || {};
  const resultObj = safeJsonParse(item?.result_json) || {};
  const remakeObj = safeJsonParse(task?.remake_storyboard_json) || {};

  const captionCandidate = [
    task?.new_caption,
    item?.new_caption,
    resultObj?.social_media_package?.caption,
    remakeObj?.social_media_package?.caption,
    campaign?.description
  ].filter(Boolean).join('\n');

  const parsed = parseRecipeSections({
    caption: captionCandidate,
    structured: recipeData || rowPayload?.recipe || resultObj?.recipe || remakeObj?.recipe || null
  });

  if (parsed.ingredients.length === 0 && parsed.steps.length === 0) {
    return {
      hasRecipe: false,
      ingredients: { until: 0, items: [], overflowLabel: '', totalCount: 0 },
      steps: []
    };
  }

  const dur = Math.max(
    Number(totalDuration) || 0,
    clipOffsets.reduce((m, c) => Math.max(m, Number(c.start || 0) + Number(c.duration || 0)), 0),
    wordEvents.reduce((m, w) => Math.max(m, Number(w.e || 0)), 0),
    1
  );

  // Determine pre-closing horizon for IngredientStack across dynamic 3..8+ clips
  const clipCount = clipOffsets.length || 1;
  const closingClipStart = clipCount >= 2 ? Number(clipOffsets[clipCount - 1]?.start || dur * 0.78) : dur * 0.78;
  const ingUntil = Number(Math.max(1.5, closingClipStart - 0.12).toFixed(3));

  const visibleIngCount = Math.min(4, parsed.ingredients.length);
  const selectedIngredients = parsed.ingredients.slice(0, visibleIngCount);
  const overflowCount = Math.max(0, parsed.ingredients.length - 4);
  const overflowLabel = overflowCount > 0 ? `+${overflowCount} bahan lain` : '';

  const ingItems = [];
  let minAllowedTime = 0.2;
  const spanForIngs = Math.max(1.2, ingUntil - 0.6);

  for (let i = 0; i < selectedIngredients.length; i++) {
    const raw = selectedIngredients[i];
    const label = truncateWordBoundary(raw, 22);
    if (!label) continue;
    const lexT = findBestWordTimestamp(raw, wordEvents, minAllowedTime, Math.max(minAllowedTime + 0.5, ingUntil - 0.6));
    const fallbackT = 0.25 + (i * (spanForIngs / Math.max(1, selectedIngredients.length)));
    const s = Number(Math.min(ingUntil - 0.45, lexT !== null ? lexT : Math.max(minAllowedTime, fallbackT)).toFixed(3));
    minAllowedTime = s + 0.35;
    ingItems.push({ label, raw, s });
  }

  // Step badges mapped onto available clips (supports 3..8+ clips dynamically without overflow)
  const stepCap = clipOffsets.length > 0 ? Math.min(parsed.steps.length, clipOffsets.length) : parsed.steps.length;
  const rawStepSlice = parsed.steps.slice(0, stepCap);
  const stepTotal = rawStepSlice.length;
  const steps = rawStepSlice.map((rawStep, idx) => {
    const clipInfo = clipOffsets[idx] || {
      start: (idx * dur) / Math.max(1, stepTotal),
      duration: dur / Math.max(1, stepTotal)
    };
    const nextStart = clipOffsets[idx + 1]?.start ?? (clipInfo.start + (clipInfo.duration || 2.0));
    const s = Number((Number(clipInfo.start) + 0.05).toFixed(3));
    const e = Number(Math.max(s + 0.3, nextStart - 0.03).toFixed(3));
    return {
      n: idx + 1,
      total: stepTotal,
      badge: `LANGKAH ${idx + 1}/${stepTotal}`,
      t: truncateWordBoundary(rawStep, 16),
      s,
      e
    };
  });

  return {
    hasRecipe: ingItems.length > 0 || steps.length > 0,
    ingredients: {
      until: ingItems.length > 0 ? ingUntil : 0,
      items: ingItems,
      overflowLabel,
      totalCount: parsed.ingredients.length
    },
    steps
  };
}

function resolveLocalImageFileUrl(candidatePath) {
  if (!candidatePath || typeof candidatePath !== 'string') return '';
  const trimmed = candidatePath.trim();
  if (!trimmed) return '';
  const abs = trimmed.startsWith('/') && !fs.existsSync(trimmed)
    ? path.join(process.cwd(), 'public', trimmed)
    : (path.isAbsolute(trimmed) ? trimmed : path.join(process.cwd(), 'public', trimmed));
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
    return pathToFileURL(abs).href;
  }
  return '';
}

/**
 * Extracts factual ProductCard metadata strictly from catalog/snapshot (zero hardcoded product literals).
 */
export function extractProductCardData({
  product = null,
  campaign = null,
  task = null,
  item = null,
  isHerbalProduct = true,
  hasRecipe = false,
  finishingPlan = null,
  wordEvents = [],
  clipOffsets = [],
  bridgeAtClip = 3,
  totalDuration = 0,
  disclaimerOverride = ''
} = {}) {
  const prodSnapshot = safeJsonParse(task?.product_snapshot_json) || {};
  const ephemeralProd = safeJsonParse(campaign?.ephemeral_product_data) || {};
  const rowPayload = safeJsonParse(item?.row_creative_payload) || {};

  const merged = {
    ...ephemeralProd,
    ...rowPayload,
    ...prodSnapshot,
    ...(product || {})
  };

  const name = truncateWordBoundary(
    merged.product_name || merged.nama_produk || merged.title || '',
    40
  );
  if (!name) return null;

  const specCandidate = merged.specification || merged.spec_line || merged.netto || merged.packaging || merged.usp || merged.description || '';
  const specLine = truncateWordBoundary(specCandidate, 44);

  const rawTag = finishingPlan?.product_tag || (hasRecipe ? 'BAHAN KUNCI' : (merged.category || 'PRODUK PILIHAN'));
  const tag = truncateWordBoundary(rawTag, 18).toUpperCase();

  let disclaimer = '';
  if (disclaimerOverride) {
    disclaimer = truncateWordBoundary(disclaimerOverride, 56);
  } else if (merged.disclaimer) {
    disclaimer = truncateWordBoundary(merged.disclaimer, 56);
  } else if (isHerbalProduct) {
    disclaimer = DEFAULT_HERBAL_DISCLAIMER;
  } else if (merged.safety_note || merged.neutral_note) {
    disclaimer = truncateWordBoundary(merged.safety_note || merged.neutral_note, 56);
  }

  const imageUrl = resolveLocalImageFileUrl(
    merged.local_image_path || merged.image_path || merged.product_image_path || merged.product_image_url || merged.thumbnail_url || ''
  );

  const dur = Math.max(Number(totalDuration) || 0, 2);
  const targetClipIdx = Math.max(0, Math.min(Math.max(0, clipOffsets.length - 1), Number(bridgeAtClip || 3) - 1));
  const fallbackStart = Number(clipOffsets[targetClipIdx]?.start ?? dur * 0.45);
  const nameTokenMatch = findBestWordTimestamp(name, wordEvents, Math.max(0.8, fallbackStart - 1.5), dur - 0.8);
  const s = Number(Math.max(1.8, nameTokenMatch !== null ? nameTokenMatch : fallbackStart + 0.1).toFixed(3));
  const e = Number(Math.min(dur - 0.15, Math.max(s + 2.2, dur - 0.35)).toFixed(3));

  if (e <= s + 0.4) return null;

  return {
    name,
    specLine,
    tag,
    disclaimer,
    imageUrl,
    s,
    e
  };
}

/**
 * Derives parameterized CTA pill and Save Prompt from VO/platform context without hardcoded strings.
 */
export function resolveCtaAndSavePrompt({
  cleanVoiceoverClips = [],
  wordEvents = [],
  clipOffsets = [],
  hasRecipe = false,
  platform = 'tiktok',
  totalDuration = 0,
  customCtaText = ''
} = {}) {
  const dur = Math.max(Number(totalDuration) || 0, wordEvents.reduce((m, w) => Math.max(m, Number(w.e || 0)), 0), 2);
  const lastClipIdx = Math.max(0, clipOffsets.length - 1);
  const lastClipStart = Number(clipOffsets[lastClipIdx]?.start ?? dur * 0.72);
  const joinedVo = cleanVoiceoverClips.join(' ').toLowerCase();

  let ctaText = sanitizeOverlayTextStrict(customCtaText || '');
  if (!ctaText) {
    if (/keranjang/i.test(joinedVo)) {
      ctaText = 'CEK KERANJANG KUNING';
    } else if (/shopee|etiket|showcase/i.test(joinedVo)) {
      ctaText = 'CEK PRODUK DI SINI';
    } else if (String(platform).toLowerCase() === 'facebook' || String(platform).toLowerCase() === 'instagram') {
      ctaText = 'CEK LINK DI CAPTION';
    } else {
      ctaText = 'LINK DI BIO';
    }
  }

  const ctaMatch = findBestWordTimestamp('keranjang bio link produk cek', wordEvents, Math.max(1.0, lastClipStart - 0.6), dur - 0.3);
  const ctaStart = Number(Math.max(1.8, ctaMatch !== null ? Math.max(lastClipStart, ctaMatch - 0.05) : lastClipStart + 0.15).toFixed(3));

  const cta = ctaStart < dur - 0.35
    ? { text: ctaText, arrowDir: '▼', s: ctaStart, e: Number(dur.toFixed(3)) }
    : null;

  let savePrompt = null;
  const saveEnd = Number(Math.max(0, (cta ? cta.s : dur) - 0.1).toFixed(3));
  const saveStart = Number(Math.max(2.0, saveEnd - 2.15).toFixed(3));
  if (saveEnd - saveStart >= 1.1) {
    savePrompt = {
      titleText: hasRecipe ? 'Simpan & Bagikan Resep Ini' : 'Simpan Tips Ini',
      subtitleText: hasRecipe
        ? 'Bahan & racikan lengkap ada di caption ⬇️'
        : 'Ringkasan lengkap ada di caption ⬇️',
      s: saveStart,
      e: saveEnd
    };
  }

  return { cta, savePrompt };
}

export { suggestFinishingTemplate } from './finishing-template-registry.js';

