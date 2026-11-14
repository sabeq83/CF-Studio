import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DISABLE_AUTO_MIGRATIONS = 'true';

const { PRODUCT_IMPORT_COLUMNS, PRODUCT_UPDATE_COLUMNS } = await import('../lib/product-repository.js');
const { validateSingleProductUpdate } = await import('../lib/product-validation.js');
const {
  buildVoProductFactsSeparationSection,
  buildOrganicPillarPrompt,
  buildMultiplierPhase2Prompt
} = await import('../lib/prompts.js');
const {
  buildRecipeVoStepContractSection,
  getRecipeMandateSection
} = await import('../lib/content-format-constants.js');

const V5_FIELDS = ['cara_pakai', 'takaran_label', 'penyimpanan', 'rasa_tekstur', 'fakta_produksi'];

test('V5-1: product repository allowlists include all 5 V5 product truth columns', () => {
  for (const field of V5_FIELDS) {
    assert.ok(PRODUCT_IMPORT_COLUMNS.includes(field), `PRODUCT_IMPORT_COLUMNS missing ${field}`);
    assert.ok(PRODUCT_UPDATE_COLUMNS.has(field), `PRODUCT_UPDATE_COLUMNS missing ${field}`);
  }
});

test('V5-1: validateSingleProductUpdate accepts, trims, and normalizes V5 fields', () => {
  const product = {
    product_name: 'Garlibee Madu Bawang Lanang',
    cara_pakai: '  Ambil 1 sendok teh madu bersama 1 siung bawang tunggal  ',
    takaran_label: '   ',
    penyimpanan: ' Simpan suhu ruang, tutup rapat ',
    rasa_tekstur: 'Manis legit karamel, lembut dikunyah',
    fakta_produksi: 'Difermentasi minimal 3 bulan di madu hutan'
  };
  const valid = validateSingleProductUpdate({ product });
  assert.deepEqual(valid.errors, {});
  assert.equal(valid.data.cara_pakai, 'Ambil 1 sendok teh madu bersama 1 siung bawang tunggal');
  assert.equal(valid.data.takaran_label, null);
  assert.equal(valid.data.penyimpanan, 'Simpan suhu ruang, tutup rapat');
  assert.equal(valid.data.rasa_tekstur, 'Manis legit karamel, lembut dikunyah');
  assert.equal(valid.data.fakta_produksi, 'Difermentasi minimal 3 bulan di madu hutan');

  const invalid = validateSingleProductUpdate({
    product: { cara_pakai: 12345 }
  });
  assert.ok(invalid.errors.cara_pakai);
});

test('V5-2: buildVoProductFactsSeparationSection separates cara_pakai vs fakta_produksi and flags Garlibee needs_data', () => {
  const populated = buildVoProductFactsSeparationSection({
    product_name: 'Garlibee Madu Bawang Lanang',
    cara_pakai: 'Ambil 1 siung dan 1 sdm madu tiap pagi',
    fakta_produksi: 'Difermentasi 3 bulan di madu hutan mentah'
  }, 'id-ID');
  assert.ok(populated.includes('Cara pakai (tindakan penonton): Ambil 1 siung dan 1 sdm madu tiap pagi'));
  assert.ok(populated.includes('Fakta produksi brand (alasan di anchor SAJA, BUKAN perintah tindakan penonton): Difermentasi 3 bulan di madu hutan mentah'));
  assert.ok(populated.includes('takaran_label, penyimpanan, rasa_tekstur'));

  // Garlibee audit state: empty V5 fields must surface needs_data cleanly without inventing values
  const garlibeeMissing = buildVoProductFactsSeparationSection({
    product_name: 'Garlibee Madu Bawang Lanang',
    product_description: 'Madu hutan mentah kombinasi bawang lanang tunggal fermentasi >3 bulan.',
    unique_selling_point: 'Fermentasi alami tanpa pewarna',
    cara_pakai: '',
    takaran_label: '',
    penyimpanan: '',
    rasa_tekstur: '',
    fakta_produksi: ''
  }, 'id-ID');
  assert.ok(garlibeeMissing.includes('cara_pakai, takaran_label, penyimpanan, rasa_tekstur, fakta_produksi'));
  assert.ok(garlibeeMissing.includes('DILARANG mengarang angka dosis'));
});

test('V5-2: buildOrganicPillarPrompt & buildMultiplierPhase2Prompt inject V5 product truth only when vo_content_contract is on', () => {
  const baseCampaign = {
    theme: 'Pencernaan sehat alami',
    content_pillar: 'Kebiasaan pagi',
    target_language: 'id-ID',
    target_clips_count: 4,
    clip_duration: 6,
    words_per_clip: '12-16 kata',
    is_bridging_active: 1,
    bridge_at_clip: 2,
    bridge_duration_clips: 2,
    narrative_mode: 'Tips/Tutorial'
  };
  const prod = {
    product_name: 'Garlibee',
    product_description: 'Bawang lanang fermentasi madu',
    unique_selling_point: 'Lembut dikunyah',
    cara_pakai: 'Ambil 1 siung langsung',
    fakta_produksi: 'Fermentasi 3 bulan di pabrik'
  };

  const offPrompt = buildOrganicPillarPrompt([], { ...baseCampaign, vo_content_contract: 'off' }, prod);
  const onPrompt = buildOrganicPillarPrompt([], { ...baseCampaign, vo_content_contract: 'on' }, prod);
  assert.ok(!offPrompt.includes('PEMISAHAN FAKTA PEMAKAIAN vs PRODUKSI PRODUK'));
  assert.ok(onPrompt.includes('PEMISAHAN FAKTA PEMAKAIAN vs PRODUKSI PRODUK'));
  assert.ok(onPrompt.includes('Ambil 1 siung langsung'));

  const multOff = buildMultiplierPhase2Prompt(
    { scenes: [{ scene: 1, voiceover: 'Mulai pagi hari', visual: 'Dapur' }] },
    prod,
    { isBridgingActive: true, bridgeAtClip: 2, vo_content_contract: 'off' },
    { vo_content_contract: 'off' },
    { targetLanguage: 'id-ID' }
  );
  const multOn = buildMultiplierPhase2Prompt(
    { scenes: [{ scene: 1, voiceover: 'Mulai pagi hari', visual: 'Dapur' }] },
    prod,
    { isBridgingActive: true, bridgeAtClip: 2, vo_content_contract: 'on' },
    { vo_content_contract: 'on' },
    { targetLanguage: 'id-ID' }
  );
  assert.ok(!multOff.includes('PEMISAHAN FAKTA PEMAKAIAN vs PRODUKSI PRODUK'));
  assert.ok(multOn.includes('PEMISAHAN FAKTA PEMAKAIAN vs PRODUKSI PRODUK'));
});

test('V5-3: Recipe specificity & anti-filler contract activates only when voContractActive is true', () => {
  const idOff = getRecipeMandateSection(true, 'id-ID');
  const idOn = getRecipeMandateSection(true, 'id-ID', { voContractActive: true });
  assert.ok(!idOff.includes('KONTRAK SPESIFISITAS LANGKAH & ANTI-FILLER RESEP'));
  assert.ok(idOn.includes('KONTRAK SPESIFISITAS LANGKAH & ANTI-FILLER RESEP'));
  assert.ok(idOn.includes('tingkat api/suhu'));
  assert.ok(idOn.includes('tanda visual/sensorik matang'));
  assert.ok(idOn.includes('ATURAN ANTI-FILLER'));

  const enContract = buildRecipeVoStepContractSection('en-US');
  assert.ok(enContract.includes('RECIPE VO & STEP SPECIFICITY CONTRACT'));
  assert.ok(enContract.includes('ANTI-FILLER RULE'));
});
