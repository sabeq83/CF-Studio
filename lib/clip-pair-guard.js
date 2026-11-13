import path from 'path';

const CLIP_EXT_RE = /(\d+)\.(?:mp3|mp4|wav|mov|m4a|mkv|aac|webm)$/i;

/**
 * Sorts TTS clip records numerically by clip_index (defensive against stringified indexes).
 */
export function sortClipsByClipIndex(clips = []) {
  if (!Array.isArray(clips)) return [];
  return [...clips].sort((a, b) => {
    const ai = Number(a?.clip_index);
    const bi = Number(b?.clip_index);
    const aValid = Number.isFinite(ai);
    const bValid = Number.isFinite(bi);
    if (aValid && bValid) return ai - bi;
    if (aValid) return -1;
    if (bValid) return 1;
    return 0;
  });
}

/**
 * Extracts trailing clip number right before media extension (never matching .mp3/.mp4 extension digits).
 */
export function parseClipNumberFromPath(filePath = '') {
  if (!filePath || typeof filePath !== 'string') return null;
  const clean = filePath.split('?')[0].split('#')[0].trim();
  if (!clean) return null;
  const base = path.basename(clean);
  const m = base.match(CLIP_EXT_RE);
  if (!m) return null;
  const parsed = Number.parseInt(m[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Validates clip count, filename clip numbers vs clip_index, VO script presence, and optional duration tolerance.
 * Returns { ok, reason, mismatches, videoOffset, audioOffset } without throwing.
 */
export function verifyClipPairIntegrity({
  videoPaths = [],
  completedClips = [],
  voiceoverTexts = null,
  probedAudioDurations = null,
  durationToleranceSec = 0.3
} = {}) {
  const videos = Array.isArray(videoPaths) ? videoPaths : [];
  const clips = Array.isArray(completedClips) ? completedClips : [];
  const mismatches = [];

  if (videos.length !== clips.length) {
    mismatches.push({
      type: 'count_mismatch',
      detail: `videoCount=${videos.length}, ttsCount=${clips.length}`
    });
  }

  if (Array.isArray(voiceoverTexts) && voiceoverTexts.length !== clips.length) {
    mismatches.push({
      type: 'vo_text_count_mismatch',
      detail: `voTexts=${voiceoverTexts.length}, ttsCount=${clips.length}`
    });
  }

  const pairCount = Math.min(videos.length, clips.length);
  const videoOffsets = new Set();
  const audioOffsets = new Set();

  for (let i = 0; i < pairCount; i++) {
    const clip = clips[i] || {};
    const expectedIdx = Number.isFinite(Number(clip.clip_index)) ? Number(clip.clip_index) : i;
    const vPath = videos[i] || '';
    const aPath = clip.audio_path || '';

    const vNum = parseClipNumberFromPath(vPath);
    if (vNum !== null) {
      const offset = vNum - expectedIdx;
      videoOffsets.add(offset);
      if (offset !== 0 && offset !== 1) {
        mismatches.push({
          type: 'video_clip_number_mismatch',
          pairIndex: i,
          expectedClipIndex: expectedIdx,
          parsedNumber: vNum,
          file: path.basename(String(vPath)),
          detail: `pair[${i}] clip_index=${expectedIdx} vs video=${path.basename(String(vPath))} (${vNum})`
        });
      }
    }

    const aNum = parseClipNumberFromPath(aPath);
    if (aNum !== null) {
      const offset = aNum - expectedIdx;
      audioOffsets.add(offset);
      if (offset !== 0 && offset !== 1) {
        mismatches.push({
          type: 'audio_clip_number_mismatch',
          pairIndex: i,
          expectedClipIndex: expectedIdx,
          parsedNumber: aNum,
          file: path.basename(String(aPath)),
          detail: `pair[${i}] clip_index=${expectedIdx} vs audio=${path.basename(String(aPath))} (${aNum})`
        });
      }
    }

    if (clip.source_text === undefined || clip.source_text === null) {
      mismatches.push({
        type: 'vo_text_missing',
        pairIndex: i,
        expectedClipIndex: expectedIdx,
        detail: `pair[${i}] clip_index=${expectedIdx} missing source_text`
      });
    }

    if (Array.isArray(voiceoverTexts) && voiceoverTexts[i] !== undefined) {
      const a = String(clip.source_text || '').trim();
      const b = String(voiceoverTexts[i] || '').trim();
      if (a && b && a !== b) {
        mismatches.push({
          type: 'vo_text_mismatch',
          pairIndex: i,
          expectedClipIndex: expectedIdx,
          detail: `pair[${i}] clip_index=${expectedIdx} VO script diverges from provided voiceoverTexts`
        });
      }
    }

    const recordedDurRaw = clip.duration ?? clip.duration_sec ?? clip.audio_duration;
    const recordedDur = Number(recordedDurRaw);
    const probedDur = Array.isArray(probedAudioDurations) ? Number(probedAudioDurations[i]) : NaN;
    if (Number.isFinite(recordedDur) && recordedDur > 0 && Number.isFinite(probedDur) && probedDur > 0) {
      const diff = Math.abs(probedDur - recordedDur);
      if (diff > durationToleranceSec) {
        mismatches.push({
          type: 'audio_duration_mismatch',
          pairIndex: i,
          expectedClipIndex: expectedIdx,
          recordedDuration: recordedDur,
          probedDuration: probedDur,
          diffSec: Number(diff.toFixed(3)),
          detail: `pair[${i}] clip_index=${expectedIdx} recorded=${recordedDur.toFixed(2)}s vs probed=${probedDur.toFixed(2)}s (diff=${diff.toFixed(2)}s > ${durationToleranceSec}s)`
        });
      }
    }
  }

  if (videoOffsets.size > 1) {
    mismatches.push({
      type: 'inconsistent_video_numbering',
      detail: `video offsets mixed: [${Array.from(videoOffsets).join(', ')}]`
    });
  }
  if (audioOffsets.size > 1) {
    mismatches.push({
      type: 'inconsistent_audio_numbering',
      detail: `audio offsets mixed: [${Array.from(audioOffsets).join(', ')}]`
    });
  }

  const reason = mismatches.map((m) => m.detail).join(' | ');
  return {
    ok: mismatches.length === 0,
    reason,
    mismatches,
    videoOffset: videoOffsets.size === 1 ? Array.from(videoOffsets)[0] : null,
    audioOffset: audioOffsets.size === 1 ? Array.from(audioOffsets)[0] : null
  };
}

