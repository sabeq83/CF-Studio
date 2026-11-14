import { withTenantContext } from '@/lib/auth';
import { refreshReferenceAssetGeneration } from '@/lib/reference-asset-service';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (req, { params }, user) => {
  try {
    const { id } = await params;
    const result = await refreshReferenceAssetGeneration(id, user?.id || user?.email || 'user');
    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
});
