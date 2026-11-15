/**
 * Pure Non-Bridging Prompt Hygiene & Packaging Sanitizer.
 * Ensures clips outside designated product bridging segments never depict
 * generic retail packages, pouches, jars, bottles, or marketing titles printed as labels.
 */

export const UNBRANDED_PREP_POSITIVE_TAG =
  '(Unbranded Prep Truth: only loose culinary ingredients inside open kitchenware and cooking utensils on a clear uncluttered countertop)';

const PACKAGING_IN_FOOD_TRUTH_PATTERN =
  '\\b(?:package|packaging|packaged|pouch|pouches|sachet|sachets|canister|tin|carton|box|bottle|bottles|jar|jars|bag|bags|label|labeled|labelled|kemasan|bungkus|saset)\\b';
const PACKAGING_IN_FOOD_TRUTH_RE = new RegExp(PACKAGING_IN_FOOD_TRUTH_PATTERN, 'i');
const PACKAGING_IN_FOOD_TRUTH_GLOBAL_RE = new RegExp(PACKAGING_IN_FOOD_TRUTH_PATTERN, 'gi');

const MULTIWORD_PACKAGING_RE =
  /\b(?:(?:standing|kraft(?:\s+paper)?|foil|retail|sealed|zip-?lock|resealable)\s+(?:pouch(?:es)?|bags?|sachets?|packets?)|(?:product|commercial|branded|retail|bulk)\s+(?:packaging|packages?|box(?:es)?|tins?|canisters?|cartons?|bags?|labels?))\b/gi;

const STANDALONE_PACKAGING_RE =
  /\b(?:pouch(?:es)?|sachets?|canisters?|packaging|packaged|kemasan|bungkus(?:an)?|saset)\b/gi;

const KITCHEN_CONTAINER_RE =
  /\b(?:bowl|beaker|glass|cup|mug|pan|skillet|plate|dish|spoon|whisk|spatula|tray|pot|kettle|mangkuk|gelas|cangkir|loyang|panci|wajan|piring|sendok)\b/i;

function escapeRegExp(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function categoryCulinaryFallback(category = '') {
  const lower = String(category || '').toLowerCase();
  if (/minuman|drink|latte|kopi|coffee|tea|smoothie|jus|juice|shake/i.test(lower)) {
    return 'pure loose culinary ingredients in open ceramic bowl beside freshly prepared beverage in locked glassware';
  }
  if (/kue|cake|brownies|bolu|muffin|pie|tart|cookies|baking|dessert/i.test(lower)) {
    return 'pure loose baking batter and fresh pastry ingredients inside open stoneware bowl and locked bakeware';
  }
  return 'pure loose raw culinary ingredients in open stoneware prep bowl and locked cookware';
}

/**
 * Replace leaked brand/product names (case-insensitive) in non-bridging text.
 */
export function stripLeakedProductNames(text, productNames = [], replacement = 'pure culinary ingredient') {
  let next = String(text || '');
  const uniqueNames = [...new Set(
    (Array.isArray(productNames) ? productNames : [productNames])
      .map(n => String(n || '').trim())
      .filter(n => n.length >= 3 && !/^(?:produk utama|product|natural ingredients)$/i.test(n))
  )].sort((a, b) => b.length - a.length);

  for (const name of uniqueNames) {
    next = next.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, 'gi'), replacement);
  }
  return next;
}

/**
 * Sanitize commercial packaging terms while preserving existing kitchen/conduit conventions.
 */
export function sanitizeCommercialPackagingTerms(prompt, {
  isPreBridgeKitchenScene = false,
  preserveBottleJarToConduit = true
} = {}) {
  let next = String(prompt || '');
  next = next.replace(/\(Product Reference File:\s*['"][^'"]*['"][^)]*\)\.?/gi, '');
  next = next.replace(/\bgarlibee\b/gi, 'natural botanical');

  if (preserveBottleJarToConduit) {
    next = next.replace(/\b(?:authentic\s+)?(?:garlibee\s+)?(?:product\s+)?(?:jar|bottle)\b/gi, 'glass conduit');
  }
  if (isPreBridgeKitchenScene) {
    next = next.replace(/\b(?:glass\s+spice\s+jars?|spice\s+jars?|amber\s+glass\s+bottles?|condiment\s+bottles?)\b/gi, 'ceramic prep bowl');
  }

  next = next.replace(MULTIWORD_PACKAGING_RE, 'open ceramic prep bowl');
  next = next.replace(STANDALONE_PACKAGING_RE, 'open ceramic prep bowl');
  return next;
}

/**
 * Prevent marketing recipe titles or uncontained powder descriptions inside (Food Truth: ...)
 * from causing T2I generators to invent a branded commercial pouch/package.
 */
export function sanitizeNonBridgingFoodTruth(prompt, {
  recipeTitle = '',
  productNames = [],
  category = ''
} = {}) {
  const cleanTitle = String(recipeTitle || '').trim();
  const titleHead = cleanTitle.includes(':') ? cleanTitle.split(':')[0].trim() : cleanTitle;
  const fallback = categoryCulinaryFallback(category);

  return String(prompt || '').replace(/\(Food Truth:\s*([^)]+)\)/gi, (_match, rawInner) => {
    let inner = stripLeakedProductNames(rawInner, productNames, 'pure culinary ingredient').trim();

    const matchesFullTitle = cleanTitle && inner.toLowerCase().includes(cleanTitle.toLowerCase());
    const matchesTitleHead = titleHead.length >= 6 && inner.toLowerCase().includes(titleHead.toLowerCase());
    const hasPackagingCue = PACKAGING_IN_FOOD_TRUTH_RE.test(inner);
    const hasBarePowderCue = /\b(?:powdered\s+state|dry\s+powder|raw\s+powder)\b/i.test(inner) && !KITCHEN_CONTAINER_RE.test(inner);

    if (matchesFullTitle || matchesTitleHead || hasPackagingCue || hasBarePowderCue) {
      if (cleanTitle) {
        inner = inner.replace(new RegExp(escapeRegExp(cleanTitle), 'gi'), '');
      }
      if (titleHead && titleHead.length >= 6) {
        inner = inner.replace(new RegExp(escapeRegExp(titleHead), 'gi'), '');
      }
      inner = inner
        .replace(MULTIWORD_PACKAGING_RE, '')
        .replace(STANDALONE_PACKAGING_RE, '')
        .replace(PACKAGING_IN_FOOD_TRUTH_GLOBAL_RE, '')
        .replace(/\b(?:next\s+to|beside|with)\s*$/i, '')
        .replace(/^\s*[:\-–,\s]+|\s*[:\-–,\s]+$/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

      const safeDetail = inner && inner.length >= 12 && KITCHEN_CONTAINER_RE.test(inner)
        ? inner
        : fallback;
      return `(Food Truth: ${safeDetail})`;
    }

    return `(Food Truth: ${inner})`;
  });
}

/**
 * Append positive-framing clean tabletop guard (immune to sanitizeImagePrompt negation stripping).
 */
export function appendUnbrandedPrepTag(prompt) {
  const text = String(prompt || '').trim();
  if (!text) return text;
  if (/\(Unbranded Prep Truth:/i.test(text)) return text;
  return `${text} ${UNBRANDED_PREP_POSITIVE_TAG}`.trim();
}

/**
 * Full deterministic non-bridging prompt sanitization pipeline for T2I / T2V prompts.
 */
export function sanitizeNonBridgingVisualPrompt(prompt, {
  productNames = [],
  recipeTitle = '',
  category = '',
  isPreBridgeKitchenScene = false,
  stripProductTruth = true,
  appendPositivePrepLock = true
} = {}) {
  let next = String(prompt || '');
  if (!next.trim()) return next;

  if (stripProductTruth) {
    next = next.replace(/,?\s*\(Product Truth:[^)]*\)\.?/gi, '').trim();
  }
  next = stripLeakedProductNames(next, productNames, 'natural raw ingredients');
  next = sanitizeNonBridgingFoodTruth(next, { recipeTitle, productNames, category });
  next = sanitizeCommercialPackagingTerms(next, {
    isPreBridgeKitchenScene,
    preserveBottleJarToConduit: true
  });
  if (appendPositivePrepLock) {
    next = appendUnbrandedPrepTag(next);
  }
  return next.replace(/\s{2,}/g, ' ').trim();
}
