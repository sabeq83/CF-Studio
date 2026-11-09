import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMultiplierPhase2Prompt,
  cleanYoutubeTitle,
  getRecipeMandateSection
} from '../lib/prompts.js';

test('Auto Pipeline Multiplier: buildMultiplierPhase2Prompt generates full recipe and Shopee/Bio CTA when generate_recipe is true', () => {
  const dummyStoryboard = [
    { scene: 1, narration_transcript: 'Rebus rimpang jahe dan serai...', visual_description: 'Panci mendidih' },
    { scene: 2, narration_transcript: 'Saring dan tambahkan madu murni...', visual_description: 'Menuang ke gelas' }
  ];
  const dummyProductDNA = {
    product_name: 'Madu Hutan Alami',
    unique_selling_point: '100% murni tanpa pengawet',
    product_description: 'Madu herbal kaya enzim'
  };
  const dummyAesthetics = {
    clipDuration: 8,
    targetDemographic: 'indonesian_casual'
  };
  const dummyBridging = {
    targetClipsCount: 2,
    isBridgingActive: true,
    bridgeAtClip: 1,
    generate_recipe: 1
  };
  const dummyVso = {
    isVsoActive: false
  };
  const dummyAudio = {
    enableTts: true,
    targetLanguage: 'id-ID'
  };

  const promptActive = buildMultiplierPhase2Prompt(
    dummyStoryboard,
    dummyProductDNA,
    dummyAesthetics,
    dummyBridging,
    dummyVso,
    dummyAudio
  );

  // 1. Mandat Resep wajib disuntikkan
  assert.match(promptActive, /RECIPE & HERBAL CONCOCTION MANDATE \[AKTIF\]/);
  assert.match(promptActive, /YOUTUBE SHORTS HIGH-CTR TITLE MANDATE \[STRICT\]/);

  // 2. Output schema caption, caption_facebook, dan caption_bio memuat resep lengkap
  assert.match(promptActive, /Teks resep\/racikan lengkap \(Bahan & Takaran, Langkah Pembuatan/);
  assert.match(promptActive, /"caption_facebook":\s*"Teks naskah caption lengkap memuat seluruh teks resep/);
  assert.match(promptActive, /"caption_bio":\s*"Teks naskah caption lengkap memuat seluruh teks resep/);
  assert.match(promptActive, /{{AFFILIATE_LINK}}/);

  // 3. Saat generate_recipe: 0 / false
  const promptInactive = buildMultiplierPhase2Prompt(
    dummyStoryboard,
    dummyProductDNA,
    dummyAesthetics,
    { ...dummyBridging, generate_recipe: 0 },
    dummyVso,
    dummyAudio
  );

  assert.doesNotMatch(promptInactive, /RECIPE & HERBAL CONCOCTION MANDATE \[AKTIF\]/);
  assert.match(promptInactive, /"caption_facebook":\s*"Teks naskah caption khusus Facebook/);
  assert.match(promptInactive, /"caption_bio":\s*"Teks naskah caption khusus platform selain Facebook/);
});

test('Auto Pipeline Multiplier: cleanYoutubeTitle guarantees High-CTR without hanging words', () => {
  const hanging = '3 Racikan Rimpang Bikin Badan Segar Sama Seperti #Shorts';
  const cleaned = cleanYoutubeTitle(hanging);
  assert.equal(cleaned, '3 Racikan Rimpang Bikin Badan Segar #Shorts');

  const emptyTitleWithVo = cleanYoutubeTitle('', 'Racikan teh herbal penenang maag alami');
  assert.equal(emptyTitleWithVo, 'Racikan teh herbal penenang maag alami #Shorts');
});

