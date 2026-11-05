import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { runScheduleImmediately } from '@/lib/auto-pipeline-scheduler-runner';

export const POST = withTenantContext(async (_request, context, user) => {
  try {
    const { id } = await context.params;
    const tenantId = user?.tenantId || 'default_tenant';

    const result = await runScheduleImmediately(tenantId, id);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[API Auto-Pipeline-Schedules/:id/run-now POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

