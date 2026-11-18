#!/usr/bin/env node
/**
 * Dry-run read-only audit script comparing effective Gemini models per tenant × task
 * before and after the centralized model resolver change.
 * Usage: node scripts/report-effective-gemini-models.mjs --schema dev|staging
 */

import pg from 'pg';

const args = process.argv.slice(2);
const schemaIdx = args.indexOf('--schema');
const schema = schemaIdx !== -1 && args[schemaIdx + 1] ? args[schemaIdx + 1].trim() : 'staging';

if (!['dev', 'staging', 'public'].includes(schema)) {
  console.error(`Invalid schema "${schema}". Expected dev | staging | public.`);
  process.exit(1);
}

const PG_CONFIG = {
  host: process.env.PG_HOST || '100.78.186.123',
  port: Number(process.env.PG_PORT || 5432),
  database: process.env.PG_DATABASE || 'maknaflow_db',
  user: process.env.PG_USER || 'makna_user',
  password: process.env.PG_PASSWORD || 'maknagridpass',
  max: 1
};

const DEAD_MODELS = new Set(['gemini-1.5-flash', 'gemini-1.5-flash-8b']);
const DEFAULT_TEXT_MODEL = 'gemini-3.6-flash';

function sanitize(v) {
  const s = String(v || '').trim();
  return !s || DEAD_MODELS.has(s) ? '' : s;
}

function oldModelForTask(cfg, taskKey) {
  const tier = cfg.gemini_api_tier || 'paid';
  const smart = cfg.gemini_smart_routing !== 'off';
  const primary = String(cfg.gemini_model_primary || '').trim() || DEFAULT_TEXT_MODEL;

  switch (taskKey) {
    case 'campaign_creative':
      return primary;
    case 'product_enrichment':
      return smart ? (tier === 'paid' ? 'gemini-1.5-flash-8b' : DEFAULT_TEXT_MODEL) : primary;
    case 'scraper':
      return smart ? (tier === 'paid' ? 'gemini-1.5-flash-8b' : DEFAULT_TEXT_MODEL) : primary;
    case 'compliance_deconstruct':
      return smart ? (tier === 'paid' ? 'gemini-2.5-flash' : DEFAULT_TEXT_MODEL) : primary;
    case 'brand_extract':
      return 'gemini-2.5-flash (hardcoded)';
    case 're_recomm':
      return 'gemini-3.6-flash (GEMINI_MODELS.PRIMARY)';
    case 'vision_qc':
      return cfg.start_frame_visual_qc_model || DEFAULT_TEXT_MODEL;
    default:
      return primary;
  }
}

function newModelForTask(cfg, taskKey) {
  const smart = cfg.gemini_smart_routing !== 'off';
  const primary = sanitize(cfg.gemini_model_primary) || DEFAULT_TEXT_MODEL;
  const light = (smart && sanitize(cfg.gemini_model_light)) ? sanitize(cfg.gemini_model_light) : primary;
  const vision = sanitize(cfg.start_frame_visual_qc_model) || light;

  switch (taskKey) {
    case 'campaign_creative':
    case 're_recomm':
      return primary;
    case 'product_enrichment':
    case 'scraper':
    case 'compliance_deconstruct':
    case 'brand_extract':
      return light;
    case 'vision_qc':
      return vision;
    default:
      return primary;
  }
}

const TASKS = [
  { key: 'campaign_creative', label: 'Kampanye / Storyboard (primary)' },
  { key: 'product_enrichment', label: 'Enrichment Produk (light)' },
  { key: 'scraper', label: 'Scraper Produk (light)' },
  { key: 'compliance_deconstruct', label: 'Compliance / Deconstruct (light)' },
  { key: 'brand_extract', label: 'Ekstrak Brand Profile (light)' },
  { key: 're_recomm', label: 'RE Grounding Sourcing (primary)' },
  { key: 'vision_qc', label: 'Start-Frame Visual QC (vision)' }
];

const SETTING_KEYS = [
  'gemini_api_tier',
  'gemini_model_primary',
  'gemini_model_fallback',
  'gemini_model_light',
  'gemini_smart_routing',
  'start_frame_visual_qc_model'
];

const pool = new pg.Pool(PG_CONFIG);
try {
  const tenantsRes = await pool.query(`SELECT id, name FROM ${schema}.tenants ORDER BY id`);
  const settingsRes = await pool.query(
    `SELECT tenant_id, setting_key, setting_value FROM ${schema}.tenant_settings WHERE setting_key = ANY($1::text[])`,
    [SETTING_KEYS]
  );

  const byTenant = new Map();
  for (const row of tenantsRes.rows) {
    byTenant.set(row.id, { id: row.id, name: row.name, settings: {} });
  }
  for (const row of settingsRes.rows) {
    if (!byTenant.has(row.tenant_id)) {
      byTenant.set(row.tenant_id, { id: row.tenant_id, name: row.tenant_id, settings: {} });
    }
    byTenant.get(row.tenant_id).settings[row.setting_key] = row.setting_value;
  }

  console.log(`\nSchema: ${schema} (read-only)\n`);
  console.log('| Tenant | Tier | Smart Routing | Tugas | Model Sebelum | Model Sesudah | Status |');
  console.log('|---|---|---|---|---|---|---|');

  for (const tenant of byTenant.values()) {
    const cfg = tenant.settings;
    const tier = cfg.gemini_api_tier || 'paid(default)';
    const sr = cfg.gemini_smart_routing || 'on(default)';
    for (const task of TASKS) {
      const before = oldModelForTask(cfg, task.key);
      const after = newModelForTask(cfg, task.key);
      const changed = before !== after ? 'BERUBAH' : 'Sama';
      console.log(`| ${tenant.id} (${tenant.name}) | ${tier} | ${sr} | ${task.label} | ${before} | ${after} | ${changed} |`);
    }
  }
} finally {
  await pool.end();
}
