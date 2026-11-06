import assert from 'assert';
import { getEffectiveStagingProvider, verifyPublishingStagingReady } from '../lib/publishing-drive-staging.js';
import { tenantContext } from '../lib/tenant-context.js';
import { setSetting, getSetting } from '../lib/db.js';

async function runDualStagingTests() {
  console.log('🧪 Starting Dual Staging Provider (R2 vs Google Drive) Tests...');

  await tenantContext.run('test_staging_tenant', async () => {
    // Test 1: Explicit 'cloudflare_r2' setting
    await setSetting('repliz_media_staging_provider', 'cloudflare_r2');
    const provider1 = await getEffectiveStagingProvider('test_staging_tenant');
    assert.strictEqual(provider1, 'cloudflare_r2', 'Should return cloudflare_r2 when explicitly set');
    console.log('✅ Test 1 Passed: Explicit cloudflare_r2 returns cloudflare_r2');

    // Test 2: Explicit 'google_drive' setting
    await setSetting('repliz_media_staging_provider', 'google_drive');
    const provider2 = await getEffectiveStagingProvider('test_staging_tenant');
    assert.strictEqual(provider2, 'google_drive', 'Should return google_drive when explicitly set');
    console.log('✅ Test 2 Passed: Explicit google_drive returns google_drive');

    // Test 3: Readiness check when provider is cloudflare_r2 and R2 is configured via env
    await setSetting('repliz_media_staging_provider', 'cloudflare_r2');
    process.env.CLOUDFLARE_R2_ACCOUNT_ID = 'test_mock_acc';
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'test_mock_key';
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'test_mock_sec';
    process.env.CLOUDFLARE_R2_BUCKET_NAME = 'test_mock_bucket';
    process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN = 'https://cdn.testdomain.com';

    const readiness = await verifyPublishingStagingReady({ tenantId: 'test_staging_tenant' });
    assert.strictEqual(readiness.provider, 'cloudflare_r2', 'Provider should be cloudflare_r2');
    assert.strictEqual(readiness.connected, true, 'Status should be connected');
    assert.strictEqual(readiness.bucketName, 'test_mock_bucket', 'Bucket name should match');
    assert.strictEqual(readiness.publicDomain, 'https://cdn.testdomain.com', 'Public domain should match');
    console.log('✅ Test 3 Passed: verifyPublishingStagingReady passes for R2 without Google OAuth');

    // Test 4: Readiness check when provider is cloudflare_r2 but R2 is NOT configured
    delete process.env.CLOUDFLARE_R2_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    delete process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

    try {
      await verifyPublishingStagingReady({ tenantId: 'test_staging_tenant' });
      assert.fail('Should throw when R2 is not configured');
    } catch (err) {
      assert.strictEqual(err.code, 'R2_STAGING_NOT_CONFIGURED', `Expected R2_STAGING_NOT_CONFIGURED, got ${err.code}`);
    }
    console.log('✅ Test 4 Passed: verifyPublishingStagingReady throws R2_STAGING_NOT_CONFIGURED when R2 missing');
  });

  console.log('🎉 All Dual Staging Provider Tests Passed!');
  process.exit(0);
}

runDualStagingTests().catch(err => {
  console.error('❌ Dual Staging Test failed:', err);
  process.exit(1);
});
