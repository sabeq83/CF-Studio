import crypto from 'crypto';
import { getCurrentUser, getCurrentUserAsync } from './auth.js';
import { pgQuery, withPgTransaction } from './db-pg.js';
import { parseJsonArrayColumn } from './operator-auth.js';

export const OPERATOR_SCOPE_PRESETS = [
  {
    id: 'viewer',
    label: 'Viewer / Auditor',
    description: 'Hanya baca status kampanye, katalog, dan jadwal tanpa mengubah data.',
    scopes: ['content:read', 'automation:read']
  },
  {
    id: 'content_operator',
    label: 'Content Operator',
    description: 'Tambah produk dan buat draft konten/video tanpa atur jadwal atau publish.',
    scopes: ['content:read', 'content:create', 'automation:read']
  },
  {
    id: 'full_tenant_operator',
    label: 'Full Tenant Operator',
    description: 'Tambah produk, buat video, kelola jadwal Auto Pipeline, dan publish Repliz di tenant izin.',
    scopes: [
      'content:read',
      'content:create',
      'content:approve',
      'automation:read',
      'automation:write',
      'publishing:approve',
      'product_research:read'
    ]
  },
  {
    id: 'master_superadmin',
    label: 'Master Superadmin',
    description: 'Akses penuh lintas seluruh tenant aktif di server.',
    scopes: [
      'content:read',
      'content:create',
      'content:approve',
      'automation:read',
      'automation:write',
      'publishing:approve',
      'product_research:read',
      'product_research:mcp_promote',
      'tenant:superadmin'
    ]
  }
];

export const ALL_OPERATOR_SCOPES = [
  'content:read',
  'content:create',
  'content:approve',
  'automation:read',
  'automation:write',
  'publishing:approve',
  'product_research:read',
  'product_research:mcp_promote',
  'product_research:ingest',
  'research:read',
  'tenant:superadmin'
];

export const MCP_TOOL_CATALOG_PREVIEW = [
  'cf_whoami',
  'cf_list_tenants',
  'cf_switch_tenant',
  'cf_search_catalog',
  'cf_list_presets',
  'cf_add_product',
  'cf_scrape_product_url',
  'cf_get_scrape_status',
  'cf_upload_product_photo',
  'cf_regenerate_product_photo',
  'cf_enrich_product',
  'cf_get_product_detail',
  'cf_update_product',
  'cf_list_radar_candidates',
  'cf_submit_radar_candidates',
  'cf_create_product_video',
  'cf_create_editorial_video',
  'cf_create_recipe_video',
  'cf_create_multiplier_video',
  'cf_create_recipe_labs_post',
  'cf_submit_custom_storyboard',
  'cf_run_auto_pipeline',
  'cf_list_schedules',
  'cf_create_schedule',
  'cf_update_schedule',
  'cf_toggle_schedule_pause',
  'cf_delete_schedule',
  'cf_trigger_schedule_now',
  'cf_get_job_status',
  'cf_approve_job',
  'cf_list_publishing_accounts',
  'cf_create_publishing_job',
  'cf_publish_storyboard',
  'cf_list_publishing_jobs',
  'cf_list_universes',
  'cf_get_universe',
  'cf_upload_reference_asset',
  'cf_approve_reference_asset'
];

export async function requireWebSuperadmin(request) {
  let user = getCurrentUser(request);
  if (!user) {
    try {
      user = await getCurrentUserAsync(request);
    } catch (err) {
      if (err?.name === 'OperatorAuthError') {
        user = null;
      } else {
        throw err;
      }
    }
  }
  if (!user) {
    const err = new Error('Unauthorized. Silakan login terlebih dahulu.');
    err.status = 401;
    throw err;
  }
  if (user.role !== 'superadmin' || user.isOperator) {
    const err = new Error('Akses ditolak. Khusus sesi web Superadmin.');
    err.status = 403;
    throw err;
  }
  return user;
}

function normalizeScopes(rawScopes) {
  const list = Array.isArray(rawScopes)
    ? rawScopes
    : String(rawScopes || '').split(',');
  const cleaned = Array.from(new Set(list.map(s => String(s || '').trim()).filter(Boolean)));
  if (cleaned.length === 0) {
    const err = new Error('Minimal satu scope operator wajib dipilih.');
    err.status = 400;
    throw err;
  }
  return cleaned;
}

function normalizeAllowedTools(rawTools) {
  if (rawTools === undefined || rawTools === null) return null;
  if (!Array.isArray(rawTools)) {
    const err = new Error('allowed_tools harus berupa array nama tool atau null.');
    err.status = 400;
    throw err;
  }
  const cleaned = Array.from(new Set(rawTools.map(t => String(t || '').trim()).filter(Boolean)));
  return cleaned;
}

function normalizeExpiresAt(rawExpires) {
  if (rawExpires === undefined || rawExpires === null || String(rawExpires).trim() === '') {
    return null;
  }
  const parsed = new Date(rawExpires);
  if (Number.isNaN(parsed.getTime())) {
    const err = new Error('Format tanggal masa berlaku (expires_at) tidak valid.');
    err.status = 400;
    throw err;
  }
  return parsed.toISOString();
}

function formatCredentialRow(row) {
  const scopes = String(row.scopes || '').split(',').map(s => s.trim()).filter(Boolean);
  const allowedTenantIds = parseJsonArrayColumn(row.allowed_tenant_ids_json) || [];
  const allowedTools = parseJsonArrayColumn(row.allowed_tools_json);
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    default_tenant_name: row.default_tenant_name || row.tenant_id,
    name: row.name,
    scopes,
    is_master: scopes.includes('tenant:superadmin') || scopes.includes('system:admin') || row.tenant_id === '*',
    allowed_tenant_ids: allowedTenantIds,
    allowed_tools: allowedTools,
    status: row.status,
    expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    last_used_at: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
    notes: row.notes || '',
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null
  };
}

function generateOperatorToken() {
  return `cfop_${crypto.randomBytes(32).toString('hex')}`;
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

async function assertValidTenants(client, defaultTenantId, allowedTenantIds) {
  const toCheck = Array.from(new Set([defaultTenantId, ...allowedTenantIds].filter(Boolean)));
  const res = await client.query(
    `SELECT id, status FROM tenants WHERE id = ANY($1::text[])`,
    [toCheck]
  );
  const byId = new Map(res.rows.map(r => [r.id, r.status]));
  if (!byId.has(defaultTenantId) || byId.get(defaultTenantId) !== 'active') {
    const err = new Error('Default tenant tidak ditemukan atau tidak aktif.');
    err.status = 400;
    throw err;
  }
  for (const tid of allowedTenantIds) {
    if (!byId.has(tid) || byId.get(tid) !== 'active') {
      const err = new Error(`Tenant allowlist "${tid}" tidak ditemukan atau tidak aktif.`);
      err.status = 400;
      throw err;
    }
  }
}

let schemaEnsured = false;

export async function ensureOperatorCredentialsSchema() {
  if (schemaEnsured) return;
  await pgQuery(`
    ALTER TABLE operator_credentials
      ADD COLUMN IF NOT EXISTS allowed_tenant_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS allowed_tools_json JSONB,
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS notes TEXT;
  `);
  schemaEnsured = true;
}

export async function listOperatorCredentials() {
  await ensureOperatorCredentialsSchema();
  const [credRes, tenantRes] = await Promise.all([
    pgQuery(`
      SELECT
        c.id, c.tenant_id, t.name AS default_tenant_name,
        c.name, c.scopes, c.allowed_tenant_ids_json, c.allowed_tools_json,
        c.status, c.expires_at, c.last_used_at, c.notes, c.created_at, c.updated_at
      FROM operator_credentials c
      LEFT JOIN tenants t ON t.id = c.tenant_id
      ORDER BY c.created_at DESC
    `),
    pgQuery(`
      SELECT id, name, slug, status
      FROM tenants
      WHERE status = 'active'
      ORDER BY name ASC
    `)
  ]);

  return {
    credentials: credRes.rows.map(formatCredentialRow),
    tenants: tenantRes.rows,
    presets: OPERATOR_SCOPE_PRESETS,
    available_scopes: ALL_OPERATOR_SCOPES,
    sample_tools: MCP_TOOL_CATALOG_PREVIEW
  };
}

export async function createOperatorCredential(input, actor) {
  await ensureOperatorCredentialsSchema();
  const name = String(input?.name || '').trim();
  const tenantId = String(input?.tenant_id || 'default_tenant').trim();
  const status = input?.status === 'revoked' ? 'revoked' : 'active';
  const notes = input?.notes ? String(input.notes).trim() : null;
  if (!name) {
    const err = new Error('Nama PC atau operator wajib diisi.');
    err.status = 400;
    throw err;
  }
  const scopes = normalizeScopes(input?.scopes);
  const rawAllowed = Array.isArray(input?.allowed_tenant_ids) ? input.allowed_tenant_ids : [];
  const allowedTenantIds = Array.from(new Set(rawAllowed.map(v => String(v || '').trim()).filter(v => v && v !== tenantId)));
  const allowedTools = normalizeAllowedTools(input?.allowed_tools);
  const expiresAt = normalizeExpiresAt(input?.expires_at);

  const id = `opcred_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
  const rawToken = generateOperatorToken();
  const tokenHash = hashToken(rawToken);

  return withPgTransaction(async client => {
    await assertValidTenants(client, tenantId, allowedTenantIds);
    const res = await client.query(`
      INSERT INTO operator_credentials (
        id, tenant_id, name, token_hash, scopes,
        allowed_tenant_ids_json, allowed_tools_json, expires_at, notes, status,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      id,
      tenantId,
      name,
      tokenHash,
      scopes.join(','),
      JSON.stringify(allowedTenantIds),
      allowedTools ? JSON.stringify(allowedTools) : null,
      expiresAt,
      notes,
      status
    ]);

    await client.query(
      `INSERT INTO tenant_audit_events (actor_user_id, tenant_id, event_type, event_json)
       VALUES ($1, $2, 'operator_credential.created', $3)`,
      [actor.id, tenantId, JSON.stringify({ credential_id: id, name, allowed_tenant_ids: allowedTenantIds, scopes })]
    );

    const tRow = await client.query(`SELECT name FROM tenants WHERE id = $1 LIMIT 1`, [tenantId]);
    return {
      credential: formatCredentialRow({ ...res.rows[0], default_tenant_name: tRow.rows[0]?.name || tenantId }),
      token: rawToken
    };
  });
}

export async function updateOperatorCredential(id, updates, actor) {
  await ensureOperatorCredentialsSchema();
  const credId = String(id || '').trim();
  if (!credId) {
    const err = new Error('ID kredensial wajib diisi.');
    err.status = 400;
    throw err;
  }

  return withPgTransaction(async client => {
    const existingRes = await client.query(`SELECT * FROM operator_credentials WHERE id = $1 LIMIT 1`, [credId]);
    if (existingRes.rowCount === 0) {
      const err = new Error('Kredensial operator tidak ditemukan.');
      err.status = 404;
      throw err;
    }
    const existing = existingRes.rows[0];

    const name = updates?.name !== undefined ? String(updates.name || '').trim() : existing.name;
    if (!name) {
      const err = new Error('Nama PC atau operator tidak boleh kosong.');
      err.status = 400;
      throw err;
    }
    const tenantId = updates?.tenant_id !== undefined ? String(updates.tenant_id || '').trim() : existing.tenant_id;
    const scopes = updates?.scopes !== undefined
      ? normalizeScopes(updates.scopes)
      : String(existing.scopes || '').split(',').map(s => s.trim()).filter(Boolean);
    const existingAllowed = parseJsonArrayColumn(existing.allowed_tenant_ids_json) || [];
    const nextAllowedRaw = updates?.allowed_tenant_ids !== undefined
      ? (Array.isArray(updates.allowed_tenant_ids) ? updates.allowed_tenant_ids : [])
      : existingAllowed;
    const allowedTenantIds = Array.from(new Set(nextAllowedRaw.map(v => String(v || '').trim()).filter(v => v && v !== tenantId)));

    const allowedTools = updates?.allowed_tools !== undefined
      ? normalizeAllowedTools(updates.allowed_tools)
      : parseJsonArrayColumn(existing.allowed_tools_json);

    const expiresAt = updates?.expires_at !== undefined
      ? normalizeExpiresAt(updates.expires_at)
      : (existing.expires_at ? new Date(existing.expires_at).toISOString() : null);

    let status = existing.status;
    if (updates?.status !== undefined) {
      if (!['active', 'revoked'].includes(updates.status)) {
        const err = new Error('Status kredensial hanya boleh active atau revoked.');
        err.status = 400;
        throw err;
      }
      status = updates.status;
    }

    const notes = updates?.notes !== undefined ? (updates.notes ? String(updates.notes).trim() : null) : existing.notes;

    await assertValidTenants(client, tenantId, allowedTenantIds);

    const updatedRes = await client.query(`
      UPDATE operator_credentials
      SET name = $2,
          tenant_id = $3,
          scopes = $4,
          allowed_tenant_ids_json = $5::jsonb,
          allowed_tools_json = $6::jsonb,
          expires_at = $7,
          status = $8,
          notes = $9,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [
      credId,
      name,
      tenantId,
      scopes.join(','),
      JSON.stringify(allowedTenantIds),
      allowedTools ? JSON.stringify(allowedTools) : null,
      expiresAt,
      status,
      notes
    ]);

    await client.query(
      `INSERT INTO tenant_audit_events (actor_user_id, tenant_id, event_type, event_json)
       VALUES ($1, $2, 'operator_credential.updated', $3)`,
      [actor.id, tenantId, JSON.stringify({ credential_id: credId, status, allowed_tenant_ids: allowedTenantIds, scopes })]
    );

    const tRow = await client.query(`SELECT name FROM tenants WHERE id = $1 LIMIT 1`, [tenantId]);
    return {
      credential: formatCredentialRow({ ...updatedRes.rows[0], default_tenant_name: tRow.rows[0]?.name || tenantId })
    };
  });
}

export async function rotateOperatorCredentialToken(id, actor) {
  await ensureOperatorCredentialsSchema();
  const credId = String(id || '').trim();
  const rawToken = generateOperatorToken();
  const tokenHash = hashToken(rawToken);

  return withPgTransaction(async client => {
    const res = await client.query(`
      UPDATE operator_credentials
      SET token_hash = $2,
          status = 'active',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [credId, tokenHash]);
    if (res.rowCount === 0) {
      const err = new Error('Kredensial operator tidak ditemukan.');
      err.status = 404;
      throw err;
    }
    const row = res.rows[0];
    await client.query(
      `INSERT INTO tenant_audit_events (actor_user_id, tenant_id, event_type, event_json)
       VALUES ($1, $2, 'operator_credential.rotated', $3)`,
      [actor.id, row.tenant_id, JSON.stringify({ credential_id: credId, name: row.name })]
    );
    const tRow = await client.query(`SELECT name FROM tenants WHERE id = $1 LIMIT 1`, [row.tenant_id]);
    return {
      credential: formatCredentialRow({ ...row, default_tenant_name: tRow.rows[0]?.name || row.tenant_id }),
      token: rawToken
    };
  });
}

export async function deleteOperatorCredential(id, actor) {
  const credId = String(id || '').trim();
  return withPgTransaction(async client => {
    const res = await client.query(
      `DELETE FROM operator_credentials WHERE id = $1 RETURNING id, tenant_id, name`,
      [credId]
    );
    if (res.rowCount === 0) {
      const err = new Error('Kredensial operator tidak ditemukan.');
      err.status = 404;
      throw err;
    }
    const row = res.rows[0];
    await client.query(
      `INSERT INTO tenant_audit_events (actor_user_id, tenant_id, event_type, event_json)
       VALUES ($1, $2, 'operator_credential.deleted', $3)`,
      [actor.id, row.tenant_id, JSON.stringify({ credential_id: credId, name: row.name })]
    );
    return { deleted: true, id: credId };
  });
}
