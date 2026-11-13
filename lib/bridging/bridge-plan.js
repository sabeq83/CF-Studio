/**
 * Pure Multi-Segment Product Bridging Plan Resolver.
 * Zero DB/Node-fs dependencies — safe to import on both server and React client components.
 */

export const MAX_BRIDGE_SEGMENTS = 3;

function toFiniteInt(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
}

export function clampInt(value, min, max, fallback) {
  const num = toFiniteInt(value, fallback);
  if (num === null) return fallback;
  return Math.max(min, Math.min(max, num));
}

export function parseBridgeSegmentsArray(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : null;
    } catch (_) {
      return null;
    }
  }
  return null;
}

/**
 * Normalizes raw multi-segment inputs according to §2.2 validation rules:
 * 1. 1 <= at_clip <= targetClips
 * 2. Sorted ascending & non-overlapping (overlaps flagged in errors, merged safely for runtime)
 * 3. Gap >= 1 clip between segments (adjacent segments auto-merged with warning)
 * 4. duration_clips = 0 ("until last clip") only valid on last segment
 * 5. Segments exceeding targetClips are truncated; fully out-of-range are dropped with warning
 * 6. Max 3 segments
 */
export function normalizeBridgeSegments(rawSegments, targetClips = 4, options = {}) {
  const clips = Math.max(1, toFiniteInt(targetClips, 4));
  const warnings = [];
  const errors = [];

  const fallbackAt = clampInt(options.fallbackAtClip, 1, clips, Math.min(clips, 2));
  const fallbackDur = Math.max(0, toFiniteInt(options.fallbackDurationClips, 1));
  const singleZoneOnly = Boolean(options.singleZoneOnly);

  const parsedInput = parseBridgeSegmentsArray(rawSegments);
  let sourceList = parsedInput && parsedInput.length > 0
    ? parsedInput
    : [{ at_clip: fallbackAt, duration_clips: fallbackDur, role: 'intro' }];

  if (sourceList.length > MAX_BRIDGE_SEGMENTS) {
    warnings.push(`Maksimal ${MAX_BRIDGE_SEGMENTS} segmen bridging per video; segmen ke-${MAX_BRIDGE_SEGMENTS + 1}+ diabaikan.`);
    sourceList = sourceList.slice(0, MAX_BRIDGE_SEGMENTS);
  }

  let working = [];
  for (let i = 0; i < sourceList.length; i++) {
    const item = sourceList[i] || {};
    const rawAt = toFiniteInt(item.at_clip ?? item.atClip, fallbackAt);
    const rawDur = toFiniteInt(item.duration_clips ?? item.durationClips, 1);
    const duration_clips = Math.max(0, rawDur !== null ? rawDur : 1);
    const rawRole = String(item.role || '').toLowerCase();
    const role = rawRole === 'intro' ? 'intro' : (i === 0 ? 'intro' : 'recall');

    if (rawAt < 1) {
      warnings.push(`Klip segmen (${rawAt}) diclamp ke 1.`);
      working.push({ at_clip: 1, duration_clips, role });
    } else if (rawAt > clips) {
      warnings.push(`Segmen pada Klip ${rawAt} dibuang karena melebihi total ${clips} klip.`);
    } else {
      working.push({ at_clip: rawAt, duration_clips, role });
    }
  }

  if (working.length === 0) {
    warnings.push(`Semua segmen di luar jangkauan (1..${clips}); fallback ke Klip ${fallbackAt}.`);
    working = [{ at_clip: fallbackAt, duration_clips: fallbackDur, role: 'intro' }];
  }

  // Sort ascending by at_clip
  working.sort((a, b) => a.at_clip - b.at_clip);
  working[0].role = 'intro';

  if (singleZoneOnly && working.length > 1) {
    warnings.push('Mode ini hanya mendukung 1 zona bridging; segmen ke-2+ dinonaktifkan.');
    working = [working[0]];
  }

  const merged = [];
  for (let i = 0; i < working.length; i++) {
    const cur = { ...working[i] };
    const isLast = i === working.length - 1;

    if (cur.duration_clips === 0 && !isLast) {
      errors.push(`Segmen Klip ${cur.at_clip} memakai durasi 0 (sampai akhir) padahal bukan segmen terakhir.`);
      warnings.push(`Durasi 0 pada Klip ${cur.at_clip} diclamp menjadi 1 klip karena bukan segmen terakhir.`);
      cur.duration_clips = 1;
    }

    const unclampedEnd = cur.duration_clips === 0
      ? clips
      : (cur.at_clip + cur.duration_clips - 1);

    let end = unclampedEnd;
    if (end > clips) {
      end = clips;
      warnings.push(`Segmen Klip ${cur.at_clip}–${unclampedEnd} dipotong agar sesuai total ${clips} klip.`);
    }
    const effectiveDur = cur.duration_clips === 0 ? 0 : Math.max(1, end - cur.at_clip + 1);

    if (merged.length === 0) {
      merged.push({
        index: 0,
        role: 'intro',
        at_clip: cur.at_clip,
        duration_clips: effectiveDur,
        start: cur.at_clip,
        end
      });
      continue;
    }

    const prev = merged[merged.length - 1];
    if (cur.at_clip <= prev.end) {
      errors.push(`Segmen Klip ${cur.at_clip} tumpang tindih dengan segmen Klip ${prev.start}–${prev.end}.`);
      const nextEnd = Math.max(prev.end, end);
      prev.end = nextEnd;
      prev.duration_clips = (cur.duration_clips === 0 && isLast && nextEnd === clips)
        ? 0
        : (nextEnd - prev.start + 1);
      warnings.push(`Segmen tumpang tindih pada Klip ${cur.at_clip} digabung menjadi Klip ${prev.start}–${prev.end}.`);
    } else if (cur.at_clip === prev.end + 1) {
      const nextEnd = Math.max(prev.end, end);
      prev.end = nextEnd;
      prev.duration_clips = (cur.duration_clips === 0 && isLast && nextEnd === clips)
        ? 0
        : (nextEnd - prev.start + 1);
      warnings.push(`Segmen Klip ${cur.at_clip} bersebelahan dengan Klip ${prev.start}–${cur.at_clip - 1} sehingga digabung otomatis menjadi Klip ${prev.start}–${prev.end}.`);
    } else {
      merged.push({
        index: merged.length,
        role: cur.role === 'intro' ? 'intro' : 'recall',
        at_clip: cur.at_clip,
        duration_clips: effectiveDur,
        start: cur.at_clip,
        end
      });
    }
  }

  return { segments: merged, warnings, errors };
}

/**
 * Extracts normalized inputs for resolveBridgePlan from either a Pillar campaign row,
 * a Multiplier bridging_config_json object, an overrides payload, or an operator preset.
 */
export function readBridgeInputs(source = {}, fallbackAesthetics = {}, options = {}) {
  const src = source && typeof source === 'object' ? source : {};
  const aes = fallbackAesthetics && typeof fallbackAesthetics === 'object' ? fallbackAesthetics : {};

  const targetClips = Math.max(
    1,
    toFiniteInt(
      src.targetClipsCount ?? src.target_clips_count ?? src.targetClips ?? aes.targetClipsCount ?? aes.target_clips_count,
      4
    )
  );

  const rawActive =
    src.isBridgingActive !== undefined
      ? src.isBridgingActive
      : src.is_bridging_active;

  let isBridgingActive;
  if (rawActive !== undefined && rawActive !== null) {
    isBridgingActive = rawActive === true || rawActive === 1 || rawActive === '1' || rawActive === 'true';
  } else if (options.defaultActive !== undefined) {
    isBridgingActive = Boolean(options.defaultActive);
  } else {
    isBridgingActive = true;
  }

  const rawAt = src.bridgeAtClip ?? src.bridge_at_clip;
  const defaultAt = options.defaultAtClip !== undefined ? options.defaultAtClip : Math.min(targetClips, 2);
  const bridgeAtClip = clampInt(rawAt, 1, targetClips, defaultAt);

  const rawDur = src.bridgeDurationClips ?? src.bridge_duration_clips;
  const defaultDur = options.defaultDurationClips !== undefined ? options.defaultDurationClips : 1;
  const parsedDur = toFiniteInt(rawDur, defaultDur);
  const bridgeDurationClips = Math.max(0, parsedDur !== null ? parsedDur : defaultDur);

  const segments = parseBridgeSegmentsArray(src.bridgeSegments ?? src.bridge_segments);

  const visualStyle = String(src.visualStyle ?? src.visual_style ?? aes.visualStyle ?? aes.visual_style ?? '').toLowerCase();
  const singleZoneOnly = Boolean(options.singleZoneOnly || visualStyle === 'investigative_faceless');

  const visualMode = src.visualMode || src.visual_mode || aes.visualMode || aes.visual_mode || 'pure_t2v';
  const bridgingMode = src.bridgingMode || src.bridging_mode || 'select_existing';

  return {
    targetClips,
    isBridgingActive,
    segments,
    bridgeAtClip,
    bridgeDurationClips,
    singleZoneOnly,
    visualMode,
    bridgingMode
  };
}

/**
 * Core resolver returning clip-level zoning, segment queries, and legacy compatibility fields.
 */
export function resolveBridgePlan({
  targetClips = 4,
  isBridgingActive = true,
  segments = null,
  bridgeAtClip = 2,
  bridgeDurationClips = 1,
  singleZoneOnly = false
} = {}) {
  const clips = Math.max(1, toFiniteInt(targetClips, 4));
  const legacyAt = clampInt(bridgeAtClip, 1, clips, Math.min(clips, 2));
  const legacyDur = Math.max(0, toFiniteInt(bridgeDurationClips, 1));
  const active = Boolean(isBridgingActive);

  if (!active) {
    return {
      active: false,
      targetClips: clips,
      segments: [],
      productClips: [],
      isProductClip: () => false,
      isSegmentStart: () => false,
      segmentOf: () => null,
      zoneOf: () => 'pre',
      zones: [{ zone: 'pre', start: 1, end: clips }],
      firstBridgeClip: legacyAt,
      legacy: { bridge_at_clip: legacyAt, bridge_duration_clips: legacyDur },
      warnings: [],
      errors: []
    };
  }

  const { segments: normalized, warnings, errors } = normalizeBridgeSegments(segments, clips, {
    fallbackAtClip: legacyAt,
    fallbackDurationClips: legacyDur,
    singleZoneOnly
  });

  const segmentByClip = new Map();
  const productClips = [];
  for (const seg of normalized) {
    for (let c = seg.start; c <= seg.end; c++) {
      segmentByClip.set(c, seg);
      productClips.push(c);
    }
  }

  const firstStart = normalized[0].start;
  const lastEnd = normalized[normalized.length - 1].end;

  const zoneOf = (clipIndex) => {
    const c = toFiniteInt(clipIndex, 0);
    const seg = segmentByClip.get(c);
    if (seg) return seg.role === 'intro' ? 'intro' : 'recall';
    if (c < firstStart) return 'pre';
    if (c > lastEnd) return 'post';
    return 'gap';
  };

  const zones = [];
  for (let c = 1; c <= clips; c++) {
    const z = zoneOf(c);
    const seg = segmentByClip.get(c);
    const prevZone = zones[zones.length - 1];
    if (prevZone && prevZone.zone === z && prevZone.segmentIndex === (seg ? seg.index : undefined)) {
      prevZone.end = c;
    } else {
      const entry = { zone: z, start: c, end: c };
      if (seg) entry.segmentIndex = seg.index;
      zones.push(entry);
    }
  }

  const firstSeg = normalized[0];
  return {
    active: true,
    targetClips: clips,
    segments: normalized,
    productClips,
    isProductClip: (c) => segmentByClip.has(toFiniteInt(c, 0)),
    isSegmentStart: (c) => {
      const seg = segmentByClip.get(toFiniteInt(c, 0));
      return Boolean(seg && seg.start === toFiniteInt(c, 0));
    },
    segmentOf: (c) => segmentByClip.get(toFiniteInt(c, 0)) || null,
    zoneOf,
    zones,
    firstBridgeClip: firstSeg.start,
    legacy: {
      bridge_at_clip: firstSeg.at_clip,
      bridge_duration_clips: firstSeg.duration_clips
    },
    warnings,
    errors
  };
}

/**
 * Formats compact clip numbers/ranges for prompt or UI display, e.g. "Klip 2 dan 6" or "Klip 2–3, 6".
 */
export function formatProductClipRanges(plan, { lang = 'id', style = 'short' } = {}) {
  if (!plan || !plan.active || !Array.isArray(plan.segments) || plan.segments.length === 0) {
    return lang === 'en' ? 'None' : 'Nonaktif';
  }
  const parts = plan.segments.map((seg) => {
    if (seg.start === seg.end) return `${seg.start}`;
    if (style === 'prose') {
      return lang === 'en' ? `${seg.start} to ${seg.end}` : `${seg.start} s.d. ${seg.end}`;
    }
    return `${seg.start}–${seg.end}`;
  });
  const prefix = lang === 'en' ? (parts.length > 1 ? 'Clips' : 'Clip') : 'Klip';
  if (style === 'prose' && parts.length > 1) {
    const last = parts[parts.length - 1];
    const head = parts.slice(0, -1).join(', ');
    const conj = lang === 'en' ? 'and' : 'dan';
    return `${prefix} ${head} ${conj} ${last}`;
  }
  return `${prefix} ${parts.join(', ')}`;
}

export function describeBridgePlan(plan, lang = 'id') {
  return formatProductClipRanges(plan, { lang, style: 'short' });
}

/**
 * Shared normalization + validation helper for API routes and UI serialization.
 * When targetClips is omitted (e.g. Multiplier batch creation before blueprint clip count is fixed),
 * uses a safe upper bound so valid clip indices are not prematurely truncated.
 */
export function normalizeBridgePayload(source = {}, fallbackSource = {}, {
  targetClips = null,
  defaultActive = true,
  singleZoneOnly = false
} = {}) {
  const inputs = readBridgeInputs(source, fallbackSource, { defaultActive });
  let effectiveClips = toFiniteInt(targetClips, 0);
  if (!effectiveClips || effectiveClips < 1) {
    const segMax = Array.isArray(inputs.segments)
      ? inputs.segments.reduce((m, s) => {
          const at = toFiniteInt(s?.at_clip ?? s?.atClip, 1);
          const dur = toFiniteInt(s?.duration_clips ?? s?.durationClips, 1);
          return Math.max(m, dur === 0 ? at : at + Math.max(0, dur - 1));
        }, 0)
      : 0;
    effectiveClips = Math.max(20, inputs.bridgeAtClip || 2, segMax);
  }
  const plan = resolveBridgePlan({
    ...inputs,
    targetClips: effectiveClips,
    singleZoneOnly
  });
  const segments = plan.active
    ? plan.segments.map((s) => ({
        at_clip: s.at_clip,
        duration_clips: s.duration_clips,
        role: s.role
      }))
    : [];
  return {
    active: plan.active,
    plan,
    segments,
    storageJson: plan.active ? JSON.stringify(segments) : null,
    legacy: plan.legacy,
    errors: plan.errors || [],
    warnings: plan.warnings || []
  };
}

/**
 * Resolve affiliate caption toggles independently from product bridging on dedicated product campaigns.
 * For product_campaign, unchecking `post_link_affiliate` only disables caption affiliate links and
 * lets preset/default product bridging remain active unless `body.is_bridging_active` is explicitly sent.
 */
export function resolveAutonomousPipelineAffiliateOverrides(body = {}, pipelineType = '') {
  const isEditorialOrLabs = pipelineType === 'editorial_campaign' || pipelineType === 'recipe_labs';
  const isProductCampaign = pipelineType === 'product_campaign';
  const isAffiliateEnabled = body.post_link_affiliate !== undefined
    ? Boolean(body.post_link_affiliate)
    : (!isEditorialOrLabs);

  if (isProductCampaign) {
    return {
      post_link_affiliate: isAffiliateEnabled,
      is_affiliate_enabled: isAffiliateEnabled,
      ...(body.is_bridging_active !== undefined ? { is_bridging_active: Boolean(body.is_bridging_active) } : {})
    };
  }

  const isBridgingActive = body.is_bridging_active !== undefined
    ? Boolean(body.is_bridging_active)
    : (isEditorialOrLabs ? false : isAffiliateEnabled);

  return {
    post_link_affiliate: isAffiliateEnabled,
    is_affiliate_enabled: isAffiliateEnabled,
    is_bridging_active: isBridgingActive
  };
}
