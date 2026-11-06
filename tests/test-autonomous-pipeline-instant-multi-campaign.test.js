import test from 'node:test';
import assert from 'node:assert/strict';
import { activeSessionsCache } from '../lib/auth.js';
import { closePgPool } from '../lib/db-pg.js';
import { stopCampaignScheduler } from '../lib/campaign-scheduler.js';
import { listOperatorPresetsForCampaignKind } from '../lib/operator-presets.js';

test.after(async () => {
  try {
    stopCampaignScheduler();
  } catch (e) {
    // ignore
  }
  await new Promise(resolve => setTimeout(resolve, 800));
  await closePgPool();
});

test('1. listOperatorPresetsForCampaignKind filters presets by campaign kind', async () => {
  // Test Product Campaign
  const productPresets = listOperatorPresetsForCampaignKind('product_campaign', 'habitfolk', 'default_tenant');
  assert.ok(Array.isArray(productPresets), 'productPresets must be an array');
  assert.ok(productPresets.length > 0, 'Must return at least 1 product preset');
  const hasProductPreset = productPresets.some(p => 
    p.key === 'product_campaign' || 
    p.kind === 'product_campaign' ||
    (p.tags && p.tags.includes('product')) ||
    (p.label && p.label.toLowerCase().includes('produk'))
  );
  assert.ok(hasProductPreset, 'Must contain a product-oriented preset');

  // Test Editorial Campaign
  const editorialPresets = listOperatorPresetsForCampaignKind('editorial_campaign', 'habitfolk', 'default_tenant');
  assert.ok(Array.isArray(editorialPresets), 'editorialPresets must be an array');
  assert.ok(editorialPresets.length > 0, 'Must return at least 1 editorial preset');
  const hasEditorialPreset = editorialPresets.some(p => 
    p.key === 'brand_editorial_campaign' || 
    p.kind === 'brand_editorial' ||
    p.kind === 'editorial_campaign' ||
    (p.tags && p.tags.includes('editorial')) ||
    (p.label && p.label.toLowerCase().includes('editorial'))
  );
  assert.ok(hasEditorialPreset, 'Must contain an editorial-oriented preset');

  // Test Recipe Campaign
  const recipePresets = listOperatorPresetsForCampaignKind('recipe_campaign', 'habitfolk', 'default_tenant');
  assert.ok(Array.isArray(recipePresets), 'recipePresets must be an array');
  assert.ok(recipePresets.length > 0, 'Must return at least 1 recipe preset');
  const hasRecipePreset = recipePresets.some(p => 
    p.key.includes('recipe') || 
    p.kind === 'recipe_campaign' ||
    (p.tags && p.tags.includes('recipe')) ||
    (p.label && p.label.toLowerCase().includes('resep'))
  );
  assert.ok(hasRecipePreset, 'Must contain a recipe-oriented preset');
});

test('2. GET /api/v2/recipes/autonomous-pipeline returns filtered presets according to pipeline_type parameter', async () => {
  // Setup mock session
  const mockToken = 'mock_instant_test_token_' + Date.now();
  activeSessionsCache[mockToken] = {
    id: 'user_instant_test',
    username: 'instant_tester',
    role: 'admin',
    tenantId: 'default_tenant',
    menuPermissions: ['auto_pipeline', 'contentflow']
  };

  const { GET } = await import('../app/api/v2/recipes/autonomous-pipeline/route.js');

  // Test GET with pipeline_type=product_campaign
  const reqProduct = new Request('http://localhost:3000/api/v2/recipes/autonomous-pipeline?brand=habitfolk&pipeline_type=product_campaign', {
    headers: { Authorization: `Bearer ${mockToken}` }
  });
  const resProduct = await GET(reqProduct);
  const dataProduct = await resProduct.json();

  assert.equal(resProduct.status, 200);
  assert.equal(dataProduct.success, true);
  assert.ok(Array.isArray(dataProduct.operator_presets));
  assert.ok(dataProduct.operator_presets.some(p => 
    p.key === 'product_campaign' || 
    p.kind === 'product_campaign' ||
    (p.tags && p.tags.includes('product'))
  ), 'GET with product_campaign must return product presets');

  // Test GET with pipeline_type=editorial_campaign
  const reqEditorial = new Request('http://localhost:3000/api/v2/recipes/autonomous-pipeline?brand=habitfolk&pipeline_type=editorial_campaign', {
    headers: { Authorization: `Bearer ${mockToken}` }
  });
  const resEditorial = await GET(reqEditorial);
  const dataEditorial = await resEditorial.json();

  assert.equal(resEditorial.status, 200);
  assert.equal(dataEditorial.success, true);
  assert.ok(Array.isArray(dataEditorial.operator_presets));
  assert.ok(dataEditorial.operator_presets.some(p => 
    p.key === 'brand_editorial_campaign' || 
    p.kind === 'brand_editorial' ||
    (p.tags && p.tags.includes('editorial'))
  ), 'GET with editorial_campaign must return editorial presets');

  // Cleanup session
  delete activeSessionsCache[mockToken];
});

test('3. POST /api/v2/recipes/autonomous-pipeline validates topic for recipe_campaign', async () => {
  const mockToken = 'mock_instant_test_token_post_' + Date.now();
  activeSessionsCache[mockToken] = {
    id: 'user_instant_test_post',
    username: 'instant_tester_post',
    role: 'admin',
    tenantId: 'default_tenant',
    menuPermissions: ['auto_pipeline', 'contentflow']
  };

  const { POST } = await import('../app/api/v2/recipes/autonomous-pipeline/route.js');

  // Missing topic on recipe_campaign
  const reqMissingTopic = new Request('http://localhost:3000/api/v2/recipes/autonomous-pipeline', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${mockToken}`
    },
    body: JSON.stringify({
      pipeline_type: 'recipe_campaign',
      brand_id: 'habitfolk',
      topic: ''
    })
  });

  const resMissingTopic = await POST(reqMissingTopic);
  const dataMissingTopic = await resMissingTopic.json();

  assert.equal(resMissingTopic.status, 400);
  assert.equal(dataMissingTopic.success, false);
  assert.ok(
    dataMissingTopic.error.includes('Topik resep wajib diisi') ||
    dataMissingTopic.error.includes('topic'),
    'Should return validation error when topic is empty'
  );

  delete activeSessionsCache[mockToken];
});

