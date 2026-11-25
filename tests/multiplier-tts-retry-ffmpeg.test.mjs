import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAudioConcatArgs } from '../lib/audio-helper.js';
import { sqliteToPgQuery } from '../lib/db.js';

test('buildAudioConcatArgs appends aresample=44100 and stereo libmp3lame flags for mp3 outputs', () => {
  const args = buildAudioConcatArgs(['/tmp/a.mp3', '/tmp/b.mp3'], '/tmp/combined.mp3');
  assert.deepEqual(args, [
    '-y',
    '-i', '/tmp/a.mp3',
    '-i', '/tmp/b.mp3',
    '-filter_complex', '[0:a][1:a]concat=n=2:v=0:a=1,aresample=44100[a]',
    '-map', '[a]',
    '-ar', '44100',
    '-ac', '2',
    '-c:a', 'libmp3lame',
    '-b:a', '128k',
    '/tmp/combined.mp3',
  ]);
});

test('sqliteToPgQuery translates INSERT OR REPLACE on tts_studio_batches and tts_studio_clips to ON CONFLICT (id) DO UPDATE', () => {
  const batchPg = sqliteToPgQuery(`
    INSERT OR REPLACE INTO tts_studio_batches (id, source_type, source_ref_id, provider_active)
    VALUES (?, ?, ?, ?)
  `);
  assert.match(batchPg, /ON CONFLICT \(id\) DO UPDATE SET/i);
  assert.match(batchPg, /source_type = EXCLUDED\.source_type/i);

  const clipPg = sqliteToPgQuery(`
    INSERT OR REPLACE INTO tts_studio_clips (id, batch_id, clip_index, source_text, audio_path, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  assert.match(clipPg, /ON CONFLICT \(id\) DO UPDATE SET/i);
  assert.match(clipPg, /status = EXCLUDED\.status/i);
});
