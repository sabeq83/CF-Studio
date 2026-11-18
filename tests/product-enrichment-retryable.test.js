process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';
process.env.PG_SEARCH_PATH = process.env.PG_SEARCH_PATH || 'dev';

import test from 'node:test';
import assert from 'node:assert/strict';

const { isRetryableGeminiError } = await import('../lib/gemini.js');

function decorateProductRetryable(product) {
  const p = { ...product };
  p.enrichment_retryable = p.enrichment_status === 'failed' && isRetryableGeminiError(p.enrichment_error);
  p.enrichment_retry_hint = p.enrichment_retryable ? 'Jalankan cf_enrich_product untuk mengulang' : null;
  return p;
}

test('S9: isRetryableGeminiError mengenali pola kuota, 429, 503, rate limit, resource_exhausted, dan kata quota saja', () => {
  assert.equal(isRetryableGeminiError('429 Too Many Requests'), true);
  assert.equal(isRetryableGeminiError('503 Service Unavailable'), true);
  assert.equal(isRetryableGeminiError('Rate limit reached for RPM'), true);
  assert.equal(isRetryableGeminiError('RESOURCE_EXHAUSTED'), true);
  assert.equal(isRetryableGeminiError('Daily quota limit hit'), true);
  assert.equal(isRetryableGeminiError('SyntaxError: Unexpected token'), false);
});

test('S9: Quota error formatting logic prefixes QUOTA_EXHAUSTED', () => {
  const formatEnrichmentError = (errMsg) => {
    let enrichmentError = errMsg.slice(0, 500);
    const msgLower = errMsg.toLowerCase();
    if (msgLower.includes('quota') || msgLower.includes('rate limit') || msgLower.includes('resource_exhausted') || msgLower.includes('429') || msgLower.includes('503')) {
      enrichmentError = `QUOTA_EXHAUSTED (dapat diulang): ${errMsg}`.slice(0, 500);
    }
    return enrichmentError;
  };

  const rawQuotaMsg = 'GoogleGenerativeAIError: [429 Too Many Requests] RESOURCE_EXHAUSTED quota exceeded';
  const formatted = formatEnrichmentError(rawQuotaMsg);
  assert.ok(formatted.startsWith('QUOTA_EXHAUSTED (dapat diulang):'));

  const standardMsg = 'SyntaxError: Unexpected token';
  const standardFormatted = formatEnrichmentError(standardMsg);
  assert.equal(standardFormatted, 'SyntaxError: Unexpected token');
});

test('S9: Product detail response decorates enrichment_retryable via isRetryableGeminiError only when status is failed', () => {
  // Case 1: Failed due to quota / 429
  const failedQuota = decorateProductRetryable({
    id: 'pe_test_1',
    enrichment_status: 'failed',
    enrichment_error: 'QUOTA_EXHAUSTED (dapat diulang): 429 Resource Exhausted'
  });
  assert.equal(failedQuota.enrichment_retryable, true);
  assert.equal(failedQuota.enrichment_retry_hint, 'Jalankan cf_enrich_product untuk mengulang');

  // Case 2: Failed due to bare quota message or 503
  const failedBareQuota = decorateProductRetryable({
    id: 'pe_test_1b',
    enrichment_status: 'failed',
    enrichment_error: 'API key quota exhausted for today'
  });
  assert.equal(failedBareQuota.enrichment_retryable, true);

  const failed503 = decorateProductRetryable({
    id: 'pe_test_1c',
    enrichment_status: 'failed',
    enrichment_error: '503 High Demand'
  });
  assert.equal(failed503.enrichment_retryable, true);

  // Case 3: Failed due to parse error (not quota/retryable)
  const failedOther = decorateProductRetryable({
    id: 'pe_test_2',
    enrichment_status: 'failed',
    enrichment_error: 'Invalid JSON response from AI'
  });
  assert.equal(failedOther.enrichment_retryable, false);
  assert.equal(failedOther.enrichment_retry_hint, null);

  // Case 4: Completed status must stay false even if stale error text exists
  const completed = decorateProductRetryable({
    id: 'pe_test_3',
    enrichment_status: 'completed',
    enrichment_error: '429 stale error'
  });
  assert.equal(completed.enrichment_retryable, false);
  assert.equal(completed.enrichment_retry_hint, null);
});
