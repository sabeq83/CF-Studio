/**
 * Modul Normalisasi Metrik Performa Lintas Platform (Repliz & Meta Graph API)
 * Pure functions, tanpa dependensi eksternal, aman untuk unit test.
 */

/**
 * Normalisasi statistik satu postingan/konten
 */
export function normalizeContentStatistic(platform, raw = {}, { ageHours = null, source = 'repliz' } = {}) {
  const p = String(platform || '').toLowerCase();
  const ins = raw?.insight || null;

  // Aturan K3: Nol mencurigakan untuk sumber Repliz
  // Bila posting berumur >= 24 jam dan semua metrik utama bernilai 0 / null
  if (source === 'repliz' && ageHours !== null && ageHours >= 24) {
    const rawViews = typeof raw?.views === 'object' ? raw?.views?.total : raw?.views;
    const isSuspiciousZero = (
      (rawViews === 0 || rawViews === undefined) &&
      (raw?.reach === 0 || raw?.reach === undefined) &&
      (raw?.like === 0 || raw?.like === undefined) &&
      (raw?.comment === 0 || raw?.comment === undefined) &&
      (raw?.share === 0 || raw?.share === undefined) &&
      (!ins || (ins.views === 0 && ins.reach === 0 && ins.clicks === 0))
    );

    if (isSuspiciousZero) {
      return {
        views: null, reach: null, clicks: null, reactions: null,
        likes: null, comments: null, shares: null, saves: null,
        avg_watch_sec: null, total_watch_sec: null, view_pct: null,
        full_watch_rate: null, skip_rate: null,
        insight_available: false, is_suspicious_zero: true
      };
    }
  }

  switch (p) {
    case 'facebook': {
      if (source === 'meta_api') {
        const postData = raw?.postData || raw;
        const insData = raw?.insData || [];
        const videoInsights = raw?.videoInsights || [];

        // Extract metrics from Graph API
        const getMetricVal = (mName) => {
          const item = insData.find(m => m.name === mName);
          return item?.values?.[0]?.value ?? null;
        };

        const getVideoMetricVal = (mName) => {
          const item = videoInsights.find(m => m.name === mName);
          return item?.values?.[0]?.value ?? null;
        };

        const mediaView = getMetricVal('post_media_view');
        const reelsPlay = getVideoMetricVal('blue_reels_play_count');
        const views = reelsPlay != null ? reelsPlay : (mediaView != null ? mediaView : (postData?.post_media_view ?? null));

        const reach = getMetricVal('post_total_media_view_unique') ?? postData?.post_total_media_view_unique ?? null;
        const clicks = getMetricVal('post_clicks') ?? postData?.post_clicks ?? null;

        const reactions = postData?.reactions?.summary?.total_count ?? postData?.reactionsCount ?? null;
        const comments = postData?.comments?.summary?.total_count ?? postData?.commentsCount ?? null;
        const shares = postData?.shares?.count ?? postData?.sharesCount ?? null;

        const avgWatchMs = getVideoMetricVal('post_video_avg_time_watched') ?? postData?.post_video_avg_time_watched ?? null;
        const totalWatchMs = getVideoMetricVal('post_video_view_time') ?? postData?.post_video_view_time ?? null;

        return {
          views: views != null ? Number(views) : null,
          reach: reach != null ? Number(reach) : null,
          clicks: clicks != null ? Number(clicks) : null,
          reactions: reactions != null ? Number(reactions) : null,
          likes: reactions != null ? Number(reactions) : null,
          comments: comments != null ? Number(comments) : null,
          shares: shares != null ? Number(shares) : null,
          saves: null,
          avg_watch_sec: avgWatchMs != null ? Number(avgWatchMs) / 1000 : null,
          total_watch_sec: totalWatchMs != null ? Number(totalWatchMs) / 1000 : null,
          view_pct: null,
          full_watch_rate: null,
          skip_rate: null,
          insight_available: true
        };
      }

      // Facebook via Repliz
      return {
        views: ins?.views ?? raw?.views ?? null,
        reach: ins?.reach ?? raw?.reach ?? null,
        clicks: ins?.clicks ?? null,
        reactions: ins?.reaction ?? raw?.like ?? null,
        likes: raw?.like ?? null,
        comments: raw?.comment ?? null,
        shares: raw?.share ?? null,
        saves: null,
        avg_watch_sec: null,
        total_watch_sec: null,
        view_pct: null,
        full_watch_rate: null,
        skip_rate: null,
        insight_available: Boolean(ins && (ins.views > 0 || ins.reach > 0))
      };
    }

    case 'instagram': {
      return {
        views: raw?.views != null ? Number(raw.views) : null,
        reach: raw?.reach != null ? Number(raw.reach) : null,
        clicks: null,
        reactions: raw?.like != null ? Number(raw.like) : null,
        likes: raw?.like != null ? Number(raw.like) : null,
        comments: raw?.comment != null ? Number(raw.comment) : null,
        shares: raw?.share != null ? Number(raw.share) : null,
        saves: raw?.saved != null ? Number(raw.saved) : null,
        avg_watch_sec: raw?.averageWatchTime != null ? Number(raw.averageWatchTime) : null,
        total_watch_sec: raw?.watchTime != null ? Number(raw.watchTime) : null,
        view_pct: null,
        full_watch_rate: null,
        skip_rate: raw?.skipRate != null ? Number(raw.skipRate) : null,
        insight_available: Boolean(raw?.views !== undefined || raw?.reach !== undefined)
      };
    }

    case 'tiktok': {
      return {
        views: raw?.views != null ? Number(raw.views) : null,
        reach: raw?.reach != null ? Number(raw.reach) : null,
        clicks: raw?.websiteClicks != null ? Number(raw.websiteClicks) : null,
        reactions: raw?.like != null ? Number(raw.like) : null,
        likes: raw?.like != null ? Number(raw.like) : null,
        comments: raw?.comment != null ? Number(raw.comment) : null,
        shares: raw?.share != null ? Number(raw.share) : null,
        saves: raw?.favourite != null ? Number(raw.favourite) : null,
        avg_watch_sec: raw?.averageWatched != null ? Number(raw.averageWatched) : null,
        total_watch_sec: raw?.watched != null ? Number(raw.watched) : null,
        view_pct: null,
        full_watch_rate: raw?.fullWatchedRate != null ? Number(raw.fullWatchedRate) : null,
        skip_rate: null,
        insight_available: Boolean(raw?.views !== undefined)
      };
    }

    case 'youtube': {
      const avgDuration = ins?.averageViewDuration ?? null;
      const estMinutes = ins?.estimatedMinutesWatched ?? null;
      const avgPct = ins?.averageViewPercentage ?? null;

      return {
        views: raw?.views != null ? Number(raw.views) : null,
        reach: null,
        clicks: null,
        reactions: raw?.like != null ? Number(raw.like) : null,
        likes: raw?.like != null ? Number(raw.like) : null,
        comments: raw?.comment != null ? Number(raw.comment) : null,
        shares: ins?.shares != null ? Number(ins.shares) : null,
        saves: null,
        avg_watch_sec: avgDuration != null ? Number(avgDuration) : null,
        total_watch_sec: estMinutes != null ? Number(estMinutes) * 60 : null,
        view_pct: avgPct != null ? Number(avgPct) : null,
        full_watch_rate: avgPct != null ? Number(avgPct) / 100 : null,
        skip_rate: null,
        insight_available: Boolean(raw?.views !== undefined)
      };
    }

    case 'threads': {
      const views = typeof raw?.views === 'object' ? raw?.views?.total : raw?.views;
      const shares = (Number(raw?.repost) || 0) + (Number(raw?.share) || 0) || null;

      return {
        views: views != null ? Number(views) : null,
        reach: null,
        clicks: null,
        reactions: raw?.like != null ? Number(raw.like) : null,
        likes: raw?.like != null ? Number(raw.like) : null,
        comments: raw?.replies != null ? Number(raw.replies) : null,
        shares: shares != null ? Number(shares) : null,
        saves: null,
        avg_watch_sec: null,
        total_watch_sec: null,
        view_pct: null,
        full_watch_rate: null,
        skip_rate: null,
        insight_available: Boolean(views !== undefined)
      };
    }

    default:
      return {
        views: raw?.views != null ? Number(raw.views) : null,
        reach: raw?.reach != null ? Number(raw.reach) : null,
        clicks: null,
        reactions: raw?.like != null ? Number(raw.like) : null,
        likes: raw?.like != null ? Number(raw.like) : null,
        comments: raw?.comment != null ? Number(raw.comment) : null,
        shares: raw?.share != null ? Number(raw.share) : null,
        saves: null,
        avg_watch_sec: null, total_watch_sec: null, view_pct: null,
        full_watch_rate: null, skip_rate: null, insight_available: false
      };
  }
}

/**
 * Normalisasi data harian akun
 * Mengembalikan array: [{ metric_date, views, reach, engagement, video_views, profile_views, new_follows, unfollows, followers_total, raw_json }]
 */
export function normalizeAccountDaily(platform, accountStat = {}, { source = 'repliz', followersTotal = null } = {}) {
  const p = String(platform || '').toLowerCase();
  const results = [];
  const followers = followersTotal != null ? Number(followersTotal) : (accountStat?.followersCount != null ? Number(accountStat.followersCount) : (accountStat?.subscribersCount != null ? Number(accountStat.subscribersCount) : null));

  // 1. Meta Graph API (Facebook)
  if (source === 'meta_api' && Array.isArray(accountStat)) {
    // accountStat is array of metrics: [{ name: 'page_media_view', values: [...] }, ...]
    const datesMap = new Map();

    for (const metricObj of accountStat) {
      const mName = metricObj.name;
      const values = Array.isArray(metricObj.values) ? metricObj.values : [];
      for (const valItem of values) {
        // end_time format: "2026-11-20T08:00:00+0000"
        const dateStr = valItem.end_time ? valItem.end_time.split('T')[0] : null;
        if (!dateStr) continue;

        if (!datesMap.has(dateStr)) {
          datesMap.set(dateStr, { metric_date: dateStr, raw_json: {} });
        }
        const row = datesMap.get(dateStr);
        row.raw_json[mName] = valItem.value;

        if (mName === 'page_media_view') row.views = Number(valItem.value);
        else if (mName === 'page_views_total') row.profile_views = Number(valItem.value);
        else if (mName === 'page_post_engagements') row.engagement = Number(valItem.value);
        else if (mName === 'page_follows') row.followers_total = Number(valItem.value);
        else if (mName === 'page_daily_follows_unique') row.new_follows = Number(valItem.value);
      }
    }

    for (const row of datesMap.values()) {
      results.push({
        metric_date: row.metric_date,
        views: row.views ?? null,
        reach: null,
        engagement: row.engagement ?? null,
        video_views: row.views ?? null,
        profile_views: row.profile_views ?? null,
        new_follows: row.new_follows ?? null,
        unfollows: null,
        followers_total: row.followers_total ?? followers,
        raw_json: row.raw_json
      });
    }

    return results;
  }

  // 2. Repliz API
  const metrics = Array.isArray(accountStat?.metrics) ? accountStat.metrics : [];

  switch (p) {
    case 'instagram': {
      for (const m of metrics) {
        const dateStr = m.date ? m.date.split('T')[0] : null;
        if (!dateStr) continue;
        results.push({
          metric_date: dateStr,
          views: null,
          reach: m.reach != null ? Number(m.reach) : null,
          engagement: null,
          video_views: null,
          profile_views: null,
          new_follows: null,
          unfollows: null,
          followers_total: followers,
          raw_json: m
        });
      }
      break;
    }

    case 'youtube': {
      for (const m of metrics) {
        const dateStr = m.date ? m.date.split('T')[0] : null;
        if (!dateStr) continue;
        results.push({
          metric_date: dateStr,
          views: m.views != null ? Number(m.views) : null,
          reach: null,
          engagement: null,
          video_views: m.views != null ? Number(m.views) : null,
          profile_views: null,
          new_follows: m.subscribersGained != null ? Number(m.subscribersGained) : null,
          unfollows: null,
          followers_total: followers,
          raw_json: m
        });
      }
      break;
    }

    case 'threads': {
      const graphs = Array.isArray(accountStat?.views?.graphs) ? accountStat.views.graphs : [];
      for (const g of graphs) {
        const dateStr = g.date ? g.date.split('T')[0] : null;
        if (!dateStr) continue;
        results.push({
          metric_date: dateStr,
          views: g.value != null ? Number(g.value) : null,
          reach: null,
          engagement: null,
          video_views: null,
          profile_views: null,
          new_follows: null,
          unfollows: null,
          followers_total: followers,
          raw_json: g
        });
      }
      break;
    }

    default: {
      for (const m of metrics) {
        const dateStr = m.date ? m.date.split('T')[0] : null;
        if (!dateStr) continue;
        results.push({
          metric_date: dateStr,
          views: m.views != null ? Number(m.views) : null,
          reach: m.reach != null ? Number(m.reach) : null,
          engagement: m.engagement != null ? Number(m.engagement) : null,
          video_views: m.videoViews != null ? Number(m.videoViews) : null,
          profile_views: m.profileViews != null ? Number(m.profileViews) : null,
          new_follows: m.newFollows != null ? Number(m.newFollows) : null,
          unfollows: m.unfollows != null ? Number(m.unfollows) : null,
          followers_total: followers,
          raw_json: m
        });
      }
    }
  }

  return results;
}

/**
 * Menentukan tag snapshot yang harus diambil berdasarkan umur publikasi postingan
 */
export function determineSnapshotTags(publishedAt, now = new Date()) {
  if (!publishedAt) return ['latest'];
  const pubTime = new Date(publishedAt).getTime();
  const nowTime = new Date(now).getTime();
  const diffHours = (nowTime - pubTime) / (1000 * 3600);

  const tags = ['latest'];

  // h24: jendela 20 - 36 jam
  if (diffHours >= 20 && diffHours <= 36) {
    tags.push('h24');
  }

  // h72: jendela 66 - 90 jam
  if (diffHours >= 66 && diffHours <= 90) {
    tags.push('h72');
  }

  // d7: jendela 160 - 200 jam (sekitar 7 hari)
  if (diffHours >= 160 && diffHours <= 200) {
    tags.push('d7');
  }

  return tags;
}

/**
 * Deteksi status insight akun
 */
export function detectInsightsStatus(platform, accountStat, { source = 'repliz', hasMetaAccount = false } = {}) {
  const p = String(platform || '').toLowerCase();
  if (p === 'facebook') {
    if (source === 'meta_api') return 'ok';
    if (!hasMetaAccount) return 'unavailable';
    return 'ok';
  }
  return 'ok';
}

/**
 * Hitung skor performa dan klik
 */
export function calculateEngagementScore(platform, snapshot = {}) {
  const p = String(platform || '').toLowerCase();
  const { views, reach, clicks, reactions, likes, comments, shares, saves, view_pct } = snapshot;

  let engagementScore = null;
  let clickRate = null;

  switch (p) {
    case 'facebook': {
      const rx = Number(reactions) || Number(likes) || 0;
      const cm = Number(comments) || 0;
      const sh = Number(shares) || 0;
      const rc = Number(reach);

      if (rc && rc > 0) {
        engagementScore = Number(((rx + (2 * cm) + (3 * sh)) / rc).toFixed(4));
        if (clicks != null) {
          clickRate = Number((Number(clicks) / rc).toFixed(4));
        }
      }
      break;
    }

    case 'youtube': {
      const vw = Number(views);
      const lk = Number(likes) || 0;
      const cm = Number(comments) || 0;
      const sh = Number(shares) || 0;
      const pct = Number(view_pct) || 0;

      if (vw && vw > 0) {
        const watchPart = (pct / 100) * 0.5;
        const interactionPart = ((lk + (2 * cm) + (3 * sh)) / vw) * 0.5;
        engagementScore = Number((watchPart + interactionPart).toFixed(4));
      }
      break;
    }

    case 'tiktok':
    case 'instagram': {
      const vw = Number(views);
      const lk = Number(likes) || 0;
      const cm = Number(comments) || 0;
      const sh = Number(shares) || 0;
      const sv = Number(saves) || 0;

      if (vw && vw > 0) {
        engagementScore = Number(((lk + (2 * cm) + (3 * sh) + (3 * sv)) / vw).toFixed(4));
        if (clicks != null) {
          clickRate = Number((Number(clicks) / vw).toFixed(4));
        }
      }
      break;
    }

    case 'threads': {
      const vw = Number(views);
      const lk = Number(likes) || 0;
      const cm = Number(comments) || 0;
      const sh = Number(shares) || 0;

      if (vw && vw > 0) {
        engagementScore = Number(((lk + (2 * cm) + (3 * sh)) / vw).toFixed(4));
      }
      break;
    }
  }

  return { engagementScore, clickRate };
}
