import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

const {
  resolveDefaultCardPhotoTab,
  resolveCardPhotoUrl,
  resolvePhotoStatusBadge,
  resolveEnrichButtonState,
  formatPhotoProviderLabel
} = await import('../lib/product-card-photo-view.js');

const { PRODUCT_IMPORT_COLUMNS, PRODUCT_UPDATE_COLUMNS } = await import('../lib/product-repository.js');

test('resolveDefaultCardPhotoTab defaults to cleaned when clean photo exists even if active_photo is raw_photo_url', () => {
  assert.equal(
    resolveDefaultCardPhotoTab({
      active_photo: 'raw_photo_url',
      raw_photo_url: '/uploads/raw.jpg',
      clean_photo_url: '/uploads/clean.png'
    }),
    'cleaned'
  );
  assert.equal(
    resolveDefaultCardPhotoTab({
      raw_photo_url: '/uploads/raw.jpg',
      cleaned_photo_url: '/uploads/cleaned.png'
    }),
    'cleaned'
  );
  assert.equal(
    resolveDefaultCardPhotoTab({
      active_photo: 'cleaned_photo_url',
      raw_photo_url: '/uploads/raw.jpg',
      clean_photo_url: null,
      cleaned_photo_url: null
    }),
    'raw'
  );
});

test('resolveCardPhotoUrl resolves explicit tab photo URL accurately', () => {
  const product = {
    raw_photo_url: '/api/v2/products/image?path=raw.jpg',
    clean_photo_url: '/api/v2/products/image?path=clean.png',
    cleaned_photo_url: '/api/v2/products/image?path=cleaned.png'
  };
  assert.equal(resolveCardPhotoUrl(product, 'raw'), product.raw_photo_url);
  assert.equal(resolveCardPhotoUrl(product, 'cleaned'), product.cleaned_photo_url);
  assert.equal(resolveCardPhotoUrl({ clean_photo_url: '/clean.png' }, 'cleaned'), '/clean.png');
  assert.equal(resolveCardPhotoUrl({ clean_photo_url: '/clean.png' }, 'raw'), null);
});

test('resolvePhotoStatusBadge maps statuses to semantic badge metadata', () => {
  assert.deepEqual(resolvePhotoStatusBadge('needs_review'), {
    label: 'Perlu ditinjau',
    shortLabel: 'Tinjau',
    tone: 'warning'
  });
  assert.deepEqual(resolvePhotoStatusBadge('approved'), {
    label: 'Disetujui',
    shortLabel: 'Disetujui',
    tone: 'success'
  });
  assert.deepEqual(resolvePhotoStatusBadge('processing'), {
    label: 'Sedang dibuat',
    shortLabel: 'Proses…',
    tone: 'info'
  });
  assert.equal(resolvePhotoStatusBadge('pending')?.label, 'Sedang dibuat');
  assert.equal(resolvePhotoStatusBadge(null), null);
});

test('resolveEnrichButtonState handles idle, loading, and retryable failures', () => {
  assert.deepEqual(resolveEnrichButtonState({ id: 'p1', enrichment_status: 'completed' }, null), {
    mode: 'idle',
    label: '🧠 Enrich AI',
    disabled: false
  });
  assert.deepEqual(resolveEnrichButtonState({ id: 'p1', enrichment_status: 'completed' }, 'p1'), {
    mode: 'loading',
    label: 'Enriching…',
    disabled: true
  });
  assert.deepEqual(resolveEnrichButtonState({ id: 'p1', enrichment_status: 'processing' }, null), {
    mode: 'loading',
    label: 'Enriching…',
    disabled: true
  });
  assert.deepEqual(
    resolveEnrichButtonState({ id: 'p1', enrichment_status: 'failed', enrichment_retryable: true }, null),
    {
      mode: 'retry',
      label: '🧠 Coba lagi',
      disabled: false
    }
  );
  assert.deepEqual(
    resolveEnrichButtonState({ id: 'p1', enrichment_status: 'failed', enrichment_retryable: false }, null),
    {
      mode: 'idle',
      label: '🧠 Enrich AI',
      disabled: false
    }
  );
});

test('formatPhotoProviderLabel maps known providers cleanly', () => {
  assert.equal(formatPhotoProviderLabel('glabs'), 'G-Labs (Local Worker)');
  assert.equal(formatPhotoProviderLabel('gemini'), 'Gemini AI Image');
  assert.equal(formatPhotoProviderLabel('upload'), 'Unggahan Manual');
  assert.equal(formatPhotoProviderLabel(null), 'Otomatis / Sistem');
});

test('PRODUCT_IMPORT_COLUMNS & PRODUCT_UPDATE_COLUMNS include previous_clean_photo_url (B5)', () => {
  assert.equal(PRODUCT_IMPORT_COLUMNS.includes('previous_clean_photo_url'), true);
  assert.equal(PRODUCT_UPDATE_COLUMNS.has('previous_clean_photo_url'), true);
});
