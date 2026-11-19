import { withTenantContext } from '../../../../../../../lib/auth.js';
import { getProductScrapeJobStatus } from '../../../../../../../lib/product-catalog-service.js';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (_request, { params }) => {
  try {
    const { jobId } = await params;
    const statusPayload = await getProductScrapeJobStatus(jobId);

    if (!statusPayload) {
      return Response.json(
        { success: false, error: `Job scraping #${jobId} tidak ditemukan untuk tenant ini.` },
        { status: 404 }
      );
    }

    return Response.json(statusPayload);
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: error.status || 500 }
    );
  }
});
