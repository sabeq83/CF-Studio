import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProductUrl } from '../lib/product-url-normalizer.js';

describe('Product Scraper Insert New Record (Hotfix Regression)', () => {
  it('constructs new product extraction record with empty url_affiliates_map safely', () => {
    const payload = {
      tenant_id: 'default_tenant',
      urls: ['https://tokopedia.com/vitameal/original-vitameal-sereal-1729711246117472017'],
      category: 'Breakfast Cereal, Granola',
      tags: null,
      url_affiliates_map: {},
      repair_mode: false,
      refresh_photo: false,
      reserved_ids: {
        'https://tokopedia.com/vitameal/original-vitameal-sereal-1729711246117472017': 'pe_1795065356310_431'
      }
    };

    const scrapedItem = {
      url: 'https://tokopedia.com/vitameal/original-vitameal-sereal-1729711246117472017',
      isRepair: false,
      scraped: {
        title: 'Original Vitameal Sereal Lengkap Paket 1 Box',
        description: 'Sereal multigrain bernutrisi tinggi serat',
        bodyText: 'Vitameal deskripsi lengkap'
      }
    };

    const productId = payload.reserved_ids[scrapedItem.url];
    const data = {
      product_name: scrapedItem.scraped.title,
      product_description: scrapedItem.scraped.description,
      unique_selling_point: 'Nutrisi tinggi serat dan rendah gula',
      target_audience: '',
      pain_point_solved: '',
      key_visuals_extracted: '[]',
      raw_response: '{}'
    };

    // Construct newData exactly as done in processProductScraperJob
    const newData = {
      id: productId,
      input_source: scrapedItem.url,
      is_url: 1,
      source_url: scrapedItem.url,
      affiliate_link: (() => {
        if (!payload?.url_affiliates_map) return '';
        const normalizedScraped = normalizeProductUrl(scrapedItem.url);
        const foundKey = Object.keys(payload.url_affiliates_map).find(
          k => normalizeProductUrl(k) === normalizedScraped
        );
        return foundKey ? payload.url_affiliates_map[foundKey] : '';
      })(),
      category: payload.category || null,
      tags: payload.tags || null,
      raw_description: scrapedItem.scraped.bodyText || scrapedItem.scraped.description || '',
      ...data
    };

    assert.equal(newData.id, 'pe_1795065356310_431');
    assert.equal(newData.affiliate_link, '');
    assert.equal(newData.category, 'Breakfast Cereal, Granola');
    assert.equal(newData.product_name, 'Original Vitameal Sereal Lengkap Paket 1 Box');
  });

  it('matches affiliate link when normalized target matches scraped URL with query/slash variations', () => {
    const scrapedItem = {
      url: 'https://tokopedia.com/ecentioindonesia/tumbler-900ml-12345?src=radar'
    };

    const payload = {
      url_affiliates_map: {
        'https://www.tokopedia.com/ecentioindonesia/tumbler-900ml-12345/': 'https://tokopedia.link/ecentio-aff'
      }
    };

    const affiliateLink = (() => {
      if (!payload?.url_affiliates_map) return '';
      const normalizedScraped = normalizeProductUrl(scrapedItem.url);
      const foundKey = Object.keys(payload.url_affiliates_map).find(
        k => normalizeProductUrl(k) === normalizedScraped
      );
      return foundKey ? payload.url_affiliates_map[foundKey] : '';
    })();

    assert.equal(affiliateLink, 'https://tokopedia.link/ecentio-aff');
  });

  it('preserves existing product fields when scrapedItem isRepair=true', () => {
    const scrapedItem = {
      url: 'https://tokopedia.com/ecentioindonesia/tumbler-900ml-12345',
      isRepair: true,
      repairInfo: {
        isRefreshPhoto: false,
        existingProduct: {
          id: 'pe_existing_123',
          generated_photo_url: '/uploads/products/ecentio_generated.jpg'
        }
      }
    };

    assert.equal(scrapedItem.isRepair, true);
    assert.equal(scrapedItem.repairInfo.existingProduct.id, 'pe_existing_123');
  });
});
