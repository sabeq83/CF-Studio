import { authenticateOperator, runAsOperatorTenant } from '../../../../../../lib/operator-auth.js';
import {
  parseResearchIngestRequest,
  ingestProductResearchBatch
} from '../../../../../../lib/product-research-ingest-service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const identity = await authenticateOperator(request, 'product_research:ingest');
    const parsed = await parseResearchIngestRequest(request);

    const result = await runAsOperatorTenant(identity, async () => {
      return await ingestProductResearchBatch(parsed);
    });

    return Response.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error('[Operator Product Research Batches POST Error]:', error);
    const status = error.status || 500;
    const isClientError = status < 500;
    return Response.json(
      {
        success: false,
        code: error.code || 'PRODUCT_RESEARCH_INGEST_FAILED',
        error: isClientError ? error.message : 'Gagal memproses ingest batch Radar Produk.'
      },
      {
        status,
        headers: { 'Cache-Control': 'no-store' }
      }
    );
  }
}
