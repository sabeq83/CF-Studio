import { NextResponse } from 'next/server';
import { dbAll, dbRun, getMultiplierTaskById } from '@/lib/db';
import { withTenantContext } from '@/lib/auth';
import { resolveMultiplierStageRetryTarget } from '@/lib/multiplier-artifacts';

export const POST = withTenantContext(async (req, { params }) => {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const body = await req.json();
    const { stage } = body;

    const task = await getMultiplierTaskById(id);
    if (!task) {
      return NextResponse.json({ success: false, error: 'Task tidak ditemukan' }, { status: 404 });
    }

    const glabsTasks = await dbAll('SELECT task_id, status, video_url FROM glabs_tasks WHERE campaign_id = ? ORDER BY item_id ASC', [id]);
    const target = resolveMultiplierStageRetryTarget(task, stage, glabsTasks);
    if (!target.ok) {
      return NextResponse.json({ success: false, error: target.error }, { status: target.statusCode || 400 });
    }
    const nextStatus = target.nextStatus;

    if (nextStatus === 'ffmpeg_muxing') {
      await dbRun(`
        UPDATE re_multiplier_tasks
        SET status = ?, error_message = NULL, failed_stage = NULL, ffmpeg_output_path = NULL
        WHERE id = ?
      `, [nextStatus, id]);
    } else {
      await dbRun(`
        UPDATE re_multiplier_tasks
        SET status = ?, error_message = NULL, failed_stage = NULL
        WHERE id = ?
      `, [nextStatus, id]);
    }

    return NextResponse.json({
      success: true,
      resumed_stage: nextStatus,
      message: `Tahapan ${stage} berhasil ditrigger ulang.`
    });

  } catch (error) {
    console.error('[Retry API Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});
