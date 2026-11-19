# Implementation Plan — Bagian F: MCP Universe & Character Lock (MVP Arka)

- **Branch Kerja**: `fitur/mcp-universe-character-lock` (dari `main` @ v2.56.1 `55072ab98b6a130475727de931287567b5ed91c5`, setelah Hotfix Bagian H ter-merge dan ter-deploy ke Staging)
- **Acuan Instruksi**:
  - `catatan-kerja/instruksi-agent/antigravity_mcp_universe_reference_manager_instructions.md`
  - `catatan-kerja/usulan/REVIEW_USULAN_MCP_UNIVERSE_REFERENCE_MANAGER.md`
  - `catatan-kerja/usulan/USULAN_MCP_UNIVERSE_REFERENCE_MANAGER.md` (kontrak preflight bagian 7)
- **Perubahan Database (Migrasi)**: **Tidak ada.**
- **Perubahan UI**: **Tidak ada.**
- **Kompatibilitas**: Perilaku resolver untuk Visual Identity (VI) non-`strict` (termasuk PawVille / `si_wajan`) tetap **identik**.

---

## Execution Task List

### Tahap 0 — Perbaikan Fondasi (commit terpisah per butir)
- [x] **0.1 (B1)**: Aset approved terbaca di manifest — perbarui `getApprovedReferenceAssetsForUniverse(universeId, tenantId)` di `lib/reference-asset-repository.js`, panggil dengan `profile.tenant_id` di `lib/universe-manifests.js`, tambahkan `identity_asset` (`approved_asset` | `legacy_path` | `fabricated_path`) per karakter di `buildManifestFromDb` sambil mempertahankan field lama
- [x] **0.4 (B4)**: Mode Character Lock `strict` di resolver — pertahankan `subject.character_lock_mode` (`'off'` | `'strict'`) di `lib/visual-identity-contract.js`; terapkan allowlist `viSubject.character_keys`, larangan fallback karakter lain, penolakan `fabricated_path`, error `REFERENCE_NOT_RESOLVED`, serta field diagnostik `resolvedCharacterAssets` di `lib/cartoon-reference-resolver.js` (async & sync); pastikan `lib/opc-start-frame-request.js` dan `lib/scheduler-processors.js` (R4) tidak menelan `REFERENCE_NOT_RESOLVED`
- [x] **0.5 (R1)**: Approval aman terhadap balapan — di `lib/reference-asset-repository.js` (`approveReferenceAsset`), pindahkan `SELECT … FOR UPDATE` ke dalam `withPgTransaction`, validasi `expected_sha256` (`CHECKSUM_MISMATCH`), idempoten bila sudah `approved` dengan sha sama, tangkap `23505` → `REVISION_CONFLICT`, dan invalidasi cache manifest (`refreshManifestCache`) setelah commit
- [x] **0.6 (B5)**: Cek scope & izin pada route Universe/aset/link — tambah helper `requireOperatorScope(user, scope)` + muat `tenantDisabledMenus` untuk operator di `lib/auth.js`; terapkan `content:read` / `content:create` / `content:approve` serta blokir bila menu `universe_manager` dinonaktifkan tenant (`403`)
- [x] **0.7**: Upload dedup checksum, konsistensi `universe_id`, dan batas dimensi — di `lib/reference-asset-storage.js` batasi dimensi maks 4096×4096 / 16 MP (`UPLOAD_TOO_LARGE`); di `lib/reference-asset-service.js` hitung `sha256` sebelum `reserveReferenceAssetVersion`, dedup draft/approved identik (`deduplicated: true`), dan validasi `universe_id === owner.universe_id` untuk `owner_type='character'` (`UNIVERSE_MISMATCH`)

### Tahap A — Route Baru & Diperkeras
- [x] **A.1**: Perkeras `app/api/v2/universe-profiles/[id]/characters/[charId]/route.js` (`GET` + ringkasan aset approved; `PUT` whitelist field, kepemilikan Universe `[id]`, `expected_updated_at` → `REVISION_CONFLICT`, tolak ubah `character_key` jika dipakai VI → `CHARACTER_KEY_IN_USE`, invalidasi cache; `DELETE` kepemilikan + invalidasi cache) serta perkaya `GET /api/v2/universe-profiles/[id]` dengan ringkasan aset approved & `tenant_id`
- [x] **A.2**: Buat `app/api/v2/visual-identities/[id]/universe-link/route.js` (`POST`, `content:approve`, validasi VI/Universe/keys se-tenant, merge hanya `subject.universe_profile_id/universe_slug/universe_name/character_keys/character_lock_mode`, `dry_run` default `true`, kembalikan `{ before, after, diff, dry_run, warnings }`)
- [x] **A.3**: Buat `app/api/v2/reference-assets/character-lock-preflight/route.js` (`POST`, `content:read`, read-only, bangun manifest segar, cek VI stylized, konsistensi Universe/keys, `approved_asset` vs legacy/fabricated, verifikasi file & sha via `verifyManagedReference`, panggil resolver diagnostik termasuk uji `sample_prompt` mengandung nama karakter lain, kembalikan kontrak respons bagian 7 + `resolved_assets[].source`)
- [x] Pastikan semua route baru/terkait mengembalikan `tenant_id` efektif dan format error stabil `{ success: false, error_code, error }`

### Tahap B — 10 Tool MCP (`apps/mcp/tools.mjs`)
- [x] Daftarkan 10 tool MCP (`cf_list_universes`, `cf_get_universe`, `cf_create_universe_character`, `cf_update_universe_character`, `cf_list_reference_assets`, `cf_upload_reference_asset`, `cf_approve_reference_asset`, `cf_reject_reference_asset`, `cf_link_visual_identity_universe`, `cf_preflight_character_lock`) dengan cek `expected_tenant_id` sisi MCP (`TENANT_MISMATCH`), validasi upload (`image_base64` XOR `file_path`, tolak `photo_url`, batas 14 MB base64 / 10 MB biner `UPLOAD_TOO_LARGE`, `fs.realpath` + file biasa + ekstensi `.png/.jpg/.jpeg/.webp`), dan teruskan `error_code` di `operatorClient`
- [x] Perbarui `apps/mcp/README.md` (daftar 10 tool baru + contoh alur Arka)
- [x] Tambah test di `apps/mcp/test/mcp.test.mjs` (registrasi 10 tool, validasi schema, `expected_tenant_id` mismatch, base64 kebesaran `UPLOAD_TOO_LARGE`, approve tanpa `expected_sha256` ditolak, `photo_url` ditolak)

### Tahap C — Pengujian & Build
- [x] Perluas `tests/universe-manifest-tenant-isolation.test.js` untuk kasus B1 (`source: 'approved_asset'`, `'legacy_path'`, `'fabricated_path'`)
- [x] Buat `tests/cartoon-reference-resolver-strict.test.js` (strict async & sync, tanpa fallback, prompt menyebut Maya tidak menambah anchor Maya, anchor hilang → `REFERENCE_NOT_RESOLVED`, `fabricated_path` ditolak, non-strict identik perilaku lama)
- [x] Buat `tests/reference-asset-approve-concurrency.test.js` (balapan paralel, idempoten, `expected_sha256` beda → `CHECKSUM_MISMATCH`, `23505` → `REVISION_CONFLICT`)
- [x] Buat `tests/reference-asset-upload-dedup.test.js` (upload identik → `deduplicated: true` tanpa versi baru, `UNIVERSE_MISMATCH`, batas dimensi)
- [x] Perluas `tests/test-visual-identity-universe-link.mjs` (route link: dry-run tidak menulis, merge tidak menyentuh field lain, key tak dikenal ditolak)
- [x] Jalankan seluruh test baru, regresi (`tests/test-cartoon-*.mjs`, `tests/reference-asset-and-sidebar-d.test.js`, `tests/base64-image-reference.test.js`, `tests/universe-character-route-whitelist.test.js`), `npm run test:mcp`, dan `npm run build`

### Tahap D — Kartu Menu, Deploy Dev & Uji Arka di Dev
- [x] Perbarui kartu `sot/menus/kartu/universes.md` dan `sot/menus/kartu/visual-identities.md`
- [x] Push `fitur/mcp-universe-character-lock` dan deploy atomic ke **Dev** (`npm run deploy:dev:atomic -- --ref <full-sha> --apply --confirm-dev`)
- [x] Verifikasi kesehatan Dev wajib SOP (`current`, manifest, HTTP 200 UI/API, PM2 online, `pm_cwd`, `PG_SEARCH_PATH=dev`, `PGPOOL_MAX=3`)
- [x] Cek alur Arka di Dev (read-only/uji kesiapan via API/MCP Dev; tidak membuat video sampel dan tidak generate gambar sendiri tanpa persetujuan pengguna) & laporkan ke pengguna

---

## Rancangan Perubahan Kode (Before & After)

### 1. `lib/reference-asset-repository.js` & `lib/universe-manifests.js` (0.1 B1 + 0.5 R1)

**Code Sebelum (Current/Before):**
```js
// lib/reference-asset-repository.js
export async function getApprovedReferenceAssetsForUniverse(universeId) {
  const tenantId = getActiveTenantId();
  const res = await pgQuery(
    `SELECT * FROM visual_reference_assets WHERE tenant_id = $1 AND universe_id = $2 AND status = 'approved'`,
    [tenantId, universeId]
  );
  return res.rows;
}

export async function approveReferenceAsset(id, review = {}, actor, ownerContext = null) {
  const tenantId = getActiveTenantId();
  const asset = await getReferenceAsset(id);
  if (!asset) throw new Error('Asset not found');
  if (asset.status !== 'draft') throw new Error('Only draft assets can be approved');
  validateApprovalAttestation(asset, review.attestation, ownerContext);
  return await withPgTransaction(async (client) => { /* ... */ });
}
```

**Code Sesudah (Proposed/After):**
```js
// lib/reference-asset-repository.js
export async function getApprovedReferenceAssetsForUniverse(universeId, tenantId = getActiveTenantId()) {
  const res = await pgQuery(
    `SELECT * FROM visual_reference_assets WHERE tenant_id = $1 AND universe_id = $2 AND status = 'approved'`,
    [tenantId, universeId]
  );
  return res.rows;
}

export async function approveReferenceAsset(id, review = {}, actor, ownerContext = null) {
  const tenantId = getActiveTenantId();
  const approvedAsset = await withPgTransaction(async (client) => {
    const locked = await client.query(
      'SELECT * FROM visual_reference_assets WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
      [id, tenantId]
    );
    const asset = locked.rows[0];
    if (!asset) { throw createCodedError('Asset not found', 'OWNER_NOT_FOUND', 404); }
    if (review.expected_sha256 && asset.sha256 !== review.expected_sha256) {
      throw createCodedError('Checksum mismatch', 'CHECKSUM_MISMATCH', 409);
    }
    if (asset.status === 'approved') return asset; // Idempotent
    if (asset.status !== 'draft') {
      throw createCodedError('Only draft assets can be approved', 'REVISION_CONFLICT', 409);
    }
    validateApprovalAttestation(asset, review.attestation, ownerContext);
    // Demote previous approved, promote current, dual-write legacy, catch 23505 -> REVISION_CONFLICT
  });
  if (approvedAsset?.universe_id) {
    await refreshManifestCache({ tenantId, universeId: approvedAsset.universe_id }).catch(() => {});
  }
  return approvedAsset;
}
```

```js
// lib/universe-manifests.js — buildManifestFromDb per character
const fabricatedPath = `/universe-assets/${profile.slug}/characters/${char.character_key}/v${char.version || 1}/identity-anchor.png`;
const identityAsset = charIdentityAsset
  ? { asset_id: charIdentityAsset.id, version: charIdentityAsset.version, sha256: charIdentityAsset.sha256, public_path: charIdentityAsset.public_path, source: 'approved_asset' }
  : (char.reference_image_path
      ? { public_path: char.reference_image_path, source: 'legacy_path' }
      : { public_path: fabricatedPath, source: 'fabricated_path' });
```

### 2. `lib/cartoon-reference-resolver.js`, `lib/opc-start-frame-request.js`, `lib/scheduler-processors.js` (0.4 B4)

**Code Sebelum (Current/Before):**
```js
// lib/cartoon-reference-resolver.js
// Tanpa cek character_lock_mode; prompt scan menerima semua karakter manifest;
// fallback ke 'si_wajan' & Object.keys(manifest.characters); gambar hilang hanya console.warn.
```

**Code Sesudah (Proposed/After):**
```js
// lib/cartoon-reference-resolver.js
const isStrictLock = viSubject.character_lock_mode === 'strict';
// Pada isStrictLock (async & sync):
// - Allowlist = viSubject.character_keys (harus non-empty & terdaftar di manifest)
// - Hanya kunci yang ada di allowlist yang diterima dari clipCharacters/voiceSegments/promptText
// - Jika kosong -> pakai kunci pertama allowlist di manifest (TANPA fallback si_wajan / Object.keys)
// - Jika identity_asset.source === 'fabricated_path' atau file gagal dimuat -> throw Error dengan err.code = 'REFERENCE_NOT_RESOLVED'
// - result.resolvedCharacterAssets = [{ character_key, asset_id, version, sha256, source, public_path }]
// Pada non-strict: perilaku 100% identik dengan sebelumnya.
```

### 3. `lib/auth.js` (0.6 B5)

**Code Sebelum (Current/Before):**
```js
// Operator token tidak memuat tenantDisabledMenus dan belum ada helper requireOperatorScope.
```

**Code Sesudah (Proposed/After):**
```js
export function hasOperatorScope(user, requiredScope) { ... }
export function requireOperatorScope(user, requiredScope) {
  // Jika user.isOperator dan bukan master dan tidak punya requiredScope -> 403 SCOPE_REQUIRED
}
export function assertUniverseManagerAccess(user, requiredScope = 'content:read') {
  // Cek tenantDisabledMenus.includes('universe_manager') -> 403, lalu requireOperatorScope
}
```

### 4. `lib/reference-asset-storage.js` & `lib/reference-asset-service.js` (0.7)

**Code Sebelum (Current/Before):**
```js
// uploadReferenceAsset langsung memanggil reserveReferenceAssetVersion tanpa dedup sha256 dan tanpa cek universe_id === owner.universe_id.
// processImageBuffer membaca width/height sharp tanpa batas dimensi.
```

**Code Sesudah (Proposed/After):**
```js
// lib/reference-asset-storage.js: validasi width <= 4096, height <= 4096, width * height <= 16_777_216 (UPLOAD_TOO_LARGE)
// lib/reference-asset-service.js:
// - Untuk owner_type === 'character': tolak jika universe_id dikirim dan !== owner.universe_id (400 UNIVERSE_MISMATCH); default owner.universe_id
// - Hitung sha256 sebelum reserveReferenceAssetVersion; bila sudah ada draft/approved dengan sha sama untuk owner/role sama -> kembalikan { ...existing, deduplicated: true }
```

### 5. Route Baru & Diperkeras (Tahap A) & 10 Tool MCP (Tahap B)

**Code Sebelum (Current/Before):**
- `app/api/v2/universe-profiles/[id]/characters/[charId]/route.js`: belum cek kepemilikan `universe_id`, belum whitelist, belum cek `expected_updated_at` / `CHARACTER_KEY_IN_USE` / scope / invalidasi cache.
- `app/api/v2/visual-identities/[id]/universe-link/route.js`: belum ada.
- `app/api/v2/reference-assets/character-lock-preflight/route.js`: belum ada.
- `apps/mcp/tools.mjs`: belum ada 10 tool Universe & Character Lock.

**Code Sesudah (Proposed/After):**
- Semua route menggunakan `assertUniverseManagerAccess(user, scope)`, menyertakan `tenant_id` di respons, dan memakai `{ success: false, error_code, error }` untuk seluruh kode error stabil (`TENANT_MISMATCH`, `OWNER_NOT_FOUND`, `UNIVERSE_MISMATCH`, `REVISION_CONFLICT`, `REFERENCE_NOT_APPROVED`, `REFERENCE_FILE_MISSING`, `CHECKSUM_MISMATCH`, `UPLOAD_TOO_LARGE`, `REFERENCE_NOT_RESOLVED`, `SCOPE_REQUIRED`, `CHARACTER_KEY_EXISTS`, `CHARACTER_KEY_IN_USE`).
- `apps/mcp/tools.mjs` mendaftarkan 10 tool baru dengan validasi `expected_tenant_id` sisi MCP sebelum request API dan pembatasan upload gambar.
