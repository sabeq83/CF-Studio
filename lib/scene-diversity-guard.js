/**
 * lib/scene-diversity-guard.js
 * K5: Lightweight Diversity Guard (telemetry + campaign-level repetition detector).
 * Runs deterministically with 0 extra LLM calls. Mode: 'report_only'.
 */

function normalizeToken(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildVideoVisualFingerprint(parsed = {}, sceneBrief = null, rowPayload = {}) {
  const brief = sceneBrief || parsed?.resolved_scene_brief || {};
  const locationKey = normalizeToken(brief.location || brief.location_en || rowPayload.context || 'unknown').slice(0, 48);
  const timeKey = normalizeToken(brief.time_key || brief.time_of_day || 'neutral');
  const angleKey = normalizeToken(brief.angle_format_key || rowPayload.strategic_angle || 'default');
  const wardrobeKey = normalizeToken(parsed?.resolved_wardrobe_color?.key || '');

  const storyboard = Array.isArray(parsed?.storyboard) ? parsed.storyboard : [];
  const t2i = Array.isArray(parsed?.t2i_prompts) ? parsed.t2i_prompts : [];

  const firstDesc = normalizeToken(t2i[0]?.prompt || storyboard[0]?.visual_description || '');
  const beatSignature = [
    angleKey,
    locationKey,
    timeKey,
    t2i.length || storyboard.length || 0
  ].join('|');

  return {
    location_key: locationKey || 'unknown',
    time_key: timeKey || 'neutral',
    angle_key: angleKey || 'default',
    wardrobe_key: wardrobeKey || null,
    beat_signature: beatSignature,
    clip1_prefix: firstDesc.slice(0, 64)
  };
}

/**
 * Analyze diversity across sibling items in the same OPC batch.
 * Flags:
 *  - >= thresholdSameBeat (default 3) videos sharing identical angle+location+time+clipCount signature
 *  - > maxDominantLocationRatio (default 0.7) of videos sharing the exact same location
 */
export function analyzeCampaignDiversity(
  items = [],
  {
    thresholdSameBeat = 3,
    maxDominantLocationRatio = 0.7
  } = {}
) {
  const normalizedList = Array.isArray(items) ? items : [];
  const fingerprints = normalizedList
    .map(entry => {
      if (!entry) return null;
      if (entry.fingerprint) return entry.fingerprint;
      const parsed = typeof entry.result_json === 'string'
        ? (() => { try { return JSON.parse(entry.result_json); } catch { return {}; } })()
        : (entry.parsed || entry.result_json || {});
      const rowPayload = typeof entry.row_creative_payload === 'string'
        ? (() => { try { return JSON.parse(entry.row_creative_payload); } catch { return {}; } })()
        : (entry.row_creative_payload || {});
      const brief = entry.sceneBrief || parsed?.resolved_scene_brief || null;
      return buildVideoVisualFingerprint(parsed, brief, rowPayload);
    })
    .filter(Boolean);

  const totalChecked = fingerprints.length;
  if (totalChecked === 0) {
    return {
      mode: 'report_only',
      status: 'ok',
      warnings: [],
      stats: {
        total_checked: 0,
        dominant_location: null,
        dominant_location_ratio: 0,
        repeated_sequences: []
      }
    };
  }

  const locationCounts = {};
  const sequenceCounts = {};
  for (const fp of fingerprints) {
    locationCounts[fp.location_key] = (locationCounts[fp.location_key] || 0) + 1;
    sequenceCounts[fp.beat_signature] = (sequenceCounts[fp.beat_signature] || 0) + 1;
  }

  let dominantLocation = null;
  let dominantCount = 0;
  for (const [loc, count] of Object.entries(locationCounts)) {
    if (count > dominantCount) {
      dominantLocation = loc;
      dominantCount = count;
    }
  }
  const dominantRatio = Number((dominantCount / totalChecked).toFixed(2));

  const repeatedSequences = Object.entries(sequenceCounts)
    .filter(([, count]) => count >= thresholdSameBeat)
    .map(([signature, count]) => ({ signature, count }));

  const warnings = [];
  if (totalChecked >= thresholdSameBeat && dominantRatio > maxDominantLocationRatio) {
    warnings.push({
      code: 'DOMINANT_LOCATION_OVERUSE',
      message: `Lokasi "${dominantLocation}" dipakai di ${Math.round(dominantRatio * 100)}% video batch (${dominantCount}/${totalChecked}). Disarankan variasi lokasi di Content Planner.`
    });
  }
  if (repeatedSequences.length > 0) {
    warnings.push({
      code: 'REPEATED_BEAT_SEQUENCE',
      message: `${repeatedSequences.length} kombinasi angle + lokasi + waktu terdeteksi berulang >=${thresholdSameBeat} kali dalam batch yang sama.`
    });
  }

  // K7.1: Deteksi pose pasif (tangan diam/hening) pada storyboard terbaru (batas maks 1 & dilarang Klip 1, 2, atau akhir)
  const PASSIVE_POSE_RE = /\b(?:diam di samping|tangan diam|memegang secara tenang|berdiri tanpa gerakan|tanpa gerakan aktif|motionless hands|hands resting quietly|hands still beside|quietly holding still|resting silently)\b/i;
  const latestEntry = normalizedList[normalizedList.length - 1];
  const latestStoryboard = Array.isArray(latestEntry?.parsed?.storyboard)
    ? latestEntry.parsed.storyboard
    : (Array.isArray(latestEntry?.storyboard) ? latestEntry.storyboard : []);
  const totalClipsLatest = latestStoryboard.length || 6;
  const passivePoseClips = latestStoryboard
    .filter((s) => {
      const desc = `${s?.visual_description || ''} ${s?.visual_action || ''}`;
      return PASSIVE_POSE_RE.test(desc);
    })
    .map((s, idx) => Number(s?.scene || s?.clip_index || (idx + 1)));

  const hasForbiddenEdgePassive = passivePoseClips.some(c => c === 1 || c === 2 || c === totalClipsLatest);
  if (passivePoseClips.length > 1 || hasForbiddenEdgePassive) {
    warnings.push({
      code: 'PASSIVE_POSE_LIMIT',
      message: `Pose pasif berlebihan/terlarang pada klip [${passivePoseClips.join(', ')}] (maks 1 dan dilarang di Klip 1, 2, atau Klip ${totalClipsLatest}).`
    });
  }

  return {
    mode: 'report_only',
    status: warnings.length > 0 ? 'warning' : 'ok',
    warnings,
    stats: {
      total_checked: totalChecked,
      dominant_location: dominantLocation,
      dominant_location_ratio: dominantRatio,
      repeated_sequences: repeatedSequences,
      passive_pose_clips: passivePoseClips
    }
  };
}

