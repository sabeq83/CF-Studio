/**
 * lib/metaphor-world-kits.js
 * Library Metaphor World Kit (28 seed kit) + helper validasi, pemetaan beat, dan formatter prompt.
 * Semua beat pre-bridge (problem, threat, struggle, failure) ditulis 100% object-only (fisika mandiri)
 * agar kompatibel dengan mode default (F1), sementara hand_variant disiapkan untuk Metaphor Policy (F2).
 */

export const GENRE_LABEL = {
  asmr_cleaning: 'ASMR Satisfying Cleaning',
  kitchen_science_demo: 'Kitchen Science Demo',
  household_physics: 'Household Physics Metaphor',
  pov_regret: 'POV Culinary Regret',
  tension_object: 'Tension & Relief Object',
};

const REQUIRED_BEAT_KEYS = ['problem', 'threat', 'struggle', 'failure', 'reaction', 'result'];
const FORBIDDEN_TOPICS = new Set(['pencegahan_kanker', 'kandungan_wanita']);
export const PRE_BRIDGE_FORBIDDEN_WORDS_RE = /\b(hands?|fingers?|arms?|bottles?|capsules?|products?|jars?|brand)\b/i;

export const METAPHOR_WORLD_KITS = [
  {
    key: 'grease_in_water',
    label: 'Minyak Bandel di Gelas Air',
    genre: 'kitchen_science_demo',
    topics: ['kolesterol', 'detox'],
    source: 'bundayes_grease_trap',
    object_world: 'A clear drinking glass of water on a bright white ceramic Indonesian kitchen table',
    environment: 'Bright Indonesian home kitchen, white ceramic tiles, clean daylight from window, uncluttered table',
    beats: {
      problem: 'A thick stream of dark-yellow used frying oil pours into clear water, swirling stubbornly at the top and refusing to dissolve',
      threat: 'Extreme close-up of a heavy greasy yellow layer clinging together and coating the inner rim of the clear glass',
      struggle: 'The liquid churns violently as an unseen vortex spins the water, forcing oil droplets to collide without merging',
      failure: 'Motion halts; the yellow oil immediately snaps back into a thick, cloudy floating film over the dull water below',
      reaction: 'A generous swirl of {product_substance} settles onto the oil surface; the thick greasy film breaks into tiny suspended pearls that sink cleanly',
      result: 'Crystal-clear water inside the glass with settled clumps resting quietly at the bottom, morning light refracting cleanly',
    },
    hand_variant: {
      struggle: 'A modest long-sleeved hand covering the wrist stirs the oily glass aggressively with a stainless spoon',
    },
    lighting_arc: {
      from: 'cool harsh 4300K high-contrast greasy side light with dim kitchen shadows',
      to: 'high-key crisp 5600K fresh morning window daylight',
    },
    sfx_palette: ['thick liquid pour', 'low tense drone', 'liquid vortex churn', 'soft sink plop', 'bright glass chime'],
    vo_bridge: 'Bayangkan minyak yang menolak larut ini seperti pola makan tinggi gorengan dan santan yang perlu kita imbangi setiap hari.',
    compliance_note: 'Dilarang klaim membakar/membuang lemak tubuh atau membersihkan darah. Gunakan "membantu menjaga" atau "pendamping pola makan".',
    thumbnail: { top: 'MINYAK BANDEL?', bottom: 'JERNIH LAGI' },
  },
  {
    key: 'oil_powder_emulsify',
    label: 'Uji Emulsi Minyak & Air Hangat',
    genre: 'kitchen_science_demo',
    topics: ['kolesterol', 'pencernaan'],
    source: 'bundayes_emulsification_test',
    object_world: 'Two side-by-side clear kitchen bowls filled with warm water and thick golden cooking oil on a bright counter',
    environment: 'Sunlit Indonesian home kitchen counter, pale ceramic backsplash, clean light wood trivet',
    beats: {
      problem: 'Thick pools of deep orange curry oil and sticky coconut fat coat a translucent soup ladle and float heavily across murky water in a glass bowl',
      threat: 'Macro view of sticky golden oil globules merging into a dense, suffocating slick across the water surface',
      struggle: 'Rapid water ripples shake the bowl from beneath, splashing droplets without breaking the surface tension of the grease',
      failure: 'As ripples subside, the oil slick reforms thicker than before, leaving stubborn cloudy rings along the glass',
      reaction: 'A spoonful of {product_substance} disperses through the water, emulsifying the heavy oil into tiny suspended micro-pearls that sink cleanly',
      result: 'Clean, bright water surface glowing under crisp sunlight with zero greasy film left on top',
    },
    hand_variant: {
      struggle: 'A modest long-sleeved hand covering the wrist whisks the oily water briskly with a small steel whisk',
    },
    lighting_arc: {
      from: 'cool overcast dim 4300K kitchen shadow highlighting thick greasy film sheen',
      to: 'crisp bright 5600K high-key clean morning daylight',
    },
    sfx_palette: ['wet oil splash', 'rapid whisk buzz', 'gentle fizzle', 'clear water settle', 'soft chime'],
    vo_bridge: 'Bayangkan minyak kental yang sulit menyatu ini seperti asupan bersantan dan berminyak yang sering menumpuk di menu harian.',
    compliance_note: 'Jangan klaim melunturkan lemak tubuh. Fokus pada pendamping pola makan seimbang.',
    thumbnail: { top: 'LEMAK MEMBANDEL', bottom: 'MUDAH TERURAI' },
  },
  {
    key: 'clogged_clear_tube',
    label: 'Selang Bening Tersumbat',
    genre: 'asmr_cleaning',
    topics: ['pencernaan', 'detox'],
    source: 'bundayes_clogged_tube',
    object_world: 'A transparent flexible kitchen hose curved over a white ceramic utility sink',
    environment: 'Clean bright Indonesian utility sink area, white subway ceramic tiles, natural daylight',
    beats: {
      problem: 'A transparent hose bulges under pressure as thick, dark paste-like residue wedges tightly inside the bend',
      threat: 'Close-up of incoming clear water backing up behind the stubborn dark blockage, unable to pass through',
      struggle: 'Water pressure pulses repeatedly against the blockage, causing the clear tube to flex and vibrate intensely',
      failure: 'Water drains back sluggishly while the dense dark plug remains wedged inside the curve',
      reaction: 'Warm water blended with {product_substance} flows into the tube, softening and breaking the blockage into loose sliding pieces',
      result: 'Clean water rushes smoothly through the spotless transparent tube in a steady, effortless stream',
    },
    hand_variant: {
      struggle: 'Modest long-sleeved hands covering wrists squeeze and massage the clogged transparent tube over the sink',
    },
    lighting_arc: {
      from: 'cool dim 4200K shadowy utility lighting highlighting the dark dense blockage',
      to: 'bright clean 5600K sunlit clarity across the clear hose',
    },
    sfx_palette: ['rubber flex creak', 'trapped water gurgle', 'pressure pulse', 'satisfying unclog whoosh', 'clean stream flow'],
    vo_bridge: 'Bayangkan selang yang mampet ini seperti saluran cerna kita saat kurang serat dan pola makan terasa berat.',
    compliance_note: 'Jangan klaim mengobati penyakit usus atau membuang racun organ. Gunakan "membantu menjaga kenyamanan pencernaan".',
    thumbnail: { top: 'ALIRAN MAMPET?', bottom: 'LANCAR PLONG!' },
  },
  {
    key: 'sink_drain_unclog',
    label: 'Wastafel Dapur Tersumbat',
    genre: 'asmr_cleaning',
    topics: ['pencernaan', 'detox'],
    source: 'bundayes_drain_unclog',
    object_world: 'A stainless-steel Indonesian kitchen sink basin filled with cloudy standing water over a clogged strainer',
    environment: 'Bright everyday Indonesian kitchen sink, white tile backsplash, dish rack blurred in clean background',
    beats: {
      problem: 'Murky brownish dishwater pools high in a stainless sink, completely stalled above a grease-caked drain strainer',
      threat: 'Macro shot of soggy food bits and congealed oil sealing every tiny hole of the metal drain grille',
      struggle: 'Cold tap water runs from above, swirling the cloudy pool deeper without moving the clogged drain',
      failure: 'The tap shuts off, leaving stagnant murky water sitting stubbornly high in the metal basin',
      reaction: 'Warm water infused with {product_substance} pours gently over the strainer; trapped grime loosens and swirls downward',
      result: 'A crisp whirlpool drains the sink completely dry, revealing a gleaming spotless stainless strainer',
    },
    hand_variant: {
      struggle: 'A modest long-sleeved hand covering the wrist taps and brushes the clogged strainer with a small wooden brush',
    },
    lighting_arc: {
      from: 'dim harsh flat 4300K utility kitchen light over murky water',
      to: 'sparkling bright 5600K high-key morning sunlight glinting off clean stainless steel',
    },
    sfx_palette: ['stagnant water slosh', 'tap splash', 'gentle fizz', 'deep drain whirlpool gurgle', 'bright metallic shine'],
    vo_bridge: 'Bayangkan wastafel yang menggenang ini seperti pencernaan yang terasa penuh dan lambat setelah makan berat.',
    compliance_note: 'Hindari klaim detoks medis. Gunakan analogi rasa ringan dan nyaman di pencernaan.',
    thumbnail: { top: 'GENANGAN MAMPET', bottom: 'PLONG BERSIH' },
  },
  {
    key: 'carpet_deep_clean',
    label: 'Karpet Kusam Jadi Cerah',
    genre: 'asmr_cleaning',
    topics: ['kesehatan_kulit', 'detox'],
    source: 'bundayes_carpet_clean',
    object_world: 'A plush cream living-room rug dusted with dull grey powder and dried surface residue',
    environment: 'Bright sunlit Indonesian family living room, light cream floor tiles, sheer white curtain in background',
    beats: {
      problem: 'A plush cream carpet looks noticeably dull and greyed out beneath embedded grime as an angled light beam reveals visible dense pale dust motes swirling out of its heavy fibers',
      threat: 'Extreme macro of fine grey particles trapped deep between pale woven carpet fibers under dim angled light',
      struggle: 'A dry stiff bristle brush sweeps rapidly across the surface, kicking up dusty haze while deeper fibers remain grey',
      failure: 'Dense grey dust settles right back onto the rug, leaving muddy streak marks and dull matted fibers',
      reaction: 'A clear clarifying mist infused with {product_substance} passes smoothly across the dusty fabric, lifting trapped grey residue cleanly out of the weave',
      result: 'Fluffy, bright cream carpet fibers standing upright and radiant in spotless morning sunlight',
    },
    hand_variant: {
      struggle: 'A modest long-sleeved hand covering the wrist pats and brushes the dusty cream carpet firmly',
    },
    lighting_arc: {
      from: 'dim shadowy 4300K utility beam slicing across suspended floating dust motes and greyed carpet fibers',
      to: 'luminous high-key 5600K clean morning sunbeam across bright spotless cream fibers',
    },
    sfx_palette: ['dry bristle scrub', 'soft dust poof', 'mist spray hiss', 'deep ASMR suction hum', 'fresh airy shimmer'],
    vo_bridge: 'Bayangkan debu yang terperangkap di serat karpet ini seperti radikal bebas dan kotoran harian yang membuat tampilan terasa kusam.',
    compliance_note: 'Dilarang klaim memutihkan permanen atau membuang racun lewat kulit. Gunakan "membantu menjaga kesegaran dan kecerahan alami".',
    thumbnail: { top: 'KUSAM BERDEBU', bottom: 'CERAH BERSERI' },
  },
  {
    key: 'greasy_pan_scrub',
    label: 'Wajan Berkerak Minyak Bekas',
    genre: 'asmr_cleaning',
    topics: ['kolesterol'],
    source: 'bundayes_deep_pan_scrub',
    object_world: 'A non-stick frying pan coated in thick hardened yellow-brown cooking grease on a white kitchen counter',
    environment: 'Bright tidy Indonesian home kitchen stove counter, white ceramic tile wall, clean daylight',
    beats: {
      problem: 'A heavy frying pan sits coated in thick, sticky, semi-solid yellow oil left over from deep-frying',
      threat: 'Macro close-up of congealed grease clinging stubbornly to the dark non-stick pan grooves',
      struggle: 'A stream of plain cold water hits the pan, beading off the waxy grease layer without lifting a speck',
      failure: 'Water pools uselessly to one side while the thick greasy coating stays smeared across the pan surface',
      reaction: 'Warm water blended with {product_substance} glides over the grease, breaking the waxy film into clean lifted droplets',
      result: 'A spotless matte-clean frying pan gleaming dry on a bright white kitchen rack',
    },
    hand_variant: {
      struggle: 'A modest long-sleeved hand covering the wrist wipes the greasy pan with a folded kitchen tissue that slides helplessly',
    },
    lighting_arc: {
      from: 'harsh directional light exposing sticky greasy reflections',
      to: 'soft clean high-key daylight on dry spotless cookware',
    },
    sfx_palette: ['cold water bead', 'sticky grease squelch', 'warm rinse hiss', 'clean squeak wipe', 'fresh chime'],
    vo_bridge: 'Bayangkan kerak minyak yang menempel kuat di wajan ini seperti sisa makanan tinggi lemak jenuh yang sulit diimbangi air biasa saja.',
    compliance_note: 'Jangan klaim mengikis lemak pembuluh darah. Fokus pada keseimbangan pola makan harian.',
    thumbnail: { top: 'KERAK MINYAK', bottom: 'KESAT BERSIH' },
  },
  {
    key: 'greasy_tupperware',
    label: 'Wadah Plastik Berminyak Merah',
    genre: 'asmr_cleaning',
    topics: ['kolesterol', 'pencernaan'],
    source: 'bundayes_greasy_tupperware',
    object_world: 'A clear plastic food container stained with bright orange-red chili oil on a bright kitchen counter',
    environment: 'Modern bright Indonesian kitchen sink counter, white ceramic tiles, morning window light',
    beats: {
      problem: 'A transparent food container is heavily coated inside with slick orange-red rendang oil and spice residue',
      threat: 'Close-up of bright orange grease beads clinging tightly to the plastic corners and walls',
      struggle: 'Plain water and foam slosh vigorously inside the sealed container, turning cloudy orange without clearing the walls',
      failure: 'Once poured out, the plastic walls still feel slippery and wear an orange greasy film',
      reaction: 'A warm infusion with {product_substance} swirls inside, lifting every orange oil droplet cleanly off the plastic walls',
      result: 'Squeaky-clean crystal-clear food container sparkling under bright morning sunlight',
    },
    hand_variant: {
      struggle: 'Modest long-sleeved hands covering wrists shake the sealed oily plastic container vigorously',
    },
    lighting_arc: {
      from: 'harsh dim 4300K directional light on orange stained plastic',
      to: 'bright pure 5600K high-key daylight shining through crystal-clear plastic',
    },
    sfx_palette: ['plastic lid snap', 'vigorous liquid shake', 'water pour', 'squeaky clean rub', 'sparkle ding'],
    vo_bridge: 'Bayangkan noda minyak yang licin menempel di wadah ini seperti sisa hidangan bersantan dan pedas yang bikin tubuh terasa berat.',
    compliance_note: 'Hindari klaim "melarutkan lemak menempel di usus". Gunakan "membantu menjaga kenyamanan setelah makan berlemak".',
    thumbnail: { top: 'NODA MINYAK MERAH', bottom: 'KESAT BENING' },
  },
  {
    key: 'soaked_sponge_squeeze',
    label: 'Spons Jenuh Diperas Segar',
    genre: 'household_physics',
    topics: ['detox', 'sirkulasi_darah'],
    source: 'bundayes_sponge_squeeze',
    object_world: 'A thick yellow kitchen sponge swollen and heavy with dark murky water on a white ceramic tray',
    environment: 'Bright clean Indonesian kitchen counter by a sunny window, white ceramic surface',
    beats: {
      problem: 'A swollen yellow sponge sits slumped and heavy, saturated with dark stagnant brownish liquid seeping around its base',
      threat: 'Macro view of pores choked with murky droplets, making the sponge sluggish and heavy',
      struggle: 'A small ceramic weight presses down unevenly on the sponge, pushing out only a trickle of cloudy water',
      failure: 'When pressure lifts, the sponge re-absorbs the same murky puddle, staying soggy and heavy',
      reaction: 'Clear pure water infused with {product_substance} flushes through the sponge as steady compression expels every drop of murky liquid',
      result: 'A bright, springy, clean yellow sponge resting lightly on a dry spotless white ceramic dish',
    },
    hand_variant: {
      struggle: 'Modest long-sleeved hands covering wrists wring and twist the heavy soaked sponge over a white bowl',
    },
    lighting_arc: {
      from: 'moody damp shadow around dark pooled liquid',
      to: 'clean crisp morning sunlight over bright dry ceramic',
    },
    sfx_palette: ['heavy wet squish', 'murky drip', 'crisp flush pour', 'firm wring squelch', 'light airy chime'],
    vo_bridge: 'Bayangkan spons yang terasa berat dan penuh cairan keruh ini seperti tubuh yang terasa lesu saat aliran dan hidrasi kurang terjaga.',
    compliance_note: 'Dilarang klaim membuang racun ginjal atau water weight medis. Gunakan "membantu menjaga kesegaran dan vitalitas harian".',
    thumbnail: { top: 'BERAT & JENUH', bottom: 'RINGAN SEGAR' },
  },
  {
    key: 'sponge_filter_barrier',
    label: 'Spons Penahan Tetesan Sirup',
    genre: 'kitchen_science_demo',
    topics: ['gula_darah'],
    source: 'bundayes_absorption_barrier',
    object_world: 'A clear glass beaker topped with a fine linen filter and thick dry sponge pad on a sunlit counter',
    environment: 'Bright bright-white Indonesian home kitchen table, daylight from side window, clean glass props',
    beats: {
      problem: 'Thick dark-amber sugar syrup pours rapidly toward an unprotected clear glass of water below',
      threat: 'Close-up of raw syrup plunging straight down, turning clear water instantly dark and syrupy in seconds',
      struggle: 'A thin paper sieve bends under the heavy syrup rush, tearing slightly as sweet dark streams leak through fast',
      failure: 'The glass below quickly clouds into thick dark caramel-brown liquid from the sudden spike',
      reaction: 'A dense fiber pad infused with {product_substance} sits atop the filter, slowing and catching the thick syrup rush',
      result: 'Only a calm, measured trickle passes slowly into clear bright water, keeping the glass balanced and light',
    },
    hand_variant: {
      struggle: 'A modest long-sleeved hand covering the wrist holds a glass pitcher pouring thick syrup slowly over the weak sieve',
    },
    lighting_arc: {
      from: 'dense warm contrast over dark heavy syrup rush',
      to: 'clean balanced natural morning light across clear glass',
    },
    sfx_palette: ['thick syrup glug', 'paper strain rustle', 'slow steady drip', 'calm water ripple', 'soft balance tone'],
    vo_bridge: 'Bayangkan sirup pekat yang langsung tumpah sekaligus ini seperti lonjakan asupan manis saat pola makan kita tidak terkendali.',
    compliance_note: 'Dilarang klaim menurunkan kadar gula darah atau menggantikan obat diabetes. Gunakan "membantu mendampingi pola makan rendah gula".',
    thumbnail: { top: 'TERLALU CEPAT NAIK', bottom: 'LEBIH TERKENDALI' },
  },
  {
    key: 'iron_filings_magnet',
    label: 'Serbuk Besi & Medan Penarik',
    genre: 'household_physics',
    topics: ['detox'],
    source: 'bundayes_magnetic_field',
    object_world: 'A white porcelain dish scattered with fine black iron grains mixed into white kitchen salt',
    environment: 'Clean bright minimalist tabletop, white ceramic mat, soft natural studio daylight',
    beats: {
      problem: 'Fine dark metallic grains are scattered unevenly throughout a bright white porcelain dish of pure sea salt',
      threat: 'Macro shot of dark grains stubbornly tangled among delicate white salt crystals',
      struggle: 'A gentle gust of air blows across the dish, scattering white salt around while heavy dark specks stay behind',
      failure: 'The mixture looks even messier, with dark specks clinging throughout the entire dish',
      reaction: 'A smooth ceramic-coated magnet glides quietly above the dish, lifting every dark grain cleanly up and away beside a bright cup holding {product_substance}',
      result: 'Pure snow-white salt crystals sparkling cleanly inside the spotless porcelain dish',
    },
    hand_variant: {
      struggle: 'A modest long-sleeved hand covering the wrist tries picking out tiny specks with a wooden spoon without success',
    },
    lighting_arc: {
      from: 'cool grey contrast emphasizing scattered dark specks',
      to: 'bright pure high-key white daylight',
    },
    sfx_palette: ['fine grain scatter', 'soft air whoosh', 'magnetic zip click', 'clean crystal shimmer'],
    vo_bridge: 'Bayangkan kotoran halus yang sulit dipisahkan manual ini seperti sisa metabolisme harian yang butuh dukungan nutrisi alami.',
    compliance_note: 'Jangan klaim mendetoksifikasi logam berat atau organ. Gunakan "membantu menjaga kesegaran dan keseimbangan tubuh".',
    thumbnail: { top: 'TERCAMPUR KOTOR', bottom: 'BERSIH TERPISAH' },
  },
  {
    key: 'damp_match_ignition',
    label: 'Korek Lembap vs Api Hangat',
    genre: 'household_physics',
    topics: ['stamina'],
    source: 'bundayes_energy_burn',
    object_world: 'Wooden kitchen matches resting beside a damp saucer and a small clay tea candle on a bright table',
    environment: 'Bright morning Indonesian dining table, light oak wood and ceramic mug in background',
    beats: {
      problem: 'A damp wooden matchstick scrapes across a wet striker strip, producing only a weak hiss and grey smoke',
      threat: 'Macro close-up of the soggy match tip crumbling slightly with zero spark',
      struggle: 'Repeated rapid friction across the damp surface leaves dark smudge marks and a faint fading wisp of smoke',
      failure: 'The wet match snaps silently, leaving the unlit morning candle cold on the saucer',
      reaction: 'A warm soothing ritual with {product_substance} accompanies crisp morning dryness as one strike ignites a tall, steady golden flame',
      result: 'A bright warm candle flame burning steadily beside a steaming morning herbal cup in crisp daylight',
    },
    hand_variant: {
      struggle: 'A modest long-sleeved hand covering the wrist strikes the damp matchbox repeatedly with weary motion',
    },
    lighting_arc: {
      from: 'cool overcast early-morning dimness',
      to: 'warm radiant golden morning sunlight',
    },
    sfx_palette: ['damp scrape hiss', 'weak wood snap', 'crisp match strike', 'warm flame whoosh', 'bright morning chime'],
    vo_bridge: 'Bayangkan korek lembap yang sulit menyala ini seperti energi pagi hari yang terasa berat sebelum tubuh mendapat asupan yang pas.',
    compliance_note: 'Dilarang klaim obat kuat atau peningkat hormon instan. Gunakan "membantu menjaga stamina dan kebugaran harian".',
    thumbnail: { top: 'ENERGI REDUP?', bottom: 'NYALA STABIL!' },
  },
  {
    key: 'apple_oxidation',
    label: 'Apel Segar vs Oksidasi Udara',
    genre: 'kitchen_science_demo',
    topics: ['anti_oksidan', 'kesehatan_kulit'],
    source: 'bundayes_oxidation_test',
    object_world: 'Two freshly sliced apple halves resting side-by-side on a white ceramic cutting board',
    environment: 'Bright clean Indonesian pantry table, pale ceramic board, crisp window daylight',
    beats: {
      problem: 'A fresh pale apple slice sits exposed on a ceramic board as dull brownish spots begin creeping across its crisp flesh',
      threat: 'Time-lapse macro of rapid oxidation browning spreading unevenly and drying out the exposed slice surface',
      struggle: 'A splash of plain tap water rinses over the slice, sliding off without stopping the browning creep',
      failure: 'The unprotected slice turns shriveled, dull tan, and lifeless under the open air',
      reaction: 'A thin glistening coat of {product_substance} brushes smoothly over the sister slice, sealing its surface cleanly',
      result: 'Crisp, dewy ivory-white apple flesh gleaming fresh and firm beside morning sunlight',
    },
    hand_variant: {
      struggle: 'A modest long-sleeved hand covering the wrist lightly pats the browning apple slice with a dry paper napkin',
    },
    lighting_arc: {
      from: 'flat slightly muted daylight over browning surface',
      to: 'bright luminous fresh morning sunbeam on crisp fruit',
    },
    sfx_palette: ['crisp apple slice crunch', 'water splash', 'soft brush glide', 'dewy sparkle chime'],
    vo_bridge: 'Bayangkan irisan apel yang cepat kecokelatan saat terpapar udara ini seperti sel tubuh kita yang setiap hari berhadapan dengan oksidasi.',
    compliance_note: 'Jangan klaim anti-penuaan permanen atau menyembuhkan penyakit. Gunakan "membantu melindungi dari paparan oksidatif harian".',
    thumbnail: { top: 'CEPAT KUSAM', bottom: 'TETAP SEGAR!' },
  },
  {
    key: 'heavy_suitcase_repack',
    label: 'Koper Sesak Jadi Ringkas',
    genre: 'tension_object',
    topics: ['stamina'],
    source: 'bundayes_heavy_suitcase',
    object_world: 'An overstuffed beige travel suitcase straining at its zipper on a bright sunlit bedroom floor',
    environment: 'Tidy bright Indonesian bedroom corner, light cream floor, crisp daylight from window',
    beats: {
      problem: 'An overpacked fabric suitcase bulges awkwardly, with clothes spilling out and its zipper stuck halfway',
      threat: 'Extreme close-up of taut metal zipper teeth groaning under excessive pressure from messy piles inside',
      struggle: 'The heavy lid bounces back up repeatedly as compressed weight pushes against the straining seam',
      failure: 'The zipper slider slips backward with a metallic rattle, leaving the messy suitcase gaping open',
      reaction: 'Neat folded compartments settle calmly inside beside a fresh cup with {product_substance}, reducing bulk into tidy order',
      result: 'A slim, neatly zipped suitcase standing effortlessly upright in bright morning light',
    },
    hand_variant: {
      struggle: 'Modest long-sleeved hands covering wrists press down hard on the bulging suitcase lid to force the zipper shut',
    },
    lighting_arc: {
      from: 'heavy cluttered indoor shadow',
      to: 'bright airy tidy morning bedroom light',
    },
    sfx_palette: ['fabric stretch groan', 'metal zipper strain', 'heavy thud', 'smooth clean zip', 'light upbeat chime'],
    vo_bridge: 'Bayangkan koper yang terlalu sesak dan bikin langkah berat ini seperti tubuh yang kelelahan karena rutinitas padat tanpa jeda.',
    compliance_note: 'Dilarang klaim penurunan berat badan instan. Gunakan "membantu tubuh terasa lebih ringan dan bugar beraktivitas".',
    thumbnail: { top: 'SESAK & BERAT', bottom: 'RINGAN TERTATA' },
  },
  {
    key: 'strained_jeans_button',
    label: 'Kancing Jeans Tegang Mereda',
    genre: 'tension_object',
    topics: ['pencernaan'],
    source: 'bundayes_turbo_jeans',
    object_world: 'A folded pair of denim jeans lying flat on a bright linen bedsheet with a straining brass waist button',
    environment: 'Clean bright Indonesian bedroom setting, soft beige linen sheet, natural morning window light',
    beats: {
      problem: 'A denim waistband stretches tightly around a puffed cotton cushion, pulling the metal buttonhole to its limit',
      threat: 'Extreme macro of taut denim threads and a straining metal button nearly popping loose under pressure',
      struggle: 'The fabric pulls inward briefly then expands outward again as trapped tension presses from within',
      failure: 'The metal button unhooks with a sharp snap, leaving the waistband flared wide under uncomfortable pressure',
      reaction: 'Gentle soothing comfort paired with {product_substance} calms the inner puffiness, letting the waistband relax smoothly',
      result: 'The denim button fastens effortlessly with comfortable breathing room along a smooth flat waistband',
    },
    hand_variant: {
      struggle: 'Modest long-sleeved hands covering wrists tug tightly at the denim waistband trying to align the button',
    },
    lighting_arc: {
      from: 'tight shadowy evening indoor tone',
      to: 'relaxed bright morning window light',
    },
    sfx_palette: ['denim fabric creak', 'metal button ping', 'soft exhale sigh', 'easy button click', 'calm chime'],
    vo_bridge: 'Bayangkan kancing celana yang terasa sesak ini seperti rasa begah dan penuh di perut setelah makan terburu-buru.',
    compliance_note: 'Hindari klaim "mengecilkan lingkar perut dalam hitungan hari". Gunakan "membantu menjaga kenyamanan perut dari rasa begah".',
    thumbnail: { top: 'PERUT BEGAH?', bottom: 'NYAMAN LEGA' },
  },
  {
    key: 'oscilloscope_stress',
    label: 'Gelombang Osiloskop Tenang',
    genre: 'tension_object',
    topics: ['fungsi_otak', 'gula_darah'],
    source: 'bundayes_cortisol_hack',
    object_world: 'A compact retro tabletop waveform monitor showing jagged red spikes beside a ceramic teacup',
    environment: 'Bright clean modern home desk, white wall, potted green leaf in background, daylight',
    beats: {
      problem: 'A bright oscilloscope screen flashes erratic jagged spikes rapidly across the grid while a desk bell vibrates',
      threat: 'Macro close-up of sharp red waveform peaks hitting the upper ceiling limit in rapid chaotic bursts',
      struggle: 'A mechanical dial ticks noisily, shifting the baseline slightly only for jagged spikes to bounce right back',
      failure: 'The chaotic high-frequency peaks keep bouncing rapidly, shaking a nearby spoon against a saucer',
      reaction: 'A soothing warm glass holding {product_substance} steams beside the monitor; the jagged red waveform gradually softens into slow, smooth green waves',
      result: 'A calm, steady, gentle sine wave gliding smoothly across the clean screen in peaceful daylight',
    },
    hand_variant: {
      struggle: 'A modest long-sleeved hand covering the wrist twists the control knob rapidly without calming the jagged spikes',
    },
    lighting_arc: {
      from: 'tense flickering screen contrast in dim study corner',
      to: 'serene bright daylight across clean calm desk',
    },
    sfx_palette: ['erratic electronic blip', 'nervous spoon rattle', 'gentle kettle pour', 'calm harmonic hum', 'soft bell'],
    vo_bridge: 'Bayangkan gelombang yang melonjak tak beraturan ini seperti pola stres harian yang sering memicu keinginan ngemil berlebihan.',
    compliance_note: 'Dilarang klaim menyembuhkan gangguan kecemasan atau menurunkan hormon kortisol secara klinis. Gunakan "membantu menjaga ketenangan dan fokus".',
    thumbnail: { top: 'PIKIRAN TEGANG', bottom: 'TENANG STABIL' },
  },
  {
    key: 'dusty_mirror_wipe',
    label: 'Cermin Kusam Jadi Bening',
    genre: 'asmr_cleaning',
    topics: ['kesehatan_kulit'],
    source: 'bundayes_dull_reflection',
    object_world: 'A frameless vanity mirror misted with dry haze and cloudy smudges on a bright white dressing table',
    environment: 'Bright tidy Indonesian dressing corner, white painted table, soft sheer daylight from side window',
    beats: {
      problem: 'A tabletop vanity mirror sits heavily veiled in cloudy grey haze and dry chalky water spots',
      threat: 'Macro close-up of crusty mineral rings and dull smudge streaks scattering light unevenly across the glass',
      struggle: 'A dry paper towel drags across the hazy surface, leaving faint scratches and pushing streaks from left to right',
      failure: 'Swirl marks remain smeared across the glass, keeping the reflection hazy and dull',
      reaction: 'A clear clarifying mist infused with {product_substance} glides across the glass and wipes away in one clean vertical stroke',
      result: 'A crystal-clear spotless mirror reflecting bright morning greenery and crisp daylight',
    },
    hand_variant: {
      struggle: 'A modest long-sleeved hand covering the wrist rubs the hazy mirror with a dry cloth leaving stubborn streaks',
    },
    lighting_arc: {
      from: 'cloudy diffused grey reflection',
      to: 'crisp radiant morning reflection',
    },
    sfx_palette: ['dry paper rub', 'mist spray spritz', 'smooth squeegee glide', 'crystal sparkle chime'],
    vo_bridge: 'Bayangkan cermin yang buram oleh noda harian ini seperti tampilan kulit yang tampak lelah saat perawatan dari dalam terabaikan.',
    compliance_note: 'Dilarang klaim bikin glowing instan atau mengobati jerawat kronis. Gunakan "membantu merawat kecerahan dan kesegaran alami".',
    thumbnail: { top: 'BURAM KUSAM', bottom: 'BENING SEGAR' },
  },
  {
    key: 'santan_food_coma',
    label: 'Mangkuk Santan Kental Siang Hari',
    genre: 'pov_regret',
    topics: ['pencernaan', 'stamina'],
    source: 'bundayes_santan_coma',
    object_world: 'An empty ceramic bowl ringed with thick cooled white-orange coconut curry oil on a dining table',
    environment: 'Bright everyday Indonesian dining table, woven rattan placemat, afternoon window light',
    beats: {
      problem: 'A cooled ceramic lunch bowl sits under dim utility shadow, rimmed with thick congealed pale-white coconut fat and deep orange curry grease',
      threat: 'Close-up of heavy orange oil pooling sluggishly beside an unwashed spoon and crumpled tissue',
      struggle: 'A glass of plain iced water sweats nearby, looking heavy and motionless next to the rich leftover bowl',
      failure: 'Thick oil films stiffen into opaque white-orange patches along the ceramic rim as minutes pass',
      reaction: 'A warm glass blended with {product_substance} arrives beside the cleared bowl; gentle warmth cuts cleanly through the visual heaviness on the table',
      result: 'A tidy cleared table bathed in fresh light with a clean sparkling glass of warm herbal drink',
    },
    hand_variant: {
      struggle: 'A modest long-sleeved hand covering the wrist sets down the heavy spoon sluggishly beside the oily bowl',
    },
    lighting_arc: {
      from: 'cool overcast dim 4300K dining shadow highlighting congealed white fat and heavy greasy sheen',
      to: 'clean crisp refreshing 5600K high-key daylight on tidy spotless table',
    },
    sfx_palette: ['ceramic spoon clink', 'ice clatter', 'warm tea pour', 'refreshing sigh breeze', 'clean chime'],
    vo_bridge: 'Bayangkan rasa berat setelah menikmati hidangan bersantan pekat ini seperti sinyal tubuh yang butuh pendamping ringan agar tetap bertenaga.',
    compliance_note: 'Jangan klaim melunturkan kolesterol seketika setelah makan. Gunakan "membantu menjaga kenyamanan tubuh setelah makan berat".',
    thumbnail: { top: 'NGANTUK BERAT', bottom: 'SEGAR KEMBALI' },
  },
  {
    key: 'midnight_martabak_box',
    label: 'Kotak Martabak Tengah Malam',
    genre: 'pov_regret',
    topics: ['gula_darah', 'pencernaan'],
    source: 'bundayes_midnight_martabak',
    object_world: 'An open cardboard snack box soaked with dark butter and thick chocolate-sugar crumbs on a table',
    environment: 'Homey Indonesian dining table transitioning from warm night lamp to bright clean morning window light',
    beats: {
      problem: 'An open cardboard box reveals buttery oil stains soaked deep through paper liners and leftover sweet sugar crumbs',
      threat: 'Macro close-up of glistening sticky butter and dense sugar glaze pooling on the paper sheet',
      struggle: 'A crumpled paper napkin presses onto the soaked box liner, instantly turning translucent with heavy grease',
      failure: 'Even after folding the box shut, oily dark stains seep through the outer cardboard',
      reaction: 'Morning light sweeps the table clean; {product_substance} dissolves cleanly into a bright glass of warm water',
      result: 'A fresh clutter-free morning table with crystal-clear herbal water glowing in sunlight',
    },
    hand_variant: {
      struggle: 'A modest long-sleeved hand covering the wrist closes the greasy cardboard box slowly on the table',
    },
    lighting_arc: {
      from: 'dim warm midnight table lamp casting heavy shadows',
      to: 'bright clean high-key 7 AM morning sunlight',
    },
    sfx_palette: ['cardboard flap creak', 'crinkly wax paper', 'morning bird chirp', 'clear water pour', 'fresh chime'],
    vo_bridge: 'Bayangkan sisa camilan manis dan bermentega semalam ini seperti beban kalori berlebih yang perlu kita imbangi di pagi hari.',
    compliance_note: 'Dilarang klaim menetralkan gula darah setelah makan manis. Fokus pada kebiasaan seimbang di pagi hari.',
    thumbnail: { top: 'KHILAF SEMALAM', bottom: 'PAGI SEIMBANG' },
  },
  {
    key: 'gorengan_oil_paper',
    label: 'Kertas Gorengan Tembus Minyak',
    genre: 'pov_regret',
    topics: ['kolesterol', 'kesehatan_kulit'],
    source: 'bundayes_gorengan_trap',
    object_world: 'Brown food-wrapping paper stained translucent with golden frying oil on a white ceramic plate',
    environment: 'Bright Indonesian kitchen breakfast table, white ceramic plate, natural morning light',
    beats: {
      problem: 'Crispy golden fritter crumbs sit atop brown wrapping paper soaked completely translucent by pooled cooking oil',
      threat: 'Macro shot of shiny oil puddles creeping outward across the paper fibers toward the white plate',
      struggle: 'A second dry paper napkin lays over top, immediately turning heavy and soaked through in seconds',
      failure: 'Layer after layer of paper turns greasy and limp while oil still glistens on the ceramic plate',
      reaction: 'The greasy paper clears away as a warm glass infused with {product_substance} settles cleanly onto the spotless plate',
      result: 'A bright clean white ceramic plate and crisp herbal glass sparkling in morning daylight',
    },
    hand_variant: {
      struggle: 'A modest long-sleeved hand covering the wrist dabs a fresh napkin onto the oily paper only to see it soak through',
    },
    lighting_arc: {
      from: 'warm harsh side light highlighting oily paper translucency',
      to: 'clean crisp airy white morning light',
    },
    sfx_palette: ['greasy paper crinkle', 'oil sizzle fade', 'plate clink', 'fresh pour', 'sparkle tone'],
    vo_bridge: 'Bayangkan minyak goreng yang mudah meresap ke kertas ini seperti lemak harian dari gorengan yang diam-diam menumpuk.',
    compliance_note: 'Jangan klaim membuang minyak dari tubuh atau menyembuhkan jerawat karena gorengan. Gunakan "pendamping gaya hidup sehat".',
    thumbnail: { top: 'MINYAK MERESAP', bottom: 'LEBIH TERJAGA' },
  },
  {
    key: 'ayce_plate_tower',
    label: 'Tumpukan Piring Makan Besar',
    genre: 'pov_regret',
    topics: ['pencernaan'],
    source: 'bundayes_ayce_aftermath',
    object_world: 'A tall precarious stack of sauce-streaked ceramic dinner plates on a clean kitchen counter',
    environment: 'Bright Indonesian home dining counter, light wood surface, clean daylight from side window',
    beats: {
      problem: 'A towering stack of heavy sauce-smudged plates wobbles precariously on a narrow kitchen counter',
      threat: 'Close-up of thick sticky glaze and heavy stacked weight pressing down on the bottom plate',
      struggle: 'The stack tilts slightly left and right under its own weight as a stray fork slides off the top',
      failure: 'The messy pile sits motionless and overwhelming, blocking the entire workspace',
      reaction: 'Warm clear rinse water infused with {product_substance} cascades smoothly, clearing plate after plate into neat bright order',
      result: 'A single sparkling clean white plate resting peacefully beside a fresh herbal glass in bright daylight',
    },
    hand_variant: {
      struggle: 'Modest long-sleeved hands covering wrists steady the wobbling tower of heavy plates carefully',
    },
    lighting_arc: {
      from: 'cluttered dim post-feast tabletop contrast',
      to: 'minimalist bright fresh daylight',
    },
    sfx_palette: ['ceramic clatter', 'metallic fork slide', 'warm water rinse', 'clean porcelain ping', 'light chime'],
    vo_bridge: 'Bayangkan tumpukan piring penuh setelah makan besar ini seperti kerja ekstra sistem cerna saat porsi makan terlalu padat.',
    compliance_note: 'Dilarang klaim membakar kalori instan. Gunakan "membantu menjaga rasa nyaman setelah makan porsi besar".',
    thumbnail: { top: 'KEBANYAKAN PORSI', bottom: 'NYAMAN KEMBALI' },
  },
  {
    key: 'rusty_hinge_free',
    label: 'Engsel Berkarat Jadi Mulus',
    genre: 'household_physics',
    topics: ['persendian'],
    source: 'original',
    object_world: 'A small weathered metal cabinet hinge mounted on a light painted white wooden kitchen door',
    environment: 'Bright clean Indonesian home pantry corner, white painted wood cabinet, clear window daylight',
    beats: {
      problem: 'A stiff metal cabinet hinge flakes with dry orange rust dust, refusing to swing smoothly past halfway',
      threat: 'Macro close-up of gritty oxidized metal teeth grinding tightly against each other',
      struggle: 'The cabinet door shudders and jerks back slightly as dry friction locks the hinge joint',
      failure: 'Dry rust powder falls onto the white wood below while the door stays stuck at an awkward half-open angle',
      reaction: 'A single drop of {product_substance} seeps smoothly into the hinge pin, loosening the dry friction cleanly',
      result: 'The spotless white cabinet door glides open and shut silently with silky effortless motion',
    },
    hand_variant: {
      struggle: 'A modest long-sleeved hand covering the wrist nudges the stiff cabinet door, feeling it jam halfway',
    },
    lighting_arc: {
      from: 'dry gritty shadow emphasizing rust flakes',
      to: 'bright smooth sunlit cleanliness',
    },
    sfx_palette: ['metallic rusty screech', 'dry grit crunch', 'soft oil drop', 'silky silent glide', 'warm bell'],
    vo_bridge: 'Bayangkan engsel yang kaku dan seret ini seperti sendi yang terasa kurang nyaman saat digerakkan di pagi hari.',
    compliance_note: 'Dilarang klaim menyembuhkan radang sendi atau pengapuran tulang. Gunakan "membantu menjaga kelenturan dan kenyamanan gerak".',
    thumbnail: { top: 'KAKU & SERET', bottom: 'MULUS LENTUR' },
  },
  {
    key: 'crusted_sugar_pot',
    label: 'Toples Gula Mengerak Kental',
    genre: 'asmr_cleaning',
    topics: ['gula_darah'],
    source: 'original',
    object_world: 'A clear glass kitchen canister with thick crystallized sugar crusted around its inner walls',
    environment: 'Bright sunny Indonesian kitchen pantry shelf, white ceramic tiles, natural daylight',
    beats: {
      problem: 'A transparent glass canister is heavily encrusted inside with hard, sticky white-brown sugar crystals',
      threat: 'Extreme close-up of jagged crystallized syrup locking a metal teaspoon rigidly inside the sticky base',
      struggle: 'Cold tap water splashes inside, swirling briefly without melting the stubborn hardened crust',
      failure: 'Water pours away while thick gritty sugar crystals still cling solidly to the bottom glass',
      reaction: 'Warm water infused with {product_substance} dissolves the sticky crystal crust effortlessly from wall to wall',
      result: 'A sparkling clean clear glass canister shining cleanly on a bright white kitchen shelf',
    },
    hand_variant: {
      struggle: 'A modest long-sleeved hand covering the wrist twists the stuck metal spoon inside the crusted canister',
    },
    lighting_arc: {
      from: 'muted cloudy contrast through crusted glass',
      to: 'crisp radiant sunlight refracting through crystal-clear glass',
    },
    sfx_palette: ['sugar crystal scrape', 'spoon clink', 'warm pour', 'fizzing dissolve', 'crystal ping'],
    vo_bridge: 'Bayangkan kerak gula yang menumpuk lengket ini seperti kebiasaan minuman manis harian yang perlu kita kontrol pelan-pelan.',
    compliance_note: 'Dilarang klaim menyembuhkan diabetes atau menurunkan HbA1c. Gunakan "membantu mendampingi gaya hidup seimbang dan kontrol asupan manis".',
    thumbnail: { top: 'KERAK MANIS', bottom: 'BERSIH SEIMBANG' },
  },
  {
    key: 'kettle_limescale',
    label: 'Kerak Teko Dapur Jadi Kinclong',
    genre: 'asmr_cleaning',
    topics: ['liver', 'detox'],
    source: 'original',
    object_world: 'An open stainless-steel electric kettle lined with chalky white-yellow mineral scale inside',
    environment: 'Bright everyday Indonesian kitchen counter, white ceramic backsplash, crisp morning window light',
    beats: {
      problem: 'Inside an open steel kettle, thick chalky mineral scale blankets the heating plate in dull uneven crusts',
      threat: 'Macro view of flaky white-yellow sediment choking the smooth metal base',
      struggle: 'Plain cold water swirls inside the kettle, barely rinsing away a few loose flakes while thick scale stays welded on',
      failure: 'Water drains out cloudy, leaving the rough chalky crust stubbornly coating the bottom',
      reaction: 'Warm water blended with {product_substance} simmers gently inside, lifting and peeling away the mineral crust into clean dissolved wisps',
      result: 'A mirror-bright stainless kettle interior gleaming fresh in warm morning daylight',
    },
    hand_variant: {
      struggle: 'A modest long-sleeved hand covering the wrist wipes the rim of the scaled kettle with a soft cloth',
    },
    lighting_arc: {
      from: 'dull shadowy interior inside scaled kettle',
      to: 'bright gleaming metallic morning reflection',
    },
    sfx_palette: ['chalky scrape', 'water swirl', 'gentle simmer bubble', 'clean steel polish', 'bright chime'],
    vo_bridge: 'Bayangkan kerak yang menempel di dasar teko ini seperti beban metabolisme harian yang menumpuk saat pola istirahat dan makan kurang terjaga.',
    compliance_note: 'Dilarang klaim menyembuhkan penyakit hati atau fatty liver. Gunakan "membantu menjaga kesehatan fungsi tubuh dan metabolisme".',
    thumbnail: { top: 'KERAK MENUMPUK', bottom: 'KINCLONG BERSIH' },
  },
  {
    key: 'foggy_window_clear',
    label: 'Kaca Jendela Berembun Jadi Terang',
    genre: 'household_physics',
    topics: ['asma', 'flu', 'alergi'],
    source: 'original',
    object_world: 'A glass kitchen windowpane clouded with heavy damp condensation and fine dust motes',
    environment: 'Bright Indonesian home window overlooking fresh green garden leaves in morning daylight',
    beats: {
      problem: 'A large home windowpane is completely fogged over with heavy misty condensation and grey haze',
      threat: 'Close-up of thick water droplets clinging tightly to dusty glass, blurring the green garden outside',
      struggle: 'A small draft of cool air blows across the glass, only thickening the mist around the edges',
      failure: 'Heavy condensation trails drip slowly down, leaving the view completely obscured and stuffy',
      reaction: 'Warm soothing vapor carrying {product_substance} rises gently toward the pane, clearing the thick fog from the center outward',
      result: 'Crystal-clear open window glass framing bright sunlit green garden leaves and fresh morning air',
    },
    hand_variant: {
      struggle: 'A modest long-sleeved hand covering the wrist wipes a narrow streak across the foggy pane that quickly mists back',
    },
    lighting_arc: {
      from: 'cold misty overcast grey haze',
      to: 'warm crisp sunlit green morning clarity',
    },
    sfx_palette: ['soft mist hum', 'water bead drip', 'warm herbal steam', 'fresh breeze whoosh', 'morning bird chime'],
    vo_bridge: 'Bayangkan kaca berembun yang membuat suasana terasa pengap ini seperti saluran napas yang butuh kehangatan alami agar terasa lebih lega.',
    compliance_note: 'Dilarang klaim menyembuhkan asma atau alergi permanen. Gunakan "membantu memberi rasa hangat dan lega pada pernapasan".',
    thumbnail: { top: 'BEREMBUN PENGAP', bottom: 'TERANG LEGA' },
  },
  {
    key: 'tangled_cables_untangle',
    label: 'Kabel Kusut Jadi Rapi Sejajar',
    genre: 'tension_object',
    topics: ['fungsi_otak', 'alzheimer'],
    source: 'original',
    object_world: 'A knotted bundle of white and beige charging cords tangled on a bright wooden study desk',
    environment: 'Tidy modern Indonesian home work desk, light oak surface, ceramic mug and notebook in soft daylight',
    beats: {
      problem: 'Multiple white and beige cords lie hopelessly knotted in a tight chaotic ball across a study desk',
      threat: 'Extreme close-up of twisted loops pulling against one another, snagging an open notebook corner',
      struggle: 'Gentle tugs from one end only tighten the central knot further, dragging the whole tangle across the desk',
      failure: 'The cords remain snarled in a rigid messy heap blocking the workspace',
      reaction: 'Calm rhythmic motion unthreads each cord into parallel straight lines beside a fresh morning ritual with {product_substance}',
      result: 'Crisp, neatly aligned parallel cords resting beside an open clean notebook in bright morning focus light',
    },
    hand_variant: {
      struggle: 'Modest long-sleeved hands covering wrists try pulling a knotted cord end only to tighten the tangle',
    },
    lighting_arc: {
      from: 'busy cluttered afternoon shadows across messy desk',
      to: 'crisp focused bright morning light',
    },
    sfx_palette: ['cord friction rustle', 'taut snap', 'smooth uncoil slide', 'calm desk tap', 'clear focus bell'],
    vo_bridge: 'Bayangkan kabel yang kusut berbelit ini seperti pikiran yang terasa penuh saat fokus harian mulai menurun.',
    compliance_note: 'Dilarang klaim mencegah atau menyembuhkan Alzheimer/demensia. Gunakan "membantu menjaga konsentrasi dan daya ingat sehari-hari".',
    thumbnail: { top: 'KUSUT BERBELIT', bottom: 'RAPI FOKUS' },
  },
  {
    key: 'clogged_showerhead',
    label: 'Shower Tersumbat Mengalir Deras',
    genre: 'asmr_cleaning',
    topics: ['sirkulasi_darah', 'kesehatan_jantung'],
    source: 'original',
    object_world: 'A chrome bathroom showerhead with clogged lime-crusted nozzles angled toward white ceramic wall tiles',
    environment: 'Bright clean modern Indonesian bathroom, white subway tiles, fresh natural window light',
    beats: {
      problem: 'A chrome showerhead sputters weakly, with half its rubber nozzles crusted shut by pale mineral buildup',
      threat: 'Macro view of uneven weak trickles spraying sideways while blocked nozzles bulge slightly under pressure',
      struggle: 'Water pressure surges inside the pipe, making the head vibrate while weak sprays spit inconsistently',
      failure: 'Pressure drops to a dripping stutter, leaving uneven wet spots across the white tile',
      reaction: 'A warm soak infused with {product_substance} dissolves the chalky mineral caps cleanly from every tiny nozzle',
      result: 'Even, silky parallel streams of sparkling water pouring smoothly in crisp morning light',
    },
    hand_variant: {
      struggle: 'A modest long-sleeved hand covering the wrist brushes the crusted chrome nozzles gently without clearing them',
    },
    lighting_arc: {
      from: 'cool dim shadow around sputtering nozzles',
      to: 'bright sparkling daylight glinting through even water streams',
    },
    sfx_palette: ['weak water sputter', 'pipe hum', 'gentle fizz soak', 'full steady shower rush', 'fresh chime'],
    vo_bridge: 'Bayangkan aliran air yang tersendat karena endapan di ujung keran ini seperti pentingnya menjaga kelancaran ritme aliran tubuh kita.',
    compliance_note: 'Dilarang klaim menyembuhkan penyakit jantung atau melancarkan pembuluh darah tersumbat. Gunakan "membantu menjaga kebugaran dan sirkulasi yang sehat".',
    thumbnail: { top: 'ALIRAN TERSENDAT', bottom: 'MENGALIR LANCAR' },
  },
  {
    key: 'sizzling_pan_cooldown',
    label: 'Wajan Panas Mendesis Jadi Teduh',
    genre: 'household_physics',
    topics: ['maag', 'anti_inflamasi'],
    source: 'original',
    object_world: 'A hot skillet sizzling aggressively with harsh chili splatter on a bright tiled stovetop',
    environment: 'Bright Indonesian home kitchen stove, white ceramic tile backsplash, clean daylight',
    beats: {
      problem: 'An overheated skillet crackles fiercely as fiery red chili oil pops and smokes across its surface',
      threat: 'Extreme close-up of angry bubbling red oil spitting sharply up the inner walls of the hot pan',
      struggle: 'A cold splash of plain water hits the hot oil, triggering a sudden violent pop and thick steam flare',
      failure: 'Heat radiates sharply back out, keeping the angry red bubbles spitting furiously',
      reaction: 'Warm soothing {product_substance} glides gently beside the cooled pan setup, calming the fierce visual glare into quiet stillness',
      result: 'A calm, cool, clean pan resting quietly beside a warm comforting cup on a bright white counter',
    },
    hand_variant: {
      struggle: 'A modest long-sleeved hand covering the wrist tilts the sizzling pan slightly while steam flares up',
    },
    lighting_arc: {
      from: 'harsh fiery warm glare and smoky haze',
      to: 'soft calm soothing morning kitchen light',
    },
    sfx_palette: ['angry hot sizzle', 'violent splash pop', 'calm gentle pour', 'soothing hush fade', 'soft warm chime'],
    vo_bridge: 'Bayangkan wajan yang terlalu panas dan meletup ini seperti rasa perih dan panas di ulu hati saat lambung sedang tidak nyaman.',
    compliance_note: 'Dilarang klaim menyembuhkan GERD atau tukak lambung akut. Gunakan "membantu menenangkan dan menjaga kenyamanan lambung".',
    thumbnail: { top: 'PANAS PERIH?', bottom: 'TEDUH NYAMAN' },
  },
  {
    key: 'cracked_soil_watering',
    label: 'Tanah Retak Kering Jadi Kokoh Subur',
    genre: 'household_physics',
    topics: ['kesehatan_tulang', 'kesehatan_kulit'],
    source: 'original',
    object_world: 'A sunlit terracotta planter filled with dry, deeply cracked clay soil and a drooping green leaf',
    environment: 'Bright airy Indonesian home terrace table, cream wall, fresh morning window sunlight',
    beats: {
      problem: 'Inside a clean terracotta pot, parched earth splits into wide brittle cracks pulling away from the rim',
      threat: 'Macro close-up of dry crumbly soil edges flaking away while a small green sprout leans weakly',
      struggle: 'A fast splash of plain water pools on top of the hard crust and runs straight down the side gap without soaking in',
      failure: 'The water drains straight out the bottom tray, leaving the inner soil core bone-dry and cracked',
      reaction: 'Nutrient-rich moisture infused with {product_substance} drops slowly in steady pulses, softening and binding the soil into dark firm richness',
      result: 'Firm, hydrated rich earth holding a tall, vibrant upright green plant bathed in bright morning sun',
    },
    hand_variant: {
      struggle: 'A modest long-sleeved hand covering the wrist pours water too fast from a cup, watching it run off the dry crust',
    },
    lighting_arc: {
      from: 'harsh dry midday glare over parched cracked earth',
      to: 'dewy radiant morning sunlight over lush vibrant green',
    },
    sfx_palette: ['dry earth crumble', 'fast runoff splash', 'slow nourishing drip', 'soil absorb sigh', 'fresh morning chime'],
    vo_bridge: 'Bayangkan tanah yang retak karena kurang nutrisi ini seperti struktur tubuh dan kulit yang butuh asupan bernutrisi agar tetap kokoh dan segar.',
    compliance_note: 'Dilarang klaim menyembuhkan osteoporosis atau menumbuhkan tulang. Gunakan "membantu menjaga kepadatan nutrisi dan kesegaran alami".',
    thumbnail: { top: 'KERING RAPUH', bottom: 'KOKOH SEGAR' },
  },
];

export function getKit(key) {
  if (!key || typeof key !== 'string') return null;
  return METAPHOR_WORLD_KITS.find(k => k.key === key) || null;
}

export function listKitsByTopics(topics = []) {
  if (!Array.isArray(topics) || topics.length === 0) return [];
  const topicSet = new Set(topics.filter(t => t && !FORBIDDEN_TOPICS.has(t)));
  if (topicSet.size === 0) return [];
  return METAPHOR_WORLD_KITS.filter(k => k.topics.some(t => topicSet.has(t)));
}

export function validateKit(kit) {
  const errors = [];
  if (!kit || typeof kit !== 'object') {
    return { valid: false, errors: ['kit must be an object'] };
  }
  if (!kit.key || !/^[a-z0-9_]+$/.test(kit.key)) errors.push('invalid or missing key');
  if (!kit.label || typeof kit.label !== 'string') errors.push('missing label');
  if (!kit.genre || !GENRE_LABEL[kit.genre]) errors.push(`invalid genre: ${kit.genre}`);
  if (!Array.isArray(kit.topics) || kit.topics.length === 0) {
    errors.push('topics must be non-empty array');
  } else {
    for (const t of kit.topics) {
      if (FORBIDDEN_TOPICS.has(t)) errors.push(`forbidden high-risk topic: ${t}`);
    }
  }
  if (!kit.object_world) errors.push('missing object_world');
  if (!kit.environment) errors.push('missing environment');
  if (!kit.beats || typeof kit.beats !== 'object') {
    errors.push('missing beats');
  } else {
    for (const b of REQUIRED_BEAT_KEYS) {
      if (!kit.beats[b] || typeof kit.beats[b] !== 'string') {
        errors.push(`missing beat: ${b}`);
      }
    }
    for (const preBeat of ['problem', 'threat', 'struggle', 'failure']) {
      const text = kit.beats[preBeat] || '';
      const match = text.match(PRE_BRIDGE_FORBIDDEN_WORDS_RE);
      if (match) {
        errors.push(`pre-bridge beat "${preBeat}" contains forbidden word "${match[0]}"`);
      }
    }
  }
  if (!kit.hand_variant?.struggle) errors.push('missing hand_variant.struggle');
  if (!kit.lighting_arc?.from || !kit.lighting_arc?.to) errors.push('missing lighting_arc');
  if (!Array.isArray(kit.sfx_palette) || kit.sfx_palette.length < 4) errors.push('sfx_palette must have >= 4 items');
  if (!kit.vo_bridge) errors.push('missing vo_bridge');
  if (!kit.compliance_note) errors.push('missing compliance_note');
  if (!kit.thumbnail?.top || !kit.thumbnail?.bottom) errors.push('missing thumbnail');

  return { valid: errors.length === 0, errors };
}

export const PRODUCT_FORM_DEFINITIONS = {
  honey_garlic: {
    form: 'honey_garlic',
    substance: 'viscous dark golden-amber herbal honey with fermented whole single-clove solo garlic',
    bridgingAction: 'drizzling viscous dark golden-amber honey and solo garlic cloves directly onto the metaphor surface with a wooden or stainless spoon',
    shortLabel: 'Madu + Bawang Tunggal Fermentasi'
  },
  powder: {
    form: 'powder',
    substance: 'fine pale golden herbal botanical powder',
    bridgingAction: 'spooning fine herbal powder directly onto the dirty metaphor surface so particles actively react',
    shortLabel: 'Serbuk Herbal'
  },
  capsule: {
    form: 'capsule',
    substance: 'concentrated botanical extract released smoothly from an opened herbal capsule',
    bridgingAction: 'opening the herbal capsule cleanly over warm liquid beside the metaphor object so active particles disperse',
    shortLabel: 'Kapsul Herbal'
  },
  oil: {
    form: 'oil',
    substance: 'pure golden-amber botanical oil drops',
    bridgingAction: 'dispensing concentrated botanical oil drops directly onto the friction or residue point',
    shortLabel: 'Minyak Herbal'
  },
  liquid: {
    form: 'liquid',
    substance: 'concentrated dark-amber liquid botanical extract',
    bridgingAction: 'pouring a measured stream of amber botanical liquid directly onto the metaphor surface to actively trigger clearing',
    shortLabel: 'Ekstrak Cair'
  },
  default: {
    form: 'default',
    substance: 'concentrated golden botanical extract',
    bridgingAction: 'applying the authentic botanical extract directly onto the metaphor surface so visible transformation begins',
    shortLabel: 'Ekstrak Herbal Alami'
  }
};

export function resolveProductForm(product = null) {
  if (!product || typeof product !== 'object') {
    return PRODUCT_FORM_DEFINITIONS.default;
  }
  const blob = [
    product.product_name,
    product.product_description,
    product.product_truth,
    product.geometric_truth,
    product.packaging_type,
    product.cara_pakai,
    product.unique_selling_point
  ].filter(Boolean).join(' ').toLowerCase();

  if (!blob) return PRODUCT_FORM_DEFINITIONS.default;

  if (/(madu|honey)/i.test(blob) && /(bawang|garlic|lanang|solo\s*garlic)/i.test(blob)) {
    return PRODUCT_FORM_DEFINITIONS.honey_garlic;
  }
  if (/(serbuk|bubuk|powder|tepung|sachet\s+seduh)/i.test(blob)) {
    return PRODUCT_FORM_DEFINITIONS.powder;
  }
  if (/(kapsul|capsule|softgel|tablet|kaplet)/i.test(blob)) {
    return PRODUCT_FORM_DEFINITIONS.capsule;
  }
  if (/(minyak|essential\s*oil|\boil\b|balm|salep)/i.test(blob) && !/madu|honey/i.test(blob)) {
    return PRODUCT_FORM_DEFINITIONS.oil;
  }
  if (/(madu|honey|sirup|syrup|cair|liquid|ekstrak\s*cair|tetes|drops|jamu\s*botol)/i.test(blob)) {
    return PRODUCT_FORM_DEFINITIONS.liquid;
  }
  return PRODUCT_FORM_DEFINITIONS.default;
}

export function renderReactionBeat(text, productOrForm = null) {
  const formSpec = (productOrForm && productOrForm.substance)
    ? productOrForm
    : resolveProductForm(productOrForm);
  return String(text || '').replace(/\{product_substance\}/gi, formSpec.substance);
}

export function toLegacyMetaphorShape(kit, opts = {}) {
  if (!kit) return null;
  const formSpec = resolveProductForm(opts?.product || null);
  return {
    key: kit.key,
    label: kit.label,
    archetype: kit.genre,
    archetype_label: GENRE_LABEL[kit.genre] || kit.genre,
    hook_metaphor: kit.beats.problem,
    environment: kit.environment,
    kit_key: kit.key,
    product_form: formSpec.form,
    product_substance: formSpec.substance,
    reaction_resolved: renderReactionBeat(kit.beats?.reaction, formSpec),
    kit,
  };
}

/**
 * Memetakan 6 beat metafora ke jumlah klip aktual secara deterministik.
 * Pre-bridge clips (1 .. bridgeAtClip - 1) HANYA mendapat beat pre-bridge (problem/threat/struggle/failure).
 */
export function mapBeatsToClips(targetClips = 6, bridgeAtClip = 4) {
  const total = Math.max(1, Number(targetClips) || 6);
  const bridge = Math.max(2, Math.min(total, Number(bridgeAtClip) || 2));
  const preCount = bridge - 1;
  const preBeats = ['problem', 'threat', 'struggle', 'failure'];
  const mapping = [];

  for (let c = 1; c <= total; c++) {
    let beat;
    if (c < bridge) {
      if (preCount === 1) {
        beat = 'problem';
      } else if (preCount === 2) {
        beat = c === 1 ? 'problem' : 'struggle';
      } else if (preCount === 3) {
        beat = c === 1 ? 'problem' : (c === 2 ? 'threat' : 'failure');
      } else {
        const idx = Math.min(preBeats.length - 1, Math.floor(((c - 1) * preBeats.length) / preCount));
        beat = preBeats[idx];
      }
    } else if (c === total) {
      beat = 'result';
    } else {
      beat = 'reaction';
    }
    mapping.push({ clip: c, beat, zone: c < bridge ? 'pre' : 'post' });
  }

  return mapping;
}

export function buildMetaphorWorldKitSection(kit, { targetClips = 6, bridgeAtClip = 4, product = null, policy = null, variety = null } = {}) {
  if (!kit) return '';
  const genreLabel = GENRE_LABEL[kit.genre] || kit.genre;
  const formSpec = resolveProductForm(product);
  const resolvedReaction = renderReactionBeat(kit.beats.reaction, formSpec);
  const clipMap = mapBeatsToClips(targetClips, bridgeAtClip);
  const total = Math.max(1, Number(targetClips) || 6);
  const isInsideMetaphor = Boolean(policy?.active && policy?.productEntry === 'inside_metaphor');
  const allowCulinary = kit.genre === 'recipe';

  const clipLines = clipMap
    .map(m => {
      if (m.clip === bridgeAtClip) {
        return `  * Klip ${m.clip} [REACTION — ACTIVE PRODUCT BRIDGE]: ${resolvedReaction} (AKSI NYATA: ${formSpec.bridgingAction}; perlihatkan zat produk berinteraksi langsung membersihkan objek metafora, bukan sekadar memegang wadah pasif)`;
      }
      if (m.clip > bridgeAtClip && m.clip < total) {
        return `  * Klip ${m.clip} [RESULT — SAME-WORLD AFTERMATH]: Kelanjutan transformasi BERSIH di dalam dunia benda YANG SAMA (${kit.object_world}). Perlihatkan efek bersih progresif: ${kit.beats.result}.${allowCulinary ? '' : ' DILARANG berpindah ke adegan memasak, merajang bawang/jahe/herbal, menumbuk bumbu, atau talenan kuliner.'}`;
      }
      if (m.clip === total) {
        const heroHint = isInsideMetaphor && product
          ? ` HERO PRODUCT FINALE: Tampilkan objek metafora yang kini bersih sempurna (${kit.beats.result}) BERSAMA wadah produk asli sesuai (Product Truth) & (Product Reference File) dalam genggaman sopan lengan panjang menutup pergelangan tangan.`
          : ` ${kit.beats.result}`;
        return `  * Klip ${m.clip} [RESULT${isInsideMetaphor && product ? ' — HERO FINALE' : ''}]:${heroHint}`;
      }
      return `  * Klip ${m.clip} [${m.beat.toUpperCase()}]: ${kit.beats[m.beat]}`;
    })
    .join('\n');

  const varietyLine = variety
    ? `\n- Identitas Visual Video Konsisten (Klip 2..${total}): Warna Lengan Baju = "${variety.wardrobeColorLabel}" (${variety.wardrobeDesc}); Sudut Kamera = "${variety.cameraAngleLabel}" (${variety.cameraAnglePrompt})`
    : '';

  return `
🌍 METAPHOR WORLD KIT: "${kit.label}" (${genreLabel})
- Dunia benda (WAJIB konsisten dari Klip 1 sampai Klip ${total}): ${kit.object_world}
- Latar: ${kit.environment}
- Bentuk Fisik Produk Target: ${formSpec.shortLabel} — ${formSpec.substance}${varietyLine}
- Peta beat pre-bridging (unattended/modest physics, tanpa kemasan komersial):
  * PROBLEM  → ${kit.beats.problem}
  * THREAT   → ${kit.beats.threat}
  * STRUGGLE → ${kit.beats.struggle}
  * FAILURE  → ${kit.beats.failure}
- Beat solusi (mulai Klip ${bridgeAtClip}): REACTION → ${resolvedReaction}; RESULT → ${kit.beats.result}${allowCulinary ? '' : '\n- KUNCI KONTINUITAS PASCA-BRIDGE (WAJIB): Klip pasca-bridging DILARANG berbelok menjadi tutorial dapur, memotong bawang/jahe/kunyit, atau meramu herbal; pertahankan objek & ruangan kit yang persis sama hingga klip terakhir.'}
- Pemetaan beat ke ${targetClips} klip:
${clipLines}
- Arc lighting: ${kit.lighting_arc.from} ➔ ${kit.lighting_arc.to}
- Palet SFX: ${(kit.sfx_palette || []).join(', ')}
- Jembatan VO (wajib 1 kalimat analogi, gaya bahasa boleh disesuaikan): "${kit.vo_bridge}"
- Kepatuhan: ${kit.compliance_note}
`;
}

