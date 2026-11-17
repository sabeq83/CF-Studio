/**
 * Backfill: perbaiki link Instagram job publish Repliz yang tersimpan sebagai ID angka
 * (https://www.instagram.com/reel/<angka>/ — tidak bisa dibuka) menjadi link resmi shortcode
 * yang diambil dari Repliz Get One Content.
 *
 * Penggunaan (di server, schema mengikuti PG_SEARCH_PATH):
 *   node --env-file=.env.local scripts/backfill-instagram-permalink.mjs            # dry-run (tidak menulis)
 *   node --env-file=.env.local scripts/backfill-instagram-permalink.mjs --apply    # tulis perubahan
 *   Opsional: --tenant=<tenant_id>  --limit=200
 */
import { getPgPool } from '../lib/db-pg.js';
import { getReplizContent, normalizeInstagramPermalink } from '../lib/repliz-client.js';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const APPLY = Boolean(args.apply);
const LIMIT = parseInt(args.limit || '200', 10);

async function main() {
  const pool = getPgPool();
  const params = [];
  let filter = '';
  if (args.tenant) { params.push(args.tenant); filter = `AND j.tenant_id = $${params.length}`; }
  params.push(LIMIT);
  const { rows } = await pool.query(`
    SELECT j.id, j.tenant_id, j.content_id, j.external_post_id, j.external_permalink, a.provider_account_id
    FROM publishing_jobs j
    JOIN publishing_accounts a ON a.id = j.account_id AND a.tenant_id = j.tenant_id
    WHERE j.provider = 'repliz' AND j.platform = 'instagram' AND j.status = 'published'
      AND j.external_post_id IS NOT NULL
      AND (j.external_permalink IS NULL OR j.external_permalink ~ 'instagram\\.com/(reel|p)/[0-9]+/?$')
      ${filter}
    ORDER BY j.published_at DESC NULLS LAST, j.updated_at DESC
    LIMIT $${params.length}`, params);

  console.log(`[Backfill IG] ${rows.length} job Instagram dengan link angka. Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  const credCache = {};
  let ok = 0, gagal = 0;
  for (const r of rows) {
    if (!credCache[r.tenant_id]) {
      const s = await pool.query(
        `SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = $1 AND setting_key IN ('repliz_api_url','repliz_access_key','repliz_secret_key')`,
        [r.tenant_id]);
      const m = Object.fromEntries(s.rows.map((x) => [x.setting_key, x.setting_value]));
      credCache[r.tenant_id] = { apiUrl: m.repliz_api_url || 'https://api.repliz.com', accessKey: m.repliz_access_key, secretKey: m.repliz_secret_key };
    }
    let link = null;
    try {
      const c = await getReplizContent(credCache[r.tenant_id], r.external_post_id, r.provider_account_id);
      link = normalizeInstagramPermalink(c?.url);
    } catch (err) {
      console.log(`  ✗ ${r.id}: ${err.message}`);
    }
    if (!link) { gagal++; continue; }
    ok++;
    console.log(`  ✓ ${r.id} (${r.content_id}): ${link}`);
    if (APPLY) {
      await pool.query(`UPDATE publishing_jobs SET external_permalink = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`, [link, r.id, r.tenant_id]);
      await pool.query(
        `UPDATE content_flow_items SET permalink_instagram = $1 WHERE (video_id = $2 OR id = $2) AND tenant_id = $3
           AND (permalink_instagram IS NULL OR permalink_instagram ~ 'instagram\\.com/(reel|p)/[0-9]+/?$')`,
        [link, r.content_id, r.tenant_id]);
    }
  }
  console.log(`[Backfill IG] Selesai: ${ok} link ditemukan, ${gagal} gagal/tidak ditemukan.${APPLY ? '' : ' (dry-run, tidak ada yang ditulis)'}`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
