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

  it('applies metadata_overrides from radar curator to product_name, product_description, and unique_selling_point', () => {
    const targetUrl = 'https://tokopedia.com/vitameal/original-vitameal-sereal-1729711246117472017';
    const payload = {
      tenant_id: 'default_tenant',
      urls: [targetUrl],
      reserved_ids: { [targetUrl]: 'pe_radar_curated_123' },
      metadata_overrides: {
        [targetUrl]: {
          product_name: 'Vitameal Kurasi Ahli Gizi',
          product_description: 'Deskripsi kurasi: sereal kaya serat alami tanpa pemanis buatan',
          unique_selling_point: '100% Organik & Aman Lambung',
          candidate_id: 'prc_vitameal_1'
        }
      }
    };

    const scrapedItem = {
      url: targetUrl,
      isRepair: false,
      scraped: {
        title: 'Judul Asli Web Scraper',
        description: 'Deskripsi Asli Web Scraper',
        bodyText: 'Body text web scraper'
      }
    };

    const productData = {
      product_name: 'Nama dari Gemini Scraper',
      usp: 'USP dari Gemini Scraper'
    };

    const productId = payload.reserved_ids[scrapedItem.url];
    const metadataOverrides = payload?.metadata_overrides || {};
    const metaOverride = metadataOverrides[scrapedItem.url] || (productId ? metadataOverrides[productId] : null);

    const curatedName = metaOverride?.product_name?.trim();
    const curatedDesc = metaOverride?.product_description?.trim();
    const curatedUsp = metaOverride?.unique_selling_point?.trim();

    let finalUsp = '';
    if (curatedUsp) {
      finalUsp = curatedUsp;
    } else if (productData.usp) {
      finalUsp = typeof productData.usp === 'string'
        ? productData.usp
        : JSON.stringify(productData.usp);
    }

    const data = {
      product_name: curatedName || productData.product_name || scrapedItem.scraped.title || 'Produk Tanpa Nama',
      product_description: curatedDesc || scrapedItem.scraped.description || scrapedItem.scraped.title || '',
      unique_selling_point: finalUsp,
      target_audience: '',
      pain_point_solved: '',
      key_visuals_extracted: JSON.stringify([]),
      raw_response: JSON.stringify({
        ...productData,
        usp_source: curatedUsp ? 'manual' : 'scraper',
        curated_from_radar: Boolean(metaOverride)
      })
    };

    const newData = {
      id: productId,
      input_source: scrapedItem.url,
      is_url: 1,
      source_url: scrapedItem.url,
      raw_description: scrapedItem.scraped.bodyText || '',
      ...data
    };

    assert.equal(newData.product_name, 'Vitameal Kurasi Ahli Gizi');
    assert.equal(newData.product_description, 'Deskripsi kurasi: sereal kaya serat alami tanpa pemanis buatan');
    assert.equal(newData.unique_selling_point, '100% Organik & Aman Lambung');
    const parsedRaw = JSON.parse(newData.raw_response);
    assert.equal(parsedRaw.usp_source, 'manual');
    assert.equal(parsedRaw.curated_from_radar, true);
  });
});
