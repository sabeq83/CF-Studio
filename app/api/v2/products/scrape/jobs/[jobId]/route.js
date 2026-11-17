import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { getActiveTenantId } from '@/lib/tenant-context';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = withTenantContext(async (request, { params }) => {
  try {
    const { jobId } = await params;
    const tenantId = getActiveTenantId();
    const db = getDb();

    const job = await db.prepare(`
      SELECT * FROM scheduler_jobs 
      WHERE id = ? AND (tenant_id = ? OR tenant_id = 'default_tenant' OR tenant_id IS NULL)
    `).get(jobId, tenantId);

    if (!job) {
      return NextResponse.json(
        { success: false, error: `Job scraping #${jobId} tidak ditemukan untuk tenant ini.` },
        { status: 404 }
      );
    }

    let parsedResult = null;
    if (job.result) {
      try {
        parsedResult = typeof job.result === 'string' ? JSON.parse(job.result) : job.result;
      } catch (_) {}
    }

    let parsedPayload = null;
    if (job.payload) {
      try {
        parsedPayload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
      } catch (_) {}
    }

    const statusSummary = parsedResult?.status_summary || 
      (job.status === 'completed' ? 'ok' : (job.status === 'failed' ? 'failed' : 'pending'));

    return NextResponse.json({
      success: true,
      job_id: job.id,
      queue_name: job.queue_name,
      status: job.status,
      status_summary: statusSummary,
      urls: parsedPayload?.urls || [],
      results: parsedResult?.results || [],
      errors: parsedResult?.errors || (job.error_note ? { error: job.error_note } : {}),
      created_at: job.created_at,
      completed_at: job.completed_at
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status || 500 }
    );
  }
});
