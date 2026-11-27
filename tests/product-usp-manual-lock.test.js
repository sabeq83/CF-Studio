import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import module from 'node:module';

process.env.NODE_ENV = 'development';
process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';
process.env.ENABLE_REDIS_QUEUE = 'false';
process.env.PG_SEARCH_PATH = process.env.PG_SEARCH_PATH || 'dev';

const repoRoot = process.cwd();
if (typeof module.registerHooks === 'function') {
  module.registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.startsWith('@/')) {
        const subPath = specifier.slice(2);
        const candidates = [
          path.join(repoRoot, subPath),
          path.join(repoRoot, `${subPath}.js`),
          path.join(repoRoot, subPath, 'index.js')
        ];
        const found = candidates.find(p => fs.existsSync(p) && fs.statSync(p).isFile());
        if (found) {
          return nextResolve(new URL(`file://${found}`).href, context);
        }
      }
      if (specifier === 'next/server') {
        const nextServerJs = path.join(repoRoot, 'node_modules/next/server.js');
        if (fs.existsSync(nextServerJs)) {
          return nextResolve(new URL(`file://${nextServerJs}`).href, context);
        }
      }
      return nextResolve(specifier, context);
    }
  });
}

const { pgQuery, closePgPool } = await import('../lib/db-pg.js');
const { activeSessionsCache } = await import('../lib/auth.js');
const { tenantContext } = await import('../lib/tenant-context.js');
const { createProduct, getProductById } = await import('../lib/product-repository.js');
const {
  isUspEdited,
  markManualUspSource,
  markManualPackagingSourceIfChanged
} = await import('../lib/product-manual-lock.js');
const { isUspManualLocked, resolveEnrichmentCategoryUpdate } = await import('../lib/product-bulk-worker.js');
const { PUT } = await import('../app/api/v2/products/[id]/route.js');

const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const TENANT_ID = `test_usp_lock_${suffix}`;
const SESSION_TOKEN = `tok_usp_lock_${suffix}`;
const createdProductIds = [];

before(async () => {
  await pgQuery(
    `INSERT INTO tenants (id, name, slug, status) VALUES ($1, $2, $3, 'active') ON CONFLICT (id) DO NOTHING`,
    [TENANT_ID, `USP Lock Test ${suffix}`, `usp-lock-${suffix}`]
  );
  activeSessionsCache[SESSION_TOKEN] = {
    id: `usr_usp_lock_${suffix}`,
    username: `usp_lock_${suffix}`,
    role: 'admin',
    tenantId: TENANT_ID
  };
});

after(async () => {
  delete activeSessionsCache[SESSION_TOKEN];
  if (createdProductIds.length > 0) {
    await pgQuery('DELETE FROM product_extractions WHERE id = ANY($1::text[]) AND tenant_id = $2', [createdProductIds, TENANT_ID]).catch(() => {});
  }
  await pgQuery('DELETE FROM tenants WHERE id = $1', [TENANT_ID]).catch(() => {});
  await closePgPool().catch(() => {});
});

async function seedProduct(overrides = {}) {
  const id = `pe_usp_${suffix}_${createdProductIds.length + 1}`;
  createdProductIds.push(id);
  return tenantContext.run(TENANT_ID, () => createProduct({
    id,
    product_name: 'Chopper Mini Portable',
    product_description: 'Chopper listrik 250ml dengan 3 mata pisau stainless tajam.',
    unique_selling_point: JSON.stringify(['Pisau stainless 3 lapis', 'Baterai USB rechargeable']),
    category: 'Peralatan Dapur',
    packaging_status: 'packaged',
    packaging_type: 'Kardus Kotak',
    is_in_packaging: 1,
    is_url: 1,
    source_url: `https://shopee.co.id/product-usp-test-${id}`,
    raw_response: 'Manual entry',
    ...overrides
  }));
}

function makeJsonPut(productId, body) {
  return new Request(`http://127.0.0.1:5020/api/v2/products/${productId}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      cookie: `makna_session=${SESSION_TOKEN}`
    },
    body: JSON.stringify(body)
  });
}

function makeMultipartPut(productId, productPayload, { regenerate = false } = {}) {
  const form = new FormData();
  form.set('product', JSON.stringify(productPayload));
  if (regenerate) form.set('regenerate', 'true');
  return new Request(`http://127.0.0.1:5020/api/v2/products/${productId}`, {
    method: 'PUT',
    headers: {
      cookie: `makna_session=${SESSION_TOKEN}`
    },
    body: form
  });
}

test('Helper unit: isUspEdited, markManualUspSource, dan resolveEnrichmentCategoryUpdate', () => {
  const existing = {
    unique_selling_point: JSON.stringify(['Pisau tajam', 'Baterai awet']),
    raw_response: JSON.stringify({ packaging_source: 'manual', physical_state: { packaging_type: 'Kardus Kotak' } })
  };

  assert.equal(isUspEdited(existing, { affiliate_link: 'https://s.shopee.co.id/x' }), false);
  assert.equal(isUspEdited(existing, { unique_selling_point: '["Pisau tajam", "Baterai awet"]' }), false);
  assert.equal(isUspEdited(existing, { unique_selling_point: 'Pisau tajam\nBaterai awet' }), false);
  assert.equal(isUspEdited(existing, { unique_selling_point: '   ' }), false);
  assert.equal(isUspEdited(existing, { unique_selling_point: 'Pisau tajam\nAnti karat' }), true);

  // Aman jika raw_response bukan JSON dan mempertahankan penanda lain
  assert.deepEqual(JSON.parse(markManualUspSource('Manual entry')), { usp_source: 'manual' });
  const merged = JSON.parse(markManualUspSource(existing.raw_response));
  assert.equal(merged.usp_source, 'manual');
  assert.equal(merged.packaging_source, 'manual');
  assert.deepEqual(merged.physical_state, { packaging_type: 'Kardus Kotak' });

  // markManualPackagingSourceIfChanged mempertahankan penanda usp_source bila ada
  const pkgAndUsp = markManualPackagingSourceIfChanged(
    { packaging_type: 'Kardus Kotak', packaging_status: 'packaged', raw_response: JSON.stringify({ usp_source: 'manual' }) },
    { packaging_type: 'Botol Kaca', packaging_status: 'packaged' }
  );
  assert.deepEqual(JSON.parse(pkgAndUsp), { usp_source: 'manual', packaging_source: 'manual' });

  // Kategori dipertahankan saat USP terkunci & kategori awal terisi
  const lockedJob = {
    is_url: 1,
    unique_selling_point: '["Pisau tajam"]',
    category: 'Peralatan Dapur',
    raw_response: JSON.stringify({ usp_source: 'manual' })
  };
  assert.equal(isUspManualLocked(lockedJob), true);
  assert.equal(resolveEnrichmentCategoryUpdate(lockedJob, { category: 'Elektronik Rumah Tangga' }), null);

  // Bila kategori awal kosong, enrichment tetap boleh mengisi
  assert.equal(
    resolveEnrichmentCategoryUpdate({ ...lockedJob, category: '' }, { category: 'Peralatan Dapur' }),
    'Peralatan Dapur'
  );

  // Bila USP tidak terkunci, enrichment tetap memperbarui kategori
  assert.equal(
    resolveEnrichmentCategoryUpdate({ ...lockedJob, raw_response: 'Manual entry' }, { category: 'Elektronik' }),
    'Elektronik'
  );
});

test('PUT JSON: simpan tanpa ubah USP tidak mengunci; usp_approved & edit USP mengunci dan mempertahankan penanda lain', async () => {
  const prod = await seedProduct({
    raw_response: JSON.stringify({ packaging_source: 'manual', curated_from_radar: true })
  });

  // 1. Update link tanpa mengubah USP (atau kirim USP sama dalam format baris) -> tidak mengunci
  const resNoChange = await PUT(
    makeJsonPut(prod.id, {
      affiliate_link: 'https://s.shopee.co.id/baru',
      unique_selling_point: 'Pisau stainless 3 lapis\nBaterai USB rechargeable'
    }),
    { params: Promise.resolve({ id: prod.id }) }
  );
  assert.equal(resNoChange.status, 200);
  const afterNoChange = await tenantContext.run(TENANT_ID, () => getProductById(prod.id));
  assert.equal(JSON.parse(afterNoChange.raw_response).usp_source, undefined);
  assert.equal(JSON.parse(afterNoChange.raw_response).packaging_source, 'manual');

  // 2. usp_approved: true tanpa mengubah USP -> mengunci & tidak menulis kolom usp_approved
  const prodLegacy = await seedProduct({ raw_response: 'Manual entry' });
  const resApproved = await PUT(
    makeJsonPut(prodLegacy.id, { usp_approved: true }),
    { params: Promise.resolve({ id: prodLegacy.id }) }
  );
  assert.equal(resApproved.status, 200);
  const afterApproved = await tenantContext.run(TENANT_ID, () => getProductById(prodLegacy.id));
  assert.equal(JSON.parse(afterApproved.raw_response).usp_source, 'manual');

  // 3. Edit USP lewat JSON -> mengunci sambil mempertahankan penanda packaging_source & curated_from_radar
  const resEdit = await PUT(
    makeJsonPut(prod.id, {
      unique_selling_point: JSON.stringify(['Pisau stainless 3 lapis', 'Motor senyap 45W'])
    }),
    { params: Promise.resolve({ id: prod.id }) }
  );
  assert.equal(resEdit.status, 200);
  const afterEdit = await tenantContext.run(TENANT_ID, () => getProductById(prod.id));
  const parsedAfterEdit = JSON.parse(afterEdit.raw_response);
  assert.equal(parsedAfterEdit.usp_source, 'manual');
  assert.equal(parsedAfterEdit.packaging_source, 'manual');
  assert.equal(parsedAfterEdit.curated_from_radar, true);
});

test('PUT multipart (UI): simpan tanpa ubah USP tidak mengunci; ubah USP mengunci dan mempertahankan packaging_source', async () => {
  const prod = await seedProduct({ raw_response: 'Manual entry' });

  // 1. Simpan perubahan nama tanpa mengubah USP -> tidak mengunci
  const resNoUspEdit = await PUT(
    makeMultipartPut(prod.id, {
      product_name: 'Chopper Mini Portable V2',
      product_description: 'Chopper listrik 250ml dengan 3 mata pisau stainless tajam.',
      packaging_status: 'packaged',
      packaging_type: 'Kardus Kotak',
      unique_selling_point: JSON.stringify(['Pisau stainless 3 lapis', 'Baterai USB rechargeable'])
    }),
    { params: Promise.resolve({ id: prod.id }) }
  );
  assert.equal(resNoUspEdit.status, 200);
  const afterNoUspEdit = await tenantContext.run(TENANT_ID, () => getProductById(prod.id));
  assert.equal(afterNoUspEdit.raw_response, 'Manual entry');

  // 2. Ubah USP dan packaging_type sekaligus (plus regenerate=true) -> mengunci kedua penanda
  const resBothEdited = await PUT(
    makeMultipartPut(prod.id, {
      product_name: 'Chopper Mini Portable V2',
      product_description: 'Chopper listrik 250ml dengan 3 mata pisau stainless tajam.',
      packaging_status: 'packaged',
      packaging_type: 'Box Tebal',
      unique_selling_point: 'Pisau stainless 3 lapis\nGaransi toko 1 tahun'
    }, { regenerate: true }),
    { params: Promise.resolve({ id: prod.id }) }
  );
  assert.equal(resBothEdited.status, 200);
  const afterBoth = await tenantContext.run(TENANT_ID, () => getProductById(prod.id));
  const parsed = JSON.parse(afterBoth.raw_response);
  assert.equal(parsed.usp_source, 'manual');
  assert.equal(parsed.packaging_source, 'manual');
  assert.equal(afterBoth.enrichment_status, 'pending');
});
