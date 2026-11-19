import { normalizeProductUrl } from './product-url-normalizer.js';
import { computeOpportunityScore } from './product-research-opportunity-score.js';
import {
  enqueueProductScrape,
  getProductScrapeJobStatus,
  getProductScraperQueueLoad,
  PRODUCT_SCRAPER_MAX_CONCURRENT
} from './product-catalog-service.js';
import {
  getResearchCandidateById,
  getResearchCandidatesByIds,
  getCandidateWeeklyHistory,
  resolveCandidateEffectiveUrl,
  isCandidateUrlBlocked,
  findCatalogDuplicatesByNormalizedUrls,
  getCatalogProductsByIds,
  claimCandidatePromotion,
  markPromotionQueued,
  markPromotionFailed,
  markPromotionLinked,
  syncCandidateProcessStatus
} from './product-research-repository.js';

export const MAX_BULK_PROMOTE_IDS = 50;

function makePromoError(message, status, code, extra = {}) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  Object.assign(err, extra);
  return err;
}

function isValidHttpUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseStudioPolishFailure(rawResponse) {
  if (!rawResponse) return null;
  let parsed = rawResponse;
  if (typeof rawResponse === 'string') {
    try {
      parsed = JSON.parse(rawResponse);
    } catch {
      return null;
    }
  }
  const sp = parsed?.studio_polish;
  if (!sp || (sp.status !== 'failed' && sp.status !== 'timeout')) return null;
  return sp;
}

/**
 * Mempromosikan 1 kandidat Radar Produk ke Database Produk (product_extractions).
 * - Menolak url_status Terdekat/Tidak ditemukan/Belum diriset tanpa pilihan listing (422)
 * - Menolak kandidat yang sudah punya cf_product_id (409)
 * - Menghubungkan jika normalized_url sudah ada di katalog tenant tanpa menimpa produk
 * - Mengklaim atomik + enqueueProductScrape() dengan reserved_product_id untuk produk baru
 */
export async function promoteResearchCandidate(candidateId, { requestedBy = null } = {}, deps = {}) {
  const candidate = await getResearchCandidateById(candidateId);
  if (!candidate) {
    throw makePromoError('Kandidat riset tidak ditemukan.', 404, 'CANDIDATE_NOT_FOUND');
  }

  if (candidate.cf_product_id) {
    throw makePromoError(
      `Kandidat sudah terhubung ke produk katalog (${candidate.cf_product_id}) dan tidak boleh di-scrape ulang.`,
      409,
      'ALREADY_IN_CATALOG'
    );
  }

  if (candidate.curation_status === 'archived') {
    throw makePromoError(
      'Kandidat berstatus arsip. Keluarkan dari arsip terlebih dahulu sebelum dimasukkan ke katalog.',
      409,
      'CANDIDATE_ARCHIVED'
    );
  }

  if (isCandidateUrlBlocked(candidate)) {
    throw makePromoError(
      'URL listing belum terverifikasi (status Terdekat/Tidak ditemukan/Belum diriset). Pilih atau tempel URL listing yang tepat terlebih dahulu.',
      422,
      'URL_VERIFICATION_REQUIRED'
    );
  }

  const effectiveUrl = resolveCandidateEffectiveUrl(candidate);
  if (!isValidHttpUrl(effectiveUrl)) {
    throw makePromoError(
      'URL listing tidak valid. Pastikan URL diawali http:// atau https://.',
      422,
      'INVALID_TARGET_URL'
    );
  }

  // Cek duplikat URL ternormalisasi di katalog tenant aktif
  const normalizedUrl = normalizeProductUrl(effectiveUrl);
  const dupMap = await findCatalogDuplicatesByNormalizedUrls([effectiveUrl]);
  const existingCatalog = normalizedUrl ? dupMap.get(normalizedUrl) : null;

  if (existingCatalog) {
    await markPromotionLinked({
      candidateId,
      cfProductId: existingCatalog.cf_product_id,
      requestedBy
    });
    const refreshed = await getResearchCandidateById(candidateId);
    return {
      success: true,
      action: 'linked',
      cf_product_id: existingCatalog.cf_product_id,
      catalog_product: existingCatalog,
      candidate: refreshed
    };
  }

  // Produk baru: klaim atomik terlebih dahulu sebelum memicu enqueue
  const claimAction = candidate.process_status === 'failed' ? 'retry' : 'promote';
  const claim = await claimCandidatePromotion({
    candidateId,
    action: claimAction,
    requestedBy
  });

  if (!claim.found) {
    throw makePromoError('Kandidat riset tidak ditemukan.', 404, 'CANDIDATE_NOT_FOUND');
  }

  if (!claim.claimed) {
    if (claim.reason === 'ALREADY_IN_CATALOG') {
      throw makePromoError('Kandidat sudah masuk katalog dan tidak boleh di-scrape ulang.', 409, 'ALREADY_IN_CATALOG');
    }
    throw makePromoError(
      'Promosi kandidat ini sudah sedang antre atau diproses.',
      409,
      'ALREADY_CLAIMED',
      { active_import: claim.activeImport || null }
    );
  }

  const enqueueFn = deps.enqueueProductScrapeFn || enqueueProductScrape;
  const targetCategory = candidate.curated_data?.category || candidate.research_data?.category || '';

  try {
    const enqueueResult = await enqueueFn({
      urls: [effectiveUrl],
      category: targetCategory,
      repair_mode: false,
      refresh_photo: false,
      reserved_ids: { [effectiveUrl]: claim.reservedProductId }
    }, deps);

    const jobId = enqueueResult?.job_ids?.[0];
    if (!jobId) {
      throw new Error(enqueueResult?.message || 'Antrean product_scraper tidak mengembalikan job_id.');
    }

    await markPromotionQueued({
      importId: claim.importRow.id,
      candidateId,
      jobId: String(jobId)
    });

    const refreshed = await getResearchCandidateById(candidateId);
    return {
      success: true,
      action: 'queued',
      job_id: String(jobId),
      reserved_product_id: claim.reservedProductId,
      candidate: refreshed
    };
  } catch (err) {
    await markPromotionFailed({
      importId: claim.importRow.id,
      candidateId,
      error: err?.message || 'Gagal memasukkan pekerjaan ke product_scraper.'
    });
    throw makePromoError(
      `Gagal mengantrekan scrape produk: ${err?.message || 'Unknown error'}`,
      err?.status && err.status >= 400 && err.status < 500 ? err.status : 502,
      'SCRAPE_ENQUEUE_FAILED',
      { reserved_product_id: claim.reservedProductId }
    );
  }
}

/**
 * Melacak status promosi kandidat dengan membaca job scheduler_jobs + keberadaan
 * aktual baris produk di product_extractions.
 */
export async function getResearchCandidatePromotionStatus(candidateId, deps = {}) {
  let candidate = await getResearchCandidateById(candidateId);
  if (!candidate) {
    throw makePromoError('Kandidat riset tidak ditemukan.', 404, 'CANDIDATE_NOT_FOUND');
  }

  const latestImport = (candidate.imports || []).find(imp =>
    ['promote', 'retry', 'link'].includes(imp.action)
  ) || null;

  const getJobFn = deps.getProductScrapeJobStatusFn || getProductScrapeJobStatus;
  const jobStatus = latestImport?.job_id
    ? await getJobFn(latestImport.job_id, deps)
    : null;

  const targetProductId = candidate.cf_product_id || latestImport?.reserved_product_id || null;
  const catalogMap = targetProductId
    ? await getCatalogProductsByIds([targetProductId])
    : new Map();
  const catalogProduct = targetProductId ? (catalogMap.get(targetProductId) || null) : null;

  let recovery = {
    needed: false,
    photo_failed: false,
    enrichment_failed: false,
    studio_polish_error: null,
    enrichment_error: null,
    cf_product_id: catalogProduct?.id || null
  };

  if (catalogProduct) {
    const studioPolishFailure = parseStudioPolishFailure(catalogProduct.raw_response);
    const photoFailed = catalogProduct.photo_status === 'failed' || Boolean(studioPolishFailure);
    const enrichmentFailed = catalogProduct.enrichment_status === 'failed';
    const nextProcessStatus = (photoFailed || enrichmentFailed) ? 'needs_review' : 'in_catalog';

    recovery = {
      needed: photoFailed || enrichmentFailed,
      photo_failed: photoFailed,
      enrichment_failed: enrichmentFailed,
      studio_polish_error: studioPolishFailure?.error || null,
      enrichment_error: catalogProduct.enrichment_error || null,
      cf_product_id: catalogProduct.id
    };

    const needsImportFinalize = latestImport && !['completed', 'linked'].includes(latestImport.status);
    if (
      candidate.process_status !== nextProcessStatus ||
      candidate.cf_product_id !== catalogProduct.id ||
      needsImportFinalize
    ) {
      await syncCandidateProcessStatus({
        candidateId,
        processStatus: nextProcessStatus,
        cfProductId: catalogProduct.id,
        importId: needsImportFinalize ? latestImport.id : null,
        importStatus: needsImportFinalize ? 'completed' : null
      });
      candidate = await getResearchCandidateById(candidateId);
    }
  } else if (jobStatus) {
    if (['running', 'processing'].includes(jobStatus.status) && candidate.process_status !== 'processing') {
      await syncCandidateProcessStatus({
        candidateId,
        processStatus: 'processing',
        importId: latestImport?.id || null,
        importStatus: 'processing'
      });
      candidate = await getResearchCandidateById(candidateId);
    } else if (
      jobStatus.status === 'failed' ||
      (jobStatus.status === 'completed' && !catalogProduct)
    ) {
      const errorText = jobStatus.errors && Object.keys(jobStatus.errors).length > 0
        ? Object.values(jobStatus.errors).join('; ')
        : 'Job scraper selesai namun produk belum terbentuk di katalog.';

      if (candidate.process_status !== 'failed' || (latestImport && latestImport.status !== 'failed')) {
        await syncCandidateProcessStatus({
          candidateId,
          processStatus: 'failed',
          importId: latestImport?.id || null,
          importStatus: 'failed',
          error: errorText
        });
        candidate = await getResearchCandidateById(candidateId);
      }
    }
  }

  const effectiveUrl = resolveCandidateEffectiveUrl(candidate);
  const [dupMap, weeklyHistory] = await Promise.all([
    (!candidate.cf_product_id && effectiveUrl)
      ? findCatalogDuplicatesByNormalizedUrls([effectiveUrl])
      : Promise.resolve(new Map()),
    getCandidateWeeklyHistory(candidate)
  ]);

  const enrichedCandidate = {
    ...candidate,
    effective_url: effectiveUrl,
    url_blocked: isCandidateUrlBlocked(candidate),
    duplicate_match: candidate.effective_normalized_url
      ? (dupMap.get(candidate.effective_normalized_url) || null)
      : null,
    catalog_product: catalogProduct,
    opportunity_score: computeOpportunityScore(candidate),
    weekly_history: weeklyHistory,
    thumb_api_url: candidate.thumb_path ? `/api/v2/product-research/candidates/${candidate.id}/image?kind=thumb` : null,
    screenshot_api_url: candidate.screenshot_path ? `/api/v2/product-research/candidates/${candidate.id}/image?kind=screenshot` : null
  };

  return {
    success: true,
    candidate: enrichedCandidate,
    latest_import: latestImport,
    job_status: jobStatus,
    catalog_product: catalogProduct,
    recovery
  };
}

function getCandidateLabel(c) {
  return c?.curated_data?.name || c?.research_data?.name || c?.external_candidate_id || c?.id || 'Kandidat';
}

export function classifyResearchCandidateForPromotion(candidate, duplicateMap) {
  if (!candidate) {
    return { bucket: 'not_found', reason: 'Kandidat tidak ditemukan pada tenant ini.' };
  }
  if (candidate.cf_product_id || candidate.process_status === 'in_catalog') {
    return {
      bucket: 'blocked',
      reason: `Sudah terhubung ke katalog (${candidate.cf_product_id || 'aktif'})`
    };
  }
  if (candidate.curation_status === 'archived') {
    return { bucket: 'blocked', reason: 'Kandidat diarsipkan — keluarkan dari arsip dulu' };
  }
  if (candidate.process_status === 'queued' || candidate.process_status === 'processing') {
    return {
      bucket: 'blocked',
      reason: `Sedang berada di antrean atau diproses (${candidate.process_status})`
    };
  }
  if (isCandidateUrlBlocked(candidate)) {
    return {
      bucket: 'blocked',
      reason: candidate.url_status === 'nearest'
        ? 'Status URL Terdekat — belum memilih listing'
        : 'URL listing belum tersedia'
    };
  }

  const effectiveUrl = resolveCandidateEffectiveUrl(candidate);
  if (!isValidHttpUrl(effectiveUrl)) {
    return {
      bucket: 'blocked',
      reason: 'URL listing tidak valid (harus http/https)'
    };
  }

  const normUrl = normalizeProductUrl(effectiveUrl);
  const dup = normUrl && duplicateMap ? duplicateMap.get(normUrl) : null;
  if (dup) {
    return {
      bucket: 'duplicate',
      reason: `URL sudah ada di katalog (${dup.cf_product_id}) — akan dihubungkan tanpa menimpa produk`,
      effective_url: effectiveUrl,
      duplicate_match: dup
    };
  }

  return {
    bucket: 'valid',
    reason: 'Siap masuk antrean product_scraper',
    effective_url: effectiveUrl
  };
}

function normalizeBulkIds(candidateIds) {
  if (!Array.isArray(candidateIds)) {
    throw makePromoError('candidate_ids wajib berupa array.', 400, 'INVALID_BULK_IDS');
  }
  const uniqueIds = Array.from(new Set(candidateIds.map(id => String(id || '').trim()).filter(Boolean)));
  if (uniqueIds.length === 0) {
    throw makePromoError('Pilih minimal 1 kandidat untuk diproses.', 400, 'EMPTY_BULK_IDS');
  }
  if (uniqueIds.length > MAX_BULK_PROMOTE_IDS) {
    throw makePromoError(
      `Maksimal ${MAX_BULK_PROMOTE_IDS} kandidat per proses bulk approval (diterima ${uniqueIds.length}).`,
      400,
      'BULK_LIMIT_EXCEEDED'
    );
  }
  return uniqueIds;
}

/**
 * Mengklasifikasikan daftar kandidat pilihan ke dalam 3 kelompok:
 * Valid (scrape baru), Duplikat (hubungkan), dan Tertahan (tidak ikut terkirim).
 */
export async function previewBulkResearchPromotion(candidateIds = [], deps = {}) {
  const uniqueIds = normalizeBulkIds(candidateIds);
  const foundRows = await getResearchCandidatesByIds(uniqueIds);
  const byId = new Map(foundRows.map(r => [r.id, r]));

  const urlsToCheck = [];
  for (const id of uniqueIds) {
    const c = byId.get(id);
    if (c && !c.cf_product_id && !isCandidateUrlBlocked(c)) {
      const u = resolveCandidateEffectiveUrl(c);
      if (isValidHttpUrl(u)) urlsToCheck.push(u);
    }
  }

  const duplicateMap = await findCatalogDuplicatesByNormalizedUrls(urlsToCheck);
  const getQueueLoadFn = deps.getProductScraperQueueLoadFn || getProductScraperQueueLoad;
  const queueLoad = await getQueueLoadFn().catch(() => ({
    queue_name: 'product_scraper',
    max_concurrent: PRODUCT_SCRAPER_MAX_CONCURRENT,
    running: 0,
    pending: 0
  }));

  const validItems = [];
  const duplicateItems = [];
  const blockedItems = [];
  const notFoundIds = [];

  for (const id of uniqueIds) {
    const candidate = byId.get(id) || null;
    const cls = classifyResearchCandidateForPromotion(candidate, duplicateMap);
    if (cls.bucket === 'not_found') {
      notFoundIds.push(id);
      blockedItems.push({
        id,
        name: id,
        url_status: null,
        process_status: null,
        reason: cls.reason
      });
    } else if (cls.bucket === 'blocked') {
      blockedItems.push({
        id: candidate.id,
        name: getCandidateLabel(candidate),
        url_status: candidate.url_status,
        process_status: candidate.process_status,
        effective_url: resolveCandidateEffectiveUrl(candidate),
        reason: cls.reason
      });
    } else if (cls.bucket === 'duplicate') {
      duplicateItems.push({
        id: candidate.id,
        name: getCandidateLabel(candidate),
        url_status: candidate.url_status,
        effective_url: cls.effective_url,
        duplicate_match: cls.duplicate_match,
        reason: cls.reason
      });
    } else {
      validItems.push({
        id: candidate.id,
        name: getCandidateLabel(candidate),
        url_status: candidate.url_status,
        effective_url: cls.effective_url,
        reason: cls.reason
      });
    }
  }

  return {
    success: true,
    mode: 'preview',
    queue_concurrency: PRODUCT_SCRAPER_MAX_CONCURRENT,
    queue_load: queueLoad,
    summary: {
      requested: uniqueIds.length,
      valid_count: validItems.length,
      duplicate_count: duplicateItems.length,
      blocked_count: blockedItems.length,
      not_found_count: notFoundIds.length
    },
    valid_items: validItems,
    duplicate_items: duplicateItems,
    blocked_items: blockedItems,
    not_found_ids: notFoundIds
  };
}

/**
 * Mengeksekusi Bulk Approval dengan memanggil ulang promoteResearchCandidate (Tahap 5)
 * untuk setiap kandidat valid & duplikat secara atomik.
 * Kandidat tertahan tidak pernah dikirim ke antrean.
 */
export async function promoteResearchCandidatesBulk(candidateIds = [], { requestedBy = null } = {}, deps = {}) {
  const preview = await previewBulkResearchPromotion(candidateIds, deps);
  const promoteOneFn = deps.promoteResearchCandidateFn || promoteResearchCandidate;

  const results = [];
  let queued = 0;
  let linked = 0;
  const skippedBlocked = preview.blocked_items.length;
  let conflicts = 0;
  let failed = 0;

  for (const b of preview.blocked_items) {
    results.push({
      candidate_id: b.id,
      name: b.name,
      status: 'skipped_blocked',
      reason: b.reason
    });
  }

  const executableTargets = [...preview.duplicate_items, ...preview.valid_items];
  for (const item of executableTargets) {
    try {
      const res = await promoteOneFn(item.id, { requestedBy }, deps);
      if (res.action === 'linked') {
        linked += 1;
        results.push({
          candidate_id: item.id,
          name: item.name,
          status: 'linked',
          cf_product_id: res.cf_product_id
        });
      } else {
        queued += 1;
        results.push({
          candidate_id: item.id,
          name: item.name,
          status: 'queued',
          job_id: res.job_id,
          reserved_product_id: res.reserved_product_id
        });
      }
    } catch (err) {
      if (err?.status === 409) {
        conflicts += 1;
        results.push({
          candidate_id: item.id,
          name: item.name,
          status: 'conflict',
          code: err.code || 'CONFLICT',
          error: err.message
        });
      } else {
        failed += 1;
        results.push({
          candidate_id: item.id,
          name: item.name,
          status: 'failed',
          code: err?.code || 'PROMOTE_FAILED',
          error: err?.message || 'Gagal mempromosikan kandidat.',
          ...(err?.reserved_product_id ? { reserved_product_id: err.reserved_product_id } : {})
        });
      }
    }
  }

  const getQueueLoadFn = deps.getProductScraperQueueLoadFn || getProductScraperQueueLoad;
  const queueLoadAfter = await getQueueLoadFn().catch(() => preview.queue_load);

  return {
    success: true,
    mode: 'execute',
    queue_concurrency: PRODUCT_SCRAPER_MAX_CONCURRENT,
    queue_load: queueLoadAfter,
    summary: {
      requested: preview.summary.requested,
      queued,
      linked,
      skipped_blocked: skippedBlocked,
      conflicts,
      failed
    },
    results
  };
}
