import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import {
  listAutoPipelineSchedules,
  createAutoPipelineSchedule
} from '@/lib/auto-pipeline-schedules-repository';
import { isScheduleRunning } from '@/lib/auto-pipeline-scheduler-runner';

export const GET = withTenantContext(async (request, _ctx, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const brandId = searchParams.get('brand_id') || searchParams.get('brand');
    const tenantId = user?.tenantId || 'default_tenant';

    const schedules = await listAutoPipelineSchedules(tenantId, { status, brandId });
    const enriched = (schedules || []).map(s => ({
      ...s,
      is_running: isScheduleRunning(s.id)
    }));
    return NextResponse.json({
      success: true,
      data: enriched,
      total: enriched.length
    });
  } catch (error) {
    console.error('[API Auto-Pipeline-Schedules GET Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = withTenantContext(async (request, _ctx, user) => {
  try {
    const body = await request.json().catch(() => ({}));
    const tenantId = user?.tenantId || 'default_tenant';

    if (!body.brand_id && !body.brandId) {
      return NextResponse.json({ success: false, error: 'brand_id wajib dipilih.' }, { status: 400 });
    }

    const payload = {
      name: body.name,
      brand_id: body.brand_id || body.brandId,
      preset_key: body.preset_key || body.presetKey || 'habitfolk_6clips_quick',
      topic_strategy: body.topic_strategy || 'dynamic_ai',
      topic: body.topic || 'Resep sehat praktis harian',
      category: body.category || 'makanan_utama',
      recipe_count: Number(body.recipe_count || body.recipeCount || 1),
      generation_time: body.generation_time || body.generationTime || '05:00',
      publish_time: body.publish_time || body.publishTime || '09:00',
      days_of_week: Array.isArray(body.days_of_week) ? body.days_of_week : [0, 1, 2, 3, 4, 5, 6],
      timezone: body.timezone || 'Asia/Jakarta',
      repliz_account_ids: Array.isArray(body.repliz_account_ids) ? body.repliz_account_ids : [],
      auto_publish_enabled: body.auto_publish_enabled !== false,
      status: body.status || 'active'
    };

    const newSchedule = await createAutoPipelineSchedule(tenantId, payload);
    return NextResponse.json({
      success: true,
      data: newSchedule,
      message: 'Jadwal Auto Pipeline berhasil dibuat.'
    }, { status: 201 });
  } catch (error) {
    console.error('[API Auto-Pipeline-Schedules POST Error]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

