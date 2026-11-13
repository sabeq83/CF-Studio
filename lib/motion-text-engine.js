import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { stripTtsMarkupTags } from './tts-text-sanitizer.js';

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

/**
 * Generate animated transparent PNG sequence for motion text overlay using Sharp + SVG.
 * 
 * Styles:
 * 1. 'floating_white_yellow': Uppercase white text with heavy outline turning vibrant yellow when spoken.
 * 2. 'floating_black_on_white': Uppercase black text inside white pills popping in word-by-word.
 * 3. 'minimal_white': Clean white studio card box with subtle glass effect and role tag.
 */
export async function generateMotionTextFrames(options) {
  const {
    outputDir,
    text = '',
    role = 'story',
    style = 'floating_white_yellow',
    effect = 'typewriter',
    videoWidth = 1080,
    videoHeight = 1920,
    duration = 5.0,
    fps = 15,
    tag = 'HOOK',
    brand = '',
    position = 'bottom'
  } = options;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const cleanText = stripTtsMarkupTags(text);
  if (!cleanText) {
    return { success: false, reason: 'Empty text' };
  }

  // Calculate safe vertical position (avoiding TikTok/Instagram Reels interactive UI)
  let posY = 'H-h-160';
  if (position === 'top') {
    const topOffset = Math.round(videoHeight * 0.08);
    posY = String(topOffset);
  } else if (position === 'center') {
    posY = '(H-h)/2';
  } else {
    // Bottom safe zone: 12% of height (~230px on 1080x1920, ~150px on 720x1280)
    const bottomOffset = Math.round(videoHeight * 0.12);
    posY = `H-h-${bottomOffset}`;
  }

  // Words array
  const rawWords = cleanText.split(/\s+/).filter(Boolean);
  const totalWords = rawWords.length;
  if (totalWords === 0) return { success: false, reason: 'No words found' };

  // Determine animation timing: text narration completes in ~75% of clip duration (leave remaining time to hold)
  const speechDuration = Math.max(duration * 0.75, 1.2);
  const totalFrames = Math.max(Math.round(speechDuration * fps), 15);
  const timePerWord = speechDuration / totalWords;

  // Render dimensions
  const overlayWidth = videoWidth;
  const overlayHeight = Math.round(videoHeight * 0.32); // Max height for badge / subtitle region
  const centerX = Math.round(overlayWidth / 2);

  const lines = wrapWordsIntoLines(rawWords, style === 'floating_black_on_white' ? 24 : 30);
  const fontSize = Math.round(overlayWidth * (style === 'minimal_white' ? 0.038 : 0.048));
  const lineHeight = Math.round(fontSize * 1.45);

  // Map word indices to lines for lookup
  const wordIndexMap = [];
  let globalWordCounter = 0;
  for (let l = 0; l < lines.length; l++) {
    const lineWords = lines[l];
    for (let w = 0; w < lineWords.length; w++) {
      wordIndexMap.push({
        word: lineWords[w],
        lineIndex: l,
        indexInLine: w,
        globalIndex: globalWordCounter++
      });
    }
  }

  // Generate frame sequence
  for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
    const currentTime = (frameIdx / totalFrames) * speechDuration;
    const activeWordIdx = Math.min(Math.floor(currentTime / timePerWord), totalWords - 1);
    const frameNumber = String(frameIdx + 1).padStart(3, '0');
    const frameFilePath = path.join(outputDir, `frame_${frameNumber}.png`);

    let svgContent = '';

    if (style === 'floating_white_yellow') {
      // ========================================================
      // STYLE 1: Floating Text (Word-by-Word Pop & Reveal Opsi A)
      // ========================================================
      const spaceDx = Math.max(Math.round(fontSize * 0.42), 16);
      const startY = Math.round(overlayHeight / 2) - Math.round(((lines.length - 1) * lineHeight) / 2);

      let textElements = '';
      lines.forEach((lineWords, lIdx) => {
        // Ambil hanya kata yang sudah atau sedang diucapkan
        const visibleIndices = [];
        lineWords.forEach((word, wIdx) => {
          const match = wordIndexMap.find(m => m.lineIndex === lIdx && m.indexInLine === wIdx);
          if (match && match.globalIndex <= activeWordIdx) {
            visibleIndices.push({ word, wIdx, gIdx: match.globalIndex });
          }
        });

        if (visibleIndices.length === 0) return; // Baris belum mulai diucapkan

        const yPos = startY + (lIdx * lineHeight);
        const tspans = visibleIndices.map((item, vIdx) => {
          const isActive = item.gIdx === activeWordIdx;
          const fill = isActive ? '#facc15' : '#ffffff';
          const strokeWidth = isActive ? 8 : 6;
          const escapedWord = escapeXml(item.word.toUpperCase());
          // Kata pertama baris tidak ada dx, kata berikutnya diberi spasi dx eksplisit
          const dxAttr = vIdx > 0 ? ` dx="${spaceDx}"` : '';

          return `<tspan${dxAttr} fill="${fill}" stroke="#000000" stroke-width="${strokeWidth}" paint-order="stroke fill">${escapedWord}</tspan>`;
        }).join('');

        textElements += `<text x="${centerX}" y="${yPos}" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-weight="900" font-size="${fontSize}px" letter-spacing="1.2px" xml:space="preserve" filter="url(#drop-shadow)">${tspans}</text>`;
      });

      svgContent = `
        <svg width="${overlayWidth}" height="${overlayHeight}" viewBox="0 0 ${overlayWidth} ${overlayHeight}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#000000" flood-opacity="0.95" />
            </filter>
          </defs>
          ${textElements}
        </svg>
      `;

    } else if (style === 'floating_black_on_white') {
      // ========================================================
      // STYLE 2: Floating Text (Black Caps on White Pills, Word-by-Word Reveal)
      // ========================================================
      // Only words up to activeWordIdx are shown
      const visibleWords = wordIndexMap.filter(m => m.globalIndex <= activeWordIdx);
      const visibleLines = [];
      lines.forEach((lineWords, lIdx) => {
        const lineVisible = lineWords.filter((w, wIdx) => {
          const match = wordIndexMap.find(m => m.lineIndex === lIdx && m.indexInLine === wIdx);
          return match && match.globalIndex <= activeWordIdx;
        });
        if (lineVisible.length > 0) {
          visibleLines.push({ lIdx, words: lineVisible });
        }
      });

      const pillFontSize = Math.round(overlayWidth * 0.044);
      const pillHeight = Math.round(pillFontSize * 1.5);
      const pillLineHeight = Math.round(pillHeight * 1.35);
      const startY = Math.round(overlayHeight / 2) - Math.round(((lines.length - 1) * pillLineHeight) / 2);

      let pillsContent = '';
      visibleLines.forEach(({ lIdx, words }) => {
        const yPos = startY + (lIdx * pillLineHeight);
        // Estimate line total width to center it
        const approxCharWidth = pillFontSize * 0.62;
        const wordWidths = words.map(w => (w.length * approxCharWidth) + 24);
        const totalLineWidth = wordWidths.reduce((a, b) => a + b, 0) + ((words.length - 1) * 8);
        let curX = centerX - Math.round(totalLineWidth / 2);

        words.forEach((word, wIdx) => {
          const wWidth = wordWidths[wIdx];
          const escaped = escapeXml(word.toUpperCase());
          const isNewest = wordIndexMap.find(m => m.lineIndex === lIdx && m.indexInLine === wIdx)?.globalIndex === activeWordIdx;
          const bgFill = isNewest ? '#ffffff' : '#f8fafc';
          const rx = 8;

          pillsContent += `
            <g filter="url(#pill-shadow)">
              <rect x="${curX}" y="${yPos - Math.round(pillHeight * 0.78)}" width="${wWidth}" height="${pillHeight}" rx="${rx}" fill="${bgFill}" />
              <text x="${curX + Math.round(wWidth / 2)}" y="${yPos - Math.round(pillHeight * 0.12)}" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-weight="900" font-size="${pillFontSize}px" fill="#000000" letter-spacing="0.5px">${escaped}</text>
            </g>
          `;
          curX += wWidth + 8;
        });
      });

      svgContent = `
        <svg width="${overlayWidth}" height="${overlayHeight}" viewBox="0 0 ${overlayWidth} ${overlayHeight}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="pill-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.8" />
            </filter>
          </defs>
          ${pillsContent}
        </svg>
      `;

    } else {
      // ========================================================
      // STYLE 3: Minimalist Clean White Card (Super Slim & Clean)
      // ========================================================
      // Hitung baris naskah penuh untuk mengunci tinggi kartu yang pas dan stabil
      const fullLines = wrapWordsIntoLines(rawWords, 32);
      const lineSpacing = Math.round(fontSize * 1.38);
      const padVertical = Math.round(fontSize * 0.72);
      const cardHeight = Math.round((padVertical * 2) + ((fullLines.length - 1) * lineSpacing) + fontSize);
      const cardWidth = Math.round(overlayWidth * 0.82);
      const cardX = Math.round((overlayWidth - cardWidth) / 2);
      const cardY = Math.round((overlayHeight - cardHeight) / 2);
      const cardRadius = 12;

      // Typewriter character limit up to current frame
      const totalChars = cleanText.length;
      const visibleCharCount = Math.min(Math.round((frameIdx / totalFrames) * totalChars * 1.2), totalChars);
      const currentRevealedText = cleanText.substring(0, visibleCharCount);
      const currentRevealedWords = currentRevealedText.split(/\s+/).filter(Boolean);
      const cardLines = wrapWordsIntoLines(currentRevealedWords, 32);

      const textStartY = cardY + padVertical + Math.round(fontSize * 0.82);
      let lineElements = '';
      cardLines.forEach((cWords, cIdx) => {
        const textStr = escapeXml(cWords.join(' '));
        lineElements += `<text x="${centerX}" y="${textStartY + (cIdx * lineSpacing)}" text-anchor="middle" font-family="Inter, -apple-system, sans-serif" font-weight="700" font-size="${fontSize}px" fill="#0f172a" letter-spacing="0.2px">${textStr}</text>`;
      });

      svgContent = `
        <svg width="${overlayWidth}" height="${overlayHeight}" viewBox="0 0 ${overlayWidth} ${overlayHeight}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="card-shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000000" flood-opacity="0.38" />
            </filter>
          </defs>
          <!-- Compact Frosted White Card -->
          <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="${cardRadius}" fill="rgba(255, 255, 255, 0.88)" stroke="rgba(255, 255, 255, 0.6)" stroke-width="1.2" filter="url(#card-shadow)" />
          
          <!-- Narration Text (Centered, Zero Clutter) -->
          ${lineElements}
        </svg>
      `;
    }

    // Convert SVG buffer to PNG file via Sharp
    await sharp(Buffer.from(svgContent.trim()))
      .png({ quality: 90, compressionLevel: 6 })
      .toFile(frameFilePath);
  }

  return {
    success: true,
    framePattern: path.join(outputDir, 'frame_%03d.png'),
    fps,
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
 * 
 * @param {Array<number>} clipDurations - Duration in seconds for each clip
 * @param {string} transitionType - Transition effect name (default 'fade')
 * @param {number} transitionDuration - Duration of each transition in seconds (default 0.5)
 * @returns {Object} { filterGraph, mapVideo, mapAudio, totalDuration }
 */
export function buildXfadeFilterGraph(clipDurations, transitionType = 'fade', transitionDuration = 0.5) {
  const n = clipDurations.length;
  if (n <= 1 || transitionType === 'cut') {
    return null; // Fallback to standard concat
  }

  // Ensure transition duration doesn't exceed 40% of shortest clip
  const minDur = Math.min(...clipDurations);
  const safeTransDur = Math.min(transitionDuration, Math.max(minDur * 0.4, 0.2));

  // Compute transition offsets
  // offset[0] = dur[0] - safeTransDur
  // offset[i] = offset[i-1] + dur[i] - safeTransDur
  const offsets = [];
  let currentOffset = clipDurations[0] - safeTransDur;
  offsets.push(Math.max(currentOffset, 0.1));

  for (let i = 1; i < n - 1; i++) {
    currentOffset = currentOffset + clipDurations[i] - safeTransDur;
    offsets.push(Math.max(currentOffset, 0.1));
  }

  const filterGraph = [];

  // Build Video xfade chain
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

  // Build Audio acrossfade chain
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
