import crypto from 'crypto';
import { pgQuery, withPgTransaction } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import { validateReferenceAssetIntent, validateApprovalAttestation } from './reference-asset-contract.js';

let _txRunnerForTest = null;
let _onManifestInvalidateForTest = null;

export function __setReferenceAssetRepoTestHooks({ txRunner = null, onManifestInvalidate = null } = {}) {
  _txRunnerForTest = txRunner;
  _onManifestInvalidateForTest = onManifestInvalidate;
}

function createCodedError(message, code, status = 400) {
  const err = new Error(message);
  err.code = code;
  err.error_code = code;
  err.status = status;
  return err;
}

export async function listReferenceAssets({ owner_type, owner_id, role, status } = {}) {
  const tenantId = getActiveTenantId();
  const conditions = ['tenant_id = $1'];
  const params = [tenantId];

  if (owner_type) {
    conditions.push(`owner_type = $${params.length + 1}`);
    params.push(owner_type);
  }
  if (owner_id) {
    conditions.push(`owner_id = $${params.length + 1}`);
    params.push(owner_id);
  }
  if (role) {
    conditions.push(`asset_role = $${params.length + 1}`);
    params.push(role);
  }
  if (status) {
    conditions.push(`status = $${params.length + 1}`);
    params.push(status);
  }

  const query = `
    SELECT * FROM visual_reference_assets 
    WHERE ${conditions.join(' AND ')} 
    ORDER BY version DESC, created_at DESC
  `;
  const res = await pgQuery(query, params);
  return res.rows;
}

export async function getReferenceAsset(id) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(
    'SELECT * FROM visual_reference_assets WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  );
  return res.rows[0] || null;
}

export async function reserveReferenceAssetVersion(intent, actor) {
  validateReferenceAssetIntent(intent);
  const tenantId = getActiveTenantId();
  const { owner_type, owner_id, role, source_type, universe_id, generation_prompt, negative_prompt } = intent;

  return await withPgTransaction(async (client) => {
    // 1. Get current max version
    const versionRes = await client.query(
      `SELECT COALESCE(MAX(version), 0) as max_v 
       FROM visual_reference_assets 
       WHERE tenant_id = $1 AND owner_type = $2 AND owner_id = $3 AND asset_role = $4`,
      [tenantId, owner_type, owner_id, role]
    );
    const nextVersion = versionRes.rows[0].max_v + 1;
    const id = `ref_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;

    const res = await client.query(
      `INSERT INTO visual_reference_assets (
        id, tenant_id, owner_type, owner_id, universe_id, asset_role, version, status, source_type,
        generation_prompt, negative_prompt, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'generating', $8, $9, $10, $11)
      RETURNING *`,
      [id, tenantId, owner_type, owner_id, universe_id || null, role, nextVersion, source_type || 'ai_generated', generation_prompt || null, negative_prompt || null, actor || null]
    );
    return res.rows[0];
  });
}

export async function markReferenceAssetDraft(id, managedFile) {
  const tenantId = getActiveTenantId();
  const { storage_path, public_path, mime_type, byte_size, sha256, width, height, provider_task_id, provider_result_url, provider } = managedFile;

  const res = await pgQuery(
    `UPDATE visual_reference_assets
     SET status = 'draft', storage_path = $1, public_path = $2, mime_type = $3, byte_size = $4,
         sha256 = $5, width = $6, height = $7, provider_task_id = $8, provider_result_url = $9, provider = $10,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $11 AND tenant_id = $12
     RETURNING *`,
    [storage_path, public_path, mime_type, byte_size, sha256, width || null, height || null, provider_task_id || null, provider_result_url || null, provider || null, id, tenantId]
  );
  return res.rows[0] || null;
}

export async function markReferenceAssetFailed(id, error) {
  const tenantId = getActiveTenantId();
  const failure_code = error.code || 'GENERATION_FAILED';
  const failure_message = error.message || 'Unknown error occurred';

  const res = await pgQuery(
    `UPDATE visual_reference_assets
     SET status = 'failed', failure_code = $1, failure_message = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $3 AND tenant_id = $4
     RETURNING *`,
    [failure_code, failure_message, id, tenantId]
  );
  return res.rows[0] || null;
}

export async function approveReferenceAsset(id, review = {}, actor, ownerContext = null) {
  const tenantId = getActiveTenantId();
  const runTx = _txRunnerForTest || withPgTransaction;

  const { approvedAsset, wasAlreadyApproved } = await runTx(async (client) => {
    const lockedRes = await client.query(
      'SELECT * FROM visual_reference_assets WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
      [id, tenantId]
    );
    const asset = lockedRes.rows[0];
    if (!asset) {
      throw createCodedError('Asset not found', 'OWNER_NOT_FOUND', 404);
    }

    if (review?.expected_sha256 !== undefined && review?.expected_sha256 !== null && String(review.expected_sha256).trim() !== '') {
      if (String(review.expected_sha256).trim() !== String(asset.sha256 || '')) {
        throw createCodedError(
          'Asset checksum does not match expected_sha256.',
          'CHECKSUM_MISMATCH',
          409
        );
      }
    }

    // Idempotent: already approved with matching checksum
    if (asset.status === 'approved') {
      return { approvedAsset: asset, wasAlreadyApproved: true };
    }

    if (asset.status !== 'draft') {
      throw createCodedError(
        `Only draft assets can be approved (current status: ${asset.status}).`,
        'REVISION_CONFLICT',
        409
      );
    }

    validateApprovalAttestation(asset, review.attestation, ownerContext);

    try {
      // 1. Demote old approved assets
      await client.query(
        `UPDATE visual_reference_assets
         SET status = 'archived', updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $1 AND owner_type = $2 AND owner_id = $3 AND asset_role = $4 AND status = 'approved'`,
        [tenantId, asset.owner_type, asset.owner_id, asset.asset_role]
      );

      // 2. Mark this asset as approved
      const res = await client.query(
        `UPDATE visual_reference_assets
         SET status = 'approved', review_notes = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND tenant_id = $4
         RETURNING *`,
        [review.notes || null, actor || null, id, tenantId]
      );

      const nextApproved = res.rows[0];

      // 3. Dual-write to legacy columns
      if (asset.owner_type === 'character' && asset.asset_role === 'identity') {
        await client.query(
          'UPDATE universe_characters SET reference_image_path = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3',
          [nextApproved.public_path, nextApproved.owner_id, tenantId]
        );
      } else if (asset.owner_type === 'character' && asset.asset_role === 'character_sheet') {
        const identityApproved = await client.query(
          `SELECT id FROM visual_reference_assets
           WHERE tenant_id = $1 AND owner_type = 'character' AND owner_id = $2 AND asset_role = 'identity' AND status = 'approved'
           LIMIT 1`,
          [tenantId, nextApproved.owner_id]
        );
        if (!identityApproved.rows.length) {
          await client.query(
            'UPDATE universe_characters SET reference_image_path = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3',
            [nextApproved.public_path, nextApproved.owner_id, tenantId]
          );
        }
      } else if (asset.owner_type === 'location' && asset.asset_role === 'location') {
        await client.query(
          'UPDATE universe_locations SET reference_image_path = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3',
          [nextApproved.public_path, nextApproved.owner_id, tenantId]
        );
      } else if (asset.owner_type === 'universe' && asset.asset_role === 'visual_style') {
        await client.query(
          'UPDATE universe_profiles SET style_reference_path = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3',
          [nextApproved.public_path, nextApproved.owner_id, tenantId]
        );
      }

      return { approvedAsset: nextApproved, wasAlreadyApproved: false };
    } catch (err) {
      if (err?.code === '23505' || /idx_vra_one_approved|unique constraint|duplicate key/i.test(String(err?.message || ''))) {
        throw createCodedError(
          'Concurrent approval conflict detected. Another version was approved simultaneously.',
          'REVISION_CONFLICT',
          409
        );
      }
      throw err;
    }
  });

  if (!wasAlreadyApproved && approvedAsset?.universe_id) {
    if (_onManifestInvalidateForTest) {
      await _onManifestInvalidateForTest({ tenantId, universeId: approvedAsset.universe_id });
    } else {
      const { refreshManifestCache } = await import('./universe-manifests.js');
      await refreshManifestCache({ tenantId, universeId: approvedAsset.universe_id }).catch(() => {});
    }
  }

  return approvedAsset;
}

export async function rejectReferenceAsset(id, review = {}, actor) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(
    `UPDATE visual_reference_assets
     SET status = 'rejected', review_notes = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND tenant_id = $3 AND status = 'draft'
     RETURNING *`,
    [review.notes || null, id, tenantId]
  );
  return res.rows[0] || null;
}

export async function archiveReferenceAsset(id, actor) {
  const tenantId = getActiveTenantId();
  
  return await withPgTransaction(async (client) => {
    const assetRes = await client.query(
      'SELECT * FROM visual_reference_assets WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    const asset = assetRes.rows[0];
    if (!asset) throw new Error('Asset not found');

    const res = await client.query(
      `UPDATE visual_reference_assets
       SET status = 'archived', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, tenantId]
    );

    // If it was the approved asset, clear legacy mapping
    if (asset.status === 'approved') {
      if (asset.owner_type === 'character' && asset.asset_role === 'identity') {
        const fallbackSheet = await client.query(
          `SELECT public_path FROM visual_reference_assets
           WHERE tenant_id = $1 AND owner_type = 'character' AND owner_id = $2 AND asset_role = 'character_sheet' AND status = 'approved'
           LIMIT 1`,
          [tenantId, asset.owner_id]
        );
        await client.query(
          'UPDATE universe_characters SET reference_image_path = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3',
          [fallbackSheet.rows[0]?.public_path || null, asset.owner_id, tenantId]
        );
      } else if (asset.owner_type === 'character' && asset.asset_role === 'character_sheet') {
        const identityApproved = await client.query(
          `SELECT id FROM visual_reference_assets
           WHERE tenant_id = $1 AND owner_type = 'character' AND owner_id = $2 AND asset_role = 'identity' AND status = 'approved'
           LIMIT 1`,
          [tenantId, asset.owner_id]
        );
        if (!identityApproved.rows.length) {
          await client.query(
            'UPDATE universe_characters SET reference_image_path = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2',
            [asset.owner_id, tenantId]
          );
        }
      } else if (asset.owner_type === 'location' && asset.asset_role === 'location') {
        await client.query(
          'UPDATE universe_locations SET reference_image_path = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2',
          [asset.owner_id, tenantId]
        );
      } else if (asset.owner_type === 'universe' && asset.asset_role === 'visual_style') {
        await client.query(
          'UPDATE universe_profiles SET style_reference_path = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2',
          [asset.owner_id, tenantId]
        );
      }
    }

    return res.rows[0];
  });
}

export async function getApprovedReferenceAssets(ownerType, ownerId, roles = []) {
  const tenantId = getActiveTenantId();
  if (roles.length === 0) return [];
  
  const placeholders = roles.map((_, i) => `$${i + 4}`).join(', ');
  const query = `
    SELECT * FROM visual_reference_assets
    WHERE tenant_id = $1 AND owner_type = $2 AND owner_id = $3 AND status = 'approved' AND asset_role IN (${placeholders})
  `;
  const res = await pgQuery(query, [tenantId, ownerType, ownerId, ...roles]);
  return res.rows;
}

export async function getApprovedReferenceAssetsForUniverse(universeId, tenantId = getActiveTenantId()) {
  const effectiveTenantId = tenantId || getActiveTenantId();
  const query = `
    SELECT * FROM visual_reference_assets
    WHERE tenant_id = $1 AND universe_id = $2 AND status = 'approved'
  `;
  const res = await pgQuery(query, [effectiveTenantId, universeId]);
  return res.rows;
}
