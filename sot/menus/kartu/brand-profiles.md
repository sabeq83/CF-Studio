# Kartu Menu: Brand Profile Manager

Terakhir dicek: 17 November 2026 · Versi aplikasi: v2.50.0
Alamat: `/settings/brand-profiles` · Kelompok: PLANNING · Kunci izin menu: `brand_profiles`

## Fungsi
Profil lengkap identitas brand untuk mesin konten. Menyimpan suara brand (tone, gaya bahasa), audiens target, aturan editorial, disclaimer wajib, dan konfigurasi finishing video (template, skin, klaim herbal/non-herbal). Semua kampanye AI mengacu ke Brand Profile agar narasi dan visual sesuai panduan brand.

## Alur pakai
1. Buat Brand Profile: isi nama brand, tagline, suara, audiens, aturan klaim.
2. Konfigurasikan finishing: pilih `default_finishing_template`, `finishing_skin`, dan flag `is_herbal_product`.
3. Aktifkan satu profil sebagai default; profil ini dipakai kampanye baru secara otomatis.

## Terhubung dengan
- Dipakai oleh: hampir semua pipeline kampanye.
- Perintah MCP: `cf_list_brand_profiles`, `cf_get_brand_profile`, `cf_create_brand_profile`, `cf_update_brand_profile`.

## Lokasi (untuk agent)
- Halaman: `app/settings/brand-profiles/page.js`, `app/settings/brand-profiles/[id]/page.js`
- API: `app/api/v2/brand-profiles/` (route, [id], extract)
- Tabel data: `brand_profiles` (tenant-isolated)

## Aturan penting & jebakan
1. Field `is_herbal_product = true` mengaktifkan validasi klaim ketat pada semua overlay finishing.
2. `finishing_skin` dan `default_finishing_template` di profil ini menjadi *default* saat membuat kampanye; bisa di-override per kampanye.
3. Satu tenant bisa punya beberapa Brand Profile (multi-brand); pastikan memilih profil yang tepat saat membuat kampanye.

## Belum ada / batasan
- Belum ada preview narasi otomatis berdasarkan suara brand yang diisi.

## Dokumen lengkap
`sot/menus/brand-profiles.md`
