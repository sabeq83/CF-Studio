/**
 * lib/metaphor-policy.js
 * Single-source-of-truth resolver untuk Metaphor Policy (F2) + helper tuple & prompt section.
 * Mode default (tanpa policy atau semua switch off) mengembalikan string legacy secara identik byte-per-byte.
 */

export const LEGACY_PRESENCE_TRUTH_TUPLE =
  '(Presence Truth: Strictly 100% Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE)';

export const MODEST_HANDS_PRESENCE_TRUTH_TUPLE =
  '(Presence Truth: Modest female hands only, one person cropped below collarbone, exactly two hands visible, long opaque sleeves covering forearms with fitted wrist cuffs clearly visible around both wrists)';

export const POSITIVE_CLIP1_OBJECT_PRESENCE_TUPLE =
  '(Presence Truth: unattended standalone still-life objects only, close macro framing focused purely on physical objects, nobody in scene, empty foreground around subject)';

export const POSITIVE_CLEAN_SCENE_CONTEXT_TUPLE =
  '(Scene Context: everyday unbranded household demonstration items on an uncluttered tabletop, plain unlabelled vessels only)';

export const MODEST_WARDROBE_ROTATION = [
  {
    key: 'sage',
    label: 'Sage Green Linen',
    description: 'solid plain muted sage green opaque linen long-sleeve tunic completely covering forearms with fitted wrist cuffs visible at wrists, single uniform solid color, plain unprinted smooth fabric, no pattern, no print, no stripes, no embroidery'
  },
  {
    key: 'navy',
    label: 'Deep Navy Cotton',
    description: 'solid plain deep navy matte cotton long-sleeve tunic completely covering forearms with fitted wrist cuffs visible at wrists, single uniform solid color, plain unprinted smooth fabric, no pattern, no print, no stripes, no embroidery'
  },
  {
    key: 'light_grey',
    label: 'Soft Dove Grey Linen',
    description: 'solid plain soft dove-grey breathable linen long-sleeve tunic completely covering forearms with fitted wrist cuffs visible at wrists, single uniform solid color, plain unprinted smooth fabric, no pattern, no print, no stripes, no embroidery'
  },
  {
    key: 'ivory',
    label: 'Warm Ivory Crepe',
    description: 'solid plain warm ivory matte opaque crepe long-sleeve tunic completely covering forearms with fitted wrist cuffs visible at wrists, single uniform solid color, plain unprinted smooth fabric, no pattern, no print, no stripes, no embroidery'
  },
  {
    key: 'muted_maroon',
    label: 'Muted Maroon Cotton',
    description: 'solid plain muted burgundy-maroon cotton long-sleeve tunic completely covering forearms with fitted wrist cuffs visible at wrists, single uniform solid color, plain unprinted smooth fabric, no pattern, no print, no stripes, no embroidery'
  },
  {
    key: 'soft_mocca',
    label: 'Soft Mocca Taupe Linen',
    description: 'solid plain soft mocca-taupe linen long-sleeve tunic completely covering forearms with fitted wrist cuffs visible at wrists, single uniform solid color, plain unprinted smooth fabric, no pattern, no print, no stripes, no embroidery'
  }
];

export const METAPHOR_CAMERA_ANGLES = [
  {
    key: 'overhead_top_down',
    label: 'Overhead Top-Down (90 deg)',
    prompt: '90-degree overhead flat-lay top-down macro angle'
  },
  {
    key: 'eye_level_side',
    label: 'Tabletop Side Profile Chest-Down (0 deg)',
    prompt: '0-degree tabletop side cross-section close-up framed strictly chest-down focused on hands and tabletop objects with upper frame edge below shoulders, neck and head out of frame'
  },
  {
    key: 'macro_diagonal',
    label: 'Macro Diagonal (35 deg)',
    prompt: '35-degree macro diagonal three-quarter close-up'
  },
  {
    key: 'three_quarter_front',
    label: 'Tabletop Three-Quarter Front Chest-Down (45 deg)',
    prompt: '45-degree clean tabletop three-quarter front close-up framed strictly chest-down centered on foreground hands and tabletop objects with upper frame edge below shoulders, no head or neck in frame'
  }
];

export function resolveVideoVariety(seedKey = '', options = {}) {
  const raw = String(seedKey || 'default');
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const positive = hash >>> 0;
  const customPool = Array.isArray(options?.paletteEntries) && options.paletteEntries.length > 0
    ? options.paletteEntries.map((entry, idx) => {
        if (typeof entry === 'string') {
          const slug = entry.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `color_${idx}`;
          const sleevePhrase = options?.sleevePolicy === 'forearms_exposed'
            ? 'clean casual long-sleeve or neatly rolled-to-elbow shirt'
            : 'loose opaque modest long-sleeve garment completely covering forearms with fitted cuffs visible at wrists';
          return {
            key: slug,
            label: entry,
            description: `solid plain ${entry.toLowerCase()} ${sleevePhrase}, single uniform solid color, plain unprinted smooth fabric, no pattern, no print, no stripes, no embroidery`
          };
        }
        return entry;
      }).filter(Boolean)
    : MODEST_WARDROBE_ROTATION;
  const wardrobePool = customPool.length > 0 ? customPool : MODEST_WARDROBE_ROTATION;
  const wardrobeChoice = wardrobePool[positive % wardrobePool.length];
  const cameraChoice = METAPHOR_CAMERA_ANGLES[Math.floor(positive / wardrobePool.length) % METAPHOR_CAMERA_ANGLES.length];
  return {
    wardrobeColorKey: wardrobeChoice.key,
    wardrobeColorLabel: wardrobeChoice.label,
    wardrobeDesc: wardrobeChoice.description,
    cameraAngleKey: cameraChoice.key,
    cameraAngleLabel: cameraChoice.label,
    cameraAnglePrompt: cameraChoice.prompt
  };
}

const HANDS_COMPATIBLE_FACELESS_MODES = new Set([
  'hands_only',
  'first_person_pov',
  'crop_below_neck',
]);

/**
 * Resolve policy metafora per item dari Visual Identity, mode kampanye, dan Metaphor World Kit.
 */
export function resolveMetaphorPolicy({
  viConfig = null,
  isMetaphoricFaceless = false,
  isInvestigativeFaceless = false,
  kit = null,
} = {}) {
  const reasons = [];

  if (!isMetaphoricFaceless || isInvestigativeFaceless) {
    reasons.push(isInvestigativeFaceless ? 'investigative_faceless_locked' : 'not_metaphoric_faceless');
    return {
      active: false,
      environmentPolicy: 'brand_locked',
      handsPolicy: 'zero_hands',
      productEntry: 'after_bridge',
      lightingArc: null,
      sceneEnvironment: null,
      objectWorld: null,
      handVariant: null,
      reasons,
    };
  }

  const structured = viConfig?.structured || viConfig || {};
  const envPolicyReq = structured.environment?.policy || 'brand_locked';
  const metaphorEngine = structured.metaphor_engine || {};
  const handsReq = metaphorEngine.hands_policy || 'zero_hands';
  const productEntryReq = metaphorEngine.product_entry || 'after_bridge';
  const lightingArcReq = metaphorEngine.lighting_arc || 'none';

  // Validasi subjek untuk hands_policy
  let handsPolicy = handsReq === 'modest_hands_active' ? 'modest_hands_active' : 'zero_hands';
  if (handsPolicy === 'modest_hands_active' && structured.subject) {
    const kind = structured.subject.kind || 'human';
    const facelessMode = structured.subject.faceless_mode || 'hands_only';
    if (kind !== 'human' || !HANDS_COMPATIBLE_FACELESS_MODES.has(facelessMode)) {
      handsPolicy = 'zero_hands';
      reasons.push(`hands_forced_zero_by_subject:${kind}/${facelessMode}`);
    }
  }
  if (handsPolicy === 'modest_hands_active') {
    reasons.push('hands:modest_hands_active');
  } else {
    reasons.push('hands:zero_hands');
  }

  // Fail-safe tanpa kit: environmentPolicy, productEntry, dan lightingArc kembali ke default lama
  let environmentPolicy = 'brand_locked';
  if (envPolicyReq === 'metaphor_driven') {
    if (kit?.environment) {
      environmentPolicy = 'metaphor_driven';
      reasons.push('environment:metaphor_driven');
    } else {
      reasons.push('fallback_no_kit:environment_brand_locked');
    }
  } else {
    reasons.push('environment:brand_locked');
  }

  let productEntry = 'after_bridge';
  if (productEntryReq === 'inside_metaphor') {
    if (kit) {
      productEntry = 'inside_metaphor';
      reasons.push('product_entry:inside_metaphor');
    } else {
      reasons.push('fallback_no_kit:product_entry_after_bridge');
    }
  } else {
    reasons.push('product_entry:after_bridge');
  }

  let lightingArc = null;
  if (lightingArcReq === 'kit') {
    if (kit?.lighting_arc?.from && kit?.lighting_arc?.to) {
      lightingArc = { from: kit.lighting_arc.from, to: kit.lighting_arc.to };
      reasons.push('lighting_arc:kit');
    } else {
      reasons.push('fallback_no_kit:lighting_arc_none');
    }
  } else {
    reasons.push('lighting_arc:none');
  }

  const compactPrompts = Boolean(metaphorEngine.compact_prompts);

  return {
    active: true,
    environmentPolicy,
    handsPolicy,
    productEntry,
    lightingArc,
    compactPrompts,
    sceneEnvironment: kit?.environment || null,
    objectWorld: kit?.object_world || null,
    handVariant: kit?.hand_variant || null,
    reasons,
  };
}

/**
 * Mengembalikan tuple Presence Truth yang tepat.
 * Pada mode default (tanpa override), mengembalikan string legacy persis byte-per-byte.
 * Pada mode override aktif (F2.1), memakai positive framing agar T2I tidak terpancing kata negasi.
 */
export function presenceTruthTuple(policy, zone = 'pre', opts = {}) {
  const hasOverride = opts?.hasOverride !== undefined ? opts.hasOverride : hasAnyMetaphorPolicyOverride(policy);
  if (!hasOverride) {
    if (policy?.active && policy.handsPolicy === 'modest_hands_active' && zone !== 'clip1' && zone !== 'hook') {
      return MODEST_HANDS_PRESENCE_TRUTH_TUPLE;
    }
    return LEGACY_PRESENCE_TRUTH_TUPLE;
  }

  if (zone === 'clip1' || zone === 'hook') {
    return POSITIVE_CLIP1_OBJECT_PRESENCE_TUPLE;
  }
  if (policy?.active && policy.handsPolicy === 'modest_hands_active') {
    const variety = opts?.variety || null;
    if (variety?.wardrobeDesc) {
      return `(Presence Truth: Modest female hands only, one person framed strictly chest-down cropped below shoulders, exactly two hands visible performing one gentle action, dressed in ${variety.wardrobeDesc})`;
    }
    return MODEST_HANDS_PRESENCE_TRUTH_TUPLE;
  }
  return POSITIVE_CLIP1_OBJECT_PRESENCE_TUPLE;
}

export function cleanSceneTuple(policy) {
  if (hasAnyMetaphorPolicyOverride(policy)) {
    return POSITIVE_CLEAN_SCENE_CONTEXT_TUPLE;
  }
  return '(Geometric Truth: strictly no product shown, strictly no bottle, jar, or packaging)';
}

export function environmentTuple(policy, fallback = '') {
  if (policy?.active && policy.environmentPolicy === 'metaphor_driven' && policy.sceneEnvironment) {
    return policy.sceneEnvironment;
  }
  return fallback;
}

/**
 * Mengembalikan instruksi lighting untuk klip tertentu berdasarkan lightingArc kit.
 * Pre-bridge = arc.from; klip produk tengah = transisi from -> to; klip terakhir / gap / post = arc.to.
 */
export function lightingTupleForClip(policy, clipIndex, bridgePlan = null) {
  if (!policy?.active || !policy.lightingArc) return null;
  const { from, to } = policy.lightingArc;
  const c = Number(clipIndex);
  if (!Number.isFinite(c) || c < 1) return from;

  const totalClips = Number(bridgePlan?.totalClips || 0);
  if (bridgePlan && typeof bridgePlan.zoneOf === 'function') {
    const zone = bridgePlan.zoneOf(c);
    if (zone === 'pre') return from;
    if (typeof bridgePlan.isProductClip === 'function' && bridgePlan.isProductClip(c)) {
      if (totalClips > 0 && c >= totalClips) return to;
      return `smooth transition from ${from} toward ${to}`;
    }
    return to;
  }

  const bridgeAt = Number(bridgePlan?.bridgeAtClip || bridgePlan?.bridgeStart || 2);
  if (c < bridgeAt) return from;
  if (totalClips > 0 && c >= totalClips) return to;
  return `smooth transition from ${from} toward ${to}`;
}

export function hasAnyMetaphorPolicyOverride(policy) {
  if (!policy?.active) return false;
  return (
    policy.handsPolicy === 'modest_hands_active' ||
    policy.environmentPolicy === 'metaphor_driven' ||
    policy.productEntry === 'inside_metaphor' ||
    Boolean(policy.lightingArc)
  );
}

/**
 * Membangun tuple notice untuk mode metafora aktif (pengganti tupleMetaphorNotice saat policy aktif).
 */
export function buildMetaphorWorldTupleNotice({
  policy,
  maxPreBridgeClip,
  bridgeAtClip,
  targetClips,
  targetAnchorText,
  targetWardrobeText,
  targetLightingText,
  opcRefFilenameTag,
  pillarRangeLabel,
  hasMultiSegmentPillarBridge,
  nonProductMultiSpanText,
  kit = null,
}) {
  const handsActive = policy?.handsPolicy === 'modest_hands_active';
  const envDriven = policy?.environmentPolicy === 'metaphor_driven' && Boolean(policy?.sceneEnvironment);
  const insideMetaphor = policy?.productEntry === 'inside_metaphor';
  const arc = policy?.lightingArc || null;

  const envLine = envDriven
    ? `${policy.sceneEnvironment} — WAJIB SAMA di seluruh klip VIDEO INI`
    : `[Latar ruangan nyata yang estetik dan hangat sesuai W'S Matrix baris ini — BUKAN void laboratorium monoton]`;
  const preLight = arc ? arc.from : (targetLightingText || 'dramatic chiaroscuro with warm golden rim light or soft natural ambient');
  const productLight = arc ? `transisi ${arc.from} ➔ ${arc.to}` : (targetLightingText || 'soft natural light');
  const finalLight = arc ? arc.to : (targetLightingText || 'soft natural light');

  const handActionHint = policy?.handVariant?.struggle || 'tangan syar\'i berakting sesuai beat adegan metafora';
  const worldLabel = policy?.objectWorld || 'Dunia Benda Metafora';

  const presenceLine = handsActive
    ? `  1. Klip 1 (Hook Object-Only): ${POSITIVE_CLIP1_OBJECT_PRESENCE_TUPLE}\n  1b. Klip 2 s/d ${maxPreBridgeClip}: ${presenceTruthTuple(policy, 'pre', { hasOverride: true })}, (Wardrobe: ${targetWardrobeText})`
    : `  1. ${POSITIVE_CLIP1_OBJECT_PRESENCE_TUPLE}`;

  const preZoneHeader = handsActive
    ? `🚨 KHUSUS KLIP 1 s/d ${maxPreBridgeClip} (METAFORA DUNIA BENDA — "${worldLabel}"):
- Klip 1: tetap object-only hook (benda fisik murni tanpa manusia/tangan, deskripsikan secara POSITIF sebagai benda berdiri sendiri yang tidak disentuh).
${maxPreBridgeClip >= 2 ? `- Klip 2 s/d ${maxPreBridgeClip}: satu orang saja (cropped di bawah bahu, tepat dua tangan, lengan panjang menutup pergelangan dengan manset terlihat jelas, ${targetWardrobeText}) berakting pada benda metafora: ${handActionHint}.\n` : ''}- ATURAN POSITIVE FRAMING (WAJIB): Dalam t2i_prompt dan i2v_prompt, deskripsikan apa yang HARUS tampil secara positif. DILARANG menulis kata negasi seperti "no bottle", "no jar", "ZERO HANDS", "no bare arms", "no face", atau "strictly no packaging".`
    : `🚨 KHUSUS KLIP 1 s/d ${maxPreBridgeClip} (METAFORA DUNIA BENDA — "${worldLabel}"):
- Klip 1 s/d ${maxPreBridgeClip} wajib berfokus pada objek fisik murni tanpa manusia; gunakan deskripsi POSITIF (${POSITIVE_CLIP1_OBJECT_PRESENCE_TUPLE}).
- DILARANG menulis kata negasi ("ZERO HANDS", "NO ARMS", "no bottle", "no jar") di dalam t2i_prompt/i2v_prompt agar generator gambar tidak salah menggambar kata benda terlarang.`;

  const reactionHint = kit?.beats?.reaction || 'zat/isi produk bekerja langsung membersihkan objek metafora';
  const resultHint = kit?.beats?.result || 'benda metafora dalam kondisi bersih & jernih';

  return `
${preZoneHeader}
- Produk komersial belum muncul pada Klip 1 s/d ${maxPreBridgeClip} — gambarkan permukaan meja/wadah rumah tangga polos tanpa merek (${POSITIVE_CLEAN_SCENE_CONTEXT_TUPLE}).
- Susunan tuple wajib Klip 1 s/d ${maxPreBridgeClip}:
${presenceLine}
  2. (Object Truth & Context: [Deskripsi objek dunia metafora "${worldLabel}" sesuai beat — maks 1 aksi & <=3 objek utama])
  3. ${POSITIVE_CLEAN_SCENE_CONTEXT_TUPLE}
  4. (Physical Kinetics: [Aksi fisik / fenomena benda metafora sesuai beat])
  5. (Environment: ${envLine})
  6. (Lighting: ${preLight})
🚨 KHUSUS KLIP PRODUK (${hasMultiSegmentPillarBridge ? pillarRangeLabel : `KLIP ${bridgeAtClip} & KLIP TERAKHIR`}):
${insideMetaphor
    ? `- TETAP di dunia benda yang sama (${envDriven ? policy.sceneEnvironment : 'latar metafora video ini'}) — pertahankan konsistensi ruangan & objek dari Klip 1 sampai Klip ${targetClips}!
- Klip ${bridgeAtClip} (Product Bridge Aktif): produk tampil BEKERJA LANGSUNG pada objek metafora kotor: ${reactionHint}.
- Klip ${bridgeAtClip + 1} s/d ${Math.max(bridgeAtClip + 1, targetClips - 1)}: tampilkan lanjutan transformasi BERSIH pada benda metafora yang sama (${resultHint})${kit?.genre === 'recipe' ? '' : ' — DILARANG berbelok ke memotong/menumbuk bumbu dapur atau herbal'}.
- Klip terakhir (Klip ${targetClips} — HERO FINALE): tampilkan ${resultHint} BERSAMA wadah/botol produk asli utuh sesuai (Product Truth) & ${opcRefFilenameTag ? `(Product Reference File)` : 'foto referensi'} dalam genggaman sopan lengan panjang berkancing/manset pergelangan.
- Pencahayaan (Lighting: ${productLight} hingga ${finalLight}).`
    : `- Baru pada ${hasMultiSegmentPillarBridge ? pillarRangeLabel : `Klip ${bridgeAtClip} ke atas`} diizinkan menuliskan (Biometric Anchor: ${targetAnchorText}), (Wardrobe: ${targetWardrobeText}), dan (Product Truth: ...)${opcRefFilenameTag}.`}
${hasMultiSegmentPillarBridge && nonProductMultiSpanText ? `- KHUSUS ZONA GAP/POST (${nonProductMultiSpanText}): Pertahankan tangan sopan satu orang yang sama (${targetAnchorText}, ${targetWardrobeText}) bersama objek bersih rumah tangga polos tanpa produk bermerek (${POSITIVE_CLEAN_SCENE_CONTEXT_TUPLE}).\n` : ''}`;
}

/**
 * Membangun blok ekspansi tuple per zona untuk mode metafora aktif.
 */
export function buildMetaphorWorldTupleExpansion({
  policy,
  maxPreBridgeClip,
  bridgeAtClip,
  targetClips,
  targetAnchorText,
  targetWardrobeText,
  targetLightingText,
  opcRefFilenameTag,
  pillarRangeLabel,
  hasMultiSegmentPillarBridge,
  nonProductMultiSpanText,
  productData,
  kit = null,
}) {
  const handsActive = policy?.handsPolicy === 'modest_hands_active';
  const envDriven = policy?.environmentPolicy === 'metaphor_driven' && Boolean(policy?.sceneEnvironment);
  const insideMetaphor = policy?.productEntry === 'inside_metaphor';
  const arc = policy?.lightingArc || null;

  const envText = envDriven ? policy.sceneEnvironment : '[Latar ruangan nyata kontekstual sesuai W\'S Matrix baris ini]';
  const preLight = arc ? arc.from : targetLightingText;
  const midLight = arc ? `smooth transition from ${arc.from} toward ${arc.to}` : targetLightingText;
  const finalLight = arc ? arc.to : targetLightingText;

  const prePresenceBlock = handsActive
    ? `  1. Klip 1 (Hook Object-Only): ${POSITIVE_CLIP1_OBJECT_PRESENCE_TUPLE}\n     Klip 2 s/d ${maxPreBridgeClip}: ${MODEST_HANDS_PRESENCE_TRUTH_TUPLE} & (Wardrobe: ${targetWardrobeText})`
    : `  1. ${POSITIVE_CLIP1_OBJECT_PRESENCE_TUPLE}`;

  const preActionDesc = handsActive
    ? '[Klip 1: fenomena fisika mandiri objek saja; Klip 2+: satu orang saja, tepat dua tangan dalam lengan panjang berkancing/manset menutup pergelangan beraksi pada benda metafora]'
    : '[Fenomena fisika/fluida mandiri pada objek fokus tanpa keberadaan orang]';

  const productActionDesc = insideMetaphor
    ? `[Produk bekerja langsung sebagai agen perubahan di dalam metafora (${kit?.beats?.reaction || 'reaction beat'}), Klip tengah menjaga kelanjutan objek bersih (${kit?.beats?.result || 'result beat'}), dan Klip ${targetClips} Hero Finale menampilkan hasil bersih + wadah produk utuh]`
    : '[Deskripsi tindakan fisik satu pasang tangan POV sopan berinteraksi langsung dengan produk]';

  const productEnvDesc = (insideMetaphor && envDriven)
    ? policy.sceneEnvironment
    : (envDriven ? policy.sceneEnvironment : '[Latar ruangan & suasana meja kerja secara rinci]');

  return `
- PADA KLIP 1 s/d ${maxPreBridgeClip} (PRE-BRIDGING METAFORA — POSITIVE FRAMING):
${prePresenceBlock}
  2. (Object Truth & Metaphor: [Deskripsi objek fisik dunia metafora "${policy?.objectWorld || 'metafora video ini'}" — maks 1 aksi & <=3 objek utama])
  3. ${POSITIVE_CLEAN_SCENE_CONTEXT_TUPLE}
  4. (Physical Kinetics: ${preActionDesc})
  5. (Environment: ${envText})
  6. (Lighting: ${preLight})
- PADA ${hasMultiSegmentPillarBridge ? pillarRangeLabel.toUpperCase() : `KLIP ${bridgeAtClip} & KLIP ${targetClips} HERO FINALE`} (PRODUCT BRIDGING & PAYOFF):
  1. (Biometric Anchor: ${handsActive ? MODEST_HANDS_PRESENCE_TRUTH_TUPLE : targetAnchorText})
  2. (Wardrobe: ${targetWardrobeText}) - KONSISTENSI WARNA & TEKSTUR 100% IDENTIK.
  ${productData ? `3. (Product Truth: [Bentuk geometri presisi produk, bahan material kemasan, warna isi])${opcRefFilenameTag}` : `3. ${POSITIVE_CLEAN_SCENE_CONTEXT_TUPLE}`}
  4. (Action & Craft: ${productActionDesc})
  5. (Environment: ${productEnvDesc})
  6. (Lighting: Klip bridging ${midLight}; Klip terakhir ${finalLight})
${hasMultiSegmentPillarBridge && nonProductMultiSpanText ? `- PADA ZONA GAP / POST (${nonProductMultiSpanText.toUpperCase()} — KONSISTENSI DUNIA METAFORA):
  1. (Biometric Anchor: ${handsActive ? MODEST_HANDS_PRESENCE_TRUTH_TUPLE : targetAnchorText})
  2. (Wardrobe: ${targetWardrobeText}) - KONSISTENSI WARNA & TEKSTUR 100% IDENTIK.
  3. ${POSITIVE_CLEAN_SCENE_CONTEXT_TUPLE}
  4. (Action & Craft: [Kelanjutan hasil bersih dunia metafora tanpa meramu/memotong bumbu dapur])
  5. (Environment: ${envText})
  6. (Lighting: ${finalLight})
` : ''}`;
}

/**
 * Mengembalikan header & poin mandat metafora (mode default = teks lama persis).
 */
export function metaphorMandateHeader(policy, { bridgeAtClip = 2, hasMultiSegmentPillarBridge = false, pillarRangeLabel = '' } = {}) {
  const maxPre = Math.max(1, bridgeAtClip - 1);
  if (!hasAnyMetaphorPolicyOverride(policy)) {
    return {
      title: '🚨 OBJECT-CENTRIC METAPHOR MANDATE (100% PURE OBJECT PRE-BRIDGING — ZERO HANDS / GROUNDED REAL-LIFE CONTEXT)',
      intro: 'Kampanye ini menggunakan gaya visual Metafora Objek Murni (Pure Isolated Object):',
      forbiddenHandsLine: `   - PADA KLIP METAFORA PRE-BRIDGING (KLIP 1 s/d ${maxPre}): DILARANG KERAS memunculkan TANGAN, LENGAN, JARI, atau bagian tubuh manusia mana pun! Tidak boleh ada orang/tangan yang memegang atau menggerakkan benda. Benda harus tampak terisolasi dan berinteraksi secara mandiri melalui hukum fisika murni.`,
      povHandsLine: `   - Interaksi Tangan POV (HANYA ${hasMultiSegmentPillarBridge ? `Segmen Produk ${pillarRangeLabel} & kontinuitas Gap/Post tanpa produk` : 'Klip Solusi/Konsumsi Belakang'}): Tangan POV hanya boleh muncul ${hasMultiSegmentPillarBridge ? `pada klip produk (${pillarRangeLabel}) dan dapat menjaga konsistensi tangan pada klip gap di antaranya (tanpa produk/kemasan apa pun)` : `pada klip produk/konsumsi (Klip ${bridgeAtClip} ke atas)`}. Klip 1 s/d ${maxPre} WAJIB MURNI BENDA TANPA TANGAN.`,
    };
  }

  const handsActive = policy.handsPolicy === 'modest_hands_active';
  const insideMetaphor = policy.productEntry === 'inside_metaphor';

  return {
    title: handsActive
      ? '🚨 METAPHOR WORLD MANDATE (TANGAN SYAR\'I AKTIF / PRODUK DI DALAM METAFORA)'
      : '🚨 METAPHOR WORLD MANDATE (DUNIA BENDA PER VIDEO / PRODUK DI DALAM METAFORA)',
    intro: 'Kampanye ini menggunakan gaya visual Metaphor World Kit (satu dunia metafora utuh dari awal hingga akhir video):',
    forbiddenHandsLine: handsActive
      ? `   - PADA KLIP 1 (Opening Hook): Tetap 100% object-only (hook benda murni tanpa tangan). Mulai Klip 2 ke atas, tangan syar'i (lengan panjang menutup pergelangan) BOLEH berakting pada benda metafora. DILARANG keras memunculkan wajah manusia atau kulit lengan telanjang!`
      : `   - PADA KLIP METAFORA PRE-BRIDGING (KLIP 1 s/d ${maxPre}): Tetap 100% object-only tanpa tangan manusia.`,
    povHandsLine: handsActive
      ? `   - Interaksi Tangan Syar'i & Produk: Klip 1 tetap object-only; Klip 2 ke atas tangan syar'i (wrists covered) aktif menggerakkan aksi benda metafora${insideMetaphor ? `, dan pada klip produk (${hasMultiSegmentPillarBridge ? pillarRangeLabel : `Klip ${bridgeAtClip} ke atas`}) produk masuk KE DALAM dunia metafora yang sama sebagai agen perubahan` : ''}.`
      : `   - Interaksi Tangan POV: Tangan POV muncul mulai ${hasMultiSegmentPillarBridge ? `Segmen Produk ${pillarRangeLabel}` : `Klip ${bridgeAtClip} ke atas`}${insideMetaphor ? ' di dalam dunia metafora yang sama (tanpa pindah ke studio brand)' : ''}. Klip 1 s/d ${maxPre} murni benda tanpa tangan.`,
  };
}

