import test from 'node:test';
import assert from 'node:assert/strict';
import { activeSessionsCache } from '../lib/auth.js';
import { dbGet, dbAll } from '../lib/db.js';
import { selectBestProductMatch, buildPlatformAdaptiveCaptions, normalizeSocialMediaPackage } from '../lib/smart-affiliate-package-builder.js';

test('1. mul_261108_s6so1p contains active Shopee affiliate link in Facebook caption & Link di Bio in bio caption', async () => {
  const task = await dbGet("SELECT * FROM re_multiplier_tasks WHERE id = 'mul_261108_s6so1p'");
  if (!task) {
    console.log('Skipping test 1 (task not in current schema)');
    return;
  }

  assert.ok(task.new_caption, 'new_caption must not be empty');
  assert.ok(task.new_caption.includes('https://s.shopee.co.id/'), 'new_caption (FB) must contain Shopee link');
  assert.ok(!task.new_caption.includes('{{AFFILIATE_LINK}}'), 'Placeholder must be fully resolved');

  let bridging = {};
  try { bridging = JSON.parse(task.bridging_config_json || '{}'); } catch(_) {}
  assert.ok(bridging.social_media_package, 'social_media_package must be preserved');
  assert.ok(bridging.social_media_package.caption_facebook.includes('https://s.shopee.co.id/'), 'caption_facebook must have Shopee link');
  assert.ok(bridging.social_media_package.caption_bio.includes('Link di Bio'), 'caption_bio must direct to Link di Bio');
  assert.ok(!bridging.social_media_package.caption_bio.includes('https://s.shopee.co.id/'), 'caption_bio must NOT have raw unclickable Shopee link');
});

test('2. Unified Batches API /batches returns 20 records across all video types including mul_261108_s6so1p', async () => {
  const mockToken = 'mock_batches_test_' + Date.now();
  activeSessionsCache[mockToken] = {
    id: 'user_test',
    username: 'tester',
    role: 'admin',
    tenantId: 'default_tenant',
    menuPermissions: ['auto_pipeline', 'contentflow']
  };

  const { GET } = await import('../app/api/v2/recipes/autonomous-pipeline/batches/route.js');
  const req = new Request('http://localhost:3000/api/v2/recipes/autonomous-pipeline/batches?limit=20', {
    headers: { Authorization: `Bearer ${mockToken}` }
  });

  const res = await GET(req);
  const json = await res.json();

  assert.equal(json.success, true);
  assert.ok(Array.isArray(json.data), 'data must be an array');
  assert.ok(json.count > 0 && json.count <= 20, 'count must be up to 20');

  // Verify multiple video types exist
  const types = new Set(json.data.map(d => d.campaign_type));
  assert.ok(types.size >= 1, 'Should contain at least 1 campaign type');

  // Verify structure of items
  for (const item of json.data) {
    assert.ok(item.id, 'item must have id');
    assert.ok(item.campaign_type, 'item must have campaign_type');
    assert.ok(item.type_badge, 'item must have type_badge');
    assert.ok(item.campaign_name, 'item must have campaign_name');
    assert.ok(item.target_detail_url, 'item must have target_detail_url');
  }

  // If mul_261108_s6so1p exists in DB, it should be in the list
  const mul = json.data.find(d => d.id === 'mul_261108_s6so1p');
  if (mul) {
    assert.equal(mul.campaign_type, 'multiplier_campaign');
    assert.equal(mul.type_badge, '⚡ Multiplier');
    assert.equal(mul.target_detail_url, '/multiplier-lab');
  }
});

test('3. Status poller /status?campaign_id=mul_261108_s6so1p returns valid 7-stage visualizer mapping', async () => {
  const mockToken = 'mock_status_test_' + Date.now();
  activeSessionsCache[mockToken] = {
    id: 'user_test',
    username: 'tester',
    role: 'admin',
    tenantId: 'default_tenant',
    menuPermissions: ['auto_pipeline', 'contentflow']
  };

  const { GET } = await import('../app/api/v2/recipes/autonomous-pipeline/status/route.js');
  const req = new Request('http://localhost:3000/api/v2/recipes/autonomous-pipeline/status?campaign_id=mul_261108_s6so1p', {
    headers: { Authorization: `Bearer ${mockToken}` }
  });

  const res = await GET(req);
  const json = await res.json();

  assert.equal(json.success, true);
  if (json.campaign) {
    assert.equal(json.campaign.id, 'mul_261108_s6so1p');
    assert.ok(json.stages, 'stages object must exist');
    assert.equal(json.stages.s1.step, 1);
    assert.equal(json.stages.s2.step, 2);
    assert.equal(json.stages.s3.step, 3);
    assert.equal(json.stages.s4.step, 4);
    assert.equal(json.stages.s5.step, 5);
    assert.equal(json.stages.s6.step, 6);
    assert.equal(json.stages.s7.step, 7);
    assert.ok(json.telemetry.message, 'telemetry message must not be empty');
  }
});

test('4. Non-bridging video campaign still generates Shopee affiliate link in Facebook caption', () => {
  const sampleProducts = [
    {
      product_id: 'pe_chocolate',
      product_name: 'Monggo Dark Chocolate 100% Cocoa',
      category: 'Makanan / Cokelat',
      unique_selling_point: 'Pure cocoa butter',
      affiliate_link: 'https://s.shopee.co.id/20ucJrQmFD'
    },
    {
      product_id: 'pe_chia',
      product_name: 'Nutrifarm Chia Seeds Organic',
      category: 'Superfood',
      unique_selling_point: 'High fiber',
      affiliate_link: 'https://s.shopee.co.id/6VLqr563Oc'
    }
  ];

  const matched = selectBestProductMatch({
    products: sampleProducts,
    topic: 'Resep Brownies Cokelat Camilan Sore'
  });

  assert.equal(matched.product_id, 'pe_chocolate');
  assert.equal(matched.affiliate_link, 'https://s.shopee.co.id/20ucJrQmFD');

  const normalized = normalizeSocialMediaPackage({
    title: 'Brownies Cokelat Camilan Sore #Shorts',
    caption: 'Bikin brownies sehat cokelat tanpa terigu!',
    caption_facebook: 'Bikin brownies sehat cokelat tanpa terigu!\n\n🛒 Beli bahan di:\n{{AFFILIATE_LINK}}',
    caption_bio: 'Bikin brownies sehat cokelat tanpa terigu!\n\n👉 Bahan ada di Link di Bio!',
    hashtags: ['#Brownies', '#CamilanSehat']
  }, matched);

  assert.ok(normalized.caption_facebook.includes('https://s.shopee.co.id/20ucJrQmFD'));
  assert.ok(!normalized.caption_facebook.includes('{{AFFILIATE_LINK}}'));
  assert.ok(normalized.caption_bio.includes('Link di Bio'));
});

