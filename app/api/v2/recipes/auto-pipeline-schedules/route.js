import { NextResponse } from 'next/server';
import { withAutoPipelineAccess } from '@/lib/auth';
import {
  listAutoPipelineSchedules,
  createAutoPipelineSchedule
} from '@/lib/auto-pipeline-schedules-repository';
import { isScheduleRunning } from '@/lib/auto-pipeline-scheduler-runner';

export const GET = withAutoPipelineAccess(async (request, _ctx, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const brandId = searchParams.get('brand_id') || searchParams.get('brand');
    const pipelineType = searchParams.get('pipeline_type') || searchParams.get('type') || 'all';
    const scheduleMode = searchParams.get('schedule_mode') || 'all';
    const targetDate = searchParams.get('target_date');
    const tenantId = (!user?.tenantId || user.tenantId === '__none__') ? 'default_tenant' : user.tenantId;

    const schedules = await listAutoPipelineSchedules(tenantId, { status, brandId, pipelineType, scheduleMode, targetDate });
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

export const POST = withAutoPipelineAccess(async (request, _ctx, user) => {
  try {
    const body = await request.json().catch(() => ({}));
    const tenantId = (!user?.tenantId || user.tenantId === '__none__') ? 'default_tenant' : user.tenantId;

    // Mode khusus: Buat 4 slot kuota harian 2+2 (2 Alat Dapur + 2 Bahan Resep) per brand secara terstruktur
    if (body.action === 'setup_multiplier_2plus2_quota') {
      const brandIds = Array.isArray(body.brand_ids) && body.brand_ids.length > 0
        ? body.brand_ids
        : (body.brand_id ? [body.brand_id] : []);
      if (brandIds.length === 0) {
        return NextResponse.json({ success: false, error: 'brand_ids wajib dipilih untuk setup kuota 2+2.' }, { status: 400 });
      }

      const slots = [
        { key: 'alat_1', role: 'alat_dapur', label: 'Alat Dapur #1 (Pagi)', genTime: '04:45', pubTime: '06:15' },
        { key: 'bahan_1', role: 'bahan_resep', label: 'Bahan Resep #1 (Siang)', genTime: '10:00', pubTime: '11:30' },
        { key: 'alat_2', role: 'alat_dapur', label: 'Alat Dapur #2 (Sore)', genTime: '14:45', pubTime: '16:15' },
        { key: 'bahan_2', role: 'bahan_resep', label: 'Bahan Resep #2 (Malam)', genTime: '18:00', pubTime: '19:30' },
      ];

      const created = [];
      for (const bId of brandIds) {
        for (const slot of slots) {
          const payload = {
            name: body.prefix ? `${body.prefix} · ${slot.label}` : `Multiplier 2+2 · ${slot.label}`,
            pipeline_type: 'multiplier_campaign',
            brand_id: bId,
            preset_key: body.preset_key || 'multiplier_deconstruct_remix',
            topic_strategy: 'dynamic_ai',
            topic: `Auto Smart Match (${slot.role})`,
            category: slot.role,
            recipe_count: 1,
            generation_time: slot.genTime,
            publish_time: slot.pubTime,
            days_of_week: Array.isArray(body.days_of_week) ? body.days_of_week : [0, 1, 2, 3, 4, 5, 6],
            timezone: body.timezone || 'Asia/Jakarta',
            repliz_account_ids: Array.isArray(body.repliz_account_ids_by_brand?.[bId])
              ? body.repliz_account_ids_by_brand[bId]
              : (Array.isArray(body.repliz_account_ids) ? body.repliz_account_ids : []),
            pipeline_config_json: {
              selection_mode: 'auto_smart_match',
              target_promo_role: slot.role,
              lookback_blueprint_days: Number(body.lookback_blueprint_days || 14),
              lookback_product_days: Number(body.lookback_product_days || 4),
              bridging_mode: 'select_existing',
              product_aware_angle: true,
              ...(body.visual_identity_preset_id ? { visual_identity_preset_id: body.visual_identity_preset_id } : {}),
            },
            auto_publish_enabled: body.auto_publish_enabled === true,
            status: body.status || 'paused',
            schedule_mode: 'recurring',
            target_date: null,
          };
          const s = await createAutoPipelineSchedule(tenantId, payload);
          created.push(s);
        }
      }
      return NextResponse.json({
        success: true,
        data: created,
        count: created.length,
        message: `${created.length} jadwal kuota 2+2 (default paused/siap tinjau) berhasil dibuat.`
      }, { status: 201 });
    }

    // Mendukung Batch Creation (Array items dari modal pemilihan multiple produk/pilar)
    if (Array.isArray(body.items) && body.items.length > 0) {
      const created = [];
      for (const item of body.items) {
        if (!item.brand_id && !item.brandId) continue;
        const payload = {
          name: item.name,
          pipeline_type: item.pipeline_type || 'recipe_campaign',
          brand_id: item.brand_id || item.brandId,
          preset_key: item.preset_key || item.presetKey || 'habitfolk_6clips_quick',
          target_item_id: item.target_item_id || null,
          target_item_title: item.target_item_title || null,
          topic_strategy: item.topic_strategy || 'dynamic_ai',
          topic: item.topic || item.target_item_title || 'Konten promosi otomatis',
          category: item.category || 'makanan_utama',
          recipe_count: Number(item.recipe_count || 1),
          generation_time: item.generation_time || '05:00',
          publish_time: item.publish_time || '09:00',
          days_of_week: Array.isArray(item.days_of_week) ? item.days_of_week : [0, 1, 2, 3, 4, 5, 6],
          timezone: item.timezone || 'Asia/Jakarta',
          repliz_account_ids: Array.isArray(item.repliz_account_ids) ? item.repliz_account_ids : [],
          pipeline_config_json: item.pipeline_config_json || item.pipeline_config || {},
          auto_publish_enabled: item.auto_publish_enabled !== false,
          status: item.status || 'active',
          schedule_mode: item.schedule_mode || 'recurring',
          target_date: item.target_date || null
        };
        const s = await createAutoPipelineSchedule(tenantId, payload);
        created.push(s);
      }
      return NextResponse.json({
        success: true,
        data: created,
        count: created.length,
        message: `${created.length} jadwal baris mandiri berhasil dibuat.`
      }, { status: 201 });
    }

    // Single schedule creation fallback
    if (!body.brand_id && !body.brandId) {
      return NextResponse.json({ success: false, error: 'brand_id wajib dipilih.' }, { status: 400 });
    }

    const payload = {
      name: body.name,
      pipeline_type: body.pipeline_type || 'recipe_campaign',
      brand_id: body.brand_id || body.brandId,
      preset_key: body.preset_key || body.presetKey || 'habitfolk_6clips_quick',
      target_item_id: body.target_item_id || null,
      target_item_title: body.target_item_title || null,
      topic_strategy: body.topic_strategy || 'dynamic_ai',
      topic: body.topic || 'Resep sehat praktis harian',
      category: body.category || 'makanan_utama',
      recipe_count: Number(body.recipe_count || body.recipeCount || 1),
      generation_time: body.generation_time || body.generationTime || '05:00',
      publish_time: body.publish_time || body.publishTime || '09:00',
      days_of_week: Array.isArray(body.days_of_week) ? body.days_of_week : [0, 1, 2, 3, 4, 5, 6],
      timezone: body.timezone || 'Asia/Jakarta',
      repliz_account_ids: Array.isArray(body.repliz_account_ids) ? body.repliz_account_ids : [],
      pipeline_config_json: body.pipeline_config_json || body.pipeline_config || {},
      auto_publish_enabled: body.auto_publish_enabled !== false,
      status: body.status || 'active',
      schedule_mode: body.schedule_mode || 'recurring',
      target_date: body.target_date || null
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

