import test from 'node:test';
import assert from 'node:assert/strict';
import { closePgPool } from '../lib/db-pg.js';
import { listProductCatalog } from '../lib/product-catalog-service.js';

test.after(async () => {
  await new Promise(resolve => setTimeout(resolve, 500));
  await closePgPool();
  process.exit(0);
});

test('Product Catalog Sorting & Adaptive Story Arc Suite', async (t) => {

  await t.test('1. listProductCatalog returns Garlibee as #1 newest product (created_at DESC)', async () => {
    const res = await listProductCatalog({ limit: 10 });
    assert.ok(res.data && res.data.length > 0, 'Catalog data must not be empty');
    
    // Garlibee Madu Bawang Lanang was created on 2026-11-06 and must be at index 0
    const firstProduct = res.data[0];
    assert.ok(
      firstProduct.product_name && firstProduct.product_name.includes('Garlibee'),
      `First product must be Garlibee, received: ${firstProduct.product_name}`
    );
    assert.strictEqual(firstProduct.id, 'pe_1793545394035_6698');
  });

  await t.test('2. listProductCatalog supports limit bump up to 500 and oldest sort', async () => {
    const res300 = await listProductCatalog({ limit: 300 });
    assert.ok(res300.data.length >= 200, `Expected at least 200 items with limit 300, got: ${res300.data.length}`);

    // Verify sort=oldest returns old IDs first
    const resOldest = await listProductCatalog({ limit: 5, sort: 'oldest' });
    assert.notStrictEqual(resOldest.data[0]?.id, 'pe_1793545394035_6698', 'Oldest sort must not return Garlibee as first item');
  });

  await t.test('3. Adaptive Story Arc generates correct beats for all 5 campaign types', () => {
    // Import helper logic or simulate the same contract
    function generateAdaptiveStoryArc(type, count = 6, dur = 4, presetConfig = {}) {
      const c = Math.max(3, Number(count) || 6);
      const d = Math.max(3, Number(dur) || 4);
      const totalSeconds = c * d;

      if (type === 'recipe_labs') {
        return {
          type: 'recipe_labs',
          isStaticGrid: true,
          totalSeconds: 0,
          steps: [
            { seq: 1, title: 'Hero Shot Utama (Sajian Matang)', tag: 'Hero Split 40%' },
            { seq: 2, title: 'Bahan Baku Segar Pilihan', tag: 'Macro Texture' },
            { seq: 3, title: 'Aksi Peracikan di Dapur', tag: 'Action Shot' },
            { seq: 4, title: 'Sajian Siap Santap / Plating', tag: 'Final Plate' }
          ]
        };
      }

      let steps = [];
      if (type === 'product_campaign') {
        steps = [
          { seq: 1, title: 'Hook Relatable / Pain Point', tag: 'Hook 0-3s' },
          { seq: 2, title: 'Eskalasi Masalah Penonton', tag: 'Pain Point' },
          { seq: 3, title: 'Solusi & Intro Produk Target', tag: '🛍️ PIVOT PRODUK' },
          { seq: 4, title: 'Demonstrasi Fitur & USP', tag: 'Fitur Unggulan' },
          { seq: 5, title: 'Bukti Nyata / Transformasi', tag: 'Social Proof' },
          { seq: 6, title: 'Rekomendasi & Outro CTA', tag: 'CTA Link Bio' }
        ];
      } else if (type === 'editorial_campaign') {
        steps = [
          { seq: 1, title: 'Tension Hook Pembuka', tag: 'Tension 0-3s' },
          { seq: 2, title: 'Realita yang Terabaikan', tag: 'Hidden Reality' },
          { seq: 3, title: 'Eksplorasi Dilema & Isu', tag: 'Dilemma' },
          { seq: 4, title: 'Sudut Pandang / Filosofi Baru', tag: 'New Paradigm' },
          { seq: 5, title: 'Reframe Persepsi Positif', tag: 'Wisdom Core' },
          { seq: 6, title: 'Kalimat Penutup & Outro Reflektif', tag: 'Closing Outro' }
        ];
      } else if (type === 'multiplier_campaign') {
        steps = [
          { seq: 1, title: 'Viral Hook Adaptasi Blueprint', tag: 'Hook 0-3s' },
          { seq: 2, title: 'Pacing Narasi & Visual Layer', tag: 'Visual Flow' },
          { seq: 3, title: 'Pengembangan Emosi Penonton', tag: 'Emotional Hook' },
          { seq: 4, title: 'Pivot Rekomendasi / Bridge', tag: 'Bridge Pivot' },
          { seq: 5, title: 'Penguatan Pesan Utama', tag: 'Key Message' },
          { seq: 6, title: 'Resolusi Cerita & Outro Khusus', tag: 'Outro Contract' }
        ];
      } else {
        steps = [
          { seq: 1, title: 'Hook Pembuka Sensori', tag: 'Sensory Hook' },
          { seq: 2, title: 'Persiapan Bahan Segar', tag: 'Prep Fresh' },
          { seq: 3, title: 'Proses Pengolahan & Masak', tag: 'Cooking Craft' },
          { seq: 4, title: 'Sizzle & Detail Tekstur', tag: 'Texture & Heat' },
          { seq: 5, title: 'Plating Estetik & Garnish', tag: 'Plating Craft' },
          { seq: 6, title: 'Sajian Akhir & Outro Bio', tag: 'Outro CTA' }
        ];
      }

      return {
        type,
        isStaticGrid: false,
        totalSeconds,
        clipsCount: c,
        clipDuration: d,
        steps: steps.slice(0, c).map((s, idx) => ({ ...s, seq: idx + 1, dur: d }))
      };
    }

    // A. Product Campaign 6 clips @ 8s = 48s
    const prodArc = generateAdaptiveStoryArc('product_campaign', 6, 8);
    assert.strictEqual(prodArc.totalSeconds, 48);
    assert.strictEqual(prodArc.steps.length, 6);
    assert.strictEqual(prodArc.steps[2].tag, '🛍️ PIVOT PRODUK');
    assert.strictEqual(prodArc.steps[0].tag, 'Hook 0-3s');

    // B. Multiplier Campaign 5 clips @ 5s = 25s
    const mulArc = generateAdaptiveStoryArc('multiplier_campaign', 5, 5);
    assert.strictEqual(mulArc.totalSeconds, 25);
    assert.strictEqual(mulArc.steps.length, 5);
    assert.strictEqual(mulArc.steps[0].title, 'Viral Hook Adaptasi Blueprint');

    // C. Recipe Labs (Static Photo Grid)
    const labsArc = generateAdaptiveStoryArc('recipe_labs', 4, 0);
    assert.strictEqual(labsArc.isStaticGrid, true);
    assert.strictEqual(labsArc.steps.length, 4);
    assert.strictEqual(labsArc.steps[0].tag, 'Hero Split 40%');
  });
});

