import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../lib/db.js';
import { closePgPool } from '../lib/db-pg.js';

test.after(async () => {
  await closePgPool();
});

test('Content Planner Search & Consumed Status Filtering Logic', async () => {
  const db = getDb();
  const tenantId = 'default_tenant';
  const timestamp = Date.now();

  const readyPlannerId = `test_pln_ready_${timestamp}`;
  const consumedPlannerId = `test_pln_consumed_${timestamp}`;
  const mockCampaignId = `camp_opc_${timestamp}`;

  // 1. Insert Ready Planner (Belum Dipakai)
  await db.prepare(`
    INSERT INTO content_planners (
      id, title, account_name, product_name, planner_focus, status, tenant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    readyPlannerId,
    'Cerita Dokter - Edukasi Bawang Hitam & Kolesterol',
    'Cerita Dokter',
    'GarliBee Garlic Honey',
    'brand_editorial',
    'planned',
    tenantId
  );

  // 2. Insert Consumed Planner (Sudah Terpakai)
  await db.prepare(`
    INSERT INTO content_planners (
      id, title, account_name, product_name, planner_focus, status, tenant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    consumedPlannerId,
    'Dapur Botani - Resep Minuman Detoks Segar',
    'Dapur Botani',
    'Botani Herbal Tea',
    'product_recipe',
    'consumed',
    tenantId
  );

  // 3. Insert Consumption Record for Consumed Planner
  await db.prepare(`
    INSERT INTO content_planner_consumptions (
      id, planner_id, owner_type, owner_id, status, tenant_id
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    `cpc_${timestamp}`,
    consumedPlannerId,
    'pillar_campaign',
    mockCampaignId,
    'consumed',
    tenantId
  );

  // 4. Query DB using the exact API query logic from /api/content-planner
  const plannersQuery = await db.prepare(`
    SELECT p.*, b.brand_name AS brand_profile_name, COUNT(r.id) as row_count,
           c.status as consumption_status, c.owner_type as consumed_owner_type, c.owner_id as consumed_owner_id
    FROM content_planners p
    LEFT JOIN brand_profiles b ON p.brand_id = b.id
    LEFT JOIN content_planner_rows r ON p.id = r.planner_id
    LEFT JOIN content_planner_consumptions c ON p.id = c.planner_id AND (c.tenant_id = p.tenant_id OR c.tenant_id = ?)
    WHERE (p.tenant_id = ? OR p.tenant_id IS NULL)
      AND p.id IN (?, ?)
    GROUP BY p.id, b.brand_name, c.status, c.owner_type, c.owner_id
    ORDER BY p.created_at DESC
  `).all(tenantId, tenantId, readyPlannerId, consumedPlannerId);

  const formattedPlanners = (plannersQuery || []).map(p => ({
    ...p,
    is_archived: Boolean(p.is_archived),
    is_consumed: Boolean(p.consumption_status === 'consumed' || p.status === 'consumed')
  }));

  assert.equal(formattedPlanners.length, 2, 'Must retrieve both planners');

  const readyPln = formattedPlanners.find(p => p.id === readyPlannerId);
  const consumedPln = formattedPlanners.find(p => p.id === consumedPlannerId);

  assert.ok(readyPln, 'Ready planner must exist');
  assert.equal(readyPln.is_consumed, false, 'Ready planner must have is_consumed = false');

  assert.ok(consumedPln, 'Consumed planner must exist');
  assert.equal(consumedPln.is_consumed, true, 'Consumed planner must have is_consumed = true');
  assert.equal(consumedPln.consumed_owner_id, mockCampaignId, 'Consumed planner must reference owner_id');

  // 5. Test Frontend In-Memory Filtering Logic

  // Filter 5.1: Status Filter 'ready'
  const readyOnly = formattedPlanners.filter(p => !p.is_consumed);
  assert.equal(readyOnly.length, 1);
  assert.equal(readyOnly[0].id, readyPlannerId);

  // Filter 5.2: Status Filter 'consumed'
  const consumedOnly = formattedPlanners.filter(p => p.is_consumed);
  assert.equal(consumedOnly.length, 1);
  assert.equal(consumedOnly[0].id, consumedPlannerId);

  // Filter 5.3: Search Query 'bawang'
  const searchBawang = formattedPlanners.filter(p => {
    const q = 'bawang';
    const title = (p.title || p.product_name || '').toLowerCase();
    const brand = (p.account_name || p.brand_profile_name || '').toLowerCase();
    return title.includes(q) || brand.includes(q);
  });
  assert.equal(searchBawang.length, 1);
  assert.equal(searchBawang[0].id, readyPlannerId);

  // Filter 5.4: Search Query 'botani'
  const searchBotani = formattedPlanners.filter(p => {
    const q = 'botani';
    const title = (p.title || p.product_name || '').toLowerCase();
    const brand = (p.account_name || p.brand_profile_name || '').toLowerCase();
    return title.includes(q) || brand.includes(q);
  });
  assert.equal(searchBotani.length, 1);
  assert.equal(searchBotani[0].id, consumedPlannerId);

  // 6. Cleanup test data
  await db.prepare('DELETE FROM content_planner_consumptions WHERE planner_id IN (?, ?)').run(readyPlannerId, consumedPlannerId);
  await db.prepare('DELETE FROM content_planners WHERE id IN (?, ?)').run(readyPlannerId, consumedPlannerId);
});
