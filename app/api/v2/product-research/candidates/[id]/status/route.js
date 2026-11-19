import { withProductResearchAccess } from '../../../../../../../lib/auth.js';
import { getResearchCandidatePromotionStatus } from '../../../../../../../lib/product-research-promotion-service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withProductResearchAccess(async (_request, context) => {
  try {
    const { id } = await context.params;
    const result = await getResearchCandidatePromotionStatus(id);
    return Response.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error('[Product Research Status GET Error]:', error);
    return Response.json(
      {
        success: false,
        code: error.code || 'STATUS_CHECK_FAILED',
        error: error.message || 'Gagal memeriksa status promosi kandidat.'
      },
      {
        status: error.status || 500,
        headers: { 'Cache-Control': 'no-store' }
      }
    );
  }
});
