/**
 * Shared pure helpers for pairing Multiplier Blueprints with Catalog Products
 * in Auto Pipeline (both Instant 1-Click and Schedule batching) and building
 * worker-compatible bridging/snapshot payloads.
 */

import { parseBridgeSegmentsArray, resolveBridgePlan } from './bridging/bridge-plan.js';

/**
 * Build schedule pair entries `{ blueprintId, productId }` according to the selected pairing mode.
 */
export function buildMultiplierSchedulePairs({
  blueprintIds = [],
  productIds = [],
  pairingMode = 'one_product' // 'one_product' | 'multi_product' | 'no_product'
} = {}) {
  const cleanBps = Array.isArray(blueprintIds) ? blueprintIds.filter(Boolean) : [];
  const cleanProds = Array.isArray(productIds) ? productIds.filter(Boolean) : [];

  if (cleanBps.length === 0) return [];
  if (pairingMode === 'no_product' || cleanProds.length === 0) {
    return cleanBps.map((blueprintId) => ({ blueprintId, productId: null }));
  }
  if (pairingMode === 'one_product') {
    const targetProductId = cleanProds[0];
    return cleanBps.map((blueprintId) => ({ blueprintId, productId: targetProductId }));
  }

  // multi_product: setiap blueprint tercentang dipasangkan ke tiap produk tercentang
  const pairs = [];
  for (const blueprintId of cleanBps) {
    for (const productId of cleanProds) {
      pairs.push({ blueprintId, productId });
    }
  }
  return pairs;
}

/**
 * Build a product snapshot JSON payload compatible with re-multiplier-worker handleProductResolution.
 */
export function buildProductSnapshot(product) {
  if (!product) return null;
  return {
    product_id: product.id,
    product_name: product.product_name || '',
    product_description: product.product_description || '',
    product_usp: product.unique_selling_point || '',
    product_truth: product.product_truth || product.clean_photo_t2i_prompt || '',
    geometric_truth: product.geometric_truth || '',
    clean_photo_t2i_prompt: product.clean_photo_t2i_prompt || '',
    t2i_prompt: product.t2i_prompt || '',
    product_url: product.product_url || product.source_url || '',
    product_image_url: product.clean_photo_url || product.photo_url || product.cleaned_photo_url || '',
    captured_at: new Date().toISOString()
  };
}

/**
 * Build bridging_config_json payload ensuring bridgingMode and image reference path
 * are preserved so the Multiplier Worker always resolves product DNA properly.
 */
export function buildAutonomousBridgingConfig({
  product = null,
  chosenAngle = {},
  presetConfig = {},
  overrides = {},
  effectiveTargetClipsCount = 4,
  effectiveMandatoryOutro = '',
  effectiveVisualMode = 'hybrid_lock',
  effectiveGenerateRecipe = 0,
  presetKey = ''
} = {}) {
  const explicitlyDisabled = overrides?.is_bridging_active === false || overrides?.bridging_mode === 'none';
  const hasActiveProduct = Boolean(product && !explicitlyDisabled);
  const isBridgingActive = hasActiveProduct || Boolean(!explicitlyDisabled && presetConfig?.product_bridging?.is_bridging_active);
  const resolvedImgPath = product
    ? (product.clean_photo_url || product.photo_url || product.cleaned_photo_url || null)
    : null;

  const targetClips = Math.max(1, Number(effectiveTargetClipsCount) || 4);
  const rawBridgeAtClip =
    overrides?.bridging?.bridgeAtClip ??
    overrides?.bridging?.bridge_at_clip ??
    overrides?.bridge_at_clip ??
    overrides?.bridgeAtClip ??
    presetConfig?.product_bridging?.bridge_at_clip ??
    Math.max(1, Math.min(targetClips, targetClips >= 4 ? 3 : 2));

  const parsedBridgeAtClip = Math.max(1, Math.min(targetClips, Number(rawBridgeAtClip) || Math.min(targetClips, 2)));

  const rawBridgeDuration =
    overrides?.bridging?.bridgeDurationClips ??
    overrides?.bridging?.bridge_duration_clips ??
    overrides?.bridge_duration_clips ??
    overrides?.bridgeDurationClips ??
    presetConfig?.product_bridging?.bridge_duration_clips ??
    1;

  const parsedBridgeDuration = Number.isFinite(Number(rawBridgeDuration)) ? Math.max(0, Number(rawBridgeDuration)) : 1;
  const rawSegments =
    parseBridgeSegmentsArray(overrides?.bridging?.bridgeSegments ?? overrides?.bridging?.bridge_segments) ||
    parseBridgeSegmentsArray(overrides?.bridge_segments ?? overrides?.bridgeSegments) ||
    parseBridgeSegmentsArray(presetConfig?.product_bridging?.bridge_segments) ||
    null;

  const resolvedPlan = resolveBridgePlan({
    targetClips,
    isBridgingActive,
    segments: rawSegments,
    bridgeAtClip: parsedBridgeAtClip,
    bridgeDurationClips: parsedBridgeDuration
  });

  const normalizedSegments = resolvedPlan.active
    ? resolvedPlan.segments.map(({ at_clip, duration_clips, role }) => ({ at_clip, duration_clips, role }))
    : [];

  const finalBridgeAt = resolvedPlan.active ? resolvedPlan.legacy.bridge_at_clip : parsedBridgeAtClip;
  const finalBridgeDur = resolvedPlan.active ? resolvedPlan.legacy.bridge_duration_clips : parsedBridgeDuration;

  const resolvedBridgingMode = hasActiveProduct
    ? (overrides?.bridging_mode || overrides?.bridging?.bridgingMode || presetConfig?.product_bridging?.bridging_mode || 'select_existing')
    : undefined;

  return {
    is_bridging_active: isBridgingActive,
    isBridgingActive: isBridgingActive,
    bridgingMode: resolvedBridgingMode,
    bridging_mode: resolvedBridgingMode,
    bridge_at_clip: finalBridgeAt,
    bridgeAtClip: finalBridgeAt,
    bridge_duration_clips: finalBridgeDur,
    bridgeDurationClips: finalBridgeDur,
    bridge_segments: normalizedSegments,
    bridgeSegments: normalizedSegments,
    productName: hasActiveProduct ? (product.product_name || '') : '',
    productUrl: hasActiveProduct ? (product.product_url || product.source_url || '') : '',
    targetProductId: hasActiveProduct ? product.id : null,
    productRefImagePath: resolvedImgPath || undefined,
    angleTitle: chosenAngle.title,
    hookText: chosenAngle.hook_text,
    targetClipsCount: targetClips,
    target_clips_count: targetClips,
    mandatoryOutroLine: effectiveMandatoryOutro,
    mandatory_outro_line: effectiveMandatoryOutro,
    visualMode: effectiveVisualMode,
    visual_mode: effectiveVisualMode,
    preset_key: presetKey,
    generate_recipe: effectiveGenerateRecipe === 1,
    ...(overrides?.bridging || {})
  };
}

