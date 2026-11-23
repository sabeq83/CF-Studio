import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { activeSessionsCache } from '../lib/auth.js';
import { pgQuery } from '../lib/db-pg.js';
import { getDb } from '../lib/db.js';
import { GET as pipelineConfigGET } from '../app/api/v2/recipes/autonomous-pipeline/route.js';
import { GET as statusGET } from '../app/api/v2/recipes/autonomous-pipeline/status/route.js';

activeSessionsCache['tok_hotfix_default'] = {
  id: 'usr_hotfix_default',
  username: 'hotfix_default',
  role: 'admin',
  tenantId: 'default_tenant',
  status: 'active'
};

activeSessionsCache['tok_hotfix_other'] = {
  id: 'usr_hotfix_other',
  username: 'hotfix_other',
  role: 'admin',
  tenantId: 'tnt_hotfix_isolated_test',
  status: 'active'
};

test('GET /api/v2/recipes/autonomous-pipeline filters multiplier blueprints strictly by caller tenant and deconstructed status', async () => {
  const ts = Date.now();
  const bpOwnOk = `bp_hotfix_own_ok_${ts}`;
  const bpOwnFailed = `bp_hotfix_own_failed_${ts}`;
  const bpOtherTenant = `bp_hotfix_other_${ts}`;

  try {
    await pgQuery(
      `INSERT INTO re_deconstructed_assets (id, tenant_id, source_url, status, core_problem)
       VALUES ($1, 'default_tenant', 'https://example.com/reel/111', 'deconstructed', 'Own Valid Blueprint'),
              ($2, 'default_tenant', 'https://example.com/reel/222', 'failed', 'Own Failed Blueprint'),
              ($3, 'tnt_hotfix_isolated_test', 'https://example.com/reel/333', 'deconstructed', 'Other Tenant Blueprint')`,
      [bpOwnOk, bpOwnFailed, bpOtherTenant]
    );

    const req = new Request(
      `http://localhost:3000/api/v2/recipes/autonomous-pipeline?pipeline_type=multiplier_campaign&blueprint_search=bp_hotfix_`,
      { headers: { Authorization: 'Bearer tok_hotfix_default' } }
    );
    const res = await pipelineConfigGET(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    const returnedIds = (body.blueprints || []).map(b => b.id);
    assert.ok(returnedIds.includes(bpOwnOk), 'Caller tenant deconstructed blueprint should be returned');
    assert.ok(!returnedIds.includes(bpOwnFailed), 'Failed blueprint must not be listed for Multiplier 1-click');
    assert.ok(!returnedIds.includes(bpOtherTenant), 'Other tenant blueprint must never leak into caller dropdown');
  } finally {
    await pgQuery('DELETE FROM re_deconstructed_assets WHERE id = ANY($1::text[])', [[bpOwnOk, bpOwnFailed, bpOtherTenant]]);
  }
});

test('GET /api/v2/recipes/autonomous-pipeline/status handles recipe_labs campaign IDs cleanly', async () => {
  const db = getDb();
  const cid = `recipe_hotfix_${Date.now()}`;
  const iid = `rcitem_${cid}_1`;

  try {
    await pgQuery(
      `INSERT INTO recipe_campaigns (id, tenant_id, category, custom_category, visual_style, images_per_recipe, status, campaign_type, selected_layout_id, config_json)
       VALUES ($1, 'default_tenant', 'Main Course', 'Hotfix Test Soup', 'Modern Minimalist Nordic Studio', 4, 'processing', 'static', '4_editorial_split', $2)`,
      [cid, JSON.stringify({ topic: 'Hotfix Test Soup' })]
    );
    await pgQuery(
      `INSERT INTO recipe_items (id, campaign_id, tenant_id, recipe_title, recipe_markdown_text, status)
       VALUES ($1, $2, 'default_tenant', 'Hotfix Test Soup', '# Recipe', 'completed')`,
      [iid, cid]
    );
    // Keep db import referenced cleanly
    assert.ok(db);

    const req = new Request(
      `http://localhost:3000/api/v2/recipes/autonomous-pipeline/status?campaign_id=${encodeURIComponent(cid)}`,
      { headers: { Authorization: 'Bearer tok_hotfix_default' } }
    );
    const res = await statusGET(req);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.campaign?.id, cid);
    assert.equal(data.is_completed, true);
    assert.equal(data.stages?.s2?.status, 'completed');
    assert.equal(data.stages?.s7?.status, 'completed');
  } finally {
    await pgQuery('DELETE FROM recipe_items WHERE id = $1', [iid]);
    await pgQuery('DELETE FROM recipe_campaigns WHERE id = $1', [cid]);
  }
});

test('Auto Pipeline page renders fixed toast, inline launchError near submit, and uses filteredInstantBlueprints', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'app/auto-pipeline/page.js'), 'utf8');
  assert.match(src, /const \[launchError, setLaunchError\] = useState\(''\)/);
  assert.match(src, /position:\s*'fixed'/);
  assert.match(src, /const filteredInstantBlueprints = blueprints\.filter/);
  assert.match(src, /const matchedBp = filteredInstantBlueprints\.find/);
  assert.match(src, /\{launchError && \(/);
});
