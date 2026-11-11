import { NextResponse } from 'next/server';
import { withAutoPipelineAccess } from '@/lib/auth';
import { triggerScheduleImmediatelyAsync } from '@/lib/auto-pipeline-scheduler-runner';

export const POST = withAutoPipelineAccess(async (_request, context, user) => {
  try {
    const { id } = await context.params;
    const tenantId = (!user?.tenantId || user.tenantId === '__none__') ? 'default_tenant' : user.tenantId;

    const result = await triggerScheduleImmediatelyAsync(tenantId, id);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[API Auto-Pipeline-Schedules/:id/run-now POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

