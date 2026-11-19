import { normalizeProductUrl } from './product-url-normalizer.js';
import {
  enqueueProductScrape,
  getProductScrapeJobStatus
} from './product-catalog-service.js';
import {
  getResearchCandidateById,
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

  return {
    success: true,
    candidate,
    latest_import: latestImport,
    job_status: jobStatus,
    catalog_product: catalogProduct,
    recovery
  };
}
