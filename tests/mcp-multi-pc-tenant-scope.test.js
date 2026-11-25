process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const { pgQuery, closePgPool } = await import('../lib/db-pg.js');
const {
  authenticateOperator,
  OperatorAuthError,
  listAccessibleTenantsForUser
} = await import('../lib/operator-auth.js');
const { withTenantContext } = await import('../lib/auth.js');
const {
  ensureOperatorCredentialsSchema,
  createOperatorCredential,
  updateOperatorCredential,
  rotateOperatorCredentialToken,
  deleteOperatorCredential,
  listOperatorCredentials,
  requireWebSuperadmin
} = await import('../lib/operator-credentials-admin.js');

function makeRequest(url, { method = 'GET', token, tenantOverride, mcpTool, body } = {}) {
  const headers = new Headers();
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (tenantOverride) headers.set('x-tenant-override', tenantOverride);
  if (mcpTool) headers.set('x-mcp-tool', mcpTool);
  if (body) headers.set('content-type', 'application/json');
  return new Request(url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {})
  });
}

const tenantsHandler = withTenantContext(async (_req, _ctx, user) => {
  const payload = await listAccessibleTenantsForUser(user);
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});

const schedulesPostHandler = withTenantContext(async () => {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
});

test('Multi-PC MCP Tenant Allowlist, Scope Guard, Real-Time Edit, Rotate & Revoke (8 Acceptance Scenarios)', async t => {
  await ensureOperatorCredentialsSchema();

  const suffix = `${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`;
  const tntA = `tnt_test_a_${suffix}`;
  const tntB = `tnt_test_b_${suffix}`;
  const tntC = `tnt_test_c_${suffix}`;
  const actor = { id: 'usr_superadmin_test' };
  const createdCredIds = [];

  await pgQuery(
    `INSERT INTO tenants (id, name, slug, timezone, status)
     VALUES ($1, $2, $3, 'Asia/Jakarta', 'active'),
            ($4, $5, $6, 'Asia/Jakarta', 'active'),
            ($7, $8, $9, 'Asia/Jakarta', 'active')`,
    [
      tntA, `Test Tenant A ${suffix}`, `test-a-${suffix}`,
      tntB, `Test Tenant B ${suffix}`, `test-b-${suffix}`,
      tntC, `Test Tenant C ${suffix}`, `test-c-${suffix}`
    ]
  );

  t.after(async () => {
    for (const cid of createdCredIds) {
      await pgQuery(`DELETE FROM operator_credentials WHERE id = $1`, [cid]).catch(() => {});
    }
    await pgQuery(`DELETE FROM tenant_audit_events WHERE tenant_id = ANY($1::text[])`, [[tntA, tntB, tntC]]).catch(() => {});
    await pgQuery(`DELETE FROM tenants WHERE id = ANY($1::text[])`, [[tntA, tntB, tntC]]).catch(() => {});
    await closePgPool();
  });

  // Create limited multi-tenant credential (tntA + tntB, viewer scope)
  const limitedCreated = await createOperatorCredential({
    name: `PC Tim B ${suffix}`,
    tenant_id: tntA,
    allowed_tenant_ids: [tntB],
    scopes: ['content:read', 'automation:read'],
    allowed_tools: ['cf_whoami', 'cf_list_tenants', 'cf_switch_tenant', 'cf_list_schedules'],
    notes: 'Integration test limited PC'
  }, actor);
  createdCredIds.push(limitedCreated.credential.id);
  const limitedToken = limitedCreated.token;
  assert.ok(limitedToken.startsWith('cfop_'));

  // 1. cf_list_tenants returns ONLY tntA and tntB (not default_tenant or tntC)
  const listRes = await tenantsHandler(makeRequest('http://localhost/api/v2/tenants', { token: limitedToken }), {});
  assert.equal(listRes.status, 200);
  const listBody = await listRes.json();
  assert.equal(listBody.is_master, false);
  assert.deepEqual(listBody.tenants.map(x => x.id).sort(), [tntA, tntB].sort());

  // 2. Switch to tntB (in allowlist) succeeds
  const switchBRes = await tenantsHandler(makeRequest('http://localhost/api/v2/tenants', {
    token: limitedToken,
    tenantOverride: tntB
  }), {});
  assert.equal(switchBRes.status, 200);
  const switchBBody = await switchBRes.json();
  assert.equal(switchBBody.active_tenant, tntB);

  // 3. Force switch to tntC or default_tenant is strictly rejected with 403 TENANT_FORBIDDEN
  const forbiddenRes = await tenantsHandler(makeRequest('http://localhost/api/v2/tenants', {
    token: limitedToken,
    tenantOverride: tntC
  }), {});
  assert.equal(forbiddenRes.status, 403);
  const forbiddenBody = await forbiddenRes.json();
  assert.equal(forbiddenBody.code, 'TENANT_FORBIDDEN');

  await assert.rejects(
    () => authenticateOperator(makeRequest('http://localhost/api/operator/v1/whoami', {
      token: limitedToken,
      tenantOverride: 'default_tenant'
    })),
    err => err instanceof OperatorAuthError && err.code === 'TENANT_FORBIDDEN' && err.status === 403
  );

  // 4. Real-time edit: remove tntB from allowlist -> next request to tntB immediately returns 403
  await updateOperatorCredential(limitedCreated.credential.id, { allowed_tenant_ids: [] }, actor);
  const afterRemoveRes = await tenantsHandler(makeRequest('http://localhost/api/v2/tenants', {
    token: limitedToken,
    tenantOverride: tntB
  }), {});
  assert.equal(afterRemoveRes.status, 403);
  const afterRemoveBody = await afterRemoveRes.json();
  assert.equal(afterRemoveBody.code, 'TENANT_FORBIDDEN');

  // 5. Viewer token (content:read, automation:read) attempting cf_create_schedule is rejected 403 OPERATOR_SCOPE_FORBIDDEN
  const viewerSchedRes = await schedulesPostHandler(makeRequest('http://localhost/api/v2/recipes/auto-pipeline-schedules', {
    method: 'POST',
    token: limitedToken,
    body: { name: 'Should Be Blocked' }
  }), {});
  assert.equal(viewerSchedRes.status, 403);
  const viewerSchedBody = await viewerSchedRes.json();
  assert.equal(viewerSchedBody.code, 'OPERATOR_SCOPE_FORBIDDEN');

  // 5b. allowed_tools restriction rejects unlisted x-mcp-tool with 403 TOOL_FORBIDDEN
  const toolForbiddenHandler = withTenantContext(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
  const toolDeniedRes = await toolForbiddenHandler(makeRequest('http://localhost/api/v2/products', {
    method: 'GET',
    token: limitedToken,
    mcpTool: 'cf_add_product'
  }), {});
  assert.equal(toolDeniedRes.status, 403);
  assert.equal((await toolDeniedRes.json()).code, 'TOOL_FORBIDDEN');

  // 6. Revoke -> immediately rejected 401; rotate -> old token dead, new token works
  await updateOperatorCredential(limitedCreated.credential.id, { status: 'revoked' }, actor);
  const revokedRes = await tenantsHandler(makeRequest('http://localhost/api/v2/tenants', { token: limitedToken }), {});
  assert.equal(revokedRes.status, 401);

  const rotated = await rotateOperatorCredentialToken(limitedCreated.credential.id, actor);
  assert.notEqual(rotated.token, limitedToken);
  const oldAfterRotate = await tenantsHandler(makeRequest('http://localhost/api/v2/tenants', { token: limitedToken }), {});
  assert.equal(oldAfterRotate.status, 401);
  const newAfterRotate = await tenantsHandler(makeRequest('http://localhost/api/v2/tenants', { token: rotated.token }), {});
  assert.equal(newAfterRotate.status, 200);

  // 6b. Expired token -> 401 OPERATOR_TOKEN_EXPIRED
  await updateOperatorCredential(limitedCreated.credential.id, {
    expires_at: new Date(Date.now() - 60_000).toISOString()
  }, actor);
  await assert.rejects(
    () => authenticateOperator(makeRequest('http://localhost/api/operator/v1/whoami', { token: rotated.token })),
    err => err instanceof OperatorAuthError && err.code === 'OPERATOR_TOKEN_EXPIRED' && err.status === 401
  );

  // 7. Master Superadmin credential still accesses all active tenants including tntC
  const masterCreated = await createOperatorCredential({
    name: `Master Test ${suffix}`,
    tenant_id: tntA,
    scopes: ['content:read', 'content:create', 'content:approve', 'automation:read', 'automation:write', 'tenant:superadmin']
  }, actor);
  createdCredIds.push(masterCreated.credential.id);

  const masterList = await tenantsHandler(makeRequest('http://localhost/api/v2/tenants', {
    token: masterCreated.token,
    tenantOverride: tntC
  }), {});
  assert.equal(masterList.status, 200);
  const masterBody = await masterList.json();
  assert.equal(masterBody.is_master, true);
  assert.equal(masterBody.active_tenant, tntC);
  assert.ok(masterBody.tenants.some(x => x.id === tntC));

  // 7b. Operator token (even master) is rejected by requireWebSuperadmin with 403
  await assert.rejects(
    () => requireWebSuperadmin(makeRequest('http://localhost/api/v2/operator-credentials', { token: masterCreated.token })),
    err => err.status === 403
  );

  // 8. Admin listing never leaks token_hash or raw token, and delete works
  const adminListing = await listOperatorCredentials();
  const row = adminListing.credentials.find(c => c.id === limitedCreated.credential.id);
  assert.ok(row);
  assert.equal('token_hash' in row, false);
  assert.equal('token' in row, false);

  const deleted = await deleteOperatorCredential(limitedCreated.credential.id, actor);
  assert.equal(deleted.deleted, true);
});
