/**
 * Whitelist & validation helpers for Universe Profile and Character API routes.
 * Prevents request bodies from overwriting server-generated IDs or ownership fields.
 */

export const CHARACTER_KEY_REGEX = /^[a-z0-9_]{2,64}$/;

export const ALLOWED_UNIVERSE_PROFILE_FIELDS = Object.freeze([
  'name',
  'slug',
  'premise',
  'tone',
  'knowledge_domain',
  'human_presence',
  'default_visual_style',
  'default_aspect_ratio',
  'default_scene_count',
  'default_scene_duration',
  'default_story_template',
  'cta_personality',
  'default_pillars_json',
  'default_pillars',
  'rules_json',
  'negative_prompts_json',
  'style_reference_path',
  'status',
  'version',
  'universe_type',
  'depiction_policy',
  'historical_period'
]);

export const ALLOWED_UNIVERSE_CHARACTER_FIELDS = Object.freeze([
  'name',
  'character_key',
  'species',
  'breed',
  'body_shape',
  'fur_color',
  'eye_color',
  'wardrobe',
  'personality',
  'movement_style',
  'relative_size',
  'role',
  'canonical_prompt',
  'forbidden_changes_json',
  'reference_image_path',
  'version',
  'depiction_mode',
  'reference_type',
  'historical_period'
]);

export function pickAllowedFields(body, allowedFields) {
  const result = {};
  if (!body || typeof body !== 'object') return result;
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(body, field) && body[field] !== undefined) {
      result[field] = body[field];
    }
  }
  return result;
}

export function validateCharacterKey(characterKey) {
  if (typeof characterKey !== 'string') return false;
  return CHARACTER_KEY_REGEX.test(characterKey);
}

export function buildCreateUniverseProfilePayload(body, serverId) {
  return {
    ...pickAllowedFields(body, ALLOWED_UNIVERSE_PROFILE_FIELDS),
    id: serverId
  };
}

export function buildCreateUniverseCharacterPayload(body, serverCharId, serverUniverseId) {
  return {
    ...pickAllowedFields(body, ALLOWED_UNIVERSE_CHARACTER_FIELDS),
    id: serverCharId,
    universe_id: serverUniverseId
  };
}

export function isCharacterKeyConflictError(err) {
  if (!err) return false;
  if (err.code === '23505') return true;
  const msg = String(err.message || '');
  return /idx_universe_chars_univ_key|universe_characters.*unique|duplicate key/i.test(msg);
}
