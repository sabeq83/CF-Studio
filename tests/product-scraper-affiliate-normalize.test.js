import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProductUrl } from '../lib/product-url-normalizer.js';

describe('Product Scraper Affiliate URL Normalization (Hotfix Regression)', () => {
  it('resolves empty affiliate link when url_affiliates_map is empty object without throwing ReferenceError', () => {
    const payload = { url_affiliates_map: {} };
    const scrapedItem = { url: 'https://tokopedia.com/vitameal/original-vitameal-sereal-1729711246117472017' };

    assert.doesNotThrow(() => {
      const affiliateLink = (() => {
        if (!payload?.url_affiliates_map) return '';
        const normalizedScraped = normalizeProductUrl(scrapedItem.url);
        const foundKey = Object.keys(payload.url_affiliates_map).find(
          k => normalizeProductUrl(k) === normalizedScraped
        );
        return foundKey ? payload.url_affiliates_map[foundKey] : '';
      })();

      assert.equal(affiliateLink, '');
    });
  });

  it('matches affiliate link when scraped URL has different trailing slash, query string, or www prefix', () => {
    const rawKey = 'https://www.tokopedia.com/ecentioindonesia/tumbler-900ml-12345/';
    const payload = {
      url_affiliates_map: {
        [rawKey]: 'https://tokopedia.link/affiliate-ecentio'
      }
    };

    // Scraped URL without www, with trailing query parameter
    const scrapedItem = {
      url: 'https://tokopedia.com/ecentioindonesia/tumbler-900ml-12345?extParam=src%3Dshop'
    };

    const affiliateLink = (() => {
      if (!payload?.url_affiliates_map) return '';
      const normalizedScraped = normalizeProductUrl(scrapedItem.url);
      const foundKey = Object.keys(payload.url_affiliates_map).find(
        k => normalizeProductUrl(k) === normalizedScraped
      );
      return foundKey ? payload.url_affiliates_map[foundKey] : '';
    })();

    assert.equal(affiliateLink, 'https://tokopedia.link/affiliate-ecentio');
  });

  it('handles null, undefined, or missing url_affiliates_map safely', () => {
    for (const testPayload of [null, undefined, {}, { url_affiliates_map: null }]) {
      const scrapedItem = { url: 'https://tokopedia.com/item-1' };
      const affiliateLink = (() => {
        if (!testPayload?.url_affiliates_map) return '';
        const normalizedScraped = normalizeProductUrl(scrapedItem.url);
        const foundKey = Object.keys(testPayload.url_affiliates_map).find(
          k => normalizeProductUrl(k) === normalizedScraped
        );
        return foundKey ? testPayload.url_affiliates_map[foundKey] : '';
      })();
      assert.equal(affiliateLink, '');
    }
  });
});
