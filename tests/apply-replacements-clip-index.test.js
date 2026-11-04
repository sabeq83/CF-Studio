import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPromptReplacements } from '../lib/scheduler-processors.js';

test('applyPromptReplacements: handles 1 argument without throwing ReferenceError for clipIndex', () => {
  const visualOverrides = {
    subject_demographic: 'indonesian_woman',
    wardrobe_style: 'casual_hijab',
    lighting_style: 'soft_warm'
  };

  const campaign = {
    bridge_at_clip: 2,
    visual_style: 'metaphoric_faceless'
  };

  const demographicPresets = {
    indonesian_woman: 'a 30-year-old Indonesian woman wearing hijab'
  };
  const wardrobePresets = {
    casual_hijab: 'casual pastel tunic'
  };
  const lightingPresets = {
    soft_warm: 'warm morning sunlight'
  };

  // Calling without clipIndex (defaults to null)
  let result;
  assert.doesNotThrow(() => {
    result = applyPromptReplacements(
      'Cinematic shot of [Subject Anchor] in [Wardrobe Lock] with [Lighting Mood]',
      undefined,
      { visualOverrides, campaign, demographicPresets, wardrobePresets, lightingPresets }
    );
  }, 'Should not throw ReferenceError when clipIndex is omitted');

  assert.ok(result.includes('a 30-year-old Indonesian woman wearing hijab'));
  assert.ok(result.includes('casual pastel tunic'));
  assert.ok(result.includes('warm morning sunlight'));
});

test('applyPromptReplacements: isolates pre-bridge clips (< bridge_at_clip) for metaphoric_faceless', () => {
  const visualOverrides = {
    subject_demographic: 'indonesian_woman',
    wardrobe_style: 'casual_hijab',
    lighting_style: 'soft_warm',
    visual_style_preset: 'metaphoric_faceless'
  };

  const campaign = {
    bridge_at_clip: 3,
    visual_style: 'metaphoric_faceless'
  };

  const demographicPresets = {
    indonesian_woman: 'a 30-year-old Indonesian woman'
  };
  const wardrobePresets = {
    casual_hijab: 'casual clothes'
  };
  const lightingPresets = {
    soft_warm: 'soft warm light'
  };

  const promptInput = '(Biometric Anchor: a doctor speaking), (Wardrobe: lab coat), (Product Truth: GarliBee Honey Jar), (Lighting: studio light), macro shot of frying pan';

  // Clip 1 is pre-bridge (1 < 3)
  const preBridgeResult = applyPromptReplacements(promptInput, 1, {
    visualOverrides,
    campaign,
    demographicPresets,
    wardrobePresets,
    lightingPresets
  });

  assert.ok(
    preBridgeResult.includes('(Presence Truth: Strictly 100% Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE)'),
    'Pre-bridge clip must isolate presence to pure object'
  );
  assert.ok(
    preBridgeResult.includes('(Geometric Truth: strictly no product shown, strictly no bottle, jar, or packaging)'),
    'Pre-bridge clip must forbid product and packaging'
  );
  assert.ok(
    !preBridgeResult.includes('lab coat'),
    'Pre-bridge clip must remove wardrobe'
  );

  // Clip 3 is bridge clip (3 >= 3)
  const bridgeResult = applyPromptReplacements(promptInput, 3, {
    visualOverrides,
    campaign,
    demographicPresets,
    wardrobePresets,
    lightingPresets
  });

  assert.ok(
    bridgeResult.includes('(Biometric Anchor: a 30-year-old Indonesian woman)'),
    'Bridge clip must retain target character'
  );
  assert.ok(
    bridgeResult.includes('(Wardrobe: casual clothes)'),
    'Bridge clip must retain target wardrobe'
  );
});

test('applyPromptReplacements: handles null, empty string, and undefined prompts gracefully', () => {
  assert.equal(applyPromptReplacements(null), '');
  assert.equal(applyPromptReplacements(''), '');
  assert.equal(applyPromptReplacements(undefined), '');
});

test('applyPromptReplacements: handles mascot universe overrides without injecting human presets', () => {
  const visualOverrides = {
    subject_demographic: 'mascot_universe_fox',
    wardrobe_style: 'clay_art',
    lighting_style: 'bright_day'
  };

  const result = applyPromptReplacements('[Subject Anchor] wearing [Wardrobe Lock]', 1, {
    visualOverrides
  });

  assert.ok(result.includes('a 3D stylized cartoon character'));
  assert.ok(result.includes('organic clay textures'));
  assert.ok(!result.includes('Muslimah'));
});

test.after(() => {
  setTimeout(() => process.exit(0), 100);
});

