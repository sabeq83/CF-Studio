/**
 * 3x Upscale Post-Concat Camera Motion Engine (`zoompan` + opening shake + punch-in + cut flashes).
 * Follows `plans/finishing-pass-reference/compose.py`.
 */

/**
 * Builds deterministic FFmpeg `zoompan` `z` and `shake` expressions mapped over global clip & punch intervals.
 */
export function buildCameraZoomExpressions({
  clipOffsets = [],
  punchTimestamps = [],
  totalDuration = 0
} = {}) {
  const clips = Array.isArray(clipOffsets) ? clipOffsets : [];
  const boundaries = clips.map((c) => Number(c.start || 0));
  const dur = Math.max(
    Number(totalDuration) || 0,
    clips.reduce((m, c) => Math.max(m, Number(c.start || 0) + Number(c.duration || 0)), 0),
    0.5
  );
  if (boundaries.length === 0) {
    boundaries.push(0, dur);
  } else if (boundaries[boundaries.length - 1] < dur - 0.05) {
    boundaries.push(Number(dur.toFixed(3)));
  }

  const terms = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const a = Number(boundaries[i].toFixed(3));
    const b = Number(Math.max(a + 0.1, boundaries[i + 1]).toFixed(3));
    const span = Number((b - a).toFixed(3));
    terms.push(`between(it,${a},${b}-0.0001)*0.045*(it-${a})/${span}`);
  }

  for (const rawP of (Array.isArray(punchTimestamps) ? punchTimestamps : [])) {
    const p = Number(rawP);
    if (!Number.isFinite(p) || p < 0 || p >= dur) continue;
    const ps = p.toFixed(3);
    terms.push(`between(it-${ps},0,0.12)*0.07*(1-pow(1-(it-${ps})/0.12,3))`);
    terms.push(`gt(it-${ps},0.12)*lt(it-${ps},0.9)*0.07*exp(-(it-${ps}-0.12)*3.2)`);
  }

  const zoomExpr = terms.length > 0 ? `1+${terms.join('+')}` : '1.02';
  const shakeExpr = 'if(lt(it,0.35),-0.006*ih/zoom*sin(70*it),0)';

  return {
    zoomExpr,
    shakeExpr,
    cutTimestamps: boundaries.slice(1, -1).map((t) => Number(t.toFixed(3)))
  };
}

/**
 * Generates FFmpeg video filter chain with 3x Lanczos upscale -> zoompan -> target resolution `[outputLabel]`.
 */
export function buildCameraMotionFilterChain({
  inputLabel = '0:v',
  outputLabel = 'cam',
  width = 720,
  height = 1280,
  fps = 30,
  upscaleFactor = 3,
  clipOffsets = [],
  punchTimestamps = [],
  totalDuration = 0
} = {}) {
  const w = Math.max(120, Math.round(Number(width) || 720));
  const h = Math.max(120, Math.round(Number(height) || 1280));
  const scaleW = w * Math.max(1, Number(upscaleFactor) || 3);
  const scaleH = h * Math.max(1, Number(upscaleFactor) || 3);
  const targetFps = Math.max(15, Math.round(Number(fps) || 30));

  const { zoomExpr, shakeExpr, cutTimestamps } = buildCameraZoomExpressions({
    clipOffsets,
    punchTimestamps,
    totalDuration
  });

  const filter = `[${inputLabel}]fps=${targetFps},scale=${scaleW}:${scaleH}:flags=lanczos,zoompan=z='${zoomExpr}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*0.45+${shakeExpr}':d=1:s=${w}x${h}:fps=${targetFps},format=yuva420p[${outputLabel}]`;

  return {
    filter,
    outputLabel: `[${outputLabel}]`,
    cutTimestamps
  };
}

