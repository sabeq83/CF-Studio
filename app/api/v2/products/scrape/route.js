import { withTenantContext } from '../../../../../lib/auth.js';
import { enqueueProductScrape } from '../../../../../lib/product-catalog-service.js';

export const dynamic = 'force-dynamic';

export const POST = withTenantContext(async (req) => {
  try {
    const body = await req.json();
    const result = await enqueueProductScrape(body);
    return Response.json(result);
  } catch (error) {
    if (error.status && error.status < 500) {
      return Response.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Scrape API Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
