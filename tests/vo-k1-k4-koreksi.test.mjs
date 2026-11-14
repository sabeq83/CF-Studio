import assert from 'node:assert/strict';
import test from 'node:test';
import {
  enforceHerbalHookSafety,
  runPlannerContentEditorStep
} from '../lib/content-planner-engine.js';
import {
  buildVoiceoverSaveUpdates,
  getMultiplierWaitingBadge,
  getPillarItemStatusInfo,
  isPillarItemBlocked
} from '../lib/vo-status-ui.js';
import { autoDetectNarrativeMode } from '../lib/pillar-campaign-ingest.js';
import {
  resolveIsHerbalOrHealthTarget,
  resolveIsHerbalProduct,
  resolvePreRenderFinishingMeta
} from '../lib/tiktok-compliance-service.js';

function legacyAutoDetectNarrativeMode7e4d5b4(row) {
  if (row.narrative_mode && row.narrative_mode !== 'Storytelling' && row.narrative_mode !== 'auto') {
    return row.narrative_mode;
  }
  const text = `${row.pillar || ''} ${row.category_cep || ''} ${row.vfo || ''} ${row.strategic_angle || ''}`.toLowerCase();
  if (['edukasi', 'tips', 'tutorial', 'review', 'pengetahuan'].some(term => text.includes(term))) {
    return 'Educational Review';
  }
  if (['promo', 'diskon', 'hard sell', 'hardsell', 'beli', 'penawaran'].some(term => text.includes(term))) {
    return 'Promo Hard Sell';
  }
  return 'Storytelling';
}

const STAGING_12_ROWS = [
  {
    id: 'row_01e1aa9f',
    pillar: 'Problem-Solution Based',
    category_cep: 'Problem-Solution Based',
    vfo: 'Aspirational (Gaya Hidup & Transformasi)',
    strategic_angle: 'The Stress Test',
    context: 'Menjelang tidur malam di kamar tidur, saat merenungkan aktivitas padat seharian dan kekhawatiran terhadap kesehatan jantung setelah sering mengonsumsi makanan bersantan.',
    content_subject: 'Menjaga kesehatan jantung secara praktis dengan rutinitas harian.',
    narrative_mode: 'Storytelling'
  },
  {
    id: 'row_3fac2a26',
    pillar: 'cara memperbaiki akustik ruangan',
    category_cep: 'Commitment Based',
    vfo: 'Aspirational (Gaya Hidup & Transformasi)',
    strategic_angle: 'The Spatial Calibrator',
    context: 'Malam hari saat hendak beristirahat, suara bising dari luar dan pantulan gema di dalam kamar tidur utama masih terasa mengganggu, membuat proses pemulihan energi setelah seharian bekerja menjadi tidak maksimal.',
    content_subject: 'Langkah awal meredam gema dan bising kamar',
    narrative_mode: 'Storytelling'
  },
  {
    id: 'row_4b8c0889',
    pillar: 'cara agar suara tidak keluar kamar',
    category_cep: 'Problem-Solution Based',
    vfo: 'Instinctive (Emosi & Sensorik Visual)',
    strategic_angle: 'The Safe Haven',
    context: 'Malam hari ketika hendak beristirahat, suara bising dari luar masih menembus dinding kamar tidur utama, sehingga mengganggu waktu tidur dan membuat suasana istirahat kurang nyaman.',
    content_subject: 'Mengenal cara dasar meredam suara agar kamar tidur kembali tenang',
    narrative_mode: 'Storytelling'
  },
  {
    id: 'row_63c55808',
    pillar: 'Problem-Solution Based',
    category_cep: 'Problem-Solution Based',
    vfo: 'Aspirational (Gaya Hidup & Transformasi)',
    strategic_angle: 'The Stress Test',
    context: 'Malam hari di ruang keluarga, saat Bunda merenungkan pentingnya menjaga kesehatan jantung agar tetap bugar menemani keluarga tercinta di masa depan.',
    content_subject: 'Merawat kesehatan jantung secara praktis dan alami setiap hari',
    narrative_mode: 'Storytelling'
  },
  {
    id: 'row_75bc67e3',
    pillar: 'peredam panas gudang',
    category_cep: 'Opportunistic Based',
    vfo: 'Uncharted (Sudut Pandang Unik / Mind-Blowing)',
    strategic_angle: 'The Problem You Didn\'t Know',
    context: 'Saat pemilik gudang melakukan kunjungan mendadak dan menyadari kenaikan suhu ekstrem yang tak terduga, ia melihat potensi kerusakan pada stok barang akibat panas yang tiba-tiba menyengat dari atap.',
    content_subject: 'Kerugian Tak Terduga Akibat Fluktuasi Suhu di Gudang: Lebih dari Sekadar Panas Sesekali.',
    narrative_mode: 'Storytelling'
  },
  {
    id: 'row_7f0708d0',
    pillar: 'Problem-Solution Based',
    category_cep: 'Problem-Solution Based',
    vfo: 'Concrete (Fakta & Produk Langsung)',
    strategic_angle: 'The Alpha',
    context: 'Mendapati adonan kue cokelat buatan rumah tampak pucat dan kurang beraroma kuat saat sedang bersiap menyajikannya untuk keluarga di sore hari',
    content_subject: 'Solusi mengatasi warna kue pucat dengan bubuk cokelat murni pekat',
    narrative_mode: 'Storytelling'
  },
  {
    id: 'row_861119ec',
    pillar: 'Problem-Solution Based',
    category_cep: 'Problem-Solution Based',
    vfo: 'Aspirational (Gaya Hidup & Transformasi)',
    strategic_angle: 'The Comparison (David vs Goliath)',
    context: 'Di pagi hari yang santai di meja makan, saat merenungkan pentingnya menjaga kesehatan jantung agar tetap prima dan bugar dalam mendampingi keluarga tercinta.',
    content_subject: 'Menjaga kesehatan jantung secara alami melalui rutinitas harian',
    narrative_mode: 'Storytelling'
  },
  {
    id: 'row_9a6b9384',
    pillar: 'cara menghilangkan gema di ruangan',
    category_cep: 'Routine Based',
    vfo: 'Concrete (Fakta & Produk Langsung)',
    strategic_angle: 'The Comparison (David vs Goliath)',
    context: 'Setiap jam makan siang di kantin kantor, sulit sekali berkomunikasi dengan rekan kerja karena suara percakapan jadi tumpang tindih dan bergema keras. Ini membuat diskusi jadi kurang efektif dan cepat memicu kelelahan.',
    content_subject: 'Mitos vs. Fakta: Solusi Gema Ruangan di Lingkungan Kantor',
    narrative_mode: 'Storytelling'
  },
  {
    id: 'row_a7ad47a1',
    pillar: 'Problem-Solution Based',
    category_cep: 'Problem-Solution Based',
    vfo: 'Instinctive (Emosi & Sensorik Visual)',
    strategic_angle: 'The Absurdity',
    context: 'Menikmati camilan cokelat saat diet seringkali dilematis karena khawatir tambahan gula merusak target harian, padahal tubuh hanya butuh kepuasan sensorik rasa cokelat murni yang pekat.',
    content_subject: 'Edukasi menikmati kreasi cokelat tanpa gula tambahan untuk teman diet',
    narrative_mode: 'Storytelling'
  },
  {
    id: 'row_b202d62b',
    pillar: 'Problem-Solution Based',
    category_cep: 'Problem-Solution Based',
    vfo: 'Aspirational (Gaya Hidup & Transformasi)',
    strategic_angle: 'The Blind Test',
    context: 'Melihat angka kolesterol di atas batas normal pada hasil cek lab mingguan sering kali memicu kekhawatiran tersendiri di tengah upaya menjaga pola makan sehat.',
    content_subject: 'Menjaga kestabilan kolesterol tubuh secara alami lewat rutinitas harian',
    narrative_mode: 'Storytelling'
  },
  {
    id: 'row_d2c557e2',
    pillar: 'glasswool foil',
    category_cep: 'Routine Based',
    vfo: 'Concrete (Fakta & Produk Langsung)',
    strategic_angle: 'The Scientific Proof',
    context: 'Saat pekerja pabrik mulai merasakan penurunan fokus akibat panas terik yang merambat langsung dari atap tanpa insulasi pelindung.',
    content_subject: 'Efisiensi pemantulan panas menggunakan glasswool foil',
    narrative_mode: 'Storytelling'
  },
  {
    id: 'row_dd45f3a4',
    pillar: 'jual peredam panas atap',
    category_cep: 'Opportunistic Based',
    vfo: 'Concrete (Fakta & Produk Langsung)',
    strategic_angle: 'The Math Whiz',
    context: 'Saat musim kemarau melanda dan suhu dalam rumah terasa memanggang, Anda sering terkejut melihat lonjakan tagihan listrik AC. Situasi ini mendorong Anda untuk segera mencari \'jual peredam panas atap\' secara online, berharap menemukan solusi instan yang bisa meringankan beban pengeluaran bulanan.',
    content_subject: 'Perhitungan Penghematan Listrik dengan Peredam Panas Atap',
    narrative_mode: 'Storytelling'
  }
];

test('K1: runPlannerContentEditorStep executes 0 Gemini calls when flag is OFF and Math.ceil(n/6) calls when ON, while V0-2 hook filter remains active', async () => {
  const sampleRows = Array.from({ length: 7 }, (_, i) => ({
    sequence: i + 1,
    pillar: 'Kesehatan Harian',
    hook: `Hook uji ${i + 1}`,
    context: 'pagi sebelum beraktivitas'
  }));

  let offCallCount = 0;
  const offRes = await runPlannerContentEditorStep({
    finalRows: sampleRows,
    plannerMeta: { vo_content_contract: 'off' },
    callGeminiJsonFn: async () => {
      offCallCount += 1;
      return [];
    }
  });
  assert.equal(offRes.enabled, false);
  assert.equal(offCallCount, 0);
  assert.equal(offRes.payloadBySeq.size, 0);

  let onCallCount = 0;
  const onRes = await runPlannerContentEditorStep({
    finalRows: sampleRows,
    plannerMeta: { vo_content_contract: 'on' },
    targetClipsForPayload: 4,
    callGeminiJsonFn: async (prompt) => {
      onCallCount += 1;
      assert.ok(prompt.includes('sequence'));
      if (onCallCount === 1) {
        return sampleRows.slice(0, 6).map(r => ({
          sequence: r.sequence,
          search_intent: `Intent ${r.sequence}`,
          search_answer: `Jawaban ${r.sequence}`,
          takeaways: [{ point: 'Langkah konkrit', anchor: '200 ml air hangat', anchor_type: 'takaran', source: 'data_produk' }],
          needs_data: []
        }));
      }
      return [{
        sequence: 7,
        search_intent: 'Intent 7',
        search_answer: 'Jawaban 7',
        takeaways: [{ point: 'Langkah konkrit 7', anchor: '1 sendok makan', anchor_type: 'takaran', source: 'data_produk' }],
        needs_data: []
      }];
    }
  });
  assert.equal(onRes.enabled, true);
  assert.equal(onCallCount, 2);
  assert.equal(onRes.payloadBySeq.size, 7);

  // V0-2 herbal hook safety still active independent of vo_content_contract
  const hookRows = [{ sequence: 1, hook: 'Cara ampuh mengobati kolesterol tinggi', context: 'pagi hari' }];
  const hookCheck = await enforceHerbalHookSafety(hookRows, { isHerbalTarget: true, productName: 'Garlibee' });
  assert.equal(hookCheck.rewrittenCount, 1);
  assert.ok(!hookRows[0].hook.toLowerCase().includes('kolesterol'));
});

test('K2: UI status helpers & Quick Edit VO clear review_state/review_reason and reset tts_status to pending', () => {
  const claimBlockedItem = {
    id: 101,
    workflow_status: 'waiting_approval',
    tts_status: 'paused_compliance',
    review_state: 'vo_claim_blocked',
    review_reason: 'Diblokir sebelum TTS: klaim medis/herbal (sembuhkan kolesterol)',
    visual_status: 'pending',
    result_json: JSON.stringify({ voiceover: [{ scene: 1, narration: 'Ini bisa sembuhkan kolesterol' }] }),
    new_video_plan_json: JSON.stringify([{ clip_index: 1, new_vo: 'Ini bisa sembuhkan kolesterol' }])
  };
  assert.equal(isPillarItemBlocked(claimBlockedItem), true);
  const claimBadge = getPillarItemStatusInfo(claimBlockedItem);
  assert.equal(claimBadge.text, '🚫 Diblokir: klaim kesehatan');
  assert.equal(claimBadge.color, 'var(--status-danger)');
  assert.equal(claimBadge.bg, 'var(--status-danger-soft)');

  const qualityBlockedItem = {
    id: 102,
    workflow_status: 'waiting_approval',
    tts_status: 'pending',
    review_state: 'vo_quality_blocked',
    review_reason: 'VO Quality Gate menahan item: 2 kalimat samar tanpa anchor'
  };
  const qualityBadge = getPillarItemStatusInfo(qualityBlockedItem);
  assert.equal(qualityBadge.text, '⚠️ VO di bawah standar');
  assert.equal(qualityBadge.color, 'var(--status-warning)');
  assert.equal(qualityBadge.bg, 'var(--status-warning-soft)');

  const multClaimBadge = getMultiplierWaitingBadge({
    status: 'waiting_approval',
    error_message: 'Diblokir sebelum TTS: ditemukan klaim medis/herbal (kolesterol).'
  });
  assert.equal(multClaimBadge.text, '🚫 Diblokir: klaim kesehatan');

  const multQualBadge = getMultiplierWaitingBadge({
    status: 'waiting_approval',
    error_message: 'VO Quality Gate menahan eksekusi karena skor rendah.'
  });
  assert.equal(multQualBadge.text, '⚠️ VO di bawah standar');

  const { updateFields } = buildVoiceoverSaveUpdates(claimBlockedItem, {
    voiceover: [{ scene: 1, narration: 'Seduh 1 sendok madu dengan 200 ml air hangat.' }],
    auto_trigger_remux: false
  });
  assert.equal(updateFields.tts_status, 'pending');
  assert.equal(updateFields.review_state, null);
  assert.equal(updateFields.review_reason, null);
  assert.equal(updateFields.workflow_status, 'production_processing');
});

test('K3: autoDetectNarrativeMode with flag OFF matches baseline 7e4d5b4 on all 12 real staging rows', () => {
  for (const row of STAGING_12_ROWS) {
    const legacy = legacyAutoDetectNarrativeMode7e4d5b4(row);
    const currentOff = autoDetectNarrativeMode(row, { voContentContract: 'off', isKeywordMode: false });
    assert.equal(currentOff, legacy, `Mismatch for ${row.id}`);
  }

  // Row row_a7ad47a1 has "Edukasi" only inside content_subject: OFF stays Storytelling, ON switches to Educational Review
  const edukasiSubjectRow = STAGING_12_ROWS.find(r => r.id === 'row_a7ad47a1');
  assert.equal(autoDetectNarrativeMode(edukasiSubjectRow, { voContentContract: 'off' }), 'Storytelling');
  assert.equal(autoDetectNarrativeMode(edukasiSubjectRow, { voContentContract: 'on' }), 'Educational Review');
});

test('K4: resolveIsHerbalOrHealthTarget handles substring tokens & guards non-herbal tools', () => {
  assert.equal(resolveIsHerbalOrHealthTarget({ brandName: 'siasatsehat' }), true);
  assert.equal(resolveIsHerbalOrHealthTarget({ brandName: 'Siasat Sehat' }), true);
  assert.equal(resolveIsHerbalOrHealthTarget({ brandName: 'Dapur Botani', productName: 'Garlickys Bumbu Rempah Dapur Bubuk' }), true);
  assert.equal(resolveIsHerbalOrHealthTarget({ brandName: 'Dapur Botani', contentPillar: 'Niat Sehat yang Sering Tertunda' }), true);

  // Non-herbal kitchen tool tagged 'dapurbotani' must remain false
  assert.equal(resolveIsHerbalOrHealthTarget({
    brandName: 'Dapur Botani',
    productName: 'Oita Pengasah Pisau Dapur 4in1',
    category: 'Perlengkapan Dapur / Pengasah Pisau',
    tags: 'dapurbotani',
    editorialPillars: '["Niat Sehat yang Sering Tertunda"]'
  }), false);
  assert.equal(resolveIsHerbalProduct({
    productName: 'Oita Pengasah Pisau Dapur 4in1',
    category: 'Perlengkapan Dapur / Pengasah Pisau',
    tags: 'dapurbotani'
  }), false);

  // Non-herbal brands remain false so nutrition words like 'lemak' are never claim-blocked as herbal
  assert.equal(resolveIsHerbalOrHealthTarget({ brandName: 'Habitfolk', knowledgeDomain: 'general' }), false);
  assert.equal(resolveIsHerbalOrHealthTarget({ brandName: 'Sasyahouse', knowledgeDomain: 'general' }), false);
  assert.equal(resolveIsHerbalOrHealthTarget({ brandName: 'Ruang Akustik ID', knowledgeDomain: 'general' }), false);
  assert.equal(resolveIsHerbalOrHealthTarget({ brandName: 'Solusi Thermal ID', knowledgeDomain: 'home_improvement' }), false);

  // Domain 'herbal' detected via knowledgeDomain
  assert.equal(resolveIsHerbalOrHealthTarget({ brandName: 'NutriBlend', knowledgeDomain: 'herbal' }), true);
});

test('K5: resolvePreRenderFinishingMeta gates bridging.finishing_plan behind vo_content_contract === on', async () => {
  const bridgingWithPlan = JSON.stringify({
    finishing_plan: { tips: [{ clip_index: 1, text: '1 sendok makan' }] }
  });
  const offMeta = await resolvePreRenderFinishingMeta({
    task: {
      bridging_config_json: bridgingWithPlan,
      vso_config_json: JSON.stringify({ vo_content_contract: 'off' }),
      product_snapshot_json: JSON.stringify({ product_name: 'Garlibee' })
    }
  });
  assert.equal(offMeta.finishingPlan, null);

  const onMeta = await resolvePreRenderFinishingMeta({
    task: {
      bridging_config_json: bridgingWithPlan,
      vso_config_json: JSON.stringify({ vo_content_contract: 'on' }),
      product_snapshot_json: JSON.stringify({ product_name: 'Garlibee' })
    }
  });
  assert.ok(onMeta.finishingPlan && Array.isArray(onMeta.finishingPlan.tips));
});


test('K2b: Simpan VO pada item normal waiting_approval (tidak diblokir) tidak mereset TTS / status', () => {
  const normalItem = {
    workflow_status: 'waiting_approval',
    tts_status: 'pending',
    review_state: 'changes_requested',
    result_json: JSON.stringify({ voiceover: [{ scene: 1, narration: 'lama' }] }),
    new_video_plan_json: '[]'
  };
  const { updateFields } = buildVoiceoverSaveUpdates(normalItem, {
    voiceover: [{ scene: 1, narration: 'baru' }],
    auto_trigger_remux: false
  });
  assert.equal(updateFields.workflow_status, undefined);
  assert.equal(updateFields.tts_status, undefined);
  assert.equal(updateFields.review_state, undefined);
  assert.ok(updateFields.result_json.includes('baru'));
});

test('K2c: Scheduler menahan item VO terblokir walau full_autopilot', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../lib/campaign-scheduler.js', import.meta.url), 'utf8');
  const guardIdx = src.indexOf('if (!isOpcFullAutopilot && !isOpcApprovedForProduction)');
  const blockedIdx = src.indexOf('if (isPillarItemBlocked(currentItem))');
  const ttsIdx = src.indexOf('// 2. TTS Stage (Bikin TTS Sampai Selesai)');
  assert.ok(guardIdx > 0 && blockedIdx > guardIdx && ttsIdx > blockedIdx, 'guard blokir VO harus berada setelah approval guard dan sebelum tahap TTS');
});
