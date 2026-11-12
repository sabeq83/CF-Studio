import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMultiplierSchedulePairs,
  buildProductSnapshot,
  buildAutonomousBridgingConfig
} from '../lib/multiplier-pairing.js';

test('buildMultiplierSchedulePairs supports no_product, one_product, and multi_product modes', () => {
  assert.deepEqual(
    buildMultiplierSchedulePairs({ blueprintIds: [], productIds: ['p1'], pairingMode: 'one_product' }),
    []
  );

  const noProd = buildMultiplierSchedulePairs({
    blueprintIds: ['bp1', 'bp2'],
    productIds: ['p1'],
    pairingMode: 'no_product'
  });
  assert.deepEqual(noProd, [
    { blueprintId: 'bp1', productId: null },
    { blueprintId: 'bp2', productId: null }
  ]);

  const oneProd = buildMultiplierSchedulePairs({
    blueprintIds: ['bp1', 'bp2'],
    productIds: ['p1', 'p2'],
    pairingMode: 'one_product'
  });
  assert.deepEqual(oneProd, [
    { blueprintId: 'bp1', productId: 'p1' },
    { blueprintId: 'bp2', productId: 'p1' }
  ]);

  const multiProd = buildMultiplierSchedulePairs({
    blueprintIds: ['bp1', 'bp2'],
    productIds: ['p1', 'p2'],
    pairingMode: 'multi_product'
  });
  assert.equal(multiProd.length, 4);
  assert.deepEqual(multiProd, [
    { blueprintId: 'bp1', productId: 'p1' },
    { blueprintId: 'bp1', productId: 'p2' },
    { blueprintId: 'bp2', productId: 'p1' },
    { blueprintId: 'bp2', productId: 'p2' }
  ]);
});

test('buildProductSnapshot & buildAutonomousBridgingConfig ensure worker resolves product DNA (Gap 2 fix)', () => {
  const product = {
    id: 'prod_123',
    product_name: 'Kopi Herbal Habbatussauda',
    product_description: 'Minuman stamina alami',
    unique_selling_point: 'Tanpa gula tambahan',
    product_url: 'https://example.com/product',
    clean_photo_url: '/uploads/clean_prod.png'
  };

  const snapshot = buildProductSnapshot(product);
  assert.equal(snapshot.product_id, 'prod_123');
  assert.equal(snapshot.product_name, 'Kopi Herbal Habbatussauda');
  assert.equal(snapshot.product_usp, 'Tanpa gula tambahan');
  assert.equal(snapshot.product_image_url, '/uploads/clean_prod.png');
  assert.equal(buildProductSnapshot(null), null);

  const bridging = buildAutonomousBridgingConfig({
    product,
    chosenAngle: { title: 'Angle Pagi', hook_text: 'Stop ngantuk jam 10 pagi!' },
    effectiveGenerateRecipe: 1
  });
  assert.equal(bridging.is_bridging_active, true);
  assert.equal(bridging.bridgingMode, 'select_existing');
  assert.equal(bridging.targetProductId, 'prod_123');
  assert.equal(bridging.productRefImagePath, '/uploads/clean_prod.png');
  assert.equal(bridging.generate_recipe, true);

  const disabledBridging = buildAutonomousBridgingConfig({
    product,
    chosenAngle: { title: 'Angle Edukasi', hook_text: 'Fakta pagi hari' },
    overrides: { bridging_mode: 'none' }
  });
  assert.equal(disabledBridging.is_bridging_active, false);
  assert.equal(disabledBridging.bridgingMode, undefined);
  assert.equal(disabledBridging.targetProductId, null);
});

