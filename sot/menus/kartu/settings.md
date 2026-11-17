# Kartu Menu: Settings

Terakhir dicek: 17 November 2026 · Versi aplikasi: v2.51.0
Alamat: `/settings` · Kelompok: SYSTEM · Kunci izin menu: `system_settings`

## Fungsi
Pusat konfigurasi sistem dan koneksi layanan pihak ketiga. Tempat mengatur model Gemini terpusat per peran (`primary`, `light`, `fallback`, Smart Routing), kunci AI (Gemini Key Pool), status autentikasi Google OAuth & Google Drive, koneksi webhook GPU worker (G-Labs), serta opsi fitur eksperimental untuk organisasi yang aktif.

## Alur pakai
1. Pilih mode tier (`Paid` / `Free`), **Model AI Utama**, **Model Cadangan Utama**, dan **Model ringan (tugas kecil)** (atau biarkan kosong *"Sama dengan model utama"*).
2. Atur saklar Smart Routing: aktif = tugas kecil memakai Model ringan, mati = semua memakai Model utama.
3. Masukkan dan kelola kunci Gemini AI untuk pemrosesan naskah dan gambar.
4. Hubungkan atau perbaiki izin Google Drive untuk penyimpanan aset cloud.
5. Konfigurasikan host dan kunci webhook G-Labs worker jika menggunakan GPU eksternal.
6. Simpan pengaturan; perubahan langsung berlaku pada tenant aktif.

## Terhubung dengan
- Menyediakan kredensial dan endpoint untuk: semua modul AI, rendering, penyimpanan drive, dan publishing.
- Perintah MCP: `cf_whoami`, `cf_switch_tenant`.

## Lokasi (untuk agent)
- Halaman: `app/settings/page.js`, `app/settings/components/ExperimentSettingsPanel.js`
- API terkait: `app/api/settings/`, `app/api/auth/google/`
- Tabel data: `tenant_settings`, `gemini_api_keys`

## Aturan penting & jebakan
1. Pengaturan tersimpan per-tenant; pastikan berada di tenant yang benar sebelum mengubah kunci.
2. Dilarang menuliskan secret nyata ke dokumen atau kode (SOP Zero Secret Exposure).
3. Status Google Drive memerlukan izin folder publishing agar sinkronisasi aset cloud tidak gagal.

## Belum ada / batasan
- Pengujian koneksi pihak ketiga dilakukan satu per satu via tombol uji di UI.

## Dokumen lengkap
Tidak ada dokumen khusus. Pengaturan mengikuti variabel pada `tenant_settings`.
