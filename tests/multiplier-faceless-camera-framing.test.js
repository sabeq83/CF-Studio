import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildMultiplierPhase2Prompt, sanitizeI2vPrompt } from '../lib/prompts.js';
import { buildMultiplierStartFrameRequest } from '../lib/multiplier-start-frame-request.js';
import { sanitizeImagePrompt } from '../lib/webhook-client.js';

function makeFacelessPlannerVso({ framing = 'forearms_and_hands', perspective = 'first_person' } = {}) {
  return {
    isVsoActive: true,
    characterConcept: 'faceless',
    subjectDemographic: 'custom',
    subjectDemographicCustom: 'POV close-up framing focusing strictly on young Indonesian male hands and forearms',
    wardrobeStyle: 'custom',
    wardrobeStyleCustom: 'solid plain Warm Sand Beige color — Single plain unprinted casual male cotton/linen shirt with neatly rolled sleeves',
    lightingStyle: 'custom',
    lightingStyleCustom: 'Crisp clean directional daylight',
    environmentPrompt: 'Fallback only: modern walnut wood counter',
    negativePrompt: 'visible human face, human face',
    resolvedWardrobeColor: 'Warm Sand Beige',
    resolved_wardrobe_color: 'Warm Sand Beige',
    structured: {
      schema_mode: 'identity_card',
      subject: { kind: 'human', faceless_mode: 'hands_only' },
      guardrails: { face_visibility: 'prohibited' },
      environment: { policy: 'planner_driven', fallback_location: 'Clean modern Indonesian home kitchen counter' },
      camera: { framing, perspective, lens_look: 'natural_50mm', depth_of_field: 'shallow' }
    }
  };
}

test('buildMultiplierPhase2Prompt never emits eye-level medium shot for forearms_and_hands / faceless planner_driven VI', () => {
  for (const perspective of ['first_person', 'third_person']) {
    const prompt = buildMultiplierPhase2Prompt(
      [{ scene: 1, visual_description: 'Pouring tea', narration_transcript: 'Minum teh rosella pagi hari' }],
      { is_pure_storytelling: true },
      { aspectRatio: '9:16', clipDuration: 8 },
      { campaign_type: 'pure_storytelling', visualMode: 'hybrid_lock', targetClipsCount: 6 },
      makeFacelessPlannerVso({ framing: 'forearms_and_hands', perspective }),
      { targetLanguage: 'id-ID' },
      0
    );

    assert.ok(!prompt.includes('eye-level medium shot showing the room context'), `Must not emit eye-level medium shot for ${perspective}`);
    assert.ok(prompt.includes('FACELESS CROP & GESTURE RULE:'), 'Must inject faceless crop & gesture guard');
    assert.ok(prompt.includes('blurred room context visible'), 'Must preserve room context behind tabletop');
  }
});

test('buildMultiplierStartFrameRequest injects sanitizer-immune positive Framing Lock and strips cheerful toast / eye-level medium shot', () => {
  const req = buildMultiplierStartFrameRequest({
    task: { id: 'mul_test_face_1', campaign_name: 'Test' },
    clipIndex: 6,
    prompt: '(VERTICAL 9:16) [LAYER 1: OPTICS] (Angle: eye-level medium shot showing the room context), (Lens: natural 50mm). (Anchor: male hands), (Frozen Action: Male hand lifting tea glass in a cheerful toast).',
    bridging: { campaign_type: 'pure_storytelling', is_bridging_active: false, targetClipsCount: 6 },
    aesthetics: {
      character_concept: 'faceless',
      guardrails_face_visibility: 'prohibited',
      faceless_mode: 'hands_only',
      resolved_wardrobe_color: 'Warm Sand Beige'
    }
  });

  const sentToGlabs = sanitizeImagePrompt(req.providerRequest.prompt);
  assert.ok(!/eye-level medium shot/i.test(sentToGlabs), 'eye-level medium shot must be replaced');
  assert.ok(!/cheerful toast/i.test(sentToGlabs), 'cheerful toast trigger phrase must be replaced');
  assert.ok(sentToGlabs.includes('Framing Lock: chest-down tabletop close-up framing cropped cleanly below collarbones'), `Framing Lock must survive sanitizeImagePrompt: ${sentToGlabs}`);
});

test('buildMultiplierStartFrameRequest skips Framing Lock for 3D CGI, environment_object_only, stylized_3d, and still-life zero-hands clips', () => {
  const baseBridging = { campaign_type: 'pure_storytelling', is_bridging_active: false, targetClipsCount: 6 };

  const cgiReq = buildMultiplierStartFrameRequest({
    task: { id: 'mul_test_face_2' },
    clipIndex: 1,
    prompt: '(VERTICAL 9:16) 3D CGI simulation of human stomach lining',
    bridging: baseBridging,
    aesthetics: { character_concept: 'faceless', guardrails_face_visibility: 'prohibited' }
  });
  assert.ok(!cgiReq.providerRequest.prompt.includes('Framing Lock:'));

  const stillLifeReq = buildMultiplierStartFrameRequest({
    task: { id: 'mul_test_face_3' },
    clipIndex: 1,
    prompt: '(VERTICAL 9:16) (Presence Truth: unattended standalone still-life objects only, nobody in scene), clear glass cup on wood table',
    bridging: baseBridging,
    aesthetics: { character_concept: 'faceless', guardrails_face_visibility: 'prohibited' }
  });
  assert.ok(!stillLifeReq.providerRequest.prompt.includes('Framing Lock:'));

  const cartoonReq = buildMultiplierStartFrameRequest({
    task: { id: 'mul_test_face_4' },
    clipIndex: 1,
    prompt: '(VERTICAL 9:16) (Anchor: cute 3D character wearing casual shirt holding glass)',
    bridging: baseBridging,
    aesthetics: { character_concept: 'stylized_3d', guardrails_face_visibility: 'allowed' }
  });
  assert.ok(!cartoonReq.providerRequest.prompt.includes('Framing Lock:'));
});

test('I2V worker positive Camera Lock survives sanitizeI2vPrompt cleanly', () => {
  const workerSrc = fs.readFileSync(path.join(process.cwd(), 'lib/re-multiplier-worker.js'), 'utf8');
  assert.match(workerSrc, /\(Camera Lock: steady chest-down tabletop framing cropped below collarbones/);
  const cleanedI2v = sanitizeI2vPrompt(
    '(VERTICAL 9:16) Male hands pouring tea (Camera Lock: steady chest-down tabletop framing cropped below collarbones, downward camera angle focused on hands and objects throughout motion)'
  );
  assert.ok(cleanedI2v.includes('Camera Lock: steady chest-down tabletop framing cropped below collarbones'));
});
