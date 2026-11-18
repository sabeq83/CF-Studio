import { withProductResearchAccess } from '../../../../../lib/auth.js';
import { normalizeProductUrl } from '../../../../../lib/product-url-normalizer.js';
import {
  listResearchBatches,
  listResearchCategories,
  listResearchCandidates,
  resolveCandidateEffectiveUrl,
  isCandidateUrlBlocked,
  findCatalogDuplicatesByNormalizedUrls,
  getCatalogProductsByIds
} from '../../../../../lib/product-research-repository.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function enrichCandidateRow(item, duplicateMap, catalogMap) {
  const effectiveUrl = resolveCandidateEffectiveUrl(item);
  const effectiveNormalizedUrl = normalizeProductUrl(effectiveUrl);
  const duplicateMatch = (!item.cf_product_id && effectiveNormalizedUrl)
    ? (duplicateMap.get(effectiveNormalizedUrl) || null)
    : null;
  const catalogProduct = item.cf_product_id
    ? (catalogMap.get(item.cf_product_id) || null)
    : null;

  return {
    ...item,
    effective_url: effectiveUrl,
    effective_normalized_url: effectiveNormalizedUrl,
    url_blocked: isCandidateUrlBlocked(item),
    duplicate_match: duplicateMatch,
    catalog_product: catalogProduct,
    thumb_api_url: item.thumb_path ? `/api/v2/product-research/candidates/${item.id}/image?kind=thumb` : null,
    screenshot_api_url: item.screenshot_path ? `/api/v2/product-research/candidates/${item.id}/image?kind=screenshot` : null
  };
}

export const GET = withProductResearchAccess(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batch_id') || '';
    const category = searchParams.get('category') || '';
    const trend = searchParams.get('trend') || '';
    const urlStatus = searchParams.get('url_status') || '';
    const curationStatus = searchParams.get('curation_status') || '';
    const processStatus = searchParams.get('process_status') || '';
    const search = searchParams.get('search') || '';
    const page = Number(searchParams.get('page') || 1);
    const limit = Number(searchParams.get('limit') || 25);

    const batches = await listResearchBatches({ limit: 50 });
    const effectiveBatchId = batchId === 'all'
      ? 'all'
      : (batchId || batches[0]?.id || '');

    const [result, categories] = await Promise.all([
      listResearchCandidates({
        batchId: effectiveBatchId,
        category,
        trend,
        urlStatus,
        curationStatus,
        processStatus,
        search,
        page,
        limit
      }),
      listResearchCategories({ batchId: effectiveBatchId })
    ]);

    const urlsToCheck = result.items
      .filter(item => !item.cf_product_id)
      .map(item => resolveCandidateEffectiveUrl(item))
      .filter(Boolean);
    const productIdsToFetch = result.items
      .map(item => item.cf_product_id)
      .filter(Boolean);

    const [duplicateMap, catalogMap] = await Promise.all([
      findCatalogDuplicatesByNormalizedUrls(urlsToCheck),
      getCatalogProductsByIds(productIdsToFetch)
    ]);

    const items = result.items.map(item => enrichCandidateRow(item, duplicateMap, catalogMap));

    return Response.json({
      success: true,
      batches,
      active_batch_id: effectiveBatchId,
      categories,
      items,
      pagination: result.pagination,
      summary: result.summary
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error('[Product Research Candidates GET Error]:', error);
    return Response.json(
      { success: false, error: error.message || 'Gagal memuat kandidat Radar Produk.' },
      { status: error.status || 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
});
