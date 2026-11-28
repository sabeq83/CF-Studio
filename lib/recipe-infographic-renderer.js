import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const INFOGRAPHIC_LAYOUT_DIMENSIONS = {
  '4:5': { width: 1080, height: 1350 },
  '3:4': { width: 1080, height: 1440 },
  '1:1': { width: 1080, height: 1080 }
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

export const INFOGRAPHIC_COLOR_THEMES = {
  warm_cream: {
    bgGradient: 'linear-gradient(180deg, #fff8ee 0%, #f8e9d2 100%)',
    primary: '#2d6a2e',
    accent: '#e03e6b',
    gold: '#e59417',
    cardBg: '#fffdf9',
    cardBorder: '#e6d3b8',
    textMain: '#2c1e16',
    textMuted: '#5b4534'
  },
  fresh_pandan: {
    bgGradient: 'linear-gradient(180deg, #f3fbef 0%, #dff1d5 100%)',
    primary: '#1f6f3d',
    accent: '#d94862',
    gold: '#df9a18',
    cardBg: '#ffffff',
    cardBorder: '#bfdcb2',
    textMain: '#1e2c1f',
    textMuted: '#485f49'
  },
  bakery_choco: {
    bgGradient: 'linear-gradient(180deg, #fdf6ef 0%, #f1dfc9 100%)',
    primary: '#5b3019',
    accent: '#c93b5b',
    gold: '#d98218',
    cardBg: '#fffbf6',
    cardBorder: '#dfc5ab',
    textMain: '#2d1a0f',
    textMuted: '#5e4130'
  },
  pastel_playful: {
    bgGradient: 'linear-gradient(180deg, #fff9fb 0%, #f8eaf0 100%)',
    primary: '#3b5e36',
    accent: '#db2777',
    gold: '#ea9010',
    cardBg: '#ffffff',
    cardBorder: '#ebc8d7',
    textMain: '#2c1e26',
    textMuted: '#5e4552'
  }
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
  const clean = String(raw || '').trim();
  if (!clean) return 'Resep Spesial Rumahan';
  // Preserve mixed-case intentional casing if already uppercase words exist, otherwise apply clean Title Case
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

function renderImgTag(dataUri, alt, fallbackLabel, theme, extraStyle = '') {
  if (dataUri) {
    return `<img src="${dataUri}" alt="${escapeHtml(alt)}" style="width:100%;height:100%;object-fit:cover;display:block;${extraStyle}" />`;
  }
  return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#e8d7c1;color:${theme.textMuted};font-weight:700;font-size:20px;padding:14px;text-align:center;${extraStyle}">${escapeHtml(fallbackLabel)}</div>`;
}

function renderIngredientsBullets(groups, theme, fontPx = 19, maxPerGroup = 12) {
  return groups.map(g => {
    const gTitle = escapeHtml(g.group_title || 'Bahan-bahan');
    const itemsHtml = (Array.isArray(g.items) ? g.items : []).slice(0, maxPerGroup).map(item => `
      <li style="margin-bottom:4px;display:flex;align-items:flex-start;gap:7px;">
        <span style="color:${theme.primary};font-weight:900;flex-shrink:0;">•</span>
        <span>${escapeHtml(item)}</span>
      </li>
    `).join('');
    return `
      <div style="margin-bottom:6px;">
        <div style="display:inline-block;padding:4px 14px;border-radius:10px;background:${theme.primary};color:#ffffff;font-size:19px;font-weight:800;margin-bottom:6px;">${gTitle} :</div>
        <ul style="list-style:none;margin:0;padding:0;font-size:${fontPx}px;line-height:1.34;color:${theme.textMain};font-weight:600;">
          ${itemsHtml}
        </ul>
      </div>
    `;
  }).join('');
}

function renderFooterBlock(tips, ctaBadge, watermarkHtml, theme, compact = false) {
  const tipsHtml = (compact ? tips.slice(0, 2) : tips).map(t => `
    <li style="margin-bottom:3px;display:flex;align-items:flex-start;gap:7px;">
      <span style="color:${theme.accent};font-weight:900;flex-shrink:0;">✓</span>
      <span>${escapeHtml(t)}</span>
    </li>
  `).join('');

  return `
    <div style="display:grid;grid-template-columns:1.38fr 0.62fr;gap:14px;align-items:end;margin-top:auto;">
      <div style="background:${theme.cardBg};border:2.5px dashed ${theme.accent};border-radius:14px;padding:10px 14px;">
        <span style="display:inline-block;padding:3px 12px;border-radius:8px;background:${theme.accent};color:#ffffff;font-size:18px;font-weight:800;margin-bottom:5px;">Tips :</span>
        <ul style="list-style:none;margin:0;padding:0;font-size:17px;line-height:1.3;font-weight:600;color:${theme.textMain};">
          ${tipsHtml || '<li>Sajikan selagi segar dan simpan di wadah tertutup.</li>'}
        </ul>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
        <div style="padding:10px 20px;border-radius:14px;background:${theme.accent};color:#ffffff;font-family:'Fredoka',sans-serif;font-size:26px;font-weight:800;text-align:center;transform:rotate(-2deg);box-shadow:0 6px 14px rgba(0,0,0,0.16);">${ctaBadge}</div>
        ${watermarkHtml}
      </div>
    </div>
  `;
}

/**
 * Pure HTML builder for all 9 recipe infographic poster templates (testable offline without Playwright).
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
  const metaText = escapeHtml([data.servings, data.cook_time || data.prep_time].filter(Boolean).join(' · ') || '4 Porsi');
  const groups = Array.isArray(data.ingredients_groups) ? data.ingredients_groups : [];
  const flatItems = groups.flatMap(g => Array.isArray(g.items) ? g.items : []);
  const ingFontPx = flatItems.length > 10 ? 17 : (flatItems.length > 7 ? 19 : 21);
  const steps = Array.isArray(data.steps) ? data.steps : [];
  const tips = Array.isArray(data.tips) ? data.tips : [];
  const ctaBadge = escapeHtml(data.cta_badge || 'Selamat Mencoba!');
  const optionalProduct = data.optional_product_name ? escapeHtml(data.optional_product_name) : '';

  const productChipHtml = optionalProduct
    ? `<div style="margin-top:auto;padding:7px 11px;border-radius:9px;background:#fff3d7;border:2px solid ${theme.gold};color:#5c3a04;font-size:16px;font-weight:700;">Pakai: ${optionalProduct}</div>`
    : '';

  const watermarkHtml = showWatermark
    ? `<div style="padding:6px 14px;border-radius:9px;background:rgba(21,32,51,0.92);color:#ffffff;font-size:18px;font-weight:800;letter-spacing:0.01em;box-shadow:0 4px 12px rgba(0,0,0,0.18);">${escapeHtml(watermarkText)}</div>`
    : '';

  const titleFontPx = rawTitle.length > 26 ? 42 : 52;
  const heroMinH = aspectRatio === '1:1' ? 205 : (aspectRatio === '4:5' ? 265 : 320);
  const footerHtml = renderFooterBlock(tips, ctaBadge, watermarkHtml, theme, aspectRatio === '1:1');

  let bodyInnerHtml = '';

  switch (template) {
    case 'hero_right_editorial': {
      const visibleSteps = steps.slice(0, 4);
      const secUri = secondaryDataUri || stepDataUris[0] || heroDataUri;
      const stepCards = visibleSteps.map((s, idx) => `
        <div style="background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:6px;">
          <span style="width:28px;height:28px;border-radius:50%;background:${theme.primary};color:#ffffff;font-size:16px;font-weight:900;display:flex;align-items:center;justify-content:center;">${idx + 1}</span>
          <span style="font-size:17px;line-height:1.28;font-weight:700;color:${theme.textMain};">${escapeHtml(s.caption)}</span>
        </div>
      `).join('');

      bodyInnerHtml = `
        <div style="display:grid;grid-template-columns:0.96fr 1.04fr;gap:18px;flex:1;align-items:stretch;">
          <div style="display:flex;flex-direction:column;gap:10px;">
            <div>
              <h1 class="title-outline">${title}</h1>
              <div style="display:inline-block;margin-top:6px;padding:6px 16px;border-radius:10px;background:${theme.accent};color:#ffffff;font-size:20px;font-weight:800;">${ribbon}</div>
            </div>
            <div style="flex:1;background:${theme.cardBg};border:2.5px solid ${theme.cardBorder};border-radius:18px;padding:14px 16px;display:flex;flex-direction:column;gap:6px;">
              ${renderIngredientsBullets(groups, theme, ingFontPx)}
              ${productChipHtml}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px;">
            <div style="position:relative;flex:1.45;border-radius:20px;overflow:hidden;border:5px solid #ffffff;box-shadow:0 10px 24px rgba(0,0,0,0.14);">
              ${renderImgTag(heroDataUri, rawTitle, rawTitle, theme)}
              <div style="position:absolute;bottom:10px;left:10px;padding:5px 12px;border-radius:8px;background:rgba(255,255,255,0.94);color:${theme.textMain};font-size:16px;font-weight:800;">${metaText}</div>
            </div>
            <div style="flex:0.65;border-radius:16px;overflow:hidden;border:4px solid #ffffff;box-shadow:0 6px 16px rgba(0,0,0,0.1);">
              ${renderImgTag(secUri, `${rawTitle} detail`, 'Detail Sajian', theme)}
            </div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div><span style="display:inline-block;padding:5px 16px;border-radius:10px;background:${theme.primary};color:#ffffff;font-size:20px;font-weight:800;">Cara Membuat :</span></div>
          <div style="display:grid;grid-template-columns:repeat(${Math.max(1, visibleSteps.length)}, minmax(0, 1fr));gap:10px;">
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
            { group_title: 'Pelengkap', items: flatItems.slice(Math.ceil(flatItems.length / 2)) }
          ]
        : groups.slice(0, 3)
      );
      const effectiveCols = groupCards.length;
      const groupHtml = groupCards.map(g => `
        <div style="background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:14px;padding:10px 12px;">
          <div style="display:inline-block;padding:3px 12px;border-radius:8px;background:${theme.primary};color:#ffffff;font-size:17px;font-weight:800;margin-bottom:6px;">${escapeHtml(g.group_title || 'Bahan')}</div>
          <ul style="list-style:none;margin:0;padding:0;font-size:${ingFontPx - 1}px;line-height:1.3;color:${theme.textMain};font-weight:600;">
            ${(g.items || []).slice(0, 6).map(it => `<li style="margin-bottom:3px;">• ${escapeHtml(it)}</li>`).join('')}
          </ul>
        </div>
      `).join('');
      const secUri = secondaryDataUri || stepDataUris[0] || heroDataUri;
      const rowsHtml = steps.slice(0, 4).map((s, idx) => `
        <div style="display:flex;align-items:flex-start;gap:10px;background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:12px;padding:10px 12px;">
          <span style="width:30px;height:30px;border-radius:50%;background:${theme.primary};color:#ffffff;font-size:18px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${idx + 1}</span>
          <span style="font-size:19px;line-height:1.3;font-weight:600;color:${theme.textMain};">${escapeHtml(s.caption)}</span>
        </div>
      `).join('');

      bodyInnerHtml = `
        <div style="display:grid;grid-template-columns:1.1fr 0.9fr;gap:16px;align-items:center;">
          <div>
            <h1 class="title-outline">${title}</h1>
            <div style="display:inline-block;margin-top:6px;padding:6px 16px;border-radius:10px;background:${theme.accent};color:#ffffff;font-size:20px;font-weight:800;">${ribbon}</div>
            <div style="display:inline-block;margin-top:6px;padding:4px 12px;border-radius:8px;background:#fff6cf;border:2px dashed ${theme.gold};color:#4a3518;font-size:16px;font-weight:700;">${hook}</div>
          </div>
          <div style="position:relative;height:${aspectRatio === '1:1' ? 200 : 250}px;border-radius:18px;overflow:hidden;border:5px solid #ffffff;box-shadow:0 8px 20px rgba(0,0,0,0.14);">
            ${renderImgTag(heroDataUri, rawTitle, rawTitle, theme)}
            <div style="position:absolute;bottom:8px;left:8px;padding:4px 10px;border-radius:8px;background:rgba(255,255,255,0.94);color:${theme.textMain};font-size:15px;font-weight:800;">${metaText}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(${effectiveCols}, minmax(0, 1fr));gap:10px;">
          ${groupHtml}
        </div>
        ${productChipHtml}
        <div style="display:grid;grid-template-columns:1.3fr 0.7fr;gap:14px;flex:1;align-items:stretch;">
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div><span style="display:inline-block;padding:5px 16px;border-radius:10px;background:${theme.primary};color:#ffffff;font-size:20px;font-weight:800;">Cara Membuat :</span></div>
            ${rowsHtml}
          </div>
          <div style="border-radius:18px;overflow:hidden;border:4px solid #ffffff;box-shadow:0 8px 20px rgba(0,0,0,0.12);">
            ${renderImgTag(secUri, `${rawTitle} potongan`, 'Sajian Potongan', theme)}
          </div>
        </div>
        ${footerHtml}
      `;
      break;
    }

    case 'centerpiece_spotlight': {
      const stepCols = steps.slice(0, 4).map((s, idx) => `
        <div style="display:flex;align-items:flex-start;gap:10px;background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:12px;padding:10px 12px;">
          <span style="width:30px;height:30px;border-radius:50%;background:${theme.primary};color:#ffffff;font-size:17px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${idx + 1}</span>
          <span style="font-size:18px;line-height:1.3;font-weight:600;color:${theme.textMain};">${escapeHtml(s.caption)}</span>
        </div>
      `).join('');

      bodyInnerHtml = `
        <div style="text-align:center;">
          <h1 class="title-outline">${title}</h1>
          <div style="display:inline-block;margin-top:6px;padding:6px 18px;border-radius:10px;background:${theme.accent};color:#ffffff;font-size:21px;font-weight:800;">${ribbon}</div>
        </div>
        <div style="display:grid;grid-template-columns:0.75fr 1.05fr 1fr;gap:14px;align-items:center;">
          <div style="background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:8px;">
            <span style="display:inline-block;align-self:flex-start;padding:4px 12px;border-radius:8px;background:${theme.primary};color:#ffffff;font-size:17px;font-weight:800;">Info Menu</span>
            <div style="font-size:18px;font-weight:800;color:${theme.textMain};">${metaText}</div>
            <div style="font-size:16px;color:${theme.textMuted};font-weight:600;">${hook}</div>
            ${productChipHtml}
          </div>
          <div style="aspect-ratio:1/1;border-radius:50%;overflow:hidden;border:6px solid #ffffff;box-shadow:0 12px 28px rgba(0,0,0,0.16);">
            ${renderImgTag(heroDataUri, rawTitle, rawTitle, theme)}
          </div>
          <div style="background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:16px;padding:12px 14px;">
            ${renderIngredientsBullets(groups, theme, ingFontPx - 1, 8)}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;flex:1;">
          <div><span style="display:inline-block;padding:5px 16px;border-radius:10px;background:${theme.primary};color:#ffffff;font-size:20px;font-weight:800;">Cara Membuat :</span></div>
          <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:10px;">
            ${stepCols}
          </div>
        </div>
        ${footerHtml}
      `;
      break;
    }

    case 'magazine_vertical_split': {
      const procImgs = [0, 1, 2].map(i => stepDataUris[i] || heroDataUri);
      const stepRows = steps.slice(0, 4).map((s, idx) => `
        <div style="display:flex;align-items:flex-start;gap:10px;">
          <span style="width:28px;height:28px;border-radius:50%;background:${theme.primary};color:#ffffff;font-size:16px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${idx + 1}</span>
          <span style="font-size:18px;line-height:1.3;font-weight:600;color:${theme.textMain};">${escapeHtml(s.caption)}</span>
        </div>
      `).join('');

      bodyInnerHtml = `
        <div style="display:grid;grid-template-columns:0.86fr 1.14fr;gap:18px;flex:1;align-items:stretch;">
          <div style="display:flex;flex-direction:column;gap:10px;">
            <div style="position:relative;flex:1.4;border-radius:18px;overflow:hidden;border:5px solid #ffffff;box-shadow:0 8px 20px rgba(0,0,0,0.14);">
              ${renderImgTag(heroDataUri, rawTitle, rawTitle, theme)}
              <div style="position:absolute;bottom:10px;left:10px;padding:4px 10px;border-radius:8px;background:rgba(255,255,255,0.94);color:${theme.textMain};font-size:15px;font-weight:800;">${metaText}</div>
            </div>
            ${procImgs.map((u, idx) => `
              <div style="position:relative;flex:0.72;border-radius:14px;overflow:hidden;border:4px solid #ffffff;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
                ${renderImgTag(u, `Proses ${idx + 1}`, `Proses ${idx + 1}`, theme)}
                <span style="position:absolute;top:8px;left:8px;width:28px;height:28px;border-radius:50%;background:${theme.gold};color:#1f1408;border:2px solid #ffffff;font-size:16px;font-weight:900;display:flex;align-items:center;justify-content:center;">${idx + 1}</span>
              </div>
            `).join('')}
          </div>
          <div style="display:flex;flex-direction:column;gap:12px;">
            <div>
              <h1 class="title-outline">${title}</h1>
              <div style="display:inline-block;margin-top:6px;padding:6px 16px;border-radius:10px;background:${theme.accent};color:#ffffff;font-size:20px;font-weight:800;">${ribbon}</div>
            </div>
            <div style="background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:16px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;">
              ${renderIngredientsBullets(groups, theme, ingFontPx - 1, 9)}
              ${productChipHtml}
            </div>
            <div style="flex:1;background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:16px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;">
              <div><span style="display:inline-block;padding:4px 14px;border-radius:8px;background:${theme.primary};color:#ffffff;font-size:19px;font-weight:800;">Cara Membuat :</span></div>
              ${stepRows}
            </div>
            ${footerHtml}
          </div>
        </div>
      `;
      break;
    }

    case 'visual_ingredient_shelf': {
      const shelfItems = flatItems.slice(0, 6).map(it => `
        <div style="padding:7px 10px;border-radius:10px;background:#fff8eb;border:1.5px solid ${theme.cardBorder};font-size:17px;font-weight:700;color:${theme.textMain};display:flex;align-items:center;gap:8px;">
          <span style="width:10px;height:10px;border-radius:50%;background:${theme.primary};flex-shrink:0;"></span>
          <span>${escapeHtml(it)}</span>
        </div>
      `).join('');
      const visibleSteps = steps.slice(0, 6);
      const cols = visibleSteps.length <= 4 ? 2 : 3;
      const stepImgH = aspectRatio === '1:1' ? 120 : (cols === 2 ? 185 : 155);
      const stepCards = visibleSteps.map((s, idx) => `
        <div style="background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:12px;overflow:hidden;display:flex;flex-direction:column;">
          <div style="position:relative;height:${stepImgH}px;">
            ${renderImgTag(stepDataUris[idx] || heroDataUri, `Langkah ${idx + 1}`, `Langkah ${idx + 1}`, theme)}
            <span style="position:absolute;top:7px;left:7px;width:28px;height:28px;border-radius:50%;background:${theme.gold};color:#1f1408;border:2px solid #ffffff;font-size:16px;font-weight:900;display:flex;align-items:center;justify-content:center;">${idx + 1}</span>
          </div>
          <div style="padding:7px 9px;font-size:16px;line-height:1.25;font-weight:700;text-align:center;color:${theme.textMain};">${escapeHtml(s.caption)}</div>
        </div>
      `).join('');

      bodyInnerHtml = `
        <div style="text-align:center;">
          <h1 class="title-outline">${title}</h1>
          <div style="display:inline-block;margin-top:6px;padding:6px 18px;border-radius:10px;background:${theme.accent};color:#ffffff;font-size:20px;font-weight:800;">${ribbon} · ${hook}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:stretch;">
          <div style="background:${theme.cardBg};border:2.5px solid ${theme.cardBorder};border-radius:18px;padding:12px 14px;display:flex;flex-direction:column;gap:7px;">
            <div><span style="display:inline-block;padding:4px 14px;border-radius:10px;background:${theme.primary};color:#ffffff;font-size:19px;font-weight:800;">Rak Bahan :</span></div>
            ${shelfItems}
            ${productChipHtml}
          </div>
          <div style="position:relative;min-height:${aspectRatio === '1:1' ? 210 : 270}px;border-radius:18px;overflow:hidden;border:5px solid #ffffff;box-shadow:0 8px 22px rgba(0,0,0,0.14);">
            ${renderImgTag(heroDataUri, rawTitle, rawTitle, theme)}
            <div style="position:absolute;bottom:10px;left:10px;padding:5px 12px;border-radius:8px;background:rgba(255,255,255,0.94);color:${theme.textMain};font-size:16px;font-weight:800;">${metaText}</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;flex:1;">
          <div><span style="display:inline-block;padding:5px 16px;border-radius:10px;background:${theme.primary};color:#ffffff;font-size:20px;font-weight:800;">Cara Membuat :</span></div>
          <div style="display:grid;grid-template-columns:repeat(${cols}, minmax(0, 1fr));gap:10px;">
            ${stepCards}
          </div>
        </div>
        ${footerHtml}
      `;
      break;
    }

    case 'step_timeline_zigzag': {
      const timelineSteps = steps.slice(0, 4).map((s, idx) => {
        const isEven = idx % 2 === 1;
        const photoBox = `<div style="width:170px;height:${aspectRatio === '1:1' ? 92 : 118}px;border-radius:12px;overflow:hidden;border:3px solid #ffffff;box-shadow:0 4px 10px rgba(0,0,0,0.1);flex-shrink:0;">${renderImgTag(stepDataUris[idx] || heroDataUri, `Langkah ${idx + 1}`, `Step ${idx + 1}`, theme)}</div>`;
        const textBox = `<div style="flex:1;font-size:19px;line-height:1.3;font-weight:700;color:${theme.textMain};">${escapeHtml(s.caption)}</div>`;
        return `
          <div style="background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-left:8px solid ${theme.primary};border-radius:14px;padding:8px 14px;display:flex;align-items:center;gap:14px;">
            <span style="width:34px;height:34px;border-radius:50%;background:${theme.gold};color:#1f1408;font-size:19px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${idx + 1}</span>
            ${isEven ? textBox + photoBox : photoBox + textBox}
          </div>
        `;
      }).join('');

      bodyInnerHtml = `
        <div style="display:grid;grid-template-columns:1.25fr 0.75fr;gap:16px;align-items:center;">
          <div>
            <h1 class="title-outline">${title}</h1>
            <div style="display:inline-block;margin-top:6px;padding:6px 16px;border-radius:10px;background:${theme.accent};color:#ffffff;font-size:20px;font-weight:800;">${ribbon}</div>
          </div>
          <div style="position:relative;height:${aspectRatio === '1:1' ? 160 : 195}px;border-radius:18px;overflow:hidden;border:5px solid #ffffff;box-shadow:0 8px 20px rgba(0,0,0,0.14);">
            ${renderImgTag(heroDataUri, rawTitle, rawTitle, theme)}
            <div style="position:absolute;bottom:8px;left:8px;padding:4px 10px;border-radius:8px;background:rgba(255,255,255,0.94);color:${theme.textMain};font-size:15px;font-weight:800;">${metaText}</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;flex:1;">
          ${timelineSteps}
        </div>
        <div style="background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:14px;padding:10px 14px;display:flex;flex-direction:column;gap:6px;">
          <div><span style="display:inline-block;padding:3px 12px;border-radius:8px;background:${theme.primary};color:#ffffff;font-size:18px;font-weight:800;">Bahan :</span> <span style="font-size:17px;font-weight:600;color:${theme.textMain};margin-left:6px;">${flatItems.map(i => escapeHtml(i)).join(' · ')}</span></div>
          ${productChipHtml}
        </div>
        ${footerHtml}
      `;
      break;
    }

    case 'polaroid_scrapbook': {
      const procImgs = [0, 1, 2].map(i => stepDataUris[i] || heroDataUri);
      const stepRows = steps.slice(0, 5).map((s, idx) => `
        <div style="display:flex;align-items:flex-start;gap:10px;font-size:18px;line-height:1.3;font-weight:600;color:${theme.textMain};">
          <span style="width:28px;height:28px;border-radius:50%;background:${theme.primary};color:#ffffff;font-size:16px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${idx + 1}</span>
          <span>${escapeHtml(s.caption)}</span>
        </div>
      `).join('');

      bodyInnerHtml = `
        <div style="text-align:center;">
          <h1 class="title-outline">${title}</h1>
          <div style="display:inline-block;margin-top:6px;padding:6px 18px;border-radius:10px;background:${theme.accent};color:#ffffff;font-size:20px;font-weight:800;">${ribbon}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;flex:1;align-items:stretch;">
          <div style="display:flex;flex-direction:column;gap:18px;justify-content:center;padding:6px;">
            <div style="background:#ffffff;padding:12px 12px 26px;border-radius:6px;box-shadow:0 10px 24px rgba(0,0,0,0.16);transform:rotate(-2deg);">
              <div style="height:${aspectRatio === '1:1' ? 220 : 320}px;overflow:hidden;border-radius:3px;">
                ${renderImgTag(heroDataUri, rawTitle, rawTitle, theme)}
              </div>
              <div style="text-align:center;margin-top:10px;font-size:18px;font-weight:800;color:#2c1e16;">${metaText}</div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:10px;">
              ${procImgs.map((u, idx) => `
                <div style="background:#ffffff;padding:6px 6px 16px;border-radius:5px;box-shadow:0 6px 14px rgba(0,0,0,0.12);transform:rotate(${idx === 1 ? '2deg' : '-1.5deg'});position:relative;">
                  <div style="height:${aspectRatio === '1:1' ? 90 : 120}px;overflow:hidden;border-radius:2px;">
                    ${renderImgTag(u, `Proses ${idx + 1}`, `${idx + 1}`, theme)}
                  </div>
                  <span style="position:absolute;top:-6px;left:-6px;width:26px;height:26px;border-radius:50%;background:${theme.gold};color:#1f1408;border:2px solid #ffffff;font-size:15px;font-weight:900;display:flex;align-items:center;justify-content:center;">${idx + 1}</span>
                </div>
              `).join('')}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px;">
            <div style="background:${theme.cardBg};border:2.5px dashed ${theme.cardBorder};border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:6px;">
              ${renderIngredientsBullets(groups, theme, ingFontPx - 1, 9)}
              ${productChipHtml}
            </div>
            <div style="flex:1;background:${theme.cardBg};border:2.5px dashed ${theme.cardBorder};border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:8px;">
              <div><span style="display:inline-block;padding:4px 14px;border-radius:8px;background:${theme.primary};color:#ffffff;font-size:19px;font-weight:800;">Cara Membuat :</span></div>
              ${stepRows}
            </div>
          </div>
        </div>
        ${footerHtml}
      `;
      break;
    }

    case 'compact_2col_cheat_sheet': {
      const bannerH = aspectRatio === '1:1' ? 280 : 370;
      const stepRows = steps.slice(0, 6).map((s, idx) => `
        <div style="display:flex;align-items:flex-start;gap:10px;font-size:19px;line-height:1.32;font-weight:600;color:${theme.textMain};">
          <span style="width:30px;height:30px;border-radius:50%;background:${theme.primary};color:#ffffff;font-size:17px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${idx + 1}</span>
          <span>${escapeHtml(s.caption)}</span>
        </div>
      `).join('');

      bodyInnerHtml = `
        <div style="position:relative;height:${bannerH}px;border-radius:20px;overflow:hidden;border:5px solid #ffffff;box-shadow:0 10px 26px rgba(0,0,0,0.16);">
          ${renderImgTag(heroDataUri, rawTitle, rawTitle, theme)}
          <div style="position:absolute;inset:auto 0 0 0;padding:24px 24px 18px;background:linear-gradient(180deg, rgba(16,10,6,0.05) 0%, rgba(16,10,6,0.88) 100%);">
            <h1 style="font-family:'Fredoka',sans-serif;font-size:${titleFontPx}px;line-height:1.05;color:#ffffff;text-shadow:0 2px 8px rgba(0,0,0,0.4);">${title}</h1>
            <div style="margin-top:6px;font-size:21px;font-weight:800;color:#fde68a;">${ribbon} · ${metaText}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:0.92fr 1.08fr;gap:16px;flex:1;align-items:stretch;">
          <div style="background:${theme.cardBg};border:2.5px solid ${theme.cardBorder};border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:8px;">
            ${renderIngredientsBullets(groups, theme, ingFontPx)}
            ${productChipHtml}
          </div>
          <div style="background:${theme.cardBg};border:2.5px solid ${theme.cardBorder};border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:10px;">
            <div><span style="display:inline-block;padding:5px 16px;border-radius:10px;background:${theme.primary};color:#ffffff;font-size:20px;font-weight:800;">Langkah Cepat :</span></div>
            ${stepRows}
          </div>
        </div>
        ${footerHtml}
      `;
      break;
    }

    case 'step_grid_classic':
    default: {
      const visibleSteps = steps.slice(0, 6);
      const cols = visibleSteps.length <= 4 ? 2 : 3;
      const stepImgH = aspectRatio === '1:1'
        ? (cols === 2 ? 140 : 110)
        : (aspectRatio === '4:5' ? (cols === 2 ? 178 : 142) : (cols === 2 ? 210 : 175));
      const stepFont = cols === 2 ? 19 : 17;
      const cardsHtml = visibleSteps.map((s, idx) => {
        const sUri = stepDataUris[idx] || heroDataUri;
        return `
          <div style="background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:14px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
            <div style="position:relative;height:${stepImgH}px;">
              ${renderImgTag(sUri, `Langkah ${idx + 1}`, `Langkah ${idx + 1}`, theme)}
              <span style="position:absolute;top:8px;left:8px;width:32px;height:32px;border-radius:50%;background:${theme.gold};color:#1f1408;border:2px solid #ffffff;font-size:18px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.2);">${idx + 1}</span>
            </div>
            <div style="padding:7px 10px;font-size:${stepFont}px;line-height:1.25;font-weight:700;color:${theme.textMain};text-align:center;">
              ${escapeHtml(s.caption)}
            </div>
          </div>
        `;
      }).join('');

      bodyInnerHtml = `
        <div style="display:grid;grid-template-columns:1.12fr 0.88fr;gap:16px;align-items:stretch;">
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div>
              <h1 class="title-outline">${title}</h1>
              <div style="display:inline-block;margin-top:7px;padding:6px 18px;border-radius:10px;background:${theme.accent};color:#ffffff;font-size:21px;font-weight:800;box-shadow:0 4px 10px rgba(0,0,0,0.14);">${ribbon}</div>
              <div style="display:inline-block;margin-top:7px;padding:4px 14px;border-radius:10px;background:#fff6cf;border:2px dashed ${theme.gold};color:#4a3518;font-size:17px;font-weight:700;">${hook}</div>
            </div>
            <div style="position:relative;flex:1;min-height:${heroMinH}px;border-radius:20px;overflow:hidden;border:5px solid #ffffff;box-shadow:0 10px 26px rgba(44,30,22,0.16);background:#e9d8c2;">
              ${renderImgTag(heroDataUri, rawTitle, rawTitle, theme)}
              <div style="position:absolute;bottom:12px;left:12px;padding:6px 14px;border-radius:10px;background:rgba(255,255,255,0.94);color:${theme.textMain};font-size:17px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,0.12);">${metaText}</div>
            </div>
          </div>
          <div style="background:${theme.cardBg};border:2.5px solid ${theme.cardBorder};border-radius:20px;padding:15px 18px;display:flex;flex-direction:column;gap:8px;box-shadow:0 8px 20px rgba(0,0,0,0.06);">
            ${renderIngredientsBullets(groups, theme, ingFontPx)}
            ${productChipHtml}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;flex:1;">
          <div>
            <span style="display:inline-block;padding:6px 18px;border-radius:12px;background:${theme.primary};color:#ffffff;font-size:22px;font-weight:800;">Cara Membuat :</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(${cols}, minmax(0, 1fr));gap:10px;">
            ${cardsHtml}
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
    width: ${dim.width}px;
    height: ${dim.height}px;
    overflow: hidden;
    font-family: 'Plus Jakarta Sans', 'Nunito', 'Hiragino Sans', system-ui, -apple-system, sans-serif;
    background: ${theme.bgGradient};
    color: ${theme.textMain};
    padding: 20px 24px 26px;
    display: flex;
    flex-direction: column;
    gap: 11px;
  }
  .title-outline {
    font-family: 'Fredoka', 'Plus Jakarta Sans', 'Hiragino Maru Gothic ProN', system-ui, sans-serif;
    font-weight: 800;
    font-size: ${titleFontPx}px;
    line-height: 1.04;
    color: ${theme.primary};
    text-shadow: 0 3px 0 #ffffff, 3px 0 0 #ffffff, -3px 0 0 #ffffff, 0 -3px 0 #ffffff, 2px 2px 0 #ffffff, -2px -2px 0 #ffffff, 2px -2px 0 #ffffff, -2px 2px 0 #ffffff;
  }
</style>
</head>
<body>
${bodyInnerHtml}
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
