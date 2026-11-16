import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { resolveFinishingSource } from '@/lib/video-studio-finishing-source';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const videoSourceType = searchParams.get('video_source_type');
    const rawVideoPath = searchParams.get('video_path');

    if (!videoSourceType || !rawVideoPath) {
      return NextResponse.json({
        success: false,
        error: 'Parameter video_source_type dan video_path wajib disertakan'
      }, { status: 400 });
    }

    const db = getDb();
    const result = await resolveFinishingSource({
      videoSourceType,
      videoPath: rawVideoPath,
      db
    });

    if (!result.success && !result.conflict) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Finishing Source API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
