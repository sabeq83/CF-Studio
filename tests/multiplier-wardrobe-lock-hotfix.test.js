import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  resolveVisualIdentitySnapshot,
  resolvePaletteColorChoice
} from '../lib/visual-override-resolver.js';
import { buildMultiplierPhase2Prompt } from '../lib/prompts.js';
import { buildMultiplierStartFrameRequest } from '../lib/multiplier-start-frame-request.js';

const nutriblendMaleVI = {
  schema_version: 'visual_identity_snapshot_v1',
  identity_ref: {
    id: 'vi_mwvkcoc3_24215939',
    key: 'nutriblend_identity_v3_male',
    version: 1,
    source: 'preset'
  },
  structured: {
    label: 'NutriBlend — Brand Identity Card v3 Male',
    subject: {
      kind: 'human',
      faceless_mode: 'hands_only',
      demographic_key: 'southeast_asian_male',
      custom_description:
        'POV close-up framing focusing strictly on young Indonesian male hands and forearms, wearing a clean minimalist casual cotton/linen shirt with neatly rolled sleeves or plain athletic top.'
    },
    wardrobe: {
      mode: 'stable_random',
      preset_key: 'custom',
      primary_color: '',
      secondary_color: '',
      palette: [
        'Charcoal Slate',
        'Deep Navy',
        'Olive Drab',
        'Warm Sand Beige',
        'Crisp Off-White',
        'Forest Pine'
      ],
      sleeve_policy: 'wrists_covered',
      custom_description:
        'Single plain unprinted casual male cotton/linen shirt with neatly rolled sleeves or clean minimalist athletic top per video, no logos or text'
    },
    lighting: {
      preset_key: 'window_daylight',
      custom_description: 'Crisp clean directional daylight'
    },
    environment: {
      policy: 'planner_driven',
      preset_key: 'custom',
      fallback_location: 'Clean modern Indonesian home kitchen counter'
    },
    rendering: {},
    composition: {},
    guardrails: {
      face_visibility: 'prohibited',
      required_negative_prompts: ['female hands', 'human face']
    }
  }
};

test('resolvePaletteColorChoice locks 1 deterministic color per seed and allows different colors across different seeds', () => {
  const palette = nutriblendMaleVI.structured.wardrobe.palette;
  const seedA1 = resolvePaletteColorChoice({ wardrobe: nutriblendMaleVI.structured.wardrobe, stableSeed: 'batch1:mul_a' });
  const seedA2 = resolvePaletteColorChoice({ wardrobe: nutriblendMaleVI.structured.wardrobe, stableSeed: 'batch1:mul_a' });
  assert.equal(seedA1, seedA2);
  assert.ok(palette.includes(seedA1));

  // Verify multiple seeds produce more than 1 unique color from the palette
  const observed = new Set();
  for (let i = 0; i < 30; i++) {
    observed.add(resolvePaletteColorChoice({
      wardrobe: nutriblendMaleVI.structured.wardrobe,
      stableSeed: `batch_var_${i}:mul_${i}`
    }));
  }
  assert.ok(observed.size >= 2, `Expected multiple colors across campaigns, got: ${[...observed].join(', ')}`);
});

test('resolveVisualIdentitySnapshot locks single solid color and strips ambiguous athletic top option for custom + palette', () => {
  const snap = resolveVisualIdentitySnapshot(nutriblendMaleVI, {
    itemIndex: 0,
    stableSeed: 'mul_261125_scjc0u:mul_261125_scjc0u',
    narrativeFunction: 'hook'
  });

  const lockedColor = snap.resolved.wardrobe_color_label;
  assert.ok(nutriblendMaleVI.structured.wardrobe.palette.includes(lockedColor));
  assert.ok(snap.resolved.wardrobe_prompt.includes(lockedColor), 'wardrobe_prompt wajib mencantumkan warna terkunci');
  assert.ok(!/or\s+(?:clean minimalist |plain )?athletic top/i.test(snap.resolved.wardrobe_prompt));
  assert.ok(!/or\s+(?:clean minimalist |plain )?athletic top/i.test(snap.resolved.subject_prompt));
  assert.equal(snap.resolved_wardrobe_color, lockedColor);
});

test('buildMultiplierPhase2Prompt & buildMultiplierStartFrameRequest lock uniform shirt color across live-action clips while skipping 3D CGI clips', () => {
  const snap = resolveVisualIdentitySnapshot(nutriblendMaleVI, {
    itemIndex: 0,
    stableSeed: 'mul_261125_scjc0u:mul_261125_scjc0u',
    narrativeFunction: 'hook'
  });
  const lockedColor = snap.resolved.wardrobe_color_label;

  const vso = {
    isVsoActive: true,
    ...snap.legacy,
    ...snap.resolved,
    structured: snap.structured,
    resolved: snap.resolved,
    resolvedWardrobeColor: lockedColor,
    resolved_wardrobe_color: lockedColor,
    resolved_wardrobe_prompt: snap.resolved.wardrobe_prompt
  };

  const prompt = buildMultiplierPhase2Prompt(
    [{ scene: 1, visual_description: 'Slice turmeric', narration_transcript: 'Test VO' }],
    { is_pure_storytelling: true },
    { aspectRatio: '9:16', clipDuration: 8 },
    { campaign_type: 'pure_storytelling', visualMode: 'hybrid_lock', targetClipsCount: 6 },
    vso,
    { targetLanguage: 'id-ID' },
    0
  );

  assert.ok(prompt.includes(`MANDATORY LOCKED COLOR FOR THIS ENTIRE VIDEO: strictly "${lockedColor}" only`));
  assert.ok(!/or\s+(?:clean minimalist |plain )?athletic top/i.test(prompt));

  const liveReq = buildMultiplierStartFrameRequest({
    task: { id: 'mul_test_1', campaign_name: 'Test' },
    clipIndex: 1,
    prompt: '(VERTICAL 9:16) (Anchor: male hands wearing casual cotton/linen shirt or plain athletic top), (Wardrobe: linen shirt)',
    bridging: { campaign_type: 'pure_storytelling', is_bridging_active: false, targetClipsCount: 6 },
    aesthetics: {
      resolved_wardrobe_color: lockedColor,
      resolved_wardrobe_prompt: snap.resolved.wardrobe_prompt
    }
  });
  assert.ok(liveReq.providerRequest.prompt.includes(`[WARDROBE LOCK: strictly uniform solid ${lockedColor}`));
  assert.ok(!/or\s+(?:clean minimalist |plain )?athletic top/i.test(liveReq.providerRequest.prompt));

  const cgiReq = buildMultiplierStartFrameRequest({
    task: { id: 'mul_test_1', campaign_name: 'Test' },
    clipIndex: 2,
    prompt: '(VERTICAL 9:16) [LAYER 2: 3D BIO-CELLULAR] 3D CGI simulation of intestinal lining and joint cartilage tissue',
    bridging: { campaign_type: 'pure_storytelling', is_bridging_active: false, targetClipsCount: 6 },
    aesthetics: {
      resolved_wardrobe_color: lockedColor,
      resolved_wardrobe_prompt: snap.resolved.wardrobe_prompt
    }
  });
  assert.ok(!cgiReq.providerRequest.prompt.includes('[WARDROBE LOCK:'), 'Klip 3D CGI tidak boleh disuntik tag baju');

  const workerSrc = fs.readFileSync(path.join(process.cwd(), 'lib/re-multiplier-worker.js'), 'utf8');
  assert.match(workerSrc, /Recovered missing combined_audio_path from disk/);
});
