process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.PG_SEARCH_PATH = process.env.PG_SEARCH_PATH || 'dev';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildOpcStartFrameRequest } from '../lib/opc-start-frame-request.js';
import { sanitizeTimeOfDayLighting } from '../lib/scene-brief.js';
import { buildStartFrameBatchQcPrompt, evaluateQcChecklistVerdict } from '../lib/start-frame-visual-qc.js';
import {
  findVoClaimViolations,
  auditScriptForTikTok,
  rewriteViolatingVoSentences
} from '../lib/tiktok-compliance-service.js';
import { buildOrganicPillarPrompt } from '../lib/prompts.js';
import { assertSafeTestDbEnv } from '../lib/db-env-validator.js';
import { ensureSafeLocalTestDbEnv } from './helpers/db-test-guard.js';

const FAKE_JPEG_BUF = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(140, 0x33)]);
const FAKE_PNG_BUF = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(140, 0x22)]);

test('K7.1-A: Jalur B attaches JPEG-bytes wardrobe_ref saved as .png, locks explicit Wardrobe on C2-C6 (skips C1 hook_only & 3D), and adds Wardrobe Lock Priority with product_ref', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'k71-wardrobe-'));
  try {
    const startFramesDir = path.join(tmpDir, 'public', 'uploads', 'start_frames');
    fs.mkdirSync(startFramesDir, { recursive: true });
    // Sengaja simpan JPEG magic bytes di ekstensi .png untuk mereproduksi bug G-Labs Staging!
    fs.writeFileSync(path.join(startFramesDir, 'wardrobe_ref_888.png'), FAKE_JPEG_BUF);
    const prodPath = path.join(startFramesDir, 'garlibee_clean.png');
    fs.writeFileSync(prodPath, FAKE_PNG_BUF);

    const mockProductLoader = async () => ({
      id: 99,
      name: 'GarliBee',
      clean_photo_url: '/uploads/start_frames/garlibee_clean.png'
    });

    const lockedColor = {
      key: 'olive_sage',
      label: 'Olive Sage',
      description: 'solid plain olive sage loose opaque modest linen long-sleeve garment completely covering forearms with fitted cuffs visible at wrists, single uniform solid color, plain unprinted smooth fabric'
    };
    const policyHookOnly = { active: true, mode: 'hook_only', handsPolicy: 'modest_hands_active' };

    const campaignJalurB = {
      id: 'camp_jalur_b',
      face_visibility: 'Faceless',
      visual_style: 'Cinematic',
      planner_scene_director: 'on',
      is_bridging_active: 1,
      bridge_at_clip: 5,
      bridge_duration_clips: 2,
      target_clips_count: 6,
      target_product_id: 99,
      product_ref_image_path: prodPath,
      resolved_metaphor_policy: policyHookOnly,
      resolved_wardrobe_color: lockedColor,
      resolved_scene_brief: {
        environment_policy: 'planner_driven',
        location_en: 'warm lived-in Indonesian family living room corner',
        time_key: 'night'
      }
    };
    const itemJalurB = {
      id: 888,
      new_video_plan_json: JSON.stringify([
        { clip_index: 1, visual_mode: 'cinematic_realistic' },
        { clip_index: 2, visual_mode: 'cinematic_realistic' },
        { clip_index: 3, visual_mode: '3d_bio_cellular' },
        { clip_index: 4, visual_mode: 'cinematic_realistic' },
        { clip_index: 5, visual_mode: 'cinematic_realistic' },
        { clip_index: 6, visual_mode: 'cinematic_realistic' }
      ]),
      result_json: JSON.stringify({
        wardrobe_reference_image: '/uploads/start_frames/wardrobe_ref_888.png',
        resolved_metaphor_policy: policyHookOnly,
        resolved_wardrobe_color: lockedColor,
        resolved_scene_brief: campaignJalurB.resolved_scene_brief
      })
    };

    // Clip 1 (hook_only): ZERO Wardrobe, ZERO W-REF
    const r1 = await buildOpcStartFrameRequest({
      campaign: campaignJalurB,
      item: itemJalurB,
      clipIndex: 1,
      prompt: 'Unattended glowing table lamp next to ceramic mug. (Wardrobe: brown). (Lighting: soft daylight)',
      productLoader: mockProductLoader,
      cwd: tmpDir
    });
    assert.equal(r1.audit.reference_count, 0);
    assert.ok(!/\(Wardrobe:/i.test(r1.providerRequest.prompt));

    // Clip 2 (pre-bridge hands): EXPLICIT locked Olive Sage Wardrobe + W-REF attached!
    const r2 = await buildOpcStartFrameRequest({
      campaign: campaignJalurB,
      item: itemJalurB,
      clipIndex: 2,
      prompt: '(Anchor: POV hands) resting on living room table. (Lighting: warm interior lamp)',
      productLoader: mockProductLoader,
      cwd: tmpDir
    });
    assert.equal(r2.audit.reference_count, 1, 'W-REF dengan JPEG bytes dalam .png wajib ikut terlampir!');
    assert.match(r2.providerRequest.prompt, /\(Wardrobe:[^)]*Olive Sage[^)]*linen[^)]*fitted cuffs(?: visible)? at wrists[^)]*identical color in every clip\)/i);
    assert.ok(!/Wardrobe Lock Priority:/i.test(r2.providerRequest.prompt));

    // Clip 3 (3d_bio_cellular): SKIPPED — zero Wardrobe, zero W-REF
    const r3 = await buildOpcStartFrameRequest({
      campaign: campaignJalurB,
      item: itemJalurB,
      clipIndex: 3,
      prompt: 'Microscopic 3D bio-cellular blood vessels illustration. (Wardrobe: Olive Sage).',
      productLoader: mockProductLoader,
      cwd: tmpDir
    });
    assert.equal(r3.audit.reference_count, 0);
    assert.ok(!/\(Wardrobe:/i.test(r3.providerRequest.prompt));

    // Clip 5 (product clip): Product pos 0 + W-REF pos 1, explicit Wardrobe, AND Wardrobe Lock Priority!
    const r5 = await buildOpcStartFrameRequest({
      campaign: campaignJalurB,
      item: itemJalurB,
      clipIndex: 5,
      prompt: '(Biometric Anchor: POV hands) opening glass jar of honey. (Lighting: warm lamp)',
      productLoader: mockProductLoader,
      cwd: tmpDir
    });
    assert.equal(r5.audit.product_reference_count, 1);
    assert.equal(r5.audit.reference_count, 2, 'C5 wajib kirim Product Ref + W-REF sekaligus');
    assert.match(r5.providerRequest.prompt, /\(Wardrobe:[^)]*Olive Sage[^)]*identical color in every clip\)/i);
    assert.match(r5.providerRequest.prompt, /\(Wardrobe Lock Priority: sleeve color must match the wardrobe reference, ignore any clothing color seen in the product reference\)/i);

    // Regresi Jalur A (metaphoric_faceless full_metaphor): tetap mengunci Wardrobe & W-REF di C2-C6
    const policyFull = { active: true, mode: 'full_metaphor', handsPolicy: 'modest_hands_active', environmentPolicy: 'metaphor_driven' };
    const rA2 = await buildOpcStartFrameRequest({
      campaign: { ...campaignJalurB, visual_style: 'metaphoric_faceless', resolved_metaphor_policy: policyFull },
      item: { ...itemJalurB, result_json: JSON.stringify({ ...JSON.parse(itemJalurB.result_json), resolved_metaphor_policy: policyFull }) },
      clipIndex: 2,
      prompt: '(Anchor: hands) guiding water flow',
      productLoader: mockProductLoader,
      cwd: tmpDir
    });
    assert.equal(rA2.audit.reference_count, 1);
    assert.match(rA2.providerRequest.prompt, /\(Wardrobe:[^)]*Olive Sage[^)]*identical color in every clip\)/i);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('K7.1-B: Night scene strips daytime phrases cleanly and enforces closed curtains / 3000K night interior in T2I, I2V, and Batch QC rubric', () => {
  const dirtyNight = '(Lighting: illuminated by soft natural daylight coming from a side window, golden hour sunny morning light reflections)';
  const cleanT2iNight = sanitizeTimeOfDayLighting(dirtyNight, 'night');
  assert.ok(!/\b(?:natural daylight|daylight|side window|sunlight|morning light|golden hour|sunny)\b/i.test(cleanT2iNight));
  assert.match(cleanT2iNight, /\(Lighting: night interior, curtains fully closed, dark window glass, warm 3000K interior lamps, hands clearly lit\)/i);

  const cleanI2vNight = sanitizeTimeOfDayLighting('[LAYER 1: SCENE] sunny morning light via side window while stirring mug', 'night');
  assert.ok(!/\b(?:sunny|morning light|side window|daylight)\b/i.test(cleanI2vNight));
  assert.ok(cleanI2vNight.includes('curtains fully closed'));

  const cleanAfternoon = sanitizeTimeOfDayLighting('soft morning sunlight across kitchen counter', 'afternoon');
  assert.ok(!/\bmorning\b/i.test(cleanAfternoon));

  // Batch QC prompt + verdict untuk night time_of_day_mismatch
  const batchPrompt = buildStartFrameBatchQcPrompt({
    clipContexts: [{
      clipIndex: 1,
      totalClips: 6,
      isPreBridge: true,
      expectsProduct: false,
      expectsObjectOnly: true,
      handsPolicy: 'modest_hands_active',
      environmentPolicy: 'planner_driven',
      sceneBrief: { time_key: 'night', location_en: 'living room corner', props: ['table lamp', 'dark curtains'] }
    }],
    campaign: { target_clips_count: 6 }
  });
  assert.match(batchPrompt, /time_of_day_mismatch/i);
  assert.match(batchPrompt, /bright sunlit windows|daylight/i);

  const nightMismatchVerdict = evaluateQcChecklistVerdict({
    hand_count: 0,
    awkward_anatomy: false,
    visible_face: false,
    exposed_forearm: false,
    wardrobe_color_match: true,
    pre_bridge_product: false,
    foreign_objects: false,
    weird_text_watermark: false,
    time_of_day_mismatch: true,
    metaphor_alignment_score: 0.6,
    reasons: []
  }, { isPreBridge: true, expectsObjectOnly: true, mode: 'report_only' });
  assert.equal(nightMismatchVerdict.metrics.time_of_day_mismatch, true);
});

test('K7.1-C: Herbal claim suffix loophole closed, negative cases clean, audit never passes on violations, and targeted 1x rewrite works', async () => {
  // 1. Suffix loophole ditutup
  const posText = 'Jaga jantungmu dan jantungnya sejak dini agar kolesterolnya serta paru-parumu tetap nyaman.';
  const posHits = findVoClaimViolations(posText, { strict: true });
  assert.ok(posHits.includes('jantungmu'));
  assert.ok(posHits.includes('jantungnya'));
  assert.ok(posHits.includes('kolesterolnya'));
  assert.ok(posHits.includes('paru-parumu'));

  // 2. Kasus netral aman (zero false positive)
  const cleanSentences = [
    'Malam kerja paruh waktu terasa lebih tenang saat keluarga berkumpul.',
    'Hangatkan malam keluarga dengan seduhan madu bawang hangat sebelum istirahat.',
    'Menjaga kebiasaan kecil setiap pagi membuat rutinitas harian terasa lebih ringan dan bugar.'
  ];
  for (const s of cleanSentences) {
    assert.deepEqual(findVoClaimViolations(s, { strict: true }), [], `Tidak boleh false positive untuk: ${s}`);
  }

  // 3. Storyboard prompt prevention untuk topik jantung
  const sbPrompt = buildOrganicPillarPrompt([], {
    campaign_name: 'GarliBee - kesehatan jantung',
    content_pillar: 'Commitment Based',
    promotion_context: 'kesehatan jantung',
    custom_hook: 'Kesehatan jantung terjaga sejak malam hari.',
    target_clips_count: 6,
    _rowPayload: {
      ws_matrix: 'When: Malam hari | Why: Menjaga sirkulasi_darah dan kesehatan_jantung',
      context: 'Suasana malam keluarga yang hangat',
      promotion_context: 'kesehatan jantung'
    }
  }, null, null, null);
  assert.match(sbPrompt, /KEBIJAKAN ANTI-KLAIM MEDIS VOICEOVER/i);
  assert.match(sbPrompt, /DILARANG KERAS menyebut nama organ atau penyakit/i);
  assert.match(sbPrompt, /Dilarang klaim menyembuhkan penyakit jantung/i);

  // 4. auditScriptForTikTok TIDAK BOLEH return pass jika regex menemukan kata terlarang
  const forcedNonPass = await auditScriptForTikTok('Awali pagi dengan kebaikan untuk jantungmu.', '', {
    skipCooldown: true,
    aiAuditorFn: async () => ({ status: 'pass', verdict: 'pass', revised_script: [] })
  });
  assert.notEqual(forcedNonPass.status, 'pass');
  assert.equal(forcedNonPass.passed, false);
  assert.ok(forcedNonPass.violating_tokens.includes('jantungmu'));

  // 5. Targeted 1x auto-rewrite hanya mengubah kalimat yang melanggar
  let aiCallCount = 0;
  const rwResult = await rewriteViolatingVoSentences({
    voiceover: [
      { scene: 1, narration: 'Kesehatan jantung terjaga sejak malam hari dengan langkah alami.' },
      { scene: 2, narration: 'Padahal, rutinitas malam yang tenang membuat tidur terasa jauh lebih nyenyak.' },
      { scene: 3, narration: 'Solusi hangat alami ini ramah untuk jantungmu setiap pagi.' }
    ],
    callRewriteJsonFn: async () => {
      aiCallCount += 1;
      return {
        rewrites: [
          { scene: 1, narration: 'Kebiasaan hangat di malam hari bantu jaga kenyamanan aktivitas keluarga.' },
          { scene: 3, narration: 'Satu sendok madu bawang hangat menemani rutinitas pagi keluarga dengan nyaman.' }
        ]
      };
    }
  });
  assert.equal(aiCallCount, 1);
  assert.equal(rwResult.blocked, false);
  assert.equal(rwResult.rewrites.length, 2);
  assert.equal(rwResult.voiceover[1].narration, 'Padahal, rutinitas malam yang tenang membuat tidur terasa jauh lebih nyenyak.');
  assert.deepEqual(rwResult.remainingViolations, []);

  // 6. Jika masih melanggar setelah 1x rewrite -> blocked = true
  const blockedResult = await rewriteViolatingVoSentences({
    voiceover: [{ scene: 1, narration: 'Rawat jantungmu sekarang.' }],
    callRewriteJsonFn: async () => ({ rewrites: [{ scene: 1, narration: 'Tetap jaga jantungmu.' }] })
  });
  assert.equal(blockedResult.blocked, true);
  assert.ok(blockedResult.remainingViolations.includes('jantungmu'));
});

test('K7.1-D: Test DB schema guard enforces DISABLE_AUTO_MIGRATIONS=true and fails loudly when PG_SEARCH_PATH is empty or public', () => {
  const prevPath = process.env.PG_SEARCH_PATH;
  const prevAuto = process.env.DISABLE_AUTO_MIGRATIONS;
  try {
    process.env.PG_SEARCH_PATH = '';
    assert.throws(() => assertSafeTestDbEnv(), /PG_SEARCH_PATH kosong/i);

    process.env.PG_SEARCH_PATH = 'public';
    assert.throws(() => ensureSafeLocalTestDbEnv(), /dilarang menyentuh schema "public"/i);

    process.env.PG_SEARCH_PATH = 'dev,public';
    assert.throws(() => assertSafeTestDbEnv(), /dilarang menyentuh schema "public"/i);

    delete process.env.DISABLE_AUTO_MIGRATIONS;
    process.env.PG_SEARCH_PATH = 'dev';
    const ok = assertSafeTestDbEnv();
    assert.equal(ok.primarySchema, 'dev');
    assert.equal(ok.disableAutoMigrations, true);
    assert.equal(process.env.DISABLE_AUTO_MIGRATIONS, 'true');
  } finally {
    if (prevPath === undefined) delete process.env.PG_SEARCH_PATH;
    else process.env.PG_SEARCH_PATH = prevPath;
    if (prevAuto === undefined) delete process.env.DISABLE_AUTO_MIGRATIONS;
    else process.env.DISABLE_AUTO_MIGRATIONS = prevAuto;
  }
});
