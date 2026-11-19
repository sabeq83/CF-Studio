export function formatRp(value) {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return `Rp${num.toLocaleString('id-ID')}`;
}

export function formatObservedDate(isoOrString) {
  if (!isoOrString) return 'tanggal pengamatan tidak tercatat';
  const date = new Date(isoOrString);
  if (Number.isNaN(date.getTime())) return String(isoOrString);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta'
  });
}

export function formatDateTimeId(isoOrString) {
  if (!isoOrString) return '—';
  const date = new Date(isoOrString);
  if (Number.isNaN(date.getTime())) return String(isoOrString);
  return date.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta'
  });
}

export function getDisplayName(c) {
  return (
    c?.curated_data?.name ||
    c?.research_data?.name ||
    c?.external_candidate_id ||
    'Produk Tanpa Nama'
  );
}

export function getDisplayCategory(c) {
  return c?.curated_data?.category || c?.research_data?.category || '—';
}

export function getDisplayBrand(c) {
  return c?.curated_data?.brand || c?.research_data?.brand || '';
}

export function labelTrend(trend) {
  const t = String(trend || '').toLowerCase();
  if (t === 'up' || t === 'naik') return '↑ Naik';
  if (t === 'down' || t === 'menurun' || t === 'turun') return '↓ Menurun';
  if (t === 'stable' || t === 'stabil') return '→ Stabil';
  return trend || '—';
}

export function trendTone(trend) {
  const t = String(trend || '').toLowerCase();
  if (t === 'up' || t === 'naik') return 'success';
  if (t === 'down' || t === 'menurun' || t === 'turun') return 'danger';
  return 'muted';
}

export function labelUrlStatus(status) {
  const map = {
    official: 'Resmi',
    listing: 'Listing',
    nearest: 'Terdekat',
    not_found: 'Tidak ditemukan',
    user: 'Dari pengguna',
    not_researched: 'Belum diriset'
  };
  return map[status] || status || '—';
}

export function urlStatusTone(status) {
  const map = {
    official: 'success',
    listing: 'info',
    user: 'neutral',
    nearest: 'warning',
    not_found: 'danger',
    not_researched: 'muted'
  };
  return map[status] || 'muted';
}

export function labelCurationStatus(status) {
  const map = {
    new: 'Baru',
    needs_info: 'Perlu dilengkapi',
    ready: 'Siap diajukan',
    archived: 'Diarsipkan'
  };
  return map[status] || status || '—';
}

export function curationStatusTone(status) {
  const map = {
    new: 'info',
    needs_info: 'warning',
    ready: 'success',
    archived: 'muted'
  };
  return map[status] || 'muted';
}

export function labelProcessStatus(status) {
  const map = {
    not_sent: 'Belum dikirim',
    queued: 'Antre',
    processing: 'Diproses',
    in_catalog: 'Masuk katalog',
    needs_review: 'Perlu review',
    failed: 'Gagal'
  };
  return map[status] || status || '—';
}

export function processStatusTone(status) {
  const map = {
    not_sent: 'muted',
    queued: 'info',
    processing: 'info',
    in_catalog: 'success',
    needs_review: 'warning',
    failed: 'danger'
  };
  return map[status] || 'muted';
}

export function extractDomainHint(url) {
  if (!url) return 'belum ada URL';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'URL perlu cek';
  }
}

export function scoreTierTone(tier) {
  if (tier === 'high') return 'success';
  if (tier === 'medium') return 'info';
  return 'warning';
}

export function formatSignedDelta(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  return `${n >= 0 ? '+' : ''}${n.toLocaleString('id-ID')}`;
}
