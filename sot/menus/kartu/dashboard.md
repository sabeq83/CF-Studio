# Kartu Menu: Dashboard

Terakhir dicek: 17 November 2026 · Versi aplikasi: v2.50.0
Alamat: `/dashboard` · Kelompok: SYSTEM · Kunci izin menu: (semua pengguna)

## Fungsi
Halaman pembuka setelah login. Menyajikan ringkasan aktivitas produksi: job terbaru, status antrean, statistik konten, dan notifikasi penting. Tidak ada tindakan produksi dari halaman ini — hanya visibilitas.

## Alur pakai
1. Buka setelah login; halaman muat otomatis data terbaru.
2. Klik item di ringkasan untuk loncat ke menu terkait (mis. klik job → RE Campaign).

## Terhubung dengan
- Membaca data dari hampir semua menu lain (job, kampanye, konten, tenants).
- Perintah MCP: tidak ada perintah MCP khusus Dashboard.

## Lokasi (untuk agent)
- Halaman: `app/dashboard/page.js`
- API: tidak ada API khusus dashboard; data diambil dari API menu lain.

## Aturan penting & jebakan
1. Dashboard bukan SOT data — selalu cek langsung ke menu yang relevan untuk data terkini.
2. Jika dashboard kosong atau loading, cek status PM2 API server terlebih dahulu.

## Belum ada / batasan
- Belum ada notifikasi push atau pembaruan real-time (halaman perlu di-refresh manual).

## Dokumen lengkap
Tidak ada dokumen khusus. Halaman ini statis presentasional.
