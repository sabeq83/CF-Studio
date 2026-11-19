import { runOperatorRadarRoute } from '../../../../../../../lib/product-research-operator-route.js';
import { getBotCandidateDetail } from '../../../../../../../lib/product-research-bot-service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request, context) {
  return runOperatorRadarRoute(request, 'product_research:read', async () => {
    const { ref } = await context.params;
    const detail = await getBotCandidateDetail(decodeURIComponent(ref));
    return { success: true, ...detail };
  });
}
