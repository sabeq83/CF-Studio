/**
 * Visual Identity Allocator & Dynamic Mode Routing Engine
 * Integrates Schema v2 Visual Identity Foundation with Organic Pillar Campaigns.
 */

import {
  DEFAULT_VISUAL_STYLE,
  VISUAL_LANGUAGE_CATALOG,
  getVisualStyleDefinition,
  getVisualStyleForSceneDirector,
  isValidVisualStyle
} from './visual-language-catalog.js';
import { hasAnyMetaphorPolicyOverride } from './metaphor-policy.js';
import { resolveAngleBeatsForClips } from './angle-visual-formats.js';

// Backward compatibility export derived from central catalog
export const VISUAL_STYLE_DESCRIPTIONS = Object.fromEntries(
  Object.entries(VISUAL_LANGUAGE_CATALOG).map(([k, v]) => [k, v.description || v.label])
);

/**
 * Dynamically allocates N clips to the 6 narrative functions and maps each to its visual mode.
 * Supports any clip count (4, 6, 8, 10, 15, 20, etc.).
 */
export function allocateClipsToNarrativeModes(totalClips = 6, modeRouting = {}, primaryStyle = DEFAULT_VISUAL_STYLE) {
  const clips = Math.max(1, Number(totalClips) || 6);
  const fallbackStyle = isValidVisualStyle(primaryStyle) ? primaryStyle : DEFAULT_VISUAL_STYLE;

  const defaultRouting = {
    hook: fallbackStyle,
    context: fallbackStyle,
    mechanism: fallbackStyle,
    consequence: fallbackStyle,
    evidence_reveal: fallbackStyle,
    conclusion: fallbackStyle,
    ...modeRouting
  };

  const allocations = [];

  for (let c = 1; c <= clips; c++) {
    let selectedFunction = 'context';

    if (clips === 1) {
      selectedFunction = 'hook';
    } else if (clips === 2) {
      selectedFunction = c === 1 ? 'hook' : 'conclusion';
    } else if (clips === 3) {
      selectedFunction = c === 1 ? 'hook' : (c === 2 ? 'mechanism' : 'conclusion');
    } else if (clips === 4) {
      if (c === 1) selectedFunction = 'hook';
      else if (c === 2) selectedFunction = 'context';
      else if (c === 3) selectedFunction = 'evidence_reveal';
      else selectedFunction = 'conclusion';
    } else if (clips === 5) {
      if (c === 1) selectedFunction = 'hook';
      else if (c === 2) selectedFunction = 'context';
      else if (c === 3) selectedFunction = 'mechanism';
      else if (c === 4) selectedFunction = 'evidence_reveal';
      else selectedFunction = 'conclusion';
    } else {
      // General proportional allocation for N >= 6 clips
      const ratio = (c - 0.5) / clips;
      if (c === 1 || ratio <= 0.15) {
        selectedFunction = 'hook';
      } else if (c === clips || ratio >= 0.88) {
        selectedFunction = 'conclusion';
      } else if (ratio <= 0.35) {
        selectedFunction = 'context';
      } else if (ratio <= 0.58) {
        selectedFunction = 'mechanism';
      } else if (ratio <= 0.78) {
        selectedFunction = 'consequence';
      } else {
        selectedFunction = 'evidence_reveal';
      }
    }

    const assignedMode = defaultRouting[selectedFunction] || defaultRouting.context || fallbackStyle;
    const styleDef = VISUAL_LANGUAGE_CATALOG[assignedMode] || { description: assignedMode };

    allocations.push({
      clipIndex: c,
      narrativeFunction: selectedFunction,
      visualMode: assignedMode,
      modeDescription: styleDef.description || assignedMode
    });
  }

  return allocations;
}

/**
 * Allocates N clips dynamically based on the planner's Strategic Angle (K3) when Scene Director is active.
 */
export function allocateClipsByAngleBeats({
  totalClips = 6,
  angleName = '',
  bridgeAtClip = null,
  primaryStyle = DEFAULT_VISUAL_STYLE,
  supportingStyles = [],
  disabledStyles = [],
  styleLimits = null,
  metaphoricActive = false
} = {}) {
  const effectiveDisabled = new Set(Array.isArray(disabledStyles) ? disabledStyles : []);
  if (metaphoricActive) {
    effectiveDisabled.add('3d_bio_cellular');
  }
  const plan = resolveAngleBeatsForClips(angleName, totalClips, {
    bridgeAtClip,
    primaryStyle,
    supportingStyles,
    disabledStyles: [...effectiveDisabled],
    styleLimits
  });

  const allocations = plan.clips.map(clip => {
    const def = getVisualStyleForSceneDirector(clip.visualMode, { stripLocation: true });
    return {
      clipIndex: clip.clipIndex,
      narrativeFunction: clip.beatRole,
      beatLabel: clip.beatLabel,
      visualIntent: clip.visualIntent,
      visualMode: clip.visualMode,
      modeLabel: def.label,
      modeDescription: def.description,
      modePrompt: def.prompt,
      isProductBridge: clip.isProductBridge
    };
  });

  return {
    angleFormat: plan.angleFormat,
    allocations,
    hasAny3d: plan.hasAny3d
  };
}

/**
 * Builds the comprehensive Visual Identity Mandate section for the Gemini AI Prompt.
 */
export function buildVisualIdentityPromptSection(snapshot, totalClips = 6, { metaphorPolicy = null, sceneDirector = null } = {}) {
  if (!snapshot) return '';

  const structured = snapshot.structured || snapshot;
  const label = structured.label || snapshot.label || 'Visual Identity System';
  const visualLang = structured.visual_language || {};
  const primaryStyle = visualLang.primary_style || DEFAULT_VISUAL_STYLE;
  const supportingStyles = Array.isArray(visualLang.supporting_styles) ? visualLang.supporting_styles : [];
  const disabledStyles = Array.isArray(visualLang.disabled_styles) ? visualLang.disabled_styles : [];
  const modeRouting = { ...(structured.mode_routing || {}) };

  const metaphoricActive = Boolean(
    metaphorPolicy?.active &&
    (hasAnyMetaphorPolicyOverride(metaphorPolicy) || metaphorPolicy?.objectWorld)
  );

  const isSceneDirectorMode = Boolean(sceneDirector?.active || structured.schema_mode === 'identity_card');

  const has3dClues = isSceneDirectorMode
    ? false
    : (/3d\s*(bio-cellular|biomedical|cellular|medical|simulation|organ)/i.test(label) ||
       /3d\s*(bio-cellular|biomedical|cellular|medical|simulation|organ)/i.test(structured.description || '') ||
       /3d\s*(bio-cellular|biomedical|cellular|medical|simulation|organ)/i.test(structured.style?.custom_description || '') ||
       (Array.isArray(structured.rendering?.textures) && structured.rendering.textures.some(t => /3d_cellular|cellular/i.test(t))));

  if (!metaphoricActive && !isSceneDirectorMode && has3dClues && (!modeRouting.mechanism || modeRouting.mechanism === 'symbolic_surrealism')) {
    modeRouting.mechanism = '3d_bio_cellular';
  }
  if (metaphoricActive) {
    for (const fn of Object.keys(modeRouting)) {
      if (modeRouting[fn] === '3d_bio_cellular') {
        modeRouting[fn] = supportingStyles.includes('symbolic_surrealism') ? 'symbolic_surrealism' : primaryStyle;
      }
    }
  }
  const rendering = structured.rendering || {};
  const guardrails = structured.guardrails || {};
  const composition = structured.composition || {};
  const metaphorEngine = structured.metaphor_engine || {};
  const wardrobe = structured.wardrobe || {};
  const lighting = structured.lighting || {};
  const environment = structured.environment || {};

  const envDesc = environment.fallback_location || environment.custom_description || (environment.preset_key ? `Environment preset (${environment.preset_key})` : '');
  const materialPalette = Array.isArray(environment.material_palette) && environment.material_palette.length > 0
    ? environment.material_palette.join(', ')
    : '';
  const propsList = Array.isArray(environment.props) && environment.props.length > 0
    ? environment.props.join(', ')
    : '';

  const allocations = isSceneDirectorMode
    ? (Array.isArray(sceneDirector?.allocations) && sceneDirector.allocations.length > 0
        ? sceneDirector.allocations
        : allocateClipsByAngleBeats({
            totalClips,
            angleName: sceneDirector?.angleName || '',
            bridgeAtClip: sceneDirector?.bridgeAtClip || null,
            primaryStyle,
            supportingStyles,
            disabledStyles,
            styleLimits: structured.style_limits || null,
            metaphoricActive
          }).allocations)
    : allocateClipsToNarrativeModes(totalClips, modeRouting, primaryStyle);

  // Group allocations into readable ranges for prompt
  const groupedRanges = [];
  let currentGroup = null;

  for (const alloc of allocations) {
    if (!currentGroup || currentGroup.visualMode !== alloc.visualMode || currentGroup.narrativeFunction !== alloc.narrativeFunction) {
      if (currentGroup) groupedRanges.push(currentGroup);
      currentGroup = {
        start: alloc.clipIndex,
        end: alloc.clipIndex,
        narrativeFunction: alloc.narrativeFunction,
        visualMode: alloc.visualMode,
        description: alloc.modeDescription
      };
    } else {
      currentGroup.end = alloc.clipIndex;
    }
  }
  if (currentGroup) groupedRanges.push(currentGroup);

  const tableLines = groupedRanges.map(g => {
    const rangeLabel = g.start === g.end ? `Klip ${g.start}` : `Klip ${g.start}–${g.end}`;
    return `* ${rangeLabel.padEnd(14)} [Fungsi: ${g.narrativeFunction.toUpperCase()}] ➔ Mode Visual: "${g.visualMode}"\n  -> Panduan Estetika: ${g.description}`;
  }).join('\n');

  const texturesList = Array.isArray(rendering.textures) && rendering.textures.length > 0
    ? rendering.textures.join(', ')
    : 'printed_paper_grain, editorial_ink';

  const wardrobeDesc = sceneDirector?.wardrobeDesc
    || wardrobe.custom_description
    || (wardrobe.preset_key ? `Attire preset (${wardrobe.preset_key})` : 'Everyday modest civilian attire in charcoal, off-white, warm gray and muted beige');
  const lightingDesc = isSceneDirectorMode
    ? (lighting.character || lighting.custom_description || 'Balanced organic natural lighting matching the Scene Brief time of day')
    : (lighting.custom_description || 'Soft directional lighting with natural shadows');

  const subject = structured.subject || {};
  const isFacelessMandate = guardrails.face_visibility !== 'allowed' &&
                            subject.face_visibility !== 'allowed' &&
                            primaryStyle !== 'stylized_3d_character' &&
                            primaryStyle !== '3d_claymation_cozy' &&
                            subject.kind !== 'stylized_3d_character';

  const charConceptDesc = isFacelessMandate
    ? 'STRICTLY FACELESS (Semua figur manusia tampil tanpa mata/hidung/mulut, atau dari sudut belakang/siluet/potong siku ke bawah).'
    : 'FULL 3D STYLIZED ANIMATED CHARACTER (Karakter kartun 3D ekspresif dengan mata animasi besar, hidung, dan mulut tersenyum ramah. Aturan faceless/hidden face TIDAK BERLAKU).';

  const sleeveRule = wardrobe.sleeve_policy === 'forearms_exposed'
    ? 'Sleeve policy: forearms exposed / lengan boleh digulung rapi hingga siku sesuai karakter brand.'
    : 'Lengan pakaian tertutup (wrists covered).';

  const guardrailsFaceRule = isFacelessMandate
    ? '- DILARANG KERAS memunculkan wajah manusia realistis (mata, hidung, mulut) atau potret close-up wajah orang nyata.'
    : '- DILARANG KERAS memunculkan wajah manusia fotorealistik / orang nyata live-action. Wajib konsisten dengan gaya animasi 3D kartun ekspresif (3D Pixar/DreamWorks stylized family animation).';

  const signatureAccents = Array.isArray(structured.signature_accents) && structured.signature_accents.length > 0
    ? structured.signature_accents.join(', ')
    : '';

  if (isSceneDirectorMode) {
    const fallbackLocationText = envDesc || 'Meja rumah atau permukaan alami netral yang rapi';
    const paletteOptions = Array.isArray(wardrobe.palette) && wardrobe.palette.length > 0
      ? `Palet Brand: ${wardrobe.palette.join(', ')} — pakai 1 warna solid konsisten sepanjang video`
      : wardrobeDesc;
    return `
========================================================================
🎨 BRAND LOOK & VISUAL IDENTITY (HOW IT LOOKS — TUNDUK PADA SCENE DIRECTOR)
========================================================================
Identitas Visual Brand: "${label}"
Gaya Visual Utama (Camera & Look): "${primaryStyle}"
Gaya Pendukung Diizinkan: ${supportingStyles.length > 0 ? supportingStyles.join(', ') : 'cinematic_realistic'}

🚨 ATURAN MODE VISUAL DINAMIS BERDASARKAN STRATEGIC ANGLE (Total ${totalClips} Klip):
Anda WAJIB mengikuti pembagian mode & niat beat per klip berikut (maksimal 1 klip 3D hanya jika Strategic Angle memang menuntut mekanisme ilmiah):
${tableLines}

🏛️ RENDERING & BRAND LOOK (KUALITAS TAMPILAN):
1. Geometri & Bentuk  : ${rendering.geometry || 'simplified_semi_realistic'}
2. Tekstur & Finishing: ${texturesList} | Finishing: ${rendering.finish || 'soft_matte'} | Shadow: ${rendering.shadow_style || 'soft_ambient'}
3. Karakter Cahaya    : ${lightingDesc} (Waktu siang/malam mengikuti SCENE DIRECTOR di atas, jangan dipaksa pagi).
${signatureAccents ? `4. Aksesori Tanda Tangan (Opsional Kecil, maks 1-2): ${signatureAccents} (hanya muncul bila wajar di lokasi Scene Director).\n` : ''}
👥 TALENT TANGAN, WARDROBE & GUARDRAILS:
- Konsep Karakter     : ${charConceptDesc}
- Deskripsi Talent    : ${subject.custom_description || 'Indonesian POV hands'}
- Pakaian / Palet     : ${paletteOptions}. Detail: ${wardrobeDesc}. ${sleeveRule}
- Batas 3D / Kartun   : ${structured.style_limits?.max_3d_clips === 0 ? '0 klip 3D (DILARANG 3D CGI).' : `Maksimal ${structured.style_limits?.max_3d_clips ?? 1} klip 3D HANYA pada angle edukasi/mekanisme.`}
${guardrailsFaceRule}

🏡 FALLBACK LOKASI BRAND (HANYA JIKA SCENE BRIEF KOSONG):
- Fallback Default    : ${fallbackLocationText}
- ATURAN HIERARKI WAJIB: Karena SCENE DIRECTOR di atas menetapkan lokasi & waktu dari Content Planner, Anda WAJIB mengikuti lokasi & suasana SCENE DIRECTOR sepenuhnya. Jangan menarik adegan keluar dari lokasi Scene Director kembali ke dapur/batu slate/studio jika planner sudah menentukan ruangan lain!
========================================================================
`;
  }

  const isMetaphorDrivenEnv = Boolean(
    metaphoricActive &&
    metaphorPolicy?.environmentPolicy === 'metaphor_driven' &&
    metaphorPolicy?.sceneEnvironment
  );

  const envMandateSection = isMetaphorDrivenEnv
    ? `🏡 ENVIRONMENT & SETTING MANDATE (WAJIB DITERAPKAN PADA SELURUH KLIP):
- Latar Setting Utama : ${metaphorPolicy.sceneEnvironment}
${materialPalette ? `- Palet Referensi Warna/Material Brand (opsional, bukan lokasi wajib): ${materialPalette}\n` : ''}- LATAR MENGIKUTI METAPHOR WORLD: "${metaphorPolicy.sceneEnvironment}". Konsisten di seluruh klip VIDEO INI. Latar brand (${envDesc || 'default brand'}) HANYA referensi nuansa warna/material, BUKAN lokasi wajib dan properti brand tidak dipaksakan.`
    : `🏡 ENVIRONMENT & SETTING MANDATE (WAJIB DITERAPKAN PADA SELURUH KLIP):
- Latar Setting Utama : ${envDesc || 'Sesuai konteks adegan dan W\'S Matrix'}
${materialPalette ? `- Palet Material Wajib: ${materialPalette}\n` : ''}${propsList ? `- Properti Kunci      : ${propsList}\n` : ''}- DILARANG KERAS menyimpang dari latar setting visual identity di atas (misal jika visual identity menetapkan corkboard/pinboard matrix, DILARANG menggantinya menjadi meja kayu arsip biasa atau dapur).`;

  return `
========================================================================
🎨 VISUAL IDENTITY SYSTEM & DYNAMIC MODE ROUTING (MANDATORY CONTRACT)
========================================================================
Sistem Visual Identity Aktif: "${label}"
Gaya Visual Utama (Primary Style): "${primaryStyle}"
Gaya Pendukung (Supporting Modes): ${supportingStyles.join(', ')}

🚨 ATURAN PENUGASAN MODE VISUAL DINAMIS PER-KLIP (Total ${totalClips} Klip):
Anda WAJIB menerapkan mode visual berikut pada deskripsi visual storyboard dan prompt T2I/I2V di setiap klip:
${tableLines}

🏛️ RENDERING & TEXTURE SPECIFICATIONS (STRICT ARTISTIC FINISH):
1. Geometri & Bentuk  : ${rendering.geometry || 'simplified_semi_realistic'} (Bentuk semi-realistis yang disederhanakan, siluet tajam, proporsional).
2. Tekstur Wajib      : ${texturesList} (Wajib menampilkan nuansa tekstur material yang realistis dan konsisten).
3. Bayangan (Shadows) : ${rendering.shadow_style || 'strong_geometric'} (Bayangan terkalibrasi sesuai pencahayaan adegan).
4. Finishing          : ${rendering.finish || 'matte_editorial'} (Finishing permukaan sesuai estetika gaya visual).
5. Palet Warna        : Terkoordinasi harmonis, maksimal SATU warna aksen kuat per adegan.

⚙️ METAPHOR ENGINE MANDATE (${metaphorEngine.pattern || 'concept_to_object_to_action'}):
- Anda DILARANG menggambarkan adegan live-action klise tanpa arah visual yang jelas.
- Terjemahkan konsep abstrak menjadi OBJEK METAFORA FISIK YANG HIDUP dan aksi visual yang memikat.

👥 ATURAN KARAKTER & WARDROBE:
- Konsep Karakter     : ${charConceptDesc}
- Pakaian (Wardrobe)  : ${wardrobeDesc}. ${sleeveRule}
${metaphorPolicy?.active && metaphorPolicy?.lightingArc
  ? `- Pencahayaan (Light Arc) : PRE-BRIDGE = "${metaphorPolicy.lightingArc.from}" ➔ BRIDGE/POST-BRIDGE = "${metaphorPolicy.lightingArc.to}" (ABAIKAN pencahayaan hangat 3500K baseline agar kontras kotor vs bersih tajam).`
  : `- Pencahayaan (Light) : ${lightingDesc}.`}

${envMandateSection}

🚫 STRICT VISUAL GUARDRAILS (ZERO TOLERANCE):
${guardrailsFaceRule}
- DILARANG KERAS visual cacat, artefak CGI berlebihan, atau gaya visual yang bertentangan dengan Primary Style.
- Seluruh prompt T2I ("t2i_prompts") dan I2V ("i2v_prompts") WAJIB ditulis dalam Bahasa Inggris dan mencerminkan mode visual klip yang bersangkutan.
========================================================================
`;
}
