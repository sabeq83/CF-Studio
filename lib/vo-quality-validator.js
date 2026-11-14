import { findVoClaimViolations } from './tiktok-compliance-service.js';
import {
  BANNED_AI_PHRASES_EN,
  getTransitionMarkersForLanguage,
  getVagueWordsForLanguage,
  parseWordsPerClipRange,
  resolveVoLanguage
} from './vo-content-payload.js';
import { validateFinishingOverlayAgainstVo } from './finishing-plan-validator.js';

const NUM_ANCHOR_RE = /\d|\b(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|seratus|puluh|ratus|setengah|separuh|semalaman|sendok|sdm|sdt|siung|gelas|gram|gr|ml|liter|menit|jam|detik|derajat|persen|meter|cm|mm|roll|one|two|three|four|five|six|seven|eight|nine|ten|half|overnight|spoon|tablespoon|teaspoon|tbsp|tsp|cup|cups|gram|grams|minute|minutes|hour|hours|second|seconds|degree|degrees|percent|inch|inches|day|days|week|weeks)\b/i;

const SPEC_ANCHOR_RE = /\b(pertama|kedua|ketiga|celah|pintu|jendela|ventilasi|kusen|door sweep|weatherstrip|lapisan|ketebalan|luas|ukur|suhu ruang|sinar matahari|catat|jadwal|radius|kain tebal|kriteria|kesalahan|sebelum|sesudah|langkah|hindari|periksa|cek|simpan|aduk|rebus|rendam|diamkan|saring|takaran|kental|first|second|third|gap|door|window|frame|seal|layer|thickness|measure|temperature|sunlight|check|schedule|avoid|mistake|step|before|after|wipe|store|stir|simmer|steep|overnight|creamy)\b/i;

const GENERIC_CLOSING_CLICHES_RE = [
  /yuk\s+coba\s+sekarang/i,
  /tunggu\s+apa\s+lagi/i,
  /jangan\s+sampai\s+kehabisan/i,
  /don['’]?t\s+walk[,\s]+run/i,
  /run[,\s]+don['’]?t\s+walk/i,
  /you\s+need\s+this\s+in\s+your\s+life/i
];

export function extractClipVoText(clip) {
  if (typeof clip === 'string') return clip.trim();
  if (!clip || typeof clip !== 'object') return '';
  return String(
    clip.new_vo ??
    clip.narration_transcript ??
    clip.voice_over ??
    clip.narration ??
    clip.voiceover ??
    clip.text ??
    ''
  ).trim();
}

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function getFirstWordToken(text) {
  const m = String(text || '').trim().toLowerCase().match(/^[a-z0-9\u00c0-\u024f']+/i);
  return m ? m[0] : '';
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractTakeawayTokens(anchorText = '') {
  return String(anchorText || '')
    .toLowerCase()
    .split(/[^a-z0-9\u00c0-\u024f]+/)
    .filter(tok => tok && (tok.length >= 4 || /^\d+$/.test(tok)));
}

/**
 * Evaluates VO narration quality & contract compliance (V4).
 */
export function validateVoQuality({
  clips = [],
  contentPayload = null,
  sourceRecipeLock = null,
  isKeywordMode = false,
  isHerbalOrHealth = false,
  targetLanguage = 'id-ID',
  wordsPerClip = '17-19 kata',
  clipDuration = 8,
  mandatoryHook = '',
  mandatoryOutroLine = '',
  finishingPlan = null,
  expectedClipsCount = null
} = {}) {
  const voLines = (Array.isArray(clips) ? clips : []).map(extractClipVoText);
  const lang = resolveVoLanguage(targetLanguage);
  const fullVoLower = voLines.join(' ').toLowerCase();
  const vagueWords = getVagueWordsForLanguage(targetLanguage);
  const transitionMarkers = getTransitionMarkersForLanguage(targetLanguage);
  const wpc = parseWordsPerClipRange(wordsPerClip, clipDuration);

  const reasons = [];

  // 1. Anchored middle clips (>= 60%)
  const middleClips = voLines.length >= 3 ? voLines.slice(1, -1) : voLines;
  const anchorTokensFromPayload = Array.isArray(contentPayload?.takeaways)
    ? contentPayload.takeaways.flatMap(t => extractTakeawayTokens(t?.anchor))
    : [];
  let anchoredMiddleCount = 0;
  for (const clipText of middleClips) {
    const low = clipText.toLowerCase();
    const hasRegexAnchor = NUM_ANCHOR_RE.test(low) || SPEC_ANCHOR_RE.test(low);
    const hasPayloadToken = anchorTokensFromPayload.some(tok => low.includes(tok));
    if (hasRegexAnchor || hasPayloadToken) anchoredMiddleCount += 1;
  }
  const anchorRatio = middleClips.length > 0 ? anchoredMiddleCount / middleClips.length : 1;
  if (middleClips.length > 0 && anchorRatio < 0.6) {
    reasons.push(`Klip isi berpegangan konkret hanya ${anchoredMiddleCount}/${middleClips.length} (${Math.round(anchorRatio * 100)}%, minimal 60%).`);
  }

  // 2. Takeaway anchor recall (>= 80%)
  const takeaways = Array.isArray(contentPayload?.takeaways) ? contentPayload.takeaways : [];
  let matchedTakeaways = 0;
  if (takeaways.length > 0) {
    for (const tk of takeaways) {
      const tokens = extractTakeawayTokens(tk?.anchor || tk?.point || '');
      if (tokens.length === 0) {
        matchedTakeaways += 1;
        continue;
      }
      const hits = tokens.filter(t => fullVoLower.includes(t)).length;
      if (hits >= Math.max(1, Math.ceil(tokens.length * 0.4))) {
        matchedTakeaways += 1;
      }
    }
  }
  const anchorRecallRatio = takeaways.length > 0 ? matchedTakeaways / takeaways.length : 1;
  if (takeaways.length > 0 && anchorRecallRatio < 0.8) {
    reasons.push(`Anchor takeaways hanya muncul ${matchedTakeaways}/${takeaways.length} (${Math.round(anchorRecallRatio * 100)}%, minimal 80%).`);
  }

  // 3. Vague words without anchor in the same sentence (<= 2)
  let vagueWithoutAnchorCount = 0;
  const sentences = fullVoLower.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  for (const sent of sentences) {
    const sentHasAnchor = NUM_ANCHOR_RE.test(sent) || SPEC_ANCHOR_RE.test(sent);
    if (sentHasAnchor) continue;
    for (const vw of vagueWords) {
      const m = sent.match(new RegExp(`\\b${escapeRegExp(vw)}\\b`, 'gi'));
      if (m) vagueWithoutAnchorCount += m.length;
    }
  }
  if (vagueWithoutAnchorCount > 2) {
    reasons.push(`Ditemukan ${vagueWithoutAnchorCount} kata samar tanpa pegangan konkret (maksimal 2).`);
  }

  // 4. Transition markers <= 1 & no consecutive same opener word
  let transitionMarkerCount = 0;
  for (const marker of transitionMarkers) {
    const m = fullVoLower.match(new RegExp(`\\b${escapeRegExp(marker.toLowerCase())}\\b`, 'gi'));
    if (m) transitionMarkerCount += m.length;
  }
  if (transitionMarkerCount > 1) {
    reasons.push(`Partikel transisi klise muncul ${transitionMarkerCount}x (maksimal 1x di seluruh naskah).`);
  }

  let consecutiveRepeatOpener = 0;
  for (let i = 1; i < voLines.length; i++) {
    const prevWord = getFirstWordToken(voLines[i - 1]);
    const currWord = getFirstWordToken(voLines[i]);
    if (prevWord && currWord && prevWord === currWord) {
      consecutiveRepeatOpener += 1;
    }
  }
  if (consecutiveRepeatOpener > 0) {
    reasons.push(`Ada ${consecutiveRepeatOpener} pasangan klip berurutan yang diawali kata yang sama.`);
  }

  // 5. Keyword editorial: search_answer must appear in clip 2
  let keywordAnswerGrounded = true;
  if (isKeywordMode && contentPayload?.search_answer && voLines.length >= 2) {
    const clip2Low = voLines[1].toLowerCase();
    const ansTokens = extractTakeawayTokens(contentPayload.search_answer);
    if (ansTokens.length > 0) {
      const ansHits = ansTokens.filter(t => clip2Low.includes(t)).length;
      if (ansHits === 0) {
        keywordAnswerGrounded = false;
        reasons.push('Klip 2 belum memuat jawaban langsung (search_answer) untuk keyword editorial.');
      }
    }
  }

  // 6. Multiplier source_recipe_lock ingredients 100% present
  const missingIngredients = [];
  const lockedIngredients = Array.isArray(sourceRecipeLock?.ingredients) ? sourceRecipeLock.ingredients : [];
  for (const ing of lockedIngredients) {
    const rawName = String(typeof ing === 'string' ? ing : ing?.name || '').trim().toLowerCase();
    if (!rawName) continue;
    const ingTokens = rawName.split(/\s+/).filter(t => t.length >= 3);
    const matched = fullVoLower.includes(rawName) || (ingTokens.length > 0 && ingTokens.some(t => fullVoLower.includes(t)));
    if (!matched) {
      missingIngredients.push(typeof ing === 'string' ? ing : ing.name);
    }
  }
  if (missingIngredients.length > 0) {
    reasons.push(`Bahan inti source_recipe_lock hilang dari VO: ${missingIngredients.join(', ')}.`);
  }

  // 7. Claims (herbal or Multiplier) & EN AI hype phrases & Finishing overlay cross-check
  const shouldCheckClaims = Boolean(isHerbalOrHealth || sourceRecipeLock || lockedIngredients.length > 0);
  const claimHits = shouldCheckClaims ? findVoClaimViolations(voLines.join(' ')) : [];
  if (claimHits.length > 0) {
    reasons.push(`Klaim terlarang terdeteksi pada VO: ${claimHits.join(', ')}.`);
  }

  const enHypeHits = [];
  if (lang === 'en') {
    for (const phrase of BANNED_AI_PHRASES_EN) {
      if (fullVoLower.includes(phrase.toLowerCase())) {
        enHypeHits.push(phrase);
      }
    }
    if (enHypeHits.length > 0) {
      reasons.push(`Frasa AI klise terdeteksi pada VO EN: ${enHypeHits.join(', ')}.`);
    }
  }

  const finishingCrossCheck = finishingPlan
    ? validateFinishingOverlayAgainstVo({
        finishingPlan,
        voLines,
        sourceAmounts: lockedIngredients.map(i => (typeof i === 'object' ? `${i.name || ''} ${i.amount || ''}` : i)),
        isHerbal: shouldCheckClaims
      })
    : { valid: true, claimHits: [], ungroundedNumbers: [] };
  if (!finishingCrossCheck.valid) {
    reasons.push(`Klaim terlarang di teks overlay finishing_plan: ${finishingCrossCheck.claimHits.join(', ')}.`);
  }

  // 8. Word budget per clip, clip count & generic closing template
  const wordCounts = voLines.map(countWords);
  const maxWordsPerClip = wordCounts.length > 0 ? Math.max(...wordCounts) : 0;
  // Allow +2 spoken flexibility over range ceiling except strict empty checks
  const wordLimitCeil = wpc.max + 2;
  const overWordClips = wordCounts
    .map((wc, idx) => ({ clip: idx + 1, wc }))
    .filter(x => x.wc > wordLimitCeil);
  if (overWordClips.length > 0) {
    reasons.push(`Kelebihan kata di klip ${overWordClips.map(x => `${x.clip} (${x.wc} kata > batas ${wpc.max})`).join(', ')}.`);
  }

  if (expectedClipsCount && voLines.length !== Number(expectedClipsCount)) {
    reasons.push(`Jumlah klip VO (${voLines.length}) tidak sama dengan target (${expectedClipsCount}).`);
  }

  const lastClip = voLines[voLines.length - 1] || '';
  const hasGenericClosing = !mandatoryOutroLine && GENERIC_CLOSING_CLICHES_RE.some(re => re.test(lastClip));
  if (hasGenericClosing) {
    reasons.push('Penutup menggunakan template CTA generik (mis. "yuk coba sekarang"); buat penutup spesifik sesuai isi.');
  }

  if (mandatoryHook && voLines[0]) {
    const cleanExpected = mandatoryHook.trim().toLowerCase().replace(/[^\w\s\u00c0-\u024f]/g, '');
    const cleanActual = voLines[0].trim().toLowerCase().replace(/[^\w\s\u00c0-\u024f]/g, '');
    if (cleanExpected && cleanActual && !cleanActual.includes(cleanExpected)) {
      reasons.push('Klip 1 tidak mempertahankan hook yang sudah dikunci.');
    }
  }

  // Weighted deterministic quality score (0..100)
  let score = 100;
  if (middleClips.length > 0 && anchorRatio < 0.6) score -= 25;
  if (takeaways.length > 0 && anchorRecallRatio < 0.8) score -= 20;
  if (vagueWithoutAnchorCount > 2) score -= Math.min(20, (vagueWithoutAnchorCount - 2) * 5);
  if (transitionMarkerCount > 1) score -= 10;
  if (consecutiveRepeatOpener > 0) score -= 10;
  if (!keywordAnswerGrounded) score -= 15;
  if (missingIngredients.length > 0) score -= 25;
  if (claimHits.length > 0 || !finishingCrossCheck.valid) score -= 35;
  if (enHypeHits.length > 0) score -= 10;
  if (overWordClips.length > 0) score -= Math.min(15, overWordClips.length * 5);
  if (expectedClipsCount && voLines.length !== Number(expectedClipsCount)) score -= 20;
  if (hasGenericClosing) score -= 10;
  score = Math.max(0, Math.min(100, score));

  const passed = reasons.length === 0;
  return {
    passed,
    status: passed ? 'pass' : 'fail',
    score,
    clip_count: voLines.length,
    reasons,
    metrics: {
      anchored_middle_clips: anchoredMiddleCount,
      middle_clips_total: middleClips.length,
      anchor_ratio: Number(anchorRatio.toFixed(2)),
      matched_takeaways: matchedTakeaways,
      takeaways_total: takeaways.length,
      anchor_recall_ratio: Number(anchorRecallRatio.toFixed(2)),
      vague_without_anchor: vagueWithoutAnchorCount,
      transition_markers: transitionMarkerCount,
      consecutive_repeat_opener: consecutiveRepeatOpener,
      keyword_answer_grounded: keywordAnswerGrounded,
      missing_ingredients: missingIngredients,
      claim_hits: claimHits,
      en_hype_hits: enHypeHits,
      max_words_per_clip: maxWordsPerClip,
      word_limit_target: wpc.label,
      word_counts: wordCounts
    }
  };
}

/**
 * 1-call targeted Gemini rewrite using exact validator failure reasons.
 */
export async function rewriteVoWithQualityFeedback({
  generateFn,
  voLines = [],
  validation = {},
  targetLanguage = 'id-ID',
  wordsPerClip = '17-19 kata',
  contentPayload = null,
  sourceRecipeLock = null,
  mandatoryHook = ''
} = {}) {
  if (typeof generateFn !== 'function' || !Array.isArray(voLines) || voLines.length === 0) {
    return { applied: false, voLines };
  }

  const lang = resolveVoLanguage(targetLanguage);
  const contractParts = [];
  if (contentPayload?.search_answer) {
    contractParts.push(`search_answer (Klip 2): "${contentPayload.search_answer}"`);
  }
  if (Array.isArray(contentPayload?.takeaways) && contentPayload.takeaways.length > 0) {
    contractParts.push('Takeaways wajib dipertahankan pegangannya:\n' + contentPayload.takeaways.map((t, i) => `${i + 1}. ${t.point} — pegangan: ${t.anchor}`).join('\n'));
  }
  if (Array.isArray(sourceRecipeLock?.ingredients) && sourceRecipeLock.ingredients.length > 0) {
    contractParts.push('Bahan wajib disebut persis: ' + sourceRecipeLock.ingredients.map(i => `${i.name}${i.amount ? ` (${i.amount})` : ''}`).join(', '));
  }

  const prompt = lang === 'en'
    ? `Revise ONLY these ${voLines.length} voiceover lines to fix ALL quality issues below while keeping the exact clip count (${voLines.length}) and max ${wordsPerClip} per clip.
Issues to fix:
${(validation.reasons || []).map(r => `- ${r}`).join('\n')}
${mandatoryHook ? `MANDATORY: Keep Clip 1 verbatim: "${mandatoryHook}"` : ''}
${contractParts.join('\n')}
Current clips:
${JSON.stringify(voLines.map((text, idx) => ({ clip: idx + 1, vo: text })))}
Return ONLY a JSON array of ${voLines.length} objects: [{"clip":1,"vo":"..."}]`
    : `Perbaiki HANYA ${voLines.length} kalimat voiceover berikut agar lolos semua pemeriksaan kualitas, dengan jumlah klip TEPAT ${voLines.length} dan batas ${wordsPerClip} per klip.
Alasan gagal yang WAJIB diperbaiki:
${(validation.reasons || []).map(r => `- ${r}`).join('\n')}
${mandatoryHook ? `WAJIB: Jangan ubah Klip 1, pertahankan persis: "${mandatoryHook}"` : ''}
${contractParts.join('\n')}
Naskah saat ini:
${JSON.stringify(voLines.map((text, idx) => ({ clip: idx + 1, vo: text })))}
Return ONLY JSON array persis ${voLines.length} objek: [{"clip":1,"vo":"..."}]`;

  try {
    const raw = await generateFn(prompt);
    let parsed = raw;
    if (typeof raw === 'string') {
      const cleaned = raw.replace(/```json\s*|```/gi, '').trim();
      parsed = JSON.parse(cleaned);
    }
    const arr = Array.isArray(parsed) ? parsed : (parsed?.clips || parsed?.voiceover || []);
    if (!Array.isArray(arr) || arr.length !== voLines.length) {
      return { applied: false, voLines };
    }
    const revised = arr.map((entry, idx) => {
      if (idx === 0 && mandatoryHook) return mandatoryHook;
      return extractClipVoText(entry) || voLines[idx];
    });
    return { applied: true, voLines: revised };
  } catch (_) {
    return { applied: false, voLines };
  }
}

/**
 * Evaluates VO against active gateMode ('off' | 'warn' | 'enforce') and executes 1x rewrite in enforce mode.
 */
export async function evaluateAndGateVoQuality({
  clips = [],
  gateMode = 'off',
  rewriteFn = null,
  ...validatorOptions
} = {}) {
  const mode = ['off', 'warn', 'enforce'].includes(gateMode) ? gateMode : 'off';
  const initialLines = (Array.isArray(clips) ? clips : []).map(extractClipVoText);
  if (mode === 'off') {
    return {
      skipped: true,
      passed: true,
      blocked: false,
      rewritten: false,
      status: 'skipped',
      gateAction: 'none',
      voLines: initialLines,
      scoreJson: null
    };
  }

  const firstCheck = validateVoQuality({ clips: initialLines, ...validatorOptions });
  if (firstCheck.passed) {
    return {
      skipped: false,
      passed: true,
      blocked: false,
      rewritten: false,
      status: 'pass',
      gateAction: 'pass',
      voLines: initialLines,
      scoreJson: firstCheck
    };
  }

  if (mode === 'warn') {
    return {
      skipped: false,
      passed: false,
      blocked: false,
      rewritten: false,
      status: 'warn',
      gateAction: 'warn',
      voLines: initialLines,
      scoreJson: firstCheck
    };
  }

  // enforce mode: try at most 1x targeted rewrite
  let workingLines = initialLines;
  let rewritten = false;
  if (typeof rewriteFn === 'function') {
    const rw = await rewriteFn(firstCheck, initialLines);
    if (rw?.applied && Array.isArray(rw.voLines) && rw.voLines.length === initialLines.length) {
      workingLines = rw.voLines;
      rewritten = true;
    }
  }

  const finalCheck = rewritten
    ? validateVoQuality({ clips: workingLines, ...validatorOptions })
    : firstCheck;

  if (finalCheck.passed) {
    return {
      skipped: false,
      passed: true,
      blocked: false,
      rewritten,
      status: 'pass_after_rewrite',
      gateAction: 'rewritten',
      voLines: workingLines,
      scoreJson: finalCheck
    };
  }

  return {
    skipped: false,
    passed: false,
    blocked: true,
    rewritten,
    status: 'blocked',
    gateAction: 'block_waiting_approval',
    voLines: workingLines,
    scoreJson: finalCheck
  };
}

function safeParseJsonObj(val) {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch (_) {
    return null;
  }
}

export function aggregateVoQualityRows(rows = []) {
  const summary = {
    total_audited: 0,
    pass_count: 0,
    warn_count: 0,
    blocked_count: 0,
    pass_rate: 0,
    avg_score: 0,
    avg_anchor_ratio: 0,
    total_claim_hits: 0,
    top_failure_reasons: []
  };

  const brandMap = new Map();
  const reasonCount = new Map();
  let scoreSum = 0;
  let scoreCount = 0;
  let anchorSum = 0;
  let anchorCount = 0;

  for (const row of rows) {
    const scoreObj = safeParseJsonObj(row.vo_quality_score_json);
    const status = String(row.vo_quality_status || scoreObj?.status || '').toLowerCase();
    if (!scoreObj && (!status || status === 'skipped')) continue;

    const brand = String(row.brand_name || row.account_name || 'Unassigned').trim() || 'Unassigned';
    if (!brandMap.has(brand)) {
      brandMap.set(brand, {
        brand,
        total: 0,
        pass: 0,
        warn: 0,
        blocked: 0,
        pass_rate: 0,
        avg_score: 0,
        avg_anchor_ratio: 0,
        avg_vague_without_anchor: 0,
        claim_hits: 0,
        _scoreSum: 0,
        _scoreCnt: 0,
        _anchorSum: 0,
        _anchorCnt: 0,
        _vagueSum: 0
      });
    }
    const b = brandMap.get(brand);

    summary.total_audited += 1;
    b.total += 1;

    const isPass = status === 'pass' || status === 'pass_after_rewrite' || scoreObj?.passed === true;
    const isBlocked = status === 'blocked';
    if (isPass) {
      summary.pass_count += 1;
      b.pass += 1;
    } else if (isBlocked) {
      summary.blocked_count += 1;
      b.blocked += 1;
    } else {
      summary.warn_count += 1;
      b.warn += 1;
    }

    if (typeof scoreObj?.score === 'number') {
      scoreSum += scoreObj.score;
      scoreCount += 1;
      b._scoreSum += scoreObj.score;
      b._scoreCnt += 1;
    }

    const ar = scoreObj?.metrics?.anchor_ratio;
    if (typeof ar === 'number') {
      anchorSum += ar;
      anchorCount += 1;
      b._anchorSum += ar;
      b._anchorCnt += 1;
    }

    const vague = Number(scoreObj?.metrics?.vague_without_anchor || 0);
    b._vagueSum += vague;

    const claims = Array.isArray(scoreObj?.metrics?.claim_hits) ? scoreObj.metrics.claim_hits.length : 0;
    summary.total_claim_hits += claims;
    b.claim_hits += claims;

    const reasons = Array.isArray(scoreObj?.reasons) ? scoreObj.reasons : [];
    for (const r of reasons) {
      const key = String(r || '').trim();
      if (!key) continue;
      reasonCount.set(key, (reasonCount.get(key) || 0) + 1);
    }
  }

  summary.pass_rate = summary.total_audited > 0
    ? Number(((summary.pass_count / summary.total_audited) * 100).toFixed(1))
    : 0;
  summary.avg_score = scoreCount > 0 ? Number((scoreSum / scoreCount).toFixed(1)) : 0;
  summary.avg_anchor_ratio = anchorCount > 0 ? Number((anchorSum / anchorCount).toFixed(2)) : 0;
  summary.top_failure_reasons = Array.from(reasonCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([reason, count]) => ({ reason, count }));

  const byBrand = {};
  for (const [brand, b] of brandMap.entries()) {
    byBrand[brand] = {
      brand,
      total: b.total,
      pass: b.pass,
      warn: b.warn,
      blocked: b.blocked,
      pass_rate: b.total > 0 ? Number(((b.pass / b.total) * 100).toFixed(1)) : 0,
      avg_score: b._scoreCnt > 0 ? Number((b._scoreSum / b._scoreCnt).toFixed(1)) : 0,
      avg_anchor_ratio: b._anchorCnt > 0 ? Number((b._anchorSum / b._anchorCnt).toFixed(2)) : 0,
      avg_vague_without_anchor: b.total > 0 ? Number((b._vagueSum / b.total).toFixed(2)) : 0,
      claim_hits: b.claim_hits
    };
  }

  return { summary, by_brand: byBrand };
}
