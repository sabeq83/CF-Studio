process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.PG_SEARCH_PATH = process.env.PG_SEARCH_PATH || 'dev';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  EXPERIMENT_SETTING_KEYS,
  EXPERIMENT_UNSET_DEFAULTS,
  EXPERIMENT_RECOMMENDED_DEFAULTS,
  EXPERIMENT_AUDIT_EVENT_TYPE,
  canEditExperimentSettings,
  validateExperimentSettingsPayload,
  buildQuotaMeterItems,
  readTenantExperimentSettings,
  saveTenantExperimentSettings
} from '../lib/experiment-settings.js';
import { assertSafeTestDbEnv } from '../lib/db-env-validator.js';
import { ensureSafeLocalTestDbEnv } from './helpers/db-test-guard.js';

function createInMemoryTenantFixture() {
  const store = {
    default_tenant: {},
    tenant_b: {}
  };
  const auditRows = [];
  let nextAuditId = 1;

  const readSettingFn = async (key, tenantId) => {
    const t = store[tenantId] || {};
    return Object.prototype.hasOwnProperty.call(t, key) ? t[key] : null;
  };

  const writeSettingFn = async (key, val, tenantId) => {
    if (!store[tenantId]) store[tenantId] = {};
    store[tenantId][key] = String(val);
  };

  const queryFn = async (sql, params = []) => {
    if (/FROM tenants/i.test(sql)) {
      const id = params[0];
      return {
        rows: [{ id, name: id === 'default_tenant' ? 'Default Akun' : 'Toko Sebelah B' }]
      };
    }
    if (/INSERT INTO tenant_audit_events/i.test(sql)) {
      auditRows.unshift({
        id: nextAuditId++,
        actor_user_id: params[0],
        tenant_id: params[1],
        event_type: params[2],
        event_json: params[3],
        created_at: new Date().toISOString(),
        username: 'admin-uji',
        email: 'admin@makna.local'
      });
      return { rows: [] };
    }
    if (/FROM tenant_audit_events/i.test(sql)) {
      const [tenantId, eventType] = params;
      return {
        rows: auditRows.filter((r) => r.tenant_id === tenantId && r.event_type === eventType)
      };
    }
    return { rows: [] };
  };

  const getPoolSummaryFn = async () => ({
    reset_wib: '15:00 WIB (PT)',
    quota_date_pt: '2026-11-14',
    total_capacity: 60,
    by_model: {
      'gemini-3.5-flash-lite': { model_name: 'gemini-3.5-flash-lite', total_used: 12, total_capacity: 60 },
      'gemini-3.1-flash-lite': { model_name: 'gemini-3.1-flash-lite', total_used: 8, total_capacity: 60 },
      'gemini-3.6-flash': { model_name: 'gemini-3.6-flash', total_used: 4, total_capacity: 60 }
    }
  });

  return { store, auditRows, readSettingFn, writeSettingFn, queryFn, getPoolSummaryFn };
}

test('Safe test DB guard active for dev schema', () => {
  ensureSafeLocalTestDbEnv();
  assertSafeTestDbEnv();
});

test('Simpan dan baca per-tenant terisolasi; tenant belum pernah set tetap memakai fallback aman scheduler', async () => {
  const fx = createInMemoryTenantFixture();

  // Tenant yang belum pernah menyimpan key apapun tetap mengembalikan EXPERIMENT_UNSET_DEFAULTS
  const initialA = await readTenantExperimentSettings({
    tenantId: 'default_tenant',
    readSettingFn: fx.readSettingFn,
    queryFn: fx.queryFn,
    getPoolSummaryFn: fx.getPoolSummaryFn
  });
  assert.deepEqual(initialA.settings, EXPERIMENT_UNSET_DEFAULTS);
  assert.equal(initialA.settings.planner_scene_director, 'off');
  assert.equal(initialA.settings.metaphor_kit_engine, 'off');
  assert.equal(initialA.settings.start_frame_visual_qc, 'off');
  assert.equal(initialA.settings.gemini_quota_brake, 'on');

  // Admin default_tenant mengaktifkan Planner Scene Director & Visual QC enforce
  const saveRes = await saveTenantExperimentSettings({
    tenantId: 'default_tenant',
    actor: { id: 'usr_admin', username: 'sabeq', role: 'admin' },
    updates: {
      planner_scene_director: 'on',
      start_frame_visual_qc: 'enforce',
      start_frame_visual_qc_batch: 'on',
      start_frame_visual_qc_model: 'gemini-3.1-flash-lite'
    },
    readSettingFn: fx.readSettingFn,
    writeSettingFn: fx.writeSettingFn,
    queryFn: fx.queryFn
  });
  assert.equal(saveRes.changed_count, 4);

  // Baca ulang default_tenant
  const afterA = await readTenantExperimentSettings({
    tenantId: 'default_tenant',
    readSettingFn: fx.readSettingFn,
    queryFn: fx.queryFn,
    getPoolSummaryFn: fx.getPoolSummaryFn
  });
  assert.equal(afterA.settings.planner_scene_director, 'on');
  assert.equal(afterA.settings.start_frame_visual_qc, 'enforce');
  assert.equal(afterA.settings.start_frame_visual_qc_batch, 'on');
  assert.equal(afterA.settings.start_frame_visual_qc_model, 'gemini-3.1-flash-lite');
  assert.equal(afterA.meta.planner_scene_director.by, 'sabeq');
  assert.ok(afterA.history.length >= 4);

  // Tenant B tidak terpengaruh sama sekali
  const afterB = await readTenantExperimentSettings({
    tenantId: 'tenant_b',
    readSettingFn: fx.readSettingFn,
    queryFn: fx.queryFn,
    getPoolSummaryFn: fx.getPoolSummaryFn
  });
  assert.deepEqual(afterB.settings, EXPERIMENT_UNSET_DEFAULTS);
  assert.equal(afterB.history.length, 0);
});

test('Validasi whitelist menolak nilai sembarang dan mengembalikan status 400', async () => {
  const fx = createInMemoryTenantFixture();

  const invalidCases = [
    { planner_scene_director: 'always' },
    { metaphor_kit_engine: 'enable' },
    { start_frame_visual_qc: 'delete_all' },
    { start_frame_visual_qc_batch: 'parallel' },
    { gemini_quota_brake: 'maybe' },
    { compact_prompts: 'ultra' },
    { start_frame_visual_qc_model: 'gpt-4o-unknown' }
  ];

  for (const payload of invalidCases) {
    const check = validateExperimentSettingsPayload(payload);
    assert.equal(check.valid, false, `Payload invalid harus ditolak: ${JSON.stringify(payload)}`);

    await assert.rejects(
      () =>
        saveTenantExperimentSettings({
          tenantId: 'default_tenant',
          actor: { id: 'usr_admin', username: 'sabeq', role: 'owner' },
          updates: payload,
          readSettingFn: fx.readSettingFn,
          writeSettingFn: fx.writeSettingFn,
          queryFn: fx.queryFn
        }),
      (err) => err && err.status === 400
    );
  }
});

test('Pembatasan role menolak viewer/member (403) dan mengizinkan admin/owner sambil mencatat audit trail', async () => {
  const fx = createInMemoryTenantFixture();

  assert.equal(canEditExperimentSettings('viewer'), false);
  assert.equal(canEditExperimentSettings('member'), false);
  assert.equal(canEditExperimentSettings('editor'), false);
  assert.equal(canEditExperimentSettings('admin'), true);
  assert.equal(canEditExperimentSettings('owner'), true);

  for (const deniedRole of ['viewer', 'member', 'user', '']) {
    await assert.rejects(
      () =>
        saveTenantExperimentSettings({
          tenantId: 'default_tenant',
          actor: { id: 'usr_view', username: 'viewer1', role: deniedRole },
          updates: { planner_scene_director: 'on' },
          readSettingFn: fx.readSettingFn,
          writeSettingFn: fx.writeSettingFn,
          queryFn: fx.queryFn
        }),
      (err) => err && err.status === 403
    );
  }

  // Owner berhasil menyimpan & menulis event audit bertipe experiment_settings.updated
  await saveTenantExperimentSettings({
    tenantId: 'default_tenant',
    actor: { id: 'usr_owner', username: 'owner1', role: 'owner' },
    updates: { compact_prompts: 'on' },
    readSettingFn: fx.readSettingFn,
    writeSettingFn: fx.writeSettingFn,
    queryFn: fx.queryFn
  });

  assert.equal(fx.auditRows.length, 1);
  assert.equal(fx.auditRows[0].event_type, EXPERIMENT_AUDIT_EVENT_TYPE);
  const parsed = JSON.parse(fx.auditRows[0].event_json);
  assert.equal(parsed.actor_label, 'owner1');
  assert.deepEqual(parsed.changes, [{ key: 'compact_prompts', from: 'off', to: 'on' }]);
});

test('Reset per kartu dan reset semua mengembalikan nilai aman yang disarankan', async () => {
  const fx = createInMemoryTenantFixture();

  // Ubah semua setting ke non-default
  await saveTenantExperimentSettings({
    tenantId: 'default_tenant',
    actor: { id: 'usr_admin', username: 'admin1', role: 'admin' },
    updates: {
      planner_scene_director: 'on',
      metaphor_kit_engine: 'on',
      start_frame_visual_qc: 'enforce',
      start_frame_visual_qc_batch: 'on',
      start_frame_visual_qc_model: 'gemini-3.6-flash',
      gemini_quota_brake: 'off',
      compact_prompts: 'on'
    },
    readSettingFn: fx.readSettingFn,
    writeSettingFn: fx.writeSettingFn,
    queryFn: fx.queryFn
  });

  // Reset hanya kartu Cerita & Adegan ('story')
  await saveTenantExperimentSettings({
    tenantId: 'default_tenant',
    actor: { id: 'usr_admin', username: 'admin1', role: 'admin' },
    resetScope: 'story',
    readSettingFn: fx.readSettingFn,
    writeSettingFn: fx.writeSettingFn,
    queryFn: fx.queryFn
  });

  const midState = await readTenantExperimentSettings({
    tenantId: 'default_tenant',
    readSettingFn: fx.readSettingFn,
    queryFn: fx.queryFn,
    getPoolSummaryFn: fx.getPoolSummaryFn
  });
  assert.equal(midState.settings.planner_scene_director, 'off');
  assert.equal(midState.settings.metaphor_kit_engine, 'off');
  // Kartu lain tetap terjaga
  assert.equal(midState.settings.start_frame_visual_qc, 'enforce');
  assert.equal(midState.settings.gemini_quota_brake, 'off');

  // Reset semua ('all')
  await saveTenantExperimentSettings({
    tenantId: 'default_tenant',
    actor: { id: 'usr_admin', username: 'admin1', role: 'admin' },
    resetScope: 'all',
    readSettingFn: fx.readSettingFn,
    writeSettingFn: fx.writeSettingFn,
    queryFn: fx.queryFn
  });

  const finalState = await readTenantExperimentSettings({
    tenantId: 'default_tenant',
    readSettingFn: fx.readSettingFn,
    queryFn: fx.queryFn,
    getPoolSummaryFn: fx.getPoolSummaryFn
  });
  assert.deepEqual(finalState.settings, EXPERIMENT_RECOMMENDED_DEFAULTS);
});

test('Meteran kuota membangun ringkasan bersih dan komponen UI mematuhi aturan semantic CSS + tanpa key teknis terlihat', () => {
  const meter = buildQuotaMeterItems({
    total_capacity: 40,
    by_model: {
      'gemini-3.5-flash-lite': { model_name: 'gemini-3.5-flash-lite', total_used: 15, total_capacity: 40 },
      'gemini-3.1-flash-lite': { model_name: 'gemini-3.1-flash-lite', total_used: 5, total_capacity: 40 }
    }
  });
  assert.equal(meter.length, 3);
  assert.equal(meter[0].label, 'Storyboard & naskah');
  assert.equal(meter[0].used, 15);
  assert.equal(meter[1].label, 'Pemeriksa gambar');
  assert.equal(meter[2].label, 'Cadangan & utama');

  const panelPath = path.join(process.cwd(), 'app', 'settings', 'components', 'ExperimentSettingsPanel.js');
  const panelSource = fs.readFileSync(panelPath, 'utf8');

  // Nol warna hardcoded (hex/rgb/rgba)
  assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(panelSource), false, 'ExperimentSettingsPanel.js tidak boleh mengandung warna hex hardcoded');
  assert.equal(/\brgba?\s*\(/i.test(panelSource), false, 'ExperimentSettingsPanel.js tidak boleh mengandung warna rgb/rgba hardcoded');

  // Nol tulisan internal api_key_usages
  assert.equal(panelSource.includes('api_key_usages'), false, 'ExperimentSettingsPanel.js tidak boleh menampilkan api_key_usages');

  // Tidak ada key teknis di dalam teks JSX terlihat (tag text & label/title/description string props)
  const visiblePropsAndText = [
    ...[...panelSource.matchAll(/(?:title|badge|description|label)=["']([^"']+)["']/g)].map((m) => m[1]),
    ...[...panelSource.matchAll(/>([^<>{}]+)</g)].map((m) => m[1])
  ].join('\n');

  for (const techKey of EXPERIMENT_SETTING_KEYS) {
    assert.equal(
      visiblePropsAndText.includes(techKey),
      false,
      `Teks UI terlihat tidak boleh menyebut key teknis "${techKey}"`
    );
  }
});

