/**
 * Auto Pipeline Queue Repository
 * Data access layer for persistent autonomous pipeline execution queue (FIFO).
 */

import { pgQuery } from './db-pg.js';

/**
 * Enqueue a new autonomous pipeline job
 */
export async function enqueuePipelineJob(tenantId = 'default_tenant', {
  scheduleId = null,
  brandId = null,
  pipelineType = 'recipe_campaign',
  jobPayload = {}
}) {
  const effectiveTenantId = (!tenantId || tenantId === '__none__') ? 'default_tenant' : tenantId;
  const sql = `
    INSERT INTO auto_pipeline_jobs (
      tenant_id, schedule_id, brand_id, pipeline_type, job_payload, status, queued_at
    )
    VALUES ($1, $2, $3, $4, $5, 'queued', CURRENT_TIMESTAMP)
    RETURNING *
  `;
  const res = await pgQuery(sql, [
    effectiveTenantId,
    scheduleId,
    brandId,
    pipelineType,
    typeof jobPayload === 'string' ? jobPayload : JSON.stringify(jobPayload)
  ]);
  return res.rows[0];
}

/**
 * List jobs in the queue for a tenant, with optional status and limit
 */
export async function listPipelineJobs(tenantId = 'default_tenant', options = {}) {
  const effectiveTenantId = (!tenantId || tenantId === '__none__') ? 'default_tenant' : tenantId;
  const { status, limit = 50 } = options;
  const conditions = ['tenant_id = $1'];
  const params = [effectiveTenantId];
  let paramIdx = 2;

  if (status && status !== 'all') {
    conditions.push(`status = $${paramIdx++}`);
    params.push(status);
  }

  const sql = `
    SELECT * FROM auto_pipeline_jobs
    WHERE ${conditions.join(' AND ')}
    ORDER BY 
      CASE 
        WHEN status = 'processing' THEN 1
        WHEN status = 'queued' THEN 2
        ELSE 3
      END,
      queued_at DESC
    LIMIT $${paramIdx}
  `;
  params.push(limit);

  const res = await pgQuery(sql, params);
  return res.rows;
}

/**
 * Get summary counts of queue jobs for a tenant
 */
export async function getPipelineQueueSummary(tenantId = 'default_tenant') {
  const effectiveTenantId = (!tenantId || tenantId === '__none__') ? 'default_tenant' : tenantId;
  const sql = `
    SELECT 
      COUNT(*) FILTER (WHERE status = 'queued') as queued_count,
      COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
      COUNT(*) FILTER (WHERE status = 'failed') as failed_count
    FROM auto_pipeline_jobs
    WHERE tenant_id = $1
  `;
  const res = await pgQuery(sql, [effectiveTenantId]);
  const row = res.rows[0] || {};
  return {
    queued: parseInt(row.queued_count || '0', 10),
    processing: parseInt(row.processing_count || '0', 10),
    completed: parseInt(row.completed_count || '0', 10),
    failed: parseInt(row.failed_count || '0', 10)
  };
}

/**
 * Dequeue the oldest queued job with atomic row locking (FOR UPDATE SKIP LOCKED)
 */
export async function dequeueNextPipelineJob(tenantId = null) {
  const conditions = ["status = 'queued'"];
  const params = [];
  if (tenantId && tenantId !== '__none__') {
    conditions.push('tenant_id = $1');
    params.push(tenantId);
  }

  const sql = `
    UPDATE auto_pipeline_jobs
    SET status = 'processing',
        started_at = CURRENT_TIMESTAMP,
        attempts = attempts + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = (
      SELECT id FROM auto_pipeline_jobs
      WHERE ${conditions.join(' AND ')}
      ORDER BY queued_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;
  const res = await pgQuery(sql, params);
  return res.rows[0] || null;
}

/**
 * Update the execution status of a pipeline job
 */
export async function updatePipelineJobStatus(tenantId = 'default_tenant', jobId, status, updates = {}) {
  const effectiveTenantId = (!tenantId || tenantId === '__none__') ? 'default_tenant' : tenantId;
  const { campaignId, errorMessage } = updates;

  const sets = ['status = $3', 'updated_at = CURRENT_TIMESTAMP'];
  const params = [effectiveTenantId, jobId, status];
  let paramIdx = 4;

  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    sets.push('completed_at = CURRENT_TIMESTAMP');
  }

  if (campaignId !== undefined) {
    sets.push(`campaign_id = $${paramIdx++}`);
    params.push(campaignId);
  }

  if (errorMessage !== undefined) {
    sets.push(`error_message = $${paramIdx++}`);
    params.push(errorMessage);
  }

  const sql = `
    UPDATE auto_pipeline_jobs
    SET ${sets.join(', ')}
    WHERE tenant_id = $1 AND id = $2
    RETURNING *
  `;
  const res = await pgQuery(sql, params);
  return res.rows[0] || null;
}

/**
 * Cancel a queued pipeline job
 */
export async function cancelPipelineJob(tenantId = 'default_tenant', jobId) {
  const effectiveTenantId = (!tenantId || tenantId === '__none__') ? 'default_tenant' : tenantId;
  const sql = `
    UPDATE auto_pipeline_jobs
    SET status = 'cancelled',
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = $1 AND id = $2 AND status = 'queued'
    RETURNING *
  `;
  const res = await pgQuery(sql, [effectiveTenantId, jobId]);
  return res.rows[0] || null;
}

