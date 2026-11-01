import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectSoloGarlicContext,
  buildProductTruthContractSection,
  buildOrganicPillarPrompt
} from '../lib/prompts.js';
import { DAPUR_BOTANI_FEMALE_CONFIG } from '../scripts/seed-brand-visual-identities.mjs';

test('1. detectSoloGarlicContext accurately flags Solo Garlic and GarliBee variations', () => {
  assert.equal(detectSoloGarlicContext({ product_name: 'GarliBee — Honey Infused Solo Garlic' }), true);
  assert.equal(detectSoloGarlicContext({ product_name: 'Madu Bawang Lanang Alami' }), true);
  assert.equal(detectSoloGarlicContext({ unique_selling_point: 'Bawang putih tunggal fermentasi 3 bulan' }), true);
  assert.equal(detectSoloGarlicContext({ product_truth: 'Ekstrak bawang tunggal murni' }), true);
  assert.equal(detectSoloGarlicContext({}, { campaign_name: 'Edukasi Khasiat Solo Garlic' }), true);

  // Negative / unrelated products
  assert.equal(detectSoloGarlicContext({ product_name: 'Nezafit Teh Daun Jati Cina' }), false);
  assert.equal(detectSoloGarlicContext({ product_name: 'Nutribake Choco Ganache' }), false);
});

test('2. buildProductTruthContractSection injects 3-month fermented solo garlic biological truth', () => {
  const garlibeeProduct = {
    id: 'pe_1793545394035_6698',
    product_name: 'GarliBee — Honey Infused Solo Garlic',
    product_description: 'Madu mentah dan bawang lanang fermentasi 3 bulan',
    packaging_type: 'Jar Kaca (Squircle Glass Jar)',
    product_truth: 'Authentic naturally fermented Solo Garlic aged for over 3 months in raw forest honey.',
    geometric_truth: 'Squircle transparent glass jar with ribbed silver-metal screw lid.',
    clean_photo_url: '/uploads/products/garlibee_clean_official.jpg'
  };

  const section = buildProductTruthContractSection(garlibeeProduct, 3, 4);

  // Biological Morphology Guarantees
  assert.ok(section.includes('MANDATORY BOTANICAL INGREDIENT TRUTH: 3-MONTH FERMENTED SOLO GARLIC'));
  assert.ok(section.includes('monobulb pearl garlic / Bawang Putih Tunggal / Bawang Lanang'));
  assert.ok(section.includes('solid and seamless without internal clove segments or dividers'));

  // 3-Month Fermentation Amber-Brown & Soft Texture Guarantees
  assert.ok(section.includes('translucent caramelized amber-brown hue from 3+ months'));
  assert.ok(section.includes('spoon-tender with tiny active fermentation micro-bubbles'));

  // Strict Negative Blockers
  assert.ok(section.includes('chalky white raw garlic'));
  assert.ok(section.includes('multi-clove garlic bulb'));
  assert.ok(section.includes('segmented garlic head'));
  assert.ok(section.includes('clustered garlic cloves'));
});

test('3. buildOrganicPillarPrompt automatically enforces anti-multi-clove negative prompts for GarliBee', () => {
  const campaignData = {
    campaign_name: '[ OPC 20261101 ] - dapurbotani - Garlibee Honey',
    content_pillar: 'Bawang Lanang Fermentasi untuk Imunitas',
    custom_hook: 'Moms pernah dengar khasiat bawang lanang?',
    target_clips_count: 6,
    bridge_at_clip: 3,
    bridge_duration_clips: 1,
    is_bridging_active: 1,
    visual_mode: 'hybrid_lock',
    visual_style: 'Cinematic'
  };

  const garlibeeProduct = {
    id: 'pe_1793545394035_6698',
    product_name: 'GarliBee — Honey Infused Solo Garlic',
    packaging_type: 'Jar Kaca (Squircle Glass Jar)',
    clean_photo_url: '/uploads/products/garlibee_clean_official.jpg'
  };

  const brandProfile = {
    brand_name: 'dapurbotani',
    visual_signature: 'Tactile macro botanical extraction on rough black slate stone.'
  };

  const vso = {
    schema_version: 'visual_identity_snapshot_v1',
    identity_ref: { id: 'vi_dapurbotani_apothecary_3d_female', key: 'dapurbotani_apothecary_3d_female', version: 1 },
    structured: DAPUR_BOTANI_FEMALE_CONFIG
  };

  const prompt = buildOrganicPillarPrompt([], campaignData, garlibeeProduct, brandProfile, vso);

  // Must contain botanical mandate
  assert.ok(prompt.includes('MANDATORY BOTANICAL INGREDIENT TRUTH: 3-MONTH FERMENTED SOLO GARLIC'));
  assert.ok(prompt.includes('translucent caramelized amber-brown hue'));

  // Must contain anti-multi-clove blockers in negative prompt
  assert.ok(prompt.includes('multi-clove garlic bulb'));
  assert.ok(prompt.includes('chalky white raw garlic'));
  assert.ok(prompt.includes('segmented garlic head'));
});

test('4. Cross-Product Isolation: Non-garlic products remain 100% clean of garlic mandates', () => {
  const nonGarlicProduct = {
    id: 'prod_tea_01',
    product_name: 'Nezafit Teh Daun Jati Cina',
    packaging_type: 'Pouch Foil',
    clean_photo_url: '/uploads/products/nezafit.png'
  };

  const section = buildProductTruthContractSection(nonGarlicProduct, 2, 3);
  assert.ok(!section.includes('SOLO GARLIC'));
  assert.ok(!section.includes('Bawang Lanang'));
  assert.ok(!section.includes('multi-clove garlic bulb'));
});
