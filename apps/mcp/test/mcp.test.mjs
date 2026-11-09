import test from 'node:test';
import { request as httpRequest } from 'node:http';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createCfStudioServer, createMaknaServer, operatorClient } from '../tools.mjs';
import { createHttpApp } from '../server.mjs';

async function connected(t, request) {
  const server = createCfStudioServer(request);
  const client = new Client({ name: 'test', version: '2' });
  const [left, right] = InMemoryTransport.createLinkedPair();
  await server.connect(right);
  await client.connect(left);
  t.after(async () => {
    await client.close();
    await server.close();
  });
  return client;
}

test('discovery of all 19 CF Studio tools and legacy aliases', async t => {
  const client = await connected(t, async () => ({ success: true }));
  const tools = (await client.listTools()).tools;
  assert.equal(tools.length, 19);

  const toolNames = new Set(tools.map(x => x.name));
  // 5 Auto Pipeline dedicated tools
  assert.ok(toolNames.has('cf_create_product_video'));
  assert.ok(toolNames.has('cf_create_editorial_video'));
  assert.ok(toolNames.has('cf_create_recipe_video'));
  assert.ok(toolNames.has('cf_create_multiplier_video'));
  assert.ok(toolNames.has('cf_create_recipe_labs_post'));
  assert.ok(toolNames.has('cf_run_auto_pipeline'));

  // Schedule management tools
  assert.ok(toolNames.has('cf_list_schedules'));
  assert.ok(toolNames.has('cf_create_schedule'));
  assert.ok(toolNames.has('cf_trigger_schedule_now'));

  // Discovery & status
  assert.ok(toolNames.has('cf_whoami'));
  assert.ok(toolNames.has('cf_list_presets'));
  assert.ok(toolNames.has('cf_search_catalog'));
  assert.ok(toolNames.has('cf_get_job_status'));

  // Legacy aliases
  assert.ok(toolNames.has('makna_whoami'));
  assert.ok(toolNames.has('makna_list_presets'));
  assert.ok(toolNames.has('makna_search_catalog'));
  assert.ok(toolNames.has('makna_create_campaign'));
  assert.ok(toolNames.has('makna_get_campaign_status'));
  assert.ok(toolNames.has('cf_create_campaign'));
});

test('auto pipeline 5 engines dispatch to /api/v2/recipes/autonomous-pipeline', async t => {
  const calls = [];
  const client = await connected(t, async (path, opts) => {
    calls.push({ path, opts });
    return { success: true, campaign_id: 'camp-123' };
  });

  // 1. Product Video
  await client.callTool({
    name: 'cf_create_product_video',
    arguments: {
      product_title: 'Sambal Bu Rudy',
      selected_cep: 'Problem-Solution Based',
      idempotency_key: 'key-prod-1'
    }
  });
  assert.equal(calls[0].path, '/api/v2/recipes/autonomous-pipeline');
  assert.equal(calls[0].opts.key, 'key-prod-1');
  assert.equal(calls[0].opts.body.pipeline_type, 'product_campaign');
  assert.equal(calls[0].opts.body.product_title, 'Sambal Bu Rudy');

  // 2. Editorial Video
  await client.callTool({
    name: 'cf_create_editorial_video',
    arguments: {
      content_pillar: 'Tips Dapur Praktis',
      idempotency_key: 'key-edit-1'
    }
  });
  assert.equal(calls[1].opts.body.pipeline_type, 'editorial_campaign');
  assert.equal(calls[1].opts.body.content_pillar, 'Tips Dapur Praktis');

  // 3. Recipe Video
  await client.callTool({
    name: 'cf_create_recipe_video',
    arguments: {
      topic: 'Ayam Goreng Mentega',
      category: 'makanan_utama',
      enable_motion_text: true,
      idempotency_key: 'key-rec-1'
    }
  });
  assert.equal(calls[2].opts.body.pipeline_type, 'recipe_campaign');
  assert.equal(calls[2].opts.body.topic, 'Ayam Goreng Mentega');
  assert.equal(calls[2].opts.body.enable_motion_text, true);

  // 4. Multiplier Video
  await client.callTool({
    name: 'cf_create_multiplier_video',
    arguments: {
      deconstruct_asset_id: 'mul_261108_s6so1p',
      selected_angle: 'Hook Kontras',
      generate_recipe: true,
      idempotency_key: 'key-mul-1'
    }
  });
  assert.equal(calls[3].opts.body.pipeline_type, 'multiplier_campaign');
  assert.equal(calls[3].opts.body.deconstruct_asset_id, 'mul_261108_s6so1p');
  assert.equal(calls[3].opts.body.generate_recipe, true);

  // 5. Recipe Labs Post
  await client.callTool({
    name: 'cf_create_recipe_labs_post',
    arguments: {
      topic: 'Brownies Fudgy',
      visual_style: 'Food Porn',
      selected_layout_id: '4_editorial_split',
      post_to_facebook: true,
      idempotency_key: 'key-labs-1'
    }
  });
  assert.equal(calls[4].opts.body.pipeline_type, 'recipe_labs');
  assert.equal(calls[4].opts.body.topic, 'Brownies Fudgy');
  assert.equal(calls[4].opts.body.selected_layout_id, '4_editorial_split');

  // 6. Universal Master Tool
  await client.callTool({
    name: 'cf_run_auto_pipeline',
    arguments: {
      pipeline_type: 'recipe_campaign',
      topic: 'Es Kopi Aren',
      idempotency_key: 'key-master-1'
    }
  });
  assert.equal(calls[5].opts.body.pipeline_type, 'recipe_campaign');
  assert.equal(calls[5].opts.body.topic, 'Es Kopi Aren');
});

test('schedule tools dispatch to /api/v2/recipes/auto-pipeline-schedules', async t => {
  const calls = [];
  const client = await connected(t, async (path, opts) => {
    calls.push({ path, opts });
    return { success: true, schedule_id: 'sched-456' };
  });

  // List schedules
  await client.callTool({
    name: 'cf_list_schedules',
    arguments: { status: 'active', pipeline_type: 'recipe_campaign' }
  });
  assert.ok(calls[0].path.startsWith('/api/v2/recipes/auto-pipeline-schedules?'));
  assert.ok(calls[0].path.includes('status=active'));
  assert.ok(calls[0].path.includes('pipeline_type=recipe_campaign'));

  // Create schedule
  await client.callTool({
    name: 'cf_create_schedule',
    arguments: {
      name: 'Resep Harian Pagi',
      pipeline_type: 'recipe_campaign',
      brand_id: 'brand-1',
      topic: 'Masakan Sehari-hari',
      generation_time: '06:00',
      publish_time: '10:00'
    }
  });
  assert.equal(calls[1].path, '/api/v2/recipes/auto-pipeline-schedules');
  assert.equal(calls[1].opts.body.name, 'Resep Harian Pagi');
  assert.equal(calls[1].opts.body.generation_time, '06:00');

  // Trigger schedule run-now
  await client.callTool({
    name: 'cf_trigger_schedule_now',
    arguments: { schedule_id: 'sched-456' }
  });
  assert.equal(calls[2].path, '/api/v2/recipes/auto-pipeline-schedules/sched-456/run-now');
});

test('legacy alias makna_create_campaign preserves backward compatibility', async t => {
  const calls = [];
  const client = await connected(t, async (...args) => {
    calls.push(args);
    return { success: true, job_id: 'job-1' };
  });

  const args = {
    idempotency_key: 'same-key',
    product_name: 'Coffee',
    product_description: 'Ground coffee',
    target_audience: 'Adults',
    content_goal: 'Awareness'
  };
  for (let i = 0; i < 2; i++) {
    await client.callTool({ name: 'makna_create_campaign', arguments: args });
  }
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls[0][1].key, 'same-key');
  assert.equal(calls[0][1].body.production.approval_mode, 'creative');
  assert.equal(calls[0][1].body.publishing.mode, 'draft_only');

  await client.callTool({ name: 'makna_get_campaign_status', arguments: { job_id: 'job-1' } });
  assert.equal(calls[2][0], '/api/operator/v1/content-jobs/job-1');
});

test('reject invalid arguments before contacting backend; propagate tool error', async t => {
  let calls = 0;
  const client = await connected(t, async () => {
    calls++;
    return { success: false, status: 403 };
  });

  assert.equal((await client.callTool({ name: 'cf_get_job_status', arguments: { job_id: '../other' } })).isError, true);
  assert.equal(calls, 0);

  // Invalid recipe category
  assert.equal((await client.callTool({ name: 'cf_create_recipe_video', arguments: { topic: 'Cake', category: 'invalid_cat' } })).isError, true);
  assert.equal(calls, 0);

  // Propagated error from backend
  assert.equal((await client.callTool({ name: 'cf_whoami' })).isError, true);
  assert.equal(calls, 1);
});

test('operator credentials stay server-side; HTTP failures never expose response secrets', async () => {
  const request = operatorClient({
    baseUrl: 'https://example.com',
    token: 'CF_STUDIO_SAMPLE_OPERATOR_TOKEN_123456',
    fetchImpl: async (url, options) => {
      assert.equal(url.pathname, '/api/operator/v1/whoami');
      assert.equal(options.headers.authorization, 'Bearer CF_STUDIO_SAMPLE_OPERATOR_TOKEN_123456');
      assert.equal(options.redirect, 'error');
      return new Response('private backend details', { status: 403 });
    }
  });
  assert.deepEqual(await request('/api/operator/v1/whoami'), {
    success: false,
    status: 403,
    error: 'Operator request rejected; check permissions, input, or job ID.'
  });
  assert.throws(() => operatorClient({ baseUrl: 'http://remote.example', token: 'CF_STUDIO_SAMPLE_OPERATOR_TOKEN_123456' }));
});

test('HTTP authentication, origin and host protection, real MCP handshake', async t => {
  const bearerToken = 'CF_STUDIO_SAMPLE_MCP_BEARER_TOKEN_32_CHARS_LONG';
  let calls = 0;
  const app = createHttpApp({ bearerToken, request: async () => { calls++; return { success: true }; } });
  const http = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.on('error', reject);
  });
  t.after(() => new Promise(resolve => {
    http.closeAllConnections();
    http.close(resolve);
  }));

  const url = new URL(`http://127.0.0.1:${http.address().port}/mcp`);
  assert.equal((await fetch(url, { method: 'POST' })).status, 401);
  assert.equal((await fetch(url, { method: 'POST', headers: { origin: 'https://untrusted.example' } })).status, 403);
  assert.equal(
    await new Promise((resolve, reject) => {
      const req = httpRequest(url, { headers: { host: 'untrusted.example' } }, res => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on('error', reject);
      req.end();
    }),
    403
  );
  assert.equal(calls, 0);

  const client = new Client({ name: 'http-test', version: '2' });
  t.after(() => client.close());
  await client.connect(
    new StreamableHTTPClientTransport(url, {
      requestInit: { headers: { authorization: `Bearer ${bearerToken}` } }
    })
  );
  assert.equal((await client.listTools()).tools.length, 19);
  assert.equal((await client.callTool({ name: 'cf_whoami' })).isError, undefined);
  assert.equal(calls, 1);
});
