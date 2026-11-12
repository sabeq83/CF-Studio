/**
 * Shared pure helpers for pairing Multiplier Blueprints with Catalog Products
 * in Auto Pipeline (both Instant 1-Click and Schedule batching) and building
 * worker-compatible bridging/snapshot payloads.
 */

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
  effectiveTargetClipsCount = 3,
  effectiveMandatoryOutro = '',
  effectiveVisualMode = 'hybrid_lock',
  effectiveGenerateRecipe = 0,
  presetKey = ''
} = {}) {
  const explicitlyDisabled = overrides?.is_bridging_active === false || overrides?.bridging_mode === 'none';
  const hasActiveProduct = Boolean(product && !explicitlyDisabled);
  const resolvedImgPath = product
    ? (product.clean_photo_url || product.photo_url || product.cleaned_photo_url || null)
    : null;

  return {
    is_bridging_active: hasActiveProduct || Boolean(!explicitlyDisabled && presetConfig?.product_bridging?.is_bridging_active),
    bridgingMode: hasActiveProduct ? (overrides?.bridging_mode || overrides?.bridging?.bridgingMode || 'select_existing') : undefined,
    productName: hasActiveProduct ? (product.product_name || '') : '',
    productUrl: hasActiveProduct ? (product.product_url || product.source_url || '') : '',
    targetProductId: hasActiveProduct ? product.id : null,
    productRefImagePath: resolvedImgPath || undefined,
    angleTitle: chosenAngle.title,
    hookText: chosenAngle.hook_text,
    targetClipsCount: effectiveTargetClipsCount,
    target_clips_count: effectiveTargetClipsCount,
    mandatoryOutroLine: effectiveMandatoryOutro,
    mandatory_outro_line: effectiveMandatoryOutro,
    visualMode: effectiveVisualMode,
    visual_mode: effectiveVisualMode,
    preset_key: presetKey,
    generate_recipe: effectiveGenerateRecipe === 1,
    ...(overrides?.bridging || {})
  };
}

