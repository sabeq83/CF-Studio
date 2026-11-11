import { NextResponse } from 'next/server';
import { withAutoPipelineAccess } from '@/lib/auth';
import {
  getAutoPipelineScheduleById,
  updateAutoPipelineSchedule,
  togglePauseSchedule,
  archiveSchedule,
  deleteSchedule
} from '@/lib/auto-pipeline-schedules-repository';

export const GET = withAutoPipelineAccess(async (_request, context, user) => {
  try {
    const { id } = await context.params;
    const tenantId = (!user?.tenantId || user.tenantId === '__none__') ? 'default_tenant' : user.tenantId;

    const schedule = await getAutoPipelineScheduleById(tenantId, id);
    if (!schedule) {
      return NextResponse.json({ success: false, error: 'Jadwal tidak ditemukan.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: schedule });
  } catch (error) {
    console.error('[API Auto-Pipeline-Schedules/:id GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const PUT = withAutoPipelineAccess(async (request, context, user) => {
  try {
    const { id } = await context.params;
    const tenantId = (!user?.tenantId || user.tenantId === '__none__') ? 'default_tenant' : user.tenantId;
    const body = await request.json().catch(() => ({}));

    // Tangani aksi cepat: toggle_pause atau archive
    if (body.action === 'toggle_pause') {
      const updated = await togglePauseSchedule(tenantId, id);
      return NextResponse.json({
        success: true,
        data: updated,
        message: `Status jadwal berhasil diubah menjadi ${updated.status}.`
      });
    }

    if (body.action === 'archive') {
      const updated = await archiveSchedule(tenantId, id);
      return NextResponse.json({
        success: true,
        data: updated,
        message: 'Jadwal berhasil diarsipkan.'
      });
    }

    const updated = await updateAutoPipelineSchedule(tenantId, id, body);
    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Jadwal Auto Pipeline berhasil diperbarui.'
    });
  } catch (error) {
    console.error('[API Auto-Pipeline-Schedules/:id PUT Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const DELETE = withAutoPipelineAccess(async (_request, context, user) => {
  try {
    const { id } = await context.params;
    const tenantId = (!user?.tenantId || user.tenantId === '__none__') ? 'default_tenant' : user.tenantId;

    await deleteSchedule(tenantId, id);
    return NextResponse.json({
      success: true,
      message: 'Jadwal berhasil dihapus.'
    });
  } catch (error) {
    console.error('[API Auto-Pipeline-Schedules/:id DELETE Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

