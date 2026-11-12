# Implementation Plan — Multi-Segment Product Bridging (Multiplier + Pillar)

Status: usulan, belum dieksekusi. Disusun 2026-11-13 dari pembacaan kode, tanpa menjalankan pipeline.

## 1. Objective

Saat ini product bridging hanya mendukung satu rentang berurutan: mulai klip ke-N (`bridge_at_clip`) selama X klip (`bridge_duration_clips`). Pekerjaan ini menambah dukungan beberapa titik bridging dalam satu video, misalnya produk muncul di klip 2 dan muncul lagi di klip 6, untuk dua pipeline:

- **Multiplier Lab** (`lib/re-multiplier-worker.js`, `buildMultiplierPhase2Prompt`)
- **Pillar Campaign / OPC** (`processPillar*` di `lib/scheduler-processors.js`, `buildOrganicPillarPrompt`)

Target perilaku:

```text
bridge_segments = [
  { at_clip: 2, duration_clips: 1, role: "intro"  },
  { at_clip: 6, duration_clips: 1, role: "recall" }
]
        ↓ resolveBridgePlan()
klip:   1      2        3      4      5      6        7
zona:   pre    PRODUK   gap    gap    gap    PRODUK   post
        hook   pivot    kembali ke topik     recall   penutup/CTA
        ↓
naskah  : produk hanya disebut di klip 2 dan 6
visual  : foto referensi produk + T2I→I2V hanya di klip 2 dan 6
```

## 2. Decisions and Non-Goals

### 2.1 Kontrak data

- Field baru `bridge_segments`: array terurut `{ at_clip, duration_clips, role }`.
- `role`: `intro` (perkenalan produk, pivot halus) atau `recall` (pengingat/bukti/CTA, tanpa perkenalan ulang). Segmen pertama selalu `intro`; segmen berikutnya default `recall`.
- Field lama `bridge_at_clip` dan `bridge_duration_clips` **tetap ditulis**, diisi dari segmen pertama. Semua pembaca lama (RE Campaign, Instant Factory, Sheets Autopilot, Bridge Injector, Smart Sync) tetap berjalan tanpa perubahan.
- Jika `bridge_segments` kosong/tidak ada, resolver membentuk satu segmen dari field lama. Campaign dan preset lama tidak perlu dimigrasi.
- Maksimal 3 segmen per video.

### 2.2 Aturan validasi

1. `at_clip` bilangan bulat, `1 ≤ at_clip ≤ target_clips_count` (form tetap mewajibkan ≥ 2 untuk segmen pertama, sama seperti sekarang).
2. Segmen urut naik dan tidak tumpang tindih.
3. Antar dua segmen harus ada minimal 1 klip jeda. Segmen yang bersebelahan digabung otomatis menjadi satu.
4. `duration_clips = 0` ("sampai klip terakhir") hanya sah di segmen terakhir.
5. Segmen yang melewati `target_clips_count` dipotong; segmen yang seluruhnya di luar jangkauan dibuang dengan peringatan.

### 2.3 Arti durasi 0 diseragamkan

Kode sekarang tidak konsisten: di prompt, 0 berarti "sampai klip terakhir" (`lib/prompts.js:1363`), di worker RE berarti "hanya klip N" (`lib/scheduler-processors.js:1449`). Resolver baru menetapkan **0 = sampai klip terakhir**. Untuk Multiplier dan Pillar ini sudah perilaku yang berlaku (`re-multiplier-worker.js:783`, `scheduler-processors.js:5485`), jadi tidak ada perubahan perilaku di cakupan ini. Jalur RE tidak disentuh.

### 2.4 Non-Goals

- **Bridge Injector** (`lib/campaign-scheduler.js:1930`): struktur tetap 4 klip dengan satu klip sisipan. Tidak diubah.
- **RE Campaign, Instant Factory, Sheets Autopilot, Recipe Labs**: tetap satu rentang. Tahap lanjutan terpisah.
- **Smart Sync** (`lib/smart-sync-engine.js:40`): tetap menerima satu angka `bridgeAtClip`; diisi dari segmen pertama sebagai batas zona hook.
- Tidak menghapus kolom/field lama.
- Mode Pillar `investigative_faceless` punya struktur produk tetap di dua klip terakhir (`prompts.js:2102`) dan tidak membaca `bridge_at_clip`. Multi-segmen **dinonaktifkan** untuk mode ini (form menampilkan satu segmen saja).

## 3. Temuan Kode yang Mendasari Rencana

| # | Temuan | Lokasi | Dampak |
|---|---|---|---|
| 1 | Rumus rentang bridging ditulis ulang di 15+ tempat | lihat §5 | Perlu satu resolver pusat sebelum fitur ditambah |
| 2 | Multiplier menyimpan bridging sebagai JSON | `bridging_config_json`, `lib/db.js:3175` | Tidak perlu migrasi skema |
| 3 | Pillar menyimpan bridging sebagai kolom tabel | `lib/db.js:2248`, whitelist update `:2318` | Perlu kolom baru `bridge_segments` |
| 4 | Prompt Pillar menganggap klip produk = "klip N s/d klip terakhir" pada aturan tuple visual, mengabaikan durasi | `lib/prompts.js:2099`, `:2131`, `:2149`, `:2232`, `:2264-2282` | Bagian paling berat; harus ditulis ulang berbasis zona |
| 5 | Pillar menjalankan start-frame dalam tiga kelompok: sebelum bridge → bridge (terisolasi) → sesudah bridge | `lib/scheduler-processors.js:5841-5862` | Harus digeneralisasi menjadi kelompok berselang |
| 6 | Sebagian jalur hanya memperlakukan klip N persis sebagai klip bridge | `scheduler-processors.js:8536`, `re-multiplier-worker.js:1019`, `app/pillar-campaigns/[id]/page.js:1308,1386,2496,2527`, `app/api/v2/multiplier/[id]/replace-start-frame/route.js:70` | Perlu diganti `isProductClip(c)` / `isSegmentStart(c)` sesuai maksud aslinya |
| 7 | `applyPromptReplacements` memaksa klip sebelum N jadi "tanpa produk, tanpa tangan" untuk mode metaphoric faceless | `lib/scheduler-processors.js:151-158` | Klip jeda antar segmen juga harus kena aturan "tanpa produk" |
| 8 | Plan per klip sudah punya `product_visible` / `requires_product_reference` dan kontrak start-frame menghormatinya | `lib/opc-start-frame-contract.js:23` | Lapisan referensi produk sebagian sudah siap untuk klip tak berurutan |
| 9 | Skema MCP mewajibkan `bridge_duration_clips ≥ 1` | `apps/mcp/tools.mjs:784,814` | Tidak konsisten dengan UI (boleh 0); dirapikan sekalian |

## 4. Desain

### 4.1 Resolver pusat — `lib/bridging/bridge-plan.js` (baru)

Modul murni tanpa dependensi DB, bisa di-import dari server maupun komponen client.

```js
resolveBridgePlan({ targetClips, isBridgingActive, segments, bridgeAtClip, bridgeDurationClips })
→ {
    active,                 // boolean
    targetClips,
    segments,               // [{ index, role, start, end }] sudah dinormalisasi & di-clamp
    productClips,           // number[] urut
    isProductClip(c),       // c di dalam segmen mana pun
    isSegmentStart(c),      // c = klip pertama sebuah segmen
    segmentOf(c),           // segmen yang memuat c, atau null
    zoneOf(c),              // 'pre' | 'intro' | 'recall' | 'gap' | 'post'
    zones,                  // [{ zone, start, end, segmentIndex? }] berurutan, menutup 1..targetClips
    firstBridgeClip,        // untuk field lama & Smart Sync
    legacy: { bridge_at_clip, bridge_duration_clips },
    warnings                // string[] hasil normalisasi
  }

normalizeBridgeSegments(raw, targetClips)   // validasi + merge + clamp (§2.2)
readBridgeInputs(source)                    // menerima campaign row Pillar ATAU objek bridging Multiplier
                                            // (snake_case & camelCase), mengembalikan argumen resolveBridgePlan
describeBridgePlan(plan, lang)              // teks ringkas: "Klip 2, 6" untuk UI/log
```

`readBridgeInputs` menggantikan logika fallback yang sekarang tersebar di `resolveNormalizedBridging` (`re-multiplier-worker.js:42`), `multiplier-pairing.js:80-111`, dan `autonomous-engine.js:519-531`.

### 4.2 Prompt naskah — `lib/bridging/bridge-prompt-zones.js` (baru)

Satu pembangun teks zona yang dipakai kedua pipeline:

```js
buildBridgeZoningContract(plan, { productName, productUsp, mandatoryOutroLine, lang })
```

Menghasilkan kontrak zona dengan satu butir per zona, berurutan:

| Zona | Aturan naskah | Aturan visual |
|---|---|---|
| `pre` | Hook + masalah. Dilarang menyebut produk/merek. | Tanpa produk/kemasan. |
| `intro` | Pivot halus, produk diperkenalkan pertama kali sebagai jawaban konteks sebelumnya. | Produk tampil; wajib ikut Product Truth. |
| `gap` | Kembali ke topik utama (aturan "sandwich return" yang sudah ada di `prompts.js:2451`). Dilarang menyebut produk. Klip terakhir sebelum segmen berikut menyiapkan alasan logis kemunculan produk lagi. | Tanpa produk/kemasan. |
| `recall` | Produk muncul kembali sebagai bukti hasil / pengingat / ajakan. **Dilarang memperkenalkan ulang** ("kenalin…", mengulang USP yang sama). Maksimal satu sudut manfaat baru. | Produk tampil; Product Truth sama dengan `intro`. |
| `post` | Payoff + penutup + kalimat outro wajib bila ada. | Tanpa produk kecuali plan menandai `product_visible`. |

Jika plan hanya berisi satu segmen, keluaran teks harus **setara** dengan kontrak sekarang (dijaga dengan snapshot test, §7).

### 4.3 Bagian yang berubah per pipeline

**Multiplier**

- `buildMultiplierPhase2Prompt` (`lib/prompts.js:3006-3300`): ganti perhitungan `bridgeAtClip/productEndClip/preBridgeRange/postBridgeStart` (`:3024-3031`, `:3256-3258`) dengan `plan`; ganti blok kontrak zona (`:3290-3294`) dengan `buildBridgeZoningContract`; teks rentang produk (`:3168`, `:3212`, `:3219`) memakai daftar klip (`Klip 2 dan 6`), bukan "N hingga M".
- `buildProductTruthContractSection` (`lib/prompts.js:38`): terima daftar klip produk, tetap menerima tanda tangan lama.
- `buildDynamicStoryCurveGuideline` (`lib/kb/dynamic-story-curve.js:17`): terima `plan` opsional; butir "Titik Bridging Alami" menyebut semua segmen beserta perannya.
- `lib/re-multiplier-worker.js`: `resolveNormalizedBridging` mengembalikan `plan`; `:781` → `plan.isProductClip`; `:1019` → `plan.isSegmentStart` hanya untuk segmen pertama (start frame yang diunggah user tetap milik segmen `intro`); `:1315` → `plan.firstBridgeClip`; ringkasan `:1369` → `describeBridgePlan`.
- Route regen: `app/api/v2/multiplier/[id]/regenerate-t2i/route.js:42`, `regenerate-start-frames/route.js:97`, `replace-start-frame/route.js:69`.
- `lib/multiplier-pairing.js:80-111` dan `lib/autonomous-engine.js:519-531`: teruskan `bridge_segments` dari override/preset.

**Pillar**

- `buildOrganicPillarPrompt` (`lib/prompts.js:1799-2826`):
  - `:1868-1879` → bangun `plan`.
  - Aturan tuple visual (`:2080-2150`, `:2232`, `:2264-2282`): semua frasa "Klip N s/d klip terakhir" diganti berbasis zona. Zona `pre` dan `gap` memakai tuple "tanpa produk"; zona `intro` dan `recall` memakai tuple produk. Untuk `metaphoric_faceless`: `pre` tetap "pure isolated object, tanpa tangan"; `gap` **tanpa produk tetapi tangan/karakter boleh** (karakter sudah diperkenalkan di `intro`).
  - Zona naskah (`:2447-2500`): `bridgeRangeText`, `sandwichReturnText`, `conversionZoneText` diganti `buildBridgeZoningContract`.
  - Contoh JSON di prompt (`:2575-2642`) dan `sandwich_transition_plan` (`:2761`): contoh klip memakai `plan.productClips`.
  - Kurva cerita (`:2727-2733`): memakai `plan.zones`.
- `processPillarGenerator` (`lib/scheduler-processors.js:5051`):
  - `:5481-5486` → `product_visible` dari `plan.isProductClip`.
  - `:5841-5862` → ganti tiga kelompok tetap dengan iterasi `plan.zones`: zona non-produk dijalankan sebagai kelompok biasa, setiap klip di zona produk dijalankan terisolasi sampai terminal, lalu lanjut ke zona berikutnya. Urutan zona dipertahankan agar kontrak isolasi dari plan `opc-product-bridge-reference` tetap berlaku.
- `applyPromptReplacements` (`:151-158`): `isPreBridgeClip` → `zoneOf(c) === 'pre'`; tambah cabang `gap` yang hanya mengganti tuple Product Truth menjadi "no product shown" tanpa menghapus Anchor/Wardrobe.
- `lib/opc-start-frame-contract.js:18-21`: `bridge` → `plan.isProductClip`; `bridgeStart/bridgeEnd` tetap dikembalikan (diisi dari segmen yang memuat klip, atau segmen pertama) agar pemanggil lama tidak rusak.
- `processPillarGlabs` (`:6667`) dan `processPillarFfmpeg` (`:7340`): `plan.firstBridgeClip`.
- `app/api/v2/pillar-campaigns/items/[itemId]/replace-start-frame/route.js:82-85` → `plan.isProductClip`.
- `lib/pillar-campaign-ingest.js:244`, `app/api/v2/pillar-campaigns/route.js:73,143,195,281`, `bulk/route.js:59`: terima dan simpan `bridge_segments`.

### 4.4 Penyimpanan

- **Multiplier**: tambahkan kunci `bridge_segments` di dalam `bridging_config_json`. Tanpa migrasi.
- **Pillar**: kolom baru `bridge_segments TEXT NULL` (JSON) di tabel campaign Pillar. Tambahkan ke insert (`lib/db.js:2248-2259`), pemetaan default (`:2184-2188`), dan whitelist update (`:2318`). Migrasi dijalankan per schema (`dev` → `staging` → `public`).
  > Mekanisme penambahan kolom di repo ini belum saya verifikasi (tidak ditemukan `ALTER TABLE` untuk tabel ini lewat grep cepat). Langkah pertama Tahap 2 adalah memastikan pola migrasi yang berlaku sebelum menulis skripnya.
- **Preset** (`lib/operator-presets.js`, `app/settings/presets/page.js:40,130,230,1051`): `product_bridging.bridge_segments` opsional di samping field lama.

### 4.5 UI

Komponen bersama baru `app/components/campaign-forms/BridgeSegmentsEditor.js`:

- Daftar baris: **Klip ke-** (angka) · **Durasi** (1–4, atau "sampai akhir" hanya di baris terakhir) · **Peran** (baris pertama terkunci "Perkenalan", berikutnya "Pengingat").
- Tombol "+ Tambah titik bridging" (maks 3) dan hapus per baris.
- Strip pratinjau klip 1..N berwarna per zona, dihitung dengan `resolveBridgePlan` yang sama dengan server.
- Pesan validasi inline dari `normalizeBridgeSegments`.

Dipasang di:

- `app/components/campaign-forms/MultiplierConfigurationForm.js:2356-2378` (state `:111-112`, hydrate preset `:223-224`, payload `:301-302`, `:919`).
- `app/components/campaign-forms/PillarConfigurationForm.js:1390-1399` (state `:83-84`, hydrate `:262-263`, payload `:347-348`, `:607-608`) dan `app/pillar-campaigns/page.js:96-97,225-226,314-315,716`.
- `app/settings/presets/page.js:1051-1055`.

Tampilan detail:

- `app/multiplier-lab/[id]/page.js:1538,1573` → `plan.isProductClip`.
- `app/pillar-campaigns/[id]/page.js:1308,1386,2496,2527` → `plan.isProductClip`; ringkasan `:3628-3632` → `describeBridgePlan`.
- `app/components/ImportPlannerModal.js:509` → `describeBridgePlan`.

### 4.6 MCP

`apps/mcp/tools.mjs:783-784,813-814`: tambah `bridge_segments` opsional (array, maks 3) dan longgarkan `bridge_duration_clips` menjadi `min(0)`. `lib/custom-storyboard-pipeline.js:203-204,347,493` meneruskan `bridge_segments`.

## 5. Daftar Titik Rumus Rentang yang Diganti Resolver

Cakupan pekerjaan ini (Multiplier + Pillar + modul bersama):

- `lib/re-multiplier-worker.js:42-52, 781-783, 971, 1019, 1315`
- `lib/multiplier-pairing.js:80-111`
- `lib/autonomous-engine.js:519-531`
- `lib/prompts.js:38-57, 1868-1879, 2080-2282, 2447-2500, 3024-3031, 3256-3294`
- `lib/kb/dynamic-story-curve.js:20-68`
- `lib/scheduler-processors.js:151-152, 5481-5486, 5844-5862, 6667, 7340`
- `lib/opc-start-frame-contract.js:18-21`
- `app/api/v2/multiplier/[id]/{regenerate-t2i,regenerate-start-frames,replace-start-frame}/route.js`
- `app/api/v2/pillar-campaigns/items/[itemId]/replace-start-frame/route.js:82-85`
- `app/multiplier-lab/[id]/page.js:1538, 1573`
- `app/pillar-campaigns/[id]/page.js:1308, 1386, 2496, 2527`

Sengaja tidak disentuh (tetap membaca field lama): `lib/scheduler-processors.js:1210-1535, 2748-2831, 3074, 3602, 4150, 4634, 8501-8785`, `lib/sheets-autopilot-worker.js`, `lib/campaign-scheduler.js`, `lib/smart-sync-engine.js`, `lib/culinary-sequence-engine.js`, form RE/Recipe/Sheets/Instant.

## 6. Tahapan Eksekusi

### Tahap 1 — Fondasi tanpa perubahan perilaku

1. Buat `lib/bridging/bridge-plan.js` + unit test.
2. Buat `lib/bridging/bridge-prompt-zones.js`; pastikan keluaran satu-segmen setara dengan teks sekarang.
3. Rekam snapshot prompt **sebelum** refactor untuk kombinasi di §7.2.
4. Ganti semua titik di §5 agar memakai resolver, masih dengan satu segmen dari field lama.
5. Verifikasi: snapshot prompt identik (atau selisih yang sudah ditinjau), test yang ada tetap lulus.

Keluaran: tidak ada perubahan yang terlihat oleh pengguna. Bisa dirilis sendiri.

### Tahap 2 — Multi-segmen Multiplier

1. Terima `bridge_segments` di `bridging_config_json`, route pembuatan (`app/api/v2/multiplier/route.js`), pairing, autonomous engine.
2. Aktifkan zona `gap`/`recall` di `buildMultiplierPhase2Prompt` dan story curve.
3. Worker + route regen memakai `plan.isProductClip`.
4. `BridgeSegmentsEditor` di form Multiplier + tampilan detail.
5. Uji generate nyata (§7.3).

### Tahap 3 — Multi-segmen Pillar

1. Pastikan pola migrasi, tambah kolom `bridge_segments`, update `lib/db.js`.
2. Route pembuatan/bulk/ingest menerima `bridge_segments`.
3. Tulis ulang aturan tuple visual dan zona naskah `buildOrganicPillarPrompt` berbasis zona.
4. Generalisasi urutan start-frame di `processPillarGenerator` + `applyPromptReplacements` cabang `gap`.
5. `opc-start-frame-contract` + route replace-start-frame.
6. `BridgeSegmentsEditor` di form Pillar + halaman detail.
7. Uji generate nyata (§7.3).

### Tahap 4 — Preset, MCP, dokumentasi

1. Preset editor + seed preset.
2. Skema MCP + custom storyboard pipeline.
3. Perbarui `kb/MULTIPLIER_BRIDGING_GUIDE.md` dengan pola "intro + recall".
4. Rilis sesuai SOP di `AGENTS.md`.

Tahap 2 dan 3 saling lepas setelah Tahap 1 selesai, tetapi keduanya mengubah `lib/prompts.js`; kerjakan berurutan, bukan paralel.

## 7. Verifikasi

### 7.1 Unit test — `tests/bridge-plan.test.js`

- Field lama saja → satu segmen, hasil sama dengan rumus lama (N=2,X=1; N=3,X=2; N=2,X=0).
- `[2/1, 6/1]` pada 7 klip → zona `pre(1) intro(2) gap(3-5) recall(6) post(7)`.
- Segmen bersebelahan digabung; tumpang tindih ditolak; urutan terbalik diurutkan.
- Durasi 0 di segmen bukan-terakhir → error validasi.
- Segmen melewati `targetClips` dipotong; seluruhnya di luar → dibuang + warning.
- Bridging nonaktif → `productClips` kosong, semua klip zona `pre`.
- Input snake_case dan camelCase memberi plan yang sama.

### 7.2 Snapshot prompt (regresi Tahap 1)

`buildMultiplierPhase2Prompt` dan `buildOrganicPillarPrompt` untuk: 4 klip N=2 X=1; 6 klip N=3 X=2; 6 klip N=2 X=0; Pillar `metaphoric_faceless` 6 klip N=3 X=1; bridging nonaktif.

### 7.3 Uji generate nyata (di dev)

Untuk tiap pipeline, minimal 3 campaign dengan `[2/1, 6/1]` pada 7–8 klip, dan periksa:

- Naskah: produk tidak disebut di klip `pre` dan `gap`; klip `recall` tidak memperkenalkan ulang.
- Plan: `product_visible` true tepat di klip produk.
- Visual: foto referensi produk terkirim hanya untuk klip produk; kemasan konsisten antara `intro` dan `recall`.
- Pillar: urutan eksekusi start-frame mengikuti zona, klip produk tidak berjalan bersamaan dengan sibling.
- Video akhir: Smart Sync berjalan normal.

### 7.4 Test yang sudah ada dan wajib tetap lulus

`tests/dynamic-bridge-isolation.test.js`, `tests/multiplier-*.test.js`, `npm run test:opc:start-frame-reference`, `npm run test:opc:start-frame-reference-integration`, `npm run test:operator-presets`.

## 8. Risiko

| Risiko | Mitigasi |
|---|---|
| Naskah membocorkan produk di klip jeda atau terdengar seperti iklan dua kali | Peran `recall` eksplisit; larangan di zona `gap`; uji §7.3 sebelum lanjut ke pipeline berikutnya. Bila perlu, tambah pemeriksaan pasca-generate: nama produk muncul di klip non-produk → regenerate. |
| Refactor Tahap 1 mengubah teks prompt tanpa sengaja | Snapshot sebelum/sesudah; Tahap 1 dirilis terpisah. |
| Kemasan berbeda antara segmen `intro` dan `recall` | Kedua segmen memakai Product Truth dan named reference yang sama; diperiksa di §7.3. |
| Urutan start-frame Pillar berubah dan melanggar kontrak isolasi | Iterasi per zona mempertahankan "non-produk selesai → produk terisolasi → lanjut"; dijaga `dynamic-bridge-isolation.test.js` + kasus baru dua segmen. |
| Biaya/waktu naik karena lebih banyak klip lewat jalur T2I→I2V | Batas 3 segmen; pratinjau di form menunjukkan jumlah klip produk. |
| Campaign lama rusak | Fallback ke field lama bila `bridge_segments` kosong; field lama tetap ditulis. |

## 9. Keputusan yang Perlu Dikonfirmasi

1. **Peran segmen kedua**: default `recall` (pengingat/bukti/CTA). Alternatif: izinkan `intro` kedua untuk membahas sudut manfaat berbeda.
2. **Batas jumlah segmen**: usulan 3.
3. **Klip jeda pada Pillar metaphoric faceless**: usulan tangan/karakter boleh muncul, produk tidak. Alternatif: kembali ke "pure object" seperti zona `pre`.
4. **Start frame unggahan user di Multiplier** (`generatedStartFrameUrl`): usulan hanya dipakai untuk segmen `intro`; segmen `recall` selalu digenerate.
