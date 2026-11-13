import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { validateFinishingPlan, resolveCampaignCaptionMode, validateBrandPatchSpec } from './finishing-plan-validator.js';
import { chunkCaptionWords, fitHookCard } from './motion-text-engine.js';
import { ensureMotionFontsRegistered } from './motion-font-loader.js';
import { resolveFinishingTemplateFile } from './finishing-template-registry.js';

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

  // Validate finishing_plan against clean VO & herbal guard
  const planCheck = validateFinishingPlan(finishingPlan, {
    cleanVoiceoverClips,
    isHerbalProduct,
    width,
    height
  });

  if (planCheck.warnings.length > 0) {
    console.warn('[Finishing Plan Warnings]', planCheck.warnings.join(' | '));
  }

  // Priority starting Fase 1: finishing_plan.hook -> fallback caller hookCard (from custom_hook/yt_title) -> null
  const finalHookCard = planCheck.hookCard || hookCard || null;

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
      type: punch.type,
      s: pStart,
      e: Number(pEnd.toFixed(4))
    });
    for (const sw of spanWords) {
      punchWordIndices.add(sw.globalIdx);
    }
  }

  // SFX timeline: pop on punches & product card, tick on ingredients, whoosh on scene cuts (+ hook entry)
  const resolvedClipStarts = Array.isArray(clipOffsets) && clipOffsets.length > 0
    ? clipOffsets.map((c) => Number(c.start || 0))
    : (clipStarts || []);
  const sfx = [];
  if (finalHookCard) {
    sfx.push({ t: 0.02, k: 'whoosh' });
  }
  for (const p of mappedPunches) {
    sfx.push({ t: Number(p.s.toFixed(3)), k: 'pop' });
  }
  if (productCard && Number.isFinite(Number(productCard.s))) {
    sfx.push({ t: Number(Number(productCard.s).toFixed(3)), k: 'pop' });
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
        isHerbalProduct,
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
      finishingTemplate: String(finishingTemplate || 'none').trim().toLowerCase(),
      captionMode: resolveCampaignCaptionMode({ caption_mode: captionMode }),
      targetLanguage: String(targetLanguage || brand?.targetLanguage || 'id-ID').trim() || 'id-ID',
      style,
      position,
      accentColor,
      activeWordColor
    },
    hookCard: finalHookCard,
    words,
    chunks,
    punches: mappedPunches,
    punchWordIndices: Array.from(punchWordIndices),
    clipCuts: resolvedClipStarts.slice(1).map((tCut) => Number(Number(tCut).toFixed(3))),
    clipOffsets: Array.isArray(clipOffsets) ? clipOffsets : null,
    recipe: recipe || null,
    productCard: productCard || null,
    savePrompt: savePrompt || null,
    cta: cta || null,
    brand: brand || null,
    brandPatch: resolvedBrandPatch,
    lowerThird: lowerThird || null,
    endCard: endCard || null,
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

