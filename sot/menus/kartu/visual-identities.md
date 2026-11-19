# Kartu Menu: Visual Identity

Terakhir dicek: 19 November 2026 · Versi aplikasi: v2.56.1 (Branch Fitur: MCP Character Lock)
Alamat: `/settings/visual-identities` · Kelompok: PLANNING · Kunci izin menu: `operator_presets`

## Fungsi
Studio karakter visual brand. Menyimpan preset gaya visual yang menentukan tampilan video: warna, lighting, suasana, karakter model, latar belakang, dan gaya kamera. Semua mesin AI image generation mengacu ke Visual Identity aktif agar konten brand konsisten.

## Alur pakai
1. Buat Visual Identity baru: isi nama, deskripsi gaya, referensi visual, negative prompts.
2. Tautkan ke Universe & tentukan karakter jika menggunakan semesta karakter konsisten (`character_lock_mode = 'strict'`).
3. Jalankan preflight Character Lock untuk memvalidasi ketersediaan file gambar referensi acuan.
4. Aktifkan satu Visual Identity sebagai default brand.
5. Kampanye baru otomatis memakai Visual Identity aktif; bisa diganti manual.

## Terhubung dengan
- Dipakai oleh: hampir semua pipeline kampanye (Auto Pipeline, RE Campaign, Pillar, Multiplier).
- Perintah MCP:
  - `cf_generate_visual_identity`, `cf_create_visual_identity`, `cf_list_visual_identities`, `cf_get_visual_identity`, `cf_update_visual_identity`.
  - `cf_link_visual_identity_universe` (`content:approve`): menautkan VI ke Universe & allowlist `character_keys` dengan preview perbandingan perubahan (dry_run default).
  - `cf_preflight_character_lock` (`content:read`): audit menyeluruh integritas referensi aset, SHA-256, dan resolver sebelum rendering kampanye.

## Lokasi (untuk agent)
- Halaman: `app/settings/visual-identities/page.js`, `app/settings/visual-identities/[id]/page.js`
- API: `app/api/v2/visual-identities/` (route, [id], ai, resolve, universe-link)
- Logika inti: `lib/visual-identity-ai-builder.js`, `lib/visual-identity-repository.js`, `lib/visual-identity-allocator.js`, `lib/visual-identity-contract.js`, `lib/visual-identity-universe-link.js`, `lib/character-lock-preflight.js`
- Tabel data: `visual_reference_assets` (tenant-isolated), `visual_identities`

## Aturan penting & jebakan
1. Kunci izin sama dengan Preset Manager (`operator_presets`).
2. Mengubah Visual Identity aktif **mempengaruhi semua kampanye berikutnya** — kampanye yang sedang berjalan tidak berubah.
3. `lib/visual-identity-allocator.js` mengelola alokasi gaya ke tiap klip; jangan edit manual referensi di DB.
4. **Character Lock & Strict Mode:** VI dengan `subject.kind = stylized_3d_character` yang mengisi `subject.universe_profile_id` / `universe_slug` + `character_keys` akan melampirkan gambar acuan karakter Universe di tiap start frame.
   - Bila `character_lock_mode = 'strict'`, sistem mengisolasi karakter secara mutlak: hanya karakter dalam daftar `character_keys` yang di-resolve, prompt intrusion (seperti kemunculan nama karakter lain) diabaikan, dan jika aset referensi belum berstatus `approved` atau file hilang dari disk maka eksekusi start frame langsung digagalkan dengan error `REFERENCE_NOT_RESOLVED` tanpa fallback.
5. Bila id VI tidak ditemukan, resolver jatuh ke VI default (Muslimah Sage Kitchen); custom storyboard tidak menyimpan snapshot default itu.

## Belum ada / batasan
- Belum ada preview live gaya visual sebelum dikonfirmasi.

## Dokumen lengkap
`sot/menus/visual-identity-studio.md`
