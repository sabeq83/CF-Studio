# Kartu Menu: Multiplier Labs

Terakhir dicek: 25 November 2026 · Versi aplikasi: v2.62.1
Alamat: `/multiplier-lab` (form) dan `/multiplier-lab/<id>` (detail hasil) · Kelompok: WORKFLOW · Kunci izin menu: `multiplier_lab`

## Fungsi
"Pabrik remake". Mengambil satu blueprint video viral (hasil Deconstruct Lab), memasukkan produk kita, lalu menghasilkan banyak video baru dengan sudut pandang (angle) berbeda. Produk disisipkan secara halus di tengah cerita, bukan iklan kasar.

## Alur pakai
1. Pilih blueprint dari hasil Deconstruct Lab.
2. Pilih produk (satu atau banyak), tautan affiliate, gaya visual, dan suara.
3. Atur penyisipan produk: mulai di klip ke berapa dan berapa klip lamanya.
4. Buat pilihan angle, lalu jalankan.
5. Di halaman detail: tinjau naskah dan gambar awal, perbaiki bila perlu, lalu setujui.
6. Kirim hasil ke ContentFlow Hub / penyimpanan.

## Pola cerita (N klip)
Pembuka viral tanpa sebut produk → jembatan ke produk → bukti/hasil → ajakan (CTA) di klip terakhir.

## Terhubung dengan
- Butuh data dari: Deconstruct Lab (blueprint), Product Database (data + foto produk), Visual Identity, Preset.
- Hasilnya dipakai oleh: ContentFlow Hub; bisa juga dijalankan otomatis lewat Auto Pipeline (`multiplier_campaign`).
- Perintah MCP: `cf_create_multiplier_video`, `cf_preview_multiplier_angles`, `cf_list_multiplier_tasks`, `cf_retry_multiplier_task`, `cf_search_blueprints`, `cf_list_deconstructed_assets`, `cf_get_deconstructed_blueprint`.

## Lokasi (untuk agent)
- Form: `app/components/campaign-forms/MultiplierConfigurationForm.js` (halaman `app/multiplier-lab/page.js` hanya pembungkus)
- Detail: `app/multiplier-lab/[id]/page.js`
- API: `app/api/v2/multiplier/` — `route`, `generate-angles`, `[id]`, `[id]/approve`, `[id]/retry`, `[id]/update-creative`, `[id]/regenerate-t2i`, `[id]/regenerate-start-frames`, `[id]/replace-start-frame`, `[id]/sync-contentflow`, `[id]/sync-nextcloud`
- Logika inti: `lib/re-multiplier-worker.js` (± 1.800 baris — cari dengan kata kunci), `lib/multiplier-resume.js`, `lib/multiplier-artifacts.js`, `lib/multiplier-start-frame-request.js`, `lib/product-photo-policy.js`, `lib/product-reference-resolver.js`, `lib/multiplier-angle-generator.js`, `lib/multiplier-pairing.js`, `lib/multiplier-audio-config.js`, `lib/blueprint-product-matcher.js` (`GET /api/v2/deconstruct/matches` untuk rekomendasi Alat Dapur vs Bahan Resep)
- Komponen pratinjau foto bridging: `app/components/BridgingProductReferenceCard.js`
- Pedoman naskah: `kb/MULTIPLIER_BRIDGING_GUIDE.md`
- Tabel data: `re_multiplier_tasks` (terhubung ke `re_deconstructed_assets`)

## Aturan penting & jebakan
1. Satu blueprint bisa punya banyak tugas multiplier; tiap baris = satu angle/produk.
2. Produk **tidak boleh disebut** sebelum klip jembatan (`bridge_at_clip`).
3. Karakter, pakaian, dan pencahayaan harus konsisten mengikuti Visual Identity aktif.
4. Ada dua alamat API mirip: `/api/v2/multiplier/` (utama) dan `/api/v2/multiplier-lab/` (hanya sinkron). Jangan tertukar.
5. Render akhir memakai slot produksi, jadi membuat Video Studio menunggu.
6. Editor detail & worker TTS menormalisasi key VO adegan (`narration` ↔ `narration_transcript`, termasuk alias/typo AI seperti `narrating_transcript` dan pencocokan dinamis) saat generate dan saat `update-creative`; jika ada VO adegan kosong saat `remaking`, worker menjalankan 1× auto-repair dan menahan ke `waiting_approval` bila tetap kosong sebelum tahap T2I/TTS.
7. Resolusi foto produk bridging menghormati `active_photo` (`resolveCampaignProductPhotoPath`) dan kontrak T2I `buildMultiplierStartFrameRequest` (`{ category: 'subject' }`, `[HIGHEST PRIORITY PRODUCT IDENTITY LOCK]`, `expected_reference_sha256s`, `webhookOverride`, sanitasi non-bridging, fail-fast bila file hilang); halaman detail memakai `zoneOf`, `safeJsonParse`, empty-state batch, dan kartu `BridgingProductReferenceCard`.
8. **Smart Resume & Retry (`retry_task` / `failed_stage`):** Worker menyimpan `failed_stage`, `handleT2iGeneration` me-reuse start frame per klip yang sudah ada di disk, dan tombol retry baris (`smart_resume`) melanjutkan langsung dari tahap terakhir yang gagal (mis. `ffmpeg_muxing` bila klip `.mp4` sudah lengkap atau `uploading_assets` bila video final sudah dirender) tanpa mengulang Gemini/T2I; `getStageStatus` juga mendukung mode `no_vo` / `native_veo`.
9. **Mode Tanpa VO (`no_vo`) & T2I Polling 120s:** Form Multiplier (`MultiplierConfigurationForm.js`) mendukung pemilihan `audio_engine_mode: 'no_vo'` beserta `no_vo_audio_bed` dan `on_screen_text_mode`, worker melewatkan TTS tanpa menulis kolom non-eksis, dan polling T2I diperpanjang hingga 120 detik dengan logging kegagalan.
10. **Shopee 2 Klip `Direct_Showcase` (`bridge_at_clip: 1`):** Form Multiplier menyediakan opsi `Direct_Showcase` dan preset `shopee_2clip_showcase_vo` / `shopee_2clip_showcase_no_vo`; prompt builder (`lib/prompts.js`, `lib/kb/dynamic-story-curve.js`, `lib/bridging/bridge-prompt-zones.js`) menghilangkan blok non-produk/`strictly no product shown` serta `KLIP 2 SAMPAI 1` ketika seluruh klip (`1..2`) merupakan klip produk.
11. **Wardrobe Color Lock Per Baris & Proteksi `combined_audio_path`:** `resolveVisualIdentitySnapshot`, `buildMultiplierPhase2Prompt`, dan `buildMultiplierStartFrameRequest` mengunci 1 warna solid deterministik dari `wardrobe.palette` per baris (`batch_id:task.id`) sambil tetap membolehkan warna berbeda antar-video/baris; `update-creative` & polling UI mempertahankan `combined_audio_path`/`tts_skipped_reason`, dan `handleVisualGeneration` memulihkan file `tts_multiplier_combined_<id>.mp3/.wav` dari disk sebelum fallback concat bisu agar VO & Motion Text tetap ter-render via `ffmpeg_muxing`.

## Belum ada / batasan
- Blueprint harus sudah dibedah di Deconstruct Lab; menu ini tidak membedah video sendiri.

## Dokumen lengkap
- `kb/MULTIPLIER_BRIDGING_GUIDE.md` — aturan cerita dan penyisipan produk (masih relevan, pendek).
- `sot/menus/multiplier-lab.md` — **sebagian sudah usang**: masih menyebut alamat `/re-multiplier`, SQLite, dan contoh kode lama. Pakai hanya untuk memahami konsep alur, bukan detail teknis.
