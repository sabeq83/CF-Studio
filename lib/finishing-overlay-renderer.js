import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { validateFinishingPlan, resolveCampaignCaptionMode, validateBrandPatchSpec, CHAPTER_PHASE_META } from './finishing-plan-validator.js';
import { chunkCaptionWords, fitHookCard } from './motion-text-engine.js';
import { ensureMotionFontsRegistered } from './motion-font-loader.js';
import { resolveFinishingTemplateFile, getFinishingTemplateMeta, hasStrictTemplateCompliance } from './finishing-template-registry.js';
import { isHerbalMedicalClaimPhrase } from './tiktok-compliance-service.js';
import { DEFAULT_HERBAL_DISCLAIMER } from './finishing-data-extractor.js';

export function resolveFinishingTemplatePath(finishingTemplate = 'none') {
  const baseDir = path.join(process.cwd(), 'templates', 'finishing');
  const file = resolveFinishingTemplateFile(finishingTemplate);
  const candidate = path.join(baseDir, file);
  if (fs.existsSync(candidate)) return candidate;
  return path.join(baseDir, 'base-caption.html');
}

/**
 * Matches validated punches onto exact global wordEvents timestamps and produces SFX cue timestamps.
 */
export function buildPhase1Timeline({
  wordEvents = [],
  hookCard = null,
  hookDuration = 1.75,
  finishingPlan = null,
  finishingTemplate = 'none',
  cleanVoiceoverClips = [],
  isHerbalProduct = true,
  clipStarts = [0],
  clipOffsets = null,
  captionMode = 'full',
  style = 'floating_white_yellow',
  position = 'bottom',
  width = 720,
  height = 1280,
  fps = 30,
  totalDuration = 0,
  accentColor = '#ffcc3d',
  activeWordColor = '#fff066',
  recipe = null,
  productCard = null,
  productData = null,
  savePrompt = null,
  cta = null,
  brand = null,
  targetLanguage = 'id-ID',
  brandPatch = null,
  lowerThird = null,
  endCard = null
} = {}) {
  const words = Array.isArray(wordEvents) ? wordEvents : [];
  const dur = Math.max(
    Number(totalDuration) || 0,
    words.reduce((m, w) => Math.max(m, Number(w.e) || 0), 0),
    hookCard ? hookDuration : 0,
    0.5
  );

  const resolvedTplId = String(finishingTemplate || 'none').trim().toLowerCase();
  const tplMeta = getFinishingTemplateMeta(resolvedTplId);
  const strictCompliance = hasStrictTemplateCompliance(resolvedTplId);
  const effectiveHerbal = Boolean(isHerbalProduct || strictCompliance);
  const recipeTexts = [
    ...((recipe?.ingredients?.items || []).map((it) => (typeof it === 'string' ? it : (it?.label || it?.text || it?.raw || '')))),
    ...((Array.isArray(recipe?.steps) ? recipe.steps : []).map((st) => (typeof st === 'string' ? st : (st?.label || st?.text || ''))))
  ].filter(Boolean);

  // Validate finishing_plan against clean VO & herbal/template compliance guard
  const planCheck = validateFinishingPlan(finishingPlan, {
    cleanVoiceoverClips,
    isHerbalProduct: effectiveHerbal,
    finishingTemplate: resolvedTplId,
    strictClaims: strictCompliance,
    recipeTexts,
    productData: productData || productCard,
    targetLanguage,
    width,
    height
  });

  if (planCheck.warnings.length > 0) {
    console.warn('[Finishing Plan Warnings]', planCheck.warnings.join(' | '));
  }

  let safeFallbackHook = hookCard || null;
  if (strictCompliance && safeFallbackHook) {
    const hookCheckText = safeFallbackHook.text || `${safeFallbackHook.l1 || ''} ${safeFallbackHook.l2 || ''}`.trim();
    if (isHerbalMedicalClaimPhrase(hookCheckText, { strict: true })) {
      planCheck.warnings.push(`finishing.fallback_hook blocked (strict template claim): "${hookCheckText}"`);
      safeFallbackHook = null;
    }
  }

  // Priority starting Fase 1: finishing_plan.hook -> fallback caller hookCard (from custom_hook/yt_title) -> null
  const finalHookCard = planCheck.hookCard || safeFallbackHook || null;

  // Map chunks from global wordEvents (retaining word array indices)
  const chunkWordObjects = chunkCaptionWords(words);
  const chunks = [];
  let searchFrom = 0;
  for (const ch of chunkWordObjects) {
    const indices = [];
    for (const cw of ch) {
      let foundIdx = -1;
      for (let wi = searchFrom; wi < words.length; wi++) {
        if (Math.abs(words[wi].s - cw.s) < 0.01 && Math.abs(words[wi].e - cw.e) < 0.01) {
          foundIdx = wi;
          searchFrom = wi + 1;
          break;
        }
      }
      if (foundIdx >= 0) indices.push(foundIdx);
    }
    if (indices.length > 0) {
      chunks.push({
        s: words[indices[0]].s,
        e: words[indices[indices.length - 1]].e,
        indices
      });
    }
  }

  // Map validated punches onto wordEvents indices and timestamps
  const enforceTenPctCap = Boolean(tplMeta?.layers?.tips);
  const maxPunchWords = enforceTenPctCap && words.length >= 10
    ? Math.max(1, Math.floor(words.length * 0.1))
    : Infinity;
  let usedPunchWords = 0;

  const mappedPunches = [];
  const punchWordIndices = new Set();

  for (const punch of planCheck.punches) {
    const targetClipWords = words
      .map((w, globalIdx) => ({ ...w, globalIdx }))
      .filter((w) => Number(w.c) === Number(punch.clipIndex));

    const startOffset = Number(punch.wordOffsetInClip);
    const punchWordCount = punch.phrase.split(/\s+/).filter(Boolean).length;
    if (startOffset < 0 || startOffset + punchWordCount > targetClipWords.length) {
      continue;
    }
    if (usedPunchWords + punchWordCount > maxPunchWords) {
      planCheck.warnings.push(`finishing_plan.punch skipped (>10% word budget): "${punch.phrase}"`);
      continue;
    }

    const spanWords = targetClipWords.slice(startOffset, startOffset + punchWordCount);
    const pStart = Math.max(0, Number((spanWords[0].s - 0.04).toFixed(4)));
    let pEnd = Math.min(dur, Math.max(spanWords[spanWords.length - 1].e + 0.32, spanWords[0].s + 0.95));

    // Prevent punch overlaps with prior punches
    const prev = mappedPunches[mappedPunches.length - 1];
    if (prev && pStart < prev.e) {
      prev.e = Math.max(prev.s + 0.35, Number((pStart - 0.04).toFixed(4)));
    }
    if (pEnd <= pStart + 0.25) continue;

    mappedPunches.push({
      phrase: punch.phrase,
      ...(punch.displayText ? { displayText: punch.displayText } : {}),
      type: punch.type,
      s: pStart,
      e: Number(pEnd.toFixed(4))
    });
    usedPunchWords += punchWordCount;
    for (const sw of spanWords) {
      punchWordIndices.add(sw.globalIdx);
    }
  }

  const resolvedClipStarts = Array.isArray(clipOffsets) && clipOffsets.length > 0
    ? clipOffsets.map((c) => Number(c.start || 0))
    : (clipStarts || []);

  // Map validated tips onto clip intervals (avoiding Hook Card at frame 0..hookDuration)
  const resolvedOffsets = Array.isArray(clipOffsets) ? clipOffsets : [];
  const mappedTips = (planCheck.tips || []).map((tip) => {
    const off = resolvedOffsets.find((c) => Number(c.clipIndex) === Number(tip.clipIndex)) || resolvedOffsets[tip.clipIndex];
    const clipStart = Number(off?.start ?? resolvedClipStarts?.[tip.clipIndex] ?? 0);
    const clipDur = Number(off?.duration) || (Number(resolvedClipStarts?.[tip.clipIndex + 1] ?? dur) - clipStart) || 2.0;
    const clipEnd = Math.min(dur, clipStart + Math.max(0.6, clipDur));
    const hookEnd = Number(hookDuration) || 1.75;
    const s = tip.clipIndex === 0 && finalHookCard
      ? Math.min(clipEnd - 0.5, Math.max(clipStart + 0.08, hookEnd + 0.12))
      : clipStart + 0.08;
    const e = Math.max(s + 0.45, clipEnd - 0.06);
    return {
      n: tip.n,
      total: tip.total,
      clipIndex: tip.clipIndex,
      text: tip.text,
      s: Number(s.toFixed(4)),
      e: Number(e.toFixed(4))
    };
  });

  // Map validated timing_badges (only for ramuan_ritual) onto exact VO trigger timestamps
  const mappedTimingBadges = [];
  for (const badge of (planCheck.timingBadges || [])) {
    const targetClipWords = words
      .map((w, globalIdx) => ({ ...w, globalIdx }))
      .filter((w) => Number(w.c) === Number(badge.clipIndex));
    const off = resolvedOffsets.find((c) => Number(c.clipIndex) === Number(badge.clipIndex)) || resolvedOffsets[badge.clipIndex];
    const clipStart = Number(off?.start ?? resolvedClipStarts?.[badge.clipIndex] ?? 0);
    const clipDur = Number(off?.duration) || (Number(resolvedClipStarts?.[badge.clipIndex + 1] ?? dur) - clipStart) || 2.4;
    const clipEnd = Math.min(dur, clipStart + Math.max(0.8, clipDur));

    const startOffset = Number(badge.wordOffsetInClip);
    const spanCount = Math.max(1, Number(badge.wordCount) || 1);
    const spanWords = startOffset >= 0 && startOffset + spanCount <= targetClipWords.length
      ? targetClipWords.slice(startOffset, startOffset + spanCount)
      : [];

    const hookEnd = Number(hookDuration) || 1.75;
    let tStart = spanWords.length > 0
      ? Math.max(0, Number((spanWords[0].s - 0.05).toFixed(4)))
      : Number((clipStart + 0.15).toFixed(4));
    if (badge.clipIndex === 0 && finalHookCard && tStart < hookEnd + 0.06 && clipEnd - hookEnd > 0.9) {
      tStart = Number((hookEnd + 0.06).toFixed(4));
    }
    const baseEnd = spanWords.length > 0
      ? Math.max(spanWords[spanWords.length - 1].e + 0.85, tStart + 2.1)
      : clipEnd - 0.08;
    const tEnd = Math.min(dur - 0.05, Math.max(tStart + 0.7, baseEnd));

    const prev = mappedTimingBadges[mappedTimingBadges.length - 1];
    if (prev && tStart < prev.e) {
      prev.e = Math.max(prev.s + 0.45, Number((tStart - 0.04).toFixed(4)));
    }
    if (tEnd <= tStart + 0.35) continue;

    mappedTimingBadges.push({
      emoji: badge.emoji,
      title: badge.title,
      ...(badge.sub ? { sub: badge.sub } : {}),
      trigger: badge.trigger,
      clipIndex: badge.clipIndex,
      s: Number(tStart.toFixed(4)),
      e: Number(tEnd.toFixed(4))
    });
  }

  // Map validated chapters & callouts (only for problem_solution)
  const resolvedLang = String(targetLanguage || brand?.targetLanguage || 'id-ID').trim() || 'id-ID';
  const isEnLang = resolvedLang.toLowerCase().startsWith('en');
  const endCardActive = Boolean(tplMeta?.layers?.sharedBrand && (brand?.name || brand?.logoUrl || endCard));
  const bodyEndLimit = endCardActive ? Math.max(0.8, dur - 1.75) : dur;

  let mappedChapters = [];
  if (tplMeta?.layers?.chapters) {
    let rawChaps = Array.isArray(planCheck.chapters) ? [...planCheck.chapters] : [];
    const totalClipCount = Math.max(resolvedOffsets.length, resolvedClipStarts.length, cleanVoiceoverClips.length);
    if (rawChaps.length === 0 && totalClipCount > 0) {
      const seq = [CHAPTER_PHASE_META.problem, CHAPTER_PHASE_META.cause, CHAPTER_PHASE_META.solution, CHAPTER_PHASE_META.result];
      for (let ci = 0; ci < totalClipCount; ci++) {
        let meta = seq[Math.min(3, ci)];
        if (totalClipCount === 2 && ci === 1) meta = CHAPTER_PHASE_META.solution;
        else if (totalClipCount === 3 && ci === 2) meta = CHAPTER_PHASE_META.solution;
        else if (totalClipCount > 4) {
          if (ci === 0) meta = CHAPTER_PHASE_META.problem;
          else if (ci < totalClipCount - 2) meta = CHAPTER_PHASE_META.cause;
          else if (ci === totalClipCount - 2) meta = CHAPTER_PHASE_META.solution;
          else meta = CHAPTER_PHASE_META.result;
        }
        rawChaps.push({
          clipIndex: ci,
          n: meta.n,
          phaseKey: meta.phaseKey,
          label: isEnLang ? meta.en : meta.id,
          color: meta.color
        });
      }
    }

    const hookEnd = Number(hookDuration) || 1.75;
    mappedChapters = rawChaps.map((ch) => {
      const off = resolvedOffsets.find((c) => Number(c.clipIndex) === Number(ch.clipIndex)) || resolvedOffsets[ch.clipIndex];
      const clipStart = Number(off?.start ?? resolvedClipStarts?.[ch.clipIndex] ?? 0);
      const clipDur = Number(off?.duration) || (Number(resolvedClipStarts?.[ch.clipIndex + 1] ?? dur) - clipStart) || 2.5;
      const rawClipEnd = Math.min(bodyEndLimit, clipStart + Math.max(0.7, clipDur));
      const s = ch.clipIndex === 0 && finalHookCard
        ? Math.min(rawClipEnd - 0.35, Math.max(clipStart + 0.08, hookEnd + 0.08))
        : clipStart + 0.08;
      const e = Math.max(s + 0.35, rawClipEnd - 0.05);
      return {
        clipIndex: ch.clipIndex,
        n: ch.n,
        phaseKey: ch.phaseKey,
        label: ch.label,
        color: ch.color,
        s: Number(s.toFixed(4)),
        e: Number(e.toFixed(4))
      };
    }).filter((ch) => ch.s < bodyEndLimit - 0.25 && ch.e > ch.s + 0.25);
  }

  const mappedCallouts = [];
  for (const co of (planCheck.callouts || [])) {
    const targetClipWords = words
      .map((w, globalIdx) => ({ ...w, globalIdx }))
      .filter((w) => Number(w.c) === Number(co.clipIndex));
    const off = resolvedOffsets.find((c) => Number(c.clipIndex) === Number(co.clipIndex)) || resolvedOffsets[co.clipIndex];
    const clipStart = Number(off?.start ?? resolvedClipStarts?.[co.clipIndex] ?? 0);
    const clipDur = Number(off?.duration) || (Number(resolvedClipStarts?.[co.clipIndex + 1] ?? dur) - clipStart) || 2.5;
    const clipEnd = Math.min(bodyEndLimit, clipStart + Math.max(0.8, clipDur));

    const startOffset = Number(co.wordOffsetInClip);
    const spanCount = Math.max(1, Number(co.wordCount) || 1);
    const spanWords = startOffset >= 0 && startOffset + spanCount <= targetClipWords.length
      ? targetClipWords.slice(startOffset, startOffset + spanCount)
      : [];

    const hookEnd = Number(hookDuration) || 1.75;
    let cStart = spanWords.length > 0
      ? Math.max(0, Number((spanWords[0].s - 0.05).toFixed(4)))
      : Number((clipStart + 0.2).toFixed(4));
    if (co.clipIndex === 0 && finalHookCard && cStart < hookEnd + 0.06 && clipEnd - hookEnd > 0.9) {
      cStart = Number((hookEnd + 0.06).toFixed(4));
    }
    const baseEnd = spanWords.length > 0
      ? Math.max(spanWords[spanWords.length - 1].e + 1.25, cStart + 2.4)
      : clipEnd - 0.08;
    const cEnd = Math.min(bodyEndLimit - 0.05, Math.max(cStart + 0.7, baseEnd));

    const prev = mappedCallouts[mappedCallouts.length - 1];
    if (prev && cStart < prev.e) {
      prev.e = Math.max(prev.s + 0.45, Number((cStart - 0.04).toFixed(4)));
    }
    if (cEnd <= cStart + 0.35) continue;

    mappedCallouts.push({
      text: co.text,
      ...(co.sub ? { sub: co.sub } : {}),
      trigger: co.trigger,
      clipIndex: co.clipIndex,
      x: co.x,
      y: co.y,
      line: co.line,
      s: Number(cStart.toFixed(4)),
      e: Number(cEnd.toFixed(4))
    });
  }

  const resolveClipAnchorTiming = (clipIdx, wordOffset, wordCount = 1) => {
    const targetWords = words.filter((w) => Number(w.c) === Number(clipIdx));
    const off = resolvedOffsets.find((c) => Number(c.clipIndex) === Number(clipIdx)) || resolvedOffsets[clipIdx];
    const clipStart = Number(off?.start ?? resolvedClipStarts?.[clipIdx] ?? 0);
    const clipDur = Number(off?.duration) || (Number(resolvedClipStarts?.[clipIdx + 1] ?? dur) - clipStart) || 2.5;
    const clipEnd = Math.min(bodyEndLimit, clipStart + Math.max(0.8, clipDur));
    const span = wordOffset >= 0 && wordOffset + wordCount <= targetWords.length
      ? targetWords.slice(wordOffset, wordOffset + wordCount)
      : [];
    const hookEnd = Number(hookDuration) || 1.75;
    let s = span.length > 0 ? Math.max(0, Number((span[0].s - 0.05).toFixed(4))) : Number((clipStart + 0.15).toFixed(4));
    if (clipIdx === 0 && finalHookCard && s < hookEnd + 0.06 && clipEnd - hookEnd > 0.8) {
      s = Number((hookEnd + 0.06).toFixed(4));
    }
    return { clipStart, clipEnd, span, s };
  };

  const mappedCompare = [];
  for (const cmp of (planCheck.compare || [])) {
    const { clipEnd, s } = resolveClipAnchorTiming(cmp.clipIndex, cmp.wordOffsetInClip, cmp.wordCount);
    const e = Math.min(bodyEndLimit - 0.05, Math.max(s + 1.2, clipEnd - 0.05));
    const prev = mappedCompare[mappedCompare.length - 1];
    if (prev && s < prev.e) {
      prev.e = Math.max(prev.s + 0.5, Number((s - 0.04).toFixed(4)));
    }
    if (e <= s + 0.4) continue;
    mappedCompare.push({
      left: cmp.left,
      right: cmp.right,
      trigger: cmp.trigger,
      clipIndex: cmp.clipIndex,
      s: Number(s.toFixed(4)),
      e: Number(e.toFixed(4))
    });
  }

  const mappedNumbers = [];
  for (const numItem of (planCheck.numbers || [])) {
    const { clipEnd, span, s } = resolveClipAnchorTiming(numItem.clipIndex, numItem.wordOffsetInClip, numItem.wordCount);
    const baseEnd = span.length > 0
      ? Math.max(span[span.length - 1].e + 1.2, s + 2.3)
      : clipEnd - 0.08;
    const e = Math.min(bodyEndLimit - 0.05, Math.min(clipEnd - 0.04, Math.max(s + 0.8, baseEnd)));
    const prev = mappedNumbers[mappedNumbers.length - 1];
    if (prev && s < prev.e) {
      prev.e = Math.max(prev.s + 0.5, Number((s - 0.04).toFixed(4)));
    }
    if (e <= s + 0.4) continue;
    mappedNumbers.push({
      fromValue: numItem.fromValue,
      value: numItem.value,
      unit: numItem.unit,
      label: numItem.label,
      trigger: numItem.trigger,
      clipIndex: numItem.clipIndex,
      s: Number(s.toFixed(4)),
      e: Number(e.toFixed(4))
    });
  }

  const mappedChips = [];
  for (const grp of (planCheck.chips || [])) {
    const firstItem = grp.items?.[0];
    if (!firstItem) continue;
    const { clipEnd, s: groupAnchorS } = resolveClipAnchorTiming(grp.clipIndex, grp.wordOffsetInClip, 1);
    const items = grp.items.map((it) => {
      const anchor = resolveClipAnchorTiming(it.clipIndex, it.wordOffsetInClip, it.wordCount);
      return {
        label: it.label,
        trigger: it.trigger,
        clipIndex: it.clipIndex,
        s: anchor.s
      };
    });
    const s = Math.min(groupAnchorS, ...items.map((x) => x.s));
    const e = Math.min(bodyEndLimit - 0.05, Math.max(s + 1.4, clipEnd - 0.05));
    const prev = mappedChips[mappedChips.length - 1];
    if (prev && s < prev.e) {
      prev.e = Math.max(prev.s + 0.5, Number((s - 0.04).toFixed(4)));
    }
    if (e <= s + 0.4) continue;
    mappedChips.push({
      clipIndex: grp.clipIndex,
      items,
      ...(grp.foot ? { foot: grp.foot } : {}),
      s: Number(s.toFixed(4)),
      e: Number(e.toFixed(4))
    });
  }

  // Enforce non-claim safety on ProductCard + mandatory safetyNotice for strict templates (`ramuan_ritual`)
  const defaultDisclaimer = isEnLang
    ? 'Herbal & culinary preparation, not medical advice'
    : DEFAULT_HERBAL_DISCLAIMER;

  let resolvedProductCard = productCard || null;
  if (strictCompliance && resolvedProductCard && typeof resolvedProductCard === 'object') {
    const cleanSpec = resolvedProductCard.specLine && isHerbalMedicalClaimPhrase(resolvedProductCard.specLine, { strict: true })
      ? ''
      : (resolvedProductCard.specLine || '');
    resolvedProductCard = {
      ...resolvedProductCard,
      specLine: cleanSpec,
      disclaimer: resolvedProductCard.disclaimer || defaultDisclaimer
    };
  }

  let mandatorySafetyNotice = null;
  if (strictCompliance) {
    const noticeText = String(brand?.safetyNoticeText || '').trim() || defaultDisclaimer;
    const endCardDur = tplMeta?.layers?.sharedBrand ? 1.75 : 0;
    const bodyEnd = Math.max(0.9, dur - endCardDur);
    const nStart = Math.max(finalHookCard ? 1.85 : 0.4, Math.min(bodyEnd - 1.1, bodyEnd - 2.6));
    const nEnd = Math.max(nStart + 0.85, bodyEnd - 0.05);
    mandatorySafetyNotice = {
      text: noticeText,
      s: Number(nStart.toFixed(4)),
      e: Number(nEnd.toFixed(4)),
      mandatory: true
    };
  }

  // SFX timeline: pop on punches & product card, tick on ingredients & timing badges, whoosh on scene cuts (+ hook entry)
  const sfx = [];
  if (finalHookCard) {
    sfx.push({ t: 0.02, k: 'whoosh' });
  }
  for (const p of mappedPunches) {
    sfx.push({ t: Number(p.s.toFixed(3)), k: 'pop' });
  }
  for (const tb of mappedTimingBadges) {
    sfx.push({ t: Number(tb.s.toFixed(3)), k: 'tick' });
  }
  for (const co of mappedCallouts) {
    sfx.push({ t: Number(co.s.toFixed(3)), k: 'tick' });
  }
  for (const cmp of mappedCompare) {
    sfx.push({ t: Number(cmp.s.toFixed(3)), k: 'pop' });
  }
  for (const numItem of mappedNumbers) {
    sfx.push({ t: Number(numItem.s.toFixed(3)), k: 'pop' });
  }
  for (const grp of mappedChips) {
    for (const it of (grp.items || [])) {
      sfx.push({ t: Number(it.s.toFixed(3)), k: 'tick' });
    }
  }
  if (resolvedProductCard && Number.isFinite(Number(resolvedProductCard.s))) {
    sfx.push({ t: Number(Number(resolvedProductCard.s).toFixed(3)), k: 'pop' });
  }
  for (const ingItem of (recipe?.ingredients?.items || [])) {
    if (Number.isFinite(Number(ingItem?.s))) {
      sfx.push({ t: Number(Number(ingItem.s).toFixed(3)), k: 'tick' });
    }
  }
  for (const cs of resolvedClipStarts.slice(1)) {
    const tCut = Number(cs);
    if (Number.isFinite(tCut) && tCut > 0.2 && tCut < dur - 0.2) {
      sfx.push({ t: Number(tCut.toFixed(3)), k: 'whoosh' });
    }
  }

  const resolvedBrandPatch = brandPatch
    ? validateBrandPatchSpec(brandPatch, {
        clipCount: cleanVoiceoverClips.length,
        isHerbalProduct: effectiveHerbal,
        strictClaims: strictCompliance,
        warnings: planCheck.warnings
      })
    : (planCheck.brandPatch || null);

  return {
    config: {
      width,
      height,
      fps: Math.max(15, Number(fps) || 30),
      duration: Number(dur.toFixed(4)),
      hookDuration: Number(hookDuration) || 1.75,
      finishingTemplate: resolvedTplId,
      captionMode: resolveCampaignCaptionMode({ caption_mode: captionMode }),
      targetLanguage: resolvedLang,
      style,
      position,
      accentColor,
      activeWordColor,
      ...(tplMeta?.layers?.sharedBrand
        ? {
            sharedBrand: {
              enabled: true,
              watermark: true,
              endCardDuration: 1.75,
              ...(strictCompliance ? { safetyNotice: true } : {})
            }
          }
        : {})
    },
    hookCard: finalHookCard,
    words,
    chunks,
    punches: mappedPunches,
    punchWordIndices: Array.from(punchWordIndices),
    clipCuts: resolvedClipStarts.slice(1).map((tCut) => Number(Number(tCut).toFixed(3))),
    clipOffsets: Array.isArray(clipOffsets) ? clipOffsets : null,
    recipe: recipe || null,
    productCard: resolvedProductCard,
    savePrompt: savePrompt || null,
    cta: cta || null,
    brand: brand || null,
    brandPatch: resolvedBrandPatch,
    lowerThird: lowerThird || null,
    endCard: endCard || null,
    ...(tplMeta?.layers?.tips || mappedTips.length > 0 ? { tips: mappedTips } : {}),
    ...(tplMeta?.layers?.timingBadges || mappedTimingBadges.length > 0 ? { timingBadges: mappedTimingBadges } : {}),
    ...(tplMeta?.layers?.chapters || mappedChapters.length > 0 ? { chapters: mappedChapters } : {}),
    ...(tplMeta?.layers?.callouts || mappedCallouts.length > 0 ? { callouts: mappedCallouts } : {}),
    ...(tplMeta?.layers?.compare || mappedCompare.length > 0 ? { compare: mappedCompare } : {}),
    ...(tplMeta?.layers?.numbers || mappedNumbers.length > 0 ? { numbers: mappedNumbers } : {}),
    ...(tplMeta?.layers?.chips || mappedChips.length > 0 ? { chips: mappedChips } : {}),
    ...(mandatorySafetyNotice ? { safetyNotice: mandatorySafetyNotice } : {}),
    sfx,
    warnings: planCheck.warnings
  };
}

/**
 * Renders transparent RGBA PNG sequence via Playwright Chromium using deterministic `renderAt(t)`
 * (1 browser per job, closed unconditionally in `finally`).
 */
export async function renderPlaywrightOverlay({
  outputDir,
  timeline,
  templatePath = null
}) {
  const resolvedTemplatePath = templatePath || resolveFinishingTemplatePath(timeline?.config?.finishingTemplate);
  if (!timeline || !timeline.config) {
    throw new Error('Timeline finishing invalid.');
  }
  if (!fs.existsSync(resolvedTemplatePath)) {
    throw new Error(`Template HTML tidak ditemukan: ${resolvedTemplatePath}`);
  }
  ensureMotionFontsRegistered();

  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });

  const width = Number(timeline.config.width) || 720;
  const height = Number(timeline.config.height) || 1280;
  const fps = Math.max(15, Number(timeline.config.fps) || 30);
  const dur = Math.max(0.2, Number(timeline.config.duration) || 1);
  const totalFrames = Math.max(1, Math.ceil(dur * fps));

  const timelineWithFonts = {
    ...timeline,
    config: {
      ...timeline.config,
      fontBaseUrl: pathToFileURL(path.join(process.cwd(), 'public', 'fonts')).href
    }
  };

  const { chromium } = await import('playwright');
  let browser = null;
  const startMs = Date.now();

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1
    });

    await page.goto(pathToFileURL(resolvedTemplatePath).href, { waitUntil: 'load' });
    await page.evaluate((payload) => window.loadTimeline(payload), timelineWithFonts);
    await page.evaluate(() => document.fonts.ready);

    const phone = await page.$('#phone');
    if (!phone) {
      throw new Error('Container #phone tidak ditemukan di template HTML.');
    }

    const framePaths = [];
    for (let i = 0; i < totalFrames; i++) {
      const t = i / fps;
      await page.evaluate((ts) => window.renderAt(ts), t);
      const framePath = path.join(outputDir, `f_${String(i).padStart(5, '0')}.png`);
      await phone.screenshot({
        path: framePath,
        omitBackground: true
      });
      framePaths.push(framePath);
    }

    const captureMs = Date.now() - startMs;
    console.log(`🎭 [Playwright Overlay] Capture ${totalFrames} frames @ ${fps}fps (${width}x${height}) selesai dalam ${captureMs}ms`);

    return {
      success: true,
      mode: 'playwright',
      imagePattern: path.join(outputDir, 'f_%05d.png'),
      fps,
      frameCount: totalFrames,
      totalDuration: dur,
      captureMs,
      sfx: Array.isArray(timeline.sfx) ? timeline.sfx : []
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Resolves available SFX files (`pop.wav`, `tick.wav`, `whoosh.wav`) and returns FFmpeg input list + audio filter chain
 * that sidechain-ducks SFX under the master VO stream and normalizes to EBU R128 loudnessTarget (-14 LUFS).
 */
export function buildPlaywrightAudioMix({
  sfxCues = [],
  totalDuration = 0,
  loudnessTarget = -14
} = {}) {
  const sfxDir = path.join(process.cwd(), 'public', 'sfx');
  const popPath = path.join(sfxDir, 'pop.wav');
  const tickPath = path.join(sfxDir, 'tick.wav');
  const whooshPath = path.join(sfxDir, 'whoosh.wav');

  const safeLoudness = Number.isFinite(Number(loudnessTarget)) ? Number(loudnessTarget) : -14;
  const loudnormFilter = `loudnorm=I=${safeLoudness}:TP=-1.0:LRA=11`;

  const validCues = (Array.isArray(sfxCues) ? sfxCues : []).filter((c) => {
    if (!c || !Number.isFinite(Number(c.t))) return false;
    if (c.k === 'pop') return fs.existsSync(popPath);
    if (c.k === 'tick') return fs.existsSync(tickPath);
    if (c.k === 'whoosh') return fs.existsSync(whooshPath);
    return false;
  }).slice(0, 24);

  if (validCues.length === 0) {
    return {
      extraAudioInputs: [],
      audioFilterComplex: `[0:a]${loudnormFilter}[aout]`,
      audioOutLabel: '[aout]'
    };
  }

  const extraAudioInputs = [];
  const popCues = validCues.filter((c) => c.k === 'pop');
  const tickCues = validCues.filter((c) => c.k === 'tick');
  const whooshCues = validCues.filter((c) => c.k === 'whoosh');

  let inputIdx = 2; // 0 = base video, 1 = overlay PNG sequence
  let popInputIdx = -1;
  let tickInputIdx = -1;
  let whooshInputIdx = -1;

  if (popCues.length > 0) {
    extraAudioInputs.push(popPath);
    popInputIdx = inputIdx++;
  }
  if (tickCues.length > 0) {
    extraAudioInputs.push(tickPath);
    tickInputIdx = inputIdx++;
  }
  if (whooshCues.length > 0) {
    extraAudioInputs.push(whooshPath);
    whooshInputIdx = inputIdx++;
  }

  const filterLines = [];
  const delayedLabels = [];

  if (popCues.length > 0) {
    const splitOuts = popCues.map((_, i) => `[pop${i}]`);
    if (popCues.length > 1) {
      filterLines.push(`[${popInputIdx}:a]asplit=${popCues.length}${splitOuts.join('')}`);
    } else {
      filterLines.push(`[${popInputIdx}:a]anull[pop0]`);
    }
    popCues.forEach((cue, i) => {
      const delayMs = Math.max(0, Math.round(cue.t * 1000));
      const lbl = `[sd${delayedLabels.length}]`;
      filterLines.push(`[pop${i}]adelay=${delayMs}|${delayMs},volume=0.45${lbl}`);
      delayedLabels.push(lbl);
    });
  }

  if (tickCues.length > 0) {
    const splitOuts = tickCues.map((_, i) => `[tck${i}]`);
    if (tickCues.length > 1) {
      filterLines.push(`[${tickInputIdx}:a]asplit=${tickCues.length}${splitOuts.join('')}`);
    } else {
      filterLines.push(`[${tickInputIdx}:a]anull[tck0]`);
    }
    tickCues.forEach((cue, i) => {
      const delayMs = Math.max(0, Math.round(cue.t * 1000));
      const lbl = `[sd${delayedLabels.length}]`;
      filterLines.push(`[tck${i}]adelay=${delayMs}|${delayMs},volume=0.38${lbl}`);
      delayedLabels.push(lbl);
    });
  }

  if (whooshCues.length > 0) {
    const splitOuts = whooshCues.map((_, i) => `[who${i}]`);
    if (whooshCues.length > 1) {
      filterLines.push(`[${whooshInputIdx}:a]asplit=${whooshCues.length}${splitOuts.join('')}`);
    } else {
      filterLines.push(`[${whooshInputIdx}:a]anull[who0]`);
    }
    whooshCues.forEach((cue, i) => {
      const delayMs = Math.max(0, Math.round(cue.t * 1000));
      const lbl = `[sd${delayedLabels.length}]`;
      filterLines.push(`[who${i}]adelay=${delayMs}|${delayMs},volume=0.30${lbl}`);
      delayedLabels.push(lbl);
    });
  }

  const durTrim = totalDuration > 0 ? `,atrim=0:${Number(totalDuration).toFixed(3)}` : '';
  filterLines.push(`${delayedLabels.join('')}amix=inputs=${delayedLabels.length}:normalize=0,apad[sfxbus]`);
  filterLines.push(`[0:a]aresample=48000,asplit=2[vo1][vo2]`);
  filterLines.push(`[sfxbus][vo1]sidechaincompress=threshold=0.05:ratio=4:attack=5:release=200[sfxduck]`);
  filterLines.push(`[vo2][sfxduck]amix=inputs=2:duration=first:normalize=0,${loudnormFilter}${durTrim}[aout]`);

  return {
    extraAudioInputs,
    audioFilterComplex: filterLines.join(';'),
    audioOutLabel: '[aout]'
  };
}

