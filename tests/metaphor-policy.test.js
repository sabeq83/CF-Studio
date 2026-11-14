import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveMetaphorPolicy,
  presenceTruthTuple,
  environmentTuple,
  lightingTupleForClip,
  metaphorMandateHeader,
  LEGACY_PRESENCE_TRUTH_TUPLE,
  MODEST_HANDS_PRESENCE_TRUTH_TUPLE,
  POSITIVE_CLIP1_OBJECT_PRESENCE_TUPLE,
} from '../lib/metaphor-policy.js';
import { validateAndNormalizeVisualIdentity } from '../lib/visual-identity-contract.js';
import { buildVisualIdentityComplianceReport } from '../lib/visual-identity-ai-contract.js';
import { getKit } from '../lib/metaphor-world-kits.js';

const fullSwitchesVI = {
  subject: { kind: 'human', faceless_mode: 'hands_only' },
  wardrobe: { sleeve_policy: 'wrists_covered' },
  environment: { policy: 'metaphor_driven' },
  metaphor_engine: {
    enabled: true,
    hands_policy: 'modest_hands_active',
    product_entry: 'inside_metaphor',
    lighting_arc: 'kit',
  },
};

test('resolveMetaphorPolicy: default (tanpa flag/switch) = perilaku lama penuh', () => {
  const p = resolveMetaphorPolicy({
    viConfig: {},
    isMetaphoricFaceless: true,
    isInvestigativeFaceless: false,
    kit: getKit('grease_in_water'),
  });
  assert.equal(p.active, true);
  assert.equal(p.environmentPolicy, 'brand_locked');
  assert.equal(p.handsPolicy, 'zero_hands');
  assert.equal(p.productEntry, 'after_bridge');
  assert.equal(p.lightingArc, null);
  assert.equal(presenceTruthTuple(p, 'pre'), LEGACY_PRESENCE_TRUTH_TUPLE);
});

test('resolveMetaphorPolicy: investigative_faceless selalu menonaktifkan policy (zero-hands tetap)', () => {
  const p = resolveMetaphorPolicy({
    viConfig: fullSwitchesVI,
    isMetaphoricFaceless: true,
    isInvestigativeFaceless: true,
    kit: getKit('grease_in_water'),
  });
  assert.equal(p.active, false);
  assert.equal(p.handsPolicy, 'zero_hands');
  assert.equal(p.environmentPolicy, 'brand_locked');
  assert.equal(p.productEntry, 'after_bridge');
  assert.equal(p.lightingArc, null);
  assert.ok(p.reasons.includes('investigative_faceless_locked'));
});

test('resolveMetaphorPolicy: fail-safe tanpa kit (hanya hands_policy tetap aktif)', () => {
  const p = resolveMetaphorPolicy({
    viConfig: fullSwitchesVI,
    isMetaphoricFaceless: true,
    isInvestigativeFaceless: false,
    kit: null,
  });
  assert.equal(p.active, true);
  assert.equal(p.handsPolicy, 'modest_hands_active');
  assert.equal(p.environmentPolicy, 'brand_locked');
  assert.equal(p.productEntry, 'after_bridge');
  assert.equal(p.lightingArc, null);
  assert.ok(p.reasons.includes('fallback_no_kit:environment_brand_locked'));
  assert.ok(p.reasons.includes('fallback_no_kit:product_entry_after_bridge'));
  assert.ok(p.reasons.includes('fallback_no_kit:lighting_arc_none'));
});

test('resolveMetaphorPolicy: keempat switch aktif dengan kit lengkap', () => {
  const kit = getKit('grease_in_water');
  const p = resolveMetaphorPolicy({
    viConfig: fullSwitchesVI,
    isMetaphoricFaceless: true,
    isInvestigativeFaceless: false,
    kit,
  });
  assert.equal(p.active, true);
  assert.equal(p.environmentPolicy, 'metaphor_driven');
  assert.equal(p.handsPolicy, 'modest_hands_active');
  assert.equal(p.productEntry, 'inside_metaphor');
  assert.deepEqual(p.lightingArc, kit.lighting_arc);
  assert.equal(p.sceneEnvironment, kit.environment);
  assert.equal(p.objectWorld, kit.object_world);
  assert.deepEqual(p.handVariant, kit.hand_variant);

  // Klip 1 tetap object-only (positive framing pada F2.1) walau tangan aktif; pre klip 2+ memakai modest hands
  assert.equal(presenceTruthTuple(p, 'clip1'), POSITIVE_CLIP1_OBJECT_PRESENCE_TUPLE);
  assert.equal(presenceTruthTuple(p, 'pre'), MODEST_HANDS_PRESENCE_TRUTH_TUPLE);
  assert.equal(environmentTuple(p, 'fallback'), kit.environment);
});

test('resolveMetaphorPolicy: subjek non-hands (silhouette / animal) memaksa zero_hands', () => {
  const kit = getKit('grease_in_water');
  const pSilhouette = resolveMetaphorPolicy({
    viConfig: {
      ...fullSwitchesVI,
      subject: { kind: 'human', faceless_mode: 'silhouette' },
    },
    isMetaphoricFaceless: true,
    isInvestigativeFaceless: false,
    kit,
  });
  assert.equal(pSilhouette.handsPolicy, 'zero_hands');

  const pAnimal = resolveMetaphorPolicy({
    viConfig: {
      ...fullSwitchesVI,
      subject: { kind: 'animal', faceless_mode: 'not_applicable' },
    },
    isMetaphoricFaceless: true,
    isInvestigativeFaceless: false,
    kit,
  });
  assert.equal(pAnimal.handsPolicy, 'zero_hands');
});

test('validateAndNormalizeVisualIdentity & compliance report: koreksi sleeve_policy & subject non-hands', () => {
  const rawBadSleeve = {
    schema_version: '2',
    label: 'Test Modest Hands Sleeve',
    subject: { kind: 'human', faceless_mode: 'hands_only' },
    visual_language: { primary_style: 'commercial_product_cinematic' },
    wardrobe: { sleeve_policy: 'forearms_exposed' },
    environment: { policy: 'metaphor_driven' },
    metaphor_engine: {
      hands_policy: 'modest_hands_active',
      product_entry: 'inside_metaphor',
      lighting_arc: 'kit',
    },
  };
  const normSleeve = validateAndNormalizeVisualIdentity(rawBadSleeve);
  assert.equal(normSleeve.metaphor_engine.hands_policy, 'modest_hands_active');
  assert.equal(normSleeve.wardrobe.sleeve_policy, 'wrists_covered');
  assert.equal(normSleeve.environment.policy, 'metaphor_driven');
  assert.equal(normSleeve.metaphor_engine.product_entry, 'inside_metaphor');
  assert.equal(normSleeve.metaphor_engine.lighting_arc, 'kit');

  const reportSleeve = buildVisualIdentityComplianceReport(rawBadSleeve, normSleeve);
  assert.ok(reportSleeve.corrections.some(c => c.path === 'wardrobe.sleeve_policy'));

  const rawBadSubject = {
    schema_version: '2',
    label: 'Test Silhouette Subject',
    subject: { kind: 'human', faceless_mode: 'silhouette' },
    visual_language: { primary_style: 'commercial_product_cinematic' },
    metaphor_engine: { hands_policy: 'modest_hands_active' },
  };
  const normSub = validateAndNormalizeVisualIdentity(rawBadSubject);
  assert.equal(normSub.metaphor_engine.hands_policy, 'zero_hands');
  const reportSub = buildVisualIdentityComplianceReport(rawBadSubject, normSub);
  assert.ok(reportSub.corrections.some(c => c.path === 'metaphor_engine.hands_policy'));
});

test('lightingTupleForClip & metaphorMandateHeader: transisi lighting per zona dan header legacy identik', () => {
  const kit = getKit('grease_in_water');
  const policy = resolveMetaphorPolicy({
    viConfig: fullSwitchesVI,
    isMetaphoricFaceless: true,
    isInvestigativeFaceless: false,
    kit,
  });

  const plan = {
    totalClips: 6,
    bridgeAtClip: 4,
    zoneOf: (c) => (c < 4 ? 'pre' : 'intro'),
    isProductClip: (c) => c >= 4,
  };
  assert.equal(lightingTupleForClip(policy, 1, plan), kit.lighting_arc.from);
  assert.equal(lightingTupleForClip(policy, 3, plan), kit.lighting_arc.from);
  assert.ok(lightingTupleForClip(policy, 4, plan).includes(kit.lighting_arc.from));
  assert.ok(lightingTupleForClip(policy, 4, plan).includes(kit.lighting_arc.to));
  assert.equal(lightingTupleForClip(policy, 6, plan), kit.lighting_arc.to);

  const legacyHeader = metaphorMandateHeader(null, { bridgeAtClip: 3 });
  assert.equal(
    legacyHeader.title,
    '🚨 OBJECT-CENTRIC METAPHOR MANDATE (100% PURE OBJECT PRE-BRIDGING — ZERO HANDS / GROUNDED REAL-LIFE CONTEXT)'
  );
  assert.ok(legacyHeader.forbiddenHandsLine.includes('DILARANG KERAS memunculkan TANGAN, LENGAN, JARI'));
});

