/**
 * Centralized per-tenant experiment settings, whitelist validation, reset defaults,
 * and audit-trail helpers for Settings -> "Fitur Eksperimen".
 */

import { getSetting, setSetting, getPoolSummary } from './db.js';
import { pgQuery } from './db-pg.js';
import { tenantContext } from './tenant-context.js';

export const EXPERIMENT_SETTING_KEYS = [
  'planner_scene_director',
  'metaphor_kit_engine',
  'start_frame_visual_qc',
  'start_frame_visual_qc_batch',
  'start_frame_visual_qc_model',
  'gemini_quota_brake',
  'compact_prompts'
];

export const EXPERIMENT_WHITELISTS = {
  planner_scene_director: ['off', 'on'],
  metaphor_kit_engine: ['off', 'on'],
  start_frame_visual_qc: ['off', 'report_only', 'enforce'],
  start_frame_visual_qc_batch: ['off', 'shadow', 'on'],
  start_frame_visual_qc_model: [
    '',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash'
  ],
  gemini_quota_brake: ['on', 'off'],
  compact_prompts: ['off', 'on']
};

// Preserves existing scheduler fallback behavior for tenants that have never saved a key.
export const EXPERIMENT_UNSET_DEFAULTS = {
  planner_scene_director: 'off',
  metaphor_kit_engine: 'off',
  start_frame_visual_qc: 'off',
  start_frame_visual_qc_batch: 'off',
  start_frame_visual_qc_model: '',
  gemini_quota_brake: 'on',
  compact_prompts: 'off'
};

// Safe recommended defaults applied by "Kembalikan ke default" actions.
export const EXPERIMENT_RECOMMENDED_DEFAULTS = {
  planner_scene_director: 'off',
  metaphor_kit_engine: 'off',
  start_frame_visual_qc: 'report_only',
  start_frame_visual_qc_batch: 'off',
  start_frame_visual_qc_model: 'gemini-3.1-flash-lite',
  gemini_quota_brake: 'on',
  compact_prompts: 'off'
};

export const EXPERIMENT_CARD_KEYS = {
  story: ['planner_scene_director', 'metaphor_kit_engine'],
  qc: ['start_frame_visual_qc', 'start_frame_visual_qc_batch', 'start_frame_visual_qc_model'],
  quota: ['gemini_quota_brake'],
  advanced: ['compact_prompts']
};

export const EXPERIMENT_FRIENDLY_LABELS = {
  planner_scene_director: 'Sutradara Adegan dari Planner',
  metaphor_kit_engine: 'Mesin Metafora',
  start_frame_visual_qc: 'Mode Pemeriksa Gambar',
  start_frame_visual_qc_batch: 'Periksa Sekaligus',
  start_frame_visual_qc_model: 'Model Pemeriksa',
  gemini_quota_brake: 'Rem Kuota Harian',
  compact_prompts: 'Prompt Ringkas'
};

export const EXPERIMENT_AUDIT_EVENT_TYPE = 'experiment_settings.updated';

export function canEditExperimentSettings(role) {
  const normalized = String(role || '').trim().toLowerCase();
  return normalized === 'admin' || normalized === 'owner';
}

export function formatExperimentValueLabel(key, val) {
  const v = val === null || val === undefined ? '' : String(val);
  if (key === 'start_frame_visual_qc') {
    if (v === 'enforce') return 'Blokir & buat ulang';
    if (v === 'report_only') return 'Lapor saja';
    return 'Mati';
  }
  if (key === 'start_frame_visual_qc_batch') {
    if (v === 'on') return 'Nyala';
    if (v === 'shadow') return 'Uji banding';
    return 'Mati';
  }
  if (key === 'start_frame_visual_qc_model') {
    return v || 'Otomatis';
  }
  return v === 'on' ? 'Nyala' : 'Mati';
}

export function validateExperimentSettingsPayload(payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, values: {}, errors: ['Payload pengaturan harus berupa objek JSON.'] };
  }

  const values = {};
  const errors = [];

  for (const key of EXPERIMENT_SETTING_KEYS) {
    if (payload[key] === undefined) continue;
    const raw = payload[key] === null ? '' : String(payload[key]).trim();
    const normalized = key === 'start_frame_visual_qc_model' ? raw : raw.toLowerCase();
    const allowed = EXPERIMENT_WHITELISTS[key];
    if (!allowed.includes(normalized)) {
      const label = EXPERIMENT_FRIENDLY_LABELS[key] || key;
      errors.push(`Nilai tidak valid untuk "${label}". Pilihan yang diizinkan: ${allowed.map((a) => (a === '' ? '(Otomatis)' : a)).join(', ')}.`);
      continue;
    }
    values[key] = normalized;
  }

  return { valid: errors.length === 0, values, errors };
}

function buildTenantReadFn(tenantId, readSettingFn) {
  if (readSettingFn) return (key) => readSettingFn(key, tenantId);
  return (key) => tenantContext.run(tenantId, () => getSetting(key, false));
}

function buildTenantWriteFn(tenantId, writeSettingFn) {
  if (writeSettingFn) return (key, val) => writeSettingFn(key, val, tenantId);
  return (key, val) => tenantContext.run(tenantId, () => setSetting(key, val));
}

export function formatIndonesianDateTimeWib(dateInput) {
  if (!dateInput) return 'Default awal';
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return String(dateInput);
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(d) + ' WIB';
  } catch {
    return d.toISOString();
  }
}

export function buildQuotaMeterItems(poolSummary = {}) {
  const byModel = poolSummary?.by_model || {};
  const totalCapacity = Number(poolSummary?.total_capacity || 0);
  const toRow = (label, modelName) => {
    const stat = byModel[modelName] || {};
    const used = Number(stat.total_used || 0);
    const limit = Number(stat.total_capacity || totalCapacity || 0);
    return { label, model: modelName, used, limit };
  };

  const rows = [
    toRow('Storyboard & naskah', 'gemini-3.5-flash-lite'),
    toRow('Pemeriksa gambar', 'gemini-3.1-flash-lite'),
    toRow('Cadangan & utama', 'gemini-3.6-flash')
  ];

  // Include any additional model with active usage today
  const known = new Set(rows.map((r) => r.model));
  for (const stat of Object.values(byModel)) {
    if (!stat?.model_name || known.has(stat.model_name) || Number(stat.total_used || 0) <= 0) continue;
    rows.push({
      label: `Model tambahan (${stat.model_name})`,
      model: stat.model_name,
      used: Number(stat.total_used || 0),
      limit: Number(stat.total_capacity || totalCapacity || 0)
    });
  }

  return rows;
}

export async function readTenantExperimentSettings({
  tenantId,
  readSettingFn = null,
  queryFn = pgQuery,
  getPoolSummaryFn = getPoolSummary
}) {
  if (!tenantId || tenantId === '__none__') {
    const err = new Error('Tenant aktif tidak valid untuk membaca Fitur Eksperimen.');
    err.status = 400;
    throw err;
  }

  const readSetting = buildTenantReadFn(tenantId, readSettingFn);
  const settings = {};
  for (const key of EXPERIMENT_SETTING_KEYS) {
    const raw = await readSetting(key);
    settings[key] = raw !== null && raw !== undefined ? String(raw) : EXPERIMENT_UNSET_DEFAULTS[key];
  }

  let tenantName = tenantId;
  try {
    const tRes = await queryFn('SELECT id, name FROM tenants WHERE id = $1 LIMIT 1', [tenantId]);
    if (tRes?.rows?.[0]?.name) {
      tenantName = tRes.rows[0].name;
    }
  } catch (_) {}

  const meta = {};
  for (const key of EXPERIMENT_SETTING_KEYS) {
    meta[key] = { by: 'system-default', at: 'Default awal' };
  }

  const history = [];
  try {
    const auditRes = await queryFn(
      `SELECT e.id, e.actor_user_id, e.event_json, e.created_at, u.username, u.email
       FROM tenant_audit_events e
       LEFT JOIN users u ON u.id = e.actor_user_id
       WHERE e.tenant_id = $1 AND e.event_type = $2
       ORDER BY e.created_at DESC, e.id DESC
       LIMIT 30`,
      [tenantId, EXPERIMENT_AUDIT_EVENT_TYPE]
    );

    for (const row of auditRes?.rows || []) {
      let parsedEvent = {};
      try {
        parsedEvent = typeof row.event_json === 'string' ? JSON.parse(row.event_json) : (row.event_json || {});
      } catch (_) {}

      const actorLabel = parsedEvent.actor_label || row.username || row.email || row.actor_user_id || 'admin';
      const formattedTime = formatIndonesianDateTimeWib(row.created_at);
      const changes = Array.isArray(parsedEvent.changes) ? parsedEvent.changes : [];

      for (const ch of changes) {
        if (!ch?.key || !EXPERIMENT_SETTING_KEYS.includes(ch.key)) continue;
        if (meta[ch.key].by === 'system-default') {
          meta[ch.key] = { by: actorLabel, at: formattedTime };
        }
        if (history.length < 15) {
          const label = EXPERIMENT_FRIENDLY_LABELS[ch.key] || ch.key;
          const fromLabel = formatExperimentValueLabel(ch.key, ch.from);
          const toLabel = formatExperimentValueLabel(ch.key, ch.to);
          history.push({
            id: `${row.id}_${ch.key}`,
            time: formattedTime,
            user: actorLabel,
            text: ch.from === ch.to
              ? `${label} ditetapkan ke ${toLabel}`
              : `${label} diubah: ${fromLabel} → ${toLabel}`
          });
        }
      }
    }
  } catch (_) {}

  let poolSummary = null;
  try {
    poolSummary = await tenantContext.run(tenantId, () => getPoolSummaryFn());
  } catch (_) {}

  return {
    tenant_id: tenantId,
    tenant_name: tenantName,
    settings,
    recommended_defaults: { ...EXPERIMENT_RECOMMENDED_DEFAULTS },
    meta,
    history,
    quota_reset_wib: poolSummary?.reset_wib || '15:00 WIB (PT)',
    quota_date_pt: poolSummary?.quota_date_pt || null,
    quota_meter: buildQuotaMeterItems(poolSummary || {})
  };
}

export async function saveTenantExperimentSettings({
  tenantId,
  actor = {},
  updates = {},
  resetScope = null,
  readSettingFn = null,
  writeSettingFn = null,
  queryFn = pgQuery
}) {
  if (!tenantId || tenantId === '__none__') {
    const err = new Error('Tenant aktif tidak valid untuk menyimpan Fitur Eksperimen.');
    err.status = 400;
    throw err;
  }
  if (!canEditExperimentSettings(actor?.role)) {
    const err = new Error('Hanya Admin / Owner akun ini yang dapat mengubah Fitur Eksperimen.');
    err.status = 403;
    throw err;
  }

  let candidatePayload = updates;
  if (resetScope === 'all') {
    candidatePayload = { ...EXPERIMENT_RECOMMENDED_DEFAULTS };
  } else if (resetScope && EXPERIMENT_CARD_KEYS[resetScope]) {
    candidatePayload = {};
    for (const k of EXPERIMENT_CARD_KEYS[resetScope]) {
      candidatePayload[k] = EXPERIMENT_RECOMMENDED_DEFAULTS[k];
    }
  }

  const validation = validateExperimentSettingsPayload(candidatePayload);
  if (!validation.valid) {
    const err = new Error(validation.errors[0] || 'Nilai Fitur Eksperimen tidak valid.');
    err.status = 400;
    err.details = validation.errors;
    throw err;
  }

  const entries = Object.entries(validation.values);
  if (entries.length === 0) {
    const err = new Error('Tidak ada pengaturan eksperimen yang dikirim.');
    err.status = 400;
    throw err;
  }

  const readSetting = buildTenantReadFn(tenantId, readSettingFn);
  const writeSetting = buildTenantWriteFn(tenantId, writeSettingFn);

  const changes = [];
  for (const [key, nextVal] of entries) {
    const prevRaw = await readSetting(key);
    const prevVal = prevRaw !== null && prevRaw !== undefined ? String(prevRaw) : EXPERIMENT_UNSET_DEFAULTS[key];
    await writeSetting(key, nextVal);
    if (prevVal !== nextVal) {
      changes.push({ key, from: prevVal, to: nextVal });
    }
  }

  if (changes.length > 0) {
    const actorLabel = actor?.username || actor?.email || actor?.id || 'admin';
    const eventPayload = {
      action: resetScope ? `reset_${resetScope}` : 'update',
      actor_label: actorLabel,
      changes
    };
    try {
      await queryFn(
        `INSERT INTO tenant_audit_events (actor_user_id, tenant_id, event_type, event_json)
         VALUES ($1, $2, $3, $4)`,
        [actor?.id || null, tenantId, EXPERIMENT_AUDIT_EVENT_TYPE, JSON.stringify(eventPayload)]
      );
    } catch (auditErr) {
      console.warn('[ExperimentSettings] Non-fatal audit log error:', auditErr.message);
    }
  }

  return {
    updated_count: entries.length,
    changed_count: changes.length,
    changes
  };
}

