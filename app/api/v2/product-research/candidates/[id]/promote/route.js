import { withProductResearchAccess } from '../../../../../../../lib/auth.js';
import { promoteResearchCandidate } from '../../../../../../../lib/product-research-promotion-service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withProductResearchAccess(async (_request, context, user) => {
  try {
    const { id } = await context.params;
    const requestedBy = user?.username || user?.id || 'web_user';
    const result = await promoteResearchCandidate(id, { requestedBy });
    return Response.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error('[Product Research Promote POST Error]:', error);
    return Response.json(
      {
        success: false,
        code: error.code || 'PROMOTE_FAILED',
        error: error.message || 'Gagal mempromosikan kandidat ke Database Produk.',
        ...(error.reserved_product_id ? { reserved_product_id: error.reserved_product_id } : {})
      },
      {
        status: error.status || 500,
        headers: { 'Cache-Control': 'no-store' }
      }
    );
  }
});
