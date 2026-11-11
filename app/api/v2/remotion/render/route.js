import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { renderExplainerVideo } from '@/lib/remotion-engine';

const REMOTION_JOBS = globalThis.__remotionJobs || new Map();
globalThis.__remotionJobs = REMOTION_JOBS;

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      compositionId = 'GarliBeeExplainer',
      inputProps = {},
      outputFilename = null
    } = body;

    const jobId = `remotion_${Date.now()}_${uuidv4().substring(0, 8)}`;
    const finalFilename = outputFilename || `${jobId}.mp4`;
    const outputPath = path.join(process.cwd(), 'public', 'rendered', finalFilename);

    const jobInfo = {
      id: jobId,
      compositionId,
      status: 'queued',
      progress: 0,
      outputPath,
      videoUrl: `/rendered/${finalFilename}`,
      createdAt: new Date().toISOString(),
      completedAt: null,
      error: null
    };

    REMOTION_JOBS.set(jobId, jobInfo);

    // Trigger rendering asynchronously in background
    (async () => {
      try {
        jobInfo.status = 'rendering';
        await renderExplainerVideo({
          compositionId,
          inputProps,
          outputPath,
          onProgress: (percent) => {
            jobInfo.progress = percent;
          }
        });
        jobInfo.status = 'completed';
        jobInfo.progress = 100;
        jobInfo.completedAt = new Date().toISOString();
      } catch (err) {
        console.error(`[RemotionAPI] Job ${jobId} failed:`, err);
        jobInfo.status = 'failed';
        jobInfo.error = err.message || 'Unknown render error';
      }
    })();

    return NextResponse.json({
      success: true,
      jobId,
      status: 'queued',
      videoUrl: jobInfo.videoUrl
    });
  } catch (error) {
    console.error('[RemotionAPI] Render request failed:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

