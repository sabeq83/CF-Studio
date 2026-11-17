/**
 * Helper murni tampilan foto & tombol Enrichment pada kartu produk.
 * Dipakai oleh UI `/products` dan diuji langsung lewat unit test.
 */

export function hasCleanPhoto(product) {
  return Boolean(product?.cleaned_photo_url || product?.clean_photo_url);
}

export function hasRawPhoto(product) {
  return Boolean(product?.raw_photo_url);
}

/**
 * Menentukan tab foto default pada kartu produk.
 * Jika produk sudah memiliki foto bersih (clean_photo_url / cleaned_photo_url),
 * thumbnail kartu selalu default ke `'cleaned'` meskipun active_photo belum diset
 * atau masih menunjuk `'raw_photo_url'`.
 */
export function resolveDefaultCardPhotoTab(product) {
  if (hasCleanPhoto(product)) return 'cleaned';
  return 'raw';
}

/**
 * Mengambil URL foto untuk tab `'raw'` (Asli) atau `'cleaned'` (Hasil AI).
 */
export function resolveCardPhotoUrl(product, tab) {
  if (!product) return null;
  const effectiveTab = tab || resolveDefaultCardPhotoTab(product);
  if (effectiveTab === 'raw') {
    return product.raw_photo_url || null;
  }
  return product.cleaned_photo_url || product.clean_photo_url || null;
}

/**
 * Memetakan status foto produk ke label & tone badge semantik UI.
 */
export function resolvePhotoStatusBadge(photoStatus) {
  switch (photoStatus) {
    case 'needs_review':
      return { label: 'Perlu ditinjau', shortLabel: 'Tinjau', tone: 'warning' };
    case 'approved':
      return { label: 'Disetujui', shortLabel: 'Disetujui', tone: 'success' };
    case 'processing':
    case 'pending':
      return { label: 'Sedang dibuat', shortLabel: 'Proses…', tone: 'info' };
    case 'failed':
      return { label: 'Gagal foto', shortLabel: 'Gagal', tone: 'danger' };
    default:
      return null;
  }
}

/**
 * Menentukan label dan status tombol Enrich AI pada kartu produk.
 */
export function resolveEnrichButtonState(product, activeReEnrichId = null) {
  const isProcessing = activeReEnrichId === product?.id
    || product?.enrichment_status === 'processing'
    || product?.enrichment_status === 'pending';

  if (isProcessing) {
    return { mode: 'loading', label: 'Enriching…', disabled: true };
  }
  if (product?.enrichment_status === 'failed' && product?.enrichment_retryable) {
    return { mode: 'retry', label: '🧠 Coba lagi', disabled: false };
  }
  return { mode: 'idle', label: '🧠 Enrich AI', disabled: false };
}

/**
 * Memformat nama provider foto untuk ditampilkan di Jendela Banding.
 */
export function formatPhotoProviderLabel(provider) {
  switch (provider) {
    case 'glabs':
      return 'G-Labs (Local Worker)';
    case 'gemini':
      return 'Gemini AI Image';
    case 'upload':
      return 'Unggahan Manual';
    case 'system_default':
    case null:
    case undefined:
    case '':
      return 'Otomatis / Sistem';
    default:
      return String(provider);
  }
}
