import { pgQuery, withPgTransaction } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import crypto from 'crypto';

export class PlannerConsumptionError extends Error {
  constructor(message, status = 409, code = 'PLANNER_ALREADY_CONSUMED') {
    super(message);
    this.name = 'PlannerConsumptionError';
    this.status = status;
    this.code = code;
  }
}

export const STALE_OPC_RESERVED_GRACE_MS = 30 * 1000;

async function campaignRowExists(ownerId, queryFn = pgQuery) {
  if (!ownerId) return false;
  const res = await queryFn(
    'SELECT 1 FROM pillar_campaigns WHERE id = $1 LIMIT 1',
    [String(ownerId)]
  );
  return (res?.rowCount ?? res?.rows?.length ?? 0) > 0;
}

/**
 * Releases an orphan 'reserved' lock left behind by a failed or crashed OPC/Recipe ingest
 * when the target campaign does not exist in pillar_campaigns.
 */
export async function cleanupOrphanReservedConsumption(consumptionRow, { queryFn = pgQuery, force = false } = {}) {
  if (!consumptionRow || consumptionRow.status !== 'reserved') return false;
  const recoverableTypes = new Set(['opc_campaign', 'recipe_campaign']);
  if (!recoverableTypes.has(consumptionRow.owner_type)) return false;

  if (!force) {
    const tsRaw = consumptionRow.updated_at || consumptionRow.created_at;
    const tsMs = tsRaw ? new Date(tsRaw).getTime() : 0;
    if (!Number.isFinite(tsMs) || (Date.now() - tsMs) < STALE_OPC_RESERVED_GRACE_MS) {
      return false;
    }
  }

  const exists = await campaignRowExists(consumptionRow.owner_id, queryFn).catch(() => true);
  if (exists) return false;

  await queryFn(
    `DELETE FROM content_planner_consumptions WHERE id = $1 AND status = 'reserved'`,
    [consumptionRow.id]
  );
  console.warn(`[PlannerConsumption] Released orphan reserved lock ${consumptionRow.id} for planner ${consumptionRow.planner_id} (missing campaign ${consumptionRow.owner_id}).`);
  return true;
}

/**
 * Checks whether a content planner has already been consumed or reserved by any engine.
 * Automatically heals stale orphan 'reserved' locks whose target campaign was never created.
 */
export async function getPlannerConsumption(plannerId, tenantId = null, { queryFn = pgQuery } = {}) {
  const tId = tenantId || getActiveTenantId() || 'default_tenant';
  const res = await queryFn(
    `SELECT * FROM content_planner_consumptions WHERE (tenant_id = $1 OR tenant_id IS NULL) AND planner_id = $2 LIMIT 1`,
    [tId, plannerId]
  );
  const row = res?.rows?.[0] || null;
  if (!row) return null;

  if (row.status === 'reserved') {
    const cleaned = await cleanupOrphanReservedConsumption(row, { queryFn, force: false }).catch(() => false);
    if (cleaned) return null;
  }
  return row;
}

/**
 * Throws PlannerConsumptionError if the planner has already been consumed.
 */
export async function ensurePlannerNotConsumed(plannerId, tenantId = null, { queryFn = pgQuery } = {}) {
  const consumption = await getPlannerConsumption(plannerId, tenantId, { queryFn });
  if (consumption) {
    throw new PlannerConsumptionError(
      `Content Planner (${plannerId}) sudah digunakan (consumed oleh ${consumption.owner_type} #${consumption.owner_id}) dan terkunci permanen. Planner sekali pakai tidak dapat dimodifikasi atau digunakan kembali.`,
      409,
      'PLANNER_ALREADY_CONSUMED'
    );
  }
}

/**
 * Guard for generation lease. Prevents running generation on consumed planners
 * and prevents concurrent generation requests on the same planner.
 */
export async function withPlannerGenerationLease(plannerId, work, tenantId = null) {
  const tId = tenantId || getActiveTenantId() || 'default_tenant';
  const planner = await withPgTransaction(async client => {
    const p = (await client.query('SELECT * FROM content_planners WHERE id=$1 AND (tenant_id=$2 OR tenant_id IS NULL) FOR UPDATE', [plannerId,tId])).rows[0];
    if (!p) throw Object.assign(Error('Planner tidak ditemukan.'), {status:404,code:'PLANNER_NOT_FOUND'});
    if (p.status==='generating') throw Object.assign(Error('Planner sedang digenerate.'), {status:409,code:'PLANNER_GENERATION_IN_PROGRESS'});
    if ((await client.query('SELECT id FROM content_planner_consumptions WHERE planner_id=$1 AND (tenant_id=$2 OR tenant_id IS NULL)',[plannerId,tId])).rowCount) throw new PlannerConsumptionError('Planner sudah digunakan.');
    if (!p.tenant_id) {
      await client.query('UPDATE content_planners SET tenant_id=$1 WHERE id=$2', [tId, plannerId]);
      p.tenant_id = tId;
    }
    await client.query("UPDATE content_planners SET status='generating' WHERE id=$1 AND tenant_id=$2",[plannerId,tId]);
    return p;
  });
  try { return await work(planner); }
  catch(error) {
    await pgQuery("UPDATE content_planners SET status='draft' WHERE id=$1 AND tenant_id=$2 AND status='generating'",[plannerId,tId]);
    throw error;
  }
}

/**
 * Invariant wrapper for caller-based consumption (Legacy Ingest, Operator, etc.).
 * Uses atomic reserve -> ingest -> finalize. Same owner retries are idempotent.
 */
export async function withPlannerConsumptionOwner({
  plannerId,
  ownerType,
  ownerId,
  tenantId = null,
  metadata = {},
  queryFn = pgQuery
}, ingestWork) {
  const tId = tenantId || getActiveTenantId() || 'default_tenant';
  if (!plannerId) throw new Error('plannerId wajib diisi.');

  const existing = await getPlannerConsumption(plannerId, tId, { queryFn });
  if (existing) {
    if (existing.owner_type === ownerType && String(existing.owner_id) === String(ownerId)) {
      // Same owner retry: proceed idempotently
      return await ingestWork({ existingConsumption: existing, reused: true });
    }
    throw new PlannerConsumptionError(
      `Content Planner (${plannerId}) sudah digunakan oleh ${existing.owner_type} #${existing.owner_id}.`,
      409,
      'PLANNER_ALREADY_CONSUMED'
    );
  }

  const consumptionId = `cpc_${crypto.randomBytes(8).toString('hex')}`;
  const metaJson = JSON.stringify(metadata || {});

  // Reserve ownership atomically
  try {
    await queryFn(
      `INSERT INTO content_planner_consumptions (
        id, tenant_id, planner_id, owner_type, owner_id, status, metadata_json, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'reserved', $6::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [consumptionId, tId, plannerId, ownerType, String(ownerId), metaJson]
    );
  } catch (err) {
    if (err.code === '23505') { // Postgres unique_violation
      const freshExisting = await getPlannerConsumption(plannerId, tId, { queryFn });
      if (freshExisting && freshExisting.owner_type === ownerType && String(freshExisting.owner_id) === String(ownerId)) {
        return await ingestWork({ existingConsumption: freshExisting, reused: true });
      }
      throw new PlannerConsumptionError(
        `Content Planner (${plannerId}) baru saja dikonsumsi oleh proses lain.`,
        409,
        'PLANNER_ALREADY_CONSUMED'
      );
    }
    throw err;
  }

  // Execute ingestion work
  try {
    const result = await ingestWork({ consumptionId, reused: false });

    // Finalize consumption status
    await queryFn(
      `UPDATE content_planner_consumptions
       SET status = 'consumed', consumed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [consumptionId]
    );

    // Update status in content_planners table for visibility
    await queryFn(
      `UPDATE content_planners SET status = 'consumed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [plannerId]
    ).catch(() => {});

    return result;
  } catch (error) {
    console.error(`[PlannerConsumption] Ingest failed for planner ${plannerId}:`, error.message);
    await cleanupOrphanReservedConsumption(
      { id: consumptionId, planner_id: plannerId, owner_type: ownerType, owner_id: String(ownerId), status: 'reserved' },
      { queryFn, force: true }
    ).catch(() => {});
    throw error;
  }
}

/**
 * Asserts that applying a research revision is allowed (not consumed).
 */
export async function assertPlannerResearchApplicationAllowed({ plannerId, tenantId = null }) {
  const tId = tenantId || getActiveTenantId() || 'default_tenant';
  await ensurePlannerNotConsumed(plannerId, tId);
}

/**
 * Reserve planner for Operator content job deterministically.
 */
export async function reservePlannerForOperatorJob(job) {
  const tenantId = job.tenant_id || 'default_tenant';
  const plannerId = job.planner_id;
  if (!plannerId) throw new Error('Job tidak memiliki planner_id.');

  const existing = await getPlannerConsumption(plannerId, tenantId);
  if (existing) {
    if (existing.owner_type === 'operator_job' && String(existing.owner_id) === String(job.id)) {
      return existing;
    }
    throw new PlannerConsumptionError(
      `Planner ${plannerId} sudah digunakan oleh ${existing.owner_type} #${existing.owner_id}.`,
      409,
      'PLANNER_ALREADY_CONSUMED'
    );
  }

  const consumptionId = `cpc_${crypto.randomBytes(8).toString('hex')}`;
  await pgQuery(
    `INSERT INTO content_planner_consumptions (
      id, tenant_id, planner_id, owner_type, owner_id, status, metadata_json, created_at, updated_at
    ) VALUES ($1, $2, $3, 'operator_job', $4, 'reserved', '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (tenant_id, planner_id) DO NOTHING`,
    [consumptionId, tenantId, plannerId, String(job.id)]
  );

  return await getPlannerConsumption(plannerId, tenantId);
}

export async function assertStudioPlannerOwner({ plannerId, tenantId, batchId, rowIds }) {
  const consumption = await getPlannerConsumption(plannerId, tenantId);
  if (!consumption || consumption.owner_type !== 'studio_batch' || consumption.owner_id !== batchId) throw new PlannerConsumptionError('Planner bukan milik batch Studio ini.');
  const result = await pgQuery('SELECT planner_row_id FROM content_studio_slots WHERE tenant_id=$1 AND batch_id=$2 AND planner_row_id=ANY($3::text[])', [tenantId, batchId, rowIds.map(String)]);
  if (result.rowCount !== new Set(rowIds.map(String)).size) throw new PlannerConsumptionError('Row Planner tidak termasuk output batch ini.');
}
