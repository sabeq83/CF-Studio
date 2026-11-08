import { pgQuery } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import { resolveActiveProductPhotoPath } from './product-reference-resolver.js';

function tenantId() {
  const id = getActiveTenantId();
  if (!id || id === '__none__') {
    const e = new Error('Tenant operasional tidak tersedia.');
    e.status = 403;
    throw e;
  }
  return id;
}

function imageUrl(row) {
  const value = resolveActiveProductPhotoPath(row);
  return value && !/^https?:\/\//.test(value)
    ? `/api/v2/products/image?path=${encodeURIComponent(value)}`
    : value;
}

export function toProductCatalogItem(row) {
  let brandLinks = Array.isArray(row.brand_links) ? row.brand_links : [];
  if (brandLinks.length === 0 && row.affiliate_link && row.affiliate_link.trim()) {
    brandLinks = [{
      brand_product_id: 'global_fallback',
      brand_profile_id: 'global',
      brand_name: 'Global Fallback',
      affiliate_link: row.affiliate_link.trim(),
      is_active: true
    }];
  }

  return {
    ...row,
    brand_links: brandLinks,
    image_url: imageUrl(row),
    completeness: {
      description: Boolean(row.product_description),
      usp: Boolean(row.unique_selling_point),
      image: Boolean(imageUrl(row)),
      target_audience: Boolean(row.target_audience),
      product_url: Boolean(row.source_url)
    }
  };
}

export async function listProductCatalog({
  search = '',
  category = '',
  affiliateStatus = 'all', // 'all' | 'multi_brand' | 'with_link' | 'without_link'
  brandId = '',
  limit = 50,
  cursor = null,
  sort = 'newest'
} = {}) {
  const currentTenantId = tenantId();
  const size = Math.min(500, Math.max(1, Number(limit) || 50));
  const params = [currentTenantId];
  const where = ['p.tenant_id = $1'];

  if (search.trim()) {
    params.push(`%${search.trim()}%`);
    where.push(`(p.product_name ILIKE $${params.length} OR p.category ILIKE $${params.length} OR p.unique_selling_point ILIKE $${params.length})`);
  }
  if (category.trim()) {
    params.push(category.trim());
    where.push(`LOWER(p.category) = LOWER($${params.length})`);
  }
  if (brandId.trim() && brandId !== 'all') {
    params.push(brandId.trim());
    where.push(`EXISTS (
      SELECT 1 FROM brand_products bp 
      WHERE bp.product_id = p.id AND bp.brand_profile_id = $${params.length} 
        AND bp.tenant_id = $1 AND bp.is_active = TRUE AND bp.affiliate_link IS NOT NULL AND bp.affiliate_link != ''
    )`);
  }

  // Filter Status Afiliasi
  if (affiliateStatus === 'multi_brand') {
    where.push(`(
      SELECT COUNT(*) FROM brand_products bp 
      WHERE bp.product_id = p.id AND bp.tenant_id = $1 AND bp.is_active = TRUE 
        AND bp.affiliate_link IS NOT NULL AND bp.affiliate_link != ''
    ) >= 2`);
  } else if (affiliateStatus === 'with_link') {
    where.push(`(
      (p.affiliate_link IS NOT NULL AND p.affiliate_link != '') OR
      EXISTS (
        SELECT 1 FROM brand_products bp 
        WHERE bp.product_id = p.id AND bp.tenant_id = $1 AND bp.is_active = TRUE 
          AND bp.affiliate_link IS NOT NULL AND bp.affiliate_link != ''
      )
    )`);
  } else if (affiliateStatus === 'without_link') {
    where.push(`(
      (p.affiliate_link IS NULL OR p.affiliate_link = '') AND
      NOT EXISTS (
        SELECT 1 FROM brand_products bp 
        WHERE bp.product_id = p.id AND bp.tenant_id = $1 AND bp.is_active = TRUE 
          AND bp.affiliate_link IS NOT NULL AND bp.affiliate_link != ''
      )
    )`);
  }

  if (cursor) {
    params.push(cursor);
    where.push(sort === 'oldest' ? `p.id > $${params.length}` : `p.id < $${params.length}`);
  }

  params.push(size + 1);
  const orderClause = sort === 'oldest' ? 'ORDER BY p.id ASC' : 'ORDER BY p.created_at DESC NULLS LAST, p.id DESC';

  const sql = `
    SELECT p.*,
      COALESCE(
        json_agg(
          json_build_object(
            'brand_product_id', bp.id,
            'brand_profile_id', bp.brand_profile_id,
            'brand_name', b.brand_name,
            'affiliate_link', bp.affiliate_link,
            'tracking_code', bp.tracking_code,
            'is_active', bp.is_active
          )
        ) FILTER (WHERE bp.id IS NOT NULL AND bp.is_active = TRUE AND bp.affiliate_link IS NOT NULL AND bp.affiliate_link != ''),
        '[]'::json
      ) AS brand_links
    FROM product_extractions p
    LEFT JOIN brand_products bp ON p.id = bp.product_id AND bp.tenant_id = $1 AND bp.is_active = TRUE
    LEFT JOIN brand_profiles b ON bp.brand_profile_id = b.id AND b.tenant_id = $1
    WHERE ${where.join(' AND ')}
    GROUP BY p.id
    ${orderClause}
    LIMIT $${params.length}
  `;

  let rows = [];
  try {
    const result = await pgQuery(sql, params);
    rows = result.rows || [];
  } catch (err) {
    console.error('[listProductCatalog Error]:', err.message);
    throw err;
  }

  const hasMore = rows.length > size;
  const data = rows.slice(0, size).map(toProductCatalogItem);

  // Hitung counter status untuk Quick Pills
  let counts = { total: 0, multi_brand: 0, with_link: 0, without_link: 0 };
  try {
    const countsResult = await pgQuery(`
      SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (
          WHERE (
            SELECT COUNT(*) FROM brand_products bp 
            WHERE bp.product_id = p.id AND bp.tenant_id = $1 AND bp.is_active = TRUE 
              AND bp.affiliate_link IS NOT NULL AND bp.affiliate_link != ''
          ) >= 2
        ) AS multi_brand,
        COUNT(*) FILTER (
          WHERE (p.affiliate_link IS NOT NULL AND p.affiliate_link != '') OR
          EXISTS (
            SELECT 1 FROM brand_products bp 
            WHERE bp.product_id = p.id AND bp.tenant_id = $1 AND bp.is_active = TRUE 
              AND bp.affiliate_link IS NOT NULL AND bp.affiliate_link != ''
          )
        ) AS with_link,
        COUNT(*) FILTER (
          WHERE (p.affiliate_link IS NULL OR p.affiliate_link = '') AND
          NOT EXISTS (
            SELECT 1 FROM brand_products bp 
            WHERE bp.product_id = p.id AND bp.tenant_id = $1 AND bp.is_active = TRUE 
              AND bp.affiliate_link IS NOT NULL AND bp.affiliate_link != ''
          )
        ) AS without_link
      FROM product_extractions p
      WHERE p.tenant_id = $1
    `, [currentTenantId]);

    if (countsResult.rows && countsResult.rows[0]) {
      const row = countsResult.rows[0];
      counts = {
        total: Number(row.total) || 0,
        multi_brand: Number(row.multi_brand) || 0,
        with_link: Number(row.with_link) || 0,
        without_link: Number(row.without_link) || 0
      };
    }
  } catch (countErr) {
    console.warn('[listProductCatalog counts warning]:', countErr.message);
  }

  return {
    data,
    pagination: {
      has_more: hasMore,
      next_cursor: hasMore ? data.at(-1)?.id : null,
      limit: size
    },
    counts
  };
}

export async function listBindingSummaries({ brandProfileId, productIds = [] }) {
  if (!brandProfileId || !productIds.length) return new Map();
  const brand = (await pgQuery('SELECT id FROM brand_profiles WHERE tenant_id=$1 AND id=$2', [tenantId(), brandProfileId])).rows[0];
  if (!brand) {
    const e = new Error('Brand Profile tidak ditemukan di tenant aktif.');
    e.status = 403;
    throw e;
  }
  const rows = (await pgQuery(`SELECT * FROM brand_products WHERE tenant_id=$1 AND brand_profile_id=$2 AND product_id=ANY($3::text[])`, [tenantId(), brandProfileId, productIds])).rows;
  return new Map(rows.map(row => [row.product_id, row]));
}
