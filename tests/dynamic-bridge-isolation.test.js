import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrganicPillarPrompt } from '../lib/prompts.js';
import { buildDynamicStoryCurveGuideline } from '../lib/kb/dynamic-story-curve.js';

test('Dynamic Bridge Isolation: Prompts correctly respect bridge_at_clip = 5 and forbid early leaks', () => {
  const campaignData = {
    campaign_name: 'Test Dynamic Bridge Campaign',
    content_pillar: 'Solusi Kolesterol',
    category_cep: 'Kecemasan Kolesterol Pasangan',
    target_clips_count: 6,
    bridge_at_clip: '5', // Passed as string from DB/form
    bridge_duration_clips: '1',
    is_bridging_active: '1',
    visual_style: 'metaphoric_faceless',
    narrative_mode: 'Problem-Solution',
    custom_hook: 'Angka kolesterol suami bikin malam Bunda jadi gelisah?',
    visual_action_guideline: 'Kamera makro menyoroti penampang pipa kaca transparan',
  };

  const productData = {
    product_name: 'GarliBee',
    product_description: 'Bawang lanang fermentasi dalam madu mentah',
    unique_selling_point: 'Fermentasi 3 bulan kaya allicin aktif',
    packaging_type: 'Jar Kaca',
    is_in_packaging: 1,
    t2i_prompt: 'A transparent jar of GarliBee',
    i2v_action_prompt: 'Macro spoon dipping into amber fluid'
  };

  const visualOverrides = {
    schema_version: 'visual_identity_snapshot_v1',
    structured: {
      visual_language: {
        primary_style: 'commercial_product_cinematic'
      }
    }
  };

  const prompt = buildOrganicPillarPrompt([], campaignData, productData, {}, visualOverrides);

  // 1. Hand POV rule must be dynamic to Clip 5, not hardcoded Clip 3
  assert.ok(
    prompt.includes('Tangan POV hanya boleh muncul pada klip produk/konsumsi (Klip 5 ke atas). Klip 1 s/d 4 WAJIB MURNI BENDA TANPA TANGAN.'),
    'Hand POV rule must forbid hands for Clips 1 to 4 and only allow from Clip 5'
  );
  assert.ok(
    !prompt.includes('Klip 3 ke atas'),
    'Must not hardcode Klip 3 ke atas for hands POV'
  );

  // 2. Metaphor beat breakdown must be dynamic and not hardcode "alkimia fermentasi alami"
  assert.ok(
    prompt.includes('- Klip 2 s/d Klip 4: Penjelasan fenomena fisika/biologis dan dinamika konteks situasi audiens secara netral (DILARANG menyebut bahan atau solusi produk target).'),
    'Clips 2 to 4 must be neutral contextual problem escalation'
  );
  assert.ok(
    !prompt.includes('alkimia fermentasi alami'),
    'Must not hardcode generic alkimia fermentasi alami in prompt template'
  );

  // 3. Product placement isolation mandate must explicitly forbid ingredients leak before bridgeAtClip
  assert.ok(
    prompt.includes('bahan/komposisi spesifik produk (seperti madu mentah, fermentasi bawang tunggal, atau racikan formula produk)'),
    'Pre-bridge mandate must forbid ingredients and formula leaks'
  );

  // 4. Must not have string concatenation bug '51'
  assert.ok(
    !prompt.includes('51'),
    'Must not produce string concatenation bug like Klip ke-51'
  );

  // 5. Problem-Solution storytelling rules must place Solution at Clip 5, not Clip 3
  assert.ok(
    prompt.includes('* Klip Eskalasi Masalah & Konteks (Klip 2 s/d 4):'),
    'Problem-Solution rule must span problem escalation across Clips 2 to 4'
  );
  assert.ok(
    prompt.includes('* Klip Solusi & Bridging (Klip 5 s/d 5):'),
    'Problem-Solution rule must place solution pivot at Clip 5'
  );
  assert.ok(
    !prompt.includes('* Klip Solusi (Klip 3 s/d N-1):'),
    'Must not hardcode Klip Solusi (Klip 3 s/d N-1)'
  );

  // 6. Tuple prompt expansion mandate must strictly isolate Clips 1 to 4 as Pure Object
  assert.ok(
    prompt.includes('🚨 KHUSUS KLIP 1 s/d 4 (METAFORA OBJEK PRE-BRIDGING — 100% PURE ISOLATED OBJECT ONLY):'),
    'Tuple notice must isolate Clips 1 to 4 for metaphoric faceless'
  );
  assert.ok(
    prompt.includes('- PADA KLIP 1 s/d 4 (PRE-BRIDGING ISOLATION):'),
    'Tuple expansion mandate must have explicit pre-bridging zone for Clips 1 to 4'
  );
  assert.ok(
    prompt.includes('1. (Presence Truth: Strictly 100% Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, NO FINGERS, ZERO HUMAN PRESENCE)'),
    'Clips 1 to 4 must mandate Pure Isolated Object tuple'
  );
  assert.ok(
    prompt.includes('- PADA KLIP 5 s/d 6 (PRODUCT BRIDGING & PAYOFF):'),
    'Product bridging zone must start at Clip 5'
  );
  assert.ok(
    !prompt.includes('🚨 KHUSUS KLIP 1 (METAFORA OBJEK — 100% PURE OBJECT ONLY):'),
    'Must not limit pure object isolation to Clip 1 only'
  );
});

test('Dynamic Story Curve: Product Campaign respects bridgeAtClip = 5', () => {
  const curve = buildDynamicStoryCurveGuideline({
    campaignKind: 'product_campaign',
    targetClips: 6,
    bridgeAtClip: 5,
    bridgeDurationClips: 1,
    language: 'id-ID'
  });

  assert.ok(
    curve.includes('- Klip 2 s.d. 4: Eskalasi masalah nyata, konteks emosional, dan dinamika pilar organik (DILARANG menyebut produk atau membocorkan bahan produk).'),
    'Dynamic curve must keep Clips 2 to 4 neutral'
  );
  assert.ok(
    curve.includes('- Klip #5: Kenalkan produk secara natural sebagai jawaban/kunci atas masalah di klip-klip sebelumnya.'),
    'Dynamic curve must introduce product at Clip 5'
  );
  assert.ok(
    !curve.includes('- Klip 2: Kenalkan produk secara natural'),
    'Must not introduce product at Clip 2 when bridgeAtClip is 5'
  );
});

test('Dynamic Bridge Isolation: defaults gracefully when bridge_at_clip = 2', () => {
  const curveDefault = buildDynamicStoryCurveGuideline({
    campaignKind: 'product_campaign',
    targetClips: 4,
    bridgeAtClip: 2,
    bridgeDurationClips: 1,
    language: 'id-ID'
  });

  assert.ok(
    curveDefault.includes('- Klip #2: Kenalkan produk secara natural sebagai jawaban/kunci atas masalah di Klip 1.'),
    'Dynamic curve should introduce at Clip 2 when bridgeAtClip = 2'
  );
});
