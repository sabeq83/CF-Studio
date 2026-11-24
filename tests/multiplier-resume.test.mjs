import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  resolveMultiplierResumeStage,
  resolveMultiplierFailedStage,
  isMultiplierTtsOptional,
  getMultiplierResumeInfo,
} from '../lib/multiplier-resume.js';
import { inspectMultiplierTaskArtifacts } from '../lib/multiplier-artifacts.js';

const ROOT = process.cwd();

test('resolveMultiplierResumeStage skips T2I/Visuals and resumes directly to ffmpeg_muxing when clips exist', () => {
  const task = {
    id: 'mul_test_ffmpeg',
    status: 'failed',
    failed_stage: 'ffmpeg',
    remake_storyboard_json: JSON.stringify([{ scene: 1 }, { scene: 2 }]),
    t2i_i2v_prompts_json: JSON.stringify([{ scene: 1 }, { scene: 2 }]),
    bridging_config_json: JSON.stringify({ visual_mode: 'hybrid_lock' }),
    audio_config_json: JSON.stringify({ audio_engine_mode: 'no_vo', enable_tts: 0 }),
    t2i_images_json: JSON.stringify(['/a.png', '/b.png']),
    glabs_task_ids: JSON.stringify(['g1', 'g2']),
  };

  assert.equal(resolveMultiplierResumeStage(task, { has_visual_clips: true, has_final_video: false }), 'ffmpeg_muxing');
  assert.equal(resolveMultiplierResumeStage(task, { has_visual_clips: true, has_final_video: true }), 'ffmpeg_muxing');

  const info = getMultiplierResumeInfo(task, { has_visual_clips: true, has_final_video: false });
  assert.equal(info.stage, 'ffmpeg_muxing');
  assert.equal(info.shortLabel, 'FFmpeg');
});

test('resolveMultiplierResumeStage resumes to uploading_assets, generating_visuals, generating_audio, or generating_t2i accurately', () => {
  const baseTask = {
    id: 'mul_test_stages',
    remake_storyboard_json: JSON.stringify([{ scene: 1 }, { scene: 2 }]),
    t2i_i2v_prompts_json: JSON.stringify([{ scene: 1 }, { scene: 2 }]),
    bridging_config_json: JSON.stringify({ visual_mode: 'hybrid_lock' }),
    audio_config_json: JSON.stringify({ audio_engine_mode: 'no_vo', enable_tts: 0 }),
  };

  assert.equal(
    resolveMultiplierResumeStage({ ...baseTask, nextcloud_video_url: null }, { has_final_video: true, has_visual_clips: true }),
    'uploading_assets'
  );
  assert.equal(
    resolveMultiplierResumeStage(baseTask, { has_all_t2i_images: true, has_visual_clips: false }),
    'generating_visuals'
  );
  assert.equal(
    resolveMultiplierResumeStage(
      { ...baseTask, audio_config_json: JSON.stringify({ audio_engine_mode: 'minimax_tts', enable_tts: true }) },
      { has_all_t2i_images: true, has_combined_audio: false, has_visual_clips: false }
    ),
    'generating_audio'
  );
  assert.equal(
    resolveMultiplierResumeStage(baseTask, { has_all_t2i_images: false, has_visual_clips: false }),
    'generating_t2i'
  );
  assert.equal(
    resolveMultiplierResumeStage({ id: 'mul_empty', remake_storyboard_json: '[]', t2i_i2v_prompts_json: '[]' }, {}),
    'pending_resolution'
  );
});

test('resolveMultiplierFailedStage and isMultiplierTtsOptional never misclassify No-VO tasks as tts_failed', () => {
  assert.equal(isMultiplierTtsOptional({ audio_engine_mode: 'no_vo' }, {}), true);
  assert.equal(isMultiplierTtsOptional({ audio_engine_mode: 'native_veo' }, {}), true);
  assert.equal(isMultiplierTtsOptional({ enable_tts: false }, {}), true);
  assert.equal(isMultiplierTtsOptional({ audio_engine_mode: 'minimax_tts', enable_tts: 1 }, {}), false);

  const noVoFailedFfmpeg = {
    id: 'mul_novo_fail',
    status: 'failed',
    failed_stage: null,
    remake_storyboard_json: JSON.stringify([{ scene: 1 }, { scene: 2 }]),
    t2i_i2v_prompts_json: JSON.stringify([{ scene: 1 }, { scene: 2 }]),
    audio_config_json: JSON.stringify({ audio_engine_mode: 'no_vo', enable_tts: 0 }),
    t2i_images_json: JSON.stringify(['/a.png', '/b.png']),
    glabs_task_ids: JSON.stringify(['g1', 'g2']),
  };
  assert.equal(
    resolveMultiplierFailedStage(noVoFailedFfmpeg, { has_visual_clips: true, has_any_t2i_images: true }),
    'ffmpeg'
  );
  assert.equal(
    resolveMultiplierFailedStage({ ...noVoFailedFfmpeg, failed_stage: 'cloud' }, { has_visual_clips: true }),
    'cloud'
  );
});

test('inspectMultiplierTaskArtifacts detects existing local mp4 clips and start frames on disk', () => {
  const prevCwd = process.cwd();
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-mul-artifacts-'));
  try {
    fs.mkdirSync(path.join(tmpRoot, 'public', 'temp'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'public', 'uploads', 'start_frames'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'public', 'temp', 'mult_clip_mul_disk_1_0.mp4'), 'clip0');
    fs.writeFileSync(path.join(tmpRoot, 'public', 'temp', 'mult_clip_mul_disk_1_1.mp4'), 'clip1');
    fs.writeFileSync(path.join(tmpRoot, 'public', 'uploads', 'start_frames', 'sf1.png'), 'png1');
    fs.writeFileSync(path.join(tmpRoot, 'public', 'uploads', 'start_frames', 'sf2.png'), 'png2');

    process.chdir(tmpRoot);
    const task = {
      id: 'mul_disk_1',
      status: 'failed',
      remake_storyboard_json: JSON.stringify([{ scene: 1 }, { scene: 2 }]),
      t2i_i2v_prompts_json: JSON.stringify([{ scene: 1 }, { scene: 2 }]),
      t2i_images_json: JSON.stringify([
        '/uploads/start_frames/sf1.png',
        '/uploads/start_frames/sf2.png',
      ]),
      audio_config_json: JSON.stringify({ audio_engine_mode: 'no_vo', enable_tts: 0 }),
      bridging_config_json: JSON.stringify({ visual_mode: 'hybrid_lock' }),
    };

    const artifacts = inspectMultiplierTaskArtifacts(task, []);
    assert.equal(artifacts.clip_count, 2);
    assert.equal(artifacts.has_local_visual_clips, true);
    assert.equal(artifacts.has_visual_clips, true);
    assert.equal(artifacts.has_all_t2i_images, true);
    assert.equal(artifacts.recommended_resume_stage, 'ffmpeg_muxing');
  } finally {
    process.chdir(prevCwd);
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('Multiplier API, worker, MCP, and detail UI implement Smart Resume contracts cleanly', () => {
  const apiRoute = fs.readFileSync(path.join(ROOT, 'app/api/v2/multiplier/route.js'), 'utf8');
  assert.ok(apiRoute.includes('inspectMultiplierTaskArtifacts'));
  assert.ok(apiRoute.includes("mode === 'restart_all'"));
  assert.ok(apiRoute.includes('failed_stage = NULL'));

  const retryStageRoute = fs.readFileSync(path.join(ROOT, 'app/api/v2/multiplier/[id]/retry/route.js'), 'utf8');
  assert.ok(retryStageRoute.includes("stage === 'cloud'"));
  assert.ok(retryStageRoute.includes("nextStatus = 'uploading_assets'"));

  const workerSrc = fs.readFileSync(path.join(ROOT, 'lib/re-multiplier-worker.js'), 'utf8');
  assert.ok(workerSrc.includes('Reusing existing start frame'));
  assert.ok(workerSrc.includes("currentStatus === 'uploading_assets'"));
  assert.ok(workerSrc.includes('failed_stage: failedStage'));

  const pageSrc = fs.readFileSync(path.join(ROOT, 'app/multiplier-lab/[id]/page.js'), 'utf8');
  assert.ok(!pageSrc.includes('video_paths_json'));
  assert.ok(pageSrc.includes('resolveMultiplierFailedStage'));
  assert.ok(pageSrc.includes('Tanpa VO (Skipped)'));
  assert.ok(pageSrc.includes('Ulang dari Awal'));

  const mcpSrc = fs.readFileSync(path.join(ROOT, 'apps/mcp/tools.mjs'), 'utf8');
  assert.ok(mcpSrc.includes("'smart_resume', 'restart_all'"));
});
