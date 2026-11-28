import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const INFOGRAPHIC_LAYOUT_DIMENSIONS = {
  '4:5': { width: 1080, height: 1350 },
  '3:4': { width: 1080, height: 1440 },
  '1:1': { width: 1080, height: 1080 },
  '9:16': { width: 1080, height: 1920 }
};

export const INFOGRAPHIC_TEMPLATE_LIST = [
  { id: 'step_grid_classic', num: 1, name: 'Classic Step Grid', quotaLabel: '5-7 Foto AI' },
  { id: 'hero_right_editorial', num: 2, name: 'Editorial Kanan', quotaLabel: '2 Foto AI' },
  { id: 'layered_band_cards', num: 3, name: 'Multi-Layer Kolom', quotaLabel: '2 Foto AI' },
  { id: 'centerpiece_spotlight', num: 4, name: 'Spotlight Tengah', quotaLabel: '1 Foto AI' },
  { id: 'magazine_vertical_split', num: 5, name: 'Majalah 2 Kolom', quotaLabel: '4 Foto AI' },
  { id: 'visual_ingredient_shelf', num: 6, name: 'Rak Bahan Visual', quotaLabel: '5-7 Foto AI' },
  { id: 'step_timeline_zigzag', num: 7, name: 'Timeline Memasak', quotaLabel: '5 Foto AI' },
  { id: 'polaroid_scrapbook', num: 8, name: 'Scrapbook Polaroid', quotaLabel: '4 Foto AI' },
  { id: 'compact_2col_cheat_sheet', num: 9, name: 'Cheat Sheet 1-Menit', quotaLabel: '1 Foto AI' }
];

const TEMPLATE_ALIASES = {
  infographic_step_grid: 'step_grid_classic',
  infographic_text_steps: 'layered_band_cards',
  infographic_visual_ingredients: 'visual_ingredient_shelf'
};

export function normalizeInfographicTemplateId(rawId) {
  if (!rawId || rawId === 'auto_rotate') return 'step_grid_classic';
  const mapped = TEMPLATE_ALIASES[rawId] || rawId;
  const found = INFOGRAPHIC_TEMPLATE_LIST.find(t => t.id === mapped);
  return found ? found.id : 'step_grid_classic';
}

export function pickAutoRotatedTemplate({ lastUsedTemplate = null, itemIndex = 0 } = {}) {
  const ids = INFOGRAPHIC_TEMPLATE_LIST.map(t => t.id);
  if (lastUsedTemplate) {
    const normalizedLast = normalizeInfographicTemplateId(lastUsedTemplate);
    const idx = ids.indexOf(normalizedLast);
    if (idx !== -1) {
      return ids[(idx + 1 + Math.max(0, Number(itemIndex || 0))) % ids.length];
    }
  }
  return ids[Math.max(0, Number(itemIndex || 0)) % ids.length];
}

const WARM_CREAM_THEME = {
  bgGradient: 'radial-gradient(rgba(168,120,70,0.08) 1px, transparent 1px), linear-gradient(180deg, #fffaf2 0%, #f7e9d3 100%)',
  primary: '#265c29',
  accent: '#d93864',
  gold: '#e59417',
  cardBg: '#fffdf9',
  cardSoft: '#fdf4e6',
  cardBorder: '#e2ceb0',
  textMain: '#2b1d14',
  textMuted: '#634b39',
  isDark: false
};

const SAGE_PANDAN_THEME = {
  bgGradient: 'radial-gradient(rgba(31,111,61,0.08) 1px, transparent 1px), linear-gradient(180deg, #f4fbf0 0%, #def0d4 100%)',
  primary: '#1b6537',
  accent: '#d64560',
  gold: '#df9a18',
  cardBg: '#ffffff',
  cardSoft: '#eef8e8',
  cardBorder: '#bad8ad',
  textMain: '#1b291c',
  textMuted: '#475f48',
  isDark: false
};

const BAKERY_CHOCO_THEME = {
  bgGradient: 'radial-gradient(rgba(91,48,25,0.07) 1px, transparent 1px), linear-gradient(180deg, #fdf7f0 0%, #efdcc5 100%)',
  primary: '#572d16',
  accent: '#c43757',
  gold: '#d98218',
  cardBg: '#fffbf7',
  cardSoft: '#f8ecdd',
  cardBorder: '#dcc0a4',
  textMain: '#2b180e',
  textMuted: '#614231',
  isDark: false
};

const PASTEL_BAKERY_THEME = {
  bgGradient: 'radial-gradient(rgba(219,39,119,0.07) 1px, transparent 1px), linear-gradient(180deg, #fffafc 0%, #f6e7ee 100%)',
  primary: '#365831',
  accent: '#d92674',
  gold: '#ea9010',
  cardBg: '#ffffff',
  cardSoft: '#fdf1f6',
  cardBorder: '#e8c4d4',
  textMain: '#2b1c24',
  textMuted: '#5f4552',
  isDark: false
};

const DARK_BISTRO_THEME = {
  bgGradient: 'radial-gradient(rgba(229,148,23,0.09) 1px, transparent 1px), linear-gradient(180deg, #1b1714 0%, #120f0d 100%)',
  primary: '#e59417',
  accent: '#e04f6d',
  gold: '#f4b43a',
  cardBg: '#251f1b',
  cardSoft: '#302822',
  cardBorder: '#473b32',
  textMain: '#f9f2e8',
  textMuted: '#c8b8a6',
  isDark: true
};

export const INFOGRAPHIC_COLOR_THEMES = {
  warm_cream: WARM_CREAM_THEME,
  fresh_pandan: SAGE_PANDAN_THEME,
  sage_kitchen: SAGE_PANDAN_THEME,
  bakery_choco: BAKERY_CHOCO_THEME,
  pastel_playful: PASTEL_BAKERY_THEME,
  pastel_bakery: PASTEL_BAKERY_THEME,
  dark_bistro: DARK_BISTRO_THEME
};

const SVG_ICONS = {
  bowl: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11h16a8 8 0 0 1-16 0Z"/><path d="M8 21h8"/><path d="M12 19v2"/></svg>',
  pot: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 10h14v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8Z"/><path d="M3 10h18"/><path d="M9 6h6"/><path d="M12 4v2"/></svg>',
  bulb: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>',
  clock: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
};

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const LOWERCASE_TITLE_WORDS = new Set(['dari', 'dan', 'dengan', 'di', 'ke', 'untuk', 'yang', 'atau', 'ala', 'tanpa', 'pakai']);

function formatPosterTitle(raw) {
  let clean = String(raw || '').trim();
  if (!clean) return 'Resep Spesial Rumahan';
  if (clean.length > 34) {
    const splitParts = clean.split(/\s*[:|]\s*|\s+[-–]\s+/);
    if (splitParts[0] && splitParts[0].trim().length >= 8) {
      clean = splitParts[0].trim();
    }
  }
  if (clean.length > 36) {
    const withoutClause = clean.replace(/\s+(?:yang|dengan|untuk|agar|supaya)\s+.+$/i, '').trim();
    if (withoutClause.length >= 10) clean = withoutClause;
  }
  if (clean.length > 36) {
    const words = clean.split(/\s+/);
    const capped = [];
    let len = 0;
    for (const w of words) {
      if (capped.length >= 5 || (len + w.length + 1 > 34 && capped.length >= 2)) break;
      capped.push(w);
      len += w.length + 1;
    }
    clean = capped.join(' ');
  }
  const hasAnyUpper = /[A-Z]/.test(clean);
  if (hasAnyUpper) return clean;
  return clean
    .split(/\s+/)
    .map((word, idx) => {
      const lower = word.toLowerCase();
      if (idx > 0 && LOWERCASE_TITLE_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function fileToDataUri(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  const lower = filePath.toLowerCase();
  const mime = lower.endsWith('.png') ? 'image/png' : (lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function pillHeader(iconSvg, label, bg, fontSize = 17, textColor = '#ffffff') {
  return `<div style="display:inline-flex;align-items:center;gap:7px;padding:5px 14px;border-radius:10px;background:${bg};color:${textColor};font-size:${fontSize}px;font-weight:800;box-shadow:0 3px 8px rgba(0,0,0,0.12);">${iconSvg}<span>${label}</span></div>`;
}

function renderImgTag(dataUri, alt, fallbackLabel, theme, extraStyle = '') {
  if (dataUri) {
    return `<img src="${dataUri}" alt="${escapeHtml(alt)}" style="width:100%;height:100%;object-fit:cover;display:block;${extraStyle}" />`;
  }
  return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${theme.cardSoft};color:${theme.textMuted};font-weight:700;font-size:18px;padding:12px;text-align:center;${extraStyle}">${escapeHtml(fallbackLabel)}</div>`;
}

function renderMetaBentoStrip(meta, theme, compact = false) {
  const cells = [
    { label: 'Persiapan', val: meta.prep || '15 mnt' },
    { label: 'Masak', val: meta.cook || '20 mnt' },
    { label: 'Hasil', val: meta.servings || '4 porsi' }
  ];
  return `
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:auto;padding-top:${compact ? 4 : 8}px;flex-shrink:0;">
      ${cells.map(c => `
        <div style="background:${theme.cardSoft};border:1.5px solid ${theme.cardBorder};border-radius:10px;padding:${compact ? '5px 7px' : '7px 9px'};text-align:center;">
          <div style="font-size:11px;font-weight:700;color:${theme.textMuted};text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(c.label)}</div>
          <div style="font-size:${compact ? 14 : 16}px;font-weight:800;color:${theme.primary};margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(c.val)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderIngredientsBullets(groups, theme, fontPx = 17, maxTotal = 12, twoColThreshold = 8) {
  const allItems = groups.flatMap(g => (Array.isArray(g.items) ? g.items : []));
  if (groups.length === 1 && allItems.length > twoColThreshold) {
    const gTitle = escapeHtml(groups[0].group_title || 'Bahan-bahan');
    return `
      <div style="display:flex;flex-direction:column;gap:5px;min-height:0;overflow:hidden;">
        <div>${pillHeader(SVG_ICONS.bowl, `${gTitle} :`, theme.primary, 15, theme.isDark ? '#1a1206' : '#ffffff')}</div>
        <ul style="list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:3px 10px;font-size:${Math.max(13, fontPx - 2)}px;line-height:1.24;color:${theme.textMain};font-weight:600;">
          ${allItems.slice(0, maxTotal).map(item => `
            <li style="display:flex;align-items:flex-start;gap:5px;">
              <span style="color:${theme.primary};font-weight:900;flex-shrink:0;">•</span>
              <span>${escapeHtml(item)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  let remaining = maxTotal;
  return groups.map(g => {
    const gTitle = escapeHtml(g.group_title || 'Bahan-bahan');
    const items = (Array.isArray(g.items) ? g.items : []).slice(0, Math.max(0, remaining));
    remaining -= items.length;
    if (items.length === 0) return '';
    return `
      <div style="margin-bottom:4px;min-height:0;overflow:hidden;">
        <div style="margin-bottom:4px;">${pillHeader(SVG_ICONS.bowl, `${gTitle} :`, theme.primary, 15, theme.isDark ? '#1a1206' : '#ffffff')}</div>
        <ul style="list-style:none;margin:0;padding:0;font-size:${fontPx}px;line-height:1.26;color:${theme.textMain};font-weight:600;display:flex;flex-direction:column;gap:2.5px;">
          ${items.map(item => `
            <li style="display:flex;align-items:flex-start;gap:6px;">
              <span style="color:${theme.primary};font-weight:900;flex-shrink:0;">•</span>
              <span>${escapeHtml(item)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }).join('');
}

function renderFooterBlock(tips, ctaBadge, theme, hasWatermark = false, compact = false) {
  const tipsList = tips.slice(0, compact ? 1 : 2);
  const tipsHtml = tipsList.map(t => `
    <li style="margin-bottom:2px;display:flex;align-items:flex-start;gap:6px;">
      <span style="color:${theme.accent};font-weight:900;flex-shrink:0;">✓</span>
      <span>${escapeHtml(t)}</span>
    </li>
  `).join('');

  return `
    <div data-footer="infographic" style="display:grid;grid-template-columns:1.42fr 0.58fr;gap:12px;align-items:end;flex-shrink:0;padding-top:2px;">
      <div style="background:${theme.cardBg};border:2px dashed ${theme.accent};border-radius:14px;padding:${compact ? '6px 12px' : '8px 13px'};">
        <div style="margin-bottom:3px;">${pillHeader(SVG_ICONS.bulb, 'Tips Anti Gagal', theme.accent, compact ? 14 : 15)}</div>
        <ul style="list-style:none;margin:0;padding:0;font-size:${compact ? 14 : 15.5}px;line-height:1.25;font-weight:600;color:${theme.textMain};">
          ${tipsHtml || '<li>Sajikan selagi segar dan simpan di wadah tertutup.</li>'}
        </ul>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;justify-content:flex-end;padding-bottom:${hasWatermark ? (compact ? '34px' : '38px') : '0'};">
        <div style="padding:${compact ? '7px 15px' : '9px 18px'};border-radius:14px;background:${theme.accent};color:#ffffff;font-family:'Fredoka',sans-serif;font-size:${compact ? 19 : 22}px;font-weight:800;text-align:center;white-space:nowrap;transform:rotate(-2deg);box-shadow:0 6px 14px rgba(0,0,0,0.16);">${ctaBadge}</div>
      </div>
    </div>
  `;
}

/**
 * Pure HTML builder for all 9 Hero-Dominant (~40%) Editorial Bento recipe infographic templates.
 */
export function buildInfographicPosterHtml({
  data = {},
  heroDataUri = null,
  secondaryDataUri = null,
  stepDataUris = [],
  config = {}
} = {}) {
  const aspectRatio = INFOGRAPHIC_LAYOUT_DIMENSIONS[config.aspectRatio] ? config.aspectRatio : '4:5';
  const dim = INFOGRAPHIC_LAYOUT_DIMENSIONS[aspectRatio];
  const theme = INFOGRAPHIC_COLOR_THEMES[config.theme] || INFOGRAPHIC_COLOR_THEMES.warm_cream;
  const template = normalizeInfographicTemplateId(config.template || 'step_grid_classic');
  const showWatermark = config.showBrandWatermark !== false && Boolean(String(config.brandWatermarkText || '').trim());
  const watermarkText = String(config.brandWatermarkText || '').trim();

  const rawTitle = formatPosterTitle(data.title || 'Resep Spesial Rumahan');
  const title = escapeHtml(rawTitle);
  const ribbon = escapeHtml(data.subtitle_ribbon || 'Lezat, Praktis, Bikin Nagih!');
  const hook = escapeHtml(data.hook_badge || 'Cocok untuk Sajian Keluarga');
  const metaInfo = {
    prep: String(data.prep_time || '15 mnt').trim(),
    cook: String(data.cook_time || '20 mnt').trim(),
    servings: String(data.servings || '4 porsi').trim()
  };
  const metaText = escapeHtml([metaInfo.servings, metaInfo.cook || metaInfo.prep].filter(Boolean).join(' · ') || '4 Porsi');
  const groups = Array.isArray(data.ingredients_groups) ? data.ingredients_groups : [];
  const flatItems = groups.flatMap(g => Array.isArray(g.items) ? g.items : []);
  const isSq = aspectRatio === '1:1';
  const isTall = aspectRatio === '9:16';
  const ingFontPx = isSq
    ? (flatItems.length > 8 ? 13.5 : 14.5)
    : (flatItems.length > 10 ? 15 : (flatItems.length > 7 ? 16 : 17));
  const ingMax = isSq ? 7 : (isTall ? 14 : 9);
  const steps = Array.isArray(data.steps) ? data.steps : [];
  const tips = Array.isArray(data.tips) ? data.tips : [];
  const ctaBadge = escapeHtml(data.cta_badge || 'Yuk Recook!');
  const optionalProduct = data.optional_product_name ? escapeHtml(data.optional_product_name) : '';

  const productChipHtml = optionalProduct
    ? `<div style="margin-top:4px;padding:${isSq ? '4px 8px' : '5px 10px'};border-radius:8px;background:#fff3d7;border:1.5px solid ${theme.gold};color:#5c3a04;font-size:${isSq ? 13 : 14.5}px;font-weight:700;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Pakai: ${optionalProduct}</div>`
    : '';

  const watermarkOverlayHtml = showWatermark
    ? `<div data-watermark="brand" style="position:absolute;right:22px;bottom:12px;z-index:25;padding:5px 14px;border-radius:9px;background:rgba(21,32,51,0.94);color:#ffffff;font-size:16px;font-weight:800;letter-spacing:0.01em;box-shadow:0 4px 12px rgba(0,0,0,0.22);">${escapeHtml(watermarkText)}</div>`
    : '';

  const titleFontPx = isSq
    ? (rawTitle.length > 26 ? 30 : (rawTitle.length > 18 ? 35 : 40))
    : (rawTitle.length > 26 ? 35 : (rawTitle.length > 18 ? 42 : 48));
  const outlineShadow = theme.isDark
    ? '0 4px 12px rgba(0,0,0,0.55)'
    : '0 3px 0 #ffffff, 3px 0 0 #ffffff, -3px 0 0 #ffffff, 0 -3px 0 #ffffff, 2px 2px 0 #ffffff, -2px -2px 0 #ffffff, 2px -2px 0 #ffffff, -2px 2px 0 #ffffff';
  const pillBtnText = theme.isDark ? '#1a1206' : '#ffffff';
  const footerHtml = renderFooterBlock(tips, ctaBadge, theme, showWatermark, isSq);
  const heroFloatBadgeStyle = 'position:absolute;bottom:12px;left:12px;padding:5px 13px;border-radius:9px;background:rgba(255,255,255,0.94);color:#2b1d14;font-size:15px;font-weight:800;box-shadow:0 4px 12px rgba(0,0,0,0.18);';
  const heroScrimBg = 'linear-gradient(180deg, rgba(16,10,6,0.08) 0%, rgba(16,10,6,0.9) 100%)';

  let bodyInnerHtml = '';

  switch (template) {
    case 'hero_right_editorial': {
      const visibleSteps = steps.slice(0, 4);
      const secUri = secondaryDataUri || stepDataUris[0] || heroDataUri;
      const stepsStripH = isSq ? 168 : (isTall ? 310 : (aspectRatio === '4:5' ? 210 : 225));
      const stepCards = visibleSteps.map((s, idx) => `
        <div style="background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:13px;padding:${isSq ? '8px 10px' : '11px 12px'};display:flex;flex-direction:column;gap:6px;justify-content:space-between;min-height:0;">
          <span style="width:30px;height:30px;border-radius:50%;background:${theme.primary};color:${pillBtnText};font-size:16px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;">0${idx + 1}</span>
          <span style="font-size:${isSq ? 14 : 16}px;line-height:1.26;font-weight:700;color:${theme.textMain};margin:auto 0;display:-webkit-box;-webkit-line-clamp:${isSq ? 3 : 4};-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(s.caption)}</span>
        </div>
      `).join('');

      bodyInnerHtml = `
        <div style="display:grid;grid-template-columns:0.74fr 1.26fr;gap:14px;flex:1;min-height:0;align-items:stretch;">
          <div style="display:flex;flex-direction:column;gap:8px;min-height:0;">
            <div style="flex-shrink:0;">
              <h1 class="title-outline title-editorial">${title}</h1>
              <div style="display:inline-block;margin-top:5px;padding:5px 14px;border-radius:9px;background:${theme.accent};color:#ffffff;font-size:${isSq ? 15 : 17}px;font-weight:800;">${ribbon}</div>
            </div>
            <div style="flex:1;background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:16px;padding:${isSq ? '10px 12px' : '13px 15px'};display:flex;flex-direction:column;gap:6px;min-height:0;overflow:hidden;">
              ${renderIngredientsBullets(groups, theme, isSq ? 14 : ingFontPx, isSq ? 7 : 10, 99)}
              ${productChipHtml}
              ${renderMetaBentoStrip(metaInfo, theme, true)}
            </div>
          </div>
          <div data-hero="primary" style="position:relative;height:100%;border-radius:20px;overflow:hidden;border:5px solid #ffffff;box-shadow:0 12px 26px rgba(0,0,0,0.16);min-height:0;">
            ${renderImgTag(heroDataUri, rawTitle, rawTitle, theme)}
            <div style="${heroFloatBadgeStyle}">${metaText}</div>
            <div style="position:absolute;right:12px;bottom:12px;width:34%;aspect-ratio:4/3;border-radius:14px;overflow:hidden;border:4px solid #ffffff;box-shadow:0 8px 20px rgba(0,0,0,0.28);background:${theme.cardSoft};">
              ${renderImgTag(secUri, `${rawTitle} detail`, 'Detail Sajian', theme)}
            </div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:7px;height:${stepsStripH}px;flex-shrink:0;">
          <div>${pillHeader(SVG_ICONS.pot, 'Langkah Memasak :', theme.primary, 16, pillBtnText)}</div>
          <div style="display:grid;grid-template-columns:repeat(${Math.max(1, visibleSteps.length)}, minmax(0, 1fr));gap:10px;flex:1;min-height:0;">
            ${stepCards}
          </div>
        </div>
        ${footerHtml}
      `;
      break;
    }

    case 'layered_band_cards': {
      const cols = Math.min(3, Math.max(1, groups.length));
      const groupCards = (cols === 1 && flatItems.length >= 6
        ? [
            { group_title: 'Bahan Utama', items: flatItems.slice(0, Math.ceil(flatItems.length / 2)) },
            { group_title: 'Pelengkap & Bumbu', items: flatItems.slice(Math.ceil(flatItems.length / 2)) }
          ]
        : groups.slice(0, 3)
      );
      const effectiveCols = groupCards.length;
      const bandItemCap = isSq ? 3 : (isTall ? 6 : 4);
      const groupHtml = groupCards.map((g, gIdx) => `
        <div style="background:${gIdx % 2 === 1 ? theme.cardSoft : theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:14px;padding:${isSq ? '7px 10px' : '9px 13px'};min-height:0;overflow:hidden;">
          <div style="margin-bottom:4px;">${pillHeader(SVG_ICONS.bowl, escapeHtml(g.group_title || 'Bahan'), gIdx % 2 === 1 ? theme.accent : theme.primary, 14, gIdx % 2 === 1 ? '#ffffff' : pillBtnText)}</div>
          <ul style="list-style:none;margin:0;padding:0;font-size:${isSq ? 13.5 : Math.max(14.5, ingFontPx - 1)}px;line-height:1.25;color:${theme.textMain};font-weight:600;">
            ${(g.items || []).slice(0, bandItemCap).map(it => `<li style="margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">• ${escapeHtml(it)}</li>`).join('')}
          </ul>
        </div>
      `).join('');
      const secUri = secondaryDataUri || stepDataUris[0] || heroDataUri;
      const visibleSteps = steps.slice(0, 4);
      const stepCards = visibleSteps.map((s, idx) => `
        <div style="display:flex;align-items:center;gap:10px;background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:12px;padding:${isSq ? '6px 10px' : '8px 13px'};min-height:0;">
          <span style="width:28px;height:28px;border-radius:50%;background:${theme.primary};color:${pillBtnText};font-size:16px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${idx + 1}</span>
          <span style="font-size:${isSq ? 14 : 16.5}px;line-height:1.25;font-weight:700;color:${theme.textMain};display:-webkit-box;-webkit-line-clamp:${isSq ? 2 : 3};-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(s.caption)}</span>
        </div>
      `).join('');

      bodyInnerHtml = `
        <div data-hero="primary" style="position:relative;flex:0 0 ${isSq ? '43%' : '42%'};border-radius:20px;overflow:hidden;border:5px solid #ffffff;box-shadow:0 12px 26px rgba(0,0,0,0.16);min-height:0;">
          ${renderImgTag(heroDataUri, rawTitle, rawTitle, theme)}
          <div style="position:absolute;top:12px;right:12px;width:23%;aspect-ratio:4/3;border-radius:13px;overflow:hidden;border:4px solid #ffffff;box-shadow:0 8px 20px rgba(0,0,0,0.28);background:${theme.cardSoft};">
            ${renderImgTag(secUri, `${rawTitle} potongan`, 'Potongan Dalam', theme)}
          </div>
          <div style="position:absolute;inset:auto 0 0 0;padding:34px 20px 14px;background:${heroScrimBg};text-align:left;">
            <h1 style="font-family:'Fredoka','Plus Jakarta Sans',sans-serif;font-weight:800;font-size:${titleFontPx}px;line-height:1.06;color:#ffffff;text-shadow:0 3px 12px rgba(0,0,0,0.55);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${title}</h1>
            <div style="margin-top:5px;display:inline-flex;align-items:center;gap:8px;padding:4px 12px;border-radius:8px;background:rgba(24,15,9,0.72);border:1px solid rgba(253,230,138,0.45);color:#fde68a;font-size:${isSq ? 14 : 16.5}px;font-weight:800;">
              <span>${ribbon}</span><span>·</span><span>${metaText}</span>
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(${effectiveCols}, minmax(0, 1fr));gap:9px;flex-shrink:0;">
          ${groupHtml}
        </div>
        ${productChipHtml}
        <div style="display:flex;flex-direction:column;gap:6px;flex:1;min-height:0;">
          <div>${pillHeader(SVG_ICONS.pot, 'Cara Membuat :', theme.primary, 16, pillBtnText)}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(2,minmax(0,1fr));gap:8px;flex:1;min-height:0;">
            ${stepCards}
          </div>
        </div>
        ${footerHtml}
      `;
      break;
    }

    case 'centerpiece_spotlight': {
      const visibleSteps = steps.slice(0, 4);
      const stepCols = visibleSteps.map((s, idx) => `
        <div style="display:flex;align-items:center;gap:11px;background:${theme.cardSoft};border:1.5px solid ${theme.cardBorder};border-radius:12px;padding:${isSq ? '6px 10px' : '9px 13px'};min-height:0;">
          <span style="width:30px;height:30px;border-radius:50%;background:${theme.gold};color:#1f1408;font-size:17px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${idx + 1}</span>
          <span style="font-size:${isSq ? 14.5 : 17}px;line-height:1.26;font-weight:700;color:${theme.textMain};display:-webkit-box;-webkit-line-clamp:${isSq ? 2 : 3};-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(s.caption)}</span>
        </div>
      `).join('');

      bodyInnerHtml = `
        <div style="text-align:center;flex-shrink:0;">
          <h1 class="title-outline title-editorial">${title}</h1>
          <div style="display:inline-block;margin-top:5px;padding:5px 20px;border-radius:999px;background:${theme.accent};color:#ffffff;font-size:${isSq ? 15.5 : 17.5}px;font-weight:800;">${ribbon}</div>
        </div>
        <div data-hero="primary" style="position:relative;flex:0 0 ${isSq ? '43%' : '42%'};border-radius:28px;overflow:hidden;border:5px solid #ffffff;box-shadow:0 14px 30px rgba(0,0,0,0.16);min-height:0;">
          ${renderImgTag(heroDataUri, rawTitle, rawTitle, theme)}
          <div style="position:absolute;bottom:12px;left:50%;transform:translateX(-50%);white-space:nowrap;padding:6px 16px;border-radius:999px;background:rgba(255,255,255,0.95);color:#2b1d14;font-size:15px;font-weight:800;box-shadow:0 4px 12px rgba(0,0,0,0.2);">${escapeHtml(metaInfo.prep)} · ${escapeHtml(metaInfo.cook)} · ${escapeHtml(metaInfo.servings)}</div>
        </div>
        <div style="display:grid;grid-template-columns:0.86fr 1.14fr;gap:12px;flex:1;min-height:0;align-items:stretch;">
          <div style="background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:16px;padding:${isSq ? '10px 13px' : '13px 15px'};display:flex;flex-direction:column;justify-content:space-between;gap:6px;min-height:0;overflow:hidden;">
            ${renderIngredientsBullets(groups, theme, isSq ? 14 : ingFontPx, isSq ? 6 : 8, 99)}
            ${productChipHtml}
            ${isSq ? '' : `<div style="font-size:14.5px;font-weight:700;color:${theme.textMuted};line-height:1.25;">${hook}</div>`}
          </div>
          <div style="background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:16px;padding:${isSq ? '10px 13px' : '13px 15px'};display:grid;grid-template-rows:auto repeat(${Math.max(1, visibleSteps.length)},minmax(0,1fr));gap:6px;min-height:0;">
            <div>${pillHeader(SVG_ICONS.pot, 'Cara Membuat :', theme.primary, 16, pillBtnText)}</div>
            ${stepCols}
          </div>
        </div>
        ${footerHtml}
      `;
      break;
    }

    case 'magazine_vertical_split': {
      const procImgs = [0, 1, 2].map(i => stepDataUris[i] || heroDataUri);
      const visibleSteps = steps.slice(0, 4);
      const stepRows = visibleSteps.map((s, idx) => `
        <div style="display:flex;align-items:center;gap:9px;background:${theme.cardSoft};border-radius:10px;padding:${isSq ? '5px 9px' : '6px 11px'};min-height:0;">
          <span style="width:26px;height:26px;border-radius:50%;background:${theme.primary};color:${pillBtnText};font-size:14px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${idx + 1}</span>
          <span style="font-size:${isSq ? 13.5 : 16}px;line-height:1.24;font-weight:700;color:${theme.textMain};display:-webkit-box;-webkit-line-clamp:${isSq ? 2 : 3};-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(s.caption)}</span>
        </div>
      `).join('');

      bodyInnerHtml = `
        <div style="display:grid;grid-template-columns:1.18fr 0.82fr;gap:14px;flex:1;min-height:0;align-items:stretch;">
          <div style="display:flex;flex-direction:column;gap:10px;min-height:0;">
            <div data-hero="primary" style="position:relative;flex:2.6;border-radius:18px;overflow:hidden;border:5px solid #ffffff;box-shadow:0 10px 24px rgba(0,0,0,0.15);min-height:0;">
              ${renderImgTag(heroDataUri, rawTitle, rawTitle, theme)}
              <div style="${heroFloatBadgeStyle}">${metaText}</div>
            </div>
            <div style="flex:0.68;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;min-height:0;">
              ${procImgs.map((u, idx) => `
                <div style="position:relative;border-radius:12px;overflow:hidden;border:3.5px solid #ffffff;box-shadow:0 4px 12px rgba(0,0,0,0.12);min-height:0;">
                  ${renderImgTag(u, `Proses ${idx + 1}`, `Proses ${idx + 1}`, theme)}
                  <span style="position:absolute;top:6px;left:6px;width:25px;height:25px;border-radius:50%;background:${theme.gold};color:#1f1408;border:2px solid #ffffff;font-size:14px;font-weight:900;display:flex;align-items:center;justify-content:center;">${idx + 1}</span>
                </div>
              `).join('')}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;min-height:0;">
            <div style="flex-shrink:0;">
              <h1 class="title-outline title-editorial" style="font-size:${Math.max(28, titleFontPx - 4)}px;">${title}</h1>
              <div style="display:inline-block;margin-top:5px;padding:5px 13px;border-radius:9px;background:${theme.accent};color:#ffffff;font-size:${isSq ? 14.5 : 16.5}px;font-weight:800;">${ribbon}</div>
            </div>
            <div style="background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:15px;padding:${isSq ? '9px 11px' : '11px 14px'};display:flex;flex-direction:column;gap:5px;min-height:0;overflow:hidden;">
              ${renderIngredientsBullets(groups, theme, isSq ? 13.5 : Math.max(14.5, ingFontPx - 1), isSq ? 6 : 8, 99)}
              ${productChipHtml}
            </div>
            <div style="flex:1;background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:15px;padding:${isSq ? '9px 11px' : '11px 14px'};display:grid;grid-template-rows:auto repeat(${Math.max(1, visibleSteps.length)}, minmax(0, 1fr));gap:6px;min-height:0;">
              <div>${pillHeader(SVG_ICONS.pot, 'Cara Membuat :', theme.primary, 15, pillBtnText)}</div>
              ${stepRows}
            </div>
          </div>
        </div>
        ${footerHtml}
      `;
      break;
    }

    case 'visual_ingredient_shelf': {
      const shelfCap = isSq ? 6 : (isTall ? 10 : 7);
      const shelfItems = flatItems.slice(0, shelfCap).map(it => `
        <div style="padding:${isSq ? '4px 7px' : '5px 9px'};border-radius:8px;background:${theme.cardSoft};border:1.5px solid ${theme.cardBorder};font-size:${isSq ? 13 : 14.5}px;font-weight:700;color:${theme.textMain};display:flex;align-items:center;gap:6px;min-width:0;">
          <span style="width:7px;height:7px;border-radius:50%;background:${theme.primary};flex-shrink:0;"></span>
          <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(it)}</span>
        </div>
      `).join('');
      const visibleSteps = isSq ? steps.slice(0, 4) : steps.slice(0, 6);
      const cols = visibleSteps.length <= 4 ? 2 : 3;
      const rows = visibleSteps.length <= 3 ? 1 : 2;
      const stepCards = visibleSteps.map((s, idx) => `
        <div style="background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:13px;overflow:hidden;display:flex;flex-direction:column;min-height:0;">
          <div style="position:relative;flex:1;min-height:0;">
            ${renderImgTag(stepDataUris[idx] || heroDataUri, `Langkah ${idx + 1}`, `Langkah ${idx + 1}`, theme)}
            <span style="position:absolute;top:6px;left:6px;width:27px;height:27px;border-radius:50%;background:${theme.gold};color:#1f1408;border:2px solid #ffffff;font-size:14px;font-weight:900;display:flex;align-items:center;justify-content:center;">${idx + 1}</span>
          </div>
          <div style="padding:5px 8px;font-size:${isSq ? 13.5 : 14.5}px;line-height:1.22;font-weight:700;text-align:center;color:${theme.textMain};display:-webkit-box;-webkit-line-clamp:${isSq ? 2 : 3};-webkit-box-orient:vertical;overflow:hidden;flex-shrink:0;">${escapeHtml(s.caption)}</div>
        </div>
      `).join('');

      bodyInnerHtml = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-shrink:0;">
          <h1 class="title-outline" style="flex:1;min-width:0;">${title}</h1>
          <span style="padding:6px 15px;border-radius:10px;background:${theme.accent};color:#ffffff;font-size:${isSq ? 15 : 17}px;font-weight:800;white-space:nowrap;flex-shrink:0;">${ribbon}</span>
        </div>
        <div data-hero="primary" style="position:relative;flex:0 0 ${isSq ? '43%' : '42%'};border-radius:18px;overflow:hidden;border:5px solid #ffffff;box-shadow:0 10px 24px rgba(0,0,0,0.15);min-height:0;">
          ${renderImgTag(heroDataUri, rawTitle, rawTitle, theme)}
          <div style="${heroFloatBadgeStyle}">${metaText}</div>
        </div>
        <div style="display:grid;grid-template-columns:0.74fr 1.26fr;gap:12px;flex:1;min-height:0;align-items:stretch;">
          <div style="background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:16px;padding:${isSq ? '9px 11px' : '11px 13px'};display:flex;flex-direction:column;gap:5px;justify-content:space-between;min-height:0;overflow:hidden;">
            <div style="display:flex;flex-direction:column;gap:5px;min-height:0;overflow:hidden;">
              <div>${pillHeader(SVG_ICONS.bowl, 'Rak Bahan :', theme.primary, 15, pillBtnText)}</div>
              <div style="display:flex;flex-direction:column;gap:4px;">
                ${shelfItems}
              </div>
            </div>
            ${productChipHtml}
            ${isSq ? '' : renderMetaBentoStrip(metaInfo, theme, true)}
          </div>
          <div style="display:grid;grid-template-columns:repeat(${cols}, minmax(0, 1fr));grid-template-rows:repeat(${rows}, minmax(0, 1fr));gap:9px;min-height:0;">
            ${stepCards}
          </div>
        </div>
        ${footerHtml}
      `;
      break;
    }

    case 'step_timeline_zigzag': {
      const visibleSteps = steps.slice(0, 4);
      const timelineSteps = visibleSteps.map((s, idx) => {
        const thumbW = isSq ? 92 : (isTall ? 155 : 115);
        return `
          <div style="background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-left:8px solid ${theme.primary};border-radius:14px;padding:${isSq ? '6px 9px' : '8px 11px'};display:flex;align-items:center;gap:11px;min-height:0;">
            <div style="position:relative;width:${thumbW}px;height:100%;border-radius:10px;overflow:hidden;border:3px solid #ffffff;box-shadow:0 4px 10px rgba(0,0,0,0.12);flex-shrink:0;">
              ${renderImgTag(stepDataUris[idx] || heroDataUri, `Langkah ${idx + 1}`, `Step ${idx + 1}`, theme)}
              <span style="position:absolute;top:5px;left:5px;width:25px;height:25px;border-radius:50%;background:${theme.gold};color:#1f1408;border:2px solid #ffffff;font-size:14px;font-weight:900;display:flex;align-items:center;justify-content:center;">${idx + 1}</span>
            </div>
            <div style="flex:1;font-size:${isSq ? 14 : 16.5}px;line-height:1.26;font-weight:700;color:${theme.textMain};display:-webkit-box;-webkit-line-clamp:${isSq ? 3 : 4};-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(s.caption)}</div>
          </div>
        `;
      }).join('');

      bodyInnerHtml = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-shrink:0;">
          <h1 class="title-outline" style="flex:1;min-width:0;">${title}</h1>
          <span style="padding:6px 15px;border-radius:10px;background:${theme.accent};color:#ffffff;font-size:${isSq ? 15 : 17}px;font-weight:800;white-space:nowrap;flex-shrink:0;">${ribbon}</span>
        </div>
        <div data-hero="primary" style="position:relative;flex:0 0 ${isSq ? '42%' : '41%'};border-radius:18px;overflow:hidden;border:5px solid #ffffff;box-shadow:0 10px 24px rgba(0,0,0,0.15);min-height:0;">
          ${renderImgTag(heroDataUri, rawTitle, rawTitle, theme)}
          <div style="${heroFloatBadgeStyle}">${metaText}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(2,minmax(0,1fr));gap:9px;flex:1;min-height:0;">
          ${timelineSteps}
        </div>
        <div style="background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:14px;padding:${isSq ? '7px 12px' : '9px 14px'};flex-shrink:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            ${pillHeader(SVG_ICONS.bowl, 'Bahan-bahan :', theme.primary, 14, pillBtnText)}
            <span style="font-size:13.5px;font-weight:800;color:${theme.textMuted};">${escapeHtml(metaInfo.prep)} · ${escapeHtml(metaInfo.cook)} · ${escapeHtml(metaInfo.servings)}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;font-size:${isSq ? 13.5 : 15}px;font-weight:600;color:${theme.textMain};">
            ${flatItems.slice(0, isSq ? 6 : 8).map(i => `<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">• ${escapeHtml(i)}</div>`).join('')}
          </div>
          ${productChipHtml}
        </div>
        ${footerHtml}
      `;
      break;
    }

    case 'polaroid_scrapbook': {
      const procImgs = [0, 1, 2].map(i => stepDataUris[i] || heroDataUri);
      const visibleSteps = steps.slice(0, 4);
      const stepRows = visibleSteps.map((s, idx) => `
        <div style="display:flex;align-items:center;gap:9px;font-size:${isSq ? 13.5 : 16}px;line-height:1.25;font-weight:700;color:${theme.textMain};min-height:0;">
          <span style="width:25px;height:25px;border-radius:50%;background:${theme.primary};color:${pillBtnText};font-size:13.5px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${idx + 1}</span>
          <span style="display:-webkit-box;-webkit-line-clamp:${isSq ? 2 : 3};-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(s.caption)}</span>
        </div>
      `).join('');

      bodyInnerHtml = `
        <div style="text-align:center;flex-shrink:0;">
          <h1 class="title-outline">${title}</h1>
          <div style="display:inline-block;margin-top:4px;padding:4px 18px;border-radius:9px;background:${theme.accent};color:#ffffff;font-size:${isSq ? 15 : 17}px;font-weight:800;">${ribbon}</div>
        </div>
        <div style="display:grid;grid-template-columns:1.22fr 0.78fr;gap:14px;flex:1;min-height:0;align-items:stretch;">
          <div style="display:flex;flex-direction:column;gap:10px;justify-content:space-between;padding:4px;min-height:0;">
            <div style="flex:3.2;background:#ffffff;padding:${isSq ? '8px 8px 10px' : '10px 10px 14px'};border-radius:7px;box-shadow:0 10px 24px rgba(0,0,0,0.16);transform:rotate(-1.1deg);display:flex;flex-direction:column;min-height:0;">
              <div data-hero="primary" style="flex:1;overflow:hidden;border-radius:4px;min-height:0;">
                ${renderImgTag(heroDataUri, rawTitle, rawTitle, theme)}
              </div>
              <div style="text-align:center;margin-top:6px;font-size:${isSq ? 14.5 : 16.5}px;font-weight:800;color:#2c1e16;flex-shrink:0;">${metaText}</div>
            </div>
            <div style="flex:0.62;display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:9px;min-height:0;">
              ${procImgs.map((u, idx) => `
                <div style="background:#ffffff;padding:5px 5px 10px;border-radius:5px;box-shadow:0 6px 14px rgba(0,0,0,0.12);transform:rotate(${idx === 1 ? '1.6deg' : '-1.3deg'});position:relative;display:flex;flex-direction:column;min-height:0;">
                  <div style="flex:1;overflow:hidden;border-radius:2px;">
                    ${renderImgTag(u, `Proses ${idx + 1}`, `${idx + 1}`, theme)}
                  </div>
                  <span style="position:absolute;top:-5px;left:-5px;width:24px;height:24px;border-radius:50%;background:${theme.gold};color:#1f1408;border:2px solid #ffffff;font-size:13.5px;font-weight:900;display:flex;align-items:center;justify-content:center;">${idx + 1}</span>
                </div>
              `).join('')}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:9px;min-height:0;">
            <div style="background:${theme.cardBg};border:2px dashed ${theme.cardBorder};border-radius:15px;padding:${isSq ? '9px 11px' : '11px 14px'};display:flex;flex-direction:column;gap:5px;min-height:0;overflow:hidden;">
              ${renderIngredientsBullets(groups, theme, isSq ? 13.5 : Math.max(14.5, ingFontPx - 1), isSq ? 6 : 8, 99)}
              ${productChipHtml}
            </div>
            <div style="flex:1;background:${theme.cardBg};border:2px dashed ${theme.cardBorder};border-radius:15px;padding:${isSq ? '9px 11px' : '11px 14px'};display:grid;grid-template-rows:auto repeat(${Math.max(1, visibleSteps.length)}, minmax(0, 1fr));gap:5px;min-height:0;">
              <div>${pillHeader(SVG_ICONS.pot, 'Cara Membuat :', theme.primary, 15, pillBtnText)}</div>
              ${stepRows}
            </div>
          </div>
        </div>
        ${footerHtml}
      `;
      break;
    }

    case 'compact_2col_cheat_sheet': {
      const visibleSteps = steps.slice(0, 6);
      const stepRows = visibleSteps.map((s, idx) => `
        <div style="display:flex;align-items:center;gap:10px;background:${theme.cardSoft};border-radius:10px;padding:${isSq ? '5px 10px' : '6px 12px'};min-height:0;">
          <span style="width:27px;height:27px;border-radius:50%;background:${theme.primary};color:${pillBtnText};font-size:14.5px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${idx + 1}</span>
          <span style="font-size:${isSq ? 14 : 16.5}px;line-height:1.25;font-weight:700;color:${theme.textMain};display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(s.caption)}</span>
        </div>
      `).join('');

      bodyInnerHtml = `
        <div data-hero="primary" style="position:relative;flex:0 0 ${isSq ? '44%' : '43%'};border-radius:20px;overflow:hidden;border:5px solid #ffffff;box-shadow:0 12px 26px rgba(0,0,0,0.16);min-height:0;">
          ${renderImgTag(heroDataUri, rawTitle, rawTitle, theme)}
          <div style="position:absolute;top:12px;left:14px;padding:4px 12px;border-radius:8px;background:${theme.primary};color:${pillBtnText};font-size:13px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;box-shadow:0 4px 10px rgba(0,0,0,0.22);">Cheat Sheet 1-Menit</div>
          <div style="position:absolute;inset:auto 0 0 0;padding:34px 20px 14px;background:${heroScrimBg};text-align:left;">
            <h1 style="font-family:'Playfair Display',Georgia,serif;font-weight:800;font-size:${titleFontPx}px;line-height:1.06;color:#ffffff;text-shadow:0 3px 12px rgba(0,0,0,0.55);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${title}</h1>
            <div style="margin-top:5px;display:inline-flex;align-items:center;gap:8px;padding:4px 12px;border-radius:8px;background:rgba(24,15,9,0.72);border:1px solid rgba(253,230,138,0.45);color:#fde68a;font-size:${isSq ? 14.5 : 17}px;font-weight:800;">
              <span>${ribbon}</span><span>·</span><span>${metaText}</span>
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:0.88fr 1.12fr;gap:12px;flex:1;min-height:0;">
          <div style="background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:16px;padding:${isSq ? '11px 14px' : '14px 16px'};display:flex;flex-direction:column;gap:8px;justify-content:space-between;min-height:0;overflow:hidden;">
            <div>${renderIngredientsBullets(groups, theme, isSq ? 14 : 17, isSq ? 7 : 10, 99)}</div>
            ${productChipHtml}
            ${isSq ? '' : `<div style="padding:8px 11px;border-radius:10px;background:${theme.cardSoft};border:1.5px solid ${theme.cardBorder};font-size:14.5px;font-weight:700;color:${theme.textMuted};line-height:1.25;">${hook}</div>`}
          </div>
          <div style="background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:16px;padding:${isSq ? '11px 14px' : '14px 16px'};display:grid;grid-template-rows:auto repeat(${Math.max(1, visibleSteps.length)}, minmax(0, 1fr));gap:6px;min-height:0;">
            <div>${pillHeader(SVG_ICONS.pot, 'Langkah Cepat :', theme.primary, 16, pillBtnText)}</div>
            ${stepRows}
          </div>
        </div>
        ${footerHtml}
      `;
      break;
    }

    case 'step_grid_classic':
    default: {
      const visibleSteps = isSq ? steps.slice(0, 4) : steps.slice(0, 6);
      const cols = visibleSteps.length <= 4 ? 2 : 3;
      const rows = visibleSteps.length <= 3 ? 1 : 2;
      const cardsHtml = visibleSteps.map((s, idx) => {
        const sUri = stepDataUris[idx] || heroDataUri;
        return `
          <div style="background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:13px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 4px 10px rgba(0,0,0,0.05);min-height:0;">
            <div style="position:relative;flex:1;min-height:0;">
              ${renderImgTag(sUri, `Langkah ${idx + 1}`, `Langkah ${idx + 1}`, theme)}
              <span style="position:absolute;top:6px;left:6px;width:27px;height:27px;border-radius:50%;background:${theme.gold};color:#1f1408;border:2px solid #ffffff;font-size:15px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.2);">${idx + 1}</span>
            </div>
            <div style="padding:5px 8px;font-size:${isSq ? 13.5 : (cols === 2 ? 16 : 14.5)}px;line-height:1.22;font-weight:700;color:${theme.textMain};text-align:center;display:-webkit-box;-webkit-line-clamp:${isSq ? 2 : 3};-webkit-box-orient:vertical;overflow:hidden;flex-shrink:0;">
              ${escapeHtml(s.caption)}
            </div>
          </div>
        `;
      }).join('');

      bodyInnerHtml = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-shrink:0;">
          <div style="min-width:0;flex:1;">
            <h1 class="title-outline">${title}</h1>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            <span style="padding:6px 15px;border-radius:10px;background:${theme.accent};color:#ffffff;font-size:${isSq ? 15 : 17}px;font-weight:800;box-shadow:0 4px 10px rgba(0,0,0,0.12);">${ribbon}</span>
            <span style="padding:6px 12px;border-radius:10px;background:#fff6cf;border:2px dashed ${theme.gold};color:#4a3518;font-size:14px;font-weight:800;white-space:nowrap;">${escapeHtml(metaInfo.servings)}</span>
          </div>
        </div>
        <div data-hero="primary" style="position:relative;flex:0 0 ${isSq ? '44%' : '43%'};border-radius:18px;overflow:hidden;border:5px solid #ffffff;box-shadow:0 12px 26px rgba(0,0,0,0.15);min-height:0;">
          ${renderImgTag(heroDataUri, rawTitle, rawTitle, theme)}
          <div style="${heroFloatBadgeStyle}display:inline-flex;align-items:center;gap:6px;">${SVG_ICONS.clock}<span>${hook}</span></div>
        </div>
        <div style="display:grid;grid-template-columns:0.74fr 1.26fr;gap:12px;flex:1;min-height:0;align-items:stretch;">
          <div style="background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:16px;padding:${isSq ? '10px 12px' : '12px 14px'};display:flex;flex-direction:column;gap:6px;box-shadow:0 6px 16px rgba(0,0,0,0.05);min-height:0;overflow:hidden;">
            ${renderIngredientsBullets(groups, theme, isSq ? 14 : 16, ingMax, 99)}
            ${productChipHtml}
            ${isSq ? '' : renderMetaBentoStrip(metaInfo, theme, true)}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;min-height:0;">
            <div>${pillHeader(SVG_ICONS.pot, 'Cara Membuat :', theme.primary, 16, pillBtnText)}</div>
            <div style="display:grid;grid-template-columns:repeat(${cols}, minmax(0, 1fr));grid-template-rows:repeat(${rows}, minmax(0, 1fr));gap:8px;flex:1;min-height:0;">
              ${cardsHtml}
            </div>
          </div>
        </div>
        ${footerHtml}
      `;
      break;
    }
  }

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    position: relative;
    width: ${dim.width}px;
    height: ${dim.height}px;
    overflow: hidden;
    font-family: 'Plus Jakarta Sans', 'Nunito', 'Hiragino Sans', system-ui, -apple-system, sans-serif;
    background: ${theme.bgGradient};
    background-size: 20px 20px, 100% 100%;
    color: ${theme.textMain};
    padding: ${isSq ? '16px 20px' : '20px 24px'};
    display: flex;
    flex-direction: column;
    gap: ${isSq ? '8px' : '11px'};
  }
  .title-outline {
    font-family: 'Fredoka', 'Plus Jakarta Sans', 'Hiragino Maru Gothic ProN', system-ui, sans-serif;
    font-weight: 800;
    font-size: ${titleFontPx}px;
    line-height: 1.06;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    color: ${theme.primary};
    text-shadow: ${outlineShadow};
  }
  .title-outline.title-editorial {
    font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
  }
</style>
</head>
<body>
${bodyInnerHtml}
${watermarkOverlayHtml}
</body>
</html>`;
}

/**
 * Renders the infographic poster HTML to a crisp JPEG file using Playwright Chromium + Sharp.
 */
export async function renderRecipeInfographicPoster({
  data,
  heroImagePath = null,
  secondaryImagePath = null,
  stepImagePaths = [],
  outputPath,
  config = {}
} = {}) {
  if (!outputPath) {
    throw new Error('renderRecipeInfographicPoster requires outputPath');
  }

  const aspectRatio = INFOGRAPHIC_LAYOUT_DIMENSIONS[config.aspectRatio] ? config.aspectRatio : '4:5';
  const dim = INFOGRAPHIC_LAYOUT_DIMENSIONS[aspectRatio];

  const heroDataUri = fileToDataUri(heroImagePath);
  const secondaryDataUri = fileToDataUri(secondaryImagePath);
  const stepDataUris = (Array.isArray(stepImagePaths) ? stepImagePaths : []).map(p => fileToDataUri(p));

  const html = buildInfographicPosterHtml({
    data,
    heroDataUri,
    secondaryDataUri,
    stepDataUris,
    config: { ...config, aspectRatio }
  });

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: dim.width, height: dim.height },
      deviceScaleFactor: 1
    });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const pngBuffer = await page.screenshot({ type: 'png', fullPage: false });
    await sharp(pngBuffer).jpeg({ quality: 94 }).toFile(outputPath);
  } finally {
    await browser.close();
  }

  console.log(`[Infographic Renderer] Rendered ${aspectRatio} (${normalizeInfographicTemplateId(config.template)}) poster to: ${outputPath}`);
  return outputPath;
}
