/**
 * Meta Graph API Insights Client
 * Read-only client for Facebook Pages & Video/Reels Insights.
 * Strict token and security isolation: secrets are never leaked into logs.
 */

import { getGraphBaseUrl } from './meta-publisher.js';

export async function getMetaTokenInfo(token) {
  if (!token) return null;
  const url = `${getGraphBaseUrl()}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const json = await res.json();
    return json?.data || null;
  } catch (err) {
    return null;
  }
}

export async function getFacebookPageDailyInsights(pageId, pageToken, sinceSec, untilSec) {
  if (!pageId || !pageToken) return [];
  const metrics = [
    'page_media_view',
    'page_views_total',
    'page_post_engagements',
    'page_follows',
    'page_daily_follows_unique'
  ];
  const qs = new URLSearchParams({
    metric: metrics.join(','),
    period: 'day',
    access_token: pageToken
  });
  if (sinceSec) qs.set('since', String(sinceSec));
  if (untilSec) qs.set('until', String(untilSec));

  const url = `${getGraphBaseUrl()}/${encodeURIComponent(pageId)}/insights?${qs.toString()}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const json = await res.json();
    return json?.data || [];
  } catch (err) {
    return [];
  }
}

export async function getFacebookPostInsights(postId, pageToken) {
  if (!postId || !pageToken) return { error: 'Post ID and page token are required' };

  const fields = 'id,created_time,permalink_url,shares,comments.summary(true).limit(0),reactions.summary(true).limit(0)';
  const postUrl = `${getGraphBaseUrl()}/${encodeURIComponent(postId)}?fields=${fields}&access_token=${encodeURIComponent(pageToken)}`;
  
  try {
    const postRes = await fetch(postUrl, { signal: AbortSignal.timeout(10000) });
    const postData = await postRes.json();
    if (postData.error) return { error: postData.error };

    const metrics = 'post_media_view,post_total_media_view_unique,post_clicks';
    const insUrl = `${getGraphBaseUrl()}/${encodeURIComponent(postId)}/insights?metric=${metrics}&access_token=${encodeURIComponent(pageToken)}`;
    const insRes = await fetch(insUrl, { signal: AbortSignal.timeout(10000) });
    const insData = await insRes.json();

    let videoInsights = null;
    const reelMatch = postData.permalink_url?.match(/\/reel\/(\d+)/);
    const videoId = reelMatch ? reelMatch[1] : (postData.object_id || null);

    if (videoId) {
      const vUrl = `${getGraphBaseUrl()}/${encodeURIComponent(videoId)}/video_insights?metric=blue_reels_play_count,post_video_avg_time_watched,post_video_view_time&access_token=${encodeURIComponent(pageToken)}`;
      const vRes = await fetch(vUrl, { signal: AbortSignal.timeout(10000) });
      const vJson = await vRes.json();
      videoInsights = vJson?.data || null;
    }

    return {
      postData,
      insData: insData?.data || [],
      videoInsights
    };
  } catch (err) {
    return { error: err.message };
  }
}
