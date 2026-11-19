import { getActiveTenantId } from './tenant-context.js';
import {
  upsertResearchBatch,
  upsertResearchCandidates,
  URL_STATUSES
} from './product-research-repository.js';
import {
  decodeResearchBase64Image,
  saveResearchImage
} from './product-research-image-storage.js';

export const MAX_CANDIDATES_PER_BATCH = 100;
const URL_STATUS_SET = new Set(URL_STATUSES);

function makeIngestError(message, status = 400, code = 'INVALID_INGEST_PAYLOAD') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function stripTenantOverrideFields(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const clone = { ...obj };
  delete clone.tenant_id;
  delete clone.tenantId;
  return clone;
}

function normalizeCandidateResearchData(cand) {
  if (cand?.research_data && typeof cand.research_data === 'object' && !Array.isArray(cand.research_data)) {
    return stripTenantOverrideFields(cand.research_data);
  }
  if (cand?.researchData && typeof cand.researchData === 'object' && !Array.isArray(cand.researchData)) {
    return stripTenantOverrideFields(cand.researchData);
  }
  // Fallback: bangun research_data dari field flat jika adapter mengirim langsung
  const {
    external_candidate_id,
    externalCandidateId,
    source_url,
    sourceUrl,
    url_status,
    urlStatus,
    thumb_base64,
    thumbBase64,
    screenshot_base64,
    screenshotBase64,
    thumb_file_field,
    screenshot_file_field,
    tenant_id,
    tenantId,
    ...rest
  } = cand || {};
  return rest;
}

async function resolveMultipartImageBuffer(fileMap, candidate, kind, index) {
  if (!fileMap || fileMap.size === 0) return null;

  const extId = String(candidate?.external_candidate_id || candidate?.externalCandidateId || '').trim();
  const explicitField = kind === 'screenshot'
    ? (candidate?.screenshot_file_field || candidate?.screenshotFileField)
    : (candidate?.thumb_file_field || candidate?.thumbFileField);

  const candidateKeys = [
    explicitField,
    extId ? `${kind}_${extId}` : null,
    `${kind}[${index}]`,
    `${kind}_${index}`
  ].filter(Boolean);

  for (const fieldKey of candidateKeys) {
    const file = fileMap.get(fieldKey);
    if (file && typeof file.arrayBuffer === 'function') {
      const ab = await file.arrayBuffer();
      return Buffer.from(ab);
    }
  }
  return null;
}

/**
 * Mengurai payload ingest dari JSON body atau multipart FormData.
 * Field tenant_id di dalam payload selalu diabaikan.
 */
export async function parseResearchIngestRequest(request) {
  const contentType = String(request?.headers?.get?.('content-type') || '').toLowerCase();

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const rawPayload = formData.get('payload') || formData.get('data');
    let parsed = {};
    if (typeof rawPayload === 'string' && rawPayload.trim()) {
      try {
        parsed = JSON.parse(rawPayload);
      } catch {
        throw makeIngestError('Field JSON "payload" pada multipart/form-data tidak valid.');
      }
    } else {
      const batchRaw = formData.get('batch');
      const candRaw = formData.get('candidates');
      parsed = {
        batch: typeof batchRaw === 'string' ? JSON.parse(batchRaw || '{}') : {},
        candidates: typeof candRaw === 'string' ? JSON.parse(candRaw || '[]') : []
      };
    }

    const fileMap = new Map();
    for (const [key, value] of formData.entries()) {
      if (value && typeof value === 'object' && typeof value.arrayBuffer === 'function') {
        fileMap.set(key, value);
      }
    }

    return { payload: parsed, fileMap };
  }

  let body;
  try {
    body = await request.json();
  } catch {
    throw makeIngestError('Body JSON tidak valid.');
  }

  return { payload: body, fileMap: new Map() };
}

/**
 * Memproses ingest batch + kandidat + foto riset pada tenant terautentikasi.
 * Selalu dipanggil di dalam runAsOperatorTenant().
 */
export async function ingestProductResearchBatch({ payload, fileMap = new Map() } = {}) {
  const tenantId = getActiveTenantId();
  if (!tenantId || tenantId === '__none__') {
    throw makeIngestError('Tenant operator tidak valid.', 403, 'TENANT_REQUIRED');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw makeIngestError('Payload harus berupa objek JSON.');
  }

  // Abaikan payload.tenant_id maupun payload.batch.tenant_id sepenuhnya
  const rawBatch = (payload.batch && typeof payload.batch === 'object' && !Array.isArray(payload.batch))
    ? stripTenantOverrideFields(payload.batch)
    : stripTenantOverrideFields(payload);

  const externalBatchId = String(rawBatch.external_batch_id || rawBatch.externalBatchId || '').trim();
  if (!externalBatchId) {
    throw makeIngestError('batch.external_batch_id wajib diisi.');
  }

  const rawCandidates = payload.candidates;
  if (!Array.isArray(rawCandidates)) {
    throw makeIngestError('Field candidates wajib berupa array.');
  }
  if (rawCandidates.length > MAX_CANDIDATES_PER_BATCH) {
    throw makeIngestError(
      `Maksimal ${MAX_CANDIDATES_PER_BATCH} kandidat per batch (diterima ${rawCandidates.length}).`,
      400,
      'BATCH_CANDIDATE_LIMIT_EXCEEDED'
    );
  }

  const normalizedBatch = {
    source: String(rawBatch.source || 'teleradar').trim() || 'teleradar',
    externalBatchId,
    observedAt: rawBatch.observed_at || rawBatch.observedAt || null,
    metadata: rawBatch.metadata && typeof rawBatch.metadata === 'object'
      ? stripTenantOverrideFields(rawBatch.metadata)
      : {}
  };

  const preparedCandidates = [];
  for (let i = 0; i < rawCandidates.length; i += 1) {
    const rawCand = rawCandidates[i];
    if (!rawCand || typeof rawCand !== 'object' || Array.isArray(rawCand)) {
      preparedCandidates.push({ external_candidate_id: '' });
      continue;
    }

    const extCandId = String(rawCand.external_candidate_id || rawCand.externalCandidateId || '').trim();
    if (!extCandId) {
      preparedCandidates.push({ external_candidate_id: '' });
      continue;
    }

    const rawUrlStatus = String(rawCand.url_status || rawCand.urlStatus || 'not_researched').trim();
    const urlStatus = URL_STATUS_SET.has(rawUrlStatus) ? rawUrlStatus : 'not_researched';
    const sourceUrl = rawCand.source_url ?? rawCand.sourceUrl ?? null;

    let thumbPath = null;
    let screenshotPath = null;

    const thumbBufferFromMultipart = await resolveMultipartImageBuffer(fileMap, rawCand, 'thumb', i);
    const thumbBase64 = rawCand.thumb_base64 ?? rawCand.thumbBase64 ?? null;
    if (thumbBufferFromMultipart) {
      const saved = await saveResearchImage({
        tenantId,
        batchKey: externalBatchId,
        candidateKey: extCandId,
        kind: 'thumb',
        buffer: thumbBufferFromMultipart
      });
      thumbPath = saved.relativePath;
    } else if (thumbBase64) {
      const { buffer } = decodeResearchBase64Image(thumbBase64);
      const saved = await saveResearchImage({
        tenantId,
        batchKey: externalBatchId,
        candidateKey: extCandId,
        kind: 'thumb',
        buffer
      });
      thumbPath = saved.relativePath;
    }

    const screenshotBufferFromMultipart = await resolveMultipartImageBuffer(fileMap, rawCand, 'screenshot', i);
    const screenshotBase64 = rawCand.screenshot_base64 ?? rawCand.screenshotBase64 ?? null;
    if (screenshotBufferFromMultipart) {
      const saved = await saveResearchImage({
        tenantId,
        batchKey: externalBatchId,
        candidateKey: extCandId,
        kind: 'screenshot',
        buffer: screenshotBufferFromMultipart
      });
      screenshotPath = saved.relativePath;
    } else if (screenshotBase64) {
      const { buffer } = decodeResearchBase64Image(screenshotBase64);
      const saved = await saveResearchImage({
        tenantId,
        batchKey: externalBatchId,
        candidateKey: extCandId,
        kind: 'screenshot',
        buffer
      });
      screenshotPath = saved.relativePath;
    }

    preparedCandidates.push({
      external_candidate_id: extCandId,
      url_status: urlStatus,
      source_url: sourceUrl ? String(sourceUrl).trim() : null,
      research_data: normalizeCandidateResearchData(rawCand),
      thumb_path: thumbPath,
      screenshot_path: screenshotPath
    });
  }

  const batch = await upsertResearchBatch(normalizedBatch);
  const upsertSummary = await upsertResearchCandidates(batch.id, preparedCandidates);

  return {
    success: true,
    batch: {
      id: batch.id,
      source: batch.source,
      external_batch_id: batch.external_batch_id,
      observed_at: batch.observed_at,
      synced_at: batch.synced_at
    },
    summary: {
      total: upsertSummary.total,
      created: upsertSummary.created,
      updated: upsertSummary.updated,
      skipped: upsertSummary.skipped
    },
    candidates: upsertSummary.results
  };
}
