# Instruksi Antigravity — Gambar Acuan Karakter Kawan Rumah + Revisi Sidebar

> Tanggal: 2026-11-14 · Penulis: Claude (reviewer) · Eksekutor: Antigravity
> Dasar: `plans/dialog-karakter/prompt-gambar-acuan-kawan-rumah.md` (temuan + prompt), VI Kawan Rumah versi 2 dan preset `kawan_rumah_3d_dialog` (dibuat Claude via MCP, lihat `usulan-mcp-vi-preset-kawan-rumah.md`).
> Lingkup: **Staging saja.** Production tidak disentuh.
> Bila uji Start Frame Kawan Rumah dari laporan v2.48.6 belum dijalankan, jalankan **setelah** Bagian C–D selesai, agar karakter langsung memakai gambar acuan.

---

## A. Revisi sidebar (`app/components/Sidebar.js`)
Permintaan langsung pengguna. Perubahan kecil, jadi tidak perlu mockup; cukup tangkapan layar staging di laporan.

1. **Ganti label** `Multiple Labs` → **`Multiplier Labs`** (baris ±51). Href `/multiplier-lab` tetap.
2. **Tampilkan lagi Universe Manager.** Menu ini terhapus sejak `v2.40.27` (e41849d, perapian sidebar):
   - tambahkan item `{ label: 'Universe Manager', href: '/settings/universes', icon: '🏰' }` ke `navItems`;
   - masukkan ke grup **PLANNING**, tepat setelah `Visual Identity` (filter grup ±baris 152);
   - tambahkan `'/settings/universes': 'universe_manager'` ke `menuKeyMap`, agar izin menu (`menuPermissions` / `tenantDisabledMenus`) tetap berlaku sama seperti cek di `app/settings/universes/page.js:154-157`;
   - cek `default_tenant` staging: pastikan `universe_manager` tidak ada di daftar menu yang dinonaktifkan. Bila ada, laporkan dulu sebelum mengubah.
3. Tes: tampilan sidebar admin dan non-admin; tautan aktif (highlight) saat membuka `/settings/universes`.

---

## B. Perbaiki pembuat gambar acuan (`lib/reference-asset-prompt-builder.js`)
Saat ini karakter 3D akan dibuat **tanpa wajah**. Perbaikan:

| # | Masalah | Perbaikan |
|---|---|---|
| B1 | `isHuman` selalu true untuk pemilik VI, juga untuk karakter `depiction_mode = normal` | Tentukan manusia dari `subject.kind === 'human'` (VI) atau penanda karakter manusia faceless (`depiction_mode` faceless/back_view/silhouette). Karakter `stylized_3d_character`, kartun, hewan kartun, dan benda = **bukan** manusia faceless. |
| B2 | `character_sheet` selalu menambah "faceless character sheet… omitting facial features" + larangan `eyes, nose, mouth` | Hanya untuk subjek manusia faceless. Untuk karakter stylized: tambah "expressive cartoon face, consistent design across all views" dan **jangan** melarang mata/mulut. |
| B3 | `DEMOGRAPHIC_PRESETS.custom` adalah fungsi, sehingga teks fungsinya ikut tertulis di prompt | Abaikan demografi bila `custom`, bukan string, atau `subject.kind` bukan manusia. Jangan pernah jatuh ke default "a graceful Muslimah" untuk subjek non-manusia. |
| B4 | Sanitizer menghapus `smile`, `visible eyes`, `detailed eyes`, `front face` dari instruksi kustom | Terapkan hanya untuk subjek manusia faceless. |
| B5 | Tambahan untuk karakter | Tambah "plain warm cream background, no text, no labels, no humans, no hands" untuk karakter stylized. Rasio 1:1 (`nano_banana_pro`) tetap. |

Tes unit:
- VI `stylized_3d_character` dan karakter Universe `depiction_mode=normal` → prompt **tanpa** "faceless", negatif **tanpa** `eyes/mouth`.
- VI manusia `hands_only` → perilaku faceless **tetap seperti sekarang** (regresi DapurBotani).
- Demografi `custom` → tidak ada teks fungsi atau "Muslimah".

---

## C. Bantu buat gambar karakter Kawan Rumah (lewat aplikasi, staging)

1. **Buat Universe "Kawan Rumah"** di Universe Manager (atau lewat API yang dipakai halaman itu):
   - slug `kawan-rumah`;
   - `human_presence: stylized_3d_character`, `default_visual_style: stylized_3d_character`;
   - `universe_type`: nilai yang paling sesuai untuk benda rumah tangga (laporkan pilihanmu);
   - tone: "Hangat, lucu, relatable ala keluarga Indonesia";
   - `knowledge_domain: home_living`.
2. **Tambah 3 karakter** (`depiction_mode: normal`, `reference_type: identity`). Isi `canonical_prompt` dari bagian A/B/C file prompt, versi singkat **tanpa** instruksi lembar/tampak:

   | character_key | Nama | role | relative_size |
   |---|---|---|---|
   | `si_wajan` | Si Wajan | protagonist | medium |
   | `sponge` | Sponge | supporting | small |
   | `sapu` | Sapu | supporting | large |

   `character_key` **wajib sama** dengan `id` pemeran suara (`si_wajan`, `sponge`, `sapu`) dan `subject.character_keys` di VI versi 2.
3. **Buat gambar acuan** (setelah perbaikan B dideploy) lewat pengelola gambar acuan di tiap karakter, peran `character_sheet`:
   - Instruksi kustom: "model sheet: front, three-quarter, side and back view plus three expression close-ups; same exact colors and proportions".
   - Buat **3 variasi per karakter**.
   - **Jangan menyetujui sendiri.** Kirim tautan/thumbnail semua variasi ke pengguna, lalu pengguna yang memilih dan menekan Setujui di UI.
4. **Gambar lineup** untuk VI Kawan Rumah (peran `character_sheet` di VI, karena hanya 1 yang bisa disetujui): pakai prompt D dari file prompt, 2–3 variasi, lalu pengguna memilih.
5. **Hubungkan VI ke Universe:** isi `subject.universe_profile_id` dan `universe_slug` VI `vi_mwfzpljm_bf15cfe9` (menjadi versi 3). Simpan cadangan versi 2 dulu.
6. **Cek kuota:** gambar acuan memakai G-Labs (`nano_banana_pro`), bukan kuota Gemini. Laporkan jumlah gambar yang dibuat (target ≤ 12).

---

## D. Kirim gambar acuan karakter ke start frame (jalur VI stylized 3D)
Sekarang acuan karakter hanya dikirim bila `content_world === 'cartoon_universe'` (`scheduler-processors.js` ±6368–6461, `cartoon-reference-resolver.js`).

1. Bila `isStylizedCharacterVisualConfig` true **dan** VI punya `universe_profile_id`, jalankan `resolveClipReferenceImagesAsync` dengan Universe tersebut. Jalur VI stylized lainnya tetap seperti v2.48.6 (tanpa Scene Director, metafora, POV tangan, atau faceless).
2. **Karakter per klip:** ambil dari `planEntry.characters`, atau dari `character_id` di `voice_segments` klip itu. Bila kosong, pakai karakter utama (`si_wajan`). Kirim maksimal 3 acuan karakter + 1 acuan gaya.
3. Bila VI punya `character_sheet` lineup yang disetujui, kirim sebagai acuan **skala & gaya** (prioritas di bawah acuan per karakter).
4. Pastikan `style_limits.max_3d_clips = 1` (default validator di VI v2) **tidak** membatasi jalur stylized. Kelima klip harus tetap 3D.
5. Tes unit:
   - stylized + Universe → acuan karakter terkirim sesuai karakter klip;
   - stylized tanpa Universe → perilaku v2.48.6;
   - kampanye `cartoon_universe` lama → tidak berubah;
   - jalur herbal (DapurBotani) → tidak berubah.

---

## E. Uji, rilis, laporan
1. Tes unit A–D + regresi (`stylized-3d-dialog-d0`, `k7.1-fixes`, tes reference asset yang ada). `DISABLE_AUTO_MIGRATIONS=true PG_SEARCH_PATH=dev npm run build` harus lulus.
2. Rilis patch via `npm run release-non-interactive`. Deploy **staging saja** dengan SHA lengkap.
3. Kerjakan Bagian C di staging, lalu **berhenti**: kirim variasi gambar ke pengguna untuk dipilih/disetujui.
4. Setelah pengguna menyetujui gambar: jalankan uji **Start Frame** Kawan Rumah:
   - kampanye baru dari preset `kawan_rumah_3d_dialog`, dengan pemeran suara 3 karakter (`usulan-mcp-vi-preset-kawan-rumah.md` Bagian 4);
   - berhenti sebelum render video;
   - bandingkan wujud karakter di start frame dengan gambar acuan.
5. Laporan `plans/dialog-karakter/stage-gambar-karakter-report.md` (bahasa sederhana untuk ringkasan):
   - tangkapan layar sidebar;
   - variasi gambar per karakter;
   - contact sheet start frame;
   - daftar acuan yang terkirim per klip (dari log);
   - jumlah gambar G-Labs dan panggilan Gemini.
