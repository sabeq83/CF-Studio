import pg from 'pg';
const { Pool } = pg;
import { decryptSecret } from '../lib/encrypted-secret.js';
import { getGraphApiVersion, getGraphBaseUrl } from '../lib/meta-publisher.js';

let totalApiCalls = 0;
const MAX_API_CALLS = 40;

async function safeFetch(url, options = {}, label = '') {
  if (totalApiCalls >= MAX_API_CALLS) {
    return { skipped: true, reason: `Batas kuota panggilan API (${MAX_API_CALLS}) tercapai.` };
  }
  totalApiCalls++;
  const callNum = totalApiCalls;
  try {
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (e) {
      json = { rawText: text.slice(0, 300) };
    }
    return {
      callNum,
      status: res.status,
      ok: res.ok,
      data: json
    };
  } catch (err) {
    return {
      callNum,
      status: 0,
      ok: false,
      error: err.message
    };
  }
}

async function main() {
  console.log('===============================================================');
  console.log('   UJI INSIGHT INSTAGRAM 2 AKUN (READ-ONLY DIAGNOSTIC)         ');
  console.log('===============================================================');
  console.log(`Waktu: ${new Date().toISOString()}`);
  console.log(`Versi Graph API: ${getGraphApiVersion()}`);
  console.log(`Base URL: ${getGraphBaseUrl()}\n`);

  const pool = new Pool({
    host: process.env.PGHOST || '100.78.186.123',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'makna_user',
    password: process.env.PGPASSWORD || 'maknagridpass',
    database: process.env.PGDATABASE || 'maknaflow_db',
  });

  // 1. Ambil Pengaturan Repliz dari staging.tenant_settings
  const replizSettingsRes = await pool.query(`
    SELECT setting_key, setting_value 
    FROM staging.tenant_settings 
    WHERE tenant_id = 'default_tenant' AND setting_key LIKE 'repliz_%'
  `);
  const replizSettings = {};
  for (const row of replizSettingsRes.rows) {
    replizSettings[row.setting_key] = row.setting_value;
  }
  const replizAccessKey = replizSettings['repliz_access_key'];
  let replizSecretKey = replizSettings['repliz_secret_key'];
  try {
    replizSecretKey = decryptSecret(replizSecretKey);
  } catch (e) {}
  const replizApiUrl = replizSettings['repliz_api_url'] || 'https://api.repliz.com';
  const hasReplizCreds = Boolean(replizAccessKey && replizSecretKey);
  const replizAuthHeader = hasReplizCreds
    ? 'Basic ' + Buffer.from(`${replizAccessKey}:${replizSecretKey}`).toString('base64')
    : null;

  // 2. Target Instagram
  const targets = [
    {
      handle: '@dapur_botani',
      igUserId: '17841439243921276',
      linkedFbPageId: '1030799026791337',
      metaAccId: 'acc_instagram_1786756995708_7d6d9e',
      replizAccId: 'acc_repliz_instagram_1787150716369_f10af8',
      replizId: '6a85a5f962caae1e04fe8301'
    },
    {
      handle: '@nutribake_id',
      igUserId: '17841479686815774',
      linkedFbPageId: '1071656722705640',
      metaAccId: 'acc_instagram_1786756995693_d72e37',
      replizAccId: 'acc_repliz_instagram_1787150716356_3747ac',
      replizId: '6a85ad8a62caae1e04fe975e'
    }
  ];

  // Ambil token akun Meta
  const metaAccQuery = await pool.query(`
    SELECT id, display_name, token_ciphertext
    FROM staging.publishing_accounts
    WHERE id = ANY($1)
  `, [targets.map(t => t.metaAccId)]);

  const metaTokens = new Map();
  for (const r of metaAccQuery.rows) {
    metaTokens.set(r.id, decryptSecret(r.token_ciphertext));
  }

  // Ambil data jobs publikasi Repliz untuk Instagram
  const publishedJobsMap = new Map();
  for (const t of targets) {
    const jobsRes = await pool.query(`
      SELECT 
        id, content_id, account_id, external_post_id, external_permalink, external_schedule_id,
        provider_state_json->>'postId' as json_post_id,
        provider_state_json->>'permalink' as json_permalink,
        created_at, published_at
      FROM staging.publishing_jobs
      WHERE account_id = $1 AND status = 'published'
      ORDER BY created_at DESC
      LIMIT 5
    `, [t.replizAccId]);
    publishedJobsMap.set(t.handle, jobsRes.rows);
  }

  const graphBaseUrl = getGraphBaseUrl();
  const fullReport = {
    targets: []
  };

  // Timestamp 7 hari terakhir (since - until)
  const nowSec = Math.floor(Date.now() / 1000);
  const sevenDaysAgoSec = nowSec - (7 * 24 * 3600);

  for (const t of targets) {
    console.log('===============================================================');
    console.log(`>>> MEMERIKSA TARGET INSTAGRAM: ${t.handle} (IG User ID: ${t.igUserId})`);
    console.log('===============================================================');

    const token = metaTokens.get(t.metaAccId);
    const targetReport = {
      handle: t.handle,
      igUserId: t.igUserId,
      replizId: t.replizId,
      meta: {
        tokenPermissions: null,
        hasInstagramManageInsights: false,
        profile: null,
        accountInsights: {},
        mediaList: [],
        mediaInsights: {}
      },
      repliz: {
        accountStatistic: null,
        contentList: [],
        contentStatistics: []
      }
    };

    // A.1 Cek Token Scopes via debug_token
    console.log('\n--- [A.1] Cek Izin Token via /debug_token ---');
    const debugRes = await safeFetch(`${graphBaseUrl}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`, {}, 'debug_token');
    if (debugRes.ok && debugRes.data?.data) {
      const scopes = debugRes.data.data.scopes || [];
      targetReport.meta.tokenPermissions = scopes;
      targetReport.meta.hasInstagramManageInsights = scopes.includes('instagram_manage_insights');
      console.log(`Token Valid: ${debugRes.data.data.is_valid}, Type: ${debugRes.data.data.type}`);
      console.log(`Scopes:`, JSON.stringify(scopes));
      console.log(`Punya 'instagram_manage_insights': ${targetReport.meta.hasInstagramManageInsights ? 'YA' : 'TIDAK'}`);
    } else {
      console.log('Gagal debug_token:', debugRes.data?.error || debugRes.error);
    }

    // A.2 Profil Akun
    console.log('\n--- [A.2] Profil Akun Instagram via Graph API ---');
    const profileRes = await safeFetch(`${graphBaseUrl}/${t.igUserId}?fields=username,followers_count,follows_count,media_count&access_token=${encodeURIComponent(token)}`, {}, 'ig_profile');
    console.log(`GET /${t.igUserId} profile -> HTTP ${profileRes.status}`);
    if (profileRes.ok) {
      targetReport.meta.profile = profileRes.data;
      console.log('  ✓ [SUKSES PROFIL]', JSON.stringify(profileRes.data));
    } else {
      targetReport.meta.profile = { error: profileRes.data?.error || profileRes.error };
      console.log('  ✗ [GAGAL PROFIL]', JSON.stringify(profileRes.data?.error || profileRes.error));
    }

    // A.3 Insight Akun 7 Hari
    console.log('\n--- [A.3] Uji Insight Akun 7 Hari per Metrik ---');
    const accountMetrics = [
      { name: 'reach', url: `${graphBaseUrl}/${t.igUserId}/insights?metric=reach&period=day&metric_type=total_value&since=${sevenDaysAgoSec}&until=${nowSec}&access_token=${encodeURIComponent(token)}` },
      { name: 'views', url: `${graphBaseUrl}/${t.igUserId}/insights?metric=views&period=day&metric_type=total_value&since=${sevenDaysAgoSec}&until=${nowSec}&access_token=${encodeURIComponent(token)}` },
      { name: 'accounts_engaged', url: `${graphBaseUrl}/${t.igUserId}/insights?metric=accounts_engaged&period=day&metric_type=total_value&since=${sevenDaysAgoSec}&until=${nowSec}&access_token=${encodeURIComponent(token)}` },
      { name: 'total_interactions', url: `${graphBaseUrl}/${t.igUserId}/insights?metric=total_interactions&period=day&metric_type=total_value&since=${sevenDaysAgoSec}&until=${nowSec}&access_token=${encodeURIComponent(token)}` },
      { name: 'follower_count', url: `${graphBaseUrl}/${t.igUserId}/insights?metric=follower_count&period=day&since=${sevenDaysAgoSec}&until=${nowSec}&access_token=${encodeURIComponent(token)}` }
    ];

    for (const am of accountMetrics) {
      const res = await safeFetch(am.url, {}, `ig_acc_metric_${am.name}`);
      if (res.ok) {
        targetReport.meta.accountInsights[am.name] = {
          success: true,
          data: res.data?.data?.[0]?.total_value || res.data?.data?.[0]?.values || res.data
        };
        console.log(`  ✓ [SUKSES AKUN] ${am.name}:`, JSON.stringify(targetReport.meta.accountInsights[am.name].data));
      } else {
        const err = res.data?.error || { message: res.error || 'Unknown error', code: res.status };
        targetReport.meta.accountInsights[am.name] = {
          success: false,
          errorCode: err.code,
          errorSubcode: err.error_subcode,
          errorMessage: err.message
        };
        console.log(`  ✗ [GAGAL AKUN] ${am.name}: (${err.code}/${err.error_subcode || '-'}) ${err.message}`);
      }
    }

    // A.4 Daftar Media Instagram via Graph API
    console.log('\n--- [A.4] Ambil Daftar Media via Graph API ---');
    const mediaListRes = await safeFetch(`${graphBaseUrl}/${t.igUserId}/media?fields=id,media_product_type,permalink,timestamp,like_count,comments_count&limit=15&access_token=${encodeURIComponent(token)}`, {}, 'ig_media_list');
    console.log(`GET /${t.igUserId}/media -> HTTP ${mediaListRes.status}`);
    const graphMediaItems = mediaListRes.ok && Array.isArray(mediaListRes.data?.data) ? mediaListRes.data.data : [];
    targetReport.meta.mediaList = graphMediaItems.slice(0, 5);
    console.log(`Ditemukan ${graphMediaItems.length} media via Graph API.`);

    // Bandingkan dengan data published jobs Repliz
    const replizJobs = publishedJobsMap.get(t.handle) || [];
    console.log(`Ditemukan ${replizJobs.length} postingan published Repliz di DB untuk ${t.handle}.`);

    // Pilih 1-2 media Reels untuk uji insight media
    const reelsToTest = graphMediaItems.filter(m => m.media_product_type === 'REELS' || m.permalink?.includes('/reel/') || m.permalink?.includes('/p/')).slice(0, 2);
    if (reelsToTest.length === 0 && graphMediaItems.length > 0) {
      reelsToTest.push(graphMediaItems[0]);
    }

    // A.5 Insight tiap Media
    console.log('\n--- [A.5] Uji Insight Media Instagram via Graph API ---');
    for (const mItem of reelsToTest) {
      console.log(`\n* Menguji Media ID: ${mItem.id} (Permalink: ${mItem.permalink})`);
      const mInsights = {};
      const mediaMetrics = [
        'views',
        'reach',
        'saved',
        'shares',
        'likes',
        'comments',
        'total_interactions',
        'ig_reels_avg_watch_time',
        'ig_reels_video_view_total_time'
      ];

      for (const mm of mediaMetrics) {
        const mUrl = `${graphBaseUrl}/${mItem.id}/insights?metric=${mm}&access_token=${encodeURIComponent(token)}`;
        const mRes = await safeFetch(mUrl, {}, `ig_media_metric_${mm}`);
        if (mRes.ok) {
          const val = mRes.data?.data?.[0]?.values?.[0]?.value ?? mRes.data?.data?.[0]?.values ?? mRes.data;
          mInsights[mm] = { success: true, value: val };
          console.log(`  ✓ [SUKSES MEDIA] ${mm}:`, JSON.stringify(val));
        } else {
          const err = mRes.data?.error || { message: mRes.error || 'Unknown error', code: mRes.status };
          mInsights[mm] = { success: false, errorCode: err.code, errorMessage: err.message };
          console.log(`  ✗ [GAGAL MEDIA] ${mm}: (${err.code}) ${err.message}`);
        }
      }
      targetReport.meta.mediaInsights[mItem.id] = {
        media: mItem,
        insights: mInsights
      };
    }

    // B.6 & B.7 & B.8 Pengujian Repliz Instagram
    console.log('\n--- [B.6, B.7, B.8] Pengujian Instagram via Repliz ---');
    if (hasReplizCreds) {
      // B.6 GET /public/account/{repliz_id}/statistic
      const rAccStatRes = await safeFetch(`${replizApiUrl}/public/account/${t.replizId}/statistic`, {
        headers: { Authorization: replizAuthHeader, 'Content-Type': 'application/json' }
      }, 'repliz_ig_acc_statistic');
      console.log(`GET /public/account/${t.replizId}/statistic -> HTTP ${rAccStatRes.status}`);
      if (rAccStatRes.ok) {
        const d = rAccStatRes.data?.data || rAccStatRes.data;
        targetReport.repliz.accountStatistic = {
          success: true,
          followersCount: d?.followersCount,
          followsCount: d?.followsCount,
          summary: d?.summary,
          metricsCount: Array.isArray(d?.metrics) ? d.metrics.length : 0
        };
        console.log(`  ✓ [REPLIZ STAT AKUN] Followers: ${d?.followersCount}, Summary: ${JSON.stringify(d?.summary)}, Metrics: ${targetReport.repliz.accountStatistic.metricsCount} hari`);
      } else {
        targetReport.repliz.accountStatistic = { success: false, status: rAccStatRes.status, error: rAccStatRes.data };
        console.log(`  ✗ [GAGAL REPLIZ STAT AKUN] HTTP ${rAccStatRes.status}`);
      }

      // B.7 GET /public/content?accountId={repliz_id}
      const rContentListRes = await safeFetch(`${replizApiUrl}/public/content?accountId=${t.replizId}&limit=5`, {
        headers: { Authorization: replizAuthHeader, 'Content-Type': 'application/json' }
      }, 'repliz_ig_content_list');
      console.log(`GET /public/content?accountId=${t.replizId} -> HTTP ${rContentListRes.status}`);
      const replizContents = rContentListRes.ok ? (rContentListRes.data?.data || rContentListRes.data?.docs || rContentListRes.data || []) : [];
      targetReport.repliz.contentList = Array.isArray(replizContents) ? replizContents.slice(0, 3) : [];
      console.log(`  Ditemukan ${Array.isArray(replizContents) ? replizContents.length : 0} konten di Repliz.`);
      if (Array.isArray(replizContents) && replizContents.length > 0) {
        console.log(`  Contoh ID konten Repliz: ${replizContents[0].id || replizContents[0]._id}, type: ${replizContents[0].type}, url: ${replizContents[0].url}`);
      }

      // B.8 GET /public/content/{id}/statistic?accountId={repliz_id} untuk Reels
      // Gunakan ID dari published jobs atau dari konten Repliz
      const sampleJobs = replizJobs.slice(0, 2);
      for (const j of sampleJobs) {
        const candIds = [];
        if (j.json_post_id) candIds.push({ id: j.json_post_id, type: 'json_post_id' });
        if (j.external_schedule_id) candIds.push({ id: j.external_schedule_id, type: 'schedule_id' });

        let statOk = false;
        let statResult = null;
        for (const c of candIds) {
          const cUrl = `${replizApiUrl}/public/content/${encodeURIComponent(c.id)}/statistic?accountId=${t.replizId}`;
          const cRes = await safeFetch(cUrl, {
            headers: { Authorization: replizAuthHeader, 'Content-Type': 'application/json' }
          }, `repliz_content_stat_${c.type}`);
          console.log(`  GET /public/content/${c.id}/statistic (${c.type}) -> HTTP ${cRes.status}`);
          if (cRes.ok) {
            statOk = true;
            statResult = { idUsed: c.id, typeUsed: c.type, data: cRes.data?.data || cRes.data };
            break;
          }
        }

        if (statOk) {
          targetReport.repliz.contentStatistics.push(statResult);
          console.log(`  ✓ [SUKSES REPLIZ CONTENT STAT]:`, JSON.stringify(statResult.data));
        } else {
          console.log(`  ✗ [GAGAL REPLIZ CONTENT STAT untuk job ${j.id}]`);
        }
      }
    }

    fullReport.targets.push(targetReport);
  }

  await pool.end();

  console.log('\n===============================================================');
  console.log(`TOTAL PANGGILAN API DIJALANKAN: ${totalApiCalls} / ${MAX_API_CALLS}`);
  console.log('===============================================================');
  console.log('\n### HASIL DIAGNOSTIK JSON LENGKAP:');
  console.log(JSON.stringify(fullReport, null, 2));
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
