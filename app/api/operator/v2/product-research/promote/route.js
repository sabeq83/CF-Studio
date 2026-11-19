import { runOperatorRadarRoute, readJsonBody } from '../../../../../../lib/product-research-operator-route.js';
import { botPromoteCandidates } from '../../../../../../lib/product-research-bot-service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  return runOperatorRadarRoute(request, 'product_research:promote', async () => {
    const body = await readJsonBody(request);
    return botPromoteCandidates(body?.candidate_refs ?? body?.candidate_ids ?? [], {
      telegramUserId: body?.telegram_user_id,
      mode: body?.mode === 'execute' ? 'execute' : 'preview'
    });
  });
}
