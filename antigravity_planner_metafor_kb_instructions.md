# Instruksi Agent: Metafora Planner, Sinkron Visual Style, Penyederhanaan KB & Pembersihan Fitur

Dokumen ini adalah instruksi kerja. Dokumen acuannya:
- `docs/usulan_planner_metafor_visual_action.md`: analisa lengkap (U1–U11, bagian 7–12).
- `docs/kb-lite-draft/` (lihat `README.md`): seluruh draf KB ringan — untuk planner (REALIST & VISUAL_STYLE lite) dan pengganti Prompt System (VIDEO_PROMPT_CORE, VOICE_AUDIO, METAPHOR_PHYSICS_LIBRARY, MANDATE_GLOSSARY), beserta `PROMPT_SYSTEM_INVENTORY.md`.

## Konteks penting

- **Ini update besar. Seluruh uji coba dilakukan di server Mac Mini Dev. TIDAK ADA deployment ke Staging** (dan tentu tidak ke Production) sampai user menyatakan hasil Dev lolos dan memberi perintah terpisah. Lihat bagian **Lingkungan Uji: Mac Mini Dev**.
- Server Staging dipakai untuk produksi harian brand, karena itu tidak boleh tersentuh selama pekerjaan ini. Perubahan perilaku prompt yang luas tetap **di balik flag** dengan default **off**, supaya saat nanti dibawa ke Staging perilaku lama tidak langsung berubah.
- Masalah utama:
  1. Planner dengan Visual Style **Metafora** menghasilkan aksi visual hook yang realis/produk, bukan analogi benda (kasus `pln_7d6363e0`: 0 dari 6 baris metafora, hook baris 1–3 menyalin contoh prompt).
  2. Saat ingest planner → OPC, `visual_style` diambil dari **preset**, bukan dari planner (`lib/pillar-campaign-ingest.js:208`). Preset tidak punya opsi Metafora/Investigasi, sehingga storyboard jalan sebagai Cinematic dan KB metafora tidak dimuat.
  3. Planner tahap 2 memuat ±265 KB KB (termasuk PROMPT_SYSTEM 140 KB, REALIST 49 KB, VISUAL_STYLE 33 KB), sehingga arahan gaya tenggelam.
- Prinsip: **pilihan pengguna di planner harus sampai utuh ke storyboard**, dan AI hanya diberi KB yang relevan dengan tugasnya.

## Langkah wajib sebelum coding

1. Baca dokumen acuan di atas sampai selesai.
2. Verifikasi ulang temuan di kode `main` saat ini (nomor baris bisa bergeser). Catat lokasi terbaru di plan.
3. Buat `planner_metafor_kb_implementation_plan.md` dengan seksi `## Execution Task List` (checkbox per fase P0–P7 di bawah), lengkap dengan **Code Sebelum (Current/Before)** dan **Code Sesudah (Proposed/After)** per file, sesuai SOP di `AGENTS.md`.
4. Laporkan plan dan **berhenti**. Tunggu persetujuan user sebelum fase P1 dan seterusnya.
5. Setiap fase selesai: ubah checkbox ke `- [x]` di plan secara real-time.

## Aturan umum

- Satu fase satu commit + deploy ke **Dev saja** (lihat bagian Lingkungan Uji). **Staging dan Production dilarang** selama pekerjaan ini.
- **Jangan memproses ulang** item, storyboard, atau video yang sudah `Completed`. Perubahan hanya berlaku untuk generasi baru.
- **Jangan mengubah data preset, planner, atau kampanye yang sudah ada** di schema mana pun (termasuk U11). Agent hanya melaporkan; user yang memutuskan. Pengecualian: membuat **data uji baru** di schema `dev` (lihat Lingkungan Uji).
- **Jangan menghapus tabel database** (`instant_campaigns`, `instant_campaign_items`, dll.) di fase mana pun. Penghapusan tabel adalah pekerjaan terpisah atas instruksi user.
- **Jangan mengubah aturan prompt video** (presence truth, kinetics, anatomy lock, T2I/I2V, start frame, bridging) kecuali disebut eksplisit di fase.
- Semua perubahan UI: **wajib mockup HTML dulu** di `public/mockup_*.html`, sinkron ke server **Dev** (`http://100.95.245.55:5020/mockup_*.html`, ikut terbawa saat deploy Dev; jangan menyalin ke folder Staging), tunggu review user, baru coding React. Pakai **semantic CSS tokens** dari `app/theme.css`, tanpa warna hardcoded.
- Semua prompt baru wajib berlaku juga untuk `target_language = en-US`.
- Jangan menulis API key atau secret di kode, test, atau dokumen (SOP Zero Secret Exposure).
- Jangan mengubah pengaturan model Gemini, API key, atau tier tenant tanpa persetujuan user.

## Lingkungan Uji: Mac Mini Dev (bukan Staging)

Pengecualian SOP untuk pekerjaan ini (atas instruksi user): **tidak ada deploy ke Staging** dan **rilis ke `main` ditunda** sampai hasil Dev disetujui.

| Item | Nilai |
|---|---|
| Host | `ssh masbenu@100.95.245.55` (Mac Mini) |
| UI / API | `http://100.95.245.55:5020` / `http://100.95.245.55:7020` |
| Folder aktif | `~/maknaflow-dev-atomic/current` (fallback lama `~/maknaflow-dev`) |
| PM2 | `ecosystem.macmini.config.cjs --env dev` |
| Database | PostgreSQL pusat, **schema `dev`** (`PG_SEARCH_PATH=dev`), `PGPOOL_MAX=3` |
| SOT deploy | `sot/global/GIT_BASED_ATOMIC_DEPLOYMENT.md` |

**Alur Git & deploy per fase**
1. Kerjakan di branch fitur `feature/planner-metafor-kb` (dari `main` terbaru). Jangan commit langsung ke `main`.
2. Setelah test lokal & `npm run build` lolos: commit, lalu `git push origin feature/planner-metafor-kb`. Script deploy Dev mengambil semua branch dari remote, jadi SHA branch bisa dipakai.
3. Dry-run: `npm run deploy:dev:atomic -- --ref <full-git-sha>`
4. Apply: `npm run deploy:dev:atomic -- --ref <full-git-sha> --apply --confirm-dev`
5. Rollback bila gagal: `npm run deploy:dev:rollback -- --apply --confirm-dev` (tambahkan `--release <id>` bila perlu).
6. Verifikasi setelah deploy: symlink `current` + manifest menunjuk SHA yang benar, HTTP 200 UI/API, PM2 dev online, `pm_cwd` = path release, `PG_SEARCH_PATH=dev`, `PGPOOL_MAX=3`, file shared (`.env.local`, `data`, `logs`, `public/uploads`) tetap terhubung.
7. Selama build remote berjalan: **jangan polling SSH tiap 10–15 detik**; tunggu dalam sesi deploy yang sama dengan jeda 60–120 detik.
8. **Jangan** menjalankan `npm run release-non-interactive`, `deploy:staging*`, atau `deploy:macmini-prod`. Rilis versi, merge ke `main`, dan deploy Staging adalah langkah terpisah setelah user menyetujui hasil Dev.

**Data uji di schema `dev`**
- Schema `dev` punya data sendiri (±123 planner, 41 planner Garlibee, preset `default_tenant`), tetapi **tidak ada** planner `pln_7d6363e0` dan belum ada planner bergaya Metafora.
- Buat planner uji baru **langsung di Dev** lewat UI/API Dev (contoh: produk Garlibee, Metafora, Problem-First, 6 baris). Jangan menyalin data dari schema `staging`.
- Data `staging` boleh **dibaca saja** sebagai pembanding (mis. isi `pln_7d6363e0`). Dilarang menulis apa pun ke schema `staging` atau `public`.
- Flag (`planner_kb_profile`, `planner_creative_brief`, `kb_profile`) boleh dinyalakan **hanya di `dev.tenant_settings`** untuk keperluan uji. Catat setiap perubahan setting Dev di plan.
- Uji yang memanggil G-Labs/render video (Node 2) dan TTS memakai kuota nyata: **minta izin user** sebelum menjalankan, dan batasi jumlahnya.
- Pastikan tidak ada jadwal otomatis Dev (scheduler, autopilot, publishing) yang ikut memposting ke akun sosial nyata saat uji. Bila ada, laporkan ke user dan minta keputusan sebelum lanjut.

**Kapan pindah ke Staging**
- Hanya setelah user menyatakan hasil Dev lolos. Agent menyiapkan ringkasan: daftar fase yang lolos, hasil uji A/B, flag yang dipakai, dan risiko. User yang memberi perintah deploy Staging.

## Flag

| Flag | Tempat | Nilai | Default | Fase |
|---|---|---|---|---|
| `planner_kb_profile` | `tenant_settings` (override per planner di `metadata_json`) | `legacy` / `lite` | `legacy` | P3 |
| `planner_creative_brief` | `tenant_settings` (override per planner) | `off` / `on` | `off` | P4 |
| `kb_profile` | `tenant_settings` | `legacy` / `modular` | `legacy` | P7 |

- Flag kosong = default. Planner dan kampanye lama tidak berubah.
- Tampilkan kedua flag di Settings (setelah mockup disetujui) dan bisa dibaca via MCP.
- **Tanpa flag** (berlaku langsung karena memperbaiki bug yang membuang pilihan user): P1 dan P2. Keduanya hanya mengubah perilaku untuk planner/kampanye bergaya Metafora atau Investigasi, kecuali perbaikan dropdown preset.

---

## Fase P0: Audit & plan (baca saja)

1. Konfirmasi semua jalur ingest planner → OPC dan dari mana `visual_style` diambil:
   - `app/components/ImportPlannerModal.js` (±baris 144–162)
   - `app/components/campaign-forms/PillarConfigurationForm.js` (±249 preset menimpa, ±516 isi dari planner)
   - `lib/contentflow-studio-adapters.js` (±25)
   - `lib/autonomous-engine.js` (±641, ±872)
   - `lib/operator-content-worker.js` (±141)
2. Konfirmasi deteksi metafora storyboard di `lib/prompts.js` (`buildPillarSharedPromptContext`, ±1950: `campaignData.visual_style`, `rowPayloadDataEarly.visual_style`, `metaphor_kit_key`, VI `metaphor_driven`).
3. Daftar semua nilai `visual_style` yang ada di data (baca saja; schema `staging` sebagai acuan utama dan `dev` sebagai pembanding) (preset `operator_presets_json`, `content_planners`, `pillar_campaigns`). Temuan awal: `Cinematic`, `UGC`, `Macrophotography`, `metaphoric_faceless`, `investigative_faceless`, `Food Porn`, `photorealistic_culinary`, `Realistic`, `Explainer 2D Motion`, `Culinary Cinematic`.
4. Hitung ukuran KB per panggilan planner (Call 1, Call 2, regenerate) dalam karakter dan perkiraan token.
5. Laporkan di plan, lalu berhenti.

## Fase P1: Sinkron Visual Style planner → storyboard (U8, U9, U10)

**P1-1. Aturan prioritas saat ingest** (`lib/pillar-campaign-ingest.js`)
- Urutan prioritas `visual_style` kampanye:
  1. pilihan manual pengguna di form ingest (bila form mengirim tanda `visual_style_source = 'user'`);
  2. `planner.visual_style` bila nilainya `metaphoric_faceless` atau `investigative_faceless`;
  3. `globalSettings.visual_style` dari preset;
  4. default lama (`photorealistic_culinary` untuk resep, `Cinematic` untuk lainnya).
- Simpan `visual_style` efektif juga di **payload per baris** (`row_creative_payload`) untuk jalur produk/editorial dan resep, karena storyboard membaca `rowPayload.visual_style` lebih dulu.
- Catat sumber keputusan di payload: `visual_style_source: 'user' | 'planner' | 'preset' | 'default'`.
- Berlaku untuk semua jalur di P0-1 (semuanya lewat `ingestPlannerToPillarCampaign`, pastikan tidak ada jalur yang melewatinya).

**P1-2. Satu katalog Visual Style** (file baru, mis. `lib/visual-style-catalog.js`)
- Berisi daftar nilai, label tampilan (ID/EN), dan penanda `kind: 'approach' | 'look'` (persiapan P6).
- Dipakai oleh: `PlannerConfigurationForm.js`, `PillarConfigurationForm.js`, `app/settings/presets/page.js` (±989), dan validasi ingest.
- Dropdown preset harus bisa menampilkan dan menyimpan `metaphoric_faceless` & `investigative_faceless`.
- Bila nilai tersimpan tidak ada di katalog: tampilkan apa adanya (contoh: "Nilai lama: Food Porn") dan jangan menggantinya diam-diam menjadi "Cinematic".

**P1-3. Peringatan konflik di layar** (mockup dulu)
- Import Planner Modal dan form OPC: bila gaya planner ≠ gaya preset, tampilkan info, contoh: "Planner memakai Metafora, preset memakai Cinematic. Yang dipakai: Metafora."
- Form OPC: memilih preset **tidak boleh** menimpa gaya Metafora/Investigasi yang diisi dari planner. Pengguna tetap bisa mengganti manual (lalu `visual_style_source = 'user'`).

**Test P1:**
- Unit test fungsi resolusi prioritas (semua kombinasi planner × preset × pilihan manual).
- Planner metafora + preset Cinematic lewat Import Modal → kampanye dan payload baris `metaphoric_faceless`; prompt storyboard memuat `OBJECT_METAPHOR_STORYTELLING_KB`.
- Form OPC: urutan pilih planner → preset dan preset → planner, hasil sama.
- Planner Cinematic + preset Macrophotography → tetap Macrophotography (perilaku lama).
- Preset "Garlibee Pin Board" dibuka di menu Presets → tampil Investigasi.

## Fase P2: Perbaikan prompt Metafora di planner (U1, U2, U3, U5, U6, sebagian U4)

Lokasi: `lib/content-planner-engine.js` — arahan metafora Call 2 (±962–975), kontrak visual action (±1010–1017), regenerate per baris (±1509–1640), dan simpan hasil (±1160).

**P2-1. Arahan metafora (U1)**
- `visual_action` = adegan hook (klip 1) saja, **wajib** analogi fisik benda nyata (pipa berkerak, cairan mengental di selang, mesin berkarat tersendat, filter tersumbat, dll.).
- Dilarang di `visual_action` mode metafora: alat medis (tensi meter, dll.), wajah/ekspresi orang, bahan produk (madu, bawang), kemasan/nama produk.
- Izin "studio botani / madu / sendok kayu" dipindah menjadi catatan untuk klip solusi di storyboard, bukan untuk field ini.

**P2-2. Cabang metafora di kontrak visual action (U2)**
- Bila gaya = metafora, kalimat Problem-First ("ekspresi frustrasi, situasi dilema nyata sehari-hari…") diganti: "Klip 1 = analogi benda; masalah ditunjukkan lewat perilaku benda, bukan lewat manusia atau alat medis."

**P2-3. Contoh berpasangan + larangan menyalin (U3)**
- Ganti 3 contoh hook dengan pasangan Hook + Visual, contoh:
  - Hook: "Saat saluran sempit terhambat, seluruh aliran ikut terhenti perlahan!" → Visual: makro pipa kaca bening, kerak kuning menebal di dinding pipa, aliran cairan merah melambat lalu tersendat.
- Tambahkan aturan: "Contoh hanya pola. Dilarang menyalin kalimat contoh. Setiap baris wajib memakai benda analogi yang berbeda."
- Terapkan pola yang sama untuk gaya Investigasi (contoh hook saat ini juga berupa kalimat jadi).

**P2-4. Muat KB metafora di planner (sebagian U4)**
- Bila gaya = metafora, tambahkan `OBJECT_METAPHOR_STORYTELLING_KB.md` ke KB Call 2 dan regenerate. Bila investigasi, tambahkan `INVESTIGATION_NARRATIVE_KB.md`.
- Pindahkan blok arahan gaya ke **bagian akhir** system instruction (dekat format output), bukan di awal.
- Pengurangan KB realis dikerjakan di P3 (di balik flag), bukan di sini.

**P2-5. Pemeriksa pasca-AI + 1× regenerate (U5)**
- Modul fungsi murni baru (mis. `lib/planner-style-validator.js`) + test. Untuk gaya metafora, satu baris gagal bila:
  - `visual_action` memuat nama produk, kata kemasan (jar, toples, botol, kemasan) atau bahan produk dari data planner;
  - `visual_action` memuat alat medis/wajah (tensi, dokter, wajah, ekspresi, stetoskop, dll.; versi ID + EN);
  - `hook` sama persis (setelah normalisasi) dengan contoh di prompt;
  - dua baris atau lebih memakai benda analogi utama yang sama (heuristik sederhana, cukup `warning`).
- Baris gagal: regenerate 1× **hanya field `visual_action`** dengan daftar pelanggaran spesifik di prompt (pakai fungsi regenerate per-field yang sudah ada).
- Masih gagal: `validation_status = 'warning'` dan simpan alasan di `generation_metadata`. Tampilkan badge peringatan di tabel planner (mockup dulu).
- Mode Problem-First (semua gaya): kemasan produk di klip 1 juga dicek (baris 4–6 `pln_7d6363e0` melanggar).

**P2-6. Regenerate per baris (U6)**
- Semua aturan P2-1 s.d. P2-5 juga berlaku di jalur regenerate per baris/per field.

**Test P2:**
- Snapshot test prompt: gaya Cinematic/UGC/Macrophotography **identik** dengan sebelum perubahan.
- Unit test validator dengan 6 baris nyata `pln_7d6363e0` (harus terdeteksi gagal) dan contoh visual metafora yang benar (harus lolos).
- Uji di **Dev**: buat planner baru di Dev dengan produk & pengaturan sama seperti `pln_7d6363e0` (Garlibee, Metafora, Problem-First, 6 baris). Lulus bila 6/6 visual action berupa analogi benda, 0 produk/bahan/alat medis, tidak ada hook yang menyalin contoh, benda analogi berbeda tiap baris.
- **Jangan regenerate** `pln_7d6363e0` yang lama tanpa izin user. Buat planner baru untuk uji.

## Fase P3: KB ringan planner + penyesuaian Gemini API (bagian 8) — flag `planner_kb_profile`

**P3-0. Verifikasi panduan Gemini API**
- Sebelum menulis kode, cek dokumentasi resmi Gemini API (ai.google.dev) untuk model yang dipakai planner: `systemInstruction`, structured output (`responseSchema`), rekomendasi temperature, dan panduan prompting. Catat ringkasannya di plan beserta tautannya.

**P3-1. KB planner baru (±10–15 KB)**
- Buat file KB baru di `kb/` (mis. `PLANNER_CREATIVE_KB.md`) dengan basis draf `docs/kb-lite-draft/*_LITE.md`, berisi:
  - aturan hook & aksi visual;
  - satu blok per gaya (Metafora, Investigasi, Cinematic, Produk);
  - ringkasan compliance (larangan klaim & testimoni; pakai daftar klaim terpusat yang sudah ada, jangan menduplikasi);
  - brand voice.
- Saat `lite`: Call 2 dan regenerate memuat KB baru + KB gaya terpilih (P2-4) + KB domain. **Tidak** memuat PROMPT_SYSTEM, REALIST, VISUAL_STYLE, dan PLATFORM_COPYWRITING versi penuh.
- Call 1 (Skeleton) tidak diubah di fase ini kecuali hasil P0 menunjukkan perlu.

**P3-2. Penyesuaian cara memanggil Gemini (hanya saat `lite`)**
- `callGeminiJson` di `lib/content-planner-engine.js` (±235) saat ini menggabungkan aturan dan data ke satu pesan user. Untuk `lite`: kirim aturan lewat `systemInstruction` dan data lewat pesan user.
- Kunci format output dengan `responseSchema` (field: sequence, hook, visual_action, dan field lain yang sudah ada).
- Instruksi pendek dan lugas. Kurangi huruf kapital, "WAJIB", "ZERO TOLERANCE" yang berulang.
- Urutan: referensi di depan; tugas dan aturan gaya di akhir.
- Temperature mengikuti hasil P3-0.
- `legacy` harus tetap persis seperti sekarang (snapshot test).

**P3-3. Uji perbandingan A/B**
- Harness baca-saja: input planner yang sama (minimal 3 kasus: Metafora Garlibee, Investigasi Garlibee, Cinematic brand lain, plus 1 kasus `en-US`) dijalankan `legacy` vs `lite`.
- Laporkan tabel: ukuran prompt, token, waktu, hasil validator P2-5, dan contoh hook/visual per baris.
- **Tulis output di luar folder release** (path absolut).
- User yang memutuskan kapan `lite` dinyalakan per tenant. Agent tidak menyalakan flag.

## Fase P4: Brief kreatif terkunci planner → OPC (bagian 7) — flag `planner_creative_brief`

- Storyboard, VO, dan aksi visual lengkap **tetap disusun di OPC** (Single-Pass Engine). Jangan memindahkan pembuatan storyboard ke planner.
- Saat `on`, planner tahap 2 mengisi brief per baris di `content_contract_json` (kolom sudah ada):
  - `hook`, `opening_visual`, `metaphor_object` (bila gaya Metafora);
  - `beats`: masalah → kenapa penting → solusi (masing-masing 1 kalimat);
  - `product_reveal_clip` (klip kemunculan produk);
  - `creative_approach` / `visual_style`.
- Ingest meneruskan brief ke `row_creative_payload`.
- Prompt storyboard (`lib/prompts.js`) membaca brief sebagai **input terkunci**: hook dan objek metafora klip 1 tidak boleh diganti, alur mengikuti `beats`, produk muncul di `product_reveal_clip` (selaras dengan aturan bridging yang sudah ada; bila bertentangan, laporkan, jangan menebak).
- Test: snapshot prompt storyboard dengan flag `off` identik; dengan `on`, hook klip 1 storyboard = hook planner dan objek metafora klip 1 sama.

## Fase P5: Hapus Instant Factory & Sheets Autopilot (bagian 10)

Data staging & production: `instant_campaigns` = 0 baris; `sheets_autopilot_scheduler_active` tidak aktif. Konfirmasi ulang di P0 (termasuk schema `dev`) sebelum menghapus. Penghapusan kode diuji di Dev dulu; karena kode ini nanti ikut ke Staging, laporkan juga apakah Staging punya pemakaian aktif.

**P5-1. Pindahkan dulu helper Google Sheets** (wajib sebelum menghapus apa pun)
- Pindahkan `updateCell`, `ensureTabAndAppendRows`, `getColumnLetter`, `resolveProductImagePath`, `resolveProductReferenceImage` dari `lib/sheets-autopilot-worker.js` ke file baru (mis. `lib/google-sheets-helpers.js`).
- Arahkan semua import: `lib/scheduler-processors.js` (RE Analyzer, RE FFmpeg, Pillar Generator, Pillar FFmpeg ×2, Recipe Exporter), `scripts/test-product-pipeline.js`, dan pemakai lain yang ditemukan.
- Rilis terpisah. Verifikasi OPC/Pillar, RE, dan Recipe Exporter masih bisa menulis ke Google Sheet sebelum lanjut.

**P5-2. Hapus Sheets Autopilot**
- `app/sheets-autopilot/**`, `app/api/sheets-autopilot/**`, `runSyncWorker` dan sisa `lib/sheets-autopilot-worker.js`, tick scheduler Sheets di `lib/campaign-scheduler.js` (±1110–1130, import ±28), entri `SHEETS_AUTOPILOT` di `lib/gemini.js`, izin di `lib/schema/user-schema.js`, menu/link navigasi bila ada.

**P5-3. Hapus Instant Factory**
- `app/instant-factory/**`, `app/api/v2/instant-factory/**`.
- Bersihkan titik terkait: tick Instant di `lib/campaign-scheduler.js` (±920–1000, ±1294, ±1332), fungsi `processInstant*` di `lib/scheduler-processors.js`, fungsi DB instant di `lib/db.js`, Affiliate Studio (`affiliate-studio-launch-adapter.js`, `-production-adapter.js`, `-recommendation-adapter.js`, `-contract.js`: hapus engine `instant`, rekomendasi BOFU dialihkan ke engine lain — usulkan engine pengganti di plan, user memutuskan), tab Instant di Video Studio (`app/video-studio/page.js`, `app/api/video-studio/campaign-videos/route.js`, `render/route.js`), TTS Studio (`app/api/tts-studio/campaign-data/route.js`), `lib/naming-helper.js`, `lib/drive-sync-helper.js`, `lib/nextcloud-sync-helper.js`, entri `INSTANT_FACTORY` di `lib/gemini.js`, log `instant_factory_logs` (`lib/scheduler.js`, `app/api/scheduler/control/route.js`, `app/api/system-logs/route.js`, `lib/console-hook.js`), izin di `lib/schema/user-schema.js`, skrip `scripts/find-campaign.js`, `scripts/update-schema-phase2.js`, `scripts/local-staging/setup.js`.
- **Jangan sentuh** `app/auto-pipeline/page.js`: variabel `instant*` di sana hanya nama form, bukan Instant Factory.
- Jangan hapus tabel database.
- Test: `npm run build` lolos, tidak ada import yang menunjuk file terhapus, halaman Affiliate Studio, Video Studio, TTS Studio, Auto Pipeline terbuka normal, scheduler berjalan tanpa error di log Dev.

## Fase P6: Pisahkan `creative_approach` dan `visual_look` (U7)

Kerjakan setelah P1 stabil. **Mockup dulu** untuk semua form yang berubah.
- `creative_approach`: `standard` / `metaphoric_faceless` / `investigative_faceless`. Dipegang **planner**.
- `visual_look`: Cinematic / UGC / Macrophotography / Food Porn / photorealistic_culinary / dll. Dipegang **preset**.
- Kolom baru di `content_planners`, `pillar_campaigns`, dan payload baris; kolom `visual_style` lama tetap ada dan tetap diisi (kompatibilitas) sampai semua pembaca pindah.
- Pemetaan nilai lama: `metaphoric_faceless`/`investigative_faceless` → `creative_approach`; sisanya → `visual_look` dengan `creative_approach = standard`.
- Migrasi skema mengikuti aturan database (`DISABLE_AUTO_MIGRATIONS`, schema per environment). Tulis skrip migrasi, dry-run lalu jalankan di schema `dev` saja (dengan persetujuan user). Dilarang menjalankannya di `staging`/`public`.
- Semua pembaca (`lib/prompts.js`, `lib/content-planner-engine.js`, ingest, start-frame QC, metaphor policy, visual identity allocator, MCP preset tools) dipindah ke field baru, dengan fallback ke `visual_style`.
- Test: kombinasi Metafora + Macrophotography menghasilkan storyboard metafora dengan tampilan makro.

## Fase P7: KB modular untuk kampanye lain (bagian 9 & BAGIAN 4) — flag `kb_profile`

Draf modul sudah tersedia di `docs/kb-lite-draft/` (lihat `README.md` dan `PROMPT_SYSTEM_INVENTORY.md`). Agent **tidak menulis ulang isinya dari nol**; agent memverifikasi, memindahkan, menyambungkan, dan menguji.

**P7-0. Verifikasi inventaris (baca saja)**
- Cocokkan `PROMPT_SYSTEM_INVENTORY.md` dengan kode `main` terbaru: daftar nomor mandate yang dirujuk, proses yang memuat PROMPT_SYSTEM, dan konflik di bagian B.
- Audit prompt Deconstruct (`buildReverseEngineeringPrompt`, `buildReverseEngineeringBridgePrompt`) dan Multiplier (`lib/multiplier-angle-generator.js` membaca file REALIST langsung). Catat bila ada aturan yang dibutuhkan tapi belum ada di modul lite; usulkan tambahannya di plan, jangan menambah diam-diam.
- Cek asal `MAKNA_Config_v54.9` (tidak ada di folder `kb/`).
- Laporkan, lalu berhenti untuk persetujuan.

**P7-1. Pindahkan modul ke `kb/`** (nama file tanpa akhiran `_LITE` atau dengan versi, sesuai konvensi `kb-loader`): `VIDEO_PROMPT_CORE`, `VOICE_AUDIO`, `METAPHOR_PHYSICS_LIBRARY`, `MANDATE_GLOSSARY`. File lama (`PROMPT_SYSTEM_v47.9.md`, `REALIST_VIRAL_NARRATIVE_v47.9.md`, `VISUAL_STYLE_GUIDE_v47.9.md`) **tetap ada** selama flag masih bisa `legacy`.

**P7-2. Flag `kb_profile`** (`tenant_settings`, default `legacy`): saat `modular`, setiap proses memuat modul sesuai tabel bagian D di `PROMPT_SYSTEM_INVENTORY.md`:
- RE campaign / Deconstruct / Bridge: VIDEO_PROMPT_CORE + VOICE_AUDIO + MANDATE_GLOSSARY (+ METAPHOR_PHYSICS_LIBRARY bila gaya Metafora).
- Storyboard OPC micro-KB: tetap, ditambah MANDATE_GLOSSARY.
- Multiplier: VOICE_AUDIO (persona router), menggantikan pembacaan file REALIST langsung.
- Pillar lama (cabang else) dan Production/pipeline v54: VIDEO_PROMPT_CORE + VOICE_AUDIO + MANDATE_GLOSSARY. Laporkan bila jalur ini sudah tidak dipakai; usulkan pensiun, user memutuskan.
- Cache master Gemini (`lib/kb-stitcher.js`): isi diganti modul inti (VIDEO_PROMPT_CORE + VOICE_AUDIO + MANDATE_GLOSSARY + compliance ringkas). Pastikan cache lama dibuat ulang saat profil berubah.
- Planner tidak memakai VIDEO_PROMPT_CORE (sudah ditangani P3).

**P7-3. Uji perbandingan**
- Jalankan `legacy` vs `modular` pada kasus nyata per jalur: 2 RE campaign, 2 Bridge Inject, 1 Deconstruct, 2 Multiplier, 1 storyboard metafora, 1 cartoon/3D, 1 `en-US`.
- Bandingkan: ukuran prompt/token, keberhasilan parsing JSON, kelengkapan layer prompt video (LAYER 0–3, micro-pacing, audio segment), kepatuhan presence/faceless, dan hasil validator yang sudah ada.
- RE campaign dan Bridge paling sensitif (prompt videonya langsung dikirim ke G-Labs): uji sampai render video untuk minimal 1 kasus masing-masing di **Dev**, dengan izin user (memakai kuota G-Labs nyata).
- Tulis output di luar folder release. User yang memutuskan kapan `modular` dinyalakan per tenant.

**P7-4. Pembersihan konflik di kode** (setelah `modular` disetujui)
- Hapus label/aturan yang bertentangan atau sudah dibatalkan (Mandate 2 di jalur metafora, rujukan "OVERRIDE MANDATE 74 & 79" bila blok lamanya tidak lagi dimuat).
- File KB lama baru boleh dihapus dari pemuatan setelah semua tenant memakai `modular` dan user menyetujui.

## Data yang hanya dilaporkan (U11, jangan diubah)

- Preset "Dapurbotani Garlibee MetaforF1F2 - Reveal 2x" tersimpan dengan `visual_style = Cinematic` walau namanya Metafor.
- Kampanye `opc_261108_hllhah` (dari `pln_5873d99a`, planner Metafora) tersimpan Cinematic.
- `pln_7d6363e0` belum di-ingest; ingatkan user bahwa sebelum P1 dirilis, ingest lewat Import Modal akan menjadi Cinematic.

## Verifikasi per fase

- Unit test untuk semua fungsi baru; snapshot test prompt untuk memastikan gaya/flag yang tidak disentuh **identik** dengan sebelumnya.
- `npm run build` lolos.
- Deploy ke **Dev saja** sesuai bagian Lingkungan Uji, lalu cek: HTTP 200 UI/API, PM2 online, `pm_cwd`, `PG_SEARCH_PATH=dev`, `PGPOOL_MAX=3`.
- Untuk UI: sediakan link mockup dan halaman di Dev (`http://100.95.245.55:5020`) untuk diuji user secara manual.
- Laporkan per fase: apa yang berubah, hasil test, dan apa yang belum diverifikasi.

## Ringkasan tracker

| Fase | Isi | Flag | Mockup UI |
|---|---|---|---|
| P0 | Audit & plan | – | – |
| P1 | Prioritas `visual_style` saat ingest, katalog gaya, peringatan konflik | tanpa flag | ya (dropdown preset, peringatan) |
| P2 | Prompt metafora planner + validator + regenerate | tanpa flag (hanya gaya Metafora/Investigasi) | ya (badge peringatan) |
| P3 | KB ringan planner + `systemInstruction`/`responseSchema` + uji A/B | `planner_kb_profile` | ya (toggle Settings) |
| P4 | Brief kreatif terkunci planner → OPC | `planner_creative_brief` | ya (toggle Settings) |
| P5 | Pindah helper Sheets, hapus Sheets Autopilot & Instant Factory | – | – |
| P6 | Pisah `creative_approach` vs `visual_look` | – | ya |
| P7 | KB modular dari draf `docs/kb-lite-draft/` (cache, RE/Deconstruct/Bridge, multiplier, pillar lama) + uji A/B | `kb_profile` | – |

Urutan wajib: P0 → P1 → P2 → P3 → P4. P5 boleh dikerjakan setelah P0 disetujui, terpisah dari P1–P4. P6 setelah P1 stabil. P7 setelah P3.
Aturan lain tetap berlaku: satu fase per commit + deploy **Dev saja**, tidak ada deploy Staging/Production dan tidak ada rilis ke `main` sampai user menyetujui hasil Dev, item `Completed` tidak diproses ulang, data Staging/Production tidak disentuh, flag di luar schema `dev` adalah keputusan user.
