# Instruksi Agent Antigravity: Hitung Panggilan Gemini API Nyata per Video (dari Log Staging)

> Tanggal: 2026-11-14 · Sifat: **AUDIT READ-ONLY**. Kode, data, setting, dan PM2 tidak boleh diubah. Tanpa rilis atau deploy. Production tidak disentuh.
> Tujuan: mengetahui jumlah panggilan Gemini API **nyata** untuk 1 video, sebagai dasar perhitungan kuota harian dan biaya.

## Latar belakang (perkiraan reviewer dari kode)
Perkiraan untuk 1 video 6 klip, yang perlu dibuktikan dengan data nyata:

| Tahap | Perkiraan | Lokasi di kode |
|---|---|---|
| Storyboard single-pass | 1 | `processPillarGenerator` / `buildOrganicPillarPrompt` |
| Audit VO TikTok (bila `enable_vo_audit = 1`) | 1 | `lib/tiktok-compliance-service.js` → `callGeminiJson` |
| Start-frame Visual QC | 6 (+ retry di mode `enforce`, maks 2 per klip) | `lib/start-frame-visual-qc.js` → `evaluateAndRecordStartFrameQc` |
| TTS Gemini batch | 1 (fallback per klip = 6 bila split gagal) | `lib/gemini-tts-batch.js` |
| **Total perkiraan** | **±9** (maks ±27 di mode `enforce`) | |

Start frame dan Veo lewat G-Labs, jadi **bukan** kuota Gemini API. Tetap hitung sebagai pembanding waktu dan antrean.

## Sampel yang diaudit
- Batch F2.1: `opc_261114_f21b7` (item `#2133`–`#2139`) dan `opc_261114_f21ab` (item `#2140`).
- Bila sudah ada, tambahkan 1 campaign hasil F2.2 dan/atau Scene Director di staging.

## Langkah
1. **Petakan semua titik panggilan Gemini** di jalur Pillar/OPC. Cari semua pemakaian `getGeminiModel`, `executeWithKeyPool`, `generateContent`, dan URL `generativelanguage.googleapis.com` di `lib/`. Hitung juga panggilan "tersembunyi" dan cantumkan semuanya dalam satu tabel, termasuk:
   - retry parse JSON storyboard;
   - fallback antar key/model;
   - perbaikan otomatis (auto-repair);
   - deteksi metafora;
   - caption/social package terpisah;
   - Vision QC yang dipanggil ulang.
2. **Kumpulkan bukti nyata** secara read-only, dari sumber yang tersedia:
   - **Log PM2 staging** (`~/maknaflow-staging-atomic/shared/logs` atau `pm2 logs` tanpa restart): baris per item untuk storyboard, `[OPC Analyzer QC]`, `QC Retry`, `[Gemini-Batch-TTS]`, fallback individual TTS, dan audit VO;
   - **DB staging** (schema `staging`, SELECT saja): `result_json.start_frame_qc` (jumlah attempt per klip), tabel pemakaian/telemetri API kalau ada (mis. log key pool, usage, token), serta riwayat retry item;
   - **Opsional, bila tersedia:** dasbor kuota Google AI Studio untuk rentang waktu uji. Jangan menyalin API key ke laporan.
3. **Hitung per item**, satu baris per video, dengan kolom:
   - storyboard;
   - audit VO;
   - QC;
   - QC retry;
   - TTS (batch atau fallback);
   - lainnya;
   - **total Gemini**;
   - jumlah panggilan error/429/timeout;
   - jumlah generate gambar G-Labs (termasuk ulang);
   - jumlah klip Veo (termasuk ulang/blokir).
4. **Ringkas:**
   - rata-rata, minimum, dan maksimum panggilan Gemini per video;
   - estimasi untuk mode `enforce`, berdasarkan tingkat penolakan QC yang tercatat di `report_only` (berapa klip yang *akan* di-retry);
   - perkiraan untuk 10, 30, dan 100 video per hari, dibandingkan dengan batas kuota key pool yang terpasang (sebut jumlah key dan batas per menit/hari bila diketahui, **tanpa** menulis isi key);
   - bila datanya ada: estimasi token/biaya per video, dipisah per tahap.
5. **Catat celah pencatatan.** Bila suatu panggilan tidak tercatat di log/DB sehingga tidak bisa dihitung pasti, tandai "tidak tercatat". Lalu usulkan (jangan kerjakan) pencatatan sederhana, misalnya 1 baris log seragam `[GEMINI_CALL] item=… stage=… model=… status=…`, agar ke depan bisa dihitung otomatis.

## Output
- File laporan: `plans/visual-metaphor-world/audit-panggilan-gemini-per-video.md`, berisi:
  - tabel titik panggilan di kode;
  - tabel per item (bukti nyata);
  - ringkasan dan proyeksi harian;
  - celah pencatatan dan usulannya.
- Bagian awal laporan berisi **ringkasan 5 kalimat dalam bahasa sederhana untuk marketer**: berapa panggilan per video, apa yang paling banyak memakan kuota, dan berapa video per hari yang aman dengan key yang ada.

## Batasan
- Read-only: hanya `SELECT`, membaca log, dan `grep`. Tidak boleh restart PM2, mengubah setting, atau men-generate ulang item.
- Jangan polling SSH berulang. Ambil log sekali per sesi.
- Jangan menulis API key, password DB, atau token ke laporan maupun file lain.
