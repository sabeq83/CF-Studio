import { NextResponse } from 'next/server.js';
import { withTenantContext } from '@/lib/auth.js';
import { 
  listPipelineJobs, 
  getPipelineQueueSummary,
  cancelPipelineJob
} from '@/lib/auto-pipeline-queue-repository.js';

export const GET = withTenantContext(async (request, _ctx, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const tenantId = user?.tenantId || user?.tenant_id || 'default_tenant';

    const [summary, jobs] = await Promise.all([
      getPipelineQueueSummary(tenantId),
      listPipelineJobs(tenantId, { status, limit })
    ]);

    return NextResponse.json({
      success: true,
      summary,
      jobs
    });
  } catch (error) {
    console.error('[API /queue] GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});

export const POST = withTenantContext(async (request, _ctx, user) => {
  try {
    const body = await request.json();
    const tenantId = user?.tenantId || user?.tenant_id || 'default_tenant';
    const { action, job_id } = body;

    if (action === 'cancel') {
      if (!job_id) {
        return NextResponse.json({ success: false, error: 'job_id wajib disertakan.' }, { status: 400 });
      }
      const cancelled = await cancelPipelineJob(tenantId, job_id);
      if (!cancelled) {
        return NextResponse.json({ success: false, error: 'Job tidak ditemukan atau sudah tidak dalam antrean.' }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: 'Job berhasil dibatalkan dari antrean.', job: cancelled });
    }

    return NextResponse.json({ success: false, error: `Aksi ${action} tidak didukung.` }, { status: 400 });
  } catch (error) {
    console.error('[API /queue] POST error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});

