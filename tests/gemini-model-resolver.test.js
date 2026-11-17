process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';
process.env.PG_SEARCH_PATH = process.env.PG_SEARCH_PATH || 'dev';

import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';

const {
  __setGeminiTestHooks,
  resolveModelChain,
  resolveModelForTask,
  getResolvedGeminiModels,
  resolveStartFrameQcModel,
  makeModelResilient,
  executeWithKeyPool,
  isRetryableGeminiError,
  DEAD_GEMINI_MODELS,
  MODULE_MODEL_MATRIX
} = await import('../lib/gemini.js');
const { generateProductEnrichmentWithGemini } = await import('../lib/product-bulk-worker.js');
const { buildProvisionTenantDefaultSettings } = await import('../lib/tenant-admin.js');

function createSettingsMap(overrides = {}) {
  return {
    gemini_api_tier: 'paid',
    gemini_smart_routing: 'on',
    gemini_model_primary: 'gemini-3.8-flash',
    gemini_model_fallback: 'gemini-3.6-flash',
    gemini_model_light: '',
    start_frame_visual_qc_model: '',
    ...overrides
  };
}

test.afterEach(() => {
  __setGeminiTestHooks(null);
});

test('1. resolveModelChain handles smart routing, light/vision fallbacks, paid tier, and deduplication', async () => {
  // a) Smart routing ON, light empty -> light uses primary; paid never yields dead models
  let settings = createSettingsMap({ gemini_api_tier: 'paid', gemini_model_primary: 'gemini-3.8-flash', gemini_model_light: '' });
  __setGeminiTestHooks({ getSetting: (k) => settings[k] ?? null });

  const lightWhenEmpty = await resolveModelChain({ role: 'light', taskType: 'PRODUCT_ENRICHMENT' });
  assert.equal(lightWhenEmpty.model, 'gemini-3.8-flash');
  assert.equal(new Set(lightWhenEmpty.chain).size, lightWhenEmpty.chain.length, 'chain must have no duplicates');
  for (const m of lightWhenEmpty.chain) {
    assert.equal(DEAD_GEMINI_MODELS.has(m), false, `dead model ${m} must never appear in chain`);
  }

  // b) Smart routing ON, light filled -> light uses light, primary still uses primary
  settings = createSettingsMap({ gemini_model_light: 'gemini-3.1-flash-lite', start_frame_visual_qc_model: '' });
  const lightWhenSet = await resolveModelChain({ taskType: 'SCRAPER' });
  const primaryWhenLightSet = await resolveModelChain({ taskType: 'CAMPAIGN_PLANNER' });
  assert.equal(lightWhenSet.model, 'gemini-3.1-flash-lite');
  assert.equal(lightWhenSet.chain[0], 'gemini-3.1-flash-lite');
  assert.equal(lightWhenSet.chain[1], 'gemini-3.6-flash'); // fallback
  assert.equal(lightWhenSet.chain[2], 'gemini-3.8-flash'); // primary
  assert.equal(primaryWhenLightSet.model, 'gemini-3.8-flash');

  // c) Smart routing OFF, light filled -> ALL use primary
  settings = createSettingsMap({ gemini_smart_routing: 'off', gemini_model_light: 'gemini-3.1-flash-lite' });
  const lightWhenSmartOff = await resolveModelChain({ role: 'light', taskType: 'BRAND_EXTRACTION' });
  assert.equal(lightWhenSmartOff.model, 'gemini-3.8-flash');

  // d) Vision role: empty QC -> light -> primary
  settings = createSettingsMap({ gemini_model_light: 'gemini-3.5-flash-lite', start_frame_visual_qc_model: '' });
  assert.equal(await resolveStartFrameQcModel(), 'gemini-3.5-flash-lite');

  settings = createSettingsMap({ gemini_model_light: '', start_frame_visual_qc_model: '' });
  assert.equal(await resolveStartFrameQcModel(), 'gemini-3.8-flash');

  settings = createSettingsMap({ gemini_model_light: 'gemini-3.5-flash-lite', start_frame_visual_qc_model: 'gemini-2.5-flash' });
  assert.equal(await resolveStartFrameQcModel(), 'gemini-2.5-flash');

  // e) Backward-compatible wrappers: string arg 'compliance_audit' & resolveModelForTask
  const compatString = await getResolvedGeminiModels('compliance_audit');
  assert.equal(compatString.resolvedPrimary, 'gemini-3.5-flash-lite');
  assert.equal(await resolveModelForTask('DECONSTRUCT'), 'gemini-3.5-flash-lite');
  assert.equal(MODULE_MODEL_MATRIX.SCRAPER.paid, undefined, 'MODULE_MODEL_MATRIX must not hardcode paid model names');
  assert.equal(MODULE_MODEL_MATRIX.SCRAPER.free, undefined, 'MODULE_MODEL_MATRIX must not hardcode free model names');
});

test('2. Product enrichment cascades 503 to fallback model and throws MODEL_BUSY when all models return 503', async () => {
  const settings = createSettingsMap({
    gemini_api_tier: 'free',
    gemini_model_primary: 'gemini-3.8-flash',
    gemini_model_fallback: 'gemini-3.6-flash',
    gemini_model_light: 'gemini-3.1-flash-lite'
  });

  // Scenario A: first model 503, second model 200
  const calledModels = [];
  class MockGenAISuccessOnFallback {
    getGenerativeModel({ model }) {
      return {
        generateContent: async () => {
          calledModels.push(model);
          if (model === 'gemini-3.1-flash-lite') {
            const e = new Error('[503 Service Unavailable] model overloaded high demand');
            e.status = 503;
            throw e;
          }
          return {
            response: {
              text: () => JSON.stringify({ products: [{ id: 'p1', unique_selling_point: ['ok'] }] }),
              usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 }
            }
          };
        }
      };
    }
  }

  const incremented = [];
  __setGeminiTestHooks({
    getSetting: (k) => settings[k] ?? null,
    sleep: async () => {},
    maxWaterfallCycles: 1,
    maxFallbackAttempts: 1,
    GoogleGenerativeAI: MockGenAISuccessOnFallback,
    getAvailableApiKey: async () => ({ id: 42, key_name: 'k-test', api_key: 'TEST_MOCK_API_KEY_A' }),
    incrementKeyUsage: async (keyId, cost, modelName) => { incremented.push({ keyId, cost, modelName }); },
    markKeyExhausted: async () => {},
    markApiKeyStatus: async () => {},
    recordAiTokenUsage: async () => {}
  });

  const text = await generateProductEnrichmentWithGemini('prompt', { itemId: 'p1', tenantId: 't1' });
  assert.match(text, /"p1"/);
  assert.equal(calledModels.includes('gemini-3.1-flash-lite'), true);
  assert.equal(calledModels.includes('gemini-3.6-flash'), true);
  assert.equal(incremented.some((x) => x.modelName === 'gemini-3.6-flash'), true);

  // Scenario B: ALL models return 503 -> must throw MODEL_BUSY (not QUOTA_EXHAUSTED)
  class MockGenAIAll503 {
    getGenerativeModel({ model }) {
      return {
        generateContent: async () => {
          const e = new Error(`[503 Service Unavailable] high demand on ${model}`);
          e.status = 503;
          throw e;
        }
      };
    }
  }

  __setGeminiTestHooks({
    getSetting: (k) => settings[k] ?? null,
    sleep: async () => {},
    maxWaterfallCycles: 1,
    maxFallbackAttempts: 1,
    GoogleGenerativeAI: MockGenAIAll503,
    getAvailableApiKey: async (cost, excluded) => (
      excluded.includes(42) ? null : { id: 42, key_name: 'k-test', api_key: 'TEST_MOCK_API_KEY_A' }
    ),
    incrementKeyUsage: async () => {},
    markKeyExhausted: async () => {},
    markApiKeyStatus: async () => {},
    recordAiTokenUsage: async () => {}
  });

  await assert.rejects(
    () => generateProductEnrichmentWithGemini('prompt', { itemId: 'p1', tenantId: 't1' }),
    (err) => {
      assert.match(err.message, /^MODEL_BUSY \(dapat diulang\):/);
      assert.doesNotMatch(err.message, /QUOTA_EXHAUSTED/);
      assert.equal(err.code, 'MODEL_BUSY');
      assert.equal(err.retryable, true);
      assert.equal(isRetryableGeminiError(err.message), true);
      return true;
    }
  );
});

test('3. executeWithKeyPool queries and marks quota against the actual called model rather than primary model', async () => {
  const settings = createSettingsMap({
    gemini_api_tier: 'free',
    gemini_model_primary: 'gemini-3.8-flash',
    gemini_model_fallback: 'gemini-3.6-flash',
    gemini_model_light: 'gemini-3.1-flash-lite'
  });

  // 3a. Light call falls back from 3.1-flash-lite to 3.6-flash -> primary 3.8-flash is never queried or charged
  const queriedModels = [];
  const usedCounts = [];
  class MockGenAILightFallbackSuccess {
    getGenerativeModel({ model }) {
      return {
        generateContent: async () => {
          if (model === 'gemini-3.1-flash-lite') {
            const e = new Error(`[429 Too Many Requests] quota exceeded on ${model}`);
            e.status = 429;
            throw e;
          }
          return { response: { text: () => 'ok' } };
        }
      };
    }
  }

  __setGeminiTestHooks({
    getSetting: (k) => settings[k] ?? null,
    sleep: async () => {},
    maxWaterfallCycles: 1,
    maxPaidAttempts: 1,
    maxFallbackAttempts: 1,
    GoogleGenerativeAI: MockGenAILightFallbackSuccess,
    getAvailableApiKey: async (cost, excluded, opts) => {
      queriedModels.push(opts?.modelName);
      if (excluded.includes(9)) return null;
      return { id: 9, key_name: 'k-free-9', api_key: 'TEST_MOCK_API_KEY_B' };
    },
    incrementKeyUsage: async (id, cost, modelName) => { usedCounts.push({ id, modelName }); },
    markKeyExhausted: async () => {},
    markApiKeyStatus: async () => {},
    recordAiTokenUsage: async () => {}
  });

  const resolvedLight = await resolveModelChain({ role: 'light' });
  await executeWithKeyPool(1, async (key) => {
    const dummy = { generateContent: async () => {}, generationConfig: {} };
    const resilient = makeModelResilient(dummy, key, resolvedLight.model, true, null, { role: 'light' });
    return await resilient.generateContent('hi');
  }, { modelName: resolvedLight.model, role: 'light' });

  assert.equal(queriedModels[0], 'gemini-3.1-flash-lite');
  assert.equal(usedCounts.some((u) => u.modelName === 'gemini-3.1-flash-lite'), true);
  assert.equal(usedCounts.some((u) => u.modelName === 'gemini-3.6-flash'), true);
  assert.equal(usedCounts.some((u) => u.modelName === 'gemini-3.8-flash'), false, 'must never charge primary when light/fallback handled call');

  // 3b. Daily 429 on explicit light model marks exhaustion ONLY on gemini-3.1-flash-lite
  const exhaustedMarks = [];
  __setGeminiTestHooks({
    getSetting: (k) => settings[k] ?? null,
    sleep: async () => {},
    maxFallbackAttempts: 1,
    getAvailableApiKey: async (cost, excluded) => (
      excluded.includes(9) ? null : { id: 9, key_name: 'k-free-9', api_key: 'TEST_MOCK_API_KEY_B' }
    ),
    incrementKeyUsage: async () => {},
    markKeyExhausted: async (id, modelName) => { exhaustedMarks.push({ id, modelName }); },
    markApiKeyStatus: async () => {},
    recordAiTokenUsage: async () => {}
  });

  await assert.rejects(
    () => executeWithKeyPool(1, async () => {
      const err = new Error('[429] RequestsPerDayPerProject exceeded for free_tier');
      err.status = 429;
      err.geminiModel = 'gemini-3.1-flash-lite';
      throw err;
    }, { modelName: resolvedLight.model, role: 'light' }),
    /QUOTA_EXHAUSTED/
  );

  assert.deepEqual(exhaustedMarks, [{ id: 9, modelName: 'gemini-3.1-flash-lite' }]);
});

test('4. buildProvisionTenantDefaultSettings copies model keys from default_tenant and omits gemini_model', async () => {
  const mockClient = {
    query: async () => ({
      rows: [
        { setting_key: 'gemini_api_tier', setting_value: 'free' },
        { setting_key: 'gemini_model_primary', setting_value: 'gemini-3.5-flash-lite' },
        { setting_key: 'gemini_model_fallback', setting_value: 'gemini-3.6-flash' },
        { setting_key: 'gemini_smart_routing', setting_value: 'on' }
      ]
    })
  };

  const defaults = await buildProvisionTenantDefaultSettings(mockClient, 'Asia/Jakarta');
  assert.equal(defaults.gemini_model, undefined);
  assert.equal(defaults.gemini_model_primary, 'gemini-3.5-flash-lite');
  assert.equal(defaults.gemini_model_fallback, 'gemini-3.6-flash');
});

test('5. Guard: no stray gemini-<digit> model literals outside allowed files', () => {
  const out = execSync('git grep -nE "[\'\\"\\\`]gemini-[0-9]" -- lib app', { encoding: 'utf8' });
  const allowedPaths = new Set([
    'lib/gemini.js',
    'lib/gemini-8s-tts.js',
    'lib/gemini-tts-batch.js',
    'lib/product-photo-providers/gemini.js',
    'lib/experiment-settings.js',
    'lib/ai-token-meter.js',
    'lib/db-pg.js',
    'app/settings/page.js',
    'app/settings/components/ExperimentSettingsPanel.js',
    'app/reports/page.js'
  ]);

  const disallowed = [];
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    const [filePath] = line.split(':', 1);
    if (allowedPaths.has(filePath)) continue;
    // Allow product_photo_gemini_model image default in app/api/settings/route.js
    if (filePath === 'app/api/settings/route.js' && line.includes('product_photo_gemini_model')) continue;
    disallowed.push(line);
  }

  assert.deepEqual(disallowed, [], `Unexpected hardcoded gemini models found:\n${disallowed.join('\n')}`);
});
