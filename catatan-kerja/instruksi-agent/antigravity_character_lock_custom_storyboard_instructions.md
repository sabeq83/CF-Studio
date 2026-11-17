# Instruksi Antigravity — Character Lock untuk Custom Storyboard (jalur CFA)

> Tanggal: 17 November 2026 · Dicek terhadap `main` @ `1217eb6` (v2.50.1) · Prioritas: **tinggi** (syarat Week 2 PT GIM via CFA)
> Ditulis oleh: Claude (review kode). Status: **SELESAI — dikerjakan Claude di v2.50.2 (lihat `catatan-kerja/laporan/LAPORAN_CHARACTER_LOCK_CUSTOM_STORYBOARD.md`); Antigravity tidak perlu mengerjakan** · Revisi terakhir: 17 Nov 2026 (prasyarat data siap, VI v3 ikut tersambung, catatan deploy Staging)
> Rencana induk Claude: `implementation_plan.md` → "Temuan Tahap 3", opsi **C**
> **Sebelum mulai:** arsipkan `implementation_plan.md` milik Claude yang sedang aktif ke `catatan-kerja/rencana/week2_ptgim_cfa_implementation_plan.md` (tambahkan ke `_DAFTAR_ISI.md`). Lalu buat `implementation_plan.md` baru untuk pekerjaan ini sesuai SOP (seksi `## Execution Task List` + Code Sebelum/Sesudah), dan perbarui centangnya selama bekerja.

## Tujuan pengguna

Video dari **CF Autopipeline (CFA)** untuk brand berkarakter 3D (Reno – Solusi Thermal ID, Maya – Ruang Akustik ID) harus memakai **gambar acuan wajah** (Character Lock) di setiap klip, sama seperti kampanye Pillar. Dengan begitu wajah tidak berubah antar-klip dan antar-video.

## Akar masalah

CFA mengirim `POST /api/v2/recipes/autonomous-pipeline` dengan `pipeline_type: custom_storyboard`. Jalur edukasi memakai `prompt_mode: direct_passthrough` (`~/cf-autopipeline/bin/cfa_produksi.py:51–64`).

1. **`lib/custom-storyboard-pipeline.js:415`** membuat kampanye dengan `visual_overrides_json: null`. Hanya `visual_identity_preset_id` yang disimpan, dan versinya di-hardcode `1` (`:417`).
2. Item passthrough langsung `generation_status: 'completed'` (`:487`), sehingga **tidak pernah** melewati `processPillarGenerator` (`lib/scheduler-processors.js:5284`). Di sana VI di-resolve dari preset id (`:5363`) dan diteruskan ke `hasStylizedUniverseLink` (`:6418–6423`).
3. Saat produksi start frame, `buildOpcStartFrameRequest` (`lib/opc-start-frame-request.js:244`) memanggil `hasStylizedUniverseLink({ campaign, row })`, yang membaca **`campaign.visual_overrides_json`** (`lib/cartoon-reference-resolver.js:59–63`). Karena null:
   - `isStylized = false` dan `hasUniverseLink = false`, sehingga `shouldResolveReferences = false`;
   - gambar acuan karakter **tidak dilampirkan**;
   - model start frame jatuh ke `nano_banana_2`, bukan `nano_banana_pro` untuk stylized (`:187–189`).

**Pembanding yang sudah benar:** `lib/pillar-campaign-ingest.js:169–173` dan `:295–297` me-resolve snapshot VI lewat `resolveVisualIdentitySubmission` lalu menyimpannya ke `visual_overrides_json`. Custom storyboard tidak melakukannya.

**Konteks tambahan (17 Nov):** VI v3 yang dipakai jadwal Editorial (`ptgim_vi_solusi_thermal_v1_…`, `ptgim_vi_ruang_akustik_v1_…`, kini versi 4) **juga sudah disambungkan** ke Universe yang sama. Karena itu, kampanye Editorial PT GIM yang dibuat sejak 17 Nov masuk `content_world = cartoon_universe` lewat pillar ingest (`:179`, `:277`), dengan Character Lock aktif. Dua kampanye Editorial Thermal tanggal 17 Nov (generate 12:05 & 12:20 WIB) bisa dipakai sebagai **pembanding log** `[CharacterLock …]`. **Perbaikan ini tidak boleh mengubah jalur Editorial/pillar ingest.**

## Perbaikan

### A. `lib/custom-storyboard-pipeline.js` — resolve & simpan snapshot VI

**Code Sebelum (Current/Before)** — impor (±baris 9–15):
```js
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb, createPillarCampaign, createPillarCampaignItem, updatePillarCampaignItem } from './db.js';
import { startCampaignScheduler } from './campaign-scheduler.js';
import { approvePillarCampaignItemUnchanged } from './pillar-campaign-approval.js';
import { stripCtaAndHashtags, buildPlatformAdaptiveCaptions } from './smart-affiliate-package-builder.js';
import { normalizeBridgePayload } from './bridging/bridge-plan.js';
```

**Code Sesudah (Proposed/After):**
```js
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb, createPillarCampaign, createPillarCampaignItem, updatePillarCampaignItem } from './db.js';
import { startCampaignScheduler } from './campaign-scheduler.js';
import { approvePillarCampaignItemUnchanged } from './pillar-campaign-approval.js';
import { stripCtaAndHashtags, buildPlatformAdaptiveCaptions } from './smart-affiliate-package-builder.js';
import { normalizeBridgePayload } from './bridging/bridge-plan.js';
import { resolveVisualIdentitySubmission } from './visual-override-resolver.js';
```

**Code Sebelum (Current/Before)** — setelah `visualIdentityPresetId` ditentukan (±baris 206):
```js
  const visualIdentityPresetId = storyboard.visual_identity_preset_id || rawDna.visual_identity_preset_id || pVso.visual_identity_preset_id || null;
```

**Code Sesudah (Proposed/After):**
```js
  const visualIdentityPresetId = storyboard.visual_identity_preset_id || rawDna.visual_identity_preset_id || pVso.visual_identity_preset_id || null;

  // Character Lock parity dengan pillar-campaign-ingest: simpan snapshot VI ke kampanye agar
  // buildOpcStartFrameRequest -> hasStylizedUniverseLink bisa melampirkan referensi karakter Universe.
  let identityResult = { ref: null, snapshot: null };
  if (visualIdentityPresetId) {
    try {
      identityResult = await resolveVisualIdentitySubmission({ preset_id: visualIdentityPresetId });
    } catch (viErr) {
      console.warn(`[Custom Storyboard] Gagal resolve Visual Identity ${visualIdentityPresetId}: ${viErr.message}`);
    }
  }
```

**Code Sebelum (Current/Before)** — objek `createPillarCampaign` (±baris 415–417):
```js
    visual_overrides_json: null,
    visual_identity_preset_id: visualIdentityPresetId,
    visual_identity_preset_version: 1,
```

**Code Sesudah (Proposed/After):**
```js
    visual_overrides_json: identityResult.snapshot ? JSON.stringify(identityResult.snapshot) : null,
    visual_identity_preset_id: identityResult.ref?.id || visualIdentityPresetId,
    visual_identity_preset_version: identityResult.ref?.version || 1,
```

Catatan:
- **Jangan** mengubah `content_world` menjadi `cartoon_universe`. Jalur stylized + universe (`shouldResolveReferences = isStylized && hasUniverseLink`) sudah cukup, dan mengubah `content_world` akan menyalakan logika kartun lain (lineup, PawVille default, dsb).
- **Tidak perlu** menambah `universe_profile`. `createPillarCampaign` (`lib/db.js:2421`) memetakan kolom secara eksplisit dan tidak memuat `universe_profile`, sehingga kolom itu akan diabaikan. Snapshot sudah cukup, karena `hasStylizedUniverseLink` membaca `universe_profile_id` / `universe_slug` dari `subject` snapshot (`cartoon-reference-resolver.js:69–71`), dan `resolveClipReferenceImagesAsync` memuat manifest lewat `universeId` (`:224–229`).
- Karakter di-resolve juga dari nama di prompt (`:254–262`, mis. "Reno"), lalu fallback ke `subject.character_keys` (`:277–289`). Prompt passthrough CFA selalu menyebut nama karakter lewat `blok_gaya_t2i`.
- Resolve VI terjadi di dalam konteks tenant permintaan (VI PT GIM adalah VI tenant). Pastikan `resolveVisualIdentity` membaca tenant aktif yang sama seperti di pillar ingest.

### B. Verifikasi jalur produksi start frame passthrough

Telusuri dan pastikan **semua** pemanggil `buildOpcStartFrameRequest` untuk item custom storyboard memuat `campaign` dari DB, sehingga `visual_overrides_json` terbawa:
- `lib/campaign-scheduler.js:713` (preflight)
- `lib/start-frame-provider-adapter.js:25`, `:185`
- `lib/scheduler-processors.js:8111` (production_recovery). Di sini `contextReferences` dikirim kosong untuk non-kartun, sehingga auto-resolve di `opc-start-frame-request.js:247` yang akan berjalan. Pastikan tidak ada jalur lain yang mengirim `contextReferences` tidak kosong untuk stylized dan menahan auto-resolve.

Tidak perlu mengubah kode di sini, cukup dikonfirmasi. Jika ditemukan pemanggil yang memakai objek kampanye tanpa `visual_overrides_json`, perbaiki di tempat itu dengan pola yang sama, dan sertakan Code Sebelum/Sesudah di laporan.

## Pengujian

### Unit test baru — `tests/custom-storyboard-character-lock.test.js`
1. `executeCustomStoryboardPipeline` dengan `prompt_mode: direct_passthrough` + `visual_identity_preset_id` VI stylized yang punya `subject.universe_profile_id` dan `character_keys: ['reno_thermal_engineer']`:
   - `pillar_campaigns.visual_overrides_json` **tidak null** dan memuat `subject.kind = stylized_3d_character` + `universe_profile_id`;
   - `visual_identity_preset_version` = versi VI sebenarnya.
2. `hasStylizedUniverseLink({ campaign })` untuk kampanye itu menghasilkan `isStylized: true`, `hasUniverseLink: true`, `shouldResolveReferences: true`, `fallbackCharacterKeys: ['reno_thermal_engineer']`.
3. Tanpa `visual_identity_preset_id`, perilaku lama tetap: `visual_overrides_json = null`, tanpa error.
4. VI id yang tidak ada: kampanye tetap dibuat (warning saja) dan `visual_overrides_json = null`.

Mock DB/tenant mengikuti pola `tests/test-custom-storyboard-mcp.test.js`. Jangan menulis kredensial asli. Gunakan placeholder seperti `TEST_MOCK_API_KEY`.

### Regresi wajib
- `node --test tests/test-custom-storyboard-mcp.test.js tests/custom-storyboard-prompt-engineer.test.mjs tests/test-cartoon-reference-url-resolver.mjs`
- **Jalur CFA produk (gemini_engineer)** milik DapurBotani & NutriBake juga custom storyboard. Dengan perubahan ini, kampanyenya kini membawa snapshot VI manusia (`identity_card`, bukan stylized). Pastikan:
  - start frame tetap memakai foto produk (`product_truth_*`) di klip reveal;
  - tidak ada referensi karakter yang dilampirkan (VI bukan stylized);
  - cabang wardrobe reference (`opc-start-frame-request.js:282+`) tidak error bila `result_json.wardrobe_reference_image` kosong.
- **Jalur Editorial/pillar ingest tidak berubah**: `git diff` tidak menyentuh `lib/pillar-campaign-ingest.js`.
- `npm run build` dengan `DISABLE_AUTO_MIGRATIONS=true`.

### Uji nyata (di Staging, setelah prasyarat di bawah siap)
- Kirim 1 custom storyboard passthrough 2 klip dengan VI Reno v4 yang sudah tersambung Universe.
- Di log PM2 staging harus muncul `[CharacterLock Async] Clip 1: characters=reno_thermal_engineer refs=1` (dan Clip 2), serta model start frame `nano_banana_pro`.
- Bandingkan wajah Reno di kedua start frame: harus sama dengan gambar acuan.

## Prasyarat data (dikerjakan pengguna/Claude, bukan Antigravity)

**Status 17 Nov: SUDAH SIAP di Staging.**
- Universe tenant `tnt_pt-gim-sosmed_62d0d9`:
  - `ptgim_univ_solusi_thermal_tnt_pt_gim_sosmed_62d0d9` (slug `solusi-thermal-id`) → karakter `reno_thermal_engineer`, `reference_image_path: /uploads/reference_assets/ptgim_reno_character_sheet.jpg`
  - `ptgim_univ_ruang_akustik_tnt_pt_gim_sosmed_62d0d9` (slug `ruang-akustik-id`) → karakter `maya_acoustic_architect`, `reference_image_path: /uploads/reference_assets/ptgim_maya_character_sheet.jpg`
  - Kedua gambar terbukti bisa diakses (HTTP 200).
- VI v4 `vi_mwk2cm17_3b3a3166` (Reno) dan `vi_mwk2cm33_0c9f088c` (Maya) sudah memuat `subject.universe_profile_id`, `universe_slug`, `character_keys` (versi 2).
- Preset CFA `solusi_thermal_cfa` / `ruang_akustik_cfa` sudah menunjuk ke VI v4 di atas (`visual_swap.visual_identity_preset_id`).
- Untuk unit test, gunakan pola ini dengan data mock. Untuk uji staging, pakai VI v4 di atas dan cari log `characters=reno_thermal_engineer refs=1`.

## Rilis & deploy

- Ikuti SOP `AGENTS.md`: `npm run release-non-interactive -- --type patch --title "Character Lock untuk Custom Storyboard" --points "Snapshot VI disimpan pada kampanye custom storyboard|Referensi karakter Universe aktif untuk passthrough CFA|Versi VI tidak lagi di-hardcode"`.
- Deploy **Dev lalu Staging** sesuai `sot/global/GIT_BASED_ATOMIC_DEPLOYMENT.md` (full Git SHA).
- **Penting (dicek 17 Nov):** CFA di Mac Mini (`CF_STUDIO_OPERATOR_BASE_URL=http://127.0.0.1:5010`) dan MCP CF Studio di laptop pengguna (`http://100.95.245.55:5010`) **sama-sama memakai Staging**. Konten PT GIM (brand profile, VI v4, preset CFA, jadwal Editorial) juga berada di Staging. Jadi perbaikan ini **langsung bermanfaat setelah deploy Staging**.
- **Waktu aktivasi Staging:** Staging adalah lingkungan konten aktif (PT GIM, HabitFolk, NutriBake, DapurBotani lewat CFA). Pilih waktu saat **tidak ada** kampanye yang sedang produksi (cek antrean/`cf_get_pipeline_queue` atau dasbor). Hindari jam generate jadwal (mis. 12:05–12:30 WIB) dan putaran CFA. Andalkan health check + rollback otomatis sesuai SOP.
- Production tetap **hanya atas perintah eksplisit pengguna** (SOP).
- Perbarui kartu menu bila perilaku menu berubah. Kandidat: `sot/menus/kartu/visual-identities.md` (Character Lock kini berlaku untuk custom storyboard).

## Laporan yang diharapkan

`catatan-kerja/laporan/LAPORAN_CHARACTER_LOCK_CUSTOM_STORYBOARD.md`, berisi:
- diff ringkas + Code Sebelum/Sesudah;
- hasil unit test & regresi;
- potongan log `[CharacterLock Async]` dari uji staging (+ pembanding dari kampanye Editorial 17 Nov bila ada);
- tangkapan 2 start frame uji vs gambar acuan;
- versi rilis, SHA, dan waktu aktivasi Staging.
