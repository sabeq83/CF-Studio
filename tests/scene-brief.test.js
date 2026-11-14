import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSceneBrief, parseWsMatrix } from '../lib/scene-brief.js';

const REAL_PLANNER_ROWS = [
  {
    id: 2051,
    content_pillar: 'Commitment Based',
    ws_matrix: 'When: Malam hari menjelang tidur | While: Merenungkan kesehatan jangka panjang | How Feeling: Ada rasa cemas tersembunyi mengenai kondisi kesehatan jantung di usia sekarang.',
    context: 'Malam hari di meja sudut ruang keluarga, saat Bunda duduk santai merenungkan pentingnya menjaga kestabilan fisik dan kesehatan jantung demi masa depan keluarga.',
    strategic_angle: 'The Rebel Choice',
    visual_action_guideline: 'Kamera melakukan slow dolly in dari sudut meja ruang keluarga yang temaram. Bunda duduk tenang memegang cangkir hangat.',
    expectLoc: /ruang keluarga/i,
    expectTime: 'Malam hari'
  },
  {
    id: 2052,
    content_pillar: 'Opportunistic Based',
    ws_matrix: 'Where: Di dapur rumah saat menyiapkan sarapan | With What: Toples kaca GarliBee yang baru dibuka | Why: Ingin segera memulai langkah praktis.',
    context: 'Saat merapikan meja dapur di akhir pekan, Bunda menemukan toples GarliBee yang praktis.',
    strategic_angle: 'The Second Chance',
    visual_action_guideline: 'Kamera menggunakan angle over-the-shoulder di dapur cerah. Tangan Bunda membuka tutup toples.',
    expectLoc: /dapur/i,
    expectTime: 'Pagi hari'
  },
  {
    id: 2053,
    content_pillar: 'Problem-Solution Based',
    ws_matrix: 'When: Siang hari di sela kesibukan pekerjaan rumah | How Feeling: Merasa cepat lelah dan cemas memikirkan stamina | Why: Mencari solusi alami yang aman.',
    context: 'Saat jam istirahat siang di ruang makan, Bunda merasakan tubuh kurang bugar dan mulai mencari solusi alami.',
    strategic_angle: 'The Intellectual Flex',
    visual_action_guideline: 'Kamera melakukan close-up pada tangan yang mengambil sendok berisi madu di meja makan.',
    expectLoc: /ruang makan/i,
    expectTime: 'Siang hari'
  },
  {
    id: 2054,
    content_pillar: 'Routine Based',
    ws_matrix: 'When: Pagi hari saat menyeduh minuman hangat | With/For Whom: Dinikmati bersama pasangan tercinta | Where: Di meja pantry rumah yang hangat.',
    context: 'Pagi hari yang tenang di meja pantry dapur, saat Bunda dan suami memulai rutinitas harian.',
    strategic_angle: 'The Life Hack',
    visual_action_guideline: 'Medium shot di meja pantry dapur yang terang.',
    expectLoc: /pantry/i,
    expectTime: 'Pagi hari'
  },
  {
    id: 2055,
    content_pillar: 'Emotional Based',
    ws_matrix: 'When: Menjelang malam saat merawat diri | How Feeling: Ingin merasa tenang dan terlindungi dari rasa cemas masalah kesehatan | Why: Demi membersamai keluarga.',
    context: 'Malam hari di kamar tidur yang sunyi, Bunda merenungkan pentingnya investasi kesehatan jantung demi anak-anak.',
    strategic_angle: 'The Minimalist',
    visual_action_guideline: 'Kamera mengambil sudut eye-level yang tenang di kamar tidur. Toples diletakkan di samping bingkai foto keluarga, diterangi cahaya lampu tidur yang lembut.',
    expectLoc: /kamar tidur/i,
    expectTime: 'Malam hari'
  },
  {
    id: 2056,
    content_pillar: 'Aspirational Based',
    ws_matrix: 'Where: Di ruang keluarga yang nyaman | With What: Toples GarliBee | Why: Mewujudkan impian hidup bugar.',
    context: 'Sore hari yang tenang di teras rumah, saat Bunda membayangkan masa tua tetap bugar.',
    strategic_angle: 'The Caregiver',
    visual_action_guideline: 'Tracking shot perlahan di teras rumah sore hari.',
    expectLoc: /ruang keluarga|teras/i,
    expectTime: 'Sore hari'
  },
  {
    id: 2142,
    content_pillar: 'supplier insulasi panas',
    ws_matrix: 'When: Rutin melakukan audit performa bangunan tahunan; While: Sedang menyusun rencana anggaran; Why: Efisiensi biaya',
    context: 'Setiap tahun, manajer fasilitas rutin meninjau performa bangunan di ruang kantor.',
    strategic_angle: 'The Math Whiz',
    visual_action_guideline: 'MEDIUM SHOT di ruang kantor dengan laptop berisi spreadsheet dan laporan anggaran.',
    expectLoc: /kantor|kerja/i,
    expectTime: null
  },
  {
    id: 2141,
    content_pillar: 'insulasi panas pabrik',
    ws_matrix: 'When pergantian shift siang, Where di area produksi pabrik yang luas, How Feeling merasa lelah dan gerah berlebihan',
    context: 'Saat pergantian shift siang di area produksi pabrik yang luas, para pekerja mulai merasa lelah.',
    strategic_angle: 'The Safe Haven',
    visual_action_guideline: 'WIDE SHOT area produksi pabrik saat shift siang dengan termometer digital di dinding.',
    expectLoc: /pabrik/i,
    expectTime: 'Siang hari'
  },
  {
    id: 2124,
    content_pillar: 'cara menghilangkan gema di ruangan',
    ws_matrix: 'When? (Saat jam makan siang) + Where? (di kantin kantor yang ramai) + How Feeling? (merasa lelah dan sulit fokus)',
    context: 'Setiap jam makan siang di kantin kantor, sulit sekali berkomunikasi karena suara percakapan bergema.',
    strategic_angle: 'The Comparison (David vs Goliath)',
    visual_action_guideline: 'WIDE SHOT dari kantin kantor yang ramai saat jam makan siang.',
    expectLoc: /kantin/i,
    expectTime: 'Siang hari'
  },
  {
    id: 2123,
    content_pillar: 'cara agar suara tidak keluar kamar',
    ws_matrix: 'When malam hari saat beristirahat + Where di dalam kamar tidur utama + How Feeling merasa terganggu oleh bising luar',
    context: 'Malam hari ketika hendak beristirahat, suara bising dari luar masih menembus dinding kamar tidur utama.',
    strategic_angle: 'The Safe Haven',
    visual_action_guideline: 'Close-up seseorang menatap langit-langit kamar dalam remang malam.',
    expectLoc: /kamar tidur/i,
    expectTime: 'Malam hari'
  },
  {
    id: 2133,
    content_pillar: 'Kolesterol & Lemak Gorengan Harian',
    context: '',
    ws_matrix: '',
    visual_action_guideline: 'Cairan keemasan mengangkat endapan minyak kental di wadah kaca bening',
    strategic_angle: 'The Scientific Proof',
    vsoFallback: 'Warm natural wooden Indonesian kitchen counter',
    expectLoc: /wooden Indonesian kitchen counter/i,
    expectTime: null
  },
  {
    id: 2137,
    content_pillar: 'Sisa Makanan & Kenyamanan Pencernaan',
    context: '',
    ws_matrix: '',
    visual_action_guideline: 'Wastafel dapur menggenang terhambat ampas kembali lancar bening',
    strategic_angle: 'The Sensory ASMR',
    expectLoc: /dapur/i,
    expectTime: null
  },
  {
    id: 9001,
    content_pillar: 'Morning Mobility Warmup',
    ws_matrix: 'When: early morning | Where: modern home workout corner | How Feeling: stiff joints after waking up',
    context: 'Early morning in a sunny living room workout corner before heading out.',
    strategic_angle: 'The Pure Relief',
    visual_action_guideline: 'Hands preparing herbal hydration in tall clear tumbler on sunlit table',
    expectLoc: /olahraga|living room|ruang keluarga/i,
    expectTime: 'Pagi hari'
  },
  {
    id: 9002,
    content_pillar: 'Afternoon Desk Slump',
    ws_matrix: 'When: late afternoon at desk | Where: home office workspace | How Feeling: mentally drained',
    context: 'Late afternoon work session at wooden desk with laptop.',
    strategic_angle: 'The Blind Test',
    visual_action_guideline: 'Two unmarked glasses placed side by side near notebook on office desk',
    expectLoc: /kantor|kerja/i,
    expectTime: 'Sore hari'
  },
  {
    id: 9003,
    content_pillar: 'Vanity Night Skincare Inside-Out',
    ws_matrix: 'When: bedtime routine | Where: modern vanity table | How Feeling: worried about dull tired skin',
    context: 'Nighttime self-care at modern bathroom vanity mirror.',
    strategic_angle: 'The Magic Moment',
    visual_action_guideline: 'Hands setting warm tea cup on vanity counter',
    expectLoc: /rias|kamar mandi/i,
    expectTime: 'Malam hari'
  }
];

test('parseWsMatrix supports pipe, plus, semicolon, and question formats', () => {
  const p1 = parseWsMatrix('When? (Saat jam makan siang) + Where? (di kantin kantor yang ramai) + How Feeling? (merasa lelah)');
  assert.equal(p1.when, 'Saat jam makan siang');
  assert.equal(p1.where, 'di kantin kantor yang ramai');
  assert.equal(p1.feeling, 'merasa lelah');

  const p2 = parseWsMatrix('When pergantian shift siang, Where di area produksi pabrik, How Feeling merasa gerah');
  assert.equal(p2.when, 'pergantian shift siang');
  assert.equal(p2.where, 'di area produksi pabrik');
});

test('buildSceneBrief extracts location, time, props, feeling, and protagonist accurately across 15+ planner rows', () => {
  assert.ok(REAL_PLANNER_ROWS.length >= 15);
  for (const row of REAL_PLANNER_ROWS) {
    const vsoData = row.vsoFallback
      ? { environment: { fallback_location: row.vsoFallback } }
      : null;
    const brief = buildSceneBrief(row, {}, { vsoData });
    assert.match(brief.location, row.expectLoc, `Row ${row.id} location mismatch: got "${brief.location}"`);
    assert.equal(brief.time_of_day, row.expectTime, `Row ${row.id} time mismatch`);
    assert.ok(brief.lighting_mood.length > 10, `Row ${row.id} missing lighting_mood`);
    assert.ok(Array.isArray(brief.situational_props) && brief.situational_props.length >= 1, `Row ${row.id} missing situational props`);
    assert.ok(brief.angle_format_key, `Row ${row.id} missing angle_format_key`);
  }
});

test('2053 siang lighting does not inject morning light; 2055 night lighting preserves well-lit bedroom mood & removes toples prop (R2, R3)', () => {
  const b2053 = buildSceneBrief(REAL_PLANNER_ROWS.find(r => r.id === 2053));
  assert.doesNotMatch(b2053.lighting_mood, /morning|3500K/i);
  assert.match(b2053.lighting_mood, /midday|daylight/i);

  const b2055 = buildSceneBrief(REAL_PLANNER_ROWS.find(r => r.id === 2055));
  assert.match(b2055.lighting_mood, /night|bedside|3000K/i);
  assert.match(b2055.lighting_mood, /well-lit|clearly visible|no dark murky gloom/i);
  assert.doesNotMatch(b2055.lighting_mood, /deep indoor shadows|warm dim/i);
  assert.ok(b2055.situational_props.some(p => /family photo|lamp/i.test(p)));
  assert.ok(!b2055.situational_props.some(p => /glass bowl|tumbler|jar/i.test(p)), 'R2: "toples" must not produce transparent glass container prop before bridge');
  assert.match(b2055.visual_action_hint_pre_bridge, /eye-level/i);
  assert.doesNotMatch(b2055.visual_action_hint_pre_bridge, /toples|garlibee/i);
  assert.match(b2055.visual_action_hint_bridge, /toples/i);
});

test('R4 & R5: Kafe, Mobil, Musala, Kamar Anak, Meja Belajar resolve cleanly; unknown ID translates; "bulk" no longer matches photo frame', () => {
  const extraLocations = [
    { ws_matrix: 'Where: Di meja kafe sambil minum teh | When: Sore hari', expectEn: /cafe|coffee shop/i },
    { ws_matrix: 'Where: Di dalam mobil sebelum berangkat | When: Pagi hari', expectEn: /car interior/i },
    { ws_matrix: 'Where: Di sudut musala di atas sajadah | When: Malam hari', expectEn: /prayer corner|prayer mat/i },
    { ws_matrix: 'Where: Di kamar anak saat mendampingi belajar', expectEn: /kids bedroom/i },
    { ws_matrix: 'Where: Di meja belajar bersama catatan', expectEn: /study desk/i },
    { ws_matrix: 'Where: Di apotek terdekat', expectEn: /pharmacy/i }
  ];
  for (const ex of extraLocations) {
    const b = buildSceneBrief({ ws_matrix: ex.ws_matrix });
    assert.match(b.location_en, ex.expectEn, `Failed R4 for "${ex.ws_matrix}": got "${b.location_en}"`);
  }

  const bulkBrief = buildSceneBrief({
    ws_matrix: 'Where: Di gudang produksi',
    visual_action_guideline: 'Pembelian bahan dalam ukuran bulk besar di meja gudang'
  });
  assert.ok(!bulkBrief.situational_props.some(p => /family photo frame/i.test(p)), 'R5: "bulk" typo must not trigger family photo frame prop');
});

