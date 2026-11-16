# Kartu Menu: Recipe Library

Terakhir dicek: 17 November 2026 · Versi aplikasi: v2.50.0
Alamat: `/recipe-library` · Kelompok: PLANNING · Kunci izin menu: `product_database`

## Fungsi
Perpustakaan resep terkurasi sebagai bahan baku konten kuliner. Menyimpan resep dengan bahan, langkah, foto, dan metadata SEO. Dipakai mesin Auto Pipeline untuk membuat video resep dan Recipe Labs untuk artikel.

## Alur pakai
1. Tambah resep baru (manual atau impor).
2. Lengkapi bahan, langkah-langkah, waktu masak, dan kategori.
3. Resep siap dipilih di Auto Pipeline (pipeline `recipe_campaign`) atau Recipe Labs.

## Terhubung dengan
- Dipakai oleh: Auto Pipeline (`recipe_campaign`), Recipe Labs.
- Perintah MCP: `cf_import_recipe_batch`, `cf_list_curated_recipes`.

## Lokasi (untuk agent)
- Halaman: `app/recipe-library/page.js`
- API: tidak ditemukan folder `app/api/v2/recipe-library/` — kemungkinan memakai API yang sama dengan Recipe Labs atau inline di halaman.
- Tabel data: `recipe_items` (terhubung ke `recipe_campaigns`)

## Aturan penting & jebakan
1. Kunci izin menu sama dengan Product Database (`product_database`) — keduanya di-gate bersama.
2. Tidak ada dokumen lengkap terpisah untuk menu ini; rujuk `sot/menus/recipe-labs.md` untuk konteks pipeline.

## Belum ada / batasan
- Belum ada impor otomatis dari sumber resep eksternal.

## Dokumen lengkap
`sot/menus/recipe-labs.md` — dokumen terdekat untuk konteks resep dan pipeline kuliner.
