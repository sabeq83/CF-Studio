# Kartu Menu: Visual Identity

Terakhir dicek: 17 November 2026 · Versi aplikasi: v2.50.2
Alamat: `/settings/visual-identities` · Kelompok: PLANNING · Kunci izin menu: `operator_presets`

## Fungsi
Studio karakter visual brand. Menyimpan preset gaya visual yang menentukan tampilan video: warna, lighting, suasana, karakter model, latar belakang, dan gaya kamera. Semua mesin AI image generation mengacu ke Visual Identity aktif agar konten brand konsisten.

## Alur pakai
1. Buat Visual Identity baru: isi nama, deskripsi gaya, referensi visual, negative prompts.
2. Aktifkan satu Visual Identity sebagai default brand.
3. Kampanye baru otomatis memakai Visual Identity aktif; bisa diganti manual.

## Terhubung dengan
- Dipakai oleh: hampir semua pipeline kampanye (Auto Pipeline, RE Campaign, Pillar, Multiplier).
- Perintah MCP: `cf_generate_visual_identity`, `cf_create_visual_identity`, `cf_list_visual_identities`, `cf_get_visual_identity`, `cf_update_visual_identity`.

## Lokasi (untuk agent)
- Halaman: `app/settings/visual-identities/page.js`, `app/settings/visual-identities/[id]/page.js`
- API: `app/api/v2/visual-identities/` (route, [id], ai, resolve)
- Logika inti: `lib/visual-identity-ai-builder.js`, `lib/visual-identity-repository.js`, `lib/visual-identity-allocator.js`, `lib/visual-identity-contract.js`
- Tabel data: `visual_reference_assets` (tenant-isolated)

## Aturan penting & jebakan
1. Kunci izin sama dengan Preset Manager (`operator_presets`).
2. Mengubah Visual Identity aktif **mempengaruhi semua kampanye berikutnya** — kampanye yang sedang berjalan tidak berubah.
3. `lib/visual-identity-allocator.js` mengelola alokasi gaya ke tiap klip; jangan edit manual referensi di DB.
4. **Character Lock (karakter 3D):** VI dengan `subject.kind = stylized_3d_character` yang mengisi `subject.universe_profile_id` / `universe_slug` + `character_keys` akan melampirkan gambar acuan karakter Universe di tiap start frame. Sejak v2.50.2 ini juga berlaku untuk **custom storyboard / CFA** (snapshot VI disimpan di kampanye, `lib/custom-storyboard-pipeline.js`). Di Editorial/Pillar, VI yang tersambung Universe membuat kampanye masuk `content_world = cartoon_universe`.
5. Bila id VI tidak ditemukan, resolver jatuh ke VI default (Muslimah Sage Kitchen); custom storyboard tidak menyimpan snapshot default itu.

## Belum ada / batasan
- Belum ada preview live gaya visual sebelum dikonfirmasi.

## Dokumen lengkap
`sot/menus/visual-identity-studio.md`
