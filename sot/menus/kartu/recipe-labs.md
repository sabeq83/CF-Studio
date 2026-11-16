# Kartu Menu: Recipe Labs

Terakhir dicek: 17 November 2026 · Versi aplikasi: v2.50.0
Alamat: `/recipe-labs` · Kelompok: WORKFLOW · Kunci izin menu: `recipe_labs`

## Fungsi
Pabrik artikel resep dan foto grid untuk media sosial. Mengambil resep dari Recipe Library, lalu menghasilkan artikel terformat dengan foto grid menarik, caption siap posting, dan versi berbeda per platform. Cocok untuk konten kuliner organik yang bukan iklan produk langsung.

## Alur pakai
1. Pilih resep dari Recipe Library atau buat kampanye resep baru.
2. Sistem menghasilkan artikel, foto grid, dan caption.
3. Tinjau dan export; kirim ke ContentFlow Hub atau ekspor via Recipe Exporter.

## Terhubung dengan
- Butuh data dari: Recipe Library (`recipe_items`).
- Hasilnya dipakai oleh: ContentFlow Hub, Recipe Exporter.
- Perintah MCP: tidak ada perintah MCP khusus Recipe Labs.

## Lokasi (untuk agent)
- Halaman: `app/recipe-labs/page.js`
- API: tidak ditemukan folder API terpisah `app/api/v2/recipe-labs/`
- Tabel data: `recipe_campaigns`, `recipe_items`

## Aturan penting & jebakan
1. Kunci izin sama dengan Recipe Exporter (`recipe_labs`).
2. Berbeda dengan Auto Pipeline `recipe_campaign` yang membuat **video** — Recipe Labs menghasilkan **artikel + foto grid**.

## Belum ada / batasan
- Belum ada auto-posting langsung; harus lewat ContentFlow Hub atau export manual.

## Dokumen lengkap
`sot/menus/recipe-labs.md`
