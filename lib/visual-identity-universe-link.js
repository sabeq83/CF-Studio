/**
 * Pure merge, validation, and service helpers for linking a Visual Identity to a Universe.
 * Only touches subject.universe_profile_id, subject.universe_slug, subject.character_keys,
 * and subject.character_lock_mode — never overwrites other Visual Identity fields.
 */

import { CHARACTER_LOCK_MODES } from './visual-identity-contract.js';

function createLinkError(message, code, status = 400) {
  const err = new Error(message);
  err.code = code;
  err.error_code = code;
  err.status = status;
  return err;
}

export function extractSubjectUniverseLinkState(config) {
  const subject = config?.subject || {};
  return {
    universe_profile_id: subject.universe_profile_id || null,
    universe_slug: subject.universe_slug || null,
    character_keys: Array.isArray(subject.character_keys) ? [...subject.character_keys] : [],
    character_lock_mode: subject.character_lock_mode || 'off'
  };
}

export function buildVisualIdentityUniverseLinkMerge(existingConfig, {
  universe,
  characterKeys,
  characterLockMode
}) {
  if (!existingConfig || typeof existingConfig !== 'object') {
    throw createLinkError('Visual Identity config is invalid.', 'VALIDATION_ERROR', 400);
  }
  if (!universe || !universe.id || !universe.slug) {
    throw createLinkError('Universe not found.', 'OWNER_NOT_FOUND', 404);
  }
  if (!Array.isArray(characterKeys) || characterKeys.length === 0) {
    throw createLinkError('character_keys must be a non-empty array.', 'VALIDATION_ERROR', 400);
  }

  const normalizedKeys = [...new Set(characterKeys.map(k => String(k || '').trim()).filter(Boolean))];
  if (normalizedKeys.length === 0) {
    throw createLinkError('character_keys must contain at least one valid key.', 'VALIDATION_ERROR', 400);
  }

  if (characterLockMode !== undefined && !CHARACTER_LOCK_MODES.includes(characterLockMode)) {
    throw createLinkError(
      `Invalid character_lock_mode "${characterLockMode}". Allowed: ${CHARACTER_LOCK_MODES.join(', ')}.`,
      'VALIDATION_ERROR',
      400
    );
  }

  const before = extractSubjectUniverseLinkState(existingConfig);
  const nextLockMode = characterLockMode !== undefined ? characterLockMode : before.character_lock_mode;

  const after = {
    universe_profile_id: universe.id,
    universe_slug: universe.slug,
    character_keys: normalizedKeys,
    character_lock_mode: nextLockMode
  };

  const mergedConfig = {
    ...existingConfig,
    subject: {
      ...(existingConfig.subject || {}),
      universe_profile_id: after.universe_profile_id,
      universe_slug: after.universe_slug,
      character_keys: after.character_keys,
      character_lock_mode: after.character_lock_mode
    }
  };

  const diff = {};
  for (const field of ['universe_profile_id', 'universe_slug', 'character_keys', 'character_lock_mode']) {
    const prevVal = before[field];
    const nextVal = after[field];
    if (JSON.stringify(prevVal) !== JSON.stringify(nextVal)) {
      diff[`subject.${field}`] = { before: prevVal, after: nextVal };
    }
  }

  return { before, after, diff, mergedConfig };
}

export async function linkVisualIdentityToUniverse({
  visualIdentityId,
  universeId,
  characterKeys,
  characterLockMode,
  dryRun = true,
  tenantId,
  actor = 'user',
  deps = {}
}) {
  const {
    getVisualIdentityFn,
    updateVisualIdentityFn,
    getUniverseProfileFn,
    getUniverseCharactersFn,
    findActiveSchedulesForViFn
  } = deps;

  if (!universeId || typeof universeId !== 'string') {
    throw createLinkError('universe_id is required.', 'VALIDATION_ERROR', 400);
  }
  if (!Array.isArray(characterKeys) || characterKeys.length === 0) {
    throw createLinkError('character_keys must be a non-empty array.', 'VALIDATION_ERROR', 400);
  }

  const vi = await getVisualIdentityFn(visualIdentityId);
  if (!vi) {
    throw createLinkError(`Visual Identity "${visualIdentityId}" not found.`, 'OWNER_NOT_FOUND', 404);
  }
  if (vi.source === 'system' || vi.tenant_id === 'system') {
    throw createLinkError('System Visual Identities are read-only. Clone to a custom preset first.', 'SYSTEM_PRESET_READONLY', 403);
  }
  if (tenantId && vi.tenant_id && vi.tenant_id !== tenantId) {
    throw createLinkError('Visual Identity does not belong to the active tenant.', 'TENANT_MISMATCH', 403);
  }

  const universe = await getUniverseProfileFn(universeId);
  if (!universe) {
    throw createLinkError(`Universe "${universeId}" not found.`, 'OWNER_NOT_FOUND', 404);
  }
  if (tenantId && universe.tenant_id && universe.tenant_id !== tenantId) {
    throw createLinkError('Universe does not belong to the active tenant.', 'TENANT_MISMATCH', 403);
  }

  const characters = (await getUniverseCharactersFn(universeId)) || [];
  const validKeySet = new Set(characters.map(c => c.character_key));
  const unknownKeys = characterKeys.filter(k => !validKeySet.has(String(k || '').trim()));
  if (unknownKeys.length > 0) {
    throw createLinkError(
      `Unknown character_key(s) in universe "${universe.slug}": ${unknownKeys.join(', ')}.`,
      'OWNER_NOT_FOUND',
      400
    );
  }

  const { before, after, diff, mergedConfig } = buildVisualIdentityUniverseLinkMerge(vi.config || {}, {
    universe,
    characterKeys,
    characterLockMode
  });

  const warnings = [];
  if (typeof findActiveSchedulesForViFn === 'function') {
    try {
      const schedules = await findActiveSchedulesForViFn(visualIdentityId, tenantId);
      if (Array.isArray(schedules) && schedules.length > 0) {
        warnings.push(
          `Visual Identity "${vi.label}" is currently referenced by ${schedules.length} active schedule(s): ${schedules.map(s => s.name || s.id).join(', ')}. Schedules were NOT modified.`
        );
      }
    } catch (_) {
      // Non-fatal informational warning check
    }
  }

  const effectiveDryRun = dryRun !== false;
  let updatedVersion = vi.version;

  if (!effectiveDryRun) {
    const updated = await updateVisualIdentityFn(vi.id, { config: mergedConfig }, actor);
    updatedVersion = updated?.version || vi.version;
  }

  return {
    success: true,
    tenant_id: tenantId || vi.tenant_id || null,
    visual_identity_id: vi.id,
    visual_identity_label: vi.label,
    visual_identity_version: updatedVersion,
    dry_run: effectiveDryRun,
    before,
    after,
    diff,
    warnings
  };
}
