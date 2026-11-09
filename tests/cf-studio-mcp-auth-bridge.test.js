process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

import test from 'node:test';
import assert from 'node:assert/strict';
import { getCurrentUserAsync, withTenantContext } from '../lib/auth.js';
import { authenticateOperator } from '../lib/operator-auth.js';
import { closePgPool } from '../lib/db-pg.js';

test('operator-auth recognizes CF_STUDIO_OPERATOR_API_TOKEN', async () => {
  const origToken = process.env.CF_STUDIO_OPERATOR_API_TOKEN;
  const origTenant = process.env.CF_STUDIO_OPERATOR_TENANT_ID;

  try {
    process.env.CF_STUDIO_OPERATOR_API_TOKEN = 'MOCK_CF_STUDIO_OPERATOR_TOKEN_99999';
    process.env.CF_STUDIO_OPERATOR_TENANT_ID = 'test_tenant_cfs';

    const req = {
      headers: {
        get: (h) => (h === 'authorization' ? 'Bearer MOCK_CF_STUDIO_OPERATOR_TOKEN_99999' : null)
      }
    };

    const identity = await authenticateOperator(req, 'content:create');
    assert.equal(identity.tenantId, 'test_tenant_cfs');
    assert.equal(identity.name, 'CF Studio Environment Credential');
    assert.ok(identity.scopes.includes('automation:read'));
    assert.ok(identity.scopes.includes('automation:write'));
  } finally {
    process.env.CF_STUDIO_OPERATOR_API_TOKEN = origToken;
    process.env.CF_STUDIO_OPERATOR_TENANT_ID = origTenant;
  }
});

test('getCurrentUserAsync bridges operator token in withTenantContext', async () => {
  const origToken = process.env.CF_STUDIO_OPERATOR_API_TOKEN;
  const origTenant = process.env.CF_STUDIO_OPERATOR_TENANT_ID;

  try {
    process.env.CF_STUDIO_OPERATOR_API_TOKEN = 'MOCK_CF_STUDIO_OPERATOR_TOKEN_88888';
    process.env.CF_STUDIO_OPERATOR_TENANT_ID = 'test_tenant_bridge';

    const req = {
      headers: {
        get: (h) => (h === 'authorization' ? 'Bearer MOCK_CF_STUDIO_OPERATOR_TOKEN_88888' : null)
      }
    };

    const user = await getCurrentUserAsync(req);
    assert.ok(user);
    assert.equal(user.isOperator, true);
    assert.equal(user.tenantId, 'test_tenant_bridge');
    assert.equal(user.role, 'admin');

    // Test withTenantContext wrapper (passing request and context as Next.js does)
    let handlerCalled = false;
    let receivedTenant = null;

    const wrappedHandler = withTenantContext(async (_req, _ctx, u) => {
      handlerCalled = true;
      receivedTenant = u?.tenantId;
      return new Response(JSON.stringify({ success: true, tenant: u?.tenantId }), { status: 200 });
    });

    const res = await wrappedHandler(req, {});
    assert.equal(res.status, 200);
    assert.equal(handlerCalled, true);
    assert.equal(receivedTenant, 'test_tenant_bridge');
  } finally {
    process.env.CF_STUDIO_OPERATOR_API_TOKEN = origToken;
    process.env.CF_STUDIO_OPERATOR_TENANT_ID = origTenant;
    try {
      await closePgPool();
    } catch (_) {}
  }
});
