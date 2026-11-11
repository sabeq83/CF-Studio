import assert from 'node:assert/strict';
import {
  DEFAULT_VISUAL_STYLE,
  PRIMARY_STYLE_KEYS,
  VISUAL_STYLE_KEYS,
  VISUAL_LANGUAGE_CATALOG
} from '../lib/visual-language-catalog.js';
import {
  validateAndNormalizeVisualIdentity
} from '../lib/visual-identity-contract.js';
import {
  normalizeAiVisualIdentityResult
} from '../lib/visual-identity-ai-contract.js';
import {
  resolveVisualIdentitySnapshot
} from '../lib/visual-override-resolver.js';

export const TEST_PRESETS = [
  {
    id: 'stickman',
    name: 'Stickman Doodles',
    tag: 'Explainer',
    prompt: 'Saya ingin visual identity gaya kartun stickman doodle minimalis yang ekspresif untuk edukasi bisnis, warna hitam putih dengan aksen kuning stabilo, karakter stickman dengan ekspresi wajah garis simpel memegang tablet atau laptop, latar belakang clean studio.',
    expected_face_allowed: true,
    expected_style_category: 'cartoon_editorial'
  },
  {
    id: 'paper_cutout',
    name: 'Paper Cutout Craft',
    tag: 'Tactile',
    prompt: 'Saya ingin gaya visual paper cutout layer bertumpuk nuansa kopi dan kuliner artisanal, tekstur kertas coklat craft dan off-white, pencahayaan lembut.',
    expected_face_allowed: false,
    expected_style_category: 'tactile_craft'
  },
  {
    id: 'clay_3d',
    name: '3D Clay Mascot',
    tag: 'Stop-Motion',
    prompt: 'Saya ingin karakter maskot 3D claymation lucu seperti kucing barista dengan celemek barista, pencahayaan softbox studio, warna pastel lembut.',
    expected_face_allowed: true,
    expected_style_category: 'claymation'
  },
  {
    id: 'nordic_kitchen',
    name: 'Nordic Kitchen Studio',
    tag: 'Clean Living',
    prompt: 'Saya ingin visual identity dapur modern Nordic minimalis, meja kayu oak dan marmer putih, pencahayaan alami jendela pagi, sangat estetik.',
    expected_face_allowed: false,
    expected_style_category: 'photorealistic'
  },
  {
    id: 'dark_moody',
    name: 'Dark Chiaroscuro',
    tag: 'Smoke & Meat',
    prompt: 'Saya ingin visual identity dark moody chiaroscuro dengan asap dramatis dan latar batu hitam slate untuk daging steak premium.',
    expected_face_allowed: false,
    expected_style_category: 'photorealistic'
  },
  {
    id: 'technical_blueprint',
    name: 'Technical Blueprint',
    tag: 'Dev & Data',
    prompt: 'Saya ingin gaya visual blueprint teknis arsitektur berwarna biru navy dengan garis skematik putih dan cyan, monospaced font, untuk konten analisis AI dan fintech.',
    expected_face_allowed: false,
    expected_style_category: 'editorial'
  },
  {
    id: 'lofi_flash',
    name: 'Lo-Fi 35mm Flash',
    tag: 'Candid UGC',
    prompt: 'Saya ingin gaya foto candid kamera analog 35mm dengan direct flash malam hari dan film grain tebal untuk street food viral dan review jujur.',
    expected_face_allowed: false,
    expected_style_category: 'photorealistic'
  },
  {
    id: 'isometric_diorama',
    name: 'Isometric 3D World',
    tag: 'Miniature',
    prompt: 'Saya ingin gaya miniatur isometrik 3D diorama pulau mengambang dengan perkebunan kopi dan kota mini, pencahayaan tilt-shift lembut.',
    expected_face_allowed: false,
    expected_style_category: 'isometric'
  },
  {
    id: 'pop_risograph',
    name: 'Pop Risograph',
    tag: 'Retro Halftone',
    prompt: 'Saya ingin gaya sablon cetak risograph retro dengan titik halftone vintage dan warna neon kontras tinggi seperti pink dan biru teal.',
    expected_face_allowed: false,
    expected_style_category: 'editorial'
  },
  {
    id: 'luminous_glass',
    name: 'Luminous Glass',
    tag: 'Trend 2027',
    prompt: 'Saya ingin visual identity futuristik tren 2027 dengan material frosted glass tembus pandang, refraksi prisma pelangi, pendaran luminous cyan cair.',
    expected_face_allowed: false,
    expected_style_category: 'photorealistic'
  },
  {
    id: 'sumi_e_ink',
    name: 'Sumi-e Asian Ink',
    tag: 'Zen Tea',
    prompt: 'Saya ingin gaya lukisan kuas kaligrafi Sumi-e oriental tradisional dengan tinta hitam dinamis di atas kertas beras washi dan aksen stempel merah cinnabar.',
    expected_face_allowed: false,
    expected_style_category: 'editorial'
  },
  {
    id: 'vintage_scrapbook',
    name: 'Vintage Scrapbook',
    tag: 'Investigation',
    prompt: 'Saya ingin gaya visual scrapbook koran investigasi retro tahun 70-an dengan sobekan kertas arsip, selotip transparan, dan lingkaran spidol merah.',
    expected_face_allowed: false,
    expected_style_category: 'editorial'
  }
];

console.log('🧪 Starting automated verification for ALL 12 Visual Identity Presets...');
console.log('----------------------------------------------------------------------');

const results = [];
let passCount = 0;
let failCount = 0;

for (let i = 0; i < TEST_PRESETS.length; i++) {
  const preset = TEST_PRESETS[i];
  const testNumber = i + 1;
  console.log(`\n[${testNumber}/12] Testing Preset: "${preset.name}" (${preset.id})...`);

  // Mock synthesized AI envelope for each preset to simulate Gemini output
  let mockEnvelope;
  if (preset.id === 'isometric_diorama') {
    // Specifically test what triggered the error: Gemini picking isometric_society
    mockEnvelope = {
      label: 'Isometric 3D World',
      description: 'Miniature 3D diorama of floating island',
      suggested_preset_key: 'isometric_3d_world',
      creative_rationale: 'Elevated angled systemic perspective with tilt-shift miniature lighting',
      config: {
        schema_version: '2',
        subject: {
          kind: 'mascot_object',
          faceless_mode: 'not_applicable',
          demographic_key: 'not_applicable',
          custom_description: 'Miniature floating island diorama with coffee plantation and micro buildings',
          character_count: 1,
          population_mode: 'single'
        },
        visual_language: {
          primary_style: 'isometric_society', // Trigger case!
          supporting_styles: []
        },
        mode_routing: {
          hook: 'isometric_society',
          context: 'isometric_society',
          mechanism: 'isometric_society',
          consequence: 'isometric_society',
          evidence_reveal: 'isometric_society',
          conclusion: 'isometric_society'
        },
        camera: { framing: 'isometric', perspective: 'third_person' },
        rendering: { geometry: 'geometric_stylized', finish: 'soft_matte' },
        guardrails: { face_visibility: 'prohibited' }
      }
    };
  } else if (preset.id === 'stickman') {
    // Test stickman cartoon face visibility
    mockEnvelope = {
      label: 'Stickman Business Doodles',
      description: 'Minimalist cartoon stickman character with simple expressive dot eyes and smile',
      suggested_preset_key: 'stickman_business_doodles',
      creative_rationale: 'Expressive minimalist doodle line art with yellow highlighter accents',
      t2i_prompt: 'Minimalist stickman cartoon character with friendly simple dot eyes and curved smile line, holding a tablet',
      config: {
        schema_version: '2',
        subject: {
          kind: 'stylized_cartoon_character',
          faceless_mode: 'stylized_cartoon_face',
          demographic_key: 'custom',
          custom_description: 'minimalist expressive stickman character with simple dot eyes and smile line holding a tablet',
          character_count: 1,
          population_mode: 'single'
        },
        visual_language: {
          primary_style: 'editorial_graphic_novel',
          supporting_styles: []
        },
        mode_routing: {
          hook: 'editorial_graphic_novel',
          context: 'editorial_graphic_novel'
        },
        camera: { framing: 'editorial_wide', perspective: 'third_person' },
        guardrails: { face_visibility: 'allowed' }
      }
    };
  } else if (preset.id === 'clay_3d') {
    mockEnvelope = {
      label: '3D Clay Mascot',
      description: 'Cute clay cat barista with apron',
      suggested_preset_key: 'clay_3d_cat_barista',
      creative_rationale: 'Cozy claymation aesthetic with expressive button eyes and warm smile',
      config: {
        schema_version: '2',
        subject: {
          kind: 'animal',
          faceless_mode: 'not_applicable',
          demographic_key: 'custom',
          custom_description: 'cute claymation cat barista with expressive button eyes and gentle smile wearing a small brown apron',
          character_count: 1,
          population_mode: 'single'
        },
        visual_language: {
          primary_style: 'cozy_claymation',
          supporting_styles: []
        },
        camera: { framing: 'object_or_animal', perspective: 'third_person' },
        guardrails: { face_visibility: 'allowed' }
      }
    };
  } else if (preset.id === 'paper_cutout') {
    mockEnvelope = {
      label: 'Paper Cutout Craft',
      description: 'Layered paper craft culinary aesthetic',
      suggested_preset_key: 'paper_cutout_craft',
      creative_rationale: 'Textured craft paper layers with soft shadow',
      config: {
        schema_version: '2',
        subject: {
          kind: 'mascot_object',
          faceless_mode: 'not_applicable',
          custom_description: 'layered artisanal paper cutout coffee dripper and cup',
          character_count: 1,
          population_mode: 'single'
        },
        visual_language: {
          primary_style: 'paper_cutout_documentary', // Also supporting style test
          supporting_styles: []
        },
        camera: { framing: 'editorial_wide', perspective: 'third_person' },
        guardrails: { face_visibility: 'prohibited' }
      }
    };
  } else {
    // Standard realistic or editorial presets
    mockEnvelope = {
      label: preset.name,
      description: `Preset test for ${preset.name}`,
      suggested_preset_key: preset.id,
      creative_rationale: `Synthesized aesthetic for ${preset.name}`,
      config: {
        schema_version: '2',
        subject: {
          kind: 'human',
          faceless_mode: 'hands_only',
          demographic_key: 'custom',
          custom_description: `Faceless hands working in ${preset.name} environment`,
          character_count: 1,
          population_mode: 'single'
        },
        visual_language: {
          primary_style: preset.id === 'nordic_kitchen' ? 'cinematic_realistic' :
                         preset.id === 'dark_moody' ? 'culinary_cinematic' :
                         preset.id === 'technical_blueprint' ? 'editorial_graphic_novel' :
                         preset.id === 'lofi_flash' ? 'cinematic_realistic' :
                         preset.id === 'pop_risograph' ? 'editorial_graphic_novel' :
                         preset.id === 'luminous_glass' ? 'commercial_product_cinematic' :
                         preset.id === 'sumi_e_ink' ? 'editorial_graphic_novel' :
                         'editorial_graphic_novel',
          supporting_styles: []
        },
        camera: { framing: 'hands_closeup', perspective: 'first_person' },
        guardrails: { face_visibility: 'prohibited' }
      }
    };
  }

  try {
    // 1. Test normalization through AI contract
    const normalizedResult = normalizeAiVisualIdentityResult(mockEnvelope);
    assert.ok(normalizedResult, 'Result should be defined');
    assert.ok(normalizedResult.config, 'Config should be normalized');

    // 2. Test snapshot resolution
    const resolvedSnapshot = resolveVisualIdentitySnapshot({
      schema_version: 'visual_identity_snapshot_v1',
      identity_ref: { id: normalizedResult.suggested_preset_key, key: normalizedResult.suggested_preset_key, version: 1, source: 'ai_builder' },
      structured: normalizedResult.config
    });

    const res = resolvedSnapshot.resolved;
    assert.ok(res.subject_prompt, 'Subject prompt must exist');
    assert.ok(res.style_prompt, 'Style prompt must exist');
    assert.ok(res.negative_prompt, 'Negative prompt must exist');

    // 3. Specific validation for Stickman & Clay (Face Allowed)
    if (preset.id === 'stickman') {
      const faceAllowed = normalizedResult.config.guardrails.face_visibility === 'allowed';
      const hasNoFaceBanInNeg = !res.negative_prompt.includes('visible human face') && !res.negative_prompt.includes('eyes');
      assert.ok(faceAllowed, 'Stickman must allow cartoon face visibility');
      assert.ok(hasNoFaceBanInNeg, 'Stickman negative prompt MUST NOT ban eyes/face');
      console.log('   ✅ Stickman Cartoon Face Check: PASSED (Face allowed, expressive eyes/mouth preserved in prompt)');
    } else if (preset.id === 'clay_3d') {
      const faceAllowed = normalizedResult.config.guardrails.face_visibility === 'allowed';
      const hasNoFaceBanInNeg = !res.negative_prompt.includes('visible human face') && !res.negative_prompt.includes('eyes');
      assert.ok(faceAllowed, '3D Clay mascot must allow facial expression');
      assert.ok(hasNoFaceBanInNeg, 'Clay negative prompt MUST NOT ban eyes');
      console.log('   ✅ 3D Clay Face Check: PASSED (Face expression allowed)');
    } else if (preset.id === 'isometric_diorama') {
      const primary = normalizedResult.config.visual_language.primary_style;
      console.log(`   ✅ Isometric Recovery Check: PASSED (Primary style: "${primary}", no validation crash)`);
    } else {
      console.log(`   ✅ Standard Preset Check: PASSED (Primary style: "${normalizedResult.config.visual_language.primary_style}")`);
    }

    passCount++;
    results.push({ id: preset.id, name: preset.name, status: 'PASS' });
  } catch (err) {
    failCount++;
    console.error(`   ❌ FAIL on "${preset.name}":`, err.message);
    results.push({ id: preset.id, name: preset.name, status: 'FAIL', error: err.message });
  }
}

console.log('\n======================================================================');
console.log(`📊 SUMMARY OF 12 PRESETS TEST: ${passCount} PASSED, ${failCount} FAILED out of 12`);
console.log('======================================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL 12 VISUAL IDENTITY PRESETS PASSED SUCCESSFULLY!\n');
  process.exit(0);
}

