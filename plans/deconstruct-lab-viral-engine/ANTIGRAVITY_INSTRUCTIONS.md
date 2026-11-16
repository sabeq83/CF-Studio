# Instruksi Eksekusi untuk Agent Antigravity — Upgrade Deconstruct Lab

**Dokumen acuan wajib dibaca dulu:** `plans/deconstruct-lab-viral-engine/proposal.md` (berisi temuan, lokasi file + nomor baris, contoh kode sebelum/sesudah, dan migrasi DB).

**Aturan umum:** ikuti seluruh SOP di `AGENTS.md`, terutama:
- Buat `plans/deconstruct-lab-viral-engine/implementation_plan.md` dengan seksi `## Execution Task List` (checkbox) + potongan kode **Sebelum/Sesudah** per file, lalu centang `- [x]` secara real-time.
- Perubahan UI → **mockup HTML dulu** di `public/mockup_*.html`, sinkron ke staging (port 5010), tunggu review pengguna sebelum coding React.
- Hanya pakai semantic CSS tokens dari `app/theme.css` (tanpa warna hardcoded).
- Tanpa secret/API key di kode atau test (pakai `process.env` / mock `TEST_MOCK_API_KEY`).
- Deploy hanya ke **Dev** dan **Staging** via atomic deploy. **DILARANG deploy Production.**
- Setelah tiap fase terverifikasi → `npm run release-non-interactive` sesuai SOP rilis.

---

## Keputusan yang Sudah Ditetapkan (pakai ini, jangan ditanyakan ulang)

1. Batas durasi video panjang: **60 menit** (bisa diubah di Settings, key `deconstruct_max_duration_min`).
2. Tujuan video panjang: **dipecah menjadi beberapa blueprint klip pendek (15–60 detik)** untuk Multiplier.
3. Rekomendasi produk: **tidak dibuat lagi untuk aset baru**; aset lama yang sudah punya data tetap ditampilkan (kondisional). Kolom DB **tidak di-drop**.
4. Urutan: **Fase 1 → Fase 2 → Fase 3**. Fase 4 (analisa komentar) **tidak dikerjakan** sekarang.
5. Jangan ubah kontrak keluaran yang dipakai Multiplier yang sudah ada (`original_storyboard_json`, `viral_pattern_summary`, `core_problem`, `core_solution`, `target_audience_pain_point`, `niche`, `tags`) — hanya **menambah** field.

---

## FASE 1 — Hapus Rekomendasi Produk + Keandalan Analisa (risiko rendah)

### Tugas
1. `lib/prompts.js` → `buildDeconstructPhase1Prompt`:
   - Hapus seksi **B. PRODUCT IDEAS** dan blok `product_ideas` di contoh JSON. Hapus juga kata "celah produk e-commerce" di peran pembuka; ganti peran menjadi analis pola konten viral.
   - Signature baru: `buildDeconstructPhase1Prompt(originalCaption, availableNiches = [], sourceMetrics = null)` (sourceMetrics belum dipakai di Fase 1, siapkan saja).
   - Penomoran seksi C/D/E disesuaikan.
2. `lib/scheduler-processors.js` (`processDeconstruct`, ±baris 11034–11060):
   - Hapus `targetRecommendationCount`; berhenti menulis `product_ideas_json` untuk aset baru.
   - Panggil `generateWithVideo(..., { taskType: 'DECONSTRUCT', temperature: 0.2, responseSchema: DECONSTRUCT_SCHEMA })`.
3. `lib/gemini.js` → `generateWithVideo(fileUri, mimeType, prompt, apiKey = null, opts = {})`:
   - Opsi: `modelName`, `taskType` (resolve via `MODULE_MODEL_MATRIX` sesuai tier paid/free), `temperature` (default 0.2), `maxOutputTokens` (default 32768), `responseSchema`, `mediaResolution`, `videoMetadata` ({startOffset, endOffset}).
   - **Pemanggil lain `generateWithVideo` harus tetap berperilaku sama** — cek semua pemanggil (`git grep -n generateWithVideo`); jika ada pemanggil selain deconstruct, beri mereka default lama (temperature 0.8, 16384) lewat opts atau pertahankan default lama dan hanya deconstruct yang override. Pilih yang paling aman.
4. Buat `DECONSTRUCT_SCHEMA` (format responseSchema Gemini) di file baru `lib/deconstruct-schema.js`, mencakup storyboard, core_problem, core_solution, target_audience_pain_point, viral_pattern_summary, niche, tags.
5. Validasi hasil: storyboard ≥ 1 adegan, field wajib terisi; jika gagal → **1x retry** otomatis sebelum status `failed`.
6. UI & API:
   - `app/deconstruct/page.js`: hapus state `recommCount` dan dropdown "Target Jumlah Ide Rekomendasi" (±baris 43, 319, 1029–1045). Perubahan ini hanya penghapusan elemen, **tidak perlu mockup**.
   - `app/api/v2/deconstruct/process/route.js` & `lib/db.js:3299`: abaikan `target_recommendation_count` (tetap toleran bila klien lama mengirimnya). Kolom DB dibiarkan.
   - `app/deconstruct/[id]/page.js` (±771–835) & `app/components/campaign-forms/MultiplierConfigurationForm.js` (±3268): seksi Low/High Ticket hanya tampil bila datanya ada.
7. Konsumen hilir:
   - `app/api/recipe-labs/deconstructed-assets/route.js`: `recipe_suggestion` diambil dari `core_solution` (tambahkan ke SELECT), fallback ke ide produk lama, lalu `'Resep Berdasarkan Video'`.
   - `lib/scheduler-processors.js` (±11227) & `lib/culinary-sequence-engine.js` (±94): ganti "Ide Produk / Bahan Pendukung" dengan **Core Problem + Core Solution**; jika aset lama masih punya `product_ideas_json`, boleh disertakan sebagai fallback.
8. MCP (`apps/mcp/tools.mjs`): pastikan deskripsi/hasil `cf_get_deconstructed_blueprint` & `cf_ingest_viral_video` tidak lagi menjanjikan rekomendasi produk.
9. Test: perbarui/ tambah test di `tests/deconstruct-*.test.js`, `tests/test-mcp-tools-parity.test.js`; tambah test bahwa prompt baru **tidak mengandung** `product_ideas`/`low_ticket`/`high_ticket`, dan bahwa `generateWithVideo` pemanggil lain tidak berubah perilakunya.

### Kriteria selesai Fase 1
- Semua test lulus (`npm test` atau runner yang dipakai proyek).
- Deploy ke **Dev**, dekonstruksi 2 video pendek nyata → status `deconstructed`, tanpa rekomendasi produk, halaman detail aset lama masih menampilkan ide produk lamanya.
- Rilis `--type patch`. Laporkan ke pengguna, lalu lanjut Fase 2.

---

## FASE 2 — Data Performa + Viral DNA

### Tugas
1. **Migrasi DB** (tambah kolom saja, schema `dev` lalu `staging`; tambahkan juga ke inisialisasi skema di `lib/db-pg.js`/`lib/db.js` sesuai pola proyek):
   `viral_dna_json TEXT`, `source_metrics_json TEXT`, `viral_score INTEGER`, `duration_sec INTEGER`, `analysis_mode TEXT DEFAULT 'short'`.
   Tambahkan kolom baru ke whitelist update di `lib/db.js` (±3344).
2. `lib/video-downloader.js` → fungsi baru `probeVideo(url)`: `yt-dlp --dump-json --no-playlist` (pakai urutan fallback cookie yang sama dengan download). Ambil: `duration, view_count, like_count, comment_count, repost_count, channel_follower_count, upload_date, uploader, track, artist`. Gagal probe **tidak boleh** menggagalkan dekonstruksi (lanjut dengan metrik kosong). Untuk upload file lokal, pakai `ffprobe` untuk durasi saja.
3. `lib/viral-score.js` → `computeViralScore(metrics)` → 0–100 dari: viral ratio (views/follower), engagement rate ((like+comment+share)/views), views per hari. Kembalikan `null` bila data tidak cukup. Wajib unit test.
4. Prompt: tambahkan seksi **VIRAL DNA** dengan struktur persis seperti `proposal.md` bagian 3 → P2 (hook, format_archetype, narrative_structure, retention_devices, payoff_timestamp, ending_type, pacing, on_screen_text, audio, cta, replicability, compliance_flags, why_it_works, adaptation_tips). Gunakan **enum** sesuai proposal. Metrik dari probe disisipkan ke prompt sebagai konteks. Perbarui `DECONSTRUCT_SCHEMA`. `viral_pattern_summary` tetap diisi.
5. Simpan `viral_dna_json`, `source_metrics_json`, `viral_score`, `duration_sec` di processor.
6. **UI (wajib mockup dulu):** buat `public/mockup_deconstruct_viral_dna.html` (self-contained tokens, light/dark) berisi:
   - Halaman detail: kartu metrik (views, follower, viral ratio, engagement, badge viral score), panel Hook 3 detik, timeline retensi, teks di layar, audio, CTA, skor bisa-ditiru-AI, flag compliance, "Kenapa Viral" & "Tips Adaptasi".
   - Library: badge viral score + filter arketipe, tipe hook, skor minimal, replicability.
   Sinkronkan ke staging (`http://100.95.245.55:5010/mockup_deconstruct_viral_dna.html`), **berhenti dan tunggu persetujuan pengguna** sebelum mengubah React.
7. Setelah disetujui: implementasi di `app/deconstruct/[id]/page.js`, `app/deconstruct/page.js`, API `app/api/v2/deconstruct/route.js` & `[id]/route.js` (kembalikan field baru + dukung filter/sort).
8. Hilir:
   - Multiplier: suntik ringkas `viral_dna.hook`, `retention_devices`, `pacing`, `ending_type` ke `buildMultiplierPhase2Prompt` dan angle generator (`lib/multiplier-angle-generator.js`) sebagai "Struktur Viral yang Wajib Ditiru". Jika `viral_dna_json` kosong (aset lama) → perilaku lama.
   - MCP `cf_get_deconstructed_blueprint` & `cf_search_blueprints`: kembalikan `viral_dna`, `source_metrics`, `viral_score`.
9. Script opsional `scripts/backfill-viral-metrics.mjs` (dry-run default) untuk mengisi metrik aset lama via probe saja (tanpa panggil Gemini).

### Kriteria selesai Fase 2
- Test lulus, deploy Dev → Staging, uji 3 video viral nyata (TikTok, Reels, Shorts): metrik terisi bila tersedia, viral_dna valid, UI tampil benar di light & dark.
- Multiplier dari blueprint baru dan lama sama-sama berjalan.
- Rilis `--type minor`. Laporkan, lalu lanjut Fase 3.

---

## FASE 3 — Mode Video Panjang

### Tugas
1. Mode ditentukan dari `probeVideo`: `short` jika ≤ 180 detik, `long` jika lebih; tolak dengan pesan jelas jika > batas `deconstruct_max_duration_min` (default 60).
2. Unduhan mode long: `-f "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720]/b" --merge-output-format mp4`; timeout dinamis (`max(5 menit, durasi × 1)` maks 30 menit). Pastikan ffmpeg tersedia (sudah ada penambahan PATH di file ini).
3. `uploadVideoToGemini`: batas polling adaptif `max(120 dtk, durasi × 0,5)`, maks 15 menit; terima parameter `expectedDurationSec`.
4. Analisa 2 tahap (fungsi baru di `lib/deconstruct-long.js`):
   - **Tahap A (peta besar)** — 1 panggilan, `mediaResolution: LOW`: segmen/bab (judul, start, end, ringkasan), struktur narasi, core problem/solution/pain point, niche, tags, viral_dna level video, dan **viral_moments** (3–10 kandidat klip 15–60 detik: start, end, alasan, hook_strength).
   - **Tahap B (detail)** — untuk tiap viral moment, panggil Gemini dengan `videoMetadata {startOffset, endOffset}` pada fileUri yang sama (tanpa upload ulang) → storyboard per adegan + viral_dna klip. Jeda antar panggilan mengikuti pola anti-block yang ada; pakai key pool.
   - `original_storyboard_json` aset induk = gabungan storyboard momen (agar konsumen lama tetap jalan, batasi maks 40 adegan).
5. Simpan momen sebagai **sub-blueprint**: tabel baru `re_deconstructed_clips` (id, tenant_id, parent_asset_id, start_sec, end_sec, storyboard_json, viral_dna_json, hook_strength, status, created_at) **atau** baris baru di `re_deconstructed_assets` dengan `parent_asset_id` — pilih yang paling sedikit mengubah Multiplier; jelaskan pilihan di implementation_plan. Sub-blueprint harus bisa dipilih di Multiplier seperti blueprint biasa.
6. Status progres baru: `probing → downloading → uploading → mapping → detailing (n/m) → deconstructed`. Tambahkan kolom `progress_note` bila perlu.
7. **UI (wajib mockup dulu):** `public/mockup_deconstruct_long_video.html` — progres tahap, daftar momen viral (thumbnail waktu, alasan, skor hook, tombol "Pakai di Multiplier"). Sinkron ke staging, **tunggu persetujuan** sebelum React.
8. Pastikan file sementara dibersihkan juga saat gagal di tengah tahap B, dan file Gemini dihapus setelah selesai bila API mendukung.

### Kriteria selesai Fase 3
- Uji di Dev/Staging dengan video **10, 30, 60 menit** + 1 video > 60 menit (harus ditolak rapi) + video pendek (harus tetap jalur `short` tanpa regresi).
- Tiap video panjang menghasilkan ≥ 3 sub-blueprint yang bisa dipakai Multiplier sampai storyboard ter-generate.
- Rilis `--type minor`.

---

## Laporan Akhir yang Wajib Diberikan ke Pengguna (Bahasa Indonesia, bahasa sederhana)
Per fase: apa yang berubah dari sisi pengguna, link staging untuk dicoba, hasil uji (berhasil/gagal + alasan), versi rilis, dan hal yang belum dikerjakan. Hindari detail teknis berlebihan.
