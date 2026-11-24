import { NextResponse } from 'next/server';
import { dbAll, dbRun, getMultiplierTaskById } from '@/lib/db';
import { withTenantContext } from '@/lib/auth';
import { inspectMultiplierTaskArtifacts } from '@/lib/multiplier-artifacts';

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
    const artifacts = inspectMultiplierTaskArtifacts(task, glabsTasks);

    let nextStatus = 'pending_resolution';
    if (stage === 'remaking') nextStatus = 'remaking';
    else if (stage === 't2i') nextStatus = 'generating_t2i';
    else if (stage === 'tts') nextStatus = 'generating_audio';
    else if (stage === 'visuals') nextStatus = 'generating_visuals';
    else if (stage === 'ffmpeg') {
      if (!artifacts.has_visual_clips) {
        return NextResponse.json({
          success: false,
          error: 'Klip video G-Labs belum lengkap untuk langsung menjalankan FFmpeg Muxing. Gunakan Lanjutkan / Visuals terlebih dahulu.'
        }, { status: 409 });
      }
      nextStatus = 'ffmpeg_muxing';
    } else if (stage === 'cloud') {
      if (!artifacts.has_final_video) {
        return NextResponse.json({
          success: false,
          error: 'File video master hasil FFmpeg belum ditemukan di disk; jalankan FFmpeg Muxing terlebih dahulu.'
        }, { status: 409 });
      }
      nextStatus = 'uploading_assets';
    }

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
