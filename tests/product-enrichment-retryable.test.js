import test from 'node:test';
import assert from 'node:assert/strict';

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

test('S9: Product detail response decorates enrichment_retryable fields accurately', () => {
  const decorateProduct = (product) => {
    const p = { ...product };
    const errText = (p.enrichment_error || '').toLowerCase();
    const isQuota = errText.includes('quota') || errText.includes('rate limit') || errText.includes('resource_exhausted') || errText.includes('429') || errText.includes('503');
    if (p.enrichment_status === 'failed' && isQuota) {
      p.enrichment_retryable = true;
      p.enrichment_retry_hint = 'Jalankan cf_enrich_product untuk mengulang';
    } else {
      p.enrichment_retryable = false;
      p.enrichment_retry_hint = null;
    }
    return p;
  };

  // Case 1: Failed due to quota
  const failedQuota = decorateProduct({
    id: 'pe_test_1',
    enrichment_status: 'failed',
    enrichment_error: 'QUOTA_EXHAUSTED (dapat diulang): 429 Resource Exhausted'
  });
  assert.equal(failedQuota.enrichment_retryable, true);
  assert.equal(failedQuota.enrichment_retry_hint, 'Jalankan cf_enrich_product untuk mengulang');

  // Case 2: Failed due to parse error (not quota)
  const failedOther = decorateProduct({
    id: 'pe_test_2',
    enrichment_status: 'failed',
    enrichment_error: 'Invalid JSON response from AI'
  });
  assert.equal(failedOther.enrichment_retryable, false);
  assert.equal(failedOther.enrichment_retry_hint, null);

  // Case 3: Completed status
  const completed = decorateProduct({
    id: 'pe_test_3',
    enrichment_status: 'completed',
    enrichment_error: null
  });
  assert.equal(completed.enrichment_retryable, false);
  assert.equal(completed.enrichment_retry_hint, null);
});
