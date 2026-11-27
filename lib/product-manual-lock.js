/**
 * Helper penguncian suntingan manual (kemasan dan USP) pada produk.
 * Menjaga penanda di raw_response agar enrichment otomatis tidak menimpa pilihan pengguna.
 */

export function parseRawResponseSafe(rawResponse) {
  if (!rawResponse) return {};
  if (typeof rawResponse === 'object' && !Array.isArray(rawResponse)) {
    return { ...rawResponse };
  }
  try {
    const parsed = JSON.parse(rawResponse);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

export function normalizeUspForComparison(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return value.map(item => String(item ?? '').trim()).filter(Boolean).join('\n');
  }
  const raw = String(value).trim();
  if (!raw) return '';
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item ?? '').trim()).filter(Boolean).join('\n');
      }
    } catch (_) {
      // Fallback sebagai teks berbaris biasa
    }
  }
  return raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
}

export function isUspEdited(existing, updateData) {
  if (!updateData || updateData.unique_selling_point === undefined) return false;
  const nextNormalized = normalizeUspForComparison(updateData.unique_selling_point);
  if (!nextNormalized) return false;
  const prevNormalized = normalizeUspForComparison(existing?.unique_selling_point);
  return nextNormalized !== prevNormalized;
}

export function markManualUspSource(rawResponse) {
  const base = parseRawResponseSafe(rawResponse);
  return JSON.stringify({ ...base, usp_source: 'manual' });
}

export function markManualPackagingSourceIfChanged(existing, updateData) {
  const pkgTypeChanged = updateData.packaging_type !== undefined
    && String(updateData.packaging_type ?? '') !== String(existing?.packaging_type ?? '');
  const pkgStatusChanged = updateData.packaging_status !== undefined
    && String(updateData.packaging_status ?? '') !== String(existing?.packaging_status ?? '');
  if (!pkgTypeChanged && !pkgStatusChanged) return null;

  const base = parseRawResponseSafe(existing?.raw_response);
  return JSON.stringify({ ...base, packaging_source: 'manual' });
}
