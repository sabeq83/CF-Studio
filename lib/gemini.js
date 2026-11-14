import { AsyncLocalStorage } from 'node:async_hooks';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager, GoogleAICacheManager } from '@google/generative-ai/server';
import { getSetting, setSetting, getAvailableApiKey, incrementKeyUsage, markKeyExhausted, markApiKeyStatus, DEFAULT_POOL_MODEL, normalizePoolModelName } from './db.js';
import { getStitchedMasterKB } from './kb-stitcher.js';

import { getActiveTenantId } from './tenant-context.js';
import { recordAiTokenUsage } from './ai-token-meter.js';

const geminiTraceStorage = new AsyncLocalStorage();
const keyPoolAttemptStorage = new AsyncLocalStorage();

// Optional dependency injection hook for isolated unit testing without hitting DB/network
let _testHooks = null;
export function __setGeminiTestHooks(hooks = null) {
  _testHooks = hooks;
}

export function runWithGeminiTrace(traceContext = {}, fn) {
  const prev = geminiTraceStorage.getStore() || {};
  const merged = { ...prev, ...(traceContext || {}) };
  return geminiTraceStorage.run(merged, fn);
}

export function getCurrentGeminiTrace() {
  return geminiTraceStorage.getStore() || {};
}

function extractHttpStatusFromError(error) {
  if (!error) return 500;
  const direct = Number(error.status || error.statusCode || error?.response?.status);
  if (Number.isFinite(direct) && direct >= 100) return direct;
  const msg = String(error.message || '');
  const bracketMatch = msg.match(/\[(\d{3})\b/);
  if (bracketMatch) return Number(bracketMatch[1]);
  const statusMatch = msg.match(/\bstatus[:=\s]+(\d{3})\b/i) || msg.match(/\b(400|401|403|404|408|429|500|502|503|504)\b/);
  if (statusMatch) return Number(statusMatch[1]);
  if (/timed?\s*out|timeout|aborted/i.test(msg)) return 408;
  if (/resource_exhausted|quota|rate limit/i.test(msg)) return 429;
  return 500;
}

export async function recordGeminiHttpCall({
  modelName,
  stage = null,
  attempt = 0,
  durationMs = 0,
  httpStatus = 200,
  ok = true,
  usageMetadata = null,
  error = null,
  trace = null
} = {}) {
  const activeTrace = { ...(getCurrentGeminiTrace() || {}), ...(trace || {}) };
  const resolvedStage = stage || activeTrace.stage || 'general_ai';
  const normalizedModel = normalizePoolModelName(modelName);
  const poolCtx = keyPoolAttemptStorage.getStore();

  const keyLabel = poolCtx?.keyId ? `pool#${poolCtx.keyId}` : (poolCtx?.keySource || 'explicit_or_single');
  const promptTok = Number(usageMetadata?.promptTokenCount || 0);
  const candTok = Number(usageMetadata?.candidatesTokenCount || 0);
  const cachedTok = Number(usageMetadata?.cachedContentTokenCount || 0);
  const totalTok = Number(usageMetadata?.totalTokenCount || (promptTok + candTok));
  const errSnippet = error ? ` err="${String(error.message || error).replace(/\s+/g, ' ').slice(0, 140)}"` : '';

  console.log(
    `[GEMINI_CALL] campaign=${activeTrace.campaign_id ?? '-'} item=${activeTrace.item_id ?? '-'} stage=${resolvedStage} clip=${activeTrace.clip_index ?? '-'} model=${normalizedModel} key=${keyLabel} attempt=${Number(attempt || 0) + 1} status=${httpStatus} ok=${ok ? 'true' : 'false'} in=${promptTok} out=${candTok} cache=${cachedTok} total=${totalTok} ms=${Math.max(0, Math.round(durationMs || 0))}${errSnippet}`
  );

  if (poolCtx && poolCtx.keyId) {
    poolCtx.trackedCount = (poolCtx.trackedCount || 0) + 1;
    poolCtx.lastModel = normalizedModel;
    const incFn = _testHooks?.incrementKeyUsage || incrementKeyUsage;
    try {
      await incFn(poolCtx.keyId, 1, normalizedModel);
    } catch (incErr) {
      console.warn('[GEMINI_CALL] Failed to increment key usage:', incErr.message);
    }
  }

  const recordFn = _testHooks?.recordAiTokenUsage || recordAiTokenUsage;
  if (usageMetadata) {
    recordFn({
      tenantId: activeTrace.tenant_id || getActiveTenantId(),
      feature: resolvedStage,
      model: normalizedModel,
      usageMetadata,
      meta: {
        campaign_id: activeTrace.campaign_id ?? null,
        item_id: activeTrace.item_id ?? null,
        stage: resolvedStage,
        clip_index: activeTrace.clip_index ?? null,
        attempt: Number(attempt || 0) + 1,
        http_status: httpStatus,
        ok: Boolean(ok)
      }
    }).catch(e => console.warn('[AI Token Meter] Record error:', e.message));
  }
}

/**
 * Resolve API key: pool first, then single key from settings as fallback.
 */
async function resolveApiKey(explicitKey = null) {
  if (explicitKey) return explicitKey;
  
  const rawTenantId = getActiveTenantId();
  const tenantId = (!rawTenantId || rawTenantId === '__none__') ? 'default_tenant' : rawTenantId;
  const apiTier = getSetting('gemini_api_tier') || 'paid';
  if (apiTier === 'paid') {
    let singleKey = getSetting('gemini_api_key', false);
    if (!singleKey && (tenantId === 'default_tenant' || !rawTenantId || rawTenantId === '__none__')) {
      singleKey = process.env.GEMINI_API_KEY;
    }
    if (singleKey) {
      return singleKey;
    }
    const keyEntry = await getAvailableApiKey(1);
    if (keyEntry) {
      return keyEntry.api_key;
    }
    if (process.env.GEMINI_API_KEY) {
      return process.env.GEMINI_API_KEY;
    }
    throw new Error(`Gemini API Key untuk tenant (${tenantId}) belum dikonfigurasi. Silakan masukkan API Key Anda di menu Settings.`);
  } else {
    // Free Tier -> Use rotated free API key
    const keyEntry = await getAvailableApiKey(1);
    if (keyEntry) {
      return keyEntry.api_key;
    }
    // Fallback to single key or env
    let singleKey = getSetting('gemini_api_key', false);
    if (!singleKey && (tenantId === 'default_tenant' || !rawTenantId || rawTenantId === '__none__')) {
      singleKey = process.env.GEMINI_API_KEY;
    }
    if (singleKey) {
      return singleKey;
    }
    if (process.env.GEMINI_API_KEY) {
      return process.env.GEMINI_API_KEY;
    }
    throw new Error(`Gemini API Key untuk tenant (${tenantId}) belum dikonfigurasi. Silakan masukkan API Key Anda di menu Settings.`);
  }
}

export const GEMINI_CASCADE_ORDER_PAID = [
  'gemini-2.5-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-flash-latest'
];

export const GEMINI_CASCADE_ORDER_FREE = [
  'gemini-2.5-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest'
];

export const GEMINI_CASCADE_ORDER = GEMINI_CASCADE_ORDER_FREE;

export const MODULE_MODEL_MATRIX = {
  SCRAPER: { paid: 'gemini-1.5-flash-8b', free: 'gemini-3.6-flash', useKB: false },
  OCR_EXTRACTION: { paid: 'gemini-1.5-flash-8b', free: 'gemini-3.6-flash', useKB: false },
  COMPLIANCE: { paid: 'gemini-2.5-flash', free: 'gemini-3.6-flash', useKB: false },
  DECONSTRUCT: { paid: 'gemini-2.5-flash', free: 'gemini-3.6-flash', useKB: false },
  CAMPAIGN_PLANNER: { paid: 'gemini-3.6-flash', free: 'gemini-3.6-flash', useKB: true },
  PILLAR_CAMPAIGN: { paid: 'gemini-3.6-flash', free: 'gemini-3.6-flash', useKB: true },
  BRAND_EDITORIAL_CREATIVE: { paid: 'gemini-3.6-flash', free: 'gemini-3.6-flash', useKB: false },
  PRODUCT_CAMPAIGN_CREATIVE: { paid: 'gemini-3.6-flash', free: 'gemini-3.6-flash', useKB: false },
  RE_CAMPAIGN: { paid: 'gemini-3.6-flash', free: 'gemini-3.6-flash', useKB: false },
  RECIPE_LABS: { paid: 'gemini-3.6-flash', free: 'gemini-3.6-flash', useKB: true },
  RECIPE_CAMPAIGN_CREATIVE: { paid: 'gemini-3.6-flash', free: 'gemini-3.6-flash', useKB: false },
  INSTANT_FACTORY: { paid: 'gemini-3.6-flash', free: 'gemini-3.6-flash', useKB: true },
  MULTIPLIER_LAB: { paid: 'gemini-3.6-flash', free: 'gemini-3.6-flash', useKB: false },
  BRIDGE_INJECT: { paid: 'gemini-3.6-flash', free: 'gemini-3.6-flash', useKB: false },
  SHEETS_AUTOPILOT: { paid: 'gemini-3.6-flash', free: 'gemini-3.6-flash', useKB: true },
  CONTENT_AUTOMATION: { paid: 'gemini-3.6-flash', free: 'gemini-3.6-flash', useKB: true },
  YOUTUBE_STUDIO: { paid: 'gemini-3.7-flash', free: 'gemini-3.7-flash', useKB: true }
};

export const GEMINI_MODELS = {
  PRIMARY: 'gemini-3.6-flash',
  FALLBACK_1: 'gemini-3.7-flash',
  FALLBACK_2: 'gemini-3.6-flash',
  TTS: 'gemini-2.5-flash-preview-tts',
  SCRAPER: 'gemini-1.5-flash-8b',
  COMPLIANCE: 'gemini-3.6-flash'
};

export async function resolveModelForTask(taskType = 'CAMPAIGN_PLANNER', modelOverride = null) {
  // 1. Explicit model override from caller
  if (modelOverride && typeof modelOverride === 'string' && modelOverride.trim()) {
    return modelOverride.trim();
  }

  const tier = (await getSetting('gemini_api_tier')) || 'paid';
  const savedPrimary = await getSetting('gemini_model_primary');

  // 2. Creative tasks ALWAYS honor the user's explicit Primary Model from Menu Settings
  const isCreativeTask = !taskType || [
    'CAMPAIGN_PLANNER',
    'PILLAR_CAMPAIGN',
    'BRAND_EDITORIAL_CREATIVE',
    'PRODUCT_CAMPAIGN_CREATIVE',
    'RE_CAMPAIGN',
    'RECIPE_LABS',
    'RECIPE_CAMPAIGN_CREATIVE',
    'INSTANT_FACTORY',
    'MULTIPLIER_LAB',
    'BRIDGE_INJECT',
    'SHEETS_AUTOPILOT',
    'CONTENT_AUTOMATION',
    'YOUTUBE_STUDIO'
  ].includes(taskType);

  if (isCreativeTask && savedPrimary && typeof savedPrimary === 'string' && savedPrimary.trim()) {
    return savedPrimary.trim();
  }

  const smartRouting = (await getSetting('gemini_smart_routing')) !== 'off';

  // 3. For specialized micro-tasks (Scraper, OCR, Compliance, Deconstruct), smart routing picks lightweight models
  if (smartRouting && taskType && MODULE_MODEL_MATRIX[taskType]) {
    return tier === 'paid' ? MODULE_MODEL_MATRIX[taskType].paid : MODULE_MODEL_MATRIX[taskType].free;
  }

  return (savedPrimary && savedPrimary.trim()) || (tier === 'paid' ? 'gemini-3.6-flash' : 'gemini-3.6-flash');
}

export async function getModelWaterfallChain(startingModel = null, explicitTier = null) {
  const tier = explicitTier || (await getSetting('gemini_api_tier')) || 'paid';
  let savedPrimary = null;
  let savedFallback = null;
  try {
    savedPrimary = await getSetting('gemini_model_primary');
    savedFallback = await getSetting('gemini_model_fallback');
  } catch (_) {}

  let primary = (startingModel && startingModel.trim()) || (savedPrimary && savedPrimary.trim()) || 'gemini-3.6-flash';
  let fallback = (savedFallback && savedFallback.trim()) || null;

  const defaultCascade = tier === 'paid' ? GEMINI_CASCADE_ORDER_PAID : GEMINI_CASCADE_ORDER_FREE;

  // Dynamically build chain: [Primary, Fallback (if distinct), ...remaining models]
  const dynamicChain = [primary];
  if (fallback && fallback !== primary) {
    dynamicChain.push(fallback);
  }
  for (const model of defaultCascade) {
    if (!dynamicChain.includes(model)) {
      dynamicChain.push(model);
    }
  }

  return dynamicChain;
}

export async function getResolvedGeminiModels({ taskType = null, explicitTier = null } = {}) {
  const tier = explicitTier || (await getSetting('gemini_api_tier')) || 'paid';
  const smartRouting = (await getSetting('gemini_smart_routing')) !== 'off';

  let primary = tier === 'paid' ? 'gemini-3.6-flash' : 'gemini-3.6-flash';
  let fallback = tier === 'paid' ? 'gemini-3.6-flash' : 'gemini-3.7-flash';
  try {
    const savedPrimary = await getSetting('gemini_model_primary');
    if (savedPrimary && typeof savedPrimary === 'string' && savedPrimary.trim()) {
      primary = savedPrimary.trim();
    }
    const savedFallback = await getSetting('gemini_model_fallback');
    if (savedFallback && typeof savedFallback === 'string' && savedFallback.trim()) {
      fallback = savedFallback.trim();
    }
  } catch (_) {}

  let resolvedPrimary = primary;
  const isMicroTask = taskType && ['SCRAPER', 'OCR_EXTRACTION', 'COMPLIANCE', 'DECONSTRUCT'].includes(taskType);
  if (smartRouting && isMicroTask && MODULE_MODEL_MATRIX[taskType]) {
    resolvedPrimary = tier === 'paid' ? MODULE_MODEL_MATRIX[taskType].paid : MODULE_MODEL_MATRIX[taskType].free;
  }

  return {
    PRIMARY: primary,
    FALLBACK_1: fallback,
    FALLBACK_2: 'gemini-3.6-flash',
    TTS: 'gemini-2.5-flash-preview-tts',
    SCRAPER: tier === 'paid' ? 'gemini-1.5-flash-8b' : 'gemini-3.6-flash',
    COMPLIANCE: 'gemini-3.6-flash',
    resolvedPrimary
  };
}

/**
 * Determine the appropriate action (retry, cascade, or throw) when an error occurs during model generation
 */
export function getCascadeAction(error, attempt, hasNextModel) {
  const status = error.status || (error.message?.match(/\[(\d{3})\b/)?.[1] ? parseInt(error.message.match(/\[(\d{3})\b/)[1], 10) : null);
  const msg = (error.message || '').toLowerCase();

  // 1. 404 / Model Not Found / No longer available to new users / Deprecated -> Immediate cascade without retrying dead model
  const is404 = status === 404 ||
                msg.includes('404') ||
                msg.includes('not found') ||
                msg.includes('no longer available') ||
                msg.includes('is not supported');
  if (is404) {
    if (hasNextModel) {
      return { action: 'cascade', reason: '404 Model Unavailable / Deprecated' };
    }
  }

  // 2. 503 / High Demand / Service Unavailable / Overloaded
  const is503 = status === 503 ||
                msg.includes('503') ||
                msg.includes('service unavailable') ||
                msg.includes('high demand') ||
                msg.includes('overloaded');
  if (is503) {
    if (hasNextModel && attempt >= 1) {
      return { action: 'cascade', reason: '503 High Demand' };
    }
    if (attempt < 3) {
      const delayMs = Math.pow(2, attempt) * 2000 + Math.floor(Math.random() * 500);
      return { action: 'retry', delayMs, reason: `503 High Demand (attempt ${attempt + 1}/4)` };
    }
    if (hasNextModel) {
      return { action: 'cascade', reason: '503 High Demand' };
    }
  }

  // 3. 429 / Rate Limit / Quota Exceeded
  const is429 = status === 429 ||
                msg.includes('429') ||
                msg.includes('quota') ||
                msg.includes('resource has been exhausted') ||
                msg.includes('rate limit');
  if (is429) {
    if (attempt < 3) {
      const delayMs = Math.pow(2, attempt) * 4000 + Math.floor(Math.random() * 1000);
      return { action: 'retry', delayMs, reason: `429 Rate Limit (attempt ${attempt + 1}/4)` };
    }
    if (hasNextModel) {
      return { action: 'cascade', reason: '429 Rate Limit' };
    }
  }

  // 4. Timeout / Deadline Exceeded / Aborted -> Cascade ke model cadangan berikutnya jika tersedia
  const isTimeout = msg.includes('timed out') ||
                    msg.includes('timeout') ||
                    msg.includes('deadline exceeded') ||
                    msg.includes('aborted');
  if (isTimeout) {
    if (hasNextModel) {
      return { action: 'cascade', reason: 'Generative AI Request Timed Out (180s)' };
    }
  }

  return { action: 'throw' };
}

/**
 * Wraps a model instance to handle 503 high demand & 404 unavailable errors using a waterfall sequential cascade
 */
export function makeModelResilient(model, apiKey, modelName = null, isExplicitKey = false, explicitFallback = null) {
  const originalGenerateContent = model.generateContent.bind(model);
  
  const callWithTimeout = async (promise, timeoutMs = 180000) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`Generative AI request timed out after ${timeoutMs/1000}s`)), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
  };
  
  model.generateContent = async function(request) {
    const waterfallChain = await getModelWaterfallChain(modelName);

    const executeWaterfall = async (activeKey) => {
      let lastError;
      const MAX_WATERFALL_CYCLES = 4;
      const INTER_CYCLE_PAUSE_MS = 30000;

      for (let cycle = 0; cycle < MAX_WATERFALL_CYCLES; cycle++) {
        if (cycle > 0) {
          console.warn(`[Gemini-Waterfall] ⏳ Semua model sementara overloaded (503). Menunggu ${INTER_CYCLE_PAUSE_MS / 1000}s sebelum mencoba ulang... (Putaran ${cycle + 1}/${MAX_WATERFALL_CYCLES})`);
          await new Promise(r => setTimeout(r, INTER_CYCLE_PAUSE_MS));
        }

        for (let i = 0; i < waterfallChain.length; i++) {
          const currentModel = waterfallChain[i];
          const nextModel = waterfallChain[i + 1] || null;

          // 1 initial attempt + up to 3 exponential backoff retries (total 4 attempts per model)
          for (let attempt = 0; attempt < 4; attempt++) {
            const callStartedAt = Date.now();
            try {
              const genAI = new GoogleGenerativeAI(activeKey);
              const modelOptions = {
                model: currentModel,
                generationConfig: model.generationConfig
              };
              if (model.systemInstruction) {
                modelOptions.systemInstruction = model.systemInstruction;
              }
              if (model.tools) {
                modelOptions.tools = model.tools;
              }
              const modelObj = genAI.getGenerativeModel(modelOptions);
              const responsePayload = await callWithTimeout(modelObj.generateContent(request));
              await recordGeminiHttpCall({
                modelName: currentModel,
                stage: getCurrentGeminiTrace().stage || 'general_ai',
                attempt,
                durationMs: Date.now() - callStartedAt,
                httpStatus: 200,
                ok: true,
                usageMetadata: responsePayload?.response?.usageMetadata || null
              });
              return responsePayload;
            } catch (error) {
              lastError = error;
              if (error && typeof error === 'object') {
                error.geminiModel = error.geminiModel || currentModel;
              }
              await recordGeminiHttpCall({
                modelName: currentModel,
                stage: getCurrentGeminiTrace().stage || 'general_ai',
                attempt,
                durationMs: Date.now() - callStartedAt,
                httpStatus: extractHttpStatusFromError(error),
                ok: false,
                usageMetadata: null,
                error
              });
              const cascadeAction = getCascadeAction(error, attempt, Boolean(nextModel));

              if (cascadeAction.action === 'retry') {
                console.warn(`[Gemini-Waterfall] ${currentModel} returned ${cascadeAction.reason}. Retrying in ${Math.round((cascadeAction.delayMs || 4000)/1000)}s...`);
                await new Promise(r => setTimeout(r, cascadeAction.delayMs || 4000));
                continue;
              } else if (cascadeAction.action === 'cascade') {
                console.warn(`[Gemini-Waterfall] ${currentModel} unavailable (${cascadeAction.reason}). Cascading down to ${nextModel}...`);
                break; // Move to next model in waterfall chain
              }

              // Non-cascadeable error (e.g. auth, bad request) → throw immediately, don't cycle
              throw error;
            }
          }
        }

        // All models in this cycle were exhausted. Only continue cycling if error is retryable (503)
        const is503Cycle = lastError && (
          (lastError.status === 503) ||
          (lastError.message || '').toLowerCase().includes('503') ||
          (lastError.message || '').toLowerCase().includes('high demand') ||
          (lastError.message || '').toLowerCase().includes('service unavailable') ||
          (lastError.message || '').toLowerCase().includes('overloaded')
        );
        if (!is503Cycle) break; // Non-503 failure, no point cycling
      }

      // All cycles exhausted
      const baseMsg = lastError?.message || 'Unknown error';
      throw new Error(`QUOTA_EXHAUSTED: Semua model Gemini tidak tersedia setelah ${MAX_WATERFALL_CYCLES} putaran. Error terakhir: ${baseMsg}`);
    };

    if (isExplicitKey) {
      return await executeWaterfall(apiKey);
    }

    // No explicit key -> Perform automatic key pool rotation on 429 errors
    const resolvedStartModel = waterfallChain[0] || modelName || DEFAULT_POOL_MODEL;
    return await executeWithKeyPool(1, async (rotatedKey) => {
      return await executeWaterfall(rotatedKey);
    }, { modelName: resolvedStartModel });
  };
  
  return model;
}

export async function getGeminiModel(apiKey = null, systemInstruction = null) {
  const key = await resolveApiKey(apiKey);
  const models = await getResolvedGeminiModels();
  const genAI = new GoogleGenerativeAI(key);
  const modelOptions = {
    model: models.PRIMARY,
    generationConfig: {
      temperature: 0.9,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 65535,
      responseMimeType: 'application/json',
    },
  };
  if (systemInstruction) {
    modelOptions.systemInstruction = systemInstruction;
  }
  const model = genAI.getGenerativeModel(modelOptions);
  return makeModelResilient(model, key, models.PRIMARY, apiKey !== null);
}

export async function getGeminiModelWithSearch(apiKey = null) {
  const key = await resolveApiKey(apiKey);
  const models = await getResolvedGeminiModels();
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: models.PRIMARY,
    generationConfig: {
      temperature: 0.9,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
    },
    tools: [{ googleSearch: {} }],
  });
  return makeModelResilient(model, key, models.PRIMARY, apiKey !== null);
}


export async function uploadVideoToGemini(filePath, mimeType = 'video/mp4', apiKey = null) {
  const key = await resolveApiKey(apiKey);
  const fileManager = new GoogleAIFileManager(key);

  const uploadResult = await fileManager.uploadFile(filePath, {
    mimeType,
    displayName: filePath.split('/').pop(),
  });

  // Poll until ACTIVE (with safety limit to prevent infinite loop)
  let file = await fileManager.getFile(uploadResult.file.name);
  let pollAttempts = 0;
  const maxPollAttempts = 40; // 40 * 3 seconds = 120 seconds max timeout
  while (file.state === 'PROCESSING') {
    pollAttempts++;
    if (pollAttempts > maxPollAttempts) {
      throw new Error('Timeout: Video processing stuck in PROCESSING state on Gemini server.');
    }
    await new Promise(r => setTimeout(r, 3000));
    file = await fileManager.getFile(uploadResult.file.name);
  }

  if (file.state === 'FAILED') {
    throw new Error('Gagal memproses video di Gemini. Coba lagi.');
  }

  return { fileUri: file.uri, mimeType: file.mimeType };
}

export async function generateWithVideo(fileUri, mimeType, prompt, apiKey = null) {
  const key = await resolveApiKey(apiKey);
  const models = await getResolvedGeminiModels();
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: models.PRIMARY,
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 16384,
      responseMimeType: 'application/json',
    },
  });

  const resilientModel = makeModelResilient(model, key, models.PRIMARY, apiKey !== null, models.FALLBACK_1);
  const result = await resilientModel.generateContent([
    { fileData: { fileUri, mimeType } },
    { text: prompt },
  ]);
  return resilientModel.generateContent ? result.response.text() : result.response.text();
}

export async function testGeminiConnection(apiKey, modelToTest = null) {
  try {
    const models = await getResolvedGeminiModels();
    const activeModel = modelToTest || models.PRIMARY;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: activeModel });
    const resilientModel = makeModelResilient(model, apiKey, activeModel, true);
    const result = await resilientModel.generateContent('Say "Connection successful" in exactly 3 words.');
    const text = result.response.text();
    return { success: true, message: `Model ${activeModel}: ${text}` };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// ========================
// Scheduler V4: Multi-Key Pool Executor
// ========================

// In-memory registry for keys that hit 429 RPM/TPM limits (holds them for a short cooldown)
const rateLimitedKeys = new Map(); // keyId -> blockedUntil (timestamp)

/**
 * Execute a Gemini task using the key pool with automatic rotation on 429 errors.
 * @param {number} cost - API call cost (usually 1)
 * @param {function} executorFn - async function(apiKey) that performs the Gemini call
 * @returns {*} Result from executorFn
 * @throws Error if all keys are exhausted or if a non-429 error occurs
 */
export async function executeWithKeyPool(cost, executorFn, options = {}) {
  const tenantId = getActiveTenantId();
  const enforceFreePool = options?.enforceFreePool === true;
  const getSettingFn = _testHooks?.getSetting || getSetting;
  const getKeyFn = _testHooks?.getAvailableApiKey || getAvailableApiKey;
  const incUsageFn = _testHooks?.incrementKeyUsage || incrementKeyUsage;
  const markExhaustedFn = _testHooks?.markKeyExhausted || markKeyExhausted;
  const markStatusFn = _testHooks?.markApiKeyStatus || markApiKeyStatus;

  const targetModel = normalizePoolModelName(
    options?.modelName || getSettingFn('gemini_model_primary') || DEFAULT_POOL_MODEL
  );
  const apiTier = enforceFreePool ? 'free' : (getSettingFn('gemini_api_tier') || 'free');

  if (apiTier === 'paid' && !enforceFreePool) {
    let singleKey = getSettingFn('gemini_api_key', false);
    if (!singleKey && tenantId === 'default_tenant') {
      singleKey = process.env.GEMINI_API_KEY;
    }
    if (singleKey) {
      let lastError;
      const maxPaidAttempts = 2;
      for (let attempt = 0; attempt < maxPaidAttempts; attempt++) {
        try {
          return await keyPoolAttemptStorage.run(
            { keyId: null, keyName: 'paid_single_key', keySource: 'paid', trackedCount: 0, lastModel: targetModel },
            () => executorFn(singleKey)
          );
        } catch (error) {
          lastError = error;
          const msg = (error.message || '').toLowerCase();
          const isSpendingCapOrExhausted = msg.includes('spending cap') ||
                                           msg.includes('credits are depleted') ||
                                           error.status === 402 ||
                                           (error.status === 429 && (msg.includes('quota') || msg.includes('limit') || msg.includes('spending')));
          if (isSpendingCapOrExhausted) {
            console.warn('[Gemini-Paid] Paid API Key spending cap / kuota habis. Auto-fallback ke Tenant Free Key Pool...');
            break;
          }
          if (attempt < maxPaidAttempts - 1) {
            const delay = Math.pow(2, attempt) * 2000 + Math.random() * 500;
            console.warn(`[Gemini-Paid] Paid key returned error. Retrying in ${Math.round(delay/1000)}s...`);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
        }
      }
      console.warn('[Gemini-Paid] Paid Key gagal atau habis kuota. Beralih ke Tenant Free Key Pool...');
    }
  }

  const triedKeyIds = new Set();
  const maxAttempts = Number(options?.maxAttempts) || 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const now = Date.now();
    const excludedIds = [];

    for (const [keyId, blockedUntil] of rateLimitedKeys.entries()) {
      if (blockedUntil > now) {
        excludedIds.push(keyId);
      } else {
        rateLimitedKeys.delete(keyId);
      }
    }

    const allExcluded = Array.from(new Set([...excludedIds, ...triedKeyIds]));
    const keyEntry = await getKeyFn(cost, allExcluded, { modelName: targetModel });

    if (!keyEntry) {
      console.warn(`[Gemini-KeyPool] No free keys available in pool for model=${targetModel}. Trying fallback settings key...`);
      const singleKey = getSettingFn('gemini_api_key', false) || process.env.GEMINI_API_KEY;
      if (singleKey) {
        let lastFallbackErr;
        const maxFallbackAttempts = 4;
        for (let fallbackAttempt = 0; fallbackAttempt < maxFallbackAttempts; fallbackAttempt++) {
          try {
            return await keyPoolAttemptStorage.run(
              { keyId: null, keyName: 'fallback_settings_key', keySource: 'fallback_settings', trackedCount: 0, lastModel: targetModel },
              () => executorFn(singleKey)
            );
          } catch (fallbackError) {
            lastFallbackErr = fallbackError;
            const isTemporary = fallbackError.status === 503 ||
                                fallbackError.status === 429 ||
                                fallbackError.message?.includes('503') ||
                                fallbackError.message?.includes('429') ||
                                fallbackError.message?.toLowerCase().includes('service unavailable') ||
                                fallbackError.message?.toLowerCase().includes('high demand') ||
                                fallbackError.message?.toLowerCase().includes('exhausted') ||
                                fallbackError.message?.toLowerCase().includes('quota') ||
                                fallbackError.message?.toLowerCase().includes('resource_exhausted');
            if (isTemporary && fallbackAttempt < maxFallbackAttempts - 1) {
              const delay = Math.pow(2, fallbackAttempt) * 4000 + Math.random() * 1000;
              console.warn(`[Gemini-KeyPool-Fallback] Fallback key failed (429/503). Retrying in ${Math.round(delay/1000)}s (attempt ${fallbackAttempt + 1}/${maxFallbackAttempts})...`);
              await new Promise(r => setTimeout(r, delay));
              continue;
            }
            throw fallbackError;
          }
        }
        throw lastFallbackErr;
      }
      throw new Error(`QUOTA_EXHAUSTED: Semua API Key habis untuk hari ini (model ${targetModel}) dan tidak ada fallback key.`);
    }

    triedKeyIds.add(keyEntry.id);
    const poolCtx = {
      keyId: keyEntry.id,
      keyName: keyEntry.key_name,
      keySource: 'pool',
      trackedCount: 0,
      lastModel: targetModel
    };

    try {
      const result = await keyPoolAttemptStorage.run(poolCtx, () => executorFn(keyEntry.api_key, keyEntry));
      if (poolCtx.trackedCount === 0) {
        await incUsageFn(keyEntry.id, cost, poolCtx.lastModel || targetModel);
      }
      return result;
    } catch (error) {
      // Ensure failed executors that didn't emit recordGeminiHttpCall still count the real attempt once
      if (poolCtx.trackedCount === 0) {
        await incUsageFn(keyEntry.id, cost, error?.geminiModel || poolCtx.lastModel || targetModel).catch(() => {});
      }

      const is429 = error.status === 429 ||
                    error.message?.includes('429') ||
                    error.message?.includes('Resource has been exhausted') ||
                    error.message?.includes('Quota exceeded') ||
                    error.message?.includes('RESOURCE_EXHAUSTED');

      const is503 = error.status === 503 ||
                    error.message?.includes('503') ||
                    error.message?.toLowerCase().includes('service unavailable') ||
                    error.message?.toLowerCase().includes('high demand') ||
                    error.message?.toLowerCase().includes('overloaded');

      if (is429 || is503) {
        const failedModel = normalizePoolModelName(error?.geminiModel || poolCtx.lastModel || targetModel);
        if (is503) {
          console.warn(`[Gemini-KeyPool] Key ${keyEntry.key_name} still returned 503 after internal retries/fallback (model=${failedModel}). Rotating key...`);
        } else {
          const errorStr = (error.message || '').toLowerCase();
          const isDailyLimit = errorStr.includes('daily') ||
                               errorStr.includes('per day') ||
                               errorStr.includes('requests per day') ||
                               errorStr.includes('rpd') ||
                               errorStr.includes('free_tier') ||
                               errorStr.includes('free tier') ||
                               errorStr.includes('requestsperdayper') ||
                               errorStr.includes('generate_content_free_tier');

          if (isDailyLimit) {
            console.warn(`[Gemini-KeyPool] Key ${keyEntry.key_name} exceeded daily quota on model=${failedModel}. Marking exhausted for ${failedModel} in DB.`);
            await markExhaustedFn(keyEntry.id, failedModel);
          } else {
            console.warn(`[Gemini-KeyPool] Key ${keyEntry.key_name} hit temporary rate limit on model=${failedModel}. Placing on 45s cooldown.`);
            rateLimitedKeys.set(keyEntry.id, Date.now() + 45000);
          }
        }
        continue;
      }

      const isInvalidKey = error.status === 400 ||
                           error.status === 403 ||
                           error.message?.includes('API_KEY_INVALID') ||
                           error.message?.includes('API key not valid') ||
                           error.message?.includes('PERMISSION_DENIED') ||
                           error.message?.toLowerCase().includes('key expired') ||
                           error.message?.toLowerCase().includes('api key revoked');

      if (isInvalidKey) {
        console.warn(`[Gemini-KeyPool] ⚠️ Key ${keyEntry.key_name} (ID: ${keyEntry.id}) terdeteksi MATI/REVOKED oleh Google API. Menonaktifkan key dari pool...`);
        try {
          await markStatusFn(keyEntry.id, 'INVALID', 0);
        } catch (e) {}
        continue;
      }

      throw error;
    }
  }

  throw new Error('QUOTA_EXHAUSTED: Semua API Key yang dicoba dalam pool gagal karena rate limit atau high demand.');
}

/**
 * Call Gemini 2.5 TTS API for text-to-speech.
 * @param {string} text - The input text to read
 * @param {string} voicePersona - The name of the Google prebuilt voice persona
 * @param {object} config - Configuration options (speed, volume)
 * @returns {Buffer} Raw PCM 16-bit linear mono 24kHz audio buffer
 */
export async function callGeminiTtsApi(text, voicePersona, config = {}) {
  const ttsModel = 'gemini-2.5-flash-preview-tts';
  return await executeWithKeyPool(1, async (apiKey) => {
    const startedAt = Date.now();
    let speedDesc = "";
    if (config.speed && Number(config.speed) !== 1.0) {
      speedDesc = `Read this at ${config.speed}x speed. `;
    }
    let volumeDesc = "";
    if (config.volume && Number(config.volume) !== 1.0) {
      volumeDesc = `Read this at ${config.volume}x volume. `;
    }
    const textPrompt = `${speedDesc}${volumeDesc}${text}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${ttsModel}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          parts: [{ text: textPrompt }]
        }
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voicePersona
            }
          }
        }
      }
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        const err = new Error(`Gemini TTS API HTTP error! status: ${response.status}, body: ${errorText}`);
        err.status = response.status;
        err.geminiModel = ttsModel;
        await recordGeminiHttpCall({
          modelName: ttsModel,
          stage: getCurrentGeminiTrace().stage || 'tts_gemini',
          attempt: 0,
          durationMs: Date.now() - startedAt,
          httpStatus: response.status,
          ok: false,
          error: err
        });
        throw err;
      }

      const result = await response.json();
      await recordGeminiHttpCall({
        modelName: ttsModel,
        stage: getCurrentGeminiTrace().stage || 'tts_gemini',
        attempt: 0,
        durationMs: Date.now() - startedAt,
        httpStatus: 200,
        ok: true,
        usageMetadata: result.usageMetadata || null
      });

      const candidate = result.candidates?.[0];
      const part = candidate?.content?.parts?.[0];
      const inlineData = part?.inlineData;

      if (!inlineData || !inlineData.data) {
        throw new Error('Gemini TTS API returned no audio inlineData. Response: ' + JSON.stringify(result));
      }

      return Buffer.from(inlineData.data, 'base64');
    } catch (error) {
      if (!error.geminiModel) {
        error.geminiModel = ttsModel;
        await recordGeminiHttpCall({
          modelName: ttsModel,
          stage: getCurrentGeminiTrace().stage || 'tts_gemini',
          attempt: 0,
          durationMs: Date.now() - startedAt,
          httpStatus: extractHttpStatusFromError(error),
          ok: false,
          error
        });
      }
      throw error;
    }
  }, { modelName: ttsModel });
}

/**
 * Creates/refreshes the explicit context cache on Google servers using the stitched Master KB directive.
 */
export async function refreshGeminiContextCache(apiKey = null, modelName = GEMINI_MODELS.PRIMARY) {
  const key = await resolveApiKey(apiKey);
  const masterSystemInstruction = getStitchedMasterKB();

  console.log(`[Cache Engine] Mendaftarkan Master KB to Google Server (Paid Tier) for model ${modelName}...`);
  
  try {
    const cacheManager = new GoogleAICacheManager(key);
    const cacheName = `makna_v7_master_cache_${modelName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;
    
    const cache = await cacheManager.create({
      model: modelName,
      displayName: cacheName,
      contents: [
        {
          role: 'user',
          parts: [{ text: masterSystemInstruction }]
        }
      ],
      ttlSeconds: 7200 // 2 Hour TTL
    });

    console.log(`[Cache Engine] Sukses! Cache ID Baru: ${cache.name}`);
    
    // Save to database SQLite settings with model-specific key
    const settingKey = `active_gemini_cache_id_${modelName.replace(/[^a-zA-Z0-9]/g, '_')}`;
    setSetting(settingKey, cache.name);
    return cache.name;
  } catch (error) {
    console.error(`[Cache Engine] Gagal membuat cache untuk ${modelName}:`, error.message);
    throw error;
  }
}

/**
 * Splits a full prompt into a static system directive / KBs part and a dynamic inputs / tasks part.
 */
export function splitPromptForCaching(fullPrompt) {
  const splitMarkers = [
    '[INPUT DATA',
    '[INPUT DATA (DARI STAGE 1)]',
    '[INPUT DATA (DARI STAGE 2)]',
    '[INPUT DATA (DARI STAGE 3)]',
    '## THE DECONSTRUCTION',
    '## SPESIFIKASI DAN ATURAN STRUKTUR'
  ];
  
  for (const marker of splitMarkers) {
    const index = fullPrompt.indexOf(marker);
    if (index !== -1) {
      const systemInstruction = fullPrompt.substring(0, index).trim();
      const prompt = fullPrompt.substring(index).trim();
      return { systemInstruction, prompt };
    }
  }
  
  return { systemInstruction: '', prompt: fullPrompt };
}

/**
 * Flexible Gemini API call with key selection and tier-based caching.
 */
async function executeContentGeneration(resolvedKey, params) {
  const { prompt, modelName = null, taskType = null, videoPayload = null, useSearch = false, timeoutMs: customTimeoutMs = null } = params;
  
  const startingModel = await resolveModelForTask(taskType, modelName);
  const waterfallChain = await getModelWaterfallChain(startingModel);
  const timeoutMs = customTimeoutMs || 180000;
  
  const callWithTimeout = async (promise, currentModel, timeoutMs) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`Request ke model ${currentModel} timed out (${timeoutMs/1000}s)`)), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
  };

  let lastError;
  const MAX_WATERFALL_CYCLES = 4;
  const INTER_CYCLE_PAUSE_MS = 30000;

  for (let cycle = 0; cycle < MAX_WATERFALL_CYCLES; cycle++) {
    if (cycle > 0) {
      console.warn(`[Gemini-Waterfall] ⏳ Semua model sementara overloaded (503). Menunggu ${INTER_CYCLE_PAUSE_MS / 1000}s sebelum mencoba ulang... (Putaran ${cycle + 1}/${MAX_WATERFALL_CYCLES})`);
      await new Promise(r => setTimeout(r, INTER_CYCLE_PAUSE_MS));
    }

    for (let i = 0; i < waterfallChain.length; i++) {
      const currentModel = waterfallChain[i];
      const nextModel = waterfallChain[i + 1] || null;       // 1 initial attempt + up to 3 exponential backoff retries (total 4 attempts per model)
      for (let attempt = 0; attempt < 4; attempt++) {
        const callStartedAt = Date.now();
        try {
          const apiTier = (await getSetting('gemini_api_tier')) || 'paid';
          const isCachingEnabled = (await getSetting('gemini_context_caching')) || 'on';
          const taskConfig = taskType ? MODULE_MODEL_MATRIX[taskType] : null;
          const shouldSkipKB = taskConfig && taskConfig.useKB === false;
          const cacheableModels = [
            'gemini-3.6-flash',
            'gemini-3.7-flash',
            'gemini-3.8-flash',
            'gemini-1.5-flash',
            'gemini-2.5-flash',
            'gemini-3.5-flash'
          ];
          const isCacheable = cacheableModels.includes(currentModel) && !shouldSkipKB;
          const activeStage = taskType || getCurrentGeminiTrace().stage || 'general_ai';

          // 1. FREE TIER, CACHING DISABLED, GOOGLE SEARCH, NON-CACHEABLE MODEL, or ZERO-KB TASK -> Standard API call (no caching)
          if (apiTier === 'free' || isCachingEnabled !== 'on' || useSearch || !isCacheable) {
            console.log(`[Gemini API] Menjalankan standard request menggunakan ${currentModel} ${useSearch ? '(Google Search aktif)' : ''}.`);
            const genAI = new GoogleGenerativeAI(resolvedKey);

            const modelOptions = {
              model: currentModel,
              generationConfig: {
                temperature: 0.9,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: currentModel.includes('1.5') ? 8192 : 65535,
                responseMimeType: useSearch ? undefined : 'application/json',
              },
            };

            if (useSearch) {
              modelOptions.tools = [{ googleSearch: {} }];
            }

            const model = genAI.getGenerativeModel(modelOptions);

            const parts = [];
            if (videoPayload) {
              parts.push({ fileData: videoPayload });
            }
            parts.push({ text: prompt });
            const result = await callWithTimeout(model.generateContent(parts), currentModel, timeoutMs);
            await recordGeminiHttpCall({
              modelName: currentModel,
              stage: activeStage,
              attempt,
              durationMs: Date.now() - callStartedAt,
              httpStatus: 200,
              ok: true,
              usageMetadata: result.response?.usageMetadata || null
            });
            return result.response.text();
          }

          // 2. PAID TIER & CACHING ENABLED -> Use explicit context caching (stored Directive)
          const settingKey = `active_gemini_cache_id_${currentModel.replace(/[^a-zA-Z0-9]/g, '_')}`;
          let cacheId = await getSetting(settingKey);

          // If no cache ID exists, create one synchronously
          if (!cacheId) {
            try {
              console.log(`[Cache Engine] No active cache ID found for ${currentModel}. Creating cache...`);
              cacheId = await refreshGeminiContextCache(resolvedKey, currentModel);
            } catch (err) {
              console.error(`[Cache Engine] Failed to create cache for ${currentModel}:`, err.message);
            }
          }

          const { prompt: dynamicPrompt } = splitPromptForCaching(prompt);

          if (cacheId) {
            const cachedStartedAt = Date.now();
            try {
              console.log(`[Cache Engine] Executing cached generation using: ${cacheId}`);
              const genAI = new GoogleGenerativeAI(resolvedKey);

              const model = genAI.getGenerativeModelFromCachedContent({
                name: cacheId,
                model: currentModel
              }, {
                generationConfig: {
                  temperature: 0.9,
                  topP: 0.95,
                  topK: 40,
                  responseMimeType: 'application/json',
                }
              });

              const parts = [];
              if (videoPayload) {
                parts.push({ fileData: videoPayload });
              }
              parts.push({ role: 'user', parts: [{ text: dynamicPrompt }] });

              const result = await callWithTimeout(model.generateContent({
                contents: parts,
                generationConfig: {
                  temperature: 0.9,
                  topP: 0.95,
                  topK: 40,
                  responseMimeType: 'application/json',
                }
              }), currentModel, timeoutMs);

              const usage = result.response?.usageMetadata;
              const cachedTokens = usage?.cachedContentTokenCount || 0;
              const promptTokens = usage?.promptTokenCount || 0;
              const candidatesTokens = usage?.candidatesTokenCount || 0;
              const uncachedPromptTokens = Math.max(0, promptTokens - cachedTokens);

              if (cachedTokens > 0) {
                console.log(`[Cache Engine] ✅ Cached generation success! Cached tokens saved: ${cachedTokens.toLocaleString()} tokens | Dynamic prompt tokens: ${uncachedPromptTokens.toLocaleString()} | Output tokens: ${candidatesTokens.toLocaleString()}`);
              } else {
                console.log(`[Cache Engine] ✅ Cached model generation success! Dynamic prompt tokens: ${promptTokens.toLocaleString()} | Output tokens: ${candidatesTokens.toLocaleString()}`);
              }

              await recordGeminiHttpCall({
                modelName: currentModel,
                stage: `${activeStage}_cached`,
                attempt,
                durationMs: Date.now() - cachedStartedAt,
                httpStatus: 200,
                ok: true,
                usageMetadata: usage || null
              });

              return result.response.text();
            } catch (err) {
              console.warn(`[Cache Engine] Caching request failed for ${currentModel}: ${err.message}. Falling back...`);
              await recordGeminiHttpCall({
                modelName: currentModel,
                stage: `${activeStage}_cached`,
                attempt,
                durationMs: Date.now() - cachedStartedAt,
                httpStatus: extractHttpStatusFromError(err),
                ok: false,
                error: err
              });

              const errStr = (err.message || '').toUpperCase();
              if (errStr.includes('NOT_FOUND') || errStr.includes('NOT FOUND') || errStr.includes('404')) {
                console.log(`[Cache Engine] Cache expired for ${currentModel}. Triggering background rebuild...`);
                refreshGeminiContextCache(resolvedKey, currentModel).catch(e => console.error(`[Cache Engine] Background rebuild failed for ${currentModel}:`, e.message));
              }
            }
          }

          // Fallback: run standard request (sends full prompt)
          const fallbackStartedAt = Date.now();
          console.log(`[Gemini API] Running standard request fallback using ${currentModel}...`);
          const genAI = new GoogleGenerativeAI(resolvedKey);
          const model = genAI.getGenerativeModel({
            model: currentModel,
            generationConfig: {
              temperature: 0.9,
              topP: 0.95,
              topK: 40,
              maxOutputTokens: 65535,
              responseMimeType: 'application/json',
            },
          });

          const parts = [];
          if (videoPayload) {
            parts.push({ fileData: videoPayload });
          }
          parts.push({ text: prompt });

          const result = await callWithTimeout(model.generateContent(parts), currentModel, timeoutMs);
          await recordGeminiHttpCall({
            modelName: currentModel,
            stage: activeStage,
            attempt,
            durationMs: Date.now() - fallbackStartedAt,
            httpStatus: 200,
            ok: true,
            usageMetadata: result.response?.usageMetadata || null
          });
          return result.response.text();
        } catch (error) {
          lastError = error;
          if (error && typeof error === 'object') {
            error.geminiModel = error.geminiModel || currentModel;
          }
          await recordGeminiHttpCall({
            modelName: currentModel,
            stage: taskType || getCurrentGeminiTrace().stage || 'general_ai',
            attempt,
            durationMs: Date.now() - callStartedAt,
            httpStatus: extractHttpStatusFromError(error),
            ok: false,
            error
          });
          const cascadeAction = getCascadeAction(error, attempt, Boolean(nextModel));

          if (cascadeAction.action === 'retry') {
            console.warn(`[Gemini-Waterfall] ${currentModel} returned ${cascadeAction.reason}. Retrying in ${Math.round((cascadeAction.delayMs || 4000)/1000)}s...`);
            await new Promise(r => setTimeout(r, cascadeAction.delayMs || 4000));
            continue;
          } else if (cascadeAction.action === 'cascade') {
            console.warn(`[Gemini-Waterfall] ${currentModel} unavailable (${cascadeAction.reason}). Cascading down to ${nextModel}...`);
            break;
          }

          // Non-cascadeable error → throw immediately, don't cycle
          throw error;
        }
      }
    }

    // All models in this cycle exhausted. Only continue cycling if error is retryable (503)
    const is503Cycle = lastError && (
      (lastError.status === 503) ||
      (lastError.message || '').toLowerCase().includes('503') ||
      (lastError.message || '').toLowerCase().includes('high demand') ||
      (lastError.message || '').toLowerCase().includes('service unavailable') ||
      (lastError.message || '').toLowerCase().includes('overloaded')
    );
    if (!is503Cycle) break; // Non-503 failure, no point cycling
  }

  // All cycles exhausted
  const baseMsg = lastError?.message || 'Unknown error';
  throw new Error(`QUOTA_EXHAUSTED: Semua model Gemini tidak tersedia setelah ${MAX_WATERFALL_CYCLES} putaran. Error terakhir: ${baseMsg}`);
}

export async function generateContentFlexible(params) {
  const { apiKey, traceContext = null, taskType = null, modelName = null } = params;
  const startingModel = await resolveModelForTask(taskType, modelName);
  const run = async () => {
    if (apiKey) {
      return await executeContentGeneration(apiKey, params);
    }
    return await executeWithKeyPool(1, async (resolvedKey) => {
      return await executeContentGeneration(resolvedKey, params);
    }, { modelName: startingModel });
  };
  if (traceContext) {
    return await runWithGeminiTrace(traceContext, run);
  }
  return await run();
}

export async function callGeminiAPI(prompt, apiKey = null) {
  return await generateContentFlexible({ prompt, apiKey });
}

export async function resolveStartFrameQcModel(modelOverride = null) {
  const getSettingFn = _testHooks?.getSetting || getSetting;
  const configured = String(
    modelOverride || getSettingFn('start_frame_visual_qc_model') || ''
  ).trim();
  if (configured) return configured;
  const models = await getResolvedGeminiModels('compliance_audit');
  return models.COMPLIANCE || models.PRIMARY;
}

/**
 * Call Gemini Vision to generate content with one or more image buffers (single or batch QC).
 * @param {Array<{buffer: Buffer, mimeType: string, label?: string}>} images
 * @param {string} prompt
 * @param {Object|null} responseSchema
 * @param {string|null} apiKey
 * @param {Object} options - { modelOverride, traceContext }
 * @returns {Promise<string>}
 */
export async function generateWithImages(images = [], prompt, responseSchema = null, apiKey = null, options = {}) {
  const targetModel = await resolveStartFrameQcModel(options?.modelOverride);
  const trace = {
    stage: options?.traceContext?.stage || 'start_frame_visual_qc',
    ...(options?.traceContext || {})
  };

  const parts = [];
  for (const img of (images || [])) {
    if (!img?.buffer) continue;
    if (img.label) {
      parts.push({ text: img.label });
    }
    parts.push({
      inlineData: {
        data: img.buffer.toString('base64'),
        mimeType: img.mimeType || 'image/png'
      }
    });
  }
  parts.push({ text: prompt });

  const executeWithKey = async (key) => {
    const genAI = new GoogleGenerativeAI(key);
    const modelOptions = {
      model: targetModel,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: responseSchema ? 'application/json' : 'text/plain',
      }
    };
    if (responseSchema) {
      modelOptions.generationConfig.responseSchema = responseSchema;
    }
    const model = genAI.getGenerativeModel(modelOptions);
    const resilientModel = makeModelResilient(model, key, targetModel, true);
    const result = await resilientModel.generateContent(parts);
    return result.response.text();
  };

  return await runWithGeminiTrace(trace, async () => {
    if (apiKey) {
      return await executeWithKey(apiKey);
    }
    return await executeWithKeyPool(1, executeWithKey, { modelName: targetModel });
  });
}

/**
 * Call Gemini Flash to generate content with an image reference with resilient fallback.
 * @param {Buffer} imageBuffer - The image file buffer.
 * @param {string} mimeType - The mime type of the image (e.g. image/png).
 * @param {string} prompt - The prompt text.
 * @param {Object} responseSchema - Optional JSON schema constraint.
 * @param {string} apiKey - Optional explicit API key.
 * @param {Object} options - Optional { modelOverride, traceContext }.
 * @returns {Promise<string>}
 */
export async function generateWithImage(imageBuffer, mimeType, prompt, responseSchema = null, apiKey = null, options = {}) {
  return await generateWithImages(
    [{ buffer: imageBuffer, mimeType }],
    prompt,
    responseSchema,
    apiKey,
    options
  );
}
