// Uji A/B prompt VO. Hanya membaca DB (SELECT) dan memanggil Gemini. Tidak menulis apa pun ke DB.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const REL = process.argv[2];
import path from 'node:path';
const OUT = path.resolve(process.argv[3]);
let lastModels = [];
const _log = console.log;
console.log = (...a) => { const m = String(a[0] ?? '').match(/menggunakan ([\w.\-]+)/); if (m) lastModels.push(m[1]); };
// Muat env aplikasi staging dari PM2 (nilai tidak dicetak)
const jl = JSON.parse(execSync('pm2 jlist', { encoding: 'utf8', maxBuffer: 64 << 20 }));
const app = jl.find(p => p.name === 'maknaflow-staging-api');
for (const [k, v] of Object.entries(app.pm2_env.env || {})) if (/^[A-Z][A-Z0-9_]*$/.test(k) && typeof v === 'string') process.env[k] = v;
for (const [k, v] of Object.entries(app.pm2_env)) if (/^[A-Z][A-Z0-9_]*$/.test(k) && typeof v === 'string' && !(k in process.env)) process.env[k] = v;
process.chdir(REL);
const imp = (m) => import(`${REL}/lib/${m}`);
const { tenantContext } = await imp('tenant-context.js');
const db = await imp('db.js');
const P = await imp('prompts.js');
const G = await imp('gemini.js');
const { parseGeminiJSON } = await imp('json-parser.js');
const N = await import('./newprompts.mjs');

const CASES = [
  { id: 'akustik_keyword', tenant: 'tnt_pt-gim-sosmed_62d0d9', type: 'pillar', item: '2123' },
  { id: 'thermal_harga_roll', tenant: 'tnt_pt-gim-sosmed_62d0d9', type: 'pillar', item: '2106' },
  { id: 'garlibee_produk', tenant: 'default_tenant', type: 'pillar', item: '2116' },
  { id: 'sasya_rantau', tenant: 'default_tenant', type: 'pillar', campaign: 'opc_261018_bq3sx3', pillar: 'Anak Rantau 101' },
  { id: 'siasat_mul_kulit', tenant: 'default_tenant', type: 'mul', task: 'mul_261114_dvz288' },
  { id: 'botani_mul_adas', tenant: 'default_tenant', type: 'mul', task: 'mul_261113_lu12u7' },
];
const only = process.argv[4] ? process.argv[4].split(',') : null;
const results = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const save = () => fs.writeFileSync(OUT, JSON.stringify(results, null, 1));

async function gen(prompt, taskType) {
  lastModels = [];
  return await G.executeWithKeyPool(1, async (apiKey) => G.generateContentFlexible({ prompt, taskType, timeoutMs: 180000, apiKey }));
}
async function genMul(prompt) {
  lastModels = [];
  const model = await G.getGeminiModel();
  const r = await model.generateContent(prompt);
  return r.response.text();
}

async function pillarInputs(c) {
  const d = db.getDb();
  let item;
  if (c.item) item = await d.prepare('SELECT * FROM pillar_campaign_items WHERE id = ?').get(c.item);
  else {
    const rows = await d.prepare('SELECT * FROM pillar_campaign_items WHERE campaign_id = ?').all(c.campaign);
    item = rows.find(r => { try { return JSON.parse(r.row_creative_payload || '{}').content_pillar === c.pillar; } catch { return false; } });
  }
  const campaign = await db.getPillarCampaign(item.campaign_id);
  const brandConfig = campaign.brand_profile_id ? await db.getBrandProfile(campaign.brand_profile_id) : null;
  const kbs = await db.getAllKnowledgeBasesWithContent();
  const rowPayload = item.row_creative_payload ? JSON.parse(item.row_creative_payload) : {};
  const rj = item.result_json ? JSON.parse(item.result_json) : {};
  const visualOverrides = rj.resolved_visual_overrides || null;
  const t = { ...campaign };
  for (const k of ['content_pillar','custom_hook','visual_action_guideline','category_cep','ws_matrix','context','vfo','strategic_angle','evidence','commercial_intent','cta_type','mandatory_outro_line']) if (rowPayload[k]) t[k] = rowPayload[k];
  if (rowPayload.content_world) t.content_world = rowPayload.content_world;
  t._rowPayload = rowPayload;
  let productData = null;
  if (Number(campaign.is_mass_production) === 1 && (rowPayload.product_name || rowPayload.target_product_name)) {
    const name = rowPayload.product_name || rowPayload.target_product_name;
    const pe = await d.prepare('SELECT product_truth, geometric_truth, packaging_type FROM product_extractions WHERE LOWER(product_name) = LOWER(?) LIMIT 1').get(name);
    productData = { product_name: name, product_description: rowPayload.product_desc || '', unique_selling_point: rowPayload.product_usp || '', packaging_type: pe?.packaging_type || '', is_in_packaging: rowPayload.is_in_packaging ?? 0, product_truth: rowPayload.product_truth || pe?.product_truth || '', geometric_truth: rowPayload.geometric_truth || pe?.geometric_truth || '' };
  }
  const isEditorial = item.content_kind === 'brand_editorial' || rowPayload.content_kind === 'brand_editorial' || rowPayload.planner_focus === 'brand_editorial' || campaign.content_pillar === 'Brand Editorial' || campaign.campaign_type === 'brand_editorial';
  const taskType = isEditorial ? 'BRAND_EDITORIAL_CREATIVE' : (productData || visualOverrides ? 'PRODUCT_CAMPAIGN_CREATIVE' : 'PILLAR_CAMPAIGN');
  return { item, campaign, brandConfig, kbs, rowPayload, rj, visualOverrides, t, productData, taskType };
}

async function runPillar(c) {
  const x = await pillarInputs(c);
  const oldPrompt = P.buildOrganicPillarPrompt(x.kbs, x.t, x.productData, x.brandConfig, x.visualOverrides);
  const clips = (x.rj.voiceover || []).length || x.t.target_clips_count || 4;
  const wpc = x.t.words_per_clip || '17-19 kata';
  const wmax = parseInt(String(wpc).split('-').pop(), 10) || 19;
  const meta = { clips, wpc, pillar: x.t.content_pillar, hook: x.t.custom_hook, taskType: x.taskType, kind: x.item.content_kind || x.rowPayload.content_kind, product: x.productData?.product_name || null, prod_vo: (x.rj.voiceover || []).map(v => v.narration) };
  const r = results[c.id] = { meta };
  save();
  const oldRaw = await gen(oldPrompt, x.taskType);
  r.m_old = lastModels.slice(); r.old = (parseGeminiJSON(oldRaw).voiceover || []).map(v => v.narration);
  save();
  const pc = { clips, wordsPerClip: wpc, totalWords: clips * wmax, brandName: x.brandConfig?.brand_name || x.campaign.account_name, brandContext: [x.brandConfig?.editorial_brand_context, x.brandConfig?.editorial_content_goal].filter(Boolean).join(' | ').slice(0, 1500), kind: meta.kind, pillar: meta.pillar, subject: x.rowPayload.content_subject, context: x.t.context, angle: x.t.strategic_angle, hook: x.t.custom_hook, product: x.productData ? { name: x.productData.product_name, desc: x.productData.product_description, usp: x.productData.unique_selling_point, truth: (x.productData.product_truth || '').slice(0, 800) } : null };
  const payloadRaw = await gen(N.buildPayloadPlannerPrompt(pc), 'BRAND_EDITORIAL_CREATIVE');
  r.m_payload = lastModels.slice(); r.payload = parseGeminiJSON(payloadRaw);
  save();
  const { prompt: newPrompt, report } = N.patchPillarPrompt(oldPrompt, r.payload, pc);
  r.patch = report;
  const newRaw = await gen(newPrompt, x.taskType);
  r.m_new = lastModels.slice(); r.new = (parseGeminiJSON(newRaw).voiceover || []).map(v => v.narration);
  r.promptLen = { old: oldPrompt.length, new: newPrompt.length };
  save();
}

async function runMul(c) {
  const d = db.getDb();
  const task = await d.prepare('SELECT * FROM re_multiplier_tasks WHERE id = ?').get(c.task);
  const asset = await d.prepare('SELECT * FROM re_deconstructed_assets WHERE id = ?').get(task.deconstruct_asset_id);
  const originalStoryboard = JSON.parse(asset.original_storyboard_json || '[]');
  const bridging = JSON.parse(task.bridging_config_json || '{}');
  const aesthetics = JSON.parse(task.vso_config_json || '{}');
  const audio = JSON.parse(task.audio_config_json || '{}');
  const productDNA = bridging.resolvedDNA || { product_name: bridging.manualProductName || '', product_description: bridging.manualProductDesc || '', unique_selling_point: bridging.manualProductUsp || '' };
  const oldPrompt = P.buildMultiplierPhase2Prompt(originalStoryboard, productDNA, aesthetics, bridging, aesthetics, audio, Number(task.row_index || 0), '');
  const prodSb = JSON.parse(task.remake_storyboard_json || '[]');
  const r = results[c.id] = { meta: { wpc: aesthetics.words_per_clip, source: originalStoryboard.map(s => s.narration_transcript || s.voice_over || ''), prod_vo: prodSb.map(s => s.narration_transcript || '') } };
  save();
  const oraw = await genMul(oldPrompt); r.m_old = lastModels.slice(); r.old = (parseGeminiJSON(oraw).storyboard || []).map(s => s.narration_transcript || s.voiceover || '');
  save();
  const { prompt: newPrompt, report } = N.patchMultiplierPrompt(oldPrompt);
  r.patch = report;
  const nraw = await genMul(newPrompt); r.m_new = lastModels.slice(); const pn = parseGeminiJSON(nraw);
  r.new = (pn.storyboard || []).map(s => s.narration_transcript || s.voiceover || '');
  r.lock = pn.source_recipe_lock || null; r.on_screen = pn.on_screen_amounts || null;
  save();
}

for (const c of CASES) {
  if (only && !only.includes(c.id)) continue;
  try {
    await tenantContext.run(c.tenant, async () => (c.type === 'pillar' ? runPillar(c) : runMul(c)));
    _log('DONE', c.id);
  } catch (e) { results[c.id] = { ...(results[c.id] || {}), error: String(e?.stack || e).slice(0, 800) }; save(); _log('ERR', c.id, String(e).slice(0, 300)); }
}
process.exit(0);
