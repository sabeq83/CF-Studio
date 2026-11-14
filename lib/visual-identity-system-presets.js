import { validateAndNormalizeVisualIdentity } from './visual-identity-contract.js';

export const WAY_SIYASI_DEFAULT_ROUTING = {
  hook: 'symbolic_surrealism',
  context: 'editorial_graphic_novel',
  mechanism: 'isometric_society',
  consequence: 'editorial_graphic_novel',
  evidence_reveal: 'paper_cutout_documentary',
  conclusion: 'symbolic_surrealism'
};

export const SYSTEM_VISUAL_IDENTITIES = [
  {
    key: 'way_siyasi_editorial_system',
    version: 1,
    label: 'Wa’y Siyasi — Editorial System',
    description: 'Faceless political education through editorial, isometric, and symbolic modes.',
    config: {
      schema_version: '2',
      label: 'Wa’y Siyasi — Editorial System',
      description: 'Faceless political education through editorial, isometric, and symbolic modes.',
      subject: {
        kind: 'human',
        faceless_mode: 'featureless_editorial',
        demographic_key: 'custom',
        custom_description: 'Contemporary Southeast Asian citizens, diverse ages, everyday modest civilian attire, strictly faceless silhouettes or turned-away angles.',
        character_count: 1,
        population_mode: 'single_group_or_crowd'
      },
      visual_language: {
        primary_style: 'editorial_graphic_novel',
        supporting_styles: [
          'isometric_society',
          'symbolic_surrealism',
          'paper_cutout_documentary'
        ],
        disabled_styles: ['shadow_silhouette', 'clay_political_theater']
      },
      mode_routing: WAY_SIYASI_DEFAULT_ROUTING,
      rendering: {
        geometry: 'simplified_semi_realistic',
        textures: ['printed_paper_grain', 'editorial_ink'],
        shadow_style: 'strong_geometric',
        finish: 'matte_editorial'
      },
      composition: {
        primary_idea_count: 1,
        primary_subject_count: 1,
        negative_space: 'required',
        safe_zone: 'vertical_social_ui'
      },
      metaphor_engine: {
        enabled: true,
        pattern: 'concept_to_object_to_action'
      },
      wardrobe: {
        mode: 'fixed',
        preset_key: 'sage_muted',
        custom_description: 'Everyday modest civilian attire in charcoal, off-white, warm gray and muted beige',
        sleeve_policy: 'wrists_covered'
      },
      environment: {
        preset_key: 'general_workspace',
        custom_description: 'Editorial clean background with subtle paper texture and minimalist structural elements',
        material_palette: ['charcoal', 'off-white', 'warm gray', 'muted beige'],
        background_density: 'minimal'
      },
      lighting: {
        preset_key: 'window_daylight',
        custom_description: 'Soft directional editorial lighting with strong geometric shadows',
        color_temperature: 'warm_neutral',
        contrast: 'medium'
      },
      camera: {
        framing: 'editorial_wide',
        perspective: 'third_person',
        lens_look: 'natural_50mm',
        depth_of_field: 'shallow',
        movement: 'subtle_handheld'
      },
      style: {
        preset_key: 'editorial_graphic_novel',
        custom_description: 'Charcoal, off-white, warm gray, muted beige, maximum one accent color per scene, subtle printed paper grain and editorial ink',
        aspect_ratio: '9:16'
      },
      guardrails: {
        face_visibility: 'prohibited',
        reflection_face: 'prohibited',
        unintended_people: 'prohibited',
        extra_people: 'prohibited',
        intentional_crowd: 'allowed_faceless',
        identity_drift: 'prohibited',
        wardrobe_drift: 'prohibited',
        required_negative_prompts: ['photorealistic stock footage', 'news TV broadcast composition']
      }
    }
  },
  {
    key: 'hands_only_muslimah_sage_kitchen',
    version: 1,
    label: 'Muslimah Sage Kitchen',
    description: 'Southeast Asian Muslimah in Sage Green attire, clean hands cooking in a Nordic-style kitchen.',
    config: {
      schema_version: '2',
      label: 'Muslimah Sage Kitchen',
      description: 'Southeast Asian Muslimah in Sage Green attire, clean hands cooking in a Nordic-style kitchen.',
      subject: {
        kind: 'human',
        faceless_mode: 'hands_only',
        demographic_key: 'syari_classic',
        character_count: 1
      },
      visual_language: {
        primary_style: 'culinary_cinematic',
        supporting_styles: [],
        disabled_styles: []
      },
      wardrobe: {
        mode: 'fixed',
        preset_key: 'sage_muted',
        sleeve_policy: 'wrists_covered'
      },
      environment: {
        preset_key: 'nordic_kitchen',
        material_palette: ['white marble', 'light oak'],
        props: ['wooden utensils', 'small herbs'],
        background_density: 'balanced'
      },
      lighting: {
        preset_key: 'window_daylight',
        color_temperature: 'warm_neutral',
        contrast: 'soft'
      },
      camera: {
        framing: 'forearms_and_hands',
        perspective: 'third_person',
        lens_look: 'natural_50mm',
        depth_of_field: 'shallow',
        movement: 'subtle_handheld'
      },
      style: {
        preset_key: 'culinary_cinematic',
        aspect_ratio: '9:16'
      }
    }
  },
  {
    key: 'syari_classic_atmospheric_home',
    version: 1,
    label: "Syar'iy Classic — Atmospheric Serenity & Wholesome Home",
    description: "Serene modest Muslimah storytelling combining atmospheric weather/window storytelling, warm home tranquility, and back-view modesty for wholesome health & wellness campaigns.",
    config: {
      schema_version: '2',
      label: "Syar'iy Classic — Atmospheric Serenity & Wholesome Home",
      description: "Serene modest Muslimah storytelling combining atmospheric weather/window storytelling, warm home tranquility, and back-view modesty for wholesome health & wellness campaigns.",
      subject: {
        kind: 'human',
        faceless_mode: 'back_view',
        demographic_key: 'syari_classic',
        character_count: 1,
        population_mode: 'single',
        custom_description: "Modest Southeast Asian Muslimah filmed strictly without visible facial features. Framing balances tranquil atmospheric weather through windows, steaming herbal cups, product macros on window sill, hands in modest sleeves, or back-view modest silhouette."
      },
      visual_language: {
        primary_style: 'cinematic_realistic',
        supporting_styles: ['commercial_product_cinematic'],
        disabled_styles: ['stylized_3d_character', 'cozy_claymation', 'clay_political_theater']
      },
      wardrobe: {
        mode: 'fixed',
        preset_key: 'mocca_caramel',
        sleeve_policy: 'wrists_covered',
        custom_description: "Loose-fitting modest syar'i dress and wide khimar in soothing warm mocca, soft caramel, and gentle earth tones. Wrists completely covered down to cuff."
      },
      environment: {
        preset_key: 'custom',
        background_density: 'balanced',
        custom_description: "Cozy home interior near a rain-streaked window or warm quiet living corner, rainy outdoor garden bokeh, warm indoor wood elements, steaming herbal tea mug, window sill with honey solo garlic jar, gentle atmospheric rain droplets.",
        material_palette: ['rain-streaked glass pane', 'warm natural wood window sill', 'ceramic warm tea cup', 'linen cozy throw blanket', 'amber glass herbal jar'],
        props: ['glass jar of honey fermented solo garlic', 'ceramic tea mug with rising steam', 'droplets on window glass', 'wooden spoon']
      },
      lighting: {
        preset_key: 'window_daylight',
        color_temperature: 'warm_neutral',
        contrast: 'soft',
        custom_description: "Natural diffused daylight from rainy window blended with warm 2800K indoor accent lamp, creating cozy comforting atmosphere."
      },
      camera: {
        framing: 'environmental_wide',
        perspective: 'third_person',
        lens_look: 'natural_50mm',
        depth_of_field: 'shallow',
        movement: 'slow_pan',
        custom_description: "Cinematic atmospheric lens with gentle soft bokeh; camera emphasizes rain mood on window, back-view modest subject contemplation, and macro product details on warm sill."
      },
      composition: {
        primary_idea_count: 1,
        primary_subject_count: 1,
        negative_space: 'moderate',
        safe_zone: 'vertical_social_ui'
      },
      guardrails: {
        anti_kitchen_monotony: 'enforced',
        forbid_faceless_kitchen_only: true,
        unintended_people: 'prohibited',
        extra_people: 'prohibited',
        intentional_crowd: 'prohibited',
        identity_drift: 'prohibited',
        wardrobe_drift: 'prohibited',
        required_negative_prompts: ['kitchen tabletop chopping', 'monotonous cutting board closeup', 'exposed face', 'bare arms']
      },
      style: {
        preset_key: 'cinematic_realistic',
        aspect_ratio: '9:16'
      }
    }
  },
  {
    key: 'hands_only_southeast_asian_male',
    version: 1,
    label: 'Southeast Asian Male Casual',
    description: 'Southeast Asian male featuring clean hands with warm light-tan/olive skin, stylish wristwatch, clean casual attire in a modern workspace.',
    config: {
      schema_version: '2',
      label: 'Southeast Asian Male Casual',
      description: 'Southeast Asian male featuring clean hands with warm light-tan/olive skin, stylish wristwatch, clean casual attire in a modern workspace.',
      subject: {
        kind: 'human',
        faceless_mode: 'hands_only',
        demographic_key: 'southeast_asian_male',
        character_count: 1
      },
      visual_language: {
        primary_style: 'commercial_product_cinematic',
        supporting_styles: [],
        disabled_styles: []
      },
      wardrobe: {
        mode: 'fixed',
        preset_key: 'male_caramel',
        sleeve_policy: 'forearms_exposed'
      },
      environment: {
        preset_key: 'general_workspace',
        material_palette: ['dark oak', 'matte slate'],
        props: ['modern notebook', 'minimalist pen'],
        background_density: 'minimal'
      },
      lighting: {
        preset_key: 'window_daylight',
        color_temperature: 'warm_neutral',
        contrast: 'soft'
      },
      camera: {
        framing: 'forearms_and_hands',
        perspective: 'third_person',
        lens_look: 'natural_50mm',
        depth_of_field: 'shallow',
        movement: 'subtle_handheld'
      },
      style: {
        preset_key: 'commercial_product_cinematic',
        aspect_ratio: '9:16'
      }
    }
  },
  {
    key: 'hands_only_caucasian_male_caramel',
    version: 1,
    label: 'Caucasian Male Caramel',
    description: 'Caucasian man wearing a sophisticated caramel long-sleeve knit shirt, clean male hands in a kitchen workspace.',
    config: {
      schema_version: '2',
      label: 'Caucasian Male Caramel',
      description: 'Caucasian man wearing a sophisticated caramel long-sleeve knit shirt, clean male hands in a kitchen workspace.',
      subject: {
        kind: 'human',
        faceless_mode: 'hands_only',
        demographic_key: 'caucasian_male',
        character_count: 1
      },
      visual_language: {
        primary_style: 'commercial_product_cinematic',
        supporting_styles: [],
        disabled_styles: []
      },
      wardrobe: {
        mode: 'fixed',
        preset_key: 'male_caramel',
        sleeve_policy: 'wrists_covered'
      },
      environment: {
        preset_key: 'nordic_kitchen',
        material_palette: ['grey granite', 'dark walnut'],
        props: ['stainless steel utensils'],
        background_density: 'balanced'
      },
      lighting: {
        preset_key: 'window_daylight',
        color_temperature: 'neutral',
        contrast: 'soft'
      },
      camera: {
        framing: 'forearms_and_hands',
        perspective: 'third_person',
        lens_look: 'natural_50mm',
        depth_of_field: 'shallow',
        movement: 'subtle_handheld'
      },
      style: {
        preset_key: 'commercial_product_cinematic',
        aspect_ratio: '9:16'
      }
    }
  },
  {
    key: 'stylized_3d_muslimah_emerald',
    version: 1,
    label: '3D Muslimah Emerald',
    description: '3D stylized claymation Muslim woman in Emerald Green attire, blank face (no eyes, nose, or mouth).',
    config: {
      schema_version: '2',
      label: '3D Muslimah Emerald',
      description: '3D stylized claymation Muslim woman in Emerald Green attire, blank face (no eyes, nose, or mouth).',
      subject: {
        kind: 'blank_face_3d',
        faceless_mode: 'blank_face_3d',
        demographic_key: 'stylized_3d_muslimah',
        character_count: 1
      },
      visual_language: {
        primary_style: 'stylized_3d_character',
        supporting_styles: [],
        disabled_styles: []
      },
      wardrobe: {
        mode: 'fixed',
        preset_key: '3d_fem_emerald'
      },
      environment: {
        preset_key: 'nordic_kitchen',
        background_density: 'minimal'
      },
      lighting: {
        preset_key: 'studio_softbox',
        color_temperature: 'warm_neutral',
        contrast: 'soft'
      },
      camera: {
        framing: 'crop_below_neck',
        perspective: 'third_person',
        lens_look: 'natural_50mm',
        depth_of_field: 'shallow',
        movement: 'still'
      },
      style: {
        preset_key: 'stylized_3d_character',
        aspect_ratio: '9:16'
      }
    }
  },
  {
    key: 'mascot_herbal_ginger_guardian',
    version: 1,
    label: 'Ginger Guardian',
    description: 'Cute 3D stylized ginger root character with muscular tiny clay arms and legs.',
    config: {
      schema_version: '2',
      label: 'Ginger Guardian',
      description: 'Cute 3D stylized ginger root character with muscular tiny clay arms and legs.',
      subject: {
        kind: 'animal',
        faceless_mode: 'not_applicable',
        demographic_key: 'mascot_ginger_guardian',
        character_count: 1
      },
      visual_language: {
        primary_style: 'cozy_claymation',
        supporting_styles: [],
        disabled_styles: []
      },
      wardrobe: {
        mode: 'fixed',
        preset_key: 'not_applicable'
      },
      environment: {
        preset_key: 'nordic_kitchen',
        background_density: 'minimal'
      },
      lighting: {
        preset_key: 'studio_softbox',
        color_temperature: 'warm_neutral',
        contrast: 'soft'
      },
      camera: {
        framing: 'object_or_animal',
        perspective: 'third_person',
        lens_look: 'natural_50mm',
        depth_of_field: 'shallow',
        movement: 'still'
      },
      style: {
        preset_key: 'cozy_claymation',
        aspect_ratio: '9:16'
      }
    }
  },
  {
    key: 'cinematic_botanical_kinetics',
    version: 1,
    label: 'Cinematic Botanical Kinetics',
    description: 'Dark volcanic basalt stone, optical amber glass refractions, pure fluid kinetics, and rich golden rim lighting (3500K). Strictly object-centric and faceless.',
    config: {
      schema_version: '2',
      label: 'Cinematic Botanical Kinetics',
      description: 'Dark volcanic basalt stone, optical amber glass refractions, pure fluid kinetics, and rich golden rim lighting (3500K). Strictly object-centric and faceless.',
      subject: {
        kind: 'human',
        faceless_mode: 'hands_only',
        demographic_key: 'custom',
        custom_description: 'Faceless, strictly object-centric macro cinematography. In later solution/ritual clips, subtle POV hands with clean aesthetic wrists may gently interact with glassware or honey dippers, but Clip 1 is 100% pure isolated object kinetics with zero hands.',
        character_count: 1
      },
      visual_language: {
        primary_style: 'commercial_product_cinematic',
        supporting_styles: [],
        disabled_styles: ['3d_bio_cellular', 'stylized_3d_character', 'cozy_claymation']
      },
      wardrobe: {
        mode: 'fixed',
        preset_key: 'custom',
        custom_description: 'Minimalist charcoal dark linen, wrists covered, subtle and never prominent',
        sleeve_policy: 'wrists_covered'
      },
      environment: {
        preset_key: 'custom',
        material_palette: ['dark volcanic basalt stone slab', 'amber glass refraction', 'matte obsidian', 'clear optical borosilicate glass'],
        props: ['optical glassware', 'wooden honey dipper', 'pure fluid droplets', 'artisanal botanical elements'],
        background_density: 'minimal',
        custom_description: 'Moody luxury botanical testing laboratory with polished dark basalt stone platform, clean amber reflections, minimal optical glassware, and dark atmospheric depth.'
      },
      lighting: {
        preset_key: 'studio_softbox',
        color_temperature: 'warm_neutral',
        contrast: 'high_contrast',
        custom_description: 'Cinematic 3500K golden rim lighting, high-contrast chiaroscuro, specular micro-reflections through amber fluid, and soft fill light.'
      },
      camera: {
        framing: 'hands_closeup',
        perspective: 'third_person',
        lens_look: 'macro_closeup',
        depth_of_field: 'shallow',
        movement: 'slow_pan',
        custom_description: 'Precision macro cinematography, 100mm macro lens f/2.8, razor-sharp focus on fluid dynamics and glass refraction with creamy bokeh.'
      },
      rendering: {
        geometry: 'simplified_semi_realistic',
        textures: ['dark basalt stone grain', 'liquid amber clarity', 'optical glass reflection'],
        shadow_style: 'strong_geometric',
        finish: 'matte_editorial'
      },
      style: {
        preset_key: 'commercial_product_cinematic',
        aspect_ratio: '9:16'
      }
    }
  },
  {
    key: 'artisanal_apothecary_metaphor',
    version: 1,
    label: 'Artisanal Botanical Apothecary',
    description: 'Aged dark walnut wood, fluted amber apothecary glassware, antique brushed brass fittings, and warm afternoon 3200K sunlight. Strictly object-centric macro cinematography with faceless heritage rituals.',
    config: {
      schema_version: '2',
      label: 'Artisanal Botanical Apothecary',
      description: 'Aged dark walnut wood, fluted amber apothecary glassware, antique brushed brass fittings, and warm afternoon 3200K sunlight. Strictly object-centric macro cinematography with faceless heritage rituals.',
      subject: {
        kind: 'human',
        faceless_mode: 'hands_only',
        demographic_key: 'custom',
        custom_description: 'Faceless, strictly object-centric macro cinematography. Early clips are strictly 100% pure isolated object kinetics with zero hands. Later solution/ritual clips may feature subtle POV hands with espresso-brown linen cuffs gently lifting brass spoons or dippers.',
        character_count: 1
      },
      visual_language: {
        primary_style: 'commercial_product_cinematic',
        supporting_styles: [],
        disabled_styles: ['3d_bio_cellular', 'stylized_3d_character', 'cozy_claymation']
      },
      wardrobe: {
        mode: 'fixed',
        preset_key: 'custom',
        custom_description: 'Minimalist espresso-brown or dark amber-tan linen, wrists fully covered, heritage artisanal vibe',
        sleeve_policy: 'wrists_covered'
      },
      environment: {
        preset_key: 'custom',
        material_palette: ['aged dark walnut wood slab', 'fluted amber apothecary glassware', 'antique brushed brass fittings', 'clear borosilicate infusion coil'],
        props: ['carved olive-wood honey dipper', 'antique brass apothecary scale dish', 'graduated amber glass beaker', 'whole fermented solo garlic bulbs'],
        background_density: 'minimal',
        custom_description: 'Timeless heritage botanical apothecary with rich dark walnut workbenches, vintage fluted amber glass tinctures, warm brass balances, and soft atmospheric depth.'
      },
      lighting: {
        preset_key: 'natural_golden_hour',
        color_temperature: 'warm_golden',
        contrast: 'high_contrast',
        custom_description: 'Warm 3200K afternoon sunlight filtering through amber glass, soft chiaroscuro contrast, glowing liquid caustics on dark walnut wood, and warm golden rim reflections.'
      },
      camera: {
        framing: 'hands_closeup',
        perspective: 'third_person',
        lens_look: 'macro_closeup',
        depth_of_field: 'shallow',
        movement: 'slow_pan',
        custom_description: 'Artisanal macro cinematography, Cooke Panchro Classic vintage look, 75mm-100mm macro f/2.2, razor-sharp focus on viscous honey kinetics and textured solo garlic with creamy analog roll-off.'
      },
      rendering: {
        geometry: 'simplified_semi_realistic',
        textures: ['aged oiled walnut grain', 'glistening viscous liquid amber', 'brushed antique brass patina'],
        shadow_style: 'strong_geometric',
        finish: 'matte_editorial'
      },
      style: {
        preset_key: 'commercial_product_cinematic',
        aspect_ratio: '9:16'
      }
    }
  },
  {
    key: 'forensic_whistleblower_archive',
    version: 1,
    label: 'Forensic Evidence Desk (Whistleblower)',
    description: 'Aged dark oak desk, manila confidential dossiers, brass magnifying glass, and 3000K conical banker lamp. Strictly object-centric investigative documentary.',
    config: {
      schema_version: '2',
      label: 'Forensic Evidence Desk (Whistleblower)',
      description: 'Aged dark oak desk, manila confidential dossiers, brass magnifying glass, and 3000K conical banker lamp. Strictly object-centric investigative documentary.',
      subject: {
        kind: 'human',
        faceless_mode: 'hands_only',
        demographic_key: 'custom',
        custom_description: 'Faceless POV cinematography focusing on subtle hands with charcoal wool investigator cuffs, wrists covered, scholarly archival framing.',
        character_count: 1
      },
      visual_language: {
        primary_style: 'commercial_product_cinematic',
        supporting_styles: [],
        disabled_styles: ['3d_bio_cellular', 'stylized_3d_character', 'cozy_claymation']
      },
      wardrobe: {
        mode: 'fixed',
        preset_key: 'custom',
        custom_description: 'Charcoal wool investigator sleeve or crisp oxford shirt, wrists covered, subtle and scholarly',
        sleeve_policy: 'wrists_covered'
      },
      environment: {
        preset_key: 'custom',
        material_palette: ['aged scarred dark oak desk', 'manila confidential dossier folder', 'antique brass magnifying glass', 'stamped archival documents'],
        props: ['red ink stamps', 'optical glass distortion', 'brass paperclips', 'forensic test tags', 'glass U-tube clamp'],
        background_density: 'minimal',
        custom_description: 'Atmospheric moody investigative archive room with scarred dark mahogany desk, confidential dossier files, and shadowy background bookshelves in heavy vignette.'
      },
      lighting: {
        preset_key: 'studio_softbox',
        color_temperature: 'warm_neutral',
        contrast: 'high_contrast',
        custom_description: 'Warm 3000K conical beam from a classic green glass banker desk lamp, heavy chiaroscuro contrast, deep shadowy falloff, and specular highlights across optical glass.'
      },
      camera: {
        framing: 'hands_closeup',
        perspective: 'third_person',
        lens_look: 'macro_closeup',
        depth_of_field: 'shallow',
        movement: 'slow_pan',
        custom_description: 'Macro investigative cinematography, 100mm macro f/2.5, razor-sharp focus on paper fiber textures, stamped text, and optical lens distortion with analog film grain.'
      },
      rendering: {
        geometry: 'simplified_semi_realistic',
        textures: ['aged paper grain', 'brass patina', 'scarred dark oak wood', 'liquid amber clarity'],
        shadow_style: 'strong_geometric',
        finish: 'matte_editorial'
      },
      style: {
        preset_key: 'commercial_product_cinematic',
        aspect_ratio: '9:16'
      }
    }
  },
  {
    key: 'deductive_pinboard_matrix',
    version: 1,
    label: 'Fact-Check Pinboard (Cold Case Matrix)',
    description: 'Dense natural corkboard, taut red investigation string, medical study clippings, and hard 3800K side raking light. Strictly object-centric deductive suspense.',
    config: {
      schema_version: '2',
      label: 'Fact-Check Pinboard (Cold Case Matrix)',
      description: 'Dense natural corkboard, taut red investigation string, medical study clippings, and hard 3800K side raking light. Strictly object-centric deductive suspense.',
      subject: {
        kind: 'human',
        faceless_mode: 'hands_only',
        demographic_key: 'custom',
        custom_description: 'Faceless POV cinematography focusing on subtle hands with dark trench-coat wool cuffs, wrists covered, moody detective framing.',
        character_count: 1
      },
      visual_language: {
        primary_style: 'commercial_product_cinematic',
        supporting_styles: [],
        disabled_styles: ['3d_bio_cellular', 'stylized_3d_character', 'cozy_claymation']
      },
      wardrobe: {
        mode: 'fixed',
        preset_key: 'custom',
        custom_description: 'Dark trench coat wool sleeve or deep navy knit cuff, wrists covered, detective noir vibe',
        sleeve_policy: 'wrists_covered'
      },
      environment: {
        preset_key: 'custom',
        material_palette: ['dense natural corkboard', 'taut red woolen string', 'printed medical study clippings', 'metallic pushpins'],
        props: ['vintage arterial charts', 'yellow highlighted study texts', 'optical glass prism', 'connecting nodes', 'wooden evidence shelf'],
        background_density: 'minimal',
        custom_description: 'Dimly lit detective war-room with massive corkboard matrix covered in red strings, anatomical charts, and newspaper clippings fading into shadowy periphery.'
      },
      lighting: {
        preset_key: 'studio_softbox',
        color_temperature: 'warm_neutral',
        contrast: 'high_contrast',
        custom_description: 'Hard 3800K side raking light casting deep lateral shadows across cork grain, taut vibrating red strings, and metallic pinheads (David Fincher noir aesthetic).'
      },
      camera: {
        framing: 'hands_closeup',
        perspective: 'third_person',
        lens_look: 'macro_closeup',
        depth_of_field: 'shallow',
        movement: 'slow_pan',
        custom_description: 'Deductive macro cinematography, 50mm-90mm vintage look, f/2.2, razor-sharp focus tracking along red strings and highlighted paper clippings with subtle documentary grain.'
      },
      rendering: {
        geometry: 'simplified_semi_realistic',
        textures: ['coarse corkboard texture', 'taut woolen string fiber', 'printed paper ink', 'glass refraction'],
        shadow_style: 'strong_geometric',
        finish: 'matte_editorial'
      },
      style: {
        preset_key: 'commercial_product_cinematic',
        aspect_ratio: '9:16'
      }
    }
  },
  {
    key: 'hydraulic_pipeline_metaphor',
    version: 1,
    label: 'Hydraulic Pipeline & Pure Flow',
    description: 'High-pressure transparent borosilicate glass pipe, lipid plaque dissolution, laminar clean fluid rush, and 5000K industrial technical rim lighting. Strictly object-centric fluid mechanics.',
    config: {
      schema_version: '2',
      label: 'Hydraulic Pipeline & Pure Flow',
      description: 'High-pressure transparent borosilicate glass pipe, lipid plaque dissolution, laminar clean fluid rush, and 5000K industrial technical rim lighting. Strictly object-centric fluid mechanics.',
      subject: {
        kind: 'human',
        faceless_mode: 'hands_only',
        demographic_key: 'custom',
        custom_description: 'Faceless POV cinematography focusing on subtle hands with minimal charcoal cuffs, wrists covered, non-intrusive artisanal framing.',
        character_count: 1
      },
      visual_language: {
        primary_style: 'commercial_product_cinematic',
        supporting_styles: ['symbolic_surrealism'],
        disabled_styles: ['3d_bio_cellular', 'stylized_3d_character', 'cozy_claymation']
      },
      wardrobe: {
        mode: 'fixed',
        preset_key: 'custom',
        custom_description: 'Charcoal minimalist cuffs, wrists covered, non-intrusive',
        sleeve_policy: 'wrists_covered'
      },
      environment: {
        preset_key: 'custom',
        material_palette: ['borosilicate glass cylinder', 'brushed titanium mounting brackets', 'clear acrylic conduit', 'dark gray laboratory backdrop'],
        props: ['high-pressure couplers', 'coagulated lipid plaque deposits', 'golden amber active extract', 'pristine laminar fluid stream'],
        background_density: 'minimal',
        custom_description: 'High-tech fluid dynamics testing pavilion with dark matte gray surfaces, clean brushed steel fittings, and crystal-clear transparent glass pipelines.'
      },
      lighting: {
        preset_key: 'studio_softbox',
        color_temperature: 'cool_neutral',
        contrast: 'high_contrast',
        custom_description: 'Cool 5000K crisp directional rim lighting tracing the outer glass cylinder edges, complemented by warm 3200K amber backlighting illuminating the golden fluid clarity.'
      },
      camera: {
        framing: 'hands_closeup',
        perspective: 'third_person',
        lens_look: 'macro_closeup',
        depth_of_field: 'shallow',
        movement: 'slow_pan',
        custom_description: 'Precision macro fluid cinematography, 90mm-100mm macro f/2.8, razor-sharp focus on internal glass wall textures, lipid detachment, and silky laminar fluid motion.'
      },
      rendering: {
        geometry: 'simplified_semi_realistic',
        textures: ['optical glass refraction', 'viscous lipid sludge', 'crystalline fluid amber', 'brushed titanium'],
        shadow_style: 'strong_geometric',
        finish: 'matte_editorial'
      },
      metaphor_engine: {
        enabled: true,
        pattern: 'concept_to_object_to_action'
      },
      style: {
        preset_key: 'commercial_product_cinematic',
        aspect_ratio: '9:16'
      }
    }
  },
  {
    key: 'decompression_gauge_metaphor',
    version: 1,
    label: 'Decompression & Pressure Gauge',
    description: 'Vintage brass dial pressure gauge, vibrating red danger zone indicator, cooling relief valve, and 3500K chiaroscuro tungsten lighting. Strictly object-centric vascular decompression.',
    config: {
      schema_version: '2',
      label: 'Decompression & Pressure Gauge',
      description: 'Vintage brass dial pressure gauge, vibrating red danger zone indicator, cooling relief valve, and 3500K chiaroscuro tungsten lighting. Strictly object-centric vascular decompression.',
      subject: {
        kind: 'human',
        faceless_mode: 'hands_only',
        demographic_key: 'custom',
        custom_description: 'Faceless POV cinematography focusing on subtle hands with dark navy wool knit cuffs, wrists covered, calm and scholarly framing.',
        character_count: 1
      },
      visual_language: {
        primary_style: 'commercial_product_cinematic',
        supporting_styles: ['symbolic_surrealism'],
        disabled_styles: ['3d_bio_cellular', 'stylized_3d_character', 'cozy_claymation']
      },
      wardrobe: {
        mode: 'fixed',
        preset_key: 'custom',
        custom_description: 'Deep navy wool knit cuff, wrists covered, calm and scholarly',
        sleeve_policy: 'wrists_covered'
      },
      environment: {
        preset_key: 'custom',
        material_palette: ['aged brass gauge housing', 'dark copper pipe manifold', 'polished reclaimed teakwood', 'matte cast iron machinery'],
        props: ['circular glass gauge face', 'vibrating red needle indicator', 'brass thermal relief valve', 'soothing steam mist condensation'],
        background_density: 'minimal',
        custom_description: 'Atmospheric vintage mechanical vault with scarred teakwood workbench, aged brass gauges, copper plumbing, and calm shadowy periphery.'
      },
      lighting: {
        preset_key: 'studio_softbox',
        color_temperature: 'warm_neutral',
        contrast: 'high_contrast',
        custom_description: 'Harsh 3500K directional tungsten spotlight shifting into serene 4000K diffuse daylight as pressure normalizes, with soft golden reflections on brass rims.'
      },
      camera: {
        framing: 'hands_closeup',
        perspective: 'third_person',
        lens_look: 'macro_closeup',
        depth_of_field: 'shallow',
        movement: 'slow_pan',
        custom_description: 'Macro mechanical suspense cinematography, 100mm macro f/2.5, tight framing on needle vibration, micro steam plumes, and smooth damping deceleration.'
      },
      rendering: {
        geometry: 'simplified_semi_realistic',
        textures: ['patinated brass grain', 'scratched gauge glass', 'copper pipe oxidation', 'glistening honey drops'],
        shadow_style: 'strong_geometric',
        finish: 'matte_editorial'
      },
      metaphor_engine: {
        enabled: true,
        pattern: 'concept_to_object_to_action'
      },
      style: {
        preset_key: 'commercial_product_cinematic',
        aspect_ratio: '9:16'
      }
    }
  },
  {
    key: 'chrono_restoration_metaphor',
    version: 1,
    label: 'Chrono-Restoration & Anti-Oxidation',
    description: 'Antique mechanical crystal and brass hourglass, reverse time-lapse rust dissolution, mirror gold finish restoration, and 3000K golden sunbeams. Strictly object-centric cellular rejuvenation.',
    config: {
      schema_version: '2',
      label: 'Chrono-Restoration & Anti-Oxidation',
      description: 'Antique mechanical crystal and brass hourglass, reverse time-lapse rust dissolution, mirror gold finish restoration, and 3000K golden sunbeams. Strictly object-centric cellular rejuvenation.',
      subject: {
        kind: 'human',
        faceless_mode: 'hands_only',
        demographic_key: 'custom',
        custom_description: 'Faceless POV cinematography focusing on subtle hands with natural cream linen cuffs, wrists covered, organic timeless framing.',
        character_count: 1
      },
      visual_language: {
        primary_style: 'commercial_product_cinematic',
        supporting_styles: ['symbolic_surrealism'],
        disabled_styles: ['3d_bio_cellular', 'stylized_3d_character', 'cozy_claymation']
      },
      wardrobe: {
        mode: 'fixed',
        preset_key: 'custom',
        custom_description: 'Natural cream or off-white linen cuffs, wrists covered, timeless organic aesthetic',
        sleeve_policy: 'wrists_covered'
      },
      environment: {
        preset_key: 'custom',
        material_palette: ['crystal glass hourglass', 'antique brushed brass armature', 'chiseled dark slate slab', 'mirror-polished gold metal'],
        props: ['corroded iron cogwheel disc', 'fine dark sand grains', 'glowing golden micro-particles', 'amber antioxidant fluid wave'],
        background_density: 'minimal',
        custom_description: 'Ethereal chronological laboratory with dark slate platforms, antique brass timepieces, and radiant morning sunbeams piercing through tall windows.'
      },
      lighting: {
        preset_key: 'natural_golden_hour',
        color_temperature: 'warm_golden',
        contrast: 'high_contrast',
        custom_description: 'Volumetric 3000K golden hour sunlight, theatrical chiaroscuro shadows across pitted rust, shifting into radiant golden caustics and specular flares on restored metal.'
      },
      camera: {
        framing: 'hands_closeup',
        perspective: 'third_person',
        lens_look: 'macro_closeup',
        depth_of_field: 'shallow',
        movement: 'slow_pan',
        custom_description: 'Cinematic allegorical macro, 85mm-100mm macro f/2.0, razor-sharp focus on flaky oxidation crust, fluid wave detachment, and glowing particles.'
      },
      rendering: {
        geometry: 'simplified_semi_realistic',
        textures: ['pitted metal rust', 'crystal optical clarity', 'mirror-polished gold luster', 'viscous honey caustics'],
        shadow_style: 'strong_geometric',
        finish: 'matte_editorial'
      },
      metaphor_engine: {
        enabled: true,
        pattern: 'concept_to_object_to_action'
      },
      style: {
        preset_key: 'commercial_product_cinematic',
        aspect_ratio: '9:16'
      }
    }
  },
  {
    key: 'luxury_rheology_metaphor',
    version: 1,
    label: 'Luxury Bio-Rheology & Kinetic Fluidics',
    description: 'Polished black obsidian stone, high-viscosity sluggish drag transforming into frictionless golden Fibonacci spiral flow, and 3200K dual studio rim lighting. Ultra-luxury dark fluid physics.',
    config: {
      schema_version: '2',
      label: 'Luxury Bio-Rheology & Kinetic Fluidics',
      description: 'Polished black obsidian stone, high-viscosity sluggish drag transforming into frictionless golden Fibonacci spiral flow, and 3200K dual studio rim lighting. Ultra-luxury dark fluid physics.',
      subject: {
        kind: 'human',
        faceless_mode: 'hands_only',
        demographic_key: 'custom',
        custom_description: 'Faceless POV cinematography focusing on subtle hands with matte black tailored cuffs, wrists covered, ultra-minimalist luxury framing.',
        character_count: 1
      },
      visual_language: {
        primary_style: 'commercial_product_cinematic',
        supporting_styles: ['symbolic_surrealism'],
        disabled_styles: ['3d_bio_cellular', 'stylized_3d_character', 'cozy_claymation']
      },
      wardrobe: {
        mode: 'fixed',
        preset_key: 'custom',
        custom_description: 'Matte black tailored wool cuff, wrists covered, ultra-minimalist luxury',
        sleeve_policy: 'wrists_covered'
      },
      environment: {
        preset_key: 'custom',
        material_palette: ['mirror-polished black obsidian slab', 'matte charcoal basalt plane', 'incandescent liquid gold', 'dense dark maroon fluid'],
        props: ['viscous sluggish fluid droplet', 'active golden fermented extract drop', 'Fibonacci spiral fluid trail', 'matte black designer spoon'],
        background_density: 'minimal',
        custom_description: 'Minimalist dark luxury physics gallery with seamless black void backdrop, flawless reflective obsidian slab, and razor-sharp studio edge lighting.'
      },
      lighting: {
        preset_key: 'studio_softbox',
        color_temperature: 'warm_neutral',
        contrast: 'high_contrast',
        custom_description: 'Precision dual studio rim lighting at 3200K slicing across the black obsidian plane, illuminating viscous surface tension and glowing golden fluid spirals against deep black levels.'
      },
      camera: {
        framing: 'hands_closeup',
        perspective: 'third_person',
        lens_look: 'macro_closeup',
        depth_of_field: 'shallow',
        movement: 'slow_pan',
        custom_description: 'Apple-commercial-style high-speed macro cinematography, 100mm macro f/2.8, 1000fps capture aesthetic, tracking surface tension breakdown and seamless laminar motion.'
      },
      rendering: {
        geometry: 'simplified_semi_realistic',
        textures: ['polished obsidian reflection', 'sticky viscous lipid drag', 'glowing hydrodynamic amber', 'matte black metallic spoon'],
        shadow_style: 'strong_geometric',
        finish: 'matte_editorial'
      },
      metaphor_engine: {
        enabled: true,
        pattern: 'concept_to_object_to_action'
      },
      style: {
        preset_key: 'commercial_product_cinematic',
        aspect_ratio: '9:16'
      }
    }
  },
  {
    key: 'dapurbotani_identity_v3',
    version: 3,
    label: 'DapurBotani — Brand Identity Card v3 (Warm Herbal Home)',
    description: 'Kartu identitas visual brand DapurBotani: tangan wanita Muslimah Indonesia berlengan panjang gamis/linen tertutup, cahaya hangat natural difus, palet sage-mocca-gading-olive-terakota lembut, properti kecil kayu jati & sendok kayu. Lokasi mengikuti Content Planner.',
    config: {
      schema_version: '2',
      schema_mode: 'identity_card',
      label: 'DapurBotani — Brand Identity Card v3',
      description: 'Warm, grounded Indonesian Muslimah home wellness & botanical lifestyle. Scene location and time of day follow the Content Planner Scene Brief.',
      subject: {
        kind: 'human',
        faceless_mode: 'hands_only',
        demographic_key: 'syari_classic',
        custom_description: 'POV close-up framing focusing strictly on Indonesian Muslimah female hands wearing modest loose long-sleeve linen gamis completely covering forearms down to the wrists, warm olive-light Southeast Asian skin tone, gentle neat natural fingernails.',
        character_count: 1
      },
      visual_language: {
        primary_style: 'cinematic_realistic',
        supporting_styles: ['culinary_cinematic', 'symbolic_surrealism', '3d_bio_cellular'],
        disabled_styles: ['editorial_graphic_novel', 'isometric_society', 'clay_political_theater', 'cozy_claymation']
      },
      wardrobe: {
        mode: 'stable_random',
        preset_key: 'custom',
        sleeve_policy: 'wrists_covered',
        palette: ['Muted Sage Green', 'Soft Mocca', 'Warm Ivory Cream', 'Earthy Olive', 'Dusty Terracotta'],
        custom_description: 'Single solid modest loose long-sleeve linen gamis covering wrists completely, plain unprinted fabric per video'
      },
      environment: {
        policy: 'planner_driven',
        preset_key: 'custom',
        fallback_location: 'Warm natural wooden Indonesian kitchen counter or dining nook with uncluttered tabletop',
        custom_description: 'Fallback only: warm natural wooden home tabletop when planner specifies no room'
      },
      lighting: {
        preset_key: 'window_daylight',
        color_temperature: 'warm',
        contrast: 'soft',
        character: 'Warm organic diffused natural directional light that stays well-lit, clean, and never dark/gloomy (matches planner time of day; even night scenes stay clearly illuminated so hands and objects remain bright and readable)',
        custom_description: 'Well-lit warm diffused directional light adapting cleanly to the Scene Brief time of day without murky shadows'
      },
      camera: {
        framing: 'hands_closeup',
        perspective: 'third_person',
        lens_look: 'natural_50mm',
        depth_of_field: 'shallow',
        movement: 'subtle_handheld'
      },
      rendering: {
        geometry: 'simplified_semi_realistic',
        textures: ['natural_film_grain', 'tactile_organic_fabric', 'ceramic_matte_glaze'],
        shadow_style: 'soft_ambient',
        finish: 'soft_matte'
      },
      signature_accents: [
        'small warm teak wood coaster or board',
        'wooden honey spoon or cream matte ceramic bowl'
      ],
      style_limits: {
        max_3d_clips: 1,
        allow_3d_only_angles: ['scientific_proof', 'intellectual_flex', 'problem_you_didnt_know', 'one_feature_obsession'],
        allow_cartoon: false
      },
      metaphor_engine: {
        enabled: false,
        pattern: 'concept_to_object_to_action',
        environment_policy: 'planner_driven',
        hands_policy: 'modest_hands_active'
      },
      style: {
        preset_key: 'cinematic_realistic',
        aspect_ratio: '9:16'
      }
    }
  },
  {
    key: 'siasatsehat_identity_v3',
    version: 3,
    label: 'SiasatSehat — Brand Identity Card v3 (Smart Casual Editorial)',
    description: 'Kartu identitas visual brand SiasatSehat: tangan pria dewasa Indonesia, lengan bawah atau kemeja digulung rapi hingga siku diizinkan, pencahayaan netral-cerah modern, palet navy-charcoal-slate-olive. Lokasi mengikuti Content Planner.',
    config: {
      schema_version: '2',
      schema_mode: 'identity_card',
      label: 'SiasatSehat — Brand Identity Card v3',
      description: 'Smart, evidence-minded adult Indonesian lifestyle & practical health cinematography. Location and lighting mood follow the Content Planner Scene Brief.',
      subject: {
        kind: 'human',
        faceless_mode: 'hands_only',
        demographic_key: 'southeast_asian_male',
        custom_description: 'POV framing focusing on adult Indonesian male hands and forearms, light-medium brown warm Southeast Asian skin tone, clean trimmed fingernails, sleeves rolled neatly to elbow or tailored cuff.',
        character_count: 1
      },
      visual_language: {
        primary_style: 'cinematic_realistic',
        supporting_styles: ['commercial_product_cinematic', 'symbolic_surrealism', '3d_bio_cellular'],
        disabled_styles: ['cozy_claymation', 'clay_political_theater']
      },
      wardrobe: {
        mode: 'stable_random',
        preset_key: 'custom',
        sleeve_policy: 'forearms_exposed',
        palette: ['Deep Navy', 'Matte Charcoal', 'Cool Slate Grey', 'Muted Olive'],
        custom_description: 'Clean casual shirt or textured polo with sleeves neatly rolled to elbow or tailored wrist, solid single color per video'
      },
      environment: {
        policy: 'planner_driven',
        preset_key: 'custom',
        fallback_location: 'Minimalist charcoal-grey desk or modern indoor dining surface with clean negative space',
        custom_description: 'Fallback only: clean modern desk or matte charcoal surface when planner specifies no room'
      },
      lighting: {
        preset_key: 'window_daylight',
        color_temperature: 'neutral',
        contrast: 'medium',
        character: 'Crisp clean neutral-cool daylight or practical desk contrast with sharp micro-detail (adapts to planner time of day)',
        custom_description: 'Crisp clean balanced lighting adapting to the Scene Brief time of day'
      },
      camera: {
        framing: 'forearms_and_hands',
        perspective: 'third_person',
        lens_look: 'natural_50mm',
        depth_of_field: 'medium',
        movement: 'subtle_handheld'
      },
      rendering: {
        geometry: 'simplified_semi_realistic',
        textures: ['crisp_editorial_clarity', 'matte_brushed_metal', 'clear_glass_refraction'],
        shadow_style: 'strong_geometric',
        finish: 'matte_editorial'
      },
      signature_accents: [
        'minimalist silver steel wristwatch',
        'plain clear borosilicate glass or matte notebook'
      ],
      style_limits: {
        max_3d_clips: 1,
        allow_3d_only_angles: ['scientific_proof', 'intellectual_flex', 'problem_you_didnt_know', 'one_feature_obsession'],
        allow_cartoon: false
      },
      metaphor_engine: {
        enabled: true,
        pattern: 'concept_to_object_to_action',
        environment_policy: 'brand_locked',
        hands_policy: 'zero_hands',
        product_entry: 'after_bridge',
        lighting_arc: 'none'
      },
      style: {
        preset_key: 'cinematic_realistic',
        aspect_ratio: '9:16'
      }
    }
  },
  {
    key: 'nutriblend_identity_v3',
    version: 3,
    label: 'NutriBlend — Brand Identity Card v3 (Fresh Airy Everyday)',
    description: 'Kartu identitas visual brand NutriBlend: tangan wanita muda Indonesia dengan jersey sporty atau kemeja kasual lengan panjang menutup pergelangan, palet mint pastel-coral lembut-putih gading-terakota muda, cahaya terang segar. Lokasi mengikuti Content Planner.',
    config: {
      schema_version: '2',
      schema_mode: 'identity_card',
      label: 'NutriBlend — Brand Identity Card v3',
      description: 'Fresh, bright, approachable active Indonesian everyday wellness style. Location and time of day follow the Content Planner Scene Brief.',
      subject: {
        kind: 'human',
        faceless_mode: 'hands_only',
        demographic_key: 'syari_classic',
        custom_description: 'POV close-up framing focusing strictly on young Indonesian female hands wearing modest long-sleeve breathable sporty jersey or casual relaxed shirt covering wrists completely, natural Southeast Asian skin tone.',
        character_count: 1
      },
      visual_language: {
        primary_style: 'cinematic_realistic',
        supporting_styles: ['culinary_cinematic', 'symbolic_surrealism', '3d_bio_cellular'],
        disabled_styles: ['editorial_graphic_novel', 'clay_political_theater', 'cozy_claymation']
      },
      wardrobe: {
        mode: 'stable_random',
        preset_key: 'custom',
        sleeve_policy: 'wrists_covered',
        palette: ['Pastel Mint', 'Soft Peach Coral', 'Crisp Ivory White', 'Light Terracotta'],
        custom_description: 'Solid pastel long-sleeve sporty active top or casual breathable cotton shirt covering wrists completely, single uniform solid color per video'
      },
      environment: {
        policy: 'planner_driven',
        preset_key: 'custom',
        fallback_location: 'Bright airy light-wood tabletop or clean home kitchen island with daylight',
        custom_description: 'Fallback only: bright airy light-wood tabletop when planner specifies no room'
      },
      lighting: {
        preset_key: 'window_daylight',
        color_temperature: 'warm_neutral',
        contrast: 'soft',
        character: 'Bright airy soft-diffused daylight with fresh clean highlights (adapts to planner time of day)',
        custom_description: 'Bright airy crisp light adapting smoothly to the Scene Brief time of day'
      },
      camera: {
        framing: 'hands_closeup',
        perspective: 'third_person',
        lens_look: 'natural_50mm',
        depth_of_field: 'shallow',
        movement: 'subtle_handheld'
      },
      rendering: {
        geometry: 'simplified_semi_realistic',
        textures: ['clean_matte_pastel', 'fresh_condensation_droplets', 'light_oak_grain'],
        shadow_style: 'soft_ambient',
        finish: 'soft_matte'
      },
      signature_accents: [
        'tall clear tumbler glass or minimalist shaker',
        'subtle pastel mint linen napkin or ceramic coaster'
      ],
      style_limits: {
        max_3d_clips: 1,
        allow_3d_only_angles: ['scientific_proof', 'intellectual_flex', 'problem_you_didnt_know', 'one_feature_obsession'],
        allow_cartoon: false
      },
      metaphor_engine: {
        enabled: false,
        pattern: 'concept_to_object_to_action',
        environment_policy: 'planner_driven',
        hands_policy: 'modest_hands_active'
      },
      style: {
        preset_key: 'cinematic_realistic',
        aspect_ratio: '9:16'
      }
    }
  }
];

export function listSystemVisualIdentities() {
  return SYSTEM_VISUAL_IDENTITIES.map(preset => ({
    ...preset,
    config: validateAndNormalizeVisualIdentity(preset.config)
  }));
}

export function getSystemVisualIdentity(key) {
  if (!key) return null;
  const normalizedKey = key.startsWith('vi_') ? key.slice(3) : key;
  const preset = SYSTEM_VISUAL_IDENTITIES.find(p => p.key === key || p.key === normalizedKey);
  if (!preset) return null;
  return {
    ...preset,
    config: validateAndNormalizeVisualIdentity(preset.config)
  };
}
