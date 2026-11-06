import test from 'node:test';
import assert from 'node:assert/strict';

test('Multiplier Autopilot: vsoConfig execution_mode full_autopilot determines autopilot transition', () => {
  const autopilotVso = {
    is_vso_active: true,
    character_concept: 'faceless',
    execution_mode: 'full_autopilot',
    approval_mode: 'auto'
  };

  const manualVso = {
    is_vso_active: true,
    character_concept: 'faceless',
    execution_mode: 'manual_review',
    approval_mode: 'manual'
  };

  const isAutopilot = (vso) => vso.execution_mode === 'full_autopilot' || vso.approval_mode === 'auto';

  assert.equal(isAutopilot(autopilotVso), true, 'Full autopilot should resolve to true');
  assert.equal(isAutopilot(manualVso), false, 'Manual review should resolve to false');

  const getNextStatus = (vso) => isAutopilot(vso) ? 'generating_audio' : 'waiting_approval';
  assert.equal(getNextStatus(autopilotVso), 'generating_audio', 'Autopilot task must bypass waiting_approval');
  assert.equal(getNextStatus(manualVso), 'waiting_approval', 'Manual review task must pause at waiting_approval');
});

test('Multiplier Audio Config: enableGlabs flag correctly resolves for video generation', () => {
  const cfg1 = { enableGlabs: 1, enable_glabs: true };
  const cfg2 = { enable_glabs: true };
  const cfg3 = { enableGlabs: true };
  const cfg4 = { enableGlabs: 0, enable_glabs: false };
  const cfgEmpty = {};

  const resolveGlabs = (audioConfig) => {
    return audioConfig.enableGlabs === 1 ||
      audioConfig.enableGlabs === true ||
      audioConfig.enable_glabs === true ||
      audioConfig.enable_glabs === 1 ||
      (audioConfig.enableGlabs === undefined && audioConfig.enable_glabs === undefined);
  };

  assert.equal(resolveGlabs(cfg1), true);
  assert.equal(resolveGlabs(cfg2), true);
  assert.equal(resolveGlabs(cfg3), true);
  assert.equal(resolveGlabs(cfgEmpty), true, 'Default empty config should default to true for video pipeline');
  assert.equal(resolveGlabs(cfg4), false, 'Explicitly disabled glabs should resolve to false');
});
