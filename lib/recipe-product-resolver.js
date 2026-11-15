import { resolveActiveProductPhotoPath } from './product-reference-resolver.js';
import { scoreCatalogProductForRecipe } from './recipe-product-matcher-shared.js';

export { scoreCatalogProductForRecipe };

/**
 * Resolve either an explicitly chosen product or auto-match the best active brand catalog product
 * for a recipe campaign with product bridging enabled.
 */
export async function resolveRecipeProductSelection({
  db,
  brandId = null,
  topic = '',
  category = 'makanan_utama',
  productId = null,
  productMode = null,
  bridgingMode = null
} = {}) {
  const normalizedMode = String(productMode || '').trim().toLowerCase();
  const normalizedBridgingMode = String(bridgingMode || '').trim().toLowerCase();

  if (normalizedMode === 'none' || normalizedBridgingMode === 'none') {
    return { resolved: false, mode: 'none', product: null };
  }

  const normalizeRow = (row, mode, score = null) => {
    if (!row) return { resolved: false, mode, product: null };
    const photoPath = resolveActiveProductPhotoPath(row);
    return {
      resolved: true,
      mode,
      score,
      product: {
        product_id: row.id,
        product_name: row.product_name,
        category: row.category || null,
        description: row.product_description || null,
        usp: row.unique_selling_point || null,
        affiliate_link: row.affiliate_link || null,
        photo_path: photoPath
      }
    };
  };

  if (productId && productId !== 'auto') {
    const manualRow = await db.prepare(`
      SELECT pe.*, bp.affiliate_link
      FROM product_extractions pe
      LEFT JOIN brand_products bp
        ON bp.product_id = pe.id
       AND (? IS NULL OR bp.brand_profile_id = ?)
       AND bp.is_active = TRUE
      WHERE pe.id = ?
      LIMIT 1
    `).get(brandId || null, brandId || null, productId);
    if (manualRow) return normalizeRow(manualRow, 'manual', 100);
  }

  if (!brandId) {
    return { resolved: false, mode: 'auto_no_brand', product: null };
  }

  const activeRows = await db.prepare(`
    SELECT pe.*, bp.affiliate_link
    FROM brand_products bp
    JOIN product_extractions pe ON bp.product_id = pe.id
    WHERE bp.brand_profile_id = ?
      AND bp.is_active = TRUE
    ORDER BY pe.updated_at DESC, pe.created_at DESC
  `).all(brandId);

  if (!Array.isArray(activeRows) || activeRows.length === 0) {
    return { resolved: false, mode: 'auto_empty', product: null };
  }

  let bestRow = null;
  let bestScore = -Infinity;
  for (const row of activeRows) {
    const score = scoreCatalogProductForRecipe(row, {
      topic,
      category,
      hasPhoto: Boolean(resolveActiveProductPhotoPath(row))
    });
    if (score > bestScore) {
      bestScore = score;
      bestRow = row;
    }
  }

  return normalizeRow(bestRow, 'auto', bestScore);
}
