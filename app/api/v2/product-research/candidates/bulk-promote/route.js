import { withProductResearchAccess } from '../../../../../../lib/auth.js';
import {
  previewBulkResearchPromotion,
  promoteResearchCandidatesBulk
} from '../../../../../../lib/product-research-promotion-service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withProductResearchAccess(async (request, _context, user) => {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { success: false, code: 'INVALID_JSON', error: 'Body JSON tidak valid.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const candidateIds = body?.candidate_ids ?? body?.candidateIds ?? [];
    const mode = body?.mode === 'execute' ? 'execute' : 'preview';
    const requestedBy = user?.username || user?.id || 'web_user';

    const result = mode === 'execute'
      ? await promoteResearchCandidatesBulk(candidateIds, { requestedBy })
      : await previewBulkResearchPromotion(candidateIds);

    return Response.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error('[Product Research Bulk Promote POST Error]:', error);
    return Response.json(
      {
        success: false,
        code: error.code || 'BULK_PROMOTE_FAILED',
        error: error.message || 'Gagal memproses bulk approval Radar Produk.'
      },
      {
        status: error.status || 500,
        headers: { 'Cache-Control': 'no-store' }
      }
    );
  }
});
