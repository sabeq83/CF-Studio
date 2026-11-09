import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractCategoryFromCookpadUrl, parseCookpadSearchHtml } from '../lib/scrapers/cookpad.js';
import { detectPlatform, formatRecipesToCsv, formatRecipesToTsv } from '../lib/scrapers/index.js';

describe('Recipe Scraper Suite', () => {

  describe('Cookpad Driver: extractCategoryFromCookpadUrl', () => {
    it('harus mengekstrak kategori sederhana dari slug URL', () => {
      const url = 'https://cookpad.com/id/cari/brownies';
      assert.equal(extractCategoryFromCookpadUrl(url), 'brownies');
    });

    it('harus mengekstrak kategori yang mengandung spasi atau encoded URL', () => {
      const url = 'https://cookpad.com/id/cari/ayam%20goreng?page=2';
      assert.equal(extractCategoryFromCookpadUrl(url), 'ayam goreng');
    });

    it('harus menangani karakter plus (+) sebagai spasi', () => {
      const url = 'https://cookpad.com/id/cari/bolu+kukus?order=recent';
      assert.equal(extractCategoryFromCookpadUrl(url), 'bolu kukus');
    });

    it('harus mengembalikan "general" jika URL tidak memiliki slug pencarian valid', () => {
      const url = 'https://cookpad.com/id/';
      assert.equal(extractCategoryFromCookpadUrl(url), 'general');
    });
  });

  describe('Cookpad Driver: parseCookpadSearchHtml', () => {
    it('harus mengekstrak title, category, dan canonical URL dari fixture HTML', () => {
      const fixtureHtml = `
        <div class="recipe-list">
          <div class="card">
            <h2>
              <a href="/id/resep/26827973-brownies-bihun">Brownies Bihun Gluten Free</a>
            </h2>
          </div>
          <div class="card">
            <h2>
              <a href="/id/resep/26824275">Brownies Dark &amp; Choco &quot;Super Lembut&quot;</a>
            </h2>
          </div>
          <!-- Link non-resep yang harus difilter -->
          <a href="/id/resep/baru">Tulis Resep Baru</a>
          <a href="/id/resep/26827973">Brownies Bihun Duplikat</a>
        </div>
      `;

      const results = parseCookpadSearchHtml(fixtureHtml, 'brownies');

      assert.equal(results.length, 2, 'Harus menghasilkan 2 resep unik (duplikat & non-resep tereliminasi)');
      
      // Item 1
      assert.equal(results[0].id, '26827973');
      assert.equal(results[0].title, 'Brownies Bihun Gluten Free');
      assert.equal(results[0].category, 'brownies');
      assert.equal(results[0].url, 'https://cookpad.com/id/resep/26827973');

      // Item 2
      assert.equal(results[1].id, '26824275');
      assert.equal(results[1].title, 'Brownies Dark & Choco "Super Lembut"');
      assert.equal(results[1].category, 'brownies');
      assert.equal(results[1].url, 'https://cookpad.com/id/resep/26824275');
    });
  });

  describe('Scraper Orchestrator: Platform Detection', () => {
    it('harus mengenali domain platform dengan tepat', () => {
      assert.equal(detectPlatform('https://cookpad.com/id/cari/brownies'), 'cookpad');
      assert.equal(detectPlatform('https://endeus.tv/resep/brownies'), 'endeus');
      assert.equal(detectPlatform('https://briliofood.net/resep/123'), 'brilio');
      assert.equal(detectPlatform('https://example.com/random'), 'unknown');
    });
  });

  describe('Scraper Orchestrator: CSV & TSV Formatters', () => {
    const sampleItems = [
      { title: 'Brownies "Fudge"', category: 'brownies', url: 'https://cookpad.com/id/resep/100' },
      { title: 'Ayam Goreng, Gurih', category: 'ayam goreng', url: 'https://cookpad.com/id/resep/200' }
    ];

    it('harus menghasilkan format CSV valid dengan escaping double-quote dan koma', () => {
      const csv = formatRecipesToCsv(sampleItems);
      const lines = csv.trim().split('\n');
      assert.equal(lines[0], 'title,category,url');
      assert.equal(lines[1], '"Brownies ""Fudge""","brownies","https://cookpad.com/id/resep/100"');
      assert.equal(lines[2], '"Ayam Goreng, Gurih","ayam goreng","https://cookpad.com/id/resep/200"');
    });

    it('harus menghasilkan format TSV valid dengan pembatas tab', () => {
      const tsv = formatRecipesToTsv(sampleItems);
      const lines = tsv.trim().split('\n');
      assert.equal(lines[0], 'title\tcategory\turl');
      assert.equal(lines[1], 'Brownies "Fudge"\tbrownies\thttps://cookpad.com/id/resep/100');
    });
  });

});
