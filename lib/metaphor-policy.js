/**
 * lib/metaphor-policy.js
 * Single-source-of-truth resolver untuk Metaphor Policy (F2) + helper tuple & prompt section.
 * Mode default (tanpa policy atau semua switch off) mengembalikan string legacy secara identik byte-per-byte.
 */

export const LEGACY_PRESENCE_TRUTH_TUPLE =
  '(Presence Truth: Strictly 100% Pure Isolated Object Only — ABSOLUTELY ZERO HANDS, NO ARMS, ZERO HUMAN PRESENCE)';

export const MODEST_HANDS_PRESENCE_TRUTH_TUPLE =
  '(Presence Truth: Modest female hands only, long sleeves fully covering wrists, no face, no bare arms)';

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

  return {
    active: true,
    environmentPolicy,
    handsPolicy,
    productEntry,
    lightingArc,
    sceneEnvironment: kit?.environment || null,
    objectWorld: kit?.object_world || null,
    handVariant: kit?.hand_variant || null,
    reasons,
  };
}

/**
 * Mengembalikan tuple Presence Truth yang tepat.
 * Pada mode default (atau zona 'clip1'), mengembalikan string legacy persis.
 */
export function presenceTruthTuple(policy, zone = 'pre') {
  if (policy?.active && policy.handsPolicy === 'modest_hands_active' && zone !== 'clip1' && zone !== 'hook') {
    return MODEST_HANDS_PRESENCE_TRUTH_TUPLE;
  }
  return LEGACY_PRESENCE_TRUTH_TUPLE;
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
    ? `  1. Klip 1 (Hook Object-Only): (Presence Truth: Pure isolated object hook only — no hands in Clip 1 opening frame)\n  1b. Klip 2 s/d ${maxPreBridgeClip}: ${MODEST_HANDS_PRESENCE_TRUTH_TUPLE}, (Wardrobe: ${targetWardrobeText})`
    : `  1. ${LEGACY_PRESENCE_TRUTH_TUPLE}`;

  const preZoneHeader = handsActive
    ? `🚨 KHUSUS KLIP 1 s/d ${maxPreBridgeClip} (METAFORA DUNIA BENDA — "${worldLabel}"):
- Klip 1: tetap object-only hook (benda fisik murni tanpa tangan sebagai opening hook).
${maxPreBridgeClip >= 2 ? `- Klip 2 s/d ${maxPreBridgeClip}: tangan syar'i (lengan panjang menutup pergelangan, ${targetWardrobeText}) BOLEH berakting dengan benda metafora: ${handActionHint}.\n` : ''}- DILARANG KERAS menampilkan wajah manusia atau kulit lengan telanjang!`
    : `🚨 KHUSUS KLIP 1 s/d ${maxPreBridgeClip} (METAFORA DUNIA BENDA — "${worldLabel}"):
- DILARANG KERAS menuliskan "(Biometric Anchor: ...)" atau "(Wardrobe: ...)" pada Klip 1 s/d ${maxPreBridgeClip}!
- DILARANG KERAS menampilkan tangan, lengan, jari, atau bagian tubuh manusia mana pun pada Klip 1 s/d ${maxPreBridgeClip}!`;

  const reactionHint = kit?.beats?.reaction || 'isi/ekstrak produk masuk ke benda metafora sebagai agen perubahan';
  const resultHint = kit?.beats?.result || 'benda metafora dalam kondisi bersih & jernih';

  return `
${preZoneHeader}
- DILARANG menampilkan produk jadi bermerek, botol/jar komersial, kemasan penjualan, atau merek apa pun pada Klip 1 s/d ${maxPreBridgeClip}!
- Susunan tuple wajib Klip 1 s/d ${maxPreBridgeClip}:
${presenceLine}
  2. (Object Truth & Context: [Deskripsi objek dunia metafora "${worldLabel}" sesuai beat])
  3. (Geometric Truth: strictly no product shown, strictly no bottle, jar, or commercial packaging)
  4. (Physical Kinetics: [Aksi fisik / fenomena benda metafora sesuai beat])
  5. (Environment: ${envLine})
  6. (Lighting: ${preLight})
🚨 KHUSUS KLIP PRODUK (${hasMultiSegmentPillarBridge ? pillarRangeLabel : `KLIP ${bridgeAtClip} s/d ${targetClips}`}):
${insideMetaphor
    ? `- TETAP di dunia benda yang sama (${envDriven ? policy.sceneEnvironment : 'latar metafora video ini'}) — DILARANG pindah ke studio/latar brand terpisah!
- Produk tampil sebagai agen perubahan di dalam metafora: ${reactionHint}.
- Klip terakhir (Klip ${targetClips}): ${resultHint} + botol/kemasan utuh (Product Truth Lock)${opcRefFilenameTag} diambil tangan syar'i.
- Pencahayaan (Lighting: ${productLight} hingga ${finalLight}).`
    : `- Baru pada ${hasMultiSegmentPillarBridge ? pillarRangeLabel : `Klip ${bridgeAtClip} ke atas`} diizinkan menuliskan (Biometric Anchor: ${targetAnchorText}), (Wardrobe: ${targetWardrobeText}), dan (Product Truth: ...)${opcRefFilenameTag}.`}
${hasMultiSegmentPillarBridge && nonProductMultiSpanText ? `- KHUSUS ZONA GAP/POST (${nonProductMultiSpanText}): Karakter/tangan POV (${targetAnchorText}, ${targetWardrobeText}) BOLEH dipertahankan agar alur visual konsisten, namun WAJIB memakai (Geometric Truth: strictly no product shown, strictly no bottle, jar, or commercial packaging) — DILARANG KERAS memunculkan produk atau kemasan!\n` : ''}`;
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
    ? `  1. Klip 1 (Hook Object-Only): (Presence Truth: Pure isolated object hook only — no hands in Clip 1 opening frame)\n     Klip 2 s/d ${maxPreBridgeClip}: ${MODEST_HANDS_PRESENCE_TRUTH_TUPLE} & (Wardrobe: ${targetWardrobeText})`
    : `  1. ${LEGACY_PRESENCE_TRUTH_TUPLE}`;

  const preActionDesc = handsActive
    ? '[Klip 1: fenomena fisika mandiri; Klip 2+: aksi tangan syar\'i pada benda metafora tanpa menampilkan wajah atau lengan terbuka]'
    : '[Fenomena fisika/fluida mandiri tanpa disentuh manusia]';

  const productActionDesc = insideMetaphor
    ? `[Produk berperan sebagai agen perubahan di dalam metafora (${kit?.beats?.reaction || 'reaction beat'}), dan di Klip ${targetClips} hasil bersih (${kit?.beats?.result || 'result beat'}) + botol utuh]`
    : '[Deskripsi tindakan fisik tangan POV berinteraksi secara autentik dengan produk]';

  const productEnvDesc = (insideMetaphor && envDriven)
    ? policy.sceneEnvironment
    : (envDriven ? policy.sceneEnvironment : '[Latar ruangan & suasana meja kerja secara rinci]');

  return `
- PADA KLIP 1 s/d ${maxPreBridgeClip} (PRE-BRIDGING ISOLATION PRODUK):
${prePresenceBlock}
  2. (Object Truth & Metaphor: [Deskripsi objek fisik dunia metafora "${policy?.objectWorld || 'metafora video ini'}"])
  3. (Geometric Truth: strictly no product shown, strictly no bottle, jar, or commercial packaging)
  4. (Physical Kinetics: ${preActionDesc})
  5. (Environment: ${envText})
  6. (Lighting: ${preLight})
- PADA ${hasMultiSegmentPillarBridge ? pillarRangeLabel.toUpperCase() : `KLIP ${bridgeAtClip} s/d ${targetClips}`} (PRODUCT BRIDGING & PAYOFF):
  1. (Biometric Anchor: ${handsActive ? MODEST_HANDS_PRESENCE_TRUTH_TUPLE : targetAnchorText})
  2. (Wardrobe: ${targetWardrobeText}) - KONSISTENSI WARNA & TEKSTUR 100% IDENTIK.
  ${productData ? `3. (Product Truth: [Bentuk geometri presisi produk, bahan material kemasan, warna isi])${opcRefFilenameTag}` : `3. (Geometric Truth: strictly no product shown) - DILARANG KERAS memunculkan botol atau produk kemasan fiktif.`}
  4. (Action & Craft: ${productActionDesc})
  5. (Environment: ${productEnvDesc})
  6. (Lighting: Klip bridging ${midLight}; Klip terakhir ${finalLight})
${hasMultiSegmentPillarBridge && nonProductMultiSpanText ? `- PADA ZONA GAP / POST (${nonProductMultiSpanText.toUpperCase()} — KONSISTENSI KARAKTER BEBAS PRODUK):
  1. (Biometric Anchor: ${handsActive ? MODEST_HANDS_PRESENCE_TRUTH_TUPLE : targetAnchorText})
  2. (Wardrobe: ${targetWardrobeText}) - KONSISTENSI WARNA & TEKSTUR 100% IDENTIK.
  3. (Geometric Truth: strictly no product shown, strictly no bottle, jar, or commercial packaging) - DILARANG KERAS memunculkan produk atau kemasan di zona jeda/penutup ini!
  4. (Action & Craft: [Aktivitas sehari-hari kontekstual tanpa produk/botol])
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

