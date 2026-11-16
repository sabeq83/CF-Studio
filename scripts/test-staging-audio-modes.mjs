process.env.PG_SEARCH_PATH = 'staging,public';
process.env.DISABLE_AUTO_MIGRATIONS = 'true';

import { createFfmpegStudioJob, getFfmpegStudioJob } from './lib/db.js';
import { triggerFfmpegStudioQueue } from './lib/video-studio-processor.js';
import fs from 'fs';
import path from 'path';

async function run() {
  console.log('=== Uji Mode B (Per-Clip Audio) di Staging ===');
  const jobBId = `fsj_test_mode_b_${Date.now()}`;
  
  // Gunakan sample video dari temp
  const sampleV1 = 'public/temp/mul_261110_0up2c5_final.mp4';
  const sampleV2 = 'public/temp/mul_261110_fdkfb7_final.mp4';

  // Siapkan 2 file audio dummy wav/mp3 di public/temp jika belum ada
  const tempDir = path.join(process.cwd(), 'public', 'temp');
  const dummyA1 = path.join('public', 'temp', `dummy_a1_${Date.now()}.wav`);
  const dummyA2 = path.join('public', 'temp', `dummy_a2_${Date.now()}.wav`);

  // Generate 3s sine wav dummy audio
  const { execSync } = await import('child_process');
  execSync(`ffmpeg -y -f lavfi -i "sine=frequency=440:duration=3" -q:a 9 "${path.join(process.cwd(), dummyA1)}"`);
  execSync(`ffmpeg -y -f lavfi -i "sine=frequency=880:duration=3" -q:a 9 "${path.join(process.cwd(), dummyA2)}"`);

  const planB = {
    hook: 'Resep Rahasia Roti Lembut',
    brand: { name: 'Nutribake' }
  };

  await createFfmpegStudioJob({
    id: jobBId,
    video_source_type: 'upload',
    video_path: JSON.stringify([sampleV1, sampleV2]),
    audio_source_type: 'upload',
    audio_path: JSON.stringify([dummyA1, dummyA2]),
    audio_mode: 'per_clip',
    sync_option: 'shortest',
    bgm_path: null,
    finishing_template: 'recipe_pop',
    finishing_config: JSON.stringify({
      finishingPlan: planB,
      skin: 'pop_kuning',
      brandName: 'Nutribake',
      captionMode: 'none',
      voiceoverTexts: ['Kocok adonan tepung sampai mengembang', 'Panggang selama 20 menit']
    }),
    status: 'pending',
    yield_count: 0
  });

  console.log(`Job Mode B dibuat: ${jobBId}. Menjalankan antrean...`);
  await triggerFfmpegStudioQueue();

  const finishedB = await getFfmpegStudioJob(jobBId);
  console.log('Hasil Job Mode B:', {
    id: finishedB.id,
    status: finishedB.status,
    progress_stage: finishedB.progress_stage,
    finishing_status: finishedB.finishing_status,
    output_path: finishedB.output_path,
    error_log: finishedB.error_log
  });

  console.log('\n=== Uji Mode A (Single Audio) di Staging ===');
  const jobAId = `fsj_test_mode_a_${Date.now()}`;
  const dummySingleAudio = path.join('public', 'temp', `dummy_single_${Date.now()}.wav`);
  execSync(`ffmpeg -y -f lavfi -i "sine=frequency=520:duration=6" -q:a 9 "${path.join(process.cwd(), dummySingleAudio)}"`);

  const planA = {
    hook: 'Solusi Kulit Kusam Seketika',
    brand: { name: 'GlowSkin' }
  };

  await createFfmpegStudioJob({
    id: jobAId,
    video_source_type: 'upload',
    video_path: JSON.stringify([sampleV1, sampleV2]),
    audio_source_type: 'upload',
    audio_path: dummySingleAudio,
    audio_mode: 'single',
    sync_option: 'shortest',
    bgm_path: null,
    finishing_template: 'problem_solution',
    finishing_config: JSON.stringify({
      finishingPlan: planA,
      skin: 'problem_solution_clean',
      brandName: 'GlowSkin',
      captionMode: 'none',
      captionText: 'Atasi kulit kering dengan formula hidrasi aktif'
    }),
    status: 'pending',
    yield_count: 0
  });

  console.log(`Job Mode A dibuat: ${jobAId}. Menjalankan antrean...`);
  await triggerFfmpegStudioQueue();

  const finishedA = await getFfmpegStudioJob(jobAId);
  console.log('Hasil Job Mode A:', {
    id: finishedA.id,
    status: finishedA.status,
    progress_stage: finishedA.progress_stage,
    finishing_status: finishedA.finishing_status,
    output_path: finishedA.output_path,
    error_log: finishedA.error_log
  });

  process.exit(0);
}

run().catch(err => {
  console.error('Error saat pengujian staging:', err);
  process.exit(1);
});
