import { WARDROBE_PRESETS, DEMOGRAPHIC_PRESETS, LIGHTING_PRESETS } from './prompts.js';

import { isStylizedCharacterVisualConfig } from './visual-identity-contract.js';

function parseVisualIdentityConfig(visualIdentity) {
  if (!visualIdentity) return {};
  const raw = visualIdentity.config !== undefined ? visualIdentity.config : visualIdentity.config_json;
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) || {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw : {};
}

function isFacelessHumanSubject({ ownerType, owner, viConfig }) {
  if (ownerType === 'character') {
    if (viConfig && isStylizedCharacterVisualConfig({ visualOverrides: viConfig })) {
      return false;
    }
    const depictionMode = String(owner?.depiction_mode || 'normal').trim().toLowerCase();
    return ['faceless', 'back_view', 'silhouette', 'hands_only'].includes(depictionMode);
  }
  if (ownerType === 'visual_identity') {
    if (isStylizedCharacterVisualConfig({ visualOverrides: viConfig })) {
      return false;
    }
    const subjectKind = String(viConfig?.subject?.kind || 'human').trim().toLowerCase();
    return subjectKind === 'human' || subjectKind === 'blank_face_3d';
  }
  return false;
}

export function buildReferenceAssetPrompt({ ownerType, owner, role, visualIdentity, customInstruction }) {
  let promptParts = [];
  let negativePromptParts = ['unclear details', 'blurry', 'low quality'];

  const viConfig = parseVisualIdentityConfig(visualIdentity);
  const isHuman = isFacelessHumanSubject({ ownerType, owner, viConfig });

  // 1. Core depiction prompt based on owner
  if (ownerType === 'character' && owner) {
    promptParts.push(owner.canonical_prompt || `${owner.name}, a character`);
    if (owner.depiction_mode === 'faceless' || owner.depiction_mode === 'hands_only') {
      promptParts.push('faceless depiction, cropped to omit the face');
      negativePromptParts.push('visible face', 'eyes', 'nose', 'mouth', 'facial features');
    } else if (owner.depiction_mode === 'back_view') {
      promptParts.push('seen from the back, back view');
      negativePromptParts.push('front view', 'face', 'eyes');
    } else if (owner.depiction_mode === 'silhouette') {
      promptParts.push('dark silhouette against bright background');
      negativePromptParts.push('face details', 'wardrobe details');
    } else if (!isHuman) {
      promptParts.push('expressive cartoon face');
    }
  } else if (ownerType === 'location' && owner) {
    promptParts.push(owner.visual_description || `${owner.name}, a beautiful location`);
    if (owner.lighting_default) {
      promptParts.push(`lit with ${owner.lighting_default}`);
    }
  } else if (ownerType === 'visual_identity' && visualIdentity) {
    const config = viConfig;
    const subjectKind = config.subject?.kind || 'human';
    const facelessMode = config.subject?.faceless_mode || 'hands_only';
    const demoKey = config.subject?.demographic_key;
    const demoPreset = (demoKey && demoKey !== 'custom' && demoKey !== 'not_applicable' && typeof DEMOGRAPHIC_PRESETS[demoKey] === 'string')
      ? DEMOGRAPHIC_PRESETS[demoKey]
      : '';

    if (isHuman) {
      let demoPrompt = demoPreset || 'a graceful Muslimah';
      if (config.subject?.custom_description) {
        demoPrompt += `, ${config.subject.custom_description}`;
      }
      promptParts.push(demoPrompt);

      if (subjectKind === 'human' || subjectKind === 'blank_face_3d') {
        if (facelessMode === 'hands_only') {
          promptParts.push('hands only, wrists covered, showcasing detailed hand gestures, omitting face, head, shoulders');
          negativePromptParts.push('face', 'head', 'eyes', 'nose', 'mouth', 'shoulders', 'chest', 'hair');
        } else if (facelessMode === 'crop_below_neck') {
          promptParts.push('cropped below neck, torso and hands only, face completely out of frame');
          negativePromptParts.push('face', 'head', 'eyes', 'nose', 'mouth', 'hair');
        } else if (facelessMode === 'back_view') {
          promptParts.push('back view, seen from behind');
          negativePromptParts.push('face', 'front view', 'eyes');
        } else if (facelessMode === 'silhouette') {
          promptParts.push('artistic silhouette, high contrast outline');
          negativePromptParts.push('face features', 'detailed textures');
        }
      }
    } else {
      const stylizedDesc = config.subject?.custom_description?.trim()
        || demoPreset
        || 'stylized 3D animated character';
      promptParts.push(stylizedDesc);
      if (config.visual_language?.primary_style === 'stylized_3d_character') {
        promptParts.push('stylized 3D animated character design, expressive cartoon face, clean silhouettes and cohesive PBR shading');
      }
    }
  } else {
    promptParts.push('a consistent visual reference asset');
  }

  // 2. Role-specific context
  if (role === 'wardrobe') {
    promptParts.push('wardrobe reference detail sheet, focusing on garment style, textures, fabrics, folds, colors');
  } else if (role === 'visual_style') {
    promptParts.push('visual style key visual, highlighting lighting, atmosphere, cozy aesthetic tone, cinematography look');
  } else if (role === 'location') {
    promptParts.push('architectural and interior space reference, real room environment, natural lighting, authentic materials and furniture details');
  } else if (role === 'palette_sheet') {
    promptParts.push('color palette swatch detail sheet, showing clean color blocks, color harmony swatches, minimalist presentation');
  } else if (role === 'character_sheet') {
    if (isHuman) {
      promptParts.push('model sheet, character sheet with multiple angles, back view, side view details, hands gestures closeups');
      promptParts.push('faceless character sheet layout, strictly omitting facial features in all panels');
      negativePromptParts.push('faces in sheet', 'front portrait face');
    } else {
      promptParts.push('model sheet, character sheet with multiple angles, front three-quarter view, side profile view, back view, expressive cartoon face, consistent proportions across all panels');
      promptParts.push('plain warm cream background, no text, no labels, no humans, no hands');
      negativePromptParts.push('photorealistic human', 'human hands', 'text', 'labels', 'watermarks');
    }
  } else if (!isHuman && ownerType === 'character') {
    promptParts.push('plain warm cream background, no text, no labels, no humans, no hands');
    negativePromptParts.push('photorealistic human', 'human hands', 'text', 'labels', 'watermarks');
  }

  // 3. Apply faceless constraints strictly for human subjects
  if (isHuman) {
    negativePromptParts.push('visible face', 'eyes', 'nose', 'mouth', 'reflection face', 'identity drift', 'wardrobe drift');
  }

  // 4. Custom instruction addition (sanitize face words ONLY for faceless human subjects)
  if (customInstruction && typeof customInstruction === 'string' && customInstruction.trim()) {
    const trimmed = customInstruction.trim();
    const effective = isHuman
      ? trimmed.replace(/(show face|with face|front face|visible eyes|detailed eyes|smile)/gi, '').trim()
      : trimmed;
    if (effective) {
      promptParts.push(effective);
    }
  }

  return {
    prompt: promptParts.filter(Boolean).join(', '),
    negative_prompt: negativePromptParts.filter(Boolean).join(', '),
    is_human: isHuman
  };
}
