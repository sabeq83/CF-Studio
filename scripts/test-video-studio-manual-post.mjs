/**
 * scripts/test-video-studio-manual-post.mjs
 * Pengujian manual 3 template: none, recipe_pop, problem_solution
 */
process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.PG_SEARCH_PATH = 'staging,public';

import { createFfmpegStudioJob, getFfmpegStudioJob } from '../lib/db.js';
import { triggerFfmpegStudioQueue } from '../lib/video-studio-processor.js';

const videoClips = [
  'public/temp/test_clips_2214_clip_0.mp4',
  'public/temp/test_clips_2214_clip_1.mp4',
  'public/temp/test_clips_2214_clip_2.mp4',
  'public/temp/test_clips_2214_clip_3.mp4',
  'public/temp/test_clips_2214_clip_4.mp4',
  'public/temp/test_clips_2214_clip_5.mp4'
];

const ttsBatchId = 'ttsb_opc_2214_1794817749342';

// 1. Test None
console.log('\n--- UJI 1: Template none ---');
const jobNoneId = `fsj_test_none_${Date.now()}`;
await createFfmpegStudioJob({
  id: jobNoneId,
  video_source_type: 'library',
  video_path: JSON.stringify(videoClips),
  audio_source_type: 'tts_studio',
  audio_path: ttsBatchId,
  sync_option: 'shortest',
  bgm_path: null,
  status: 'pending',
  finishing_template: 'none',
  finishing_config: JSON.stringify({}),
  audio_mode: 'tts_batch'
});
await triggerFfmpegStudioQueue();
const resNone = await getFfmpegStudioJob(jobNoneId);
console.log('Result None:', {
  id: resNone.id,
  status: resNone.status,
  finishing_status: resNone.finishing_status,
  progress_stage: resNone.progress_stage,
  output_path: resNone.output_path
});

// 2. Test Recipe Pop
console.log('\n--- UJI 2: Template recipe_pop ---');
const jobRecipeId = `fsj_test_recipe_${Date.now()}`;
const recipePlan = {
  hook: 'Sarapan Sehat Tanpa Dimasak',
  chips: ['Rolled Oat', 'Susu Segar', 'Buah Segar'],
  punches: ['sarapan sehat', 'tanpa campuran'],
  brand_patch: { name: 'Oat Sahabat', mark: 'OS' }
};

await createFfmpegStudioJob({
  id: jobRecipeId,
  video_source_type: 'library',
  video_path: JSON.stringify(videoClips),
  audio_source_type: 'tts_studio',
  audio_path: ttsBatchId,
  sync_option: 'shortest',
  bgm_path: null,
  status: 'pending',
  finishing_template: 'recipe_pop',
  finishing_config: JSON.stringify({
    finishingPlan: recipePlan,
    captionMode: 'full',
    brandName: 'Oat Sahabat',
    hookTitle: 'Sarapan Sehat Tanpa Dimasak',
    isHerbalProduct: false
  }),
  audio_mode: 'tts_batch'
});
await triggerFfmpegStudioQueue();
const resRecipe = await getFfmpegStudioJob(jobRecipeId);
console.log('Result Recipe Pop:', {
  id: resRecipe.id,
  status: resRecipe.status,
  finishing_status: resRecipe.finishing_status,
  progress_stage: resRecipe.progress_stage,
  output_path: resRecipe.output_path
});

// 3. Test Problem Solution
console.log('\n--- UJI 3: Template problem_solution ---');
const jobProblemId = `fsj_test_problem_${Date.now()}`;
const problemPlan = {
  hook: 'Selalu Skip Sarapan Pagi?',
  chapters: [
    { title: 'Buru-Buru Pagi Hari', clip_index: 0 },
    { title: 'Sarapan Tanpa Masak', clip_index: 1 },
    { title: 'Rendam Semalaman Saja', clip_index: 2 }
  ],
  punches: ['skip sarapan', 'sarapan sehat'],
  callouts: [{ label: 'Rolled Oat Murni', clip_index: 2 }],
  brand_patch: { name: 'Oat Sahabat', mark: 'OS' }
};

await createFfmpegStudioJob({
  id: jobProblemId,
  video_source_type: 'library',
  video_path: JSON.stringify(videoClips),
  audio_source_type: 'tts_studio',
  audio_path: ttsBatchId,
  sync_option: 'shortest',
  bgm_path: null,
  status: 'pending',
  finishing_template: 'problem_solution',
  finishing_config: JSON.stringify({
    finishingPlan: problemPlan,
    captionMode: 'full',
    brandName: 'Oat Sahabat',
    hookTitle: 'Selalu Skip Sarapan Pagi?',
    isHerbalProduct: false
  }),
  audio_mode: 'tts_batch'
});
await triggerFfmpegStudioQueue();
const resProblem = await getFfmpegStudioJob(jobProblemId);
console.log('Result Problem Solution:', {
  id: resProblem.id,
  status: resProblem.status,
  finishing_status: resProblem.finishing_status,
  progress_stage: resProblem.progress_stage,
  output_path: resProblem.output_path
});
