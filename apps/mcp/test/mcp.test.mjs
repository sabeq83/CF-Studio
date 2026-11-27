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

test('discovery of all CF Studio tools across 7 studio pillars and legacy aliases', async t => {
  const client = await connected(t, async () => ({ success: true }));
  const tools = (await client.listTools()).tools;
  assert.ok(tools.length >= 61);

  const toolNames = new Set(tools.map(x => x.name));
  assert.ok(toolNames.has('cf_cancel_storyboard'));
  // 6 Auto Pipeline dedicated tools
  assert.ok(toolNames.has('cf_create_product_video'));
  assert.ok(toolNames.has('cf_create_editorial_video'));
  assert.ok(toolNames.has('cf_create_recipe_video'));
  assert.ok(toolNames.has('cf_create_multiplier_video'));
  assert.ok(toolNames.has('cf_create_recipe_labs_post'));
  assert.ok(toolNames.has('cf_submit_custom_storyboard'));
  assert.ok(toolNames.has('cf_run_auto_pipeline'));

  // Recipe Importer & Curated Library
  assert.ok(toolNames.has('cf_import_recipe_batch'));
  assert.ok(toolNames.has('cf_list_curated_recipes'));

  // Schedule management tools
  assert.ok(toolNames.has('cf_list_schedules'));
  assert.ok(toolNames.has('cf_create_schedule'));
  assert.ok(toolNames.has('cf_update_schedule'));
  assert.ok(toolNames.has('cf_toggle_schedule_pause'));
  assert.ok(toolNames.has('cf_delete_schedule'));
  assert.ok(toolNames.has('cf_trigger_schedule_now'));

  // Discovery & status
  assert.ok(toolNames.has('cf_whoami'));
  assert.ok(toolNames.has('cf_list_presets'));
  assert.ok(toolNames.has('cf_search_catalog'));
  assert.ok(toolNames.has('cf_get_job_status'));

  // Pilar 1: Product Database
  assert.ok(toolNames.has('cf_add_product'));
  assert.ok(toolNames.has('cf_enrich_product'));
  assert.ok(toolNames.has('cf_get_product_detail'));
  assert.ok(toolNames.has('cf_update_product'));
  assert.ok(toolNames.has('cf_scrape_product_url'));

  // Pilar 2: Visual Identity Studio
  assert.ok(toolNames.has('cf_generate_visual_identity'));
  assert.ok(toolNames.has('cf_create_visual_identity'));
  assert.ok(toolNames.has('cf_list_visual_identities'));
  assert.ok(toolNames.has('cf_get_visual_identity'));
  assert.ok(toolNames.has('cf_update_visual_identity'));

  // Pilar 3: Strategy Presets
  assert.ok(toolNames.has('cf_get_preset_detail'));
  assert.ok(toolNames.has('cf_create_preset'));
  assert.ok(toolNames.has('cf_clone_preset'));
  assert.ok(toolNames.has('cf_update_preset'));

  // Pilar 4: Viral Deconstruction
  assert.ok(toolNames.has('cf_ingest_viral_video'));
  assert.ok(toolNames.has('cf_start_deconstruct'));
  assert.ok(toolNames.has('cf_list_deconstructed_assets'));
  assert.ok(toolNames.has('cf_search_blueprints'));
  assert.ok(toolNames.has('cf_get_deconstructed_blueprint'));

  // Pilar 5: Creative Review
  assert.ok(toolNames.has('cf_get_job_review'));
  assert.ok(toolNames.has('cf_approve_job'));

  // Pilar 6: Omnichannel Publishing
  assert.ok(toolNames.has('cf_list_publishing_accounts'));
  assert.ok(toolNames.has('cf_create_publishing_job'));
  assert.ok(toolNames.has('cf_list_publishing_jobs'));

  // Pilar 7: Cluster Observability & Stats
  assert.ok(toolNames.has('cf_get_cluster_health'));
  assert.ok(toolNames.has('cf_get_studio_stats'));

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
      topic: 'Crispy Honey Garlic Air Fryer Chicken Bites',
      target_language: 'en_US',
      recipe_classification: 'Main Courses & Entrees',
      aspect_ratio: '3:4',
      visual_style: 'Modern Minimalist Nordic Studio',
      images_per_recipe: 4,
      selected_layout_id: '4_editorial_split',
      post_to_facebook: true,
      idempotency_key: 'key-labs-1'
    }
  });
  assert.equal(calls[4].opts.body.pipeline_type, 'recipe_labs');
  assert.equal(calls[4].opts.body.topic, 'Crispy Honey Garlic Air Fryer Chicken Bites');
  assert.equal(calls[4].opts.body.aspect_ratio, '3:4');
  assert.equal(calls[4].opts.body.visual_style, 'Modern Minimalist Nordic Studio');
  assert.equal(calls[4].opts.body.target_language, 'en_US');
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

  // List schedules (including publish_date filter)
  await client.callTool({
    name: 'cf_list_schedules',
    arguments: { status: 'active', pipeline_type: 'recipe_campaign', publish_date: '2026-11-26' }
  });
  assert.ok(calls[0].path.startsWith('/api/v2/recipes/auto-pipeline-schedules?'));
  assert.ok(calls[0].path.includes('status=active'));
  assert.ok(calls[0].path.includes('pipeline_type=recipe_campaign'));
  assert.ok(calls[0].path.includes('publish_date=2026-11-26'));

  // Create schedule with full publish accounts, recipe toggle, Shopee affiliate link, blueprint, and split production/publish dates
  await client.callTool({
    name: 'cf_create_schedule',
    arguments: {
      name: 'Resep Harian Pagi',
      pipeline_type: 'recipe_campaign',
      brand_id: 'brand-1',
      topic: 'Masakan Sehari-hari',
      generation_date: '2026-11-25',
      generation_time: '15:00',
      publish_date: '2026-11-26',
      publish_time: '07:15',
      publish_day_offset: 0,
      repliz_account_ids: ['acc_fb_1', 'acc_ig_1'],
      generate_recipe: true,
      post_link_affiliate: true,
      blueprint_id: 'bp-uuid-12345',
      execution_mode: 'full_autopilot'
    }
  });
  assert.equal(calls[1].path, '/api/v2/recipes/auto-pipeline-schedules');
  assert.equal(calls[1].opts.body.name, 'Resep Harian Pagi');
  assert.equal(calls[1].opts.body.schedule_mode, 'specific_date');
  assert.equal(calls[1].opts.body.target_date, '2026-11-25');
  assert.equal(calls[1].opts.body.publish_date, '2026-11-26');
  assert.equal(calls[1].opts.body.publish_day_offset, 0);
  assert.equal(calls[1].opts.body.generation_time, '15:00');
  assert.equal(calls[1].opts.body.publish_time, '07:15');
  assert.deepEqual(calls[1].opts.body.repliz_account_ids, ['acc_fb_1', 'acc_ig_1']);
  assert.equal(calls[1].opts.body.pipeline_config_json.generate_recipe, true);
  assert.equal(calls[1].opts.body.pipeline_config_json.post_link_affiliate, true);
  assert.equal(calls[1].opts.body.pipeline_config_json.blueprint_id, 'bp-uuid-12345');
  assert.equal(calls[1].opts.body.pipeline_config_json.execution_mode, 'full_autopilot');

  // Update schedule (including publish_day_offset)
  await client.callTool({
    name: 'cf_update_schedule',
    arguments: {
      schedule_id: 'sched-456',
      name: 'Resep Harian Update',
      generation_time: '20:00',
      publish_time: '06:15',
      publish_day_offset: 1,
      repliz_account_ids: ['acc_fb_updated'],
      generate_recipe: false
    }
  });
  assert.equal(calls[2].path, '/api/v2/recipes/auto-pipeline-schedules/sched-456');
  assert.equal(calls[2].opts.method, 'PUT');
  assert.equal(calls[2].opts.body.name, 'Resep Harian Update');
  assert.equal(calls[2].opts.body.publish_day_offset, 1);
  assert.deepEqual(calls[2].opts.body.repliz_account_ids, ['acc_fb_updated']);
  assert.equal(calls[2].opts.body.pipeline_config_json.generate_recipe, false);

  // Toggle pause schedule
  await client.callTool({
    name: 'cf_toggle_schedule_pause',
    arguments: { schedule_id: 'sched-456' }
  });
  assert.equal(calls[3].path, '/api/v2/recipes/auto-pipeline-schedules/sched-456');
  assert.equal(calls[3].opts.method, 'PUT');
  assert.equal(calls[3].opts.body.action, 'toggle_pause');

  // Delete schedule
  await client.callTool({
    name: 'cf_delete_schedule',
    arguments: { schedule_id: 'sched-456' }
  });
  assert.equal(calls[4].path, '/api/v2/recipes/auto-pipeline-schedules/sched-456');
  assert.equal(calls[4].opts.method, 'DELETE');

  // Trigger schedule run-now
  await client.callTool({
    name: 'cf_trigger_schedule_now',
    arguments: { schedule_id: 'sched-456' }
  });
  assert.equal(calls[5].path, '/api/v2/recipes/auto-pipeline-schedules/sched-456/run-now');

  // Search blueprints
  await client.callTool({
    name: 'cf_search_blueprints',
    arguments: { query: 'https://www.facebook.com/reel/123456789' }
  });
  assert.ok(calls[6].path.startsWith('/api/v2/deconstruct?assets=true&q=https%3A%2F%2Fwww.facebook.com%2Freel%2F123456789'));
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

test('product database tools dispatch to /api/v2/products (Pilar 1)', async t => {
  const calls = [];
  const client = await connected(t, async (path, opts) => {
    calls.push({ path, opts });
    return { success: true, id: 'pe-123', data: { id: 'pe-123' } };
  });

  // 1. Add product
  await client.callTool({
    name: 'cf_add_product',
    arguments: {
      product_name: 'Madu Hutan Sumbawa',
      category: 'Madu',
      unique_selling_point: 'Madu murni dari lebah liar',
      tags: 'madu,alami'
    }
  });
  assert.equal(calls[0].path, '/api/v2/products');
  assert.equal(calls[0].opts.body.product_name, 'Madu Hutan Sumbawa');

  // 2. Enrich product
  await client.callTool({
    name: 'cf_enrich_product',
    arguments: { product_id: 'pe-123' }
  });
  assert.equal(calls[1].path, '/api/v2/products/re-enrich');
  assert.deepEqual(calls[1].opts.body.ids, ['pe-123']);

  // 3. Get product detail
  await client.callTool({
    name: 'cf_get_product_detail',
    arguments: { product_id: 'pe-123' }
  });
  assert.equal(calls[2].path, '/api/v2/products/pe-123');

  // 4. Update product
  await client.callTool({
    name: 'cf_update_product',
    arguments: { product_id: 'pe-123', updates: { category: 'Madu Organik' } }
  });
  assert.equal(calls[3].path, '/api/v2/products/pe-123');
  assert.equal(calls[3].opts.method, 'PUT');
  assert.equal(calls[3].opts.body.category, 'Madu Organik');

  // 5. Scrape product URL
  await client.callTool({
    name: 'cf_scrape_product_url',
    arguments: { url: 'https://shopee.co.id/product/123/456', category: 'Herbal' }
  });
  assert.equal(calls[4].path, '/api/v2/products/scrape');
  assert.equal(calls[4].opts.body.urls, 'https://shopee.co.id/product/123/456');
});

test('visual identity tools dispatch to /api/v2/visual-identities (Pilar 2)', async t => {
  const calls = [];
  const client = await connected(t, async (path, opts) => {
    calls.push({ path, opts });
    return { success: true, id: 'vi-789' };
  });

  // 1. Generate AI draft
  await client.callTool({
    name: 'cf_generate_visual_identity',
    arguments: { seed: 'Cozy rustic kitchen faceless muslimah', visual_style: '3d_claymation_cozy' }
  });
  assert.equal(calls[0].path, '/api/v2/visual-identities/ai/generate');
  assert.equal(calls[0].opts.body.seed, 'Cozy rustic kitchen faceless muslimah');

  // 2. Create structured visual identity
  await client.callTool({
    name: 'cf_create_visual_identity',
    arguments: { label: 'Cozy Sage Kitchen', preset_key: 'cozy_sage_kitchen', config: { faceless_mode: 'hands_only' } }
  });
  assert.equal(calls[1].path, '/api/v2/visual-identities');
  assert.equal(calls[1].opts.body.label, 'Cozy Sage Kitchen');

  // 3. List visual identities
  await client.callTool({
    name: 'cf_list_visual_identities',
    arguments: { status: 'active' }
  });
  assert.ok(calls[2].path.startsWith('/api/v2/visual-identities?'));
  assert.ok(calls[2].path.includes('status=active'));

  // 4. Get visual identity detail
  await client.callTool({
    name: 'cf_get_visual_identity',
    arguments: { id_or_key: 'cozy_sage_kitchen' }
  });
  assert.equal(calls[3].path, '/api/v2/visual-identities/cozy_sage_kitchen');

  // 5. Update visual identity
  await client.callTool({
    name: 'cf_update_visual_identity',
    arguments: { id: 'vi-789', label: 'Updated Label' }
  });
  assert.equal(calls[4].path, '/api/v2/visual-identities/vi-789');
  assert.equal(calls[4].opts.method, 'PUT');
});

test('strategy preset tools dispatch to /api/v2/operator-presets (Pilar 3)', async t => {
  const calls = [];
  const client = await connected(t, async (path, opts) => {
    calls.push({ path, opts });
    if (path.includes('source_preset')) {
      return { success: true, preset: { label: 'Source', basic_strategy: { narrative_mode: 'Storytelling' } } };
    }
    return { success: true, key: 'custom_preset' };
  });

  // 1. Get preset detail
  await client.callTool({
    name: 'cf_get_preset_detail',
    arguments: { preset_key: 'habitfolk_6clips_quick' }
  });
  assert.equal(calls[0].path, '/api/v2/operator-presets/habitfolk_6clips_quick');

  // 2. Create preset
  await client.callTool({
    name: 'cf_create_preset',
    arguments: { key: 'skincare_fast_pacing', label: 'Skincare Fast Pacing', config: { clip_duration: 5 } }
  });
  assert.equal(calls[1].path, '/api/v2/operator-presets');
  assert.equal(calls[1].opts.body.key, 'skincare_fast_pacing');

  // 3. Clone preset
  await client.callTool({
    name: 'cf_clone_preset',
    arguments: {
      source_key: 'source_preset',
      new_key: 'cloned_preset',
      new_label: 'Cloned Preset',
      overrides: { clip_duration: 6 }
    }
  });
  assert.equal(calls[2].path, '/api/v2/operator-presets/source_preset');
  assert.equal(calls[3].path, '/api/v2/operator-presets');
  assert.equal(calls[3].opts.body.key, 'cloned_preset');
  assert.equal(calls[3].opts.body.config.clip_duration, 6);

  // 4. Update preset
  await client.callTool({
    name: 'cf_update_preset',
    arguments: { key: 'custom_preset', config: { clip_duration: 8 } }
  });
  assert.equal(calls[4].path, '/api/v2/operator-presets/custom_preset');
  assert.equal(calls[4].opts.method, 'PUT');
});

test('viral deconstruction, review, publishing, and observability tools (Pilar 4, 5, 6, 7)', async t => {
  const calls = [];
  const client = await connected(t, async (path, opts) => {
    calls.push({ path, opts });
    return { success: true, result: 'ok' };
  });

  // Pilar 4: Ingest viral video
  await client.callTool({
    name: 'cf_ingest_viral_video',
    arguments: { url: 'https://www.tiktok.com/@user/video/1234567890', niche: 'Kuliner' }
  });
  assert.equal(calls[0].path, '/api/v2/deconstruct');
  assert.equal(calls[0].opts.body.urls, 'https://www.tiktok.com/@user/video/1234567890');

  // Pilar 4: List deconstructed assets
  await client.callTool({
    name: 'cf_list_deconstructed_assets',
    arguments: { niche: 'Kuliner', limit: 10 }
  });
  assert.ok(calls[1].path.startsWith('/api/v2/deconstruct?assets=true&'));
  assert.ok(calls[1].path.includes('niche=Kuliner'));

  // Pilar 4: Get deconstructed blueprint
  await client.callTool({
    name: 'cf_get_deconstructed_blueprint',
    arguments: { asset_id: 'asset-999' }
  });
  assert.equal(calls[2].path, '/api/v2/deconstruct/assets/asset-999');

  // Pilar 5: Get job review
  await client.callTool({
    name: 'cf_get_job_review',
    arguments: { job_id: 'job-777' }
  });
  assert.equal(calls[3].path, '/api/operator/v1/content-jobs/job-777/review');

  // Pilar 5: Approve job
  await client.callTool({
    name: 'cf_approve_job',
    arguments: { job_id: 'job-777', review_revision: 1 }
  });
  assert.equal(calls[4].path, '/api/operator/v1/content-jobs/job-777/approve');
  assert.equal(calls[4].opts.body.review_revision, 1);

  // Pilar 6: List publishing accounts
  await client.callTool({
    name: 'cf_list_publishing_accounts',
    arguments: { provider: 'meta' }
  });
  assert.ok(calls[5].path.startsWith('/api/v2/publishing/accounts?'));

  // Pilar 6: Create publishing job
  await client.callTool({
    name: 'cf_create_publishing_job',
    arguments: {
      account_id: 'acc-1',
      content_id: 'cf_item_1',
      media_url: 'https://example.com/video.mp4',
      platform: 'facebook',
      caption: 'Resep Viral'
    }
  });
  assert.equal(calls[6].path, '/api/v2/publishing/jobs');
  assert.equal(calls[6].opts.body.caption, 'Resep Viral');

  // Pilar 6: List publishing jobs
  await client.callTool({
    name: 'cf_list_publishing_jobs',
    arguments: { status: 'completed' }
  });
  assert.ok(calls[7].path.startsWith('/api/v2/publishing/jobs?'));
  assert.ok(calls[7].path.includes('status=completed'));

  // Pilar 7: Cluster health
  await client.callTool({ name: 'cf_get_cluster_health' });
  assert.equal(calls[8].path, '/api/v2/system-health');

  // Pilar 7: Studio stats
  await client.callTool({ name: 'cf_get_studio_stats' });
  assert.equal(calls[9].path, '/api/v2/dashboard/stats');
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
    error: 'Operator request rejected (HTTP 403); check permissions, input, or ID.'
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
  assert.ok((await client.listTools()).tools.length >= 61);
  assert.equal((await client.callTool({ name: 'cf_whoami' })).isError, undefined);
  assert.equal(calls, 1);
});


test('Radar Produk tools dispatch to operator radar endpoints (7.6)', async t => {
  const calls = [];
  const client = await connected(t, async (path, opts) => {
    calls.push({ path, opts });
    return { success: true, items: [], matches: [] };
  });

  const names = new Set((await client.listTools()).tools.map(x => x.name));
  for (const n of ['cf_list_radar_candidates', 'cf_get_radar_candidate', 'cf_get_radar_status', 'cf_submit_radar_candidates']) {
    assert.ok(names.has(n), `${n} harus terdaftar`);
  }

  await client.callTool({ name: 'cf_list_radar_candidates', arguments: { mode: 'top', trend: 'up', limit: 5 } });
  assert.match(calls.at(-1).path, /^\/api\/operator\/v2\/product-research\/candidates\?/);
  assert.match(calls.at(-1).path, /trend=up/);
  assert.equal(calls.at(-1).opts.body, undefined);

  await client.callTool({ name: 'cf_get_radar_candidate', arguments: { candidate_ref: '12' } });
  assert.equal(calls.at(-1).path, '/api/operator/v2/product-research/candidates/12');

  await client.callTool({ name: 'cf_get_radar_status', arguments: {} });
  assert.equal(calls.at(-1).path, '/api/operator/v2/product-research/status');

  // default preview: tidak ada efek samping
  await client.callTool({ name: 'cf_submit_radar_candidates', arguments: { candidate_refs: ['1', '2'] } });
  assert.equal(calls.at(-1).path, '/api/operator/v2/product-research/submit');
  assert.equal(calls.at(-1).opts.body.mode, 'preview');
  await client.callTool({ name: 'cf_submit_radar_candidates', arguments: { candidate_refs: ['1'], mode: 'execute' } });
  assert.equal(calls.at(-1).opts.body.mode, 'execute');
});

test('cf_add_product: guard Radar memblokir URL kandidat riset, input manual & bypass tetap berjalan (7.6)', async t => {
  const calls = [];
  const client = await connected(t, async (path, opts) => {
    calls.push({ path, opts });
    if (path.startsWith('/api/operator/v2/product-research/candidates/match-url')) {
      return String(path).includes('riset-ada')
        ? { success: true, matches: [{ number: '7', name: 'Produk Riset', batch_label: '2026-11-17', process_status: 'not_sent', cf_product_id: null }] }
        : { success: true, matches: [] };
    }
    return { success: true, id: 'pe-1' };
  });

  // 1. URL ada di Radar & belum masuk katalog -> diblokir, tidak POST ke /api/v2/products
  const blocked = await client.callTool({
    name: 'cf_add_product',
    arguments: { product_name: 'X', source_url: 'https://shopee.co.id/riset-ada' }
  });
  assert.equal(blocked.structuredContent.code, 'RADAR_CANDIDATE_EXISTS');
  assert.equal(calls.some(c => c.path === '/api/v2/products'), false);

  // 2. bypass eksplisit -> lanjut, flag tidak bocor ke body
  await client.callTool({
    name: 'cf_add_product',
    arguments: { product_name: 'X', source_url: 'https://shopee.co.id/riset-ada', bypass_radar_check: true }
  });
  const post = calls.find(c => c.path === '/api/v2/products');
  assert.ok(post);
  assert.equal('bypass_radar_check' in post.opts.body, false);

  // 3. URL tidak ada di Radar -> berjalan normal
  calls.length = 0;
  await client.callTool({
    name: 'cf_add_product',
    arguments: { product_name: 'Y', source_url: 'https://shopee.co.id/bukan-riset' }
  });
  assert.equal(calls.at(-1).path, '/api/v2/products');

  // 4. input manual tanpa source_url -> tidak ada pemeriksaan Radar sama sekali
  calls.length = 0;
  await client.callTool({ name: 'cf_add_product', arguments: { product_name: 'Z' } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/v2/products');
});

test('Universe & Character Lock MVP: all 10 tools registered with schema, tenant guard, and upload/approve validation', async t => {
  const fs = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');

  const calls = [];
  const rawReq = async (reqPath, opts = {}) => {
    calls.push({ path: reqPath, opts });
    if (reqPath === '/api/operator/v1/whoami') {
      return { success: true, operator: { id: 'op_1', tenant_id: 'tnt_pt-gim-sosmed_62d0d9', scopes: ['content:read', 'content:create', 'content:approve'] } };
    }
    if (reqPath.startsWith('/api/v2/reference-assets/upload')) {
      return {
        success: true,
        tenant_id: 'tnt_pt-gim-sosmed_62d0d9',
        deduplicated: false,
        data: {
          id: 'ref_arka_1',
          tenant_id: 'tnt_pt-gim-sosmed_62d0d9',
          owner_type: 'character',
          owner_id: 'char_arka',
          asset_role: 'identity',
          version: 1,
          status: 'draft',
          sha256: 'abc1234567890',
          public_path: '/uploads/reference-assets/tnt/character/char_arka/identity/v1/abc.png'
        }
      };
    }
    if (reqPath.startsWith('/api/v2/reference-assets?')) {
      return {
        success: true,
        tenant_id: 'tnt_pt-gim-sosmed_62d0d9',
        data: [
          {
            id: 'ref_arka_1',
            tenant_id: 'tnt_pt-gim-sosmed_62d0d9',
            owner_type: 'character',
            owner_id: 'char_arka',
            asset_role: 'identity',
            version: 1,
            status: 'approved',
            sha256: 'abc1234567890',
            public_path: '/uploads/reference-assets/tnt/character/char_arka/identity/v1/abc.png',
            generation_prompt: 'huge internal prompt should be stripped'
          }
        ]
      };
    }
    return { success: true, tenant_id: 'tnt_pt-gim-sosmed_62d0d9', data: [] };
  };
  rawReq.baseUrl = 'http://127.0.0.1:5020';

  const client = await connected(t, rawReq);
  const tools = (await client.listTools()).tools;
  const toolNames = new Set(tools.map(x => x.name));

  const expected10 = [
    'cf_list_universes',
    'cf_get_universe',
    'cf_create_universe_character',
    'cf_update_universe_character',
    'cf_list_reference_assets',
    'cf_upload_reference_asset',
    'cf_approve_reference_asset',
    'cf_reject_reference_asset',
    'cf_link_visual_identity_universe',
    'cf_preflight_character_lock'
  ];
  for (const name of expected10) {
    assert.ok(toolNames.has(name), `Expected MCP tool "${name}" to be registered`);
  }

  // 1. expected_tenant_id mismatch is rejected on MCP side BEFORE calling API
  calls.length = 0;
  const mismatchRes = await client.callTool({
    name: 'cf_create_universe_character',
    arguments: {
      universe_id: 'univ_1',
      name: 'Arka',
      character_key: 'arka_acoustic_consultant',
      canonical_prompt: 'Indonesian acoustic consultant',
      expected_tenant_id: 'tnt_wrong_tenant'
    }
  });
  assert.equal(mismatchRes.isError, true);
  assert.equal(mismatchRes.structuredContent.error_code, 'TENANT_MISMATCH');
  assert.ok(calls.every(c => !c.path.includes('/characters')), 'Must NOT call character creation API on tenant mismatch');

  // 2. Schema rejects invalid character_key and approve without expected_sha256
  const invalidKeyRes = await client.callTool({
    name: 'cf_create_universe_character',
    arguments: {
      universe_id: 'univ_1',
      name: 'Arka',
      character_key: 'Invalid Key!',
      canonical_prompt: 'Prompt'
    }
  });
  assert.equal(invalidKeyRes.isError, true);

  const missingShaRes = await client.callTool({
    name: 'cf_approve_reference_asset',
    arguments: { asset_id: 'ref_arka_1' }
  });
  assert.equal(missingShaRes.isError, true);

  // 3. Upload rejects photo_url and oversized base64 BEFORE calling API
  calls.length = 0;
  const urlReject = await client.callTool({
    name: 'cf_upload_reference_asset',
    arguments: {
      owner_type: 'character',
      owner_id: 'char_arka',
      role: 'identity',
      photo_url: 'https://example.com/arka.png'
    }
  });
  assert.equal(urlReject.isError, true);
  assert.equal(urlReject.structuredContent.error_code, 'UNSUPPORTED_SOURCE');
  assert.equal(calls.length, 0);

  const hugeBase64 = 'A'.repeat(14 * 1024 * 1024 + 10);
  const bigReject = await client.callTool({
    name: 'cf_upload_reference_asset',
    arguments: {
      owner_type: 'character',
      owner_id: 'char_arka',
      role: 'identity',
      image_base64: hugeBase64
    }
  });
  assert.equal(bigReject.isError, true);
  assert.equal(bigReject.structuredContent.error_code, 'UPLOAD_TOO_LARGE');
  assert.equal(calls.length, 0);

  // 4. Upload via local file_path builds FormData and returns absolute preview_url
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cf-mcp-upload-'));
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));
  const imgFile = path.join(tmpDir, 'arka.png');
  const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await fs.writeFile(imgFile, pngBytes);

  const uploadOk = await client.callTool({
    name: 'cf_upload_reference_asset',
    arguments: {
      owner_type: 'character',
      owner_id: 'char_arka',
      role: 'identity',
      file_path: imgFile,
      expected_tenant_id: 'tnt_pt-gim-sosmed_62d0d9'
    }
  });
  assert.equal(uploadOk.isError, undefined);
  assert.equal(uploadOk.structuredContent.asset.preview_url, 'http://127.0.0.1:5020/uploads/reference-assets/tnt/character/char_arka/identity/v1/abc.png');
  const uploadCall = calls.find(c => c.path === '/api/v2/reference-assets/upload');
  assert.ok(uploadCall && uploadCall.opts.body instanceof FormData);

  // 5. cf_list_reference_assets strips heavy fields and returns absolute preview_url
  const listRes = await client.callTool({
    name: 'cf_list_reference_assets',
    arguments: { owner_type: 'character', owner_id: 'char_arka' }
  });
  assert.equal(listRes.structuredContent.count, 1);
  assert.equal(listRes.structuredContent.assets[0].preview_url, 'http://127.0.0.1:5020/uploads/reference-assets/tnt/character/char_arka/identity/v1/abc.png');
  assert.equal('generation_prompt' in listRes.structuredContent.assets[0], false);

  // 6. cf_link_visual_identity_universe defaults dry_run=true
  calls.length = 0;
  await client.callTool({
    name: 'cf_link_visual_identity_universe',
    arguments: {
      visual_identity_id: 'vi_1',
      universe_id: 'univ_1',
      character_keys: ['arka_acoustic_consultant'],
      character_lock_mode: 'strict'
    }
  });
  assert.equal(calls[0].path, '/api/v2/visual-identities/vi_1/universe-link');
  assert.equal(calls[0].opts.body.dry_run, true);
  assert.equal(calls[0].opts.body.character_lock_mode, 'strict');

  // 7. cf_preflight_character_lock forwards mode & sample_prompt
  calls.length = 0;
  await client.callTool({
    name: 'cf_preflight_character_lock',
    arguments: {
      visual_identity_id: 'vi_1',
      mode: 'required',
      sample_prompt: 'Maya in studio'
    }
  });
  assert.equal(calls[0].path, '/api/v2/reference-assets/character-lock-preflight');
  assert.equal(calls[0].opts.body.mode, 'required');
  assert.equal(calls[0].opts.body.sample_prompt, 'Maya in studio');
});

test('Remote HTTP MCP accepts per-operator Bearer token and blocks file_path / photo_file_path', async t => {
  const backendSeenAuth = [];
  const backendSeenTool = [];
  const mockBackend = createHttpApp ? null : null;

  // Spin up mock CF Studio backend HTTP server
  const { createServer } = await import('node:http');
  const backendServer = createServer((req, res) => {
    backendSeenAuth.push(req.headers.authorization || '');
    backendSeenTool.push(req.headers['x-mcp-tool'] || '');
    res.setHeader('content-type', 'application/json');
    if (req.url === '/api/operator/v1/whoami') {
      res.end(JSON.stringify({
        success: true,
        operator: { id: 'op_pc_b', name: 'PC B', tenant_id: 'tnt_b', scopes: ['content:read'] }
      }));
      return;
    }
    if (req.url === '/api/v2/tenants') {
      if (req.headers['x-tenant-override'] === 'default_tenant') {
        res.statusCode = 403;
        res.end(JSON.stringify({
          success: false,
          code: 'TENANT_FORBIDDEN',
          error_code: 'TENANT_FORBIDDEN',
          error: 'Akses ke tenant ini tidak diizinkan untuk kredensial Anda.'
        }));
        return;
      }
      res.end(JSON.stringify({ success: true, active_tenant: 'tnt_b', is_master: false, tenants: [{ id: 'tnt_b' }] }));
      return;
    }
    res.end(JSON.stringify({ success: true }));
  });

  await new Promise(resolve => backendServer.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => {
    backendServer.closeAllConnections();
    backendServer.close(resolve);
  }));
  const backendUrl = `http://127.0.0.1:${backendServer.address().port}`;

  const app = createHttpApp({
    baseUrl: backendUrl,
    bearerToken: 'STATIC_MASTER_BEARER_TOKEN_32_CHARS_LONG',
    request: async () => ({ success: true })
  });
  const mcpHttp = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.on('error', reject);
  });
  t.after(() => new Promise(resolve => {
    mcpHttp.closeAllConnections();
    mcpHttp.close(resolve);
  }));

  const mcpUrl = new URL(`http://127.0.0.1:${mcpHttp.address().port}/mcp`);
  const perOperatorToken = 'cfop_SAMPLE_PER_PC_OPERATOR_TOKEN_0123456789abcdef';

  const client = new Client({ name: 'remote-pc-test', version: '2' });
  t.after(() => client.close());
  await client.connect(
    new StreamableHTTPClientTransport(mcpUrl, {
      requestInit: { headers: { authorization: `Bearer ${perOperatorToken}` } }
    })
  );

  // 1. Per-operator Bearer forwarded to backend along with x-mcp-tool
  const whoami = await client.callTool({ name: 'cf_whoami' });
  assert.equal(whoami.isError, undefined);
  assert.equal(whoami.structuredContent.operator.id, 'op_pc_b');
  assert.equal(backendSeenAuth[0], `Bearer ${perOperatorToken}`);
  assert.equal(backendSeenTool[0], 'cf_whoami');

  // 2. cf_switch_tenant propagates TENANT_FORBIDDEN when backend returns 403
  const forbiddenSwitch = await client.callTool({
    name: 'cf_switch_tenant',
    arguments: { tenant: 'default_tenant' }
  });
  assert.equal(forbiddenSwitch.isError, true);
  assert.equal(forbiddenSwitch.structuredContent.error_code, 'TENANT_FORBIDDEN');

  // 3. Remote HTTP blocks file_path on cf_upload_reference_asset
  const refReject = await client.callTool({
    name: 'cf_upload_reference_asset',
    arguments: {
      owner_type: 'character',
      owner_id: 'char_1',
      role: 'identity',
      file_path: '/etc/passwd'
    }
  });
  assert.equal(refReject.isError, true);
  assert.equal(refReject.structuredContent.error_code, 'VALIDATION_ERROR');

  // 4. Remote HTTP blocks photo_file_path on cf_add_product & cf_upload_product_photo
  const prodReject = await client.callTool({
    name: 'cf_add_product',
    arguments: {
      product_name: 'Sample Product',
      photo_file_path: '/etc/passwd'
    }
  });
  assert.equal(prodReject.isError, true);
  assert.equal(prodReject.structuredContent.error_code, 'VALIDATION_ERROR');

  const photoReject = await client.callTool({
    name: 'cf_upload_product_photo',
    arguments: {
      product_id: 'prod_1',
      photo_file_path: '/etc/passwd'
    }
  });
  assert.equal(photoReject.isError, true);
  assert.equal(photoReject.structuredContent.error_code, 'VALIDATION_ERROR');

  // 5. Static master bearer token still works when supplied
  const masterClient = new Client({ name: 'master-test', version: '2' });
  t.after(() => masterClient.close());
  await masterClient.connect(
    new StreamableHTTPClientTransport(mcpUrl, {
      requestInit: { headers: { authorization: 'Bearer STATIC_MASTER_BEARER_TOKEN_32_CHARS_LONG' } }
    })
  );
  const masterTools = await masterClient.listTools();
  assert.ok(masterTools.tools.length >= 61);
});

test('createCfStudioServer enforces allowedTools allowlist locally when provided or returned by whoami', async t => {
  const client = await connected(
    t,
    async path => {
      if (path === '/api/operator/v1/whoami') {
        return { success: true, operator: { id: 'op_1', tenant_id: 'tnt_a', allowed_tools: ['cf_whoami', 'cf_list_tenants'] } };
      }
      return { success: true };
    }
  );
  const whoami = await client.callTool({ name: 'cf_whoami' });
  assert.equal(whoami.isError, undefined);

  const denied = await client.callTool({ name: 'cf_create_schedule', arguments: { name: 'Test' } });
  assert.equal(denied.isError, true);
  assert.equal(denied.structuredContent.error_code, 'TOOL_FORBIDDEN');
});

test('cf_approve_job supports mul_* Multiplier tasks, cf_retry_multiplier_task passes force & stage, and cf_list_publishing_jobs supports needs_review & scheduled', async t => {
  const calls = [];
  const client = await connected(t, async (path, opts) => {
    calls.push({ path, opts });
    return { success: true };
  });

  await client.callTool({
    name: 'cf_approve_job',
    arguments: { job_id: 'mul_261125_h6c6p0' }
  });
  assert.equal(calls[0].path, '/api/v2/multiplier/mul_261125_h6c6p0/approve');
  assert.deepEqual(calls[0].opts.body, {});

  await client.callTool({
    name: 'cf_retry_multiplier_task',
    arguments: { task_id: 'mul_261125_pa2dv7', force: true, stage: 't2i' }
  });
  assert.equal(calls[1].path, '/api/v2/multiplier');
  assert.equal(calls[1].opts.method, 'PATCH');
  assert.deepEqual(calls[1].opts.body, {
    action: 'retry_task',
    taskId: 'mul_261125_pa2dv7',
    force: true,
    stage: 't2i'
  });

  await client.callTool({
    name: 'cf_list_publishing_jobs',
    arguments: { status: 'needs_review', limit: 10 }
  });
  assert.ok(calls[2].path.startsWith('/api/v2/publishing/jobs?'));
  assert.ok(calls[2].path.includes('status=needs_review'));

  await client.callTool({
    name: 'cf_list_publishing_jobs',
    arguments: { status: 'scheduled', limit: 10 }
  });
  assert.ok(calls[3].path.includes('status=scheduled'));
});

test('cf_link_product_brand saves a per-brand affiliate link, verifies it, and never silently overwrites', async t => {
  const calls = [];
  let rows = [];
  let ignoreWrite = false;
  const client = await connected(t, async (path, opts) => {
    calls.push({ path, opts });
    if (opts.method === 'PUT') {
      if (!ignoreWrite) {
        rows = [{ brand_profile_id: 'brand-1', brand_name: 'snacklab', affiliate_link: opts.body.affiliateLink, is_active: true }];
      }
      return { success: true, data: rows[0] || null };
    }
    return { success: true, data: rows };
  });
  const link = args => client.callTool({
    name: 'cf_link_product_brand',
    arguments: { brand_id: 'brand-1', product_id: 'pe-123', affiliate_link: 'https://s.shopee.co.id/aaa', ...args }
  });
  const writes = () => calls.filter(c => c.opts.method === 'PUT');

  // 1. Link baru: tulis ke endpoint brand, lalu baca ulang
  const created = (await link({ tracking_code: 'SnackLab' })).structuredContent;
  assert.equal(created.success, true);
  assert.equal(created.verified, true);
  assert.equal(writes()[0].path, '/api/v2/brand-profiles/brand-1/products');
  assert.deepEqual(writes()[0].opts.body, { productId: 'pe-123', affiliateLink: 'https://s.shopee.co.id/aaa', trackingCode: 'SnackLab' });
  assert.equal(calls.at(-1).path, '/api/v2/products/pe-123/brands');

  // 2. Link sama tanpa tracking_code: tidak menulis ulang
  const same = (await link({})).structuredContent;
  assert.equal(same.changed, false);
  assert.equal(writes().length, 1);

  // 3. Link berbeda ditahan kecuali replace_existing
  const blocked = await link({ affiliate_link: 'https://s.shopee.co.id/bbb' });
  assert.equal(blocked.isError, true);
  assert.equal(blocked.structuredContent.error_code, 'BRAND_LINK_EXISTS');
  assert.equal(writes().length, 1);
  const replaced = (await link({ affiliate_link: 'https://s.shopee.co.id/bbb', replace_existing: true })).structuredContent;
  assert.equal(replaced.brand_link.affiliate_link, 'https://s.shopee.co.id/bbb');
  assert.equal(writes().length, 2);

  // 4. Tulisan yang tidak terbaca ulang dilaporkan gagal
  rows = [];
  ignoreWrite = true;
  assert.equal((await link({})).structuredContent.error_code, 'BRAND_LINK_NOT_VERIFIED');

  // 5. URL bukan http(s) ditolak sebelum ada permintaan
  const count = calls.length;
  assert.equal((await link({ affiliate_link: 'javascript:alert(1)' })).isError, true);
  assert.equal(calls.length, count);
});

test('cf_link_product_brand stops when the product cannot be read', async t => {
  const calls = [];
  const client = await connected(t, async (path, opts) => {
    calls.push({ path, opts });
    return { success: false, status: 403, error: 'Akses ke tenant ini tidak diizinkan.' };
  });
  const result = await client.callTool({
    name: 'cf_link_product_brand',
    arguments: { brand_id: 'brand-1', product_id: 'pe-123', affiliate_link: 'https://s.shopee.co.id/aaa' }
  });
  assert.equal(result.isError, true);
  assert.equal(calls.length, 1);
});

test('cf_add_product: usp_approved mengunci USP via raw_response.usp_source=manual dan memvalidasi USP wajib', async t => {
  const calls = [];
  const client = await connected(t, async (path, opts) => {
    calls.push({ path, opts });
    return { success: true, id: 'pe-usp-1' };
  });

  // 1. Dengan usp_approved=true dan USP -> raw_response JSON berisi usp_source='manual', usp_approved tidak dikirim
  await client.callTool({
    name: 'cf_add_product',
    arguments: {
      product_name: 'Sikat Elektrik',
      unique_selling_point: 'Tahan air IPX7\nPutaran 350 RPM',
      usp_approved: true
    }
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/v2/products');
  assert.equal('usp_approved' in calls[0].opts.body, false);
  const parsedRaw = JSON.parse(calls[0].opts.body.raw_response);
  assert.equal(parsedRaw.usp_source, 'manual');
  assert.equal(parsedRaw.source, 'manual');

  // 2. Tanpa usp_approved -> tidak ada raw_response
  calls.length = 0;
  await client.callTool({
    name: 'cf_add_product',
    arguments: {
      product_name: 'Sikat Biasa',
      unique_selling_point: 'Ringan'
    }
  });
  assert.equal(calls.length, 1);
  assert.equal('raw_response' in calls[0].opts.body, false);

  // 3. usp_approved=true tanpa USP (kosong / spasi) -> USP_REQUIRED dan tidak ada permintaan tulis
  calls.length = 0;
  const missingUsp = await client.callTool({
    name: 'cf_add_product',
    arguments: {
      product_name: 'Produk Tanpa USP',
      unique_selling_point: '   ',
      usp_approved: true
    }
  });
  assert.equal(missingUsp.isError, true);
  assert.equal(missingUsp.structuredContent.error_code, 'USP_REQUIRED');
  assert.equal(calls.length, 0);
});
