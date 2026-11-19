import fs from 'node:fs';
import path from 'node:path';

const TREND_MAP = {
  naik: 'up',
  up: 'up',
  stabil: 'stable',
  stable: 'stable',
  menurun: 'down',
  turun: 'down',
  down: 'down'
};

const URL_STATUS_MAP = {
  resmi: 'official',
  official: 'official',
  listing: 'listing',
  terdekat: 'nearest',
  nearest: 'nearest',
  'tidak ditemukan': 'not_found',
  not_found: 'not_found',
  'dari pengguna': 'user',
  user: 'user',
  'tidak diriset': 'not_researched',
  'belum diriset': 'not_researched',
  not_researched: 'not_researched'
};

export function mapTeleRadarTrend(rawTrend) {
  const key = String(rawTrend || '').trim().toLowerCase();
  return TREND_MAP[key] || 'stable';
}

export function mapTeleRadarUrlStatus(rawStatus) {
  const key = String(rawStatus || '').trim().toLowerCase();
  return URL_STATUS_MAP[key] || 'not_researched';
}

export function buildTeleRadarBatchIngestPayload(rawJson, { batchDir = null, includeLocalPhotos = true } = {}) {
  const products = Array.isArray(rawJson?.produk)
    ? rawJson.produk
    : (Array.isArray(rawJson?.candidates) ? rawJson.candidates : []);

  const externalBatchId = String(rawJson?.tanggal || rawJson?.external_batch_id || '').trim();
  if (!externalBatchId) {
    throw new Error('Field "tanggal" atau "external_batch_id" tidak ditemukan pada data.json.');
  }

  const observedAt = /^\d{4}-\d{2}-\d{2}$/.test(externalBatchId)
    ? `${externalBatchId}T08:00:00+07:00`
    : (rawJson?.observed_at || null);

  const candidates = products.map((item, idx) => {
    const extId = String(item?.no ?? item?.external_candidate_id ?? (idx + 1)).trim();
    const urlStatus = mapTeleRadarUrlStatus(item?.status_url || item?.url_status);
    const sourceUrl = item?.url ? String(item.url).trim() : '';

    let thumbBase64 = null;
    if (includeLocalPhotos && batchDir) {
      const candidateFotoName = item?.foto ? path.basename(String(item.foto)) : `${extId}.jpg`;
      const localFotoPath = path.join(batchDir, 'foto', candidateFotoName);
      if (fs.existsSync(localFotoPath)) {
        const buf = fs.readFileSync(localFotoPath);
        if (buf.length > 0 && buf.length <= 5 * 1024 * 1024) {
          thumbBase64 = buf.toString('base64');
        }
      }
    }

    // Catatan historis dari batch lama: TIDAK memicu promosi & TIDAK dicocokkan ke katalog Dev
    const researchData = {
      rank: Number(item?.rank || item?.no || idx + 1),
      no: item?.no ?? idx + 1,
      name: String(item?.nama || item?.name || `Produk #${extId}`).trim(),
      brand: String(item?.toko || item?.brand || '').trim(),
      category: String(item?.kategori || item?.category || '').trim(),
      sold_per_week: item?.terjual != null ? Number(item.terjual) : null,
      trend: mapTeleRadarTrend(item?.tren || item?.trend),
      trend_label: item?.tren || null,
      trend_note: item?.catatan_tren ? String(item.catatan_tren).trim() : '',
      commission_rp: item?.komisi != null ? Number(item.komisi) : null,
      price: item?.harga != null ? Number(item.harga) : null,
      original_price: item?.harga_coret != null ? Number(item.harga_coret) : null,
      shop_label: item?.label || null,
      recommended: Boolean(item?.rekomendasi),
      description: item?.deskripsi ? String(item.deskripsi).trim() : '',
      usp: item?.usp ? String(item.usp).trim() : '',
      photo_source: item?.foto_sumber || 'screenshot',
      url_note: item?.catatan_url || null,
      legacy_approved: Boolean(item?.disetujui),
      legacy_cf_status: item?.cf_status || null,
      legacy_staging_cf_product_id: item?.cf_product_id || null
    };

    return {
      external_candidate_id: extId,
      url_status: urlStatus,
      source_url: sourceUrl || null,
      research_data: researchData,
      ...(thumbBase64 ? { thumb_base64: thumbBase64 } : {})
    };
  });

  return {
    batch: {
      source: 'teleradar',
      external_batch_id: externalBatchId,
      observed_at: observedAt,
      metadata: {
        imported_from: 'teleradar_data_json',
        total_items: candidates.length
      }
    },
    candidates
  };
}
