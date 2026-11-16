# Kartu Menu: Recipe Exporter

Terakhir dicek: 17 November 2026 · Versi aplikasi: v2.50.0
Alamat: `/recipe-exporter` · Kelompok: PUBLISHING · Kunci izin menu: `recipe_labs`

## Fungsi
Pusat pengemasan dan ekspor resep siap tayang. Mengambil resep dari Recipe Labs atau kampanye resep, lalu mengekspor gambar, teks, dan video preview ke format paket media sosial atau penyimpanan cloud (Cloudflare R2 / Drive).

## Alur pakai
1. Pilih sumber resep: dari Recipe Labs (`labs`) atau kampanye (`campaign`).
2. Saring daftar resep berdasarkan status ekspor, asal pilar, atau kampanye.
3. Buka modal ekspor resep untuk meninjau paket visual dan video.
4. Klik tombol ekspor ke tujuan yang diinginkan (R2, media sosial, atau unduh).

## Terhubung dengan
- Butuh data dari: Recipe Labs (`recipe_campaigns`, `recipe_items`).
- Hasilnya dipakai oleh: tim media sosial atau pengunggahan cloud.
- Perintah MCP: tidak ada perintah MCP khusus Recipe Exporter.

## Lokasi (untuk agent)
- Halaman: `app/recipe-exporter/page.js`
- Komponen: `app/components/recipe-export/RecipeExportModal.jsx`, `app/components/recipe-export/DedicatedVideoLightbox.jsx`
- API data resep: `app/api/recipes/route.js` (atau API kampanye terkait)
- Tabel data: `recipe_campaigns`, `recipe_items`

## Aturan penting & jebakan
1. Kunci izin menu sama dengan Recipe Labs (`recipe_labs`).
2. Ekspor ke cloud membutuhkan konfigurasi Cloudflare R2 yang valid; jika belum diatur, indikator R2 akan nonaktif.
3. Filter asal (`originFilter`) mendukung pemisahan resep dari pilar, multiplier, planner, atau labs.

## Belum ada / batasan
- Belum ada penjadwalan publish otomatis langsung ke media sosial dari menu ini (gunakan ContentFlow Hub untuk penjadwalan).

## Dokumen lengkap
`sot/menus/recipe-labs.md`
