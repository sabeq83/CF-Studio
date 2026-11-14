# Instruksi Agent Antigravity — F2.2 Hotfix (setelah uji staging F2.1)

> Tanggal: 2026-11-14 · Basis: `v2.46.1` (`7cb97ff`) · Sumber: `stage-f21-staging-report.md` + review reviewer
> Aturan umum tetap: tulis plan singkat (Sebelum/Sesudah) dulu, tes lokal, **berhenti sebelum rilis/deploy** kecuali untuk H1 (lihat catatan), lapor dengan bahasa sederhana.

## H1 — URGENT: Halaman detail campaign crash ("This page couldn't load")
- **Gejala:** `http://100.95.245.55:5010/pillar-campaigns/opc_261114_f21b7` tidak bisa dibuka. Log server bersih, jadi crash terjadi di browser.
- **Akar masalah (sudah diverifikasi reviewer):** `app/pillar-campaigns/[id]/page.js` sekitar baris `2513–2552` (blok Visual QC dari F2.1) memakai variabel **`parsedResult`** yang **tidak pernah dideklarasikan** di file itu (`grep parsedResult` hanya menemukan pemakaian, tidak ada deklarasi). Optional chaining (`parsedResult?.`) tidak melindungi variabel yang tidak ada → `ReferenceError` saat render → halaman crash. **Kemungkinan besar semua halaman detail pillar campaign ikut kena sejak v2.46.1**, bukan hanya campaign uji.
- **Perbaikan:** deklarasikan hasil parse `item.result_json` yang aman (try/catch, fallback `{}`) di scope item tersebut, konsisten dengan pola `parsedRes` yang sudah ada di file (±`:2433`).
- **Pencegahan:** tambahkan tes/lint `no-undef` untuk file halaman ini, atau tes render ringan, agar variabel tak terdeklarasi tertangkap sebelum rilis.
- **Verifikasi:** buka halaman `opc_261114_f21b7`, `opc_261114_g0zltt`, dan 1 campaign lama non-metafor (mis. `opc_261108_8618kc`) setelah login operator.
- **Catatan rilis:** H1 boleh dirilis sebagai **patch** + deploy staging begitu tes lulus (perbaikan bug regresi, tanpa perubahan perilaku generate). Laporkan setelahnya.

## H2 — Rubrik Visual QC Klip 3 & 6 (wajib sebelum mode `enforce`)
- Klip bridge & hero **memang wajib** menampilkan produk dan kondisi bersih, tapi QC menandainya `pre_bridge_product`/`foreign_objects` (false positive di 6 dari 7 video).
- Saat `expectsProduct = true`: abaikan cek produk pre-bridge; dunia metafora yang dicek adalah versi **bersih** (`beats.result`); produk + bahan produk (madu, bawang) bukan benda asing.
- Tes: fixture frame klip 3/6 dengan produk → lulus; klip 1/2 dengan produk → gagal.

## H3 — Framing terlalu dekat ke wajah
- Di beberapa video (#2133, #2135, #2138, #2139), sudut `eye_level_side` / `three_quarter_front` menampilkan badan sampai ke dagu. QC sudah menangkap 1 tepi profil wajah (#2133 klip 2).
- Perbaikan: untuk sudut tersebut, framing dikunci **dada ke bawah dengan fokus tangan** (tepi atas frame di bawah bahu). Sudut makro & top-down tidak berubah.

## H4 — Warna/motif baju berubah di tengah video
- #2136 (navy): klip 4–5 muncul lengan **bermotif/beda warna**. Ini melanggar konsistensi dalam 1 video.
- Perbaikan: kalimat wardrobe dipertegas ("solid plain <warna>, no pattern, no print") di semua klip, dan Visual QC menambah cek **kecocokan warna lengan** dengan `resolved_wardrobe_color` (bagian §4b di `plans/planner-scene-director/VI_SEBAGAI_IDENTITAS_BRAND.md`).

## H5 — Item macet & terblokir
- **#2140:** step `pillar_ffmpeg` gagal berulang setiap ±30 detik ("Batch TTS Studio 'null'"). Item terjebak dalam loop. Hentikan retry tanpa batas (tandai failed setelah N kali + pesan jelas di UI), lalu perbaiki penautan batch TTS setelah regenerate TTS.
- **#2136:** G-Labs/Veo menolak klip berulang dengan `PUBLIC_ERROR_USER_MINOR` / `REPUTATIONAL`. Identifikasi klip & prompt yang memicu, lalu laporkan pola kata/visual pemicunya (jangan mengakali filter keamanan; ubah deskripsi agar wajar). Catat juga apakah filter kata "lemak" di pre-TTS terlalu agresif untuk konteks masak.

## H6 — `compact_prompts`
- Uji A/B menunjukkan panjang prompt akhir hampir sama (rata-rata 1.243 vs 1.255 karakter) karena pembungkus tetap ±750–900 karakter. Flag ini belum memberi manfaat.
- **Jangan dikembangkan dulu.** Biarkan default off. Catat sebagai temuan untuk Scene Director (pembungkus prompt perlu dirampingkan di sana).

## Urutan
H1 (segera, boleh rilis patch) → H2 + H3 + H4 → H5 → laporan → (izin) uji ulang 7 video dengan QC `enforce`.
Setelah F2.2 beres, lanjut ke `plans/planner-scene-director/RENCANA_DAN_INSTRUKSI_ANTIGRAVITY.md`.
