import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrganicPillarPrompt } from '../lib/prompts.js';

test('OPC Strategic Context: buildOrganicPillarPrompt injects strategic planning fields and locks exact hook', () => {
  const campaignData = {
    campaign_name: 'Kampanye Kolesterol Sehat',
    content_pillar: 'Solusi Kolesterol',
    category_cep: 'Kecemasan Kolesterol Pasangan',
    ws_matrix: 'Who: Istri peduli suami | When: Malam sebelum tidur | Where: Kamar tidur | What: Cek hasil lab',
    context: 'Bunda melihat suami sesak & cemas setelah makan malam berlemak',
    vfo: 'Ekspresi cemas dan gelas air hangat di meja tidur',
    strategic_angle: 'Pencegahan stroke dini lewat pembersihan vaskular',
    evidence: 'Studi Journal of Lipid Research 2023',
    custom_hook: 'Angka kolesterol suami bikin malam Bunda jadi gelisah? Saatnya ubah kebiasaan kecil dari rumah.',
    visual_action_guideline: 'Close-up penampang pipa kaca transparan berlumut lemak keruh',
    visual_style: 'metaphoric_faceless',
    narrative_mode: 'Storytelling',
    resolved_health_metaphor: {
      type: 'vascular_tube',
      concept: 'Penampang pipa kaca transparan dialiri cairan keruh lalu jernih'
    }
  };

  const prompt = buildOrganicPillarPrompt([], campaignData, {}, {}, {});

  // 1. Verify STRATEGIC PLANNING CONTEXT header and all 6 strategic dimensions
  assert.ok(prompt.includes('## STRATEGIC PLANNING CONTEXT (DARI CONTENT PLANNER — WAJIB MENJADI RUJUKAN UTAMA CERITA):'), 'Must include strategic planning section header');
  assert.ok(prompt.includes('- Category Entry Point (CEP): "Kecemasan Kolesterol Pasangan"'), 'Must include Category CEP');
  assert.ok(prompt.includes('- W\'s Framework Matrix: "Who: Istri peduli suami | When: Malam sebelum tidur | Where: Kamar tidur | What: Cek hasil lab"'), 'Must include Ws Matrix');
  assert.ok(prompt.includes('- Konteks Situasi Spesifik (Context): "Bunda melihat suami sesak & cemas setelah makan malam berlemak"'), 'Must include Context');
  assert.ok(prompt.includes('- Visual Focus Objective (VFO): "Ekspresi cemas dan gelas air hangat di meja tidur"'), 'Must include VFO');
  assert.ok(prompt.includes('- Strategic Angle: "Pencegahan stroke dini lewat pembersihan vaskular"'), 'Must include Strategic Angle');
  assert.ok(prompt.includes('- Evidence / Fakta Terverifikasi: "Studi Journal of Lipid Research 2023"'), 'Must include Evidence');

  // 2. Verify Anti-Drift consistency rules
  assert.ok(prompt.includes('🚨 ATURAN KONSISTENSI SITUASI (ANTI-DRIFT):'), 'Must include Anti-Drift mandate');

  // 3. Verify Clip 1 Voiceover locks exact hook even when visual_style is metaphoric_faceless
  assert.ok(
    prompt.includes('WAJIB menggunakan naskah hook dari sistem secara persis: \\"Angka kolesterol suami bikin malam Bunda jadi gelisah? Saatnya ubah kebiasaan kecil dari rumah.\\"'),
    'Voiceover for scene 1 must enforce exact custom hook verbatim'
  );
  assert.ok(
    !prompt.includes('Bayangkan pembuluh darah kita seperti saluran kaca transparan ini'),
    'Prompt must not inject hardcoded generic analogy hook example when exact custom hook is provided'
  );

  // 4. Verify Clip 1 Visual Description reflects the exact visual action guideline
  assert.ok(
    prompt.includes('WAJIB merefleksikan aksi visual panduan: \\"Close-up penampang pipa kaca transparan berlumut lemak keruh\\"'),
    'Storyboard scene 1 visual description must enforce exact visual action guideline'
  );

  // 5. Verify Core Strategy section reflects hook and visual action
  assert.ok(
    prompt.includes('"Angka kolesterol suami bikin malam Bunda jadi gelisah? Saatnya ubah kebiasaan kecil dari rumah." (WAJIB DIBACAKAN PERSIS DI VOICE OVER KLIP 1)'),
    'Core strategy section must mandate exact hook read'
  );
  assert.ok(
    prompt.includes('- Panduan Aksi Visual Global: "Close-up penampang pipa kaca transparan berlumut lemak keruh"'),
    'Core strategy section must include exact visual action'
  );
});

test('OPC Strategic Context: fallback gracefully when strategic fields are absent', () => {
  const minimalCampaign = {
    campaign_name: 'Kampanye Standar',
    content_pillar: 'Tips Kesehatan',
    custom_hook: '',
    visual_action_guideline: '',
    visual_style: 'Cinematic'
  };

  const prompt = buildOrganicPillarPrompt([], minimalCampaign, {}, {}, {});

  assert.ok(!prompt.includes('## STRATEGIC PLANNING CONTEXT'), 'Should not include strategic planning context when fields are absent');
  assert.ok(prompt.includes('- Pilar Konten (Tema Utama): "Tips Kesehatan"'), 'Must fallback to content_pillar');
});
