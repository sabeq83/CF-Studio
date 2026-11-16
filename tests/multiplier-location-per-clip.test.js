import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMultiplierPhase2Prompt } from '../lib/prompts.js';
import { readBridgeInputs } from '../lib/bridging/bridge-plan.js';

test('1. Multiplier Prompt with planner_driven VI enables per-clip dynamic locations & natural optics', () => {
  const originalStoryboard = [
    { scene: 1, visual_description: 'Office desk fatigue', narration_transcript: 'Jam 2 siang di kantor perut bunyi aneh' },
    { scene: 2, visual_description: 'Kitchen prep', narration_transcript: 'Racik ramuan herbal alami' },
    { scene: 3, visual_description: 'Enjoying drink', narration_transcript: 'Badan enteng seketika' }
  ];

  const productDNA = {
    is_pure_storytelling: true,
    product_name: '',
    product_description: 'Resep herbal pereda begah'
  };

  const aesthetics = {
    aspectRatio: '9:16',
    clipDuration: 6,
    visualStyle: 'Cinematic'
  };

  const bridging = {
    campaign_type: 'pure_storytelling',
    bridging_mode: 'none',
    isBridgingActive: false,
    visualMode: 'hybrid_lock',
    targetClipsCount: 3
  };

  const audio = {
    targetLanguage: 'id-ID'
  };

  // Structured VI mimicking dapurbotani_identity_v3
  const vsoPlannerDriven = {
    isVsoActive: true,
    characterConcept: 'faceless',
    subjectDemographic: 'custom',
    subjectDemographicCustom: 'POV close-up focusing strictly on Indonesian Muslimah female hands...',
    wardrobeStyle: 'custom',
    wardrobeStyleCustom: 'Single solid modest loose long-sleeve linen gamis covering wrists completely',
    lightingStyle: 'custom',
    lightingStyleCustom: 'Warm organic diffused natural directional light',
    environmentPrompt: 'Fallback only: warm natural wooden home tabletop when planner specifies no room',
    negativePrompt: 'visible human face, short sleeves, bare arms',
    structured: {
      schema_mode: 'identity_card',
      environment: {
        policy: 'planner_driven',
        fallback_location: 'Warm natural wooden Indonesian kitchen counter or dining nook with uncluttered tabletop',
        custom_description: 'Fallback only: warm natural wooden home tabletop when planner specifies no room'
      },
      camera: {
        framing: 'hands_closeup',
        perspective: 'third_person',
        lens_look: 'natural_50mm',
        depth_of_field: 'shallow'
      }
    }
  };

  const prompt = buildMultiplierPhase2Prompt(
    originalStoryboard,
    productDNA,
    aesthetics,
    bridging,
    vsoPlannerDriven,
    audio,
    0
  );

  // A. Verifikasi instruksi lokasi per klip (Point A)
  assert.ok(
    prompt.includes('Per-clip location chosen from this scene\'s story beat'),
    'Wajib memuat instruksi pemilihan lokasi per klip berdasarkan story beat'
  );
  assert.ok(
    prompt.includes('hook/problem clip = the place where the problem happens'),
    'Wajib memuat panduan lokasi klip hook/masalah'
  );
  assert.ok(
    prompt.includes('preparation clips = home kitchen zone'),
    'Wajib memuat panduan zona dapur untuk klip peracikan'
  );
  assert.ok(
    prompt.includes('final result clip = where the result is enjoyed'),
    'Wajib memuat panduan lokasi menikmati untuk klip hasil'
  );
  assert.ok(
    !prompt.includes('- Environment / Setting Lock: Fallback only: warm natural wooden home tabletop'),
    'DILARANG mengunci Environment / Setting Lock ke teks fallback untuk planner_driven'
  );
  assert.ok(
    prompt.includes('LOCATION LOGIC: Location must follow the story beat per clip'),
    'Wajib menggunakan LOCATION LOGIC dinamis, bukan LOCATION CONSISTENCY seragam'
  );

  // B. Verifikasi sudut kamera & lensa natural dari VI (Point B)
  assert.ok(
    prompt.includes('eye-level close-up on hands and the action, room context visible behind'),
    'Wajib menggunakan framing natural dengan konteks ruangan terlihat, bukan makro kuliner meja'
  );
  assert.ok(
    prompt.includes('natural 50mm, shallow depth of field'),
    'Wajib mengadopsi lens_look natural 50mm dari camera VI'
  );
  assert.ok(
    !prompt.includes('Phase One XF IQ4 (150MP), 100mm Macro Food Photography lens'),
    'DILARANG memaksa lensa makro kuliner 100mm Phase One pada VI planner_driven'
  );

  // C. Verifikasi skema output JSON memuat location_en & prompts Location
  assert.ok(
    prompt.includes('"location_en":'),
    'Skema storyboard wajib memuat field location_en per adegan'
  );
  assert.ok(
    prompt.includes('Konsistensi Lokasi Per Klip (Location per Clip)'),
    'Aturan utama wajib memuat panduan konsistensi lokasi per klip'
  );
  assert.ok(
    prompt.includes('(Location: [Must match storyboard location_en])'),
    'Contoh prompt t2i/t2v wajib menyelaraskan Location dengan location_en storyboard'
  );
});

test('2. Multiplier Prompt with legacy brand_locked VI preserves culinary macro & locked environment', () => {
  const originalStoryboard = [
    { scene: 1, visual_description: 'Macro cake prep', narration_transcript: 'Resep cokelat lembut' }
  ];

  const productDNA = {
    is_pure_storytelling: false,
    product_name: 'NutriBake Dark Choco',
    product_description: 'Bubuk coklat murni',
    unique_selling_point: '100% cocoa murni'
  };

  const aesthetics = {
    aspectRatio: '9:16',
    clipDuration: 8,
    visualStyle: 'Cinematic'
  };

  const bridging = {
    bridging_mode: 'select_existing',
    isBridgingActive: true,
    targetClipsCount: 4,
    bridgeAtClip: 2,
    bridgeDurationClips: 1,
    visualMode: 'hybrid_lock'
  };

  const audio = { targetLanguage: 'id-ID' };

  const vsoLegacy = {
    isVsoActive: true,
    characterConcept: 'faceless',
    subjectDemographic: 'syari_classic',
    wardrobeStyle: 'custom',
    wardrobeStyleCustom: 'Clean oatmeal linen',
    lightingStyle: 'custom',
    lightingStyleCustom: 'Soft window light',
    environmentPrompt: 'Pristine quartz kitchen counter with wooden accents',
    negativePrompt: 'blurry, distorted'
    // No structured planner_driven policy
  };

  const prompt = buildMultiplierPhase2Prompt(
    originalStoryboard,
    productDNA,
    aesthetics,
    bridging,
    vsoLegacy,
    audio,
    0
  );

  // Regresi: VI lama tetap memakai makro tabletop dan environment prompt lama
  assert.ok(
    prompt.includes('Top-down 45-degree tabletop macro / tight overhead culinary framing'),
    'VI legacy wajib tetap menggunakan sudut makro tabletop kuliner'
  );
  assert.ok(
    prompt.includes('Phase One XF IQ4 (150MP), 100mm Macro Food Photography lens'),
    'VI legacy wajib tetap menggunakan lensa makro 100mm Phase One'
  );
  assert.ok(
    prompt.includes('- Environment / Setting Lock: Pristine quartz kitchen counter with wooden accents'),
    'VI legacy wajib tetap mengunci environment ke environmentPrompt'
  );
  assert.ok(
    prompt.includes('- LOCATION CONSISTENCY: The background setting (Environment/Location) must be uniform across all visual prompts'),
    'VI legacy wajib mempertahankan konsistensi latar seragam'
  );
});

test('3. aiDirective allows visual rules (location, camera, guardrails) to apply to storyboard and prompts', () => {
  const originalStoryboard = [{ scene: 1, visual_description: 'test', narration_transcript: 'test' }];
  const productDNA = { is_pure_storytelling: true };
  const aesthetics = {
    aiDirective: 'Klip 1: latar meja kantor. Klip 2: dapur minimalis. Dilarang menampilkan jendela malam.'
  };
  const bridging = { bridging_mode: 'none', isBridgingActive: false, targetClipsCount: 2 };
  const audio = {};
  const vso = { isVsoActive: false };

  const prompt = buildMultiplierPhase2Prompt(originalStoryboard, productDNA, aesthetics, bridging, vso, audio, 0);

  assert.ok(
    prompt.includes('aturan visual di dalamnya (lokasi, sudut kamera, larangan visual) WAJIB DITERAPKAN pada storyboard dan prompt visual'),
    'aiDirective wajib mengizinkan dan mewajibkan aturan visual diterapkan pada storyboard & prompt'
  );
  assert.ok(
    prompt.includes('DILARANG mengutip atau membacakannya di voiceover, CTA, dan caption'),
    'aiDirective tetap melarang pembacaan verbatim di VO dan caption'
  );
});

test('4. Pure storytelling or bridging_mode none enforces strict zero commercial branding & hides product data', () => {
  // Scenario: residual product in payload but bridging_mode is 'none'
  const originalStoryboard = [{ scene: 1, visual_description: 'test', narration_transcript: 'test' }];
  const productDNAWithResidual = {
    is_pure_storytelling: false,
    product_name: 'Nutrifarm Kayu Manis Bubuk',
    product_description: 'Kayu manis premium',
    unique_selling_point: '100% murni tanpa campuran'
  };
  const aesthetics = {};
  const bridgingNone = {
    bridging_mode: 'none',
    targetClipsCount: 3
  };
  const audio = {};
  const vso = { isVsoActive: false };

  const prompt = buildMultiplierPhase2Prompt(
    originalStoryboard,
    productDNAWithResidual,
    aesthetics,
    bridgingNone,
    vso,
    audio,
    0
  );

  // readBridgeInputs test
  const bridgeInputs = readBridgeInputs(bridgingNone, aesthetics, { defaultActive: true });
  assert.equal(bridgeInputs.isBridgingActive, false, 'readBridgeInputs with bridging_mode none must set isBridgingActive to false');

  // Anti-branding rules
  assert.ok(
    prompt.includes('Larangan Keras Merek Dagang (Strict Zero Commercial Branding)'),
    'Wajib memuat larangan keras merek dagang komersial'
  );
  assert.ok(
    prompt.includes('Gunakan toples kaca, wadah, sendok, dan wadah bumbu dapur polos generik tanpa label merek'),
    'Wajib mewajibkan wadah polos generik tanpa label merek'
  );
  assert.ok(
    !prompt.includes('### DATA PRODUK TARGET KAMI:'),
    'DILARANG menyuntikkan section DATA PRODUK TARGET KAMI saat bridging mati'
  );
  assert.ok(
    !prompt.includes('DIRECT PLACEMENT RULES (NO BRIDGING):'),
    'DILARANG jatuh ke direct placement product saat bridging_mode none'
  );
});

setTimeout(() => process.exit(0), 100);
