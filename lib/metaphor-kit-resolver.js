import crypto from 'crypto';
import { getKit, listKitsByTopics } from './metaphor-world-kits.js';
import { detectHealthTopics } from './health-metaphors.js';
import * as defaultUsageRepo from './metaphor-kit-usage-repository.js';

export function stableHash(str = '') {
  const digest = crypto.createHash('sha256').update(String(str || '')).digest();
  return digest.readUInt32BE(0);
}

/**
 * Memilih Metaphor World Kit dengan prioritas:
 * explicitKitKey > sticky (itemId sudah pernah di-resolve) > rotasi anti-repeat per brand > LRU.
 * Error DB tidak pernah menggagalkan generate (fallback ke pilihan deterministik + warning).
 */
export async function resolveMetaphorKit({
  text = '',
  tenantId = 'default_tenant',
  brandProfileId = null,
  campaignId = null,
  itemId = null,
  explicitKitKey = null,
  window = 6,
  repo = defaultUsageRepo,
} = {}) {
  const topics = detectHealthTopics(text);
  const safeTenant = String(tenantId || 'default_tenant');
  const safeBrand = brandProfileId ? String(brandProfileId) : null;
  const safeItem = itemId ? String(itemId) : null;

  const tryUpsert = async (kitKey, reason) => {
    if (!safeItem || !repo?.upsertUsage) return;
    try {
      await repo.upsertUsage({
        tenantId: safeTenant,
        brandProfileId: safeBrand,
        campaignId: campaignId ? String(campaignId) : null,
        itemId: safeItem,
        kitKey,
        topicKeys: topics,
        reason,
      });
    } catch (err) {
      console.warn('[MetaphorKitResolver] Gagal mencatat usage (non-blocking):', err.message);
    }
  };

  // 1. Explicit override (dari planner / rowPayload.metaphor_kit_key)
  if (explicitKitKey) {
    const explicitKit = getKit(explicitKitKey);
    if (explicitKit) {
      await tryUpsert(explicitKit.key, 'explicit');
      return { kit: explicitKit, reason: 'explicit', topics };
    }
  }

  // 2. Sticky untuk itemId yang sama (regenerate / retry)
  if (safeItem && repo?.getUsageForItem) {
    try {
      const existing = await repo.getUsageForItem(safeItem);
      if (existing?.kit_key) {
        const stickyKit = getKit(existing.kit_key);
        if (stickyKit) {
          return { kit: stickyKit, reason: 'sticky', topics };
        }
      }
    } catch (err) {
      console.warn('[MetaphorKitResolver] Gagal cek sticky usage (lanjut tanpa sticky):', err.message);
    }
  }

  // 3. Deteksi topik & kandidat kit
  const candidates = listKitsByTopics(topics);
  if (candidates.length === 0) {
    return null;
  }

  // 4. Ambil recent usage untuk brand di tenant ini
  const rotWindow = Math.max(1, Number(window) || 6);
  let recent = [];
  let dbReadFailed = false;
  if (repo?.getRecentKitKeys) {
    try {
      recent = await repo.getRecentKitKeys(safeTenant, safeBrand, Math.max(rotWindow * 2, 20));
    } catch (err) {
      dbReadFailed = true;
      console.warn('[MetaphorKitResolver] Gagal membaca recent usage (fallback tanpa rotasi):', err.message);
    }
  }

  // 5. Filter pool anti-repeat dalam window N terakhir; jika habis pakai LRU
  const recentWindowSet = new Set(recent.slice(0, rotWindow));
  const freshPool = candidates.filter(c => !recentWindowSet.has(c.key));
  const seedKey = safeItem || String(text || 'seed');

  let chosen;
  let reason = dbReadFailed ? 'fallback_no_db' : 'rotation';

  if (freshPool.length > 0) {
    chosen = freshPool[stableHash(seedKey) % freshPool.length];
  } else {
    // LRU: urutkan kandidat dari paling lama dipakai (index terbesar di `recent`, atau tidak ada di `recent`)
    const ranked = candidates.map(c => {
      const idx = recent.indexOf(c.key);
      return { kit: c, rank: idx === -1 ? Number.MAX_SAFE_INTEGER : idx };
    });
    ranked.sort((a, b) => b.rank - a.rank);
    const maxRank = ranked[0].rank;
    const oldestTier = ranked.filter(r => r.rank === maxRank).map(r => r.kit);
    chosen = oldestTier[stableHash(seedKey) % oldestTier.length];
    if (!dbReadFailed) reason = 'lru_rotation';
  }

  // 6. Reservasi usage
  await tryUpsert(chosen.key, reason);
  return { kit: chosen, reason, topics };
}

