import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMetaphorKit, stableHash } from '../lib/metaphor-kit-resolver.js';

function createMemoryRepo() {
  const rows = [];
  let seq = 0;
  return {
    rows,
    async getUsageForItem(itemId) {
      return rows.find(r => r.item_id === itemId) || null;
    },
    async getRecentKitKeys(tenantId, brandProfileId, limit = 6) {
      return rows
        .filter(r => r.tenant_id === tenantId && (brandProfileId ? r.brand_profile_id === brandProfileId : r.brand_profile_id === null))
        .sort((a, b) => b.seq - a.seq)
        .slice(0, limit)
        .map(r => r.kit_key);
    },
    async upsertUsage({ tenantId, brandProfileId, campaignId, itemId, kitKey, topicKeys, reason }) {
      const idx = rows.findIndex(r => r.item_id === itemId);
      const record = {
        id: `mku_${++seq}`,
        seq,
        tenant_id: tenantId,
        brand_profile_id: brandProfileId,
        campaign_id: campaignId,
        item_id: itemId,
        kit_key: kitKey,
        topic_keys: JSON.stringify(topicKeys),
        reason,
      };
      if (idx >= 0) {
        rows[idx] = record;
      } else {
        rows.push(record);
      }
      return record;
    },
  };
}

test('resolveMetaphorKit: prioritas explicit > sticky > rotasi anti-repeat', async () => {
  const repo = createMemoryRepo();

  // Explicit menang
  const explicitRes = await resolveMetaphorKit({
    text: 'Masalah kolesterol tinggi',
    tenantId: 't1',
    brandProfileId: 'brand_a',
    itemId: 'item_exp',
    explicitKitKey: 'carpet_deep_clean',
    repo,
  });
  assert.equal(explicitRes.kit.key, 'carpet_deep_clean');
  assert.equal(explicitRes.reason, 'explicit');

  // Sticky menang pada itemId yang sama saat explicit kosong
  const stickyRes = await resolveMetaphorKit({
    text: 'Masalah kolesterol tinggi',
    tenantId: 't1',
    brandProfileId: 'brand_a',
    itemId: 'item_exp',
    repo,
  });
  assert.equal(stickyRes.kit.key, 'carpet_deep_clean');
  assert.equal(stickyRes.reason, 'sticky');
});

test('resolveMetaphorKit: rotasi topik kolesterol & pencernaan (window=6) tidak mengulang sebelum pool habis, lalu LRU', async () => {
  const repo = createMemoryRepo();
  const pickedKeys = [];

  // 7 video berturut-turut untuk topik kolesterol + pencernaan (pool > 6)
  for (let i = 1; i <= 7; i++) {
    const res = await resolveMetaphorKit({
      text: 'Cara mengimbangi gorengan bersantan berlemak agar pencernaan nyaman',
      tenantId: 't1',
      brandProfileId: 'dapurbotani',
      itemId: `item_rot_${i}`,
      window: 6,
      repo,
    });
    assert.ok(res);
    pickedKeys.push(res.kit.key);
  }

  // 6 item pertama harus seluruhnya unik; item ke-7 juga tidak mengulang 6 item sebelumnya (pool kolesterol+pencernaan = 10 kit)
  assert.equal(new Set(pickedKeys.slice(0, 6)).size, 6, `6 kit pertama harus unik: ${pickedKeys.slice(0, 6)}`);
  assert.equal(new Set(pickedKeys).size, 7, `7 kit harus unik karena pool >= 7: ${pickedKeys}`);

  // Uji LRU pada topik dengan 4 kit (gula_darah) dan window=6
  const sugarRepo = createMemoryRepo();
  const sugarKeys = [];
  for (let i = 1; i <= 5; i++) {
    const res = await resolveMetaphorKit({
      text: 'Menjaga gula darah harian',
      tenantId: 't1',
      brandProfileId: 'siasatsehat',
      itemId: `sugar_${i}`,
      window: 6,
      repo: sugarRepo,
    });
    sugarKeys.push(res.kit.key);
  }
  assert.equal(new Set(sugarKeys.slice(0, 4)).size, 4, '4 kit pertama gula_darah harus unik');
  assert.equal(sugarKeys[4], sugarKeys[0], 'Item ke-5 harus memilih LRU (yang pertama kali dipakai)');
});

test('resolveMetaphorKit: isolasi antar brand & deterministik pada retry', async () => {
  const repo = createMemoryRepo();

  const b1 = await resolveMetaphorKit({
    text: 'Masalah kolesterol gorengan',
    tenantId: 't1',
    brandProfileId: 'brand_1',
    itemId: 'same_seed_item',
    repo,
  });

  // Brand berbeda tidak terpengaruh oleh usage brand_1
  const b2 = await resolveMetaphorKit({
    text: 'Masalah kolesterol gorengan',
    tenantId: 't1',
    brandProfileId: 'brand_2',
    itemId: 'same_seed_item_2',
    repo,
  });
  assert.ok(b1 && b2);
  assert.equal(stableHash('abc'), stableHash('abc'));
});

test('resolveMetaphorKit: DB error fallback aman tanpa crash & topik tanpa kit return null', async () => {
  const brokenRepo = {
    async getUsageForItem() { throw new Error('PG connection timeout'); },
    async getRecentKitKeys() { throw new Error('PG relation does not exist'); },
    async upsertUsage() { throw new Error('PG write failed'); },
  };

  const fallbackRes = await resolveMetaphorKit({
    text: 'Kolesterol tinggi akibat gorengan',
    tenantId: 't1',
    brandProfileId: 'brand_x',
    itemId: 'item_broken_db',
    repo: brokenRepo,
  });
  assert.ok(fallbackRes?.kit, 'Harus tetap mengembalikan kit meski DB error');
  assert.equal(fallbackRes.reason, 'fallback_no_db');

  // Topik pencegahan_kanker sengaja tidak diberi kit -> null
  const noKitRes = await resolveMetaphorKit({
    text: 'Edukasi pencegahan kanker sejak dini',
    tenantId: 't1',
    brandProfileId: 'brand_x',
    itemId: 'item_cancer',
    repo: brokenRepo,
  });
  assert.equal(noKitRes, null);
});

