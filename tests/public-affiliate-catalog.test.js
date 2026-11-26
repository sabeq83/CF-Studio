import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

import {
  resolvePublicThumbnailUrl,
  toPublicAffiliateCatalogItem,
  listPublicAffiliateCatalog,
  isProductPhotoAllowedForTenant
} from '../lib/public-affiliate-catalog-service.js';
import { resolveSafeProductUploadFile } from '../lib/product-image-storage.js';
import { isPublicRoutePathname } from '../lib/public-routes.js';

test('toPublicAffiliateCatalogItem only exposes safe public fields', () => {
  const dto = toPublicAffiliateCatalogItem({
    product_id: 'pe_123',
    product_name: 'Ajwain Seed 100gr',
    brand_profile_id: 'bp_nutribake',
    brand_name: 'NUTRIBAKE ID',
    affiliate_link: '  https://s.shopee.co.id/abc123  ',
    clean_photo_url: '/uploads/products/default_tenant/clean/ajwain.png',
    product_truth: 'INTERNAL_TRUTH_DO_NOT_LEAK',
    geometric_truth: 'INTERNAL_GEOMETRY',
    notes: 'INTERNAL_NOTES',
    source_url: 'https://shopee.co.id/internal-source'
  });

  assert.deepEqual(Object.keys(dto).sort(), [
    'affiliate_link',
    'brand_id',
    'brand_name',
    'id',
    'product_id',
    'product_name',
    'thumbnail_url'
  ]);
  assert.equal(dto.id, 'pe_123__bp_nutribake');
  assert.equal(dto.affiliate_link, 'https://s.shopee.co.id/abc123');
  assert.equal(
    dto.thumbnail_url,
    '/api/public/affiliate-catalog/image?path=%2Fuploads%2Fproducts%2Fdefault_tenant%2Fclean%2Fajwain.png'
  );
});

test('resolvePublicThumbnailUrl keeps external URLs and returns null when empty', () => {
  assert.equal(
    resolvePublicThumbnailUrl({ raw_photo_url: 'https://cdn.example.com/item.jpg' }),
    'https://cdn.example.com/item.jpg'
  );
  assert.equal(resolvePublicThumbnailUrl({}), null);
});

test('listPublicAffiliateCatalog defaults to first populated brand and maps 1 card = 1 brand', async () => {
  const calls = [];
  const mockQuery = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('FROM brand_profiles b')) {
      return {
        rows: [
          { id: 'bp_empty', brand_name: 'BRAND KOSONG', product_count: 0 },
          { id: 'bp_nutribake', brand_name: 'NUTRIBAKE ID', product_count: 2 }
        ]
      };
    }
    return {
      rows: [
        {
          product_id: 'pe_1',
          product_name: 'Ajwain Seed',
          clean_photo_url: '/uploads/products/default_tenant/clean/ajwain.jpg',
          brand_profile_id: 'bp_nutribake',
          brand_name: 'NUTRIBAKE ID',
          affiliate_link: 'https://s.shopee.co.id/ajwain'
        }
      ]
    };
  };

  const result = await listPublicAffiliateCatalog({}, { query: mockQuery, tenantId: 'default_tenant' });
  assert.equal(result.selected_brand_id, 'bp_nutribake');
  assert.equal(result.total_count, 2);
  assert.equal(result.brands.length, 2);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].brand_name, 'NUTRIBAKE ID');
  assert.deepEqual(calls[1].params, ['default_tenant', 'bp_nutribake']);
});

test('resolveSafeProductUploadFile blocks path traversal and external URLs', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-aff-img-'));
  try {
    const cleanDir = path.join(tmpDir, 'default_tenant', 'clean');
    fs.mkdirSync(cleanDir, { recursive: true });
    const imgPath = path.join(cleanDir, 'sample.webp');
    fs.writeFileSync(imgPath, Buffer.from('fake-webp'));

    const traversal = resolveSafeProductUploadFile('../../etc/passwd', { baseDir: tmpDir });
    assert.equal(traversal.status, 403);

    const external = resolveSafeProductUploadFile('https://example.com/a.jpg', { baseDir: tmpDir });
    assert.equal(external.status, 400);

    const valid = resolveSafeProductUploadFile('/uploads/products/default_tenant/clean/sample.webp', {
      baseDir: tmpDir
    });
    assert.equal(valid.missing, false);
    assert.equal(valid.contentType, 'image/webp');
    assert.equal(valid.cleanPath, 'default_tenant/clean/sample.webp');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('isProductPhotoAllowedForTenant enforces tenant isolation', async () => {
  assert.equal(
    await isProductPhotoAllowedForTenant('default_tenant/clean/a.jpg', {
      tenantId: 'default_tenant',
      query: async () => ({ rows: [] })
    }),
    true
  );

  assert.equal(
    await isProductPhotoAllowedForTenant('other_tenant/clean/a.jpg', {
      tenantId: 'default_tenant',
      query: async () => ({ rows: [] })
    }),
    false
  );
});

test('isPublicRoutePathname allows /aff and /api/public/affiliate-catalog without auth', () => {
  assert.equal(isPublicRoutePathname('/aff'), true);
  assert.equal(isPublicRoutePathname('/aff/'), true);
  assert.equal(isPublicRoutePathname('/api/public/affiliate-catalog'), true);
  assert.equal(isPublicRoutePathname('/api/public/affiliate-catalog/image'), true);
  assert.equal(isPublicRoutePathname('/products'), false);
  assert.equal(isPublicRoutePathname('/api/v2/products'), false);
});
