/**
 * Single Source of Truth Registry for VO Content Contract & Quality Gate flags.
 * Mirrored across operator presets, MCP tools, API routes, and generation pipelines.
 */

export const VO_CONTENT_CONTRACT_VALUES = Object.freeze(['off', 'on']);
export const VO_QUALITY_GATE_VALUES = Object.freeze(['off', 'warn', 'enforce']);

export const DEFAULT_VO_CONTENT_CONTRACT = 'off';
export const DEFAULT_VO_QUALITY_GATE = 'off';

export const VO_CONTENT_CONTRACT_OPTIONS = Object.freeze([
  { id: 'off', label: 'Off — Mode Naskah Klasik (Default)' },
  { id: 'on', label: 'On — Kontrak Isi VO & Kontrak Resep Sumber Aktif' }
]);

export const VO_QUALITY_GATE_OPTIONS = Object.freeze([
  { id: 'off', label: 'Off — Tanpa Validasi Kualitas VO (Default)' },
  { id: 'warn', label: 'Warn — Hitung Skor & Tampilkan Badge Peringatan' },
  { id: 'enforce', label: 'Enforce — 1x Regenerate Terarah, Blokir Auto-Publish Jika Gagal' }
]);

export function normalizeVoContentContract(value, fallback = DEFAULT_VO_CONTENT_CONTRACT) {
  if (value === true) return 'on';
  if (value === false) return 'off';
  const norm = String(value ?? '').trim().toLowerCase();
  if (VO_CONTENT_CONTRACT_VALUES.includes(norm)) return norm;
  return VO_CONTENT_CONTRACT_VALUES.includes(fallback) ? fallback : DEFAULT_VO_CONTENT_CONTRACT;
}

export function normalizeVoQualityGate(value, fallback = DEFAULT_VO_QUALITY_GATE) {
  const norm = String(value ?? '').trim().toLowerCase();
  if (VO_QUALITY_GATE_VALUES.includes(norm)) return norm;
  return VO_QUALITY_GATE_VALUES.includes(fallback) ? fallback : DEFAULT_VO_QUALITY_GATE;
}

/**
 * Validates and normalizes `vo_content_contract` and `vo_quality_gate` fields
 * from HTTP/MCP request payloads. Returns `{ updates, error, status }`.
 */
export function parseVoOverrideFields(input = {}, { allowNull = false } = {}) {
  const updates = {};
  if (!input || typeof input !== 'object') return { updates, error: null, status: 200 };

  if (input.vo_content_contract !== undefined) {
    if (input.vo_content_contract === null || input.vo_content_contract === '') {
      updates.vo_content_contract = allowNull ? DEFAULT_VO_CONTENT_CONTRACT : DEFAULT_VO_CONTENT_CONTRACT;
    } else if (typeof input.vo_content_contract === 'boolean') {
      updates.vo_content_contract = input.vo_content_contract ? 'on' : 'off';
    } else {
      const raw = String(input.vo_content_contract).trim().toLowerCase();
      if (!VO_CONTENT_CONTRACT_VALUES.includes(raw)) {
        return {
          updates: {},
          error: `vo_content_contract tidak valid ("${input.vo_content_contract}"). Pilihan: ${VO_CONTENT_CONTRACT_VALUES.join(', ')}.`,
          status: 400
        };
      }
      updates.vo_content_contract = raw;
    }
  }

  if (input.vo_quality_gate !== undefined) {
    if (input.vo_quality_gate === null || input.vo_quality_gate === '') {
      updates.vo_quality_gate = allowNull ? DEFAULT_VO_QUALITY_GATE : DEFAULT_VO_QUALITY_GATE;
    } else {
      const raw = String(input.vo_quality_gate).trim().toLowerCase();
      if (!VO_QUALITY_GATE_VALUES.includes(raw)) {
        return {
          updates: {},
          error: `vo_quality_gate tidak valid ("${input.vo_quality_gate}"). Pilihan: ${VO_QUALITY_GATE_VALUES.join(', ')}.`,
          status: 400
        };
      }
      updates.vo_quality_gate = raw;
    }
  }

  return { updates, error: null, status: 200 };
}

/**
 * Resolves effective VO flags with strict precedence:
 * overrides -> campaign/item config -> preset workflow -> safe default ('off').
 */
export function resolveEffectiveVoSettings({ overrides = {}, campaign = {}, preset = {} } = {}) {
  const wf = preset?.workflow || {};
  return {
    vo_content_contract: normalizeVoContentContract(
      overrides?.vo_content_contract ?? campaign?.vo_content_contract ?? wf?.vo_content_contract,
      DEFAULT_VO_CONTENT_CONTRACT
    ),
    vo_quality_gate: normalizeVoQualityGate(
      overrides?.vo_quality_gate ?? campaign?.vo_quality_gate ?? wf?.vo_quality_gate,
      DEFAULT_VO_QUALITY_GATE
    )
  };
}

