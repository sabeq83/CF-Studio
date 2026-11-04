import { getPgPool, closePgPool } from '../lib/db-pg.js';

const CAMPAIGN_ID = 'opc_261103_8kz9ko';

const ROW_UPDATES = {
  2013: {
    // Baris 1: Tema: Malam Cemas Hasil Cek Lab
    clips: [
      {
        clip_index: 1,
        product_visible: false,
        requires_product_reference: false,
        visual_action: "Penampang makro aliran cairan kental dengan endapan lemak yang melambat dramatis, lalu ditembus tetesan keemasan murni yang mengembalikan aliran jernih.",
        new_vo: "Angka kolesterol suami bikin malam Bunda jadi gelisah? Saatnya ubah kebiasaan kecil dari rumah.",
        voice_segments: null,
        t2i_prompt: "(Presence Truth: Strictly 100% Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE WHATSOEVER) (Object Truth & Metaphor: Macro cross-section of dense viscous liquid flow with heavy lipid sedimentation slowing dramatically, suddenly penetrated by a pristine amber droplet restoring clear kinetic flow) (Geometric Truth: strictly no commercial product packaging, no branded jars or labels shown) (Environment: Macro conceptual cross-section conduit with pristine dark background) (Lighting: high-end studio three-point professional softbox lighting, clean cinematic rim lighting tracing fluid clarity, warm 3200K amber backlighting illuminating the golden fluid.)",
        t2v_prompt: "",
        i2v_prompt: "Macro slow motion shot of dense viscous lipid fluid slowing down until a pure radiant amber droplet breaks through, clearing the pathway in smooth fluid dynamics."
      },
      {
        clip_index: 2,
        product_visible: false,
        requires_product_reference: false,
        visual_action: "Sudut meja nakas kayu kamar tidur malam hari dengan lembar dokumen hasil lab, kacamata baca, dan lampu meja temaram hangat.",
        new_vo: "Melihat lembar hasil lab di meja kamar malam hari, rasa cemas itu wajar datang menyergap.",
        voice_segments: null,
        t2i_prompt: "(Presence Truth: Strictly Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE) (Object & Context Truth: Aesthetic wooden bedroom nightstand at night with an unfolded medical lab test report sheet, reading glasses, and a soft warm glowing table lamp) (Geometric Truth: strictly no commercial product packaging, no branded jars or labels shown) (Environment: Cozy bedroom interior at night, warm moody amber ambient) (Lighting: Warm 3000K bedside lamp glow casting gentle shadows across the wooden nightstand surface.)",
        t2v_prompt: "",
        i2v_prompt: "Slow gentle cinematic camera pan across the wooden bedside nightstand revealing the medical lab report sheet and reading glasses under the warm lamp glow."
      },
      {
        clip_index: 3,
        product_visible: false,
        requires_product_reference: false,
        visual_action: "Cangkir keramik air hangat di atas baki kayu kecil di samping jendela malam yang tenang.",
        new_vo: "Kalau dibiarkan, kekhawatiran ini bukan cuma ganggu waktu istirahat, tapi juga kebugaran jangka panjangnya.",
        voice_segments: null,
        t2i_prompt: "(Presence Truth: Strictly Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE) (Object & Context Truth: Steaming ceramic cup of warm water resting on a small rustic wooden tray next to a quiet night window with city lights bokeh) (Geometric Truth: strictly no commercial product packaging, no branded jars or labels shown) (Environment: Peaceful night window sill, quiet residential nocturnal atmosphere) (Lighting: Subtle cool blue window moonlight contrasted with soft warm indoor rim light on the ceramic cup and steam.)",
        t2v_prompt: "",
        i2v_prompt: "Subtle slow motion macro capture of delicate steam rising from the warm ceramic cup resting by the nocturnal window, tranquil and atmospheric."
      },
      {
        clip_index: 4,
        product_visible: false,
        requires_product_reference: false,
        visual_action: "Semangkuk kecil bahan alami mentah (bawang lanang segar utuh & madu murni) di atas meja kayu estetik.",
        new_vo: "Kuncinya ada pada langkah kecil harian yang konsisten, tanpa harus repot atau mengubah total menu makan.",
        voice_segments: null,
        t2i_prompt: "(Presence Truth: Strictly Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE) (Object & Context Truth: Small handcrafted ceramic bowl containing pristine whole raw solo garlic bulbs and a small dish of raw golden honey on an organic timber table) (Geometric Truth: strictly no commercial product packaging, no branded jars or labels shown) (Environment: Warm domestic kitchen table with natural organic textures) (Lighting: Soft cinematic warm lighting highlighting the natural skin texture of solo garlic and the rich gloss of honey.)",
        t2v_prompt: "",
        i2v_prompt: "Slow macro tracking shot showcasing whole raw solo garlic bulbs resting beside pure glistening golden honey on the natural wood surface."
      },
      {
        clip_index: 5,
        product_visible: true,
        requires_product_reference: true,
        visual_action: "Sendok stainless steel mengangkat satu siung bawang lanang berlapis madu keemasan dari jar GarliBee.",
        new_vo: "Hadirkan GarliBee Honey Infused Solo Garlic, perpaduan bawang lanang fermentasi dan raw honey murni.",
        voice_segments: null,
        t2i_prompt: "(Biometric Anchor: Faceless, subtle POV hands with minimal charcoal cuffs gently interacting with the authentic GarliBee jar and stainless spoon.) (Wardrobe: Charcoal minimalist cuffs, wrists covered, non-intrusive) (Product Reference File: 'garlibee_clean_official.jpg', geometry_lock: EXACT FILENAME MATCH — high-fidelity visual must match the attached reference photo) (Product Truth: Authentic naturally fermented Solo Garlic aged for over 3 months in raw forest honey inside a squircle transparent glass jar with ribbed silver-metal screw lid and matte-black label) (Action & Craft: Faceless hands using a polished stainless steel spoon to lift a honey-glazed fermented solo garlic clove from the open GarliBee jar) (Environment: Warm cozy evening dining space with soft mood lighting) (Lighting: Professional warm commercial key light illuminating the golden honey drip and dark caramel garlic texture.)",
        t2v_prompt: "",
        i2v_prompt: "Delicate macro slow motion lifting a single glistening honey-glazed fermented solo garlic clove out of the GarliBee jar with a polished spoon."
      },
      {
        clip_index: 6,
        product_visible: true,
        requires_product_reference: true,
        visual_action: "Jar GarliBee squircle berdiri anggun di atas meja kayu dengan pantulan cahaya malam yang hangat dan menenangkan.",
        new_vo: "Jaga kesehatan suami dengan cara yang nikmat dan praktis, link pembelian aku taruh di Bio ya!",
        voice_segments: null,
        t2i_prompt: "(Biometric Anchor: Faceless, clean tabletop product commercial.) (Wardrobe: Charcoal minimalist cuffs, wrists covered, non-intrusive) (Product Reference File: 'garlibee_clean_official.jpg', geometry_lock: EXACT FILENAME MATCH — high-fidelity visual must match the attached reference photo) (Product Truth: Squircle transparent glass jar of GarliBee Honey Infused Solo Garlic resting elegantly with ribbed silver-metal screw lid and matte-black label) (Action & Craft: Premium hero commercial showcase of the GarliBee jar resting on a solid teak wood table accompanied by reading glasses and warm ambient accents) (Environment: Warm tranquil bedroom/living room evening ambiance) (Lighting: Commercial product studio lighting with warm rim light and soft golden bounce.)",
        t2v_prompt: "",
        i2v_prompt: "Slow cinematic pull-back reveal of the GarliBee jar on the evening wooden table, warm comforting reflections, premium commercial finish."
      }
    ]
  },
  2015: {
    // Baris 3: Tema: Rutinitas Sarapan Pagi Suami Sebelum Berangkat
    clips: [
      {
        clip_index: 1,
        product_visible: false,
        requires_product_reference: false,
        visual_action: "Uap hangat mengepul dari piring sarapan sehat dan cangkir teh di atas meja makan kayu minimalis yang bermandikan sinar matahari pagi (soft morning sun flare).",
        new_vo: "Awali pagi suami dengan satu kebiasaan kecil ini agar tubuh bugar dan bebas beban kolesterol.",
        voice_segments: null,
        t2i_prompt: "(Presence Truth: Strictly 100% Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE WHATSOEVER) (Object Truth & Metaphor: Gentle morning steam rising from a healthy breakfast plate and a ceramic tea mug on a minimalist light wood dining table bathed in radiant golden morning sunlight flares) (Geometric Truth: strictly no commercial product packaging, no branded jars or labels shown) (Environment: Sunlit Scandinavian morning dining room) (Lighting: Warm 4500K natural morning sunlight streaming through sheer curtains with delicate lens flare.)",
        t2v_prompt: "",
        i2v_prompt: "Slow cinematic drift over a sun-drenched wooden breakfast table with gentle steam rising into golden morning light rays."
      },
      {
        clip_index: 2,
        product_visible: false,
        requires_product_reference: false,
        visual_action: "Kotak bekal makan siang suami yang sedang dirapikan berdampingan dengan gelas air segar.",
        new_vo: "Pagi hari di dapur selalu penuh kesibukan, tapi menyiapkan perlindungan terbaik untuk suami tetap yang utama.",
        voice_segments: null,
        t2i_prompt: "(Presence Truth: Strictly Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE) (Object & Context Truth: A neat aesthetic bento lunch box prepared with fresh ingredients beside a crystal glass of pure water on a clean wooden kitchen counter) (Geometric Truth: strictly no commercial product packaging, no branded jars or labels shown) (Environment: Bright modern domestic kitchen counter) (Lighting: Soft diffused daylight, crisp natural reflections on glassware and clean wooden textures.)",
        t2v_prompt: "",
        i2v_prompt: "Gentle smooth pan across the neatly packed lunch box and water glass on the bright morning kitchen counter."
      },
      {
        clip_index: 3,
        product_visible: false,
        requires_product_reference: false,
        visual_action: "Sebutir bawang putih tunggal utuh segar bersanding dengan madu mentah di atas talenan kayu artisanal dapur.",
        new_vo: "Aktivitas kerjanya yang padat butuh stamina stabil agar badan tidak cepat lelah dan terasa berat di leher.",
        voice_segments: null,
        t2i_prompt: "(Presence Truth: Strictly Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE) (Object & Context Truth: A single pristine whole raw solo garlic bulb with papery skin resting beside a small ceramic dip bowl filled with pure golden wild honey on an artisanal cutting board) (Geometric Truth: strictly no commercial product packaging, no branded jars or labels shown) (Environment: Rustic modern kitchen food prep area) (Lighting: Warm directional morning light highlighting natural textures of garlic skin and honey viscosity.)",
        t2v_prompt: "",
        i2v_prompt: "Subtle macro dolly movement focusing on the solitary solo garlic bulb and glistening raw honey on the artisanal cutting board."
      },
      {
        clip_index: 4,
        product_visible: false,
        requires_product_reference: false,
        visual_action: "Sendok kayu mengaduk madu keemasan alami yang kental dan berkilau di udara pagi.",
        new_vo: "Cukup satu sentuhan alami saat sarapan untuk bantu menjaga sirkulasi tubuhnya tetap segar sepanjang hari.",
        voice_segments: null,
        t2i_prompt: "(Presence Truth: Strictly Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE) (Object & Context Truth: A carved wooden honey dipper lifting rich golden honey, thick radiant threads dripping slowly into a ceramic bowl in mid-air) (Geometric Truth: strictly no commercial product packaging, no branded jars or labels shown) (Environment: Bright morning kitchen table) (Lighting: Backlit golden morning sun highlighting translucent honey drip amber tones and microscopic air bubbles.)",
        t2v_prompt: "",
        i2v_prompt: "Macro high-speed slow motion of thick golden honey dripping in mesmerizing viscous ribbons from a wooden dipper into the bowl."
      },
      {
        clip_index: 5,
        product_visible: true,
        requires_product_reference: true,
        visual_action: "Tangan POV faceless mengambil satu siung bawang lanang lembut berlumur madu dari jar GarliBee di meja sarapan.",
        new_vo: "GarliBee menyatukan kebaikan bawang lanang dan madu mentah murni yang siap dinikmati satu sendok setiap pagi.",
        voice_segments: null,
        t2i_prompt: "(Biometric Anchor: Faceless, subtle POV hands with minimal charcoal cuffs gently interacting with the authentic GarliBee jar and stainless spoon.) (Wardrobe: Charcoal minimalist cuffs, wrists covered, non-intrusive) (Product Reference File: 'garlibee_clean_official.jpg', geometry_lock: EXACT FILENAME MATCH — high-fidelity visual must match the attached reference photo) (Product Truth: Authentic naturally fermented Solo Garlic aged for over 3 months in raw forest honey inside a squircle transparent glass jar with ribbed silver-metal screw lid and matte-black label) (Action & Craft: Subtle POV hands using a dessert spoon to gently lift a whole soft solo garlic clove immersed in raw amber honey from the open GarliBee jar) (Environment: Sun-drenched breakfast table setting with morning breakfast accents) (Lighting: Warm bright natural morning sunshine, soft commercial rim lighting.)",
        t2v_prompt: "",
        i2v_prompt: "Smooth macro shot of POV hands spooning a soft, dark honey-soaked solo garlic bulb from the GarliBee jar on the morning breakfast table."
      },
      {
        clip_index: 6,
        product_visible: true,
        requires_product_reference: true,
        visual_action: "Jar GarliBee berdiri cantik di samping cangkir sarapan pagi keluarga dengan suasana dapur yang cerah dan rapi.",
        new_vo: "Bekali suami dengan kebaikan alami setiap hari, link pembelian aku taruh di Bio ya!",
        voice_segments: null,
        t2i_prompt: "(Biometric Anchor: Faceless, clean tabletop product commercial.) (Wardrobe: Charcoal minimalist cuffs, wrists covered, non-intrusive) (Product Reference File: 'garlibee_clean_official.jpg', geometry_lock: EXACT FILENAME MATCH — high-fidelity visual must match the attached reference photo) (Product Truth: Squircle transparent glass jar of GarliBee Honey Infused Solo Garlic resting elegantly with ribbed silver-metal screw lid and matte-black label) (Action & Craft: Hero commercial presentation of the GarliBee jar standing beside a warm breakfast cup and linen napkin on a clean oak table) (Environment: Bright airy family breakfast nook) (Lighting: Commercial food advertising lighting, crisp highlights on silver lid and warm golden reflections.)",
        t2v_prompt: "",
        i2v_prompt: "Cinematic push-in hero shot onto the GarliBee jar standing proudly on the sunlit morning breakfast table."
      }
    ]
  },
  2016: {
    // Baris 4: Tema: Rahasia Fermentasi Alami 3 Bulan / The Science of Patience
    clips: [
      {
        clip_index: 1,
        product_visible: false,
        requires_product_reference: false,
        visual_action: "Macro time-lapse siung bawang lanang yang terendam dalam madu hutan murni dengan gelembung mikro fermentasi alami yang berkilau aktif.",
        new_vo: "Bukan sekadar rendaman biasa, ini rahasia fermentasi tiga bulan yang bekerja optimal untuk tubuh.",
        voice_segments: null,
        t2i_prompt: "(Presence Truth: Strictly 100% Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE WHATSOEVER) (Object Truth & Metaphor: Macro close-up of whole solo garlic cloves submerged in pure unheated forest honey, showing active microscopic natural fermentation bubbles rising slowly around the cloves) (Geometric Truth: strictly no commercial product packaging, no branded jars or labels shown) (Environment: Natural dark wooden cellar fermentation shelf) (Lighting: Directional 3200K warm rim light illuminating glowing amber honey viscosity and delicate micro bubbles.)",
        t2v_prompt: "",
        i2v_prompt: "Mesmerizing macro slow motion of tiny natural fermentation bubbles rising gently through rich golden honey enveloping dark submerged solo garlic cloves."
      },
      {
        clip_index: 2,
        product_visible: false,
        requires_product_reference: false,
        visual_action: "Sudut pantry dapur herbal yang estetik dengan jajaran toples fermentasi tradisional berlabel tanggal artisanal.",
        new_vo: "Banyak yang belum tahu, bawang putih tunggal butuh waktu panjang agar senyawa alaminya benar-benar matang.",
        voice_segments: null,
        t2i_prompt: "(Presence Truth: Strictly Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE) (Object & Context Truth: Aesthetic artisanal botanical pantry corner with neatly arranged traditional aging glass vessels labeled with handwritten fermentation dates on kraft paper tags) (Geometric Truth: strictly no commercial product packaging, no branded jars or labels shown) (Environment: Earthy rustic botanical pantry with dried herbs and timber shelves) (Lighting: Soft atmospheric diffused daylight through a high pantry window, warm rustic aesthetic.)",
        t2v_prompt: "",
        i2v_prompt: "Slow cinematic tracking shot across wooden pantry shelves featuring rows of aging artisanal fermentation jars with kraft tags."
      },
      {
        clip_index: 3,
        product_visible: false,
        requires_product_reference: false,
        visual_action: "Pisau keramik membelah siung bawang lanang fermentasi yang berubah kenyal, lembut, dan berwarna gelap karamel berkilau tanpa noda getah.",
        new_vo: "Melalui fermentasi minimal sembilan puluh hari, aroma tajam dan rasa getirnya hilang berganti tekstur lembut manis.",
        voice_segments: null,
        t2i_prompt: "(Presence Truth: Strictly Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE) (Object & Context Truth: A sleek dark ceramic knife cleanly slicing a 90-day fermented solo garlic bulb into halves, revealing a tender chewy dark caramel-amber interior without acrid sap) (Geometric Truth: strictly no commercial product packaging, no branded jars or labels shown) (Environment: Dark slate food preparation board) (Lighting: High-contrast food cinematography spotlighting the glistening translucent jelly-like core of the fermented garlic.)",
        t2v_prompt: "",
        i2v_prompt: "Macro slow motion of the ceramic blade gliding effortlessly through the soft caramel-textured fermented solo garlic bulb."
      },
      {
        clip_index: 4,
        product_visible: false,
        requires_product_reference: false,
        visual_action: "Sendok kayu mengangkat bawang hitam lembut berbalut madu kental dengan tekstur saus karamel alami.",
        new_vo: "Proses sabar inilah yang membuatnya sangat ramah di lambung dan mudah diserap tubuh setiap hari.",
        voice_segments: null,
        t2i_prompt: "(Presence Truth: Strictly Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE) (Object & Context Truth: Hand-carved olive wood spoon lifting a glistening soft black fermented solo garlic clove enrobed in a rich dark honey caramel reduction) (Geometric Truth: strictly no commercial product packaging, no branded jars or labels shown) (Environment: Natural artisanal kitchen setting) (Lighting: Warm focused key light highlighting rich glossy sauce textures and deep balsamic amber hues.)",
        t2v_prompt: "",
        i2v_prompt: "Macro slow motion capturing the rich caramel honey sauce slowly dripping off the tender fermented solo garlic clove on the wooden spoon."
      },
      {
        clip_index: 5,
        product_visible: true,
        requires_product_reference: true,
        visual_action: "Sendok elegan mengambil satu siung utuh dari jar GarliBee dengan latar pantry botani yang bersih.",
        new_vo: "GarliBee menghadirkan mahakarya fermentasi alami ini dalam satu jar praktis tanpa repot meracik sendiri.",
        voice_segments: null,
        t2i_prompt: "(Biometric Anchor: Faceless, subtle POV hands with minimal charcoal cuffs gently interacting with the authentic GarliBee jar and stainless spoon.) (Wardrobe: Charcoal minimalist cuffs, wrists covered, non-intrusive) (Product Reference File: 'garlibee_clean_official.jpg', geometry_lock: EXACT FILENAME MATCH — high-fidelity visual must match the attached reference photo) (Product Truth: Authentic naturally fermented Solo Garlic aged for over 3 months in raw forest honey inside a squircle transparent glass jar with ribbed silver-metal screw lid and matte-black label) (Action & Craft: Subtle hands lifting a glossy fermented garlic clove from the GarliBee jar with an elegant spoon against a botanical background) (Environment: Clean aesthetic apothecary pantry) (Lighting: Warm balanced commercial lighting, glistening highlights on honey surface.)",
        t2v_prompt: "",
        i2v_prompt: "Delicate macro pull-up shot of the spoon lifting the fermented garlic bulb from the authentic GarliBee jar."
      },
      {
        clip_index: 6,
        product_visible: true,
        requires_product_reference: true,
        visual_action: "Jar GarliBee dengan tutup silver berulir berdiri di atas meja kayu pantry di bawah pencahayaan natural yang hangat.",
        new_vo: "Rasakan bedanya fermentasi alami tiga bulan, link pembelian aku taruh di Bio ya!",
        voice_segments: null,
        t2i_prompt: "(Biometric Anchor: Faceless, clean tabletop product commercial.) (Wardrobe: Charcoal minimalist cuffs, wrists covered, non-intrusive) (Product Reference File: 'garlibee_clean_official.jpg', geometry_lock: EXACT FILENAME MATCH — high-fidelity visual must match the attached reference photo) (Product Truth: Squircle transparent glass jar of GarliBee Honey Infused Solo Garlic resting elegantly with ribbed silver-metal screw lid and matte-black label) (Action & Craft: Hero commercial shot of the GarliBee jar standing prominently on a polished timber shelf flanked by natural honeycombs and dried herbs) (Environment: High-end wellness pantry background) (Lighting: Premium commercial softbox studio lighting, crisp metallic rim on silver lid.)",
        t2v_prompt: "",
        i2v_prompt: "Slow elegant orbit around the GarliBee jar resting on the wooden pantry shelf under warm inviting light."
      }
    ]
  },
  2017: {
    // Baris 5: Tema: Komitmen Menu Akhir Pekan Keluarga
    clips: [
      {
        clip_index: 1,
        product_visible: false,
        requires_product_reference: false,
        visual_action: "Dua cangkir teh herbal beruap tipis di atas meja makan kayu jati ruang keluarga saat suasana santai akhir pekan.",
        new_vo: "Nikmati akhir pekan bersama keluarga tanpa rasa cemas, mulailah langkah penjagaan sejak dini.",
        voice_segments: null,
        t2i_prompt: "(Presence Truth: Strictly 100% Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE WHATSOEVER) (Object Truth & Metaphor: Two elegant ceramic cups of steaming herbal tea resting on a warm solid teak dining table in a cozy sunlit family living room) (Geometric Truth: strictly no commercial product packaging, no branded jars or labels shown) (Environment: Relaxing family dining room with warm weekend atmosphere) (Lighting: Soft golden afternoon sunlight cascading across the wooden table with gentle tea steam wisps.)",
        t2v_prompt: "",
        i2v_prompt: "Slow cinematic glide between two warm cups of herbal tea with steam softly dancing in the weekend sunlight."
      },
      {
        clip_index: 2,
        product_visible: false,
        requires_product_reference: false,
        visual_action: "Keranjang anyaman berisi buah-buahan segar, kacang-kacangan, dan sajian sehat keluarga yang tertata menggugah selera.",
        new_vo: "Momen kumpul keluarga terasa makin hangat saat kita sadar pentingnya menyajikan asupan yang lebih sehat.",
        voice_segments: null,
        t2i_prompt: "(Presence Truth: Strictly Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE) (Object & Context Truth: A woven rattan basket filled with crisp apples, grapes, walnuts, and wholesome family snacks arranged artfully on a linen table runner) (Geometric Truth: strictly no commercial product packaging, no branded jars or labels shown) (Environment: Warm cozy family dining room) (Lighting: Warm ambient lighting, rich appetizing natural fruit colors.)",
        t2v_prompt: "",
        i2v_prompt: "Smooth panoramic movement capturing the rich assortment of fresh fruits and wholesome nuts on the family table."
      },
      {
        clip_index: 3,
        product_visible: false,
        requires_product_reference: false,
        visual_action: "Buku agenda resep sehat terbuka di samping piring saji keramik dan tanaman hijau hias di sudut ruang makan.",
        new_vo: "Menjaga tubuh dari ancaman kolesterol tinggi bukan berarti harus makan serba hambar atau menyiksa diri.",
        voice_segments: null,
        t2i_prompt: "(Presence Truth: Strictly Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE) (Object & Context Truth: An open hardcover healthy recipe journal with handwritten wellness notes resting beside an empty artisan ceramic serving plate and a potted indoor plant) (Geometric Truth: strictly no commercial product packaging, no branded jars or labels shown) (Environment: Sun-drenched family dining nook) (Lighting: Soft natural daylight from wide windows, crisp paper textures and warm ceramics.)",
        t2v_prompt: "",
        i2v_prompt: "Gentle tilt shot revealing the open recipe journal and decorative ceramic tableware in the quiet dining area."
      },
      {
        clip_index: 4,
        product_visible: false,
        requires_product_reference: false,
        visual_action: "Tetesan madu keemasan jatuh perlahan di atas potongan buah segar di atas piring porselen kecil.",
        new_vo: "Sentuhan bahan alami berkualitas membantu menjaga kebugaran tubuh tanpa mengurangi kenikmatan momen bersama.",
        voice_segments: null,
        t2i_prompt: "(Presence Truth: Strictly Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE) (Object & Context Truth: Viscous droplets of pure golden honey falling in slow motion onto freshly sliced crisp apples on a delicate white porcelain plate) (Geometric Truth: strictly no commercial product packaging, no branded jars or labels shown) (Environment: Family dining table setting) (Lighting: Radiant directional backlighting capturing glistening honey threads and fresh fruit moisture.)",
        t2v_prompt: "",
        i2v_prompt: "Ultra-detailed macro slow motion of golden raw honey drizzling smoothly over crisp fruit slices on porcelain."
      },
      {
        clip_index: 5,
        product_visible: true,
        requires_product_reference: true,
        visual_action: "Jar GarliBee dibuka anggun di tengah meja makan keluarga, memperlihatkan butiran bawang lanang terendam madu murni.",
        new_vo: "GarliBee hadir sebagai pelengkap gaya hidup sehat keluarga, perpaduan manis madu dan bawang lanang pilihan.",
        voice_segments: null,
        t2i_prompt: "(Biometric Anchor: Faceless, subtle POV hands with minimal charcoal cuffs gently interacting with the authentic GarliBee jar and stainless spoon.) (Wardrobe: Charcoal minimalist cuffs, wrists covered, non-intrusive) (Product Reference File: 'garlibee_clean_official.jpg', geometry_lock: EXACT FILENAME MATCH — high-fidelity visual must match the attached reference photo) (Product Truth: Authentic naturally fermented Solo Garlic aged for over 3 months in raw forest honey inside a squircle transparent glass jar with ribbed silver-metal screw lid and matte-black label) (Action & Craft: Subtle hands holding the open GarliBee jar at the center of the family dining table, showcasing glossy solo garlic cloves submerged in clear raw honey) (Environment: Warm inviting family weekend dining atmosphere) (Lighting: Warm golden dining room lighting, appetizing glow on the honey-infused garlic.)",
        t2v_prompt: "",
        i2v_prompt: "Gentle camera push into the open GarliBee jar held gently at the heart of the family dining table."
      },
      {
        clip_index: 6,
        product_visible: true,
        requires_product_reference: true,
        visual_action: "Jar GarliBee bersanding harmonis dengan cangkir teh dan keranjang buah di meja makan keluarga yang terang dan nyaman.",
        new_vo: "Mulai kebiasaan sehat keluargamu akhir pekan ini, link pembelian aku taruh di Bio ya!",
        voice_segments: null,
        t2i_prompt: "(Biometric Anchor: Faceless, clean tabletop product commercial.) (Wardrobe: Charcoal minimalist cuffs, wrists covered, non-intrusive) (Product Reference File: 'garlibee_clean_official.jpg', geometry_lock: EXACT FILENAME MATCH — high-fidelity visual must match the attached reference photo) (Product Truth: Squircle transparent glass jar of GarliBee Honey Infused Solo Garlic resting elegantly with ribbed silver-metal screw lid and matte-black label) (Action & Craft: Commercial lifestyle hero composition with the GarliBee jar standing harmoniously alongside a ceramic tea cup and woven fruit basket) (Environment: Bright cozy family dining room) (Lighting: Professional warm commercial lighting, sparkling glass highlights and soft shadow falloff.)",
        t2v_prompt: "",
        i2v_prompt: "Cinematic pull-back wide hero shot of the GarliBee jar centered on the beautiful family weekend table."
      }
    ]
  },
  2018: {
    // Baris 6: Tema: Solusi Praktis Meja Kerja (Orang Sibuk)
    clips: [
      {
        clip_index: 1,
        product_visible: false,
        requires_product_reference: false,
        visual_action: "Sudut meja kerja modern yang bersih dan estetik (laptop ramping, buku agenda, tanaman mini sukulen, dan mug keramik).",
        new_vo: "Sibuk seharian tapi tetap ingin jaga kolesterol? Cukup satu siung dan satu sendok tiap hari.",
        voice_segments: null,
        t2i_prompt: "(Presence Truth: Strictly 100% Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE WHATSOEVER) (Object Truth & Metaphor: Aesthetic modern work desk corner with a sleek slim aluminum laptop, leather notebook planner, miniature potted succulent, and a modern ceramic mug) (Geometric Truth: strictly no commercial product packaging, no branded jars or labels shown) (Environment: Clean contemporary home office workspace) (Lighting: Soft balanced natural daylight from an adjacent window, crisp minimalist office aesthetics.)",
        t2v_prompt: "",
        i2v_prompt: "Slow cinematic glide across the clean contemporary workspace revealing laptop, planner, and ceramic coffee mug."
      },
      {
        clip_index: 2,
        product_visible: false,
        requires_product_reference: false,
        visual_action: "Jam meja minimalis menunjukkan jam istirahat siang, layar laptop tertutup sejenak untuk relaksasi.",
        new_vo: "Duduk berjam-jam di depan laptop sering kali bikin kita lupa merawat sirkulasi tubuh dan pola makan.",
        voice_segments: null,
        t2i_prompt: "(Presence Truth: Strictly Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE) (Object & Context Truth: Minimalist wooden desk clock indicating midday break sitting next to a closed modern laptop and a small water glass) (Geometric Truth: strictly no commercial product packaging, no branded jars or labels shown) (Environment: Peaceful executive desk space during midday pause) (Lighting: Soft ambient daylight, gentle reflections on metallic and glass surfaces.)",
        t2v_prompt: "",
        i2v_prompt: "Smooth focus pull from the wooden desk clock ticking at midday break to the closed laptop on the modern desk."
      },
      {
        clip_index: 3,
        product_visible: false,
        requires_product_reference: false,
        visual_action: "Piring tatakan keramik kecil berisi 1 siung bawang lanang lembut berlumur madu diletakkan di samping buku catatan kerja.",
        new_vo: "Padahal di tengah padatnya pekerjaan, tubuh butuh perlindungan praktis yang tidak menyita waktu berharga.",
        voice_segments: null,
        t2i_prompt: "(Presence Truth: Strictly Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE) (Object & Context Truth: Small matte-black ceramic saucer holding a single tender honey-glazed fermented solo garlic clove resting beside an open workday planner) (Geometric Truth: strictly no commercial product packaging, no branded jars or labels shown) (Environment: Professional modern office desk) (Lighting: Directional task lamp glow casting warm focused illumination onto the glistening caramel garlic clove.)",
        t2v_prompt: "",
        i2v_prompt: "Macro slow tilt up from the open work planner to the single honey-glazed solo garlic bulb on the ceramic saucer."
      },
      {
        clip_index: 4,
        product_visible: false,
        requires_product_reference: false,
        visual_action: "Satu suapan praktis menggunakan sendok kecil stainless steel tanpa meninggalkan remah atau bau menyengat di ruang kerja.",
        new_vo: "Tanpa perlu mengupas bawang atau merebus ramuan rumit, solusi alami ini siap dinikmati kapan saja di meja kerjamu.",
        voice_segments: null,
        t2i_prompt: "(Presence Truth: Strictly Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE) (Object & Context Truth: Polished stainless steel teaspoon resting gracefully on a ceramic coaster with a golden honey droplet, completely clean with zero mess or crumbs) (Geometric Truth: strictly no commercial product packaging, no branded jars or labels shown) (Environment: Clean clutter-free executive workspace) (Lighting: Crisp studio daylight, bright reflections on polished steel and ceramic glaze.)",
        t2v_prompt: "",
        i2v_prompt: "Close-up slow dolly move around the pristine polished stainless spoon resting cleanly on the desk coaster."
      },
      {
        clip_index: 5,
        product_visible: true,
        requires_product_reference: true,
        visual_action: "Jar GarliBee berukuran 300 gram diletakkan rapi di sudut meja kerja di samping mug keramik.",
        new_vo: "Cukup satu jar GarliBee di sudut meja, perpaduan bawang lanang dan madu mentah siap melengkapi harimu.",
        voice_segments: null,
        t2i_prompt: "(Biometric Anchor: Faceless, subtle POV hands with minimal charcoal cuffs gently interacting with the authentic GarliBee jar and stainless spoon.) (Wardrobe: Charcoal minimalist cuffs, wrists covered, non-intrusive) (Product Reference File: 'garlibee_clean_official.jpg', geometry_lock: EXACT FILENAME MATCH — high-fidelity visual must match the attached reference photo) (Product Truth: Authentic naturally fermented Solo Garlic aged for over 3 months in raw forest honey inside a squircle transparent glass jar with ribbed silver-metal screw lid and matte-black label) (Action & Craft: Subtle POV hands setting the pristine GarliBee jar neatly on the modern desk beside a ceramic mug and laptop) (Environment: Clean professional home office workstation) (Lighting: Balanced modern workspace lighting, crisp rim reflection on jar bevels.)",
        t2v_prompt: "",
        i2v_prompt: "Subtle macro dolly as hands gently position the GarliBee jar on the clean modern desk."
      },
      {
        clip_index: 6,
        product_visible: true,
        requires_product_reference: true,
        visual_action: "Jar GarliBee dengan pantulan cahaya jendela kantor/rumah modern yang elegan dan tertata rapi.",
        new_vo: "Bebas repot jaga kebugaran saat sibuk bekerja, link pembelian aku taruh di Bio ya!",
        voice_segments: null,
        t2i_prompt: "(Biometric Anchor: Faceless, clean tabletop product commercial.) (Wardrobe: Charcoal minimalist cuffs, wrists covered, non-intrusive) (Product Reference File: 'garlibee_clean_official.jpg', geometry_lock: EXACT FILENAME MATCH — high-fidelity visual must match the attached reference photo) (Product Truth: Squircle transparent glass jar of GarliBee Honey Infused Solo Garlic resting elegantly with ribbed silver-metal screw lid and matte-black label) (Action & Craft: Hero product shot of the GarliBee jar catching natural window light on an executive wooden desk with laptop in soft focus background) (Environment: Premium modern home office setup) (Lighting: Commercial advertising cinematography, soft natural window key light with warm ambient fill.)",
        t2v_prompt: "",
        i2v_prompt: "Cinematic push-in reveal of the GarliBee jar on the executive desk with soft bokeh of the laptop in the background."
      }
    ]
  }
};

async function main() {
  const pool = getPgPool();
  console.log(`Connecting to Staging DB to update campaign ${CAMPAIGN_ID}...`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const [itemIdStr, updateData] of Object.entries(ROW_UPDATES)) {
      const itemId = parseInt(itemIdStr, 10);
      console.log(`\nProcessing Item ID: ${itemId}...`);

      const res = await client.query('SELECT id, campaign_id, new_video_plan_json, result_json FROM staging.pillar_campaign_items WHERE id = $1', [itemId]);
      if (res.rows.length === 0) {
        throw new Error(`Item ${itemId} not found in staging.pillar_campaign_items`);
      }

      const row = res.rows[0];
      let planObj = typeof row.new_video_plan_json === 'string' ? JSON.parse(row.new_video_plan_json) : (row.new_video_plan_json || []);
      let resultObj = typeof row.result_json === 'string' ? JSON.parse(row.result_json) : (row.result_json || {});

      // Synchronize video plan clips
      const updatedPlan = updateData.clips.map((newClip, idx) => {
        const existing = planObj[idx] || {};
        return {
          ...existing,
          clip_index: newClip.clip_index,
          product_visible: newClip.product_visible,
          requires_product_reference: newClip.requires_product_reference,
          visual_action: newClip.visual_action,
          new_vo: newClip.new_vo,
          voice_segments: newClip.voice_segments,
          t2i_prompt: newClip.t2i_prompt,
          t2v_prompt: newClip.t2v_prompt,
          i2v_prompt: newClip.i2v_prompt
        };
      });

      // Synchronize resultObj.storyboard
      const storyboard = resultObj.storyboard || [];
      const updatedStoryboard = updateData.clips.map((newClip, idx) => {
        const existingScene = storyboard[idx] || {};
        return {
          ...existingScene,
          clip_number: newClip.clip_index,
          voiceover: newClip.new_vo,
          visual_description: newClip.visual_action,
          visual_prompt: newClip.t2i_prompt,
          t2i_prompt: newClip.t2i_prompt,
          i2v_prompt: newClip.i2v_prompt,
          product_visible: newClip.product_visible,
          requires_product_reference: newClip.requires_product_reference
        };
      });

      // Synchronize resultObj.t2i_prompts
      const updatedT2iPrompts = updateData.clips.map(c => ({
        clip: c.clip_index,
        prompt: c.t2i_prompt
      }));

      resultObj.storyboard = updatedStoryboard;
      resultObj.t2i_prompts = updatedT2iPrompts;

      await client.query(
        'UPDATE staging.pillar_campaign_items SET new_video_plan_json = $1, result_json = $2 WHERE id = $3',
        [JSON.stringify(updatedPlan), JSON.stringify(resultObj), itemId]
      );

      console.log(`✓ Item ${itemId} successfully updated in Staging DB.`);
    }

    await client.query('COMMIT');
    console.log('\n✅ All targeted campaign rows (2013, 2015, 2016, 2017, 2018) successfully updated in Staging DB!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error updating items:', err);
    throw err;
  } finally {
    client.release();
    await closePgPool();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

