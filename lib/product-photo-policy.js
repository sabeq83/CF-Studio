export const CANONICAL_PRODUCT_PHOTO_FIELDS = Object.freeze(['clean_photo_url', 'raw_photo_url']);
export const ACTIVE_PHOTO_FIELDS = Object.freeze(['clean_photo_url', 'cleaned_photo_url', 'generated_photo_url', 'raw_photo_url', 'photo_url']);

/**
 * Prefix prompt with strict visual identity lock so the image generator treats the attached
 * product reference image as sole source of packaging truth over any stale text details.
 */
export function lockProductIdentityPrompt(prompt, product, productTag = 'product_truth') {
  const sanitizedPrompt = String(prompt || '')
    .replace(/\(Product Reference File:\s*['"][^'"]*generated_[^'"]*['"][^)]*\)\.?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const productName = String(product?.name || product?.product_name || '').trim();
  return `[HIGHEST PRIORITY PRODUCT IDENTITY LOCK] The attached product reference @${productTag} is the sole visual source of truth${productName ? ` for ${productName}` : ''}. Reproduce the exact same package identity, silhouette, materials, colors, logo, label artwork, typography, and printed details. Do not redesign, simplify, genericize, relabel, translate, substitute, or invent a different product package. Ignore any filename or textual product description that conflicts with the attached image. Preserve the attached package as a recognizable exact product while composing it naturally into the requested scene.\n\n${sanitizedPrompt}`;
}

export function photoCandidates(product, fallbackPaths = []) {
  const active = ACTIVE_PHOTO_FIELDS.includes(product?.active_photo) ? product[product.active_photo] : null;
  return [active, product?.clean_photo_url, product?.cleaned_photo_url, product?.generated_photo_url, product?.raw_photo_url, product?.photo_url, ...fallbackPaths]
    .filter((value, index, values) => typeof value === 'string' && value.trim() && values.indexOf(value) === index);
}

export function resolveActiveProductPhotoPath(product, fallbackPaths = []) {
  return photoCandidates(product, fallbackPaths)[0] || null;
}

/**
 * Resolve product photo path respecting explicit canonical active_photo selection
 * ('raw_photo_url', 'clean_photo_url', 'cleaned_photo_url') without letting legacy
 * generated_photo_url override canonical clean/raw photos.
 */
export function resolveCampaignProductPhotoPath(product, fallbackPaths = []) {
  if (!product) {
    return fallbackPaths.find(p => typeof p === 'string' && p.trim()) || null;
  }
  const activePhoto = product.active_photo;
  if (activePhoto === 'raw_photo_url') {
    return product.raw_photo_url || null;
  }
  if (activePhoto === 'clean_photo_url') {
    return product.clean_photo_url || product.cleaned_photo_url || null;
  }
  if (activePhoto === 'cleaned_photo_url') {
    return product.cleaned_photo_url || product.clean_photo_url || null;
  }
  const ordered = [
    product.clean_photo_url,
    product.cleaned_photo_url,
    product.raw_photo_url,
    product.photo_url,
    product.generated_photo_url,
    ...fallbackPaths
  ].filter(value => typeof value === 'string' && value.trim());
  return ordered[0] || null;
}
