# Kartu Menu: Threads Labs

Terakhir dicek: 17 November 2026 · Versi aplikasi: v2.50.0
Alamat: `/threads-labs` · Kelompok: WORKFLOW · Kunci izin menu: `threads_labs`

## Fungsi
Radar peluang percakapan di Threads. Memindai topik dan komentar yang relevan dengan brand, mengidentifikasi peluang membalas, dan membantu membuat balasan yang terasa natural — bukan spam. Juga bisa membuat seri utas (Threads Series) sebagai konten edukasi berjadwal.

## Alur pakai
1. Pindai akun Threads brand (sync akun terlebih dahulu).
2. Sistem mendeteksi peluang balasan berdasarkan kata kunci yang dikonfigurasi.
3. Tinjau daftar peluang; setujui balasan yang ingin dikirim.
4. Atau: buat Threads Series baru (seri utas tematik) dan jadwalkan.

## Terhubung dengan
- Butuh konfigurasi: akun Threads aktif di integrasi publishing.
- Perintah MCP: `cf_threads_labs_list_accounts`, `cf_threads_labs_sync_accounts`, `cf_threads_labs_select_account`, `cf_threads_labs_scan`, `cf_threads_labs_list_opportunities`, `cf_threads_labs_approve_reply`, `cf_threads_labs_manage_keywords`, `cf_threads_labs_get_schedule`, `cf_threads_labs_update_schedule`, `cf_list_threads_series`, `cf_create_threads_series`.

## Lokasi (untuk agent)
- Halaman: `app/threads-labs/page.js`
- Logika inti: `lib/threads-radar-scheduler.js`, `lib/threads-series-generator.js`, `lib/threads-series-pipeline.js`, `lib/threads-affiliate-matcher.js`, `lib/threads-affiliate-repository.js`
- Tabel data: lihat skema di `lib/db.js` (tabel terkait Threads)

## Aturan penting & jebakan
1. Akun Threads harus disinkronkan dulu sebelum scan; gunakan `cf_threads_labs_sync_accounts`.
2. Peluang balasan punya tanggal kedaluwarsa — peluang lama tidak relevan lagi.
3. Kata kunci scan dikonfigurasi per akun; terlalu umum → banjir peluang tidak relevan.

## Belum ada / batasan
- Balasan tidak bisa dijadwalkan; harus disetujui dan dikirim langsung.

## Dokumen lengkap
Tidak ada dokumen lengkap terpisah. Referensi MCP adalah sumber utama.
