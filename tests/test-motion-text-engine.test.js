import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { generateMotionTextFrames, buildXfadeFilterGraph } from '../lib/motion-text-engine.js';

async function runTests() {
  console.log('🧪 Starting Motion Text Engine & XFade Transitions Unit Tests...\n');
  const tempTestDir = path.join(process.cwd(), 'public', 'temp', 'unit_test_motion_engine');
  if (!fs.existsSync(tempTestDir)) {
    fs.mkdirSync(tempTestDir, { recursive: true });
  }

  let passed = 0;
  let failed = 0;

  function testCase(name, fn) {
    try {
      fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ ${name}:`, err.message);
      failed++;
    }
  }

  async function asyncTestCase(name, fn) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ ${name}:`, err.message);
      failed++;
    }
  }

  // --- Suite 1: Motion Text Frames Generation ---
  console.log('--- Test Suite 1: SVG Sharp Frame Generation ---');

  await asyncTestCase('Style 1: floating_white_yellow renders PNG sequence successfully', async () => {
    const dir = path.join(tempTestDir, 'style_1');
    const result = await generateMotionTextFrames({
      outputDir: dir,
      text: 'BONGKAR RAHASIA RESEP RENDANG DAGING PADANG PALING EMPUK',
      role: 'hook',
      style: 'floating_white_yellow',
      effect: 'pop_bounce',
      videoWidth: 1080,
      videoHeight: 1920,
      duration: 4.0,
      fps: 12,
      position: 'bottom'
    });

    assert.strictEqual(result.success, true, 'Result success should be true');
    assert.strictEqual(result.style, 'floating_white_yellow');
    assert.ok(result.frameCount >= 15, `Frame count should be >= 15, got ${result.frameCount}`);
    assert.strictEqual(result.posY, 'H-h-230', 'Safe zone position Y should be bottom offset H-h-230');

    // Check that frame files exist and are valid PNG images
    const frame1 = path.join(dir, 'frame_001.png');
    assert.ok(fs.existsSync(frame1), 'frame_001.png must exist');
    const stat1 = fs.statSync(frame1);
    assert.ok(stat1.size > 500, `frame_001.png size must be > 500 bytes, got ${stat1.size}`);
  });

  await asyncTestCase('Style 2: floating_black_on_white renders pill badges word-by-word', async () => {
    const dir = path.join(tempTestDir, 'style_2');
    const result = await generateMotionTextFrames({
      outputDir: dir,
      text: 'TUMIS BUMBU HALUS SAMPAI HARUM DAN MINYAKNYA KELUAR',
      role: 'story',
      style: 'floating_black_on_white',
      effect: 'word_karaoke',
      videoWidth: 1080,
      videoHeight: 1920,
      duration: 3.5,
      fps: 10,
      position: 'center'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.style, 'floating_black_on_white');
    assert.strictEqual(result.posY, '(H-h)/2', 'Center position should be (H-h)/2');

    const lastFrame = path.join(dir, `frame_${String(result.frameCount).padStart(3, '0')}.png`);
    assert.ok(fs.existsSync(lastFrame), 'Last frame must exist');
    assert.ok(fs.statSync(lastFrame).size > 500);
  });

  await asyncTestCase('Style 3: minimal_white renders elegant clean frosted card', async () => {
    const dir = path.join(tempTestDir, 'style_3');
    const result = await generateMotionTextFrames({
      outputDir: dir,
      text: 'Simpan resep ini dan bagikan ke teman kuliner kalian!',
      role: 'cta',
      style: 'minimal_white',
      effect: 'typewriter',
      videoWidth: 1080,
      videoHeight: 1920,
      duration: 4.0,
      fps: 10,
      tag: 'CTA',
      brand: 'garlibee.id',
      position: 'top'
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.style, 'minimal_white');
    assert.strictEqual(result.posY, '154', 'Top position offset should be ~154px on 1920h');

    const frame1 = path.join(dir, 'frame_001.png');
    assert.ok(fs.existsSync(frame1));
    assert.ok(fs.statSync(frame1).size > 500);
  });

  await asyncTestCase('Edge case: Empty text returns failure cleanly', async () => {
    const dir = path.join(tempTestDir, 'style_empty');
    const result = await generateMotionTextFrames({
      outputDir: dir,
      text: '   ',
      style: 'floating_white_yellow'
    });
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.reason, 'Empty text');
  });

  // --- Suite 2: Video Transition XFade Filter Graph ---
  console.log('\n--- Test Suite 2: FFmpeg XFade Filter Graph Builder ---');

  testCase('XFade: 3 clips with fade transition computes correct offsets and filter chains', () => {
    const durations = [5.0, 6.0, 5.0];
    const xfade = buildXfadeFilterGraph(durations, 'fade', 0.5);

    assert.ok(xfade !== null, 'XFade config must not be null');
    assert.strictEqual(xfade.transitionType, 'fade');
    assert.strictEqual(xfade.transitionDuration, 0.5);
    // 2 video filters (xfade) + 2 audio filters (acrossfade) = 4 filters
    assert.strictEqual(xfade.filterGraph.length, 4, 'Must produce 4 filter stages');

    const videoFilter0 = xfade.filterGraph[0];
    assert.strictEqual(videoFilter0.filter, 'xfade');
    assert.strictEqual(videoFilter0.options.transition, 'fade');
    assert.strictEqual(videoFilter0.options.offset, '4.500', 'First transition offset should be 5.0 - 0.5 = 4.5');

    const videoFilter1 = xfade.filterGraph[1];
    assert.strictEqual(videoFilter1.filter, 'xfade');
    assert.strictEqual(videoFilter1.options.offset, '10.000', 'Second transition offset should be 4.5 + 6.0 - 0.5 = 10.0');

    assert.strictEqual(xfade.mapVideo, '[v_joined]');
    assert.strictEqual(xfade.mapAudio, '[a_joined]');
    assert.strictEqual(xfade.totalDuration, 15.0, 'Total duration should be 5 + 6 + 5 - (2 * 0.5) = 15.0');
  });

  testCase('XFade: Fallback to concat when transition is cut or single clip', () => {
    const cutResult = buildXfadeFilterGraph([5.0, 5.0], 'cut', 0.5);
    assert.strictEqual(cutResult, null, 'Transition "cut" must return null for standard concat fallback');

    const singleResult = buildXfadeFilterGraph([5.0], 'fade', 0.5);
    assert.strictEqual(singleResult, null, 'Single clip must return null');
  });

  testCase('XFade: Safe duration clamp on short clips', () => {
    // If a clip is very short (e.g. 1.0s), 0.5s transition is 50% which is clamped to max 40% (0.4s)
    const xfade = buildXfadeFilterGraph([1.0, 5.0], 'slideleft', 0.8);
    assert.ok(xfade.transitionDuration <= 0.4, `Transition duration should be clamped to <= 0.4, got ${xfade.transitionDuration}`);
  });

  // Cleanup temp files
  try {
    fs.rmSync(tempTestDir, { recursive: true, force: true });
  } catch (_) {}

  console.log(`\n========================================`);
  console.log(`🏁 Unit Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unexpected test error:', err);
  process.exit(1);
});
