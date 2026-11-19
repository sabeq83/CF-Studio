/**
 * Perhitungan Skor Peluang Radar Produk (Rumus Transparan v1, 0–100).
 * Catatan aturan produk: skor HANYA alat bantu urutan kurasi dan TIDAK pernah memicu promosi otomatis.
 */

export const OPPORTUNITY_SCORE_RULES = {
  version: 'v1',
  maxTotal: 100,
  disclaimer: 'Skor hanya alat bantu urutan kurasi dan tidak pernah memicu promosi otomatis.',
  components: [
    { key: 'sold', label: 'Penjualan/minggu', max: 30 },
    { key: 'trend', label: 'Arah tren', max: 20 },
    { key: 'commission', label: 'Komisi/produk', max: 20 },
    { key: 'price', label: 'Zona harga', max: 15 },
    { key: 'url_match', label: 'Kesiapan URL', max: 15 }
  ]
};

function toFiniteNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function formatDateBadge(observedAt, externalBatchId) {
  const raw = observedAt || externalBatchId;
  if (!raw) return '';
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return String(raw);
  return dt.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta'
  });
}

function formatRpShort(val) {
  return `Rp${Math.round(val).toLocaleString('id-ID')}`;
}

export function computeOpportunityScore(candidate) {
  const rd = candidate?.research_data || {};
  const sold = toFiniteNumber(rd.sold_per_week);
  const commission = toFiniteNumber(rd.commission_rp);
  const price = toFiniteNumber(rd.price);
  const rawTrend = String(rd.trend || '').trim().toLowerCase();
  const urlStatus = String(candidate?.url_status || 'not_researched').trim();
  const dateLabel = formatDateBadge(candidate?.observed_at, candidate?.external_batch_id);
  const dateSuffix = dateLabel ? ` (${dateLabel})` : '';

  let soldScore = 0;
  if (sold !== null && sold > 0) {
    if (sold >= 1000) soldScore = 30;
    else if (sold >= 500) soldScore = 24;
    else if (sold >= 200) soldScore = 18;
    else if (sold >= 50) soldScore = 12;
    else soldScore = 6;
  }

  let trendScore = 8;
  let trendLabel = 'Tidak tercatat';
  if (rawTrend === 'up' || rawTrend === 'naik') {
    trendScore = 20;
    trendLabel = '↑ Naik';
  } else if (rawTrend === 'stable' || rawTrend === 'stabil') {
    trendScore = 12;
    trendLabel = '→ Stabil';
  } else if (rawTrend === 'down' || rawTrend === 'menurun' || rawTrend === 'turun') {
    trendScore = 4;
    trendLabel = '↓ Menurun';
  }

  let commissionScore = 0;
  if (commission !== null && commission > 0) {
    if (commission >= 25000) commissionScore = 20;
    else if (commission >= 15000) commissionScore = 16;
    else if (commission >= 8000) commissionScore = 12;
    else if (commission >= 3000) commissionScore = 8;
    else commissionScore = 4;
  }

  let priceScore = 0;
  let priceNote = 'Harga tidak tercatat';
  if (price !== null && price > 0) {
    if (price >= 35000 && price <= 250000) {
      priceScore = 15;
      priceNote = `${formatRpShort(price)} (sweet spot Rp35rb–Rp250rb)`;
    } else if ((price >= 20000 && price < 35000) || (price > 250000 && price <= 500000)) {
      priceScore = 11;
      priceNote = `${formatRpShort(price)} (zona menengah)`;
    } else if (price < 20000 || (price > 500000 && price <= 1000000)) {
      priceScore = 7;
      priceNote = `${formatRpShort(price)} (zona tepi)`;
    } else {
      priceScore = 4;
      priceNote = `${formatRpShort(price)} (> Rp1jt)`;
    }
  }

  const urlScoreMap = {
    official: { score: 15, label: 'URL Resmi' },
    user: { score: 14, label: 'Verifikasi Kurator' },
    listing: { score: 12, label: 'URL Listing' },
    nearest: { score: 4, label: 'Terdekat (perlu verifikasi)' },
    not_found: { score: 0, label: 'Belum ditemukan' },
    not_researched: { score: 0, label: 'Belum diriset' }
  };
  const urlMeta = urlScoreMap[urlStatus] || { score: 0, label: urlStatus };

  const total = soldScore + trendScore + commissionScore + priceScore + urlMeta.score;
  const tier = total >= 80 ? 'high' : total >= 60 ? 'medium' : 'low';
  const tierLabel = tier === 'high'
    ? 'Prioritas Tinggi'
    : tier === 'medium'
      ? 'Potensial'
      : 'Perlu Tinjau';

  return {
    version: OPPORTUNITY_SCORE_RULES.version,
    total,
    max: OPPORTUNITY_SCORE_RULES.maxTotal,
    tier,
    tier_label: tierLabel,
    note: OPPORTUNITY_SCORE_RULES.disclaimer,
    observed_at: candidate?.observed_at || candidate?.external_batch_id || null,
    breakdown: [
      {
        key: 'sold',
        label: 'Penjualan/minggu',
        score: soldScore,
        max: 30,
        detail: sold !== null ? `${sold.toLocaleString('id-ID')} terjual/mg${dateSuffix}` : `Belum ada data${dateSuffix}`
      },
      {
        key: 'trend',
        label: 'Arah tren',
        score: trendScore,
        max: 20,
        detail: `${trendLabel}${dateSuffix}`
      },
      {
        key: 'commission',
        label: 'Komisi/produk',
        score: commissionScore,
        max: 20,
        detail: commission !== null ? `${formatRpShort(commission)}${dateSuffix}` : `Belum ada data${dateSuffix}`
      },
      {
        key: 'price',
        label: 'Zona harga',
        score: priceScore,
        max: 15,
        detail: `${priceNote}${dateSuffix}`
      },
      {
        key: 'url_match',
        label: 'Kesiapan URL',
        score: urlMeta.score,
        max: 15,
        detail: urlMeta.label
      }
    ]
  };
}
