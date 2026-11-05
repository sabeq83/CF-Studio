/**
 * Auto Pipeline Schedules Repository
 * Data access layer for Autonomous Recipe Pipelines with Repliz Multi-Platform Publishing.
 */

import { pgQuery } from './db-pg.js';
import crypto from 'crypto';

/**
 * List all auto pipeline schedules for a tenant, with optional status/brand filters.
 */
export async function listAutoPipelineSchedules(tenantId = 'default_tenant', { status, brandId } = {}) {
  const conditions = ['s.tenant_id = $1'];
  const params = [tenantId];
  let paramIdx = 2;

  if (status && status !== 'all') {
    conditions.push(`s.status = $${paramIdx++}`);
    params.push(status);
  }

  if (brandId && brandId !== 'all') {
    conditions.push(`s.brand_id = $${paramIdx++}`);
    params.push(brandId);
  }

  const whereClause = conditions.join(' AND ');

  const sql = `
    SELECT 
      s.*,
      b.brand_name,
      b.tone_of_voice as brand_tone_of_voice,
      b.visual_signature as brand_visual_signature
    FROM auto_pipeline_schedules s
    LEFT JOIN brand_profiles b ON (s.brand_id = b.id AND (b.tenant_id = s.tenant_id OR b.tenant_id IS NULL))
    WHERE ${whereClause}
    ORDER BY s.generation_time ASC, s.created_at DESC
  `;

  const res = await pgQuery(sql, params);
  const schedules = res.rows.map(normalizeScheduleRow);

  // Ambil data akun Repliz untuk memperkaya detail akun yang terpilih
  const accountIdsToFetch = new Set();
  schedules.forEach(s => {
    if (Array.isArray(s.repliz_account_ids)) {
      s.repliz_account_ids.forEach(id => accountIdsToFetch.add(id));
    }
  });

  let accountsMap = {};
  if (accountIdsToFetch.size > 0) {
    const accIdsArray = Array.from(accountIdsToFetch);
    const accSql = `
      SELECT id, platform, display_name, provider, status
      FROM publishing_accounts
      WHERE tenant_id = $1 AND id = ANY($2::text[])
    `;
    const accRes = await pgQuery(accSql, [tenantId, accIdsArray]);
    accRes.rows.forEach(acc => {
      accountsMap[acc.id] = acc;
    });
  }

  return schedules.map(s => ({
    ...s,
    repliz_accounts: (s.repliz_account_ids || []).map(id => accountsMap[id]).filter(Boolean)
  }));
}

/**
 * Get a single auto pipeline schedule by ID.
 */
export async function getAutoPipelineScheduleById(tenantId = 'default_tenant', id) {
  const sql = `
    SELECT 
      s.*,
      b.brand_name,
      b.tone_of_voice as brand_tone_of_voice,
      b.visual_signature as brand_visual_signature
    FROM auto_pipeline_schedules s
    LEFT JOIN brand_profiles b ON (s.brand_id = b.id AND (b.tenant_id = s.tenant_id OR b.tenant_id IS NULL))
    WHERE s.tenant_id = $1 AND s.id = $2
    LIMIT 1
  `;

  const res = await pgQuery(sql, [tenantId, id]);
  if (!res.rows[0]) return null;

  const schedule = normalizeScheduleRow(res.rows[0]);

  if (Array.isArray(schedule.repliz_account_ids) && schedule.repliz_account_ids.length > 0) {
    const accSql = `
      SELECT id, platform, display_name, provider, status
      FROM publishing_accounts
      WHERE tenant_id = $1 AND id = ANY($2::text[])
    `;
    const accRes = await pgQuery(accSql, [tenantId, schedule.repliz_account_ids]);
    schedule.repliz_accounts = accRes.rows;
  } else {
    schedule.repliz_accounts = [];
  }

  return schedule;
}

/**
 * Create a new auto pipeline schedule.
 */
export async function createAutoPipelineSchedule(tenantId = 'default_tenant', data) {
  const id = data.id || `apsched_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const name = data.name || 'Jadwal Auto Pipeline Harian';
  const brandId = data.brand_id;
  const presetKey = data.preset_key || 'habitfolk_6clips_quick';
  const topicStrategy = data.topic_strategy || 'dynamic_ai';
  const topic = data.topic || 'Resep sehat praktis harian';
  const category = data.category || 'makanan_utama';
  const recipeCount = parseInt(data.recipe_count || '1', 10);
  const generationTime = data.generation_time || '05:00';
  const publishTime = data.publish_time || '09:00';
  const daysOfWeek = Array.isArray(data.days_of_week) ? data.days_of_week : [0, 1, 2, 3, 4, 5, 6];
  const timezone = data.timezone || 'Asia/Jakarta';
  const replizAccountIds = Array.isArray(data.repliz_account_ids) ? data.repliz_account_ids : [];
  const autoPublishEnabled = data.auto_publish_enabled !== false;
  const status = data.status || 'active';

  const sql = `
    INSERT INTO auto_pipeline_schedules (
      id, tenant_id, name, brand_id, preset_key, topic_strategy, topic,
      category, recipe_count, generation_time, publish_time, days_of_week_json,
      timezone, repliz_account_ids_json, auto_publish_enabled, status,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12,
      $13, $14, $15, $16,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING *
  `;

  const res = await pgQuery(sql, [
    id,
    tenantId,
    name,
    brandId,
    presetKey,
    topicStrategy,
    topic,
    category,
    recipeCount,
    generationTime,
    publishTime,
    JSON.stringify(daysOfWeek),
    timezone,
    JSON.stringify(replizAccountIds),
    autoPublishEnabled,
    status
  ]);

  return normalizeScheduleRow(res.rows[0]);
}

/**
 * Update an existing auto pipeline schedule.
 */
export async function updateAutoPipelineSchedule(tenantId = 'default_tenant', id, data) {
  const existing = await getAutoPipelineScheduleById(tenantId, id);
  if (!existing) {
    throw new Error(`Schedule ${id} not found`);
  }

  const name = data.name !== undefined ? data.name : existing.name;
  const brandId = data.brand_id !== undefined ? data.brand_id : existing.brand_id;
  const presetKey = data.preset_key !== undefined ? data.preset_key : existing.preset_key;
  const topicStrategy = data.topic_strategy !== undefined ? data.topic_strategy : existing.topic_strategy;
  const topic = data.topic !== undefined ? data.topic : existing.topic;
  const category = data.category !== undefined ? data.category : existing.category;
  const recipeCount = data.recipe_count !== undefined ? parseInt(data.recipe_count, 10) : existing.recipe_count;
  const generationTime = data.generation_time !== undefined ? data.generation_time : existing.generation_time;
  const publishTime = data.publish_time !== undefined ? data.publish_time : existing.publish_time;
  const daysOfWeek = Array.isArray(data.days_of_week) ? data.days_of_week : existing.days_of_week;
  const timezone = data.timezone !== undefined ? data.timezone : existing.timezone;
  const replizAccountIds = Array.isArray(data.repliz_account_ids) ? data.repliz_account_ids : existing.repliz_account_ids;
  const autoPublishEnabled = data.auto_publish_enabled !== undefined ? Boolean(data.auto_publish_enabled) : existing.auto_publish_enabled;
  const status = data.status !== undefined ? data.status : existing.status;

  const sql = `
    UPDATE auto_pipeline_schedules
    SET
      name = $3,
      brand_id = $4,
      preset_key = $5,
      topic_strategy = $6,
      topic = $7,
      category = $8,
      recipe_count = $9,
      generation_time = $10,
      publish_time = $11,
      days_of_week_json = $12,
      timezone = $13,
      repliz_account_ids_json = $14,
      auto_publish_enabled = $15,
      status = $16,
      updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = $1 AND id = $2
    RETURNING *
  `;

  const res = await pgQuery(sql, [
    tenantId,
    id,
    name,
    brandId,
    presetKey,
    topicStrategy,
    topic,
    category,
    recipeCount,
    generationTime,
    publishTime,
    JSON.stringify(daysOfWeek),
    timezone,
    JSON.stringify(replizAccountIds),
    autoPublishEnabled,
    status
  ]);

  return normalizeScheduleRow(res.rows[0]);
}

/**
 * Toggle pause/active status of a schedule.
 */
export async function togglePauseSchedule(tenantId = 'default_tenant', id) {
  const existing = await getAutoPipelineScheduleById(tenantId, id);
  if (!existing) throw new Error(`Schedule ${id} not found`);

  const nextStatus = existing.status === 'paused' ? 'active' : 'paused';
  const sql = `
    UPDATE auto_pipeline_schedules
    SET status = $3, updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = $1 AND id = $2
    RETURNING *
  `;
  const res = await pgQuery(sql, [tenantId, id, nextStatus]);
  return normalizeScheduleRow(res.rows[0]);
}

/**
 * Archive a schedule.
 */
export async function archiveSchedule(tenantId = 'default_tenant', id) {
  const sql = `
    UPDATE auto_pipeline_schedules
    SET status = 'archived', updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = $1 AND id = $2
    RETURNING *
  `;
  const res = await pgQuery(sql, [tenantId, id]);
  if (!res.rows[0]) throw new Error(`Schedule ${id} not found`);
  return normalizeScheduleRow(res.rows[0]);
}

/**
 * Delete a schedule permanently.
 */
export async function deleteSchedule(tenantId = 'default_tenant', id) {
  const sql = `
    DELETE FROM auto_pipeline_schedules
    WHERE tenant_id = $1 AND id = $2
    RETURNING id
  `;
  const res = await pgQuery(sql, [tenantId, id]);
  return res.rowCount > 0;
}

/**
 * Update runtime execution status (called by scheduler runner).
 */
export async function updateScheduleExecutionStatus(tenantId = 'default_tenant', id, {
  lastRunAt,
  lastCampaignId,
  lastPublishAt,
  lastError
} = {}) {
  const updates = [];
  const params = [tenantId, id];
  let pIdx = 3;

  if (lastRunAt !== undefined) {
    updates.push(`last_run_at = $${pIdx++}`);
    params.push(lastRunAt ? new Date(lastRunAt).toISOString() : null);
  }
  if (lastCampaignId !== undefined) {
    updates.push(`last_campaign_id = $${pIdx++}`);
    params.push(lastCampaignId);
  }
  if (lastPublishAt !== undefined) {
    updates.push(`last_publish_at = $${pIdx++}`);
    params.push(lastPublishAt ? new Date(lastPublishAt).toISOString() : null);
  }
  if (lastError !== undefined) {
    updates.push(`last_error = $${pIdx++}`);
    params.push(lastError);
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);

  const sql = `
    UPDATE auto_pipeline_schedules
    SET ${updates.join(', ')}
    WHERE tenant_id = $1 AND id = $2
    RETURNING *
  `;

  const res = await pgQuery(sql, params);
  return res.rows[0] ? normalizeScheduleRow(res.rows[0]) : null;
}

/**
 * Normalizes DB row json fields.
 */
function normalizeScheduleRow(row) {
  if (!row) return null;
  let daysOfWeek = [0, 1, 2, 3, 4, 5, 6];
  if (row.days_of_week_json) {
    daysOfWeek = typeof row.days_of_week_json === 'string'
      ? JSON.parse(row.days_of_week_json)
      : row.days_of_week_json;
  }

  let replizAccountIds = [];
  if (row.repliz_account_ids_json) {
    replizAccountIds = typeof row.repliz_account_ids_json === 'string'
      ? JSON.parse(row.repliz_account_ids_json)
      : row.repliz_account_ids_json;
  }

  return {
    ...row,
    days_of_week: daysOfWeek,
    repliz_account_ids: replizAccountIds
  };
}
