/**
 * Read-only Character Lock Preflight service.
 * Proves that a Visual Identity's Universe link, approved identity assets, disk files,
 * SHA-256 checksums, and production resolver all align without calling any paid generator.
 */

import fs from 'fs';
import path from 'path';
import { isStylizedCharacterVisualConfig } from './visual-identity-contract.js';
import { getUniverseManifestAsync } from './universe-manifests.js';
import { resolveClipReferenceImagesAsync } from './cartoon-reference-resolver.js';
import { verifyManagedReference } from './reference-asset-storage.js';

function resolveLocalFilePath(publicOrAbsPath, cwd = process.cwd()) {
  if (!publicOrAbsPath || typeof publicOrAbsPath !== 'string') return null;
  const clean = publicOrAbsPath.trim().split('?')[0].split('#')[0];
  if (!clean) return null;
  const rel = clean.replace(/^\/+/, '');
  const candidates = [clean, path.join(cwd, 'public', rel), path.join(cwd, rel)];
  for (const p of candidates) {
    if (p && fs.existsSync(p) && fs.statSync(p).isFile()) {
      return p;
    }
  }
  return null;
}

export async function runCharacterLockPreflight({
  visualIdentityId,
  mode = 'advisory',
  samplePrompt = null,
  tenantId,
  deps = {}
}) {
  const {
    getVisualIdentityFn,
    getUniverseProfileFn,
    getReferenceAssetFn,
    getManifestFn = getUniverseManifestAsync,
    verifyManagedReferenceFn = verifyManagedReference,
    resolverFn = resolveClipReferenceImagesAsync,
    cwd = process.cwd()
  } = deps;

  const missing = [];
  const warnings = [];
  const resolvedAssets = [];

  if (!visualIdentityId) {
    const err = new Error('visual_identity_id is required.');
    err.code = 'VALIDATION_ERROR';
    err.error_code = 'VALIDATION_ERROR';
    err.status = 400;
    throw err;
  }

  const effectiveMode = mode === 'required' ? 'required' : 'advisory';
  const vi = await getVisualIdentityFn(visualIdentityId);
  if (!vi) {
    const err = new Error(`Visual Identity "${visualIdentityId}" not found.`);
    err.code = 'OWNER_NOT_FOUND';
    err.error_code = 'OWNER_NOT_FOUND';
    err.status = 404;
    throw err;
  }
  if (tenantId && vi.tenant_id && vi.tenant_id !== 'system' && vi.tenant_id !== tenantId) {
    const err = new Error('Visual Identity does not belong to the active tenant.');
    err.code = 'TENANT_MISMATCH';
    err.error_code = 'TENANT_MISMATCH';
    err.status = 403;
    throw err;
  }

  const viConfig = vi.config || {};
  const viSubject = viConfig.subject || {};
  const universeId = viSubject.universe_profile_id || null;
  const universeSlug = viSubject.universe_slug || null;
  const characterKeys = Array.isArray(viSubject.character_keys)
    ? viSubject.character_keys.map(k => String(k || '').trim()).filter(Boolean)
    : [];
  const characterLockMode = viSubject.character_lock_mode === 'strict' ? 'strict' : 'off';

  const isStylized = isStylizedCharacterVisualConfig({ visualOverrides: viConfig });
  if (!isStylized) {
    missing.push({
      code: 'VALIDATION_ERROR',
      message: `Visual Identity "${vi.label}" is not configured for stylized character lock (subject.kind=${viSubject.kind || 'unknown'}).`
    });
  }

  if (!universeId && !universeSlug) {
    missing.push({
      code: 'UNIVERSE_MISMATCH',
      message: 'Visual Identity is not linked to any universe_profile_id or universe_slug.'
    });
  }

  if (characterKeys.length === 0) {
    missing.push({
      code: 'REFERENCE_NOT_APPROVED',
      message: 'Visual Identity has no character_keys configured.'
    });
  }

  if (characterLockMode !== 'strict') {
    warnings.push('subject.character_lock_mode is "off". Set to "strict" to forbid silent fallback to other characters.');
  }

  // Verify universe ownership & slug consistency within tenant
  let universeRow = null;
  if (universeId && typeof getUniverseProfileFn === 'function') {
    universeRow = await getUniverseProfileFn(universeId);
    if (!universeRow) {
      missing.push({
        code: 'OWNER_NOT_FOUND',
        message: `Linked universe_profile_id "${universeId}" not found in tenant "${tenantId}".`
      });
    } else if (universeSlug && universeRow.slug && universeRow.slug.toLowerCase() !== universeSlug.toLowerCase()) {
      missing.push({
        code: 'UNIVERSE_MISMATCH',
        message: `VI universe_slug "${universeSlug}" does not match universe profile slug "${universeRow.slug}".`
      });
    }
  }

  // Build fresh manifest for active tenant
  let manifest = null;
  if (universeId || universeSlug) {
    manifest = await getManifestFn(universeSlug, {
      forceRefresh: true,
      universeId,
      tenantId
    });
    if (!manifest) {
      missing.push({
        code: 'OWNER_NOT_FOUND',
        message: `Unable to load universe manifest for "${universeId || universeSlug}" in tenant "${tenantId}".`
      });
    }
  }

  // Verify each character key & its identity asset + file + checksum
  const expectedByKey = new Map();
  if (manifest && manifest.characters) {
    for (const key of characterKeys) {
      const charEntry = manifest.characters[key];
      if (!charEntry) {
        missing.push({
          code: 'OWNER_NOT_FOUND',
          character_key: key,
          message: `Character key "${key}" not found in universe "${manifest.universe_profile}".`
        });
        continue;
      }

      const ia = charEntry.identity_asset || null;
      const source = ia?.source || (charEntry.identity_reference ? 'approved_asset' : 'fabricated_path');

      if (source === 'fabricated_path') {
        missing.push({
          code: 'REFERENCE_NOT_APPROVED',
          character_key: key,
          source,
          public_path: ia?.public_path || charEntry.identity_reference_path || null,
          message: `Character "${key}" has no approved or legacy reference image (only fabricated_path).`
        });
        continue;
      }

      if (source === 'legacy_path') {
        warnings.push(`Character "${key}" relies on legacy_path (${ia?.public_path || charEntry.identity_reference_path}) instead of an approved managed reference asset.`);
        const localFile = resolveLocalFilePath(ia?.public_path || charEntry.identity_reference_path, cwd);
        if (!localFile) {
          missing.push({
            code: 'REFERENCE_FILE_MISSING',
            character_key: key,
            source,
            public_path: ia?.public_path || charEntry.identity_reference_path || null,
            message: `Legacy reference file missing on disk for character "${key}".`
          });
          continue;
        }
        expectedByKey.set(key, {
          character_key: key,
          asset_id: null,
          role: 'identity',
          version: charEntry.version || 1,
          sha256: null,
          public_path: ia?.public_path || charEntry.identity_reference_path,
          source: 'legacy_path'
        });
        continue;
      }

      // source === 'approved_asset'
      const assetId = ia?.asset_id || charEntry.identity_reference?.asset_id || null;
      let dbAsset = null;
      if (assetId && typeof getReferenceAssetFn === 'function') {
        dbAsset = await getReferenceAssetFn(assetId);
      }

      if (!dbAsset) {
        missing.push({
          code: 'REFERENCE_NOT_APPROVED',
          character_key: key,
          asset_id: assetId,
          message: `Approved reference asset "${assetId}" for character "${key}" could not be verified in tenant "${tenantId}".`
        });
        continue;
      }

      const fileExists = dbAsset.storage_path ? fs.existsSync(dbAsset.storage_path) : Boolean(resolveLocalFilePath(dbAsset.public_path, cwd));
      if (!fileExists) {
        missing.push({
          code: 'REFERENCE_FILE_MISSING',
          character_key: key,
          asset_id: dbAsset.id,
          public_path: dbAsset.public_path,
          message: `Managed reference file is missing on disk for character "${key}" (${dbAsset.public_path}).`
        });
        continue;
      }

      const checksumOk = await verifyManagedReferenceFn(dbAsset);
      if (!checksumOk) {
        missing.push({
          code: 'CHECKSUM_MISMATCH',
          character_key: key,
          asset_id: dbAsset.id,
          public_path: dbAsset.public_path,
          message: `Checksum verification failed for approved reference asset "${dbAsset.id}" (${key}).`
        });
        continue;
      }

      expectedByKey.set(key, {
        character_key: key,
        asset_id: dbAsset.id,
        role: dbAsset.asset_role || 'identity',
        version: dbAsset.version,
        sha256: dbAsset.sha256,
        public_path: dbAsset.public_path,
        source: 'approved_asset'
      });
    }
  }

  // Diagnostic dry-run through production resolver (without loading full base64 into memory)
  if (manifest && characterKeys.length > 0) {
    // Pick a sample prompt mentioning another character in the same universe if caller did not supply one
    let effectivePrompt = samplePrompt;
    if (!effectivePrompt && manifest.characters) {
      const otherChar = Object.entries(manifest.characters).find(([k]) => !characterKeys.includes(k));
      if (otherChar) {
        effectivePrompt = `Scene mentioning ${otherChar[1]?.display_name || otherChar[0]} in background`;
      }
    }

    const diagnosticImageLoader = async (imagePath) => {
      if (!imagePath || typeof imagePath !== 'string') return null;
      if (imagePath.startsWith('data:image/') || imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return `verified://${imagePath}`;
      }
      const localPath = resolveLocalFilePath(imagePath, cwd);
      return localPath ? `verified://${imagePath}` : null;
    };

    try {
      const resolved = await resolverFn({
        contentWorld: 'general',
        universeProfile: universeSlug || manifest.universe_profile,
        universeProfileId: universeId,
        tenantId,
        universeSnapshot: { manifest },
        visualIdentitySnapshot: {
          identity_ref: { id: vi.id },
          structured: viConfig
        },
        clip: 1,
        promptText: effectivePrompt || '',
        clipCharacters: [],
        imageLoader: diagnosticImageLoader
      });

      const resolvedKeys = Array.isArray(resolved?.characterKeysResolved) ? resolved.characterKeysResolved : [];
      const resolverAssets = Array.isArray(resolved?.resolvedCharacterAssets) ? resolved.resolvedCharacterAssets : [];

      // Check for unintended extra characters (e.g. Maya leaking when prompt mentions Maya)
      const unexpectedKeys = resolvedKeys.filter(k => !characterKeys.includes(k));
      if (unexpectedKeys.length > 0) {
        if (characterLockMode === 'strict') {
          missing.push({
            code: 'REFERENCE_NOT_RESOLVED',
            message: `Strict resolver unexpectedly included non-allowlisted character(s): ${unexpectedKeys.join(', ')}.`
          });
        } else {
          warnings.push(
            `Sample prompt triggered non-configured character anchor(s) (${unexpectedKeys.join(', ')}) because character_lock_mode is "off".`
          );
        }
      }

      // Cross-check resolved assets against verified expected assets
      for (const ra of resolverAssets) {
        const expected = expectedByKey.get(ra.character_key);
        if (expected && expected.asset_id && ra.asset_id && expected.asset_id !== ra.asset_id) {
          missing.push({
            code: 'REFERENCE_NOT_RESOLVED',
            character_key: ra.character_key,
            message: `Resolver selected asset "${ra.asset_id}" instead of expected approved asset "${expected.asset_id}".`
          });
        }
        resolvedAssets.push({
          character_key: ra.character_key,
          asset_id: ra.asset_id || expected?.asset_id || null,
          role: expected?.role || 'identity',
          version: ra.version || expected?.version || 1,
          sha256: ra.sha256 || expected?.sha256 || null,
          public_path: ra.public_path || expected?.public_path || null,
          source: ra.source || expected?.source || 'unknown'
        });
      }

      if (resolvedAssets.length === 0 && missing.length === 0) {
        missing.push({
          code: 'REFERENCE_NOT_RESOLVED',
          message: 'Resolver returned zero resolved character assets.'
        });
      }
    } catch (resolveErr) {
      missing.push({
        code: resolveErr?.code || 'REFERENCE_NOT_RESOLVED',
        details: resolveErr?.details || null,
        message: resolveErr.message
      });
    }
  }

  const status = missing.length === 0 ? 'ready' : 'not_ready';
  const blocking = effectiveMode === 'required' && status !== 'ready';

  return {
    success: true,
    tenant_id: tenantId || vi.tenant_id || null,
    status,
    mode: effectiveMode,
    visual_identity_id: vi.id,
    universe_id: universeRow?.id || universeId || null,
    universe_slug: universeRow?.slug || universeSlug || manifest?.universe_profile || null,
    character_lock_mode: characterLockMode,
    character_keys: characterKeys,
    resolved_assets: resolvedAssets,
    missing,
    warnings,
    blocking
  };
}
