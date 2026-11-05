import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { generateMotionTextFrames, buildXfadeFilterGraph } from '../lib/motion-text-engine.js';

// Configuration
const BASE_DIR = process.cwd();
const TEMP_DIR = path.join(BASE_DIR, 'public', 'temp');
const SHOWCASE_DIR = path.join(TEMP_DIR, 'showcase');

// Input Clips
const CLIP_0 = path.join(TEMP_DIR, 'opc_glabs_1_clip_0.mp4');
const CLIP_1 = path.join(TEMP_DIR, 'opc_glabs_1_clip_1.mp4');

const SAMPLE_HOOK_TEXT = "CRISPY GOLDEN CHICKEN WINGS WITH ZERO EXCESS OIL";

const MOTION_TEXT_STYLES = [
  {
    id: 'floating_white_yellow',
    name: 'Floating Putih ➔ Kuning',
    tag: 'TIKTOK / REELS',
    desc: 'Teks tebal kapital putih dengan drop-shadow kuat, menyala kuning cerah mengikuti ritme kata.',
    role: 'hook'
  },
  {
    id: 'floating_black_on_white',
    name: 'Floating Hitam BG Pill Putih',
    tag: 'CAPCUT / VIRAL PILL',
    desc: 'Teks hitam kontras tinggi dalam kapsul pill putih bersih yang muncul bertahap per kata.',
    role: 'hook'
  },
  {
    id: 'minimal_white',
    name: 'Minimalist Clean White Card',
    tag: 'STUDIO DOCUMENTARY',
    desc: 'Badge kartu putih elegan semi-transparan dengan label kategori dan tipografi studio yang rapi.',
    role: 'hook'
  }
];

const TRANSITION_STYLES = [
  {
    id: 'fade',
    name: 'Smooth Dissolve',
    desc: 'Peleburan halus (Crossfade) antar adegan tanpa hentakan, cocok untuk transisi natural.'
  },
  {
    id: 'fadewhite',
    name: 'White Flash',
    desc: 'Kilatan putih punchy dan energik, ideal untuk pergantian hook atau beat drop.'
  },
  {
    id: 'fadeblack',
    name: 'Fade to Black',
    desc: 'Peredupan sesaat ke layar gelap, memberi jeda sinematik antar segmen besar.'
  },
  {
    id: 'slideleft',
    name: 'Slide Left',
    desc: 'Pergeseran horizontal dinamis ke kiri, sempurna untuk langkah tutorial atau resep bertahap.'
  },
  {
    id: 'zoomin',
    name: 'Zoom In',
    desc: 'Dorongan kamera masuk membesar ke adegan berikutnya, menciptakan efek kedalaman.'
  },
  {
    id: 'circleopen',
    name: 'Circle Open',
    desc: 'Transisi lingkaran membuka dari pusat layar, eye-catching dan playful.'
  },
  {
    id: 'cut',
    name: 'Hard Cut',
    desc: 'Potongan langsung tanpa efek transisi, tempo cepat dan tegas.'
  }
];

function getMediaDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 5.0);
    });
  });
}

function getVideoDimensions(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      resolve({
        width: videoStream?.width || 720,
        height: videoStream?.height || 1280
      });
    });
  });
}

// 1. Render Motion Text Overlay
async function renderMotionTextVariant(styleConfig, inputClip, outputClip) {
  console.log(`\n🎨 [Motion Text] Merender gaya '${styleConfig.id}' (${styleConfig.name})...`);
  const framesDir = path.join(TEMP_DIR, `frames_${styleConfig.id}`);
  if (fs.existsSync(framesDir)) {
    fs.rmSync(framesDir, { recursive: true, force: true });
  }
  fs.mkdirSync(framesDir, { recursive: true });

  const duration = await getMediaDuration(inputClip);
  const dims = await getVideoDimensions(inputClip);

  const frameRes = await generateMotionTextFrames({
    outputDir: framesDir,
    text: SAMPLE_HOOK_TEXT,
    role: styleConfig.role,
    style: styleConfig.id,
    effect: 'typewriter',
    videoWidth: dims.width,
    videoHeight: dims.height,
    duration: duration,
    fps: 15,
    tag: 'HABITFOLK RECIPE',
    brand: 'HabitFolk',
    position: 'bottom'
  });

  if (!frameRes.success) {
    throw new Error(`Gagal generate frame SVG: ${frameRes.reason}`);
  }

  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputClip)
      .input(frameRes.framePattern)
      .inputOptions([`-framerate ${frameRes.fps}`])
      .complexFilter([
        `[0:v][1:v]overlay=(W-w)/2:${frameRes.posY}:eof_action=repeat[vout]`
      ])
      .outputOptions([
        '-map [vout]',
        '-map 0:a',
        '-c:v libx264',
        '-preset fast',
        '-crf 20',
        '-pix_fmt yuv420p',
        '-c:a copy'
      ])
      .save(outputClip)
      .on('end', () => {
        console.log(`✅ [Motion Text OK] Selesai: ${path.basename(outputClip)}`);
        resolve(outputClip);
      })
      .on('error', (err) => {
        console.error(`❌ [Motion Text Error]:`, err.message);
        reject(err);
      });
  });

  // Cleanup frames
  try { fs.rmSync(framesDir, { recursive: true, force: true }); } catch (_) {}
}

// 2. Render Transition Variant
async function renderTransitionVariant(transConfig, inputClipA, inputClipB, outputClip) {
  console.log(`\n✂️ [Transition XFade] Merender transisi '${transConfig.id}' (${transConfig.name})...`);

  // To keep test videos fast and concise (~6s total), we trim Clip A to 3.5s and Clip B to 3.5s
  const trimmedA = path.join(TEMP_DIR, `temp_trim_a_${transConfig.id}.mp4`);
  const trimmedB = path.join(TEMP_DIR, `temp_trim_b_${transConfig.id}.mp4`);

  await new Promise((res, rej) => {
    ffmpeg(inputClipA)
      .setDuration(3.5)
      .outputOptions(['-c:v libx264', '-preset ultrafast', '-c:a copy'])
      .save(trimmedA)
      .on('end', res)
      .on('error', rej);
  });

  await new Promise((res, rej) => {
    ffmpeg(inputClipB)
      .setDuration(3.5)
      .outputOptions(['-c:v libx264', '-preset ultrafast', '-c:a copy'])
      .save(trimmedB)
      .on('end', res)
      .on('error', rej);
  });

  const durA = await getMediaDuration(trimmedA);
  const durB = await getMediaDuration(trimmedB);

  const concatCmd = ffmpeg()
    .input(trimmedA)
    .input(trimmedB);

  if (transConfig.id === 'cut') {
    // Standard concat
    concatCmd
      .complexFilter([
        {
          filter: 'concat',
          options: { n: 2, v: 1, a: 1 },
          inputs: ['0:v', '0:a', '1:v', '1:a'],
          outputs: ['v_joined', 'a_joined']
        }
      ])
      .outputOptions([
        '-map [v_joined]',
        '-map [a_joined]',
        '-c:v libx264',
        '-preset fast',
        '-crf 20',
        '-pix_fmt yuv420p',
        '-c:a aac'
      ]);
  } else {
    // XFade
    const xfadeRes = buildXfadeFilterGraph([durA, durB], transConfig.id, 0.6);
    concatCmd
      .complexFilter(xfadeRes.filterGraph)
      .outputOptions([
        `-map ${xfadeRes.mapVideo}`,
        `-map ${xfadeRes.mapAudio}`,
        '-c:v libx264',
        '-preset fast',
        '-crf 20',
        '-pix_fmt yuv420p',
        '-c:a aac'
      ]);
  }

  await new Promise((resolve, reject) => {
    concatCmd
      .save(outputClip)
      .on('end', () => {
        console.log(`✅ [Transition OK] Selesai: ${path.basename(outputClip)}`);
        resolve(outputClip);
      })
      .on('error', (err) => {
        console.error(`❌ [Transition Error]:`, err.message);
        reject(err);
      });
  });

  // Cleanup trims
  try {
    fs.unlinkSync(trimmedA);
    fs.unlinkSync(trimmedB);
  } catch (_) {}
}

async function main() {
  console.log('🚀 ========================================================');
  console.log('🚀 MAKNA Flow — Batch Showcase Generator (0 AI Credit)');
  console.log('🚀 ========================================================');

  if (!fs.existsSync(CLIP_0) || !fs.existsSync(CLIP_1)) {
    console.error(`❌ Error: File clip sampel tidak ditemukan di ${CLIP_0} atau ${CLIP_1}`);
    process.exit(1);
  }

  if (!fs.existsSync(SHOWCASE_DIR)) {
    fs.mkdirSync(SHOWCASE_DIR, { recursive: true });
  }

  // Part 1: Render 3 Motion Text Styles
  console.log('\n--- TAHAP 1: Merender 3 Gaya Motion Text ---');
  for (const style of MOTION_TEXT_STYLES) {
    const outFile = path.join(SHOWCASE_DIR, `motion_text_${style.id}.mp4`);
    await renderMotionTextVariant(style, CLIP_0, outFile);
  }

  // Part 2: Render 7 Transition Effects
  console.log('\n--- TAHAP 2: Merender 7 Efek Transisi Video ---');
  for (const trans of TRANSITION_STYLES) {
    const outFile = path.join(SHOWCASE_DIR, `transition_${trans.id}.mp4`);
    await renderTransitionVariant(trans, CLIP_0, CLIP_1, outFile);
  }

  // Write metadata manifest for frontend HTML showcase
  const manifest = {
    generated_at: new Date().toISOString(),
    motion_texts: MOTION_TEXT_STYLES.map(s => ({
      ...s,
      video_url: `/temp/showcase/motion_text_${s.id}.mp4`
    })),
    transitions: TRANSITION_STYLES.map(t => ({
      ...t,
      video_url: `/temp/showcase/transition_${t.id}.mp4`
    }))
  };

  const manifestPath = path.join(SHOWCASE_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n📋 Manifest berhasil ditulis: ${manifestPath}`);

  console.log('\n🎉 SELURUH 10 VIDEO SHOWCASE BERHASIL DIRENDER!');
  console.log(`📁 Lokasi file: ${SHOWCASE_DIR}`);
}

main().catch(err => {
  console.error('\n💥 Fatal Error:', err);
  process.exit(1);
});

