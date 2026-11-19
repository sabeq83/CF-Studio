# Instruksi Agent AI Antigravity — MCP Universe & Character Lock (MVP Arka)

Tanggal: 19 November 2026 · Disusun oleh: Claude (reviewer) · Acuan: `main` @ v2.56.0 (`1b9d238`)

## Mandat

Buat agen bisa, **hanya lewat MCP CF Studio**, menambah/mengubah karakter Universe, mengunggah dan menyetujui gambar referensi karakter, menautkannya ke Visual Identity (VI), lalu **membuktikan** bahwa resolver produksi memakai gambar yang benar — tanpa edit DB langsung dan tanpa menyalin file manual.

Kasus penerimaan: **Arka menggantikan Maya** pada Ruang Akustik ID, tenant PT GIM Sosmed.

Dokumen sumber (baca dulu, urut):
1. `AGENTS.md` (SOP branch, rilis, deploy, token warna, secret).
2. `catatan-kerja/usulan/REVIEW_USULAN_MCP_UNIVERSE_REFERENCE_MANAGER.md` — **keputusan final lingkup** (menang atas usulan Codex bila bertentangan).
3. `catatan-kerja/usulan/USULAN_MCP_UNIVERSE_REFERENCE_MANAGER.md` — latar & kontrak respons preflight (bagian 7).
4. `sot/menus/_PETA_MENU.md`, `sot/menus/kartu/universes.md`, `sot/menus/kartu/visual-identities.md`.
5. Dokumentasi Next.js lokal: `node_modules/next/dist/docs/01-app/` bagian Route Handlers & Dynamic Routes (params berupa Promise — ikuti pola `const { id } = await params` yang sudah ada).

## Batasan Keras

- Pekerjaan dibagi **dua branch** (disetujui pengguna 19 Nov 2026):
  1. **Bagian H — Hotfix** `hotfix/universe-tenant-isolation` (B2 + B3), dikerjakan **lebih dulu**, boleh naik ke Staging setelah persetujuan pengguna (tanpa pintu 1 hari).
  2. **Bagian F — Fitur** `fitur/mcp-universe-character-lock` (semua sisanya), dibuat dari `main` **setelah** hotfix ter-merge. **Tanpa** `npm run release` di branch fitur.
- **Tanpa migrasi DB.** Jangan menambah tabel/kolom. Jika ternyata mutlak perlu, BERHENTI dan laporkan ke pengguna.
- **Tanpa perubahan UI** (tidak ada React/halaman baru). Bila muncul kebutuhan UI → berhenti, ikuti SOP mockup HTML.
- Perilaku resolver untuk VI yang **tidak** memakai `character_lock_mode: 'strict'` harus **identik** dengan sebelumnya.
- Jangan pernah mengirim render/generate G-Labs sebagai bagian dari upload, approve, link, atau preflight.
- Jangan menulis kredensial apa pun ke kode/test/dokumen (SOP Zero Secret Exposure). Test memakai token mock `TEST_MOCK_OPERATOR_TOKEN`.
- Jangan deploy ke Staging/Production. Hanya Dev, setelah semua test lulus.
- Ikuti SOP Kontrol Eksekusi: buat `implementation_plan.md` dengan `## Execution Task List` (checkbox) dan potongan **Code Sebelum / Code Sesudah** per file, centang real-time.

## Audit Wajib Sebelum Coding

Konfirmasi temuan berikut masih berlaku di `main` terbaru (nomor baris bisa bergeser). Catat hasilnya di `implementation_plan.md`.

| ID | File | Yang dicek |
|---|---|---|
| B1 | `lib/universe-manifests.js` (~213, ~226, ~364) & `lib/reference-asset-repository.js` (`getApprovedReferenceAssetsForUniverse`) | Dipanggil di `tenantContext.run('__none__')` → query `tenant_id='__none__'` → selalu kosong. |
| B2 | `lib/universe-manifests.js` (`getUniverseManifestAsync`, `loadManifestsFromDb`, `_manifestCache`, `_characterNameMap`) | Lookup slug tanpa batas tenant; cache dikunci slug saja. |
| B3 | `app/api/v2/universe-profiles/route.js` (~33), `…/[id]/characters/route.js` (~36) | `{ id, ...body }` → body menimpa `id`/`universe_id`. |
| B4 | `lib/cartoon-reference-resolver.js` (`resolveClipReferenceImagesAsync` ~262-315, dan versi sync ~391+) | Fallback ke `si_wajan`/karakter pertama; scan nama di prompt; gambar hilang hanya `console.warn`. |
| B5 | `lib/auth.js` (`withTenantContext`, fallback operator) | Route Universe/aset tanpa cek scope. |
| R1 | `lib/reference-asset-repository.js` (`approveReferenceAsset` ~107) | Cek `status !== 'draft'` di luar transaksi. |
| R2 | `app/api/v2/universe-profiles/[id]/characters/` | Konfirmasi belum ada route update per karakter. |
| R3 | `apps/mcp/tools.mjs` (`resolvePhotoInput` ~8, factory `request` ~296, `register` ~362) | Pola base64/file_path, FormData, `x-tenant-override`. |
| R4 | Pemanggil resolver: `lib/opc-start-frame-request.js` (~262), `lib/scheduler-processors.js` (~6507) | Bagaimana error resolver ditangani (saat ini ditangkap & di-`warn`). |

## Bagian H — Hotfix Isolasi Tenant (kerjakan PERTAMA)

Alur SOP Hotfix (`AGENTS.md` Alur 2). Isi **hanya** butir 0.2 (B2) dan 0.3 (B3) di bawah — jangan menyelipkan butir lain.

1. `git checkout main && git pull && git checkout -b hotfix/universe-tenant-isolation`.
2. Kerjakan **0.2** dan **0.3** persis seperti dijelaskan di Tahap 0. Pada 0.2, cukup isolasi tenant (lookup by ID dulu, slug dibatasi tenant, kunci cache per tenant, resolver meneruskan `tenantId`); jangan menambah field diagnostik/strict — itu milik Bagian F.
3. Test wajib lulus:
   - `tests/universe-manifest-tenant-isolation.test.js` (bagian B2: dua tenant slug sama tidak tertukar).
   - `tests/universe-character-route-whitelist.test.js` (B3).
   - Regresi: `tests/test-cartoon-*.mjs`, `tests/reference-asset-and-sidebar-d.test.js`, `tests/base64-image-reference.test.js` — hasil resolver untuk kampanye yang sudah ada **identik**.
   - `npm run build` lulus.
4. Commit, push branch hotfix. **BERHENTI** dan laporkan ke pengguna (bahasa sederhana): apa yang diperbaiki, hasil test, tanpa perubahan database. Minta persetujuan naik ke Staging.
5. Setelah pengguna setuju: `git checkout main && git pull && git merge --no-ff hotfix/universe-tenant-isolation`, lalu
   `npm run release-non-interactive -- --type patch --title "Isolasi Tenant Universe" --points "Manifest Universe dibatasi per tenant|ID karakter/Universe tidak bisa ditimpa data kiriman"`.
6. Deploy SHA rilis `main` ke Staging: `npm run deploy:staging -- --ref <full-sha> --apply --confirm-staging`, lalu verifikasi wajib SOP deploy (current, manifest, HTTP 200, PM2, `pm_cwd`, `PG_SEARCH_PATH=staging`, `PGPOOL_MAX=3`). Pantau satu siklus produksi CFA berikutnya; bila ada keluhan referensi karakter, rollback: `npm run deploy:staging:rollback -- --apply --confirm-staging`.
7. Perbarui kartu `sot/menus/kartu/universes.md` (catatan isolasi tenant) dalam commit rilis yang sama.
8. Hapus branch hotfix (lokal & remote). Bila ada branch `fitur/*` lain yang aktif, jalankan `git merge main` di sana sesuai SOP.

## Bagian F — Fitur MCP Universe & Character Lock

Mulai **setelah** Bagian H ter-merge ke `main`: `git checkout main && git pull && git checkout -b fitur/mcp-universe-character-lock`. Butir 0.2 dan 0.3 sudah ada di `main`; di Bagian F cukup perluas manifest dengan field diagnostik (0.1) dan mode strict (0.4).

## Tahap 0 — Perbaikan Fondasi (commit terpisah per butir)

> 0.2 dan 0.3 dikerjakan di **Bagian H** (hotfix). Butir lain dikerjakan di Bagian F.

### 0.1 (B1) Aset approved terbaca di manifest
- Ubah `getApprovedReferenceAssetsForUniverse(universeId, tenantId = getActiveTenantId())`; query memakai `tenantId` eksplisit.
- Di `universe-manifests.js`, panggil dengan `profile.tenant_id`.
- Di `buildManifestFromDb`, tambahkan per karakter:
  ```js
  identity_asset: charIdentityAsset
    ? { asset_id, version, sha256, public_path, source: 'approved_asset' }
    : (char.reference_image_path
        ? { public_path: char.reference_image_path, source: 'legacy_path' }
        : { public_path: <path tebakan saat ini>, source: 'fabricated_path' })
  ```
  Field lama (`identity_reference_path`, dst.) tetap ada agar kompatibel.

### 0.2 (B2) Isolasi tenant manifest
- `getUniverseManifestAsync(slug, { universeId, tenantId })`: bila `universeId` ada, cari by ID **lebih dulu**; lookup slug wajib `WHERE slug = $1 AND tenant_id = $2` (pakai `pgQuery` dengan tenant eksplisit, jangan bergantung interceptor di konteks `__none__`).
- Kunci cache `${tenant_id}:${slug}`; `_characterNameMap` per tenant (`Map<tenantId, map>`). Pertahankan fallback statis Pawville.
- Resolver meneruskan `tenantId` kampanye (`campaign.tenant_id` / `row.tenant_id`) ke manifest. Snapshot kampanye (`universe_snapshot_json`) tetap diprioritaskan seperti sekarang.
- `refreshManifestCache()` tetap bekerja; tambahkan `refreshManifestCache({ tenantId, universeId })` yang hanya membuang entri terkait (argumen lama diabaikan dengan aman).

### 0.3 (B3) Hentikan penimpaan ID
- `createUniverseProfile({ ...pick(body, ALLOWED), id })` dan `createUniverseCharacter({ ...pick(body, ALLOWED), id: charId, universe_id: id })` — ID server **terakhir**.
- Validasi `character_key`: `/^[a-z0-9_]{2,64}$/`; konflik `(universe_id, character_key)` → 409 `CHARACTER_KEY_EXISTS` (jangan bocorkan error constraint mentah).
- Setelah create karakter: panggil invalidasi cache 0.2.

### 0.4 (B4) Mode Character Lock `strict` di resolver
- Baca `viSubject.character_lock_mode` (`'off'` default, `'strict'`).
- Pada `strict` (berlaku untuk versi async **dan** sync):
  - Allowlist = `viSubject.character_keys`. Kunci dari `clipCharacters`/`voiceSegments`/scan prompt hanya diterima bila ada di allowlist.
  - Bila hasil kosong → pakai kunci pertama allowlist yang ada di manifest. **Tidak ada** fallback ke `si_wajan` atau `Object.keys(manifest.characters)`.
  - Kunci allowlist tidak ada di manifest, atau gambar gagal dimuat → lempar `Error` dengan `code = 'REFERENCE_NOT_RESOLVED'` dan detail (`character_key`, path, source).
  - Sumber `fabricated_path` dianggap **tidak valid** pada strict.
- Tambahkan ke `result` field diagnostik: `resolvedCharacterAssets: [{ character_key, asset_id, version, sha256, source, public_path }]`.
- Pemanggil (R4): pada error `REFERENCE_NOT_RESOLVED`, **jangan** ditelan — tandai klip gagal dengan pesan jelas supaya pemulih CFA (`cfa-cek-produksi`) mengirim URGENT. Untuk VI non-strict perilaku lama tidak berubah.

### 0.5 (R1) Approval aman terhadap balapan
- Di `approveReferenceAsset`, di dalam `withPgTransaction`: `SELECT … WHERE id=$1 AND tenant_id=$2 FOR UPDATE`, lalu cek status.
- Terima `review.expected_sha256` (bila dikirim harus sama dengan `asset.sha256`, selain itu `CHECKSUM_MISMATCH`).
- Idempoten: bila status sudah `approved` dan sha sama → kembalikan aset tanpa perubahan.
- Tangkap error unique violation (`23505`) → `REVISION_CONFLICT`.
- Setelah commit: invalidasi cache manifest (0.2) untuk Universe aset tersebut.

### 0.6 (B5) Cek scope & izin pada route mutasi
- Helper baru di `lib/auth.js`, mis. `requireOperatorScope(user, scope)`: bila `user.isOperator` dan scope tidak dimiliki (dan bukan master) → 403 `SCOPE_REQUIRED`.
- Mutasi karakter/upload → `content:create`; approve/reject/link → `content:approve`. Baca (GET/preflight) → `content:read`.
- Bila tenant menonaktifkan menu `universe_manager` (`user.tenantDisabledMenus`) → 403.
- Jangan ubah perilaku route lain di luar lingkup ini.

### 0.7 Upload: dedup checksum & universe konsisten
- Di `uploadReferenceAsset`: hitung sha256 dari buffer **sebelum** `reserveReferenceAssetVersion`. Bila sudah ada aset owner/role sama berstatus `draft`/`approved` dengan sha sama → kembalikan aset lama dengan `deduplicated: true` tanpa membuat versi baru.
- `universe_id` dari form harus sama dengan `owner.universe_id` untuk `owner_type='character'`; bila beda → 400 `UNIVERSE_MISMATCH`. Default = `owner.universe_id`.
- Tambahkan batas dimensi (mis. maks 4096×4096 / 16 MP) bila `reference-asset-storage.js` sudah membaca width/height; jika belum, catat sebagai TODO, jangan menambah dependensi baru.

## Tahap A — Route Baru

1. `app/api/v2/universe-profiles/[id]/characters/[charId]/route.js`
   - `GET`: karakter + ringkasan aset approved (identity, character_sheet).
   - `PUT`: whitelist field `updateUniverseCharacter`; karakter wajib milik Universe `[id]`; `expected_updated_at` opsional → 409 `REVISION_CONFLICT` bila beda. Ubah `character_key` ditolak (`CHARACTER_KEY_IN_USE`) bila ada VI di tenant yang mereferensikannya. Invalidasi cache.
2. `app/api/v2/visual-identities/[id]/universe-link/route.js` — `POST`
   - Body: `{ universe_id, character_keys[], character_lock_mode?: 'off'|'strict', dry_run = true }`.
   - Validasi: VI milik tenant & bukan system preset; Universe milik tenant; tiap `character_key` ada di Universe tersebut.
   - Merge **hanya** `subject.universe_profile_id`, `subject.universe_slug`, `subject.character_keys`, `subject.character_lock_mode`; field VI lain tidak disentuh. Pakai fungsi update VI yang ada (`updateVisualIdentity`) dengan config hasil merge.
   - Respons: `{ before, after, diff, dry_run, warnings }`. Warning bila VI dipakai jadwal aktif (informasi saja, jadwal tidak diubah).
3. `app/api/v2/reference-assets/character-lock-preflight/route.js` — `POST`
   - Body: `{ visual_identity_id, mode: 'advisory'|'required', sample_prompt? }`.
   - Read-only. Bangun manifest segar (0.1/0.2) lalu panggil resolver dalam mode diagnostik (tanpa memuat base64 berlebih bila memungkinkan; cukup verifikasi file via `verifyManagedReference`).
   - Cek: VI ada & stylized; Universe/kunci konsisten se-tenant; tiap kunci punya identity `approved_asset` (bukan legacy/fabricated — legacy = warning, fabricated = missing); file ada & sha cocok; resolver mengembalikan aset yang sama; `sample_prompt` berisi nama karakter lain tidak menambah anchor lain pada strict.
   - Respons persis kontrak usulan Codex bagian 7 + `resolved_assets[].source`. `success` = pemeriksaan berjalan; kesiapan = `status` (`ready|not_ready`) & `blocking`.
   - Kode error stabil: `TENANT_MISMATCH`, `OWNER_NOT_FOUND`, `UNIVERSE_MISMATCH`, `REVISION_CONFLICT`, `REFERENCE_NOT_APPROVED`, `REFERENCE_FILE_MISSING`, `CHECKSUM_MISMATCH`, `UPLOAD_TOO_LARGE`, `REFERENCE_NOT_RESOLVED`, `SCOPE_REQUIRED`, `CHARACTER_KEY_EXISTS`, `CHARACTER_KEY_IN_USE`.

Semua respons route baru menyertakan `tenant_id` efektif. Error memakai bentuk `{ success:false, error_code, error }`.

## Tahap B — Tool MCP (`apps/mcp/tools.mjs`)

Daftarkan 10 tool berikut. Deskripsi tool berbahasa Inggris, singkat, menyebut scope yang dibutuhkan. Semua tool mutasi menerima `expected_tenant_id` opsional: bila diisi dan berbeda dari tenant aktif sesi (`activeTenantOverride || operator.tenant_id`), tolak di sisi MCP dengan `TENANT_MISMATCH` **sebelum** memanggil API.

| Tool | readOnly | Endpoint |
|---|---|---|
| `cf_list_universes` | true | GET `/api/v2/universe-profiles` (ringkas, tanpa field besar) |
| `cf_get_universe` | true | GET `/api/v2/universe-profiles/{id}` + ringkasan aset per karakter |
| `cf_create_universe_character` | false | POST `/api/v2/universe-profiles/{id}/characters` |
| `cf_update_universe_character` | false | PUT `/api/v2/universe-profiles/{id}/characters/{charId}` |
| `cf_list_reference_assets` | true | GET `/api/v2/reference-assets?owner_type&owner_id&role&status` — buang field besar, tambahkan `preview_url` absolut |
| `cf_upload_reference_asset` | false | POST `/api/v2/reference-assets/upload` (FormData) |
| `cf_approve_reference_asset` | false | POST `/api/v2/reference-assets/{id}/approve` — `expected_sha256` **wajib** di schema |
| `cf_reject_reference_asset` | false | POST `/api/v2/reference-assets/{id}/reject` — `reason` wajib |
| `cf_link_visual_identity_universe` | false | POST `/api/v2/visual-identities/{id}/universe-link` — `dry_run` default `true` |
| `cf_preflight_character_lock` | true | POST `/api/v2/reference-assets/character-lock-preflight` |

Detail `cf_upload_reference_asset`:
- Schema: `owner_type` (enum `character|location|universe|visual_identity`), `owner_id`, `role` (enum dari `ASSET_ROLES`), `universe_id?`, tepat satu dari `image_base64` | `file_path`, `filename?`.
- Pakai ulang/perluas `resolvePhotoInput`. `file_path`: hanya ekstensi `.png/.jpg/.jpeg/.webp`, `fs.realpath` lalu tolak bila bukan file biasa; pesan error menjelaskan file dibaca di **host MCP**.
- Batasi panjang base64 (≈ 14 MB terenkode → ≤ 10 MB biner) dan tolak sebelum membuat FormData → `UPLOAD_TOO_LARGE`.
- Bangun `FormData` + `Blob` (Node 18+) lalu kirim lewat `request` yang sudah mendukung FormData. Jangan mencatat payload ke log/respons.
- `photo_url`/URL import **tidak** didukung di MVP (tolak dengan pesan jelas).

Perbarui `apps/mcp/README.md` (daftar tool + contoh alur Arka) dan tambah test di `apps/mcp/test/mcp.test.mjs` (tool terdaftar, schema menolak input salah, `expected_tenant_id` mismatch ditolak, upload base64 terlalu besar ditolak, approve tanpa `expected_sha256` ditolak).

## Tahap C — Test

Tambah di `tests/` (node:test), tanpa jaringan dan tanpa kredensial nyata:
1. `universe-manifest-tenant-isolation.test.js` — sudah dibuat di Bagian H (B2); di Bagian F tambahkan kasus aset approved muncul dengan `source:'approved_asset'` (B1).
2. `cartoon-reference-resolver-strict.test.js` — strict: tanpa fallback ke karakter lain; prompt menyebut "Maya" tidak menambah anchor Maya; anchor hilang → `REFERENCE_NOT_RESOLVED`; `fabricated_path` ditolak. Non-strict: hasil identik dengan perilaku lama (snapshot Pawville/si_wajan).
3. `universe-character-route-whitelist.test.js` — sudah dibuat di Bagian H (B3); pastikan tetap lulus.
4. `reference-asset-approve-concurrency.test.js` — approve ganda paralel → satu sukses, satu `REVISION_CONFLICT`/idempoten; `expected_sha256` beda → `CHECKSUM_MISMATCH`.
5. `reference-asset-upload-dedup.test.js` — upload gambar identik → `deduplicated:true`, tanpa versi baru; `UNIVERSE_MISMATCH`.
6. Perluas `tests/test-visual-identity-universe-link.mjs` untuk route link (dry-run tidak menulis, merge tidak menyentuh field lain, key tak dikenal ditolak).
7. Jalankan juga test resolver/manifest yang sudah ada: `tests/test-cartoon-*.mjs`, `tests/reference-asset-and-sidebar-d.test.js`, `tests/base64-image-reference.test.js`, dan `npm test` di `apps/mcp`.
8. `npm run build` lokal harus lulus.

## Tahap D — Deploy Dev & Uji Arka

1. Commit per tahap (pesan konvensional, bahasa Indonesia boleh), push branch, ambil full SHA.
2. `npm run deploy:dev:atomic -- --ref <full-sha> --apply --confirm-dev`. Tunggu build tanpa polling SSH rapat (SOP: interval 60–120 detik).
3. Verifikasi wajib SOP deploy (current, manifest, HTTP 200 UI/API, PM2 online, `pm_cwd`, `PG_SEARCH_PATH=dev`, `PGPOOL_MAX=3`).
4. Uji alur Arka **di Dev** lewat MCP yang diarahkan ke Dev (port 7020/5020), tenant `tnt_pt-gim-sosmed_62d0d9` — semua ID dibaca ulang, jangan pakai ID lama mentah-mentah:
   1. `cf_switch_tenant` → `cf_list_universes` → `cf_get_universe` (Ruang Akustik).
   2. `cf_create_universe_character` key `arka_acoustic_consultant` (pria Indonesia 30–35 th, rambut hitam pendek, blazer navy polos, kaus abu terang, headphone charcoal, tanpa aksen cyan).
   3. `cf_upload_reference_asset` role `identity` dengan gambar anchor bersih satu karakter yang **disediakan pengguna** (minta path/file bila belum ada; jangan generate sendiri).
   4. Tampilkan preview + sha256 ke pengguna → tunggu persetujuan eksplisit → `cf_approve_reference_asset` dengan `expected_sha256`.
   5. `cf_link_visual_identity_universe` dry-run → tunjukkan diff → setelah disetujui, kirim `dry_run:false`, `character_lock_mode:'strict'`. Maya tidak diubah.
   6. `cf_preflight_character_lock` `mode:'required'`, `sample_prompt` yang menyebut "Maya" → harus `ready`, hanya aset Arka.
   7. **Tidak** membuat video sampel tanpa izin pengguna (kuota G-Labs).
   > Catatan: Dev memakai schema `dev`. Jika data PT GIM belum ada di schema `dev`, uji alur dengan Universe/VI uji di tenant uji dan laporkan; jangan menyalin data Staging ke Dev tanpa izin.
5. Perbarui kartu `sot/menus/kartu/universes.md` dan `sot/menus/kartu/visual-identities.md` (bagian MCP, mode strict, tanggal & versi) di branch yang sama.

## Format Laporan ke Pengguna (Bahasa Indonesia sederhana)

- Tingkat keberhasilan: **konfigurasi tersimpan / referensi siap / sudah diuji produksi**.
- Daftar tool baru & cara cek singkat di Dev (`http://100.95.245.55:5020`).
- Hasil test (jumlah lulus/gagal, sertakan output bila gagal).
- Apakah ada perubahan database (harus: **tidak ada**).
- Pengingat pintu Staging: butuh pernyataan lolos uji dari pengguna + minimal 1 hari di Dev; merge ke `main` + `npm run release-non-interactive -- --type minor …` hanya setelah itu.

## Di Luar Lingkup (jangan dikerjakan)

Create/update/arsip Universe via MCP, arsip/restore aset, lokasi, generate AI referensi, import legacy, URL import, upload session bertoken, kolom revision/tabel idempotency, perubahan UI, pengalihan jadwal/brand dari Maya ke Arka.
