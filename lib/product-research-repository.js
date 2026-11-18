import crypto from 'crypto';
import { pgQuery, withPgTransaction } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import { normalizeProductUrl } from './product-url-normalizer.js';

export const URL_STATUSES = Object.freeze([
  'official',
  'listing',
  'nearest',
  'not_found',
  'user',
  'not_researched'
]);

export const CURATION_STATUSES = Object.freeze([
  'new',
  'needs_info',
  'ready',
  'archived'
]);

export const PROCESS_STATUSES = Object.freeze([
  'not_sent',
  'queued',
  'processing',
  'in_catalog',
  'needs_review',
  'failed'
]);

export const BLOCKED_URL_STATUSES = new Set(['nearest', 'not_found', 'not_researched']);
const URL_STATUS_SET = new Set(URL_STATUSES);
const CURATION_STATUS_SET = new Set(CURATION_STATUSES);
const PROCESS_STATUS_SET = new Set(PROCESS_STATUSES);
const IMPORT_ACTION_SET = new Set(['promote', 'link', 'archive', 'retry']);

function activeTenantId() {
  const tenantId = getActiveTenantId();
  if (!tenantId || tenantId === '__none__') {
    const error = new Error('Tenant operasional tidak tersedia.');
    error.status = 403;
    throw error;
  }
  return tenantId;
}

function makeConflictError(message, code = 'CONFLICT') {
  const error = new Error(message);
  error.status = 409;
  error.code = code;
  return error;
}

function makeValidationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export function resolveCandidateEffectiveUrl(candidate) {
  if (!candidate) return '';
  const targetUrl = candidate.curated_data?.target_url;
  if (typeof targetUrl === 'string' && targetUrl.trim()) {
    return targetUrl.trim();
  }
  if (typeof candidate.source_url === 'string' && candidate.source_url.trim()) {
    return candidate.source_url.trim();
  }
  return '';
}

export function isCandidateUrlBlocked(candidate) {
  if (!candidate) return true;
  const targetUrl = typeof candidate.curated_data?.target_url === 'string'
    ? candidate.curated_data.target_url.trim()
    : '';
  if (targetUrl) return false;
  return BLOCKED_URL_STATUSES.has(candidate.url_status);
}

/**
 * Upsert batch riset produk untuk tenant aktif berdasarkan (tenant_id, source, external_batch_id).
 */
export async function upsertResearchBatch({
  source = 'teleradar',
  externalBatchId,
  observedAt = null,
  metadata = {}
} = {}) {
  const tenantId = activeTenantId();
  const extBatch = String(externalBatchId || '').trim();
  if (!extBatch) {
    throw makeValidationError('external_batch_id wajib diisi.');
  }

  const normalizedSource = String(source || 'teleradar').trim() || 'teleradar';
  const id = `prb_${crypto.randomUUID()}`;

  const res = await pgQuery(
    `INSERT INTO product_research_batches (
       id, tenant_id, source, external_batch_id, observed_at, synced_at, metadata
     ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6::jsonb)
     ON CONFLICT (tenant_id, source, external_batch_id) DO UPDATE SET
       observed_at = COALESCE(EXCLUDED.observed_at, product_research_batches.observed_at),
       synced_at = CURRENT_TIMESTAMP,
       metadata = EXCLUDED.metadata,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *, (xmax = 0) AS inserted`,
    [
      id,
      tenantId,
      normalizedSource,
      extBatch,
      observedAt || null,
      JSON.stringify(metadata || {})
    ]
  );

  return res.rows[0];
}

export async function listResearchBatches({ source = null, limit = 50 } = {}) {
  const tenantId = activeTenantId();
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
  const params = [tenantId];
  const where = ['b.tenant_id = $1'];

  if (source && String(source).trim()) {
    params.push(String(source).trim());
    where.push(`b.source = $${params.length}`);
  }
  params.push(safeLimit);

  const res = await pgQuery(
    `SELECT
       b.*,
       COUNT(c.id)::int AS candidate_count
     FROM product_research_batches b
     LEFT JOIN product_research_candidates c
       ON c.batch_id = b.id AND c.tenant_id = b.tenant_id
     WHERE ${where.join(' AND ')}
     GROUP BY b.id
     ORDER BY COALESCE(b.observed_at, b.synced_at) DESC, b.synced_at DESC
     LIMIT $${params.length}`,
    params
  );

  return res.rows;
}

export async function getResearchBatchById(batchId) {
  const tenantId = activeTenantId();
  const res = await pgQuery(
    'SELECT * FROM product_research_batches WHERE id = $1 AND tenant_id = $2',
    [batchId, tenantId]
  );
  return res.rows[0] || null;
}

/**
 * Upsert idempotent daftar kandidat dalam satu batch.
 * Pada sinkron ulang, hanya research_data (dan aset/URL non-manual) yang diperbarui;
 * curated_data, curation_status, process_status, cf_product_id, dan revision TIDAK pernah ditimpa.
 */
export async function upsertResearchCandidates(batchId, candidatesInput = []) {
  const tenantId = activeTenantId();
  if (!batchId) {
    throw makeValidationError('batch_id wajib diisi.');
  }
  if (!Array.isArray(candidatesInput)) {
    throw makeValidationError('Daftar kandidat harus berupa array.');
  }

  return withPgTransaction(async (client) => {
    const batchRes = await client.query(
      'SELECT id FROM product_research_batches WHERE id = $1 AND tenant_id = $2',
      [batchId, tenantId]
    );
    if (!batchRes.rows[0]) {
      const error = new Error('Batch riset tidak ditemukan pada tenant ini.');
      error.status = 404;
      throw error;
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const results = [];

    for (const item of candidatesInput) {
      const extCandId = String(item?.external_candidate_id || item?.externalCandidateId || '').trim();
      if (!extCandId) {
        skipped += 1;
        results.push({
          external_candidate_id: null,
          status: 'skipped',
          reason: 'external_candidate_id kosong'
        });
        continue;
      }

      const rawUrlStatus = String(item?.url_status || item?.urlStatus || 'not_researched').trim();
      const urlStatus = URL_STATUS_SET.has(rawUrlStatus) ? rawUrlStatus : 'not_researched';
      const sourceUrl = item?.source_url ?? item?.sourceUrl ?? null;
      const normalizedUrl = sourceUrl ? normalizeProductUrl(String(sourceUrl)) : '';
      const initialCurationStatus = BLOCKED_URL_STATUSES.has(urlStatus) ? 'needs_info' : 'new';
      const researchData = item?.research_data ?? item?.researchData ?? {};
      const screenshotPath = item?.screenshot_path ?? item?.screenshotPath ?? null;
      const thumbPath = item?.thumb_path ?? item?.thumbPath ?? null;
      const candidateId = `prc_${crypto.randomUUID()}`;

      const upsertRes = await client.query(
        `INSERT INTO product_research_candidates (
           id, tenant_id, batch_id, external_candidate_id,
           research_data, curated_data,
           source_url, url_status, normalized_url,
           screenshot_path, thumb_path,
           curation_status, process_status
         ) VALUES (
           $1, $2, $3, $4,
           $5::jsonb, '{}'::jsonb,
           $6, $7, $8,
           $9, $10,
           $11, 'not_sent'
         )
         ON CONFLICT (tenant_id, batch_id, external_candidate_id) DO UPDATE SET
           research_data = EXCLUDED.research_data,
           source_url = CASE
             WHEN product_research_candidates.url_status = 'user'
               THEN product_research_candidates.source_url
             ELSE EXCLUDED.source_url
           END,
           url_status = CASE
             WHEN product_research_candidates.url_status = 'user'
               THEN product_research_candidates.url_status
             ELSE EXCLUDED.url_status
           END,
           normalized_url = CASE
             WHEN product_research_candidates.url_status = 'user'
               THEN product_research_candidates.normalized_url
             ELSE EXCLUDED.normalized_url
           END,
           screenshot_path = COALESCE(EXCLUDED.screenshot_path, product_research_candidates.screenshot_path),
           thumb_path = COALESCE(EXCLUDED.thumb_path, product_research_candidates.thumb_path),
           updated_at = CURRENT_TIMESTAMP
         RETURNING id, external_candidate_id, (xmax = 0) AS inserted`,
        [
          candidateId,
          tenantId,
          batchId,
          extCandId,
          JSON.stringify(researchData || {}),
          sourceUrl ? String(sourceUrl).trim() : null,
          urlStatus,
          normalizedUrl || null,
          screenshotPath,
          thumbPath,
          initialCurationStatus
        ]
      );

      const saved = upsertRes.rows[0];
      if (saved.inserted) {
        created += 1;
      } else {
        updated += 1;
      }
      results.push({
        external_candidate_id: saved.external_candidate_id,
        candidate_id: saved.id,
        status: saved.inserted ? 'created' : 'updated'
      });
    }

    return {
      batch_id: batchId,
      total: candidatesInput.length,
      created,
      updated,
      skipped,
      results
    };
  });
}

export async function listResearchCandidates({
  batchId = '',
  category = '',
  trend = '',
  urlStatus = '',
  curationStatus = '',
  processStatus = '',
  search = '',
  page = 1,
  limit = 25
} = {}) {
  const tenantId = activeTenantId();
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const offset = (safePage - 1) * safeLimit;

  const params = [tenantId];
  const where = ['c.tenant_id = $1'];

  if (batchId && batchId !== 'all') {
    params.push(batchId);
    where.push(`c.batch_id = $${params.length}`);
  }
  if (category && category !== 'all') {
    params.push(category);
    where.push(`LOWER(COALESCE(NULLIF(c.curated_data->>'category', ''), c.research_data->>'category', '')) = LOWER($${params.length})`);
  }
  if (trend && trend !== 'all') {
    params.push(trend);
    where.push(`LOWER(COALESCE(c.research_data->>'trend', '')) = LOWER($${params.length})`);
  }
  if (urlStatus && urlStatus !== 'all') {
    params.push(urlStatus);
    where.push(`c.url_status = $${params.length}`);
  }
  if (curationStatus && curationStatus !== 'all') {
    params.push(curationStatus);
    where.push(`c.curation_status = $${params.length}`);
  }
  if (processStatus && processStatus !== 'all') {
    params.push(processStatus);
    where.push(`c.process_status = $${params.length}`);
  }
  if (search && String(search).trim()) {
    params.push(`%${String(search).trim()}%`);
    const p = `$${params.length}`;
    where.push(`(
      COALESCE(c.curated_data->>'name', '') ILIKE ${p}
      OR COALESCE(c.research_data->>'name', '') ILIKE ${p}
      OR COALESCE(c.curated_data->>'brand', '') ILIKE ${p}
      OR COALESCE(c.research_data->>'brand', '') ILIKE ${p}
      OR COALESCE(c.research_data->>'trend_note', '') ILIKE ${p}
    )`);
  }

  const whereSql = where.join(' AND ');
  const countRes = await pgQuery(
    `SELECT COUNT(*)::int AS total
     FROM product_research_candidates c
     WHERE ${whereSql}`,
    params
  );
  const total = countRes.rows[0]?.total || 0;

  const listParams = [...params, safeLimit, offset];
  const rowsRes = await pgQuery(
    `SELECT
       c.*,
       b.source AS batch_source,
       b.external_batch_id,
       b.observed_at,
       b.synced_at
     FROM product_research_candidates c
     INNER JOIN product_research_batches b
       ON b.id = c.batch_id AND b.tenant_id = c.tenant_id
     WHERE ${whereSql}
     ORDER BY
       COALESCE((c.research_data->>'rank')::int, 999999) ASC,
       c.created_at DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  // Ringkasan KPI untuk batch terpilih (selalu terisolasi tenant_id)
  const summaryParams = [tenantId];
  const summaryWhere = ['tenant_id = $1'];
  if (batchId && batchId !== 'all') {
    summaryParams.push(batchId);
    summaryWhere.push(`batch_id = $${summaryParams.length}`);
  }
  const summaryRes = await pgQuery(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE LOWER(COALESCE(research_data->>'trend', '')) = 'up')::int AS trend_up,
       COUNT(*) FILTER (WHERE LOWER(COALESCE(research_data->>'trend', '')) = 'stable')::int AS trend_stable,
       COUNT(*) FILTER (WHERE LOWER(COALESCE(research_data->>'trend', '')) = 'down')::int AS trend_down,
       COUNT(*) FILTER (WHERE url_status = 'official')::int AS url_official,
       COUNT(*) FILTER (WHERE url_status = 'listing')::int AS url_listing,
       COUNT(*) FILTER (WHERE url_status = 'nearest')::int AS url_nearest,
       COUNT(*) FILTER (WHERE url_status = 'not_found')::int AS url_not_found,
       COUNT(*) FILTER (WHERE url_status = 'user')::int AS url_user,
       COUNT(*) FILTER (WHERE url_status = 'not_researched')::int AS url_not_researched,
       COUNT(*) FILTER (WHERE process_status = 'not_sent')::int AS process_not_sent,
       COUNT(*) FILTER (WHERE process_status = 'queued')::int AS process_queued,
       COUNT(*) FILTER (WHERE process_status = 'processing')::int AS process_processing,
       COUNT(*) FILTER (WHERE process_status = 'in_catalog')::int AS process_in_catalog,
       COUNT(*) FILTER (WHERE process_status = 'needs_review')::int AS process_needs_review,
       COUNT(*) FILTER (WHERE process_status = 'failed')::int AS process_failed
     FROM product_research_candidates
     WHERE ${summaryWhere.join(' AND ')}`,
    summaryParams
  );

  return {
    items: rowsRes.rows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit))
    },
    summary: summaryRes.rows[0] || {}
  };
}

export async function getResearchCandidateById(candidateId) {
  const tenantId = activeTenantId();
  const candRes = await pgQuery(
    `SELECT
       c.*,
       b.source AS batch_source,
       b.external_batch_id,
       b.observed_at,
       b.synced_at
     FROM product_research_candidates c
     INNER JOIN product_research_batches b
       ON b.id = c.batch_id AND b.tenant_id = c.tenant_id
     WHERE c.id = $1 AND c.tenant_id = $2`,
    [candidateId, tenantId]
  );

  const candidate = candRes.rows[0];
  if (!candidate) return null;

  const importsRes = await pgQuery(
    `SELECT *
     FROM product_research_imports
     WHERE candidate_id = $1 AND tenant_id = $2
     ORDER BY created_at DESC
     LIMIT 30`,
    [candidateId, tenantId]
  );

  const effectiveUrl = resolveCandidateEffectiveUrl(candidate);
  return {
    ...candidate,
    effective_url: effectiveUrl,
    effective_normalized_url: normalizeProductUrl(effectiveUrl),
    imports: importsRes.rows
  };
}

/**
 * Memperbarui edit kurator (curated_data, curation_status, target_url) dengan pengecekan revision.
 */
export async function updateResearchCandidateCuration(candidateId, {
  curatedData = null,
  curationStatus = null,
  targetUrl = undefined,
  urlStatus = null,
  expectedRevision = null
} = {}) {
  const tenantId = activeTenantId();

  return withPgTransaction(async (client) => {
    const curRes = await client.query(
      'SELECT * FROM product_research_candidates WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
      [candidateId, tenantId]
    );
    const existing = curRes.rows[0];
    if (!existing) return null;

    if (expectedRevision !== null && expectedRevision !== undefined) {
      if (Number(existing.revision) !== Number(expectedRevision)) {
        throw makeConflictError(
          `Data kandidat telah diperbarui (revisi saat ini ${existing.revision}, dikirim ${expectedRevision}). Muat ulang sebelum menyimpan.`,
          'REVISION_CONFLICT'
        );
      }
    }

    const nextCuratedData = {
      ...(existing.curated_data || {}),
      ...(curatedData && typeof curatedData === 'object' ? curatedData : {})
    };

    let nextUrlStatus = existing.url_status;
    let nextNormalizedUrl = existing.normalized_url;

    if (targetUrl !== undefined) {
      const trimmedUrl = targetUrl === null ? '' : String(targetUrl).trim();
      nextCuratedData.target_url = trimmedUrl;
      if (trimmedUrl) {
        nextNormalizedUrl = normalizeProductUrl(trimmedUrl);
        nextUrlStatus = urlStatus && URL_STATUS_SET.has(urlStatus) ? urlStatus : 'user';
      } else {
        nextNormalizedUrl = existing.source_url ? normalizeProductUrl(existing.source_url) : null;
        if (urlStatus && URL_STATUS_SET.has(urlStatus)) {
          nextUrlStatus = urlStatus;
        }
      }
    } else if (urlStatus !== null && urlStatus !== undefined) {
      if (!URL_STATUS_SET.has(urlStatus)) {
        throw makeValidationError(`url_status tidak valid: ${urlStatus}`);
      }
      nextUrlStatus = urlStatus;
    }

    let nextCurationStatus = existing.curation_status;
    if (curationStatus !== null && curationStatus !== undefined) {
      if (!CURATION_STATUS_SET.has(curationStatus)) {
        throw makeValidationError(`curation_status tidak valid: ${curationStatus}`);
      }
      nextCurationStatus = curationStatus;
    }

    const updatedRes = await client.query(
      `UPDATE product_research_candidates
       SET curated_data = $1::jsonb,
           url_status = $2,
           normalized_url = $3,
           curation_status = $4,
           revision = revision + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND tenant_id = $6
       RETURNING *`,
      [
        JSON.stringify(nextCuratedData),
        nextUrlStatus,
        nextNormalizedUrl,
        nextCurationStatus,
        candidateId,
        tenantId
      ]
    );

    return updatedRes.rows[0];
  });
}

export async function archiveResearchCandidate(candidateId, { archived = true, requestedBy = null } = {}) {
  const tenantId = activeTenantId();

  return withPgTransaction(async (client) => {
    const nextStatus = archived ? 'archived' : 'new';
    const updRes = await client.query(
      `UPDATE product_research_candidates
       SET curation_status = $1,
           revision = revision + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [nextStatus, candidateId, tenantId]
    );
    const candidate = updRes.rows[0];
    if (!candidate) return null;

    await client.query(
      `INSERT INTO product_research_imports (
         id, tenant_id, candidate_id, action, requested_by, status
       ) VALUES ($1, $2, $3, 'archive', $4, 'completed')`,
      [`pri_${crypto.randomUUID()}`, tenantId, candidateId, requestedBy]
    );

    return candidate;
  });
}

/**
 * Klaim atomik promosi kandidat.
 * Memanfaatkan partial unique index (tenant_id, candidate_id) WHERE status IN ('claimed','queued','processing')
 * agar klik ganda atau request paralel tidak bisa membuat dua job scrape.
 * Jika sebelumnya gagal, retry memakai ulang reserved_product_id yang sama.
 */
export async function claimCandidatePromotion({
  candidateId,
  action = 'promote',
  requestedBy = null,
  generateReservedProductId = null
} = {}) {
  const tenantId = activeTenantId();
  if (!IMPORT_ACTION_SET.has(action)) {
    throw makeValidationError(`action tidak valid: ${action}`);
  }

  return withPgTransaction(async (client) => {
    const candRes = await client.query(
      'SELECT * FROM product_research_candidates WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
      [candidateId, tenantId]
    );
    const candidate = candRes.rows[0];
    if (!candidate) {
      return { found: false, claimed: false };
    }

    if (candidate.cf_product_id) {
      return {
        found: true,
        claimed: false,
        conflict: true,
        reason: 'ALREADY_IN_CATALOG',
        candidate
      };
    }

    const prevFailedRes = await client.query(
      `SELECT reserved_product_id
       FROM product_research_imports
       WHERE tenant_id = $1
         AND candidate_id = $2
         AND status = 'failed'
         AND reserved_product_id IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [tenantId, candidateId]
    );

    const reservedProductId = prevFailedRes.rows[0]?.reserved_product_id
      || (typeof generateReservedProductId === 'function'
        ? generateReservedProductId()
        : `pe_${Date.now()}_${crypto.randomInt(100, 999)}`);

    const importId = `pri_${crypto.randomUUID()}`;

    await client.query('SAVEPOINT claim_promo_insert');
    try {
      const insertRes = await client.query(
        `INSERT INTO product_research_imports (
           id, tenant_id, candidate_id, action, requested_by, reserved_product_id, status
         ) VALUES ($1, $2, $3, $4, $5, $6, 'claimed')
         RETURNING *`,
        [importId, tenantId, candidateId, action, requestedBy, reservedProductId]
      );
      await client.query('RELEASE SAVEPOINT claim_promo_insert');

      return {
        found: true,
        claimed: true,
        conflict: false,
        candidate,
        importRow: insertRes.rows[0],
        reservedProductId
      };
    } catch (err) {
      if (err?.code === '23505') {
        await client.query('ROLLBACK TO SAVEPOINT claim_promo_insert');
        const activeRes = await client.query(
          `SELECT *
           FROM product_research_imports
           WHERE tenant_id = $1
             AND candidate_id = $2
             AND status IN ('claimed', 'queued', 'processing')
           ORDER BY created_at DESC
           LIMIT 1`,
          [tenantId, candidateId]
        );
        return {
          found: true,
          claimed: false,
          conflict: true,
          reason: 'ALREADY_CLAIMED',
          candidate,
          activeImport: activeRes.rows[0] || null
        };
      }
      throw err;
    }
  });
}

export async function markPromotionQueued({ importId, candidateId, jobId }) {
  const tenantId = activeTenantId();
  return withPgTransaction(async (client) => {
    const impRes = await client.query(
      `UPDATE product_research_imports
       SET status = 'queued',
           job_id = $1,
           error = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [jobId, importId, tenantId]
    );
    const candRes = await client.query(
      `UPDATE product_research_candidates
       SET process_status = 'queued',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [candidateId, tenantId]
    );
    return {
      importRow: impRes.rows[0] || null,
      candidate: candRes.rows[0] || null
    };
  });
}

export async function markPromotionFailed({ importId, candidateId, error }) {
  const tenantId = activeTenantId();
  const errorText = String(error || 'Enqueue gagal').slice(0, 1000);
  return withPgTransaction(async (client) => {
    const impRes = await client.query(
      `UPDATE product_research_imports
       SET status = 'failed',
           error = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [errorText, importId, tenantId]
    );
    const candRes = await client.query(
      `UPDATE product_research_candidates
       SET process_status = 'failed',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [candidateId, tenantId]
    );
    return {
      importRow: impRes.rows[0] || null,
      candidate: candRes.rows[0] || null
    };
  });
}

export async function markPromotionLinked({ candidateId, cfProductId, requestedBy = null }) {
  const tenantId = activeTenantId();
  if (!cfProductId) {
    throw makeValidationError('cf_product_id wajib diisi untuk menautkan produk.');
  }
  return withPgTransaction(async (client) => {
    const candRes = await client.query(
      `UPDATE product_research_candidates
       SET cf_product_id = $1,
           process_status = 'in_catalog',
           revision = revision + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [cfProductId, candidateId, tenantId]
    );
    const candidate = candRes.rows[0];
    if (!candidate) return null;

    const impRes = await client.query(
      `INSERT INTO product_research_imports (
         id, tenant_id, candidate_id, action, requested_by, reserved_product_id, status
       ) VALUES ($1, $2, $3, 'link', $4, $5, 'linked')
       RETURNING *`,
      [`pri_${crypto.randomUUID()}`, tenantId, candidateId, requestedBy, cfProductId]
    );

    return {
      candidate,
      importRow: impRes.rows[0]
    };
  });
}

export async function syncCandidateProcessStatus({
  candidateId,
  processStatus,
  cfProductId = undefined,
  importId = null,
  importStatus = null,
  error = null
}) {
  const tenantId = activeTenantId();
  if (!PROCESS_STATUS_SET.has(processStatus)) {
    throw makeValidationError(`process_status tidak valid: ${processStatus}`);
  }

  return withPgTransaction(async (client) => {
    const sets = ['process_status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const params = [processStatus];

    if (cfProductId !== undefined) {
      params.push(cfProductId);
      sets.push(`cf_product_id = $${params.length}`);
    }
    params.push(candidateId, tenantId);

    const candRes = await client.query(
      `UPDATE product_research_candidates
       SET ${sets.join(', ')}
       WHERE id = $${params.length - 1} AND tenant_id = $${params.length}
       RETURNING *`,
      params
    );

    let importRow = null;
    if (importId && importStatus) {
      const impRes = await client.query(
        `UPDATE product_research_imports
         SET status = $1,
             error = COALESCE($2, error),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND tenant_id = $4
         RETURNING *`,
        [importStatus, error, importId, tenantId]
      );
      importRow = impRes.rows[0] || null;
    }

    return {
      candidate: candRes.rows[0] || null,
      importRow
    };
  });
}
