/**
 * lib/angle-visual-formats.js
 * K3: 30 Strategic Angles -> Visual Beat Grammar & Dynamic Clip Allocation.
 * Mappings derived from kb/STRATEGIC_FRAMEWORKS_v47.9.md (Set A Ego, Set B Brain, Set C Gut).
 * Pure deterministic module (zero LLM calls).
 */

export const ALLOWED_3D_ANGLE_KEYS = new Set([
  'scientific_proof',
  'intellectual_flex',
  'problem_you_didnt_know',
  'one_feature_obsession'
]);

const makeBeats = (specs) => specs.map(([role, beatLabel, visualIntent, modePreference]) => ({
  role,
  beatLabel,
  visualIntent,
  modePreference: modePreference || 'primary'
}));

export const ANGLE_VISUAL_FORMATS = {
  // =========================================================================
  // SET A: STATUS & IDENTITY ("Ego" Angles)
  // =========================================================================
  secret_club: {
    key: 'secret_club',
    label: 'The Secret Club',
    set: 'ego',
    allows3D: false,
    preferredModes: ['cinematic_realistic', 'symbolic_surrealism'],
    signatureVisualCues: 'insider close-up reveal, hand partially shielding or uncovering rare detail, low-key intimate framing',
    beats: makeBeats([
      ['hook', 'Insider Whisper Reveal', 'Close-up tangan menyingkap detail kecil yang jarang diketahui orang kebanyakan di lokasi adegan'],
      ['context', 'Crowd Noise Contrast', 'Kontras pilihan umum yang ramai vs objek pilihan kalangan terpilih di situasi keseharian'],
      ['mechanism', 'Quiet Craft Secret', 'Detail proses atau ciri autentik tersembunyi yang membedakan metode ini dari cara massal', 'symbolic_surrealism'],
      ['consequence', 'Elevated Routine', 'Tangan melakukan kebiasaan tenang penuh kontrol tanpa ikut kebingungan umum'],
      ['evidence_reveal', 'Member Proof Moment', 'Produk diperlihatkan secara elegan sebagai kunci pilihan kalangan paham di lokasi situasi'],
      ['conclusion', 'Quiet Invitation', 'Ritual penutup sederhana dan berkelas mengundang penonton masuk ke lingkaran pilihan cerdas']
    ])
  },

  status_signal: {
    key: 'status_signal',
    label: 'The Status Signal',
    set: 'ego',
    allows3D: false,
    preferredModes: ['cinematic_realistic', 'commercial_product_cinematic'],
    signatureVisualCues: 'clean uncluttered surfaces, deliberate unhurried hand cadence, refined minimal accessories',
    beats: makeBeats([
      ['hook', 'Refined Standard Hook', 'Tangan menata atau merapikan objek berstandar tinggi di lokasi adegan dengan satu fokus gerakan bermutu'],
      ['context', 'Ordinary Clutter Rejection', 'Membandingkan kebiasaan terburu-buru biasa dengan ketertataan ruang pilihan audiens'],
      ['mechanism', 'Quality Benchmark', 'Close-up tekstur material, kejernihan bahan, dan presisi takaran berstandar tinggi', 'commercial_product_cinematic'],
      ['consequence', 'Poised Everyday Control', 'Gerakan tangan mantap, bersih, dan terukur menyelesaikan rutinitas harian'],
      ['evidence_reveal', 'Signature Object Presence', 'Produk hadir menyatu mulus sebagai standar kualitas di tengah situasi nyata'],
      ['conclusion', 'Aspirational Sign-off', 'Komposisi akhir simetris rapi mencerminkan pilihan hidup berstandar']
    ])
  },

  rebel_choice: {
    key: 'rebel_choice',
    label: 'The Rebel Choice',
    set: 'ego',
    allows3D: false,
    preferredModes: ['cinematic_realistic', 'symbolic_surrealism'],
    signatureVisualCues: 'sweeping away common habit object, choosing single bold alternative in real room setting',
    beats: makeBeats([
      ['hook', 'Anti-Mainstream Gesture', 'Tangan menepikan kebiasaan lama/ramai dan memilih satu jalur berbeda di lokasi situasi'],
      ['context', 'Fatigue of Mainstream Habit', 'Visualisasi kejenuhan rutinitas biasa yang bikin lelah dan tidak tuntas di konteks harian'],
      ['mechanism', 'Simpler Smarter Alternative', 'Kontras cara alternatif yang jujur dan minim kompromi di situasi nyata', 'symbolic_surrealism'],
      ['consequence', 'Self-Determined Relief', 'Momen tenang saat memilih cara sendiri dengan sikap yakin di ruang keluarga/harian'],
      ['evidence_reveal', 'Unapologetic Natural Switch', 'Produk diperkenalkan sebagai pengganti nyata kebiasaan lama yang lebih selaras nilai diri'],
      ['conclusion', 'Conviction Close', 'Tangan memegang atau menyajikan pilihan akhir dengan ketegasan yang tenang']
    ])
  },

  intellectual_flex: {
    key: 'intellectual_flex',
    label: 'The Intellectual Flex',
    set: 'ego',
    allows3D: true,
    preferredModes: ['cinematic_realistic', '3d_bio_cellular', 'commercial_product_cinematic'],
    signatureVisualCues: 'curious inspection, neat notes/glass/ingredient comparison, maximum 1 brief micro-mechanism cutaway',
    beats: makeBeats([
      ['hook', 'Smart Question Hook', 'Close-up situasi cerdas saat tokoh mengamati detail yang sering terlewat orang lain'],
      ['context', 'Surface Myth vs Logic', 'Aktivitas nyata di ruang situasi yang menunjukkan mengapa cara asal-asalan sering keliru'],
      ['mechanism', 'Micro-Mechanism Insight', 'Penjelasan visual mekanisme inti (maks 1 klip 3D seluler/sirkulasi bila relevan topik)', '3d_bio_cellular'],
      ['consequence', 'Informed Adjustment', 'Tangan mempraktikkan langkah terukur dengan pengetahuan yang tepat di meja/lokasi sama'],
      ['evidence_reveal', 'Smart Criteria Match', 'Produk hadir memenuhi logika bahan dan proses secara transparan tanpa gimmick', 'commercial_product_cinematic'],
      ['conclusion', 'Knowing Mastery', 'Penutup rapi menunjukkan kepuasan memilih berdasarkan pemahaman, bukan ikut-ikutan']
    ])
  },

  taste_maker: {
    key: 'taste_maker',
    label: 'The Taste Maker',
    set: 'ego',
    allows3D: false,
    preferredModes: ['cinematic_realistic', 'commercial_product_cinematic'],
    signatureVisualCues: 'curated tabletop eye, subtle aesthetic arrangement, early-discoverer confidence',
    beats: makeBeats([
      ['hook', 'Hidden Gem Discovery', 'Angle menarik menyoroti benda/kebiasaan kurasi pertama sebelum ramai dibicarakan'],
      ['context', 'Discerning Routine', 'Potongan momen sehari-hari di ruang situasi yang menunjukkan selera selektif audiens'],
      ['mechanism', 'Tactile Appreciation', 'Eksplorasi detail aroma, warna, atau kejernihan visual yang memikat selera', 'commercial_product_cinematic'],
      ['consequence', 'Curated Ritual', 'Tangan menata penyajian sederhana dengan sentuhan estetis di lokasi adegan'],
      ['evidence_reveal', 'Curator Recommendation', 'Produk ditampilkan layaknya temuan bermutu yang layak direkomendasikan'],
      ['conclusion', 'Signature Aesthetic Ending', 'Frame penutup berkarakter membuat audiens ingin ikut mencoba kurasi ini']
    ])
  },

  minimalist: {
    key: 'minimalist',
    label: 'The Minimalist',
    set: 'ego',
    allows3D: false,
    preferredModes: ['cinematic_realistic'],
    signatureVisualCues: 'decluttering extra items, quiet negative space, keeping one essential calm object',
    beats: makeBeats([
      ['hook', 'Clutter to Calm Shift', 'Tangan merapikan atau menyingkirkan banyak benda berlebih sehingga menyisakan ruang tenang'],
      ['context', 'Mental & Surface Overload', 'Situasi kamar/meja berantakan oleh banyak pilihan yang memicu rasa cemas ringan'],
      ['mechanism', 'One Essential Focus', 'Fokus tunggal pada satu kebiasaan inti tanpa langkah berlapis-lapis yang merepotkan'],
      ['consequence', 'Breathing Space', 'Ruangan dan gerak tangan menjadi ringan, hening, dan teratur dalam cahaya lembut'],
      ['evidence_reveal', 'One Simple Jar/Bottle', 'Produk hadir seorang diri di samping benda personal sebagai satu langkah ringkas yang cukup'],
      ['conclusion', 'Serene Minimal Close', 'Komposisi bersih penuh ruang bernapas menutup hari atau rutinitas dengan damai']
    ])
  },

  caregiver: {
    key: 'caregiver',
    label: 'The Caregiver',
    set: 'ego',
    allows3D: false,
    preferredModes: ['cinematic_realistic'],
    signatureVisualCues: 'warm two-cup or family meal gesture, gentle protective care, home warmth',
    beats: makeBeats([
      ['hook', 'Thoughtful Care Moment', 'Tangan menyiapkan perhatian kecil hangat untuk orang tersayang di ruang keluarga/teras'],
      ['context', 'Quiet Worry for Loved Ones', 'Detail situasi sehari-hari yang mengingatkan pentingnya menjaga stamina demi keluarga'],
      ['mechanism', 'Gentle Protective Habit', 'Tindakan merawat secara konsisten lewat sajian atau perawatan rumah tangga alami'],
      ['consequence', 'Warm Shared Connection', 'Nuansa kebersamaan hangat terwakili lewat dua cangkir/piring atau foto keluarga di latar'],
      ['evidence_reveal', 'Trusted Home Companion', 'Produk hadir secara hangat sebagai bekal merawat kebugaran keluarga di meja rumah'],
      ['conclusion', 'Loving Continuity', 'Penutup lembut yang mengutamakan rasa tenang dapat terus mendampingi keluarga']
    ])
  },

  alpha: {
    key: 'alpha',
    label: 'The Alpha',
    set: 'ego',
    allows3D: false,
    preferredModes: ['cinematic_realistic', 'commercial_product_cinematic'],
    signatureVisualCues: 'decisive grip, crisp forward pacing, sharp contrast, high-output daily discipline',
    beats: makeBeats([
      ['hook', 'Decisive Edge Hook', 'Gerakan tangan tegas mengambil inisiatif di tengah situasi menuntut performa tinggi'],
      ['context', 'Bottleneck Pressure', 'Gambaran kelelahan atau hambatan yang mengancam ritme kerja/aktivitas utama'],
      ['mechanism', 'Performance Lever', 'Penekanan fungsi inti secara padat, cepat dipahami, tanpa basa-basi', 'commercial_product_cinematic'],
      ['consequence', 'Momentum Regained', 'Alur tindakan kembali cepat, rapi, dan fokus penuh menuju target harian'],
      ['evidence_reveal', 'Reliable Advantage Tool', 'Produk diperlihatkan sebagai bagian disiplin unggulan tanpa tampilan lemah'],
      ['conclusion', 'Strong Finish', 'Frame tegas penuh percaya diri menutup rutinitas dengan kendali penuh']
    ])
  },

  artist: {
    key: 'artist',
    label: 'The Artist',
    set: 'ego',
    allows3D: false,
    preferredModes: ['cinematic_realistic', 'symbolic_surrealism'],
    signatureVisualCues: 'expressive light play, layered tactile craft, unhurried creative rhythm',
    beats: makeBeats([
      ['hook', 'Poetic Visual Frame', 'Komposisi artistik menyoroti permainan bayangan, tekstur, dan detail tak biasa'],
      ['context', 'Flat Routine Break', 'Rutinitas kaku terasa hambar hingga disentuh pendekatan yang lebih penuh rasa'],
      ['mechanism', 'Craft Alchemy', 'Transformasi visual puitis menunjukkan harmoni unsur alami bekerja selaras', 'symbolic_surrealism'],
      ['consequence', 'Creative Renewal', 'Tangan menata komposisi dengan kepekaan rasa yang hidup dan personal'],
      ['evidence_reveal', 'Artisanal Focal Piece', 'Produk muncul selaras estetika karya, menonjolkan keindahan bahan aslinya'],
      ['conclusion', 'Expressive Sign-off', 'Purna adegan meninggalkan kesan visual indah dan personal']
    ])
  },

  heritage: {
    key: 'heritage',
    label: 'The Heritage',
    set: 'ego',
    allows3D: false,
    preferredModes: ['cinematic_realistic', 'culinary_cinematic'],
    signatureVisualCues: 'timeless natural wood, ceramic mortar/spoon, patient fermentation/tradition cues',
    beats: makeBeats([
      ['hook', 'Time-Honored Ritual', 'Close-up elemen tradisi nyata yang diwariskan turun-temurun di rumah Nusantara'],
      ['context', 'Fast Modern Shortcut Contrast', 'Kontras antara cara instan terburu-buru dengan kearifan kesabaran alami'],
      ['mechanism', 'Patient Natural Process', 'Visual proses alami bertahap (fermentasi/ekstraksi tenang tanpa tergesa)', 'culinary_cinematic'],
      ['consequence', 'Grounded Respect', 'Tangan melakukan langkah sederhana penuh penghormatan terhadap bahan murni'],
      ['evidence_reveal', 'Modernized Heritage Jar', 'Produk hadir menjembatani warisan bahan alami dalam kemasan praktis masa kini'],
      ['conclusion', 'Enduring Tradition Close', 'Penutup hangat merayakan kebiasaan baik yang bertahan lintas generasi']
    ])
  },

  // =========================================================================
  // SET B: LOGIC & UTILITY ("Brain" Angles)
  // =========================================================================
  life_hack: {
    key: 'life_hack',
    label: 'The Life Hack',
    set: 'brain',
    allows3D: false,
    preferredModes: ['cinematic_realistic', 'culinary_cinematic'],
    signatureVisualCues: 'side-by-side effort contrast, single-spoon 10-second shortcut action, clean tidy setup',
    beats: makeBeats([
      ['hook', 'Shortcut Contrast Hook', 'Tangan menghentikan cara ribet bertahap-tahap dan menunjukkan satu gerakan ringkas'],
      ['context', 'Time-Wasting Friction', 'Situasi sibuk (pagi/kerja) di mana menyiapkan banyak bahan terpisah bikin malas'],
      ['mechanism', 'Step-Collapse Shortcut', 'Menunjukkan penggabungan langkah rumit menjadi satu porsi siap pakai yang presisi'],
      ['consequence', 'Seconds Saved', 'Aktivitas selesai bersih dan cepat tanpa tumpukan alat kotor di meja'],
      ['evidence_reveal', 'Ready-to-Use Solution', 'Produk tampil sebagai jalan pintas praktis siap santap/pakai dalam satu langkah'],
      ['conclusion', 'Effortless Habit Win', 'Penutup ringan memperlihatkan audiens siap lanjut beraktivitas tanpa repot']
    ])
  },

  math_whiz: {
    key: 'math_whiz',
    label: 'The Math Whiz',
    set: 'brain',
    allows3D: false,
    preferredModes: ['cinematic_realistic', 'commercial_product_cinematic'],
    signatureVisualCues: 'tangible quantity breakdown (1 spoon vs pile of costs/items), clear visual ledger/notes',
    beats: makeBeats([
      ['hook', 'Concrete Scale Contrast', 'Perbandingan visual jumlah besar vs porsi kecil terukur secara konkret di meja'],
      ['context', 'Hidden Accumulating Drain', 'Menunjukkan kebocoran waktu, biaya, atau energi berulang dalam aktivitas harian'],
      ['mechanism', 'Unit Efficiency Logic', 'Visual pembagian porsi/unit terukur yang langsung masuk akal secara hitungan', 'commercial_product_cinematic'],
      ['consequence', 'Predictable Control', 'Catatan, grafik sederhana, atau porsi teratur menunjukkan kontrol anggaran/stamina'],
      ['evidence_reveal', 'High-Yield Practicality', 'Produk hadir dengan takaran efisien (misal 1 sendok/1 lembar bertahan lama)'],
      ['conclusion', 'Smart ROI Payoff', 'Penutup rasional menegaskan nilai jangka panjang dalam keputusan sederhana']
    ])
  },

  scientific_proof: {
    key: 'scientific_proof',
    label: 'The Scientific Proof',
    set: 'brain',
    allows3D: true,
    preferredModes: ['cinematic_realistic', '3d_bio_cellular', 'commercial_product_cinematic'],
    signatureVisualCues: 'clean measurement, raw ingredient macro, maximum 1 accurate 3D mechanism clip',
    beats: makeBeats([
      ['hook', 'Observable Evidence Hook', 'Close-up fenomena nyata atau bahan utama yang mengundang pertanyaan cara kerja'],
      ['context', 'Everyday Reality Setup', 'Konteks nyata dari planner di mana gejala/kebutuhan terjadi secara konkret'],
      ['mechanism', 'Biological / Physical Mechanism', 'Satu visual mekanisme ilmiah/mikroskopis yang akurat dan kredibel', '3d_bio_cellular'],
      ['consequence', 'Ingredient Synergy', 'Kembali ke bahan nyata/tangan yang memadukan komposisi sesuai prinsip tadi'],
      ['evidence_reveal', 'Formulated Product Proof', 'Produk hadir dengan transparansi bahan dan proses pembuatannya', 'commercial_product_cinematic'],
      ['conclusion', 'Verified Takeaway', 'Ringkasan tenang berbasis fakta yang memberi rasa yakin']
    ])
  },

  stress_test: {
    key: 'stress_test',
    label: 'The Stress Test',
    set: 'brain',
    allows3D: false,
    preferredModes: ['cinematic_realistic', 'commercial_product_cinematic'],
    signatureVisualCues: 'real physical test (heat, pour, viscosity, load, wipe test), unbroken observation',
    beats: makeBeats([
      ['hook', 'Live Torture / Challenge Test', 'Adegan langsung menguji ketahanan atau performa di situasi menantang'],
      ['context', 'Real Pressure Condition', 'Menunjukkan kondisi berat nyata (panas, berminyak, bising, jadwal padat)'],
      ['mechanism', 'Resistance in Action', 'Close-up fisik saat objek/bahan menghadapi uji tekanan secara langsung', 'commercial_product_cinematic'],
      ['consequence', 'Holding Steady', 'Hasil sesudah uji tetap kokoh, bersih, atau lancar tanpa turun performa'],
      ['evidence_reveal', 'Tested Product Reveal', 'Produk diperlihatkan utuh bersama bukti hasil pengujian yang baru saja terjadi'],
      ['conclusion', 'Earned Trust', 'Penutup berbasis pembuktian langsung tanpa klaim berlebih']
    ])
  },

  comparison_david_vs_goliath: {
    key: 'comparison_david_vs_goliath',
    label: 'The Comparison (David vs Goliath)',
    set: 'brain',
    allows3D: false,
    preferredModes: ['cinematic_realistic', 'symbolic_surrealism'],
    signatureVisualCues: 'split spatial contrast: bulky noisy conventional method vs agile focused contender',
    beats: makeBeats([
      ['hook', 'Underdog Contrast Frame', 'Kontras visual langsung antara pendekatan besar/konvensional vs pilihan ringkas tajam'],
      ['context', 'Where Big Habit Falls Short', 'Menunjukkan di situasi harian nyata mengapa cara besar/populer justru bikin repot'],
      ['mechanism', 'Targeted Precision Edge', 'Visual keunggulan fokus spesifik yang mengalahkan kerumitan massal', 'symbolic_surrealism'],
      ['consequence', 'Lighter Better Outcome', 'Situasi berubah jauh lebih efektif menggunakan pendekatan yang lebih ramping'],
      ['evidence_reveal', 'Agile Contender Reveal', 'Produk tampil percaya diri berdampingan dengan hasil nyata yang bersih'],
      ['conclusion', 'Smart Underdog Choice', 'Ajakan memilih solusi tepat guna ketimbang sekadar nama besar']
    ])
  },

  one_feature_obsession: {
    key: 'one_feature_obsession',
    label: 'The One-Feature Obsession',
    set: 'brain',
    allows3D: true,
    preferredModes: ['cinematic_realistic', 'commercial_product_cinematic', '3d_bio_cellular'],
    signatureVisualCues: 'extreme macro spotlight on 1 specific detail/trait across clips',
    beats: makeBeats([
      ['hook', 'Extreme Detail Spotlight', 'Extreme macro tertuju hanya pada satu ciri fisik/tekstur/detail paling menentukan'],
      ['context', 'Why That One Detail Matters', 'Menunjukkan dampak langsung detail tunggal tersebut dalam situasi nyata planner'],
      ['mechanism', 'Deep Dive into One Trait', 'Bedah mekanisme detail tunggal itu (maks 1 klip 3D hanya jika topik mekanisme mikro)', '3d_bio_cellular'],
      ['consequence', 'Difference You Feel', 'Tangan merasakan/menguji langsung kualitas detail tersebut di adegan nyata', 'commercial_product_cinematic'],
      ['evidence_reveal', 'Hero Detail in Product', 'Produk hadir menonjolkan detail spesifik yang sama secara otentik'],
      ['conclusion', 'Focused Reminder', 'Penutup tajam mengunci satu keunggulan kunci dalam ingatan']
    ])
  },

  origin_story: {
    key: 'origin_story',
    label: 'The Origin Story',
    set: 'brain',
    allows3D: false,
    preferredModes: ['cinematic_realistic', 'culinary_cinematic'],
    signatureVisualCues: 'raw starting materials, chronological making steps, patience & honesty of process',
    beats: makeBeats([
      ['hook', 'Raw Beginning', 'Close-up bahan baku paling mentah sebelum diolah menjadi sesuatu yang bernilai'],
      ['context', 'Why Careful Craft Started', 'Konteks masalah nyata yang mendorong lahirnya metode pengolahan telaten ini'],
      ['mechanism', 'Step-by-Step Transformation', 'Proses peracikan/pembuatan bertahap dengan fokus kesabaran dan higienitas', 'culinary_cinematic'],
      ['consequence', 'Maturation Result', 'Perubahan tekstur/warna/karakter bahan setelah melewati proses penuh'],
      ['evidence_reveal', 'Finished Craft Bottle/Jar', 'Produk jadi hadir sebagai buah langsung dari perjalanan bahan murni tadi'],
      ['conclusion', 'Honest Maker Closing', 'Penutup autentik mengaitkan asal-usul jujur dengan rutinitas penonton']
    ])
  },

  blind_test: {
    key: 'blind_test',
    label: 'The Blind Test',
    set: 'brain',
    allows3D: false,
    preferredModes: ['cinematic_realistic', 'commercial_product_cinematic'],
    signatureVisualCues: 'two unmarked plain vessels A vs B, fair side-by-side texture/clarity check',
    beats: makeBeats([
      ['hook', 'Two Unmarked Samples', 'Dua wadah polos tanpa label diletakkan sejajar siap diuji secara adil'],
      ['context', 'Bias Removal Setup', 'Tangan melakukan pengujian tekstur, endapan, suara, atau kekentalan kedua sampel'],
      ['mechanism', 'Side-by-Side Reveal', 'Perbedaan reaksi fisik tampak jelas antara sampel biasa vs sampel teruji', 'commercial_product_cinematic'],
      ['consequence', 'Clear Winner Identified', 'Tangan menunjuk atau memilih sampel dengan hasil terbaik tanpa prasangka'],
      ['evidence_reveal', 'Identity Behind Winner', 'Produk terungkap sebagai isi dari sampel pemenang uji buta tadi'],
      ['conclusion', 'Objective Final Note', 'Penutup objektif mengajak penonton menilai kualitas nyata, bukan kemasan']
    ])
  },

  problem_you_didnt_know: {
    key: 'problem_you_didnt_know',
    label: "The Problem You Didn't Know",
    set: 'brain',
    allows3D: true,
    preferredModes: ['cinematic_realistic', '3d_bio_cellular', 'symbolic_surrealism'],
    signatureVisualCues: 'seemingly harmless everyday scene -> hidden residue/risk reveal -> calm fix',
    beats: makeBeats([
      ['hook', 'Hidden Blind Spot Hook', 'Adegan harian tampak normal lalu kamera menyoroti detail kecil sumber masalah tersembunyi'],
      ['context', 'Unsuspected Routine', 'Kebiasaan sehari-hari di ruang situasi planner yang terlihat aman padahal menumpuk beban'],
      ['mechanism', 'Behind-the-Surface Impact', 'Visualisasi efek tersembunyi di balik permukaan (maks 1 klip 3D jika membahas proses biologis)', '3d_bio_cellular'],
      ['consequence', 'Silent Toll Recognized', 'Tanda lelah atau residu terlihat jelas begitu audiens sadar penyebabnya'],
      ['evidence_reveal', 'Targeted Safeguard', 'Produk masuk sebagai langkah praktis menjawab masalah tersembunyi tadi'],
      ['conclusion', 'Eyes-Opened Prevention', 'Penutup informatif mendorong kebiasaan pencegahan ringan mulai hari ini']
    ])
  },

  bundle_logic: {
    key: 'bundle_logic',
    label: 'The Bundle Logic',
    set: 'brain',
    allows3D: false,
    preferredModes: ['cinematic_realistic', 'commercial_product_cinematic'],
    signatureVisualCues: 'combining fragmented separate tools into one unified pairing on tabletop',
    beats: makeBeats([
      ['hook', 'Fragmented Stack Hook', 'Tangan menatap beberapa bahan/alat terpisah yang ribet dibeli & dipakai sendiri-sendiri'],
      ['context', 'Incomplete Half-Fix', 'Mencoba satu per satu terasa kurang tuntas dan boros langkah'],
      ['mechanism', 'Synergy in One Pair', 'Visual penyatuan dua elemen saling melengkapi dalam satu takaran utuh', 'commercial_product_cinematic'],
      ['consequence', 'All-in-One Practicality', 'Meja bersih cukup dengan satu solusi terpadu yang langsung bekerja lengkap'],
      ['evidence_reveal', 'Complete Package Product', 'Produk hadir memperlihatkan kombinasi bahan/fitur lengkapnya dalam satu kemasan'],
      ['conclusion', 'Complete Value Close', 'Penutup cerdas menegaskan kelengkapan praktis dalam satu keputusan']
    ])
  },

  // =========================================================================
  // SET C: EMOTION & SENSATION ("Gut" Angles)
  // =========================================================================
  revenge: {
    key: 'revenge',
    label: 'The Revenge',
    set: 'gut',
    allows3D: false,
    preferredModes: ['cinematic_realistic'],
    signatureVisualCues: 'quietly rising from underestimated low state into sharp refreshed poise',
    beats: makeBeats([
      ['hook', 'Underestimated Tension Hook', 'Momen hening penuh tekad saat lelah diremehkan atau dipandang sebelah mata'],
      ['context', 'Quiet Turning Point', 'Di ruang aktivitas sendiri, tangan memulai perubahan konsisten tanpa banyak bicara'],
      ['mechanism', 'Disciplined Shift', 'Rangkaian aksi konsisten merawat diri/ruang dari hari ke hari'],
      ['consequence', 'Visible Glow Up', 'Perubahan energi, kerapian, dan ketegasan suasana ruang tampak kontras'],
      ['evidence_reveal', 'Secret Ally Reveal', 'Produk hadir singkat sebagai bagian diam-diam dari konsistensi perubahan ini'],
      ['conclusion', 'Unstoppable Outcome', 'Hasil akhir rapi dan bercahaya menjadi jawaban tanpa perlu berdebat']
    ])
  },

  pure_relief: {
    key: 'pure_relief',
    label: 'The Pure Relief',
    set: 'gut',
    allows3D: false,
    preferredModes: ['cinematic_realistic', 'symbolic_surrealism'],
    signatureVisualCues: 'tight heavy posture/tension softening into slow breath, warmth, looseness',
    beats: makeBeats([
      ['hook', 'Physical Burden Sensation', 'Close-up gestur tegang/berat (usap bahu/pelipis, napas pendek, objek kaku/berat)'],
      ['context', 'Peak Discomfort Context', 'Suasana ruangan nyata dari planner saat rasa tidak nyaman sedang paling terasa'],
      ['mechanism', 'Soothing Release', 'Pelepasan visual perlahan—hangat merambat, uap lembut, beban mengurai tenang', 'symbolic_surrealism'],
      ['consequence', 'Posture Unclenching', 'Gerak tangan melambat rileks di bawah pencahayaan lembut yang menenangkan'],
      ['evidence_reveal', 'Comforting Aid', 'Produk masuk lembut sebagai pendamping momen pemulihan rasa nyaman'],
      ['conclusion', 'Exhale Close', 'Atmosfer tenang, hangat, dan lega menutup video seperti tarikan napas panjang']
    ])
  },

  safe_haven: {
    key: 'safe_haven',
    label: 'The Safe Haven',
    set: 'gut',
    allows3D: false,
    preferredModes: ['cinematic_realistic'],
    signatureVisualCues: 'harsh outside noise/glare contrasted with enclosed serene warm shelter indoors',
    beats: makeBeats([
      ['hook', 'Outside Friction Hook', 'Sinyal gangguan luar—silau panas, bising jalan, atau kesibukan menekan dari luar'],
      ['context', 'Seeking Quiet Refuge', 'Momen kembali ke ruang pribadi (kamar tidur/ruang keluarga/area kerja tenang)'],
      ['mechanism', 'Protective Boundary', 'Tindakan menutup celah gangguan dan membangun ritual perlindungan sederhana'],
      ['consequence', 'Soft Sanctum Peace', 'Cahaya dalam ruangan tenang, stabil, dan aman melindungi rasa tenteram'],
      ['evidence_reveal', 'Protective Companion', 'Produk hadir selaras sebagai penjaga rasa aman di sudut kamar atau meja rumah'],
      ['conclusion', 'Sanctuary Rest', 'Penutup damai menjaga ketenangan agar istirahat dan hari esok terjaga']
    ])
  },

  guilty_pleasure: {
    key: 'guilty_pleasure',
    label: 'The Guilty Pleasure',
    set: 'gut',
    allows3D: false,
    preferredModes: ['cinematic_realistic', 'culinary_cinematic'],
    signatureVisualCues: 'indulgent slow pour, rich texture, unapologetic cozy me-time',
    beats: makeBeats([
      ['hook', 'Indulgent Macro Tease', 'Close-up tekstur kaya menggoda di momen istirahat setelah hari panjang'],
      ['context', 'Permission to Spoil Self', 'Ruang pribadi nyaman di mana tidak perlu merasa bersalah memanjakan diri'],
      ['mechanism', 'Zero-Regret Balance', 'Keindahan rasa nikmat sekaligus tetap ringan dan aman untuk kebiasaan baik', 'culinary_cinematic'],
      ['consequence', 'Pure Coziness', 'Tangan menikmati sajian pelan-pelan tanpa terburu waktu'],
      ['evidence_reveal', 'Guilt-Free Treat', 'Produk tampil memikat sebagai suguhan spesial pribadi yang tetap selaras sehat'],
      ['conclusion', 'Cozy Satisfaction', 'Momen me-time hangat penuh rasa cukup menutup cerita']
    ])
  },

  fear_of_missing_out: {
    key: 'fear_of_missing_out',
    label: 'The Fear of Missing Out (FOMO)',
    set: 'gut',
    allows3D: false,
    preferredModes: ['cinematic_realistic'],
    signatureVisualCues: 'clock/calendar momentum cue, others moving ahead while static habit lags behind',
    beats: makeBeats([
      ['hook', 'Urgency Wake-Up Hook', 'Visual tanda waktu berjalan atau orang lain sudah lebih dulu selangkah lebih siap'],
      ['context', 'Cost of Waiting', 'Suasana rutin di mana menunda terus-menerus bikin tertinggal nyaman atau kebugaran'],
      ['mechanism', 'Closing the Gap Fast', 'Satu tindakan kecil berdaya ungkit tinggi untuk langsung menyusul hari ini'],
      ['consequence', 'Immediate Readiness', 'Gerakan sigap menyiapkan langkah pertama tanpa menunggu waktu sempurna'],
      ['evidence_reveal', 'Ready Essential Now', 'Produk hadir nyata di tangan sebagai bekal langsung mulai saat ini juga'],
      ['conclusion', 'Dont Wait Ending', 'Penutup berenergi mendorong keputusan cepat sebelum kesempatan lewat']
    ])
  },

  magic_moment: {
    key: 'magic_moment',
    label: 'The Magic Moment',
    set: 'gut',
    allows3D: false,
    preferredModes: ['cinematic_realistic'],
    signatureVisualCues: 'subtle spark of light, sudden effortless shift from dull to alive, intimate warmth',
    beats: makeBeats([
      ['hook', 'Unexpected Spark', 'Momen hening biasa mendadak berubah indah oleh satu detail kecil bercahaya hangat'],
      ['context', 'Everyday Backdrop', 'Latar kehidupan nyata sederhana tempat kejadian istimewa itu berlangsung'],
      ['mechanism', 'Effortless Transformation', 'Transisi visual halus dari suasana datar menjadi hidup dan hangat'],
      ['consequence', 'Felt Wonder', 'Gestur tangan kecil penuh apresiasi merasakan perbedaan spontan itu'],
      ['evidence_reveal', 'Trigger of the Spark', 'Produk hadir manis di tengah momen sebagai pemicu perubahan rasa hari itu'],
      ['conclusion', 'Lingering Glow', 'Frame penuh kehangatan emosional yang membekas setelah video berakhir']
    ])
  },

  second_chance: {
    key: 'second_chance',
    label: 'The Second Chance',
    set: 'gut',
    allows3D: false,
    preferredModes: ['cinematic_realistic', 'culinary_cinematic'],
    signatureVisualCues: 'fresh morning light reset, clearing stale attempt, gentle fresh restart at home',
    beats: makeBeats([
      ['hook', 'Fresh Reset Hook', 'Tangan membersihkan meja/membuka jendela menyambut awal baru yang lebih ringan'],
      ['context', 'Past Inconsistency Memory', 'Mengakui kebiasaan lama yang sempat terputus di tengah kesibukan tanpa menghakimi'],
      ['mechanism', 'One Gentle First Step', 'Langkah paling mudah dijangkau di dapur/meja hari ini agar konsistensi bisa dimulai lagi', 'culinary_cinematic'],
      ['consequence', 'Renewed Lightness', 'Suasana ruang cerah dan gerak tangan optimis menata ulang rutinitas'],
      ['evidence_reveal', 'Practical Restart Anchor', 'Produk muncul siap diraih di meja sebagai pengingat awal baru yang gampang dijalani'],
      ['conclusion', 'Hopeful Tomorrow Close', 'Penutup penuh harapan bahwa perubahan baik selalu bisa dimulai ulang hari ini']
    ])
  },

  belonging: {
    key: 'belonging',
    label: 'The Belonging',
    set: 'gut',
    allows3D: false,
    preferredModes: ['cinematic_realistic'],
    signatureVisualCues: 'shared table cues, two cups/chairs, warm community or family togetherness',
    beats: makeBeats([
      ['hook', 'Shared Table Warmth', 'Menampilkan suasana meja atau ruang bersama yang langsung terasa akrab dan diterima'],
      ['context', 'You Are Not Alone in This', 'Menggambarkan keresahan yang ternyata dialami banyak orang dengan rutinitas serupa'],
      ['mechanism', 'Shared Simple Ritual', 'Kebiasaan bersama yang sederhana dan menyatukan kebersamaan sehari-hari'],
      ['consequence', 'Warm Inclusivity', 'Dua sajian berdampingan atau aktivitas berpasangan dalam cahaya ramah'],
      ['evidence_reveal', 'Common Companion', 'Produk berada wajar di meja bersama sebagai bagian hidup keseharian'],
      ['conclusion', 'We Belong Together Close', 'Penutup akrab mengajak audiens merasakan dukungan komunitas/keluarga yang sama']
    ])
  },

  sensory_asmr: {
    key: 'sensory_asmr',
    label: 'The Sensory ASMR',
    set: 'gut',
    allows3D: false,
    preferredModes: ['cinematic_realistic', 'culinary_cinematic'],
    signatureVisualCues: 'micro close-up sound & texture: slow honey drip, crisp crackle, steam whisper, soft brush',
    beats: makeBeats([
      ['hook', 'Pure Tactile Hook', 'Extreme macro tekstur & gerak lambat paling memanjakan indra (tetesan, uap, kilau)'],
      ['context', 'Sensory Immersion Setup', 'Lingkungan hening dari planner agar seluruh fokus tertuju pada suara dan detail fisik'],
      ['mechanism', 'Micro-Texture Rhythm', 'Gerakan tangan lembut atau reaksi fisik presisi yang terasa renyah/kental/nyata', 'culinary_cinematic'],
      ['consequence', 'Hypnotic Smooth Flow', 'Transisi visual sangat mulus dan bersih menghasilkan kepuasan sensorik'],
      ['evidence_reveal', 'Authentic Product Texture', 'Produk ditampilkan pada tekstur aslinya secara jujur dalam jarak sangat dekat'],
      ['conclusion', 'Crisp Final Sensation', 'Sensasi akhir bersih dan memuaskan mengundang tonton ulang']
    ])
  },

  absurdity: {
    key: 'absurdity',
    label: 'The Absurdity',
    set: 'gut',
    allows3D: false,
    preferredModes: ['cinematic_realistic', 'symbolic_surrealism'],
    signatureVisualCues: 'playful visual exaggeration or deadpan odd prop contrast that snaps straight into common sense',
    beats: makeBeats([
      ['hook', 'Pattern-Interrupt Oddity', 'Juxtaposition tak terduga/lucu namun aman secara visual untuk menghentikan scroll seketika'],
      ['context', 'Playful Metaphor Flip', 'Menghubungkan keanehan visual itu dengan kekonyolan kebiasaan sehari-hari di planner'],
      ['mechanism', 'Deadpan Reality Check', 'Kamera beralih ke logika sederhana yang justru membuat pesan cepat nancap', 'symbolic_surrealism'],
      ['consequence', 'Aha Smile Moment', 'Ekspresi gerakan tangan menepikan prop konyol lalu beralih ke cara normal yang waras'],
      ['evidence_reveal', 'Grounded Real Product', 'Produk hadir realistis dan praktis di meja tanpa gimmick berlebihan'],
      ['conclusion', 'Clever Punchline Close', 'Penutup ringan jenaka namun tetap mengarah jelas ke manfaat nyata']
    ])
  }
};

export const ANGLE_VISUAL_FORMAT_LIST = Object.values(ANGLE_VISUAL_FORMATS);

const ALIAS_MAP = {
  'fomo': 'fear_of_missing_out',
  'fear of missing out': 'fear_of_missing_out',
  'the fear of missing out': 'fear_of_missing_out',
  'the fomo': 'fear_of_missing_out',
  'david vs goliath': 'comparison_david_vs_goliath',
  'the comparison': 'comparison_david_vs_goliath',
  'comparison': 'comparison_david_vs_goliath',
  'asmr': 'sensory_asmr',
  'the asmr': 'sensory_asmr',
  'problem you didnt know': 'problem_you_didnt_know',
  'the problem you didnt know': 'problem_you_didnt_know',
  'one feature obsession': 'one_feature_obsession',
  'shadow & silhouette': 'safe_haven'
};

function normalizeAngleLookupKey(raw = '') {
  return String(raw || '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/\([^)]*\)/g, (m) => ` ${m.slice(1, -1)} `)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Resolve one of the 30 Strategic Angles to its visual format definition.
 * Defaults gracefully to a neutral balanced cinematic format if angle is empty/unknown.
 */
export function resolveAngleFormat(angleNameOrKey = '') {
  const raw = String(angleNameOrKey || '').trim();
  if (!raw) {
    return ANGLE_VISUAL_FORMATS.life_hack;
  }

  const directSlug = raw.toLowerCase().replace(/^the\s+/i, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (ANGLE_VISUAL_FORMATS[directSlug]) {
    return ANGLE_VISUAL_FORMATS[directSlug];
  }

  const normalized = normalizeAngleLookupKey(raw);
  if (ALIAS_MAP[normalized] && ANGLE_VISUAL_FORMATS[ALIAS_MAP[normalized]]) {
    return ANGLE_VISUAL_FORMATS[ALIAS_MAP[normalized]];
  }

  const stripped = normalized.replace(/^the\s+/, '').trim();
  if (ALIAS_MAP[stripped] && ANGLE_VISUAL_FORMATS[ALIAS_MAP[stripped]]) {
    return ANGLE_VISUAL_FORMATS[ALIAS_MAP[stripped]];
  }

  for (const fmt of ANGLE_VISUAL_FORMAT_LIST) {
    const labelNorm = normalizeAngleLookupKey(fmt.label);
    const labelStripped = labelNorm.replace(/^the\s+/, '').trim();
    if (normalized === labelNorm || stripped === labelStripped || normalized.includes(labelStripped)) {
      return fmt;
    }
  }

  return ANGLE_VISUAL_FORMATS.life_hack;
}

/**
 * Allocate N clips dynamically using the resolved Strategic Angle beats.
 * Enforces:
 *  - max 1 clip of 3d_bio_cellular
 *  - 3d_bio_cellular ONLY allowed on educational/mechanism angles (or styleLimits.allow_3d_only_angles)
 *  - honors disabledStyles and falls back safely to primaryStyle
 */
export function resolveAngleBeatsForClips(
  angleNameOrKey,
  totalClips = 6,
  {
    bridgeAtClip = null,
    primaryStyle = 'cinematic_realistic',
    supportingStyles = [],
    disabledStyles = [],
    styleLimits = null
  } = {}
) {
  const count = Math.max(1, Math.min(12, Number(totalClips) || 6));
  const format = resolveAngleFormat(angleNameOrKey);
  const disabledSet = new Set(Array.isArray(disabledStyles) ? disabledStyles : []);
  const supportingSet = new Set(Array.isArray(supportingStyles) ? supportingStyles : []);

  const configuredMax3d = Number.isFinite(Number(styleLimits?.max_3d_clips))
    ? Math.max(0, Number(styleLimits.max_3d_clips))
    : 1;
  const allowedAngles = Array.isArray(styleLimits?.allow_3d_only_angles) && styleLimits.allow_3d_only_angles.length > 0
    ? new Set(styleLimits.allow_3d_only_angles.map(k => resolveAngleFormat(k).key))
    : ALLOWED_3D_ANGLE_KEYS;

  const isAngle3dEligible = Boolean(format.allows3D || allowedAngles.has(format.key));
  const canUse3d = isAngle3dEligible && configuredMax3d > 0 && !disabledSet.has('3d_bio_cellular');

  // Map N clips proportionally across the format's canonical 6 beats
  const baseBeats = format.beats;
  let used3dCount = 0;
  const allocated = [];

  for (let i = 0; i < count; i++) {
    const clipIndex = i + 1;
    let beatIdx;
    if (count === 1) {
      beatIdx = 0;
    } else if (i === 0) {
      beatIdx = 0;
    } else if (i === count - 1) {
      beatIdx = baseBeats.length - 1;
    } else if (bridgeAtClip && clipIndex === Number(bridgeAtClip)) {
      beatIdx = 4; // evidence_reveal / product bridge beat
    } else {
      beatIdx = Math.min(baseBeats.length - 2, Math.max(1, Math.round((i / (count - 1)) * (baseBeats.length - 1))));
    }

    const beat = baseBeats[beatIdx];
    let resolvedMode = beat.modePreference === 'primary' ? primaryStyle : beat.modePreference;

    if (resolvedMode === '3d_bio_cellular') {
      if (!canUse3d || used3dCount >= configuredMax3d) {
        const non3dFallback = (format.preferredModes || []).find(
          m => m !== '3d_bio_cellular' && !disabledSet.has(m) && (m === primaryStyle || supportingSet.has(m))
        );
        resolvedMode = non3dFallback || primaryStyle;
      } else {
        used3dCount += 1;
      }
    } else if (resolvedMode !== primaryStyle && (disabledSet.has(resolvedMode) || (supportingSet.size > 0 && !supportingSet.has(resolvedMode)))) {
      resolvedMode = primaryStyle;
    }

    allocated.push({
      clipIndex,
      beatRole: beat.role,
      beatLabel: beat.beatLabel,
      visualIntent: beat.visualIntent,
      visualMode: resolvedMode,
      isProductBridge: Boolean(bridgeAtClip && clipIndex === Number(bridgeAtClip))
    });
  }

  return {
    angleFormat: format,
    clips: allocated,
    hasAny3d: used3dCount > 0,
    used3dCount
  };
}

