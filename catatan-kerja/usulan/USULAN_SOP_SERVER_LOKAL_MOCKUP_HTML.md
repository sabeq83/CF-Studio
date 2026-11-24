# Usulan SOP: Server Lokal Mockup HTML di MacBook (`http://127.0.0.1:4199`)

**Tanggal:** 24 November 2026  
**Latar Belakang:** Menggantikan kewajiban sinkronisasi setiap file `public/mockup_*.html` ke server Mac Mini Staging (`5010`) selama fase perancangan UI awal.

---

## 1. Apakah Mockup HTML Bisa Dijalankan di Server Lokal MacBook Saja?

**Ya, bisa dan sangat disarankan.** Selama ini `public/mockup_*.html` disalin ke Staging (`5010`) melalui SSH/SCP agar dapat dibuka lewat HTTP. Padahal seluruh mockup HTML CF Studio dirancang standalone (token CSS semantik di dalam file yang sama, tanpa API backend maupun database PostgreSQL), sehingga menjalankannya langsung dari MacBook memberikan 3 keuntungan:

1. **Instan (< 1 detik):** Tidak perlu `scp` ke Mac Mini dan tidak terbentur cache static `public/` milik `next start` (yang sebelumnya menyebabkan file mockup baru mengembalikan `HTTP 404` di Staging jika `maknaflow-staging-ui` belum di-reload).
2. **Nol Risiko ke Staging:** Server Staging (`5010/7010`) tetap bersih sebagai lingkungan produksi konten aktif tanpa perubahan file sementara atau reload proses PM2.
3. **Bebas Koneksi Database:** Server mockup hanya melayani berkas statis di folder `public/`, sehingga tidak memicu pool koneksi PostgreSQL maupun guard `PG_SEARCH_PATH`.

---

## 2. Arsitektur Usulan Server Lokal Mockup

Tambahkan skrip Node bawaan tanpa dependensi tambahan (`scripts/serve-mockups.mjs`) dan alias npm `"mockup:serve": "node scripts/serve-mockups.mjs"` di `package.json`:

- **Port Default:** `4199` (`http://127.0.0.1:4199`), terpisah dari Next.js dev (`3005`), Dev Mac Mini (`5020`), dan Staging (`5010`).
- **Fitur Utama:**
  1. Membaca `public/mockup_*.html` langsung dari disk setiap request (`Cache-Control: no-store`) sehingga perubahan file HTML langsung aktif cukup dengan refresh browser.
  2. Halaman indeks otomatis di `http://127.0.0.1:4199/` yang menampilkan daftar seluruh file `public/mockup_*.html` beserta waktu modifikasi terakhir dan tautan klik langsung.
  3. Mendukung flag opsional `--lan` (`0.0.0.0:4199`) bila suatu saat perlu dibuka dari HP/perangkat lain di jaringan Tailscale/Wi-Fi yang sama untuk uji responsivitas mobile (`antislop-layoutmobile`).
  4. **Alternatif tanpa skrip custom (zero-setup):** `python3 -m http.server 4199 --bind 127.0.0.1 --directory public` atau membuka langsung via `file:///Users/sabeqmmursyid/_cfstudio/public/mockup_*.html` *(namun HTTP localhost `127.0.0.1:4199` tetap lebih disarankan daripada `file://` agar perilaku CSS, SVG, font, dan state script identik dengan HTTP server)*.

---

## 3. Usulan Revisi SOP Mockup HTML (`AGENTS.md`)

Jika disetujui, seksi **SOP Mockup HTML Sebelum Perbaikan UI** di `AGENTS.md` dapat diperbarui menjadi:

1. **Simulasi Lokal Terlebih Dahulu:** Sebelum menulis/mengubah komponen React/Next.js, buat atau perbarui `public/mockup_*.html` dengan CSS tokens semantik mandiri (`data-theme="dark"` / `data-theme="light"`).
2. **Sajikan via Server Mockup Lokal MacBook (Default):** Pastikan server lokal mockup (`npm run mockup:serve` pada port `4199`) aktif atau sediakan URL `http://127.0.0.1:4199/mockup_*.html` untuk review cepat pengguna tanpa mengunggah apa pun ke Staging (`5010`).
3. **Sinkronisasi ke Staging Hanya Jika Diminta / Pengujian Lintas Perangkat:** Upload ke `~/maknaflow-staging-atomic/current/public/` **hanya** dilakukan apabila pengguna secara eksplisit meminta review lewat URL Staging/Dev atau perlu diuji dari perangkat lain di luar MacBook.
4. **Higiene Git:** File mockup dapat ikut di-commit ke branch `fitur/*` sebagai dokumentasi visual atau dibiarkan terpusat di `public/mockup_*.html` sesuai alur saat ini.

---

## 4. Rencana Penerapan Jika Disetujui
1. Buat `scripts/serve-mockups.mjs` (~65 baris, murni Node `http` + `fs`, mendukung daftar indeks mockup, `no-store` header, dan MIME `.html`/`.css`/`.svg`/`.png`).
2. Daftarkan `"mockup:serve": "node scripts/serve-mockups.mjs"` di `package.json`.
3. Perbarui blok **SOP Mockup HTML Sebelum Perbaikan UI** di `AGENTS.md`.
4. Uji buka `http://127.0.0.1:4199/` dan `http://127.0.0.1:4199/mockup_home_living_no_human_no_vo.html`.
