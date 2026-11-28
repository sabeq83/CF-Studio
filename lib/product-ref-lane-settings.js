export const PRODUCT_REF_LANE_MODES = ['exclusive', 'shared_staggered'];
export const DEFAULT_PRODUCT_REF_LANE_MODE = 'exclusive';
export const DEFAULT_PRODUCT_REF_STAGGER_SEC = 12;
export const MIN_PRODUCT_REF_STAGGER_SEC = 5;
export const MAX_PRODUCT_REF_STAGGER_SEC = 60;

/**
 * Normalizes product-reference start-frame lane mode to the allowed whitelist.
 */
export function normalizeProductRefLaneMode(value) {
  return String(value || '').trim() === 'shared_staggered'
    ? 'shared_staggered'
    : DEFAULT_PRODUCT_REF_LANE_MODE;
}

/**
 * Clamps stagger interval in seconds to the safe 5..60 range.
 */
export function clampProductRefStaggerSec(value, fallback = DEFAULT_PRODUCT_REF_STAGGER_SEC) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return fallback;
  }
  const parsed = Number.parseInt(String(value).trim(), 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(MAX_PRODUCT_REF_STAGGER_SEC, Math.max(MIN_PRODUCT_REF_STAGGER_SEC, parsed));
}

/**
 * Resolves active tenant's product-reference lane mode and stagger delay from settings.
 */
export function resolveProductRefLaneSettings(getSettingFn) {
  if (typeof getSettingFn !== 'function') {
    return {
      laneMode: DEFAULT_PRODUCT_REF_LANE_MODE,
      staggerSec: DEFAULT_PRODUCT_REF_STAGGER_SEC
    };
  }
  return {
    laneMode: normalizeProductRefLaneMode(getSettingFn('webhook_product_ref_lane_mode')),
    staggerSec: clampProductRefStaggerSec(getSettingFn('webhook_product_ref_stagger_sec'))
  };
}

/**
 * Validates incoming /api/settings payload for product-reference lane controls.
 */
export function validateProductRefLaneSettings(body = {}) {
  const result = {
    valid: true,
    errors: [],
    hasLaneMode: body.webhook_product_ref_lane_mode !== undefined,
    hasStaggerSec: body.webhook_product_ref_stagger_sec !== undefined,
    laneMode: undefined,
    staggerSec: undefined
  };

  if (result.hasLaneMode) {
    const rawMode = String(body.webhook_product_ref_lane_mode ?? '').trim();
    if (!PRODUCT_REF_LANE_MODES.includes(rawMode)) {
      result.valid = false;
      result.errors.push(
        `webhook_product_ref_lane_mode tidak valid. Pilihan yang didukung: ${PRODUCT_REF_LANE_MODES.join(', ')}.`
      );
    } else {
      result.laneMode = rawMode;
    }
  }

  if (result.hasStaggerSec) {
    const rawSec = String(body.webhook_product_ref_stagger_sec ?? '').trim();
    const parsed = Number.parseInt(rawSec, 10);
    if (!rawSec || Number.isNaN(parsed)) {
      result.valid = false;
      result.errors.push('webhook_product_ref_stagger_sec harus berupa angka bulat (5-60 detik).');
    } else {
      result.staggerSec = clampProductRefStaggerSec(parsed);
    }
  }

  return result;
}
