import { execFile } from 'child_process';
import fs from 'fs';
import { promisify } from 'util';
import ffmpeg from 'fluent-ffmpeg';
import { sanitizeOverlayTextStrict } from './tts-text-sanitizer.js';
import { resolveFfprobePath } from './ffprobe-path.js';

const execFileAsync = promisify(execFile);
ffmpeg.setFfprobePath(resolveFfprobePath());

function resolveFfmpegBin() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  if (fs.existsSync('/opt/homebrew/bin/ffmpeg')) {
    return '/opt/homebrew/bin/ffmpeg';
  }
  return 'ffmpeg';
}

export function normAlignmentWord(word) {
  return String(word || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

export function computeWordWeight(word) {
  return normAlignmentWord(word).length + 1.6;
}

/**
 * Parses ffmpeg silencedetect filter stderr lines into sorted silence intervals.
 */
export function parseSilenceDetectStderr(stderr = '', totalDuration = 0) {
  const lines = String(stderr || '').split(/\r?\n/);
  const intervals = [];
  let pendingStart = null;

  for (const line of lines) {
    const startMatch = line.match(/silence_start:\s*([0-9.+-]+)/);
    if (startMatch) {
      const val = Number(startMatch[1]);
      if (Number.isFinite(val)) {
        pendingStart = Math.max(0, val);
      }
      continue;
    }

    const endMatch = line.match(/silence_end:\s*([0-9.+-]+)/);
    if (endMatch) {
      const endVal = Number(endMatch[1]);
      if (Number.isFinite(endVal)) {
        const startVal = pendingStart !== null ? pendingStart : 0;
        if (endVal > startVal) {
          intervals.push({ start: startVal, end: endVal });
        }
        pendingStart = null;
      }
    }
  }

  if (pendingStart !== null && totalDuration > pendingStart) {
    intervals.push({ start: pendingStart, end: totalDuration });
  }

  return intervals;
}

/**
 * Converts silence intervals into active speech windows within [0, totalDuration].
 */
export function buildSpeechIslands(silences = [], totalDuration = 0) {
  const dur = Math.max(Number(totalDuration) || 0, 0.05);
  if (!Array.isArray(silences) || silences.length === 0) {
    return [{ start: 0, end: dur }];
  }

  const sorted = [...silences]
    .filter(s => Number.isFinite(s?.start) && Number.isFinite(s?.end) && s.end > s.start)
    .sort((a, b) => a.start - b.start);

  const islands = [];
  let cursor = 0;

  for (const sil of sorted) {
    const silStart = Math.max(0, Math.min(sil.start, dur));
    const silEnd = Math.max(silStart, Math.min(sil.end, dur));
    if (silStart - cursor >= 0.04) {
      islands.push({ start: cursor, end: silStart });
    }
    cursor = Math.max(cursor, silEnd);
  }

  if (dur - cursor >= 0.04) {
    islands.push({ start: cursor, end: dur });
  }

  return islands.length > 0 ? islands : [{ start: 0, end: dur }];
}

/**
 * Splits clean words into punctuation-delimited clauses when possible so internal audio
 * silences map naturally onto sentence/comma pauses.
 */
export function splitWordsIntoClauses(words = []) {
  if (!Array.isArray(words) || words.length === 0) return [];
  const clauses = [];
  let current = [];

  for (const w of words) {
    current.push(w);
    if (/[,.?!;:]$/.test(w)) {
      clauses.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    clauses.push(current);
  }
  return clauses;
}

function distributeWordsOverSpan(words, spanStart, spanEnd) {
  if (!words.length) return [];
  const safeStart = Math.max(0, Number(spanStart) || 0);
  const safeEnd = Math.max(safeStart + 0.04, Number(spanEnd) || safeStart + 0.04);
  const spanDur = safeEnd - safeStart;

  const weights = words.map(computeWordWeight);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0) || words.length;

  const result = [];
  let cursor = safeStart;
  for (let i = 0; i < words.length; i++) {
    const share = (weights[i] / totalWeight) * spanDur;
    const wordEnd = i === words.length - 1 ? safeEnd : cursor + share;
    result.push({
      w: words[i],
      s: Number(cursor.toFixed(4)),
      e: Number(wordEnd.toFixed(4))
    });
    cursor = wordEnd;
  }
  return result;
}

function allocateClausesToIslands(words, islands) {
  if (!words.length) return [];
  if (!islands.length) return distributeWordsOverSpan(words, 0, 1);
  if (islands.length === 1) {
    return distributeWordsOverSpan(words, islands[0].start, islands[0].end);
  }

  const clauses = splitWordsIntoClauses(words);
  // If clause count doesn't match internal pauses cleanly, flatten across outer bounds while skipping long pauses proportionally
  if (clauses.length === islands.length) {
    const out = [];
    for (let i = 0; i < clauses.length; i++) {
      out.push(...distributeWordsOverSpan(clauses[i], islands[i].start, islands[i].end));
    }
    return out;
  }

  if (clauses.length >= 2 && islands.length >= 2) {
    // Merge or group clauses greedily to match island durations by character weight
    const totalWordWeight = words.reduce((sum, w) => sum + computeWordWeight(w), 0) || 1;
    const totalSpeechDur = islands.reduce((sum, isl) => sum + (isl.end - isl.start), 0) || 1;

    const assigned = [];
    let clauseIdx = 0;

    for (let islIdx = 0; islIdx < islands.length; islIdx++) {
      const remainingIslands = islands.length - islIdx;
      const islandWeightShare = ((islands[islIdx].end - islands[islIdx].start) / totalSpeechDur) * totalWordWeight;
      const bucketWords = [];
      let bucketWeight = 0;

      if (islIdx === islands.length - 1) {
        while (clauseIdx < clauses.length) {
          bucketWords.push(...clauses[clauseIdx++]);
        }
      } else {
        while (clauseIdx < clauses.length && (clauses.length - clauseIdx) >= remainingIslands) {
          const nextClause = clauses[clauseIdx];
          const nextW = nextClause.reduce((s, w) => s + computeWordWeight(w), 0);
          if (bucketWords.length === 0 || bucketWeight + nextW * 0.55 <= islandWeightShare) {
            bucketWords.push(...nextClause);
            bucketWeight += nextW;
            clauseIdx++;
          } else {
            break;
          }
        }
      }

      if (bucketWords.length > 0) {
        assigned.push(...distributeWordsOverSpan(bucketWords, islands[islIdx].start, islands[islIdx].end));
      }
    }

    if (assigned.length === words.length) {
      return assigned;
    }
  }

  // Fallback across total active span [firstIsland.start .. lastIsland.end] weighted smoothly per island
  const totalSpeech = islands.reduce((s, isl) => s + (isl.end - isl.start), 0) || 1;
  const weights = words.map(computeWordWeight);
  const totalWeight = weights.reduce((s, w) => s + w, 0) || 1;

  // Map cumulative speech time to cumulative wall-clock time across speech islands
  const mapSpeechOffset = (speechTime) => {
    let rem = Math.max(0, Math.min(speechTime, totalSpeech));
    for (const isl of islands) {
      const len = isl.end - isl.start;
      if (rem <= len + 1e-6) {
        return isl.start + rem;
      }
      rem -= len;
    }
    return islands[islands.length - 1].end;
  };

  const out = [];
  let accWeight = 0;
  for (let i = 0; i < words.length; i++) {
    const wStartSpeech = (accWeight / totalWeight) * totalSpeech;
    accWeight += weights[i];
    const wEndSpeech = (accWeight / totalWeight) * totalSpeech;
    const s = mapSpeechOffset(wStartSpeech);
    const e = Math.max(s + 0.03, mapSpeechOffset(wEndSpeech));
    out.push({
      w: words[i],
      s: Number(s.toFixed(4)),
      e: Number(e.toFixed(4))
    });
  }
  return out;
}

function getDurationWithFfprobe(mediaPath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(mediaPath, (err, meta) => {
      if (err) return resolve(0);
      resolve(Number(meta?.format?.duration) || 0);
    });
  });
}

/**
 * Tier-3 runtime word alignment using ffmpeg silencedetect=noise=-35dB:d=0.08
 * and character-weight allocation (norm(w).length + 1.6), without requiring DB columns.
 */
export async function alignClipWordsTier3({ audioPath = '', text = '', duration = 0 } = {}) {
  const cleanText = sanitizeOverlayTextStrict(text);
  if (!cleanText) {
    return { words: [], source: 'tier3_empty', duration: Number(duration) || 0 };
  }

  const tokens = cleanText.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { words: [], source: 'tier3_empty', duration: Number(duration) || 0 };
  }

  let effectiveDuration = Number(duration) || 0;
  const hasAudio = Boolean(audioPath && fs.existsSync(audioPath));

  if (hasAudio && effectiveDuration <= 0) {
    effectiveDuration = await getDurationWithFfprobe(audioPath);
  }
  if (effectiveDuration <= 0) {
    effectiveDuration = Math.max(tokens.length * 0.35, 1.5);
  }

  let silences = [];
  if (hasAudio) {
    try {
      const { stderr } = await execFileAsync(resolveFfmpegBin(), [
        '-hide_banner',
        '-i', audioPath,
        '-af', 'silencedetect=noise=-35dB:d=0.08',
        '-f', 'null', '-'
      ], { maxBuffer: 1024 * 1024 * 4 });
      silences = parseSilenceDetectStderr(stderr, effectiveDuration);
    } catch (err) {
      // execFile may exit non-zero only on malformed streams; stderr still captured if available
      if (err?.stderr) {
        silences = parseSilenceDetectStderr(err.stderr, effectiveDuration);
      }
    }
  }

  const islands = buildSpeechIslands(silences, effectiveDuration);
  const words = allocateClausesToIslands(tokens, islands);

  return {
    words,
    source: hasAudio ? 'silencedetect_tier3' : 'weight_fallback',
    silences,
    islands,
    duration: effectiveDuration
  };
}

/**
 * Maps clip-relative word timings onto the concatenated/xfaded global video timeline.
 */
export function buildGlobalTimelineWords({ clips = [], xfadeOverlapSec = 0 } = {}) {
  const overlap = Math.max(0, Number(xfadeOverlapSec) || 0);
  const wordEvents = [];
  const clipOffsets = [];
  let cursor = 0;

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i] || {};
    const segDur = Math.max(0, Number(clip.duration) || 0);
    const clipStart = Math.max(0, cursor - (i > 0 ? overlap : 0));
    clipOffsets.push({ clipIndex: i, start: clipStart, duration: segDur });

    const words = Array.isArray(clip.words) ? clip.words : [];
    for (const word of words) {
      const wText = sanitizeOverlayTextStrict(word.w || '');
      if (!wText) continue;
      const relS = Math.max(0, Number(word.s) || 0);
      const relE = Math.max(relS + 0.03, Number(word.e) || relS + 0.03);
      // Cap word end inside segment boundary so subtitles do not linger into next clip
      const clampedRelE = segDur > 0 ? Math.min(relE, segDur) : relE;
      wordEvents.push({
        w: wText,
        s: Number((clipStart + Math.min(relS, clampedRelE)).toFixed(4)),
        e: Number((clipStart + clampedRelE).toFixed(4)),
        c: i
      });
    }

    cursor = clipStart + segDur;
  }

  return {
    wordEvents,
    clipOffsets,
    totalDuration: cursor
  };
}

