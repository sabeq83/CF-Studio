process.env.NODE_ENV = 'test';
process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { executeCustomStoryboardPipeline } from '../lib/custom-storyboard-pipeline.js';
import { buildCustomStoryboardPromptEngineerPrompt } from '../lib/prompts.js';
import { getDb } from '../lib/db.js';
import { createCfStudioServer } from '../apps/mcp/tools.mjs';

after(() => {
  setTimeout(() => process.exit(0), 100);
});

const sampleProduct = {
  id: 'pe_custom_sb_test_1',
  product_name: 'GarliBee Madu Bawang Lanang',
  product_description: 'Madu mentah dan fermentasi bawang lanang murni',
  unique_selling_point: 'Kombinasi bawang lanang fermentasi dan madu mentah harian',
  packaging_type: 'Jar Kaca Heksagonal',
  is_in_packaging: 1,
  product_truth: 'Hexagonal glass jar containing amber raw honey and dark fermented garlic cloves',
  geometric_truth: 'Hexagonal clear glass jar with matte black cap',
  clean_photo_url: '/uploads/products/default_tenant/clean/garlibee_jar_clean.png',
  t2i_prompt: 'Hexagonal amber glass jar with matte black lid',
  i2v_action_prompt: 'Gentle atmospheric spoon lift beside jar'
};

const sampleVso = {
  schema_version: 'visual_identity_snapshot_v1',
  visual_language: { primary_style: 'syari_classic_atmospheric_home' },
  structured: {
    visual_language: { primary_style: 'syari_classic_atmospheric_home' },
    subject: { custom_description: 'Graceful faceless hands with modest cuffs' },
    wardrobe: { custom_description: 'Warm olive linen modest sleeve' },
    lighting: { custom_description: 'Warm golden 3500K morning window light' }
  },
  subject_prompt: 'Graceful faceless hands with modest cuffs',
  wardrobe_prompt: 'Warm olive linen modest sleeve',
  lighting_prompt: 'Warm golden 3500K morning window light'
};

test('1. executeCustomStoryboardPipeline defaults to prompt_mode=gemini_engineer and queues generation_status=pending', async () => {
  const db = getDb();
  let createdCampaignId = null;

  try {
    const result = await executeCustomStoryboardPipeline({
      storyboard: {
        title: 'Rahasia Tubuh Lebih Ringan Di Pagi Hari',
        content_pillar: 'Ritual Sehat Pagi Hari',
        creative_brief: 'Tekankan transisi emosional dari pagi yang lesu ke kebiasaan alami tanpa hard selling.',
        narrative_mode: 'Problem-Solution',
        post_link_affiliate: false,
        video_dna: {
          aspect_ratio: '9:16',
          visual_mode: 'hybrid_lock',
          visual_style: 'Cinematic',
          clip_duration: 6
        },
        scenes: [
          {
            scene_index: 1,
            scene_role: 'hook',
            visual_action: 'Close-up gelas kaca bening berisi air hangat di meja kayu yang terkena sinar matahari pagi',
            setting_hint: 'Meja makan kayu oak minimalis pagi hari',
            audio_mood: 'Suara tenang udara pagi tanpa musik',
            camera_movement: 'Slow push in 85mm macro',
            voiceover_text: 'Pernah merasa bangun tidur justru badan terasa berat dari kemarin?',
            product_visible: false,
            duration_seconds: 6
          },
          {
            scene_index: 2,
            scene_role: 'intro_product',
            visual_action: 'Tangan POV membuka toples madu heksagonal lalu menyendok perlahan di atas meja dapur hangat',
            setting_hint: 'Dapur herbal hangat bernuansa earth-tone',
            audio_mood: 'Detik hening taktil sendok menyentuh toples kaca',
            camera_movement: 'Overhead slight arc',
            voiceover_text: 'Banyak yang mulai memilih satu sendok kombinasi madu mentah dan bawang fermentasi.',
            product_visible: true,
            duration_seconds: 6
          }
        ]
      },
      tenantId: 'default_tenant',
      executionMode: 'full_autopilot'
    });
    createdCampaignId = result.campaign_id;

    assert.equal(result.success, true);
    assert.equal(result.prompt_mode, 'gemini_engineer');
    assert.equal(result.status, 'pending_generation');
    assert.deepEqual(result.production_stages, ['gemini_prompt_engineer', 'start_frames', 'tts', 'visuals', 'ffmpeg']);

    const item = await db.prepare('SELECT * FROM pillar_campaign_items WHERE id = ?').get(result.item_id);
    assert.equal(item.generation_status, 'pending');
    assert.equal(item.workflow_status, 'pending_generation');
    assert.equal(item.result_json, null);
    assert.equal(item.new_video_plan_json, '[]');

    const payload = JSON.parse(item.row_creative_payload);
    assert.equal(payload.prompt_mode, 'gemini_engineer');
    assert.equal(payload.content_pillar, 'Ritual Sehat Pagi Hari');
    assert.equal(payload.post_link_affiliate, false);
    assert.equal(payload.custom_storyboard.scenes.length, 2);
    assert.equal(payload.custom_storyboard.scenes[0].scene_role, 'hook');
    assert.equal(payload.custom_storyboard.scenes[0].setting_hint, 'Meja makan kayu oak minimalis pagi hari');
    assert.equal(payload.custom_storyboard.scenes[0].audio_mood, 'Suara tenang udara pagi tanpa musik');
    assert.equal(payload.custom_storyboard.scenes[0].camera_movement, 'Slow push in 85mm macro');
    assert.equal(payload.custom_storyboard.scenes[0].product_visible, false);
    assert.equal(payload.custom_storyboard.scenes[0].new_vo, 'Pernah merasa bangun tidur justru badan terasa berat dari kemarin?');
    assert.equal(payload.custom_storyboard.scenes[0].t2i_prompt, '');
    assert.equal(payload.custom_storyboard.scenes[0].i2v_prompt, '');
    assert.equal(payload.custom_storyboard.scenes[1].product_visible, true);
  } finally {
    if (createdCampaignId) {
      await db.prepare('DELETE FROM pillar_campaign_items WHERE campaign_id = ?').run(createdCampaignId);
      await db.prepare('DELETE FROM pillar_campaigns WHERE id = ?').run(createdCampaignId);
    }
  }
});

test('2. executeCustomStoryboardPipeline preserves direct_passthrough legacy bypass when explicitly requested', async () => {
  const db = getDb();
  let createdCampaignId = null;

  try {
    const result = await executeCustomStoryboardPipeline({
      storyboard: {
        title: 'Legacy Direct Passthrough Test',
        prompt_mode: 'direct_passthrough',
        scenes: [
          {
            scene_index: 1,
            voiceover_text: 'Direct passthrough tetap bisa dipakai untuk prompt pre-engineered.',
            visual_prompt: 'Pre-engineered raw prompt directly to renderer --ar 9:16',
            i2v_prompt: 'Slow cinematic dolly push forward'
          }
        ]
      },
      tenantId: 'default_tenant',
      executionMode: 'full_autopilot'
    });
    createdCampaignId = result.campaign_id;

    assert.equal(result.prompt_mode, 'direct_passthrough');
    assert.equal(result.status, 'production_processing');
    assert.deepEqual(result.production_stages, ['tts', 'visuals', 'ffmpeg']);

    const item = await db.prepare('SELECT generation_status, new_video_plan_json FROM pillar_campaign_items WHERE id = ?').get(result.item_id);
    assert.equal(item.generation_status, 'completed');
    const plan = JSON.parse(item.new_video_plan_json);
    assert.equal(plan[0].t2i_prompt, 'Pre-engineered raw prompt directly to renderer --ar 9:16');
    assert.equal(plan[0].i2v_prompt, 'Slow cinematic dolly push forward');
  } finally {
    if (createdCampaignId) {
      await db.prepare('DELETE FROM pillar_campaign_items WHERE campaign_id = ?').run(createdCampaignId);
      await db.prepare('DELETE FROM pillar_campaigns WHERE id = ?').run(createdCampaignId);
    }
  }
});

test('3. buildCustomStoryboardPromptEngineerPrompt locks Claude VO & injects VSO, Product Truth, and Bridging Contract', () => {
  const customSpec = {
    title: 'Kebiasaan Malam Yang Sering Terlewat',
    content_pillar: 'Ritual Pemulihan Malam',
    creative_brief: 'Jaga pacing reflektif dengan bridging intro di klip 2 dan recall di klip 5.',
    scenes: [
      {
        clip_index: 1,
        scene_role: 'hook',
        visual_action: 'Uap tipis naik dari cangkir keramik di sudut meja kamar tidur yang temaram',
        camera_movement: 'Slow macro pull back',
        setting_hint: 'Kamar tidur hangat lampu redup 3000K',
        audio_mood: 'Keheningan malam yang lembut',
        product_visible: false,
        new_vo: 'Jam tidur cukup belum tentu membuat tubuh terasa pulih keesokan paginya.',
        duration_seconds: 6
      },
      {
        clip_index: 2,
        scene_role: 'intro_product',
        visual_action: 'Tangan POV meraih jar kaca heksagonal berisi madu bawang fermentasi di atas baki kayu',
        camera_movement: 'Smooth orbit 45 derajat',
        setting_hint: 'Sudut pantry kayu estetik',
        audio_mood: 'Suara tutupan jar terbuka pelan',
        product_visible: true,
        new_vo: 'Satu sendok GarliBee sebelum istirahat membantu menenangkan rutinitas malammu.',
        duration_seconds: 6
      },
      {
        clip_index: 3,
        scene_role: 'gap',
        visual_action: 'Buku catatan terbuka dan pena di meja kerja yang tertata rapi tanpa botol produk',
        camera_movement: 'Static atmospheric tripod',
        setting_hint: 'Meja kerja tenang malam hari',
        audio_mood: 'Udara malam tenang',
        product_visible: false,
        new_vo: 'Kebiasaan kecil yang diulang tiap hari selalu mengalahkan niat besar sesaat.',
        duration_seconds: 6
      },
      {
        clip_index: 4,
        scene_role: 'problem',
        visual_action: 'Lampu nakas redup menyinari gelas air putih di samping jam weker analog',
        camera_movement: 'Slow sideways pan',
        setting_hint: 'Meja nakas minimalis',
        audio_mood: 'Detak lembut sunyi',
        product_visible: false,
        new_vo: 'Tubuh butuh sinyal konsisten untuk masuk ke fase pemulihan terdalam.',
        duration_seconds: 6
      },
      {
        clip_index: 5,
        scene_role: 'recall_product',
        visual_action: 'Close-up sendok kayu di samping jar heksagonal dengan cahaya keemasan lembut',
        camera_movement: 'Macro push in',
        setting_hint: 'Baki kayu pantry hangat',
        audio_mood: 'Ambient dapur sunyi',
        product_visible: true,
        new_vo: 'Pastikan stok GarliBee selalu siap di dapur sebelum malam tiba.',
        duration_seconds: 6
      },
      {
        clip_index: 6,
        scene_role: 'cta',
        visual_action: 'Cangkir hangat kosong yang tenang di atas tatami atau meja kayu diterangi cahaya fajar pertama',
        camera_movement: 'Slow fade pull out',
        setting_hint: 'Meja fajar hangat',
        audio_mood: 'Kicau pagi jauh sangat pelan',
        product_visible: false,
        new_vo: 'Mulai langkah sederhana malam ini agar esok terasa jauh lebih ringan.',
        duration_seconds: 6
      }
    ]
  };

  const campaignData = {
    campaign_name: customSpec.title,
    visual_mode: 'hybrid_lock',
    visual_style: 'Cinematic',
    narrative_mode: 'Problem-Solution',
    aspect_ratio: '9:16',
    clip_duration: 6,
    target_clips_count: 6,
    is_bridging_active: 1,
    bridge_segments: JSON.stringify([
      { at_clip: 2, duration_clips: 1, role: 'intro' },
      { at_clip: 5, duration_clips: 1, role: 'recall' }
    ]),
    _rowPayload: { post_link_affiliate: false }
  };

  const prompt = buildCustomStoryboardPromptEngineerPrompt([], campaignData, customSpec, sampleProduct, { brand_name: 'Dapur Botani' }, sampleVso);

  assert.match(prompt, /CUSTOM STORYBOARD PROMPT ENGINEER/);
  assert.match(prompt, /Total Scene TERKUNCI\s*:\s*TEPAT 6 KLIP/);
  assert.match(prompt, /VOICEOVER VERBATIM \(DIKUNCI — DILARANG DIUBAH\)/);
  assert.match(prompt, /Jam tidur cukup belum tentu membuat tubuh terasa pulih keesokan paginya\./);
  assert.match(prompt, /Graceful faceless hands with modest cuffs/);
  assert.match(prompt, /Warm olive linen modest sleeve/);
  assert.match(prompt, /garlibee_jar_clean\.png/);
  assert.match(prompt, /MULTI-BRIDGE SANDWICH MANDATE/);
  assert.match(prompt, /TANPA \{\{AFFILIATE_LINK\}\}/);
  assert.doesNotMatch(prompt, /"t2v_prompts":/);
});

test('4. MCP cf_submit_custom_storyboard accepts visual_action + creative context, defaults prompt_mode=gemini_engineer, and rejects scene without visuals', async t => {
  const calls = [];
  const server = createCfStudioServer(async (reqPath, opts) => {
    calls.push({ reqPath, opts });
    return { success: true, campaign_id: 'cst_mock_123' };
  });
  const client = new Client({ name: 'test-custom-sb', version: '1' });
  const [left, right] = InMemoryTransport.createLinkedPair();
  await server.connect(right);
  await client.connect(left);
  t.after(async () => {
    await client.close();
    await server.close();
  });

  // Invalid scene without any visual_* field should fail schema validation before calling backend
  const invalidRes = await client.callTool({
    name: 'cf_submit_custom_storyboard',
    arguments: {
      title: 'Missing Visual Action',
      scenes: [
        {
          scene_index: 1,
          voiceover_text: 'Ada VO tapi tidak ada visual_action.'
        }
      ]
    }
  });
  assert.equal(invalidRes.isError, true);
  assert.equal(calls.length, 0);

  // Valid scene using new visual_action + scene_role + setting_hint + creative_brief fields
  const validRes = await client.callTool({
    name: 'cf_submit_custom_storyboard',
    arguments: {
      preset_key: 'product_campaign',
      title: 'Custom Storyboard via Gemini Prompt Engineer',
      creative_brief: 'Fokus pada pengalaman taktil tangan POV dan tekstur bahan.',
      post_link_affiliate: true,
      scenes: [
        {
          scene_index: 1,
          scene_role: 'hook',
          visual_action: 'Macro gelas teh hangat mengepul di meja kayu',
          setting_hint: 'Pantry rumah minimalis',
          audio_mood: 'Tenang alami',
          product_visible: false,
          camera_movement: 'Slow push in',
          voiceover_text: 'Banyak yang mengira rasa begah setelah makan itu hal wajar.',
          duration_seconds: 8
        }
      ]
    }
  });
  assert.equal(validRes.isError, undefined);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].reqPath, '/api/v2/recipes/autonomous-pipeline');
  assert.equal(calls[0].opts.body.pipeline_type, 'custom_storyboard');
  assert.equal(calls[0].opts.body.storyboard.prompt_mode, 'gemini_engineer');
  assert.equal(calls[0].opts.body.storyboard.creative_brief, 'Fokus pada pengalaman taktil tangan POV dan tekstur bahan.');
  assert.equal(calls[0].opts.body.storyboard.scenes[0].visual_action, 'Macro gelas teh hangat mengepul di meja kayu');
  assert.equal(calls[0].opts.body.storyboard.scenes[0].scene_role, 'hook');
});

