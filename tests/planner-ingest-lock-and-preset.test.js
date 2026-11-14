process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.PG_SEARCH_PATH = process.env.PG_SEARCH_PATH || 'dev';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  getPlannerConsumption,
  ensurePlannerNotConsumed,
  withPlannerConsumptionOwner,
  PlannerConsumptionError
} from '../lib/content-planner-consumption.js';
import { validateAndNormalizePresetProductBridging } from '../lib/operator-presets.js';
import { assertSafeTestDbEnv } from '../lib/db-env-validator.js';
import { ensureSafeLocalTestDbEnv } from './helpers/db-test-guard.js';

function createMockConsumptionQuery({ initialConsumptions = [], existingCampaignIds = [] } = {}) {
  const consumptions = [...initialConsumptions];
  const campaigns = new Set(existingCampaignIds);

  const queryFn = async (sql, params = []) => {
    if (/^\s*SELECT\b[\s\S]*FROM content_planner_consumptions\b/i.test(sql)) {
      const [tenantId, plannerId] = params;
      const found = consumptions.find(
        (r) => r.planner_id === plannerId && (r.tenant_id === tenantId || r.tenant_id === null)
      );
      return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
    }
    if (/INSERT INTO content_planner_consumptions/i.test(sql)) {
      const [id, tenantId, plannerId, ownerType, ownerId, metaJson] = params;
      if (consumptions.some((r) => r.planner_id === plannerId && r.tenant_id === tenantId)) {
        const dup = new Error('duplicate key');
        dup.code = '23505';
        throw dup;
      }
      const now = new Date().toISOString();
      consumptions.push({
        id,
        tenant_id: tenantId,
        planner_id: plannerId,
        owner_type: ownerType,
        owner_id: ownerId,
        status: 'reserved',
        metadata_json: metaJson,
        created_at: now,
        updated_at: now
      });
      return { rows: [], rowCount: 1 };
    }
    if (/SELECT 1 FROM pillar_campaigns WHERE id = \$1/i.test(sql)) {
      const exists = campaigns.has(params[0]);
      return { rows: exists ? [{ '?column?': 1 }] : [], rowCount: exists ? 1 : 0 };
    }
    if (/DELETE FROM content_planner_consumptions WHERE id = \$1/i.test(sql)) {
      const idx = consumptions.findIndex((r) => r.id === params[0] && r.status === 'reserved');
      if (idx !== -1) {
        consumptions.splice(idx, 1);
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (/UPDATE content_planner_consumptions/i.test(sql)) {
      const row = consumptions.find((r) => r.id === params[0]);
      if (row) row.status = 'consumed';
      return { rows: [], rowCount: row ? 1 : 0 };
    }
    return { rows: [], rowCount: 0 };
  };

  return { consumptions, campaigns, queryFn };
}

test('Safe test DB guard active for dev schema', () => {
  ensureSafeLocalTestDbEnv();
  assertSafeTestDbEnv();
});

test('withPlannerConsumptionOwner melepas lock reserved saat ingest gagal sehingga planner bisa di-ingest ulang', async () => {
  const fx = createMockConsumptionQuery();

  await assert.rejects(
    () =>
      withPlannerConsumptionOwner(
        {
          plannerId: 'pln_9da0a289',
          ownerType: 'opc_campaign',
          ownerId: 'opc_failed_1',
          tenantId: 'default_tenant',
          queryFn: fx.queryFn
        },
        async () => {
          throw new Error('Segmen Klip 6 tumpang tindih dengan segmen Klip 6–6.');
        }
      ),
    /tumpang tindih/
  );

  // Lock reserved harus otomatis bersih
  assert.equal(fx.consumptions.length, 0);

  // Percobaan ingest kedua dengan campaignId baru harus berhasil dan berstatus consumed
  const res = await withPlannerConsumptionOwner(
    {
      plannerId: 'pln_9da0a289',
      ownerType: 'opc_campaign',
      ownerId: 'opc_retry_2',
      tenantId: 'default_tenant',
      queryFn: fx.queryFn
    },
    async () => {
      fx.campaigns.add('opc_retry_2');
      return { campaignId: 'opc_retry_2' };
    }
  );
  assert.equal(res.campaignId, 'opc_retry_2');
  assert.equal(fx.consumptions.length, 1);
  assert.equal(fx.consumptions[0].status, 'consumed');
});

test('getPlannerConsumption & ensurePlannerNotConsumed memulihkan lock reserved yatim (>30s tanpa campaign) tapi menahan lock aktif', async () => {
  const twoMinutesAgo = new Date(Date.now() - 120 * 1000).toISOString();
  const twoSecondsAgo = new Date(Date.now() - 2 * 1000).toISOString();

  // 1. Orphan reserved (>30s, campaign tidak ada) -> dipulihkan
  const orphanFx = createMockConsumptionQuery({
    initialConsumptions: [
      {
        id: 'cpc_68f7443b8ff43b1d',
        tenant_id: 'default_tenant',
        planner_id: 'pln_9da0a289',
        owner_type: 'opc_campaign',
        owner_id: 'opc_261114_300n9n',
        status: 'reserved',
        created_at: twoMinutesAgo,
        updated_at: twoMinutesAgo
      }
    ]
  });

  const healed = await getPlannerConsumption('pln_9da0a289', 'default_tenant', { queryFn: orphanFx.queryFn });
  assert.equal(healed, null);
  assert.equal(orphanFx.consumptions.length, 0);
  await ensurePlannerNotConsumed('pln_9da0a289', 'default_tenant', { queryFn: orphanFx.queryFn });

  // 2. Fresh in-flight reserved (<30s) -> TIDAK boleh dihapus
  const activeFx = createMockConsumptionQuery({
    initialConsumptions: [
      {
        id: 'cpc_active_1',
        tenant_id: 'default_tenant',
        planner_id: 'pln_active',
        owner_type: 'opc_campaign',
        owner_id: 'opc_in_flight',
        status: 'reserved',
        created_at: twoSecondsAgo,
        updated_at: twoSecondsAgo
      }
    ]
  });

  await assert.rejects(
    () => ensurePlannerNotConsumed('pln_active', 'default_tenant', { queryFn: activeFx.queryFn }),
    (err) => err instanceof PlannerConsumptionError && err.status === 409
  );
  assert.equal(activeFx.consumptions.length, 1);
});

test('validateAndNormalizePresetProductBridging menolak segmen kembar/tumpang tindih dan menormalkan konfigurasi valid', () => {
  const badPreset = {
    visual_engine: { target_clips_count: 6 },
    product_bridging: {
      is_bridging_active: true,
      bridge_at_clip: 6,
      bridge_duration_clips: 1,
      bridge_segments: [
        { at_clip: 6, duration_clips: 1, role: 'intro' },
        { at_clip: 6, duration_clips: 1, role: 'recall' }
      ]
    }
  };
  const badCheck = validateAndNormalizePresetProductBridging(badPreset);
  assert.ok(badCheck.error);
  assert.match(badCheck.error, /tumpang tindih/i);

  const goodPreset = {
    visual_engine: { target_clips_count: 6 },
    product_bridging: {
      is_bridging_active: true,
      bridge_segments: [
        { at_clip: 2, duration_clips: 1, role: 'intro' },
        { at_clip: 6, duration_clips: 1, role: 'recall' }
      ]
    }
  };
  const goodCheck = validateAndNormalizePresetProductBridging(goodPreset);
  assert.equal(goodCheck.error, null);
  assert.equal(goodCheck.product_bridging.bridge_at_clip, 2);
  assert.equal(goodCheck.product_bridging.bridge_segments.length, 2);
});

test('pillar-campaign-ingest memvalidasi bridge_segments dan preset sebelum memanggil withPlannerConsumptionOwner', () => {
  const ingestPath = path.join(process.cwd(), 'lib', 'pillar-campaign-ingest.js');
  const source = fs.readFileSync(ingestPath, 'utf8');
  const bridgeValidationIdx = source.indexOf('const ingestBridgeNorm = normalizeBridgePayload(');
  const lockAcquireIdx = source.indexOf('return await withPlannerConsumptionOwner({');
  assert.ok(bridgeValidationIdx !== -1 && lockAcquireIdx !== -1);
  assert.ok(
    bridgeValidationIdx < lockAcquireIdx,
    'Validasi bridging dan preset harus berjalan sebelum lock planner diambil'
  );
});
