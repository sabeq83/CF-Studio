/**
 * Client-safe preview timeline builder for the Finishing Pass Live Preview iframe.
 * Zero Node-only imports (no fs, path, or playwright) so Next.js Client Components can import it directly.
 */
import { chunkCaptionWords, collectProtectedSubtitlePhrases } from './subtitle-chunker.js';

export const PREVIEW_DURATION_SEC = 24;

export const PREVIEW_TIMELINE_MARKERS = [
  { id: 'hook', label: '0.6s Hook', t: 0.6 },
  { id: 'layer', label: '4.2s Layer Utama', t: 4.2 },
  { id: 'highlight', label: '9.5s Highlight', t: 9.5 },
  { id: 'punch', label: '14.5s Punch', t: 14.5 },
  { id: 'cta', label: '20.2s CTA', t: 20.2 },
  { id: 'endcard', label: '22.5s Penutup', t: 22.5 }
];

function buildSampleWordsAndChunks(sentences, protectedPhrases = [], motionStyle = 'floating_white_yellow') {
  const words = [];
  sentences.forEach((tokens, clipIdx) => {
    const clipStart = clipIdx * 6;
    const step = Math.max(0.22, (6 - 0.8) / Math.max(1, tokens.length));
    tokens.forEach((w, idx) => {
      const s = Number((clipStart + 0.35 + idx * step).toFixed(3));
      const e = Number((s + step * 0.88).toFixed(3));
      words.push({ w, s, e, c: clipIdx, originalIndex: words.length });
    });
  });

  const chunked = chunkCaptionWords(words, {
    protectedPhrases,
    style: motionStyle || 'floating_white_yellow',
    width: 720,
    enforceWidthSplit: true
  });

  const chunks = chunked.map((ch) => ({
    s: ch[0].s,
    e: ch[ch.length - 1].e,
    indices: ch.map((item) => item.originalIndex),
    ...(ch.fontCqw || ch[0]?.singleWordFontCqw ? { fontCqw: ch.fontCqw || ch[0].singleWordFontCqw } : {})
  }));
  return { words, chunks };
}

function deriveMonogram(name) {
  const parts = String(name || 'Studio Contoh').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(parts[0] || 'SC').slice(0, 2).toUpperCase();
}

export function buildPreviewTimeline({
  templateId = 'none',
  captionMode = 'hybrid',
  loudnessTarget = -14,
  targetLanguage = 'id-ID',
  brandName = '',
  brandTagline = '',
  accentColor = '',
  hookTitle = '',
  productName = '',
  productSpec = '',
  motionStyle = 'floating_white_yellow',
  motionPosition = 'bottom'
} = {}) {
  const isEn = String(targetLanguage || 'id-ID').toLowerCase().startsWith('en');
  const tpl = String(templateId || 'none').trim().toLowerCase();
  const dur = PREVIEW_DURATION_SEC;

  const displayBrand = String(brandName || '').trim() || (isEn ? 'Sample Studio' : 'Studio Contoh');
  const displayTag = String(brandTagline || '').trim() || (isEn ? 'Daily Practical Guide' : 'Panduan Praktis Harian');
  const displayProd = String(productName || '').trim() || (isEn ? 'Featured Daily Item' : 'Produk Pilihan Harian');
  const displaySpec = String(productSpec || '').trim() || (isEn ? 'Pack 100g • Daily Use' : 'Kemasan 100g • Praktis');

  const sampleSentences = isEn
    ? [
        ['Start', 'morning', 'with', 'calm', 'steady', 'rhythm'],
        ['Compare', 'gentle', 'steps', 'for', 'daily', 'focus'],
        ['Measured', 'checks', 'save', 'thirty', 'five', 'percent'],
        ['Save', 'summary', 'and', 'check', 'link', 'below']
      ]
    : [
        ['Mulai', 'pagi', 'dengan', 'ritme', 'yang', 'terarah'],
        ['Bandingkan', 'cara', 'bertahap', 'agar', 'lebih', 'konsisten'],
        ['Catat', 'kemajuan', 'hemat', 'tiga', 'puluh', 'persen'],
        ['Simpan', 'ringkasan', 'lalu', 'cek', 'tautan', 'bio']
      ];

  const defaultHookL1 = tpl === 'mitos_fakta'
    ? (isEn ? 'IS A STRICT ROUTINE BETTER?' : 'BENARKAH POLA KETAT WAJIB?')
    : (isEn ? '3 DAILY FOCUS HABITS' : '3 KEBIASAAN FOKUS HARIAN');
  const resolvedHook = String(hookTitle || '').trim();
  const hookCard = {
    text: resolvedHook || defaultHookL1,
    l1: resolvedHook ? resolvedHook.toUpperCase().slice(0, 34) : defaultHookL1,
    l2: tpl === 'mitos_fakta'
      ? (isEn ? 'CHECK THE FACTS' : 'CEK FAKTANYA')
      : (isEn ? 'SIMPLE & STEADY' : 'RINGKAS & PRAKTIS'),
    l1Ratio: 0.088,
    l2Ratio: 0.104
  };

  const accent = accentColor || '#ffd23f';
  const brandColor = '#1e293b';

  const punches = [
    {
      phrase: isEn ? 'CALM STEADY' : 'RITME TERARAH',
      displayText: tpl === 'tips_listicle' ? '3X' : (isEn ? 'STEADY' : 'TERARAH'),
      type: 'benefit',
      s: 4.0,
      e: 5.5,
      flashAt: 4.0
    },
    {
      phrase: isEn ? 'CONSISTENT DAILY' : 'KONSISTEN HARIAN',
      displayText: tpl === 'tips_listicle' ? '35%' : (isEn ? 'CONSISTENT' : 'KONSISTEN'),
      type: 'result',
      s: 13.8,
      e: 15.6,
      flashAt: 13.8
    }
  ];

  const previewProtectedPhrases = collectProtectedSubtitlePhrases({
    brand: { name: displayBrand },
    productData: { product_name: displayProd, spesifikasi_produk: displaySpec },
    finishingPlan: {
      punches,
      numbers: [{ trigger: isEn ? 'thirty five percent' : 'tiga puluh persen' }]
    }
  });
  const { words, chunks } = buildSampleWordsAndChunks(sampleSentences, previewProtectedPhrases, motionStyle);

  const sharedBrandEnabled = ['tips_listicle', 'ramuan_ritual', 'problem_solution', 'angka_banding', 'mitos_fakta'].includes(tpl);

  const timeline = {
    version: '2.0-preview',
    duration: dur,
    fps: 30,
    width: 720,
    height: 1280,
    clipCuts: [6, 12, 18],
    config: {
      duration: dur,
      hookDuration: 1.75,
      finishingTemplate: tpl,
      captionMode,
      loudnessTarget: Number(loudnessTarget) || -14,
      targetLanguage: isEn ? 'en-US' : 'id-ID',
      accentColor: accent,
      accent,
      brandColor,
      activeWord: accent,
      activeWordColor: accent,
      style: motionStyle || 'floating_white_yellow',
      position: motionPosition || 'bottom',
      fontBaseUrl: '/fonts',
      sharedBrand: {
        enabled: sharedBrandEnabled,
        watermarkEnabled: sharedBrandEnabled,
        endCardEnabled: sharedBrandEnabled,
        endCardDuration: 1.85
      }
    },
    brand: {
      name: displayBrand,
      mark: deriveMonogram(displayBrand),
      color: brandColor,
      accentColor: accent,
      tagline: displayTag,
      location: isEn ? 'Sample City' : 'Kota Contoh',
      targetLanguage: isEn ? 'en-US' : 'id-ID',
      presenterName: isEn ? 'Advisory Team' : 'Tim Edukasi',
      presenterTitle: isEn ? 'Content Specialist' : 'Spesialis Konten',
      defaultCta: isEn ? 'CHECK LINK IN BIO' : 'CEK LINK DI BIO'
    },
    hookCard,
    words,
    chunks,
    punchWordIndices: [],
    punches,
    cta: {
      text: isEn ? 'CHECK LINK IN BIO' : 'CEK LINK DI BIO',
      arrowDir: '▼',
      s: 19.6,
      e: 21.8
    },
    savePrompt: {
      titleText: tpl === 'recipe_pop'
        ? (isEn ? 'Save & Share Recipe' : 'Simpan & Bagikan Resep')
        : (isEn ? 'Save These Tips' : 'Simpan Tips Ini'),
      subtitleText: isEn ? 'Full summary in caption ⬇️' : 'Ringkasan lengkap ada di caption ⬇️',
      s: 17.2,
      e: 19.4
    },
    productCard: {
      name: displayProd,
      specLine: displaySpec,
      tag: tpl === 'recipe_pop'
        ? (isEn ? 'KEY INGREDIENT' : 'BAHAN KUNCI')
        : (isEn ? 'FEATURED ITEM' : 'PRODUK PILIHAN'),
      disclaimer: tpl === 'ramuan_ritual'
        ? (isEn ? 'Supportive daily wellness habit.' : 'Kebiasaan kebugaran harian, bukan klaim medis.')
        : '',
      imageUrl: '',
      s: 11.2,
      e: 17.0
    },
    endCard: {
      enabled: sharedBrandEnabled,
      duration: 1.85,
      ctaText: isEn ? 'CHECK LINK IN BIO' : 'CEK LINK DI BIO'
    }
  };

  if (tpl === 'recipe_pop' || tpl === 'ramuan_ritual') {
    timeline.recipe = {
      hasRecipe: true,
      ingredients: {
        until: 11.0,
        totalCount: 5,
        overflowLabel: isEn ? '+1 more' : '+1 bahan lain',
        items: isEn
          ? [
              { label: 'Fresh ginger (10g)', s: 2.0 },
              { label: 'Warm water (250ml)', s: 3.5 },
              { label: 'Raw honey (1 tsp)', s: 5.0 },
              { label: 'Citrus squeeze', s: 6.5 }
            ]
          : [
              { label: '1 ruas jahe segar', s: 2.0 },
              { label: '250 ml air hangat', s: 3.5 },
              { label: '1 sdt madu murni', s: 5.0 },
              { label: 'Perasan jeruk nipis', s: 6.5 }
            ]
      },
      steps: isEn
        ? [
            { n: 1, total: 3, badge: 'STEP 1/3', t: 'Rinse & slice', s: 2.2, e: 7.5 },
            { n: 2, total: 3, badge: 'STEP 2/3', t: 'Steep warm', s: 7.6, e: 13.5 },
            { n: 3, total: 3, badge: 'STEP 3/3', t: 'Serve steady', s: 13.6, e: 19.2 }
          ]
        : [
            { n: 1, total: 3, badge: 'LANGKAH 1/3', t: 'Iris tipis bahan', s: 2.2, e: 7.5 },
            { n: 2, total: 3, badge: 'LANGKAH 2/3', t: 'Seduh air hangat', s: 7.6, e: 13.5 },
            { n: 3, total: 3, badge: 'LANGKAH 3/3', t: 'Sajikan hangat', s: 13.6, e: 19.2 }
          ]
    };
  }

  if (tpl === 'tips_listicle') {
    timeline.tips = isEn
      ? [
          { n: 1, total: 3, text: 'Set morning glass early', s: 2.0, e: 6.5 },
          { n: 2, total: 3, text: 'Keep 10-min calm pause', s: 6.6, e: 12.2 },
          { n: 3, total: 3, text: 'Track progress every week', s: 12.3, e: 17.5 }
        ]
      : [
          { n: 1, total: 3, text: 'Siapkan jadwal pagi lebih awal', s: 2.0, e: 6.5 },
          { n: 2, total: 3, text: 'Jaga jeda 10 menit tanpa layar', s: 6.6, e: 12.2 },
          { n: 3, total: 3, text: 'Catat progres tiap akhir pekan', s: 12.3, e: 17.5 }
        ];
  }

  if (tpl === 'ramuan_ritual') {
    timeline.timingBadges = [
      {
        emoji: '🌙',
        title: isEn ? 'EVENING' : 'MALAM HARI',
        sub: isEn ? 'Sip while warm' : 'Diminum hangat',
        s: 2.1,
        e: 6.5
      },
      {
        emoji: '⏱️',
        title: isEn ? 'STEEP 5 MIN' : 'DIAMKAN 5 MENIT',
        sub: isEn ? 'Stir gently' : 'Aduk perlahan',
        s: 7.2,
        e: 12.0
      }
    ];
  }

  if (tpl === 'problem_solution') {
    timeline.chapters = [
      { n: 1, label: isEn ? 'PROBLEM' : 'MASALAH', color: '#e5484d', s: 1.85, e: 6.5 },
      { n: 2, label: isEn ? 'CAUSE' : 'PENYEBAB', color: '#f59e0b', s: 6.5, e: 11.8 },
      { n: 3, label: isEn ? 'SOLUTION' : 'SOLUSI', color: '#10b981', s: 11.8, e: 17.2 },
      { n: 4, label: isEn ? 'RESULT' : 'HASIL', color: '#3b82f6', s: 17.2, e: 21.8 }
    ];
    timeline.callouts = [
      {
        text: isEn ? 'DENSE LAYER' : 'LAPIS PADAT',
        sub: isEn ? 'Reduce excess echo' : 'Redam gema berlebih',
        x: 50,
        y: 28,
        s: 3.2,
        e: 9.8
      },
      {
        text: isEn ? 'SEALED EDGE' : 'CELAH RAPAT',
        sub: isEn ? 'Close side openings' : 'Tutup bukaan sisi',
        x: 48,
        y: 32,
        s: 11.9,
        e: 17.0
      }
    ];
  }

  if (tpl === 'angka_banding') {
    timeline.numbers = [
      {
        fromValue: 0,
        value: 35,
        unit: '%',
        label: isEn ? 'Daily Efficiency' : 'Efisiensi Harian',
        s: 2.4,
        e: 7.5
      }
    ];
    timeline.compare = [
      {
        left: {
          title: isEn ? 'STRUCTURED' : 'LAPIS INSULASI',
          sub: isEn ? 'More comfortable' : 'Suhu lebih stabil',
          good: true
        },
        right: {
          title: isEn ? 'UNLINED' : 'TANPA LAPIS',
          sub: isEn ? 'Fast heat gain' : 'Cepat gerah',
          good: false
        },
        s: 7.8,
        e: 13.8
      }
    ];
    timeline.chips = [
      {
        items: [
          { label: isEn ? 'OPTION A' : 'PILIHAN A', s: 14.2 },
          { label: isEn ? 'OPTION B' : 'PILIHAN B', s: 15.6 }
        ],
        foot: isEn ? 'Matched to space needs' : 'Sesuai kebutuhan ruang',
        s: 14.0,
        e: 18.8
      }
    ];
  }

  if (tpl === 'mitos_fakta') {
    timeline.mythFact = [
      {
        type: 'myth',
        text: isEn ? 'Strict instant shifts always stick' : 'Perubahan drastis selalu tahan lama',
        why: isEn ? 'Steady gradual steps are easier to maintain' : 'Langkah bertahap lebih mudah dipertahankan',
        s: 2.2,
        e: 8.6
      },
      {
        type: 'fact',
        text: isEn ? 'Small steady habits build results' : 'Kebiasaan kecil konsisten lebih terjaga',
        why: isEn ? 'Repeatable daily pace reduces burnout' : 'Ritme wajar menjaga konsistensi harian',
        s: 8.8,
        e: 17.5
      }
    ];
  }

  return timeline;
}
