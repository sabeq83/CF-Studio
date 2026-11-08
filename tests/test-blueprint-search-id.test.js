import test from 'node:test';
import assert from 'node:assert/strict';
import { pgQuery, closePgPool } from '../lib/db-pg.js';

function extractReelId(url) {
  if (!url) return '';
  const m = url.match(/reel\/(\d+)/i) || url.match(/\/(\d{10,})/);
  return m ? m[1] : '';
}

function filterBlueprints(blueprints, searchQuery) {
  if (!searchQuery || !searchQuery.trim()) return blueprints;
  const q = searchQuery.toLowerCase().trim();
  return blueprints.filter(bp => {
    const reelId = extractReelId(bp.source_url);
    return (
      (reelId && reelId.includes(q)) ||
      (bp.source_url && bp.source_url.toLowerCase().includes(q)) ||
      (bp.core_problem && bp.core_problem.toLowerCase().includes(q)) ||
      (bp.core_solution && bp.core_solution.toLowerCase().includes(q)) ||
      (bp.niche && bp.niche.toLowerCase().includes(q)) ||
      (bp.tags && (Array.isArray(bp.tags) ? bp.tags.join(' ') : String(bp.tags)).toLowerCase().includes(q)) ||
      (bp.viral_pattern_summary && bp.viral_pattern_summary.toLowerCase().includes(q)) ||
      (bp.original_caption && bp.original_caption.toLowerCase().includes(q))
    );
  });
}

test('extractReelId extracts numeric reel ID from Facebook and Instagram URLs', () => {
  assert.equal(
    extractReelId('https://www.facebook.com/reel/1476160110888470'),
    '1476160110888470'
  );
  assert.equal(
    extractReelId('https://m.facebook.com/reel/2130962364300836/?mibextid=rS40aB7S9Ucbxw6v'),
    '2130962364300836'
  );
  assert.equal(
    extractReelId('https://www.instagram.com/reel/850865538060532/'),
    '850865538060532'
  );
  assert.equal(extractReelId(''), '');
  assert.equal(extractReelId(null), '');
  assert.equal(extractReelId(undefined), '');
});

test('filterBlueprints filters correctly across Reel ID, Niche, and Topic keywords', () => {
  const sampleBlueprints = [
    {
      id: 'bp_1476160110888470',
      source_url: 'https://www.facebook.com/reel/1476160110888470',
      niche: 'Baking',
      core_problem: 'Did you know if you add milk, then add cornstarch...',
      core_solution: 'Hasil olahan dessert lembut 3 bahan tanpa oven',
      viral_pattern_summary: 'Formula 3-Ingredient Hook dengan visual ASMR'
    },
    {
      id: 'bp_2130962364300836',
      source_url: 'https://www.facebook.com/reel/2130962364300836',
      niche: 'Cooking',
      core_problem: 'Sarapan praktis, sehat, bergizi tinggi tanpa ribet',
      core_solution: 'Did you know if you mash 1 boiled potato and add oats...',
      viral_pattern_summary: 'Teknik Did You Know hook dengan adegan roti hangat'
    },
    {
      id: 'bp_850865538060532',
      source_url: 'https://www.facebook.com/reel/850865538060532',
      niche: 'Baking',
      core_problem: 'Stop buying chocolate desserts, make this rich creamy one',
      core_solution: 'Stop buying chocolate desserts',
      viral_pattern_summary: 'Visual Culinary ASMR sendok cokelat kental'
    },
    {
      id: 'bp_1034313555836569',
      source_url: 'https://www.facebook.com/reel/1034313555836569',
      niche: 'Health',
      core_problem: 'Stamina pria dan pegal linu: herbal secret',
      core_solution: 'Honey and black garlic drink',
      viral_pattern_summary: 'Reverse-psychology hook visual rempah alami'
    }
  ];

  // 1. Search by exact Reel ID: 1476160110888470
  const matchId = filterBlueprints(sampleBlueprints, '1476160110888470');
  assert.equal(matchId.length, 1);
  assert.equal(matchId[0].id, 'bp_1476160110888470');

  // 2. Search by partial Reel ID: 147616
  const matchPartialId = filterBlueprints(sampleBlueprints, '147616');
  assert.equal(matchPartialId.length, 1);
  assert.equal(matchPartialId[0].id, 'bp_1476160110888470');

  // 3. Search by topic keyword: "chocolate"
  const matchChocolate = filterBlueprints(sampleBlueprints, 'chocolate');
  assert.equal(matchChocolate.length, 1);
  assert.equal(matchChocolate[0].id, 'bp_850865538060532');

  // 4. Search by topic keyword: "sarapan"
  const matchBreakfast = filterBlueprints(sampleBlueprints, 'sarapan');
  assert.equal(matchBreakfast.length, 1);
  assert.equal(matchBreakfast[0].id, 'bp_2130962364300836');

  // 5. Search by niche: "Baking"
  const matchBaking = filterBlueprints(sampleBlueprints, 'baking');
  assert.equal(matchBaking.length, 2);

  // 6. Search by niche: "Health"
  const matchHealth = filterBlueprints(sampleBlueprints, 'health');
  assert.equal(matchHealth.length, 1);
  assert.equal(matchHealth[0].id, 'bp_1034313555836569');

  // 7. Non-matching query
  const matchNone = filterBlueprints(sampleBlueprints, 'nonexistent_query_xyz');
  assert.equal(matchNone.length, 0);

  // 8. Empty query returns all
  const matchAll = filterBlueprints(sampleBlueprints, '');
  assert.equal(matchAll.length, 4);
});

test('PostgreSQL re_deconstructed_assets query returns enriched columns safely', async () => {
  try {
    const res = await pgQuery(`
      SELECT id, source_url, original_caption, viral_pattern_summary, niche, core_problem, core_solution, tags, created_at
      FROM re_deconstructed_assets
      ORDER BY created_at DESC
      LIMIT 5
    `);
    assert.ok(Array.isArray(res.rows), 'Query should return array of rows');
    if (res.rows.length > 0) {
      const row = res.rows[0];
      assert.ok('id' in row, 'Row must have id');
      assert.ok('source_url' in row, 'Row must have source_url');
      assert.ok('niche' in row, 'Row must have niche column');
      assert.ok('core_problem' in row, 'Row must have core_problem column');
      assert.ok('core_solution' in row, 'Row must have core_solution column');
    }
  } finally {
    await closePgPool();
  }
});
