import { NextResponse } from 'next/server';

const REMOTION_JOBS = globalThis.__remotionJobs || new Map();
globalThis.__remotionJobs = REMOTION_JOBS;

export async function GET(request, { params }) {
  try {
    const { jobId } = await params;
    if (!jobId) {
      return NextResponse.json({ success: false, error: 'Job ID is required' }, { status: 400 });
    }

    const job = REMOTION_JOBS.get(jobId);
    if (!job) {
      return NextResponse.json({ success: false, error: `Job ${jobId} not found` }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      job
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

