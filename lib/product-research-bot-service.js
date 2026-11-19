import crypto from 'crypto';
import { pgQuery } from './db-pg.js';
import { getActiveTenantId } from './tenant-context.js';
import {
  listResearchBatches,
  listResearchCandidates,
  getResearchCandidateById,
  getCandidateWeeklyHistory,
  updateResearchCandidateCuration,
  resolveCandidateEffectiveUrl
} from './product-research-repository.js';
import { computeOpportunityScore } from './product-research-opportunity-score.js';
import {
  previewBulkResearchPromotion,
  promoteResearchCandidatesBulk,
  MAX_BULK_PROMOTE_IDS
} from './product-research-promotion-service.js';

export const BOT_MAX_LIST_LIMIT = 50;

function botError(message, status, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function activeTenant() {
  const t = getActiveTenantId();
  if (!t || t === '__none__') throw botError('Tenant operasional tidak tersedia.', 403, 'TENANT_REQUIRED');
  return t;
}

export function normalizeTelegramUserId(raw) {
  const v = String(raw ?? '').trim();
  if (!/^\d{3,20}$/.test(v)) {
    throw botError('telegram_user_id wajib berupa angka ID pengguna Telegram.', 400, 'INVALID_TELEGRAM_USER');
  }
  return v;
}

export async function registerTelegramIdentity({ telegramUserId, displayName = null, createdBy = null }) {
  const tenantId = activeTenant();
  const tgId = normalizeTelegramUserId(telegramUserId);
  const res = await pgQuery(
    `INSERT INTO product_research_telegram_identities (id, tenant_id, telegram_user_id, display_name, status, created_by)
     VALUES ($1, $2, $3, $4, 'active', $5)
     ON CONFLICT (tenant_id, telegram_user_id) DO UPDATE SET
       status = 'active',
       display_name = COALESCE(EXCLUDED.display_name, product_research_telegram_identities.display_name),
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [`prti_${crypto.randomUUID()}`, tenantId, tgId, displayName, createdBy]
  );
  return res.rows[0];
}

export async function revokeTelegramIdentity(telegramUserId) {
  const tenantId = activeTenant();
  const tgId = normalizeTelegramUserId(telegramUserId);
  const res = await pgQuery(
    `UPDATE product_research_telegram_identities
     SET status = 'revoked', updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $1 AND telegram_user_id = $2
     RETURNING *`,
    [tenantId, tgId]
  );
  return res.rows[0] || null;
}

/**
 * Identitas Telegram wajib terdaftar & aktif pada tenant kredensial operator.
 */
export async function requireRegisteredTelegramIdentity(telegramUserId) {
  const tenantId = activeTenant();
  const tgId = normalizeTelegramUserId(telegramUserId);
  const res = await pgQuery(
    `SELECT * FROM product_research_telegram_identities
     WHERE tenant_id = $1 AND telegram_user_id = $2 AND status = 'active'`,
    [tenantId, tgId]
  );
  if (!res.rows[0]) {
    throw botError(
      'Pengguna Telegram ini belum terdaftar untuk tenant ini. Minta admin mendaftarkan ID Telegram Anda.',
      403,
      'TELEGRAM_IDENTITY_NOT_REGISTERED'
    );
  }
  return res.rows[0];
}

export function toCompactCandidate(c) {
  const rd = c.research_data || {};
  const wc = c.weekly_comparison || null;
  const sc = c.opportunity_score || computeOpportunityScore(c);
  return {
    id: c.id,
    number: c.external_candidate_id,
    batch_id: c.batch_id,
    batch_label: c.external_batch_id || null,
    observed_at: c.observed_at || null,
    rank: rd.rank ?? null,
    name: c.curated_data?.name || rd.name || c.external_candidate_id,
    brand: c.curated_data?.brand || rd.brand || '',
    category: c.curated_data?.category || rd.category || '',
    sold_per_week: rd.sold_per_week ?? null,
    trend: rd.trend || null,
    price: rd.price ?? null,
    commission_rp: rd.commission_rp ?? null,
    url_status: c.url_status,
    curation_status: c.curation_status,
    process_status: c.process_status,
    cf_product_id: c.cf_product_id || null,
    effective_url: resolveCandidateEffectiveUrl(c) || null,
    score: { total: sc.total, max: sc.max, tier_label: sc.tier_label },
    weekly: wc
      ? {
          status: wc.status,
          match_method: wc.match_method,
          sold_delta: wc.deltas?.sold_delta ?? null,
          sold_pct: wc.deltas?.sold_pct ?? null,
          rank_delta: wc.deltas?.rank_delta ?? null,
          previous_observed_at: wc.previous?.observed_at || null
        }
      : null
  };
}

export async function listBotCandidates({
  mode = 'top',
  trend = '',
  search = '',
  batchId = '',
  limit = 10
} = {}) {
  const safeLimit = Math.min(BOT_MAX_LIST_LIMIT, Math.max(1, Number(limit) || 10));
  const batches = await listResearchBatches({ limit: 1 });
  const effectiveBatchId = batchId || batches[0]?.id || '';
  if (!effectiveBatchId) {
    return { batch: null, items: [], total: 0 };
  }
  const result = await listResearchCandidates({
    batchId: effectiveBatchId,
    trend,
    search,
    sortBy: mode === 'top' ? 'score_desc' : 'rank',
    page: 1,
    limit: Math.min(100, safeLimit * 2)
  });
  let rows = result.items.filter(c => c.curation_status !== 'archived');
  if (mode === 'top') rows = rows.filter(c => c.process_status === 'not_sent');
  const items = rows.slice(0, safeLimit).map(toCompactCandidate);
  const batch = batches.find(b => b.id === effectiveBatchId) || batches[0] || null;
  return { batch, items, total: rows.length, summary: result.summary };
}

async function resolveRefsToIds(refs) {
  const tenantId = activeTenant();
  const clean = Array.from(new Set((Array.isArray(refs) ? refs : []).map(r => String(r ?? '').trim()).filter(Boolean)));
  if (clean.length === 0) return [];
  const batches = await listResearchBatches({ limit: 1 });
  const latestBatchId = batches[0]?.id || '';
  const res = await pgQuery(
    `SELECT id, external_candidate_id
     FROM product_research_candidates
     WHERE tenant_id = $1
       AND (id = ANY($2::text[]) OR (batch_id = $3 AND external_candidate_id = ANY($2::text[])))`,
    [tenantId, clean, latestBatchId]
  );
  const byId = new Map(res.rows.map(r => [r.id, r.id]));
  const byNumber = new Map(res.rows.map(r => [r.external_candidate_id, r.id]));
  return clean.map(ref => byId.get(ref) || byNumber.get(ref) || ref);
}

export async function getBotCandidateDetail(ref) {
  const [id] = await resolveRefsToIds([ref]);
  const candidate = id ? await getResearchCandidateById(id) : null;
  if (!candidate) throw botError('Kandidat tidak ditemukan.', 404, 'CANDIDATE_NOT_FOUND');
  const history = await getCandidateWeeklyHistory(candidate);
  const score = computeOpportunityScore(candidate);
  return {
    candidate: toCompactCandidate({ ...candidate, opportunity_score: score, weekly_comparison: history?.summary || null }),
    score_breakdown: score.breakdown,
    score_note: score.note,
    weekly_history: history
  };
}

export async function getBotStatusSummary() {
  const batches = await listResearchBatches({ limit: 1 });
  const latest = batches[0] || null;
  if (!latest) return { batch: null, summary: null };
  const result = await listResearchCandidates({ batchId: latest.id, page: 1, limit: 1 });
  return { batch: latest, summary: result.summary };
}

export async function setBotCandidateUrl(ref, url, { telegramUserId }) {
  await requireRegisteredTelegramIdentity(telegramUserId);
  let parsed;
  try {
    parsed = new URL(String(url || '').trim());
  } catch {
    throw botError('Format URL listing tidak valid.', 400, 'INVALID_URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw botError('URL listing wajib menggunakan http:// atau https://.', 400, 'INVALID_URL');
  }
  const [id] = await resolveRefsToIds([ref]);
  const candidate = id ? await getResearchCandidateById(id) : null;
  if (!candidate) throw botError('Kandidat tidak ditemukan.', 404, 'CANDIDATE_NOT_FOUND');
  if (candidate.cf_product_id || ['queued', 'processing', 'in_catalog'].includes(candidate.process_status)) {
    throw botError('Kandidat sudah dikirim/masuk katalog; URL tidak dapat diubah dari bot.', 409, 'CANDIDATE_LOCKED');
  }
  await updateResearchCandidateCuration(candidate.id, {
    targetUrl: parsed.toString(),
    urlStatus: 'user'
  });
  const refreshed = await getResearchCandidateById(candidate.id);
  return toCompactCandidate(refreshed);
}

/**
 * Persetujuan via bot memakai layanan promosi yang sama dengan UI web (klaim atomik per kandidat).
 */
export async function botPromoteCandidates(refs, { telegramUserId, mode = 'preview' }) {
  const identity = await requireRegisteredTelegramIdentity(telegramUserId);
  const ids = await resolveRefsToIds(refs);
  if (mode === 'execute') {
    const requestedBy = `telegram:${identity.telegram_user_id}`;
    return promoteResearchCandidatesBulk(ids, { requestedBy });
  }
  return previewBulkResearchPromotion(ids);
}

export { MAX_BULK_PROMOTE_IDS };
