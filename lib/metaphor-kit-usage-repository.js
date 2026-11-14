import crypto from 'crypto';
import { pgQuery } from './db-pg.js';

export const METAPHOR_KIT_USAGE_DDL = `
CREATE TABLE IF NOT EXISTS metaphor_kit_usage (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  brand_profile_id TEXT,
  campaign_id TEXT,
  item_id TEXT NOT NULL UNIQUE,
  kit_key TEXT NOT NULL,
  topic_keys TEXT,
  reason TEXT,
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mku_brand_recent ON metaphor_kit_usage (tenant_id, brand_profile_id, used_at DESC);
`;

export async function getRecentKitKeys(tenantId, brandProfileId, limit = 6) {
  const safeTenant = String(tenantId || 'default_tenant');
  const safeLimit = Math.max(1, Number(limit) || 6);

  const res = brandProfileId
    ? await pgQuery(
        `SELECT kit_key FROM metaphor_kit_usage
         WHERE tenant_id = $1 AND brand_profile_id = $2
         ORDER BY used_at DESC
         LIMIT $3`,
        [safeTenant, String(brandProfileId), safeLimit]
      )
    : await pgQuery(
        `SELECT kit_key FROM metaphor_kit_usage
         WHERE tenant_id = $1 AND brand_profile_id IS NULL
         ORDER BY used_at DESC
         LIMIT $2`,
        [safeTenant, safeLimit]
      );

  return (res?.rows || []).map(r => r.kit_key).filter(Boolean);
}

export async function getUsageForItem(itemId) {
  if (!itemId) return null;
  const res = await pgQuery(
    `SELECT * FROM metaphor_kit_usage WHERE item_id = $1 LIMIT 1`,
    [String(itemId)]
  );
  return res?.rows?.[0] || null;
}

export async function upsertUsage({
  id = null,
  tenantId = 'default_tenant',
  brandProfileId = null,
  campaignId = null,
  itemId,
  kitKey,
  topicKeys = [],
  reason = 'rotation',
}) {
  if (!itemId || !kitKey) {
    throw new Error('upsertUsage requires itemId and kitKey');
  }
  const rowId = id || `mku_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
  const serializedTopics = Array.isArray(topicKeys) ? JSON.stringify(topicKeys) : String(topicKeys || '[]');

  const res = await pgQuery(
    `INSERT INTO metaphor_kit_usage (id, tenant_id, brand_profile_id, campaign_id, item_id, kit_key, topic_keys, reason, used_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
     ON CONFLICT (item_id) DO UPDATE SET
       kit_key = EXCLUDED.kit_key,
       topic_keys = EXCLUDED.topic_keys,
       reason = EXCLUDED.reason,
       used_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      rowId,
      String(tenantId || 'default_tenant'),
      brandProfileId ? String(brandProfileId) : null,
      campaignId ? String(campaignId) : null,
      String(itemId),
      String(kitKey),
      serializedTopics,
      String(reason || 'rotation'),
    ]
  );

  return res?.rows?.[0] || null;
}

