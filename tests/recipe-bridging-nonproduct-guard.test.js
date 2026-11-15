import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

after(() => {
  setTimeout(() => process.exit(0), 50);
});

import { sanitizeNonBridgingRecipeScene } from '../lib/recipe-production-adapter.js';
import { buildOpcStartFrameRequest } from '../lib/opc-start-frame-request.js';
import { sanitizeImagePrompt } from '../lib/webhook-client.js';
import { buildRecipePlannerBridgingRule } from '../lib/recipe-planner-engine.js';
import { UNBRANDED_PREP_POSITIVE_TAG } from '../lib/bridging/non-bridging-prompt-sanitizer.js';

const GHU8BO_RECIPE_TITLE = 'Hot Choco Diet Booster: Minuman Cokelat Hangat Tanpa Gula yang Creamy & Menenangkan';
const GHU8BO_PRODUCT_NAME = 'Premix Cocoa Powder Premium';

const GHU8BO_CLIP1_T2I =
  `(VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: OPTICS] (Angle: Top-down 45-degree tabletop macro), ` +
  `(Shot on Phase One XF IQ4 (150MP)). [LAYER 2: SUBJECT, COOKWARE & VISUAL TRUTH] ` +
  `(Anchor: POV close-up framing focusing strictly on forearms and hands), ` +
  `(Wardrobe: Clean oatmeal cotton rolled sleeves), ` +
  `(Food Truth: ${GHU8BO_RECIPE_TITLE} in initial powdered state), ` +
  `(Cookware Truth: clear fluted cylindrical highball glass with transparent glass straw), ` +
  `(Product Truth: High fidelity photography of "${GHU8BO_PRODUCT_NAME}"). ` +
  `[LAYER 3: SCENE & LIGHT] (Environment: Pristine modern kitchen island with seamless flat matte warm-grey quartz countertop, standing pouch beside bowl), ` +
  `(Lighting: illuminated by soft natural daylight).`;

test('sanitizeNonBridgingRecipeScene strips marketing Food Truth title, product name, packaging & adds positive prep lock', () => {
  const sanitized = sanitizeNonBridgingRecipeScene(
    {
      index: 1,
      scene_function: 'hook',
      visual_action: `Tangan menakar 2 sdm ${GHU8BO_PRODUCT_NAME} ke dalam gelas tinggi.`,
      t2i_prompt: GHU8BO_CLIP1_T2I,
      product_ids: ['pe_1786588017962_4710']
    },
    {
      productName: GHU8BO_PRODUCT_NAME,
      recipeTitle: GHU8BO_RECIPE_TITLE,
      category: 'minuman',
      isPureT2v: false
    }
  );

  assert.deepEqual(sanitized.product_ids, []);
  assert.equal(sanitized.visual_action.includes(GHU8BO_PRODUCT_NAME), false);
  assert.equal(/\(Product Truth:/i.test(sanitized.t2i_prompt), false);
  assert.equal(/Hot Choco Diet Booster/i.test(sanitized.t2i_prompt), false);
  assert.equal(sanitized.t2i_prompt.includes(GHU8BO_PRODUCT_NAME), false);
  assert.equal(/\bpouch\b/i.test(sanitized.t2i_prompt), false);
  assert.ok(sanitized.t2i_prompt.includes(UNBRANDED_PREP_POSITIVE_TAG));
});

test('buildOpcStartFrameRequest enforces zero product/packaging on non-bridging clips 1,2,3,5 while keeping product ref on clips 4,6', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recipe-nonbridge-'));
  const relPhoto = '/uploads/products/test/cocoa_test.jpg';
  const absPhoto = path.join(tmpDir, 'public', relPhoto.replace(/^\/+/, ''));
  fs.mkdirSync(path.dirname(absPhoto), { recursive: true });
  const fakeJpeg = Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
    Buffer.alloc(160, 0x20),
    Buffer.from([0xff, 0xd9])
  ]);
  fs.writeFileSync(absPhoto, fakeJpeg);

  try {
    const bridgeSegments = JSON.stringify([
      { at_clip: 4, duration_clips: 1, role: 'intro' },
      { at_clip: 6, duration_clips: 1, role: 'recall' }
    ]);
    const campaign = {
      id: 'opc_261115_ghu8bo',
      campaign_focus: 'recipe_campaign',
      content_pillar: 'Recipe Campaign',
      target_clips_count: 6,
      is_bridging_active: 1,
      bridge_at_clip: 4,
      bridge_duration_clips: 1,
      bridge_segments: bridgeSegments,
      target_product_id: 'pe_1786588017962_4710',
      target_product_name: GHU8BO_PRODUCT_NAME,
      product_ref_image_path: relPhoto
    };
    const item = {
      id: 2188,
      row_creative_payload: JSON.stringify({
        content_kind: 'recipe_campaign',
        title: GHU8BO_RECIPE_TITLE,
        category: 'minuman',
        primary_product_id: 'pe_1786588017962_4710',
        primary_product_name: GHU8BO_PRODUCT_NAME
      }),
      new_video_plan_json: JSON.stringify([
        { clip_index: 1, product_visible: false, requires_product_reference: false },
        { clip_index: 2, product_visible: false, requires_product_reference: false },
        { clip_index: 3, product_visible: false, requires_product_reference: false },
        { clip_index: 4, product_visible: true, requires_product_reference: true },
        { clip_index: 5, product_visible: false, requires_product_reference: false },
        { clip_index: 6, product_visible: true, requires_product_reference: true }
      ])
    };
    const productLoader = async (id) => ({
      id,
      name: GHU8BO_PRODUCT_NAME,
      clean_photo_url: relPhoto
    });

    for (const clipIndex of [1, 2, 3, 5]) {
      const built = await buildOpcStartFrameRequest({
        campaign,
        item,
        clipIndex,
        prompt: GHU8BO_CLIP1_T2I,
        productLoader,
        cwd: tmpDir
      });
      assert.equal(built.audit.requires_product_reference, false);
      assert.equal(built.audit.reference_count, 0);
      assert.equal(built.providerRequest.reference_images, undefined);
      assert.equal(/Hot Choco Diet Booster/i.test(built.providerRequest.prompt), false, `Clip ${clipIndex} leaked recipe title`);
      assert.equal(built.providerRequest.prompt.includes(GHU8BO_PRODUCT_NAME), false, `Clip ${clipIndex} leaked product name`);
      assert.equal(/\bpouch\b/i.test(built.providerRequest.prompt), false, `Clip ${clipIndex} leaked pouch term`);
      assert.ok(built.providerRequest.negative_prompt.includes('standing pouch'));

      const sentToGlabs = sanitizeImagePrompt(built.providerRequest.prompt);
      assert.ok(
        sentToGlabs.includes('only loose culinary ingredients inside open kitchenware'),
        `Clip ${clipIndex} positive unbranded guard must survive sanitizeImagePrompt`
      );
    }

    for (const clipIndex of [4, 6]) {
      const built = await buildOpcStartFrameRequest({
        campaign,
        item,
        clipIndex,
        prompt: `(VERTICAL 9:16) [LAYER 2] (Food Truth: finished cocoa drink next to product package), (Product Truth: "${GHU8BO_PRODUCT_NAME}")`,
        productLoader,
        cwd: tmpDir
      });
      assert.equal(built.audit.requires_product_reference, true);
      assert.equal(built.audit.reference_count, 1);
      assert.equal(built.providerRequest.reference_images.length, 1);
      assert.ok(built.providerRequest.prompt.includes('[HIGHEST PRIORITY PRODUCT IDENTITY LOCK]'));
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('buildRecipePlannerBridgingRule restricts packaging mentions outside bridging clips', () => {
  const targeted = buildRecipePlannerBridgingRule({
    isOrganic: false,
    bridgingConfig: { is_bridging_active: true, product_clips: [4, 6] }
  });
  assert.equal(targeted.hasTargetedBridging, true);
  assert.deepEqual(targeted.bridgingClips, [4, 6]);
  assert.ok(targeted.directive.includes('[4, 6]'));
  assert.ok(targeted.directive.includes('DILARANG menampilkan kemasan'));

  const untargeted = buildRecipePlannerBridgingRule({ isOrganic: true, bridgingConfig: null });
  assert.equal(untargeted.hasTargetedBridging, false);
  assert.ok(untargeted.directive.includes('JANGAN menampilkan kemasan ritel generik'));
});

