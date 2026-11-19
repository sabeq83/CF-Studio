import { runOperatorRadarRoute, readJsonBody } from '../../../../../../../../lib/product-research-operator-route.js';
import { setBotCandidateUrl } from '../../../../../../../../lib/product-research-bot-service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request, context) {
  return runOperatorRadarRoute(request, 'product_research:curate', async () => {
    const { ref } = await context.params;
    const body = await readJsonBody(request);
    const candidate = await setBotCandidateUrl(decodeURIComponent(ref), body?.url, {
      telegramUserId: body?.telegram_user_id
    });
    return { success: true, candidate };
  });
}
