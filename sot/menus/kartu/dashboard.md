# Kartu Menu: Dashboard

Terakhir dicek: 21 November 2026 · Versi aplikasi: v2.57.7
Alamat: `/dashboard` · Kelompok: SYSTEM · Kunci izin menu: (semua pengguna)

## Fungsi
Halaman pembuka setelah login. Menyajikan ringkasan aktivitas produksi: job terbaru, status antrean, statistik konten, dan notifikasi penting. Tidak ada tindakan produksi dari halaman ini — hanya visibilitas.

## Tata Letak Mobile & Responsif (Tahap 1 Fondasi Bersama)
- Pada desktop (>1024px), sidebar desktop tetap berada di sisi kiri (260px) tanpa perubahan.
- Pada HP (≤640px) dan tablet (641-1024px), sidebar desktop disembunyikan dan digantikan dengan MobileNav (Bilah Atas 52px dengan tombol "Menu" membuka drawer navigasi 100dvh).
- Pada HP (≤640px), tersedia bilah bawah navigasi cepat (56px) untuk 4 aksi utama: Dashboard, Auto Pipeline, ContentFlow Hub, dan Menu.
- Grid statistik otomatis tersusun 2 kolom di HP dan kartu metrik/tabel tersusun 1 kolom tanpa kebocoran geser samping (zero horizontal scroll leak).

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
