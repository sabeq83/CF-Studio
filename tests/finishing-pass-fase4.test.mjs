import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  SUBTITLE_CONNECTOR_WORDS,
  collectProtectedSubtitlePhrases,
  measureChunkWidthCqw,
  chunkCaptionWords as pureChunkCaptionWords
} from '../lib/subtitle-chunker.js';
import {
  chunkCaptionWords,
  buildGlobalOverlayFrameSvg,
  renderGlobalTimelineOverlay,
  generateMotionTextFrames
} from '../lib/motion-text-engine.js';
import { buildPhase1Timeline, resolveFinishingTemplatePath } from '../lib/finishing-overlay-renderer.js';
import { buildPreviewTimeline } from '../lib/finishing-preview-builder.js';
import { measureFontTextWidth } from '../lib/motion-font-loader.js';
import { closePgPool } from '../lib/db-pg.js';

test.after(async () => {
  await closePgPool();
});

const ALL_EIGHT_TEMPLATES = [
  'base-caption.html',
  'calm-wellness.html',
  'recipe-pop.html',
  'tips-listicle.html',
  'ramuan-ritual.html',
  'problem-solution.html',
  'angka-banding.html',
  'mitos-fakta.html'
];

function makeTimedWords(tokens, { step = 0.36, clipIndex = 0, startAt = 0.2 } = {}) {
  return tokens.map((w, idx) => ({
    w,
    s: Number((startAt + idx * step).toFixed(3)),
    e: Number((startAt + idx * step + step * 0.85).toFixed(3)),
    c: clipIndex,
    originalIndex: idx
  }));
}

test('F4 (R14): Seluruh 8 template HTML bersih dari CSS .sub ukuran font & joinedLen, dan memakai shared-layers.js', () => {
  const slPath = path.join(process.cwd(), 'templates', 'finishing', 'shared-layers.js');
  const slContent = fs.readFileSync(slPath, 'utf8');
  assert.match(slContent, /\.sub\.s-yellow\b/);
  assert.match(slContent, /\.sub\.s-pill\b/);
  assert.match(slContent, /\.sub\.s-minimal\b/);
  assert.match(slContent, /\.sub-band\b/);
  assert.match(slContent, /function renderSubtitle\b/);
  assert.equal(/joinedLen/i.test(slContent), false);

  for (const file of ALL_EIGHT_TEMPLATES) {
    const html = fs.readFileSync(path.join(process.cwd(), 'templates', 'finishing', file), 'utf8');
    assert.match(html, /<style\s+id="shared-layers-css"><\/style>/, `${file} missing #shared-layers-css`);
    assert.match(html, /<script\s+src="\.\/shared-layers\.js"><\/script>/, `${file} missing shared-layers.js script`);
    assert.match(html, /SL\.renderSubtitle\(/, `${file} should call SL.renderSubtitle`);
    assert.equal(/joinedLen/i.test(html), false, `${file} still contains joinedLen`);
    assert.equal(/\.sub(?!-)[^{]*\{[^}]*font-size\s*:/s.test(html), false, `${file} still contains inline .sub font-size`);
    assert.equal(/\.sub\.(?:pill-mode|minimal-mode)/i.test(html), false, `${file} still contains legacy subtitle classes`);
    assert.equal(/--sub-size/.test(html), false, `${file} still contains inline --sub-size`);
  }
});

test('F4 (R15.1-R15.5): chunkCaptionWords pada transkrip opc_2107, opc_1756, mul_261113_nfrdfh menjaga frasa terlindungi & batas alami', () => {
  // 1. opc_2107 (Solusi Thermal ID)
  const thermalTokens = 'Pasang Alum Thermal Bubble Foil di atap rumah agar listrik AC jauh lebih hemat setiap hari.'.split(/\s+/);
  const thermalWords = makeTimedWords(thermalTokens);
  const thermalProtected = collectProtectedSubtitlePhrases({
    brand: { name: 'Solusi Thermal ID' },
    productData: { product_name: 'Alum Thermal Bubble Foil', spesifikasi_produk: 'Listrik AC hemat' }
  });
  const thermalChunks = chunkCaptionWords(thermalWords, { protectedPhrases: thermalProtected });
  const thermalStrings = thermalChunks.map((ch) => ch.map((w) => w.w).join(' '));
  assert.ok(
    thermalStrings.some((s) => /Alum Thermal/i.test(s)),
    `Alum Thermal should stay together, got: ${JSON.stringify(thermalStrings)}`
  );
  assert.ok(
    thermalStrings.some((s) => /Bubble Foil/i.test(s)),
    `Bubble Foil should stay together, got: ${JSON.stringify(thermalStrings)}`
  );
  assert.ok(
    thermalStrings.some((s) => /listrik AC/i.test(s)),
    `listrik AC should stay together, got: ${JSON.stringify(thermalStrings)}`
  );

  // 2. opc_1756 (Sasyahouse) — "Di titik ini,", "dana darurat", "sepuluh persen"
  const sasyaTokens = 'Di titik ini, kamu wajib siapkan dana darurat minimal sepuluh persen dari gaji bulanan sekarang.'.split(/\s+/);
  const sasyaWords = makeTimedWords(sasyaTokens);
  const sasyaProtected = collectProtectedSubtitlePhrases({
    finishingPlan: {
      punches: [{ phrase: 'dana darurat' }],
      numbers: [{ trigger: 'sepuluh persen' }]
    }
  });
  const sasyaChunks = chunkCaptionWords(sasyaWords, { protectedPhrases: sasyaProtected });
  const sasyaStrings = sasyaChunks.map((ch) => ch.map((w) => w.w).join(' '));
  assert.ok(
    sasyaStrings.some((s) => s === 'Di titik ini,'),
    `"Di titik ini," must stay intact ('ini' is not a connector), got: ${JSON.stringify(sasyaStrings)}`
  );
  assert.ok(
    sasyaStrings.some((s) => /dana darurat/i.test(s)),
    `dana darurat must stay intact, got: ${JSON.stringify(sasyaStrings)}`
  );
  assert.ok(
    sasyaStrings.some((s) => /sepuluh persen/i.test(s)),
    `sepuluh persen must stay intact, got: ${JSON.stringify(sasyaStrings)}`
  );

  // 3. mul_261113_nfrdfh (Rempah) — "api kecil", "tutup panci", "jahe merah", "minyak atsiri"
  const rempahTokens = 'Rebus jahe merah pakai api kecil lalu tutup panci supaya minyak atsiri tetap terjaga.'.split(/\s+/);
  const rempahWords = makeTimedWords(rempahTokens);
  const rempahProtected = collectProtectedSubtitlePhrases({
    recipe: { ingredients: { items: [{ label: '2 ruas jahe merah' }, { label: 'minyak atsiri' }] } },
    finishingPlan: {
      timing_badges: [{ trigger: 'api kecil', label: 'API KECIL' }, { trigger: 'tutup panci', label: 'TUTUP PANCI' }]
    }
  });
  const rempahChunks = chunkCaptionWords(rempahWords, { protectedPhrases: rempahProtected });
  const rempahStrings = rempahChunks.map((ch) => ch.map((w) => w.w).join(' '));
  for (const phrase of ['jahe merah', 'api kecil', 'tutup panci', 'minyak atsiri']) {
    assert.ok(
      rempahStrings.some((s) => s.toLowerCase().includes(phrase)),
      `"${phrase}" must stay together, got: ${JSON.stringify(rempahStrings)}`
    );
  }
});

test('F4 (R15.4, R15.6, R15.7): Zero dangling connector, <0.45s merge (non cross-clip), & >88cqw split', () => {
  // Trailing connector check ("atau", "untuk", "dan")
  const connTokens = 'Pilih langkah tepat atau teknik lembut dan hasil aman untuk keseharian'.split(/\s+/);
  const connChunks = chunkCaptionWords(makeTimedWords(connTokens));
  for (let k = 0; k < connChunks.length - 1; k++) {
    const cur = connChunks[k];
    const next = connChunks[k + 1];
    if (cur.length > 1 && next.length < 3) {
      const tailNorm = cur[cur.length - 1].w.toLowerCase().replace(/[^a-z]/g, '');
      const joinedIfMoved = `${cur[cur.length - 1].w} ${next.map((w) => w.w).join(' ')}`;
      if (joinedIfMoved.length <= 16) {
        assert.equal(
          SUBTITLE_CONNECTOR_WORDS.has(tailNorm),
          false,
          `Chunk "${cur.map((x) => x.w).join(' ')}" should not end on connector "${tailNorm}" before "${next.map((x) => x.w).join(' ')}"`
        );
      }
    }
  }

  // < 0.45s short chunk merge within same clip, but NOT across clip boundary
  const shortWords = [
    { w: 'Fokus', s: 0.10, e: 0.30, c: 0 },
    { w: 'harian,', s: 0.31, e: 0.90, c: 0 },
    { w: 'Cepat', s: 1.00, e: 1.22, c: 0 }, // < 0.45s next clip differs!
    { w: 'Tepat', s: 1.30, e: 1.85, c: 1 }
  ];
  const mergedChunks = chunkCaptionWords(shortWords);
  assert.equal(mergedChunks[0].map((x) => x.w).join(' '), 'Fokus harian,');
  assert.equal(mergedChunks[1].map((x) => x.w).join(' '), 'Cepat');
  assert.equal(mergedChunks[2].map((x) => x.w).join(' '), 'Tepat');

  // > 88cqw multi-word chunk splits cleanly, while wide 16-char single word shrinks cleanly <= 88cqw (>= 6cqw floor)
  const wideWords = [
    { w: 'PERBANDINGAN', s: 0.2, e: 0.7, c: 0 },
    { w: 'KESEIMBANGAN', s: 0.7, e: 1.2, c: 0 },
    { w: 'BERTANGGUNGJAWAB', s: 1.4, e: 2.3, c: 0 }
  ];
  for (const style of ['floating_white_yellow', 'floating_black_on_white', 'minimal_white']) {
    const wideChunks = chunkCaptionWords(wideWords, { style, width: 720, enforceWidthSplit: true });
    for (const ck of wideChunks) {
      const usedCqw = ck.length === 1 ? (ck.fontCqw || ck[0]?.singleWordFontCqw || null) : null;
      const wCqw = measureChunkWidthCqw(ck, { style, width: 720, fontCqw: usedCqw, measureTextWidth: measureFontTextWidth });
      assert.ok(wCqw <= 88.5, `Width exceeded 88cqw for style=${style}: ${wCqw.toFixed(2)}cqw (${ck.map((x) => x.w).join(' ')})`);
      if (usedCqw !== null) {
        assert.ok(usedCqw >= 6.0, `Single-word shrink below 6cqw minimum: ${usedCqw}`);
      }
    }
  }

  // Extreme >20 char single word hits the 6.0cqw floor without shrinking below 6cqw
  const extremeChunks = chunkCaptionWords([{ w: 'PERTANGGUNGJAWABANMU', s: 0.1, e: 1.0, c: 0 }], {
    style: 'floating_white_yellow',
    width: 720,
    enforceWidthSplit: true
  });
  assert.equal(extremeChunks.length, 1);
  assert.equal(extremeChunks[0].fontCqw, 6);
});

test('F4 (R15.5, R17.2): All 4 render paths wire protected phrases & Sharp/SVG matches 3 new styles', async () => {
  // Path 1: Playwright timeline builder (with validated punches + valid whitelisted timing_badges + recipe)
  const pWords = makeTimedWords('Gunakan api kecil lalu tutup panci lalu diamkan lima menit'.split(/\s+/));
  const tl = buildPhase1Timeline({
    wordEvents: pWords,
    finishingTemplate: 'ramuan_ritual',
    finishingPlan: {
      punches: [
        { phrase: 'API KECIL', type: 'benefit' },
        { phrase: 'TUTUP PANCI', type: 'result' }
      ],
      timing_badges: [
        { trigger: 'diamkan lima menit', label: 'DIAMKAN 5 MENIT', sub: 'Perlahan' }
      ]
    },
    productData: { product_name: 'Jahe Merah Pilihan' },
    cleanVoiceoverClips: ['Gunakan api kecil lalu tutup panci lalu diamkan lima menit']
  });
  const tlChunkStrings = tl.chunks.map((c) => c.indices.map((i) => tl.words[i].w).join(' ').toLowerCase());
  assert.ok(tlChunkStrings.some((s) => s.includes('api kecil')), `Got: ${JSON.stringify(tlChunkStrings)}`);
  assert.ok(tlChunkStrings.some((s) => s.includes('tutup panci')), `Got: ${JSON.stringify(tlChunkStrings)}`);
  assert.ok(tlChunkStrings.some((s) => s.includes('lima menit')), `Got: ${JSON.stringify(tlChunkStrings)}`);

  // Path 2 & 3: Sharp/SVG Global Timeline & Legacy generateMotionTextFrames
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfstudio-f4-'));
  try {
    for (const style of ['floating_white_yellow', 'floating_black_on_white', 'minimal_white']) {
      const svg = buildGlobalOverlayFrameSvg({
        width: 720,
        height: 1280,
        chunk: makeTimedWords(['Alum', 'Thermal']),
        activeWordIdxInChunk: 1,
        style,
        activeWordColor: '#ffd23f'
      });
      if (style === 'floating_black_on_white') {
        // Single white pill rect + dark shadow rect + 1 highlight rect (not per-word white pills)
        assert.match(svg, /rx="17"/); // Math.round(720 * 0.024) === 17
        assert.match(svg, /fill="#ffffff"/);
      } else if (style === 'minimal_white') {
        assert.match(svg, /id="minimal-band-grad"/);
        assert.match(svg, />Alum</); // normal case
        assert.match(svg, /fill="#ffd23f"/); // underline bar
      } else {
        assert.match(svg, /font-size="55px"/); // Math.round(720 * 0.076) === 55
        assert.match(svg, /stroke-width="11"/); // Math.round(720 * 0.015) === 11
      }
    }

    const globalRes = await renderGlobalTimelineOverlay({
      outputDir: path.join(tmpDir, 'global'),
      wordEvents: pWords,
      style: 'floating_black_on_white',
      protectedPhrases: ['api kecil', 'tutup panci'],
      totalDuration: 3.2
    });
    assert.equal(globalRes.success, true);

    const legacyRes = await generateMotionTextFrames({
      outputDir: path.join(tmpDir, 'legacy'),
      text: 'Rebus api kecil dan tutup panci',
      duration: 1.5,
      fps: 15,
      videoWidth: 720,
      videoHeight: 1280,
      style: 'minimal_white',
      protectedPhrases: ['api kecil', 'tutup panci']
    });
    assert.equal(legacyRes.success, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // Path 4: Live Preview builder uses chunkCaptionWords & #ffd23f default
  const preview = buildPreviewTimeline({
    templateId: 'angka_banding',
    brandName: 'Solusi Thermal ID',
    productName: 'Alum Thermal Foil',
    motionStyle: 'floating_black_on_white'
  });
  assert.equal(preview.config.activeWordColor, '#ffd23f');
  for (const ch of preview.chunks) {
    const chTxt = ch.indices.map((idx) => preview.words[idx]?.w || '').join(' ');
    assert.ok(ch.indices.length <= 4 && chTxt.length <= 24, `Preview chunk unexpectedly huge: ${chTxt}`);
  }
  // Ensure pureChunkCaptionWords imported cleanly as fallback
  assert.ok(pureChunkCaptionWords(['Satu', 'Dua', 'Tiga']).length === 1);
});

test('F4 (R16, R17.1, R17.3, R18): Chromium renders 3 styles <= 88cqw, 1 pill/chunk, dark accent contrast, & zero collision', async () => {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  const sampleWords = makeTimedWords(['Pasang', 'Alum', 'Thermal'], { startAt: 0.5, step: 0.4 });
  const fontUrl = pathToFileURL(path.join(process.cwd(), 'public', 'fonts')).href;

  try {
    const page = await browser.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 });

    // 1. Test all 3 styles on base-caption.html via real chunkCaptionWords pipeline
    for (const style of ['floating_white_yellow', 'floating_black_on_white', 'minimal_white']) {
      await page.goto(pathToFileURL(resolveFinishingTemplatePath('none')).href, { waitUntil: 'load' });
      const tl = buildPhase1Timeline({
        wordEvents: sampleWords,
        finishingTemplate: 'none',
        captionMode: 'full',
        style,
        productData: { product_name: 'Alum Thermal' },
        cleanVoiceoverClips: ['Pasang Alum Thermal'],
        totalDuration: 6,
        accentColor: '#ffd23f',
        activeWordColor: '#ffd23f'
      });
      tl.config.hookDuration = 0;
      tl.config.fontBaseUrl = fontUrl;
      await page.evaluate((payload) => window.loadTimeline(payload), tl);
      await page.evaluate(() => document.fonts.ready);

      // Early entrance frame on "Alum Thermal" chunk (lt = 0.02s -> scale < 1)
      const secondChunkStart = tl.chunks[tl.chunks.length - 1].s;
      await page.evaluate((t) => window.renderAt(t), secondChunkStart + 0.02);
      const earlyScale = await page.evaluate(() => {
        const sub = document.getElementById('oSub');
        const tr = getComputedStyle(sub).transform;
        const m = tr.match(/matrix\(([-\d.]+)/);
        return m ? parseFloat(m[1]) : 1;
      });
      assert.ok(earlyScale < 0.98, `${style} should animate scale in at 0.02s, got ${earlyScale}`);

      // Settled frame on active chunk
      await page.evaluate((t) => window.renderAt(t), secondChunkStart + 0.16);
      const metrics = await page.evaluate(() => {
        const sub = document.getElementById('oSub');
        const band = document.querySelector('.sub-band');
        const pillEl = sub.querySelector('.pill');
        const spans = Array.from(sub.querySelectorAll('span'));
        let contentWidthPx = 0;
        if (pillEl) {
          contentWidthPx = pillEl.getBoundingClientRect().width;
        } else if (spans.length > 0) {
          const lefts = spans.map((sp) => sp.getBoundingClientRect().left);
          const rights = spans.map((sp) => sp.getBoundingClientRect().right);
          contentWidthPx = Math.max(...rights) - Math.min(...lefts);
        } else {
          contentWidthPx = sub.getBoundingClientRect().width;
        }
        const spanTextTransform = getComputedStyle(sub).textTransform;
        return {
          widthPx: contentWidthPx,
          pillCount: sub.querySelectorAll('.pill').length,
          bandVisible: band ? !band.hidden : false,
          textTransform: spanTextTransform,
          activeText: spans.find((s) => s.classList.contains('on'))?.textContent || '',
          allText: spans.map((s) => s.textContent).join(' ')
        };
      });

      const maxPx = 720 * 0.88; // 633.6px
      assert.ok(metrics.widthPx <= maxPx, `${style} rendered width ${metrics.widthPx}px > 88cqw (${maxPx}px) for "${metrics.allText}"`);
      if (style === 'floating_black_on_white') {
        assert.equal(metrics.pillCount, 1, 's-pill must wrap chunk in exactly 1 .pill');
      } else if (style === 'minimal_white') {
        assert.equal(metrics.bandVisible, true, 's-minimal must show .sub-band');
        assert.equal(metrics.textTransform, 'none', 's-minimal must render normal case');
      } else {
        assert.equal(metrics.bandVisible, false, 's-yellow must hide .sub-band');
      }
      assert.equal(metrics.activeText, 'Alum');
    }

    // 2. Dark accent contrast guard (R16)
    await page.evaluate((payload) => window.loadTimeline(payload), {
      config: {
        width: 720,
        height: 1280,
        fps: 30,
        duration: 4,
        hookDuration: 0,
        style: 'floating_black_on_white',
        captionMode: 'full',
        accentColor: '#16222c',
        activeWordColor: '#16222c',
        fontBaseUrl: fontUrl
      },
      words: sampleWords,
      chunks: [{ s: 0.5, e: 1.5, indices: [0, 1, 2] }],
      punches: []
    });
    await page.evaluate(() => window.renderAt(0.75));
    const pillFg = await page.evaluate(() => {
      const onSpan = document.querySelector('#oSub .pill span.on');
      return onSpan ? getComputedStyle(onSpan).color : '';
    });
    assert.equal(pillFg, 'rgb(255, 255, 255)', 'Dark accent highlight must flip active word text to white');

    // 3. Collision checks (R17.3) on tips_listicle, ramuan_ritual, recipe_pop
    const collisionCases = [
      {
        tpl: 'tips_listicle',
        tChecks: [3.5, 5.2], // CTA + sub visible
        timeline: {
          config: { width: 720, height: 1280, duration: 8, hookDuration: 0, style: 'floating_black_on_white', captionMode: 'full', finishingTemplate: 'tips_listicle', sharedBrand: { enabled: true } },
          words: makeTimedWords(['Tiga', 'Tips', 'Hemat', 'Listrik', 'Rumah', 'Harian'], { startAt: 2.0, step: 0.6 }),
          chunks: [
            { s: 2.0, e: 4.0, indices: [0, 1, 2] },
            { s: 4.1, e: 6.2, indices: [3, 4, 5] }
          ],
          cta: { text: 'CEK LINK DI BIO SEKARANG', s: 2.5, e: 6.0 },
          tips: [{ n: 1, total: 3, text: 'Pasang insulasi atap rumah', s: 1.5, e: 4.5 }],
          punches: []
        }
      },
      {
        tpl: 'ramuan_ritual',
        tChecks: [2.8, 4.8], // x-notice + CTA + sub visible
        timeline: {
          config: { width: 720, height: 1280, duration: 8, hookDuration: 0, style: 'floating_black_on_white', captionMode: 'full', finishingTemplate: 'ramuan_ritual', sharedBrand: { enabled: true, safetyNotice: true } },
          brand: { safetyNotice: 'Konten edukasi minuman hangat tradisional harian.' },
          words: makeTimedWords(['Rebus', 'Api', 'Kecil', 'Lalu', 'Tutup', 'Panci'], { startAt: 2.0, step: 0.6 }),
          chunks: [
            { s: 2.0, e: 4.0, indices: [0, 1, 2] },
            { s: 4.1, e: 6.2, indices: [3, 4, 5] }
          ],
          cta: { text: 'SIMPAN RESEP INI', s: 4.2, e: 6.5 },
          punches: []
        }
      },
      {
        tpl: 'recipe_pop',
        tChecks: [2.8, 5.0], // save card + CTA + sub visible
        timeline: {
          config: { width: 720, height: 1280, duration: 8, hookDuration: 0, style: 'floating_black_on_white', captionMode: 'full', finishingTemplate: 'recipe_pop' },
          words: makeTimedWords(['Siapkan', 'Jahe', 'Merah', 'Madu', 'Murni', 'Hangat'], { startAt: 2.0, step: 0.6 }),
          chunks: [
            { s: 2.0, e: 4.0, indices: [0, 1, 2] },
            { s: 4.1, e: 6.2, indices: [3, 4, 5] }
          ],
          savePrompt: { titleText: 'Simpan & Bagikan Resep', subtitleText: 'Takaran lengkap ada di caption', s: 2.2, e: 4.1 },
          cta: { text: 'CEK LINK BIO', s: 4.2, e: 6.5 },
          punches: []
        }
      }
    ];

    for (const cCase of collisionCases) {
      await page.goto(pathToFileURL(resolveFinishingTemplatePath(cCase.tpl)).href, { waitUntil: 'load' });
      await page.evaluate((payload) => window.loadTimeline({ ...payload, config: { ...payload.config, fontBaseUrl: payload.fontBaseUrl } }), {
        ...cCase.timeline,
        fontBaseUrl: fontUrl
      });
      await page.evaluate(() => document.fonts.ready);

      for (const ts of cCase.tChecks) {
        await page.evaluate((t) => window.renderAt(t), ts);
        const overlaps = await page.evaluate(() => {
          const sub = document.getElementById('oSub');
          if (!sub || sub.hidden) return [];
          const sr = sub.getBoundingClientRect();
          const selectors = ['#oCta', '#oSave', '#oRecap', '.x-notice', '.x-lower'];
          const hits = [];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (!el || el.hidden) continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            const yOverlap = Math.min(sr.bottom, r.bottom) - Math.max(sr.top, r.top);
            const xOverlap = Math.min(sr.right, r.right) - Math.max(sr.left, r.left);
            if (yOverlap > 2 && xOverlap > 2) {
              hits.push({ sel, yOverlap, subTop: sr.top, subBot: sr.bottom, elTop: r.top, elBot: r.bottom });
            }
          }
          return hits;
        });
        assert.deepEqual(overlaps, [], `Collision detected on ${cCase.tpl} @ t=${ts}s: ${JSON.stringify(overlaps)}`);
      }
    }
  } finally {
    await browser.close();
  }
});

