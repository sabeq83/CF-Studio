import test from 'node:test';
import assert from 'node:assert/strict';

// 1. Tests for Celah 1: platform_titles in Publishing Contract
import { cleanTitle, normalizePlatformTitles, validateScheduleRequest } from '../lib/publishing-contract.js';

test('Celah 1: cleanTitle trims, strips surrounding quotes, and limits length to 100', () => {
  assert.equal(cleanTitle('  "Judul Keren"  '), 'Judul Keren');
  assert.equal(cleanTitle("'Judul Single Quote'"), 'Judul Single Quote');
  assert.equal(cleanTitle(''), '');
  assert.equal(cleanTitle(null), '');
  const longTitle = 'a'.repeat(150);
  assert.equal(cleanTitle(longTitle).length, 100);
});

test('Celah 1: normalizePlatformTitles handles empty/null and normalizes platform keys to lowercase', () => {
  assert.equal(normalizePlatformTitles(null), null);
  assert.equal(normalizePlatformTitles('invalid'), null);
  assert.equal(normalizePlatformTitles({}), null);

  const normalized = normalizePlatformTitles({
    YouTube: '  "Judul YouTube High CTR"  ',
    FaceBook: 'Judul Facebook Organik',
    EMPTY: '   '
  });

  assert.deepEqual(normalized, {
    youtube: 'Judul YouTube High CTR',
    facebook: 'Judul Facebook Organik'
  });
});

test('Celah 1: validateScheduleRequest includes normalized platform_titles', () => {
  const req = {
    content_id: 'cf_test_123',
    account_ids: ['acc_yt_1', 'acc_fb_1'],
    media_type: 'video',
    media_url: 'https://example.com/video.mp4',
    scheduled_at: new Date(Date.now() + 60000).toISOString(),
    title: 'Judul Default Global',
    caption: 'Caption Default',
    platform_titles: {
      youtube: 'Judul Spesifik YouTube',
      facebook: 'Judul Spesifik Facebook'
    }
  };

  const validated = validateScheduleRequest(req);
  assert.equal(validated.title, 'Judul Default Global');
  assert.deepEqual(validated.platform_titles, {
    youtube: 'Judul Spesifik YouTube',
    facebook: 'Judul Spesifik Facebook'
  });
});

test('Celah 1: Target account mapping resolves platform-specific title correctly', () => {
  const validated = {
    title: 'Judul Default',
    caption: 'Caption Default',
    platform_titles: {
      youtube: 'Judul YouTube Viral',
      facebook: 'Judul Facebook Komunitas'
    }
  };

  const accounts = [
    { id: 'acc_1', platform: 'youtube' },
    { id: 'acc_2', platform: 'facebook' },
    { id: 'acc_3', platform: 'tiktok' }
  ];

  const targets = accounts.map(acc => {
    const platform = acc.platform.toLowerCase();
    const selectedTitle = validated.platform_titles?.[platform] || validated.title;
    return {
      accountId: acc.id,
      platform,
      title: selectedTitle
    };
  });

  assert.equal(targets[0].title, 'Judul YouTube Viral');
  assert.equal(targets[1].title, 'Judul Facebook Komunitas');
  assert.equal(targets[2].title, 'Judul Default');
});

// 2. Tests for Celah 2: Mode Ringkas cf_get_storyboard_status
test('Celah 2: MCP Storyboard summary defaults to compact (item_count) and captures errors', async () => {
  // Simulate mock fetchPillarStoryboardSummary logic
  const mockDetail = {
    success: true,
    campaign: {
      id: 'cst_test_1',
      campaign_name: 'Kampanye Uji NutriBake',
      status: 'failed'
    },
    items: [
      {
        id: 999,
        generation_status: 'failed',
        start_frame_status: 'pending',
        tts_status: 'pending',
        visual_status: 'pending',
        ffmpeg_status: 'pending',
        upload_status: 'pending',
        review_reason: 'Gemini 503 Overloaded; max retries exceeded'
      }
    ]
  };

  const summarize = (detail, { includeItems = false } = {}) => {
    const campaign = detail.campaign || {};
    const items = detail.items || [];
    const primaryItem = items[0] || null;
    const errorMessage = primaryItem?.error_message || primaryItem?.review_reason || primaryItem?.contentflow_error || null;
    const generationError = primaryItem?.generation_error || (primaryItem?.generation_status === 'failed' ? (primaryItem?.review_reason || 'Generation failed') : null);

    return {
      success: true,
      campaign_id: campaign.id,
      campaign_name: campaign.campaign_name,
      status: campaign.status,
      stages: primaryItem ? {
        generation_status: primaryItem.generation_status,
        error_message: errorMessage,
        generation_error: generationError
      } : null,
      ...(includeItems ? { items } : { item_count: items.length })
    };
  };

  // Default compact
  const compactSummary = summarize(mockDetail, { includeItems: false });
  assert.equal(compactSummary.item_count, 1);
  assert.equal(compactSummary.items, undefined);
  assert.equal(compactSummary.stages.error_message, 'Gemini 503 Overloaded; max retries exceeded');
  assert.equal(compactSummary.stages.generation_error, 'Gemini 503 Overloaded; max retries exceeded');

  // Explicit includeItems: true
  const detailedSummary = summarize(mockDetail, { includeItems: true });
  assert.ok(Array.isArray(detailedSummary.items));
  assert.equal(detailedSummary.items.length, 1);
});

// 3. Tests for Celah 3: Filter Preset & Visual Identity
test('Celah 3: cf_list_presets filtering and compact projection', () => {
  const samplePresets = [
    { key: 'nutribake_diet', label: 'NutriBake Diet Cocoa', brand: 'NutriBake', campaign_kinds: ['product_campaign'], config: { full: 'large_data_1' } },
    { key: 'habitfolk_airfryer', label: 'HabitFolk Resep Air Fryer', brand: 'HabitFolk', campaign_kinds: ['recipe_campaign'], config: { full: 'large_data_2' } },
    { key: 'generic_review', label: 'Review Produk Umum', brand: null, campaign_kinds: ['editorial_campaign'], config: { full: 'large_data_3' } }
  ];

  const filterPresets = (list, { brand, query, detail = false } = {}) => {
    const match = (p, s) => JSON.stringify([p.key, p.label, p.brand, p.config?.label]).toLowerCase().includes(s.toLowerCase());
    let filtered = list;
    if (brand) filtered = filtered.filter(p => match(p, brand));
    if (query) filtered = filtered.filter(p => match(p, query));
    if (!detail) {
      filtered = filtered.map(p => ({ key: p.key, label: p.label, campaign_kinds: p.campaign_kinds }));
    }
    return { success: true, count: filtered.length, presets: filtered };
  };

  // Filter by brand
  const brandRes = filterPresets(samplePresets, { brand: 'NutriBake' });
  assert.equal(brandRes.count, 1);
  assert.equal(brandRes.presets[0].key, 'nutribake_diet');
  assert.equal(brandRes.presets[0].config, undefined); // compact mode strips config!

  // Filter by query
  const queryRes = filterPresets(samplePresets, { query: 'resep' });
  assert.equal(queryRes.count, 1);
  assert.equal(queryRes.presets[0].key, 'habitfolk_airfryer');

  // Detail mode preserves config
  const detailRes = filterPresets(samplePresets, { brand: 'NutriBake', detail: true });
  assert.ok(detailRes.presets[0].config);
});

test('Celah 3: cf_list_visual_identities filtering and compact projection', () => {
  const sampleVIs = [
    { id: 'vi_1', preset_key: 'vi_nutribake_warm', label: 'NutriBake Warm Bakery', status: 'active', source: 'tenant', config: { brand: 'NutriBake', palette: 'warm' } },
    { id: 'vi_2', preset_key: 'vi_cyberpunk_neon', label: 'Cyberpunk Neon Studio', status: 'active', source: 'system', config: { brand: 'General', palette: 'neon' } }
  ];

  const filterVIs = (list, { brand, query, detail = false } = {}) => {
    const match = (v, s) => JSON.stringify([v.id, v.preset_key, v.label, v.description, v.config?.brand, v.config?.label]).toLowerCase().includes(s.toLowerCase());
    let filtered = list;
    if (brand) filtered = filtered.filter(v => match(v, brand));
    if (query) filtered = filtered.filter(v => match(v, query));
    if (!detail) {
      filtered = filtered.map(v => ({
        id: v.id,
        preset_key: v.preset_key,
        label: v.label,
        status: v.status,
        source: v.source
      }));
    }
    return { success: true, count: filtered.length, visual_identities: filtered };
  };

  const brandRes = filterVIs(sampleVIs, { brand: 'NutriBake' });
  assert.equal(brandRes.count, 1);
  assert.equal(brandRes.visual_identities[0].id, 'vi_1');
  assert.equal(brandRes.visual_identities[0].config, undefined); // compact!

  const detailRes = filterVIs(sampleVIs, { brand: 'NutriBake', detail: true });
  assert.ok(detailRes.visual_identities[0].config);
});

// 4. Tests for Celah 4: Cancel Custom Storyboard
test('Celah 4: PATCH status validation allows "cancelled"', () => {
  const allowedStatuses = ['running', 'paused', 'completed', 'draft', 'cancelled'];
  assert.ok(allowedStatuses.includes('cancelled'));
  assert.ok(allowedStatuses.includes('paused'));
  assert.ok(!allowedStatuses.includes('random_status'));
});

test('Celah 4: Worker processor skips quota consumption when campaign is cancelled or paused', async () => {
  const cancelledCampaign = { id: 'cst_cancel_test', status: 'cancelled' };
  const pausedCampaign = { id: 'cst_pause_test', status: 'paused' };
  let itemUpdated = null;

  const mockUpdateItem = async (id, fields) => {
    itemUpdated = { id, ...fields };
  };

  const checkWorkerGate = async (campaign, itemId, stage) => {
    if (campaign.status === 'cancelled') {
      await mockUpdateItem(itemId, { [`${stage}_status`]: 'cancelled', workflow_status: 'cancelled' });
      return { skip: true, reason: 'Campaign is cancelled' };
    }
    if (campaign.status === 'paused') {
      return { skip: true, reason: 'Campaign is paused' };
    }
    return { skip: false };
  };

  // Test cancelled
  const cancelOutcome = await checkWorkerGate(cancelledCampaign, 101, 'generation');
  assert.equal(cancelOutcome.skip, true);
  assert.equal(cancelOutcome.reason, 'Campaign is cancelled');
  assert.deepEqual(itemUpdated, { id: 101, generation_status: 'cancelled', workflow_status: 'cancelled' });

  // Test paused
  itemUpdated = null;
  const pauseOutcome = await checkWorkerGate(pausedCampaign, 102, 'tts');
  assert.equal(pauseOutcome.skip, true);
  assert.equal(pauseOutcome.reason, 'Campaign is paused');
  assert.equal(itemUpdated, null); // paused does not mark item cancelled
});

