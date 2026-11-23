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

test('6. cf_submit_custom_storyboard accepts preset_key alone without requiring manual video_dna or auto_sync override', async () => {
  const { client, calls, close } = await setupTestMcpClient(async () => ({ success: true, campaign_id: 'cst_preset_1' }));
  try {
    await client.callTool({
      name: 'cf_submit_custom_storyboard',
      arguments: {
        preset_key: 'multiplier_nutribake_produk',
        product_id: 'prd_123',
        title: 'Single Preset Storyboard',
        scenes: [
          {
            scene_index: 1,
            voiceover_text: 'Bosan camilan manis yang bikin bersalah?',
            visual_prompt: 'Close up ripe bananas on ceramic plate --ar 9:16'
          }
        ]
      }
    });

    const singleCall = calls[0];
    assert.equal(singleCall.path, '/api/v2/recipes/autonomous-pipeline');
    assert.equal(singleCall.opts.body.pipeline_type, 'custom_storyboard');
    assert.equal(singleCall.opts.body.storyboard.preset_key, 'multiplier_nutribake_produk');
    assert.equal(singleCall.opts.body.storyboard.product_id, 'prd_123');
    assert.equal(singleCall.opts.body.storyboard.video_dna, undefined);
    assert.equal(singleCall.opts.body.storyboard.auto_sync_contentflow, undefined);

    await client.callTool({
      name: 'cf_submit_custom_storyboard',
      arguments: {
        preset_key: 'nutribake_kampanye_produk_02',
        brand_id: 'brd_1',
        items: [
          {
            title: 'Batch Item 1',
            scenes: [
              {
                scene_index: 1,
                voiceover_text: 'Scene 1 text',
                visual_prompt: 'Scene 1 visual'
              }
            ]
          }
        ]
      }
    });

    const batchCall = calls[1];
    assert.equal(batchCall.opts.body.pipeline_type, 'custom_storyboard');
    assert.equal(batchCall.opts.body.preset_key, 'nutribake_kampanye_produk_02');
    assert.equal(batchCall.opts.body.brand_id, 'brd_1');
    assert.equal(batchCall.opts.body.items.length, 1);
  } finally {
    await close();
  }
});

test('7. cf_start_deconstruct: pre-flight status check, batching, deduplication, error handling, and schema validation', async () => {
  // Case 1: All IDs have status "saved" -> process called once with all IDs, batch_id forwarded
  {
    const { client, calls, close } = await setupTestMcpClient(async (path) => {
      if (path.startsWith('/api/v2/deconstruct/assets/')) {
        return { success: true, asset: { id: path.split('/').pop(), status: 'saved' } };
      }
      if (path === '/api/v2/deconstruct/scheduler-control') {
        return { success: true, isSchedulerActive: true };
      }
      if (path === '/api/v2/deconstruct/process') {
        return { success: true, batch_id: 'batch_all_saved', enqueued_count: 2 };
      }
      return { success: true };
    });
    try {
      const res = await client.callTool({
        name: 'cf_start_deconstruct',
        arguments: { asset_ids: ['dec_1', 'dec_2'] }
      });
      assert.equal(res.isError, undefined);
      assert.equal(res.structuredContent.success, true);
      assert.equal(res.structuredContent.batch_id, 'batch_all_saved');
      assert.equal(res.structuredContent.enqueued_count, 2);
      assert.deepEqual(res.structuredContent.enqueued_ids, ['dec_1', 'dec_2']);
      assert.deepEqual(res.structuredContent.skipped, []);
      assert.deepEqual(res.structuredContent.not_found, []);
      assert.deepEqual(res.structuredContent.warnings, []);
      assert.match(res.structuredContent.next_step, /cf_get_deconstruct_status/);
      const processCalls = calls.filter(c => c.path === '/api/v2/deconstruct/process');
      assert.equal(processCalls.length, 1);
      assert.deepEqual(processCalls[0].opts.body.asset_ids, ['dec_1', 'dec_2']);
    } finally {
      await close();
    }
  }

  // Case 2: Mixed saved/failed/analyzing/deconstructed -> only saved+failed sent, rest in skipped with status
  {
    const statuses = {
      a_saved: 'saved',
      a_failed: 'failed',
      a_analyzing: 'analyzing',
      a_done: 'deconstructed'
    };
    const { client, calls, close } = await setupTestMcpClient(async (path) => {
      if (path.startsWith('/api/v2/deconstruct/assets/')) {
        const id = path.split('/').pop();
        return { success: true, asset: { id, status: statuses[id] } };
      }
      if (path === '/api/v2/deconstruct/scheduler-control') {
        return { success: true, isSchedulerActive: true };
      }
      if (path === '/api/v2/deconstruct/process') {
        return { success: true, batch_id: 'batch_mixed' };
      }
      return { success: true };
    });
    try {
      const res = await client.callTool({
        name: 'cf_start_deconstruct',
        arguments: { asset_ids: ['a_saved', 'a_analyzing', 'a_failed', 'a_done'] }
      });
      assert.equal(res.structuredContent.batch_id, 'batch_mixed');
      assert.equal(res.structuredContent.enqueued_count, 2);
      assert.deepEqual(res.structuredContent.enqueued_ids, ['a_saved', 'a_failed']);
      assert.deepEqual(res.structuredContent.skipped, [
        { id: 'a_analyzing', status: 'analyzing' },
        { id: 'a_done', status: 'deconstructed' }
      ]);
      const processCalls = calls.filter(c => c.path === '/api/v2/deconstruct/process');
      assert.equal(processCalls.length, 1);
      assert.deepEqual(processCalls[0].opts.body.asset_ids, ['a_saved', 'a_failed']);
    } finally {
      await close();
    }
  }

  // Case 3: None eligible -> process NOT called, enqueued_count: 0, batch_id: null
  {
    const { client, calls, close } = await setupTestMcpClient(async (path) => {
      if (path.startsWith('/api/v2/deconstruct/assets/')) {
        return { success: true, asset: { id: path.split('/').pop(), status: 'deconstructed' } };
      }
      if (path === '/api/v2/deconstruct/scheduler-control') {
        return { success: true, isSchedulerActive: true };
      }
      return { success: true };
    });
    try {
      const res = await client.callTool({
        name: 'cf_start_deconstruct',
        arguments: { asset_ids: ['done_1', 'done_2'] }
      });
      assert.equal(res.isError, undefined);
      assert.equal(res.structuredContent.success, true);
      assert.equal(res.structuredContent.batch_id, null);
      assert.equal(res.structuredContent.enqueued_count, 0);
      assert.deepEqual(res.structuredContent.enqueued_ids, []);
      assert.deepEqual(res.structuredContent.skipped, [
        { id: 'done_1', status: 'deconstructed' },
        { id: 'done_2', status: 'deconstructed' }
      ]);
      assert.equal(calls.some(c => c.path === '/api/v2/deconstruct/process'), false);
    } finally {
      await close();
    }
  }

  // Case 4: 404 ID -> added to not_found, other eligible IDs still processed
  {
    const { client, calls, close } = await setupTestMcpClient(async (path) => {
      if (path === '/api/v2/deconstruct/assets/missing_id') {
        return { success: false, status: 404, error: 'Aset tidak ditemukan' };
      }
      if (path.startsWith('/api/v2/deconstruct/assets/')) {
        return { success: true, asset: { id: 'valid_id', status: 'saved' } };
      }
      if (path === '/api/v2/deconstruct/scheduler-control') {
        return { success: true, isSchedulerActive: true };
      }
      if (path === '/api/v2/deconstruct/process') {
        return { success: true, batch_id: 'batch_partial_404' };
      }
      return { success: true };
    });
    try {
      const res = await client.callTool({
        name: 'cf_start_deconstruct',
        arguments: { asset_ids: ['missing_id', 'valid_id'] }
      });
      assert.equal(res.structuredContent.batch_id, 'batch_partial_404');
      assert.equal(res.structuredContent.enqueued_count, 1);
      assert.deepEqual(res.structuredContent.enqueued_ids, ['valid_id']);
      assert.deepEqual(res.structuredContent.not_found, ['missing_id']);
      const processCalls = calls.filter(c => c.path === '/api/v2/deconstruct/process');
      assert.equal(processCalls.length, 1);
      assert.deepEqual(processCalls[0].opts.body.asset_ids, ['valid_id']);
    } finally {
      await close();
    }
  }

  // Case 5: 401/500 error while reading asset -> tool stops and returns error, process NOT called
  for (const statusCode of [401, 500]) {
    const { client, calls, close } = await setupTestMcpClient(async (path) => {
      if (path.startsWith('/api/v2/deconstruct/assets/')) {
        return { success: false, status: statusCode, error: `HTTP ${statusCode} failure` };
      }
      return { success: true };
    });
    try {
      const res = await client.callTool({
        name: 'cf_start_deconstruct',
        arguments: { asset_ids: ['dec_1', 'dec_2'] }
      });
      assert.equal(res.isError, true);
      assert.equal(res.structuredContent.success, false);
      assert.equal(res.structuredContent.status, statusCode);
      assert.equal(calls.length, 1);
      assert.equal(calls.some(c => c.path === '/api/v2/deconstruct/process'), false);
    } finally {
      await close();
    }
  }

  // Case 6: isSchedulerActive: false -> warnings populated, process still runs
  {
    const { client, calls, close } = await setupTestMcpClient(async (path) => {
      if (path.startsWith('/api/v2/deconstruct/assets/')) {
        return { success: true, asset: { id: 'dec_1', status: 'saved' } };
      }
      if (path === '/api/v2/deconstruct/scheduler-control') {
        return { success: true, isSchedulerActive: false };
      }
      if (path === '/api/v2/deconstruct/process') {
        return { success: true, batch_id: 'batch_sched_off' };
      }
      return { success: true };
    });
    try {
      const res = await client.callTool({
        name: 'cf_start_deconstruct',
        arguments: { asset_ids: ['dec_1'] }
      });
      assert.equal(res.structuredContent.batch_id, 'batch_sched_off');
      assert.equal(res.structuredContent.warnings.length, 1);
      assert.match(res.structuredContent.warnings[0], /inactive/i);
      assert.equal(calls.some(c => c.path === '/api/v2/deconstruct/process'), true);
    } finally {
      await close();
    }
  }

  // Case 7: Duplicate IDs in input are checked and sent only once
  {
    const { client, calls, close } = await setupTestMcpClient(async (path) => {
      if (path.startsWith('/api/v2/deconstruct/assets/')) {
        return { success: true, asset: { id: 'dup_1', status: 'saved' } };
      }
      if (path === '/api/v2/deconstruct/scheduler-control') {
        return { success: true, isSchedulerActive: true };
      }
      if (path === '/api/v2/deconstruct/process') {
        return { success: true, batch_id: 'batch_dedup' };
      }
      return { success: true };
    });
    try {
      const res = await client.callTool({
        name: 'cf_start_deconstruct',
        arguments: { asset_ids: ['dup_1', 'dup_1', 'dup_1'] }
      });
      assert.equal(res.structuredContent.enqueued_count, 1);
      assert.deepEqual(res.structuredContent.enqueued_ids, ['dup_1']);
      const assetGets = calls.filter(c => c.path.startsWith('/api/v2/deconstruct/assets/'));
      assert.equal(assetGets.length, 1);
      const processCall = calls.find(c => c.path === '/api/v2/deconstruct/process');
      assert.deepEqual(processCall.opts.body.asset_ids, ['dup_1']);
    } finally {
      await close();
    }
  }

  // Case 8 & 9: Schema rejects empty list, >50 IDs, blank ID; registered with readOnlyHint: false
  {
    const { client, calls, close } = await setupTestMcpClient(async () => ({ success: true }));
    try {
      const { tools } = await client.listTools();
      const tool = tools.find(t => t.name === 'cf_start_deconstruct');
      assert.ok(tool, 'cf_start_deconstruct must be registered');
      assert.equal(tool.annotations?.readOnlyHint, false);

      const emptyRes = await client.callTool({
        name: 'cf_start_deconstruct',
        arguments: { asset_ids: [] }
      });
      assert.equal(emptyRes.isError, true);

      const tooManyRes = await client.callTool({
        name: 'cf_start_deconstruct',
        arguments: { asset_ids: Array.from({ length: 51 }, (_, i) => `id_${i}`) }
      });
      assert.equal(tooManyRes.isError, true);

      const blankIdRes = await client.callTool({
        name: 'cf_start_deconstruct',
        arguments: { asset_ids: ['   '] }
      });
      assert.equal(blankIdRes.isError, true);

      assert.equal(calls.length, 0);
    } finally {
      await close();
    }
  }

  // Case 10: process fails (success: false) -> error propagated, not hidden
  {
    const { client, close } = await setupTestMcpClient(async (path) => {
      if (path.startsWith('/api/v2/deconstruct/assets/')) {
        return { success: true, asset: { id: 'dec_1', status: 'saved' } };
      }
      if (path === '/api/v2/deconstruct/scheduler-control') {
        return { success: true, isSchedulerActive: true };
      }
      if (path === '/api/v2/deconstruct/process') {
        return { success: false, status: 500, error: 'Database queue error' };
      }
      return { success: true };
    });
    try {
      const res = await client.callTool({
        name: 'cf_start_deconstruct',
        arguments: { asset_ids: ['dec_1'] }
      });
      assert.equal(res.isError, true);
      assert.equal(res.structuredContent.success, false);
      assert.equal(res.structuredContent.error, 'Database queue error');
    } finally {
      await close();
    }
  }
});
