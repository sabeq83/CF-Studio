function tokenizeText(input = '') {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 3);
}

const APPLIANCE_OR_UTENSIL_REGEX = /\b(blender|mixer|oven|chopper|air\s*fryer|skillet|pan|wajan|panci|pisau|juicer|grinder|kukusan|frother|whisk|cetakan|loyang|pie\s*beans|wrap)\b/i;

/**
 * Score an active brand product for relevance to a recipe topic & category.
 * Prefers culinary ingredients over utensils unless the topic explicitly names a utensil.
 * Pure JS (client & server safe).
 */
export function scoreCatalogProductForRecipe(product, { topic = '', category = '', hasPhoto = null } = {}) {
  if (!product) return -1;
  const hay = [
    product.product_name,
    product.category,
    product.tags,
    product.product_description,
    product.unique_selling_point
  ].filter(Boolean).join(' ').toLowerCase();

  const topicTokens = tokenizeText(topic);
  const categoryTokens = tokenizeText(String(category || '').replace(/_/g, ' '));
  let score = 10;

  for (const token of topicTokens) {
    if ((product.product_name || '').toLowerCase().includes(token)) score += 35;
    else if (hay.includes(token)) score += 18;
  }

  for (const token of categoryTokens) {
    if (hay.includes(token)) score += 10;
  }

  if (category === 'dessert' && /\b(cokelat|chocolate|cocoa|gula|sugar|aren|baking|butter|kue|cake|muffin|brownie|vanilla|tepung)\b/i.test(hay)) {
    score += 18;
  } else if (category === 'minuman' && /\b(kopi|coffee|tea|teh|matcha|cokelat|chocolate|powder|sirup|syrup|smoothie|chia|madu|honey)\b/i.test(hay)) {
    score += 18;
  } else if ((category === 'makanan_utama' || category === 'camilan') && /\b(bumbu|spice|rempah|minyak|oil|butter|saus|sauce|garam|kaldu|oat|chia|air\s*fryer)\b/i.test(hay)) {
    score += 14;
  }

  const topicWantsTool = APPLIANCE_OR_UTENSIL_REGEX.test(topic || '');
  const productIsTool = APPLIANCE_OR_UTENSIL_REGEX.test(product.product_name || '') || /peralatan|cetakan|alat/i.test(product.category || '');
  if (!topicWantsTool && productIsTool) {
    score -= 12;
  }

  const photoPresent = hasPhoto !== null
    ? Boolean(hasPhoto)
    : Boolean(product.clean_photo_url || product.cleaned_photo_url || product.generated_photo_url || product.photo_url || product.image_url);
  if (photoPresent) score += 20;
  if (product.affiliate_link || (Array.isArray(product.brand_links) && product.brand_links.some(l => l.affiliate_link))) {
    score += 4;
  }

  return score;
}

/**
 * Filter catalog products belonging to brandId (when brand_links metadata is available)
 * and pick the top relevance match for the recipe topic & category.
 */
export function pickAutoMatchedBrandProduct(catalogProducts = [], { brandId = null, topic = '', category = 'makanan_utama' } = {}) {
  const list = Array.isArray(catalogProducts) ? catalogProducts : [];
  const brandFiltered = brandId
    ? list.filter(p => Array.isArray(p.brand_links) && p.brand_links.some(bl => bl.brand_profile_id === brandId && bl.is_active !== false))
    : list;
  const pool = brandFiltered.length > 0 ? brandFiltered : list;
  if (pool.length === 0) return { product: null, score: 0, brandPoolCount: brandFiltered.length };

  let best = pool[0];
  let bestScore = -Infinity;
  for (const prod of pool) {
    const score = scoreCatalogProductForRecipe(prod, { topic, category });
    if (score > bestScore) {
      bestScore = score;
      best = prod;
    }
  }
  return { product: best, score: Math.min(99, Math.max(10, bestScore)), brandPoolCount: brandFiltered.length };
}

/**
 * Build API/schedule submission fields for recipe_campaign product bridging.
 * Ensures manual selection explicitly enables 'select_existing' even on non-bridging presets.
 */
export function buildRecipeProductSubmitFields(productMode, productId = null) {
  const mode = String(productMode || 'auto').trim().toLowerCase();
  if (mode === 'none') {
    return { product_mode: 'none', product_id: null, bridging_mode: 'none' };
  }
  if (mode === 'manual') {
    return { product_mode: 'manual', product_id: productId || null, bridging_mode: 'select_existing' };
  }
  return { product_mode: 'auto', product_id: 'auto' };
}

