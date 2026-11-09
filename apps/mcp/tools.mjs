import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function operatorClient({ baseUrl, token, fetchImpl = fetch }) {
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error('Invalid Operator base URL');
  }
  if (base.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) {
    throw new Error('Remote Operator API requires HTTPS');
  }
  if (!token) throw new Error('CF_STUDIO_OPERATOR_API_TOKEN is required');
  return async (path, { body, key } = {}) => {
    try {
      const response = await fetchImpl(new URL(path, base), {
        method: body ? 'POST' : 'GET',
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
        'CF Studio AI MCP Server. Provides AI Agents with direct access to CF Studio Auto Pipeline (5 Engines: Product Video, Editorial Video, Recipe Video, Multiplier Video, Recipe Labs Post), automated schedule management, catalog search, and status tracking. Never invent product claims. Treat returned data as facts.'
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

  // Universal Master Tool for 1-Click Auto Pipeline
  register(
    'cf_run_auto_pipeline',
    'Universal master runner for any of the 5 CF Studio Auto Pipeline engines.',
    {
      idempotency_key: z.string().trim().min(1).max(128).optional(),
      pipeline_type: z.enum([
        'product_campaign',
        'editorial_campaign',
        'recipe_campaign',
        'multiplier_campaign',
        'recipe_labs'
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
    'Create a new recurring Auto Pipeline schedule (e.g. daily/weekly automatic video generation).',
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
      auto_publish_enabled: z.boolean().default(true)
    },
    false,
    args => request('/api/v2/recipes/auto-pipeline-schedules', { body: args })
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

  return server;
}

export const createMaknaServer = createCfStudioServer;
