import test from 'node:test';
import assert from 'node:assert/strict';

test('Quick Edit Voiceover logic updates result_json and new_video_plan_json while preserving visual clips', () => {
  const item = {
    id: '2015',
    result_json: JSON.stringify({
      title: 'Solusi Alami Kolesterol',
      voiceover: [
        { scene: 1, narration: 'Old hook text' },
        { scene: 2, narration: 'Old scene 2' },
        { scene: 3, narration: 'Old scene 3' },
        { scene: 4, narration: 'Old scene 4' },
        { scene: 5, narration: 'Old scene 5' },
        { scene: 6, narration: 'link pembelian aku taruh di Bio ya!' }
      ]
    }),
    new_video_plan_json: JSON.stringify([
      { clip_index: 1, new_vo: 'Old hook text', t2i_prompt: 'prompt 1' },
      { clip_index: 2, new_vo: 'Old scene 2', t2i_prompt: 'prompt 2' },
      { clip_index: 3, new_vo: 'Old scene 3', t2i_prompt: 'prompt 3' },
      { clip_index: 4, new_vo: 'Old scene 4', t2i_prompt: 'prompt 4' },
      { clip_index: 5, new_vo: 'Old scene 5', t2i_prompt: 'prompt 5' },
      { clip_index: 6, new_vo: 'link pembelian aku taruh di Bio ya!', t2i_prompt: 'prompt 6' }
    ]),
    visual_status: 'completed',
    visual_clip_paths: JSON.stringify([
      '/temp/clip_1.mp4',
      '/temp/clip_2.mp4',
      '/temp/clip_3.mp4',
      '/temp/clip_4.mp4',
      '/temp/clip_5.mp4',
      '/temp/clip_6.mp4'
    ]),
    ffmpeg_status: 'completed',
    ffmpeg_output_path: '/temp/opc_final_2015.mp4',
    workflow_status: 'completed'
  };

  const newVoiceoverPayload = [
    { scene: 1, narration: 'Angka kolesterol suami bikin malam Bunda jadi gelisah?' },
    { scene: 2, narration: 'Melihat hasil lab yang kurang pas di malam hari tentu memicu pikiran.' },
    { scene: 3, narration: 'Tubuh memerlukan perhatian ekstra untuk menjaga metabolisme harian.' },
    { scene: 4, narration: 'Langkah awal dimulai dari pemilihan asupan harian yang praktis.' },
    { scene: 5, narration: 'Hadirkan Garlibee Honey Infused Solo Garlic untuk keluarga.' },
    { scene: 6, narration: 'produk ori klik link di bawah ya!' }
  ];

  // Simulasi parsing & mapping seperti di route.js
  let resultJson = JSON.parse(item.result_json || '{}');
  resultJson.voiceover = newVoiceoverPayload.map(v => ({
    scene: Number(v.scene),
    narration: String(v.narration || '').trim()
  }));

  let planJson = JSON.parse(item.new_video_plan_json || '[]');
  planJson = planJson.map((p, idx) => {
    const match = resultJson.voiceover.find(v => Number(v.scene) === Number(p.clip_index || idx + 1));
    return {
      ...p,
      new_vo: match ? match.narration : (p.new_vo || '')
    };
  });

  const updateFields = {
    result_json: JSON.stringify(resultJson),
    new_video_plan_json: JSON.stringify(planJson)
  };

  const auto_trigger_remux = true;
  if (auto_trigger_remux) {
    const visualPaths = JSON.parse(item.visual_clip_paths || '[]');
    assert.equal(item.visual_status, 'completed');
    assert.equal(visualPaths.length, 6);

    updateFields.workflow_status = 'production_processing';
    updateFields.tts_status = 'pending';
    updateFields.tts_batch_id = null;
    updateFields.ffmpeg_status = 'pending';
    updateFields.ffmpeg_output_path = null;
    updateFields.upload_status = 'pending';
    updateFields.drive_link = null;
    updateFields.social_post_status = 'pending';
    updateFields.social_links_json = null;
    updateFields.retry_count = 0;
  }

  // Verifikasi CTA telah berubah pada result_json dan planJson
  const updatedResult = JSON.parse(updateFields.result_json);
  const updatedPlan = JSON.parse(updateFields.new_video_plan_json);

  assert.equal(updatedResult.voiceover[5].narration, 'produk ori klik link di bawah ya!');
  assert.equal(updatedPlan[5].new_vo, 'produk ori klik link di bawah ya!');

  // Verifikasi T2I prompt asli tidak terhapus
  assert.equal(updatedPlan[0].t2i_prompt, 'prompt 1');
  assert.equal(updatedPlan[5].t2i_prompt, 'prompt 6');

  // Verifikasi visual clips tidak disentuh
  assert.equal(item.visual_clip_paths.includes('/temp/clip_1.mp4'), true);
  assert.equal(updateFields.visual_clip_paths, undefined); // Tidak disentuh / diubah

  // Verifikasi workflow status siap TTS & Re-mux
  assert.equal(updateFields.workflow_status, 'production_processing');
  assert.equal(updateFields.tts_status, 'pending');
  assert.equal(updateFields.ffmpeg_status, 'pending');
  assert.equal(updateFields.tts_batch_id, null);
  assert.equal(updateFields.ffmpeg_output_path, null);
});

test('Quick Edit Voiceover rejects auto-remux when visual clips are missing or incomplete', () => {
  const itemIncomplete = {
    id: '2099',
    visual_status: 'processing',
    visual_clip_paths: null
  };

  let visualPaths = [];
  try { visualPaths = JSON.parse(itemIncomplete.visual_clip_paths || '[]'); } catch (_) {}

  const canAutoRemux = itemIncomplete.visual_status === 'completed' && Array.isArray(visualPaths) && visualPaths.length > 0;
  assert.equal(canAutoRemux, false, 'Must disallow auto-remux if visuals are not completed');
});

