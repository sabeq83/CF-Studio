import { runOperatorRadarRoute } from '../../../../../../lib/product-research-operator-route.js';
import { getBotStatusSummary } from '../../../../../../lib/product-research-bot-service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  return runOperatorRadarRoute(request, 'product_research:read', async () => {
    const data = await getBotStatusSummary();
    return { success: true, ...data };
  });
}
