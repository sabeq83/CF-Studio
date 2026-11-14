/**
 * lib/health-metaphors.js
 * Kamus Metafora Visual Faceless (Object-Centric) untuk 22 Masalah Kesehatan
 * Menghindari visual monoton (meja dapur & sel biologi 3D) dengan menggantinya
 * ke analogi visual benda makro, fisika fluida, mekanika alam, dan penempaan elemen.
 */

export const HEALTH_METAPHOR_MAP = {
  // 1. Kolesterol
  kolesterol: {
    archetype: 'sacred_hydro',
    archetype_label: 'Sacred Hydro & Clarity',
    label: 'Pembersihan Lapisan Lemak Fluida',
    hook_metaphor: 'A cloudy, oil-smudged optical crystal glass disc where a single heavy drop of dense black-garlic honey extract lands at the center, causing the stubborn greasy film to instantly cleave and disperse outward to the edges, leaving immaculate transparent crystalline clarity.',
    environment: 'Honed white limestone minimalist surface, soft natural diffused daylight, macro 85mm lens.'
  },
  // 2. Gula Darah
  gula_darah: {
    archetype: 'zen_kinetic',
    archetype_label: 'Zen Kinetic & Equilibrium',
    label: 'Keseimbangan Neraca Antik',
    hook_metaphor: 'A delicate antique brass balance scale heavily tilted on one side by a jagged mound of brittle white sugar crystals, then slowly leveling out to a dead-flat perfect equilibrium as a single dark, glistening aged garlic clove is placed on the opposite brass pan.',
    environment: 'Polished antique mahogany workbench with subtle gold-accented grain, warm chiaroscuro studio lighting.'
  },
  // 3. Kesehatan Jantung
  kesehatan_jantung: {
    archetype: 'zen_kinetic',
    archetype_label: 'Zen Kinetic & Equilibrium',
    label: 'Detak Ritmik Pendulum Abadi',
    hook_metaphor: 'A heavy solid brass pendulum swinging in rock-solid, serene rhythmic precision across a dark ebony base, perfectly synchronized with a calm, steady amber oil lamp flame burning tall and unwavering in the background.',
    environment: 'Architectural moody study with dark walnut textures and warm amber rim lights.'
  },
  // 4. Pencegahan Kanker
  pencegahan_kanker: {
    archetype: 'crucible_alchemy',
    archetype_label: 'The Crucible & Alchemy Heat',
    label: 'Perisai Resin Ambar Alami',
    hook_metaphor: 'A delicate green leaf encapsulated in a pure natural amber resin shield, repelling harsh, scorching ultraviolet light rays while preserving the pristine, unblemished cell structure beneath without a single charred spot.',
    environment: 'Rough-hewn volcanic basalt stone pedestal, dramatic beam of focused sunbeam from above.'
  },
  // 5. Maag (Asam Lambung / GERD)
  maag: {
    archetype: 'crucible_alchemy',
    archetype_label: 'The Crucible & Alchemy Heat',
    label: 'Pemadaman Api Panas Lambung',
    hook_metaphor: 'A red-hot glowing charcoal briquette sizzling furiously with acrid heat, when a thick drop of cool dark honey coats its surface, instantly extinguishing the ember into calm, soothing stillness with a glossy protective caramel glaze.',
    environment: 'Rough black slate plate in a moody zen culinary studio, moody deep-shadow cinematography.'
  },
  // 6. Asma & Saluran Napas
  asma: {
    archetype: 'living_flora',
    archetype_label: 'Living Flora & Organic Nurture',
    label: 'Mekarnya Daun Pakis Embun Pagi',
    hook_metaphor: 'A tightly curled, constricted dry fern frond that slowly uncoils and expands wide with supple elasticity as fresh, oxygen-rich morning mist wafts across its surface, breathing in deep vitality.',
    environment: 'Dew-drenched mossy forest stone bed, luminous dawn golden-hour backlighting.'
  },
  // 7. Stamina & Vitalitas Pria
  stamina: {
    archetype: 'zen_kinetic',
    archetype_label: 'Zen Kinetic & Equilibrium',
    label: 'Busur Jati Kencang & Api Abadi',
    hook_metaphor: 'A vintage ashwood recurve bow drawn to maximum tension with zero micro-fractures, resting alongside an ancient brass oil lamp whose flame burns intense, tall, and unflinching despite a sudden gust of wind.',
    environment: 'Rugged dark granite workbench with leather straps, high-contrast masculine cinematic lighting.'
  },
  // 8. Kandungan Wanita & Promil
  kandungan_wanita: {
    archetype: 'living_flora',
    archetype_label: 'Living Flora & Organic Nurture',
    label: 'Benih Humus & Kintsugi Kehidupan',
    hook_metaphor: 'A rare dormant seed nestled in warm, nutrient-dense dark humus soil, as golden nectar gently seeps into the soil, causing a delicate green shoot to tenderly emerge in a tranquil micro-environment.',
    environment: 'Soft linen-draped wooden botanical workbench, gentle diffused morning sunlight with floating micro-particles.'
  },
  // 9. Mengurangi Risiko Alzheimer & Fungsi Otak
  alzheimer: {
    archetype: 'living_flora',
    archetype_label: 'Living Flora & Organic Nurture',
    label: 'Fokus Tajam Lensa Optik Antik',
    hook_metaphor: 'A dusty, fogged antique brass magnifying glass lens, gently wiped clean by soft linen, instantly revealing intricate, crystal-sharp golden manuscript calligraphy beneath with limitless optical clarity.',
    environment: 'Warm scholarly archive with weathered leather-bound tomes and brass drafting tools.'
  },
  // 10. Kesehatan Pencernaan
  pencernaan: {
    archetype: 'sacred_hydro',
    archetype_label: 'Sacred Hydro & Clarity',
    label: 'Aliran Mulus Bambu & Air Sejuk',
    hook_metaphor: 'A handcrafted natural bamboo water conduit flowing smoothly with crystal-clear mountain spring water, washing away coarse organic sediments effortlessly without clogging.',
    environment: 'Serene Japanese stone garden basin, gentle water ripples with natural jade reflections.'
  },
  // 11. Kesehatan Tulang
  kesehatan_tulang: {
    archetype: 'zen_kinetic',
    archetype_label: 'Zen Kinetic & Equilibrium',
    label: 'Pilar Batu Karang Tak Goyah',
    hook_metaphor: 'A dense, solid monolithic limestone pillar standing majestic and unflinching under a steady cascade of mineral-rich water, showing rock-solid structural density and resilience.',
    environment: 'Ancient mineral cave grotto, soft turquoise rim light and natural mineral sheen.'
  },
  // 12. Anti Inflamasi (Peradangan Tubuh)
  anti_inflamasi: {
    archetype: 'crucible_alchemy',
    archetype_label: 'The Crucible & Alchemy Heat',
    label: 'Meredam Lidah Api Liar',
    hook_metaphor: 'An erratic, wild candle flame flickering violently, immediately stilled and cooled into a soft, steady, warm glow as a glass cloche bell gently regulates the atmosphere.',
    environment: 'Minimalist stoneware table with brushed copper accents, warm amber candlelight.'
  },
  // 13. Anti Oksidan
  anti_oksidan: {
    archetype: 'crucible_alchemy',
    archetype_label: 'The Crucible & Alchemy Heat',
    label: 'Perisai Oksidasi Logam & Buah',
    hook_metaphor: 'A sliced fresh fruit half immediately coated in an airtight layer of dark golden honey, preventing any browning or oxidation, preserving its crisp vibrant color against the elements.',
    environment: 'Artisan ceramic carving slab, natural directional daylight from an open window.'
  },
  // 14. Anti Bakteri
  anti_bakteri: {
    archetype: 'crucible_alchemy',
    archetype_label: 'The Crucible & Alchemy Heat',
    label: 'Cincin Pelindung Ambar',
    hook_metaphor: 'A pure drop of fresh dew encircled by a concentric barrier ring of raw dark honey; stray dark soot particles rebound and dissolve upon touching the honey barrier line.',
    environment: 'Polished obsidian stone mirror plate, crisp geometric macro focus.'
  },
  // 15. Flu & Batuk Pilek
  flu: {
    archetype: 'sacred_hydro',
    archetype_label: 'Sacred Hydro & Clarity',
    label: 'Pencairan Embun Hangat',
    hook_metaphor: 'A frosted, cold windowpane blanketed in heavy condensation, rapidly melting into warm, glistening droplets as steam from a clay infusion bowl rises, opening up an unobstructed vista.',
    environment: 'Rustic cedarwood windowsill overlooking misty pine trees, warm steam swirls.'
  },
  // 16. Baik untuk Liver
  liver: {
    archetype: 'sacred_hydro',
    archetype_label: 'Sacred Hydro & Clarity',
    label: 'Filtrasi Kristal Bejana Alami',
    hook_metaphor: 'Murky, sediment-laden water inside a fluted borosilicate decanter, passing through a dark natural organic filter bed, emerging on the other side as 100% pure, sparkling mountain elixir.',
    environment: 'Minimalist lab-craft counter with polished travertine marble and soft backlighting.'
  },
  // 17. Kesehatan Kulit (Anti-Aging & Glowing)
  kesehatan_kulit: {
    archetype: 'living_flora',
    archetype_label: 'Living Flora & Organic Nurture',
    label: 'Kenyal Montok Buah Kering Terhidrasi',
    hook_metaphor: 'A wrinkled, dehydrated dry fruit surface absorbing a viscous drop of dark fermented nectar, plumping up with supple, bouncy firmness and a soft dewy glass-skin luster.',
    environment: 'Textured handmade ecru linen fabric, soft diffused ring light, extreme macro 100mm.'
  },
  // 18. Detoksifikasi Tubuh
  detox: {
    archetype: 'sacred_hydro',
    archetype_label: 'Sacred Hydro & Clarity',
    label: 'Pengikatan & Pembilasan Racun',
    hook_metaphor: 'A glass flask of clouded fluid where dark organic active particles magnetically bind to impurities, precipitating them to the base and leaving crystal-clear radiant fluid above.',
    environment: 'Clean slate workbench with borosilicate glassware and natural quartz crystals.'
  },
  // 19. Sakit pada Persendian
  persendian: {
    archetype: 'zen_kinetic',
    archetype_label: 'Zen Kinetic & Equilibrium',
    label: 'Pelumasan Roda Gigi Kayu & Sutra',
    hook_metaphor: 'Intricate vintage hardwood gears that previously creaked and ground dryly, rotating with effortless, whisper-quiet silky smoothness after receiving a drop of pure amber lubricant.',
    environment: 'Horologist craftsman bench with brass calipers, velvet-lined drawers, and macro mechanical depth.'
  },
  // 20. Fungsi Otak & Daya Ingat
  fungsi_otak: {
    archetype: 'living_flora',
    archetype_label: 'Living Flora & Organic Nurture',
    label: 'Uraian Benang Emas Kusut',
    hook_metaphor: 'A dense tangle of fine golden silk threads on a dark polished table, effortlessly unraveling into straight, parallel, harmonious strands as a drop of amber resin settles them.',
    environment: 'Dark ebony desk with architectural drawing rulers and golden ratio compass.'
  },
  // 21. Sirkulasi Darah
  sirkulasi_darah: {
    archetype: 'sacred_hydro',
    archetype_label: 'Sacred Hydro & Clarity',
    label: 'Aliran Bebas Pipa Kaca Ruby',
    hook_metaphor: 'A continuous spiral glass capillary tube flowing smoothly with deep ruby fluid under steady pressure, free from air bubbles or turbulence, glowing with warm vitality.',
    environment: 'Sleek frosted glass backdrop with soft ambient backlight and precise specular highlights.'
  },
  // 22. Alergi & Histamin
  alergi: {
    archetype: 'living_flora',
    archetype_label: 'Living Flora & Organic Nurture',
    label: 'Penenteraman Kelopak Sensitif',
    hook_metaphor: 'A hypersensitive, trembling blossom petal gently shielded from abrasive airborne pollen dust by a gossamer-thin protective veil of natural amber mist, resting in peace.',
    environment: 'Botanical glass terrarium, soft morning vapor and ultra-delicate lighting.'
  }
};

/**
 * Temukan metafora visual terbaik berdasarkan input topic atau teks masalah
 * @param {string} topicText 
 * @returns {object|null}
 */
export function resolveHealthMetaphor(topicText = '') {
  if (!topicText || typeof topicText !== 'string') return null;
  const clean = topicText.toLowerCase().replace(/[\s\-_]+/g, ' ');

  for (const [key, meta] of Object.entries(HEALTH_METAPHOR_MAP)) {
    const cleanKey = key.replace(/_/g, ' ');
    if (clean.includes(cleanKey) || cleanKey.includes(clean)) {
      return { key, ...meta };
    }
  }

  // Alias checks
  if (clean.includes('asam lambung') || clean.includes('gerd')) return { key: 'maag', ...HEALTH_METAPHOR_MAP.maag };
  if (clean.includes('vitalitas') || clean.includes('pria')) return { clean: 'stamina', ...HEALTH_METAPHOR_MAP.stamina };
  if (clean.includes('sendi') || clean.includes('rematik')) return { key: 'persendian', ...HEALTH_METAPHOR_MAP.persendian };
  if (clean.includes('jantung')) return { key: 'kesehatan_jantung', ...HEALTH_METAPHOR_MAP.kesehatan_jantung };
  if (clean.includes('tulang')) return { key: 'kesehatan_tulang', ...HEALTH_METAPHOR_MAP.kesehatan_tulang };
  if (clean.includes('kulit') || clean.includes('glowing')) return { key: 'kesehatan_kulit', ...HEALTH_METAPHOR_MAP.kesehatan_kulit };
  if (clean.includes('otak') || clean.includes('ingat')) return { key: 'fungsi_otak', ...HEALTH_METAPHOR_MAP.fungsi_otak };
  if (clean.includes('sirkulasi') || clean.includes('darah')) return { key: 'sirkulasi_darah', ...HEALTH_METAPHOR_MAP.sirkulasi_darah };
  if (clean.includes('kanker')) return { key: 'pencegahan_kanker', ...HEALTH_METAPHOR_MAP.pencegahan_kanker };
  if (clean.includes('radang') || clean.includes('inflamasi')) return { key: 'anti_inflamasi', ...HEALTH_METAPHOR_MAP.anti_inflamasi };
  if (clean.includes('oksidan')) return { key: 'anti_oksidan', ...HEALTH_METAPHOR_MAP.anti_oksidan };
  if (clean.includes('bakteri')) return { key: 'anti_bakteri', ...HEALTH_METAPHOR_MAP.anti_bakteri };
  if (clean.includes('detox') || clean.includes('racun')) return { key: 'detox', ...HEALTH_METAPHOR_MAP.detox };
  if (clean.includes('cerna')) return { key: 'pencernaan', ...HEALTH_METAPHOR_MAP.pencernaan };

  return null;
}

const LEGACY_TOPIC_ALIASES = [
  [/asam lambung|gerd|\bmaag\b|\blambung\b/, 'maag'],
  [/vitalitas|\bpria\b/, 'stamina'],
  [/sendi|rematik/, 'persendian'],
  [/jantung/, 'kesehatan_jantung'],
  [/tulang/, 'kesehatan_tulang'],
  [/kulit|glowing/, 'kesehatan_kulit'],
  [/\botak\b|ingat/, 'fungsi_otak'],
  [/sirkulasi|aliran darah|pembuluh darah|tekanan darah|\btensi\b|hipertensi/, 'sirkulasi_darah'],
  [/kanker/, 'pencegahan_kanker'],
  [/radang|inflamasi/, 'anti_inflamasi'],
  [/oksidan/, 'anti_oksidan'],
  [/bakteri/, 'anti_bakteri'],
  [/detox|detoks|racun/, 'detox'],
  [/cerna/, 'pencernaan'],
  [/\bdiabetes\b|\bdiabet\b|\bglukosa\b/, 'gula_darah'],
  [/\bpernapasan\b|\bnapas\b|\bsesak\b/, 'asma'],
  [/\bbatuk\b|\bpilek\b|\bflu\b/, 'flu'],
  [/\bhati\b|\bliver\b/, 'liver'],
  [/\balergi\b|histamin|gatal/, 'alergi'],
];

const EXTRA_TOPIC_ALIASES = [
  [/lemak|gorengan|santan|langsing|\bdiet\b/, 'kolesterol'],
  [/begah|sembelit|\bbab\b|susah buang air|\busus\b/, 'pencernaan'],
  [/kusam|jerawat/, 'kesehatan_kulit'],
  [/lesu|capek|lelah/, 'stamina'],
  [/stres|stress|cortisol|kortisol/, 'fungsi_otak'],
];

/**
 * Deteksi seluruh topik kesehatan yang cocok dari teks (multi-topic).
 * @param {string} topicText
 * @returns {string[]} daftar key HEALTH_METAPHOR_MAP yang unik
 */
export function detectHealthTopics(topicText = '') {
  if (!topicText || typeof topicText !== 'string') return [];
  const clean = topicText.toLowerCase().replace(/[\s\-_]+/g, ' ').trim();
  if (!clean) return [];

  const found = new Set();

  for (const key of Object.keys(HEALTH_METAPHOR_MAP)) {
    const cleanKey = key.replace(/_/g, ' ');
    if (clean.includes(cleanKey)) {
      found.add(key);
    }
  }

  for (const [pattern, targetKey] of [...LEGACY_TOPIC_ALIASES, ...EXTRA_TOPIC_ALIASES]) {
    if (pattern.test(clean)) {
      found.add(targetKey);
    }
  }

  // Fallback compatibility: kata "darah" (bukan "gula darah") memetakan ke sirkulasi_darah
  if (/\bdarah\b/.test(clean.replace(/gula\s+darah/g, ' '))) {
    found.add('sirkulasi_darah');
  }

  return Array.from(found);
}
