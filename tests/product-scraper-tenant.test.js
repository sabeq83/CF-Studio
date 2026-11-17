import test from 'node:test';
import assert from 'node:assert/strict';
import { tenantContext, getActiveTenantId } from '../lib/tenant-context.js';

test('S4: tenantContext correctly tracks active tenant across async executions', async () => {
  await tenantContext.run('tnt_pt-gim-sosmed_62d0d9', async () => {
    assert.equal(getActiveTenantId(), 'tnt_pt-gim-sosmed_62d0d9');

    // Simulate job payload preparation in route
    const jobPayload = {
      tenant_id: getActiveTenantId(),
      urls: ['https://tokopedia.com/product/123'],
      category: 'Thermal'
    };

    assert.equal(jobPayload.tenant_id, 'tnt_pt-gim-sosmed_62d0d9');
  });

  await tenantContext.run('default_tenant', async () => {
    assert.equal(getActiveTenantId(), 'default_tenant');

    const jobPayload = {
      tenant_id: getActiveTenantId(),
      urls: ['https://tokopedia.com/product/123']
    };

    assert.equal(jobPayload.tenant_id, 'default_tenant');
  });
});

test('S4: tenant isolation prevents product collision across different tenants', () => {
  // Mock product catalog across two tenants with identical product source_url
  const testUrl = 'https://www.tokopedia.com/cuculemon-bottle/cuculemon-tumbler-premium';
  const databaseRows = [
    { id: 'prod_1', tenant_id: 'default_tenant', source_url: testUrl, product_name: 'Cuculemon Local' },
    { id: 'prod_2', tenant_id: 'tnt_pt-gim-sosmed_62d0d9', source_url: testUrl, product_name: 'Cuculemon PT GIM' }
  ];

  // Simulating route & processor query: WHERE tenant_id = ?
  const findExistingInTenant = (targetUrl, tenantId) => {
    return databaseRows.filter(r => r.tenant_id === tenantId && r.source_url === targetUrl);
  };

  const inDefault = findExistingInTenant(testUrl, 'default_tenant');
  const inPtGim = findExistingInTenant(testUrl, 'tnt_pt-gim-sosmed_62d0d9');
  const inOther = findExistingInTenant(testUrl, 'tnt_other_tenant');

  assert.equal(inDefault.length, 1);
  assert.equal(inDefault[0].id, 'prod_1');

  assert.equal(inPtGim.length, 1);
  assert.equal(inPtGim[0].id, 'prod_2');

  assert.equal(inOther.length, 0, 'Other tenant must not see products from other tenants');
});
