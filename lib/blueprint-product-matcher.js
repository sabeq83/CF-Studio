import crypto from 'crypto';
import { pgQuery, withPgTransaction } from './db-pg.js';
import {
  PROMO_ROLES,
  classifyProductPromoRole,
  analyzeBlueprintProfile,
  scoreBlueprintAgainstProduct,
} from './blueprint-product-matcher-shared.js';

export { PROMO_ROLES, classifyProductPromoRole, analyzeBlueprintProfile, scoreBlueprintAgainstProduct };

/**
 * Pastikan semua produk aktif yang promo_role-nya masih NULL terisi otomatis.
 */
export async function backfillProductPromoRoles(tenantId = 'default_tenant') {
  const { rows } = await pgQuery(
    `SELECT id, product_name, category, tags, product_description, promo_role
     FROM product_extractions
     WHERE tenant_id = $1 AND (promo_role IS NULL OR promo_role = '')`,
    [tenantId]
  );

  let updatedCount = 0;
  for (const row of rows) {
    const inferred = classifyProductPromoRole(row, { respectExisting: false });
    await pgQuery(
      `UPDATE product_extractions SET promo_role = $1 WHERE id = $2 AND tenant_id = $3 AND (promo_role IS NULL OR promo_role = '')`,
      [inferred, row.id, tenantId]
    );
    updatedCount += 1;
  }
  return updatedCount;
}

/**
 * Muat daftar brand aktif beserta produk katalognya untuk tenant tertentu.
 */
async function loadBrandProductPools(tenantId = 'default_tenant') {
  const res = await pgQuery(
    `SELECT bp.brand_profile_id, b.brand_name, bp.affiliate_link AS brand_affiliate_link,
            p.id AS product_id, p.product_name, p.category, p.tags, p.product_description,
            p.unique_selling_point, p.pain_point_solved, p.promo_role,
            p.affiliate_link AS global_affiliate_link,
            p.clean_photo_url, p.cleaned_photo_url, p.product_truth
     FROM brand_products bp
     JOIN brand_profiles b ON b.id = bp.brand_profile_id AND b.tenant_id = bp.tenant_id
     JOIN product_extractions p ON p.id = bp.product_id AND p.tenant_id = bp.tenant_id
     WHERE bp.tenant_id = $1 AND bp.is_active = TRUE`,
    [tenantId]
  );

  const byBrand = new Map();
  for (const row of res.rows) {
    if (!byBrand.has(row.brand_profile_id)) {
      byBrand.set(row.brand_profile_id, {
        brandId: row.brand_profile_id,
        brandName: row.brand_name,
        products: [],
      });
    }
    byBrand.get(row.brand_profile_id).products.push({
      id: row.product_id,
      product_name: row.product_name,
      category: row.category,
      tags: row.tags,
      product_description: row.product_description,
      unique_selling_point: row.unique_selling_point,
      pain_point_solved: row.pain_point_solved,
      promo_role: row.promo_role,
      hasCleanPhoto: Boolean(row.clean_photo_url || row.cleaned_photo_url),
      hasProductTruth: Boolean(row.product_truth),
      hasAffiliateLink: Boolean((row.brand_affiliate_link || row.global_affiliate_link || '').trim()),
    });
  }
  return Array.from(byBrand.values());
}

/**
 * Hitung dan simpan top matches (alat_dapur & bahan_resep) untuk satu blueprint deconstruct.
 */
export async function indexBlueprintMatchesForAsset(assetId, tenantId = 'default_tenant', { topPerRole = 6, minScore = 24 } = {}) {
  const assetRes = await pgQuery(
    `SELECT id, tenant_id, niche, tags, core_problem, core_solution, target_audience_pain_point,
            viral_pattern_summary, original_caption, original_storyboard_json, product_ideas_json, status
     FROM re_deconstructed_assets
     WHERE id = $1 AND tenant_id = $2
     LIMIT 1`,
    [assetId, tenantId]
  );
  const asset = assetRes.rows[0];
  if (!asset || asset.status !== 'deconstructed') {
    return { indexed: 0, skipped: true };
  }

  const brandPools = await loadBrandProductPools(tenantId);
  const bpProfile = analyzeBlueprintProfile(asset);

  const records = [];
  for (const pool of brandPools) {
    const alatMatches = [];
    const bahanMatches = [];

    for (const prod of pool.products) {
      const scored = scoreBlueprintAgainstProduct(bpProfile, prod, {
        hasCleanPhoto: prod.hasCleanPhoto,
        hasProductTruth: prod.hasProductTruth,
        hasAffiliateLink: prod.hasAffiliateLink,
      });
      if (scored.score < minScore) continue;
      const rec = {
        id: `bpm_${crypto.createHash('sha1').update(`${tenantId}:${asset.id}:${pool.brandId}:${prod.id}`).digest('hex').slice(0, 16)}`,
        deconstruct_asset_id: asset.id,
        brand_profile_id: pool.brandId,
        product_id: prod.id,
        promo_role: scored.promoRole,
        match_score: scored.score,
        match_reason: scored.reason,
        matched_keywords: scored.matchedKeywords,
        is_food_safe: bpProfile.isFoodSafe,
      };
      if (scored.promoRole === 'alat_dapur') alatMatches.push(rec);
      else if (scored.promoRole === 'bahan_resep') bahanMatches.push(rec);
    }

    alatMatches.sort((a, b) => b.match_score - a.match_score);
    bahanMatches.sort((a, b) => b.match_score - a.match_score);
    records.push(...alatMatches.slice(0, topPerRole), ...bahanMatches.slice(0, topPerRole));
  }

  await withPgTransaction(async (client) => {
    await client.query(
      `DELETE FROM blueprint_product_matches WHERE tenant_id = $1 AND deconstruct_asset_id = $2`,
      [tenantId, asset.id]
    );
    for (const r of records) {
      await client.query(
        `INSERT INTO blueprint_product_matches
          (id, tenant_id, deconstruct_asset_id, brand_profile_id, product_id, promo_role, match_score, match_reason, matched_keywords_json, is_food_safe, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, CURRENT_TIMESTAMP)`,
        [
          r.id,
          tenantId,
          r.deconstruct_asset_id,
          r.brand_profile_id,
          r.product_id,
          r.promo_role,
          r.match_score,
          r.match_reason,
          JSON.stringify(r.matched_keywords || []),
          r.is_food_safe,
        ]
      );
    }
  });

  return {
    indexed: records.length,
    is_food_safe: bpProfile.isFoodSafe,
    asset_id: asset.id,
  };
}

/**
 * Backfill seluruh blueprint status 'deconstructed' dan produk yang promo_role-nya belum terisi.
 */
export async function backfillBlueprintProductMatches(tenantId = 'default_tenant') {
  const rolesUpdated = await backfillProductPromoRoles(tenantId);
  const assetsRes = await pgQuery(
    `SELECT id FROM re_deconstructed_assets WHERE tenant_id = $1 AND status = 'deconstructed' ORDER BY created_at DESC`,
    [tenantId]
  );

  let assetsProcessed = 0;
  let totalMatches = 0;
  for (const row of assetsRes.rows) {
    const res = await indexBlueprintMatchesForAsset(row.id, tenantId);
    assetsProcessed += 1;
    totalMatches += res.indexed || 0;
  }

  return {
    roles_updated: rolesUpdated,
    assets_processed: assetsProcessed,
    total_matches: totalMatches,
  };
}

/**
 * Ambil rekomendasi produk teratas untuk satu blueprint & (opsional) brand tertentu.
 */
export async function getMatchesForBlueprint({
  tenantId = 'default_tenant',
  blueprintId,
  brandId = null,
  promoRole = null,
  limit = 20,
}) {
  const params = [tenantId, blueprintId];
  const where = ['m.tenant_id = $1', 'm.deconstruct_asset_id = $2'];

  let resolvedBrandId = brandId;
  if (brandId && brandId !== 'all') {
    const bRes = await pgQuery(
      `SELECT id FROM brand_profiles WHERE tenant_id = $1 AND (id = $2 OR LOWER(brand_name) = LOWER($2)) LIMIT 1`,
      [tenantId, brandId]
    );
    resolvedBrandId = bRes.rows[0]?.id || brandId;
    params.push(resolvedBrandId);
    where.push(`m.brand_profile_id = $${params.length}`);
  }

  if (promoRole && PROMO_ROLES.includes(promoRole)) {
    params.push(promoRole);
    where.push(`m.promo_role = $${params.length}`);
  }

  params.push(Math.min(100, Math.max(1, Number(limit) || 20)));

  const { rows } = await pgQuery(
    `SELECT m.*, p.product_name, p.category, p.clean_photo_url, p.cleaned_photo_url, p.photo_url,
            p.photo_status, p.enrichment_status, b.brand_name
     FROM blueprint_product_matches m
     JOIN product_extractions p ON p.id = m.product_id AND p.tenant_id = m.tenant_id
     LEFT JOIN brand_profiles b ON b.id = m.brand_profile_id AND b.tenant_id = m.tenant_id
     WHERE ${where.join(' AND ')}
     ORDER BY m.match_score DESC, p.product_name ASC
     LIMIT $${params.length}`,
    params
  );

  return rows;
}

/**
 * Pilih pasangan (blueprint, product) terbaik untuk kuota 2+2 Autopilot dengan rotasi anti-duplikat.
 */
export async function pickNextSmartMatchPair({
  tenantId = 'default_tenant',
  brandId,
  targetPromoRole = 'alat_dapur',
  lookbackBlueprintDays = 14,
  lookbackProductDays = 4,
}) {
  if (!brandId) return null;

  const brandRes = await pgQuery(
    `SELECT id, brand_name FROM brand_profiles WHERE (tenant_id = $1 OR tenant_id = 'default_tenant') AND (id = $2 OR LOWER(brand_name) = LOWER($2)) LIMIT 1`,
    [tenantId, brandId]
  );
  const resolvedBrandId = brandRes.rows[0]?.id || brandId;
  const resolvedBrandName = brandRes.rows[0]?.brand_name || brandId;

  const recentBpRes = await pgQuery(
    `SELECT DISTINCT deconstruct_asset_id AS id
     FROM re_multiplier_tasks
     WHERE tenant_id = $1
       AND deconstruct_asset_id IS NOT NULL
       AND created_at >= NOW() - ($2 || ' days')::interval
       AND (brand_profile_id = $3 OR LOWER(COALESCE(account_name, '')) = LOWER($4))`,
    [tenantId, String(lookbackBlueprintDays), resolvedBrandId, resolvedBrandName]
  );
  const recentBlueprintIds = new Set(recentBpRes.rows.map(r => r.id));

  const recentProdRes = await pgQuery(
    `SELECT DISTINCT target_product_id AS id
     FROM re_multiplier_tasks
     WHERE tenant_id = $1
       AND target_product_id IS NOT NULL
       AND created_at >= NOW() - ($2 || ' days')::interval
       AND (brand_profile_id = $3 OR LOWER(COALESCE(account_name, '')) = LOWER($4))`,
    [tenantId, String(lookbackProductDays), resolvedBrandId, resolvedBrandName]
  );
  const recentProductIds = new Set(recentProdRes.rows.map(r => r.id));

  const params = [tenantId, resolvedBrandId];
  let roleClause = `AND m.promo_role IN ('alat_dapur', 'bahan_resep')`;
  if (targetPromoRole && targetPromoRole !== 'any' && PROMO_ROLES.includes(targetPromoRole)) {
    params.push(targetPromoRole);
    roleClause = `AND m.promo_role = $${params.length}`;
  }

  const candidatesRes = await pgQuery(
    `SELECT m.deconstruct_asset_id, m.product_id, m.promo_role, m.match_score, m.match_reason,
            p.product_name, a.niche, a.core_problem, a.source_url,
            (p.clean_photo_url IS NOT NULL OR p.cleaned_photo_url IS NOT NULL) AS has_clean_photo,
            (p.product_truth IS NOT NULL) AS has_product_truth
     FROM blueprint_product_matches m
     JOIN re_deconstructed_assets a ON a.id = m.deconstruct_asset_id AND a.tenant_id = m.tenant_id
     JOIN product_extractions p ON p.id = m.product_id AND p.tenant_id = m.tenant_id
     JOIN brand_products bp ON bp.product_id = m.product_id AND bp.brand_profile_id = m.brand_profile_id AND bp.tenant_id = m.tenant_id AND bp.is_active = TRUE
     WHERE m.tenant_id = $1
       AND m.brand_profile_id = $2
       AND m.is_food_safe = TRUE
       AND a.status = 'deconstructed'
       ${roleClause}
     ORDER BY
       (p.clean_photo_url IS NOT NULL AND p.product_truth IS NOT NULL) DESC,
       m.match_score DESC,
       m.updated_at DESC
     LIMIT 120`,
    params
  );

  const candidates = candidatesRes.rows;
  if (candidates.length === 0) return null;

  // Prioritas 1: Lolos anti-duplikat blueprint 14h & produk 4h
  const freshBoth = candidates.find(c => !recentBlueprintIds.has(c.deconstruct_asset_id) && !recentProductIds.has(c.product_id));
  if (freshBoth) return freshBoth;

  // Prioritas 2: Lolos anti-duplikat blueprint 14h (boleh ulang produk bila stok terbatas)
  const freshBp = candidates.find(c => !recentBlueprintIds.has(c.deconstruct_asset_id));
  if (freshBp) return freshBp;

  // Fallback: skor tertinggi yang siap visual
  return candidates[0];
}

/**
 * Sinkronkan tabel blueprint_product_matches saat promo_role suatu produk diperbarui.
 * Bila berubah ke 'lainnya', semua entri match produk tersebut langsung dihapus.
 */
export async function syncProductPromoRoleInMatches(tenantId = 'default_tenant', product = {}) {
  if (!product?.id) return { action: 'noop', count: 0 };
  const effectiveRole = classifyProductPromoRole(product);

  if (effectiveRole === 'lainnya') {
    const delRes = await pgQuery(
      `DELETE FROM blueprint_product_matches WHERE tenant_id = $1 AND product_id = $2`,
      [tenantId, product.id]
    );
    return { action: 'deleted', count: delRes.rowCount || 0, promo_role: effectiveRole };
  }

  const updRes = await pgQuery(
    `UPDATE blueprint_product_matches
     SET promo_role = $1, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $2 AND product_id = $3`,
    [effectiveRole, tenantId, product.id]
  );

  // Bila sebelumnya pernah dihapus (dari 'lainnya' kembali ke 'alat_dapur'/'bahan_resep'), indeks ulang untuk produk ini
  if ((updRes.rowCount || 0) === 0) {
    const brandPools = await loadBrandProductPools(tenantId);
    const matchingPools = brandPools.filter(pool => pool.products.some(p => p.id === product.id));
    if (matchingPools.length > 0) {
      const assetsRes = await pgQuery(
        `SELECT id, niche, tags, core_problem, core_solution, target_audience_pain_point,
                viral_pattern_summary, original_caption, original_storyboard_json, product_ideas_json
         FROM re_deconstructed_assets
         WHERE tenant_id = $1 AND status = 'deconstructed'`,
        [tenantId]
      );
      let inserted = 0;
      for (const pool of matchingPools) {
        const prodEntry = pool.products.find(p => p.id === product.id);
        for (const asset of assetsRes.rows) {
          const bpProfile = analyzeBlueprintProfile(asset);
          const scored = scoreBlueprintAgainstProduct(bpProfile, prodEntry, {
            hasCleanPhoto: prodEntry.hasCleanPhoto,
            hasProductTruth: prodEntry.hasProductTruth,
            hasAffiliateLink: prodEntry.hasAffiliateLink,
          });
          if (scored.score < 24 || scored.promoRole === 'lainnya') continue;
          const rowId = `bpm_${crypto.createHash('sha1').update(`${tenantId}:${asset.id}:${pool.brandId}:${product.id}`).digest('hex').slice(0, 16)}`;
          await pgQuery(
            `INSERT INTO blueprint_product_matches
              (id, tenant_id, deconstruct_asset_id, brand_profile_id, product_id, promo_role, match_score, match_reason, matched_keywords_json, is_food_safe, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, CURRENT_TIMESTAMP)
             ON CONFLICT (tenant_id, deconstruct_asset_id, brand_profile_id, product_id)
             DO UPDATE SET promo_role = EXCLUDED.promo_role, match_score = EXCLUDED.match_score, match_reason = EXCLUDED.match_reason, updated_at = CURRENT_TIMESTAMP`,
            [rowId, tenantId, asset.id, pool.brandId, product.id, scored.promoRole, scored.score, scored.reason, JSON.stringify(scored.matchedKeywords || []), bpProfile.isFoodSafe]
          );
          inserted += 1;
        }
      }
      return { action: 'reindexed', count: inserted, promo_role: effectiveRole };
    }
  }

  return { action: 'updated', count: updRes.rowCount || 0, promo_role: effectiveRole };
}
