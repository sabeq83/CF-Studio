# Kartu Menu: User & Tenant Management

Terakhir dicek: 17 November 2026 · Versi aplikasi: v2.50.5 (branch `fitur/hapus-instant-sheets`)
Alamat: `/settings/users` & `/settings/tenants` · Kelompok: SYSTEM · Kunci izin menu: `admin_only` & `superadmin_only`

## Fungsi
Pusat kontrol hak akses dan isolasi data organisasi. Halaman Users mengatur akun anggota, peran (admin/user), reset kata sandi, daftar menu yang diizinkan, dan penetapan brand. Halaman Tenants (khusus superadmin) membuat dan mengelola organisasi mandiri serta mengaktifkan/menonaktifkan modul menu per tenant.

## Alur pakai
1. **User Management**: Admin membuat akun pengguna baru, menentukan peran, memilih menu yang boleh diakses, dan menetapkan brand yang diizinkan.
2. **Tenant Management**: Superadmin membuat tenant baru (nama, slug, zona waktu, akun admin awal) atau mengatur pembatasan modul menu untuk organisasi tertentu.

## Terhubung dengan
- Mengendalikan akses ke: seluruh menu di sidebar via `lib/sidebar-nav.js` dan middleware.
- Perintah MCP: `cf_list_tenants`, `cf_switch_tenant`.

## Lokasi (untuk agent)
- Halaman Users: `app/settings/users/page.js`
- Halaman Tenants: `app/settings/tenants/page.js`
- API Users: `app/api/admin/users/` (route, [id])
- API Tenants: `app/api/admin/tenants/` (route, [id])
- Skema & Izin: `lib/schema/user-schema.js` (`ALL_MENU_KEYS`)
- Tabel data: `users`, `tenants`

## Aturan penting & jebakan
1. Halaman Users hanya dapat dibuka oleh role `admin` atau `superadmin`. Halaman Tenants **khusus `superadmin`**.
2. Password baru dienkripsi (bcrypt); dilarang menulis plain password di kode atau log.
3. Menonaktifkan menu di level tenant akan menyembunyikan menu tersebut bagi seluruh pengguna di dalam tenant terkait.
4. Key izin lama `sheets_autopilot` dan `instant_campaign` sudah dihapus dari `ALL_MENU_KEYS` (baris lama di DB dibiarkan dan diabaikan UI).

## Belum ada / batasan
- Belum ada fitur self-service registrasi publik (semua akun dibuat oleh admin).

## Dokumen lengkap
Tidak ada dokumen terpisah. Struktur perizinan mengacu ke `lib/schema/user-schema.js` dan `lib/sidebar-nav.js`.
