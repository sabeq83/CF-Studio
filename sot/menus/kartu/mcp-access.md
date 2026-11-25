# Kartu Menu: Akses MCP & Operator Multi-PC

Terakhir dicek: 25 November 2026 · Branch: `fitur/mcp-multi-pc-tenant-terbatas`
Alamat: `/settings/mcp-access` · Kelompok: SYSTEM · Kunci izin menu: `superadmin_only`

## Fungsi
Pusat pengelolaan token akses Remote MCP per-PC/per-operator (`operator_credentials`). Superadmin dapat menerbitkan token terpisah untuk PC klien, membatasi tenant yang diizinkan (`allowed_tenant_ids_json`), mengatur scope hak akses serta pembatasan tool opsional (`allowed_tools_json`), memutar token, atau mencabut akses secara real-time tanpa mengedit konfigurasi PC klien.

## Alur pakai
1. Buka **Akses MCP & Operator** (khusus sesi web `superadmin`).
2. Klik **+ Buat Kredensial PC Baru**, isi nama PC, default tenant, dan pilih tenant tambahan yang diizinkan (atau pilih **Master Superadmin** untuk akses lintas seluruh tenant).
3. Pilih preset privilege cepat (`Viewer / Auditor`, `Content Operator`, `Full Tenant Operator`, `Master Superadmin`) atau sesuaikan checklist scope dan batas tool.
4. Salin token sekali tampil dan snippet JSON MCP (`Authorization: Bearer <token>` ke endpoint `/mcp`) untuk ditempel di Antigravity / Cursor / Claude Desktop PC klien.
5. Gunakan **Edit Akses**, **Revoke**, atau **Putar Token** kapan saja; perubahan berlaku langsung pada request berikutnya.

## Terhubung dengan
- Autentikasi operator & API: `lib/operator-auth.js`, `lib/auth.js` (`withTenantContext`), `app/api/v2/tenants/route.js`.
- Server Remote MCP: `apps/mcp/server.mjs` (`Authorization: Bearer` di `/mcp` & `isRemoteHttp: true`), `apps/mcp/tools.mjs`.

## Lokasi (untuk agent)
- Halaman UI: `app/settings/mcp-access/page.js`
- Admin Service: `lib/operator-credentials-admin.js`
- API Routes: `app/api/v2/operator-credentials/` (`route.js`, `[id]/route.js`, `[id]/rotate/route.js`)
- Tabel data: `operator_credentials`, `tenants`, `tenant_audit_events`

## Aturan penting & jebakan
1. **Khusus sesi web Superadmin:** Token operator (termasuk master) dilarang keras mengakses `/api/v2/operator-credentials*`.
2. **Isolasi `file_path` Remote:** Pada mode HTTP remote (`isRemoteHttp: true`), `file_path` (`cf_upload_reference_asset`) dan `photo_file_path` (`cf_add_product`, `cf_upload_product_photo`) ditolak dengan `VALIDATION_ERROR`.
3. **Tolak Keras Tenant Terlarang:** `X-Tenant-Override` / `X-Tenant-Id` di luar allowlist kredensial wajib mengembalikan `403 TENANT_FORBIDDEN` (tanpa fallback ke default tenant).
4. **Zero Secret Exposure:** Token mentah (`cfop_...`) hanya dikembalikan sekali saat create/rotate dan tidak pernah disimpan plaintext.
