import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeContentStatistic,
  normalizeAccountDaily,
  determineSnapshotTags,
  detectInsightsStatus,
  calculateEngagementScore
} from '../lib/repliz-metrics-normalizer.js';

test('normalizeContentStatistic - Meta API Facebook', () => {
  const rawMeta = {
    postData: {
      id: '1071656722705640_122119074963328298',
      reactionsCount: 5,
      commentsCount: 2,
      sharesCount: 1
    },
    insData: [
      { name: 'post_media_view', values: [{ value: 18 }] },
      { name: 'post_total_media_view_unique', values: [{ value: 12 }] },
      { name: 'post_clicks', values: [{ value: 3 }] }
    ],
    videoInsights: [
      { name: 'blue_reels_play_count', values: [{ value: 25 }] },
      { name: 'post_video_avg_time_watched', values: [{ value: 11362 }] }, // 11.362 ms
      { name: 'post_video_view_time', values: [{ value: 79540 }] } // 79.540 ms
    ]
  };

  const norm = normalizeContentStatistic('facebook', rawMeta, { source: 'meta_api' });
  assert.equal(norm.views, 25); // Reel play count prioritized
  assert.equal(norm.reach, 12);
  assert.equal(norm.clicks, 3);
  assert.equal(norm.reactions, 5);
  assert.equal(norm.comments, 2);
  assert.equal(norm.shares, 1);
  assert.equal(norm.avg_watch_sec, 11.362); // ms -> sec
  assert.equal(norm.total_watch_sec, 79.54); // ms -> sec
  assert.equal(norm.insight_available, true);
});

test('normalizeContentStatistic - Repliz Instagram Reels', () => {
  const rawIg = {
    mediaProductType: 'REELS',
    like: 13,
    comment: 2,
    share: 3,
    reach: 719,
    saved: 5,
    views: 968,
    averageWatchTime: 8.4,
    watchTime: 6215,
    skipRate: 39.4
  };

  const norm = normalizeContentStatistic('instagram', rawIg, { source: 'repliz' });
  assert.equal(norm.views, 968);
  assert.equal(norm.reach, 719);
  assert.equal(norm.likes, 13);
  assert.equal(norm.comments, 2);
  assert.equal(norm.shares, 3);
  assert.equal(norm.saves, 5);
  assert.equal(norm.avg_watch_sec, 8.4);
  assert.equal(norm.total_watch_sec, 6215);
  assert.equal(norm.skip_rate, 39.4);
  assert.equal(norm.insight_available, true);
});

test('normalizeContentStatistic - Repliz TikTok', () => {
  const rawTiktok = {
    like: 3,
    comment: 0,
    share: 0,
    reach: 0,
    views: 42,
    watched: 634,
    favourite: 1,
    averageWatched: 13.21,
    fullWatchedRate: 0.2917,
    websiteClicks: 2
  };

  const norm = normalizeContentStatistic('tiktok', rawTiktok, { source: 'repliz' });
  assert.equal(norm.views, 42);
  assert.equal(norm.likes, 3);
  assert.equal(norm.saves, 1);
  assert.equal(norm.clicks, 2);
  assert.equal(norm.avg_watch_sec, 13.21);
  assert.equal(norm.total_watch_sec, 634);
  assert.equal(norm.full_watch_rate, 0.2917);
  assert.equal(norm.insight_available, true);
});

test('normalizeContentStatistic - Repliz YouTube', () => {
  const rawYt = {
    like: 15,
    comment: 4,
    views: 1250,
    insight: {
      estimatedMinutesWatched: 120, // 120 min = 7200 sec
      averageViewDuration: 24,
      averageViewPercentage: 65.5,
      shares: 8
    }
  };

  const norm = normalizeContentStatistic('youtube', rawYt, { source: 'repliz' });
  assert.equal(norm.views, 1250);
  assert.equal(norm.likes, 15);
  assert.equal(norm.comments, 4);
  assert.equal(norm.shares, 8);
  assert.equal(norm.avg_watch_sec, 24);
  assert.equal(norm.total_watch_sec, 7200);
  assert.equal(norm.view_pct, 65.5);
  assert.equal(norm.full_watch_rate, 0.655);
  assert.equal(norm.insight_available, true);
});

test('normalizeContentStatistic - Repliz Threads', () => {
  const rawThreads = {
    like: 7,
    replies: 3,
    views: 85,
    repost: 2,
    share: 1
  };

  const norm = normalizeContentStatistic('threads', rawThreads, { source: 'repliz' });
  assert.equal(norm.views, 85);
  assert.equal(norm.likes, 7);
  assert.equal(norm.comments, 3);
  assert.equal(norm.shares, 3); // 2 repost + 1 share
  assert.equal(norm.insight_available, true);
});

test('normalizeContentStatistic - Aturan K3 (Nol Mencurigakan pada Repliz > 24 jam)', () => {
  const oldSuspiciousPost = {
    like: 0,
    comment: 0,
    share: 0,
    reach: 0,
    views: 0,
    insight: { views: 0, reach: 0, clicks: 0 }
  };

  // Umur 48 jam -> memicu K3
  const normOld = normalizeContentStatistic('facebook', oldSuspiciousPost, { ageHours: 48, source: 'repliz' });
  assert.equal(normOld.views, null);
  assert.equal(normOld.reach, null);
  assert.equal(normOld.insight_available, false);
  assert.equal(normOld.is_suspicious_zero, true);

  // Umur 2 jam -> belum memicu K3 (mungkin memang baru terbit)
  const normNew = normalizeContentStatistic('facebook', oldSuspiciousPost, { ageHours: 2, source: 'repliz' });
  assert.equal(normNew.views, 0);
  assert.equal(normNew.is_suspicious_zero, undefined);
});

test('determineSnapshotTags - Tag generator', () => {
  const now = new Date('2026-11-22T12:00:00Z');

  // 10 jam lalu -> hanya latest
  const tags10h = determineSnapshotTags(new Date('2026-11-22T02:00:00Z'), now);
  assert.deepEqual(tags10h, ['latest']);

  // 24 jam lalu -> latest + h24
  const tags24h = determineSnapshotTags(new Date('2026-11-21T12:00:00Z'), now);
  assert.deepEqual(tags24h, ['latest', 'h24']);

  // 72 jam lalu -> latest + h72
  const tags72h = determineSnapshotTags(new Date('2026-11-19T12:00:00Z'), now);
  assert.deepEqual(tags72h, ['latest', 'h72']);

  // 7 hari (168 jam) lalu -> latest + d7
  const tags7d = determineSnapshotTags(new Date('2026-11-15T12:00:00Z'), now);
  assert.deepEqual(tags7d, ['latest', 'd7']);
});

test('calculateEngagementScore - Formula skor lintas platform', () => {
  // Facebook: (reactions + 2*comments + 3*shares) / reach
  const fbScore = calculateEngagementScore('facebook', {
    reach: 100,
    reactions: 10,
    comments: 5,
    shares: 2,
    clicks: 4
  });
  // (10 + 10 + 6) / 100 = 26 / 100 = 0.26
  assert.equal(fbScore.engagementScore, 0.26);
  assert.equal(fbScore.clickRate, 0.04);

  // Instagram: (likes + 2*comments + 3*shares + 3*saves) / views
  const igScore = calculateEngagementScore('instagram', {
    views: 1000,
    likes: 20,
    comments: 5,
    shares: 4,
    saves: 6
  });
  // (20 + 10 + 12 + 18) / 1000 = 60 / 1000 = 0.06
  assert.equal(igScore.engagementScore, 0.06);

  // YouTube: view_pct/100 * 0.5 + (likes + 2*comments + 3*shares)/views * 0.5
  const ytScore = calculateEngagementScore('youtube', {
    views: 1000,
    likes: 50,
    comments: 10,
    shares: 10,
    view_pct: 60
  });
  // (0.6 * 0.5) + ((50 + 20 + 30)/1000 * 0.5) = 0.3 + (0.1 * 0.5) = 0.35
  assert.equal(ytScore.engagementScore, 0.35);
});
