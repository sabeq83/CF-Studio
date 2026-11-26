import { pgQuery } from './db-pg.js';
import { resolveActiveProductPhotoPath } from './product-photo-policy.js';

/**
 * Mengambil ID tenant default untuk halaman katalog publik /aff tanpa token.
 */
export function resolvePublicAffiliateTenantId() {
  return String(process.env.PUBLIC_AFFILIATE_TENANT_ID || 'default_tenant').trim() || 'default_tenant';
}

/**
 * Membentuk URL thumbnail publik dari path foto produk aktif.
 */
export function resolvePublicThumbnailUrl(row) {
  const value = resolveActiveProductPhotoPath(row);
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `/api/public/affiliate-catalog/image?path=${encodeURIComponent(value)}`;
}

/**
 * Memetakan baris query menjadi DTO publik aman (tanpa field internal seperti product_truth atau notes).
 */
export function toPublicAffiliateCatalogItem(row) {
  return {
    id: `${row.product_id}__${row.brand_profile_id}`,
    product_id: row.product_id,
    product_name: row.product_name,
    brand_id: row.brand_profile_id,
    brand_name: row.brand_name,
    affiliate_link: String(row.affiliate_link || '').trim(),
    thumbnail_url: resolvePublicThumbnailUrl(row)
  };
}

/**
 * Mengambil daftar Brand Profile dan item katalog affiliate (1 item = 1 produk + 1 brand aktif)
 * secara read-only untuk halaman publik /aff tanpa login.
 */
export async function listPublicAffiliateCatalog(
  { brandId = '', search = '' } = {},
  { query = pgQuery, tenantId = resolvePublicAffiliateTenantId() } = {}
) {
  const brandResult = await query(
    `
      SELECT
        b.id,
        b.brand_name,
        COUNT(DISTINCT CASE
          WHEN bp.is_active = TRUE
            AND bp.affiliate_link IS NOT NULL
            AND BTRIM(bp.affiliate_link) != ''
            AND p.id IS NOT NULL
          THEN bp.product_id
          ELSE NULL
        END)::int AS product_count
      FROM brand_profiles b
      LEFT JOIN brand_products bp
        ON bp.brand_profile_id = b.id
       AND bp.tenant_id = b.tenant_id
      LEFT JOIN product_extractions p
        ON p.id = bp.product_id
       AND p.tenant_id = b.tenant_id
      WHERE b.tenant_id = $1
      GROUP BY b.id, b.brand_name
      ORDER BY b.brand_name ASC
    `,
    [tenantId]
  );

  const brands = (brandResult.rows || []).map((row) => ({
    id: row.id,
    brand_name: row.brand_name,
    product_count: Number(row.product_count) || 0
  }));

  const totalProductsAllBrands = brands.reduce((sum, brand) => sum + brand.product_count, 0);

  const requestedBrand = String(brandId || '').trim();
  let selectedBrandId = 'all';
  if (requestedBrand === 'all') {
    selectedBrandId = 'all';
  } else if (requestedBrand && brands.some((b) => b.id === requestedBrand)) {
    selectedBrandId = requestedBrand;
  } else if (brands.length > 0) {
    const firstWithProducts = brands.find((b) => b.product_count > 0);
    selectedBrandId = (firstWithProducts || brands[0]).id;
  }

  const params = [tenantId];
  const where = [
    'bp.tenant_id = $1',
    'bp.is_active = TRUE',
    'bp.affiliate_link IS NOT NULL',
    "BTRIM(bp.affiliate_link) != ''"
  ];

  if (selectedBrandId && selectedBrandId !== 'all') {
    params.push(selectedBrandId);
    where.push(`bp.brand_profile_id = $${params.length}`);
  }

  const cleanSearch = String(search || '').trim();
  if (cleanSearch) {
    params.push(`%${cleanSearch}%`);
    where.push(
      `COALESCE(NULLIF(BTRIM(bp.product_name_override), ''), p.product_name) ILIKE $${params.length}`
    );
  }

  const itemsResult = await query(
    `
      SELECT
        p.id AS product_id,
        COALESCE(NULLIF(BTRIM(bp.product_name_override), ''), p.product_name) AS product_name,
        p.active_photo,
        p.clean_photo_url,
        p.cleaned_photo_url,
        p.generated_photo_url,
        p.raw_photo_url,
        p.photo_url,
        bp.brand_profile_id,
        b.brand_name,
        BTRIM(bp.affiliate_link) AS affiliate_link
      FROM brand_products bp
      INNER JOIN brand_profiles b
        ON b.id = bp.brand_profile_id
       AND b.tenant_id = bp.tenant_id
      INNER JOIN product_extractions p
        ON p.id = bp.product_id
       AND p.tenant_id = bp.tenant_id
      WHERE ${where.join(' AND ')}
      ORDER BY LOWER(COALESCE(NULLIF(BTRIM(bp.product_name_override), ''), p.product_name)) ASC,
               LOWER(b.brand_name) ASC
    `,
    params
  );

  return {
    brands,
    selected_brand_id: selectedBrandId,
    total_count: totalProductsAllBrands,
    items: (itemsResult.rows || []).map(toPublicAffiliateCatalogItem)
  };
}

/**
 * Memastikan file foto lokal yang diminta endpoint publik hanya berasal dari tenant publik aktif.
 */
export async function isProductPhotoAllowedForTenant(
  cleanPath,
  { tenantId = resolvePublicAffiliateTenantId(), query = pgQuery } = {}
) {
  if (!cleanPath || typeof cleanPath !== 'string') return false;
  const tenantSafeId = String(tenantId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!tenantSafeId) return false;

  if (cleanPath.startsWith(`${tenantSafeId}/`)) {
    return true;
  }

  const candidates = [
    cleanPath,
    `/${cleanPath}`,
    `uploads/products/${cleanPath}`,
    `/uploads/products/${cleanPath}`,
    `public/uploads/products/${cleanPath}`
  ];

  const result = await query(
    `
      SELECT 1
      FROM product_extractions
      WHERE tenant_id = $1
        AND (
          raw_photo_url = ANY($2::text[])
          OR clean_photo_url = ANY($2::text[])
          OR cleaned_photo_url = ANY($2::text[])
          OR generated_photo_url = ANY($2::text[])
          OR photo_url = ANY($2::text[])
        )
      LIMIT 1
    `,
    [tenantId, candidates]
  );

  return (result.rows || []).length > 0;
}
