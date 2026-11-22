import pg from 'pg';
const { Pool } = pg;
import { decryptSecret } from '../lib/encrypted-secret.js';

async function main() {
  const pool = new Pool({
    host: process.env.PGHOST || '100.78.186.123',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'makna_user',
    password: process.env.PGPASSWORD || 'maknagridpass',
    database: process.env.PGDATABASE || 'maknaflow_db',
  });

  const settingsRes = await pool.query(`
    SELECT setting_key, setting_value 
    FROM staging.tenant_settings 
    WHERE tenant_id = 'default_tenant' AND setting_key LIKE 'repliz_%'
  `);
  const s = {};
  for (const r of settingsRes.rows) s[r.setting_key] = r.setting_value;
  const accessKey = s['repliz_access_key'];
  let secretKey = s['repliz_secret_key'];
  try { secretKey = decryptSecret(secretKey); } catch (e) {}
  const auth = 'Basic ' + Buffer.from(accessKey + ':' + secretKey).toString('base64');
  const replizUrl = s['repliz_api_url'] || 'https://api.repliz.com';

  const targets = [
    { platform: 'tiktok', name: 'NutriBake ID', replizId: '6a85ad6362caae1e04fe96b3' },
    { platform: 'youtube', name: 'NutriBake ID', replizId: '6ad077c062caae1e047c1ecd' },
    { platform: 'threads', name: 'NutriBake ID', replizId: '6af3032ffc43f81b78728090' }
  ];

  const results = {};

  for (const t of targets) {
    console.log(`\n===============================================================`);
    console.log(`>>> UJI PLATFORM: ${t.platform.toUpperCase()} (${t.name} - ${t.replizId})`);
    console.log(`===============================================================`);

    // 1. Account statistic
    const accUrl = `${replizUrl}/public/account/${t.replizId}/statistic`;
    const accRes = await fetch(accUrl, {
      headers: { Authorization: auth, 'Content-Type': 'application/json' }
    });
    console.log(`GET /public/account/${t.replizId}/statistic -> HTTP ${accRes.status}`);
    const accData = await accRes.json();
    console.log(`Account Stat Keys:`, Object.keys(accData?.data || accData || {}));
    console.log(`Account Stat Sample:`, JSON.stringify(accData?.data || accData, null, 2).slice(0, 500));

    // 2. Content list
    const contentUrl = `${replizUrl}/public/content?accountId=${t.replizId}&limit=3`;
    const cRes = await fetch(contentUrl, {
      headers: { Authorization: auth, 'Content-Type': 'application/json' }
    });
    console.log(`GET /public/content?accountId=${t.replizId} -> HTTP ${cRes.status}`);
    const cData = await cRes.json();
    const docs = cData?.data || cData?.docs || cData || [];
    console.log(`Content items count: ${Array.isArray(docs) ? docs.length : 0}`);

    let firstContentStat = null;
    if (Array.isArray(docs) && docs.length > 0) {
      const firstItem = docs[0];
      const contentId = firstItem.id || firstItem._id;
      console.log(`First item ID: ${contentId}, type: ${firstItem.type}, title: ${firstItem.title}`);

      // 3. Content statistic
      const statUrl = `${replizUrl}/public/content/${encodeURIComponent(contentId)}/statistic?accountId=${t.replizId}`;
      const statRes = await fetch(statUrl, {
        headers: { Authorization: auth, 'Content-Type': 'application/json' }
      });
      console.log(`GET /public/content/${contentId}/statistic -> HTTP ${statRes.status}`);
      firstContentStat = await statRes.json();
      console.log(`Content Stat Result:`, JSON.stringify(firstContentStat, null, 2));
    }

    results[t.platform] = {
      accountStat: accData?.data || accData,
      contentSample: Array.isArray(docs) && docs.length > 0 ? docs[0] : null,
      contentStatSample: firstContentStat?.data || firstContentStat
    };
  }

  await pool.end();
  console.log('\n--- FULL SUMMARY JSON ---');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
