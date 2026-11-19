# Kartu Menu: Universe Manager

Terakhir dicek: 19 November 2026 · Versi aplikasi: v2.56.1
Alamat: `/settings/universes` · Kelompok: PLANNING · Kunci izin menu: `universe_manager`

## Fungsi
Pencipta dunia cerita brand. Mendefinisikan semesta fiksi atau semi-fiksi untuk konten berseri: karakter tetap, lokasi, periode sejarah, aturan dunia. Konten yang menggunakan Universe akan memunculkan karakter dan latar yang konsisten di setiap episode/seri.

## Alur pakai
1. Buat Universe: isi nama, tipe (`fictional` / `realistic`), deskripsi dunia.
2. Tambah karakter (nama, spesies/ras, penampilan visual, peran).
3. Tambah lokasi (nama, deskripsi visual, suasana).
4. Aktifkan Universe; pipeline kampanye berseri akan memakai karakter dan lokasi ini.

## Terhubung dengan
- Dipakai oleh: Pillar Campaign (seri konten berkarakter), Auto Pipeline.
- Perintah MCP: tidak ada perintah MCP khusus Universe Manager.

## Lokasi (untuk agent)
- Halaman: `app/settings/universes/page.js`
- API: `app/api/v2/universe-profiles/` (profil, characters, locations, episodes); referensi melalui `app/api/v2/reference-assets/` (upload, generate, approval, status).
- Logika inti: `lib/universe-ai-builder.js`, `lib/universe-ai-repository.js`, `lib/universe-manifests.js`, `lib/universe-ai-suggest.js`
- Tabel data: `universe_profiles`, `universe_characters`, `universe_locations`, `universe_episodes`

## Aturan penting & jebakan
1. Universe tidak aktif otomatis — harus dipilih saat membuat kampanye berseri.
2. **Isolasi tenant manifest (v2.56.1):** `lib/universe-manifests.js` mengunci cache manifest per `${tenant_id}:${slug}`, memisahkan peta nama karakter per tenant, memprioritaskan lookup `universeId`, serta membatasi lookup `slug` pada `tenant_id` eksplisit agar dua tenant dengan slug sama tidak pernah tertukar. `refreshManifestCache({ tenantId, universeId })` mendukung invalidasi selektif tanpa perlu restart PM2.
3. **Proteksi ID & `character_key` (v2.56.1):** Pembuatan profil Universe dan karakter hanya menerima field dalam whitelist (ID server selalu ditetapkan terakhir); `character_key` wajib cocok `/^[a-z0-9_]{2,64}$/` dan duplikasi mengembalikan HTTP 409 `CHARACTER_KEY_EXISTS`.
4. Karakter harus punya deskripsi visual detail agar AI image konsisten.

## Belum ada / batasan
- Universe Manager belum memiliki tool khusus dalam katalog MCP yang diperiksa; gunakan UI/API resmi untuk menjaga validasi dan lifecycle referensi, bukan edit DB langsung.

## Dokumen lengkap
`sot/menus/universe-manager.md`
