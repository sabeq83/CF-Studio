# Instruksi Antigravity: MCP CF Studio Selalu Kembali ke Tenant Default

## Mandat

Pengguna ingin MCP CF Studio **selalu bekerja di `default_tenant`, kecuali ada permintaan khusus**. Pindah tenant lewat `cf_switch_tenant` hanya boleh berlaku **sementara**, lalu otomatis kembali ke default.

Lingkup: hanya `apps/mcp/` (server MCP). **Tidak** mengubah autentikasi server (`lib/operator-auth.js`, `lib/auth.js`), operator credential/token, data tenant, atau CFA di Mac mini.

## Kondisi sekarang (dicek 17 Nov 2026)

- Token operator `opcred_antigravity_ide` kini terikat ke **`default_tenant`** (`cf_whoami` → `tenant_id: default_tenant`). Sesi MCP baru sudah mulai di default. (Catatan lama `catatan-kerja/usulan/ANALISA_TENANT_MCP_MACMINI.md` masih menyebut PT GIM; itu sudah tidak berlaku.)
- CFA di Mac mini memanggil API lewat `~/cf-autopipeline/bin/antrean.py`/`cfa_api.py` (bukan MCP). Tenant ditentukan per brand di `config.json` dan dikunci dengan `kunci_tenant()`. **Tidak perlu diubah.**
- **Celah:** `apps/mcp/tools.mjs` → `createCfStudioServer()` menyimpan `let activeTenantOverride = null;` (~baris 346). Setelah `cf_switch_tenant` (~407–426), nilai itu **menempel untuk semua tool berikutnya selama proses MCP hidup**. Proses MCP stdio di Claude Desktop bisa hidup berhari-hari dan dipakai banyak percakapan (contoh: proses MCP laptop yang hidup sejak 14 Nov). Akibatnya, percakapan berikutnya bisa diam-diam menulis ke tenant lain. Pesan sukses `cf_switch_tenant` bahkan menyatakan *"All subsequent tools in this session will operate in this tenant."*

Cara menjalankan MCP:
- Laptop: `node ~/_cfstudio/apps/mcp/server.mjs --stdio` (dari **folder kerja repo**, cabang apa pun yang sedang di-checkout).
- Mac mini: `~/cf-autopipeline/bin/cf-studio-mcp.sh` → `~/maknaflow-staging-atomic/current/apps/mcp/server.mjs` (ikut rilis staging).

## Perubahan yang diminta (`apps/mcp/tools.mjs`)

### 1. Tenant default yang jelas
- `createCfStudioServer(rawRequest, options = {})` menerima `options.now` (jam yang bisa di-mock untuk tes) dan `options.defaultTenant`.
- Tenant default = `options.defaultTenant` ?? env `CF_STUDIO_DEFAULT_TENANT` ?? *(kosong → tenant bawaan token)*. Teruskan env dari `server.mjs`.
- State sesi diganti menjadi objek, misalnya:
  ```js
  { override: null | 'tnt_…', switchedAt, lastUsedAt, ttlMinutes }
  ```

### 2. `cf_switch_tenant` bersifat sementara
- Parameter baru opsional `ttl_minutes` (default **30**, min 5, maks 240): batas waktu **tanpa aktivitas**. Setiap pemanggilan tool memperbarui `lastUsedAt`.
- Pindah ke tenant yang sama dengan default → hapus override (sama dengan reset).
- Ubah deskripsi tool dan pesan sukses: *"Tenant aktif sementara: <x>. Kembali otomatis ke tenant default setelah <ttl> menit tanpa aktivitas, atau panggil cf_reset_tenant."* Kembalikan juga `expires_after_idle_minutes` dan `default_tenant`.

### 3. Kembali otomatis
- Di fungsi `request()` (~347), sebelum mengirim: jika override aktif dan `now - lastUsedAt > ttl` → hapus override, lalu tandai `revertedNotice` agar jawaban tool berikutnya memberi tahu: *"Tenant kembali ke default (<default>) karena <ttl> menit tanpa aktivitas."*
- `tenantOverride` eksplisit per panggilan (pemakaian internal seperti cek di `cf_switch_tenant`) tetap diizinkan dan **tidak** mengubah state sesi.

### 4. Tool baru `cf_reset_tenant`
- Tanpa parameter. Menghapus override dan mengembalikan `{ success, active_tenant: <default>, message }`.

### 5. Tenant aktif terlihat di setiap jawaban
- Di pembungkus `register()` (~362–378): jika `result` berupa objek biasa, tambahkan
  ```js
  _tenant: { active, source: 'default' | 'switched', idle_expires_in_minutes | null, notice? }
  ```
  Jangan mengubah isi data lain. Untuk tool tulis (`readOnly === false`), field ini **wajib** ada, supaya agen dan pengguna langsung melihat jika salah tenant.
- `cf_whoami`/`makna_whoami`: `session_active_tenant` mengikuti state baru, plus `session_tenant_source` dan sisa waktu.

### 6. Dokumentasi
- `apps/mcp/README.md`: jelaskan perilaku tenant sementara, `ttl_minutes`, `cf_reset_tenant`, env `CF_STUDIO_DEFAULT_TENANT`.
- `sot/menus/kartu/users-tenants.md`: tambahkan butir perilaku tenant MCP (wajib saat rilis, sesuai SOP Konteks Menu).
- Perbarui catatan di `catatan-kerja/usulan/ANALISA_TENANT_MCP_MACMINI.md` (tambahkan paragraf status di atas: token kini `default_tenant`, celah sticky ditutup oleh instruksi ini).

## Tes wajib (`apps/mcp/test/*.test.mjs`, `npm run test:mcp`)

Pakai `rawRequest` palsu yang merekam header `x-tenant-override` dan `options.now` yang bisa dimajukan.
1. Sesi baru tanpa switch → request **tanpa** `x-tenant-override` (tenant token), `_tenant.source = 'default'`.
2. Dengan `CF_STUDIO_DEFAULT_TENANT=default_tenant` → header berisi `default_tenant`.
3. `cf_switch_tenant('tnt_pt-gim…')` → tool berikutnya mengirim override PT GIM, `_tenant.source = 'switched'`.
4. Majukan jam 31 menit tanpa aktivitas → tool berikutnya **tanpa** override PT GIM, dan jawabannya memuat `notice` kembali ke default.
5. Aktivitas tiap 20 menit selama 1 jam → override tetap aktif (idle timeout, bukan batas total).
6. `cf_reset_tenant` → langsung kembali ke default.
7. `ttl_minutes` di luar batas → ditolak validasi.
8. Tool tulis selalu memuat `_tenant`. Jawaban yang bukan objek tidak rusak.
9. Tes MCP yang sudah ada tetap lulus.

## Branch dan alur (SOP `AGENTS.md`)

1. **Sebelum mulai:** folder kerja laptop `~/_cfstudio` saat ini ada di branch `fitur/scraper-foto-galeri-r02`, dengan perubahan dokumen yang belum di-commit (`catatan-kerja/_DAFTAR_ISI.md` dan beberapa file instruksi di `catatan-kerja/instruksi-agent/`). Karena MCP laptop berjalan dari folder ini, MCP laptop sekarang memakai kode branch fitur. Amankan perubahan dokumen itu (commit dokumen ke `main` atau stash; **jangan dibuang**), lalu `git checkout main && git pull`.
2. Buat `fitur/mcp-tenant-default` dari `main`. Commit dan push tanpa release.
3. **Uji di Dev:** jalankan server MCP lokal dengan `CF_STUDIO_OPERATOR_BASE_URL=http://100.95.245.55:5020` (Dev) dan uji skenario 3–6 secara nyata (switch → tunggu/atur TTL kecil → kembali). Deploy Dev dengan `deploy:dev:atomic` bila perubahan server ikut.
4. Naik ke staging hanya setelah pengguna menyatakan lolos: merge ke `main`, `release-non-interactive --type patch`, deploy staging.
5. Setelah selesai, **kembalikan folder kerja laptop ke `main`** agar MCP laptop memakai kode yang sudah rilis. Beri tahu pengguna untuk me-restart Claude Desktop agar proses MCP memuat kode baru. Mac mini otomatis memakai kode baru pada sesi MCP berikutnya setelah deploy staging.

## Larangan

- Jangan mengubah operator credential/token, scope, `operator_credentials`, atau `tenant_settings`.
- Jangan mengubah autentikasi/otorisasi tenant di server (`lib/operator-auth.js`, `lib/auth.js`). Perubahan hanya di sisi klien MCP.
- Jangan menyentuh file CFA di Mac mini (`~/cf-autopipeline/*`) maupun skill `~/.claude/skills/cfa-*`.
- Jangan menghapus atau mengganti nama tool MCP yang sudah ada.
- Jangan merge ke `main`, rilis, atau deploy staging tanpa izin eksplisit pengguna. Production dilarang.
- Jangan menulis token asli di kode, tes, atau dokumen.

## Format laporan balik

Bahasa Indonesia sederhana untuk marketer:
1. Ringkasan 3–5 kalimat: bagaimana sekarang MCP selalu kembali ke default.
2. Contoh singkat percakapan uji: switch ke PT GIM → `_tenant` di jawaban → kembali otomatis → reset.
3. Hasil tes (`npm run test:mcp`) dan uji nyata di Dev.
4. File yang diubah, branch, commit, dan SHA. Status folder kerja laptop (harus kembali ke `main`).
5. Pertanyaan izin: *"Boleh naik ke staging?"* Sertakan pengingat untuk me-restart Claude Desktop setelah rilis.
