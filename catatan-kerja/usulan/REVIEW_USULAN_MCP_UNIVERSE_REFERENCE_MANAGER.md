# Review & Penyempurnaan: Usulan MCP Universe dan Referensi Karakter

Tanggal: 19 November 2026 · Reviewer: Claude · Acuan kode: `main` @ v2.56.0 (`1b9d238`)
Dokumen yang direview: [USULAN_MCP_UNIVERSE_REFERENCE_MANAGER.md](USULAN_MCP_UNIVERSE_REFERENCE_MANAGER.md) (Codex)
Instruksi eksekusi: [antigravity_mcp_universe_reference_manager_instructions.md](../instruksi-agent/antigravity_mcp_universe_reference_manager_instructions.md)

---

## Ringkasan untuk pengguna (bahasa sederhana)

Usulan Codex **arahnya benar dan hati-hati**: membuat agen bisa mengganti karakter (Maya → Arka) lewat MCP tanpa utak-atik database, dengan bukti bahwa gambar Arka benar-benar dipakai saat produksi.

Setelah dicek ke kode `main`, ada **4 masalah nyata yang belum disebut Codex** dan harus dibereskan dulu, karena tanpa itu tool MCP baru pun bisa "terlihat sukses" padahal video tetap memakai wajah yang salah:

1. **Sistem bisa diam-diam memakai karakter lain.** Kalau gambar/kunci Arka tidak ketemu, mesin otomatis mengambil karakter pertama di Universe — bisa saja Maya — tanpa peringatan.
2. **Kalau gambar karakter hilang, produksi tetap jalan** hanya dengan catatan di log, tanpa menghentikan apa pun.
3. **Daftar gambar "approved" sebenarnya tidak terbaca** oleh mesin pembaca Universe (salah konteks tenant). Saat ini masih berfungsi hanya karena ada salinan cadangan di kolom lama.
4. **Pembacaan Universe lintas tenant**: Universe dicari berdasarkan nama-pendek (slug) tanpa batas tenant, jadi dua tenant dengan slug sama bisa tertukar.

Usulan juga **dirampingkan**: dari 14 tool menjadi **10 tool** untuk tahap pertama, dan **tanpa perubahan struktur database** (tanpa migrasi), supaya aman untuk Staging yang dipakai produksi konten.

---

## 1. Yang sudah tepat dari usulan Codex (dipertahankan)

| Poin | Penilaian |
|---|---|
| Tiga tingkat keberhasilan (konfigurasi → referensi siap → referensi dipakai) | Sangat tepat. Dipakai sebagai format laporan wajib. |
| Pakai service/repository aset yang ada, bukan tabel baru | Tepat. `lib/reference-asset-service.js` & `-repository.js` sudah punya versi + approval + dual-write. |
| Upload menghasilkan **draft**, approval terpisah dengan cek checksum | Tepat. Mencegah approve gambar yang berbeda dari yang ditinjau. |
| Link VI tidak menyentuh brand/jadwal/kampanye berjalan; Maya tidak dihapus | Tepat. |
| Preflight lama tidak cukup (hanya cek style VI pada kampanye Pillar) | Terverifikasi benar (`runReferenceAssetPreflight`). |
| Identity anchor bersih satu karakter, bukan board multi-panel | Tepat secara produksi. |
| Peringatan route memakai spread body | Terverifikasi — dan ternyata berdampak nyata (lihat B3). |
| Render berbayar bukan efek samping upload/link | Tepat. |

## 2. Koreksi atas klaim usulan

| Klaim Codex | Kenyataan di kode `main` | Dampak ke rencana |
|---|---|---|
| "Approval paralel bisa menghasilkan dua versi approved" | DB sudah punya unique index `idx_vra_one_approved` dan `UNIQUE(tenant, owner, role, version)` (`lib/db-pg.js:2186-2188`). Dua approved **tidak mungkin**; yang terjadi adalah error mentah (constraint violation) dan cek status di luar transaksi (`reference-asset-repository.js:109`). | Cukup: pindahkan cek status ke dalam transaksi dengan `SELECT … FOR UPDATE`, terjemahkan error constraint menjadi `REVISION_CONFLICT`. Tidak perlu kolom baru. |
| `expected_revision` & idempotency key server-side | Tidak ada kolom revision maupun tabel idempotency. Menambahkannya = **migrasi DB** (rollback tidak mengembalikan DB). | Ganti dengan mekanisme **tanpa migrasi**: `updated_at` sebagai token revisi; idempotency alami lewat checksum (upload gambar identik ke owner/role yang sama mengembalikan draft/approved yang sudah ada). |
| `cf_update_universe_character` memanggil API yang ada | **Tidak ada route update karakter.** `characters/route.js` hanya GET & POST; tidak ada `characters/[charId]`. Fungsi DB `updateUniverseCharacter` ada (`lib/db.js:3846`). | Perlu route baru `PUT /api/v2/universe-profiles/[id]/characters/[charId]`. |
| Cache manifest hanya soal invalidasi antar-proses | Resolver produksi memanggil `getUniverseManifestAsync(..., { forceRefresh: true })` bila kampanye tidak punya snapshot, jadi masalah utamanya **bukan basi**, melainkan **salah tenant** (B1, B2). | Fokus perbaikan dipindah ke isolasi tenant manifest. |
| MVP upload hanya `image_base64`; `file_path` hanya opsional | MCP CF Studio berjalan **lokal (stdio) di laptop/Mac Mini** dan sudah punya pola `resolvePhotoInput` (base64 / file_path / url) di `apps/mcp/tools.mjs:8`. `file_path` adalah jalur paling praktis untuk kasus Arka. | MVP: `image_base64` **atau** `file_path` (dibaca di host MCP, dikirim sebagai multipart). URL import ditunda (risiko SSRF). |
| Link VI bisa memakai patch subject | `cf_update_visual_identity` mengirim `config` utuh — rawan menimpa field lain. VI PUT tidak memvalidasi relasi Universe. | Tool khusus `cf_link_visual_identity_universe` **tetap perlu**, dengan merge hanya field `subject.*` terkait + validasi server-side. |

## 3. Temuan baru (tidak ada di usulan Codex) — WAJIB diperbaiki sebelum tool MCP

### B1 — Manifest tidak pernah melihat aset approved (salah konteks tenant)
- `lib/universe-manifests.js:213, 226, 364` memanggil `getApprovedReferenceAssetsForUniverse` di dalam `tenantContext.run('__none__')`.
- Fungsi itu (`reference-asset-repository.js:255`) memakai `pgQuery` langsung dengan `tenant_id = getActiveTenantId()` → `tenant_id = '__none__'` → **selalu kosong**.
- Akibat: `identity_reference_path` jatuh ke kolom lama `reference_image_path` (masih benar karena dual-write saat approve identity), `character_sheet_reference_path` selalu `null`, dan manifest **tidak membawa asset_id/versi/sha256** — sehingga preflight tidak bisa membuktikan aset mana yang dipakai.
- Perbaikan: fungsi menerima `tenantId` eksplisit dari `profile.tenant_id`; manifest menyimpan `identity_asset: { asset_id, version, sha256, source }` per karakter.

### B2 — Lookup Universe lintas tenant berdasarkan slug
- `getUniverseManifestAsync` mencari via slug lebih dulu di konteks `'__none__'` (interceptor tenant dilewati, `lib/db.js:101`), lalu baru via ID. Slug hanya unik **per tenant** (`idx_universe_profiles_tenant_slug`).
- Cache `_manifestCache` dikunci slug saja dan `_characterNameMap` global.
- Akibat: dua tenant dengan slug sama bisa saling tertukar karakter/gambar.
- Perbaikan: utamakan `universeProfileId`; lookup slug wajib dibatasi tenant kampanye; kunci cache `${tenant_id}:${slug}`.

### B3 — Spread body menimpa ID buatan server
- `characters/route.js:36`: `createUniverseCharacter({ id: charId, universe_id: id, ...body })` → body bisa menimpa `id` **dan** `universe_id` (karakter masuk ke Universe lain; respons mengembalikan `charId` yang salah).
- `universe-profiles/route.js:33`: sama untuk `id`.
- Perbaikan: spread body dulu, lalu ID server di akhir; plus whitelist field.

### B4 — Resolver diam-diam memakai karakter lain / tanpa gambar
- `lib/cartoon-reference-resolver.js:277-283`: bila kunci tidak cocok, fallback ke `'si_wajan'` lalu **karakter pertama di Universe** → di Ruang Akustik bisa jatuh ke Maya.
- `:262-271`: nama apa pun yang muncul di teks prompt/VO ikut ditambahkan (prompt menyebut "Maya" → anchor Maya masuk).
- `:314`: gambar hilang hanya `console.warn`, produksi tetap jalan.
- Perbaikan (tanpa mengubah perilaku VI lain): mode baru `subject.character_lock_mode = 'strict'` (default `off`). Pada `strict`: hanya kunci dalam `subject.character_keys` yang boleh di-resolve, tanpa fallback ke karakter lain, dan anchor hilang → error `REFERENCE_NOT_RESOLVED` yang menghentikan klip (dipulihkan oleh alur pemulih CFA yang sudah ada).

### B5 — Tidak ada cek izin/scope pada route Universe & aset
- Semua route memakai `withTenantContext` saja. Token operator selalu ber-role `admin`; flag `readOnly` di MCP hanya hint.
- Untuk MVP: route mutasi baru mewajibkan scope `content:create` (upload/create/update) dan `content:approve` (approve/reject/link) bila `user.isOperator`; pengguna browser tetap melalui login biasa. Menu `universe_manager` bila dinonaktifkan untuk tenant → 403.

## 4. Lingkup MVP yang disempurnakan (10 tool, tanpa migrasi)

| # | Tool | Backend | Catatan |
|---|---|---|---|
| 1 | `cf_list_universes` | GET `/api/v2/universe-profiles` | Ringkas: id, slug, nama, jumlah karakter, tenant efektif. |
| 2 | `cf_get_universe` | GET `/api/v2/universe-profiles/[id]` | + ringkasan aset approved per karakter (asset_id, versi, sha256, sumber). |
| 3 | `cf_create_universe_character` | POST `…/characters` (diperbaiki B3) | `character_key` slug-case, unik dalam Universe → 409 bila ada. |
| 4 | `cf_update_universe_character` | **Route baru** PUT `…/characters/[charId]` | Whitelist field; tolak ubah `character_key` bila sudah dipakai VI; `expected_updated_at` opsional. |
| 5 | `cf_list_reference_assets` | GET `/api/v2/reference-assets` | Tanpa base64; preview = `public_path` lengkap dengan base URL. |
| 6 | `cf_upload_reference_asset` | POST `…/upload` (multipart) | Sumber: `image_base64` **atau** `file_path` (host MCP). Hasil: draft + sha256 + preview. Dedup checksum. |
| 7 | `cf_approve_reference_asset` | POST `…/[id]/approve` | `expected_sha256` **wajib**; idempoten bila sudah approved dengan sha sama. |
| 8 | `cf_reject_reference_asset` | POST `…/[id]/reject` | `reason` wajib. |
| 9 | `cf_link_visual_identity_universe` | **Route baru** POST `/api/v2/visual-identities/[id]/universe-link` | `dry_run` default `true`; merge hanya `subject.universe_profile_id/universe_slug/character_keys/character_lock_mode`; kembalikan diff. |
| 10 | `cf_preflight_character_lock` | **Route baru** POST `/api/v2/reference-assets/character-lock-preflight` | Read-only; menjalankan resolver secara dry-run untuk VI; kontrak respons seperti usulan Codex bagian 7. |

**Ditunda ke Tahap C** (tidak dibutuhkan untuk kasus Arka): create/update Universe, archive/restore aset, lokasi, generate AI + status, import legacy, URL import, upload session bertoken, `expected_revision` berbasis kolom & tabel idempotency (butuh migrasi).

## 5. Kriteria selesai (diperketat)

1. Unit test B1–B4 lulus, termasuk: dua tenant slug sama tidak tertukar; mode `strict` tidak pernah jatuh ke karakter lain; prompt menyebut "Maya" tidak memasukkan anchor Maya pada VI Arka strict; anchor hilang → `REFERENCE_NOT_RESOLVED`.
2. VI yang **tidak** memakai `strict` menghasilkan referensi identik dengan sebelum perubahan (uji regresi Pawville/si_wajan).
3. Semua tool MCP terdaftar, lolos test parity di `apps/mcp/test`, dan menolak token tanpa scope.
4. Preflight Arka di Dev: `status: ready`, `resolved_assets[0].source = 'approved_asset'`, sha256 sama dengan yang di-approve, tanpa aset milik Maya.
5. Laporan akhir menyebut tingkat keberhasilan (konfigurasi / referensi siap / sudah diuji produksi).

## 6. Alur Arka (setelah fitur ada di Dev)

Sama seperti usulan Codex bagian 8, dengan tambahan:
- Set `character_lock_mode: 'strict'` saat link VI Arka.
- Pastikan naskah CFA (skill `cfa-penulis`) menulis nama tokoh **"Arka"** di `voice_segments`/karakter klip, bukan "Maya" — pada mode strict nama lain diabaikan, tetapi naskah yang konsisten tetap penting untuk VO.
- Uji 1 video sampel hanya setelah pengguna setuju memakai kuota G-Labs.

## 7. Risiko & catatan rilis

- **Tanpa migrasi DB** pada MVP — aman untuk rollback atomic.
- Perbaikan B1/B2/B4 menyentuh resolver produksi yang dipakai Staging. Karena itu wajib lewat Dev ≥ 1 hari sesuai SOP, dan mode `strict` default **off**.
- **Keputusan pengguna (19 Nov 2026):** B2+B3 dipisah menjadi `hotfix/universe-tenant-isolation`, dikerjakan dan dinaikkan ke Staging lebih dulu (rilis patch). Sisanya di `fitur/mcp-universe-character-lock` lewat Dev ≥ 1 hari.
- Kartu menu `universes.md` dan `visual-identities.md` serta `apps/mcp/README.md` wajib diperbarui saat rilis.
