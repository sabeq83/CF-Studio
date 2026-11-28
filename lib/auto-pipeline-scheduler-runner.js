/**
 * Auto Pipeline Scheduler Runner
 * Manages autonomous cron cycles for Recipe Pipelines and Auto-Dispatching to Repliz Publishing.
 */

import { pgQuery } from './db-pg.js';
import { 
  executeAutonomousRecipePipeline,
  executeAutonomousProductPipeline,
  executeAutonomousEditorialPipeline,
  executeAutonomousMultiplierPipeline,
  executeAutonomousRecipeLabsPipeline
} from './autonomous-engine.js';
import { schedulePublishingJobs } from './publishing-service.js';
import { tenantContext } from './tenant-context.js';
import { 
  listAutoPipelineSchedules, 
  getAutoPipelineScheduleById,
  updateScheduleExecutionStatus 
} from './auto-pipeline-schedules-repository.js';
import { 
  enqueuePipelineJob, 
  updatePipelineJobStatus 
} from './auto-pipeline-queue-repository.js';
import {
  maybeEmitReplizReadyDigest,
  notifyAutoPipelineDispatchFailed,
  notifyAutoPipelineProductionFailed,
  notifyAutoPipelineProductionReady
} from './brand-notification-service.js';

let isTickRunning = false;

/**
 * Adds offsetDays to a YYYY-MM-DD calendar date string in UTC calendar space.
 */
export function addDaysToDateStr(dateStr, offsetDays = 0) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr).trim().slice(0, 10))) return null;
  const [y, m, d] = String(dateStr).trim().slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + Number(offsetDays || 0)));
  return dt.toISOString().slice(0, 10);
}

function getTimezonePartsMap(dateObj, timeZone = 'Asia/Jakarta') {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(dateObj);
  const map = {};
  parts.forEach(p => { map[p.type] = p.value; });
  if (map.hour === '24') map.hour = '00';
  return map;
}

/**
 * Converts a calendar date + HH:mm in an arbitrary IANA timeZone to a UTC Date instance.
 */
export function zonedDateTimeToUtcDate(dateStr, timeStr = '09:00', timeZone = 'Asia/Jakarta') {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const desiredUtcMs = Date.UTC(y, m - 1, d, hh, mm, 0);

  let guessMs = desiredUtcMs;
  for (let i = 0; i < 2; i++) {
    const p = getTimezonePartsMap(new Date(guessMs), timeZone);
    const renderedUtcMs = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
      Number(p.second || 0)
    );
    const diff = desiredUtcMs - renderedUtcMs;
    if (diff === 0) break;
    guessMs += diff;
  }
  return new Date(guessMs);
}

/**
 * Gets formatted date and time in a specific timezone.
 */
function getNowInTimezone(timeZone = 'Asia/Jakarta') {
  const now = new Date();
  const map = getTimezonePartsMap(now, timeZone);

  const dateStr = `${map.year}-${map.month}-${map.day}`;
  const timeStr = `${map.hour}:${map.minute}`;

  const [y, m, d] = dateStr.split('-').map(Number);
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

  return { dateStr, timeStr, dayOfWeek, fullDate: now };
}

/**
 * Calculates scheduled_at ISO string given publish time, timezone, and separate publish/generation date or offset.
 * Supports both object options and legacy 3-argument positional signature (publishTimeStr, timeZone, targetDateStr).
 */
export function computeTargetPublishIso(arg1 = {}, legacyTimeZone = 'Asia/Jakarta', legacyTargetDateStr = null) {
  const opts = (typeof arg1 === 'object' && arg1 !== null)
    ? arg1
    : {
        publishTimeStr: arg1 || '09:00',
        timeZone: legacyTimeZone || 'Asia/Jakarta',
        publishDateStr: legacyTargetDateStr || null,
        generationDateStr: null,
        publishDayOffset: 0
      };

  const publishTimeStr = opts.publishTimeStr || '09:00';
  const timeZone = opts.timeZone || 'Asia/Jakarta';
  const publishDateStr = opts.publishDateStr ? String(opts.publishDateStr).slice(0, 10) : null;
  const generationDateStr = opts.generationDateStr ? String(opts.generationDateStr).slice(0, 10) : null;
  const publishDayOffset = Number(opts.publishDayOffset || 0);
  const now = opts.now instanceof Date ? opts.now : new Date();

  let dateBase = publishDateStr;
  if (!dateBase && generationDateStr) {
    dateBase = addDaysToDateStr(generationDateStr, publishDayOffset);
  }
  if (!dateBase) {
    const { dateStr: todayInTz } = getNowInTimezone(timeZone);
    dateBase = addDaysToDateStr(todayInTz, publishDayOffset);
  }

  const targetDateLocal = zonedDateTimeToUtcDate(dateBase, publishTimeStr, timeZone);

  // Jika waktu target sudah terlewat, jadwalkan 15 menit dari sekarang
  if (targetDateLocal.getTime() <= now.getTime()) {
    return new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  }

  return targetDateLocal.toISOString();
}

/**
 * Resolves the Repliz scheduled_at ISO string for a schedule row,
 * honoring publish_date, generation date + publish_day_offset, and run-now on H-1.
 */
export function resolveSchedulePublishIso(row = {}, now = new Date()) {
  const publishDateStr = row.publish_date ? String(row.publish_date).slice(0, 10) : null;
  const schedMode = row.schedule_mode || 'recurring';
  const targetDateStr = row.target_date ? String(row.target_date).slice(0, 10) : null;
  const lastRunTargetDateStr = row.last_run_target_date ? String(row.last_run_target_date).slice(0, 10) : null;
  const generationDateStr = schedMode === 'specific_date'
    ? (targetDateStr || lastRunTargetDateStr)
    : (lastRunTargetDateStr || targetDateStr);
  const publishDayOffset = Number(row.publish_day_offset || 0);

  return computeTargetPublishIso({
    publishTimeStr: row.publish_time || '09:00',
    timeZone: row.timezone || 'Asia/Jakarta',
    publishDateStr,
    generationDateStr,
    publishDayOffset,
    now
  });
}

/**
 * Ekstrak override mode audio/VO dari pipeline_config schedule agar berlaku seragam
 * ke seluruh runner autonomous (product, editorial, multiplier, recipe).
 */
function buildScheduleAudioOverrides(cfg = {}) {
  const out = {};
  if (cfg.audio_engine_mode) {
    out.audio_engine_mode = cfg.audio_engine_mode;
    if (cfg.audio_engine_mode === 'no_vo' || cfg.audio_engine_mode === 'native_veo') {
      out.enable_tts = false;
    } else if (cfg.audio_engine_mode === 'minimax_tts') {
      out.enable_tts = true;
    }
  }
  if (cfg.no_vo_audio_bed) out.no_vo_audio_bed = cfg.no_vo_audio_bed;
  if (cfg.on_screen_text_mode) out.on_screen_text_mode = cfg.on_screen_text_mode;
  return out;
}

/**
 * Dispatcher eksekusi mandiri berdasarkan pipeline_type jadwal
 */
export async function executeAutonomousPipelineForSchedule(schedule, tenantId = 'default_tenant') {
  const pType = schedule.pipeline_type || 'recipe_campaign';
  let pipelineConfig = {};
  try {
    pipelineConfig = typeof schedule.pipeline_config_json === 'string'
      ? JSON.parse(schedule.pipeline_config_json || '{}')
      : (schedule.pipeline_config_json || {});
  } catch (_) {}

  if (pType === 'product_campaign') {
    const promotionContext = pipelineConfig.promotion_context ||
      (schedule.topic && schedule.topic !== schedule.target_item_title ? schedule.topic : null);

    return await executeAutonomousProductPipeline({
      brandId: schedule.brand_id,
      productId: schedule.target_item_id || pipelineConfig.product_id,
      productTitle: schedule.target_item_title || schedule.name,
      promotionContext,
      selectedCep: pipelineConfig.selected_cep || null,
      presetKey: schedule.preset_key || 'product_campaign',
      executionMode: 'full_autopilot',
      overrides: {
        ...buildScheduleAudioOverrides(pipelineConfig),
        ...(pipelineConfig.overrides || {})
      },
      tenantId
    });
  }

  if (pType === 'editorial_campaign') {
    const cfg = pipelineConfig || {};
    const isKeyword = cfg.use_brand_pillars === false || Boolean(cfg.keyword);
    return await executeAutonomousEditorialPipeline({
      brandId: schedule.brand_id,
      pillarTitle: schedule.target_item_title || schedule.topic,
      keyword: cfg.keyword || (isKeyword ? (schedule.target_item_title || schedule.topic) : null),
      useBrandPillars: cfg.use_brand_pillars !== false,
      presetKey: schedule.preset_key || 'brand_editorial_campaign',
      tenantId,
      overrides: {
        ...buildScheduleAudioOverrides(cfg),
        ...(cfg || {})
      }
    });
  }

  if (pType === 'multiplier_campaign') {
    const cfg = pipelineConfig || {};
    const isSmartMatchMode = cfg.selection_mode === 'auto_smart_match';
    let resolvedBlueprintId = schedule.target_item_id || cfg.deconstruct_asset_id || cfg.blueprint_id || null;
    let resolvedProductId = cfg.product_id || null;
    let resolvedBridgingMode = cfg.bridging_mode || 'select_existing';

    if (isSmartMatchMode && (!resolvedBlueprintId || !resolvedProductId || resolvedProductId === 'auto')) {
      const { pickNextSmartMatchPair } = await import('./blueprint-product-matcher.js');
      const smartPair = await pickNextSmartMatchPair({
        tenantId,
        brandId: schedule.brand_id,
        targetPromoRole: cfg.target_promo_role || 'alat_dapur',
        lookbackBlueprintDays: Number(cfg.lookback_blueprint_days || 14),
        lookbackProductDays: Number(cfg.lookback_product_days || 4),
      });
      if (!smartPair?.deconstruct_asset_id || !smartPair?.product_id) {
        throw new Error(`Smart Matcher tidak menemukan pasangan blueprint + ${cfg.target_promo_role || 'produk'} yang cocok untuk brand ini.`);
      }
      resolvedBlueprintId = resolvedBlueprintId || smartPair.deconstruct_asset_id;
      resolvedProductId = smartPair.product_id;
      resolvedBridgingMode = 'select_existing';
    }

    const hasPairedProduct = Boolean(resolvedProductId) && resolvedBridgingMode !== 'none';

    return await executeAutonomousMultiplierPipeline({
      brandId: schedule.brand_id,
      deconstructAssetId: resolvedBlueprintId,
      productId: hasPairedProduct ? resolvedProductId : null,
      presetKey: schedule.preset_key || 'multiplier_deconstruct_remix',
      executionMode: 'full_autopilot',
      tenantId,
      overrides: {
        visual_identity_preset_id: cfg.visual_identity_preset_id || null,
        generate_recipe: cfg.generate_recipe !== undefined ? Boolean(cfg.generate_recipe) : undefined,
        bridging_mode: hasPairedProduct ? resolvedBridgingMode : 'none',
        is_bridging_active: hasPairedProduct,
        product_aware_angle: cfg.product_aware_angle !== false,
        post_link_affiliate: cfg.post_link_affiliate !== undefined ? Boolean(cfg.post_link_affiliate) : undefined,
        enable_motion_text: cfg.enable_motion_text,
        motion_text_style: cfg.motion_text_style,
        video_transition: cfg.video_transition,
        transition_duration: cfg.transition_duration,
        finishing_template: cfg.finishing_template,
        caption_mode: cfg.caption_mode,
        loudness_target: cfg.loudness_target,
        ...buildScheduleAudioOverrides(cfg),
        ...(cfg.overrides || {})
      }
    });
  }

  if (pType === 'recipe_labs') {
    let cfg = {};
    try {
      cfg = typeof schedule.pipeline_config_json === 'string'
        ? JSON.parse(schedule.pipeline_config_json || '{}')
        : (schedule.pipeline_config_json || {});
    } catch (_) {}

    const resolvedTopic = schedule.topic || cfg.topic || schedule.target_item_title || 'Resep Praktis Nusantara';
    const resolvedCategory = cfg.recipe_classification || schedule.category || cfg.category || 'Makanan';
    const resolvedOutputStyle = cfg.output_style || 'recipe_infographic';
    const resolvedAspectRatio = cfg.aspect_ratio || (resolvedOutputStyle === 'recipe_infographic' ? '4:5' : '3:4');

    return await executeAutonomousRecipeLabsPipeline({
      brandId: schedule.brand_id,
      category: resolvedCategory,
      recipeClassification: resolvedCategory,
      targetLanguage: cfg.target_language || 'id_ID',
      topic: resolvedTopic,
      aspectRatio: resolvedAspectRatio,
      visualStyle: cfg.visual_style || 'Rustic Warm Tabletop & Artisanal Kitchen',
      outputStyle: resolvedOutputStyle,
      infographicTemplate: cfg.infographic_template || 'auto_rotate',
      infographicTheme: cfg.infographic_theme || 'warm_cream',
      recipeSource: cfg.recipe_source || 'ai_generated',
      curatedRecipeId: cfg.curated_recipe_id || null,
      librarySelectionMode: cfg.library_selection_mode || (cfg.recipe_source === 'recipe_library' ? 'auto_library_rotation' : 'manual'),
      showBrandWatermark: cfg.show_brand_watermark !== false,
      brandWatermarkText: cfg.brand_watermark_text || null,
      productId: cfg.product_id || null,
      imagesPerRecipe: cfg.images_per_recipe || 4,
      selectedLayoutId: cfg.selected_layout_id || '4_editorial_split',
      gridGapSize: cfg.grid_gap_size !== undefined ? cfg.grid_gap_size : 12,
      gridBorderRadius: cfg.grid_border_radius !== undefined ? cfg.grid_border_radius : 16,
      gridOuterPadding: cfg.grid_outer_padding !== undefined ? cfg.grid_outer_padding : 16,
      gridBgColor: cfg.grid_bg_color || '#0d0d12',
      postToFacebook: cfg.post_to_facebook !== undefined ? cfg.post_to_facebook : true,
      tenantId,
      overrides: {
        target_language: cfg.target_language || 'id_ID',
        recipe_classification: resolvedCategory,
        aspect_ratio: resolvedAspectRatio,
        post_link_affiliate: cfg.post_link_affiliate
      }
    });
  }

  if (pType === 'threads_series') {
    const { executeAutonomousThreadsSeriesPipeline } = await import('./threads-series-pipeline.js');
    return await executeAutonomousThreadsSeriesPipeline({
      schedule,
      pipelineConfig,
      tenantId,
      targetPublishIso: schedule.target_publish_iso || resolveSchedulePublishIso(schedule)
    });
  }

  // Default: recipe_campaign
  const cfg = pipelineConfig || {};
  return await executeAutonomousRecipePipeline({
    brandId: schedule.brand_id,
    presetKey: schedule.preset_key,
    productId: cfg.product_id || null,
    productMode: cfg.product_mode || null,
    bridgingMode: cfg.bridging_mode || null,
    topic: schedule.topic,
    category: schedule.category,
    recipeCount: schedule.recipe_count || 1,
    executionMode: 'full_autopilot',
    overrides: {
      ...(cfg.post_link_affiliate !== undefined ? { post_link_affiliate: Boolean(cfg.post_link_affiliate), is_affiliate_enabled: Boolean(cfg.post_link_affiliate) } : {}),
      ...(cfg.generate_recipe !== undefined ? { generate_recipe: Boolean(cfg.generate_recipe) } : {}),
      ...(cfg.finishing_template !== undefined ? { finishing_template: cfg.finishing_template } : {}),
      ...(cfg.caption_mode !== undefined ? { caption_mode: cfg.caption_mode } : {}),
      ...(cfg.loudness_target !== undefined ? { loudness_target: cfg.loudness_target } : {}),
      ...(cfg.vo_content_contract !== undefined ? { vo_content_contract: cfg.vo_content_contract } : {}),
      ...(cfg.vo_quality_gate !== undefined ? { vo_quality_gate: cfg.vo_quality_gate } : {}),
      ...buildScheduleAudioOverrides(cfg),
      ...(cfg.overrides || {})
    },
    tenantId
  });
}

/**
 * 1. Checks and triggers due recipe generation pipelines.
 */
export async function runDueAutoPipelineGenerations() {
  const schedulesRes = await pgQuery(
    "SELECT * FROM auto_pipeline_schedules WHERE status = 'active'"
  );
  if (!schedulesRes.rows || schedulesRes.rows.length === 0) return;

  // 1. Kumpulkan semua jadwal yang jatuh tempo ke dalam antrean (Batch Snapshot Due Detection)
  const dueBatch = [];

  for (const row of schedulesRes.rows) {
    const tz = row.timezone || 'Asia/Jakarta';
    const { dateStr, timeStr, dayOfWeek } = getNowInTimezone(tz);
    const schedMode = row.schedule_mode || 'recurring';
    const targetGenTime = row.generation_time || '05:00';

    if (schedMode === 'specific_date') {
      const rowTargetDate = row.target_date ? String(row.target_date).slice(0, 10) : null;
      if (!rowTargetDate || dateStr !== rowTargetDate) continue;
      if (row.last_run_at) continue; // Jangan ulangi jadwal specific_date yang sudah pernah jalan
      // Toleransi jatuh tempo: waktu sekarang sudah mencapai atau melewati target
      if (timeStr < targetGenTime) continue;
    } else {
      // Cek days of week untuk mode recurring
      let daysOfWeek = [0, 1, 2, 3, 4, 5, 6];
      if (row.days_of_week_json) {
        daysOfWeek = typeof row.days_of_week_json === 'string'
          ? JSON.parse(row.days_of_week_json)
          : row.days_of_week_json;
      }
      if (!daysOfWeek.includes(dayOfWeek)) continue;

      // Cek apakah sudah pernah run hari ini (khusus recurring)
      if (row.last_run_at) {
        const lastRunFmt = new Intl.DateTimeFormat('en-CA', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(new Date(row.last_run_at));

        if (lastRunFmt === dateStr) {
          // Jika run hari ini GAGAL (last_error terisi dan tidak ada last_campaign_id),
          // izinkan self-healing retry setelah jeda minimal 15 menit
          const isFailedRun = Boolean(row.last_error) && !row.last_campaign_id;
          const timeSinceLastRun = Date.now() - new Date(row.last_run_at).getTime();
          const canRetryFailed = isFailedRun && timeSinceLastRun >= 15 * 60 * 1000;

          if (!canRetryFailed) {
            // Sudah dieksekusi hari ini dan berhasil atau belum lewat jeda retry
            continue;
          }
        }
      }

      // Toleransi jatuh tempo: waktu sekarang sudah mencapai atau melewati target
      if (timeStr < targetGenTime) continue;
    }

    const effectiveTenantId = (row.tenant_id && row.tenant_id !== '__none__') ? row.tenant_id : 'default_tenant';
    dueBatch.push({
      schedule: row,
      effectiveTenantId,
      schedMode,
      targetGenTime,
      tz,
      runDateStr: dateStr
    });
  }

  if (dueBatch.length === 0) return;

  // Urutkan antrean secara FIFO berdasarkan target generation_time lalu created_at
  dueBatch.sort((a, b) => {
    const timeComp = (a.targetGenTime || '05:00').localeCompare(b.targetGenTime || '05:00');
    if (timeComp !== 0) return timeComp;
    const dateA = new Date(a.schedule.created_at || 0).getTime();
    const dateB = new Date(b.schedule.created_at || 0).getTime();
    return dateA - dateB;
  });

  console.log(`[Auto Pipeline Scheduler] 📋 Ditemukan ${dueBatch.length} jadwal jatuh tempo dalam antrean sekuensial FIFO.`);

  // 2. Eksekusi antrean secara sekuensial (FIFO) dengan jeda napas (cooldown) 3 detik
  for (let i = 0; i < dueBatch.length; i++) {
    const { schedule: row, effectiveTenantId, schedMode, runDateStr } = dueBatch[i];

    console.log(`[Auto Pipeline Scheduler] 🚀 [${i + 1}/${dueBatch.length}] Memproses antrean: "${row.name}" (${row.id}) [Type: ${row.pipeline_type || 'recipe_campaign'}, Mode: ${schedMode}] di tenant ${effectiveTenantId}`);

    let queueJob = null;
    try {
      queueJob = await enqueuePipelineJob(effectiveTenantId, {
        scheduleId: row.id,
        brandId: row.brand_id,
        pipelineType: row.pipeline_type || 'recipe_campaign',
        jobPayload: { schedule_name: row.name, schedule_mode: schedMode, config: row.pipeline_config_json }
      });
      if (queueJob) {
        await updatePipelineJobStatus(effectiveTenantId, queueJob.id, 'processing');
      }
    } catch (qErr) {
      console.warn('[Auto Pipeline Queue Warning]:', qErr.message);
    }

    try {
      await tenantContext.run(effectiveTenantId, async () => {
        // Tandai run sekarang beserta tanggal produksi lokal untuk mencegah pergeseran offset lintas tengah malam
        row.last_run_target_date = runDateStr;
        await updateScheduleExecutionStatus(effectiveTenantId, row.id, {
          lastRunAt: new Date(),
          lastRunTargetDate: runDateStr
        });

        const result = await executeAutonomousPipelineForSchedule(row, effectiveTenantId);
        const resolvedResultId = result?.campaign_id || result?.post_id || null;

        console.log(`[Auto Pipeline Scheduler] ✅ [${i + 1}/${dueBatch.length}] Selesai untuk "${row.name}". ID: ${resolvedResultId}`);

        await updateScheduleExecutionStatus(effectiveTenantId, row.id, {
          lastCampaignId: resolvedResultId,
          lastError: null
        });

        if (queueJob) {
          await updatePipelineJobStatus(effectiveTenantId, queueJob.id, 'completed', {
            campaignId: resolvedResultId
          });
        }

        if (row.auto_publish_enabled === false) {
          await notifyAutoPipelineProductionReady(effectiveTenantId, row, resolvedResultId);
        }

        // Jika mode specific_date dan auto publish tidak diaktifkan, tandai langsung sebagai completed
        if (schedMode === 'specific_date' && row.auto_publish_enabled === false) {
          await pgQuery(
            "UPDATE auto_pipeline_schedules SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 AND id = $2",
            [effectiveTenantId, row.id]
          );
          console.log(`[Auto Pipeline Scheduler] 🏁 Specific-date schedule "${row.name}" (${row.id}) marked as completed.`);
        }
      });
    } catch (err) {
      console.error(`[Auto Pipeline Scheduler] ❌ [${i + 1}/${dueBatch.length}] Gagal mengeksekusi pipeline untuk "${row.name}":`, err.message);
      await notifyAutoPipelineProductionFailed(effectiveTenantId, row, err.message);
      await updateScheduleExecutionStatus(effectiveTenantId, row.id, {
        lastError: err.message
      });
      if (queueJob) {
        await updatePipelineJobStatus(effectiveTenantId, queueJob.id, 'failed', {
          errorMessage: err.message
        });
      }
    }

    // Jeda napas (cooldown) 3 detik antar task untuk stabilitas VRAM GPU & rotasi kuota API
    if (i < dueBatch.length - 1) {
      console.log(`[Auto Pipeline Scheduler] ⏸️ Jeda antrean 3 detik sebelum jadwal berikutnya...`);
      await new Promise(res => setTimeout(res, 3000));
    }
  }
}

/**
 * 2. Checks completed videos and dispatches Repliz publishing jobs.
 */
export async function runDueAutoPipelinePublishingDispatch() {
  // Ambil jadwal aktif yang auto_publish_enabled = true dan memiliki last_campaign_id
  const schedulesRes = await pgQuery(`
    SELECT * FROM auto_pipeline_schedules 
    WHERE status = 'active' 
      AND auto_publish_enabled = true 
      AND last_campaign_id IS NOT NULL
  `);

  if (!schedulesRes.rows || schedulesRes.rows.length === 0) return;

  for (const row of schedulesRes.rows) {
    const effectiveTenantId = (row.tenant_id && row.tenant_id !== '__none__') ? row.tenant_id : 'default_tenant';

    let replizAccountIds = [];
    if (row.repliz_account_ids_json) {
      replizAccountIds = typeof row.repliz_account_ids_json === 'string'
        ? JSON.parse(row.repliz_account_ids_json)
        : row.repliz_account_ids_json;
    }

    if (!Array.isArray(replizAccountIds) || replizAccountIds.length === 0) {
      continue;
    }

    // Cari video yang sudah Completed di content_flow_items untuk campaign ini
    const cfRes = await pgQuery(`
      SELECT * FROM content_flow_items 
      WHERE tenant_id = $1 
        AND source_campaign_id = $2 
        AND pipeline_status = 'Completed'
        AND (url_asset IS NOT NULL OR drive_link IS NOT NULL OR nextcloud_url IS NOT NULL)
    `, [effectiveTenantId, row.last_campaign_id]);

    if (!cfRes.rows || cfRes.rows.length === 0) continue;

    for (const cfItem of cfRes.rows) {
      // Cek apakah item ini sudah memiliki record di publishing_jobs
      const existingJobRes = await pgQuery(`
        SELECT id FROM publishing_jobs 
        WHERE tenant_id = $1 AND content_id = $2 
        LIMIT 1
      `, [effectiveTenantId, cfItem.id]);

      if (existingJobRes.rows.length > 0) {
        // Sudah pernah dijadwalkan publikasinya
        continue;
      }

      // Format judul dan caption dari social_media_package_json jika ada
      let highCtrTitle = '';
      let captionText = cfItem.caption || cfItem.campaign_title || row.topic || '';
      let captionFacebook = null;
      let captionBio = null;
      let platformCaptions = null;

      if (cfItem.social_media_package_json) {
        try {
          const pkg = typeof cfItem.social_media_package_json === 'string'
            ? JSON.parse(cfItem.social_media_package_json)
            : cfItem.social_media_package_json;

          highCtrTitle = pkg?.title || '';
          captionFacebook = pkg.caption_facebook || null;
          captionBio = pkg.caption_bio || null;
          platformCaptions = pkg.platform_captions || null;

          if (pkg.caption) {
            captionText = pkg.caption;
            if (Array.isArray(pkg.hashtags) && pkg.hashtags.length > 0) {
              captionText += '\n\n' + pkg.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ');
            }
          }
        } catch (_) {}
      }

      // Prioritas judul: social_media_package.title -> cfItem.hook -> cfItem.campaign_title -> row.name
      if (!highCtrTitle) {
        highCtrTitle = cfItem.hook || cfItem.campaign_title || row.name || '';
      }
      highCtrTitle = String(highCtrTitle).trim().replace(/^["'\s]+|["'\s]+$/g, '').slice(0, 100);

      // 🛒 Smart Shopee Link Injection (Periksa Toggle post_link_affiliate, Akun Facebook, & Brand Profile Kampanye)
      let isAffiliateToggleActive = true;
      if (row.pipeline_config_json) {
        try {
          const pcfg = typeof row.pipeline_config_json === 'string'
            ? JSON.parse(row.pipeline_config_json)
            : row.pipeline_config_json;
          if (pcfg.post_link_affiliate === false) {
            isAffiliateToggleActive = false;
          }
        } catch (_) {}
      }

      if (isAffiliateToggleActive) {
        try {
          let targetBrandProfileId = cfItem.brand_profile_id || row.brand_id || null;
          if (!targetBrandProfileId && cfItem.campaign_title) {
            const candidate = cfItem.campaign_title.split(/[\s\-:]+/)[0].trim().toLowerCase();
            if (candidate) {
              const bpRes = await pgQuery(
                'SELECT id FROM brand_profiles WHERE LOWER(brand_name) = $1 LIMIT 1',
                [candidate]
              );
              if (bpRes.rows[0]?.id) targetBrandProfileId = bpRes.rows[0].id;
            }
          }

          // Jika caption_facebook belum memiliki link aktif, perkaya dengan Shopee Affiliate
          if (targetBrandProfileId && (!captionFacebook || !captionFacebook.includes('shopee.co.id'))) {
            const { enrichCaptionForFacebookPublishing } = await import('./shopee-affiliate-injector.js');
            const enriched = await enrichCaptionForFacebookPublishing({
              caption: captionFacebook || captionText,
              tenantId: effectiveTenantId,
              brandProfileId: targetBrandProfileId,
              cfItemId: cfItem.id
            });
            if (enriched) {
              captionFacebook = enriched;
            }
          }
        } catch (injectErr) {
          console.warn(`[Auto Pipeline Scheduler] Warning Shopee injection for ${cfItem.id}:`, injectErr.message);
        }
      }

      // Pastikan caption_bio selalu ada dan mengarahkan ke Link di Bio jika belum diatur
      if (!captionBio) {
        const bioCta = '\n\n👉 Info Bahan/Produk:\nBahan & produk rekomendasi yang mimin pakai bisa kamu cek di Link di Bio ya! ✨';
        captionBio = `${captionText.trim()}${bioCta}`;
      }

      const mediaUrl = cfItem.url_asset || cfItem.drive_link || cfItem.nextcloud_url;
      const scheduledAtIso = resolveSchedulePublishIso(row);
      const isStaticImageItem = (row.pipeline_type === 'recipe_labs' || cfItem.source_type === 'recipe')
        && !String(mediaUrl || '').toLowerCase().endsWith('.mp4');
      const resolvedMediaType = isStaticImageItem ? 'image' : 'video';

      console.log(`[Auto Pipeline Scheduler] 📢 Dispatching Repliz publishing (${resolvedMediaType}) for item ${cfItem.id} to ${replizAccountIds.length} accounts at ${scheduledAtIso}`);

      await tenantContext.run(effectiveTenantId, async () => {
        try {
          const schedResult = await schedulePublishingJobs({
            tenantId: effectiveTenantId,
            userId: 'system_auto_pipeline',
            rawBody: {
              content_id: cfItem.id,
              account_ids: replizAccountIds,
              publish_mode: 'live',
              media_type: resolvedMediaType,
              title: highCtrTitle,
              caption: captionText,
              caption_facebook: captionFacebook,
              caption_bio: captionBio,
              platform_captions: platformCaptions,
              media_url: mediaUrl,
              scheduled_at: scheduledAtIso,
              timezone: row.timezone || 'Asia/Jakarta',
              is_ai_generated: true
            }
          });

          const createdJobs = Array.isArray(schedResult?.data) ? schedResult.data : [];
          const hasReplizJob = createdJobs.some(j => j.provider === 'repliz');
          if (!hasReplizJob && createdJobs.length > 0) {
            await maybeEmitReplizReadyDigest(effectiveTenantId, cfItem.id);
          }

          await updateScheduleExecutionStatus(effectiveTenantId, row.id, {
            lastPublishAt: new Date(),
            lastError: null
          });

          console.log(`[Auto Pipeline Scheduler] ✅ Successfully scheduled Repliz publishing for "${row.name}" (${cfItem.id})`);

          // Jika schedule_mode specific_date, tandai status menjadi completed
          if (row.schedule_mode === 'specific_date') {
            await pgQuery(
              "UPDATE auto_pipeline_schedules SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 AND id = $2",
              [effectiveTenantId, row.id]
            );
            console.log(`[Auto Pipeline Scheduler] 🏁 Specific-date schedule "${row.name}" (${row.id}) marked as completed after Repliz dispatch.`);
          }
        } catch (pubErr) {
          console.error(`[Auto Pipeline Scheduler] ❌ Failed to dispatch Repliz publishing for ${cfItem.id}:`, pubErr.message);
          await notifyAutoPipelineDispatchFailed(effectiveTenantId, row, cfItem.id, pubErr.message);
          await updateScheduleExecutionStatus(effectiveTenantId, row.id, {
            lastError: `Publishing error: ${pubErr.message}`
          });
        }
      });
    }
  }
}

/**
 * Main periodic tick function. Called by campaign scheduler loop.
 */
export async function tickAutoPipelineScheduler() {
  if (isTickRunning) return;
  isTickRunning = true;

  try {
    await runDueAutoPipelineGenerations();
    await runDueAutoPipelinePublishingDispatch();
  } catch (err) {
    console.error('[Auto Pipeline Scheduler] Error during periodic tick:', err);
  } finally {
    isTickRunning = false;
  }
}

const activeScheduleRuns = new Map();

/**
 * Cek apakah jadwal tertentu sedang berjalan di background.
 */
export function isScheduleRunning(scheduleId) {
  return activeScheduleRuns.has(scheduleId);
}

/**
 * Manually trigger a schedule run immediately ("Run Now" testing).
 */
export async function runScheduleImmediately(tenantId = 'default_tenant', scheduleId) {
  const effectiveTenantId = (!tenantId || tenantId === '__none__') ? 'default_tenant' : tenantId;
  const schedule = await getAutoPipelineScheduleById(effectiveTenantId, scheduleId);
  if (!schedule) throw new Error(`Jadwal dengan ID ${scheduleId} tidak ditemukan.`);

  if (activeScheduleRuns.has(schedule.id)) {
    return {
      success: true,
      already_running: true,
      message: `Jadwal "${schedule.name}" sedang berjalan di latar belakang.`,
      schedule_id: schedule.id
    };
  }

  activeScheduleRuns.set(schedule.id, {
    started_at: new Date(),
    schedule_id: schedule.id,
    name: schedule.name
  });

  console.log(`[Auto Pipeline Scheduler] ⚡ "Run Now" triggered for schedule "${schedule.name}" (${schedule.id}) [tenant: ${effectiveTenantId}]`);

  // Update status run & bersihkan error lama
  const { dateStr: runDateStr } = getNowInTimezone(schedule.timezone || 'Asia/Jakarta');
  schedule.last_run_target_date = runDateStr;
  await updateScheduleExecutionStatus(effectiveTenantId, schedule.id, {
    lastRunAt: new Date(),
    lastRunTargetDate: runDateStr,
    lastError: null
  });

  return tenantContext.run(effectiveTenantId, async () => {
    try {
      const result = await executeAutonomousPipelineForSchedule(schedule, effectiveTenantId);
      const resolvedResultId = result.campaign_id || result.post_id || null;

      await updateScheduleExecutionStatus(effectiveTenantId, schedule.id, {
        lastCampaignId: resolvedResultId,
        lastError: null
      });

      return {
        success: true,
        message: `Eksekusi instan jadwal "${schedule.name}" berhasil dipicu.`,
        campaign_id: resolvedResultId,
        planner_id: result.planner_id,
        items_count: result.items_count
      };
    } catch (err) {
      console.error(`[Auto Pipeline Scheduler] ❌ Failed to execute "Run Now" for "${schedule.name}":`, err);
      await updateScheduleExecutionStatus(effectiveTenantId, schedule.id, {
        lastError: err.message
      });
      throw err;
    } finally {
      activeScheduleRuns.delete(schedule.id);
    }
  });
}

/**
 * Pemicu eksekusi instan non-blocking di latar belakang.
 */
export async function triggerScheduleImmediatelyAsync(tenantId = 'default_tenant', scheduleId) {
  const effectiveTenantId = (!tenantId || tenantId === '__none__') ? 'default_tenant' : tenantId;
  const schedule = await getAutoPipelineScheduleById(effectiveTenantId, scheduleId);
  if (!schedule) throw new Error(`Jadwal dengan ID ${scheduleId} tidak ditemukan.`);

  if (activeScheduleRuns.has(schedule.id)) {
    return {
      success: true,
      already_running: true,
      message: `Jadwal "${schedule.name}" sedang berjalan di latar belakang.`,
      schedule_id: schedule.id
    };
  }

  // Jalankan di background tanpa memblokir respons HTTP
  runScheduleImmediately(effectiveTenantId, schedule.id).catch(err => {
    console.error(`[Auto Pipeline Scheduler] Background execution failed for "${schedule.name}":`, err.message);
  });

  return {
    success: true,
    message: `Eksekusi instan untuk "${schedule.name}" berhasil dipicu dan sedang berjalan di latar belakang.`,
    schedule_id: schedule.id,
    status: 'running'
  };
}

