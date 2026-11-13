// Prompt baru (uji): planner isi, patch VO pilar, patch multiplier.
export const VAGUE = ['efektif','maksimal','optimal','tepat','sempurna','berkualitas','pilihan','terbaik','alami','kebugaran','nyaman','praktis','secukupnya','sebentar','beberapa'];
export const MARKERS = ['Padahal','Masalahnya','Nah','Di titik inilah','Di sinilah','Hasilnya','Makanya'];
export const CLAIMS = ['lemak visceral','bakar lemak','rontokkan lemak','racun','detoks','detox','ginjal','paru-paru','gula darah','kolesterol','kanker','tumor','metabolisme','imun','obat','menyembuhkan','sembuh','asam urat','hipertensi','jantung'];

export function buildPayloadPlannerPrompt(c) {
  return `Kamu adalah Content Editor senior. Tugasmu BUKAN menulis naskah, tetapi menyusun ISI yang akan disampaikan sebuah video pendek ${c.clips} klip (±${c.wordsPerClip} per klip, total ±${c.totalWords} kata lisan).

## DATA
- Brand: ${c.brandName}
- Konteks brand: ${c.brandContext || '-'}
- Jenis konten: ${c.kind}
- Pilar / keyword: "${c.pillar}"
- Subjek: ${c.subject || '-'}
- Situasi audiens: ${c.context || '-'}
- Angle: ${c.angle || '-'}
- Hook (sudah dikunci): "${c.hook || '-'}"
${c.product ? `- Produk: ${c.product.name}\n- Deskripsi produk: ${c.product.desc || '-'}\n- USP: ${c.product.usp || '-'}\n- Fakta produk: ${c.product.truth || '-'}` : '- Produk: tidak ada (editorial murni)'}

## TUGAS
1. Tentukan search_intent: pertanyaan nyata yang ada di kepala penonton saat melihat topik ini.
2. Tulis search_answer: jawaban langsung 1 kalimat (≤20 kata). Jika keyword berupa harga dan data harga TIDAK ada, jawab dengan faktor penentu harga + cara menghitung kebutuhan.
3. Susun ${Math.min(3, Math.max(2, c.clips - 2))} takeaways (MAKSIMAL 3, lebih sedikit tapi tajam lebih baik daripada banyak tapi dangkal). Setiap takeaway = satu hal yang bisa langsung dipraktikkan/diperiksa penonton hari ini, dengan "anchor" (pegangan konkret) berupa salah satu: angka/takaran, durasi/frekuensi, urutan langkah, lokasi/titik, kriteria memilih, atau kesalahan umum + koreksinya.

## ATURAN TAKEAWAY
- "point" adalah TINDAKAN yang dilakukan PENONTON (kata kerja perintah: pasang, ukur, ambil, simpan, catat, hindari). Fakta tentang cara brand memproduksi produk (mis. difermentasi 3 bulan) BUKAN tindakan penonton; jika dipakai, tulis sebagai alasan di anchor, bukan perintah.
- Untuk keyword, takeaway pertama WAJIB langsung menjawab search_intent.
- Angka kosmetik dilarang: jangan membuat angka yang tidak lazim/tidak bisa dicek (mis. "radius 100 meter", "30 menit evaluasi") hanya agar terlihat konkret. Lebih baik anchor berupa contoh nyata atau kriteria.

## ATURAN KEJUJURAN (WAJIB)
- Angka spesifik brand/produk (harga, ukuran roll, densitas, takaran produk) HANYA boleh jika ada di DATA. Jika tidak ada, tulis anchor non-angka (urutan/kriteria/titik) atau tandai "[butuh data: ...]" di needs_data. JANGAN mengarang.
- Pengetahuan umum yang lazim dan aman (mis. tes alergi di belakang telinga, celah bawah pintu meloloskan suara) boleh, beri source "pengetahuan_umum".
- Konten kesehatan/herbal: DILARANG klaim menyembuhkan/mencegah/menurunkan kondisi medis (lemak, gula darah, kolesterol, jantung, ginjal, detoks, imun, dsb). Untuk produk herbal, isi berupa CARA PAKAI (kapan, dicampur apa, penyimpanan, rasa) dan kebiasaan pendukung umum, bukan manfaat medis.
- Hindari kata samar (${VAGUE.join(', ')}) di anchor.

Return ONLY JSON:
{"search_intent":"...","search_answer":"...","takeaways":[{"point":"...","anchor":"...","anchor_type":"angka|durasi|urutan|titik|kriteria|kesalahan","source":"data_produk|data_brand|pengetahuan_umum"}],"needs_data":["..."]}`;
}

function mustReplace(src, find, repl, label, report) {
  if (src.includes(find)) { report.push(`ok:${label}`); return src.split(find).join(repl); }
  report.push(`MISS:${label}`); return src;
}

export function patchPillarPrompt(oldPrompt, payload, c) {
  const report = [];
  let p = oldPrompt;
  // 1. Hapus mandat penanda wacana per klip
  const start = p.indexOf('- CONNECTIVE FLOW & MASTER MONOLOGUE MANDATE');
  const end = start >= 0 ? p.indexOf('\n1. ', start) : -1;
  if (start >= 0 && end > start) {
    p = p.slice(0, start) + `- ALUR: Naskah tetap terdengar sebagai satu monolog yang mengalir, tetapi kesinambungan dibangun dari ISI (poin 1 → poin 2 → …), bukan dari kata sambung wajib. Lihat KONTRAK ISI VO.` + p.slice(end);
    report.push('ok:connective');
  } else report.push('MISS:connective');
  p = mustReplace(p, `Melukiskan suasana, proses, atau dinamika topik secara visual dan kronologis.`, `Menyampaikan takeaways dari KONTRAK ISI VO, satu poin per klip, lengkap dengan pegangannya.`, 'storytelling-mid', report);
  p = mustReplace(p, `Penutup/kesimpulan yang hangat dan reflektif dari topik tersebut beserta CTA yang relevan.`, `Ringkas poin terpenting dalam 1 kalimat, lalu CTA.`, 'storytelling-end', report);
  p = p.replace(/WAJIB tersambung secara kohesif dengan Klip 1, diawali partikel wacana \(misal: 'Padahal\.\.\.', 'Masalahnya\.\.\.', 'In reality,\.\.\.'\) yang melanjutkan cerita tanpa patah nalar\./, () => { report.push('ok:scene2-hint'); return `WAJIB memuat search_answer / takeaway pertama dari KONTRAK ISI VO.`; });
  const tk = payload.takeaways.map((t, i) => `  ${i + 1}. ${t.point} — pegangan: ${t.anchor}`).join('\n');
  const contract = `
## 🎯 KONTRAK ISI VO (PRIORITAS TERTINGGI — jika bertentangan dengan aturan alur/narrative mode di bawah, KONTRAK INI YANG BERLAKU)
Pertanyaan penonton: "${payload.search_intent}"
Jawaban langsung: "${payload.search_answer}"
Takeaways (urut):
${tk}

Aturan naskah voiceover:
1. Klip 1 = hook (jika hook dikunci, pakai persis) + boleh 1 kalimat pendek masalah. Klip 2 = jawaban langsung (search_answer) / takeaway 1. Klip berikutnya = takeaway berikutnya. Klip ${c.clips} = ringkas 1 poin terpenting + CTA.\n   PEGANGAN (anchor) WAJIB diucapkan dengan isi yang sama — angka, nama titik, kriteria, atau contoh tidak boleh diringkas menjadi kata umum (\"hitung luas atap, tambah 5–10% untuk sambungan\" TIDAK boleh menjadi \"hitung luas secara akurat\").
2. Jika klip isi lebih banyak dari takeaways, satu takeaway boleh dibagi ke 2 klip: klip pertama = apa yang dilakukan, klip berikutnya = contoh nyata / cara mengecek hasilnya / kesalahan yang sering terjadi. DILARANG mengisi klip dengan suasana atau motivasi umum.\n   Bahasa lisan alami seperti orang menjelaskan ke teman, bukan daftar poin yang dibacakan; sambungkan klip lewat isi (\"setelah itu…\", \"cara ceknya…\").
3. Kata transisi (${MARKERS.join(', ')}) maksimal 1 kali di seluruh naskah. Dilarang dua klip berurutan diawali kata yang sama.
4. Kata samar (${VAGUE.join(', ')}) hanya boleh jika kalimat yang sama memuat pegangan konkret. Dilarang kalimat suasana tanpa informasi (mis. "Hidup tenang tercipta saat…", "kualitas tidur kembali maksimal").
5. DILARANG menambah angka di luar takeaways. Jika takeaway bertanda butuh data, sampaikan tanpa angka.
6. Konten kesehatan/produk herbal: tanpa klaim medis; bicarakan cara pakai & kebiasaan.
7. Tetap patuhi batas kata per klip.
`;
  const anchor = '## FONDASI KREATIF (CORE STRATEGY):';
  if (p.includes(anchor)) { p = p.replace(anchor, contract + '\n' + anchor); report.push('ok:contract'); } else { p = contract + p; report.push('MISS:contract-anchor'); }
  return { prompt: p, report };
}

export function patchMultiplierPrompt(oldPrompt) {
  const report = [];
  let p = oldPrompt;
  p = mustReplace(p, `Fokus pada keindahan proses, estetika visual, dan ketenangan pikiran.`, `Fokus pada langkah yang bisa ditiru: bahan, takaran, durasi, dan tanda selesai.`, 'mul-storytelling', report);
  const contract = `
## 🎯 KONTRAK RESEP SUMBER (PRIORITAS TERTINGGI)
Sebelum menulis naskah, ekstrak dari ORIGINAL STORYBOARD semua bahan inti, takaran, dan langkah berdurasi (rendam, rebus, diamkan, dinginkan, panggang, dsb). Tambahkan field JSON tingkat atas "source_recipe_lock": {"ingredients":[{"name":"...","amount":"..."}],"timed_steps":["..."]}.
Aturan naskah suara ("narration_transcript"):
1. WAJIB menyebut SEMUA bahan inti dengan nama aslinya. DILARANG mengganti dengan "bahan pilihan", "bahan alami", "rempah ini".
2. Setiap takaran/durasi di sumber WAJIB muncul, di naskah suara ATAU di field "on_screen_amounts" (array string pendek, akan ditampilkan sebagai teks layar). Durasi kunci (mis. rendam semalaman, rebus sampai menyusut setengah) WAJIB diucapkan.
3. Dilarang "secukupnya", "sebentar", "beberapa jam" jika sumber punya angka; jika sumber tidak punya angka, sebut tanda selesai yang terlihat (mis. "sampai seperti krim").
4. DILARANG klaim medis di naskah suara, apa pun yang ada di sumber: ${CLAIMS.join(', ')}. Ganti dengan manfaat pengalaman yang netral (hangat di perut, segar, rasa) atau hilangkan.
5. DILARANG menyebut merek/produk apa pun di naskah suara kecuali bridging produk aktif.
6. Batas kata per klip & outro wajib tetap berlaku; hemat kata dengan membuang kalimat suasana, bukan membuang bahan/takaran.
`;
  const anchors = ['### FORMAT OUTPUT', '## OUTPUT', 'Return ONLY'];
  const a = anchors.find(x => p.includes(x));
  if (a) { const i = p.indexOf(a); p = p.slice(0, i) + contract + '\n' + p.slice(i); report.push('ok:mul-contract@' + a); } else { p += contract; report.push('MISS:mul-anchor'); }
  return { prompt: p, report };
}
