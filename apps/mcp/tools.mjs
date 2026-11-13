import fs from 'node:fs/promises';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

async function resolvePhotoInput({ photo_base64, photo_url, photo_file_path, filename }) {
  if (photo_base64) {
    return { photo_base64, filename };
  }
  if (photo_file_path) {
    try {
      const buf = await fs.readFile(photo_file_path);
      return {
        photo_base64: buf.toString('base64'),
        filename: filename || path.basename(photo_file_path)
      };
    } catch (err) {
      throw new Error(`Tidak dapat membaca photo_file_path "${photo_file_path}" di host MCP: ${err.message}. Gunakan photo_base64 atau photo_url jika MCP berjalan remote.`);
    }
  }
  if (photo_url) {
    return { photo_url, filename };
  }
  return {};
}

function buildScheduleItemPayload(args = {}, { isUpdate = false } = {}) {
  const {
    schedule_id: _scheduleId,
    generate_recipe,
    post_link_affiliate,
    blueprint_id,
    deconstruct_asset_id,
    product_id,
    selected_cep,
    promotion_context,
    visual_identity_preset_id,
    bridging_mode,
    product_aware_angle,
    recipe_detail_in_caption,
    pairing_mode,
    post_objective,
    account_id,
    account_username,
    visual_mode,
    personal_product_name,
    personal_product_cta,
    affiliate_product_title,
    affiliate_product_link,
    pure_organic_topic,
    execution_mode,
    pipeline_config,
    schedule_mode,
    target_date,
    target_item_id,
    ...restArgs
  } = args;

  const resolvedBlueprintId = blueprint_id || deconstruct_asset_id || null;
  const resolvedProductId = bridging_mode === 'none' || pairing_mode === 'no_product'
    ? null
    : (product_id || null);

  const extraConfig = {
    ...(pipeline_config || {}),
    ...(generate_recipe !== undefined ? { generate_recipe } : {}),
    ...(post_link_affiliate !== undefined ? { post_link_affiliate } : {}),
    ...(resolvedBlueprintId ? { blueprint_id: resolvedBlueprintId, deconstruct_asset_id: resolvedBlueprintId } : {}),
    ...(resolvedProductId ? { product_id: resolvedProductId, target_product_id: resolvedProductId } : {}),
    ...(selected_cep !== undefined ? { selected_cep } : {}),
    ...(promotion_context !== undefined ? { promotion_context } : {}),
    ...(visual_identity_preset_id !== undefined ? { visual_identity_preset_id } : {}),
    ...(bridging_mode !== undefined ? { bridging_mode } : {}),
    ...(product_aware_angle !== undefined ? { product_aware_angle } : {}),
    ...(recipe_detail_in_caption !== undefined ? { recipe_detail_in_caption } : {}),
    ...(pairing_mode !== undefined ? { pairing_mode } : {}),
    ...(post_objective !== undefined ? { post_objective } : {}),
    ...(account_id !== undefined ? { account_id } : {}),
    ...(account_username !== undefined ? { account_username } : {}),
    ...(visual_mode !== undefined ? { visual_mode } : {}),
    ...(personal_product_name !== undefined ? { personal_product_name } : {}),
    ...(personal_product_cta !== undefined ? { personal_product_cta } : {}),
    ...(affiliate_product_title !== undefined ? { affiliate_product_title } : {}),
    ...(affiliate_product_link !== undefined ? { affiliate_product_link } : {}),
    ...(pure_organic_topic !== undefined ? { pure_organic_topic } : {}),
    ...(execution_mode ? { execution_mode } : {})
  };

  const resolvedMode = schedule_mode || (target_date ? 'specific_date' : (isUpdate ? undefined : 'recurring'));
  const resolvedTargetItemId = target_item_id || resolvedProductId || resolvedBlueprintId || undefined;

  return {
    ...restArgs,
    ...(resolvedTargetItemId !== undefined ? { target_item_id: resolvedTargetItemId } : {}),
    ...(resolvedMode ? { schedule_mode: resolvedMode } : {}),
    ...(target_date !== undefined ? { target_date } : {}),
    ...(Object.keys(extraConfig).length > 0 ? { pipeline_config_json: extraConfig } : {})
  };
}

function buildScheduleBatchItems(args = {}) {
  if (Array.isArray(args.items) && args.items.length > 0) {
    return args.items.map(item => buildScheduleItemPayload({
      brand_id: args.brand_id,
      pipeline_type: args.pipeline_type,
      generation_time: args.generation_time,
      publish_time: args.publish_time,
      timezone: args.timezone,
      days_of_week: args.days_of_week,
      repliz_account_ids: args.repliz_account_ids,
      auto_publish_enabled: args.auto_publish_enabled,
      schedule_mode: args.schedule_mode,
      target_date: args.target_date,
      post_link_affiliate: args.post_link_affiliate,
      visual_identity_preset_id: args.visual_identity_preset_id,
      ...item
    }));
  }

  if (Array.isArray(args.blueprint_ids) && args.blueprint_ids.length > 0) {
    const productPool = Array.isArray(args.product_ids) && args.product_ids.length > 0
      ? args.product_ids
      : (args.product_id ? [args.product_id] : []);
    const mode = args.pairing_mode || (productPool.length > 1 ? 'rotating_products' : (productPool.length === 1 ? 'single_product' : 'no_product'));
    return args.blueprint_ids.map((bpId, idx) => {
      let assignedProductId = null;
      if (mode === 'single_product') {
        assignedProductId = productPool[0] || null;
      } else if (mode === 'rotating_products' && productPool.length > 0) {
        assignedProductId = productPool[idx % productPool.length];
      }
      const { blueprint_ids: _bps, product_ids: _prods, ...baseArgs } = args;
      return buildScheduleItemPayload({
        ...baseArgs,
        pipeline_type: baseArgs.pipeline_type || 'multiplier_campaign',
        name: args.blueprint_ids.length > 1 ? `${baseArgs.name || 'Multiplier'} #${idx + 1}` : baseArgs.name,
        blueprint_id: bpId,
        product_id: assignedProductId,
        bridging_mode: assignedProductId ? (baseArgs.bridging_mode || 'product_aware_angle') : 'none',
        pairing_mode: mode
      });
    });
  }

  return null;
}

async function fetchPillarStoryboardSummary(request, campaignId) {
  const detail = await request(`/api/v2/pillar-campaigns/${encodeURIComponent(campaignId)}`);
  if (!detail || detail.success === false) return detail;
  const campaign = detail.campaign || {};
  const items = Array.isArray(detail.items) ? detail.items : [];
  const primaryItem = items[0] || null;
  let contentFlowItem = null;
  if (primaryItem?.id) {
    const cfSearch = await request(`/api/content-flow?q=${encodeURIComponent(`opc_${primaryItem.id}`)}`);
    const rows = Array.isArray(cfSearch?.items) ? cfSearch.items : (Array.isArray(cfSearch?.data) ? cfSearch.data : []);
    contentFlowItem = rows.find(r => r.id === `opc_${primaryItem.id}` || String(r.source_item_id) === String(primaryItem.id)) || rows[0] || null;
  }
  return {
    success: true,
    campaign_id: campaign.id || campaignId,
    campaign_name: campaign.campaign_name,
    status: campaign.status,
    execution_mode: campaign.execution_mode,
    approval_mode: campaign.approval_mode,
    target_product_id: campaign.target_product_id || null,
    product_ref_image_path: campaign.product_ref_image_path || null,
    voice_provider: campaign.voice_provider,
    voice_persona: campaign.voice_persona,
    auto_sync_contentflow: Boolean(campaign.auto_sync_contentflow),
    item_id: primaryItem?.id || null,
    workflow_status: primaryItem?.workflow_status || null,
    review_state: primaryItem?.review_state || null,
    review_revision: primaryItem?.review_revision ?? null,
    stages: primaryItem ? {
      generation_status: primaryItem.generation_status,
      start_frame_status: primaryItem.start_frame_status,
      tts_status: primaryItem.tts_status,
      visual_status: primaryItem.visual_status,
      ffmpeg_status: primaryItem.ffmpeg_status,
      upload_status: primaryItem.upload_status
    } : null,
    output: primaryItem ? {
      ffmpeg_output_path: primaryItem.ffmpeg_output_path || null,
      drive_link: primaryItem.drive_link || null,
      nextcloud_url: primaryItem.nextcloud_url || null
    } : null,
    content_flow_item_id: contentFlowItem?.id || null,
    content_flow_video_id: contentFlowItem?.video_id || null,
    content_flow_url_asset: contentFlowItem?.url_asset || null,
    items,
    stats: detail.stats || null
  };
}

async function dispatchPublishingWithLookup(request, args) {
  let contentId = args.content_id || null;
  let mediaUrl = args.media_url || null;
  let itemId = args.item_id || null;
  let fallbackTitle = args.title;
  let fallbackCaption = args.caption;

  let needsContentFlowLookup = Boolean(contentId && !mediaUrl);

  if (!contentId && args.campaign_id) {
    const statusRes = await fetchPillarStoryboardSummary(request, args.campaign_id);
    if (!statusRes?.success) return statusRes;
    itemId = itemId || statusRes.item_id;
    contentId = statusRes.content_flow_item_id || (itemId ? `opc_${itemId}` : null);
    mediaUrl = mediaUrl || statusRes.content_flow_url_asset || statusRes.output?.ffmpeg_output_path || statusRes.output?.nextcloud_url || statusRes.output?.drive_link || null;
    fallbackTitle = fallbackTitle || statusRes.campaign_name;
    if (!statusRes.content_flow_item_id && contentId) {
      needsContentFlowLookup = true;
    }
  }

  if (contentId && needsContentFlowLookup) {
    let cfDetail = await request(`/api/content-flow/${encodeURIComponent(contentId)}`);
    let cfItem = cfDetail?.item || null;
    if (!cfItem && args.trigger_sync_if_missing !== false) {
      await request('/api/content-flow/sync', { method: 'POST', body: {} });
      cfDetail = await request(`/api/content-flow/${encodeURIComponent(contentId)}`);
      cfItem = cfDetail?.item || null;
    }
    if (cfItem) {
      mediaUrl = mediaUrl || cfItem.url_asset || cfItem.nextcloud_url || cfItem.drive_link || null;
      fallbackTitle = fallbackTitle || cfItem.hook || cfItem.campaign_title;
      fallbackCaption = fallbackCaption || cfItem.caption;
    }
  }

  const accountIds = Array.isArray(args.account_ids) && args.account_ids.length > 0
    ? args.account_ids
    : (args.account_id ? [args.account_id] : []);

  if (!contentId) {
    return { success: false, error: 'content_id atau campaign_id wajib diisi.' };
  }
  if (accountIds.length === 0) {
    return { success: false, error: 'account_ids (atau account_id) wajib diisi minimal 1 akun Repliz/Meta.' };
  }

  const mediaType = args.media_type || 'video';
  if (['image', 'video', 'reels'].includes(mediaType) && !mediaUrl) {
    return {
      success: false,
      error: `media_url belum tersedia untuk ${contentId}. Pastikan render FFmpeg selesai dan ContentFlow telah disinkronkan (cf_sync_content_flow).`
    };
  }

  return request('/api/v2/publishing/jobs', {
    body: {
      content_id: contentId,
      account_ids: accountIds,
      media_type: mediaType,
      ...(mediaUrl ? { media_url: mediaUrl } : {}),
      publish_mode: args.publish_mode || 'live',
      scheduled_at: args.scheduled_at || args.scheduled_time || new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      timezone: args.timezone || 'Asia/Jakarta',
      ...(fallbackTitle ? { title: fallbackTitle } : {}),
      ...(fallbackCaption !== undefined ? { caption: fallbackCaption } : {}),
      ...(args.caption_facebook !== undefined ? { caption_facebook: args.caption_facebook } : {}),
      ...(args.caption_bio !== undefined ? { caption_bio: args.caption_bio } : {}),
      ...(args.platform_captions ? { platform_captions: args.platform_captions } : {})
    }
  });
}

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
  return async (path, { body, key, method, tenantOverride, timeoutMs = 120000 } = {}) => {
    try {
      const httpMethod = method || (body ? 'POST' : 'GET');
      const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
      const headers = {
        authorization: `Bearer ${token}`,
        ...(tenantOverride ? { 'x-tenant-override': tenantOverride } : {}),
        ...(key ? { 'idempotency-key': key } : {}),
        ...(body && !isFormData ? { 'content-type': 'application/json' } : {})
      };
      const response = await fetchImpl(new URL(path, base), {
        method: httpMethod,
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
        headers,
        body: body ? (isFormData ? body : JSON.stringify(body)) : undefined
      });
      if (!response.ok) {
        let errorPayload = null;
        try {
          const text = await response.text();
          errorPayload = text ? JSON.parse(text) : null;
        } catch (_) {}
        return {
          success: false,
          status: response.status,
          ...(errorPayload?.code ? { code: errorPayload.code } : {}),
          error: errorPayload?.error || errorPayload?.message || `Operator request rejected (HTTP ${response.status}); check permissions, input, or ID.`,
          ...(errorPayload?.reconnectUrl ? { reconnectUrl: errorPayload.reconnectUrl } : {}),
          ...(errorPayload?.errors ? { details: errorPayload.errors } : {})
        };
      }
      const contentType = response.headers?.get?.('content-type') || '';
      if (contentType.includes('text/markdown') || contentType.includes('text/plain')) {
        const text = await response.text();
        return { success: true, markdown: text };
      }
      return await response.json();
    } catch (err) {
      return {
        success: false,
        error: err?.name === 'TimeoutError'
          ? 'Operator request timed out. For creation, retry with the SAME idempotency_key and identical brief.'
          : 'Operator API unavailable. For creation, retry with the SAME idempotency_key and identical brief.'
      };
    }
  };
}

export function createCfStudioServer(rawRequest) {
  let activeTenantOverride = null;
  const request = (path, opts = {}) => {
    return rawRequest(path, {
      ...opts,
      tenantOverride: opts.tenantOverride || activeTenantOverride
    });
  };

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
  register('cf_whoami', 'Read configured CF Studio operator identity, active tenant, and scopes.', {}, true, async () => {
    const res = await request('/api/operator/v1/whoami');
    if (res && res.operator) {
      res.operator.session_active_tenant = activeTenantOverride || res.operator.tenant_id;
    }
    return res;
  });
  register('makna_whoami', 'Read configured CF Studio operator identity, active tenant, and scopes (legacy alias).', {}, true, async () => {
    const res = await request('/api/operator/v1/whoami');
    if (res && res.operator) {
      res.operator.session_active_tenant = activeTenantOverride || res.operator.tenant_id;
    }
    return res;
  });

  register(
    'cf_list_tenants',
    'List all active tenants in the cluster (e.g. PT GIM Sosmed, SY Benu, Mas Ibnu). Requires master operator or lists accessible tenants.',
    {},
    true,
    async () => {
      return request('/api/v2/tenants');
    }
  );

  register(
    'cf_switch_tenant',
    'Switch the active tenant context for all subsequent operations in this MCP session. Provide tenant ID (e.g. tnt_pt-gim-sosmed_62d0d9) or slug (e.g. pt-gim-sosmed).',
    {
      tenant: z.string().trim().min(1).describe('Tenant ID or slug to switch into')
    },
    false,
    async ({ tenant }) => {
      const check = await rawRequest('/api/v2/tenants', { tenantOverride: tenant });
      if (!check || !check.success) {
        return { success: false, error: check?.error || `Unable to switch to tenant: ${tenant}` };
      }
      activeTenantOverride = check.active_tenant || tenant;
      return {
        success: true,
        message: `Active tenant successfully switched to: ${activeTenantOverride}. All subsequent tools in this session will operate in this tenant.`,
        active_tenant: activeTenantOverride,
        is_master: check.is_master
      };
    }
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
    'Read a campaign job status, progress, and available results. Automatically routes custom storyboards (cst_*) and operator jobs (ocj_*).',
    {
      job_id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/)
    },
    true,
    ({ job_id }) => {
      if (job_id.startsWith('cst_') || job_id.startsWith('opc_') || /^\d+$/.test(job_id)) {
        return fetchPillarStoryboardSummary(request, job_id);
      }
      return request(`/api/operator/v1/content-jobs/${encodeURIComponent(job_id)}`);
    }
  );
  register(
    'makna_get_campaign_status',
    'Read a campaign job status, progress and available results (legacy alias).',
    {
      job_id: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/)
    },
    true,
    ({ job_id }) => {
      if (job_id.startsWith('cst_') || job_id.startsWith('opc_') || /^\d+$/.test(job_id)) {
        return fetchPillarStoryboardSummary(request, job_id);
      }
      return request(`/api/operator/v1/content-jobs/${encodeURIComponent(job_id)}`);
    }
  );

  // 3. Auto Pipeline: Dedicated Engine Tools
  const bridgeSegmentSchema = z.object({
    at_clip: z.number().int().min(1).max(12),
    duration_clips: z.number().int().min(0).max(12).default(1),
    role: z.enum(['intro', 'recall']).optional()
  });

  // Engine 1: Product Video (product_campaign)
  register(
    'cf_create_product_video',
    'Create a 1-Click Product Video campaign showcasing catalog products with CEP triggers, affiliate toggle, voice & visual identity.',
    {
      idempotency_key: z.string().trim().min(1).max(128).optional(),
      brand_id: z.string().max(100).optional(),
      product_id: z.string().max(100).optional(),
      product_title: z.string().trim().min(1).max(300),
      promotion_context: z.string().max(2000).optional(),
      selected_cep: z.string().max(200).optional(),
      visual_identity_preset_id: z.string().max(100).optional(),
      post_link_affiliate: z.boolean().default(true),
      bridge_at_clip: z.number().int().min(1).max(12).optional(),
      bridge_duration_clips: z.number().int().min(0).max(12).optional(),
      bridge_segments: z.array(bridgeSegmentSchema).max(3).optional(),
      voice_provider: z.enum(['gemini', 'minimax', 'elevenlabs']).optional(),
      voice_persona: z.string().max(120).optional(),
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
    'cf_preview_multiplier_angles',
    'Generate 3 AI creative angle options bridging a deconstructed viral blueprint with an optional product before running Multiplier.',
    {
      blueprint_id: z.string().trim().min(1).max(128),
      product_id: z.string().max(100).optional()
    },
    true,
    ({ blueprint_id, product_id }) => {
      const qs = new URLSearchParams({ action: 'get_multiplier_angles', blueprint_id });
      if (product_id) qs.set('product_id', product_id);
      return request(`/api/v2/recipes/autonomous-pipeline?${qs.toString()}`, { timeoutMs: 120000 });
    }
  );

  register(
    'cf_create_multiplier_video',
    'Create a 1-Click Multiplier Video (1 Blueprint + 1 Product or Blueprint-only) remixed from a deconstructed viral blueprint.',
    {
      idempotency_key: z.string().trim().min(1).max(128).optional(),
      brand_id: z.string().max(100).optional(),
      deconstruct_asset_id: z.string().trim().min(1).max(128),
      product_id: z.string().max(100).optional(),
      bridging_mode: z.enum(['select_existing', 'product_aware_angle', 'bridge_injection', 'none']).optional(),
      product_aware_angle: z.boolean().optional(),
      selected_angle: z
        .union([
          z.object({
            title: z.string(),
            hook_text: z.string().optional(),
            vo_preview: z.string().optional()
          }),
          z.number().int().min(0).max(10),
          z.string().max(300),
          z.null()
        ])
        .optional(),
      generate_recipe: z.boolean().default(true),
      post_link_affiliate: z.boolean().default(true),
      visual_identity_preset_id: z.string().max(100).optional(),
      bridge_at_clip: z.number().int().min(1).max(12).optional(),
      bridge_duration_clips: z.number().int().min(0).max(12).optional(),
      bridge_segments: z.array(bridgeSegmentSchema).max(3).optional(),
      preset_key: z.string().max(100).default('multiplier_deconstruct_remix'),
      execution_mode: z.enum(['full_autopilot', 'creative_review']).default('full_autopilot')
    },
    false,
    async ({ idempotency_key, selected_angle, ...args }) => {
      let resolvedAngle = selected_angle ?? null;
      if (typeof selected_angle === 'number') {
        const qs = new URLSearchParams({ action: 'get_multiplier_angles', blueprint_id: args.deconstruct_asset_id });
        if (args.product_id) qs.set('product_id', args.product_id);
        const angleRes = await request(`/api/v2/recipes/autonomous-pipeline?${qs.toString()}`);
        resolvedAngle = Array.isArray(angleRes?.angles) ? (angleRes.angles[selected_angle] || null) : null;
      } else if (typeof selected_angle === 'string' && selected_angle.trim()) {
        resolvedAngle = { title: selected_angle.trim(), hook_text: selected_angle.trim() };
      }
      return request('/api/v2/recipes/autonomous-pipeline', {
        key: idempotency_key,
        body: { pipeline_type: 'multiplier_campaign', selected_angle: resolvedAngle, ...args }
      });
    }
  );

  // Engine 5: Recipe Labs Text & Photo Post (recipe_labs)
  register(
    'cf_create_recipe_labs_post',
    'Create a Recipe Labs social media post: Facebook recipe article + 3-6 AI composite grid images (1:1, 3:4, or 9:16 layout) across 4 commercial photography environments.',
    {
      idempotency_key: z.string().trim().min(1).max(128).optional(),
      brand_id: z.string().max(100).optional(),
      topic: z.string().trim().min(1).max(300),
      target_language: z.enum(['en_US', 'id_ID', 'bilingual']).default('en_US'),
      recipe_classification: z.string().max(200).optional(),
      category: z.string().max(100).default('Makanan'),
      aspect_ratio: z.enum(['1:1', '3:4', '9:16']).default('3:4'),
      visual_style: z
        .enum([
          'Rustic Warm Tabletop & Artisanal Kitchen',
          'Modern Minimalist Nordic Studio',
          'Dark Moody Chiaroscuro & Atmospheric Smoke',
          'Vibrant Alfresco Sunlit Patio'
        ])
        .or(z.string().max(100))
        .default('Modern Minimalist Nordic Studio'),
      images_per_recipe: z.number().int().min(3).max(6).default(4),
      selected_layout_id: z
        .enum([
          '3_split_left',
          '3_split_right',
          '4_editorial_split',
          '4_modern_masonry',
          '5_pentagon_grid',
          '6_magazine_spread'
        ])
        .or(z.string().max(100))
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

  const storyboardVideoDnaSchema = z.object({
    aspect_ratio: z.enum(['9:16', '16:9', '1:1']).default('9:16'),
    visual_style: z.string().default('Cinematic'),
    visual_mode: z.enum(['hybrid_lock', 'pure_t2v']).default('hybrid_lock'),
    video_model: z.enum(['veo_31_lite', 'omni_flash']).optional(),
    face_visibility: z.string().optional(),
    narrative_mode: z.string().optional(),
    voice_provider: z.enum(['gemini', 'minimax', 'elevenlabs']).default('gemini'),
    voice_persona: z.string().default('Aoede'),
    elevenlabs_model: z.string().optional(),
    elevenlabs_stability: z.number().min(0).max(1).optional(),
    elevenlabs_similarity_boost: z.number().min(0).max(1).optional(),
    voice_speed: z.number().optional(),
    speed_control: z.number().optional(),
    voice_volume: z.number().optional(),
    target_language: z.string().default('id-ID'),
    words_per_clip: z.union([z.number(), z.string()]).optional(),
    clip_duration: z.number().min(1).max(15).optional(),
    target_ai_engine: z.string().default('Google Veo (8s)'),
    visual_identity_preset_id: z.string().max(100).optional(),
    enable_audio_segment: z.boolean().optional(),
    sfx_setting: z.string().optional(),
    enable_motion_text: z.boolean().default(true),
    motion_text_style: z.string().default('floating_white_yellow'),
    motion_text_position: z.string().default('bottom'),
    video_transition: z.string().default('fade'),
    transition_duration: z.number().default(0.5),
    enable_sfx: z.boolean().optional(),
    enable_bgm: z.boolean().optional(),
    ffmpeg_sfx_volume: z.number().optional(),
    ffmpeg_bgm_volume: z.number().optional(),
    ffmpeg_sync_option: z.string().optional(),
    bridge_at_clip: z.number().int().min(1).max(12).optional(),
    bridge_duration_clips: z.number().int().min(0).max(12).optional(),
    bridge_segments: z.array(bridgeSegmentSchema).max(3).optional()
  });

  const storyboardSceneSchema = z.object({
    scene_index: z.number().int().min(1).max(12).optional(),
    voiceover_text: z.string().trim().min(1),
    visual_action: z.string().trim().min(1).optional(),
    visual_description: z.string().trim().min(1).optional(),
    visual_prompt: z.string().trim().min(1).optional(),
    scene_role: z.enum(['hook', 'problem', 'mechanism', 'intro_product', 'gap', 'recall_product', 'cta', 'conclusion']).optional(),
    setting_hint: z.string().max(300).optional(),
    product_visible: z.boolean().optional(),
    audio_mood: z.string().max(200).optional(),
    i2v_prompt: z.string().optional(),
    camera_movement: z.string().optional(),
    duration_seconds: z.number().min(1).max(15).default(8)
  }).refine(
    s => Boolean(s.visual_action || s.visual_description || s.visual_prompt),
    { message: 'Setiap scene wajib mengisi minimal salah satu dari visual_action, visual_description, atau visual_prompt.' }
  );

  const storyboardSocialSchema = z.object({
    title: z.string().optional(),
    caption: z.string().optional(),
    hashtags: z.array(z.string()).optional(),
    caption_facebook: z.string().optional(),
    caption_bio: z.string().optional()
  });

  const singleStoryboardFields = {
    brand_id: z.string().max(100).optional(),
    preset_key: z.string().trim().min(1).max(100).optional(),
    prompt_mode: z.enum(['gemini_engineer', 'direct_passthrough']).default('gemini_engineer'),
    product_id: z.string().max(100).optional(),
    product_name: z.string().max(300).optional(),
    require_product_photo: z.boolean().optional(),
    enable_social_post: z.boolean().optional(),
    auto_sync_contentflow: z.boolean().optional(),
    post_link_affiliate: z.boolean().optional(),
    visual_identity_preset_id: z.string().max(100).optional(),
    content_pillar: z.string().max(200).optional(),
    creative_brief: z.string().max(1000).optional(),
    narrative_mode: z.string().max(80).optional(),
    ai_directive: z.string().max(1000).optional(),
    mandatory_outro_line: z.string().max(300).optional(),
    is_bridging_active: z.boolean().optional(),
    bridge_at_clip: z.number().int().min(1).max(12).optional(),
    bridge_duration_clips: z.number().int().min(0).max(12).optional(),
    bridge_segments: z.array(bridgeSegmentSchema).max(3).optional(),
    title: z.string().trim().min(1).max(300).optional(),
    video_dna: storyboardVideoDnaSchema.optional(),
    scenes: z.array(storyboardSceneSchema).min(1).max(12).optional(),
    social_media_package: storyboardSocialSchema.optional(),
    execution_mode: z.enum(['full_autopilot', 'creative_review']).default('full_autopilot')
  };

  // Engine 6: Custom Storyboard Submission (Claude / External AI to Video Pipeline + Batch up to 12)
  register(
    'cf_submit_custom_storyboard',
    'Submit 1 or a batch (up to 12) of custom storyboards. In default prompt_mode="gemini_engineer", send preset_key + title + scenes (voiceover_text, visual_action/visual_description, optional camera_movement/scene_role/setting_hint/product_visible/audio_mood) + optional product_id/brand_id/creative_brief; Gemini AI locks your VO and engineers full t2i/i2v prompts before Start Frame & Veo rendering. Use prompt_mode="direct_passthrough" only for raw pre-engineered prompts.',
    {
      idempotency_key: z.string().trim().min(1).max(128).optional(),
      ...singleStoryboardFields,
      items: z.array(z.object({
        idempotency_key: z.string().trim().min(1).max(128).optional(),
        ...singleStoryboardFields,
        title: z.string().trim().min(1).max(300),
        scenes: z.array(storyboardSceneSchema).min(1).max(12)
      })).min(1).max(12).optional()
    },
    false,
    ({ idempotency_key, items, execution_mode, ...storyboard }) => {
      if (Array.isArray(items) && items.length > 0) {
        return request('/api/v2/recipes/autonomous-pipeline', {
          key: idempotency_key,
          timeoutMs: 120000,
          body: {
            pipeline_type: 'custom_storyboard',
            brand_id: storyboard.brand_id,
            preset_key: storyboard.preset_key,
            prompt_mode: storyboard.prompt_mode,
            execution_mode,
            idempotency_key,
            items
          }
        });
      }
      if (!storyboard.title || !Array.isArray(storyboard.scenes) || storyboard.scenes.length === 0) {
        return { success: false, error: 'Sertakan (title + scenes) untuk single storyboard atau array items (1-12) untuk batch.' };
      }
      return request('/api/v2/recipes/autonomous-pipeline', {
        key: idempotency_key,
        timeoutMs: 120000,
        body: {
          pipeline_type: 'custom_storyboard',
          execution_mode,
          idempotency_key,
          storyboard
        }
      });
    }
  );

  register(
    'cf_get_storyboard_status',
    'Poll full production progress (TTS, Start Frame, Veo, FFmpeg, Upload, ContentFlow sync, and review_revision) for a custom storyboard or OPC campaign (cst_*/opc).',
    {
      campaign_id: z.string().trim().min(1).max(128)
    },
    true,
    ({ campaign_id }) => fetchPillarStoryboardSummary(request, campaign_id)
  );

  register(
    'cf_approve_storyboard',
    'Approve (or save edits to) a creative_review custom storyboard or OPC campaign item so production rendering starts. Auto-fetches review_revision and plan if omitted.',
    {
      item_id: z.union([z.number().int(), z.string().trim().min(1)]).optional(),
      campaign_id: z.string().trim().min(1).max(128).optional(),
      review_revision: z.string().optional(),
      only_save: z.boolean().default(false),
      new_video_plan: z.array(z.record(z.any())).optional(),
      video_dna: z.record(z.any()).optional(),
      tiktok_caption: z.string().optional(),
      ig_caption: z.string().optional(),
      yt_title: z.string().optional(),
      yt_desc: z.string().optional(),
      voice_provider: z.enum(['gemini', 'minimax', 'elevenlabs']).optional(),
      voice_persona: z.string().optional(),
      voice_speed: z.number().optional(),
      voice_volume: z.number().optional()
    },
    false,
    async ({ item_id, campaign_id, ...body }) => {
      let resolvedItemId = item_id;
      let resolvedRevision = body.review_revision;
      let resolvedPlan = body.new_video_plan;
      let resolvedDna = body.video_dna;

      if (campaign_id && (!resolvedItemId || resolvedRevision === undefined || !resolvedPlan)) {
        const detail = await request(`/api/v2/pillar-campaigns/${encodeURIComponent(campaign_id)}`);
        if (!detail || detail.success === false) return detail;
        const firstItem = Array.isArray(detail.items) ? detail.items[0] : null;
        if (!firstItem) return { success: false, error: `Tidak ditemukan item pada campaign ${campaign_id}.` };
        resolvedItemId = resolvedItemId || firstItem.id;
        resolvedRevision = resolvedRevision !== undefined ? resolvedRevision : (firstItem.review_revision || '');
        if (!resolvedPlan) {
          try { resolvedPlan = JSON.parse(firstItem.new_video_plan_json || '[]'); } catch { resolvedPlan = []; }
        }
        if (!resolvedDna) {
          try { resolvedDna = JSON.parse(firstItem.video_dna_json || '{}'); } catch { resolvedDna = {}; }
        }
      }

      if (!resolvedItemId) {
        return { success: false, error: 'Sertakan item_id atau campaign_id.' };
      }

      return request(`/api/v2/pillar-campaigns/items/${encodeURIComponent(String(resolvedItemId))}/approve`, {
        body: {
          ...body,
          ...(resolvedRevision !== undefined ? { review_revision: resolvedRevision } : {}),
          ...(resolvedPlan ? { new_video_plan: resolvedPlan } : {}),
          ...(resolvedDna ? { video_dna: resolvedDna } : {})
        }
      });
    }
  );

  // Universal Master Tool for 1-Click Auto Pipeline
  register(
    'cf_run_auto_pipeline',
    'Universal master runner for any of the CF Studio Auto Pipeline engines (product, editorial, recipe, multiplier, threads_series, recipe_labs, custom_storyboard).',
    {
      idempotency_key: z.string().trim().min(1).max(128).optional(),
      pipeline_type: z.enum([
        'product_campaign',
        'editorial_campaign',
        'recipe_campaign',
        'multiplier_campaign',
        'threads_series',
        'recipe_labs',
        'custom_storyboard'
      ]),
      brand_id: z.string().max(100).optional(),
      topic: z.string().max(300).optional(),
      target_language: z.enum(['en_US', 'id_ID', 'bilingual']).optional(),
      recipe_classification: z.string().max(200).optional(),
      aspect_ratio: z.enum(['1:1', '3:4', '9:16']).optional(),
      visual_style: z.string().max(100).optional(),
      images_per_recipe: z.number().int().min(3).max(6).optional(),
      selected_layout_id: z.string().max(100).optional(),
      product_id: z.string().max(100).optional(),
      product_title: z.string().max(300).optional(),
      content_pillar: z.string().max(300).optional(),
      deconstruct_asset_id: z.string().max(128).optional(),
      bridging_mode: z.enum(['select_existing', 'product_aware_angle', 'bridge_injection', 'none']).optional(),
      product_aware_angle: z.boolean().optional(),
      post_link_affiliate: z.boolean().optional(),
      visual_identity_preset_id: z.string().max(100).optional(),
      category: z.string().max(100).optional(),
      selected_angle: z.union([z.record(z.any()), z.string().max(300), z.null()]).optional(),
      generate_recipe: z.boolean().optional(),
      preset_key: z.string().max(100).optional(),
      bridge_at_clip: z.number().int().min(1).max(12).optional(),
      bridge_duration_clips: z.number().int().min(0).max(12).optional(),
      bridge_segments: z.array(bridgeSegmentSchema).max(3).optional(),
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

  // 4. Schedule Management & FIFO Queue Tools
  const schedulePipelineTypeEnum = z.enum([
    'product_campaign',
    'editorial_campaign',
    'recipe_campaign',
    'multiplier_campaign',
    'threads_series',
    'recipe_labs'
  ]);

  const scheduleExtendedFields = {
    name: z.string().trim().min(1).max(300).optional(),
    pipeline_type: schedulePipelineTypeEnum.optional(),
    brand_id: z.string().max(100).optional(),
    preset_key: z.string().max(100).optional(),
    topic: z.string().max(300).optional(),
    category: z.string().max(100).optional(),
    target_item_id: z.string().max(100).optional(),
    target_item_title: z.string().max(300).optional(),
    product_id: z.string().max(100).optional(),
    selected_cep: z.string().max(200).optional(),
    promotion_context: z.string().max(2000).optional(),
    visual_identity_preset_id: z.string().max(100).optional(),
    generation_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    publish_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    days_of_week: z.array(z.number().int().min(0).max(6)).optional(),
    schedule_mode: z.enum(['recurring', 'specific_date']).optional(),
    target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD').optional(),
    timezone: z.string().optional(),
    auto_publish_enabled: z.boolean().optional(),
    repliz_account_ids: z.array(z.string()).optional(),
    generate_recipe: z.boolean().optional(),
    recipe_detail_in_caption: z.boolean().optional(),
    post_link_affiliate: z.boolean().optional(),
    blueprint_id: z.string().max(100).optional(),
    deconstruct_asset_id: z.string().max(100).optional(),
    bridging_mode: z.enum(['select_existing', 'product_aware_angle', 'bridge_injection', 'none']).optional(),
    product_aware_angle: z.boolean().optional(),
    pairing_mode: z.enum(['single_product', 'rotating_products', 'no_product']).optional(),
    post_objective: z.enum(['personal_product', 'affiliate_recommendation', 'pure_organic']).optional(),
    account_id: z.string().max(100).optional(),
    account_username: z.string().max(150).optional(),
    visual_mode: z.enum(['glabs', 'imagen', 'none']).optional(),
    personal_product_name: z.string().max(200).optional(),
    personal_product_cta: z.string().max(500).optional(),
    affiliate_product_title: z.string().max(200).optional(),
    affiliate_product_link: z.string().max(500).optional(),
    pure_organic_topic: z.string().max(500).optional(),
    execution_mode: z.enum(['full_autopilot', 'semi_autopilot']).optional(),
    pipeline_config: z.record(z.any()).optional()
  };

  register(
    'cf_list_schedules',
    'List recurring or specific-date Auto Pipeline schedules in the tenant with their status, target date, and execution metrics.',
    {
      status: z.enum(['active', 'paused', 'all']).default('all'),
      pipeline_type: z
        .enum(['product_campaign', 'editorial_campaign', 'recipe_campaign', 'multiplier_campaign', 'threads_series', 'recipe_labs', 'all'])
        .default('all'),
      brand_id: z.string().max(100).optional(),
      schedule_mode: z.enum(['recurring', 'specific_date', 'all']).default('all'),
      target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD').optional()
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
    'Create single or batch Auto Pipeline schedules (Product Video, Multiplier + Product with 1 Produk Andalan or Multi-Produk Bergilir, Recipe, Editorial, Threads Series, Recipe Labs) with recurring or specific_date cadence.',
    {
      ...scheduleExtendedFields,
      blueprint_ids: z.array(z.string().max(100)).optional(),
      product_ids: z.array(z.string().max(100)).optional(),
      items: z.array(z.object(scheduleExtendedFields)).min(1).max(30).optional()
    },
    false,
    args => {
      const batchItems = buildScheduleBatchItems(args);
      if (batchItems) {
        return request('/api/v2/recipes/auto-pipeline-schedules', { body: { items: batchItems } });
      }
      if (!args.brand_id || !args.name) {
        return { success: false, error: 'name dan brand_id wajib diisi untuk pembuatan jadwal tunggal (atau kirim array items).' };
      }
      const payload = buildScheduleItemPayload({
        pipeline_type: 'recipe_campaign',
        preset_key: 'habitfolk_6clips_quick',
        category: 'makanan_utama',
        generation_time: '05:00',
        publish_time: '09:00',
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
        timezone: 'Asia/Jakarta',
        auto_publish_enabled: true,
        repliz_account_ids: [],
        execution_mode: 'full_autopilot',
        ...args
      });
      return request('/api/v2/recipes/auto-pipeline-schedules', { body: payload });
    }
  );

  register(
    'cf_update_schedule',
    'Update an existing Auto Pipeline schedule (target_date, schedule_mode, product_id, CEP, promotion_context, Multiplier pairing, times, preset, publish accounts, or status).',
    {
      schedule_id: z.string().trim().min(1).max(128),
      ...scheduleExtendedFields,
      status: z.enum(['active', 'paused', 'archived']).optional()
    },
    false,
    args => {
      const payload = buildScheduleItemPayload(args, { isUpdate: true });
      return request(`/api/v2/recipes/auto-pipeline-schedules/${encodeURIComponent(args.schedule_id)}`, {
        body: payload,
        method: 'PUT'
      });
    }
  );

  register(
    'cf_get_pipeline_queue',
    'Inspect the Auto Pipeline FIFO execution queue (pending, processing, completed, failed jobs) and summary metrics.',
    {
      status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled', 'all']).default('all'),
      limit: z.number().int().min(1).max(100).default(30)
    },
    true,
    args => request(`/api/v2/recipes/autonomous-pipeline/queue?status=${encodeURIComponent(args.status)}&limit=${args.limit}`)
  );

  register(
    'cf_cancel_pipeline_job',
    'Cancel a pending Auto Pipeline job in the FIFO execution queue.',
    {
      job_id: z.string().trim().min(1).max(128)
    },
    false,
    ({ job_id }) => request('/api/v2/recipes/autonomous-pipeline/queue', { body: { action: 'cancel', job_id } })
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
    'Register a new product into the tenant catalog, optionally uploading a raw product photo (via photo_base64, photo_url, or local photo_file_path) and queuing AI clean photo generation.',
    {
      product_name: z.string().trim().min(1).max(300),
      product_description: z.string().max(12000).optional(),
      raw_description: z.string().max(12000).optional(),
      category: z.string().max(100).optional(),
      unique_selling_point: z.string().max(2000).optional(),
      tags: z.string().max(500).optional(),
      affiliate_link: z.string().max(1000).optional(),
      source_url: z.string().max(1000).optional(),
      packaging_type: z.string().max(100).optional(),
      is_in_packaging: z.boolean().optional(),
      target_audience: z.string().max(2000).optional(),
      pain_point_solved: z.string().max(2000).optional(),
      photo_base64: z.string().optional(),
      photo_filename: z.string().max(255).optional(),
      photo_url: z.string().max(2000).optional(),
      photo_file_path: z.string().max(1000).optional(),
      active_photo: z.enum(['raw_photo_url', 'clean_photo_url']).optional(),
      auto_enrich_clean_photo: z.boolean().default(true)
    },
    false,
    async ({ photo_base64, photo_filename, photo_url, photo_file_path, ...args }) => {
      try {
        const photoData = await resolvePhotoInput({
          photo_base64,
          photo_url,
          photo_file_path,
          filename: photo_filename
        });
        return request('/api/v2/products', {
          timeoutMs: 120000,
          body: {
            ...args,
            ...(photoData.photo_base64 ? { photo_base64: photoData.photo_base64 } : {}),
            ...(photoData.photo_url ? { photo_url: photoData.photo_url } : {}),
            ...(photoData.filename ? { photo_filename: photoData.filename } : {})
          }
        });
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
  );

  register(
    'cf_upload_product_photo',
    'Upload or replace the raw or clean photo for an existing catalog product (supports photo_base64, photo_url, or local photo_file_path).',
    {
      product_id: z.string().trim().min(1).max(128),
      type: z.enum(['raw', 'clean']).default('raw'),
      photo_base64: z.string().optional(),
      photo_url: z.string().max(2000).optional(),
      photo_file_path: z.string().max(1000).optional(),
      filename: z.string().max(255).optional(),
      active_photo: z.enum(['raw_photo_url', 'clean_photo_url']).optional()
    },
    false,
    async ({ product_id, type, photo_base64, photo_url, photo_file_path, filename, active_photo }) => {
      try {
        const photoData = await resolvePhotoInput({ photo_base64, photo_url, photo_file_path, filename });
        if (!photoData.photo_base64 && !photoData.photo_url) {
          return { success: false, error: 'Sertakan salah satu dari photo_base64, photo_url, atau photo_file_path.' };
        }
        return request('/api/v2/products/image', {
          timeoutMs: 120000,
          body: {
            productId: product_id,
            type,
            ...(active_photo ? { active_photo } : {}),
            ...photoData
          }
        });
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
  );

  register(
    'cf_regenerate_product_photo',
    'Queue AI Studio regeneration of clean white-background product photos (clean_photo_url) from raw product photos.',
    {
      product_ids: z.array(z.string().trim().min(1).max(128)).min(1).max(50),
      provider: z.string().max(50).optional()
    },
    false,
    ({ product_ids, provider }) =>
      request('/api/v2/products/regenerate-photos', {
        body: { ids: product_ids, ...(provider ? { provider } : {}) }
      })
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
    'Approve pending campaign review items (operator jobs ocj_* or custom storyboards cst_*) to proceed to production rendering.',
    {
      job_id: z.string().trim().min(1).max(128),
      review_revision: z.union([z.number().int().min(1), z.string()]).optional(),
      review_sha256: z.string().optional()
    },
    false,
    ({ job_id, review_revision, ...body }) => {
      if (job_id.startsWith('cst_') || job_id.startsWith('opc_') || /^\d+$/.test(job_id)) {
        return fetchPillarStoryboardSummary(request, job_id).then(summary => {
          if (!summary?.success) return summary;
          const targetItemId = summary.item_id;
          if (!targetItemId) return { success: false, error: `Tidak ditemukan item pada ${job_id}.` };
          return request(`/api/v2/pillar-campaigns/items/${encodeURIComponent(String(targetItemId))}/approve`, {
            body: {
              review_revision: review_revision !== undefined ? String(review_revision) : (summary.review_revision || ''),
              new_video_plan: summary.items?.[0]?.new_video_plan_json ? JSON.parse(summary.items[0].new_video_plan_json) : [],
              video_dna: summary.items?.[0]?.video_dna_json ? JSON.parse(summary.items[0].video_dna_json) : {}
            }
          });
        });
      }
      return request(`/api/operator/v1/content-jobs/${encodeURIComponent(job_id)}/approve`, {
        body: { review_revision, ...body }
      });
    }
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
    'Schedule or publish completed content to Repliz/Meta accounts. Accepts content_id (or campaign_id for storyboard auto-lookup), account_ids array, media_type, optional media_url (auto-resolved from ContentFlow if omitted), and scheduled_at ISO.',
    {
      content_id: z.string().trim().min(1).max(128).optional(),
      campaign_id: z.string().trim().min(1).max(128).optional(),
      item_id: z.union([z.number().int(), z.string()]).optional(),
      account_ids: z.array(z.string().trim().min(1)).optional(),
      account_id: z.string().trim().min(1).max(128).optional(),
      media_type: z.enum(['video', 'reels', 'image', 'text_only']).default('video'),
      media_url: z.string().max(2000).optional(),
      scheduled_at: z.string().optional(),
      scheduled_time: z.string().optional(),
      timezone: z.string().default('Asia/Jakarta'),
      publish_mode: z.enum(['live', 'draft', 'now']).default('live'),
      title: z.string().max(300).optional(),
      caption: z.string().max(5000).optional(),
      caption_facebook: z.string().max(5000).optional(),
      caption_bio: z.string().max(5000).optional(),
      platform_captions: z.record(z.string()).optional(),
      trigger_sync_if_missing: z.boolean().default(true)
    },
    false,
    args => dispatchPublishingWithLookup(request, args)
  );

  register(
    'cf_publish_storyboard',
    'Publish a completed custom storyboard or OPC campaign directly to Repliz social accounts (resolves OPC item -> syncs ContentFlow if missing -> dispatches Repliz job).',
    {
      campaign_id: z.string().trim().min(1).max(128),
      item_id: z.union([z.number().int(), z.string()]).optional(),
      account_ids: z.array(z.string().trim().min(1)).min(1),
      media_type: z.enum(['video', 'reels', 'image']).default('video'),
      media_url: z.string().max(2000).optional(),
      scheduled_at: z.string().optional(),
      timezone: z.string().default('Asia/Jakarta'),
      publish_mode: z.enum(['live', 'draft', 'now']).default('live'),
      title: z.string().max(300).optional(),
      caption: z.string().max(5000).optional(),
      caption_facebook: z.string().max(5000).optional(),
      caption_bio: z.string().max(5000).optional(),
      platform_captions: z.record(z.string()).optional(),
      trigger_sync_if_missing: z.boolean().default(true)
    },
    false,
    args => dispatchPublishingWithLookup(request, args)
  );

  register(
    'cf_retry_publishing_job',
    'Retry a failed social media publishing job (optionally confirming Repliz account reconnect).',
    {
      job_id: z.string().trim().min(1).max(128),
      confirmed_reconnect: z.boolean().default(false)
    },
    false,
    ({ job_id, confirmed_reconnect }) =>
      request(`/api/v2/publishing/jobs/${encodeURIComponent(job_id)}/retry`, {
        body: { confirmedReconnect: confirmed_reconnect }
      })
  );

  register(
    'cf_cancel_publishing_job',
    'Cancel a scheduled or pending publishing job (also removes remote Repliz schedule when applicable).',
    {
      job_id: z.string().trim().min(1).max(128),
      reason: z.string().max(500).optional()
    },
    false,
    ({ job_id, reason }) =>
      request(`/api/v2/publishing/jobs/${encodeURIComponent(job_id)}`, {
        method: 'PATCH',
        body: { action: 'cancel', ...(reason ? { reason } : {}) }
      })
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

  // ==========================================
  // 10. BRAND PROFILES, CONTENTFLOW & LABS PARITY
  // ==========================================

  register(
    'cf_list_brand_profiles',
    'List brand profiles available in the active tenant (needed to obtain brand_id for Auto Pipeline, Storyboards, and Schedules).',
    {},
    true,
    () => request('/api/v2/brand-profiles')
  );

  register(
    'cf_get_brand_profile',
    'Get detailed configuration of a specific brand profile (voice defaults, storage targets, visual signature).',
    {
      brand_id: z.string().trim().min(1).max(128)
    },
    true,
    ({ brand_id }) => request(`/api/v2/brand-profiles/${encodeURIComponent(brand_id)}`)
  );

  register(
    'cf_create_brand_profile',
    'Create a new brand profile in the active tenant.',
    {
      brand_name: z.string().trim().min(1).max(200),
      visual_signature: z.string().trim().min(1).max(4000),
      tone_of_voice: z.string().max(1000).optional(),
      raw_guideline_text: z.string().max(12000).optional(),
      storage_provider: z.enum(['nextcloud', 'gdrive']).optional(),
      nextcloud_target_folder: z.string().max(300).optional(),
      drive_target_folder: z.string().max(300).optional()
    },
    false,
    body => request('/api/v2/brand-profiles', { body })
  );

  register(
    'cf_update_brand_profile',
    'Update an existing brand profile in the active tenant.',
    {
      brand_id: z.string().trim().min(1).max(128),
      updates: z.record(z.any())
    },
    false,
    ({ brand_id, updates }) =>
      request(`/api/v2/brand-profiles/${encodeURIComponent(brand_id)}`, {
        method: 'PUT',
        body: updates
      })
  );

  register(
    'cf_list_content_flow',
    'List finished video/image assets in ContentFlow Hub ready for publishing (returns content_id, video_id, url_asset, affiliate links, and captions).',
    {
      q: z.string().max(200).optional(),
      source_type: z.string().max(50).optional(),
      account: z.string().max(100).optional(),
      pipeline_status: z.string().max(50).optional(),
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(30)
    },
    true,
    args =>
      request(
        `/api/content-flow?${new URLSearchParams(
          Object.entries(args)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        )}`
      )
  );

  register(
    'cf_sync_content_flow',
    'Trigger immediate synchronization of completed OPC / Multiplier / Auto Pipeline outputs into ContentFlow Hub.',
    {},
    false,
    () => request('/api/content-flow/sync', { method: 'POST', body: {} })
  );

  register(
    'cf_get_deconstruct_status',
    'Check processing progress and extracted assets of a viral deconstruction batch.',
    {
      batch_id: z.string().trim().min(1).max(128)
    },
    true,
    ({ batch_id }) => request(`/api/v2/deconstruct/${encodeURIComponent(batch_id)}`)
  );

  register(
    'cf_list_multiplier_tasks',
    'List Multiplier Lab production tasks (optionally filtered by batch_id) along with video task status and ContentFlow sync state.',
    {
      batch_id: z.string().max(128).optional()
    },
    true,
    ({ batch_id }) =>
      request(`/api/v2/multiplier${batch_id ? `?batchId=${encodeURIComponent(batch_id)}` : ''}`)
  );

  register(
    'cf_retry_multiplier_task',
    'Retry a failed Multiplier Lab task back into pending_resolution queue.',
    {
      task_id: z.string().trim().min(1).max(128)
    },
    false,
    ({ task_id }) => request('/api/v2/multiplier', { method: 'PATCH', body: { action: 'retry_task', taskId: task_id } })
  );

  register(
    'cf_list_threads_series',
    'List generated and scheduled Threads Series posts in the tenant.',
    {
      limit: z.number().int().min(1).max(100).default(30)
    },
    true,
    ({ limit }) => request(`/api/v2/threads-series?limit=${limit}`)
  );

  register(
    'cf_create_threads_series',
    'Create and optionally publish a multi-post Threads Series (personal product, affiliate recommendation, or pure organic educational series).',
    {
      account_id: z.string().max(100).optional(),
      account_username: z.string().max(150).optional(),
      post_objective: z.enum(['personal_product', 'affiliate_recommendation', 'pure_organic']).default('personal_product'),
      personal_product_name: z.string().max(200).optional(),
      personal_product_cta: z.string().max(500).optional(),
      affiliate_product_title: z.string().max(200).optional(),
      affiliate_product_link: z.string().max(500).optional(),
      pure_organic_topic: z.string().max(500).optional(),
      visual_mode: z.enum(['glabs', 'imagen', 'none']).default('glabs'),
      auto_publish: z.boolean().default(true),
      publish_time: z.string().optional()
    },
    false,
    body => request('/api/v2/threads-series', { body })
  );

  // ==========================================
  // THREADS LABS (SOCIAL SELLING & REPLIZ API)
  // ==========================================

  register(
    'cf_threads_labs_list_accounts',
    'List all connected Threads accounts from Repliz and display currently selected active account.',
    {},
    true,
    () => request('/api/v2/threads-radar/accounts')
  );

  register(
    'cf_threads_labs_sync_accounts',
    'Force sync connected Threads accounts directly from Repliz API and update local cache.',
    {},
    false,
    () => request('/api/v2/threads-radar/accounts/sync', { method: 'POST' })
  );

  register(
    'cf_threads_labs_select_account',
    'Select active Threads account to be used for radar scanning and comment publishing.',
    {
      account_id: z.string().trim().min(1)
    },
    false,
    ({ account_id }) => request('/api/v2/threads-radar/accounts/select', {
      method: 'POST',
      body: { accountId: account_id }
    })
  );

  register(
    'cf_threads_labs_scan',
    'Scan Threads content via Repliz API based on active keywords and trigger AI Shopee affiliate product matching.',
    {},
    false,
    () => request('/api/v2/threads-radar/scan', { method: 'POST' })
  );

  register(
    'cf_threads_labs_list_opportunities',
    'List discovered user posts/complaints from Threads with AI matched Shopee products and natural reply drafts.',
    {
      status: z.enum(['all', 'ready', 'posted']).default('all'),
      limit: z.number().int().min(1).max(50).default(20)
    },
    true,
    args => request(`/api/v2/threads-radar/opportunities?status=${args.status}&limit=${args.limit}`)
  );

  register(
    'cf_threads_labs_approve_reply',
    'Approve and post an AI reply to Threads via Repliz API with product photo and affiliate link.',
    {
      draft_id: z.string().trim().min(1),
      custom_reply_text: z.string().optional()
    },
    false,
    ({ draft_id, custom_reply_text }) =>
      request(`/api/v2/threads-radar/reply/${encodeURIComponent(draft_id)}`, {
        method: 'POST',
        body: custom_reply_text ? { customText: custom_reply_text } : {}
      })
  );

  register(
    'cf_threads_labs_manage_keywords',
    'Manage Threads Labs monitoring keywords (list, add, or delete).',
    {
      action: z.enum(['list', 'add', 'delete']).default('list'),
      keyword: z.string().optional(),
      id: z.string().optional()
    },
    false,
    async args => {
      if (args.action === 'add') {
        return request('/api/v2/threads-radar/keywords', { method: 'POST', body: { keyword: args.keyword } });
      }
      if (args.action === 'delete') {
        return request(`/api/v2/threads-radar/keywords?id=${encodeURIComponent(args.id)}`, { method: 'DELETE' });
      }
      return request('/api/v2/threads-radar/keywords');
    }
  );

  register(
    'cf_threads_labs_get_schedule',
    'Get current automated Threads Labs scanning schedule, active days (Senin-Minggu), hours, and next execution time.',
    {},
    true,
    () => request('/api/v2/threads-radar/schedule')
  );

  register(
    'cf_threads_labs_update_schedule',
    'Update automated scanning schedule for Threads Labs (active days, specific hours or interval).',
    {
      is_active: z.boolean().optional(),
      schedule_mode: z.enum(['specific', 'interval']).optional(),
      active_days: z.array(z.string()).optional(),
      specific_hours: z.array(z.string()).optional(),
      interval_hours: z.number().int().optional()
    },
    false,
    body => request('/api/v2/threads-radar/schedule', { method: 'POST', body })
  );

  return server;
}

export const createMaknaServer = createCfStudioServer;
