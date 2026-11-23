import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  resolveCampaignProductPhotoPath,
  resolveCampaignProductReference
} from '../lib/product-reference-resolver.js';
import {
  buildProductSnapshot,
  buildAutonomousBridgingConfig
} from '../lib/multiplier-pairing.js';
import { buildMultiplierStartFrameRequest } from '../lib/multiplier-start-frame-request.js';
import { ProductReferenceUnavailableError } from '../lib/opc-start-frame-contract.js';

const TINY_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
]);

const TINY_JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);

test('P1: resolveCampaignProductPhotoPath and pairing helpers honor active_photo raw vs clean vs cleaned', () => {
  const baseProd = {
    id: 'pe_beorganik',
    product_name: 'Beorganik Peanut Butter',
    clean_photo_url: '/uploads/products/clean_jar.jpg',
    cleaned_photo_url: '/uploads/products/cleaned_jar.jpg',
    raw_photo_url: '/uploads/products/raw_jar.png',
    generated_photo_url: '/uploads/products/generated_jar.jpg',
    active_photo: 'raw_photo_url'
  };

  assert.equal(resolveCampaignProductPhotoPath(baseProd), '/uploads/products/raw_jar.png');
  assert.equal(buildProductSnapshot(baseProd).product_image_url, '/uploads/products/raw_jar.png');
  assert.equal(buildAutonomousBridgingConfig({ product: baseProd }).productRefImagePath, '/uploads/products/raw_jar.png');

  const cleanedProd = { ...baseProd, active_photo: 'cleaned_photo_url' };
  assert.equal(resolveCampaignProductPhotoPath(cleanedProd), '/uploads/products/cleaned_jar.jpg');

  const legacyGenProd = { ...baseProd, active_photo: 'generated_photo_url' };
  assert.equal(
    resolveCampaignProductPhotoPath(legacyGenProd),
    '/uploads/products/clean_jar.jpg',
    'Legacy generated_photo_url should yield to canonical clean_photo_url'
  );
});

test('P1+P2: buildMultiplierStartFrameRequest attaches subject reference + identity lock on clip 4 & 6 and sanitizes clip 1', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mul-sf-'));
  try {
    const cleanRel = '/uploads/products/beorganik_clean.jpg';
    const rawRel = '/uploads/products/beorganik_raw.png';
    const cleanAbs = path.join(tmpRoot, 'public', cleanRel);
    const rawAbs = path.join(tmpRoot, 'public', rawRel);
    fs.mkdirSync(path.dirname(cleanAbs), { recursive: true });
    fs.writeFileSync(cleanAbs, TINY_JPG);
    fs.writeFileSync(rawAbs, TINY_PNG);

    const expectedRawSha = crypto.createHash('sha256').update(TINY_PNG).digest('hex');

    const product = {
      id: 'pe_1781998087509_929',
      product_name: 'Beorganik Peanut Butter',
      clean_photo_url: cleanRel,
      raw_photo_url: rawRel,
      active_photo: 'raw_photo_url'
    };

    const bridging = {
      is_bridging_active: true,
      targetProductId: product.id,
      productName: product.product_name,
      bridge_segments: [
        { at_clip: 4, duration_clips: 1, role: 'intro' },
        { at_clip: 6, duration_clips: 1, role: 'recall' }
      ],
      targetClipsCount: 6,
      productRefImagePath: cleanRel // stale snapshot path should be overridden by live product active_photo!
    };

    const aesthetics = { aspect_ratio: '9:16' };
    const brandProfile = { id: 'bp_nutri', glabs_webhook_host: 'http://100.64.70.61:8765' };

    // Clip 4 (Bridge Intro)
    const clip4 = buildMultiplierStartFrameRequest({
      task: { id: 'mul_test', target_product_id: product.id },
      clipIndex: 4,
      prompt: '(Food Truth: Spoon scooping Beorganik Peanut Butter from jar)',
      product,
      bridging,
      aesthetics,
      webhookOverride: brandProfile,
      cwd: tmpRoot
    });

    assert.equal(clip4.isBridgeClip, true);
    assert.equal(clip4.providerRequest.reference_images?.length, 1);
    assert.equal(clip4.providerRequest.reference_images[0].category, 'subject');
    assert.match(clip4.providerRequest.reference_images[0].name, /^product_truth_pe_1781998087509_929\.png$/);
    assert.deepEqual(clip4.providerRequest.expected_reference_sha256s, [expectedRawSha]);
    assert.equal(clip4.audit.referenceSourceField, 'raw_photo_url');
    assert.match(clip4.providerRequest.prompt, /^\[HIGHEST PRIORITY PRODUCT IDENTITY LOCK\]/);
    assert.equal(clip4.providerRequest.webhookOverride?.id, 'bp_nutri');

    // Clip 6 (Bridge Recall)
    const clip6 = buildMultiplierStartFrameRequest({
      task: { id: 'mul_test', target_product_id: product.id },
      clipIndex: 6,
      prompt: '(Food Truth: Plated cake beside Beorganik Peanut Butter jar)',
      product,
      bridging,
      aesthetics,
      webhookOverride: brandProfile,
      cwd: tmpRoot
    });
    assert.equal(clip6.isBridgeClip, true);
    assert.deepEqual(clip6.providerRequest.expected_reference_sha256s, [expectedRawSha]);

    // Clip 1 (Non-bridging kitchen scene)
    const clip1 = buildMultiplierStartFrameRequest({
      task: { id: 'mul_test', target_product_id: product.id },
      clipIndex: 1,
      prompt: '(Food Truth: Warm moist blueberry Beorganik Peanut Butter cake on kitchen counter), (Product Truth: Beorganik jar)',
      product,
      bridging,
      aesthetics,
      cwd: tmpRoot
    });
    assert.equal(clip1.isBridgeClip, false);
    assert.equal(clip1.providerRequest.reference_images, undefined);
    assert.ok(!/Beorganik Peanut Butter/i.test(clip1.providerRequest.prompt), 'Leaked product name must be stripped from non-bridging clip');
    assert.match(clip1.providerRequest.prompt, /Unbranded Prep Truth/);

    // Explicit reference check
    const refDirect = resolveCampaignProductReference({ product, cwd: tmpRoot });
    assert.equal(refDirect.sha256, expectedRawSha);
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('P2: buildMultiplierStartFrameRequest throws ProductReferenceUnavailableError when bridging image is missing on disk', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mul-missing-'));
  try {
    assert.throws(
      () =>
        buildMultiplierStartFrameRequest({
          task: { id: 'mul_missing', target_product_id: 'pe_missing' },
          clipIndex: 4,
          prompt: '(Food Truth: Jar on countertop)',
          product: { id: 'pe_missing', product_name: 'Missing Jar', clean_photo_url: '/uploads/products/missing.jpg', active_photo: 'clean_photo_url' },
          bridging: { is_bridging_active: true, bridge_segments: [{ at_clip: 4, duration_clips: 1, role: 'intro' }], targetClipsCount: 6 },
          cwd: tmpRoot
        }),
      (err) => err instanceof ProductReferenceUnavailableError
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});
