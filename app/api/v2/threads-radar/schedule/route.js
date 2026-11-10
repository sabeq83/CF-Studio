import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRadarSchedule, saveRadarSchedule } from '@/lib/threads-affiliate-repository';
import { computeNextRunTime, getWibTimeContext } from '@/lib/threads-radar-scheduler';

export const dynamic = 'force-dynamic';

function getTenantId(req) {
  const user = getCurrentUser(req);
  if (user && user.tenantId && user.tenantId !== '__none__') {
    return user.tenantId;
  }
  return process.env.DEFAULT_TENANT_ID || 'default_tenant';
}

export async function GET(req) {
  try {
    const tenantId = getTenantId(req);
    const schedule = await getRadarSchedule(tenantId);
    const wibContext = getWibTimeContext();
    const nextRun = computeNextRunTime(schedule);

    return NextResponse.json({
      success: true,
      data: {
        ...schedule,
        next_run_at: nextRun ? nextRun.toISOString() : schedule.next_run_at,
        current_wib: wibContext
      }
    });
  } catch (err) {
    console.error('[API Threads Schedule GET Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const tenantId = getTenantId(req);
    const body = await req.json();

    const {
      is_active,
      schedule_mode = 'specific',
      active_days,
      specific_hours,
      interval_hours,
      range_start,
      range_end
    } = body;

    const nextRun = computeNextRunTime({
      is_active,
      schedule_mode,
      active_days,
      specific_hours,
      interval_hours,
      range_start,
      range_end
    });

    const saved = await saveRadarSchedule(tenantId, {
      is_active,
      schedule_mode,
      active_days,
      specific_hours,
      interval_hours,
      range_start,
      range_end,
      next_run_at: nextRun
    });

    return NextResponse.json({
      success: true,
      message: 'Konfigurasi jadwal radar berhasil disimpan',
      data: saved
    });
  } catch (err) {
    console.error('[API Threads Schedule POST Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

