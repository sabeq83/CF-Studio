import { formatProductClipRanges } from './bridge-plan.js';

function formatZoneClipSpan(zoneEntry) {
  if (zoneEntry.start === zoneEntry.end) return `Klip #${zoneEntry.start}`;
  return `KLIP #${zoneEntry.start} s.d. KLIP #${zoneEntry.end}`;
}

/**
 * Generates sequential per-zone narrative + visual isolation directives.
 * When plan has a single segment, preserves existing single-segment wording so Stage 1
 * regression snapshots remain identical. When plan has 2-3 segments, expands into
 * explicit PRE -> INTRO -> GAP -> RECALL -> POST zoning rules.
 */
export function buildBridgeZoningContract(plan, options = {}) {
  const {
    mode = 'multiplier', // 'multiplier' | 'pillar'
    productName = '',
    productUsp = '',
    promoStyle = 'Softselling',
    mandatoryOutroLine = ''
  } = options;

  if (!plan || !plan.active || !Array.isArray(plan.segments) || plan.segments.length === 0) {
    return '';
  }

  const targetClipsCount = plan.targetClips;

  // SINGLE-SEGMENT LEGACY-EQUIVALENT BRANCH
  if (plan.segments.length === 1 && mode === 'multiplier') {
    const seg = plan.segments[0];
    const bridgeAtClip = seg.start;
    const clampedProductEndClip = seg.end;
    const preBridgeRange = bridgeAtClip > 2 ? `Klip 1 s.d. Klip ${bridgeAtClip - 1}` : 'Klip 1';
    const postBridgeStart = clampedProductEndClip + 1;

    return `🚨 PRODUCT BRIDGING & STRICT CLIP ZONING CONTRACT (TOTAL ${targetClipsCount} KLIP, BRIDGING MULAI KLIP #${bridgeAtClip}):
${bridgeAtClip > 1 ? `1. **ZONA PRE-BRIDGING (${preBridgeRange})**: Fokus 100% membangun hook pembuka, masalah/ketertarikan audiens, serta langkah/konteks awal sesuai blueprint asli. DILARANG KERAS (STRICTLY FORBIDDEN) menyebut nama merek/produk "${productName}", memunculkan kemasan produk di prompt visual, atau melakukan penjualan di zona ini. Pastikan klip tepat sebelum Klip #${bridgeAtClip} menyiapkan logika alasan mengapa solusi di Klip #${bridgeAtClip} dibutuhkan.` : ''}
${bridgeAtClip > 1 ? '2' : '1'}. **TITIK PIVOT BRIDGING (TEPAT DI KLIP #${bridgeAtClip})**: Di sinilah produk "${productName}" pertama kali diperkenalkan secara halus sebagai kunci/solusi alami yang menjawab konteks klip sebelumnya. Hubungkan USP produk ("${productUsp}") ke aksi visual adegan tanpa terdengar seperti iklan yang dipaksakan.
${clampedProductEndClip > bridgeAtClip ? `${bridgeAtClip > 1 ? '3' : '2'}. **ZONA PEMBAHASAN PRODUK (KLIP #${bridgeAtClip} s.d. KLIP #${clampedProductEndClip})**: Perdalam manfaat/tekstur/keunggulan produk "${productName}" ("${productUsp}") secara meyakinkan yang menyatu dengan progres aktivitas visual.` : ''}
${postBridgeStart <= targetClipsCount ? `4. **ZONA PENUTUP / TRANSITION BACK (KLIP #${postBridgeStart} s.d. KLIP #${targetClipsCount})**: Kembalikan fokus pada hasil akhir yang memuaskan (payoff) serta kesimpulan cerita${mandatoryOutroLine ? `, dan akhiri Scene #${targetClipsCount} dengan kalimat wajib "${mandatoryOutroLine}"` : ''}.` : ''}`;
  }

  // MULTI-SEGMENT ZONING CONTRACT (2-3 SEGMENTS, PRE -> INTRO -> GAP -> RECALL -> POST)
  const scheduleDesc = formatProductClipRanges(plan, { lang: 'id', style: 'short' });
  const header = `🚨 PRODUCT BRIDGING MULTI-SEGMENT & STRICT CLIP ZONING CONTRACT (TOTAL ${targetClipsCount} KLIP | JADWAL PRODUK: ${scheduleDesc}):`;
  const lines = [header];

  let step = 1;
  for (let zi = 0; zi < plan.zones.length; zi++) {
    const z = plan.zones[zi];
    const span = formatZoneClipSpan(z);

    if (z.zone === 'pre') {
      lines.push(
        `${step++}. **ZONA PRE-BRIDGING (${span})**: Fokus 100% membangun hook pembuka, masalah/ketertarikan audiens, dan konteks cerita. DILARANG KERAS (STRICTLY FORBIDDEN) menyebut nama merek/produk "${productName}", komposisi/bahan spesifik produk, memunculkan kemasan di prompt visual, atau melakukan penjualan. Klip tepat sebelum Klip #${z.end + 1} wajib menyiapkan jembatan logis mengapa solusi dibutuhkan.`
      );
    } else if (z.zone === 'intro') {
      const hasMultiSpan = z.end > z.start;
      lines.push(
        `${step++}. **ZONA INTRO PRODUK — PERKENALAN UTAMA (${span})**: Perkenalkan produk "${productName}" pertama kali secara halus (gaya "${promoStyle}") sebagai jawaban alami atas konteks sebelumnya. Hubungkan USP ("${productUsp}") ke aksi visual${hasMultiSpan ? ' dan dalami manfaat/tekstur produk sepanjang segmen ini' : ''}. Prompt visual WAJIB menampilkan produk sesuai Product Truth & foto referensi.`
      );
    } else if (z.zone === 'gap') {
      const nextZone = plan.zones[zi + 1];
      const nextStartHint = nextZone ? `Klip #${nextZone.start}` : 'segmen berikutnya';
      lines.push(
        `${step++}. **ZONA GAP / JEDA CERITA MURNI (${span} — SANDWICH RETURN)**: Kembali ke alur cerita utama / dampak nyata di kehidupan audiens agar video terasa organik dan tidak seperti iklan terus-menerus. DILARANG KERAS menyebut nama produk "${productName}", memunculkan kemasan/botol di prompt visual, atau berjualan di zona ini. Pastikan pada Klip #${z.end} narasi mengarah halus ke konteks pengingat di ${nextStartHint}.`
      );
    } else if (z.zone === 'recall') {
      lines.push(
        `${step++}. **ZONA RECALL PRODUK — PENGINGAT / BUKTI / CTA (${span})**: Produk "${productName}" muncul kembali (gaya "${promoStyle}"). **DILARANG MEMPERKENALKAN ULANG DARI AWAL** (dilarang memakai frasa seperti "kenalin ini...", "buat yang belum tahu...", atau mengulang definisi/USP yang sudah dijelaskan di Intro). Fokus pada pengingat singkat (boleh gunakan sebutan nama ringkas/alias produk), bukti hasil praktis, maksimal satu sudut manfaat pelengkap, atau ajakan ringan. Prompt visual WAJIB menampilkan kemasan yang konsisten dengan Product Truth yang sama seperti di zona Intro.${z.end === targetClipsCount && mandatoryOutroLine ? ` Akhiri Scene #${targetClipsCount} tepat dengan kalimat wajib "${mandatoryOutroLine}".` : ''}`
      );
    } else if (z.zone === 'post') {
      lines.push(
        `${step++}. **ZONA POST-BRIDGING / PENUTUP (${span})**: Kembalikan fokus ke hasil akhir yang memuaskan (payoff) serta kesimpulan cerita tanpa memperkenalkan fitur produk baru dan tanpa kemasan produk di visual${mandatoryOutroLine ? `, dan akhiri Scene #${targetClipsCount} dengan kalimat wajib "${mandatoryOutroLine}"` : ''}.`
      );
    }
  }

  return lines.join('\n');
}

