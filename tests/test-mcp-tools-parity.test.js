process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createCfStudioServer, operatorClient } from '../apps/mcp/tools.mjs';
import { resolveImageBufferFromInput, detectImageMime } from '../lib/product-image-storage.js';

const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function setupTestMcpClient(handler) {
  const calls = [];
  const mockRequest = async (path, opts = {}) => {
    calls.push({ path, opts });
    return handler(path, opts);
  };
  const server = createCfStudioServer(mockRequest);
  const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    calls,
    close: async () => Promise.all([client.close(), server.close()])
  };
}

test('1. operatorClient propagates structured backend errors and supports FormData', async () => {
  const seen = [];
  const mockFetch = async (url, init) => {
    seen.push({ url: String(url), method: init.method, headers: init.headers, body: init.body });
    if (String(url).includes('/fail-endpoint')) {
      return new Response(JSON.stringify({
        success: false,
        code: 'REPLIZ_ACCOUNT_DISCONNECTED',
        error: 'Akun terputus',
        reconnectUrl: 'https://repliz.com/user/account'
      }), { status: 409, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ success: true, ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };

  const client = operatorClient({
    baseUrl: 'http://127.0.0.1:5010',
    token: 'TEST_MOCK_OPERATOR_TOKEN_PARITY',
    fetchImpl: mockFetch
  });

  const errRes = await client('/fail-endpoint', { body: { test: 1 }, key: 'idem-1' });
  assert.equal(errRes.success, false);
  assert.equal(errRes.status, 409);
  assert.equal(errRes.code, 'REPLIZ_ACCOUNT_DISCONNECTED');
  assert.equal(errRes.error, 'Akun terputus');
  assert.equal(errRes.reconnectUrl, 'https://repliz.com/user/account');
  assert.equal(seen[0].headers['content-type'], 'application/json');
  assert.equal(seen[0].headers['idempotency-key'], 'idem-1');

  const form = new FormData();
  form.set('productId', 'prd_1');
  const okRes = await client('/api/v2/products/image', { body: form });
  assert.equal(okRes.success, true);
  assert.equal(seen[1].headers['content-type'], undefined);
  assert.ok(seen[1].body instanceof FormData);
});

test('2. MCP server exposes new cf_* parity tools without unnecessary makna_* duplicates', async () => {
  const { client, close } = await setupTestMcpClient(async () => ({ success: true }));
  try {
    const { tools } = await client.listTools();
    const names = new Set(tools.map(t => t.name));

    const expectedNewTools = [
      'cf_upload_product_photo',
      'cf_regenerate_product_photo',
      'cf_preview_multiplier_angles',
      'cf_get_pipeline_queue',
      'cf_cancel_pipeline_job',
      'cf_get_storyboard_status',
      'cf_approve_storyboard',
      'cf_publish_storyboard',
      'cf_retry_publishing_job',
      'cf_cancel_publishing_job',
      'cf_list_brand_profiles',
      'cf_get_brand_profile',
      'cf_create_brand_profile',
      'cf_update_brand_profile',
      'cf_list_content_flow',
      'cf_sync_content_flow',
      'cf_list_threads_series',
      'cf_create_threads_series',
      'cf_get_deconstruct_status',
      'cf_list_multiplier_tasks',
      'cf_retry_multiplier_task'
    ];

    for (const toolName of expectedNewTools) {
      assert.ok(names.has(toolName), `Expected tool ${toolName} to be registered`);
    }
    assert.equal(names.has('makna_upload_product_photo'), false);
    assert.equal(names.has('makna_publish_storyboard'), false);
  } finally {
    await close();
  }
});

test('3. Product photo + Product video + Multiplier+Product + Schedule batch parity calls', async () => {
  const { client, calls, close } = await setupTestMcpClient(async () => ({
    success: true,
    angles: [{ title: 'Angle 1', hook_text: 'Hook 1', vo_preview: 'VO 1' }]
  }));
  try {
    await client.callTool({
      name: 'cf_add_product',
      arguments: {
        product_name: 'Matcha Ceremonial',
        photo_base64: TINY_PNG_BASE64,
        photo_filename: 'matcha.png',
        auto_enrich_clean_photo: true
      }
    });
    assert.equal(calls.at(-1).path, '/api/v2/products');
    assert.equal(calls.at(-1).opts.body.photo_base64, TINY_PNG_BASE64);
    assert.equal(calls.at(-1).opts.body.auto_enrich_clean_photo, true);

    await client.callTool({
      name: 'cf_create_multiplier_video',
      arguments: {
        deconstruct_asset_id: 'bp_001',
        product_id: 'prd_001',
        bridging_mode: 'product_aware_angle',
        selected_angle: { title: 'Angle A', hook_text: 'Hook A' },
        visual_identity_preset_id: 'vi_123'
      }
    });
    assert.equal(calls.at(-1).path, '/api/v2/recipes/autonomous-pipeline');
    assert.equal(calls.at(-1).opts.body.pipeline_type, 'multiplier_campaign');
    assert.equal(calls.at(-1).opts.body.bridging_mode, 'product_aware_angle');
    assert.deepEqual(calls.at(-1).opts.body.selected_angle, { title: 'Angle A', hook_text: 'Hook A' });

    await client.callTool({
      name: 'cf_create_schedule',
      arguments: {
        name: 'Multiplier Matcha',
        brand_id: 'bp_1',
        pipeline_type: 'multiplier_campaign',
        pairing_mode: 'rotating_products',
        blueprint_ids: ['bp_a', 'bp_b', 'bp_c'],
        product_ids: ['prd_1', 'prd_2'],
        schedule_mode: 'specific_date',
        target_date: '2026-11-20',
        recipe_detail_in_caption: true
      }
    });
    const batchBody = calls.at(-1).opts.body;
    assert.equal(calls.at(-1).path, '/api/v2/recipes/auto-pipeline-schedules');
    assert.equal(batchBody.items.length, 3);
    assert.equal(batchBody.items[0].pipeline_config_json.product_id, 'prd_1');
    assert.equal(batchBody.items[1].pipeline_config_json.product_id, 'prd_2');
    assert.equal(batchBody.items[2].pipeline_config_json.product_id, 'prd_1');
    assert.equal(batchBody.items[0].target_date, '2026-11-20');
  } finally {
    await close();
  }
});

test('4. Custom Storyboard status, approve & Repliz publish auto-lookup flow', async () => {
  let synced = false;
  const { client, calls, close } = await setupTestMcpClient(async (path, opts) => {
    if (path.startsWith('/api/v2/pillar-campaigns/cst_test1')) {
      return {
        success: true,
        campaign: {
          id: 'cst_test1',
          campaign_name: '[Custom Storyboard] Matcha',
          status: 'running',
          auto_sync_contentflow: 1
        },
        items: [{
          id: 901,
          workflow_status: 'completed',
          ffmpeg_status: 'completed',
          ffmpeg_output_path: '/temp/final_901.mp4',
          review_revision: 'rev_2',
          new_video_plan_json: '[{"clip_index":1,"new_vo":"Halo"}]',
          video_dna_json: '{"aspect_ratio":"9:16"}'
        }]
      };
    }
    if (path.startsWith('/api/content-flow?q=opc_901')) {
      return { success: true, items: [] };
    }
    if (path === '/api/content-flow/sync') {
      synced = true;
      return { success: true };
    }
    if (path === '/api/content-flow/opc_901') {
      if (!synced) return { success: false, status: 404, error: 'Content not found' };
      return {
        success: true,
        item: {
          id: 'opc_901',
          url_asset: '/temp/final_901.mp4',
          hook: 'Hook Final',
          caption: 'Caption Final'
        }
      };
    }
    if (path === '/api/v2/publishing/jobs') {
      return { success: true, scheduled: opts.body.account_ids.length };
    }
    return { success: true };
  });

  try {
    await client.callTool({
      name: 'cf_approve_storyboard',
      arguments: { campaign_id: 'cst_test1' }
    });
    const approveCall = calls.find(c => c.path === '/api/v2/pillar-campaigns/items/901/approve');
    assert.ok(approveCall);
    assert.equal(approveCall.opts.body.review_revision, 'rev_2');

    await client.callTool({
      name: 'cf_publish_storyboard',
      arguments: {
        campaign_id: 'cst_test1',
        account_ids: ['acc_ig_1', 'acc_tt_1'],
        scheduled_at: '2026-11-20T09:00:00+07:00'
      }
    });
    const syncCall = calls.find(c => c.path === '/api/content-flow/sync');
    assert.ok(syncCall, 'Expected auto sync trigger when ContentFlow item not yet present');
    const pubCall = calls.find(c => c.path === '/api/v2/publishing/jobs');
    assert.ok(pubCall);
    assert.equal(pubCall.opts.body.content_id, 'opc_901');
    assert.equal(pubCall.opts.body.media_url, '/temp/final_901.mp4');
    assert.deepEqual(pubCall.opts.body.account_ids, ['acc_ig_1', 'acc_tt_1']);
  } finally {
    await close();
  }
});

test('5. resolveImageBufferFromInput decodes data-URI PNG safely', async () => {
  const { buffer, filename } = await resolveImageBufferFromInput({
    photoBase64: `data:image/png;base64,${TINY_PNG_BASE64}`,
    filename: 'sample'
  });
  assert.equal(detectImageMime(buffer), 'image/png');
  assert.equal(filename, 'sample.png');
});
