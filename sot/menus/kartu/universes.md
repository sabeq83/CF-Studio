# Kartu Menu: Universe Manager

Terakhir dicek: 17 November 2026 · Versi aplikasi: v2.50.0
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
- API: tidak ditemukan folder API terpisah — data diakses via `lib/universe-*.js`
- Logika inti: `lib/universe-ai-builder.js`, `lib/universe-ai-repository.js`, `lib/universe-manifests.js`, `lib/universe-ai-suggest.js`
- Tabel data: `universe_profiles`, `universe_characters`, `universe_locations`, `universe_episodes`

## Aturan penting & jebakan
1. Universe tidak aktif otomatis — harus dipilih saat membuat kampanye berseri.
2. `universe_manifests.js` di-cache di memori; restart PM2 bila manifest tidak update.
3. Karakter harus punya deskripsi visual detail agar AI image konsisten.

## Belum ada / batasan
- Universe Manager belum bisa diakses via MCP; kelola lewat UI atau langsung ke DB.

## Dokumen lengkap
`sot/menus/universe-manager.md`
