import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

function isLocalOrPrivateHost(hostname) {
  if (['localhost', '127.0.0.1', '[::1]'].includes(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true; // Tailscale 100.64.0.0/10
  return false;
}

export function operatorClient({ baseUrl, token, fetchImpl = fetch }) {
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error('Invalid Operator base URL');
  }
  if (base.protocol !== 'https:' && !isLocalOrPrivateHost(base.hostname)) {
    throw new Error('Remote Operator API requires HTTPS');
  }
  if (!token) throw new Error('CF_STUDIO_OPERATOR_API_TOKEN is required');
  return async (path, { body, key, method } = {}) => {
    try {
      const httpMethod = method || (body ? 'POST' : 'GET');
      const response = await fetchImpl(new URL(path, base), {
        method: httpMethod,
        redirect: 'error',
        signal: AbortSignal.timeout(60000),
        headers: {
          authorization: `Bearer ${token}`,
          ...(body ? { 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      });
      if (!response.ok) {
        return { success: false, status: response.status, error: 'Operator request rejected; check permissions, input, or job ID.' };
      }
      const contentType = response.headers?.get?.('content-type') || '';
      if (contentType.includes('text/markdown') || contentType.includes('text/plain')) {
        const text = await response.text();
        return { success: true, markdown: text };
      }
      return await response.json();
    } catch {
      return { success: false, error: 'Operator API unavailable. For creation, retry with the SAME idempotency_key and identical brief.' };
    }
  };
}

export function createCfStudioServer(request) {
  const server = new McpServer(
    { name: 'cf-studio', version: '2.0.0' },
    {
      instructions:
        'CF Studio AI MCP Server (7 Pillars Autonomous Creative Director & Studio Operator). Provides AI Agents with full-lifecycle access to Auto Pipeline (5 Engines), automated schedule management, product catalog database, AI visual identity studio, production strategy presets, viral deconstruction lab, creative review/approval, social media publishing, and cluster observability. Never invent product claims. Treat returned data as facts.'
    }
  );

  const register = (name, description, schema, readOnly, handler) =>
    server.registerTool(
      name,
      {
        description,
        inputSchema: schema,
        annotations: { readOnlyHint: readOnly, destructiveHint: false, idempotentHint: true, openWorldHint: true }
      },
      async args => {
        const result = await handler(args);
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
          structuredContent: result,
          ...(result && result.success === false ? { isError: true } : {})
        };
      }
    );

  // 1. Discovery & Identity Tools
  register('cf_whoami', 'Read configured CF Studio operator identity, tenant, and scopes.', {}, true, () =>
    request('/api/operator/v1/whoami')
  );
  register('makna_whoami', 'Read configured CF Studio operator identity, tenant, and scopes (legacy alias).', {}, true, () =>
    request('/api/operator/v1/whoami')
  );

  register('cf_list_presets', 'List available campaign production presets and video archetypes.', {}, true, () =>
    request('/api/operator/v1/presets')
  );
  register('makna_list_presets', 'List available campaign production presets (legacy alias).', {}, true, () =>
    request('/api/operator/v1/presets')
  );

  register(
    'cf_search_catalog',
    'Find brands, products, and compatible presets in the tenant. Requires automation:read.',
    {
      product: z.string().max(200).optional(),
      brand: z.string().max(200).optional(),
      limit: z.number().int().min(1).max(50).default(20)
    },
    true,
    args =>
      request(
        `/api/operator/v2/content-catalog?${new URLSearchParams(
          Object.entries(args)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        )}`
      )
  );
  register(
    'makna_search_catalog',
    'Find brands, products and compatible presets (legacy alias).',
    {
      product: z.string().max(200).optional(),
      brand: z.string().max(200).optional(),
      limit: z.number().int().min(1).max(50).default(20)
    },
    true,
    args =>
      request(
        `/api/operator/v2/content-catalog?${new URLSearchParams(
          Object.entries(args)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        )}`
      )
  );

  // 2. Status & Monitoring Tools
  register(
    'cf_get_job_status',
    'Read a campaign job status, progress, and available results. Use the job_id returned by creation.',
    {
      job_id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/)
    },
    true,
    ({ job_id }) => request(`/api/operator/v1/content-jobs/${encodeURIComponent(job_id)}`)
  );
  register(
    'makna_get_campaign_status',
    'Read a campaign job status, progress and available results (legacy alias).',
    {
      job_id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/)
    },
    true,
    ({ job_id }) => request(`/api/operator/v1/content-jobs/${encodeURIComponent(job_id)}`)
  );

  // 3. Auto Pipeline: 5 Dedicated Engine Tools
  // Engine 1: Product Video (product_campaign)
  register(
    'cf_create_product_video',
    'Create a 1-Click Product Video campaign showcasing catalog products with CEP triggers and unboxing.',
    {
      idempotency_key: z.string().trim().min(1).max(128).optional(),
      brand_id: z.string().max(100).optional(),
      product_id: z.string().max(100).optional(),
      product_title: z.string().trim().min(1).max(300),
      promotion_context: z.string().max(2000).optional(),
      selected_cep: z.string().max(200).optional(),
      preset_key: z.string().max(100).default('product_campaign'),
      execution_mode: z.enum(['full_autopilot', 'creative_review']).default('full_autopilot')
    },
    false,
    ({ idempotency_key, ...args }) =>
      request('/api/v2/recipes/autonomous-pipeline', {
        key: idempotency_key,
        body: { pipeline_type: 'product_campaign', ...args }
      })
  );

  // Legacy Campaign Creator (points to /api/operator/v1/content-jobs)
  register(
    'makna_create_campaign',
    'Create a product campaign asynchronously using single-pass strategic generation (legacy format).',
    {
      idempotency_key: z.string().trim().min(1).max(128),
      product_name: z.string().trim().min(1).max(300),
      product_description: z.string().trim().min(1).max(12000),
      target_audience: z.string().trim().min(1).max(2000),
      content_goal: z.string().trim().min(1).max(2000),
      platform: z.enum(['tiktok', 'instagram', 'youtube']).default('instagram'),
      planner_count: z.union([z.literal(6), z.literal(12), z.literal(18), z.literal(24), z.literal(30)]).default(6)
    },
    false,
    ({ idempotency_key, ...brief }) =>
      request('/api/operator/v1/content-jobs', {
        key: idempotency_key,
        body: {
          planner: { ...brief, planner_focus: 'product_campaign' },
          selection: { mode: 'best_one' },
          production: { approval_mode: 'creative', enable_social_post: false },
          publishing: { mode: 'draft_only' }
        }
      })
  );
  register(
    'cf_create_campaign',
    'Create a strategic product campaign asynchronously using CF Studio single-pass strategic generation.',
    {
      idempotency_key: z.string().trim().min(1).max(128),
      product_name: z.string().trim().min(1).max(300),
      product_description: z.string().trim().min(1).max(12000),
      target_audience: z.string().trim().min(1).max(2000),
      content_goal: z.string().trim().min(1).max(2000),
      platform: z.enum(['tiktok', 'instagram', 'youtube']).default('instagram'),
      planner_count: z.union([z.literal(6), z.literal(12), z.literal(18), z.literal(24), z.literal(30)]).default(6)
    },
    false,
    ({ idempotency_key, ...brief }) =>
      request('/api/operator/v1/content-jobs', {
        key: idempotency_key,
        body: {
          planner: { ...brief, planner_focus: 'product_campaign' },
          selection: { mode: 'best_one' },
          production: { approval_mode: 'creative', enable_social_post: false },
          publishing: { mode: 'draft_only' }
        }
      })
  );

  // Engine 2: Editorial Video (editorial_campaign)
  register(
    'cf_create_editorial_video',
    'Create a 1-Click Editorial Video campaign based on brand narrative pillars and educational storytelling.',
    {
      idempotency_key: z.string().trim().min(1).max(128).optional(),
      brand_id: z.string().max(100).optional(),
      content_pillar: z.string().trim().min(1).max(300),
      preset_key: z.string().max(100).default('brand_editorial_campaign'),
      execution_mode: z.enum(['full_autopilot', 'creative_review']).default('full_autopilot')
    },
    false,
    ({ idempotency_key, ...args }) =>
      request('/api/v2/recipes/autonomous-pipeline', {
        key: idempotency_key,
        body: { pipeline_type: 'editorial_campaign', ...args }
      })
  );

  // Engine 3: Recipe Video (recipe_campaign)
  register(
    'cf_create_recipe_video',
    'Create a 1-Click Food Recipe Video campaign (4-part structure, appetizing hook, voiceover, and structured recipe caption).',
    {
      idempotency_key: z.string().trim().min(1).max(128).optional(),
      brand_id: z.string().max(100).optional(),
      topic: z.string().trim().min(1).max(300),
      category: z.enum(['makanan_utama', 'masakan', 'minuman', 'dessert', 'kue', 'camilan']).default('makanan_utama'),
      recipe_count: z.number().int().min(1).max(10).default(1),
      enable_motion_text: z.boolean().default(true),
      preset_key: z.string().max(100).optional(),
      execution_mode: z.enum(['full_autopilot', 'creative_review']).default('full_autopilot')
    },
    false,
    ({ idempotency_key, ...args }) =>
      request('/api/v2/recipes/autonomous-pipeline', {
        key: idempotency_key,
        body: { pipeline_type: 'recipe_campaign', ...args }
      })
  );

  // Engine 4: Multiplier Video (multiplier_campaign)
  register(
    'cf_create_multiplier_video',
    'Create a 1-Click Multiplier Video remixed from a deconstructed viral video blueprint to your product.',
    {
      idempotency_key: z.string().trim().min(1).max(128).optional(),
      brand_id: z.string().max(100).optional(),
      deconstruct_asset_id: z.string().trim().min(1).max(128),
      product_id: z.string().max(100).optional(),
      selected_angle: z.string().max(300).optional(),
      generate_recipe: z.boolean().default(true),
      preset_key: z.string().max(100).default('multiplier_deconstruct_remix'),
      execution_mode: z.enum(['full_autopilot', 'creative_review']).default('full_autopilot')
    },
    false,
    ({ idempotency_key, ...args }) =>
      request('/api/v2/recipes/autonomous-pipeline', {
        key: idempotency_key,
        body: { pipeline_type: 'multiplier_campaign', ...args }
      })
  );

  // Engine 5: Recipe Labs Text & Photo Post (recipe_labs)
  register(
    'cf_create_recipe_labs_post',
    'Create a Recipe Labs social media post: Facebook recipe article + 4 AI composite grid images (no video rendering).',
    {
      idempotency_key: z.string().trim().min(1).max(128).optional(),
      brand_id: z.string().max(100).optional(),
      topic: z.string().trim().min(1).max(300),
      category: z.string().max(100).default('Makanan'),
      visual_style: z.string().max(100).default('Food Porn'),
      images_per_recipe: z.number().int().min(1).max(4).default(4),
      selected_layout_id: z
        .enum(['4_editorial_split', '4_grid_equal', '3_editorial_focus', '2_vertical_split', '2_horizontal_split'])
        .default('4_editorial_split'),
      post_to_facebook: z.boolean().default(true)
    },
    false,
    ({ idempotency_key, ...args }) =>
      request('/api/v2/recipes/autonomous-pipeline', {
        key: idempotency_key,
        body: { pipeline_type: 'recipe_labs', ...args }
      })
  );

  // Authoritative Recipe Importer & Curated Library
  register(
    'cf_import_recipe_batch',
    'Import and curate up to 50 recipe URLs sequentially with Schema.org JSON-LD extraction, 100% frozen ingredients protection, and AI Magic Polish.',
    {
      urls: z.array(z.string().url()).min(1).max(50),
      auto_polish: z.boolean().default(true),
      style_preset: z.string().default('Food Porn'),
      category: z.string().default('makanan_utama'),
      cuisine: z.string().default('indonesia'),
      min_delay_ms: z.number().int().min(1000).max(60000).default(10000),
      max_delay_ms: z.number().int().min(1000).max(60000).default(20000)
    },
    false,
    args => request('/api/v2/recipes/curated/import-batch', { body: args })
  );

  register(
    'cf_list_curated_recipes',
    'List curated authoritative recipes stored in the database with ingredients and polish status.',
    {
      batch_id: z.string().optional(),
      search: z.string().optional(),
      polish_status: z.enum(['polished', 'unpolished', 'fallback_raw', 'failed', 'all']).default('all'),
      category: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(20),
      offset: z.number().int().min(0).default(0)
    },
    true,
    args =>
      request(
        `/api/v2/recipes/curated/import-batch?${new URLSearchParams(
          Object.entries(args)
            .filter(([_, v]) => v !== undefined && v !== 'all')
            .map(([k, v]) => [k, String(v)])
        )}`
      )
  );

  // Engine 6: Custom Storyboard Submission (Claude / External AI to Video Pipeline)
  register(
    'cf_submit_custom_storyboard',
    'Submit a pre-crafted custom storyboard directly to CF Studio for physical rendering (TTS voiceover, AI video clips per scene, and FFmpeg assembly).',
    {
      idempotency_key: z.string().trim().min(1).max(128).optional(),
      brand_id: z.string().max(100).optional(),
      title: z.string().trim().min(1).max(300),
      video_dna: z.object({
        aspect_ratio: z.enum(['9:16', '16:9', '1:1']).default('9:16'),
        visual_style: z.string().default('Cinematic'),
        visual_mode: z.enum(['hybrid_lock', 'pure_t2v']).default('hybrid_lock'),
        voice_persona: z.string().default('Aoede'),
        speed_control: z.number().default(2.5),
        target_ai_engine: z.string().default('Google Veo (8s)'),
        enable_motion_text: z.boolean().default(true),
        motion_text_style: z.string().default('floating_white_yellow'),
        video_transition: z.string().default('fade'),
        transition_duration: z.number().default(0.5)
      }).optional(),
      scenes: z.array(z.object({
        scene_index: z.number().int().min(1).max(12).optional(),
        voiceover_text: z.string().trim().min(1),
        visual_prompt: z.string().trim().min(1),
        i2v_prompt: z.string().optional(),
        camera_movement: z.string().optional(),
        duration_seconds: z.number().min(1).max(15).default(4)
      })).min(1).max(12),
      social_media_package: z.object({
        caption: z.string().optional(),
        hashtags: z.array(z.string()).optional(),
        caption_facebook: z.string().optional(),
        caption_bio: z.string().optional()
      }).optional(),
      execution_mode: z.enum(['full_autopilot', 'creative_review']).default('full_autopilot')
    },
    false,
    ({ idempotency_key, ...storyboard }) =>
      request('/api/v2/recipes/autonomous-pipeline', {
        key: idempotency_key,
        body: {
          pipeline_type: 'custom_storyboard',
          storyboard
        }
      })
  );

  // Universal Master Tool for 1-Click Auto Pipeline
  register(
    'cf_run_auto_pipeline',
    'Universal master runner for any of the 6 CF Studio Auto Pipeline engines.',
    {
      idempotency_key: z.string().trim().min(1).max(128).optional(),
      pipeline_type: z.enum([
        'product_campaign',
        'editorial_campaign',
        'recipe_campaign',
        'multiplier_campaign',
        'recipe_labs',
        'custom_storyboard'
      ]),
      brand_id: z.string().max(100).optional(),
      topic: z.string().max(300).optional(),
      product_id: z.string().max(100).optional(),
      product_title: z.string().max(300).optional(),
      content_pillar: z.string().max(300).optional(),
      deconstruct_asset_id: z.string().max(128).optional(),
      category: z.string().max(100).optional(),
      selected_angle: z.string().max(300).optional(),
      generate_recipe: z.boolean().optional(),
      preset_key: z.string().max(100).optional(),
      storyboard: z.record(z.any()).optional(),
      execution_mode: z.enum(['full_autopilot', 'creative_review']).default('full_autopilot')
    },
    false,
    ({ idempotency_key, ...args }) =>
      request('/api/v2/recipes/autonomous-pipeline', {
        key: idempotency_key,
        body: args
      })
  );

  // 4. Schedule Management Tools
  register(
    'cf_list_schedules',
    'List recurring Auto Pipeline schedules in the tenant with their status and execution metrics.',
    {
      status: z.enum(['active', 'paused', 'all']).default('all'),
      pipeline_type: z
        .enum(['product_campaign', 'editorial_campaign', 'recipe_campaign', 'multiplier_campaign', 'recipe_labs', 'all'])
        .default('all'),
      brand_id: z.string().max(100).optional()
    },
    true,
    args =>
      request(
        `/api/v2/recipes/auto-pipeline-schedules?${new URLSearchParams(
          Object.entries(args)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        )}`
      )
  );

  register(
    'cf_create_schedule',
    'Create a new recurring Auto Pipeline schedule (e.g. daily/weekly automatic video generation) with full publish accounts, recipe toggle, Shopee affiliate link, and blueprint binding.',
    {
      name: z.string().trim().min(1).max(300),
      pipeline_type: z
        .enum(['product_campaign', 'editorial_campaign', 'recipe_campaign', 'multiplier_campaign', 'recipe_labs'])
        .default('recipe_campaign'),
      brand_id: z.string().max(100),
      preset_key: z.string().max(100).default('habitfolk_6clips_quick'),
      topic: z.string().max(300).optional(),
      category: z.string().max(100).default('makanan_utama'),
      target_item_id: z.string().max(100).optional(),
      target_item_title: z.string().max(300).optional(),
      generation_time: z.string().regex(/^\d{2}:\d{2}$/).default('05:00'),
      publish_time: z.string().regex(/^\d{2}:\d{2}$/).default('09:00'),
      days_of_week: z.array(z.number().int().min(0).max(6)).default([0, 1, 2, 3, 4, 5, 6]),
      timezone: z.string().default('Asia/Jakarta'),
      auto_publish_enabled: z.boolean().default(true),
      repliz_account_ids: z.array(z.string()).optional().default([]),
      generate_recipe: z.boolean().optional(),
      post_link_affiliate: z.boolean().optional(),
      blueprint_id: z.string().max(100).optional(),
      execution_mode: z.enum(['full_autopilot', 'semi_autopilot']).optional().default('full_autopilot'),
      pipeline_config: z.record(z.any()).optional()
    },
    false,
    args => {
      const {
        generate_recipe,
        post_link_affiliate,
        blueprint_id,
        execution_mode,
        pipeline_config,
        ...restArgs
      } = args;

      const mergedConfig = {
        ...(pipeline_config || {}),
        ...(generate_recipe !== undefined ? { generate_recipe } : {}),
        ...(post_link_affiliate !== undefined ? { post_link_affiliate } : {}),
        ...(blueprint_id ? { blueprint_id, deconstruct_asset_id: blueprint_id } : {}),
        ...(execution_mode ? { execution_mode } : {})
      };

      const payload = {
        ...restArgs,
        pipeline_config_json: mergedConfig
      };

      return request('/api/v2/recipes/auto-pipeline-schedules', { body: payload });
    }
  );

  register(
    'cf_update_schedule',
    'Update an existing recurring Auto Pipeline schedule (modify times, preset, publish accounts, recipe toggle, blueprint, or status).',
    {
      schedule_id: z.string().trim().min(1).max(128),
      name: z.string().trim().min(1).max(300).optional(),
      pipeline_type: z
        .enum(['product_campaign', 'editorial_campaign', 'recipe_campaign', 'multiplier_campaign', 'recipe_labs'])
        .optional(),
      brand_id: z.string().max(100).optional(),
      preset_key: z.string().max(100).optional(),
      topic: z.string().max(300).optional(),
      category: z.string().max(100).optional(),
      target_item_id: z.string().max(100).optional(),
      target_item_title: z.string().max(300).optional(),
      generation_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      publish_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      days_of_week: z.array(z.number().int().min(0).max(6)).optional(),
      timezone: z.string().optional(),
      auto_publish_enabled: z.boolean().optional(),
      repliz_account_ids: z.array(z.string()).optional(),
      generate_recipe: z.boolean().optional(),
      post_link_affiliate: z.boolean().optional(),
      blueprint_id: z.string().max(100).optional(),
      execution_mode: z.enum(['full_autopilot', 'semi_autopilot']).optional(),
      pipeline_config: z.record(z.any()).optional(),
      status: z.enum(['active', 'paused', 'archived']).optional()
    },
    false,
    args => {
      const {
        schedule_id,
        generate_recipe,
        post_link_affiliate,
        blueprint_id,
        execution_mode,
        pipeline_config,
        ...restArgs
      } = args;

      let pipelineConfigUpdate;
      if (generate_recipe !== undefined || post_link_affiliate !== undefined || blueprint_id || execution_mode || pipeline_config) {
        pipelineConfigUpdate = {
          ...(pipeline_config || {}),
          ...(generate_recipe !== undefined ? { generate_recipe } : {}),
          ...(post_link_affiliate !== undefined ? { post_link_affiliate } : {}),
          ...(blueprint_id ? { blueprint_id, deconstruct_asset_id: blueprint_id } : {}),
          ...(execution_mode ? { execution_mode } : {})
        };
      }

      const payload = {
        ...restArgs,
        ...(pipelineConfigUpdate ? { pipeline_config_json: pipelineConfigUpdate } : {})
      };

      return request(`/api/v2/recipes/auto-pipeline-schedules/${encodeURIComponent(schedule_id)}`, {
        body: payload,
        method: 'PUT'
      });
    }
  );

  register(
    'cf_toggle_schedule_pause',
    'Pause or resume an active Auto Pipeline schedule.',
    {
      schedule_id: z.string().trim().min(1).max(128)
    },
    false,
    ({ schedule_id }) =>
      request(`/api/v2/recipes/auto-pipeline-schedules/${encodeURIComponent(schedule_id)}`, {
        body: { action: 'toggle_pause' },
        method: 'PUT'
      })
  );

  register(
    'cf_delete_schedule',
    'Permanently delete an Auto Pipeline schedule.',
    {
      schedule_id: z.string().trim().min(1).max(128)
    },
    false,
    ({ schedule_id }) =>
      request(`/api/v2/recipes/auto-pipeline-schedules/${encodeURIComponent(schedule_id)}`, {
        method: 'DELETE'
      })
  );

  register(
    'cf_trigger_schedule_now',
    'Immediately trigger an execution run for an existing Auto Pipeline schedule without waiting for cron time.',
    {
      schedule_id: z.string().trim().min(1).max(128)
    },
    false,
    ({ schedule_id }) =>
      request(`/api/v2/recipes/auto-pipeline-schedules/${encodeURIComponent(schedule_id)}/run-now`, { body: {} })
  );

  // 5. Product Database Tools (Pilar 1: Data Engine)
  register(
    'cf_add_product',
    'Register a new product into the tenant catalog.',
    {
      product_name: z.string().trim().min(1).max(300),
      product_description: z.string().max(12000).optional(),
      category: z.string().max(100).optional(),
      unique_selling_point: z.string().max(2000).optional(),
      tags: z.string().max(500).optional(),
      affiliate_link: z.string().max(1000).optional(),
      source_url: z.string().max(1000).optional(),
      packaging_type: z.string().max(100).optional(),
      target_audience: z.string().max(2000).optional(),
      pain_point_solved: z.string().max(2000).optional()
    },
    false,
    args => request('/api/v2/products', { body: args })
  );

  register(
    'cf_enrich_product',
    'Trigger AI enrichment for product USP, truths, and clean photo prompt.',
    {
      product_id: z.string().trim().min(1).max(128)
    },
    false,
    ({ product_id }) => request('/api/v2/products/re-enrich', { body: { ids: [product_id] } })
  );

  register(
    'cf_get_product_detail',
    'Retrieve full product details, status, truths, and extraction metadata.',
    {
      product_id: z.string().trim().min(1).max(128)
    },
    true,
    ({ product_id }) => request(`/api/v2/products/${encodeURIComponent(product_id)}`)
  );

  register(
    'cf_update_product',
    'Update existing product information in the catalog.',
    {
      product_id: z.string().trim().min(1).max(128),
      updates: z.record(z.any())
    },
    false,
    ({ product_id, updates }) =>
      request(`/api/v2/products/${encodeURIComponent(product_id)}`, { method: 'PUT', body: updates })
  );

  register(
    'cf_scrape_product_url',
    'Scrape product specifications and images from an e-commerce or product URL.',
    {
      url: z.string().url(),
      category: z.string().max(100).optional(),
      tags: z.string().max(500).optional()
    },
    false,
    ({ url, ...args }) => request('/api/v2/products/scrape', { body: { urls: url, ...args } })
  );

  // 6. Visual Identity Tools (Pilar 2: Visual DNA Engine)
  register(
    'cf_generate_visual_identity',
    'Generate an AI Visual Identity draft from a creative brief.',
    {
      seed: z.string().trim().min(1).max(1000),
      demographic_key: z.string().max(100).optional(),
      setting: z.string().max(300).optional(),
      mood: z.string().max(300).optional(),
      visual_style: z.string().max(100).optional(),
      color_palette: z.string().max(300).optional()
    },
    false,
    args => request('/api/v2/visual-identities/ai/generate', { body: args })
  );

  register(
    'cf_create_visual_identity',
    'Register a structured Visual Identity preset in the tenant.',
    {
      label: z.string().trim().min(1).max(200),
      preset_key: z.string().max(100).optional(),
      description: z.string().max(1000).optional(),
      config: z.record(z.any())
    },
    false,
    args => request('/api/v2/visual-identities', { body: args })
  );

  register(
    'cf_list_visual_identities',
    'List available active Visual Identity presets (system & tenant custom).',
    {
      status: z.enum(['active', 'all', 'archived']).default('active')
    },
    true,
    args => request(`/api/v2/visual-identities?${new URLSearchParams(args)}`)
  );

  register(
    'cf_get_visual_identity',
    'Get detailed configuration of a Visual Identity preset.',
    {
      id_or_key: z.string().trim().min(1).max(128)
    },
    true,
    ({ id_or_key }) => request(`/api/v2/visual-identities/${encodeURIComponent(id_or_key)}`)
  );

  register(
    'cf_update_visual_identity',
    'Update an existing custom Visual Identity preset.',
    {
      id: z.string().trim().min(1).max(128),
      label: z.string().max(200).optional(),
      description: z.string().max(1000).optional(),
      config: z.record(z.any()).optional()
    },
    false,
    ({ id, ...args }) => request(`/api/v2/visual-identities/${encodeURIComponent(id)}`, { method: 'PUT', body: args })
  );

  // 7. Production Presets (Pilar 3: Strategy Engine)
  register(
    'cf_get_preset_detail',
    'Get full strategy configuration of an operator preset.',
    {
      preset_key: z.string().trim().min(1).max(128)
    },
    true,
    ({ preset_key }) => request(`/api/v2/operator-presets/${encodeURIComponent(preset_key)}`)
  );

  register(
    'cf_create_preset',
    'Create a new custom operator preset.',
    {
      key: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,63}$/),
      label: z.string().trim().min(1).max(200),
      config: z.record(z.any())
    },
    false,
    args => request('/api/v2/operator-presets', { body: args })
  );

  register(
    'cf_clone_preset',
    'Clone an existing preset with strategic modifications.',
    {
      source_key: z.string().trim().min(1).max(128),
      new_key: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,63}$/),
      new_label: z.string().trim().min(1).max(200),
      overrides: z.record(z.any()).optional()
    },
    false,
    async ({ source_key, new_key, new_label, overrides = {} }) => {
      const existing = await request(`/api/v2/operator-presets/${encodeURIComponent(source_key)}`);
      if (!existing || !existing.success) return { success: false, error: 'Source preset not found' };
      const mergedConfig = { ...existing.preset, ...overrides, label: new_label };
      return request('/api/v2/operator-presets', { body: { key: new_key, label: new_label, config: mergedConfig } });
    }
  );

  register(
    'cf_update_preset',
    'Update an existing custom operator preset.',
    {
      key: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,63}$/),
      label: z.string().max(200).optional(),
      config: z.record(z.any()).optional()
    },
    false,
    ({ key, ...args }) => request(`/api/v2/operator-presets/${encodeURIComponent(key)}`, { method: 'PUT', body: args })
  );

  // 8. Viral Deconstruction & Review (Pilar 4 & 5: Viral Blueprint & Review)
  register(
    'cf_ingest_viral_video',
    'Ingest viral video URL into Deconstruct Lab for AI pattern extraction.',
    {
      url: z.string().url(),
      niche: z.string().max(100).optional(),
      page_source: z.string().max(100).optional()
    },
    false,
    ({ url, ...args }) => request('/api/v2/deconstruct', { body: { urls: url, ...args } })
  );

  register(
    'cf_list_deconstructed_assets',
    'Search finished deconstructed viral video blueprints.',
    {
      q: z.string().max(200).optional(),
      niche: z.string().max(100).optional(),
      limit: z.number().int().min(1).max(50).default(20)
    },
    true,
    args =>
      request(
        `/api/v2/deconstruct?assets=true&${new URLSearchParams(
          Object.entries(args)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        )}`
      )
  );

  register(
    'cf_search_blueprints',
    'Search viral deconstruction blueprints by Facebook Reel URL, TikTok URL, UUID, niche, or topic keyword to retrieve the blueprint UUID and metadata for auto pipeline schedule binding.',
    {
      query: z.string().trim().min(1).max(500),
      niche: z.string().max(100).optional(),
      limit: z.number().int().min(1).max(50).default(10)
    },
    true,
    ({ query, niche, limit }) =>
      request(
        `/api/v2/deconstruct?assets=true&q=${encodeURIComponent(query)}&limit=${limit}${
          niche ? `&niche=${encodeURIComponent(niche)}` : ''
        }`
      )
  );

  register(
    'cf_get_deconstructed_blueprint',
    'Get detailed viral pattern breakdown and storyboard of a deconstructed asset.',
    {
      asset_id: z.string().trim().min(1).max(128)
    },
    true,
    ({ asset_id }) => request(`/api/v2/deconstruct/assets/${encodeURIComponent(asset_id)}`)
  );

  register(
    'cf_get_job_review',
    'Get human-in-the-loop review artifact (script and storyboard) for a pending job.',
    {
      job_id: z.string().trim().min(1).max(128)
    },
    true,
    ({ job_id }) => request(`/api/operator/v1/content-jobs/${encodeURIComponent(job_id)}/review`)
  );

  register(
    'cf_approve_job',
    'Approve pending campaign review items to proceed to production rendering.',
    {
      job_id: z.string().trim().min(1).max(128),
      review_revision: z.number().int().min(1),
      review_sha256: z.string().optional()
    },
    false,
    ({ job_id, ...body }) => request(`/api/operator/v1/content-jobs/${encodeURIComponent(job_id)}/approve`, { body })
  );

  // 9. Publishing & Observability (Pilar 6 & 7: Publishing & Cluster Observability)
  register(
    'cf_list_publishing_accounts',
    'List connected social media publishing accounts (Meta, Repliz, etc.).',
    {
      provider: z.enum(['meta', 'repliz', 'all']).default('all')
    },
    true,
    args => request(`/api/v2/publishing/accounts?${new URLSearchParams(args)}`)
  );

  register(
    'cf_create_publishing_job',
    'Schedule or publish completed content to a social account.',
    {
      account_id: z.string().trim().min(1).max(128),
      campaign_item_id: z.string().trim().min(1).max(128),
      platform: z.enum(['facebook', 'instagram', 'tiktok', 'youtube']),
      scheduled_time: z.string().optional(),
      caption: z.string().max(5000).optional()
    },
    false,
    args => request('/api/v2/publishing/jobs', { body: args })
  );

  register(
    'cf_list_publishing_jobs',
    'Monitor social media publishing job statuses and view live links.',
    {
      status: z.enum(['pending', 'processing', 'completed', 'failed', 'all']).default('all'),
      platform: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(20)
    },
    true,
    args =>
      request(
        `/api/v2/publishing/jobs?${new URLSearchParams(
          Object.entries(args)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        )}`
      )
  );

  register(
    'cf_get_cluster_health',
    'Check real-time health of the 3-node cluster, services, API keys, and queue tasks.',
    {},
    true,
    () => request('/api/v2/system-health')
  );

  register(
    'cf_get_studio_stats',
    'Get overview metrics on content production, stock availability, and publishing counts.',
    {},
    true,
    () => request('/api/v2/dashboard/stats')
  );

  return server;
}

export const createMaknaServer = createCfStudioServer;
