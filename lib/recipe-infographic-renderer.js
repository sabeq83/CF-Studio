import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export const INFOGRAPHIC_LAYOUT_DIMENSIONS = {
  '4:5': { width: 1080, height: 1350 },
  '3:4': { width: 1080, height: 1440 },
  '1:1': { width: 1080, height: 1080 }
};

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

function fileToDataUri(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const buf = fs.readFileSync(filePath);
  const lower = filePath.toLowerCase();
  const mime = lower.endsWith('.png') ? 'image/png' : (lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
  return `data:${mime};base64,${buf.toString('base64')}`;
}

/**
 * Pure HTML builder for the recipe infographic poster (testable offline without Playwright).
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
  const template = config.template || 'infographic_step_grid';
  const showWatermark = config.showBrandWatermark !== false && Boolean(String(config.brandWatermarkText || '').trim());
  const watermarkText = String(config.brandWatermarkText || '').trim();

  const title = escapeHtml(data.title || 'Resep Spesial Rumahan');
  const ribbon = escapeHtml(data.subtitle_ribbon || 'Lezat, Praktis, Bikin Nagih!');
  const hook = escapeHtml(data.hook_badge || 'Cocok untuk Sajian Keluarga');
  const metaText = escapeHtml([data.servings, data.cook_time || data.prep_time].filter(Boolean).join(' · ') || '4 Porsi');
  const groups = Array.isArray(data.ingredients_groups) ? data.ingredients_groups : [];
  const flatIngCount = groups.reduce((acc, g) => acc + (Array.isArray(g.items) ? g.items.length : 0), 0);
  const ingFontPx = flatIngCount > 10 ? 18 : (flatIngCount > 7 ? 20 : 22);
  const steps = Array.isArray(data.steps) ? data.steps : [];
  const tips = Array.isArray(data.tips) ? data.tips : [];
  const ctaBadge = escapeHtml(data.cta_badge || 'Selamat Mencoba!');
  const optionalProduct = data.optional_product_name ? escapeHtml(data.optional_product_name) : '';

  const heroImgHtml = heroDataUri
    ? `<img src="${heroDataUri}" alt="${title}" style="width:100%;height:100%;object-fit:cover;display:block;" />`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#e8d7c1;color:${theme.textMuted};font-weight:700;font-size:24px;padding:20px;text-align:center;">${title}</div>`;

  const ingredientsHtml = groups.map(g => {
    const gTitle = escapeHtml(g.group_title || 'Bahan-bahan');
    const itemsHtml = (Array.isArray(g.items) ? g.items : []).map(item => `
      <li style="margin-bottom:4px;display:flex;align-items:flex-start;gap:8px;">
        <span style="color:${theme.primary};font-weight:900;flex-shrink:0;">•</span>
        <span>${escapeHtml(item)}</span>
      </li>
    `).join('');
    return `
      <div style="margin-bottom:8px;">
        <div style="display:inline-block;padding:5px 16px;border-radius:12px;background:${theme.primary};color:#ffffff;font-size:21px;font-weight:800;margin-bottom:8px;">${gTitle} :</div>
        <ul style="list-style:none;margin:0;padding:0;font-size:${ingFontPx}px;line-height:1.36;color:${theme.textMain};font-weight:600;">
          ${itemsHtml}
        </ul>
      </div>
    `;
  }).join('');

  const productChipHtml = optionalProduct
    ? `<div style="margin-top:auto;padding:8px 12px;border-radius:10px;background:#fff3d7;border:2px solid ${theme.gold};color:#5c3a04;font-size:17px;font-weight:700;">Pakai: ${optionalProduct}</div>`
    : '';

  let stepsSectionHtml = '';
  if (template === 'infographic_text_steps') {
    const secImg = secondaryDataUri || heroDataUri;
    const rowsHtml = steps.slice(0, 4).map((s, idx) => `
      <div style="display:flex;align-items:flex-start;gap:12px;background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:14px;padding:12px 14px;">
        <span style="width:34px;height:34px;border-radius:50%;background:${theme.primary};color:#ffffff;font-size:20px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${idx + 1}</span>
        <span style="font-size:21px;line-height:1.35;font-weight:600;color:${theme.textMain};">${escapeHtml(s.caption)}</span>
      </div>
    `).join('');

    stepsSectionHtml = `
      <div style="display:grid;grid-template-columns:1.35fr 0.65fr;gap:16px;align-items:stretch;flex:1;">
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${rowsHtml}
        </div>
        <div style="border-radius:18px;overflow:hidden;border:4px solid #ffffff;box-shadow:0 8px 20px rgba(0,0,0,0.12);background:#ead8c0;">
          ${secImg ? `<img src="${secImg}" alt="${title}" style="width:100%;height:100%;object-fit:cover;display:block;" />` : heroImgHtml}
        </div>
      </div>
    `;
  } else {
    const visibleSteps = steps.slice(0, 6);
    const cols = visibleSteps.length <= 4 ? 2 : 3;
    const stepImgH = aspectRatio === '1:1' ? (cols === 2 ? 150 : 120) : (cols === 2 ? 210 : 175);
    const stepFont = cols === 2 ? 19 : 17;
    const cardsHtml = visibleSteps.map((s, idx) => {
      const sUri = stepDataUris[idx] || heroDataUri;
      const thumb = sUri
        ? `<img src="${sUri}" alt="Langkah ${idx + 1}" style="width:100%;height:${stepImgH}px;object-fit:cover;display:block;" />`
        : `<div style="width:100%;height:${stepImgH}px;background:#ead8c0;display:flex;align-items:center;justify-content:center;font-weight:700;color:${theme.textMuted};">Langkah ${idx + 1}</div>`;
      return `
        <div style="background:${theme.cardBg};border:2px solid ${theme.cardBorder};border-radius:14px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
          <div style="position:relative;">
            ${thumb}
            <span style="position:absolute;top:8px;left:8px;width:32px;height:32px;border-radius:50%;background:${theme.gold};color:#1f1408;border:2px solid #ffffff;font-size:18px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.2);">${idx + 1}</span>
          </div>
          <div style="padding:8px 10px;font-size:${stepFont}px;line-height:1.28;font-weight:700;color:${theme.textMain};text-align:center;">
            ${escapeHtml(s.caption)}
          </div>
        </div>
      `;
    }).join('');

    stepsSectionHtml = `
      <div style="display:grid;grid-template-columns:repeat(${cols}, minmax(0, 1fr));gap:12px;">
        ${cardsHtml}
      </div>
    `;
  }

  const tipsHtml = tips.map(t => `
    <li style="margin-bottom:4px;display:flex;align-items:flex-start;gap:8px;">
      <span style="color:${theme.accent};font-weight:900;flex-shrink:0;">✓</span>
      <span>${escapeHtml(t)}</span>
    </li>
  `).join('');

  const watermarkHtml = showWatermark
    ? `<div style="padding:7px 16px;border-radius:10px;background:rgba(21,32,51,0.9);color:#ffffff;font-size:19px;font-weight:800;letter-spacing:0.01em;box-shadow:0 4px 12px rgba(0,0,0,0.18);">${escapeHtml(watermarkText)}</div>`
    : '';

  const heroMinH = aspectRatio === '1:1' ? 250 : 350;

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
    padding: 26px 28px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .title-outline {
    font-family: 'Fredoka', 'Plus Jakarta Sans', 'Hiragino Maru Gothic ProN', system-ui, sans-serif;
    font-weight: 800;
    font-size: ${title.length > 26 ? 48 : 58}px;
    line-height: 1.04;
    color: ${theme.primary};
    text-shadow: 0 3px 0 #ffffff, 3px 0 0 #ffffff, -3px 0 0 #ffffff, 0 -3px 0 #ffffff, 2px 2px 0 #ffffff, -2px -2px 0 #ffffff, 2px -2px 0 #ffffff, -2px 2px 0 #ffffff;
  }
</style>
</head>
<body>
  <div style="display:grid;grid-template-columns:1.12fr 0.88fr;gap:18px;align-items:stretch;">
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div>
        <h1 class="title-outline">${title}</h1>
        <div style="display:inline-block;margin-top:8px;padding:7px 20px;border-radius:10px;background:${theme.accent};color:#ffffff;font-size:22px;font-weight:800;box-shadow:0 4px 10px rgba(0,0,0,0.14);">${ribbon}</div>
        <div style="display:inline-block;margin-top:8px;padding:5px 14px;border-radius:10px;background:#fff6cf;border:2px dashed ${theme.gold};color:#4a3518;font-size:18px;font-weight:700;">${hook}</div>
      </div>
      <div style="position:relative;flex:1;min-height:${heroMinH}px;border-radius:20px;overflow:hidden;border:5px solid #ffffff;box-shadow:0 10px 26px rgba(44,30,22,0.16);background:#e9d8c2;">
        ${heroImgHtml}
        <div style="position:absolute;bottom:12px;left:12px;padding:6px 14px;border-radius:10px;background:rgba(255,255,255,0.94);color:${theme.textMain};font-size:17px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,0.12);">${metaText}</div>
      </div>
    </div>

    <div style="background:${theme.cardBg};border:2.5px solid ${theme.cardBorder};border-radius:20px;padding:16px 18px;display:flex;flex-direction:column;gap:8px;box-shadow:0 8px 20px rgba(0,0,0,0.06);">
      ${ingredientsHtml}
      ${productChipHtml}
    </div>
  </div>

  <div style="display:flex;flex-direction:column;gap:10px;flex:1;">
    <div>
      <span style="display:inline-block;padding:6px 20px;border-radius:12px;background:${theme.primary};color:#ffffff;font-size:23px;font-weight:800;">Cara Membuat :</span>
    </div>
    ${stepsSectionHtml}
  </div>

  <div style="display:grid;grid-template-columns:1.38fr 0.62fr;gap:16px;align-items:end;margin-top:auto;">
    <div style="background:${theme.cardBg};border:2.5px dashed ${theme.accent};border-radius:16px;padding:12px 16px;">
      <span style="display:inline-block;padding:4px 14px;border-radius:8px;background:${theme.accent};color:#ffffff;font-size:19px;font-weight:800;margin-bottom:6px;">Tips :</span>
      <ul style="list-style:none;margin:0;padding:0;font-size:18px;line-height:1.34;font-weight:600;color:${theme.textMain};">
        ${tipsHtml}
      </ul>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;">
      <div style="padding:12px 22px;border-radius:16px;background:${theme.accent};color:#ffffff;font-family:'Fredoka',sans-serif;font-size:28px;font-weight:800;text-align:center;transform:rotate(-2deg);box-shadow:0 6px 16px rgba(0,0,0,0.16);">${ctaBadge}</div>
      ${watermarkHtml}
    </div>
  </div>
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

  console.log(`[Infographic Renderer] Rendered ${aspectRatio} poster to: ${outputPath}`);
  return outputPath;
}
