import fs from 'fs';
import path from 'path';
import { pgQuery } from './db-pg.js';
import { createJob, getDb } from './db.js';
import { getActiveTenantId } from './tenant-context.js';
import { resolveActiveProductPhotoPath } from './product-reference-resolver.js';
import { assessProductCompleteness } from './product-completeness.js';
import { normalizeProductUrl } from './product-url-normalizer.js';

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
  photoStatus = 'all', // 'all' | 'needs_review' | 'approved' | 'processing'
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
  if (photoStatus.trim() && photoStatus !== 'all') {
    params.push(photoStatus.trim());
    where.push(`p.photo_status = $${params.length}`);
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
      COALESCE((
        SELECT json_agg(
          json_build_object(
            'brand_product_id', bp.id,
            'brand_profile_id', bp.brand_profile_id,
            'brand_name', b.brand_name,
            'affiliate_link', bp.affiliate_link,
            'tracking_code', bp.tracking_code,
            'is_active', bp.is_active
          )
        )
        FROM brand_products bp
        JOIN brand_profiles b ON bp.brand_profile_id = b.id AND b.tenant_id = $1
        WHERE bp.product_id = p.id AND bp.tenant_id = $1 AND bp.is_active = TRUE
          AND bp.affiliate_link IS NOT NULL AND bp.affiliate_link != ''
      ), '[]'::json) AS brand_links
    FROM product_extractions p
    WHERE ${where.join(' AND ')}
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
  let counts = { total: 0, multi_brand: 0, with_link: 0, without_link: 0, needs_review: 0 };
  try {
    const countsResult = await pgQuery(`
      SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE p.photo_status = 'needs_review') AS needs_review,
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
        without_link: Number(row.without_link) || 0,
        needs_review: Number(row.needs_review) || 0
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

/**
 * Layanan bersama untuk memasukkan URL atau batch CSV produk ke antrean product_scraper.
 * Dipakai oleh route POST /api/v2/products/scrape dan promosi Radar Produk.
 */
export async function enqueueProductScrape({
  urls,
  csv_data,
  category,
  tags,
  repair_mode = true,
  refresh_photo = false,
  reserved_ids: suppliedReservedIds = null
} = {}, deps = {}) {
  if (!urls && !csv_data) {
    const err = new Error('Masukkan daftar URL produk atau file CSV terlebih dahulu.');
    err.status = 400;
    throw err;
  }

  const activeTenant = tenantId();
  const db = deps.db || getDb();
  const createJobFn = deps.createJobFn || createJob;
  const allProducts = await db.prepare(
    'SELECT id, input_source, source_url, raw_photo_url, clean_photo_url, cleaned_photo_url, generated_photo_url, unique_selling_point, packaging_type, t2i_prompt, i2v_action_prompt FROM product_extractions WHERE tenant_id = ?'
  ).all(activeTenant);

  const findExistingProduct = (targetUrl) => {
    const normalizedTarget = normalizeProductUrl(targetUrl);
    return allProducts.find(p =>
      normalizeProductUrl(p.input_source) === normalizedTarget ||
      normalizeProductUrl(p.source_url) === normalizedTarget
    );
  };

  const checkMissingComponents = (product) => assessProductCompleteness(product, {
    fileExists: (rel) => Boolean(rel && fs.existsSync(path.join(process.cwd(), 'public', rel)))
  });

  const urlsToScrape = [];
  let skippedCount = 0;
  let updatedCount = 0;
  let repairCount = 0;
  let newCount = 0;
  const urlAffiliatesMap = {};

  if (csv_data && Array.isArray(csv_data)) {
    const uniqueCsvRows = [];
    const seenUrls = new Set();
    for (const row of csv_data) {
      const trimmedUrl = typeof row?.url === 'string' ? row.url.trim() : '';
      if (trimmedUrl && !seenUrls.has(trimmedUrl)) {
        seenUrls.add(trimmedUrl);
        uniqueCsvRows.push({ ...row, url: trimmedUrl });
      }
    }

    if (uniqueCsvRows.length > 50) {
      const err = new Error(`Maksimal 50 URL per batch. Anda memasukkan ${uniqueCsvRows.length}.`);
      err.status = 400;
      throw err;
    }

    for (const row of uniqueCsvRows) {
      const url = row.url;
      const affiliate = row.affiliate_link ? row.affiliate_link.trim() : '';
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const existing = findExistingProduct(url);
        if (existing) {
          if (affiliate) {
            await db.prepare('UPDATE product_extractions SET affiliate_link = ? WHERE id = ? AND tenant_id = ?')
              .run(affiliate, existing.id, activeTenant);
            updatedCount++;
          }

          if (refresh_photo) {
            urlsToScrape.push(url);
            urlAffiliatesMap[url] = affiliate;
            repairCount++;
          } else if (repair_mode) {
            const comp = checkMissingComponents(existing);
            if (comp.anyMissing) {
              urlsToScrape.push(url);
              urlAffiliatesMap[url] = affiliate;
              repairCount++;
            } else {
              skippedCount++;
            }
          } else {
            skippedCount++;
          }
        } else {
          urlsToScrape.push(url);
          urlAffiliatesMap[url] = affiliate;
          newCount++;
        }
      }
    }
  } else {
    let urlList = [];
    if (Array.isArray(urls)) {
      urlList = urls.map(u => String(u || '').trim()).filter(u => u.length > 0);
    } else if (typeof urls === 'string') {
      urlList = urls
        .split('\n')
        .map(u => u.trim())
        .filter(u => u.length > 0);
    }

    if (urlList.length === 0) {
      const err = new Error('Tidak ada URL valid yang ditemukan.');
      err.status = 400;
      throw err;
    }

    const uniqueUrls = Array.from(new Set(urlList));
    if (uniqueUrls.length > 50) {
      const err = new Error(`Maksimal 50 URL per batch. Anda memasukkan ${uniqueUrls.length}.`);
      err.status = 400;
      throw err;
    }

    for (const url of uniqueUrls) {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const existing = findExistingProduct(url);
        if (existing) {
          if (refresh_photo) {
            urlsToScrape.push(url);
            repairCount++;
          } else if (repair_mode) {
            const comp = checkMissingComponents(existing);
            if (comp.anyMissing) {
              urlsToScrape.push(url);
              repairCount++;
            } else {
              skippedCount++;
            }
          } else {
            skippedCount++;
          }
        } else {
          urlsToScrape.push(url);
          newCount++;
        }
      }
    }
  }

  if (urlsToScrape.length === 0) {
    let message = '';
    if (csv_data) {
      message = `Proses selesai. ${updatedCount} link afiliasi produk diperbarui secara instan. Tidak ada produk baru atau data rumpang yang perlu di-scrape.`;
    } else {
      message = `Semua URL produk yang dimasukkan (${skippedCount}) sudah ada di database dan datanya lengkap. Scraping dilewati.`;
    }
    return {
      success: true,
      message,
      enqueued_count: 0,
      skipped_count: skippedCount,
      updated_count: updatedCount
    };
  }

  const batchSize = 20;
  let enqueuedCount = 0;
  const jobIds = [];
  const reservedIds = { ...(suppliedReservedIds && typeof suppliedReservedIds === 'object' ? suppliedReservedIds : {}) };
  let singleTargetProductId = null;

  if (urlsToScrape.length === 1) {
    const singleUrl = urlsToScrape[0];
    const existing = findExistingProduct(singleUrl);
    singleTargetProductId = reservedIds[singleUrl]
      || (existing ? existing.id : `pe_${Date.now()}_${Math.floor(Math.random() * 1000)}`);
    reservedIds[singleUrl] = singleTargetProductId;
  }

  for (let i = 0; i < urlsToScrape.length; i += batchSize) {
    const chunk = urlsToScrape.slice(i, i + batchSize);
    const created = await createJobFn('product_scraper', {
      tenant_id: activeTenant,
      urls: chunk,
      category,
      tags,
      url_affiliates_map: urlAffiliatesMap,
      repair_mode,
      refresh_photo: Boolean(refresh_photo),
      reserved_ids: reservedIds
    });
    if (created?.id) {
      jobIds.push(created.id);
    }
    enqueuedCount += chunk.length;
  }

  let message = '';
  if (newCount > 0 && repairCount > 0) {
    message = `${newCount} produk baru dan ${repairCount} produk lama (dalam proses melengkapi data) dimasukkan ke antrean scraping.`;
  } else if (newCount > 0) {
    message = `${newCount} produk baru dimasukkan ke antrean scraping.`;
  } else if (repairCount > 0) {
    message = `${repairCount} produk lama (dalam proses melengkapi data) dimasukkan ke antrean scraping.`;
  }

  if (updatedCount > 0) {
    message += ` (${updatedCount} link afiliasi langsung diperbarui).`;
  }
  if (skippedCount > 0) {
    message += ` (${skippedCount} produk dilewati karena sudah lengkap di database).`;
  }

  return {
    success: true,
    message,
    enqueued_count: enqueuedCount,
    job_ids: jobIds,
    product_id: singleTargetProductId || undefined,
    skipped_count: skippedCount,
    updated_count: updatedCount,
    new_count: newCount,
    repair_count: repairCount
  };
}

/**
 * Membaca status job product_scraper untuk tenant aktif (dipakai bersama oleh
 * GET /api/v2/products/scrape/jobs/[jobId] dan pelacakan Radar Produk).
 */
export async function getProductScrapeJobStatus(jobId, deps = {}) {
  const currentTenantId = tenantId();
  const numericId = Number(jobId);
  if (!Number.isInteger(numericId) || numericId <= 0) return null;

  let job = null;
  if (deps.db) {
    job = await deps.db.prepare('SELECT * FROM scheduler_jobs WHERE id = ?').get(numericId);
  } else {
    job = (await pgQuery('SELECT * FROM scheduler_jobs WHERE id = $1', [numericId])).rows[0] || null;
  }

  if (!job) return null;

  let parsedResult = null;
  if (job.result) {
    try {
      parsedResult = typeof job.result === 'string' ? JSON.parse(job.result) : job.result;
    } catch {}
  }

  let parsedPayload = null;
  if (job.payload) {
    try {
      parsedPayload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
    } catch {}
  }

  const payloadTenant = parsedPayload?.tenant_id;
  if (payloadTenant) {
    if (payloadTenant !== currentTenantId) return null;
  } else if (currentTenantId !== 'default_tenant') {
    return null;
  }

  const statusSummary = parsedResult?.status_summary
    || (job.status === 'completed' ? 'ok' : (job.status === 'failed' ? 'failed' : 'pending'));

  return {
    success: true,
    job_id: job.id,
    queue_name: job.queue_name,
    status: job.status,
    status_summary: statusSummary,
    urls: parsedPayload?.urls || [],
    results: parsedResult?.results || [],
    errors: parsedResult?.errors || (job.error_note ? { error: job.error_note } : {}),
    created_at: job.created_at,
    completed_at: job.completed_at
  };
}
