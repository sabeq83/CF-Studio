# Usulan Peningkatan Deconstruct Lab — Engine Analisa Video Viral

Tanggal: 2026-11-16 · Status: **USULAN (belum dieksekusi, menunggu persetujuan)**
Penyusun: Claude (reviewer/planner) · Eksekutor: Antigravity

---

## 0. Ringkasan Cara Kerja Engine Saat Ini

Alur per video (diproses satu per satu, jeda 20 detik antar video):

1. **Unduh** video dari URL pakai yt-dlp — `lib/video-downloader.js:44` (format `best[ext=mp4]/best`, batas waktu 5 menit).
2. **Upload** ke Gemini File API, tunggu status ACTIVE maksimal **120 detik** — `lib/gemini.js:528`.
3. **Analisa** 1x panggilan Gemini (video + prompt) — `lib/gemini.js:557` (temperature **0.8**, output maks **16.384 token**).
4. Prompt: `buildDeconstructPhase1Prompt` — `lib/prompts.js:3820`, meminta:
   - A. Storyboard per adegan (timestamp, visual, emosi, transkrip, teknik kamera)
   - **B. Rekomendasi produk Low Ticket & High Ticket** ← diminta dihapus
   - C. Core problem / core solution / pain point audiens
   - D. Ringkasan pola viral (teks bebas 3–5 kalimat)
   - E. Niche & tags
5. Simpan ke tabel `re_deconstructed_assets` — `lib/scheduler-processors.js:11049`.

---

## 1. Hapus Rekomendasi Produk dari Gemini

### Temuan
Ya, saat ini Gemini **selalu** diminta membuat rekomendasi produk (default 3 Low Ticket + 3 High Ticket per video). Ini membuang token output dan membuat Gemini "terdistraksi" dari tugas utama (membedah pola viral).

### Titik yang terdampak (harus ikut dibereskan, bukan hanya prompt)

| # | Lokasi | Pemakaian `product_ideas` | Tindakan |
|---|--------|---------------------------|----------|
| 1 | `lib/prompts.js:3854-3876` & contoh JSON | Instruksi seksi B | **Hapus** seksi B + blok `product_ideas` di contoh JSON; parameter `targetRecommendationCount` dibuang |
| 2 | `lib/scheduler-processors.js:11034-11035, 11051` | Kirim jumlah rekomendasi, simpan `product_ideas_json` | Hapus argumen; berhenti menulis kolom (biarkan kolom lama tetap ada) |
| 3 | `app/deconstruct/page.js:43, 319, 1029-1045` | Dropdown "Target Jumlah Ide Rekomendasi" | **Hapus** dropdown dari modal proses |
| 4 | `app/api/v2/deconstruct/process/route.js:9,20` + `lib/db.js:3299` | Terima & simpan `target_recommendation_count` | Abaikan/hapus parameter (kolom DB dibiarkan, tidak di-drop) |
| 5 | `app/deconstruct/[id]/page.js:216-217, 771-835` | Kartu "Low/High Ticket Concepts" | Tampilkan hanya jika data lama ada; untuk aset baru sembunyikan seksi |
| 6 | `app/components/campaign-forms/MultiplierConfigurationForm.js:3268` | Modal detail blueprint | Sama: tampil kondisional |
| 7 | `app/api/recipe-labs/deconstructed-assets/route.js:35-40` | `recipe_suggestion` diambil dari ide produk kategori food | **Ganti sumber** → pakai `core_solution` (fallback "Resep Berdasarkan Video") |
| 8 | `lib/scheduler-processors.js:11227` & `lib/culinary-sequence-engine.js:94` | Ide produk disuntik ke prompt resep | Ganti dengan `core_problem` + `core_solution` (lebih relevan untuk resep) |
| 9 | `app/api/v2/deconstruct/route.js:33` | Pencarian ILIKE di `product_ideas_json` | Boleh tetap (aman untuk data lama) |

**Prinsip keamanan data:** kolom `product_ideas_json` dan `target_recommendation_count` **tidak dihapus** dari database — data lama tetap terbaca, hanya tidak diisi lagi.

**Dampak:** hemat ±25–35% token output per video, dan respon lebih fokus.

---

## 2. Kesiapan untuk Video Durasi Panjang

### Kesimpulan: **BELUM SIAP.** Engine saat ini dirancang untuk video pendek (TikTok/Reels/Shorts < 90 detik).

### Titik lemah (urut dari yang paling sering membuat gagal)

| # | Masalah | Lokasi | Akibat pada video panjang |
|---|---------|--------|---------------------------|
| L1 | Output Gemini dibatasi 16.384 token & semua adegan diminta sekaligus | `lib/gemini.js:566` | Video 10–30 menit punya 80–300 adegan → JSON **terpotong** → parse gagal → status `failed` |
| L2 | Tunggu proses Gemini maks 120 detik | `lib/gemini.js:540` | Video panjang butuh beberapa menit untuk diproses Gemini → **timeout** |
| L3 | yt-dlp ambil kualitas terbaik (bisa 1080p/4K), tanpa cek durasi/ukuran | `lib/video-downloader.js:45` | File ratusan MB–GB, unduh > 5 menit → **timeout**; upload lambat; disk penuh |
| L4 | Resolusi analisa default Gemini (±300 token/detik video) | `generateWithVideo` | Video 1 jam ≈ 1 juta token input → melewati batas/kuota key gratis |
| L5 | Tidak ada potong-segmen (chunking) | prompt & processor | Detail adegan di menit akhir cenderung asal-asalan ("lost in the middle") |
| L6 | Hasil dipakai Multiplier yang membuat video pendek; storyboard dimasukkan utuh ke prompt | `lib/prompts.js:4351`, `lib/multiplier-angle-generator.js:308` | 200 adegan dibuang mentah ke prompt remake → boros & tidak relevan untuk klip 30–60 detik |
| L7 | Model tidak mengikuti matriks `DECONSTRUCT`; pakai model PRIMARY umum | `lib/gemini.js:173` vs `:560` | Tidak bisa memilih model berkonteks panjang khusus untuk dekonstruksi |

### Usulan: "Mode Video Panjang" (otomatis aktif bila durasi > 3 menit)

1. **Cek durasi dulu sebelum unduh** — `yt-dlp --dump-json` (sekalian ambil metadata, lihat bagian 3). Tentukan mode: `short` (≤ 3 menit) atau `long`.
2. **Unduh hemat** — mode long pakai format maksimal 480p/720p (`-f "bv*[height<=720][ext=mp4]+ba/b[height<=720]"`), batas durasi (misal maks 60 menit, bisa diatur di Settings), timeout dinamis.
3. **Tunggu proses Gemini secara adaptif** — batas tunggu = `max(120 detik, durasi × 0,5)`, maks 15 menit.
4. **Resolusi analisa rendah** untuk mode long (`mediaResolution: LOW`, ±100 token/detik) → 1 jam ≈ 360rb token, masih masuk konteks model Flash.
5. **Analisa 2 tahap (ganti 1 panggilan raksasa):**
   - **Tahap A — Peta Besar:** 1 panggilan untuk seluruh video → bab/segmen (judul, rentang waktu, ringkasan), struktur narasi keseluruhan, core problem/solution, niche, tags, **dan daftar "Momen Viral"** (kandidat potongan 15–60 detik yang paling kuat hook-nya).
   - **Tahap B — Bedah Detail per Segmen:** untuk tiap segmen/momen terpilih, panggil Gemini dengan **potongan waktu** (`videoMetadata.startOffset/endOffset`, file yang sama tidak perlu upload ulang) → storyboard per adegan seperti sekarang.
   - Hasil digabung; masing-masing tahap aman di bawah batas output.
6. **Simpan "Momen Viral" sebagai sub-blueprint** — tabel baru `re_deconstructed_clips` (atau kolom `viral_moments_json`), sehingga 1 video panjang → beberapa blueprint pendek yang **langsung bisa dipakai Multiplier** (sesuai format output kita: video pendek).
7. **Naikkan batas output** ke 32k–65k token (didukung model Flash) & pakai **structured output** (`responseSchema`) agar JSON tidak rusak.
8. **Hormati matriks model** `MODULE_MODEL_MATRIX.DECONSTRUCT` di `generateWithVideo` (tambah opsi `modelName`).
9. **Progress di UI** — status baru: `probing → downloading → uploading → mapping (Tahap A) → detailing 3/7 (Tahap B) → deconstructed`.

---

## 3. Audit: Apakah Engine Sudah FIT untuk Menganalisa Video Viral?

### Skor kesiapan saat ini (penilaian reviewer)

| Dimensi analisa viral | Status | Catatan |
|-----------------------|--------|---------|
| Bedah adegan (storyboard) | ✅ Baik | Timestamp, visual, emosi, transkrip, kamera |
| Masalah & solusi inti | ✅ Baik | core_problem / core_solution / pain point |
| **Bukti viral (data performa)** | ❌ Tidak ada | Tidak tahu views, likes, share, komentar, jumlah follower, tanggal upload |
| **Bedah HOOK 0–3 detik** | ⚠️ Lemah | Hanya tersirat di adegan 1; tidak ada tipe hook, teks hook, frame pertama |
| **Teks di layar (on-screen text)** | ❌ Tidak ada | Elemen kunci video TikTok/Reels viral tidak direkam |
| **Lapisan audio** | ❌ Tidak ada | Musik/trending sound, SFX, jenis suara (asli/AI), tempo bicara |
| **Ritme & pacing** | ❌ Tidak ada | Jumlah potongan, rata-rata durasi shot, kecepatan narasi |
| **Struktur retensi** | ⚠️ Lemah | Tidak ada open loop, re-hook, waktu payoff, ending loop |
| **Format/arketipe** | ❌ Tidak ada | Tutorial / before-after / storytime / listicle / POV / ASMR / myth-busting tidak diklasifikasi |
| **CTA & pancingan komentar** | ❌ Tidak ada | |
| **Bisa ditiru AI? (replicability)** | ❌ Tidak ada | Penting karena remake kita pakai AI video (G-Labs): butuh wajah bicara? lokasi khusus? |
| **Risiko compliance** | ❌ Tidak ada | Penting untuk niche herbal/kesehatan (klaim berlebihan) |
| Konsistensi hasil | ⚠️ Lemah | Temperature 0.8 → hasil analisa berubah-ubah tiap run |
| Ringkasan pola viral bisa difilter | ❌ | `viral_pattern_summary` teks bebas, tidak bisa dicari/dibandingkan |

### Verdict: **BELUM FIT.** Engine sekarang bagus untuk *"apa isi video ini"*, tapi belum menjawab *"KENAPA video ini viral dan bagian mana yang bisa kita tiru"*.

### Usulan Peningkatan

#### P1. Ambil Data Performa (gratis, tanpa token AI)
Dari `yt-dlp --dump-json` (sudah dipanggil di langkah cek durasi): `view_count`, `like_count`, `comment_count`, `repost_count`, `channel_follower_count`, `upload_date`, `duration`, `uploader`, `track/artist` (musik).
Hitung otomatis:
- **Viral Ratio** = views ÷ follower (≥ 3x = viral karena konten, bukan karena nama akun)
- **Engagement Rate** = (like + komentar + share) ÷ views
- **Umur video** & views per hari
Simpan di kolom baru `source_metrics_json` + `viral_score` (0–100). Tampilkan badge di library & bisa diurutkan.

#### P2. Ganti `viral_pattern_summary` teks bebas → objek terstruktur `viral_dna_json`
Field yang diminta ke Gemini (pilihan enum agar bisa difilter):

```json
{
  "hook": {
    "type": "question | shock_statement | result_first | pattern_interrupt | pov | controversy | curiosity_gap | relatable_pain",
    "first_frame": "deskripsi frame pertama",
    "spoken_hook": "kalimat 0-3 detik",
    "text_overlay_hook": "teks di layar 0-3 detik",
    "hook_duration_sec": 2.5,
    "strength_score": 8
  },
  "format_archetype": "tutorial | before_after | storytime | listicle | pov | asmr | myth_busting | reaction | day_in_life | comparison",
  "narrative_structure": "problem-agitate-solve | hook-story-offer | list | transformation | ...",
  "retention_devices": [{"timestamp": "00:07", "device": "open_loop | re_hook | reveal | countdown | cliffhanger"}],
  "payoff_timestamp": "00:24",
  "ending_type": "loop | cta | cliffhanger | punchline",
  "pacing": {"total_cuts": 14, "avg_shot_sec": 1.8, "speech_wpm": 165},
  "on_screen_text": [{"timestamp": "00:00-00:03", "text": "..."}],
  "audio": {"music_type": "trending_sound | original | none", "voice_type": "human_native | ai_voice | none", "sfx_used": true, "music_mood": "..."},
  "cta": {"type": "comment_bait | follow | save | link_bio | none", "text": "..."},
  "replicability": {"ai_reproducible_score": 7, "needs_human_face": false, "needs_special_location": false, "notes": "..."},
  "compliance_flags": ["klaim menyembuhkan penyakit", "..."],
  "why_it_works": ["alasan 1", "alasan 2", "alasan 3"],
  "adaptation_tips": ["cara meniru tanpa menjiplak 1", "..."]
}
```

`viral_pattern_summary` tetap diisi (ringkasan singkat) agar Multiplier & tampilan lama tidak rusak.

#### P3. Analisa Komentar (opsional, mode lanjutan)
Untuk YouTube, yt-dlp bisa ambil top komentar (`--write-comments`, dibatasi 50). Kirim ke Gemini sebagai teks tambahan → "apa yang membuat penonton bereaksi", keberatan, pertanyaan yang sering muncul (bahan hook baru). TikTok/IG seringkali tidak tersedia → lewati tanpa error.

#### P4. Konsistensi & Keandalan
- Temperature **0.8 → 0.2** (analisa = faktual, bukan kreatif).
- Pakai **responseSchema** (structured output) → JSON selalu valid.
- Validasi minimal: storyboard ≥ 1 adegan, timestamp berurutan, hook terisi; jika gagal → 1x retry otomatis.

#### P5. Manfaatkan Hasil Baru di Hilir
- **Multiplier:** suntik `viral_dna.hook`, `retention_devices`, `pacing`, `ending_type` ke prompt remake (meniru *struktur viral*, bukan sekadar urutan adegan).
- **Library Deconstruct:** filter berdasarkan arketipe, tipe hook, viral score, replicability.
- **MCP** (`cf_get_deconstructed_blueprint`, `cf_search_blueprints`): ikut mengembalikan `viral_dna` & metrik.

---

## 4. Rekomendasi Urutan Eksekusi (bertahap, aman)

| Fase | Isi | Risiko | Perkiraan |
|------|-----|--------|-----------|
| **Fase 1 — Cepat** | Bagian 1 (hapus rekomendasi produk) + P4 (temperature, schema, model matrix) | Rendah | 0,5–1 hari |
| **Fase 2 — Viral DNA** | P1 (metrik yt-dlp + viral score) + P2 (viral_dna_json) + tampilan UI + P5 | Sedang | 2–3 hari |
| **Fase 3 — Video Panjang** | Bagian 2 (probe durasi, unduh hemat, analisa 2 tahap, momen viral → sub-blueprint) | Sedang–Tinggi | 3–5 hari |
| Fase 4 — Opsional | P3 analisa komentar | Rendah | 1 hari |

Sesuai SOP: perubahan UI (Fase 2 & 3) wajib dibuat **mockup HTML** dulu (`public/mockup_deconstruct_viral_dna.html`) dan di-review via staging sebelum coding React.

---

## 5. Contoh Perubahan Kode Kunci (Sebelum → Sesudah)

### 5.1 Prompt — hapus seksi produk (`lib/prompts.js:3820`)
**Sebelum:**
```js
export function buildDeconstructPhase1Prompt(originalCaption, targetRecommendationCount = 3, availableNiches = []) {
  ...
### B. PRODUCT IDEAS (Celah Produk yang Bisa Dijual)
Berikan ${targetRecommendationCount} rekomendasi untuk masing-masing kategori: ...
```
**Sesudah:**
```js
export function buildDeconstructPhase1Prompt(originalCaption, availableNiches = [], sourceMetrics = null) {
  ...
  // Seksi B diganti: "### B. VIRAL DNA (Mengapa Video Ini Viral)" → objek viral_dna (lihat P2)
```

### 5.2 Processor (`lib/scheduler-processors.js:11034-11051`)
**Sebelum:**
```js
const targetRecommendationCount = Number(asset.target_recommendation_count || 3);
const promptText = buildDeconstructPhase1Prompt(asset.original_caption, targetRecommendationCount, availableNiches);
...
product_ideas_json: JSON.stringify(parsed.product_ideas || {}),
```
**Sesudah:**
```js
const promptText = buildDeconstructPhase1Prompt(asset.original_caption, availableNiches, sourceMetrics);
return await generateWithVideo(uploadResult.fileUri, mimeType, promptText, apiKey, {
  taskType: 'DECONSTRUCT', temperature: 0.2, responseSchema: DECONSTRUCT_SCHEMA,
});
...
viral_dna_json: JSON.stringify(parsed.viral_dna || {}),
source_metrics_json: JSON.stringify(sourceMetrics || {}),
viral_score: computeViralScore(sourceMetrics),
```

### 5.3 Gemini video call (`lib/gemini.js:557`)
**Sebelum:**
```js
export async function generateWithVideo(fileUri, mimeType, prompt, apiKey = null) {
  ... model: models.PRIMARY, generationConfig: { temperature: 0.8, maxOutputTokens: 16384, responseMimeType: 'application/json' }
```
**Sesudah:**
```js
export async function generateWithVideo(fileUri, mimeType, prompt, apiKey = null, opts = {}) {
  const modelName = opts.modelName || resolveTaskModel(opts.taskType) || models.PRIMARY;
  ... generationConfig: {
    temperature: opts.temperature ?? 0.2,
    maxOutputTokens: opts.maxOutputTokens ?? 32768,
    responseMimeType: 'application/json',
    ...(opts.responseSchema ? { responseSchema: opts.responseSchema } : {}),
    ...(opts.mediaResolution ? { mediaResolution: opts.mediaResolution } : {}),
  }
  // parts: { fileData }, opsional { videoMetadata: { startOffset, endOffset } } untuk Tahap B
```

### 5.4 Downloader (`lib/video-downloader.js:45`)
**Sebelum:**
```js
const baseArgs = ['-f', 'best[ext=mp4]/best', '--no-playlist'];
```
**Sesudah:**
```js
// probeVideo(url) → yt-dlp --dump-json → { duration, view_count, like_count, ... }
const format = mode === 'long'
  ? 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720]/b'
  : 'best[ext=mp4]/best';
const baseArgs = ['-f', format, '--no-playlist', '--merge-output-format', 'mp4'];
```

---

## 6. Migrasi Database (tambahan, tidak menghapus apa pun)

```sql
ALTER TABLE re_deconstructed_assets ADD COLUMN IF NOT EXISTS viral_dna_json TEXT;
ALTER TABLE re_deconstructed_assets ADD COLUMN IF NOT EXISTS source_metrics_json TEXT;
ALTER TABLE re_deconstructed_assets ADD COLUMN IF NOT EXISTS viral_score INTEGER;
ALTER TABLE re_deconstructed_assets ADD COLUMN IF NOT EXISTS duration_sec INTEGER;
ALTER TABLE re_deconstructed_assets ADD COLUMN IF NOT EXISTS analysis_mode TEXT DEFAULT 'short';
ALTER TABLE re_deconstructed_assets ADD COLUMN IF NOT EXISTS viral_moments_json TEXT; -- Fase 3
```
Dijalankan di schema `dev` → `staging` → (production hanya atas perintah manual).

---

## 7. Pertanyaan untuk Pengguna Sebelum Eksekusi

1. **Batas durasi maksimal** video panjang yang ingin didukung? (usulan: 60 menit)
2. Untuk video panjang, apakah tujuan utamanya **(a)** memecah jadi beberapa blueprint klip pendek untuk Multiplier, atau **(b)** blueprint utuh untuk membuat ulang video panjang juga? (usulan ini mengasumsikan **(a)**)
3. Data rekomendasi produk lama: cukup **disembunyikan** di aset baru (usulan), atau dihapus juga dari tampilan aset lama?
4. Fase mana yang ingin dikerjakan duluan? (usulan: Fase 1 → 2 → 3)

---

## Execution Task List

### Fase 1
- [ ] Hapus seksi B (product ideas) dari `buildDeconstructPhase1Prompt` & contoh JSON
- [ ] Hapus parameter jumlah rekomendasi di processor, API process, dan dropdown UI
- [ ] Ganti sumber `recipe_suggestion` → `core_solution`
- [ ] Ganti injeksi `product_ideas_json` di prompt resep & culinary engine → core problem/solution
- [ ] Kartu Low/High Ticket tampil kondisional (hanya data lama)
- [ ] `generateWithVideo`: opsi model DECONSTRUCT, temperature 0.2, responseSchema
- [ ] Update unit test terkait (`tests/deconstruct-*.test.js`, `tests/test-mcp-tools-parity.test.js`)
- [ ] Verifikasi di Dev → rilis patch

### Fase 2
- [ ] `probeVideo()` via yt-dlp `--dump-json` + `computeViralScore()`
- [ ] Migrasi kolom baru (dev → staging)
- [ ] Tambah seksi Viral DNA di prompt + schema
- [ ] Mockup HTML tampilan Viral DNA & metrik → review pengguna di staging
- [ ] Implementasi UI detail & filter library
- [ ] Suntik viral DNA ke prompt Multiplier + MCP blueprint
- [ ] Verifikasi → rilis minor

### Fase 3
- [ ] Mode long: format unduh ≤720p, batas durasi, timeout dinamis
- [ ] Polling upload adaptif + mediaResolution LOW
- [ ] Tahap A (peta besar + momen viral) & Tahap B (detail per segmen pakai offset)
- [ ] Simpan momen viral sebagai sub-blueprint siap Multiplier
- [ ] Mockup & UI progress tahap → review pengguna
- [ ] Uji dengan video 10, 30, 60 menit → rilis minor
