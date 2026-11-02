import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAndNormalizeVisualIdentity } from '../lib/visual-identity-contract.js';
import {
  DAPUR_BOTANI_CONFIG,
  DAPUR_BOTANI_FEMALE_CONFIG,
  DAPUR_BOTANI_MALE_CONFIG,
  NUTRIBAKE_CONFIG,
  SIASAT_SEHAT_CONFIG
} from '../scripts/seed-brand-visual-identities.mjs';

test('1. Validasi Dapur Botani Female & Male Contract V2 & 3D Bio-Cellular Routing', () => {
  // Test Female Preset (Default Syar'i Classic)
  const female = validateAndNormalizeVisualIdentity(DAPUR_BOTANI_FEMALE_CONFIG);
  assert.equal(female.schema_version, '2');
  assert.equal(female.label, 'Dapur Botani — Earthy Botanical Apothecary & 3D Bio-Cellular Female');
  assert.equal(female.subject.kind, 'human');
  assert.equal(female.subject.faceless_mode, 'hands_only');
  assert.equal(female.subject.demographic_key, 'syari_classic');
  assert.equal(female.wardrobe.sleeve_policy, 'wrists_covered');
  assert.equal(female.wardrobe.primary_color, 'soft_mocca');
  assert.equal(female.wardrobe.secondary_color, null);
  assert.ok(female.environment.material_palette.includes('rough black slate stone'));
  assert.equal(female.lighting.color_temperature, 'warm');
  assert.equal(female.camera.lens_look, 'macro_closeup');
  assert.equal(female.guardrails.face_visibility, 'prohibited');
  assert.equal(female.mode_routing.mechanism, '3d_bio_cellular');
  assert.ok(female.guardrails.required_negative_prompts.includes('human face'));
  assert.ok(female.guardrails.required_negative_prompts.includes('male hands'));
  assert.ok(female.guardrails.required_negative_prompts.includes('bare arms'));
  assert.ok(female.guardrails.required_negative_prompts.includes('wardrobe color change'));
  assert.ok(female.guardrails.required_negative_prompts.includes('white marble veining'));
  assert.ok(!female.guardrails.required_negative_prompts.includes('syari dress'), 'Female syari must NOT forbid syari dress');

  // Test Male Preset (Caucasian Male Botanist)
  const male = validateAndNormalizeVisualIdentity(DAPUR_BOTANI_MALE_CONFIG);
  assert.equal(male.schema_version, '2');
  assert.equal(male.label, 'Dapur Botani — Earthy Botanical Apothecary & 3D Bio-Cellular Male');
  assert.equal(male.subject.kind, 'human');
  assert.equal(male.subject.faceless_mode, 'hands_only');
  assert.equal(male.subject.demographic_key, 'caucasian_male');
  assert.equal(male.wardrobe.sleeve_policy, 'forearms_exposed');
  assert.equal(male.wardrobe.primary_color, 'earthy_raw_linen');
  assert.equal(male.wardrobe.secondary_color, null);
  assert.ok(male.environment.material_palette.includes('rough black slate stone'));
  assert.equal(male.lighting.color_temperature, 'warm');
  assert.equal(male.mode_routing.mechanism, '3d_bio_cellular');
  assert.ok(male.guardrails.required_negative_prompts.includes('human face'));
  assert.ok(male.guardrails.required_negative_prompts.includes('female hands'));
  assert.ok(male.guardrails.required_negative_prompts.includes('wardrobe color change'));
  assert.ok(male.guardrails.required_negative_prompts.includes('syari dress'), 'Male botanist must forbid syari dress');

  // Legacy alias must point to female
  assert.equal(DAPUR_BOTANI_CONFIG.subject.demographic_key, 'syari_classic');
});

test('2. Validasi Nutribake Contract V2 (Strict Anti-Marble & Modern Baking Guarantee)', () => {
  const norm = validateAndNormalizeVisualIdentity(NUTRIBAKE_CONFIG);
  assert.equal(norm.schema_version, '2');
  assert.equal(norm.label, 'Nutribake — Clean Modern Kitchen & Sensory Baking');
  assert.equal(norm.subject.kind, 'human');
  assert.equal(norm.subject.faceless_mode, 'hands_only');
  assert.ok(norm.environment.material_palette.includes('seamless flat matte warm-grey quartz countertop'));
  assert.ok(norm.environment.props.includes('copper pastry tools'));
  assert.equal(norm.lighting.color_temperature, 'neutral');
  assert.equal(norm.camera.lens_look, 'macro_closeup');
  assert.equal(norm.guardrails.face_visibility, 'prohibited');
  assert.ok(norm.guardrails.required_negative_prompts.includes('white marble veining'));
  assert.ok(norm.guardrails.required_negative_prompts.includes('syari dress'));
  assert.ok(norm.guardrails.required_negative_prompts.includes('rough black slate'));
});

test('3. Validasi Siasat Sehat Contract V2 (Clinical Biohacking & 3D High-Tech Anatomy)', () => {
  const norm = validateAndNormalizeVisualIdentity(SIASAT_SEHAT_CONFIG);
  assert.equal(norm.schema_version, '2');
  assert.equal(norm.label, 'Siasat Sehat — Clinical Biohacking & 3D High-Tech Anatomy');
  assert.equal(norm.subject.kind, 'human');
  assert.equal(norm.subject.faceless_mode, 'hands_only');
  assert.ok(norm.environment.material_palette.includes('matte charcoal micro-cement countertop'));
  assert.ok(norm.environment.props.includes('magnetic vortex mixer'));
  assert.equal(norm.lighting.color_temperature, 'cool');
  assert.equal(norm.camera.lens_look, 'macro_closeup');
  assert.equal(norm.guardrails.face_visibility, 'prohibited');
  assert.equal(norm.mode_routing.mechanism, 'symbolic_surrealism');
  assert.ok(norm.guardrails.required_negative_prompts.includes('caucasian male'));
  assert.ok(norm.guardrails.required_negative_prompts.includes('white marble'));
});

test('4. Cross-Brand Differentiation & Zero Surface Conflict Guarantee', () => {
  const botani = validateAndNormalizeVisualIdentity(DAPUR_BOTANI_CONFIG);
  const nutri = validateAndNormalizeVisualIdentity(NUTRIBAKE_CONFIG);
  const siasat = validateAndNormalizeVisualIdentity(SIASAT_SEHAT_CONFIG);

  // Surface materials must be completely distinct
  const botaniSurface = botani.environment.material_palette[0];
  const nutriSurface = nutri.environment.material_palette[0];
  const siasatSurface = siasat.environment.material_palette[0];

  assert.notEqual(botaniSurface, nutriSurface);
  assert.notEqual(botaniSurface, siasatSurface);
  assert.notEqual(nutriSurface, siasatSurface);

  // Lighting temperatures must be distinctly categorized (warm, neutral, cool)
  assert.equal(botani.lighting.color_temperature, 'warm');
  assert.equal(nutri.lighting.color_temperature, 'neutral');
  assert.equal(siasat.lighting.color_temperature, 'cool');

  // HabitFolk uses white marble, none of our 3 presets may use white marble in material palette
  for (const preset of [botani, nutri, siasat]) {
    for (const mat of preset.environment.material_palette) {
      assert.ok(!mat.toLowerCase().includes('white marble'), `Preset ${preset.label} contains white marble: ${mat}`);
    }
  }
});
