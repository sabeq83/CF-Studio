# Kartu Menu: Pillar Campaign

Terakhir dicek: 18 November 2026 · Versi aplikasi: v2.54.1
Alamat: `/pillar-campaigns` · Kelompok: WORKFLOW · Kunci izin menu: `pillar_campaign`

## Fungsi
Mesin kampanye konten strategis berbasis pilar editorial. Mengambil baris dari Content Planner, mengembangkannya menjadi seri video edukasi/storytelling brand. Berbeda dengan RE Campaign yang iklan produk langsung — Pillar Campaign lebih ke konten nilai, membangun kepercayaan audiens.

## Alur pakai
1. Pilih baris dari Content Planner atau buat topik baru.
2. Sistem membuat naskah per klip berbasis pilar strategis dan angle yang dipilih.
3. Tinjau naskah dan gambar awal; setujui untuk render.
4. Hasil masuk ContentFlow Hub.

## Terhubung dengan
- Butuh data dari: Content Planner, Brand Profile, Visual Identity, Preset.
- Perintah MCP: tidak ada perintah MCP khusus Pillar Campaign.

## Lokasi (untuk agent)
- Halaman: `app/pillar-campaigns/page.js`, `app/pillar-campaigns/[id]/page.js`
- API: `app/api/v2/pillar-campaigns/` (route, [id], bulk, ingest-planner, items)
- Logika inti: `lib/pillar-campaign-approval.js`, `lib/pillar-campaign-ingest.js`
- Tabel data: `pillar_campaigns`, `strategic_campaigns` (tenant-isolated)

## Aturan penting & jebakan
1. Pillar Campaign bersifat editorial — klaim produk eksplisit tidak sesuai di sini; gunakan RE Campaign untuk iklan produk.
2. Ingest dari Content Planner via endpoint `ingest-planner`; baris yang sudah diingest tidak bisa dikirim ulang tanpa reset.
3. Dokumen `sot/menus/STRATEGIC_PILLAR_CAMPAIGN.md` berisi panduan strategi (bukan panduan teknis).
4. **Gambar awal (start frame) sejak v2.54.1**: klip yang gagal saat pra-render (timeout jalur G-Labs, deadlock) otomatis diantrekan ulang ke durable worker, jadi item tidak lagi diam di `partial`. Menunggu jalur/polling G-Labs tidak dihitung sebagai percobaan (batas 5; error sementara 8).
5. **Regenerasi**: ulang satu klip (`items/[itemId]/regenerate-t2i`) kini membawa klip lain yang sudah jadi ke revisi baru (hitungan tidak turun). `items/[itemId]/regenerate-start-frames` menerima `{"only_missing": true}` untuk membuat ulang hanya klip kosong; tanpa opsi itu tetap membuat ulang semua klip.
6. **Pantauan mesin**: `GET /api/v2/pillar-campaigns/scheduler-control` menampilkan `start_frame_worker` (last_tick, last_claim_at, stuck_recoveries) dan langkah penjadwal terlama. Pekerja start frame pulih sendiri bila satu putaran menggantung > 10 menit. Kirim produksi banyak video sekaligus tetap sebaiknya diberi jeda 10–15 menit (CFA sudah bertahap).

## Belum ada / batasan
- Belum ada integrasi otomatis dari Content Planner ke Pillar Campaign (harus manual ingest).

## Dokumen lengkap
`sot/menus/pillar-campaigns.md`, `sot/menus/STRATEGIC_PILLAR_CAMPAIGN.md`
