import test from 'node:test';
import assert from 'node:assert/strict';
import {
  matchesBrand,
  listOperatorPresetsForCampaignKind,
  hydrateOperatorPresetCache
} from '../lib/operator-presets.js';

test('matchesBrand should correctly match brand names against presets', () => {
  const presetDapur = {
    key: 'dapurbotani_4clips_healthy',
    label: 'DapurBotani — Herbal & Wellness Recipe (4 Klip @ 8s)'
  };

  const presetProduct = {
    key: 'dapurbotani_kampanye_produk_4_klip',
    label: 'Dapur Botani 4 Klip Product Campaign'
  };

  const presetHabit = {
    key: 'habitfolk_6clips_quick',
    label: 'HabitFolk — Quick Snack & Reels'
  };

  const presetNutri = {
    key: 'nutribake_kampanye_produk_4_klip_v2',
    label: 'Nutribake 4 Klip Product Campaign V2'
  };

  // 1. Spaced brand name matching slug key and label
  assert.equal(matchesBrand(presetDapur, 'Dapur Botani'), true);
  assert.equal(matchesBrand(presetProduct, 'dapur botani'), true);
  assert.equal(matchesBrand(presetDapur, 'DapurBotani'), true);

  // 2. Exact brand match
  assert.equal(matchesBrand(presetHabit, 'HabitFolk'), true);
  assert.equal(matchesBrand(presetHabit, 'habit folk'), true);

  // 3. NutriBake match
  assert.equal(matchesBrand(presetNutri, 'NutriBake'), true);
  assert.equal(matchesBrand(presetNutri, 'nutri bake'), true);

  // 4. Non-matching brand
  assert.equal(matchesBrand(presetDapur, 'HabitFolk'), false);
  assert.equal(matchesBrand(presetHabit, 'Dapur Botani'), false);
  assert.equal(matchesBrand(presetNutri, 'Other Brand'), false);
  assert.equal(matchesBrand(presetDapur, ''), false);
  assert.equal(matchesBrand(presetDapur, null), false);
});

test('listOperatorPresetsForCampaignKind should prioritize brand presets and include is_brand_match', () => {
  const testTenant = 'test_tenant_brand_presets_' + Date.now();
  
  // Hydrate custom presets for test tenant
  const customPresets = {
    dapurbotani_kampanye_produk_4_klip: {
      label: 'Dapur Botani 4 Klip Product Campaign',
      campaign_kinds: ['product_campaign'],
      schema_version: '2'
    },
    dapurbotani_4clips_healthy: {
      label: 'DapurBotani — Herbal Recipe 4 Klip',
      campaign_kinds: ['recipe_campaign'],
      schema_version: '2'
    },
    habitfolk_6clips_quick: {
      label: 'HabitFolk Quick Reels',
      campaign_kinds: ['recipe_campaign'],
      schema_version: '2'
    }
  };

  hydrateOperatorPresetCache(testTenant, customPresets);

  // Test 1: recipe_campaign with brand 'Dapur Botani'
  const recipePresets = listOperatorPresetsForCampaignKind('recipe_campaign', 'Dapur Botani', testTenant);
  assert.ok(recipePresets.length > 0);
  
  // Brand matched presets must be first
  const brandMatched = recipePresets.filter(p => p.is_brand_match);
  assert.ok(brandMatched.length >= 2, 'Should include both Dapur Botani presets (healthy recipe and product campaign)');
  assert.equal(recipePresets[0].is_brand_match, true, 'First preset should be brand match');
  assert.ok(recipePresets[0].key.includes('dapurbotani'));

  // Test 2: recipe_campaign with brand 'HabitFolk'
  const habitPresets = listOperatorPresetsForCampaignKind('recipe_campaign', 'HabitFolk', testTenant);
  assert.ok(habitPresets.length > 0);
  assert.equal(habitPresets[0].is_brand_match, true);
  assert.equal(habitPresets[0].key, 'habitfolk_6clips_quick');

  // Test 3: product_campaign with brand 'Dapur Botani'
  const productPresets = listOperatorPresetsForCampaignKind('product_campaign', 'Dapur Botani', testTenant);
  assert.ok(productPresets.length > 0);
  assert.equal(productPresets[0].is_brand_match, true);
  assert.ok(productPresets[0].key.includes('dapurbotani'));
});
