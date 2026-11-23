import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROMO_ROLES,
  classifyProductPromoRole,
  analyzeBlueprintProfile,
  scoreBlueprintAgainstProduct,
} from '../lib/blueprint-product-matcher-shared.js';

test('PROMO_ROLES memuat tiga peran baku', () => {
  assert.deepEqual(PROMO_ROLES, ['alat_dapur', 'bahan_resep', 'lainnya']);
});

test('classifyProductPromoRole mengenali alat_dapur, bahan_resep, dan menghormati override manual', () => {
  assert.equal(
    classifyProductPromoRole({ product_name: 'Blender Philips 3000 Series HR2042/13', category: 'Peralatan Dapur' }),
    'alat_dapur'
  );
  assert.equal(
    classifyProductPromoRole({ product_name: 'Borosilicate Teko Kaca dengan Tutup Kayu dan Infuser', category: 'Teko Teh & Kopi' }),
    'alat_dapur'
  );
  assert.equal(
    classifyProductPromoRole({ product_name: 'Premix Cocoa Powder Premium', category: 'Bahan Kue' }),
    'bahan_resep'
  );
  assert.equal(
    classifyProductPromoRole({ product_name: 'Nutrifarm Kunyit Bubuk', category: 'Rempah & Herbal' }),
    'bahan_resep'
  );
  assert.equal(
    classifyProductPromoRole({ product_name: 'Serum Wajah Vitamin C', category: 'Skincare' }),
    'lainnya'
  );
  // Hormati override manual bila promo_role valid sudah tersimpan
  assert.equal(
    classifyProductPromoRole({ product_name: 'Gelatin Sapi', category: 'Bahan Kue', promo_role: 'lainnya' }),
    'lainnya'
  );
});

test('analyzeBlueprintProfile memblokir blueprint non-pangan untuk brand kuliner', () => {
  const skincareBp = analyzeBlueprintProfile({
    id: 'bp_skin',
    niche: 'Skincare',
    core_problem: 'Jerawat meradang dan bekas flek hitam di pipi',
    core_solution: 'Gunakan masker wajah lidah buaya setiap malam',
  });
  assert.equal(skincareBp.isFoodSafe, false);

  const herbalDrinkBp = analyzeBlueprintProfile({
    id: 'bp_teh',
    niche: 'Health',
    core_problem: 'Tenggorokan gatal dan badan terasa dingin',
    core_solution: 'Seduh cengkeh dengan air hangat dan perasan jeruk nipis dalam teko kaca',
    tags: 'teko, seduh, cengkeh, nipis',
  });
  assert.equal(herbalDrinkBp.isFoodSafe, true);
  assert.ok(herbalDrinkBp.methods.some(m => m.key === 'kettle_seduh'));
  assert.ok(herbalDrinkBp.methods.some(m => m.key === 'saring_peras'));
});

test('scoreBlueprintAgainstProduct memberi skor tinggi ke alat dan bahan yang relevan serta 0 untuk non-pangan', () => {
  const tehBp = analyzeBlueprintProfile({
    id: 'ba977b0a',
    niche: 'Health',
    core_problem: 'Susah tidur dan tenggorokan kering',
    core_solution: 'Rebus cengkeh, kayu manis, dan jeruk nipis memakai teko infuser lalu peras nipisnya',
  });

  const tekoMatch = scoreBlueprintAgainstProduct(
    tehBp,
    { id: 'pe_1784449324420_841', product_name: 'Borosilicate Teko Kaca dengan Tutup Kayu dan Infuser', category: 'Peralatan Dapur' },
    { hasCleanPhoto: true, hasProductTruth: true, hasAffiliateLink: true }
  );
  assert.equal(tekoMatch.promoRole, 'alat_dapur');
  assert.ok(tekoMatch.score >= 50, `Expected score >= 50, got ${tekoMatch.score}`);

  const kayuManisMatch = scoreBlueprintAgainstProduct(
    tehBp,
    { id: 'pe_1783235604763_116', product_name: 'Nutrifarm Kayu Manis Bubuk', category: 'Rempah & Herbal' },
    { hasCleanPhoto: true, hasProductTruth: true }
  );
  assert.equal(kayuManisMatch.promoRole, 'bahan_resep');
  assert.ok(kayuManisMatch.score >= 50, `Expected score >= 50, got ${kayuManisMatch.score}`);

  const skincareBp = analyzeBlueprintProfile({
    id: 'bp_skin_2',
    niche: 'Skincare',
    core_problem: 'Pori-pori besar di hidung',
    core_solution: 'Bersihkan wajah rutin dengan scrub',
  });
  const blockedScore = scoreBlueprintAgainstProduct(
    skincareBp,
    { id: 'pe_1784449324420_841', product_name: 'Borosilicate Teko Kaca dengan Tutup Kayu dan Infuser', category: 'Peralatan Dapur' }
  );
  assert.equal(blockedScore.score, 0);

  // Produk dengan override manual promo_role='lainnya' tetap diklasifikasikan 'lainnya' meski namanya mengandung bahan resep
  assert.equal(
    classifyProductPromoRole({ product_name: 'Matcha Kapsul Ekstrak', category: 'Minuman & Teh', promo_role: 'lainnya' }),
    'lainnya'
  );
});
