import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrganicPillarPrompt } from '../lib/prompts.js';
import { DAPUR_BOTANI_CONFIG, NUTRIBAKE_CONFIG } from '../scripts/seed-brand-visual-identities.mjs';

test('1. Organic Pillar Prompt Builder injects Dual-Realm Orchestration for Dapur Botani', () => {
  const campaignData = {
    campaign_name: '[ OPC 20261101 ] - dapurbotani - Garlibee Honey',
    content_pillar: 'Racik Sendiri atau Siap Nikmati?',
    custom_hook: 'Moms mau jaga daya tahan tubuh?',
    target_clips_count: 8,
    bridge_at_clip: 3,
    bridge_duration_clips: 1,
    is_bridging_active: 1,
    visual_mode: 'hybrid_lock',
    visual_style: 'Cinematic'
  };

  const productData = {
    product_name: 'GarliBee — Honey Infused Solo Garlic',
    product_description: 'Kebaikan madu mentah dan bawang lanang',
    unique_selling_point: 'Fermentasi minimal 3 bulan',
    packaging_type: 'Jar Plastik',
    is_in_packaging: 1,
    clean_photo_url: '/uploads/products/clean_garlibee.png'
  };

  const brandProfile = {
    brand_name: 'dapurbotani',
    brand_description: 'Earthy natural apothecary brand',
    visual_signature: 'Tactile macro botanical extraction on rough black slate stone with vintage amber dropper bottles and rustic granite mortar. Directional 3500K golden window chiaroscuro daylight. High-end 3D bio-cellular CGI simulations of soft organ tissue healing during pathology mechanisms. 100% faceless object-first cinematography.'
  };

  const vsoDapurBotani = {
    schema_version: 'visual_identity_snapshot_v1',
    identity_ref: { id: 'vi_dapurbotani_apothecary_3d', key: 'dapurbotani_apothecary_3d', version: 1 },
    structured: DAPUR_BOTANI_CONFIG,
    resolved: {
      environment_prompt: 'Artisanal apothecary studio, rough black slate stone workstation with glistening natural dew droplets, rustic granite mortar and pestle',
      lighting_prompt: 'Moody organic directional golden morning window light (3500K) with soft chiaroscuro shadows'
    }
  };

  const prompt = buildOrganicPillarPrompt([], campaignData, productData, brandProfile, vsoDapurBotani);

  // 1. Verifikasi Dual-Realm Mandate
  assert.ok(prompt.includes('DUAL-REALM NARRATIVE ORCHESTRATION MANDATE:'), 'Dual-realm mandate header wajib ada di Organic Pillar');
  assert.ok(prompt.includes('REALM 1: PHYSICAL WORKSPACE & PREPARATION'), 'Realm 1 physical workspace wajib terdaftar');
  assert.ok(prompt.includes('REALM 2: SCIENTIFIC / 3D BIO-CELLULAR SIMULATION'), 'Realm 2 3D bio-cellular wajib terdaftar');
  assert.ok(prompt.includes('High-end 3D bio-cellular CGI simulations'), 'Simulasi 3D bio-cellular deskripsi wajib ada');
  assert.ok(prompt.includes('rough black slate stone workstation'), 'Workspace slate stone Realm 1 wajib ada');

  // 2. Verifikasi aturan transisi antar-alam
  assert.ok(prompt.includes('Transisi cinematic scientific cutaways antara Realm 1 dan Realm 2 diperbolehkan secara eksplisit'), 'Scientific cutaways harus diizinkan');

  // 3. Verifikasi Negative Prompt TIDAK melarang CGI look
  assert.ok(!prompt.includes('CGI look'), 'Dapur Botani berkemampuan 3D simulation DILARANG memiliki "CGI look" di negative prompt');

  // 4. Verifikasi Dynamic Mode Routing menugaskan 3D Bio-Cellular untuk klip Mechanism
  assert.ok(prompt.includes('Mode Visual: "3d_bio_cellular"'), 'Klip Mechanism wajib menugaskan mode 3d_bio_cellular');

  // 5. Verifikasi Template Prompt T2I Polimorfik menyertakan Layer 3D Cellular Truth
  assert.ok(prompt.includes('[LAYER 2: 3D BIO-CELLULAR & ANATOMICAL TRUTH]'), 'Layer 3D Bio-Cellular Truth wajib ada di contoh T2I prompt');
});

test('2. Organic Pillar Prompt Builder maintains Single-Realm Tabletop for Nutribake (No 3D Contamination)', () => {
  const campaignData = {
    campaign_name: '[ OPC 20261101 ] - nutribake - Fudgy Brownie',
    content_pillar: 'Camilan Sehat Tanpa Gula',
    custom_hook: 'Ngidam manis tapi takut gula?',
    target_clips_count: 6,
    bridge_at_clip: 2,
    is_bridging_active: 1,
    visual_mode: 'hybrid_lock',
    visual_style: 'Cinematic'
  };

  const productData = {
    product_name: 'Nutribake Flourless Brownie Mix',
    packaging_type: 'Pouch'
  };

  const brandProfile = {
    brand_name: 'nutribake',
    visual_signature: 'Sensory ASMR pastry craft and sugar-free baking cinematography anchored strictly on seamless flat matte warm-grey quartz countertop. 100% faceless hands-only movement.'
  };

  const vsoNutribake = {
    schema_version: 'visual_identity_snapshot_v1',
    identity_ref: { id: 'vi_nutribake_clean_kitchen', key: 'nutribake_clean_kitchen', version: 1 },
    structured: NUTRIBAKE_CONFIG,
    resolved: {
      environment_prompt: 'Pristine modern kitchen island with seamless flat matte warm-grey quartz countertop',
      lighting_prompt: 'Bright clean morning daylight'
    }
  };

  const prompt = buildOrganicPillarPrompt([], campaignData, productData, brandProfile, vsoNutribake);

  // 1. Verifikasi Nutribake TIDAK memicu Dual-Realm
  assert.ok(!prompt.includes('DUAL-REALM NARRATIVE ORCHESTRATION MANDATE:'), 'Nutribake DILARANG memicu dual-realm');
  assert.ok(!prompt.includes('REALM 2: SCIENTIFIC / 3D BIO-CELLULAR SIMULATION'), 'Nutribake DILARANG memiliki Realm 2');

  // 2. Verifikasi Nutribake tetap pada estetika single culinary cinematic
  assert.ok(prompt.includes('Nutribake — Clean Modern Kitchen & Sensory Baking'), 'Nutribake label visual identity wajib ada');
  assert.ok(prompt.includes('Gaya Visual Utama (Primary Style): "culinary_cinematic"'), 'Nutribake wajib konsisten pada primary style culinary_cinematic');
});

test.after(() => {
  setTimeout(() => process.exit(0), 100);
});
