#!/usr/bin/env node
/**
 * Migrate legacy Indonesian Product Truth & Geometric Truth to English.
 * Only touches product_truth and geometric_truth columns; USP, category, prompts, and photos remain untouched.
 *
 * Usage:
 *   node scripts/translate-product-truths.mjs --schema dev|staging [--tenant <id>] [--limit <n>] [--apply]
 */

process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';

import pg from 'pg';

const args = process.argv.slice(2);
function getArg(name) {
  const idx = args.indexOf(name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1].trim() : null;
}

const schema = getArg('--schema');
const tenantFilter = getArg('--tenant');
const limitRaw = getArg('--limit');
const applyMode = args.includes('--apply');

if (!schema || !['dev', 'staging'].includes(schema)) {
  console.error('Argumen --schema <dev|staging> wajib diisi (nilai yang diizinkan: dev | staging).');
  process.exit(1);
}

const limitCount = limitRaw ? Math.max(1, Number.parseInt(limitRaw, 10) || 10) : (applyMode ? Infinity : 10);

// Configure schema BEFORE importing db-aware helpers
process.env.PG_SEARCH_PATH = schema;

const { ensureDbCachesLoaded } = await import('../lib/db.js');
const { getPgPool } = await import('../lib/db-pg.js');
const { tenantContext } = await import('../lib/tenant-context.js');
const { resolveModelChain, createResilientGeminiModel, executeWithKeyPool, runWithGeminiTrace } = await import('../lib/gemini.js');
const { looksIndonesian, buildBatchTruthTranslatePrompt } = await import('../lib/product-truth-language.js');

function clip(txt, maxLen = 120) {
  const s = String(txt || '').replace(/\s+/g, ' ').trim();
  if (!s) return '-';
  return s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : s;
}

async function translateBatch(items, tenantIdForAuth) {
  const prompt = buildBatchTruthTranslatePrompt(items);
  const runInTenant = async () => {
    const resolved = await resolveModelChain({ role: 'light', taskType: 'PRODUCT_ENRICHMENT' });
    const explicitKey = process.env.GEMINI_API_KEY || null;
    if (explicitKey) {
      const { model } = await createResilientGeminiModel({
        apiKey: explicitKey,
        role: 'light',
        taskType: 'PRODUCT_ENRICHMENT',
        modelName: resolved.model,
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        isExplicitKey: true
      });
      const res = await model.generateContent([{ text: prompt }]);
      return res.response.text();
    }
    return await runWithGeminiTrace({ stage: 'translate_product_truths', tenant_id: tenantIdForAuth }, () =>
      executeWithKeyPool(1, async (apiKey) => {
        const { model } = await createResilientGeminiModel({
          apiKey,
          role: 'light',
          taskType: 'PRODUCT_ENRICHMENT',
          modelName: resolved.model,
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
          isExplicitKey: true
        });
        const res = await model.generateContent([{ text: prompt }]);
        return res.response.text();
      }, { modelName: resolved.model, role: 'light', taskType: 'PRODUCT_ENRICHMENT' })
    );
  };

  const rawText = await tenantContext.run(tenantIdForAuth || 'default_tenant', runInTenant);
  const cleaned = String(rawText || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed.items) ? parsed.items : [];
}

await ensureDbCachesLoaded().catch(() => {});

const PG_CONFIG = {
  host: process.env.PG_HOST || '100.78.186.123',
  port: Number(process.env.PG_PORT || 5432),
  database: process.env.PG_DATABASE || 'maknaflow_db',
  user: process.env.PG_USER || 'makna_user',
  password: process.env.PG_PASSWORD || 'maknagridpass',
  max: 2
};

const pool = new pg.Pool(PG_CONFIG);

try {
  const params = [];
  let sql = `
    SELECT id, tenant_id, product_name, product_truth, geometric_truth
    FROM ${schema}.product_extractions
    WHERE (product_truth IS NOT NULL OR geometric_truth IS NOT NULL)
  `;
  if (tenantFilter) {
    params.push(tenantFilter);
    sql += ` AND tenant_id = $${params.length}`;
  }
  sql += ' ORDER BY tenant_id, created_at ASC';

  const res = await pool.query(sql, params);
  const candidates = res.rows.filter(
    (r) => looksIndonesian(r.product_truth) || looksIndonesian(r.geometric_truth)
  );

  const byTenant = {};
  for (const row of candidates) {
    byTenant[row.tenant_id] = (byTenant[row.tenant_id] || 0) + 1;
  }

  console.log(`\nSchema: ${schema} | Mode: ${applyMode ? 'APPLY (WRITE)' : 'DRY-RUN (READ-ONLY)'}`);
  console.log(`Total baris diperiksa: ${res.rowCount} | Terdeteksi Truth Bahasa Indonesia: ${candidates.length}`);
  console.log('\nRingkasan per tenant:');
  console.log('| Tenant | Jumlah Produk Terdeteksi Indonesia |');
  console.log('|---|---|');
  for (const [tid, count] of Object.entries(byTenant)) {
    console.log(`| ${tid} | ${count} |`);
  }

  const targetSlice = Number.isFinite(limitCount) ? candidates.slice(0, limitCount) : candidates;
  if (targetSlice.length === 0) {
    console.log('\nTidak ada produk yang perlu diterjemahkan.');
    process.exit(0);
  }

  const BATCH_SIZE = 10;
  let updatedCount = 0;
  let previewRows = [];

  for (let i = 0; i < targetSlice.length; i += BATCH_SIZE) {
    const batch = targetSlice.slice(i, i + BATCH_SIZE);
    // Group by tenant_id so each tenant uses its own key/pool when available
    const tenantGroups = new Map();
    for (const item of batch) {
      const tKey = item.tenant_id || 'default_tenant';
      if (!tenantGroups.has(tKey)) tenantGroups.set(tKey, []);
      tenantGroups.get(tKey).push(item);
    }

    for (const [tid, groupItems] of tenantGroups.entries()) {
      let translatedItems = [];
      try {
        translatedItems = await translateBatch(groupItems, tid);
      } catch (err) {
        // Fallback to default_tenant key if sandbox test tenant has no dedicated key
        if (tid !== 'default_tenant') {
          try {
            translatedItems = await translateBatch(groupItems, 'default_tenant');
          } catch (fallbackErr) {
            console.warn(`[WARN] Gagal menerjemahkan batch tenant ${tid}: ${fallbackErr.message}`);
            continue;
          }
        } else {
          console.warn(`[WARN] Gagal menerjemahkan batch tenant ${tid}: ${err.message}`);
          continue;
        }
      }

      const byId = new Map(translatedItems.map((x) => [x.id, x]));
      for (const orig of groupItems) {
        const tr = byId.get(orig.id);
        if (!tr) continue;
        const nextPt = orig.product_truth ? (tr.product_truth || orig.product_truth) : null;
        const nextGt = orig.geometric_truth ? (tr.geometric_truth || orig.geometric_truth) : null;

        previewRows.push({
          id: orig.id,
          name: orig.product_name || orig.id,
          tenant: orig.tenant_id,
          ptBefore: clip(orig.product_truth),
          ptAfter: clip(nextPt),
          gtBefore: clip(orig.geometric_truth),
          gtAfter: clip(nextGt)
        });

        if (applyMode) {
          await pool.query(
            `UPDATE ${schema}.product_extractions
             SET product_truth = $1,
                 geometric_truth = $2,
                 updated_at = NOW()
             WHERE id = $3 AND tenant_id = $4`,
            [nextPt, nextGt, orig.id, orig.tenant_id]
          );
          updatedCount++;
        }
      }
    }
  }

  console.log(`\nPreview terjemahan (${previewRows.length} dari ${candidates.length} produk):`);
  console.log('| Nama Produk | Tenant | Product Truth (Sebelum → Sesudah) | Geometric Truth (Sebelum → Sesudah) |');
  console.log('|---|---|---|---|');
  for (const row of previewRows) {
    console.log(`| ${row.name} | ${row.tenant} | ${row.ptBefore} → ${row.ptAfter} | ${row.gtBefore} → ${row.gtAfter} |`);
  }

  console.log(`\nTotal terdeteksi: ${candidates.length} | Diproses dalam run ini: ${previewRows.length} | Diperbarui ke DB: ${updatedCount}`);
} finally {
  await pool.end().catch(() => {});
  try {
    await getPgPool().end();
  } catch (_) {}
}
