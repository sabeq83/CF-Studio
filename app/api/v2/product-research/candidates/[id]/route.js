import { withProductResearchAccess } from '../../../../../../lib/auth.js';
import {
  getResearchCandidateById,
  updateResearchCandidateCuration,
  resolveCandidateEffectiveUrl,
  isCandidateUrlBlocked,
  findCatalogDuplicatesByNormalizedUrls,
  getCatalogProductsByIds
} from '../../../../../../lib/product-research-repository.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function buildCandidateDetailResponse(candidate) {
  const effectiveUrl = resolveCandidateEffectiveUrl(candidate);
  const [dupMap, catMap] = await Promise.all([
    (!candidate.cf_product_id && effectiveUrl)
      ? findCatalogDuplicatesByNormalizedUrls([effectiveUrl])
      : Promise.resolve(new Map()),
    candidate.cf_product_id
      ? getCatalogProductsByIds([candidate.cf_product_id])
      : Promise.resolve(new Map())
  ]);

  return {
    ...candidate,
    effective_url: effectiveUrl,
    url_blocked: isCandidateUrlBlocked(candidate),
    duplicate_match: candidate.effective_normalized_url
      ? (dupMap.get(candidate.effective_normalized_url) || null)
      : null,
    catalog_product: candidate.cf_product_id
      ? (catMap.get(candidate.cf_product_id) || null)
      : null,
    thumb_api_url: candidate.thumb_path ? `/api/v2/product-research/candidates/${candidate.id}/image?kind=thumb` : null,
    screenshot_api_url: candidate.screenshot_path ? `/api/v2/product-research/candidates/${candidate.id}/image?kind=screenshot` : null
  };
}

function validateOptionalHttpUrl(rawUrl) {
  if (rawUrl === undefined || rawUrl === null) return undefined;
  const trimmed = String(rawUrl).trim();
  if (!trimmed) return '';
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    const err = new Error('Format URL listing tidak valid.');
    err.status = 400;
    throw err;
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    const err = new Error('URL listing wajib menggunakan http:// atau https://.');
    err.status = 400;
    throw err;
  }
  return trimmed;
}

export const GET = withProductResearchAccess(async (_request, context) => {
  try {
    const { id } = await context.params;
    const candidate = await getResearchCandidateById(id);
    if (!candidate) {
      return Response.json(
        { success: false, error: 'Kandidat riset tidak ditemukan.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const detail = await buildCandidateDetailResponse(candidate);
    return Response.json({ success: true, candidate: detail }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error('[Product Research Candidate GET Error]:', error);
    return Response.json(
      { success: false, error: error.message || 'Gagal memuat detail kandidat.' },
      { status: error.status || 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
});

export const PATCH = withProductResearchAccess(async (request, context) => {
  try {
    const { id } = await context.params;
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { success: false, error: 'Body JSON tidak valid.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const validatedTargetUrl = validateOptionalHttpUrl(body.target_url);
    const expectedRevision = body.expected_revision ?? body.revision ?? null;

    const updated = await updateResearchCandidateCuration(id, {
      curatedData: body.curated_data ?? body.curatedData ?? null,
      curationStatus: body.curation_status ?? body.curationStatus ?? null,
      targetUrl: validatedTargetUrl,
      urlStatus: body.url_status ?? body.urlStatus ?? null,
      expectedRevision
    });

    if (!updated) {
      return Response.json(
        { success: false, error: 'Kandidat riset tidak ditemukan.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const refreshed = await getResearchCandidateById(id);
    const detail = await buildCandidateDetailResponse(refreshed);
    return Response.json({ success: true, candidate: detail }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error('[Product Research Candidate PATCH Error]:', error);
    return Response.json(
      {
        success: false,
        code: error.code || 'UPDATE_FAILED',
        error: error.message || 'Gagal menyimpan perubahan kurasi.'
      },
      { status: error.status || 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
});
