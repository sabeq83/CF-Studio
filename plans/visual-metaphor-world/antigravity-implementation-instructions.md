# Instruksi Agent AI Antigravity — Metaphor World Kit + Metaphor Policy (F1 + F2, Satu Rilis)

## Mandat

Kerjakan **Tahap A sampai E** dari rencana gabungan berikut sampai Definition of Done terbukti:

- `plans/visual-metaphor-world/execution_order_F1_F2.md` (urutan & checklist gabungan, **sumber urutan kerja**)
- `plans/visual-metaphor-world/implementation_plan_F1.md` (Metaphor World Kit library + rotasi anti-repeat)
- `plans/visual-metaphor-world/implementation_plan_F2.md` (latar ikut metafora, tangan syar'i aktif, produk di dalam metafora, lighting arc, konflik 3D)
- Latar belakang masalah: `plans/visual-metaphor-world/USULAN_VISUAL_METAFORA_HERBAL.md`

Target bisnis: video metaforik faceless untuk brand herbal (DapurBotani, SiasatSehat) **tidak lagi monoton**. Setiap video memakai dunia metafora yang berbeda (karpet, wastafel, wajan, gelas minyak, dan seterusnya), latar mengikuti metafora tersebut, tangan syar'i boleh berakting, produk masuk ke dalam dunia metafora sebagai agen perubahan, dan lighting bergerak dari kotor ke bersih.

**Tahap F (rilis, migrasi staging, deploy staging, uji batch) TIDAK BOLEH dijalankan** sebelum pengguna memberi izin eksplisit terpisah setelah Tahap E lulus. Production dilarang total.

## Keputusan yang Sudah Ditetapkan Pengguna

| # | Keputusan | Nilai |
|---|---|---|
| 1 | Urutan rilis | **F1 + F2 digabung dalam satu rilis** |
| 2 | Penyimpanan kit | File JS di Git (`lib/metaphor-world-kits.js`); DB hanya tabel usage |
| 3 | Window rotasi | 6 video terakhir per brand |
| 4 | Klip 1 saat tangan aktif | Tetap **object-only** (hook benda murni) |
| 5 | Lokasi switch policy | Field Visual Identity saja (tanpa override per campaign) |
| 6 | Badge UI | Ikut (E3), hanya teks, memakai token CSS yang sudah ada |

Bila menemukan alasan kuat untuk menyimpang, **berhenti dan tanyakan pengguna**. Jangan memutuskan sendiri.

## Bacaan Wajib Sebelum Mengubah File

1. `AGENTS.md` secara penuh (SOP rilis, deployment atomic, semantic CSS token, zero secret exposure, mockup HTML, execution task list).
2. Ketiga file plan di atas secara penuh, termasuk before/after snippets dan tabel risiko.
3. `git status` dan `git log -5`. Jangan menimpa perubahan pengguna atau agent lain. Catatan: plan ditulis di atas `main @ 5b42ad7` (v2.45.0). Bila ada commit baru yang menyentuh file target, sesuaikan nomor baris dan snippet.
4. Inspeksi kode aktual minimal:
   - `lib/health-metaphors.js`
   - `lib/visual-identity-contract.js`, `lib/visual-identity-ai-contract.js`, `lib/visual-identity-allocator.js`
   - `lib/prompts.js` (cari: `tupleMetaphorNotice`, `HEALTH METAPHOR DIRECTIVE`, `OBJECT-CENTRIC METAPHOR MANDATE`, `KONSISTENSI LATAR/LOKASI`, `buildVisualIdentityPromptSection(`, `has3dSimulation`)
   - `lib/scheduler-processors.js` (`applyPromptReplacements` sekitar `:110–190`, `processPillarGenerator` sekitar `:5116`, blok `resolveHealthMetaphor` sekitar `:5356`, `parsed.resolved_health_metaphor` sekitar `:6035`)
   - `lib/opc-start-frame-request.js` (gateway sanitizer sekitar `:110–135`)
   - `lib/db-pg.js` (pola migrasi `migrateVisualIdentityFoundation` + advisory lock)
   - `lib/db.js` `getSetting` (`:610`), yang **fallback ke default_tenant secara default**
   - `app/pillar-campaigns/[id]/page.js` (badge metafora sekitar `:2395`)
5. Sebelum mengubah React/Next.js, baca dokumentasi relevan di `node_modules/next/dist/docs/`.
6. Anggap snippet di plan sebagai **arah desain, bukan patch literal**. Cocokkan dengan source aktual.

Jika source berbeda material dari plan, **update plan terlebih dahulu** (tambahkan Code Sebelum/Sesudah untuk file atau baris baru) sebelum mengedit file tersebut.

## Batas Scope dan Keselamatan

- **Default = perilaku lama.** Saat flag `metaphor_kit_engine` off dan field policy VI bernilai default, prompt yang dihasilkan harus **identik byte-per-byte** dengan sebelumnya. Snapshot `tests/fixtures/bridge-prompt-stage1.snapshot.json` **tidak boleh diubah** untuk meloloskan tes.
- Helper teks (`presenceTruthTuple`, `metaphorMandateHeader`, dan lainnya) harus mengembalikan string lama secara **persis** pada mode default.
- **Larangan produk pre-bridge tidak boleh dilonggarkan.** Bridge plan, start-frame requirement, dan penggantian `jar|bottle → glass conduit` di `opc-start-frame-request.js` tidak diubah.
- Mode **investigative_faceless**: aturan zero-hands tetap. Policy tidak aktif di mode ini.
- Path Reverse Engineering (`prompts.js` sekitar `:1164`, `:1423`), Multiplier, dan Strategic Campaign: **tidak disentuh**. Single-pass engine tetap.
- `getSetting('metaphor_kit_engine', false)`: **wajib** `allowDefaultFallback=false` supaya flag tidak bocor antar-tenant.
- Resolver kit **tidak boleh** menggagalkan generate. Error DB → fallback tanpa rotasi + `console.warn`. Kit tidak ditemukan → fallback `resolveHealthMetaphor` lama.
- Jangan mengubah VI tenant yang ada (`dapurbotani_apothecary_3d_*`, `siasatsehat_clinical_biohack_3d`) maupun system preset yang ada. Uji memakai VI test baru (Tahap F, atas izin).
- Kepatuhan klaim kesehatan: `vo_bridge` setiap kit memakai bahasa aman ("bayangkan…seperti…", "membantu menjaga…"). **Dilarang** klaim menyembuhkan, membakar lemak tubuh, membuang racun dari organ, dan sejenisnya. `pencegahan_kanker` dan `kandungan_wanita` **tidak diberi kit**.
- Jangan menulis credential, API key, atau connection string ke source, tes, log, atau dokumen. Tes DB memakai mock/injeksi dependency, bukan koneksi nyata.
- Jangan polling SSH berulang. Jangan deploy. Jangan sentuh schema `public`.

## Seed Kit — Sumber Konten

28 kit, sesuai tabel di `implementation_plan_F1.md` §3.2. Sumber 20 kit pertama adalah kampanye Bundayes (Google Docs pengguna). Ringkasan pola yang harus dipertahankan ada di `USULAN_VISUAL_METAFORA_HERBAL.md` §1. Aturan penulisan kit:

- **Bahasa prompt Inggris**, `label`/`vo_bridge`/`compliance_note` Bahasa Indonesia.
- Benda **rumah tangga Indonesia yang relatable**, latar **terang** (dapur keramik putih, wastafel, meja makan, kamar), **bukan** estetika dark-luxury (slate hitam, walnut, obsidian, kuningan antik).
- `beats.problem/threat/struggle/failure`: **object-only** (fisika mandiri). Lint di tes: tanpa kata `hand|finger|arm|bottle|capsule|product|jar|brand`.
- `beats.reaction` (zona produk) boleh menyebut isi produk netral (mis. "fine bone-white herbal powder"), **tanpa nama merek**.
- `hand_variant.struggle` (dan beat lain bila relevan): tangan berlengan panjang menutup pergelangan.
- `lighting_arc.from` kotor/kontras/gelap → `lighting_arc.to` high-key/pagi/bersih.
- `sfx_palette` 4–6 item ASMR konkret.
- Jangan menyalin nama merek "Bundayes" ke kit. Kolom `source` cukup berisi slug konsep (mis. `bundayes_grease_trap`) sebagai jejak.

## Definition of Done (Tahap A–E)

1. Semua checkbox Tahap A–E di `execution_order_F1_F2.md` dicentang **real-time** (`- [ ]` → `- [x]`) setiap kali satu tugas selesai, sesuai SOP Execution Task List. Checkbox yang setara di F1/F2 plan ikut dicentang.
2. Tes baru lulus:
   - `tests/health-metaphors-detect-topics.test.js`
   - `tests/metaphor-world-kits.test.js`
   - `tests/metaphor-kit-resolver.test.js`
   - `tests/metaphor-policy.test.js`
   - `tests/metaphor-policy-prompt.test.js`
3. Regresi lulus **tanpa mengubah tes atau snapshot lama**:
   - `tests/apply-replacements-clip-index.test.js`
   - `tests/dynamic-bridge-isolation.test.js` (+ snapshot `bridge-prompt-stage1`)
   - `tests/test-visual-identity-allocator.mjs`
   - `tests/garlibee-metaphor-visual-identities.test.js`
   - `tests/multiplier-dual-realm-visual-identity.test.js`
   - `tests/opc-planner-strategic-context.test.js`
   - Tes Visual Identity lain yang relevan (`rg -l "visual-identity" tests`)
4. `npm run build` lulus.
5. `plans/visual-metaphor-world/f2-prompt-diff.md` berisi diff prompt 1 baris DapurBotani (kolesterol/pencernaan) untuk: (a) flag off + VI default, (b) flag on + VI default, (c) flag on + VI dengan keempat switch aktif. Dibuat lewat script lokal tanpa memanggil Gemini, tanpa DB nyata (mock), dan tanpa credential.
6. Badge UI (E3) memakai token `var(--...)` yang sudah ada, tanpa warna hardcode. Karena perubahannya hanya teks, mockup HTML **tidak wajib**. Bila badge berubah lebih dari sekadar teks, buat mockup `public/mockup_metaphor_badge.html` dan **tunggu persetujuan pengguna** sebelum mengubah React.
7. Laporan akhir ke pengguna berisi: daftar file baru/diubah, hasil tes (output ringkas), ringkasan diff prompt, risiko yang tersisa, dan permintaan izin untuk Tahap F.
8. **Tidak ada** commit, tag, push, release, atau deploy sebelum pengguna mengizinkan Tahap F. Perubahan dibiarkan di working tree, atau di branch fitur lokal bila pengguna memintanya.

## Tahap F (Hanya Setelah Izin Eksplisit)

Ikuti `execution_order_F1_F2.md` Tahap F dan SOP `AGENTS.md`:
- `npm run release-non-interactive -- --type minor --title "Metaphor World Kit + Metaphor Policy (F1+F2)" --points "..."`
- Migrasi `metaphor_kit_usage` di schema `staging` lewat `scripts/migrate-metaphor-kit-usage.mjs` (idempotent). Build memakai `DISABLE_AUTO_MIGRATIONS=true`.
- Deploy staging atomic dengan full Git SHA. Verifikasi `current`, manifest, HTTP 200, PM2 `pm_cwd`, `PG_SEARCH_PATH`, `PGPOOL_MAX`.
- `metaphor_kit_engine=on` **hanya** di `default_tenant`. Buat VI test `dapurbotani_metaphor_world_test` (duplikat VI DapurBotani + empat switch aktif).
- Batch 6–7 baris DapurBotani → contact sheet 3×3 + laporan: jumlah kit unik, sticky saat regenerate, tangan syar'i di klip 2+, tidak ada botol pre-bridge, latar per video, tanpa 3D CGI.

## Kapan Harus Berhenti dan Bertanya
- Snapshot lama berubah dan tidak bisa dibuat identik.
- `tempCampaign` ternyata tidak sampai ke `opc-start-frame-request.js` dan perlu perubahan signature yang lebar.
- Ada konflik dengan perubahan lain di working tree.
- Ada kebutuhan mengubah file di luar daftar §"Estimasi file tersentuh" pada `execution_order_F1_F2.md`.
- Ada keraguan soal klaim kesehatan di `vo_bridge`.
