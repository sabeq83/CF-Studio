/**
 * Dynamic Story Curve Micro-KB Helper
 * Menyediakan aturan narasi adaptif untuk Brand Editorial, Product Campaign,
 * dan Multiplier Seamless Bridging mengikuti target_clips_count (tidak dibatasi kaku 4 babak).
 */

import { readKbFile } from '../kb-loader.js';

export function getMicroKbContent(filename) {
  try {
    return readKbFile(filename);
  } catch (_) {
    return '';
  }
}

export function buildDynamicStoryCurveGuideline({
  campaignKind = 'brand_editorial', // 'brand_editorial' | 'product_campaign' | 'multiplier'
  targetClips = 4,
  bridgeAtClip = 2,
  bridgeDurationClips = 1,
  bridgePlan = null,
  narrativeMode = 'Storytelling',
  language = 'id-ID',
  brandVoice = '',
  targetAudience = '',
  objective = ''
}) {
  const isEn = (language || '').toLowerCase().startsWith('en');
  const clipsCount = Math.max(2, Math.min(12, Number(targetClips) || 4));
  const normalizedBridgeAt = Math.max(1, Math.min(clipsCount, Number(bridgeAtClip) || 2));
  const isEditorial = campaignKind === 'brand_editorial';
  const isMultiplier = campaignKind === 'multiplier' || campaignKind === 're_campaign';
  const isDirectShowcase = !isEditorial && (
    String(narrativeMode || '').trim() === 'Direct_Showcase' ||
    (clipsCount <= 2 && normalizedBridgeAt <= 1)
  );
  const hasMultiSegment = Boolean(bridgePlan?.active && Array.isArray(bridgePlan.segments) && bridgePlan.segments.length > 1);
  const multiplierBridgeRule = hasMultiSegment
    ? bridgePlan.segments.map((seg, idx) => {
        const span = seg.start === seg.end ? `Klip #${seg.start}` : `Klip #${seg.start}–#${seg.end}`;
        return idx === 0
          ? `   - Titik Intro Produk (${span}): Hubungkan masalah/cerita viral secara organik ke solusi produk (hindari iklan kasar).`
          : `   - Titik Recall Produk #${idx + 1} (${span}): Kemunculan pengingat/bukti hasil/CTA halus tanpa memperkenalkan ulang dari nol (jaga jeda cerita murni di antaranya).`;
      }).join('\n')
    : (normalizedBridgeAt <= 1
      ? `   - Direct Showcase Sejak Klip #1: Produk target langsung tampil dan menjadi fokus utama sejak detik pertama, lanjutkan dengan pembuktian detail/fit/fungsi.`
      : `   - Titik Bridging Alami (Klip #${normalizedBridgeAt}): Hubungkan masalah/cerita viral secara organik ke solusi produk.
   - Penonton TIDAK BOLEH merasa sedang melihat iklan kasar. Transisi harus terasa seperti rekomendasi tulus.
   - Tunjukkan Unique Selling Proposition (USP) produk dan demo visual transformasi yang memuaskan.`);

  // Read base micro-KB file if available as reference
  let baseGuideFile = '';
  if (isEditorial) {
    baseGuideFile = getMicroKbContent('BRAND_EDITORIAL_GUIDE.md');
  } else if (isMultiplier) {
    baseGuideFile = getMicroKbContent('MULTIPLIER_BRIDGING_GUIDE.md');
  } else {
    baseGuideFile = getMicroKbContent('PRODUCT_CAMPAIGN_GUIDE.md');
  }

  const baseHeader = baseGuideFile ? `${baseGuideFile.slice(0, 1000)}\n\n` : '';

  if (clipsCount === 2) {
    const body2Clips = isDirectShowcase
      ? `STRUKTUR KURVA CERITA 2 KLIP (DIRECT SHOWCASE / SHOPEE):
1. KLIP 1 (INSTANT PRODUCT REVEAL / UNBOXING / TRY-ON):
   - Produk target WAJIB langsung terlihat jelas sejak detik ke-1 (unboxing paket, diangkat ke kamera, atau langsung dipakai try-on).
   - Hook singkat langsung mengaitkan visual produk dengan rasa penasaran atau manfaat utamanya.
2. KLIP 2 (PROOF, DETAIL & SOFT CTA):
   - Tunjukkan detail fisik, tekstur, fit pemakaian, atau bukti fungsi utama produk secara dekat.
   - Tutup dengan ajakan ringan cek keranjang / link produk.`
      : `STRUKTUR KURVA CERITA PROPORSIONAL (2 KLIP):
1. KLIP 1 (HOOK / OPENING - 3 Detik Pertama):
   - Wajib memikat perhatian instan penonton dan menghentikan scrolling.
   ${isEditorial
     ? '- Gunakan hook emosional, pertanyaan menggelitik, atau sudut pandang kontraintuitif tanpa menyebut nama produk.'
     : (normalizedBridgeAt <= 1
       ? '- Tampilkan langsung konteks/aksi bersama produk secara memikat sejak detik ke-1.'
       : '- Tampilkan hook situasi/masalah nyata yang langsung mengantar ke solusi di Klip 2 tanpa menyebut nama produk terlebih dahulu.')}
2. KLIP 2 (${isEditorial ? 'RESOLUTION & CALL TO ACTION' : 'BRIDGING PRODUK, PROOF & CTA'}):
   - ${isEditorial ? 'Ringkas pesan utama lalu tutup dengan CTA komunitas (Simpan / Bagikan / Follow).' : 'Kenalkan produk sebagai solusi/jawaban atas Klip 1, perlihatkan bukti singkat atau USP inti, lalu tutup dengan CTA jelas (Cek keranjang di bawah).'} `;

    return `
${baseHeader}=== DYNAMIC STORY CURVE SPECIFICATION (2 KLIP) ===
Target Durasi Klip: Tepat 2 adegan berurutan.
Fokus Kampanye: ${isEditorial ? 'BRAND EDITORIAL (Storytelling / Relatable / Thought Leadership)' : (isDirectShowcase ? 'DIRECT PRODUCT SHOWCASE (Instant Reveal / Unboxing / Try-On)' : (isMultiplier ? 'MULTIPLIER / SEAMLESS BRIDGING (Viral Angle to Product Solution)' : 'PRODUCT CAMPAIGN (Solution-Driven / Demo / UGC Review)'))}
Bahasa Narasi: ${isEn ? 'English (US)' : 'Bahasa Indonesia (Natural & Conversational)'}

${body2Clips}
=== END DYNAMIC SPECIFICATION ===
`.trim();
  }

  return `
${baseHeader}=== DYNAMIC STORY CURVE SPECIFICATION (${clipsCount} KLIP) ===
Target Durasi Klip: Tepat ${clipsCount} adegan berurutan.
Fokus Kampanye: ${isEditorial ? 'BRAND EDITORIAL (Storytelling / Relatable / Thought Leadership)' : (isDirectShowcase ? 'DIRECT PRODUCT SHOWCASE (Instant Reveal + Proof & CTA)' : (isMultiplier ? 'MULTIPLIER / SEAMLESS BRIDGING (Viral Angle to Product Solution)' : 'PRODUCT CAMPAIGN (Solution-Driven / Demo / UGC Review)'))}
Bahasa Narasi: ${isEn ? 'English (US)' : 'Bahasa Indonesia (Natural & Conversational)'}

STRUKTUR KURVA CERITA PROPORSIONAL:
1. KLIP 1 (HOOK / OPENING - 3 Detik Pertama):
   - Wajib memikat perhatian instan penonton dan menghentikan scrolling.
   ${isEditorial 
     ? '- Gunakan hook emosional, pertanyaan menggelitik, atau sudut pandang kontraintuitif tanpa menyebut nama produk.' 
     : (isDirectShowcase
       ? '- Produk target WAJIB langsung terlihat jelas sejak detik ke-1 (unboxing / try-on / showcase), diikuti hook yang menyorot detail paling menarik.'
       : (isMultiplier
         ? '- Ambil hook viral / emosional kuat dari referensi asli untuk memikat audiens sebelum mengenalkan produk.'
         : '- Tampilkan visual masalah nyata, rasa frustrasi sehari-hari, atau situasi sebelum produk digunakan.'))}

2. KLIP 2 SAMPAI ${clipsCount - 1} (PROGRESSION / INTI PESAN & SEAMLESS BRIDGING):
   - Total adegan di tengah: ${clipsCount - 2} klip. Eskalasi alur cerita secara bertahap dan mulus.
   ${isEditorial ? `
   - Berikan konteks mendalam, perspektif baru, dan insight edukatif yang menginspirasi.
   - Ceritakan perjalanan atau fakta menarik yang membuat audiens merasa relate.
   - Dilarang hard-selling atau penawaran komersial agresif.` : ((isMultiplier || hasMultiSegment) ? `
${multiplierBridgeRule}${isMultiplier ? '' : '\n   - Pastikan HANYA klip segmen produk di atas yang menampilkan & membahas produk; klip jeda (GAP) di antaranya wajib kembali ke cerita/konteks organik tanpa menyebut produk.'}` : `
   ${normalizedBridgeAt > 2 ? `- Klip 2 s.d. ${normalizedBridgeAt - 1}: Eskalasi masalah nyata, konteks emosional, dan dinamika pilar organik (DILARANG menyebut produk atau membocorkan bahan produk).\n   - Klip #${normalizedBridgeAt}: Kenalkan produk secara natural sebagai jawaban/kunci atas masalah di klip-klip sebelumnya.` : (normalizedBridgeAt === 1 ? `- Lanjutkan demonstrasi tekstur, fit pemakaian, atau bukti nyata produk secara dekat.` : `- Klip #${normalizedBridgeAt}: Kenalkan produk secara natural sebagai jawaban/kunci atas masalah di Klip 1.`)}
   - Klip selanjutnya s.d. ${clipsCount - 1}: Tunjukkan Unique Selling Proposition (USP), demo cara pakai, tekstur, atau transformasi nyata.
   - Buktikan benefit spesifik yang dirasakan konsumen secara visual dan lugas.`)}

3. KLIP ${clipsCount} (RESOLUTION & CALL TO ACTION):
   - Kesimpulan memuaskan yang mengikat seluruh cerita.
   ${isEditorial
     ? '- CTA Komunitas & Engagement: "Simpan video ini jika relate", "Bagikan ke teman kamu", atau "Follow untuk insight berikutnya".'
     : '- CTA Komersial Jelas: "Cek keranjang di bawah", "Dapatkan promo terbatas di bio", atau "Coba sekarang sebelum kehabisan".'}
=== END DYNAMIC SPECIFICATION ===
`.trim();
}
