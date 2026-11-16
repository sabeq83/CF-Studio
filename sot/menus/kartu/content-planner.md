# Kartu Menu: Content Planner

Terakhir dicek: 17 November 2026 · Versi aplikasi: v2.50.0
Alamat: `/content-planner` · Kelompok: PLANNING · Kunci izin menu: `content_planner`

## Fungsi
Mesin penyusun rencana konten strategis. Menghasilkan baris-baris rencana topik terstruktur (Pilar, CEP, W's Matrix, Konteks, VFO, Sudut Strategis, Hook, Aksi Visual, Produk) berbasis brand dan kerangka strategi — bukan improvisasi bebas AI.

## Alur pakai
1. Buka Content Planner, pilih brand dan preset strategi.
2. Jalankan generator; sistem memilih pilar dan sudut via decision tree.
3. Tinjau hasil baris per baris, edit bila perlu.
4. Setujui baris yang siap; baris dipakai sebagai bahan Pillar Campaign atau RE Campaign.

## Terhubung dengan
- Butuh data dari: Brand Profile Manager (suara brand, audiens).
- Hasilnya dipakai oleh: Pillar Campaign (`pillar_campaigns`), RE Campaign.
- Perintah MCP: tidak ada perintah MCP khusus Content Planner.

## Lokasi (untuk agent)
- Halaman: `app/content-planner/page.js`, `app/content-planner/[id]/page.js`
- API: `app/api/v2/content-planner/` (route, [id])
- Logika inti: `lib/pillar-campaign-ingest.js`, `lib/pillar-campaign-approval.js`
- Tabel data: `content_planners` (tenant-isolated)

## Aturan penting & jebakan
1. Tiap baris planner terikat satu tenant; tidak bisa dibagi antar-tenant.
2. Baris yang belum disetujui **tidak otomatis** masuk pipeline kampanye.
3. Dokumen `sot/menus/content-planner.md` adalah spesifikasi lama (dalam bahasa Inggris, cukup panjang) — baca hanya bagian yang dibutuhkan.

## Belum ada / batasan
- Belum ada ekspor langsung ke spreadsheet dari halaman ini.

## Dokumen lengkap
`sot/menus/content-planner.md` — blueprint arsitektur (± 1.509 baris, **jangan dibaca utuh**, cari bagian spesifik)
