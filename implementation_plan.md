# Implementation Plan: Distribusi CF Studio MCP ke PC Lain dengan Privilege Tenant Terbatas yang Dapat Diedit

**Sumber Usulan:** [usulan-cf-studio-mcp-multi-pc-tenant-terbatas.md](file:///Users/sabeqmmursyid/cf-autopipeline/usulan-cf-studio-mcp-multi-pc-tenant-terbatas.md)  
**Target Branch Kerja:** `fitur/mcp-multi-pc-tenant-terbatas` (dibuat dari `main` sesuai SOP Alur 1 — Fitur Baru)  
**Lingkungan Uji Target:** Server **Dev (`5020`/`7020`)** terlebih dahulu sebelum naik ke Staging (`5010`/`7010`).

> [!WARNING]
> **Catatan Migrasi Database & Keamanan:**
> 1. **Migrasi Database (`operator_credentials`):** Fitur ini menambahkan 5 kolom baru (`allowed_tenant_ids_json`, `allowed_tools_json`, `expires_at`, `last_used_at`, `notes`) menggunakan `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` di `lib/db-pg.js` (`migrateTenantControlPlane`). Rollback kode/filesystem tidak menghapus kolom DB, sehingga wajib dikonfirmasi sebelum naik ke Staging.
> 2. **Zero Secret Exposure:** Token mentah (`cfop_<64_hex>`) hanya ditampilkan **1 kali** saat pembuatan atau rotasi kredensial di UI/API, tidak pernah disimpan dalam bentuk plaintext (hanya SHA-256 `token_hash`), dan seluruh contoh di mockup/test memakai placeholder netral (`cfop_SAMPLE_TOKEN_PLACEHOLDER_...`).
> 3. **Isolasi File Host di Remote HTTP:** Pada mode Remote Streamable HTTP (`isRemoteHttp: true`), parameter `file_path` (`cf_upload_reference_asset`) dan `photo_file_path` (`cf_add_product`, `cf_upload_product_photo`) wajib ditolak dengan `VALIDATION_ERROR` agar klien remote tidak dapat membaca filesystem host server MCP.
> 4. **Admin API Eksklusif Web Session Superadmin:** Seluruh endpoint `/api/v2/operator-credentials*` hanya boleh diakses oleh sesi web `role === 'superadmin'` (`!user.isOperator`). Token operator/MCP dilarang keras mengelola kredensial.

---

## Ringkasan Celah Hasil Audit Codebase

1. **Akses Tenant Biner (`lib/operator-auth.js` & `lib/auth.js`):** Non-master terkunci pada 1 `tenant_id` (header `X-Tenant-Override` diabaikan diam-diam alih-alih ditolak `403 TENANT_FORBIDDEN`), sedangkan master bebas ke semua tenant. Belum ada `allowed_tenant_ids_json`, validasi `expires_at`, atau update `last_used_at`.
2. **Error Propagation di `withTenantContext` (`lib/auth.js`):** Saat ini `getCurrentUserAsync` menelan error di blok `catch` dan mengembalikan `null`, sehingga penolakan tenant terlarang (`403 TENANT_FORBIDDEN`) tidak bisa muncul sebagai `403` melainkan jatuh ke `401 Unauthorized` atau silent fallback.
3. **Scope Guard pada Route `/api/v2/*` (`lib/auth.js`):** Route `/api/operator/v1/*` dan `/api/operator/v2/*` sudah memeriksa scope via `authenticateOperator(request, scope)`, namun route `/api/v2/*` yang dipanggil oleh MCP (mis. `POST /api/v2/recipes/auto-pipeline-schedules`, `POST /api/v2/recipes/autonomous-pipeline`, dll.) memakai `withTenantContext` yang belum memeriksa `user.scopes` operator -> token `Viewer` bisa lolos melakukan mutasi!
4. **Filter Tenant di `GET /api/v2/tenants` (`app/api/v2/tenants/route.js`):** Saat ini non-master hanya mengembalikan `WHERE id = $1` (`user.tenantId`), belum mengembalikan seluruh tenant aktif dalam `allowedTenantIds` milik kredensial tersebut.
5. **Bearer Per-Operator di `/mcp` (`apps/mcp/server.mjs`):** `app.use('/mcp')` hanya menerima `?token=...` atau satu env statis `CF_STUDIO_MCP_BEARER_TOKEN`; header `Authorization: Bearer cfop_...` dari PC lain ditolak `401`.
6. **File Path Leak di Remote MCP (`apps/mcp/tools.mjs`):** `resolveReferenceAssetUploadInput` (`file_path`) dan `resolvePhotoInput` (`photo_file_path`) belum memiliki guard `isRemoteHttp`.
7. **Belum Ada UI & API Admin Manajemen Akses MCP:** Belum ada halaman `Settings -> Akses MCP & Operator` (`/settings/mcp-access`) dan API `/api/v2/operator-credentials`.

---

## Execution Task List

### Tahap 0 — Persiapan Branch Fitur
- [x] Pastikan working tree bersih, pindah ke `main` terbaru (`git checkout main && git pull`), lalu buat branch fitur `fitur/mcp-multi-pc-tenant-terbatas`

### Tahap 1 — Mockup HTML Interaktif & Review Pengguna (WAJIB Sebelum Edit Backend & UI Utama)
- [x] Konfirmasi mode `antislop` (`During` / `After`) bersama pengguna sebelum menyusun mockup
- [x] Buat standalone mockup HTML [public/mockup_mcp_access_management.html](file:///Users/sabeqmmursyid/_cfstudio/public/mockup_mcp_access_management.html) memakai 100% Semantic CSS Design Tokens (`app/theme.css`) dengan dukungan Light/Dark Mode penuh, mencakup:
  - Ringkasan status endpoint Remote MCP & daftar PC/Operator (`badge` tenant allowlist, profil scope, status aktif/revoked/expired, `last_used_at`)
  - Modal **Tambah PC / Token Baru** (pilih default tenant, multi-select tenant allowlist, preset scope 1-klik + checklist scope, optional `allowed_tools` restriction, `expires_at`, catatan)
  - Modal **Token Sekali Tampil + Copy Snippet JSON MCP** (`Streamable HTTP` via Tailscale/HTTPS & `stdio`) dengan placeholder aman
  - Modal **Edit Akses Real-Time** (tambah/kurangi tenant & scope tanpa mengubah token) serta tombol **Rotate Token**, **Revoke/Aktifkan**, dan **Hapus**
  - State kosong (*empty*), *loading*, dan *error*
- [x] Sajikan mockup lokal (via `http://127.0.0.1:4299/mockup_mcp_access_management.html`) dan minta persetujuan pengguna sebelum lanjut ke Tahap 2

### Tahap 2 — Migrasi Schema Database & Shared Auth / Tenant Allowlist / Scope Guard
- [x] Tambahkan kolom `allowed_tenant_ids_json`, `allowed_tools_json`, `expires_at`, `last_used_at`, dan `notes` ke tabel `operator_credentials` di `migrateTenantControlPlane` ([lib/db-pg.js](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js))
- [x] Perbarui [lib/operator-auth.js](file:///Users/sabeqmmursyid/_cfstudio/lib/operator-auth.js):
  - Tambah helper terpadu `resolveOperatorCredentialAccess(credential, overrideReq)` (parsing `allowed_tenant_ids_json` & `allowed_tools_json`, validasi `expires_at` -> `401 OPERATOR_TOKEN_EXPIRED`, validasi `X-Tenant-Override`/`X-Tenant-Id` -> `403 TENANT_FORBIDDEN` bila di luar allowlist atau tenant tidak aktif)
  - Tambah throttled update `last_used_at` (maksimal 1x per 5 menit per `credential.id`)
  - Tambah helper `resolveRequiredOperatorScopeForRequest(request)` untuk route `/api/v2/*` & `/api/content-flow*`
- [x] Perbarui [lib/auth.js](file:///Users/sabeqmmursyid/_cfstudio/lib/auth.js):
  - Gunakan helper dari `lib/operator-auth.js` di `getCurrentUserAsync` (tanpa duplikasi query/logika allowlist)
  - Ekspos `allowedTenantIds` & `allowedTools` pada `userFromToken`, dan teruskan `OperatorAuthError` (`403 TENANT_FORBIDDEN`, `401 OPERATOR_TOKEN_EXPIRED`) ke `withTenantContext` tanpa silent fallback
  - Terapkan pengecekan scope operator di `withTenantContext` (`403 OPERATOR_SCOPE_FORBIDDEN`), sembari mempertahankan `error_code: 'SCOPE_REQUIRED'` di `requireOperatorScope` untuk kompatibilitas `tests/universe-character-route-whitelist.test.js`
- [x] Perbarui [app/api/v2/tenants/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/tenants/route.js) agar operator terbatas menerima **hanya** daftar tenant aktif dalam `user.allowedTenantIds` (dan perbarui `/api/operator/v1/whoami` & `/api/operator/v2/whoami` agar mengembalikan `allowed_tenants`, `allowed_tools`, dan `expires_at`)

### Tahap 3 — Remote MCP HTTP Server & Isolasi Keamanan Tool (`apps/mcp/`)
- [x] Perbarui [apps/mcp/server.mjs](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/server.mjs):
  - Terima `Authorization: Bearer <token>` per-operator di `/mcp` (jika bukan `CF_STUDIO_MCP_BEARER_TOKEN` statis dan panjang `>= 24` atau berawalan `cfop_`, teruskan sebagai `operatorClient({ baseUrl, token })`)
  - Teruskan `{ isRemoteHttp: true }` ke `createCfStudioServer(clientRequest, { isRemoteHttp: true })` pada seluruh handler HTTP (`/mcp` dan `/u/:token`), sementara mode `--stdio` tetap `isRemoteHttp: false`
- [x] Perbarui [apps/mcp/tools.mjs](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/tools.mjs):
  - Terima opsi `{ isRemoteHttp = false }` di `createCfStudioServer`
  - Tolak `file_path` di `resolveReferenceAssetUploadInput` dan `photo_file_path` di `resolvePhotoInput` dengan error `VALIDATION_ERROR` saat `isRemoteHttp === true`
  - Terapkan enforcement `allowed_tools` opsional dari `/api/operator/v1/whoami` (jika array non-null, tolak pemanggilan tool di luar daftar dengan `TOOL_FORBIDDEN`)
  - Perbarui `cf_switch_tenant` agar meneruskan `code`/`error_code` (`TENANT_FORBIDDEN`) secara jelas saat server menolak perpindahan tenant

### Tahap 4 — Backend Admin Service & API Manajemen Kredensial Operator
- [x] Buat helper server [lib/operator-credentials-admin.js](file:///Users/sabeqmmursyid/_cfstudio/lib/operator-credentials-admin.js):
  - Definisi preset privilege (`viewer`, `content_operator`, `full_tenant_operator`, `master_superadmin`) dan daftar scope yang tersedia
  - Validasi input (nama, `tenant_id` aktif, `allowed_tenant_ids`, `scopes`, `allowed_tools`, `expires_at`, `status`)
  - Generator token aman `cfop_${crypto.randomBytes(32).toString('hex')}` + SHA-256 `token_hash`
  - Pencatatan audit ke `tenant_audit_events` (`operator_credential.created`, `updated`, `rotated`, `deleted`)
- [x] Buat endpoint API khusus web session `superadmin`:
  - `GET` & `POST` [app/api/v2/operator-credentials/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/operator-credentials/route.js)
  - `PATCH` & `DELETE` [app/api/v2/operator-credentials/[id]/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/operator-credentials/[id]/route.js)
  - `POST` [app/api/v2/operator-credentials/[id]/rotate/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/operator-credentials/[id]/rotate/route.js)

### Tahap 5 — Halaman UI `Settings -> Akses MCP & Operator` & Navigasi Sidebar
- [x] Buat halaman [app/settings/mcp-access/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/settings/mcp-access/page.js) sesuai mockup HTML yang disetujui pengguna, memakai 100% semantic CSS tokens `app/theme.css` (Light & Dark Mode)
- [x] Daftarkan `/settings/mcp-access` (`superadminOnly: true`, kunci `superadmin_only`) di [lib/sidebar-nav.js](file:///Users/sabeqmmursyid/_cfstudio/lib/sidebar-nav.js) dan `SYSTEM` section di [app/components/Sidebar.js](file:///Users/sabeqmmursyid/_cfstudio/app/components/Sidebar.js)

### Tahap 6 — Pengujian Komprehensif, Build Aman & Deploy ke Dev (`5020`/`7020`)
- [x] Tambah unit/integration test baru [tests/mcp-multi-pc-tenant-scope.test.js](file:///Users/sabeqmmursyid/_cfstudio/tests/mcp-multi-pc-tenant-scope.test.js) dan perluas [apps/mcp/test/mcp.test.mjs](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/test/mcp.test.mjs) mencakup seluruh 8 skenario penerimaan di dokumen usulan (allowlist `cf_list_tenants`, `cf_switch_tenant`, `403 TENANT_FORBIDDEN`, edit real-time, `401` revoked/expired, `403 OPERATOR_SCOPE_FORBIDDEN` untuk Viewer di `cf_create_schedule`, blokir `file_path` & `photo_file_path` di HTTP mode, kompatibilitas master superadmin & Bearer `/mcp`)
- [x] Jalankan seluruh test relevan dengan `PG_SEARCH_PATH=dev`:
  - `PG_SEARCH_PATH=dev npm run test:mcp`
  - `PG_SEARCH_PATH=dev node --test tests/mcp-multi-pc-tenant-scope.test.js tests/cf-studio-mcp-auth-bridge.test.js tests/universe-character-route-whitelist.test.js tests/hermes-token-rotation.test.js`
  - `DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build`
- [x] Perbarui dokumentasi ([apps/mcp/README.md](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/README.md), [sot/menus/kartu/users-tenants.md](file:///Users/sabeqmmursyid/_cfstudio/sot/menus/kartu/users-tenants.md), [sot/menus/_PETA_MENU.md](file:///Users/sabeqmmursyid/_cfstudio/sot/menus/_PETA_MENU.md), dan tambah kartu [mcp-access.md](file:///Users/sabeqmmursyid/_cfstudio/sot/menus/kartu/mcp-access.md))
- [x] Commit & push branch `fitur/mcp-multi-pc-tenant-terbatas` (tanpa `npm run release`), lalu deploy atomic ke **Dev** (`npm run deploy:dev:atomic -- --ref <full-git-sha> --apply --confirm-dev`) dan serahkan daftar uji manual kepada pengguna
- [ ] *(Menunggu persetujuan eksplisit pengguna setelah uji Dev)*: Merge ke `main`, jalankan `npm run release-non-interactive -- --type minor ...`, dan deploy ke Staging

---

## Rencana Perbaikan Bug Uji Dev: Tombol Salin Token, URL MCP & JSON Config Tidak Berfungsi di HTTP Non-Localhost

### Akar Masalah
1. **Tidak Ada Fallback `document.execCommand('copy')` untuk Origin HTTP Non-Localhost (`http://100.95.245.55:5020`):**
   - Browser modern hanya menyediakan `navigator.clipboard` pada *Secure Context* (`https://`, `http://localhost`, atau `http://127.0.0.1`). Saat halaman diakses via IP Tailscale (`http://100.95.245.55:5020/settings/mcp-access`), `navigator.clipboard` bernilai `undefined` sehingga `copyToClipboard()` tidak menyalin apa pun.
2. **Tidak Ada Umpan Balik Langsung di Dalam Modal & Penanganan Kegagalan:**
   - Banner `feedback` hanya tampil di belakang modal (`zIndex: 1000`), sehingga saat pengguna menekan **Salin Token** atau **Salin JSON Config** di dalam modal, tidak terlihat perubahan status berhasil/gagal pada tombol atau di dalam modal.
   - Jika kedua jalur penyalinan (`navigator.clipboard` maupun `document.execCommand('copy')`) ditolak browser, sistem tetap menampilkan seolah berhasil alih-alih memberi pesan error dan memudahkan seleksi teks manual.

### Execution Task List (Perbaikan Salin Clipboard)
- [x] **Tahap P1 — Perbarui Mockup HTML** ([public/mockup_mcp_access_management.html](file:///Users/sabeqmmursyid/_cfstudio/public/mockup_mcp_access_management.html)): tambahkan fallback `document.execCommand('copy')` yang aman untuk non-HTTPS + indikator `"Tersalin!"` langsung pada tombol modal/endpoint.
- [x] **Tahap P2 — Perbaiki `copyToClipboard` & Feedback Modal** ([app/settings/mcp-access/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/settings/mcp-access/page.js)):
  - Gunakan `navigator.clipboard.writeText` (jika `window.isSecureContext && navigator?.clipboard?.writeText`), dengan fallback `textarea` (`position: fixed`, `opacity: 0`, `select()`, `setSelectionRange(0, text.length)`, `document.execCommand('copy')`) yang memeriksa nilai balik boolean `true`/`false`.
  - Tampilkan status langsung di tombol yang diklik (`copiedKey`: `'endpoint' | 'token' | 'config'`) berupa teks `"Tersalin"` selama 2 detik, serta banner status di dalam modal (`modalFeedback`) bila sukses atau gagal agar terlihat tanpa menutup modal.
  - Jadikan `<code className="mcp-code-inline">` / `<pre>` memakai `userSelect: 'all'` pada token agar mudah di-select manual bila browser memblokir clipboard.
- [x] **Tahap P3 — Verifikasi Build, Commit, Push & Deploy Ulang Dev (`5020`/`7020`)**:
  - Jalankan `DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build`.
  - Commit & push ke `fitur/mcp-multi-pc-tenant-terbatas`, lalu `npm run deploy:dev:atomic -- --ref <full-git-sha> --apply --confirm-dev` dan cek `HTTP 200` + PM2 online.

### Detail Perubahan Kode (Before & After)

#### [app/settings/mcp-access/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/settings/mcp-access/page.js)

**Code Sebelum (Current/Before):**
```js
  const [configModal, setConfigModal] = useState({ open: false, cred: null, plainToken: null });
  const [configClientMode, setConfigClientMode] = useState('http');
  const [configHostUrl, setConfigHostUrl] = useState('http://100.95.245.55:7030/mcp');
```
```js
  function copyToClipboard(text, message) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setFeedback({ message, isSuccess: true });
  }
```
```jsx
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ minHeight: 38, padding: '6px 12px', cursor: 'pointer' }}
                          onClick={() => copyToClipboard(configModal.plainToken, 'Token operator disalin ke clipboard.')}
                        >
                          Salin Token
                        </button>
```
```jsx
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ minHeight: 44, cursor: 'pointer' }}
                  onClick={() => copyToClipboard(mcpConfigJsonText, 'Snippet JSON MCP berhasil disalin ke clipboard.')}
                >
                  Salin JSON Config
                </button>
```

**Code Sesudah (Proposed/After):**
```js
  const [configModal, setConfigModal] = useState({ open: false, cred: null, plainToken: null });
  const [configClientMode, setConfigClientMode] = useState('http');
  const [configHostUrl, setConfigHostUrl] = useState('http://100.95.245.55:7030/mcp');
  const [copiedKey, setCopiedKey] = useState('');
  const [modalCopyFeedback, setModalCopyFeedback] = useState({ message: '', isError: false });
```
```js
  function fallbackCopyText(text, containerEl = null) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '1px';
    textarea.style.height = '1px';
    textarea.style.opacity = '0';
    const mountTarget = containerEl || document.body;
    mountTarget.appendChild(textarea);
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } finally {
      mountTarget.removeChild(textarea);
    }
    return copied;
  }

  async function copyToClipboard(text, message, key = '', containerEl = null) {
    let copied = false;
    if (typeof window !== 'undefined' && window.isSecureContext && navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        copied = false;
      }
    }
    if (!copied && typeof document !== 'undefined') {
      try {
        copied = fallbackCopyText(text, containerEl);
      } catch {
        copied = false;
      }
    }
    if (copied) {
      if (key) {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(prev => (prev === key ? '' : prev)), 2000);
      }
      if (configModal.open) {
        setModalCopyFeedback({ message, isError: false });
      }
      setFeedback({ message, isSuccess: true });
    } else {
      const errMsg = 'Browser memblokir salin otomatis pada HTTP non-localhost. Silakan blok teks lalu salin manual (Cmd+C / Ctrl+C).';
      if (configModal.open) {
        setModalCopyFeedback({ message: errMsg, isError: true });
      }
      setFeedback({ message: errMsg, isSuccess: false });
    }
  }
```
```jsx
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ minHeight: 38, padding: '6px 12px', cursor: 'pointer' }}
                          onClick={e => copyToClipboard(configModal.plainToken, 'Token operator disalin ke clipboard.', 'token', e.currentTarget.closest('[role="dialog"]'))}
                        >
                          {copiedKey === 'token' ? 'Tersalin!' : 'Salin Token'}
                        </button>
```
```jsx
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ minHeight: 44, cursor: 'pointer' }}
                  onClick={e => copyToClipboard(mcpConfigJsonText, 'Snippet JSON MCP berhasil disalin ke clipboard.', 'config', e.currentTarget.closest('[role="dialog"]'))}
                >
                  {copiedKey === 'config' ? 'JSON Tersalin!' : 'Salin JSON Config'}
                </button>
```

---

## Detail Perubahan Kode (Before & After)

### 1. [lib/db-pg.js](file:///Users/sabeqmmursyid/_cfstudio/lib/db-pg.js) (`migrateTenantControlPlane`)

**Code Sebelum (Current/Before):**
```js
        await pool.query(`
          CREATE TABLE IF NOT EXISTS operator_credentials (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            token_hash TEXT UNIQUE NOT NULL,
            scopes TEXT NOT NULL DEFAULT 'content:create,content:read,content:approve',
            status TEXT NOT NULL DEFAULT 'active',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS users_tenant_idx ON users (tenant_id);`);
```

**Code Sesudah (Proposed/After):**
```js
        await pool.query(`
          CREATE TABLE IF NOT EXISTS operator_credentials (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            token_hash TEXT UNIQUE NOT NULL,
            scopes TEXT NOT NULL DEFAULT 'content:create,content:read,content:approve',
            status TEXT NOT NULL DEFAULT 'active',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await pool.query(`
          ALTER TABLE operator_credentials
            ADD COLUMN IF NOT EXISTS allowed_tenant_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
            ADD COLUMN IF NOT EXISTS allowed_tools_json JSONB,
            ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS notes TEXT;
        `);
        await pool.query(`CREATE INDEX IF NOT EXISTS users_tenant_idx ON users (tenant_id);`);
```

---

### 2. [lib/operator-auth.js](file:///Users/sabeqmmursyid/_cfstudio/lib/operator-auth.js)

**Code Sebelum (Current/Before):**
```js
  const tokenHash = crypto.createHash('sha256').update(suppliedToken).digest('hex');
  const credentialResult = await pgQuery(`
    SELECT c.id, c.tenant_id, c.name, c.scopes
    FROM operator_credentials c
    JOIN tenants t ON t.id = c.tenant_id
    WHERE c.token_hash = $1 AND c.status = 'active' AND t.status = 'active'
    LIMIT 1
  `, [tokenHash]);
  let identity;
  if (credentialResult.rowCount > 0) {
    const credential = credentialResult.rows[0];
    const scopes = credential.scopes.split(',').map(value => value.trim());
    let effectiveTenantId = credential.tenant_id;

    // Dukungan Master Operator / Tenant Override (X-Tenant-Override atau X-Tenant-Id)
    const isMaster = scopes.includes('tenant:superadmin') || scopes.includes('system:admin') || credential.tenant_id === '*';
    const overrideReq = request?.headers?.get?.('x-tenant-override') || request?.headers?.get?.('x-tenant-id');
    if (isMaster && overrideReq) {
      const tenantMatch = await pgQuery(
        `SELECT id FROM tenants WHERE (id = $1 OR slug = $1) AND status = 'active' LIMIT 1`,
        [overrideReq.trim()]
      );
      if (tenantMatch.rowCount > 0) {
        effectiveTenantId = tenantMatch.rows[0].id;
      }
    }

    identity = { tenantId: effectiveTenantId, actor: credential.id, name: credential.name, scopes };
  } else {
```

**Code Sesudah (Proposed/After):**
```js
const LAST_USED_TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const lastUsedTouchCache = new Map();

export function parseJsonArrayColumn(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.map(v => String(v || '').trim()).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(v => String(v || '').trim()).filter(Boolean) : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function touchCredentialLastUsed(credentialId) {
  if (!credentialId) return;
  const now = Date.now();
  const prev = lastUsedTouchCache.get(credentialId) || 0;
  if (now - prev < LAST_USED_TOUCH_INTERVAL_MS) return;
  lastUsedTouchCache.set(credentialId, now);
  pgQuery('UPDATE operator_credentials SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1', [credentialId]).catch(() => {});
}

export async function resolveOperatorCredentialAccess(credential, overrideReqRaw = null) {
  if (credential.expires_at && new Date(credential.expires_at) < new Date()) {
    throw new OperatorAuthError('Token operator sudah kedaluwarsa.', 'OPERATOR_TOKEN_EXPIRED', 401);
  }
  const scopes = String(credential.scopes || '').split(',').map(v => v.trim()).filter(Boolean);
  const isMaster = scopes.includes('tenant:superadmin') || scopes.includes('system:admin') || scopes.includes('*') || credential.tenant_id === '*';
  const extraTenants = parseJsonArrayColumn(credential.allowed_tenant_ids_json) || [];
  const rawAllowedIds = Array.from(new Set([credential.tenant_id, ...extraTenants].filter(v => v && v !== '*')));

  let allowedTenantIds = rawAllowedIds;
  if (!isMaster && rawAllowedIds.length > 0) {
    const activeRes = await pgQuery(
      `SELECT id FROM tenants WHERE id = ANY($1::text[]) AND status = 'active'`,
      [rawAllowedIds]
    );
    allowedTenantIds = activeRes.rows.map(r => r.id);
  }

  let effectiveTenantId = credential.tenant_id;
  const overrideReq = String(overrideReqRaw || '').trim();
  if (overrideReq) {
    const tenantMatch = await pgQuery(
      `SELECT id FROM tenants WHERE (id = $1 OR slug = $1) AND status = 'active' LIMIT 1`,
      [overrideReq]
    );
    if (isMaster) {
      if (tenantMatch.rowCount > 0) {
        effectiveTenantId = tenantMatch.rows[0].id;
      }
    } else {
      const matchedId = tenantMatch.rows[0]?.id || null;
      if (!matchedId || !allowedTenantIds.includes(matchedId)) {
        throw new OperatorAuthError(
          'Akses ke tenant ini tidak diizinkan untuk kredensial Anda.',
          'TENANT_FORBIDDEN',
          403
        );
      }
      effectiveTenantId = matchedId;
    }
  }

  const allowedTools = parseJsonArrayColumn(credential.allowed_tools_json);
  touchCredentialLastUsed(credential.id);

  return {
    tenantId: effectiveTenantId,
    defaultTenantId: credential.tenant_id,
    actor: credential.id,
    name: credential.name,
    scopes,
    isMaster,
    allowedTenantIds,
    allowedTools,
    expiresAt: credential.expires_at || null
  };
}

export function resolveRequiredOperatorScopeForRequest(request) {
  let pathname = '';
  try {
    pathname = new URL(request?.url || 'http://localhost').pathname;
  } catch {
    pathname = '';
  }
  const method = String(request?.method || 'GET').toUpperCase();
  if (pathname === '/api/v2/tenants') return null;

  if (method === 'GET' || method === 'HEAD') {
    return ['content:read', 'automation:read'];
  }
  if (pathname.startsWith('/api/v2/recipes/auto-pipeline-schedules') || pathname.startsWith('/api/v2/recipes/autonomous-pipeline')) {
    return ['automation:write'];
  }
  if (/\/(approve|reject)$/.test(pathname)) {
    return ['content:approve'];
  }
  if (pathname.startsWith('/api/v2/publishing')) {
    return ['content:approve', 'publishing:approve'];
  }
  return ['content:create', 'automation:write'];
}
```
Dan di `authenticateOperator`:
```js
  const tokenHash = crypto.createHash('sha256').update(suppliedToken).digest('hex');
  const credentialResult = await pgQuery(`
    SELECT c.id, c.tenant_id, c.name, c.scopes, c.allowed_tenant_ids_json, c.allowed_tools_json, c.expires_at
    FROM operator_credentials c
    JOIN tenants t ON t.id = c.tenant_id
    WHERE c.token_hash = $1 AND c.status = 'active' AND t.status = 'active'
    LIMIT 1
  `, [tokenHash]);
  let identity;
  if (credentialResult.rowCount > 0) {
    const overrideReq = request?.headers?.get?.('x-tenant-override') || request?.headers?.get?.('x-tenant-id');
    identity = await resolveOperatorCredentialAccess(credentialResult.rows[0], overrideReq);
  } else {
    ...
```

---

### 3. [lib/auth.js](file:///Users/sabeqmmursyid/_cfstudio/lib/auth.js)

**Code Sebelum (Current/Before):**
```js
    // Fallback: Check Operator credentials (allows MCP & Operator API tokens to access withTenantContext routes)
    if (!userFromToken) {
      try {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const opRes = await pgQuery(`
          SELECT c.id, c.tenant_id, c.name, c.scopes
          FROM operator_credentials c
          JOIN tenants t ON t.id = c.tenant_id
          WHERE c.token_hash = $1 AND c.status = 'active' AND t.status = 'active'
          LIMIT 1
        `, [tokenHash]);
        if (opRes.rows[0]) {
          const op = opRes.rows[0];
          const scopes = (op.scopes || '').split(',').map(s => s.trim());
          let effectiveTenantId = op.tenant_id;

          const isMaster = scopes.includes('tenant:superadmin') || scopes.includes('system:admin') || op.tenant_id === '*';
          const overrideReq = req?.headers?.get?.('x-tenant-override') || req?.headers?.get?.('x-tenant-id');
          if (isMaster && overrideReq) {
            const tenantMatch = await pgQuery(
              `SELECT id FROM tenants WHERE (id = $1 OR slug = $1) AND status = 'active' LIMIT 1`,
              [overrideReq.trim()]
            );
            if (tenantMatch.rowCount > 0) {
              effectiveTenantId = tenantMatch.rows[0].id;
            }
          }
          ...
          userFromToken = {
            id: op.id,
            username: op.name || 'operator',
            role: 'admin',
            tenantId: effectiveTenantId,
            tenant_id: effectiveTenantId,
            isOperator: true,
            isMaster,
            scopes,
            tenantDisabledMenus: opDisabledMenus
          };
```
```js
export function withTenantContext(handler) {
  return async (request, ...args) => {
    try {
      const user = await getCurrentUserAsync(request) || getCurrentUser(request);
      if (!user) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' }
        });
      }
      if (user.tenantId === '__none__') {
        return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
          status: 403,
          headers: { 'content-type': 'application/json' }
        });
      }
      return await tenantContext.run(user.tenantId || 'default_tenant', () => handler(request, ...args, user));
    } catch (err) {
      console.error('[API Wrapper Error]', err);
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: err.status || 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  };
}
```

**Code Sesudah (Proposed/After):**
```js
import {
  OperatorAuthError,
  resolveOperatorCredentialAccess,
  resolveRequiredOperatorScopeForRequest
} from './operator-auth.js';
```
Di `getCurrentUserAsync`:
```js
    if (!userFromToken) {
      try {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const opRes = await pgQuery(`
          SELECT c.id, c.tenant_id, c.name, c.scopes, c.allowed_tenant_ids_json, c.allowed_tools_json, c.expires_at
          FROM operator_credentials c
          JOIN tenants t ON t.id = c.tenant_id
          WHERE c.token_hash = $1 AND c.status = 'active' AND t.status = 'active'
          LIMIT 1
        `, [tokenHash]);
        if (opRes.rows[0]) {
          const overrideReq = req?.headers?.get?.('x-tenant-override') || req?.headers?.get?.('x-tenant-id');
          const opIdentity = await resolveOperatorCredentialAccess(opRes.rows[0], overrideReq);
          let opDisabledMenus = [];
          try {
            const tMenuRes = await pgQuery('SELECT disabled_menus FROM tenants WHERE id = $1 LIMIT 1', [opIdentity.tenantId]);
            const rawMenus = tMenuRes.rows[0]?.disabled_menus;
            if (rawMenus) {
              opDisabledMenus = Array.isArray(rawMenus) ? rawMenus : (typeof rawMenus === 'string' ? JSON.parse(rawMenus) : []);
            }
          } catch {}

          userFromToken = {
            id: opIdentity.actor,
            username: opIdentity.name || 'operator',
            role: 'admin',
            tenantId: opIdentity.tenantId,
            tenant_id: opIdentity.tenantId,
            isOperator: true,
            isMaster: opIdentity.isMaster,
            scopes: opIdentity.scopes,
            allowedTenantIds: opIdentity.allowedTenantIds,
            allowedTools: opIdentity.allowedTools,
            expiresAt: opIdentity.expiresAt,
            tenantDisabledMenus: opDisabledMenus
          };
        } else {
          // fallback CF_STUDIO_OPERATOR_API_TOKEN / MAKNA_OPERATOR_API_TOKEN tetap seperti sebelumnya
          // dengan allowedTenantIds: [envTenantId], serta tolak X-Tenant-Override non-master -> OperatorAuthError 403 TENANT_FORBIDDEN
```
Di `withTenantContext`:
```js
export function withTenantContext(handler) {
  return async (request, ...args) => {
    try {
      const user = await getCurrentUserAsync(request) || getCurrentUser(request);
      if (!user) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' }
        });
      }
      if (user.tenantId === '__none__') {
        return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
          status: 403,
          headers: { 'content-type': 'application/json' }
        });
      }
      if (user.isOperator && !isMasterOperator(user)) {
        const requiredAnyScopes = resolveRequiredOperatorScopeForRequest(request);
        if (Array.isArray(requiredAnyScopes) && requiredAnyScopes.length > 0) {
          const userScopes = Array.isArray(user.scopes) ? user.scopes : [];
          const hasAnyScope = requiredAnyScopes.some(scope => userScopes.includes(scope));
          if (!hasAnyScope) {
            return new Response(JSON.stringify({
              success: false,
              code: 'OPERATOR_SCOPE_FORBIDDEN',
              error_code: 'OPERATOR_SCOPE_FORBIDDEN',
              error: `Scope operator tidak mencukupi (membutuhkan salah satu: ${requiredAnyScopes.join(' atau ')}).`
            }), {
              status: 403,
              headers: { 'content-type': 'application/json' }
            });
          }
        }
      }
      return await tenantContext.run(user.tenantId || 'default_tenant', () => handler(request, ...args, user));
    } catch (err) {
      if (err instanceof OperatorAuthError || err?.name === 'OperatorAuthError') {
        return new Response(JSON.stringify({
          success: false,
          code: err.code,
          error_code: err.code,
          error: err.message
        }), {
          status: err.status || 403,
          headers: { 'content-type': 'application/json' }
        });
      }
      console.error('[API Wrapper Error]', err);
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: err.status || 500,
        headers: { 'content-type': 'application/json' }
      });
    }
  };
}
```
Dan di [app/api/auth/me/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/auth/me/route.js), tangkap `OperatorAuthError` secara aman sebagai `authenticated: false` bila request tidak memiliki sesi web valid.

---

### 4. [app/api/v2/tenants/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/tenants/route.js) & `whoami` routes

**Code Sebelum (Current/Before):**
```js
    if (isMaster) {
      sql = `
        SELECT id, name, slug, status, created_at 
        FROM tenants 
        WHERE status = 'active' 
        ORDER BY name ASC
      `;
    } else {
      sql = `
        SELECT id, name, slug, status, created_at 
        FROM tenants 
        WHERE id = $1 AND status = 'active'
      `;
      params = [user.tenantId];
    }
```

**Code Sesudah (Proposed/After):**
```js
    if (isMaster) {
      sql = `
        SELECT id, name, slug, status, created_at 
        FROM tenants 
        WHERE status = 'active' 
        ORDER BY name ASC
      `;
    } else if (user.isOperator && Array.isArray(user.allowedTenantIds) && user.allowedTenantIds.length > 0) {
      sql = `
        SELECT id, name, slug, status, created_at 
        FROM tenants 
        WHERE id = ANY($1::text[]) AND status = 'active'
        ORDER BY name ASC
      `;
      params = [user.allowedTenantIds];
    } else {
      sql = `
        SELECT id, name, slug, status, created_at 
        FROM tenants 
        WHERE id = $1 AND status = 'active'
      `;
      params = [user.tenantId];
    }
```
Dan di [app/api/operator/v1/whoami/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/operator/v1/whoami/route.js) & [app/api/operator/v2/whoami/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/operator/v2/whoami/route.js), ikut sertakan `is_master`, `allowed_tenant_ids`, `allowed_tools`, dan `expires_at` pada objek `operator`.

---

### 5. [apps/mcp/server.mjs](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/server.mjs)

**Code Sebelum (Current/Before):**
```js
  // Helper untuk menjalankan sesi MCP Streamable HTTP
  const handleMcpSession = async (req, res, clientRequest) => {
    const server = createCfStudioServer(clientRequest);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void transport.close(); void server.close(); });
...
  // 2. Endpoint Standard /mcp (dengan Bearer token atau ?token=...)
  app.use('/mcp', (req, res, next) => {
    if (req.query.token && req.query.token.length >= 16) {
      req.clientToken = req.query.token;
      return next();
    }
    if (bearerToken && req.headers.authorization && crypto.timingSafeEqual(digest(req.headers.authorization), digest(`Bearer ${bearerToken}`))) {
      req.clientToken = null;
      return next();
    }
    res.set('WWW-Authenticate', 'Bearer realm="cf-studio-mcp"');
    return res.sendStatus(401);
  });
```

**Code Sesudah (Proposed/After):**
```js
  // Helper untuk menjalankan sesi MCP Streamable HTTP (wajib isRemoteHttp: true)
  const handleMcpSession = async (req, res, clientRequest) => {
    const server = createCfStudioServer(clientRequest, { isRemoteHttp: true });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void transport.close(); void server.close(); });
...
  // 2. Endpoint Standard /mcp (mendukung Bearer statis server, Bearer token per-operator, atau ?token=...)
  app.use('/mcp', (req, res, next) => {
    if (req.query.token && String(req.query.token).length >= 16) {
      req.clientToken = String(req.query.token);
      return next();
    }
    const authHeader = String(req.headers.authorization || '').trim();
    if (authHeader.startsWith('Bearer ')) {
      const suppliedBearer = authHeader.slice(7).trim();
      if (bearerToken && crypto.timingSafeEqual(digest(`Bearer ${suppliedBearer}`), digest(`Bearer ${bearerToken}`))) {
        req.clientToken = null;
        return next();
      }
      if (suppliedBearer.startsWith('cfop_') || suppliedBearer.length >= 24) {
        req.clientToken = suppliedBearer;
        return next();
      }
    }
    res.set('WWW-Authenticate', 'Bearer realm="cf-studio-mcp"');
    return res.sendStatus(401);
  });
```

---

### 6. [apps/mcp/tools.mjs](file:///Users/sabeqmmursyid/_cfstudio/apps/mcp/tools.mjs)

**Code Sebelum (Current/Before):**
```js
async function resolveReferenceAssetUploadInput({ image_base64, file_path, photo_url, filename }) {
  if (photo_url) { ... }
  const hasBase64 = Boolean(image_base64 && String(image_base64).trim());
  const hasFilePath = Boolean(file_path && String(file_path).trim());
```
```js
async function resolvePhotoInput({ photo_base64, photo_url, photo_file_path, filename }) {
  if (photo_base64) {
    return { photo_base64, filename };
  }
  if (photo_file_path) {
    try {
      const buf = await fs.readFile(photo_file_path);
...
```
```js
export function createCfStudioServer(rawRequest) {
...
  const register = (name, description, schema, readOnly, handler) =>
    server.registerTool(
      name,
      { ... },
      async args => {
        const result = await handler(args);
        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
          structuredContent: result,
          ...(result && result.success === false ? { isError: true } : {})
        };
      }
    );
```

**Code Sesudah (Proposed/After):**
```js
async function resolveReferenceAssetUploadInput({ image_base64, file_path, photo_url, filename, isRemoteHttp = false }) {
  if (isRemoteHttp && file_path && String(file_path).trim()) {
    return {
      error: {
        success: false,
        error_code: 'VALIDATION_ERROR',
        error: 'Parameter file_path dinonaktifkan pada mode Remote HTTP MCP demi keamanan host. Gunakan image_base64.'
      }
    };
  }
  ...
```
```js
async function resolvePhotoInput({ photo_base64, photo_url, photo_file_path, filename, isRemoteHttp = false }) {
  if (photo_file_path && isRemoteHttp) {
    const err = new Error('Parameter photo_file_path dinonaktifkan pada mode Remote HTTP MCP demi keamanan host. Gunakan photo_base64 atau photo_url.');
    err.error_code = 'VALIDATION_ERROR';
    throw err;
  }
  ...
```
```js
export function createCfStudioServer(rawRequest, { isRemoteHttp = false } = {}) {
  let cachedAllowedTools = undefined; // undefined = belum dicek, null = semua diizinkan, Set = terbatas
  const resolveAllowedToolsSet = async () => {
    if (cachedAllowedTools !== undefined) return cachedAllowedTools;
    try {
      const whoami = await request('/api/operator/v1/whoami');
      const list = whoami?.operator?.allowed_tools;
      cachedAllowedTools = Array.isArray(list) ? new Set(list) : null;
    } catch {
      cachedAllowedTools = null;
    }
    return cachedAllowedTools;
  };
  ...
  const register = (name, description, schema, readOnly, handler) =>
    server.registerTool(
      name,
      { ... },
      async args => {
        if (name !== 'cf_whoami' && name !== 'makna_whoami') {
          const allowedSet = await resolveAllowedToolsSet();
          if (allowedSet && !allowedSet.has(name)) {
            const denied = {
              success: false,
              error_code: 'TOOL_FORBIDDEN',
              error: `Tool "${name}" tidak diizinkan oleh kebijakan kredensial operator Anda.`
            };
            return {
              content: [{ type: 'text', text: JSON.stringify(denied) }],
              structuredContent: denied,
              isError: true
            };
          }
        }
        const result = await handler(args);
        ...
```
Serta meneruskan `isRemoteHttp` ke pemanggilan `resolveReferenceAssetUploadInput` dan `resolvePhotoInput` pada `cf_upload_reference_asset`, `cf_add_product`, dan `cf_upload_product_photo`. Di `cf_switch_tenant`, sertakan `...(check?.code ? { code: check.code } : {})` dan `...(check?.error_code ? { error_code: check.error_code } : {})` saat gagal agar `TENANT_FORBIDDEN` diteruskan jelas ke agen MCP.

---

### 7. File Baru Admin API & UI Manajemen Akses MCP

1. **[lib/operator-credentials-admin.js](file:///Users/sabeqmmursyid/_cfstudio/lib/operator-credentials-admin.js)**
   - Ekspor `OPERATOR_SCOPE_PRESETS` (4 preset: `viewer`, `content_operator`, `full_tenant_operator`, `master_superadmin`) dan `ALL_OPERATOR_SCOPES` (`content:read`, `content:create`, `content:approve`, `automation:read`, `automation:write`, `publishing:approve`, `research:read`, `product_research:read`, `product_research:mcp_promote`, `product_research:ingest`, `tenant:superadmin`).
   - Fungsi CRUD: `listOperatorCredentials()`, `createOperatorCredential(input, actor)`, `updateOperatorCredential(id, updates, actor)`, `rotateOperatorCredentialToken(id, actor)`, `deleteOperatorCredential(id, actor)`.
   - Validasi superadmin async di route: `requireWebSuperadmin(request)` (`user.role === 'superadmin' && !user.isOperator`).
2. **[app/api/v2/operator-credentials/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/operator-credentials/route.js)** (`GET`, `POST`)
3. **[app/api/v2/operator-credentials/[id]/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/operator-credentials/[id]/route.js)** (`PATCH`, `DELETE`)
4. **[app/api/v2/operator-credentials/[id]/rotate/route.js](file:///Users/sabeqmmursyid/_cfstudio/app/api/v2/operator-credentials/[id]/rotate/route.js)** (`POST`)
5. **[app/settings/mcp-access/page.js](file:///Users/sabeqmmursyid/_cfstudio/app/settings/mcp-access/page.js)** (berbasis mockup HTML yang telah disetujui pengguna)
6. **[lib/sidebar-nav.js](file:///Users/sabeqmmursyid/_cfstudio/lib/sidebar-nav.js)** & **[app/components/Sidebar.js](file:///Users/sabeqmmursyid/_cfstudio/app/components/Sidebar.js)**:

**Code Sebelum (`lib/sidebar-nav.js`):**
```js
  '/settings/users': 'admin_only',
  '/settings/tenants': 'superadmin_only',
  '/settings': 'system_settings'
```
```js
  { section: 'SYSTEM' },
  { label: 'Settings', href: '/settings', icon: '⚙' },
  { label: 'User Management', href: '/settings/users', icon: '👥', adminOnly: true },
  { label: 'Tenant Management', href: '/settings/tenants', icon: '🏢', superadminOnly: true },
```

**Code Sesudah (`lib/sidebar-nav.js`):**
```js
  '/settings/users': 'admin_only',
  '/settings/tenants': 'superadmin_only',
  '/settings/mcp-access': 'superadmin_only',
  '/settings': 'system_settings'
```
```js
  { section: 'SYSTEM' },
  { label: 'Settings', href: '/settings', icon: '⚙' },
  { label: 'User Management', href: '/settings/users', icon: '👥', adminOnly: true },
  { label: 'Tenant Management', href: '/settings/tenants', icon: '🏢', superadminOnly: true },
  { label: 'Akses MCP & Operator', href: '/settings/mcp-access', icon: '🔑', superadminOnly: true },
```
Dan di [app/components/Sidebar.js](file:///Users/sabeqmmursyid/_cfstudio/app/components/Sidebar.js) baris 99: tambahkan `'/settings/mcp-access'` ke daftar path section `'SYSTEM'` agar accordion otomatis terbuka saat mengunjungi `/settings/mcp-access`.

---

## Kriteria Penerimaan & Verifikasi

Setiap poin pada Seksi 5 dokumen usulan diverifikasi melalui unit/integration test otomatis dan uji manual di Dev (`http://100.95.245.55:5020` & MCP `7030`):
1. Token terbatas (`allowed_tenant_ids = [tnt_a, tnt_b]`) memanggil `cf_list_tenants` -> hanya mengembalikan `tnt_a` dan `tnt_b`.
2. `cf_switch_tenant("tnt_b")` lalu baca data -> berhasil pada konteks `tnt_b`.
3. `cf_switch_tenant("default_tenant")` atau `X-Tenant-Id: default_tenant` -> ditolak keras `403 TENANT_FORBIDDEN`.
4. Admin menghapus `tnt_b` dari allowlist di UI -> request berikutnya langsung ditolak `403` tanpa restart server atau mengubah config PC klien.
5. Admin klik **Revoke** (atau token melewati `expires_at`) -> seluruh request langsung ditolak `401`.
6. Token `Viewer` (`content:read`, `automation:read`) memanggil `cf_create_schedule` -> ditolak `403 OPERATOR_SCOPE_FORBIDDEN`.
7. Klien Remote HTTP MCP mengirim `file_path` / `photo_file_path` -> ditolak `VALIDATION_ERROR` sebelum menyentuh filesystem host.
8. Token `Master Superadmin` (`opcred_antigravity_ide` / `tenant:superadmin`) tetap bekerja 100% normal di seluruh tenant.
