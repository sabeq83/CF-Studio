import crypto from 'crypto';
import { tenantContext } from './tenant-context.js';
import { pgQuery } from './db-pg.js';

export class OperatorAuthError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'OperatorAuthError';
    this.code = code;
    this.status = status;
  }
}

function constantTimeEqual(left, right) {
  const leftDigest = crypto.createHash('sha256').update(left).digest();
  const rightDigest = crypto.createHash('sha256').update(right).digest();
  return crypto.timingSafeEqual(leftDigest, rightDigest);
}

const LAST_USED_TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const lastUsedTouchCache = new Map();

export function parseJsonArrayColumn(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.map(v => String(v || '').trim()).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(v => String(v || '').trim()).filter(Boolean) : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function touchCredentialLastUsed(credentialId) {
  if (!credentialId) return;
  const now = Date.now();
  const prev = lastUsedTouchCache.get(credentialId) || 0;
  if (now - prev < LAST_USED_TOUCH_INTERVAL_MS) return;
  lastUsedTouchCache.set(credentialId, now);
  pgQuery('UPDATE operator_credentials SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1', [credentialId]).catch(() => {});
}

export async function resolveOperatorCredentialAccess(credential, overrideReqRaw = null) {
  if (credential.expires_at && new Date(credential.expires_at) < new Date()) {
    throw new OperatorAuthError('Token operator sudah kedaluwarsa.', 'OPERATOR_TOKEN_EXPIRED', 401);
  }
  const scopes = String(credential.scopes || '').split(',').map(value => value.trim()).filter(Boolean);
  const isMaster = scopes.includes('tenant:superadmin')
    || scopes.includes('system:admin')
    || scopes.includes('*')
    || credential.tenant_id === '*';
  const extraTenants = parseJsonArrayColumn(credential.allowed_tenant_ids_json) || [];
  const rawAllowedIds = Array.from(new Set([credential.tenant_id, ...extraTenants].filter(v => v && v !== '*')));

  let allowedTenantIds = rawAllowedIds;
  if (!isMaster && rawAllowedIds.length > 0) {
    const activeRes = await pgQuery(
      `SELECT id FROM tenants WHERE id = ANY($1::text[]) AND status = 'active'`,
      [rawAllowedIds]
    );
    allowedTenantIds = activeRes.rows.map(r => r.id);
  }

  let effectiveTenantId = credential.tenant_id;
  const overrideReq = String(overrideReqRaw || '').trim();
  if (overrideReq) {
    const tenantMatch = await pgQuery(
      `SELECT id FROM tenants WHERE (id = $1 OR slug = $1) AND status = 'active' LIMIT 1`,
      [overrideReq]
    );
    if (isMaster) {
      if (tenantMatch.rowCount > 0) {
        effectiveTenantId = tenantMatch.rows[0].id;
      }
    } else {
      const matchedId = tenantMatch.rows[0]?.id || null;
      if (!matchedId || !allowedTenantIds.includes(matchedId)) {
        throw new OperatorAuthError(
          'Akses ke tenant ini tidak diizinkan untuk kredensial Anda.',
          'TENANT_FORBIDDEN',
          403
        );
      }
      effectiveTenantId = matchedId;
    }
  }

  const allowedTools = parseJsonArrayColumn(credential.allowed_tools_json);
  touchCredentialLastUsed(credential.id);

  return {
    tenantId: effectiveTenantId,
    defaultTenantId: credential.tenant_id,
    actor: credential.id,
    name: credential.name,
    scopes,
    isMaster,
    allowedTenantIds,
    allowedTools,
    expiresAt: credential.expires_at || null
  };
}

export function assertAllowedMcpTool(allowedTools, request) {
  if (!Array.isArray(allowedTools)) return;
  const toolName = String(request?.headers?.get?.('x-mcp-tool') || '').trim();
  if (!toolName || toolName === 'cf_whoami' || toolName === 'makna_whoami') return;
  if (!allowedTools.includes(toolName)) {
    throw new OperatorAuthError(
      `Tool "${toolName}" tidak diizinkan oleh kebijakan kredensial operator Anda.`,
      'TOOL_FORBIDDEN',
      403
    );
  }
}

export function resolveRequiredOperatorScopeForRequest(request) {
  if (!request?.url) return null;
  let pathname = '';
  try {
    pathname = new URL(request.url, 'http://localhost').pathname;
  } catch {
    return null;
  }
  const method = String(request.method || 'GET').toUpperCase();
  if (
    pathname === '/api/v2/tenants'
    || pathname.startsWith('/api/v2/reference-assets')
    || pathname.startsWith('/api/v2/universe-profiles')
    || /\/api\/v2\/visual-identities\/[^/]+\/universe-link/.test(pathname)
  ) {
    return null;
  }

  if (method === 'GET' || method === 'HEAD') {
    return ['content:read', 'automation:read'];
  }
  if (
    pathname.startsWith('/api/v2/recipes/auto-pipeline-schedules')
    || pathname.startsWith('/api/v2/recipes/autonomous-pipeline')
  ) {
    return ['automation:write'];
  }
  if (/\/(approve|reject)$/.test(pathname)) {
    return ['content:approve'];
  }
  if (pathname.startsWith('/api/v2/publishing')) {
    return ['content:approve', 'publishing:approve'];
  }
  return ['content:create', 'automation:write'];
}

export async function authenticateOperator(request, requiredScope = null) {
  const authorization = request?.headers?.get?.('authorization') || '';
  const suppliedToken = authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';
  if (!suppliedToken) {
    throw new OperatorAuthError('Unauthorized.', 'OPERATOR_UNAUTHORIZED', 401);
  }
  const tokenHash = crypto.createHash('sha256').update(suppliedToken).digest('hex');
  const credentialResult = await pgQuery(`
    SELECT c.*
    FROM operator_credentials c
    JOIN tenants t ON t.id = c.tenant_id
    WHERE c.token_hash = $1 AND c.status = 'active' AND t.status = 'active'
    LIMIT 1
  `, [tokenHash]);
  let identity;
  if (credentialResult.rowCount > 0) {
    const overrideReq = request?.headers?.get?.('x-tenant-override') || request?.headers?.get?.('x-tenant-id');
    identity = await resolveOperatorCredentialAccess(credentialResult.rows[0], overrideReq);
  } else {
    const cfToken = process.env.CF_STUDIO_OPERATOR_API_TOKEN || '';
    const maknaToken = process.env.MAKNA_OPERATOR_API_TOKEN || '';
    const overrideReq = (request?.headers?.get?.('x-tenant-override') || request?.headers?.get?.('x-tenant-id') || '').trim();
    if (cfToken && constantTimeEqual(suppliedToken, cfToken)) {
      const envTenantId = process.env.CF_STUDIO_OPERATOR_TENANT_ID || process.env.MAKNA_OPERATOR_TENANT_ID || 'default_tenant';
      if (overrideReq && overrideReq !== envTenantId) {
        throw new OperatorAuthError('Akses ke tenant ini tidak diizinkan untuk kredensial Anda.', 'TENANT_FORBIDDEN', 403);
      }
      identity = {
        tenantId: envTenantId,
        defaultTenantId: envTenantId,
        actor: 'operator-api-cf-studio',
        name: 'CF Studio Environment Credential',
        scopes: ['content:create', 'content:read', 'content:approve', 'automation:read', 'automation:write'],
        isMaster: false,
        allowedTenantIds: [envTenantId],
        allowedTools: null,
        expiresAt: null
      };
    } else if (maknaToken && constantTimeEqual(suppliedToken, maknaToken)) {
      const envTenantId = process.env.MAKNA_OPERATOR_TENANT_ID || 'default_tenant';
      if (overrideReq && overrideReq !== envTenantId) {
        throw new OperatorAuthError('Akses ke tenant ini tidak diizinkan untuk kredensial Anda.', 'TENANT_FORBIDDEN', 403);
      }
      identity = {
        tenantId: envTenantId,
        defaultTenantId: envTenantId,
        actor: 'operator-api-legacy',
        name: 'Legacy Environment Credential',
        scopes: ['content:create', 'content:read', 'content:approve'],
        isMaster: false,
        allowedTenantIds: [envTenantId],
        allowedTools: null,
        expiresAt: null
      };
    }
  }
  if (!identity) {
    throw new OperatorAuthError(
      'Unauthorized.',
      'OPERATOR_UNAUTHORIZED',
      401
    );
  }
  if (requiredScope && !identity.scopes.includes(requiredScope)) {
    throw new OperatorAuthError('Scope operator tidak mencukupi.', 'OPERATOR_SCOPE_FORBIDDEN', 403);
  }
  assertAllowedMcpTool(identity.allowedTools, request);
  return identity;
}

export function runAsOperatorTenant(identity, callback) {
  return tenantContext.run(identity.tenantId, callback);
}

export async function listAccessibleTenantsForUser(user) {
  const isMaster = user?.role === 'superadmin'
    || (Array.isArray(user?.scopes) && (user.scopes.includes('tenant:superadmin') || user.scopes.includes('system:admin')));

  let sql;
  let params = [];
  if (isMaster) {
    sql = `
      SELECT id, name, slug, status, created_at
      FROM tenants
      WHERE status = 'active'
      ORDER BY name ASC
    `;
  } else if (user?.isOperator && Array.isArray(user?.allowedTenantIds) && user.allowedTenantIds.length > 0) {
    sql = `
      SELECT id, name, slug, status, created_at
      FROM tenants
      WHERE id = ANY($1::text[]) AND status = 'active'
      ORDER BY name ASC
    `;
    params = [user.allowedTenantIds];
  } else {
    sql = `
      SELECT id, name, slug, status, created_at
      FROM tenants
      WHERE id = $1 AND status = 'active'
    `;
    params = [user?.tenantId];
  }

  const res = await pgQuery(sql, params);
  return {
    success: true,
    active_tenant: user?.tenantId,
    is_master: isMaster,
    tenants: res.rows
  };
}
