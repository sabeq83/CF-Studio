import { runOperatorRadarRoute, readJsonBody } from '../../../../../../lib/product-research-operator-route.js';
import { mcpPromoteCandidates } from '../../../../../../lib/product-research-bot-service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  return runOperatorRadarRoute(request, 'product_research:mcp_promote', async (identity) => {
    const body = await readJsonBody(request);
    return mcpPromoteCandidates(body?.candidate_refs ?? body?.candidate_ids ?? [], {
      actor: identity.actor,
      mode: body?.mode === 'execute' ? 'execute' : 'preview'
    });
  });
}
