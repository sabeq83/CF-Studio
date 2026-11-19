# Implementation Plan — Bagian H: Hotfix Isolasi Tenant Universe (`hotfix/universe-tenant-isolation`)

- **Branch Kerja**: `hotfix/universe-tenant-isolation` (dari `main` @ `df4ed5a` / v2.56.0)
- **Acuan Instruksi**: `catatan-kerja/instruksi-agent/antigravity_mcp_universe_reference_manager_instructions.md`
- **Lingkup Hotfix (SOP Alur 2 — HANYA 0.2 & 0.3)**:
  1. **0.2 (B2) Isolasi Tenant Manifest**:
     - `getUniverseManifestAsync(slug, { forceRefresh, universeId, tenantId })`: cari by `universeId` lebih dulu; lookup slug wajib `WHERE slug = $1 AND tenant_id = $2` via `pgQuery` dengan tenant eksplisit (tidak bergantung pada interceptor di konteks `__none__`).
     - Kunci cache `${tenant_id}:${slug}` + indeks by ID; `_characterNameMap` per tenant (`Map<tenantId, map>`). Pertahankan fallback statis PawVille.
     - Resolver (`lib/cartoon-reference-resolver.js`) dan pemanggilnya meneruskan `tenantId` kampanye (`campaign.tenant_id` / `row.tenant_id`) ke manifest; snapshot kampanye (`universe_snapshot_json`) tetap diprioritaskan.
     - `refreshManifestCache()` dan pemanggilan argumen lama tetap bekerja; tambahkan `refreshManifestCache({ tenantId, universeId })` untuk invalidasi selektif entri terkait.
  2. **0.3 (B3) Hentikan Penimpaan ID & Whitelist Route Universe**:
     - `POST /api/v2/universe-profiles` dan `POST /api/v2/universe-profiles/[id]/characters` memakai whitelist field eksplisit dan meletakkan ID buatan server (`id`, `universe_id`) di posisi **terakhir**.
     - Validasi `character_key` dengan `/^[a-z0-9_]{2,64}$/`; konflik `(universe_id, character_key)` → HTTP 409 `CHARACTER_KEY_EXISTS` tanpa membocorkan error constraint database mentah.
     - Setelah create karakter, panggil invalidasi cache selektif (`refreshManifestCache({ tenantId, universeId })`).
- **Perubahan Database (Migrasi)**: **Tidak ada.**
- **Perubahan UI**: **Tidak ada.**
- **Tahap Berikutnya (Terpisah di Bagian F setelah Hotfix ter-merge ke `main`)**: `fitur/mcp-universe-character-lock` (0.1 B1, 0.4 B4, 0.5 R1, 0.6 B5, 0.7 upload dedup, Tahap A routes, Tahap B 10 tool MCP, Tahap C test, Tahap D deploy Dev & uji Arka).

---

## Hasil Audit Wajib pada `main` (`df4ed5a`)

| ID | File | Hasil Konfirmasi di `main` |
|---|---|---|
| B1 | `lib/universe-manifests.js` (:213, :226, :364) & `lib/reference-asset-repository.js` (:255) | **Terkonfirmasi.** `getApprovedReferenceAssetsForUniverse(profile.id)` dipanggil di dalam `tenantContext.run('__none__', ...)` sehingga `getActiveTenantId()` menghasilkan `'__none__'` dan query selalu kosong. (Ditangani di Bagian F.) |
| B2 | `lib/universe-manifests.js` (`loadManifestsFromDb`, `getUniverseManifestAsync`, `_manifestCache`, `_characterNameMap`) | **Terkonfirmasi.** Lookup slug dilakukan lebih dulu daripada `universeId` di konteks `'__none__'` (tanpa filter tenant), `_manifestCache` dikunci `slug` saja, dan `_characterNameMap` global lintas tenant. **(Ditangani di Hotfix ini — 0.2.)** |
| B3 | `app/api/v2/universe-profiles/route.js` (:33), `app/api/v2/universe-profiles/[id]/characters/route.js` (:36) | **Terkonfirmasi.** `{ id, ...body }` dan `{ id: charId, universe_id: id, ...body }` memungkinkan `body` menimpa `id` / `universe_id`; belum ada validasi format `character_key` maupun penanganan konflik 409 `CHARACTER_KEY_EXISTS`. **(Ditangani di Hotfix ini — 0.3.)** |
| B4 | `lib/cartoon-reference-resolver.js` (:264-315, :391+) | **Terkonfirmasi.** Scan prompt tanpa allowlist, fallback ke `'si_wajan'` / karakter pertama manifest, gambar hilang hanya `console.warn`. (Ditangani di Bagian F.) |
| B5 | `lib/auth.js` (`withTenantContext`, operator fallback) | **Terkonfirmasi.** Route Universe/aset hanya memakai `withTenantContext` tanpa cek scope operator (`content:read`/`content:create`/`content:approve`) dan tanpa cek `tenantDisabledMenus` untuk `universe_manager`. (Ditangani di Bagian F.) |
| R1 | `lib/reference-asset-repository.js` (:105-113) | **Terkonfirmasi.** Cek `asset.status !== 'draft'` dilakukan sebelum `withPgTransaction`, belum ada `FOR UPDATE`, cek `expected_sha256`, idempotency, atau pemetaan error `23505` → `REVISION_CONFLICT`. (Ditangani di Bagian F.) |
| R2 | `app/api/v2/universe-profiles/[id]/characters/[charId]/route.js` | **Catatan Audit Penting:** File `[charId]/route.js` **sudah ada** di `main` (GET/PUT/DELETE dasar), tetapi belum memverifikasi kepemilikan `universe_id`, belum memakai whitelist field/validasi `character_key` dipakai VI, belum mendukung `expected_updated_at`, belum menginvalidasi cache manifest, dan belum mengecek scope. Akan diperbarui pada Bagian F Tahap A. |
| R3 | `apps/mcp/tools.mjs` (`resolvePhotoInput` :8, `request` :296, `register` :362) | **Terkonfirmasi.** Pola `resolvePhotoInput`, `FormData` pada `request`, dan `x-tenant-override` tersedia dan siap dipakai di Bagian F Tahap B. |
| R4 | `lib/opc-start-frame-request.js` (:262-282), `lib/scheduler-processors.js` (:6506-6523) | **Terkonfirmasi.** `buildOpcStartFrameRequest` menangkap error resolver dan hanya `console.warn`; `scheduler-processors.js` belum menangani error khusus `REFERENCE_NOT_RESOLVED`. (Penanganan strict error di Bagian F; penerusan `tenantId` dikerjakan di Hotfix ini.) |

---

## Execution Task List

### Bagian H — Hotfix Isolasi Tenant (`hotfix/universe-tenant-isolation`)
- [x] Baca dokumen acuan, konfirmasi audit B1–B5 & R1–R4 pada `main`, dan buat branch `hotfix/universe-tenant-isolation`
- [x] **0.2 (B2)**: Perbarui `lib/universe-manifests.js` (lookup by `universeId` lebih dulu, lookup slug eksplisit `WHERE slug = $1 AND tenant_id = $2` via `pgQuery`, kunci cache `${tenant_id}:${slug}`, `_characterNameMap` per tenant `Map<tenantId, map>`, fallback statis PawVille tetap ada, `refreshManifestCache({ tenantId, universeId })` selektif + kompatibel argumen lama)
- [x] **0.2 (B2)**: Teruskan `tenantId` kampanye/konteks pada `lib/cartoon-reference-resolver.js`, `lib/opc-start-frame-request.js`, `lib/scheduler-processors.js`, `app/api/v2/cartoon-universe/manifest/route.js`, `app/api/v2/pillar-campaigns/items/[itemId]/regenerate-t2i/route.js`, dan `lib/pillar-campaign-ingest.js`
- [x] **0.3 (B3)**: Buat helper whitelist & validasi `lib/universe-route-validation.js`, lalu perbarui `app/api/v2/universe-profiles/route.js` dan `app/api/v2/universe-profiles/[id]/characters/route.js` (ID server terakhir, validasi `character_key`, konflik 409 `CHARACTER_KEY_EXISTS`, invalidasi cache 0.2 setelah create karakter)
- [x] Tambah unit test wajib:
  - `tests/universe-manifest-tenant-isolation.test.js` (B2: dua tenant slug sama tidak tertukar, lookup by ID dulu, `_characterNameMap` per tenant, `refreshManifestCache({ tenantId, universeId })` selektif, resolver meneruskan `tenantId`)
  - `tests/universe-character-route-whitelist.test.js` (B3: body tidak bisa menimpa `id`/`universe_id`/`tenant_id`, validasi format `character_key`, konflik 409 `CHARACTER_KEY_EXISTS` tanpa bocor error DB, invalidasi cache dipanggil)
- [x] Jalankan seluruh test wajib + regresi (`tests/test-cartoon-*.mjs`, `tests/reference-asset-and-sidebar-d.test.js`, `tests/base64-image-reference.test.js`) dan `npm run build`
- [x] Commit dan push branch `hotfix/universe-tenant-isolation`
- [ ] **🛑 BERHENTI**: Laporkan hasil ke pengguna (bahasa sederhana, tanpa perubahan DB) dan minta persetujuan untuk merge ke `main`, rilis patch + perbarui `sot/menus/kartu/universes.md`, dan deploy ke Staging

---

## Rancangan Perubahan Kode (Before & After)

### 1. Modifikasi — `lib/universe-manifests.js`

**Code Sebelum (Current/Before):**
```js
let _manifestCache = null;       // { pawville: {...}, kitchentails: {...} }
let _characterNameMap = null;    // { 'mochi': 'mochi', 'dr. paw': 'dr_paw', ... }
let _cacheReady = false;
let _cacheLoadPromise = null;

// ...
export async function getUniverseManifestAsync(universeProfile, { forceRefresh = false, universeId = null } = {}) {
  // ...
  let profile = cleanProfile
    ? await tenantContext.run('__none__', () => getUniverseProfileBySlug(cleanProfile))
    : null;
  if (!profile && universeId) {
    profile = await tenantContext.run('__none__', () => getUniverseProfile(universeId));
  }
  if (profile) {
    // ...
    _manifestCache[String(profile.slug || cleanProfile).toLowerCase()] = manifest;
    if (!_characterNameMap) _characterNameMap = buildCharacterNameMap(characters || []);
    return manifest;
  }
}

export async function refreshManifestCache() {
  _cacheLoadPromise = loadManifestsFromDb();
  await _cacheLoadPromise;
}
```

**Code Sesudah (Proposed/After):**
```js
import { getActiveTenantId, tenantContext } from './tenant-context.js';

let _manifestCache = null;         // { '<tenantId>:<slug>': manifest }
let _manifestById = new Map();     // Map<universeId, { tenantId, slug, cacheKey, manifest }>
let _characterNameMap = new Map(); // Map<tenantId, { 'name': 'character_key' }>
let _cacheReady = false;
let _cacheLoadPromise = null;

// Lookup order in getUniverseManifestAsync(universeProfile, { forceRefresh = false, universeId = null, tenantId = null }):
// 1. If universeId is present, query by ID FIRST via pgQuery (with tenant_id filter when tenantId/active context is known).
// 2. Otherwise query by slug with explicit tenant_id:
//    SELECT * FROM universe_profiles WHERE slug = $1 AND tenant_id = $2 LIMIT 1
// 3. Cache under `${profileTenantId}:${profileSlug}` and index by `profile.id`,
//    update `_characterNameMap` ONLY for `profileTenantId`.
// 4. Preserve PAWVILLE_STATIC_FALLBACK for slug 'pawville'.
// 5. refreshManifestCache(options):
//    - If options is { tenantId, universeId }, evict only matching cache entries & tenant name map.
//    - Otherwise (no args or legacy string arg), reload all manifests from DB.
```

### 2. Modifikasi — `lib/cartoon-reference-resolver.js` & Pemanggilnya

**Code Sebelum (Current/Before):**
```js
// lib/cartoon-reference-resolver.js
export async function resolveClipReferenceImagesAsync({
  contentWorld,
  universeProfile,
  universeProfileId = null,
  universeSnapshot,
  // ...
}) {
  // ...
  let manifest = universeSnapshot?.manifest;
  if (!manifest && (effectiveUniverseSlug || effectiveUniverseId)) {
    manifest = await getUniverseManifestAsync(effectiveUniverseSlug, {
      forceRefresh: true,
      universeId: effectiveUniverseId
    });
  }
  if (!manifest && effectiveUniverseSlug) {
    manifest = getUniverseManifest(effectiveUniverseSlug);
  }
```

**Code Sesudah (Proposed/After):**
```js
// lib/cartoon-reference-resolver.js
export async function resolveClipReferenceImagesAsync({
  contentWorld,
  universeProfile,
  universeProfileId = null,
  tenantId = null,
  universeSnapshot,
  // ...
}) {
  // ...
  let manifest = universeSnapshot?.manifest;
  if (!manifest && (effectiveUniverseSlug || effectiveUniverseId)) {
    manifest = await getUniverseManifestAsync(effectiveUniverseSlug, {
      forceRefresh: true,
      universeId: effectiveUniverseId,
      tenantId
    });
  }
  if (!manifest && effectiveUniverseSlug) {
    manifest = getUniverseManifest(effectiveUniverseSlug, { tenantId });
  }
```
*(Pola yang sama diterapkan pada `resolveClipReferenceImages` sync serta pemanggil di `lib/opc-start-frame-request.js`, `lib/scheduler-processors.js`, `app/api/v2/cartoon-universe/manifest/route.js`, `app/api/v2/pillar-campaigns/items/[itemId]/regenerate-t2i/route.js`, dan `lib/pillar-campaign-ingest.js`.)*

### 3. Baru — `lib/universe-route-validation.js`

**Code Sebelum (Current/Before):**
*(Belum ada; route melakukan spread `...body` langsung setelah ID server tanpa whitelist maupun validasi `character_key`.)*

**Code Sesudah (Proposed/After):**
```js
export const CHARACTER_KEY_REGEX = /^[a-z0-9_]{2,64}$/;
export const ALLOWED_UNIVERSE_PROFILE_FIELDS = [ /* daftar eksplisit kolom profil tanpa id/tenant_id */ ];
export const ALLOWED_UNIVERSE_CHARACTER_FIELDS = [ /* daftar eksplisit kolom karakter tanpa id/universe_id/tenant_id */ ];

export function pickAllowedFields(body, allowedFields) { ... }
export function validateCharacterKey(key) { ... }
export function buildCreateUniverseProfilePayload(body, id) {
  return { ...pickAllowedFields(body, ALLOWED_UNIVERSE_PROFILE_FIELDS), id };
}
export function buildCreateUniverseCharacterPayload(body, charId, universeId) {
  return { ...pickAllowedFields(body, ALLOWED_UNIVERSE_CHARACTER_FIELDS), id: charId, universe_id: universeId };
}
export function isCharacterKeyConflictError(err) { ... }
```

### 4. Modifikasi — `app/api/v2/universe-profiles/route.js` & `app/api/v2/universe-profiles/[id]/characters/route.js`

**Code Sebelum (Current/Before):**
```js
// app/api/v2/universe-profiles/route.js
const id = uuidv4();
await createUniverseProfile({ id, ...body });

// app/api/v2/universe-profiles/[id]/characters/route.js
const charId = uuidv4();
await createUniverseCharacter({ id: charId, universe_id: id, ...body });
```

**Code Sesudah (Proposed/After):**
```js
// app/api/v2/universe-profiles/route.js
const id = uuidv4();
await createUniverseProfile(buildCreateUniverseProfilePayload(body, id));

// app/api/v2/universe-profiles/[id]/characters/route.js
if (!validateCharacterKey(body.character_key)) {
  return Response.json({ success: false, error_code: 'INVALID_CHARACTER_KEY', error: 'character_key must match /^[a-z0-9_]{2,64}$/.' }, { status: 400 });
}
const existingChars = await getUniverseCharacters(id);
if ((existingChars || []).some(c => c.character_key === body.character_key)) {
  return Response.json({ success: false, error_code: 'CHARACTER_KEY_EXISTS', error: 'Character key already exists in this universe.' }, { status: 409 });
}
const charId = uuidv4();
try {
  await createUniverseCharacter(buildCreateUniverseCharacterPayload(body, charId, id));
} catch (err) {
  if (isCharacterKeyConflictError(err)) {
    return Response.json({ success: false, error_code: 'CHARACTER_KEY_EXISTS', error: 'Character key already exists in this universe.' }, { status: 409 });
  }
  throw err;
}
await refreshManifestCache({ tenantId: user?.tenantId || universe.tenant_id, universeId: id });
```
