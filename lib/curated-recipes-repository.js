import { getDb } from './db.js';
import { getActiveTenantId } from './tenant-context.js';
import crypto from 'crypto';

let isTableInitialized = false;

/**
 * Memastikan tabel curated_recipes dan indeksnya tersedia di database.
 */
export async function ensureCuratedRecipesTable() {
  if (isTableInitialized) return;
  const db = getDb();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS curated_recipes (
      id TEXT PRIMARY KEY,
      tenant_id TEXT DEFAULT 'default_tenant',
      source_url TEXT NOT NULL,
      source_domain TEXT,
      author TEXT,
      original_title TEXT NOT NULL,
      polished_title TEXT,
      original_summary TEXT,
      polished_summary TEXT,
      ingredients_raw TEXT NOT NULL,
      original_instructions TEXT,
      polished_instructions TEXT,
      prep_time TEXT,
      cook_time TEXT,
      total_time TEXT,
      servings TEXT,
      category TEXT DEFAULT 'makanan_utama',
      cuisine TEXT DEFAULT 'indonesia',
      original_image_url TEXT,
      ai_photo_prompts TEXT,
      status TEXT DEFAULT 'draft',
      polish_status TEXT DEFAULT 'unpolished',
      polish_error TEXT,
      batch_id TEXT,
      used_in_campaign_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  try {
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_curated_recipes_tenant ON curated_recipes(tenant_id)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_curated_recipes_source ON curated_recipes(source_url)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_curated_recipes_batch ON curated_recipes(batch_id)`).run();
  } catch (idxErr) {
    // Abaikan jika index sudah ada
  }

  isTableInitialized = true;
}

/**
 * Format string atau object JSON dengan aman
 */
function safeJsonStringify(val, fallback = '[]') {
  if (!val) return fallback;
  if (typeof val === 'string') {
    try {
      JSON.parse(val);
      return val;
    } catch {
      return JSON.stringify([val]);
    }
  }
  try {
    return JSON.stringify(val);
  } catch {
    return fallback;
  }
}

/**
 * Parse string JSON ke object/array dengan aman
 */
function safeJsonParse(val, fallback = []) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

/**
 * Format row dari database ke response model
 */
function formatCuratedRecipeRow(row) {
  if (!row) return null;
  return {
    ...row,
    ingredients_raw: safeJsonParse(row.ingredients_raw, []),
    original_instructions: safeJsonParse(row.original_instructions, []),
    polished_instructions: safeJsonParse(row.polished_instructions, []),
    ai_photo_prompts: safeJsonParse(row.ai_photo_prompts, [])
  };
}

/**
 * Menyimpan atau memperbarui resep otoritatif ke database.
 * STRICT GUARDRAIL: ingredients_raw disimpan 100% asli dari data scraper.
 */
export async function insertCuratedRecipe(data) {
  await ensureCuratedRecipesTable();
  const db = getDb();
  const tenantId = data.tenant_id || getActiveTenantId() || 'default_tenant';
  const id = data.id || `rcp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  const ingredientsRaw = safeJsonStringify(data.ingredients_raw, '[]');
  const originalInstructions = safeJsonStringify(data.original_instructions, '[]');
  const polishedInstructions = safeJsonStringify(data.polished_instructions, '[]');
  const aiPhotoPrompts = safeJsonStringify(data.ai_photo_prompts, '[]');

  await db.prepare(`
    INSERT OR REPLACE INTO curated_recipes (
      id, tenant_id, source_url, source_domain, author, original_title, polished_title,
      original_summary, polished_summary, ingredients_raw, original_instructions,
      polished_instructions, prep_time, cook_time, total_time, servings, category,
      cuisine, original_image_url, ai_photo_prompts, status, polish_status,
      polish_error, batch_id, used_in_campaign_count, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, CURRENT_TIMESTAMP
    )
  `).run(
    id,
    tenantId,
    data.source_url || '',
    data.source_domain || '',
    data.author || '',
    data.original_title || '',
    data.polished_title || null,
    data.original_summary || '',
    data.polished_summary || null,
    ingredientsRaw,
    originalInstructions,
    polishedInstructions,
    data.prep_time || null,
    data.cook_time || null,
    data.total_time || null,
    data.servings || null,
    data.category || 'makanan_utama',
    data.cuisine || 'indonesia',
    data.original_image_url || null,
    aiPhotoPrompts,
    data.status || 'draft',
    data.polish_status || 'unpolished',
    data.polish_error || null,
    data.batch_id || null,
    Number(data.used_in_campaign_count || 0)
  );

  return await getCuratedRecipeById(id, tenantId);
}

/**
 * Mengambil satu resep berdasarkan ID
 */
export async function getCuratedRecipeById(id, tenantId = null) {
  await ensureCuratedRecipesTable();
  const db = getDb();
  const tId = tenantId || getActiveTenantId() || 'default_tenant';

  const row = await db.prepare(`
    SELECT * FROM curated_recipes 
    WHERE id = ? AND tenant_id = ?
  `).get(id, tId);

  return formatCuratedRecipeRow(row);
}

/**
 * Mengambil resep berdasarkan URL sumber
 */
export async function getCuratedRecipeByUrl(url, tenantId = null) {
  await ensureCuratedRecipesTable();
  const db = getDb();
  const tId = tenantId || getActiveTenantId() || 'default_tenant';

  const row = await db.prepare(`
    SELECT * FROM curated_recipes 
    WHERE source_url = ? AND tenant_id = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(url, tId);

  return formatCuratedRecipeRow(row);
}

/**
 * Menampilkan daftar resep otoritatif dengan filter
 */
export async function listCuratedRecipes({
  tenantId = null,
  batchId = null,
  status = null,
  polishStatus = null,
  category = null,
  search = null,
  limit = 50,
  offset = 0
} = {}) {
  await ensureCuratedRecipesTable();
  const db = getDb();
  const tId = tenantId || getActiveTenantId() || 'default_tenant';

  let sql = `SELECT * FROM curated_recipes WHERE tenant_id = ?`;
  const params = [tId];

  if (batchId) {
    sql += ` AND batch_id = ?`;
    params.push(batchId);
  }
  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }
  if (polishStatus) {
    sql += ` AND polish_status = ?`;
    params.push(polishStatus);
  }
  if (category) {
    sql += ` AND category = ?`;
    params.push(category);
  }
  if (search) {
    sql += ` AND (original_title LIKE ? OR polished_title LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));

  const rows = await db.prepare(sql).all(...params);
  return (rows || []).map(formatCuratedRecipeRow);
}

/**
 * Menghapus resep berdasarkan ID
 */
export async function deleteCuratedRecipe(id, tenantId = null) {
  await ensureCuratedRecipesTable();
  const db = getDb();
  const tId = tenantId || getActiveTenantId() || 'default_tenant';

  await db.prepare(`
    DELETE FROM curated_recipes WHERE id = ? AND tenant_id = ?
  `).run(id, tId);

  return { success: true, id };
}

/**
 * Menambah hitungan penggunaan resep dalam campaign/video
 */
export async function incrementRecipeUsage(id, tenantId = null) {
  await ensureCuratedRecipesTable();
  const db = getDb();
  const tId = tenantId || getActiveTenantId() || 'default_tenant';

  await db.prepare(`
    UPDATE curated_recipes 
    SET used_in_campaign_count = used_in_campaign_count + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND tenant_id = ?
  `).run(id, tId);
}

