/**
 * Unified Content Performance Metrics Collector (Meta Graph API & Repliz)
 * Safe rate limiting (300ms pause, max 400 calls per run), strict tenant isolation,
 * zero secret leakage, idempotent upserts.
 */

import crypto from 'node:crypto';
import { pgQuery } from './db-pg.js';
import { decryptSecret } from './encrypted-secret.js';
import { redactCredentials } from './repliz-client.js';
import {
  getReplizAccountStatistic,
  getReplizContentStatistic
} from './repliz-client.js';
import {
  getMetaTokenInfo,
  getFacebookPageDailyInsights,
  getFacebookPostInsights
} from './meta-insights-client.js';
import {
  normalizeContentStatistic,
  normalizeAccountDaily,
  determineSnapshotTags,
  detectInsightsStatus
} from './repliz-metrics-normalizer.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const MAX_CALLS_PER_RUN = 400;

export async function getReplizCredentials(tenantId = 'default_tenant') {
  const res = await pgQuery(
    `SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = $1 AND setting_key LIKE 'repliz_%'`,
    [tenantId]
  );
  const s = {};
  for (const r of res.rows) s[r.setting_key] = r.setting_value;
  const accessKey = s['repliz_access_key'] || process.env.REPLIZ_ACCESS_KEY || null;
  let secretKey = s['repliz_secret_key'] || process.env.REPLIZ_SECRET_KEY || null;
  if (secretKey) {
    try { secretKey = decryptSecret(secretKey); } catch (_) {}
  }
  return {
    apiUrl: s['repliz_api_url'] || process.env.REPLIZ_API_URL || 'https://api.repliz.com',
    accessKey,
    secretKey
  };
}

export async function collectMetrics({ tenantId = 'default_tenant', now = new Date(), dryRun = false, accountId = null } = {}) {
  let apiCallCount = 0;
  const summary = {
    tenantId,
    startedAt: now.toISOString(),
    dryRun,
    accountsProcessed: 0,
    dailyMetricRowsUpserted: 0,
    postSnapshotsUpserted: 0,
    apiCallsMade: 0,
    errors: [],
    details: []
  };

  const trackCall = () => {
    if (apiCallCount >= MAX_CALLS_PER_RUN) {
      throw new Error(`Batas aman pemanggilan API tercapai (${MAX_CALLS_PER_RUN} panggilan per jalan).`);
    }
    apiCallCount++;
    summary.apiCallsMade = apiCallCount;
  };

  try {
    // 1. Ambil akun publishing aktif
    const accParams = [tenantId];
    let accSql = `
      SELECT id, tenant_id, platform, display_name, facebook_page_id, instagram_user_id,
             provider, provider_account_id, token_ciphertext, status
      FROM publishing_accounts
      WHERE tenant_id = $1 AND status = 'active'
    `;
    if (accountId) {
      accParams.push(accountId);
      accSql += ` AND id = $2`;
    }
    accSql += ` ORDER BY platform ASC, display_name ASC`;

    const accRes = await pgQuery(accSql, accParams);
    const accounts = accRes.rows;

    // Ambil akun Meta aktif untuk mapping Facebook
    const metaFbAccountsRes = await pgQuery(`
      SELECT id, facebook_page_id, token_ciphertext
      FROM publishing_accounts
      WHERE tenant_id = $1 AND platform = 'facebook' AND provider = 'meta' AND status = 'active' AND facebook_page_id IS NOT NULL
    `, [tenantId]);
    const metaFbPageMap = new Map();
    for (const mf of metaFbAccountsRes.rows) {
      if (mf.token_ciphertext) {
        try {
          const dec = decryptSecret(mf.token_ciphertext);
          metaFbPageMap.set(String(mf.facebook_page_id), { id: mf.id, token: dec });
        } catch (_) {}
      }
    }

    // Ambil kredensial Repliz untuk tenant ini
    const replizCreds = await getReplizCredentials(tenantId);
    const hasReplizCreds = Boolean(replizCreds.accessKey && replizCreds.secretKey);

    // Rentang 30 hari untuk metrik harian
    const nowSec = Math.floor(now.getTime() / 1000);
    const thirtyDaysAgoSec = nowSec - (30 * 24 * 3600);
    const eightDaysAgo = new Date(now.getTime() - (8 * 24 * 3600 * 1000));

    // 2. Iterasi akun
    for (const acc of accounts) {
      summary.accountsProcessed++;
      const accDetail = {
        accountId: acc.id,
        platform: acc.platform,
        name: acc.display_name,
        provider: acc.provider,
        dailyRows: 0,
        postRows: 0,
        status: 'ok'
      };

      try {
        // ==============================================================
        // A. Akun Facebook
        // ==============================================================
        if (acc.platform === 'facebook') {
          // Cari apakah halaman ini terhubung ke app Meta
          let pageId = acc.facebook_page_id;
          let metaToken = null;

          if (acc.provider === 'meta' && acc.token_ciphertext) {
            try { metaToken = decryptSecret(acc.token_ciphertext); } catch (_) {}
          } else if (acc.provider === 'repliz') {
            // Cocokkan lewat facebook_page_id jika ada, atau nanti lewat postingan
            if (pageId && metaFbPageMap.has(String(pageId))) {
              metaToken = metaFbPageMap.get(String(pageId)).token;
            }
          }

          if (metaToken && pageId) {
            // Ambil Daily Insights dari Meta Graph API
            trackCall();
            await sleep(300);
            const pageInsights = await getFacebookPageDailyInsights(pageId, metaToken, thirtyDaysAgoSec, nowSec);
            const dailyRows = normalizeAccountDaily('facebook', pageInsights, { source: 'meta_api' });

            for (const d of dailyRows) {
              const rowId = `${tenantId}:${acc.id}:${d.metric_date}`;
              if (!dryRun) {
                await pgQuery(`
                  INSERT INTO account_metric_daily (
                    id, tenant_id, publishing_account_id, provider_account_id, platform,
                    metric_date, source, views, reach, engagement, video_views, profile_views,
                    new_follows, unfollows, followers_total, raw_json, captured_at
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
                  ON CONFLICT (tenant_id, publishing_account_id, metric_date) DO UPDATE SET
                    views = EXCLUDED.views,
                    reach = EXCLUDED.reach,
                    engagement = EXCLUDED.engagement,
                    video_views = EXCLUDED.video_views,
                    profile_views = EXCLUDED.profile_views,
                    new_follows = EXCLUDED.new_follows,
                    unfollows = EXCLUDED.unfollows,
                    followers_total = EXCLUDED.followers_total,
                    raw_json = EXCLUDED.raw_json,
                    captured_at = CURRENT_TIMESTAMP
                `, [
                  rowId, tenantId, acc.id, acc.provider_account_id, 'facebook',
                  d.metric_date, 'meta_api', d.views, d.reach, d.engagement, d.video_views,
                  d.profile_views, d.new_follows, d.unfollows, d.followers_total, JSON.stringify(d.raw_json)
                ]);
                summary.dailyMetricRowsUpserted++;
              }
              accDetail.dailyRows++;
            }

            if (!dryRun) {
              await pgQuery(`
                UPDATE publishing_accounts
                SET insights_status = 'ok', insights_checked_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND tenant_id = $2
              `, [acc.id, tenantId]);
            }
          } else {
            // Facebook tanpa akun Meta
            if (!dryRun) {
              await pgQuery(`
                UPDATE publishing_accounts
                SET insights_status = 'unavailable', insights_checked_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND tenant_id = $2
              `, [acc.id, tenantId]);
            }
          }

          // Ambil postingan Facebook yang dipublish 8 hari terakhir
          const jobsRes = await pgQuery(`
            SELECT id, content_id, account_id, platform, external_post_id, external_permalink,
                   provider_state_json->>'postId' as json_post_id,
                   published_at, created_at
            FROM publishing_jobs
            WHERE tenant_id = $1 AND account_id = $2 AND status = 'published' AND created_at >= $3
            ORDER BY created_at DESC
          `, [tenantId, acc.id, eightDaysAgo]);

          for (const job of jobsRes.rows) {
            const resolvedPostId = job.external_post_id || job.json_post_id;
            if (!resolvedPostId) continue;

            const postPubDate = job.published_at || job.created_at;
            const ageHours = (now.getTime() - new Date(postPubDate).getTime()) / (1000 * 3600);
            const tags = determineSnapshotTags(postPubDate, now);

            let rawPostData = null;
            let postSource = 'repliz';

            // Jika ada Meta Token untuk halaman ini, prioritaskan Meta Graph API
            if (metaToken) {
              trackCall();
              await sleep(300);
              const metaPostRes = await getFacebookPostInsights(resolvedPostId, metaToken);
              if (!metaPostRes.error) {
                rawPostData = metaPostRes;
                postSource = 'meta_api';
              }
            }

            // Fallback ke Repliz jika Meta tidak tersedia
            if (!rawPostData && hasReplizCreds && acc.provider_account_id) {
              trackCall();
              await sleep(300);
              try {
                rawPostData = await getReplizContentStatistic(replizCreds, acc.provider_account_id, resolvedPostId);
                postSource = 'repliz';
              } catch (_) {}
            }

            if (rawPostData) {
              const norm = normalizeContentStatistic('facebook', rawPostData, { ageHours, source: postSource });

              for (const tag of tags) {
                const snapId = `${tenantId}:${acc.id}:${resolvedPostId}:${tag}`;
                if (!dryRun) {
                  await pgQuery(`
                    INSERT INTO post_metric_snapshots (
                      id, tenant_id, publishing_job_id, publishing_account_id, platform,
                      external_post_id, permalink, post_created_at, snapshot_tag,
                      source, age_hours, views, reach, clicks, reactions, likes,
                      comments, shares, saves, avg_watch_sec, total_watch_sec,
                      view_pct, full_watch_rate, skip_rate, insight_available,
                      raw_json, captured_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, CURRENT_TIMESTAMP)
                    ON CONFLICT (tenant_id, publishing_account_id, external_post_id, snapshot_tag) DO UPDATE SET
                      age_hours = EXCLUDED.age_hours,
                      views = EXCLUDED.views,
                      reach = EXCLUDED.reach,
                      clicks = EXCLUDED.clicks,
                      reactions = EXCLUDED.reactions,
                      likes = EXCLUDED.likes,
                      comments = EXCLUDED.comments,
                      shares = EXCLUDED.shares,
                      saves = EXCLUDED.saves,
                      avg_watch_sec = EXCLUDED.avg_watch_sec,
                      total_watch_sec = EXCLUDED.total_watch_sec,
                      view_pct = EXCLUDED.view_pct,
                      full_watch_rate = EXCLUDED.full_watch_rate,
                      skip_rate = EXCLUDED.skip_rate,
                      insight_available = EXCLUDED.insight_available,
                      raw_json = EXCLUDED.raw_json,
                      captured_at = CURRENT_TIMESTAMP
                  `, [
                    snapId, tenantId, job.id, acc.id, 'facebook',
                    resolvedPostId, job.external_permalink, postPubDate, tag,
                    postSource, Number(ageHours.toFixed(2)), norm.views, norm.reach, norm.clicks,
                    norm.reactions, norm.likes, norm.comments, norm.shares, norm.saves,
                    norm.avg_watch_sec, norm.total_watch_sec, norm.view_pct, norm.full_watch_rate,
                    norm.skip_rate, norm.insight_available, JSON.stringify(rawPostData)
                  ]);
                  summary.postSnapshotsUpserted++;
                }
                accDetail.postRows++;
              }
            }
          }

        // ==============================================================
        // B. Akun Platform Lain (Instagram, TikTok, YouTube, Threads)
        // ==============================================================
        } else if (hasReplizCreds && acc.provider_account_id) {
          trackCall();
          await sleep(300);
          const rawAccStat = await getReplizAccountStatistic(replizCreds, acc.provider_account_id);
          const dailyRows = normalizeAccountDaily(acc.platform, rawAccStat, { source: 'repliz' });

          for (const d of dailyRows) {
            const rowId = `${tenantId}:${acc.id}:${d.metric_date}`;
            if (!dryRun) {
              await pgQuery(`
                INSERT INTO account_metric_daily (
                  id, tenant_id, publishing_account_id, provider_account_id, platform,
                  metric_date, source, views, reach, engagement, video_views, profile_views,
                  new_follows, unfollows, followers_total, raw_json, captured_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
                ON CONFLICT (tenant_id, publishing_account_id, metric_date) DO UPDATE SET
                  views = EXCLUDED.views,
                  reach = EXCLUDED.reach,
                  engagement = EXCLUDED.engagement,
                  video_views = EXCLUDED.video_views,
                  profile_views = EXCLUDED.profile_views,
                  new_follows = EXCLUDED.new_follows,
                  unfollows = EXCLUDED.unfollows,
                  followers_total = EXCLUDED.followers_total,
                  raw_json = EXCLUDED.raw_json,
                  captured_at = CURRENT_TIMESTAMP
              `, [
                rowId, tenantId, acc.id, acc.provider_account_id, acc.platform,
                d.metric_date, 'repliz', d.views, d.reach, d.engagement, d.video_views,
                d.profile_views, d.new_follows, d.unfollows, d.followers_total, JSON.stringify(d.raw_json)
              ]);
              summary.dailyMetricRowsUpserted++;
            }
            accDetail.dailyRows++;
          }

          if (!dryRun) {
            await pgQuery(`
              UPDATE publishing_accounts
              SET insights_status = 'ok', insights_checked_at = CURRENT_TIMESTAMP
              WHERE id = $1 AND tenant_id = $2
            `, [acc.id, tenantId]);
          }

          // Ambil postingan untuk platform ini 8 hari terakhir
          const jobsRes = await pgQuery(`
            SELECT id, content_id, account_id, platform, external_post_id, external_permalink,
                   provider_state_json->>'postId' as json_post_id,
                   published_at, created_at
            FROM publishing_jobs
            WHERE tenant_id = $1 AND account_id = $2 AND status = 'published' AND created_at >= $3
            ORDER BY created_at DESC
          `, [tenantId, acc.id, eightDaysAgo]);

          for (const job of jobsRes.rows) {
            const resolvedPostId = job.external_post_id || job.json_post_id;
            if (!resolvedPostId) continue;

            const postPubDate = job.published_at || job.created_at;
            const ageHours = (now.getTime() - new Date(postPubDate).getTime()) / (1000 * 3600);
            const tags = determineSnapshotTags(postPubDate, now);

            trackCall();
            await sleep(300);
            let rawContentStat = null;
            try {
              rawContentStat = await getReplizContentStatistic(replizCreds, acc.provider_account_id, resolvedPostId);
            } catch (postErr) {
              // Jika gagal, lanjut ke postingan berikutnya
              continue;
            }

            if (rawContentStat) {
              const norm = normalizeContentStatistic(acc.platform, rawContentStat, { ageHours, source: 'repliz' });

              for (const tag of tags) {
                const snapId = `${tenantId}:${acc.id}:${resolvedPostId}:${tag}`;
                if (!dryRun) {
                  await pgQuery(`
                    INSERT INTO post_metric_snapshots (
                      id, tenant_id, publishing_job_id, publishing_account_id, platform,
                      external_post_id, permalink, post_created_at, snapshot_tag,
                      source, age_hours, views, reach, clicks, reactions, likes,
                      comments, shares, saves, avg_watch_sec, total_watch_sec,
                      view_pct, full_watch_rate, skip_rate, insight_available,
                      raw_json, captured_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, CURRENT_TIMESTAMP)
                    ON CONFLICT (tenant_id, publishing_account_id, external_post_id, snapshot_tag) DO UPDATE SET
                      age_hours = EXCLUDED.age_hours,
                      views = EXCLUDED.views,
                      reach = EXCLUDED.reach,
                      clicks = EXCLUDED.clicks,
                      reactions = EXCLUDED.reactions,
                      likes = EXCLUDED.likes,
                      comments = EXCLUDED.comments,
                      shares = EXCLUDED.shares,
                      saves = EXCLUDED.saves,
                      avg_watch_sec = EXCLUDED.avg_watch_sec,
                      total_watch_sec = EXCLUDED.total_watch_sec,
                      view_pct = EXCLUDED.view_pct,
                      full_watch_rate = EXCLUDED.full_watch_rate,
                      skip_rate = EXCLUDED.skip_rate,
                      insight_available = EXCLUDED.insight_available,
                      raw_json = EXCLUDED.raw_json,
                      captured_at = CURRENT_TIMESTAMP
                  `, [
                    snapId, tenantId, job.id, acc.id, acc.platform,
                    resolvedPostId, job.external_permalink, postPubDate, tag,
                    'repliz', Number(ageHours.toFixed(2)), norm.views, norm.reach, norm.clicks,
                    norm.reactions, norm.likes, norm.comments, norm.shares, norm.saves,
                    norm.avg_watch_sec, norm.total_watch_sec, norm.view_pct, norm.full_watch_rate,
                    norm.skip_rate, norm.insight_available, JSON.stringify(rawContentStat)
                  ]);
                  summary.postSnapshotsUpserted++;
                }
                accDetail.postRows++;
              }
            }
          }
        }
      } catch (err) {
        accDetail.status = 'error';
        accDetail.error = redactCredentials(err.message || String(err));
        summary.errors.push({ accountId: acc.id, error: accDetail.error });
      }

      summary.details.push(accDetail);
    }
  } catch (globalErr) {
    summary.errors.push({ global: redactCredentials(globalErr.message || String(globalErr)) });
  }

  return summary;
}
