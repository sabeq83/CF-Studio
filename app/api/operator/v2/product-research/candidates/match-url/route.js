import { runOperatorRadarRoute } from '../../../../../../../lib/product-research-operator-route.js';
import { findRadarCandidatesByUrl } from '../../../../../../../lib/product-research-bot-service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  return runOperatorRadarRoute(request, 'product_research:read', async () => {
    const url = new URL(request.url).searchParams.get('url') || '';
    const data = await findRadarCandidatesByUrl(url);
    return { success: true, ...data };
  });
}
