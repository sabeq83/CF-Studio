/**
 * Auto Pipeline Scheduler Runner
 * Manages autonomous cron cycles for Recipe Pipelines and Auto-Dispatching to Repliz Publishing.
 */

import { pgQuery } from './db-pg.js';
import { 
  executeAutonomousRecipePipeline,
  executeAutonomousProductPipeline,
  executeAutonomousEditorialPipeline
} from './autonomous-recipe-engine.js';
import { schedulePublishingJobs } from './publishing-service.js';
import { tenantContext } from './tenant-context.js';
import { 
  listAutoPipelineSchedules, 
  getAutoPipelineScheduleById,
  updateScheduleExecutionStatus 
} from './auto-pipeline-schedules-repository.js';

let isTickRunning = false;

/**
 * Gets formatted date and time in a specific timezone.
 */
function getNowInTimezone(timeZone = 'Asia/Jakarta') {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const map = {};
  parts.forEach(p => { map[p.type] = p.value; });

  const dateStr = `${map.year}-${map.month}-${map.day}`;
  const timeStr = `${map.hour}:${map.minute}`;

  // Hitung day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const dt = new Date(`${dateStr}T${timeStr}:00+07:00`);
  const dayOfWeek = dt.getDay();

  return { dateStr, timeStr, dayOfWeek, fullDate: now };
}

/**
 * Calculates scheduled_at ISO string given a target HH:mm in a timezone.
 */
function computeTargetPublishIso(publishTimeStr = '09:00', timeZone = 'Asia/Jakarta') {
  const now = new Date();
  const [targetH, targetM] = publishTimeStr.split(':').map(Number);

  // Cari tanggal hari ini di timezone tersebut
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false
  });
  const todayStr = formatter.format(now); // YYYY-MM-DD

  // Format ISO local string
  const hPad = String(targetH).padStart(2, '0');
  const mPad = String(targetM).padStart(2, '0');
  const targetDateLocal = new Date(`${todayStr}T${hPad}:${mPad}:00+07:00`);

  // Jika waktu target hari ini sudah terlewat lebih dari 15 menit yang lalu, jadwalkan 15 menit dari sekarang
  if (targetDateLocal.getTime() <= now.getTime()) {
    return new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  }

  return targetDateLocal.toISOString();
}

/**
 * Dispatcher eksekusi mandiri berdasarkan pipeline_type jadwal
 */
export async function executeAutonomousPipelineForSchedule(schedule, tenantId = 'default_tenant') {
  const pType = schedule.pipeline_type || 'recipe_campaign';

  if (pType === 'product_campaign') {
    return await executeAutonomousProductPipeline({
      brandId: schedule.brand_id,
      productId: schedule.target_item_id,
      productTitle: schedule.target_item_title || schedule.name,
      presetKey: schedule.preset_key || 'product_showcase_6clips',
      tenantId
    });
  }

  if (pType === 'editorial_campaign') {
    return await executeAutonomousEditorialPipeline({
      brandId: schedule.brand_id,
      pillarTitle: schedule.target_item_title || schedule.topic,
      presetKey: schedule.preset_key || 'editorial_tension_6clips',
      tenantId
    });
  }

  // Default: recipe_campaign
  return await executeAutonomousRecipePipeline({
    brandId: schedule.brand_id,
    presetKey: schedule.preset_key,
    topic: schedule.topic,
    category: schedule.category,
    recipeCount: schedule.recipe_count || 1,
    executionMode: 'full_autopilot',
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

  for (const row of schedulesRes.rows) {
    const tz = row.timezone || 'Asia/Jakarta';
    const { dateStr, timeStr, dayOfWeek } = getNowInTimezone(tz);

    // Cek days of week
    let daysOfWeek = [0, 1, 2, 3, 4, 5, 6];
    if (row.days_of_week_json) {
      daysOfWeek = typeof row.days_of_week_json === 'string'
        ? JSON.parse(row.days_of_week_json)
        : row.days_of_week_json;
    }
    if (!daysOfWeek.includes(dayOfWeek)) continue;

    // Cek apakah waktu saat ini cocok dengan generation_time
    const targetGenTime = row.generation_time || '05:00';
    if (timeStr !== targetGenTime) continue;

    // Cek apakah sudah pernah run hari ini
    if (row.last_run_at) {
      const lastRunFmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date(row.last_run_at));

      if (lastRunFmt === dateStr) {
        // Sudah dieksekusi hari ini
        continue;
      }
    }

    console.log(`[Auto Pipeline Scheduler] 🚀 Triggering schedule: "${row.name}" (${row.id}) [Type: ${row.pipeline_type || 'recipe_campaign'}] at ${timeStr} ${tz}`);

    const effectiveTenantId = (row.tenant_id && row.tenant_id !== '__none__') ? row.tenant_id : 'default_tenant';

    try {
      await tenantContext.run(effectiveTenantId, async () => {
        // Tandai run sekarang untuk mencegah duplicate trigger
        await updateScheduleExecutionStatus(effectiveTenantId, row.id, {
          lastRunAt: new Date()
        });

        const result = await executeAutonomousPipelineForSchedule(row, effectiveTenantId);

        console.log(`[Auto Pipeline Scheduler] ✅ Pipeline (${row.pipeline_type || 'recipe_campaign'}) executed for "${row.name}". Campaign ID: ${result.campaign_id}`);

        await updateScheduleExecutionStatus(effectiveTenantId, row.id, {
          lastCampaignId: result.campaign_id,
          lastError: null
        });
      });
    } catch (err) {
      console.error(`[Auto Pipeline Scheduler] ❌ Failed to execute pipeline for "${row.name}":`, err);
      await updateScheduleExecutionStatus(effectiveTenantId, row.id, {
        lastError: err.message
      });
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

      // Format caption dari social_media_package_json jika ada
      let captionText = cfItem.caption || cfItem.campaign_title || row.topic || '';
      if (cfItem.social_media_package_json) {
        try {
          const pkg = typeof cfItem.social_media_package_json === 'string'
            ? JSON.parse(cfItem.social_media_package_json)
            : cfItem.social_media_package_json;

          if (pkg.caption) {
            captionText = pkg.caption;
            if (Array.isArray(pkg.hashtags) && pkg.hashtags.length > 0) {
              captionText += '\n\n' + pkg.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ');
            }
          }
        } catch (_) {}
      }

      const mediaUrl = cfItem.url_asset || cfItem.drive_link || cfItem.nextcloud_url;
      const scheduledAtIso = computeTargetPublishIso(row.publish_time || '09:00', row.timezone || 'Asia/Jakarta');

      console.log(`[Auto Pipeline Scheduler] 📢 Dispatching Repliz publishing for item ${cfItem.id} to ${replizAccountIds.length} accounts at ${scheduledAtIso}`);

      await tenantContext.run(effectiveTenantId, async () => {
        try {
          await schedulePublishingJobs({
            tenantId: effectiveTenantId,
            userId: 'system_auto_pipeline',
            rawBody: {
              content_id: cfItem.id,
              account_ids: replizAccountIds,
              publish_mode: 'live',
              media_type: 'video',
              title: cfItem.campaign_title || row.name,
              caption: captionText,
              media_url: mediaUrl,
              scheduled_at: scheduledAtIso,
              timezone: row.timezone || 'Asia/Jakarta',
              is_ai_generated: true
            }
          });

          await updateScheduleExecutionStatus(effectiveTenantId, row.id, {
            lastPublishAt: new Date(),
            lastError: null
          });

          console.log(`[Auto Pipeline Scheduler] ✅ Successfully scheduled Repliz publishing for "${row.name}" (${cfItem.id})`);
        } catch (pubErr) {
          console.error(`[Auto Pipeline Scheduler] ❌ Failed to dispatch Repliz publishing for ${cfItem.id}:`, pubErr.message);
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
  await updateScheduleExecutionStatus(effectiveTenantId, schedule.id, {
    lastRunAt: new Date(),
    lastError: null
  });

  return tenantContext.run(effectiveTenantId, async () => {
    try {
      const result = await executeAutonomousPipelineForSchedule(schedule, effectiveTenantId);

      await updateScheduleExecutionStatus(effectiveTenantId, schedule.id, {
        lastCampaignId: result.campaign_id,
        lastError: null
      });

      return {
        success: true,
        message: `Eksekusi instan jadwal "${schedule.name}" berhasil dipicu.`,
        campaign_id: result.campaign_id,
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

