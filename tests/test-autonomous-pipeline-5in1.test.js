import test from 'node:test';
import assert from 'node:assert/strict';
import { listOperatorPresetsForCampaignKind } from '../lib/operator-presets.js';
import { GRID_LAYOUT_COORDINATES } from '../lib/core/GridCoordinates.js';
import { activeSessionsCache } from '../lib/auth.js';

test('1. Operator Presets Registry for Multiplier and Recipe Labs', () => {
  const multiplierPresets = listOperatorPresetsForCampaignKind('multiplier_campaign', null, 'default_tenant');
  assert.ok(Array.isArray(multiplierPresets), 'Multiplier presets should be an array');
  assert.ok(multiplierPresets.length >= 1, 'Should have at least 1 multiplier preset');
  assert.equal(multiplierPresets[0].key, 'multiplier_deconstruct_remix', 'First preset should be multiplier_deconstruct_remix');

  const recipeLabsPresets = listOperatorPresetsForCampaignKind('recipe_labs', null, 'default_tenant');
  assert.ok(Array.isArray(recipeLabsPresets), 'Recipe Labs presets should be an array');
  assert.ok(recipeLabsPresets.length >= 1, 'Should have at least 1 recipe labs preset');
  assert.equal(recipeLabsPresets[0].key, 'recipe_labs_editorial_food', 'First preset should be recipe_labs_editorial_food');
});

test('2. Grid Layout Coordinates Integrity', () => {
  assert.ok(GRID_LAYOUT_COORDINATES[3], 'Should support 3 image layouts');
  assert.ok(GRID_LAYOUT_COORDINATES[4], 'Should support 4 image layouts');
  assert.ok(GRID_LAYOUT_COORDINATES[5], 'Should support 5 image layouts');
  assert.ok(GRID_LAYOUT_COORDINATES[6], 'Should support 6 image layouts');

  const defLayout = GRID_LAYOUT_COORDINATES[4]['4_editorial_split'];
  assert.ok(Array.isArray(defLayout), '4_editorial_split should be an array of slot coordinates');
  assert.equal(defLayout.length, 4, '4_editorial_split should have 4 slots');
});

test('3. GET Route Handler for 5-in-1 Pipeline Hub', async () => {
  const mockToken = 'mock-unit-test-token-' + Date.now();
  activeSessionsCache[mockToken] = {
    id: 'test-admin',
    username: 'testadmin',
    role: 'admin',
    tenantId: 'default_tenant'
  };

  const route = await import('../app/api/v2/recipes/autonomous-pipeline/route.js');

  // Test GET Multiplier
  const mulReq = new Request('http://localhost:3000/api/v2/recipes/autonomous-pipeline?pipeline_type=multiplier_campaign', {
    headers: { authorization: `Bearer ${mockToken}` }
  });
  const mulRes = await route.GET(mulReq, {});
  const mulData = await mulRes.json();
  assert.equal(mulData.success, true, 'GET Multiplier should succeed');
  assert.ok(Array.isArray(mulData.operator_presets), 'Operator presets should be present');
  assert.ok(Array.isArray(mulData.blueprints), 'Blueprints array should be present');

  // Test GET Recipe Labs
  const rlReq = new Request('http://localhost:3000/api/v2/recipes/autonomous-pipeline?pipeline_type=recipe_labs', {
    headers: { authorization: `Bearer ${mockToken}` }
  });
  const rlRes = await route.GET(rlReq, {});
  const rlData = await rlRes.json();
  assert.equal(rlData.success, true, 'GET Recipe Labs should succeed');
  assert.ok(rlData.grid_layouts, 'Grid layouts should be present');

  setTimeout(() => process.exit(0), 100);
});
