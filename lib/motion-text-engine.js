import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { ensureMotionFontsRegistered, measureFontTextWidth } from './motion-font-loader.js';
import { hasLeakedOverlayMarkup, sanitizeOverlayTextStrict } from './tts-text-sanitizer.js';
import { isHerbalMedicalClaimPhrase } from './tiktok-compliance-service.js';

ensureMotionFontsRegistered();

const L1_SIZE_RATIOS = [0.13, 0.115, 0.10, 0.088, 0.08];
const L2_SIZE_RATIOS = [0.15, 0.135, 0.12, 0.108, 0.10];

/**
 * Helper to wrap words into balanced lines based on maximum characters per line
 */
function wrapWordsIntoLines(words, maxCharsPerLine = 28) {
  const lines = [];
  let currentLine = [];
  let currentLen = 0;

  for (const word of words) {
    const wordLen = word.length;
    if (currentLine.length > 0 && (currentLen + 1 + wordLen) > maxCharsPerLine) {
      lines.push(currentLine);
      currentLine = [word];
      currentLen = wordLen;
    } else {
      currentLine.push(word);
      currentLen += (currentLine.length === 1 ? 0 : 1) + wordLen;
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Escape XML special characters for SVG text safety
 */
function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function assertCleanOverlayString(rawText, label = 'overlay') {
  const cleaned = sanitizeOverlayTextStrict(rawText);
  if (hasLeakedOverlayMarkup(rawText) || hasLeakedOverlayMarkup(cleaned)) {
    console.warn(`[MotionText QA Guard] Terdeteksi markup TTS/stage note pada ${label}; dibersihkan sebelum render.`);
  }
  return sanitizeOverlayTextStrict(cleaned);
}

/**
 * Breaks aligned words into readable 2-4 word subtitle chunks matching overlay.html derive():
 * breaks at punctuation [,.?!]$, >= 4 words, >= 2 words with joined length > 15, or clip boundaries.
 */
export function chunkCaptionWords(words = []) {
  if (!Array.isArray(words) || words.length === 0) return [];
  const chunks = [];
  let cur = [];

  for (let i = 0; i < words.length; i++) {
    const item = typeof words[i] === 'string' ? { w: words[i], s: i * 0.35, e: (i + 1) * 0.35, c: 0 } : words[i];
    const cleanWord = assertCleanOverlayString(item.w || '', 'subtitle_word');
    if (!cleanWord) continue;

    const normalizedItem = { ...item, w: cleanWord };
    cur.push(normalizedItem);

    const joined = cur.map(w => w.w).join(' ');
    const nextItem = words[i + 1];
    const hasClipBoundary = Boolean(
      nextItem &&
      typeof nextItem === 'object' &&
      normalizedItem.c !== undefined &&
      nextItem.c !== undefined &&
      nextItem.c !== normalizedItem.c
    );

    if (
      /[,.?!]$/.test(cleanWord) ||
      cur.length >= 4 ||
      (cur.length >= 2 && joined.length > 15) ||
      hasClipBoundary
    ) {
      chunks.push(cur);
      cur = [];
    }
  }

  if (cur.length > 0) {
    chunks.push(cur);
  }
  return chunks;
}

/**
 * Cleans raw hook titles for Frame 0 Hook Card by stripping #Shorts, TTS tags, and dangling quotes.
 */
export function cleanHookCardTitle(rawHook = '') {
  const withoutShorts = String(rawHook || '').replace(/#shorts\b/gi, '');
  const sanitized = sanitizeOverlayTextStrict(withoutShorts);
  return sanitized.replace(/^[\s"'|:-]+|[\s"'|:-]+$/g, '').trim();
}

function generateHookSplitCandidates(words = []) {
  if (words.length <= 1) {
    return [{ l1: words.join(' '), l2: '' }];
  }

  const candidates = [{ l1: words.join(' '), l2: '' }];
  const splits = [];
  for (let idx = 1; idx < words.length; idx++) {
    const l1 = words.slice(0, idx).join(' ');
    const l2 = words.slice(idx).join(' ');
    const punctBonus = /[?!,:;]$/.test(words[idx - 1]) ? -10 : 0;
    const balanceScore = Math.abs(l1.length - l2.length) + punctBonus;
    splits.push({ l1, l2, score: balanceScore });
  }
  splits.sort((a, b) => a.score - b.score);
  return [...splits.map(({ l1, l2 }) => ({ l1, l2 })), ...candidates];
}

/**
 * Fits a pre-FFmpeg Hook Card strictly within <= 2 lines and <= 88cqw width using real Anton OFL metrics,
 * blocking medical/disease claims for herbal products. Returns null if unsafe or too long so the video
 * starts cleanly without forced clipping.
 */
export function fitHookCard(rawHook, { isHerbalProduct = true, width = 720, height = 1280 } = {}) {
  const cleaned = cleanHookCardTitle(rawHook);
  if (!cleaned) return null;

  if (isHerbalProduct && isHerbalMedicalClaimPhrase(cleaned)) {
    return null;
  }

  // Hard guard matching R1.2 (~34 char ceiling; allow minor tolerance up to 38 chars before Anton width check)
  if (cleaned.length > 38) {
    return null;
  }

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  const maxLinePx = width * 0.88;
  const letterSpacingFactor = 0.01;
  const candidates = generateHookSplitCandidates(words);

  for (const { l1, l2 } of candidates) {
    const u1 = l1.toUpperCase();
    const u2 = l2.toUpperCase();

    if (!u2) {
      for (const ratio of L1_SIZE_RATIOS) {
        const px = Math.round(width * ratio);
        const w1 = measureFontTextWidth('Anton-Regular.ttf', px, u1, px * letterSpacingFactor);
        if (w1 <= maxLinePx) {
          return {
            l1: u1,
            l2: '',
            text: cleaned,
            l1FontSize: px,
            l2FontSize: 0,
            l1Ratio: ratio,
            l2Ratio: 0,
            lineCount: 1,
            width,
            height
          };
        }
      }
      continue;
    }

    for (let i = 0; i < L1_SIZE_RATIOS.length; i++) {
      const r1 = L1_SIZE_RATIOS[i];
      const r2 = L2_SIZE_RATIOS[Math.min(i, L2_SIZE_RATIOS.length - 1)];
      const px1 = Math.round(width * r1);
      const px2 = Math.round(width * r2);

      // Account for l2 horizontal padding inside the tilted accent bar (2.5cqw * 2)
      const w1 = measureFontTextWidth('Anton-Regular.ttf', px1, u1, px1 * letterSpacingFactor);
      const w2 = measureFontTextWidth('Anton-Regular.ttf', px2, u2, px2 * letterSpacingFactor) + width * 0.06;

      if (w1 <= maxLinePx && w2 <= maxLinePx) {
        return {
          l1: u1,
          l2: u2,
          text: cleaned,
          l1FontSize: px1,
          l2FontSize: px2,
          l1Ratio: r1,
          l2Ratio: r2,
          lineCount: 2,
          width,
          height
        };
      }
    }
  }

  return null;
}

function renderHookGroupSvg(hookCard, width, height, accentColor = '#f2b632') {
  if (!hookCard) return '';
  const centerX = Math.round(width / 2);
  const topY = Math.round(height * 0.34);
  const l1Size = hookCard.l1FontSize || Math.round(width * 0.105);
  const l2Size = hookCard.l2FontSize || Math.round(width * 0.125);
  const stroke1 = Math.max(4, Math.round(l1Size * 0.14));
  const safeL1 = escapeXml(assertCleanOverlayString(hookCard.l1 || '', 'hook_l1')).toUpperCase();
  const safeL2 = escapeXml(assertCleanOverlayString(hookCard.l2 || '', 'hook_l2')).toUpperCase();

  let svg = `
    <g filter="url(#hook-shadow)">
      <text x="${centerX}" y="${topY}" text-anchor="middle" font-family="Anton, sans-serif" font-size="${l1Size}px" fill="#ffffff" stroke="#000000" stroke-width="${stroke1}" paint-order="stroke fill" letter-spacing="1px">${safeL1}</text>
  `;

  if (safeL2) {
    const l2Width = Math.min(
      Math.round(width * 0.90),
      Math.round(measureFontTextWidth('Anton-Regular.ttf', l2Size, hookCard.l2 || '', 1) + width * 0.07)
    );
    const barH = Math.round(l2Size * 1.18);
    const barX = Math.round(centerX - l2Width / 2);
    const barY = Math.round(topY + l1Size * 0.25);
    const textY = Math.round(barY + barH * 0.80);

    svg += `
      <g transform="rotate(-2 ${centerX} ${Math.round(barY + barH / 2)})">
        <rect x="${barX}" y="${barY}" width="${l2Width}" height="${barH}" rx="${Math.round(width * 0.018)}" fill="${accentColor}" />
        <text x="${centerX}" y="${textY}" text-anchor="middle" font-family="Anton, sans-serif" font-size="${l2Size}px" fill="#18120c" letter-spacing="1px">${safeL2}</text>
      </g>
    `;
  }

  svg += '</g>';
  return svg;
}

function renderSubtitleChunkSvg({
  chunk = [],
  activeWordIdxInChunk = 0,
  width = 720,
  height = 1280,
  style = 'floating_white_yellow',
  position = 'bottom',
  activeWordColor = '#fff066'
}) {
  if (!Array.isArray(chunk) || chunk.length === 0) return '';

  const centerX = Math.round(width / 2);
  let anchorY = Math.round(height * 0.69);
  if (position === 'top') anchorY = Math.round(height * 0.16);
  else if (position === 'center') anchorY = Math.round(height * 0.50);

  const fontSize = Math.round(width * (style === 'minimal_white' ? 0.052 : 0.066));
  const strokeWidth = Math.max(4, Math.round(width * 0.0055 * 2));
  const cleanTokens = chunk.map(w => assertCleanOverlayString(w.w || w, 'subtitle_chunk')).filter(Boolean);
  if (cleanTokens.length === 0) return '';

  if (style === 'floating_black_on_white') {
    const pillFontSize = Math.round(width * 0.056);
    const pillHeight = Math.round(pillFontSize * 1.48);
    const widths = cleanTokens.map(w => Math.round(measureFontTextWidth('Montserrat-Black.ttf', pillFontSize, w.toUpperCase(), 0.5) + width * 0.04));
    const gap = Math.round(width * 0.014);
    const totalW = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, widths.length - 1);
    let curX = Math.round(centerX - totalW / 2);

    const pills = cleanTokens.map((word, idx) => {
      const boxW = widths[idx];
      const bg = idx === activeWordIdxInChunk ? activeWordColor : '#ffffff';
      const el = `
        <rect x="${curX}" y="${anchorY - Math.round(pillHeight * 0.72)}" width="${boxW}" height="${pillHeight}" rx="${Math.round(width * 0.014)}" fill="${bg}" />
        <text x="${curX + Math.round(boxW / 2)}" y="${anchorY}" text-anchor="middle" font-family="Montserrat Black, Montserrat, sans-serif" font-weight="900" font-size="${pillFontSize}px" fill="#0d0e11">${escapeXml(word.toUpperCase())}</text>
      `;
      curX += boxW + gap;
      return el;
    }).join('');

    return `<g filter="url(#drop-shadow)">${pills}</g>`;
  }

  if (style === 'minimal_white') {
    const textJoined = cleanTokens.join(' ');
    const cardWidth = Math.round(width * 0.84);
    const cardHeight = Math.round(fontSize * 2.1);
    const cardX = Math.round(centerX - cardWidth / 2);
    const cardY = Math.round(anchorY - cardHeight * 0.65);

    return `
      <g filter="url(#drop-shadow)">
        <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="12" fill="rgba(255,255,255,0.9)" />
        <text x="${centerX}" y="${anchorY}" text-anchor="middle" font-family="Inter, Montserrat, sans-serif" font-weight="700" font-size="${fontSize}px" fill="#0f172a">${escapeXml(textJoined)}</text>
      </g>
    `;
  }

  // Default: floating_white_yellow aligned with overlay.html (.sub 6.6cqw top 69cqh)
  const spaceDx = Math.max(Math.round(fontSize * 0.34), 12);
  const tspans = cleanTokens.map((word, idx) => {
    const isActive = idx === activeWordIdxInChunk;
    const fill = isActive ? activeWordColor : '#ffffff';
    const dxAttr = idx > 0 ? ` dx="${spaceDx}"` : '';
    return `<tspan${dxAttr} fill="${fill}" stroke="#000000" stroke-width="${strokeWidth}" paint-order="stroke fill">${escapeXml(word.toUpperCase())}</tspan>`;
  }).join('');

  return `
    <g filter="url(#drop-shadow)">
      <text x="${centerX}" y="${anchorY}" text-anchor="middle" font-family="Montserrat Black, Montserrat, sans-serif" font-weight="900" font-size="${fontSize}px" letter-spacing="0.4px" xml:space="preserve">${tspans}</text>
    </g>
  `;
}

export function buildGlobalOverlayFrameSvg({
  width = 720,
  height = 1280,
  hookCard = null,
  showHook = false,
  chunk = null,
  activeWordIdxInChunk = -1,
  style = 'floating_white_yellow',
  position = 'bottom',
  accentColor = '#f2b632',
  activeWordColor = '#fff066'
}) {
  const hookSvg = showHook && hookCard ? renderHookGroupSvg(hookCard, width, height, accentColor) : '';
  const subSvg = chunk && chunk.length > 0
    ? renderSubtitleChunkSvg({ chunk, activeWordIdxInChunk, width, height, style, position, activeWordColor })
    : '';

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.92" />
        </filter>
        <filter id="hook-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#000000" flood-opacity="0.88" />
        </filter>
      </defs>
      ${hookSvg}
      ${subSvg}
    </svg>
  `.trim();
}

/**
 * Renders deduplicated transparent RGBA PNG states and writes an ffconcat schedule for crisp
 * target-FPS global-timeline compositing after clip concat/xfade (Fase 0 + Fase 1 fallback).
 */
export async function renderGlobalTimelineOverlay({
  outputDir,
  wordEvents = [],
  hookCard = null,
  hookDuration = 1.75,
  style = 'floating_white_yellow',
  position = 'bottom',
  width = 720,
  height = 1280,
  fps = 30,
  totalDuration = 0,
  accentColor = '#f2b632',
  activeWordColor = '#fff066'
}) {
  ensureMotionFontsRegistered();
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const dur = Math.max(
    Number(totalDuration) || 0,
    wordEvents.reduce((m, w) => Math.max(m, Number(w.e) || 0), 0),
    hookCard ? hookDuration : 0,
    0.5
  );

  const chunks = chunkCaptionWords(wordEvents);
  const chunkSpans = chunks.map((ch) => ({
    words: ch,
    start: ch[0].s,
    end: ch[ch.length - 1].e
  }));

  const cutPoints = new Set([0, Number(dur.toFixed(4))]);
  if (hookCard && hookDuration > 0 && hookDuration < dur) {
    cutPoints.add(Number(hookDuration.toFixed(4)));
  }
  for (const w of wordEvents) {
    if (w.s > 0 && w.s < dur) cutPoints.add(Number(w.s.toFixed(4)));
    if (w.e > 0 && w.e < dur) cutPoints.add(Number(w.e.toFixed(4)));
  }
  for (const sp of chunkSpans) {
    if (sp.start > 0 && sp.start < dur) cutPoints.add(Number(sp.start.toFixed(4)));
    if (sp.end > 0 && sp.end < dur) cutPoints.add(Number(sp.end.toFixed(4)));
  }

  const sortedPoints = Array.from(cutPoints).sort((a, b) => a - b);
  const rawSegments = [];

  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const t0 = sortedPoints[i];
    const t1 = sortedPoints[i + 1];
    if (t1 - t0 < 0.015) continue;

    const tMid = (t0 + t1) / 2;
    const showHook = Boolean(hookCard && tMid < hookDuration);

    let activeChunkIdx = -1;
    let activeWordIdxInChunk = -1;
    for (let c = 0; c < chunkSpans.length; c++) {
      const sp = chunkSpans[c];
      if (tMid >= sp.start && tMid <= sp.end) {
        activeChunkIdx = c;
        for (let wi = 0; wi < sp.words.length; wi++) {
          if (tMid >= sp.words[wi].s && tMid <= sp.words[wi].e) {
            activeWordIdxInChunk = wi;
            break;
          }
        }
        if (activeWordIdxInChunk < 0) activeWordIdxInChunk = 0;
        break;
      }
    }

    const stateKey = `${showHook ? 'H1' : 'H0'}_${activeChunkIdx}_${activeWordIdxInChunk}`;
    if (rawSegments.length > 0 && rawSegments[rawSegments.length - 1].stateKey === stateKey) {
      rawSegments[rawSegments.length - 1].t1 = t1;
    } else {
      rawSegments.push({
        t0,
        t1,
        stateKey,
        showHook,
        activeChunk: activeChunkIdx >= 0 ? chunkSpans[activeChunkIdx].words : null,
        activeWordIdxInChunk
      });
    }
  }

  if (rawSegments.length === 0) {
    return { success: false, reason: 'No overlay segments generated' };
  }

  const stateFileMap = new Map();
  let stateCounter = 0;
  const concatLines = ['ffconcat version 1.0'];

  for (const seg of rawSegments) {
    let pngPath = stateFileMap.get(seg.stateKey);
    if (!pngPath) {
      stateCounter += 1;
      pngPath = path.join(outputDir, `state_${String(stateCounter).padStart(4, '0')}.png`);
      if (!seg.showHook && !seg.activeChunk) {
        await sharp({
          create: {
            width,
            height,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          }
        }).png({ compressionLevel: 6 }).toFile(pngPath);
      } else {
        const svgContent = buildGlobalOverlayFrameSvg({
          width,
          height,
          hookCard,
          showHook: seg.showHook,
          chunk: seg.activeChunk,
          activeWordIdxInChunk: seg.activeWordIdxInChunk,
          style,
          position,
          accentColor,
          activeWordColor
        });
        await sharp(Buffer.from(svgContent))
          .png({ quality: 92, compressionLevel: 6 })
          .toFile(pngPath);
      }
      stateFileMap.set(seg.stateKey, pngPath);
    }

    const segDur = Math.max(0.02, seg.t1 - seg.t0);
    concatLines.push(`file '${pngPath.replace(/'/g, "'\\''")}'`);
    concatLines.push(`duration ${segDur.toFixed(4)}`);
  }

  const lastPng = stateFileMap.get(rawSegments[rawSegments.length - 1].stateKey);
  concatLines.push(`file '${lastPng.replace(/'/g, "'\\''")}'`);

  const ffconcatPath = path.join(outputDir, 'overlay.ffconcat');
  fs.writeFileSync(ffconcatPath, concatLines.join('\n') + '\n', 'utf8');

  return {
    success: true,
    ffconcatPath,
    fps: Math.max(15, Number(fps) || 30),
    segmentCount: rawSegments.length,
    uniquePngCount: stateFileMap.size,
    totalDuration: dur
  };
}

/**
 * Legacy per-clip PNG sequence generator (updated with OFL fonts, strict QA sanitizer, and chunked captions).
 */
export async function generateMotionTextFrames(options) {
  ensureMotionFontsRegistered();

  const {
    outputDir,
    text = '',
    role = 'story',
    style = 'floating_white_yellow',
    videoWidth = 1080,
    videoHeight = 1920,
    duration = 5.0,
    fps = 30,
    position = 'bottom'
  } = options;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const cleanText = assertCleanOverlayString(text, `legacy_${role}`);
  if (!cleanText) {
    return { success: false, reason: 'Empty text' };
  }

  const rawWords = cleanText.split(/\s+/).filter(Boolean);
  const totalWords = rawWords.length;
  if (totalWords === 0) return { success: false, reason: 'No words found' };

  let posY = 'H-h-160';
  if (position === 'top') {
    posY = String(Math.round(videoHeight * 0.08));
  } else if (position === 'center') {
    posY = '(H-h)/2';
  } else {
    posY = `H-h-${Math.round(videoHeight * 0.12)}`;
  }

  const targetFps = Math.max(15, Number(fps) || 30);
  const speechDuration = Math.max(duration * 0.78, 1.2);
  const totalFrames = Math.max(Math.round(speechDuration * targetFps), 15);
  const timePerWord = speechDuration / totalWords;

  const chunks = chunkCaptionWords(rawWords.map((w, idx) => ({
    w,
    s: idx * timePerWord,
    e: (idx + 1) * timePerWord,
    c: 0
  })));

  const overlayWidth = videoWidth;
  const overlayHeight = Math.round(videoHeight * 0.32);
  const centerX = Math.round(overlayWidth / 2);
  const fontSize = Math.round(overlayWidth * (style === 'minimal_white' ? 0.052 : 0.066));
  const strokeWidth = Math.max(4, Math.round(overlayWidth * 0.0055 * 2));

  for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
    const currentTime = (frameIdx / totalFrames) * speechDuration;
    let activeChunk = chunks[0];
    let activeWordIdxInChunk = 0;

    for (const ch of chunks) {
      if (currentTime >= ch[0].s && currentTime <= ch[ch.length - 1].e) {
        activeChunk = ch;
        const idx = ch.findIndex(w => currentTime >= w.s && currentTime <= w.e);
        activeWordIdxInChunk = idx >= 0 ? idx : ch.length - 1;
        break;
      }
    }

    const tokens = activeChunk.map(w => w.w);
    const frameNumber = String(frameIdx + 1).padStart(3, '0');
    const frameFilePath = path.join(outputDir, `frame_${frameNumber}.png`);

    let svgContent = '';
    if (style === 'floating_black_on_white') {
      const pillFontSize = Math.round(overlayWidth * 0.052);
      const pillHeight = Math.round(pillFontSize * 1.48);
      const wordWidths = tokens.map(w => Math.round(measureFontTextWidth('Montserrat-Black.ttf', pillFontSize, w.toUpperCase(), 0.5) + overlayWidth * 0.04));
      const gap = Math.round(overlayWidth * 0.014);
      const totalLineW = wordWidths.reduce((a, b) => a + b, 0) + gap * Math.max(0, tokens.length - 1);
      let curX = Math.round(centerX - totalLineW / 2);
      const yPos = Math.round(overlayHeight * 0.56);

      const pills = tokens.map((word, wIdx) => {
        const wWidth = wordWidths[wIdx];
        const bgFill = wIdx === activeWordIdxInChunk ? '#fff066' : '#ffffff';
        const g = `
          <g filter="url(#pill-shadow)">
            <rect x="${curX}" y="${yPos - Math.round(pillHeight * 0.72)}" width="${wWidth}" height="${pillHeight}" rx="10" fill="${bgFill}" />
            <text x="${curX + Math.round(wWidth / 2)}" y="${yPos}" text-anchor="middle" font-family="Montserrat Black, Montserrat, sans-serif" font-weight="900" font-size="${pillFontSize}px" fill="#0d0e11">${escapeXml(word.toUpperCase())}</text>
          </g>
        `;
        curX += wWidth + gap;
        return g;
      }).join('');

      svgContent = `
        <svg width="${overlayWidth}" height="${overlayHeight}" viewBox="0 0 ${overlayWidth} ${overlayHeight}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="pill-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.8" />
            </filter>
          </defs>
          ${pills}
        </svg>
      `;
    } else if (style === 'minimal_white') {
      const lines = wrapWordsIntoLines(tokens, 26);
      const lineSpacing = Math.round(fontSize * 1.35);
      const padV = Math.round(fontSize * 0.7);
      const cardHeight = Math.round(padV * 2 + (lines.length - 1) * lineSpacing + fontSize);
      const cardWidth = Math.round(overlayWidth * 0.84);
      const cardX = Math.round((overlayWidth - cardWidth) / 2);
      const cardY = Math.round((overlayHeight - cardHeight) / 2);
      const textStartY = cardY + padV + Math.round(fontSize * 0.82);

      const lineElements = lines.map((cWords, cIdx) => (
        `<text x="${centerX}" y="${textStartY + cIdx * lineSpacing}" text-anchor="middle" font-family="Inter, Montserrat, sans-serif" font-weight="700" font-size="${fontSize}px" fill="#0f172a">${escapeXml(cWords.join(' '))}</text>`
      )).join('');

      svgContent = `
        <svg width="${overlayWidth}" height="${overlayHeight}" viewBox="0 0 ${overlayWidth} ${overlayHeight}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="card-shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000000" flood-opacity="0.38" />
            </filter>
          </defs>
          <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="12" fill="rgba(255, 255, 255, 0.9)" filter="url(#card-shadow)" />
          ${lineElements}
        </svg>
      `;
    } else {
      const spaceDx = Math.max(Math.round(fontSize * 0.34), 12);
      const yPos = Math.round(overlayHeight * 0.56);
      const tspans = tokens.map((word, idx) => {
        const isActive = idx === activeWordIdxInChunk;
        const fill = isActive ? '#fff066' : '#ffffff';
        const dxAttr = idx > 0 ? ` dx="${spaceDx}"` : '';
        return `<tspan${dxAttr} fill="${fill}" stroke="#000000" stroke-width="${strokeWidth}" paint-order="stroke fill">${escapeXml(word.toUpperCase())}</tspan>`;
      }).join('');

      svgContent = `
        <svg width="${overlayWidth}" height="${overlayHeight}" viewBox="0 0 ${overlayWidth} ${overlayHeight}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000000" flood-opacity="0.95" />
            </filter>
          </defs>
          <text x="${centerX}" y="${yPos}" text-anchor="middle" font-family="Montserrat Black, Montserrat, sans-serif" font-weight="900" font-size="${fontSize}px" letter-spacing="0.4px" xml:space="preserve" filter="url(#drop-shadow)">${tspans}</text>
        </svg>
      `;
    }

    await sharp(Buffer.from(svgContent.trim()))
      .png({ quality: 90, compressionLevel: 6 })
      .toFile(frameFilePath);
  }

  return {
    success: true,
    framePattern: path.join(outputDir, 'frame_%03d.png'),
    fps: targetFps,
    frameCount: totalFrames,
    posY,
    style,
    duration
  };
}

/**
 * Build FFmpeg xfade filter complex for N video clips and acrossfade for audio streams.
 *
 * Supports: 'fade', 'fadewhite', 'fadeblack', 'slideleft', 'slideright', 'wipeleft', 'zoomin', 'circleopen', 'cut'
 */
export function buildXfadeFilterGraph(clipDurations, transitionType = 'cut', transitionDuration = 0.5) {
  const n = clipDurations.length;
  if (n <= 1 || transitionType === 'cut') {
    return null;
  }

  const minDur = Math.min(...clipDurations);
  const safeTransDur = Math.min(transitionDuration, Math.max(minDur * 0.4, 0.2));

  const offsets = [];
  let currentOffset = clipDurations[0] - safeTransDur;
  offsets.push(Math.max(currentOffset, 0.1));

  for (let i = 1; i < n - 1; i++) {
    currentOffset = currentOffset + clipDurations[i] - safeTransDur;
    offsets.push(Math.max(currentOffset, 0.1));
  }

  const filterGraph = [];

  let lastVideoLabel = '0:v';
  for (let i = 0; i < n - 1; i++) {
    const nextVideo = `${i + 1}:v`;
    const outLabel = (i === n - 2) ? 'v_joined' : `v_xfade_${i + 1}`;
    const offsetSec = offsets[i].toFixed(3);

    filterGraph.push({
      filter: 'xfade',
      options: {
        transition: transitionType,
        duration: safeTransDur.toFixed(2),
        offset: offsetSec
      },
      inputs: [lastVideoLabel, nextVideo],
      outputs: [outLabel]
    });

    lastVideoLabel = outLabel;
  }

  let lastAudioLabel = '0:a';
  for (let i = 0; i < n - 1; i++) {
    const nextAudio = `${i + 1}:a`;
    const outLabel = (i === n - 2) ? 'a_joined' : `a_xfade_${i + 1}`;

    filterGraph.push({
      filter: 'acrossfade',
      options: {
        d: safeTransDur.toFixed(2),
        c1: 'tri',
        c2: 'tri'
      },
      inputs: [lastAudioLabel, nextAudio],
      outputs: [outLabel]
    });

    lastAudioLabel = outLabel;
  }

  const totalDuration = clipDurations.reduce((a, b) => a + b, 0) - ((n - 1) * safeTransDur);

  return {
    filterGraph,
    mapVideo: '[v_joined]',
    mapAudio: '[a_joined]',
    totalDuration,
    transitionType,
    transitionDuration: safeTransDur
  };
}
