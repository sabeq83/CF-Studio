(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.FinishingSharedLayers = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SHARED_LAYERS_CSS = `
    .x { position: absolute; pointer-events: none; }
    .x-wm {
      left: 4.5cqw;
      top: 8.6cqh;
      display: inline-flex;
      align-items: center;
      gap: 1.4cqw;
      font-family: var(--f-sub);
      font-weight: 800;
      font-size: 2.7cqw;
      letter-spacing: 0.14em;
      color: rgba(255, 255, 255, 0.85);
      text-shadow: 0 0.3cqw 1cqw rgba(0, 0, 0, 0.65);
      text-transform: uppercase;
    }
    .x-wm i {
      display: inline-block;
      width: 2cqw;
      height: 2cqw;
      border-radius: 50%;
      background: var(--accent);
      flex-shrink: 0;
    }
    .x-wm img {
      height: 3.4cqw;
      width: auto;
      max-width: 14cqw;
      object-fit: contain;
      filter: drop-shadow(0 0.3cqw 0.8cqw rgba(0, 0, 0, 0.5));
    }
    .x-lower {
      left: 5cqw;
      top: 54.5cqh;
      display: flex;
      align-items: stretch;
      background: rgba(10, 14, 18, 0.86);
      border-radius: 1.6cqw;
      overflow: hidden;
      box-shadow: 0 1.4cqw 3cqw rgba(0, 0, 0, 0.4);
      max-width: 76cqw;
    }
    .x-lower i {
      width: 1.4cqw;
      background: var(--accent);
      flex-shrink: 0;
    }
    .x-lower div {
      padding: 1.4cqw 3.2cqw 1.6cqw 2.4cqw;
    }
    .x-lower b {
      display: block;
      font-family: var(--f-sub);
      font-weight: 900;
      font-size: 4.2cqw;
      color: #ffffff;
    }
    .x-lower span {
      display: block;
      font-family: var(--f-ui);
      font-size: 2.9cqw;
      color: #cfd6dc;
    }
    .x-patch {
      background: var(--brand, #16222c);
      border-radius: 3cqw;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      justify-content: center;
      gap: 1cqw;
      padding: 1.8cqw 3.6cqw;
      box-shadow: 0 1.4cqw 3cqw rgba(0, 0, 0, 0.38);
    }
    .x-patch .mk {
      width: 8.5cqw;
      height: 8.5cqw;
      border-radius: 2.2cqw;
      background: var(--accent);
      display: grid;
      place-items: center;
      font-family: var(--f-punch);
      font-size: 4.6cqw;
      color: #111111;
    }
    .x-patch img {
      max-height: 8.5cqw;
      max-width: 24cqw;
      object-fit: contain;
    }
    .x-patch b {
      font-family: var(--f-punch);
      font-size: 5.8cqw;
      line-height: 0.96;
      color: #ffffff;
      text-align: right;
      text-transform: uppercase;
    }
    .x-notice {
      left: 8cqw;
      right: 8cqw;
      top: 58cqh;
      text-align: center;
      font-family: var(--f-ui);
      font-size: 3cqw;
      font-weight: 600;
      color: #ffffff;
      background: rgba(10, 12, 14, 0.78);
      padding: 1.4cqw 3cqw;
      border-radius: 1.6cqw;
      line-height: 1.3;
    }
    .x-notice b { color: var(--accent); }
    .x-end {
      /* Sisakan 1px transparan via clip-path sambil menjaga bounding box 720x1280 agar Chromium tetap mengekspor PNG RGBA (bukan RGB24) dan FFmpeg image2 tidak memotong frame x-end. */
      inset: 0;
      clip-path: inset(0 0 1px 0);
      background: var(--brand, #16222c);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3cqw;
      text-align: center;
      padding: 0 8cqw;
    }
    .x-end .mk {
      width: 16cqw;
      height: 16cqw;
      border-radius: 4cqw;
      background: var(--accent);
      display: grid;
      place-items: center;
      font-family: var(--f-punch);
      font-size: 8.5cqw;
      color: #111111;
    }
    .x-end img {
      max-width: 42cqw;
      max-height: 18cqh;
      object-fit: contain;
    }
    .x-end b {
      font-family: var(--f-punch);
      font-size: 10.2cqw;
      line-height: 0.96;
      color: #ffffff;
      text-transform: uppercase;
    }
    .x-end span {
      font-family: var(--f-ui);
      font-size: 3.6cqw;
      color: rgba(255, 255, 255, 0.85);
    }
    .x-end .ct {
      font-family: var(--f-sub);
      font-weight: 900;
      font-size: 4.4cqw;
      background: var(--accent);
      color: #111111;
      padding: 1.8cqw 4.4cqw;
      border-radius: 99cqw;
      margin-top: 1.6cqw;
    }
    .sub-band {
      position: absolute;
      left: 0;
      right: 0;
      top: 56cqh;
      height: 28cqh;
      background: linear-gradient(
        to bottom,
        rgba(0, 0, 0, 0),
        rgba(0, 0, 0, 0.55) 45%,
        rgba(0, 0, 0, 0.55) 70%,
        rgba(0, 0, 0, 0)
      );
      pointer-events: none;
      z-index: 4;
    }
    .sub {
      position: absolute;
      left: var(--sub-left, 6cqw);
      right: var(--sub-right, 15cqw);
      top: var(--sub-top, 71cqh);
      transform: translateY(-50%);
      transform-origin: 50% 50%;
      display: flex;
      justify-content: center;
      align-items: baseline;
      flex-wrap: nowrap;
      text-align: center;
      white-space: nowrap;
      z-index: 5;
    }
    .sub.s-yellow {
      font-family: var(--f-sub);
      font-weight: 900;
      font-size: var(--sub-size, 7.6cqw);
      line-height: 1.05;
      text-transform: uppercase;
      color: #ffffff;
      -webkit-text-stroke: 0.75cqw #000000;
      paint-order: stroke fill;
      text-shadow: 0 0.9cqw 0 rgba(0, 0, 0, 0.55);
      gap: 2.2cqw;
    }
    .sub.s-yellow span {
      display: inline-block;
    }
    .sub.s-yellow span.on {
      color: var(--sub-accent-text, var(--accent, #ffd23f));
    }
    .sub.s-pill {
      gap: 0;
    }
    .sub.s-pill .pill {
      display: inline-flex;
      gap: 1.8cqw;
      align-items: baseline;
      background: #ffffff;
      color: #0d0e11;
      border-radius: 2.4cqw;
      padding: 1.4cqw 3.2cqw 1.6cqw;
      box-shadow: 0 1.2cqw 0 rgba(0, 0, 0, 0.45);
      font-family: var(--f-sub);
      font-weight: 900;
      font-size: var(--sub-size, 7cqw);
      line-height: 1.05;
      text-transform: uppercase;
    }
    .sub.s-pill .pill span {
      display: inline-block;
      padding: 0 1cqw;
      border-radius: 1.2cqw;
      margin: 0 -1cqw;
    }
    .sub.s-pill .pill span.on {
      background: var(--sub-accent-bg, var(--accent, #ffd23f));
      color: var(--pill-on-fg, #0d0e11);
    }
    .sub.s-minimal {
      font-family: var(--f-sub);
      font-weight: 800;
      font-size: var(--sub-size, 6.8cqw);
      line-height: 1.1;
      text-transform: none;
      color: #ffffff;
      text-shadow: 0 0.4cqw 1.6cqw rgba(0, 0, 0, 0.55);
      gap: 2cqw;
    }
    .sub.s-minimal span {
      display: inline-block;
      border-bottom: 0.9cqw solid transparent;
      padding-bottom: 0.3cqw;
    }
    .sub.s-minimal span.on {
      border-bottom-color: var(--sub-accent-text, var(--accent, #ffd23f));
    }
  `;

  const I18N_DICTIONARY = {
    id: {
      before: 'SEBELUM',
      after: 'SESUDAH',
      myth: 'MITOS',
      fact: 'FAKTA',
      why: 'KENAPA?',
      recap: 'RINGKASAN',
      tipLabel: 'TIP',
      stepLabel: 'LANGKAH',
      ingredientsHeader: 'BAHAN',
      chapterProblem: 'MASALAH',
      chapterCause: 'PENYEBAB',
      chapterSolution: 'SOLUSI',
      chapterResult: 'HASIL',
      vsLabel: 'VS',
      savePromptTitle: 'Simpan & Bagikan',
      defaultCta: 'CEK LINK DI BIO'
    },
    en: {
      before: 'BEFORE',
      after: 'AFTER',
      myth: 'MYTH',
      fact: 'FACT',
      why: 'WHY?',
      recap: 'RECAP',
      tipLabel: 'TIP',
      stepLabel: 'STEP',
      ingredientsHeader: 'INGREDIENTS',
      chapterProblem: 'PROBLEM',
      chapterCause: 'CAUSE',
      chapterSolution: 'SOLUTION',
      chapterResult: 'RESULT',
      vsLabel: 'VS',
      savePromptTitle: 'Save & Share',
      defaultCta: 'LINK IN BIO'
    }
  };

  function normalizeTargetLanguage(targetLanguage = 'id-ID') {
    const raw = String(targetLanguage || 'id-ID').trim().toLowerCase();
    if (raw.startsWith('en') || raw.includes('english')) return 'en';
    return 'id';
  }

  function getLocalizedLabels(targetLanguage = 'id-ID') {
    const lang = normalizeTargetLanguage(targetLanguage);
    return { lang, ...I18N_DICTIONARY[lang] };
  }

  function escHtml(str) {
    return String(str || '').replace(/[&<>"]/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;'
    }[c]));
  }

  const PATCH_ANCHORS = {
    top_right: { left: 53.5, top: 6.5, width: 44, height: 21 },
    top_left: { left: 2.5, top: 6.5, width: 44, height: 21 },
    bottom_left: { left: 2.5, top: 66, width: 44, height: 15 },
    bottom_right: { left: 40, top: 66, width: 44, height: 15 }
  };

  function resolveBrandPatchRect(patchSpec = {}) {
    const anchor = String(patchSpec?.anchor || 'top_right').trim().toLowerCase();
    const base = PATCH_ANCHORS[anchor] || PATCH_ANCHORS.top_right;
    const rect = patchSpec?.rect && typeof patchSpec.rect === 'object' ? patchSpec.rect : {};
    const clamp = (val, min, max, fallback) => {
      const n = Number(val);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    };
    return {
      left: clamp(rect.left, 0, 85, base.left),
      top: clamp(rect.top, 0, 85, base.top),
      width: clamp(rect.width, 15, 92, base.width),
      height: clamp(rect.height, 8, 40, base.height)
    };
  }

  function resolveBrandPatchesList(timeline = {}) {
    const list = [];
    if (Array.isArray(timeline?.brandPatches)) {
      list.push(...timeline.brandPatches);
    } else if (timeline?.brandPatch) {
      list.push(timeline.brandPatch);
    }
    const clipOffsets = Array.isArray(timeline?.clipOffsets) ? timeline.clipOffsets : [];
    const dur = Math.max(0.2, Number(timeline?.config?.duration) || 1);

    return list
      .filter((p) => p && typeof p === 'object')
      .map((p) => {
        let s = Number(p.s);
        let e = Number(p.e);
        if ((!Number.isFinite(s) || !Number.isFinite(e)) && Number.isFinite(Number(p.clipIndex))) {
          const ci = Number(p.clipIndex);
          const off = clipOffsets.find((c) => Number(c.clipIndex) === ci) || clipOffsets[ci];
          if (off) {
            s = Number(off.start) || 0;
            e = s + Math.max(0.4, Number(off.duration) || 1);
          }
        }
        if (!Number.isFinite(s)) s = 0;
        if (!Number.isFinite(e) || e <= s) e = Math.min(dur, s + 2.5);
        return {
          s,
          e,
          label: p.label ? String(p.label) : '',
          rect: resolveBrandPatchRect(p)
        };
      });
  }

  /**
   * Computes pure deterministic state of shared brand layers at timestamp `t`.
   */
  function resolveSharedLayerState(timeline = {}, t = 0) {
    const dur = Math.max(0.2, Number(timeline?.config?.duration) || 1);
    const time = Math.min(Math.max(0, Number(t) || 0), dur);
    const brand = timeline?.brand && typeof timeline.brand === 'object' ? timeline.brand : {};
    const brandName = String(brand.name || '').trim();
    const sharedCfg = timeline?.config?.sharedBrand || {};
    const enabled = Boolean(sharedCfg.enabled || timeline?.endCard || timeline?.lowerThird || resolveBrandPatchesList(timeline).length > 0);
    const labels = getLocalizedLabels(timeline?.config?.targetLanguage || brand.targetLanguage || 'id-ID');

    let endCard = null;
    if (enabled && (brandName || brand.logoUrl || timeline?.endCard)) {
      const cardDur = Math.min(2.0, Math.max(1.5, Number(timeline?.endCard?.duration ?? sharedCfg.endCardDuration ?? 1.75)));
      const endStart = Number.isFinite(Number(timeline?.endCard?.s))
        ? Math.max(0.5, Number(timeline.endCard.s))
        : Math.max(0.5, dur - cardDur);
      const endFinish = Number.isFinite(Number(timeline?.endCard?.e)) ? Number(timeline.endCard.e) : dur;
      if (time >= endStart && time <= endFinish) {
        const progress = Math.min(1, Math.max(0, (time - endStart) / 0.35));
        endCard = {
          active: true,
          s: endStart,
          e: endFinish,
          progress,
          name: brandName,
          mark: brand.mark || (brandName ? brandName.slice(0, 2).toUpperCase() : ''),
          logoUrl: brand.logoUrl || '',
          tagline: brand.tagline || '',
          cta: timeline?.endCard?.cta || brand.defaultCta || timeline?.cta?.text || labels.defaultCta
        };
      }
    }

    const watermark = enabled && !endCard && (brandName || brand.logoUrl) && sharedCfg.watermark !== false
      ? { active: true, name: brandName, logoUrl: brand.logoUrl || '' }
      : null;

    let lowerThird = null;
    const lt = timeline?.lowerThird;
    const pName = String(lt?.name || brand.presenterName || '').trim();
    const pRole = String(lt?.role || brand.presenterRole || '').trim();
    if (enabled && !endCard && pName) {
      const ltStart = Number.isFinite(Number(lt?.s)) ? Number(lt.s) : 0.4;
      const ltEnd = Number.isFinite(Number(lt?.e)) ? Number(lt.e) : Math.min(dur - 2.0, 4.2);
      if (time >= ltStart && time < ltEnd) {
        lowerThird = { active: true, s: ltStart, e: ltEnd, name: pName, role: pRole };
      }
    }

    const activePatches = !endCard
      ? resolveBrandPatchesList(timeline).filter((p) => time >= p.s && time < p.e)
      : [];

    let safetyNotice = null;
    const noticeObj = timeline?.safetyNotice;
    const noticeText = String(noticeObj?.text || (sharedCfg.safetyNotice ? brand.safetyNoticeText : '') || '').trim();
    if (enabled && !endCard && noticeText) {
      const nStart = Number.isFinite(Number(noticeObj?.s)) ? Number(noticeObj.s) : 0.4;
      const nEnd = Number.isFinite(Number(noticeObj?.e)) ? Number(noticeObj.e) : Math.max(nStart + 1.5, dur - 2.0);
      if (time >= nStart && time < nEnd) {
        safetyNotice = { active: true, s: nStart, e: nEnd, text: noticeText };
      }
    }

    return {
      enabled,
      labels,
      endCard,
      watermark,
      lowerThird,
      safetyNotice,
      activePatches
    };
  }

  function renderSharedLayersDom({ oBrandRoot, oPatchRoot, timeline, time }) {
    const state = resolveSharedLayerState(timeline, time);
    if (oPatchRoot) {
      if (state.activePatches.length === 0) {
        oPatchRoot.hidden = true;
        if (oPatchRoot.dataset.k !== '') {
          oPatchRoot.dataset.k = '';
          oPatchRoot.innerHTML = '';
        }
      } else {
        const brand = timeline?.brand || {};
        const key = state.activePatches.map((p) => `${p.s}:${p.rect.left},${p.rect.top}`).join('|');
        if (oPatchRoot.dataset.k !== key) {
          oPatchRoot.dataset.k = key;
          oPatchRoot.innerHTML = state.activePatches.map((p) => {
            const label = p.label || brand.name || '';
            const logoHtml = brand.logoUrl
              ? `<img src="${escHtml(brand.logoUrl)}" alt="">`
              : `<div class="mk">${escHtml(brand.mark || label.slice(0, 2).toUpperCase())}</div>`;
            return `<div class="x x-patch" style="left:${p.rect.left}cqw;top:${p.rect.top}cqh;width:${p.rect.width}cqw;height:${p.rect.height}cqh">${logoHtml}<b>${escHtml(label)}</b></div>`;
          }).join('');
        }
        oPatchRoot.hidden = false;
      }
    }

    if (oBrandRoot) {
      let html = '';
      if (state.endCard) {
        const ec = state.endCard;
        const logoHtml = ec.logoUrl
          ? `<img src="${escHtml(ec.logoUrl)}" alt="">`
          : `<div class="mk">${escHtml(ec.mark)}</div>`;
        html = `<div class="x x-end">${logoHtml}<b>${escHtml(ec.name)}</b>${ec.tagline ? `<span>${escHtml(ec.tagline)}</span>` : ''}${ec.cta ? `<div class="ct">${escHtml(ec.cta)}</div>` : ''}</div>`;
      } else {
        const parts = [];
        if (state.watermark) {
          parts.push(
            state.watermark.logoUrl
              ? `<div class="x x-wm"><img src="${escHtml(state.watermark.logoUrl)}" alt=""><span>${escHtml(state.watermark.name)}</span></div>`
              : `<div class="x x-wm"><i></i>${escHtml(state.watermark.name)}</div>`
          );
        }
        if (state.lowerThird) {
          parts.push(`<div class="x x-lower"><i></i><div><b>${escHtml(state.lowerThird.name)}</b>${state.lowerThird.role ? `<span>${escHtml(state.lowerThird.role)}</span>` : ''}</div></div>`);
        }
        if (state.safetyNotice) {
          parts.push(`<div class="x x-notice">${escHtml(state.safetyNotice.text)}</div>`);
        }
        html = parts.join('');
      }

      if (oBrandRoot.dataset.k !== html) {
        oBrandRoot.dataset.k = html;
        oBrandRoot.innerHTML = html;
      }
      oBrandRoot.hidden = !html;
      if (state.endCard && oBrandRoot.firstElementChild) {
        const slidePct = (1 - (1 - Math.pow(1 - state.endCard.progress, 3))) * 100;
        oBrandRoot.firstElementChild.style.transform = `translateY(${slidePct.toFixed(2)}%)`;
      }
    }

    return state;
  }

  function parseHexRgb(hexStr) {
    const raw = String(hexStr || '').trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(raw)) {
      return [
        parseInt(raw[0] + raw[0], 16),
        parseInt(raw[1] + raw[1], 16),
        parseInt(raw[2] + raw[2], 16)
      ];
    }
    if (/^[0-9a-fA-F]{6}$/.test(raw)) {
      return [
        parseInt(raw.slice(0, 2), 16),
        parseInt(raw.slice(2, 4), 16),
        parseInt(raw.slice(4, 6), 16)
      ];
    }
    return null;
  }

  function relativeLuminance(rgb) {
    if (!rgb) return null;
    const toLin = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * toLin(rgb[0]) + 0.7152 * toLin(rgb[1]) + 0.0722 * toLin(rgb[2]);
  }

  function resolveSubtitleAccentPalette(cfg = {}, rootDoc = null) {
    let rawColor = String(cfg.activeWordColor || cfg.activeWord || cfg.accentColor || cfg.accent || '').trim();
    if (!rawColor && rootDoc && typeof getComputedStyle === 'function') {
      rawColor = getComputedStyle(rootDoc.documentElement).getPropertyValue('--accent').trim();
    }
    if (!rawColor) rawColor = '#ffd23f';
    const lum = relativeLuminance(parseHexRgb(rawColor));
    return {
      pillBg: rawColor,
      pillFg: lum !== null && lum < 0.22 ? '#ffffff' : '#0d0e11',
      textAccent: lum !== null && lum < 0.22 ? '#ffd23f' : rawColor
    };
  }

  function resolveSubtitleStyleClass(style) {
    const s = String(style || 'floating_white_yellow').trim().toLowerCase();
    if (s === 'floating_black_on_white' || s === 'pill') return 's-pill';
    if (s === 'minimal_white' || s === 'minimal') return 's-minimal';
    return 's-yellow';
  }

  function ensureSubtitleBand(oSub, explicitBand) {
    if (explicitBand) return explicitBand;
    if (!oSub || !oSub.parentNode || typeof document === 'undefined') return null;
    const existing = oSub.parentNode.querySelector('.sub-band');
    if (existing) return existing;
    const band = document.createElement('div');
    band.className = 'sub-band';
    band.hidden = true;
    oSub.parentNode.insertBefore(band, oSub);
    return band;
  }

  function configureSubtitleLayer(oSub, cfg = {}, opts = {}) {
    if (!oSub) return null;
    const styleClass = resolveSubtitleStyleClass(opts.style || cfg.style);
    oSub.className = `sub ${styleClass}`;
    if (opts.subTop) oSub.style.setProperty('--sub-top', opts.subTop);
    if (opts.subLeft) oSub.style.setProperty('--sub-left', opts.subLeft);
    if (opts.subRight) oSub.style.setProperty('--sub-right', opts.subRight);
    const palette = resolveSubtitleAccentPalette(cfg, typeof document !== 'undefined' ? document : null);
    oSub.style.setProperty('--sub-accent-bg', palette.pillBg);
    oSub.style.setProperty('--pill-on-fg', palette.pillFg);
    oSub.style.setProperty('--sub-accent-text', palette.textAccent);
    return ensureSubtitleBand(oSub, opts.bandEl);
  }

  function renderSubtitle(oSub, timeline, time, opts = {}) {
    if (!oSub) return false;
    const cfg = timeline?.config || {};
    const styleKey = opts.style || cfg.style || 'floating_white_yellow';
    const styleClass = resolveSubtitleStyleClass(styleKey);
    const captionMode = opts.captionMode || cfg.captionMode || 'full';
    const activePunch = opts.activePunch ?? null;
    const hidden = Boolean(opts.hidden);
    const bandEl = configureSubtitleLayer(oSub, cfg, { ...opts, style: styleKey });

    if (hidden || captionMode === 'keyword_only' || (captionMode === 'hybrid' && activePunch)) {
      oSub.hidden = true;
      oSub.innerHTML = '';
      if (bandEl) bandEl.hidden = true;
      return false;
    }

    const chunks = Array.isArray(timeline?.chunks) ? timeline.chunks : [];
    const words = Array.isArray(timeline?.words) ? timeline.words : [];
    const punchWordSet = new Set(timeline?.punchWordIndices || []);
    const activeChunk = chunks.find((ch) => time >= ch.s - 0.03 && time <= ch.e + 0.08);
    if (!activeChunk || !Array.isArray(activeChunk.indices)) {
      oSub.hidden = true;
      oSub.innerHTML = '';
      if (bandEl) bandEl.hidden = true;
      return false;
    }

    const visibleIndices = captionMode === 'hybrid'
      ? activeChunk.indices.filter((idx) => !punchWordSet.has(idx))
      : activeChunk.indices;

    if (visibleIndices.length === 0) {
      oSub.hidden = true;
      oSub.innerHTML = '';
      if (bandEl) bandEl.hidden = true;
      return false;
    }

    // Never shrink multi-word chunks; only allow pre-computed singleWordFontCqw (min 6cqw, R15.7)
    const firstWordObj = words[visibleIndices[0]];
    const singleCqw = visibleIndices.length === 1
      ? (activeChunk.fontCqw || activeChunk.singleWordFontCqw || firstWordObj?.singleWordFontCqw || null)
      : null;
    if (singleCqw && Number.isFinite(Number(singleCqw))) {
      oSub.style.setProperty('--sub-size', `${Math.max(6, Number(singleCqw)).toFixed(2)}cqw`);
    } else {
      oSub.style.removeProperty('--sub-size');
    }

    const spansHtml = visibleIndices.map((idx) => {
      const item = words[idx];
      if (!item) return '';
      const isOn = time >= item.s && time <= item.e + 0.04;
      const wordText = String(item.w || '');
      return `<span class="${isOn ? 'on' : ''}">${escHtml(wordText)}</span>`;
    }).filter(Boolean).join(styleClass === 's-pill' ? '' : ' ');

    if (!spansHtml) {
      oSub.hidden = true;
      oSub.innerHTML = '';
      if (bandEl) bandEl.hidden = true;
      return false;
    }

    oSub.hidden = false;
    if (styleClass === 's-pill') {
      oSub.innerHTML = `<div class="pill">${spansHtml}</div>`;
    } else {
      oSub.innerHTML = spansHtml;
    }

    if (bandEl) {
      bandEl.hidden = styleClass !== 's-minimal';
    }

    // Pure t-driven 0.12s entrance animation (R16.5 / mockup_caption_styles.html:303)
    const lt = Math.max(0, time - activeChunk.s);
    const k = Math.min(1, Math.max(0, lt / 0.12));
    const sc = 0.9 + 0.1 * k;
    oSub.style.transform = `translateY(-50%) scale(${sc.toFixed(4)})`;
    oSub.style.opacity = String(Math.min(1, 0.3 + k));
    return true;
  }

  return {
    SHARED_LAYERS_CSS,
    I18N_DICTIONARY,
    normalizeTargetLanguage,
    getLocalizedLabels,
    resolveBrandPatchRect,
    resolveBrandPatchesList,
    resolveSharedLayerState,
    renderSharedLayersDom,
    resolveSubtitleStyleClass,
    resolveSubtitleAccentPalette,
    configureSubtitleLayer,
    renderSubtitle
  };
});
