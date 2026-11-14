# Audit Read-Only: Panggilan Gemini API Nyata per Video (Log & DB Staging)

- **Tanggal Audit:** 2026-11-14
- **Lingkungan Diaudit:** Mac Mini Staging (`staging` PostgreSQL schema & PM2 logs `staging-ui.out.log` / `staging-ui.err.log` / `staging-api.*.log`)
- **Sifat Audit:** Read-only (`SELECT`, `grep`, pembacaan file kode & log). Tanpa perubahan kode/DB/setting, tanpa restart PM2, dan Production tidak tersentuh.

---

## Ringkasan untuk Marketer (5 Kalimat)

1. Saat ini satu video 6 klip di jalur Pillar/OPC secara nyata memanggil **7 panggilan Gemini API** (1× untuk menyusun storyboard & naskah, lalu 6× untuk mengecek kualitas gambar start frame oleh AI Vision QC), sedangkan VO menggunakan MiniMax dan gambar/video memakai G-Labs (bukan kuota Gemini).
2. Tahap yang paling banyak memakan kuota Gemini adalah **Vision QC Start Frame (6 dari 7 panggilan, atau sekitar 86% kuota)**, jauh lebih besar daripada pembuatan naskah/storyboard yang hanya 1 panggilan.
3. Bila fitur Vision QC nanti diubah dari sekadar lapor (`report_only`) ke mode perbaikan otomatis (`enforce`), pemakaian diperkirakan naik menjadi sekitar **8–10 panggilan per video** secara rata-rata (maksimal ±19–27 panggilan pada kasus terburuk atau bila TTS ikut dipindah ke Gemini).
4. Di Staging saat ini, akun `default_tenant` memiliki **17 API key gratis** dengan batas **20 panggilan per hari per key** (total kapasitas **340 panggilan per hari**), sehingga batas aman produksi adalah sekitar **30–35 video per hari** (10 video/hari sangat aman; 30 video/hari memakai ±62% kapasitas; **100 video/hari akan kehabisan kuota** dan butuh upgrade ke Paid Tier atau menambah key pool menjadi minimal 35–40 key).
5. Karena audit ini juga menemukan bahwa beberapa tahap (seperti Vision QC, VO Audit, TTS Gemini, dan retry error 503) belum mencatat jumlah token atau item ID secara lengkap ke ledger database, perlu ditambahkan satu baris log seragam agar ke depan biaya harian per video bisa dipantau otomatis 100%.

---

## 1. Peta Titik Panggilan Gemini API di Kode (Jalur Pillar / OPC)

Penelusuran pada `lib/scheduler-processors.js`, `lib/gemini.js`, `lib/tiktok-compliance-service.js`, `lib/start-frame-visual-qc.js`, `lib/gemini-tts-batch.js`, `lib/gemini-8s-tts.js`, `lib/vo-quality-validator.js`, `lib/json-parser.js`, `lib/metaphor-kit-resolver.js`, dan `lib/start-frame-worker.js`:

| Tahap / Fungsi | Lokasi di Kode | API / Wrapper Gemini | Kuota per Video (6 klip) | Kondisi Aktif & Catatan Nyata di Staging |
|---|---|---|---|---|
| **1. Content Editor Fallback (V1)** | [scheduler-processors.js#L5662-L5669](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js#L5662-L5669) | `generateContentFlexible` → `executeWithKeyPool` | `0` atau `1` | Aktif hanya jika `vo_content_contract === 'on'` dan `rowPayload.content_payload` kosong. **0** pada seluruh sampel (`vo_content_contract = 'off'`). |
| **2. Storyboard Single-Pass (Utama)** | [scheduler-processors.js#L5684-L5694](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js#L5684-L5694) | `generateContentFlexible` → `executeWithKeyPool` | **`1`** *(sukses)* | **Selalu dipanggil** (menghasilkan storyboard, VO, DNA, prompt T2I/I2V, dan `social_media_package` sekaligus dalam 1 call). Mencatat token ke `ai_token_usage_ledger`. |
| **3. Audit VO TikTok (`enable_vo_audit`)** | [scheduler-processors.js#L5972-L5979](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js#L5972-L5979) → [tiktok-compliance-service.js#L544-L621](file:///Users/sabeqmmursyid/_cfstudio/lib/tiktok-compliance-service.js#L544-L621) | `callGeminiJson` → `getGeminiModel` (`makeModelResilient`) | `0` atau `1` | **(a)** Memiliki **Zero-Token Lexicon Pre-Filter Bypass**: jika `scanLexicon()` bersih, langsung `pass` dengan **0** call Gemini. **(b) Temuan bug:** di PostgreSQL kolom `enable_vo_audit` bertipe `bigint` sehingga dikembalikan sebagai string `'1'`, membuat `campaign.enable_vo_audit === 1` (`===`) bernilai `false`. Nyata terpakai di seluruh sampel Staging = **0**. |
| **4. VO Quality Gate Rewrite (V4)** | [scheduler-processors.js#L6042-L6081](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js#L6042-L6081) | `generateContentFlexible` → `executeWithKeyPool` | `0` atau `1` | Aktif hanya jika `vo_quality_gate !== 'off'` dan validasi kualitas gagal. **0** di semua sampel (`off`). |
| **5. Start-Frame Visual QC** | [scheduler-processors.js#L6412-L6421](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js#L6412-L6421) → [start-frame-visual-qc.js#L297](file:///Users/sabeqmmursyid/_cfstudio/lib/start-frame-visual-qc.js#L297) → [gemini.js#L1036](file:///Users/sabeqmmursyid/_cfstudio/lib/gemini.js#L1036) | `generateWithImage` → `executeWithKeyPool` + `makeModelResilient` | **`6`** (`report_only`) atau **`6`–`18`** (`enforce`) | Mengirim gambar + `START_FRAME_QC_RESPONSE_SCHEMA`. Jika mode `enforce`, klip yang gagal memicu G-Labs T2I ulang + Vision QC ulang maks `START_FRAME_QC_MAX_RETRIES = 2` per klip (maks `6 + 12 = 18` call). Juga dipanggil ulang jika user menekan regenerasi manual via [start-frame-worker.js#L168](file:///Users/sabeqmmursyid/_cfstudio/lib/start-frame-worker.js#L168). |
| **6. TTS Gemini Batch / 8s Individual / Multi-Voice** | [scheduler-processors.js#L6946-L7077](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js#L6946-L7077), [gemini-tts-batch.js#L63-L64](file:///Users/sabeqmmursyid/_cfstudio/lib/gemini-tts-batch.js#L63-L64), [gemini-8s-tts.js#L42-L43](file:///Users/sabeqmmursyid/_cfstudio/lib/gemini-8s-tts.js#L42-L43), [gemini.js#L663-L676](file:///Users/sabeqmmursyid/_cfstudio/lib/gemini.js#L663-L676) | Direct REST `generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent` via `executeWithKeyPool` | `0` (`minimax`) / `1` (batch) / `6` (fallback per klip) | Di seluruh sampel Staging, `voice_provider = 'minimax'` atau `enable_tts = 0` → **0** call Gemini. Jika `voice_provider = 'gemini'`, mencoba 1× batch TTS lalu fallback ke 6× request individual bila silence split gagal. *(Jika `voice_provider = 'minimax'` gagal per klip/segmen, juga bisa fallback ke Gemini TTS).* |

### Panggilan Tersembunyi / Internal (Retry, Cascade, Helper)

| Kategori yang Diperiksa | Status di Jalur Pillar / OPC |
|---|---|
| **Retry parse JSON storyboard** | **Tidak ada retry LLM otomatis.** `parseGeminiJSON()` di [json-parser.js](file:///Users/sabeqmmursyid/_cfstudio/lib/json-parser.js) hanya memperbaiki string JSON lokal lalu melempar error bila tetap rusak (yang baru mengulang step `pillar_generator` jika scheduler retry). |
| **Fallback / retry antar model & API key** | **YA — Terjadi nyata di Staging.** [makeModelResilient](file:///Users/sabeqmmursyid/_cfstudio/lib/gemini.js#L279-L368) melakukan hingga **4 percobaan per model** (`1` awal + `3` backoff) dan cascade model (`4` siklus waterfall), dibungkus [executeWithKeyPool](file:///Users/sabeqmmursyid/_cfstudio/lib/gemini.js#L492-L620) (`maxAttempts = 5` rotasi key + `4` fallback attempts bila pool habis). Satu panggilan logis dapat menghasilkan **2–3+ HTTP request nyata** saat terjadi `503 High Demand` / `404`. |
| **Perbaikan otomatis (auto-repair)** | `sanitizeVoiceoverItems()` dan `sanitizeAiDirectiveLeak()` bersifat deterministik (**0** call Gemini; `containsAiDirectiveLeak` langsung melempar error). Perbaikan VO via LLM hanya lewat Audit VO (bila kena filter lexicon) atau VO Quality Gate (bila aktif & gagal). |
| **Deteksi metafora (`resolveMetaphorKit` / `resolveHealthMetaphor`)** | **0 panggilan Gemini** (aturan deterministik kata kunci + rotasi histori DB `metaphor_kit_usage`). |
| **Caption / `social_media_package` terpisah** | **0 panggilan terpisah** (sudah digabung dalam Single-Pass Storyboard Engine). |
| **Generate gambar & video (G-Labs)** | Lewat webhook worker G-Labs (`generateImage` & `generateVideo`), **tidak memakai kuota Gemini API**. |

---

## 2. Bukti Nyata per Item di Staging

### Sampel Utama yang Diaudit
1. **Batch F2.1 (`opc_261114_f21b7`, `#2133`–`#2139`, 7 video penuh):** `enable_vo_audit = 0`, `voice_provider = 'minimax'`, `start_frame_visual_qc = 'report_only'`, `enable_tts = 1`, `enable_glabs = 1`, `enable_ffmpeg = 1`.
2. **Batch F2.1 A/B `compact_prompts = ON` (`opc_261114_f21ab`, `#2140`, 1 video):** `enable_vo_audit = 0`, `voice_provider = 'minimax'`, `start_frame_visual_qc = 'report_only'`. Sempat tertahan pre-TTS filter kata `"lemak"` lalu dilanjutkan hingga Veo selesai.
3. **Batch Scene Director (`opc_261114_0j4bt2`, `#2143`–`#2148`, 6 video Start Frame only):** `enable_vo_audit = 1` *(tidak terpicu karena bug `bigint === 1`)*, `start_frame_visual_qc = 'report_only'`, `enable_tts = 0`, `enable_glabs = 0`, `enable_ffmpeg = 0`.
4. **Pembanding Historis Batch F1+F2 (`opc_261114_g0zltt`, `#2126`–`#2132`, 7 video):** era sebelum Vision QC (`qc = 0`), MiniMax TTS, total **8** entri `ai_token_usage_ledger` (ada 1 eksekusi ulang generator), **555** baris `opc_start_frame_request_audits` (`510` status `prepared` + `45` status `submitted`), dan **46** task Veo (`45` completed + `1` failed pada `#2129`). *(Hotfix F2.2 diverifikasi lewat unit test lokal dan tidak membuat batch baru tersendiri di Staging).*

### Tabel Per Item (14 Video dengan Vision QC Aktif: F2.1 + A/B + Scene Director)

| Batch | Item | Storyboard (sukses) | Audit VO | Vision QC | QC Retry | TTS Gemini | Lainnya | **Total Gemini (Sukses / HTTP Nyata)** | Error / 429 / 503 / Timeout | G-Labs Gambar (SF Audit) | G-Labs Veo (Total / Gagal) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|
| F2.1 | **#2133** | 1 | 0 | 6 | 0 | 0 *(MiniMax)* | 0 | **7 / 7** | 0 *(0 error)* | 6 | 6 / 0 |
| F2.1 | **#2134** | 1 | 0 | 6 | 0 | 0 *(MiniMax)* | 0 | **7 / 9** | `2× 503` saat QC + cascade ke `gemini-3.6-flash` (`11:04:24–11:04:28`) | 6 | 6 / 0 |
| F2.1 | **#2135** | 1 | 0 | 6 | 0 | 0 *(MiniMax)* | 0 | **7 / 7** | 0 *(0 error)* | 6 | 6 / 0 |
| F2.1 | **#2136** | 1 | 0 | 6 | 0 | 0 *(MiniMax)* | 0 | **7 / 7** | 0 *(gagal Veo G-Labs, bukan Gemini)* | 6 | 24 / 13 |
| F2.1 | **#2137** | 1 | 0 | 6 | 0 | 0 *(MiniMax)* | 0 | **7 / 7** | 0 *(0 error)* | 6 | 6 / 0 |
| F2.1 | **#2138** | 1 | 0 | 6 | 0 | 0 *(MiniMax)* | 0 | **7 / 7** | 0 *(0 error)* | 6 | 6 / 0 |
| F2.1 | **#2139** | 1 | 0 | 6 | 0 | 0 *(MiniMax)* | 0 | **7 / 8** | `1× 503` saat QC (`11:29:36`, retry sukses 2s kemudian) | 6 | 6 / 0 |
| F2.1 A/B | **#2140** | 1 | 0 | 6 | 0 | 0 *(terblokir filter `"lemak"`, MiniMax)* | 0 | **7 / 7** | 0 *(3× scheduler retry terjadi di `ffmpeg`/pre-TTS tanpa call Gemini)* | 6 | 6 / 0 |
| SceneDir | **#2143** | 1 | 0 | 6 | 0 | 0 *(`enable_tts=0`)* | 0 | **7 / 7** | 0 *(0 error)* | 6 | 0 / 0 |
| SceneDir | **#2144** | 1 | 0 | 6 | 0 | 0 *(`enable_tts=0`)* | 0 | **7 / 7** | 0 *(0 error)* | 6 | 0 / 0 |
| SceneDir | **#2145** | 1 | 0 | 6 | 0 | 0 *(`enable_tts=0`)* | 0 | **7 / 9** | `2× 503` saat Storyboard + cascade ke `gemini-3.6-flash` (`13:38:00–13:38:06`) | 6 | 0 / 0 |
| SceneDir | **#2146** | 1 | 0 | 6 | 0 | 0 *(`enable_tts=0`)* | 0 | **7 / 8** | `1× 503` saat QC (`13:49:00`, retry sukses 2s kemudian) | 6 | 0 / 0 |
| SceneDir | **#2147** | 1 | 0 | 6 | 0 | 0 *(`enable_tts=0`)* | 0 | **7 / 7** | 0 *(0 error)* | 6 | 0 / 0 |
| SceneDir | **#2148** | 1 | 0 | 6 | 0 | 0 *(`enable_tts=0`)* | 0 | **7 / 7** | 0 *(0 error)* | 6 | 0 / 0 |

### Rekonsiliasi Bukti `api_key_usages` di DB (`2026-11-14`)
Pada `staging.api_key_usages` tanggal `2026-11-14` untuk `default_tenant` (`17` key aktif: `key_id` `24..39, 41`), total `used_count` tercatat **106 panggilan** (`4 key × 7 + 13 key × 6`). Angka tersebut cocok **100%** dengan total panggilan logis sukses `default_tenant` pada hari yang sama:
`8` storyboard (`g0zltt`) + `8` storyboard (`f21b7` + `f21ab`) + `48` Vision QC (`f21b7` + `f21ab`) + `6` storyboard (`0j4bt2`) + `36` Vision QC (`0j4bt2`) = **`106`**.

---

## 3. Ringkasan, Estimasi Mode `enforce`, Kuota Harian & Token/Biaya

### A. Statistik Panggilan per Video (14 Sampel Aktif QC)
- **Panggilan Logis Sukses:** Minimum **`7`**, Rata-rata **`7,00`**, Maksimum **`7`** (dengan `Vision QC = report_only`, `MiniMax TTS`, `Audit VO = 0`).
- **HTTP Request Nyata ke Gemini (termasuk retry internal `503`):** Minimum **`7`**, Rata-rata **`7,43`**, Maksimum **`9`** (`6` kali retry internal `503 High Demand` pada 14 video; `0` error `429` maupun timeout).
- *(Perbandingan pra-QC `g0zltt`: rata-rata **`1,14`** panggilan Gemini/video, `8` call untuk `7` video).*

### B. Estimasi Jika Mode `start_frame_visual_qc = 'enforce'` Diaktifkan
Berdasarkan data penolakan Vision QC yang tercatat saat `report_only`:
- **Batch Scene Director (`#2143`–`#2148`, sesudah perbaikan `buildStartFrameQcPrompt`):** `8` dari `36` klip gagal (**`22,2%`**, rata-rata **`1,33` klip/video**).
- **Batch F2.1 (`#2133`–`#2140`, sebelum hotfix F2.2):** `25` dari `48` klip gagal (**`52,1%`**, rata-rata **`3,13` klip/video**, banyak false-positive di Clip 3/6 yang kini sudah ditambal di F2.2).
- **Gabungan seluruh 14 video (`84` klip):** `33` klip gagal (**`39,3%`**, rata-rata **`2,36` klip/video**).

Proyeksi panggilan Gemini **per video (6 klip)** bila `enforce` menyala (setiap klip gagal = `+1` Vision QC per percobaan retry, maks 2×):
- **Skenario realistis Scene Director / pasca-F2.2 (~1,33 klip gagal, 1× retry lulus):** `7 + 1,33` ≈ **`8–9` panggilan Gemini/video** (`+1,3` gambar G-Labs).
- **Skenario rata-rata historis gabungan (~2,36 klip gagal, 1× retry lulus):** `7 + 2,36` ≈ **`9–10` panggilan Gemini/video**.
- **Skenario berat (2× retry di semua klip gagal pada rate `3,13`/video):** `7 + 6,25` ≈ **`13–14` panggilan Gemini/video**.
- **Worst-case teoritis absolut (6/6 klip gagal 2× penuh):** `1 + 6 + 12 = 19` panggilan (atau **`20–27`** bila Audit VO `1` + Gemini Batch TTS `1` / Fallback `6` + VO Quality Rewrite `1` ikut aktif).

### C. Proyeksi Harian vs Kapasitas Key Pool `default_tenant`
Kapasitas terpasang pada `staging.gemini_api_keys` untuk `default_tenant`:
- **Jumlah Key Aktif:** **`17` key** (`AISKey_03` s.d. `AISKey_18` + `AISKey_20`), seluruhnya `tier = 'FREE'`, `daily_limit = 20` RPD per key.
- **Total Kapasitas Nominal Harian Pool:** `17 × 20` = **`340` panggilan/hari**. *(Di luar 1 fallback key pada `tenant_settings.gemini_api_key`).*

| Skenario Beban per Hari | Kondisi Aktual (`7` call/video) | Kondisi Aktual + Overhead 503 (`~7,5` HTTP/video) | Proyeksi `enforce` + MiniMax (`~9` call/video) | Proyeksi `enforce` + Gemini TTS Batch (`~10` call/video) | Proyeksi `enforce` + Gemini TTS Fallback (`~15` call/video) | Kecukupan vs Pool `340` RPD |
|---|---:|---:|---:|---:|---:|---|
| **10 video / hari** | **70** (`20,6%`) | **75** (`22,1%`) | **90** (`26,5%`) | **100** (`29,4%`) | **150** (`44,1%`) | **Aman** di semua skenario |
| **30 video / hari** | **210** (`61,8%`) | **225** (`66,2%`) | **270** (`79,4%`) | **300** (`88,2%`) | **450** (`132,4%`) | **Aman ketat** untuk `MiniMax` / Batch TTS (`79%–88%`), **jebol** jika TTS fallback per klip aktif |
| **100 video / hari** | **700** (`205,9%`) | **750** (`220,6%`) | **900** (`264,7%`) | **1.000** (`294,1%`) | **1.500** (`441,2%`) | **Melebihi kuota (2×–4,4×)** — wajib **Paid Tier** atau tambah pool ke **35–50+ Free key** |

### D. Estimasi Token & Biaya per Video (Berdasarkan `ai_token_usage_ledger`)
Data nyata yang tercatat di `staging.ai_token_usage_ledger` (saat ini **hanya** tahap Storyboard Single-Pass yang dicatat dengan rate internal `ai-token-meter.js`):

| Tahap | Sampel | Rata-rata Prompt Token | Rata-rata Output Token | Rata-rata Total Token | Biaya Terukur (USD / IDR per video) |
|---|---|---:|---:|---:|---:|
| **Storyboard** (F2.1 `#2133`–`#2140`, `n=8`) | 8 video | 14.516 | 4.476 | **18.992** | `$0,006986` / **Rp 111,78** |
| **Storyboard** (Scene Director `#2143`–`#2148`, `n=6`) | 6 video | 12.585 | 4.507 | **17.410** | `$0,006526` / **Rp 104,42** |
| **Storyboard Gabungan (`n=14`)** | 14 video | 13.688 | 4.489 | **18.314** | `$0,006789` / **Rp 108,63** |
| **Vision QC Start Frame (`6` call/video)** | — | *tidak tercatat* | *tidak tercatat* | *tidak tercatat* | *tidak tercatat di `ai_token_usage_ledger`* |
| **Audit VO & TTS Gemini** | — | *tidak tercatat* | *tidak tercatat* | *tidak tercatat* | *tidak tercatat di `ai_token_usage_ledger`* |

---

## 4. Celah Pencatatan (Telemetry Gaps) & Usulan Perbaikan

### Celah Pencatatan yang Ditemukan
1. **Vision QC (`generateWithImage`) tidak tercatat di `ai_token_usage_ledger`:** Fungsi `generateWithImage()` di [gemini.js#L1036-L1063](file:///Users/sabeqmmursyid/_cfstudio/lib/gemini.js#L1036-L1063) tidak memanggil `recordAiTokenUsage()`, padahal ia menyumbang **86% dari total panggilan Gemini** saat QC aktif. Token gambar + JSON output QC berstatus **`tidak tercatat`**.
2. **VO Compliance Audit (`getGeminiModel` / `callGeminiJson`) & Gemini TTS tidak tercatat di token ledger:** Keduanya tidak memanggil `recordAiTokenUsage()`, dan VO Audit memakai `getGeminiModel()` langsung tanpa label `feature` maupun `item_id`.
3. **Retry internal `503`/`404` & rotasi key tersembunyi tidak terhitung di `api_key_usages`:** `executeWithKeyPool()` memanggil `incrementKeyUsage(keyId, 1)` hanya **1 kali setelah `executorFn` sukses**, dan `recordAiTokenUsage` juga hanya mencatat percobaan sukses terakhir. Percobaan HTTP yang gagal `503` (seperti `2×` retry di `#2134` dan `#2145`) atau berpindah key **`tidak tercatat`** jumlahnya di database.
4. **`ai_token_usage_ledger.meta_json` kosong (`{}`):** Seluruh 25 baris ledger uji hari ini memiliki `meta_json = {}` tanpa `campaign_id`, `item_id`, maupun `stage` (harus dicocokkan manual lewat timestamp ke log PM2).
5. **Log `[Gemini API]` tidak seragam di seluruh jalur:** `generateContentFlexible()` menulis `[Gemini API] Menjalankan standard request...` (tanpa `item_id`), sedangkan `generateWithImage()` tidak menulis log apa pun saat sukses (hanya menulis log `[Gemini-Waterfall]` bila error `503`/`404`).
6. **Bug status Audit VO PostgreSQL (`bigint` vs `=== 1` & whitelist DB):** Di [scheduler-processors.js#L5972](file:///Users/sabeqmmursyid/_cfstudio/lib/scheduler-processors.js#L5972), `campaign.enable_vo_audit === 1` gagal ketika driver `pg` mengembalikan kolom `bigint` sebagai `'1'`. Selain itu `compliance_status`, `compliance_score`, dan `compliance_log_json` tidak masuk daftar `allowed` pada [updatePillarCampaignItem](file:///Users/sabeqmmursyid/_cfstudio/lib/db.js#L2497-L2512) sehingga pembaruannya tidak tersimpan di Postgres.

### Usulan Pencatatan Sederhana (Belum Dikerjakan — Untuk Iterasi Berikutnya)
1. **Satu baris log terstruktur seragam untuk semua caller Gemini** (storyboard, Vision QC, compliance audit, TTS batch/8s, waterfall retry):
   ```text
   [GEMINI_CALL] campaign=<id> item=<item_id> clip=<clip_idx|all> stage=<storyboard|vo_audit|vo_rewrite|vision_qc|tts_batch|tts_clip> attempt=<n> key_id=<id> model=<model> status=<ok|429|503|404|timeout|err> pt=<prompt_tokens> ct=<output_tokens> ms=<latency>
   ```
2. **Sertakan `recordAiTokenUsage()` + `meta: { campaign_id, item_id, stage, clip_index }`** di `generateWithImage()`, `tiktok-compliance-service.js`, dan modul TTS Gemini (bila `usageMetadata` tersedia), serta tambahkan konteks ringan opsional (`AsyncLocalStorage` atau `options.traceContext`) agar 100% baris ledger bisa diagregasi per `item_id` dengan satu query SQL.
3. *(Catatan bug terpisah untuk backlog perbaikan)*: ubah `campaign.enable_vo_audit === 1` menjadi `Number(campaign.enable_vo_audit) === 1` dan masukkan `compliance_status`, `compliance_score`, `compliance_log_json`, `original_voiceover`, `tiktok_safe_voiceover`, `selected_vo_version` ke whitelist `updatePillarCampaignItem`.

