const BARE_DATETIME_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;
export const JAKARTA_TIMEZONE = 'Asia/Jakarta';

/**
 * Mengubah string/Date timestamp menjadi objek Date UTC yang akurat.
 * String timestamp tanpa offset zona waktu (mis. PostgreSQL TIMESTAMP WITHOUT TIME ZONE)
 * ditafsirkan sebagai UTC agar tidak tergeser oleh zona waktu lokal server/browser.
 */
export function parseUtcDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = BARE_DATETIME_RE.test(raw)
    ? new Date(`${raw.replace(' ', 'T')}Z`)
    : new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatWibDateTime(value, options = {}) {
  const date = parseUtcDate(value);
  if (!date) return '-';
  return `${date.toLocaleString('id-ID', {
    timeZone: JAKARTA_TIMEZONE,
    ...options
  })} WIB`;
}

export function formatWibTime(value, options = {}) {
  const date = parseUtcDate(value);
  if (!date) return '-';
  return `${date.toLocaleTimeString('id-ID', {
    timeZone: JAKARTA_TIMEZONE,
    ...options
  })} WIB`;
}

export function formatWibShortDateTime(value) {
  const date = parseUtcDate(value);
  if (!date) return '-';
  return `${date.toLocaleDateString('id-ID', {
    timeZone: JAKARTA_TIMEZONE,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })} WIB`;
}
