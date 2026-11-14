import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOrganicPillarPrompt, buildMultiplierPhase2Prompt } from '../lib/prompts.js';
import { mergeOnScreenAmountsIntoFinishingPlan } from '../lib/finishing-plan-validator.js';

const baseCampaign = {
  campaign_name: 'Test Keyword Campaign',
  content_pillar: 'peredam suara pintu kamar',
  custom_hook: 'Pintu kamar sudah ditutup tapi suara dari luar tetap masuk?',
  visual_action_guideline: 'POV tangan memeriksa celah bawah pintu kamar',
  narrative_mode: 'Storytelling',
  visual_style: 'Cinematic',
  words_per_clip: '17-19 kata',
  clip_duration: 8,
  target_clips_count: 4,
  aspect_ratio: '9:16',
  target_language: 'id-ID',
  face_visibility: 'Faceless',
  is_bridging_active: 0,
  finishing_template: 'none'
};

test('V2 Snapshot: vo_content_contract=off preserves legacy prompt byte-for-byte', () => {
  const unsetPrompt = buildOrganicPillarPrompt([], { ...baseCampaign }, null, { brand_name: 'Siasat' }, null);
  const offPrompt = buildOrganicPillarPrompt([], { ...baseCampaign, vo_content_contract: 'off' }, null, { brand_name: 'Siasat' }, null);

  assert.equal(offPrompt, unsetPrompt);
  assert.ok(offPrompt.includes('- CONNECTIVE FLOW & MASTER MONOLOGUE MANDATE (SANGAT KETAT):'));
  assert.ok(offPrompt.includes('Melukiskan suasana, proses, atau dinamika topik secara visual dan kronologis.'));
  assert.ok(offPrompt.includes('Penutup/kesimpulan yang hangat dan reflektif dari topik tersebut beserta CTA yang relevan.'));
  assert.ok(!offPrompt.includes('KONTRAK ISI VO'));
  assert.ok(!offPrompt.includes('VO CONTENT CONTRACT'));
});

test('V2 Contract ON (id-ID): injects KONTRAK ISI VO, removes mandatory discourse markers, supports Tips/Tutorial', () => {
  const prompt = buildOrganicPillarPrompt([], {
    ...baseCampaign,
    vo_content_contract: 'on',
    narrative_mode: 'Tips/Tutorial',
    _rowPayload: {
      content_payload: {
        search_intent: 'Kenapa suara tembus lewat pintu kamar?',
        search_answer: 'Suara bocor lewat celah 3-5 mm di bawah pintu dan kusen yang renggang.',
        takeaways: [
          { point: 'Pasang door sweep karet di bawah pintu', anchor: 'tutup celah bawah 3-5 mm', anchor_type: 'titik', source: 'pengetahuan_umum' },
          { point: 'Tempel weatherstrip sepanjang kusen', anchor: '3 sisi kusen kiri kanan atas', anchor_type: 'titik', source: 'pengetahuan_umum' }
        ],
        needs_data: []
      }
    }
  }, null, { brand_name: 'Siasat' }, null);

  assert.ok(prompt.includes('## 🎯 KONTRAK ISI VO (PRIORITAS TERTINGGI'));
  assert.ok(prompt.includes('tutup celah bawah 3-5 mm'));
  assert.ok(prompt.includes('- ALUR: Naskah tetap terdengar sebagai satu monolog yang mengalir'));
  assert.ok(!prompt.includes('- CONNECTIVE FLOW & MASTER MONOLOGUE MANDATE (SANGAT KETAT):'));
  assert.ok(prompt.includes('WAJIB memuat search_answer / takeaway pertama dari KONTRAK ISI VO.'));
  assert.ok(prompt.includes('- Jika "Tips/Tutorial":'));
});

test('V2 Contract ON (en-US & >5 clips): injects English VO Content Contract and clip_plan for 7 clips', () => {
  const prompt = buildOrganicPillarPrompt([], {
    ...baseCampaign,
    vo_content_contract: 'on',
    target_language: 'en-US',
    target_clips_count: 7,
    narrative_mode: 'Storytelling',
    _rowPayload: {
      content_payload: {
        search_intent: 'Why does dry indoor heat crack wooden cutting boards?',
        search_answer: 'Dry winter indoor air under 35% humidity pulls moisture out of end-grain wood.',
        takeaways: [
          { point: 'Coat board with food-grade mineral oil', anchor: '1 tablespoon every 2 weeks', anchor_type: 'angka', source: 'pengetahuan_umum' },
          { point: 'Stand board upright after rinsing', anchor: 'air-dry both faces for 2 hours', anchor_type: 'durasi', source: 'pengetahuan_umum' }
        ]
      }
    }
  }, null, { brand_name: 'Habitfolk' }, null);

  assert.ok(prompt.includes('## 🎯 VO CONTENT CONTRACT (HIGHEST PRIORITY'));
  assert.ok(prompt.includes('1 tablespoon every 2 weeks'));
  assert.ok(prompt.includes('Klip 7 (summary_and_cta)'));
  assert.ok(prompt.includes('not only'));
});

test('V3 Multiplier Snapshot: vo_content_contract=off preserves legacy Multiplier prompt byte-for-byte', () => {
  const sampleStoryboard = [
    { scene: 1, visual_description: 'Biji adas direndam semalaman', narration_transcript: 'Rendam biji adas semalaman' },
    { scene: 2, visual_description: 'Rebus dengan dua gelas air hingga menyusut setengah', narration_transcript: 'Rebus sampai menyusut setengah' }
  ];
  const offA = buildMultiplierPhase2Prompt(
    sampleStoryboard,
    { product_name: '' },
    { targetClipsCount: 4, narrativeMode: 'Storytelling', wordsPerClip: '17-19 kata', targetLanguage: 'id-ID' },
    { is_pure_storytelling: true, angleTitle: 'Teh Adas Tradisional' },
    null,
    { enableTts: true },
    0,
    ''
  );
  const offB = buildMultiplierPhase2Prompt(
    sampleStoryboard,
    { product_name: '' },
    { targetClipsCount: 4, narrativeMode: 'Storytelling', wordsPerClip: '17-19 kata', targetLanguage: 'id-ID', vo_content_contract: 'off' },
    { is_pure_storytelling: true, angleTitle: 'Teh Adas Tradisional', vo_content_contract: 'off' },
    null,
    { enableTts: true },
    0,
    ''
  );
  assert.equal(offB, offA);
  assert.ok(offB.includes('Fokus pada keindahan proses, estetika visual, dan ketenangan pikiran.'));
  assert.ok(!offB.includes('KONTRAK RESEP SUMBER'));
});

test('V3 Multiplier ON (id-ID & en-US) + mergeOnScreenAmountsIntoFinishingPlan', () => {
  const sampleStoryboard = [
    { scene: 1, visual_description: 'Siapkan adas, jintan, biji karam', narration_transcript: 'Siapkan satu sendok adas' }
  ];
  const onId = buildMultiplierPhase2Prompt(
    sampleStoryboard,
    { product_name: '' },
    { targetClipsCount: 4, narrativeMode: 'Storytelling', wordsPerClip: '17-19 kata', targetLanguage: 'id-ID', vo_content_contract: 'on' },
    { is_pure_storytelling: true, angleTitle: 'Minuman Rempah Hangat' },
    null,
    { enableTts: true },
    0,
    ''
  );
  assert.ok(onId.includes('## 🎯 KONTRAK RESEP SUMBER (PRIORITAS TERTINGGI)'));
  assert.ok(onId.includes('"source_recipe_lock"'));
  assert.ok(onId.includes('"on_screen_amounts"'));
  assert.ok(onId.includes('Fokus pada langkah yang bisa ditiru: bahan, takaran, durasi, dan tanda selesai.'));

  const onEn = buildMultiplierPhase2Prompt(
    sampleStoryboard,
    { product_name: '' },
    { targetClipsCount: 4, narrativeMode: 'Storytelling', wordsPerClip: '17-19 kata', vo_content_contract: 'on' },
    { is_pure_storytelling: true, angleTitle: 'Warm Fennel Tea' },
    null,
    { enableTts: true, targetLanguage: 'en-US' },
    0,
    ''
  );
  assert.ok(onEn.includes('## 🎯 SOURCE RECIPE CONTRACT (HIGHEST PRIORITY)'));

  const merged = mergeOnScreenAmountsIntoFinishingPlan({
    finishingPlan: { tips: [] },
    onScreenAmounts: ['1 sdm biji adas', 'rontokkan lemak visceral', '250 ml air panas'],
    clipCount: 4
  });
  assert.equal(merged.tips.length, 2);
  assert.equal(merged.tips[0].text, '1 sdm biji adas');
  assert.equal(merged.tips[0].clip_index, 1);
  assert.equal(merged.tips[1].text, '250 ml air panas');
  assert.equal(merged.tips[1].clip_index, 2);
});
