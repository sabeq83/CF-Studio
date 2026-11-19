import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DISABLE_STARTUP_DB_CACHES = 'true';

const { tenantContext } = await import('../lib/tenant-context.js');
const {
  approveReferenceAsset,
  __setReferenceAssetRepoTestHooks
} = await import('../lib/reference-asset-repository.js');

test('R1: approveReferenceAsset locks FOR UPDATE, supports idempotent re-approve, rejects CHECKSUM_MISMATCH, and invalidates manifest cache', async (t) => {
  const tenantId = 'tnt_pt-gim-sosmed_62d0d9';
  const row = {
    id: 'ref_arka_v1',
    tenant_id: tenantId,
    owner_type: 'character',
    owner_id: 'char_arka',
    universe_id: 'univ_ra_1',
    asset_role: 'identity',
    version: 1,
    status: 'draft',
    sha256: 'deadbeef1234567890',
    public_path: '/uploads/reference-assets/tnt/character/char_arka/identity/v1/deadbeef.png'
  };

  let lockChain = Promise.resolve();
  const seenSql = [];
  const invalidated = [];

  const txRunner = async (fn) => {
    const prev = lockChain;
    let release;
    lockChain = new Promise(resolve => { release = resolve; });
    await prev;
    try {
      const client = {
        async query(sql, params) {
          seenSql.push(sql);
          if (/SELECT \* FROM visual_reference_assets WHERE id = \$1 AND tenant_id = \$2 FOR UPDATE/i.test(sql)) {
            if (params[0] === row.id && params[1] === row.tenant_id) {
              return { rows: [{ ...row }] };
            }
            return { rows: [] };
          }
          if (/UPDATE visual_reference_assets[\s\S]*SET status = 'approved'/i.test(sql)) {
            row.status = 'approved';
            row.approved_by = params[1];
            return { rows: [{ ...row }] };
          }
          return { rows: [] };
        }
      };
      return await fn(client);
    } finally {
      release();
    }
  };

  __setReferenceAssetRepoTestHooks({
    txRunner,
    onManifestInvalidate: async (info) => invalidated.push(info)
  });
  t.after(() => __setReferenceAssetRepoTestHooks());

  const ownerContext = {
    owner: { depiction_mode: 'normal' },
    universe: { universe_type: 'character_driven' }
  };

  // 1. Checksum mismatch rejected BEFORE approving
  await assert.rejects(
    () => tenantContext.run(tenantId, () =>
      approveReferenceAsset(row.id, { expected_sha256: 'wrong_sha' }, 'actor_1', ownerContext)
    ),
    (err) => err.code === 'CHECKSUM_MISMATCH' && err.status === 409
  );
  assert.equal(row.status, 'draft');
  assert.equal(invalidated.length, 0);

  // 2. Parallel double approve of same asset: serialized by FOR UPDATE -> first approves, second is idempotent
  const [res1, res2] = await Promise.all([
    tenantContext.run(tenantId, () =>
      approveReferenceAsset(row.id, { expected_sha256: row.sha256 }, 'actor_1', ownerContext)
    ),
    tenantContext.run(tenantId, () =>
      approveReferenceAsset(row.id, { expected_sha256: row.sha256 }, 'actor_2', ownerContext)
    )
  ]);

  assert.equal(res1.status, 'approved');
  assert.equal(res2.status, 'approved');
  assert.equal(res1.id, row.id);
  assert.equal(res2.id, row.id);
  assert.ok(seenSql.some(s => /FOR UPDATE/i.test(s)), 'Must lock row with SELECT ... FOR UPDATE');
  assert.equal(invalidated.length, 1, 'Manifest cache invalidated once for actual transition');
  assert.deepEqual(invalidated[0], { tenantId, universeId: 'univ_ra_1' });
});

test('R1: maps PostgreSQL unique constraint 23505 to REVISION_CONFLICT and rejects archived/rejected assets', async (t) => {
  const tenantId = 'tnt_test_r1';
  let currentStatus = 'draft';
  let failWith23505 = true;

  __setReferenceAssetRepoTestHooks({
    txRunner: async (fn) => {
      const client = {
        async query(sql) {
          if (/FOR UPDATE/i.test(sql)) {
            return {
              rows: [{
                id: 'ref_race_1',
                tenant_id: tenantId,
                owner_type: 'character',
                owner_id: 'char_1',
                universe_id: 'univ_1',
                asset_role: 'identity',
                status: currentStatus,
                sha256: 'sha_race',
                public_path: '/uploads/a.png'
              }]
            };
          }
          if (/SET status = 'approved'/i.test(sql) && failWith23505) {
            const e = new Error('duplicate key value violates unique constraint "idx_vra_one_approved"');
            e.code = '23505';
            throw e;
          }
          return { rows: [] };
        }
      };
      return await fn(client);
    }
  });
  t.after(() => __setReferenceAssetRepoTestHooks());

  const ownerContext = {
    owner: { depiction_mode: 'normal' },
    universe: { universe_type: 'character_driven' }
  };

  await assert.rejects(
    () => tenantContext.run(tenantId, () =>
      approveReferenceAsset('ref_race_1', { expected_sha256: 'sha_race' }, 'actor_1', ownerContext)
    ),
    (err) => err.code === 'REVISION_CONFLICT' && err.status === 409
  );

  // Archived asset cannot be approved -> REVISION_CONFLICT
  failWith23505 = false;
  currentStatus = 'archived';
  await assert.rejects(
    () => tenantContext.run(tenantId, () =>
      approveReferenceAsset('ref_race_1', { expected_sha256: 'sha_race' }, 'actor_1', ownerContext)
    ),
    (err) => err.code === 'REVISION_CONFLICT' && err.status === 409
  );
});
