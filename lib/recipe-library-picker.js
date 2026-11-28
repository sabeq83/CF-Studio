import { getDb } from './db.js';
import { getActiveTenantId } from './tenant-context.js';
import { ensureCuratedRecipesTable, getCuratedRecipeById } from './curated-recipes-repository.js';

/**
 * Normalizes array/JSON/string fields into a clean list of strings.
 */
function normalizeTextList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(v => {
      if (typeof v === 'string') return v.trim();
      if (v && typeof v === 'object') return String(v.text || v.instruction || v.step || v.name || '').trim();
      return '';
    }).filter(Boolean);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return normalizeTextList(parsed);
    } catch (_) {}
    return trimmed.split(/\r?\n/).map(s => s.replace(/^[-*\d.)\s]+/, '').trim()).filter(Boolean);
  }
  return [];
}

/**
 * Formats a curated_recipes row into an authoritative context object for Recipe Labs.
 */
export function formatCuratedRecipeSourceContext(row) {
  if (!row) return null;
  const title = (row.polished_title || row.original_title || '').trim() || 'Resep Terkurasi';
  const ingredients = normalizeTextList(row.ingredients_raw);
  const polishedSteps = normalizeTextList(row.polished_instructions);
  const originalSteps = normalizeTextList(row.original_instructions);
  const steps = polishedSteps.length > 0 ? polishedSteps : originalSteps;

  return {
    id: row.id,
    title,
    summary: (row.polished_summary || row.original_summary || '').trim(),
    ingredients,
    steps,
    prep_time: row.prep_time || null,
    cook_time: row.cook_time || null,
    total_time: row.total_time || null,
    servings: row.servings || null,
    category: row.category || 'makanan_utama',
    cuisine: row.cuisine || 'indonesia',
    used_in_campaign_count: Number(row.used_in_campaign_count || 0)
  };
}

/**
 * Resolves a recipe from Recipe Library (`curated_recipes`) either by explicit ID or auto-rotation.
 */
export async function resolveCuratedRecipeForPipeline({
  tenantId = null,
  curatedRecipeId = null,
  category = null,
  selectionMode = 'manual'
} = {}) {
  await ensureCuratedRecipesTable();
  const effectiveTenant = tenantId || getActiveTenantId() || 'default_tenant';

  if (selectionMode !== 'auto_library_rotation' && curatedRecipeId) {
    const exact = await getCuratedRecipeById(curatedRecipeId, effectiveTenant);
    if (exact) return formatCuratedRecipeSourceContext(exact);
    // Fallback lookup without strict tenant restriction if shared default_tenant
    const db = getDb();
    const fallbackRow = await db.prepare('SELECT * FROM curated_recipes WHERE id = ? LIMIT 1').get(curatedRecipeId);
    if (fallbackRow) {
      return formatCuratedRecipeSourceContext({
        ...fallbackRow,
        ingredients_raw: typeof fallbackRow.ingredients_raw === 'string' ? JSON.parse(fallbackRow.ingredients_raw || '[]') : fallbackRow.ingredients_raw,
        original_instructions: typeof fallbackRow.original_instructions === 'string' ? JSON.parse(fallbackRow.original_instructions || '[]') : fallbackRow.original_instructions,
        polished_instructions: typeof fallbackRow.polished_instructions === 'string' ? JSON.parse(fallbackRow.polished_instructions || '[]') : fallbackRow.polished_instructions
      });
    }
    return null;
  }

  const db = getDb();
  const normalizedCat = String(category || '').trim().toLowerCase();
  const useCategoryFilter = Boolean(normalizedCat) && !['all', 'semua', 'semua kategori', 'makanan'].includes(normalizedCat);

  let row = null;
  if (useCategoryFilter) {
    row = await db.prepare(`
      SELECT * FROM curated_recipes
      WHERE tenant_id = ?
        AND (LOWER(category) = ? OR LOWER(cuisine) = ?)
      ORDER BY COALESCE(used_in_campaign_count, 0) ASC,
               CASE WHEN polish_status = 'polished' THEN 0 ELSE 1 END ASC,
               created_at DESC
      LIMIT 1
    `).get(effectiveTenant, normalizedCat, normalizedCat);
  }

  if (!row) {
    row = await db.prepare(`
      SELECT * FROM curated_recipes
      WHERE tenant_id = ?
      ORDER BY COALESCE(used_in_campaign_count, 0) ASC,
               CASE WHEN polish_status = 'polished' THEN 0 ELSE 1 END ASC,
               created_at DESC
      LIMIT 1
    `).get(effectiveTenant);
  }

  if (!row) return null;

  const parseField = (val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return val; }
    }
    return [];
  };

  return formatCuratedRecipeSourceContext({
    ...row,
    ingredients_raw: parseField(row.ingredients_raw),
    original_instructions: parseField(row.original_instructions),
    polished_instructions: parseField(row.polished_instructions)
  });
}

/**
 * Increments usage counter on `curated_recipes` so auto-rotation avoids repeating recipes.
 */
export async function markCuratedRecipeUsed(curatedRecipeId, tenantId = null) {
  if (!curatedRecipeId) return false;
  await ensureCuratedRecipesTable();
  const db = getDb();
  const effectiveTenant = tenantId || getActiveTenantId() || 'default_tenant';
  await db.prepare(`
    UPDATE curated_recipes
    SET used_in_campaign_count = COALESCE(used_in_campaign_count, 0) + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ?
  `).run(curatedRecipeId, effectiveTenant);
  return true;
}
