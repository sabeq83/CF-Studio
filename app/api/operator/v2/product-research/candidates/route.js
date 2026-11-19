import { runOperatorRadarRoute } from '../../../../../../lib/product-research-operator-route.js';
import { listBotCandidates } from '../../../../../../lib/product-research-bot-service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  return runOperatorRadarRoute(request, 'product_research:read', async () => {
    const sp = new URL(request.url).searchParams;
    const data = await listBotCandidates({
      mode: sp.get('mode') === 'list' ? 'list' : 'top',
      trend: sp.get('trend') || '',
      search: sp.get('search') || '',
      batchId: sp.get('batch_id') || '',
      limit: Number(sp.get('limit') || 10)
    });
    return { success: true, ...data };
  });
}
