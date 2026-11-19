# Kartu Menu: Universe Manager

Terakhir dicek: 19 November 2026 · Versi aplikasi: v2.56.1 (Branch Fitur: MCP Character Lock)
Alamat: `/settings/universes` · Kelompok: PLANNING · Kunci izin menu: `universe_manager`

## Fungsi
Pencipta dunia cerita brand. Mendefinisikan semesta fiksi atau semi-fiksi untuk konten berseri: karakter tetap, lokasi, periode sejarah, aturan dunia. Konten yang menggunakan Universe akan memunculkan karakter dan latar yang konsisten di setiap episode/seri.

## Alur pakai
1. Buat Universe: isi nama, tipe (`fictional` / `realistic`), deskripsi dunia.
2. Tambah karakter (nama, spesies/ras, penampilan visual, peran).
3. Tambah lokasi (nama, deskripsi visual, suasana).
4. Aktifkan Universe; pipeline kampanye berseri akan memakai karakter dan lokasi ini.
5. Kelola aset referensi karakter (upload draft via base64/file, review, approve dengan verifikasi SHA-256).

## Terhubung dengan
- Dipakai oleh: Pillar Campaign (seri konten berkarakter), Auto Pipeline, Visual Identity Character Lock.
- Perintah MCP:
  - `cf_list_universes` (`content:read`): daftar ringkas universe aktif per tenant.
  - `cf_get_universe` (`content:read`): detail universe, karakter, lokasi, dan status approved asset.
  - `cf_create_universe_character` (`content:create`): buat karakter dengan `character_key` divalidasi regex dan scoped tenant.
  - `cf_update_universe_character` (`content:create`): update karakter dengan proteksi konflik revisi `expected_updated_at`.
  - `cf_list_reference_assets` (`content:read`): daftar referensi aset dengan `preview_url` absolut tanpa payload base64.
  - `cf_upload_reference_asset` (`content:create`): upload draft aset (`image_base64` atau `file_path`, max 4096x4096 / 16 MP, SHA-256 dedup).
  - `cf_approve_reference_asset` (`content:approve`): persetujuan draft aset transaksi `FOR UPDATE` dengan `expected_sha256` wajib dan invalidasi cache otomatis.
  - `cf_reject_reference_asset` (`content:approve`): tolak draft aset dengan alasan wajib tanpa mengganggu versi approved aktif.

## Lokasi (untuk agent)
- Halaman: `app/settings/universes/page.js`
- API: `app/api/v2/universe-profiles/` (profil, characters, locations, episodes); referensi melalui `app/api/v2/reference-assets/` (upload, approve, reject, status, preflight).
- Logika inti: `lib/universe-ai-builder.js`, `lib/universe-ai-repository.js`, `lib/universe-manifests.js`, `lib/reference-asset-repository.js`, `lib/reference-asset-service.js`, `lib/character-lock-preflight.js`
- Tabel data: `universe_profiles`, `universe_characters`, `universe_locations`, `universe_episodes`, `reference_assets`

## Aturan penting & jebakan
1. Universe tidak aktif otomatis — harus dipilih saat membuat kampanye berseri atau ditautkan ke Visual Identity.
2. **Isolasi tenant manifest (v2.56.1):** `lib/universe-manifests.js` mengunci cache manifest per `${tenant_id}:${slug}`, memisahkan peta nama karakter per tenant, memprioritaskan lookup `universeId`, serta membatasi lookup `slug` pada `tenant_id` eksplisit agar dua tenant dengan slug sama tidak pernah tertukar. `refreshManifestCache({ tenantId, universeId })` mendukung invalidasi selektif tanpa perlu restart PM2.
3. **Proteksi ID & `character_key` (v2.56.1):** Pembuatan profil Universe dan karakter hanya menerima field dalam whitelist (ID server selalu ditetapkan terakhir); `character_key` wajib cocok `/^[a-z0-9_]{2,64}$/` dan duplikasi mengembalikan HTTP 409 `CHARACTER_KEY_EXISTS`.
4. **Approval Bersyarat:** Approval aset referensi wajib menyertakan `expected_sha256` untuk mencegah race condition. Karakter yang aktif digunakan di Visual Identity berstatus `strict` dilindungi dari penghapusan (`CHARACTER_KEY_IN_USE`).
5. Karakter harus punya deskripsi visual detail agar AI image konsisten.

## Belum ada / batasan
- Fitur auto-generate prompt Universe melalui AI generator dijalankan via UI/API server, MCP fokus pada manajemen entitas, upload referensi lokal/base64, approval, dan verifikasi preflight.

## Dokumen lengkap
`sot/menus/universe-manager.md`
