import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import sharp from 'sharp';

process.env.DISABLE_STARTUP_DB_CACHES = 'true';

const { tenantContext } = await import('../lib/tenant-context.js');
const {
  uploadReferenceAsset,
  __setReferenceAssetServiceTestHooks
} = await import('../lib/reference-asset-service.js');
const { processImageBuffer } = await import('../lib/reference-asset-storage.js');

test('0.7: uploadReferenceAsset deduplicates identical sha256 without reserving a new version', async (t) => {
  const tenantId = 'tnt_test_dedup';
  const imgBuf = await sharp({
    create: { width: 64, height: 64, channels: 4, background: { r: 20, g: 40, b: 80, alpha: 1 } }
  }).png().toBuffer();
  const expectedSha = crypto.createHash('sha256').update(imgBuf).digest('hex');

  const storedAssets = [];
  let reserveCalls = 0;

  __setReferenceAssetServiceTestHooks({
    async fetchOwner(ownerType, ownerId) {
      if (ownerType === 'character' && ownerId === 'char_arka') {
        return { id: 'char_arka', tenant_id: tenantId, universe_id: 'univ_ra_1', name: 'Arka' };
      }
      return null;
    },
    async findDuplicateReferenceAsset(tId, { owner_type, owner_id, role, sha256 }) {
      return storedAssets.find(
        a => a.tenant_id === tId && a.owner_type === owner_type && a.owner_id === owner_id && a.asset_role === role && a.sha256 === sha256 && ['draft', 'approved'].includes(a.status)
      ) || null;
    },
    async reserveReferenceAssetVersion(intent) {
      reserveCalls += 1;
      return {
        id: `ref_v${reserveCalls}`,
        tenant_id: tenantId,
        owner_type: intent.owner_type,
        owner_id: intent.owner_id,
        universe_id: intent.universe_id,
        asset_role: intent.role,
        version: reserveCalls,
        status: 'generating'
      };
    },
    async ingestUploadedReference(buf, reserved) {
      return {
        storage_path: `/tmp/${reserved.id}.png`,
        public_path: `/uploads/reference-assets/${reserved.id}.png`,
        mime_type: 'image/png',
        byte_size: buf.length,
        sha256: expectedSha,
        width: 64,
        height: 64
      };
    },
    async markReferenceAssetDraft(id, managed) {
      const draft = {
        id,
        tenant_id: tenantId,
        owner_type: 'character',
        owner_id: 'char_arka',
        universe_id: 'univ_ra_1',
        asset_role: 'identity',
        version: reserveCalls,
        status: 'draft',
        ...managed
      };
      storedAssets.push(draft);
      return draft;
    },
    async markReferenceAssetFailed() {}
  });
  t.after(() => __setReferenceAssetServiceTestHooks(null));

  // First upload reserves v1
  const first = await tenantContext.run(tenantId, () =>
    uploadReferenceAsset({ owner_type: 'character', owner_id: 'char_arka', role: 'identity' }, imgBuf, 'tester')
  );
  assert.equal(first.version, 1);
  assert.equal(first.universe_id, 'univ_ra_1');
  assert.equal(reserveCalls, 1);

  // Second identical upload returns existing draft with deduplicated: true and does NOT reserve v2
  const second = await tenantContext.run(tenantId, () =>
    uploadReferenceAsset({ owner_type: 'character', owner_id: 'char_arka', role: 'identity' }, imgBuf, 'tester')
  );
  assert.equal(second.deduplicated, true);
  assert.equal(second.id, first.id);
  assert.equal(second.version, 1);
  assert.equal(reserveCalls, 1, 'Duplicate sha256 must NOT reserve a new version');
});

test('0.7: uploadReferenceAsset rejects mismatched universe_id with 400 UNIVERSE_MISMATCH', async (t) => {
  const tenantId = 'tnt_test_mismatch';
  const imgBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  __setReferenceAssetServiceTestHooks({
    async fetchOwner() {
      return { id: 'char_arka', tenant_id: tenantId, universe_id: 'univ_real_1' };
    },
    async findDuplicateReferenceAsset() { return null; }
  });
  t.after(() => __setReferenceAssetServiceTestHooks(null));

  await assert.rejects(
    () => tenantContext.run(tenantId, () =>
      uploadReferenceAsset({
        owner_type: 'character',
        owner_id: 'char_arka',
        role: 'identity',
        universe_id: 'univ_wrong_999'
      }, imgBuf, 'tester')
    ),
    (err) => err.code === 'UNIVERSE_MISMATCH' && err.status === 400
  );
});

test('0.7: processImageBuffer enforces maximum 4096x4096 / 16 MP image dimension limit', async () => {
  const oversizedBuf = await sharp({
    create: { width: 4200, height: 100, channels: 3, background: { r: 10, g: 20, b: 30 } }
  }).png().toBuffer();

  await assert.rejects(
    () => processImageBuffer(oversizedBuf, {
      tenant_id: 'tnt_dim',
      owner_type: 'character',
      owner_id: 'char_1',
      asset_role: 'identity',
      version: 1
    }),
    (err) => err.code === 'UPLOAD_TOO_LARGE' && err.status === 413
  );
});
