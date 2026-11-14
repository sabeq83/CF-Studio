# Usulan: Perbaiki VI Kawan Rumah & Buat Preset Dialog lewat MCP

> Tanggal: 2026-11-14 · Penulis: Claude (reviewer)
> Status: **SUDAH DIEKSEKUSI 2026-11-14** oleh Claude lewat MCP atas persetujuan pengguna (trio Si Wajan, Sponge, Sapu). Lihat Bagian 4.
> Lingkungan: MCP `cf-studio` terhubung ke **staging** (`default_tenant`). Ini sudah dicek: daftar 28 preset kustom dan isi VI `vi_mwfzpljm_bf15cfe9` identik dengan `staging.tenant_settings` / `staging.visual_identity_presets`. Production tidak tersentuh.

---

## 0. Kemampuan MCP (hasil cek)
| Kebutuhan | Alat MCP | Catatan penting |
|---|---|---|
| Baca VI | `cf_get_visual_identity` | ✅ sudah dicoba |
| Ubah VI | `cf_update_visual_identity` → `PUT /api/v2/visual-identities/:id` | Kirim **config lengkap** (bukan potongan), agar tidak ada bagian yang hilang |
| Buat preset | `cf_create_preset` → `POST /api/v2/operator-presets` | Config lengkap, kontrol penuh |
| Kloning preset | `cf_clone_preset` | Penggabungan **dangkal**: override `basic_strategy` mengganti seluruh bagian itu. Sumber yang cocok (brand_editorial_campaign) masih membawa VI tangan Muslimah & faceless, jadi **lebih aman pakai `cf_create_preset`** dengan config lengkap |
| Daftar pemeran (suara) di preset | — | **Belum didukung** (perbaikan D-3 belum dibuat). Untuk sementara, pemeran diisi di **kampanye** saat membuat kampanye uji |

---

## 1. Perbaikan VI "Kawan Rumah (Si Wajan)" — 3 karakter tetap

### Usulan pemeran inti (3)
| Karakter | Peran | Wujud tetap (dikunci di VI) | Suara (dari kampanye uji, bisa diganti setelah dengar sampel) |
|---|---|---|---|
| **Si Wajan** | Utama, yang curhat | Wajan antilengket bulat, badan hitam doff, gagang kayu terakota, mata besar, pipi merona | `Indonesian_energetic_streamer_vv2` |
| **Sponge** | Teman yang menenangkan | Spons cuci piring kotak, sisi kuning + sisi hijau sage kasar, mata bulat kecil, senyum lebar | `Indonesian_intellectual_commentator_vv2` |
| **Sapu** | Teman yang ceplas-ceplos | Sapu ijuk, gagang hijau sage, ikatan ijuk cokelat, alis tebal ekspresif | `Indonesian_crisp_reporter_vv2` |

**Kenapa Kulkas dikeluarkan dari pemeran inti:** ukurannya jauh lebih besar daripada wajan dan spons. Kalau ketiganya ditaruh dalam satu frame, Kulkas terpotong atau yang lain jadi kecil sekali. Kulkas cukup jadi latar atau tamu sesekali. (Pengguna bisa memilih trio lain.)

**Latar yang membuat ketiganya muat dalam satu adegan:** meja dapur di samping bak cuci. Wajan di atas kompor/meja, Sponge di tepi bak, Sapu bersandar di ujung meja.

### Perubahan field (selain yang tercantum, tetap)
| Field | Sekarang | Usulan | Alasan |
|---|---|---|---|
| `label` | Kawan Rumah (Si Wajan) | Kawan Rumah (Si Wajan, Sponge, Sapu) | Jelas berisi 3 pemeran |
| `subject.character_count` | 1 | **3** | Dialog butuh lebih dari 1 karakter dalam frame |
| `subject.population_mode` | single | **group** | Nilai resmi yang tersedia: single/group/crowd |
| `subject.character_keys` | [] | `["si_wajan","sponge","sapu"]` | Harus sama dengan `id` pemeran suara |
| `subject.custom_description` | Si Wajan + "supporting objects (sofa, broom, fridge, sponge)… Any human is faceless or hands only." | Deskripsi wujud tetap 3 karakter di atas + "**No humans and no human hands in frame. No other talking objects.**" | Mengunci wujud dan mencegah karakter liar atau tangan manusia |
| `composition.primary_subject_count` | 1 | **3** | Sama dengan jumlah karakter |
| `metaphor_engine.enabled` | true | **false** | Tidak dipakai untuk karakter 3D (sudah dimatikan otomatis di kode; disamakan agar tidak membingungkan) |
| `wardrobe.sleeve_policy` | wrists_covered | `not_applicable` (bila nilai ditolak validator, biarkan) | Aturan baju manusia tidak relevan |
| `guardrails.required_negative_prompts` | 4 item | + `human hands`, `people`, `extra unnamed characters`, `realistic photo` | Memperkuat gaya 3D dan pemeran terkunci |
| `environment.custom_description` | Rumah umum + diorama isometrik | "Cozy Indonesian kitchen counter beside the sink (main set where all three characters fit together); occasional living room corner for Sapu scenes; consistent warm cream/terracotta/sage palette" | Satu set utama = konsistensi dan karakter muat bersama |
| `camera` | framing object_or_animal, third_person | Tetap; tambah di `style.custom_description`: "two-shot or over-the-shoulder framing during dialogue, listener reacts while speaker talks" | Tata bahasa dialog tanpa lip-sync (D-8) |

Tidak diubah: gaya `stylized_3d_character`, rendering glossy Pixar, palet, pencahayaan siang hangat, `mode_routing`.

### Langkah eksekusi (setelah disetujui)
1. `cf_get_visual_identity` → simpan salinan config lama ke `plans/dialog-karakter/backup-vi-kawan-rumah-v1.json` (untuk rollback).
2. `cf_update_visual_identity` dengan config lengkap hasil perubahan.
3. `cf_get_visual_identity` lagi → cocokkan setiap field. Laporkan field yang ditolak atau dinormalisasi validator.
4. Kampanye lama (#2175/#2176) tidak terpengaruh, karena memakai snapshot versi 1.

---

## 2. Preset baru `kawan_rumah_3d_dialog`

Dibuat dengan `cf_create_preset`. Struktur mengikuti `brand_editorial_campaign`, dengan perubahan bertanda ★.

| Bagian | Isi usulan |
|---|---|
| `label` | ★ Kawan Rumah — Dialog 3D (5 Klip @ 8s) |
| `campaign_kinds` | `["brand_editorial"]` (kampanye OPC/Pillar seperti uji D-0) |
| `basic_strategy` | narrative `Storytelling`; `voice_provider: minimax`; ★`voice_persona: Indonesian_energetic_streamer_vv2` (suara Si Wajan, juga cadangan); `tts_model_quality: speech-2.8-turbo`; `target_language: id-ID`; `target_demographic: ibu_rumah_tangga`; `promotion_style: Softselling`; ★`enable_audio_segment: true`; `sfx_setting: without_sfx`; `enable_vo_audit: 1`; ★`nextcloud_parent_folder: /MAKNA_Assets/ASET_KAWANRUMAH`; ★`ai_directive`: "Dialog santai, hangat, lucu ala keluarga Indonesia antara Si Wajan, Sponge, dan Sapu. Bergantian, kalimat pendek, tanpa klaim berlebihan."; `mandatory_outro_line`: kosong (atau diisi pengguna) |
| `visual_engine` | `visual_style: Cinematic`; `visual_mode: hybrid_lock`; `video_model: veo_31_lite`; ★`clip_duration: 8`; ★`target_clips_count: 5`; ★`words_per_clip: "16-20 kata"` (±8–10 kata per karakter); ★`face_visibility: cartoon_face`; `aspect_ratio: 9:16` |
| `product_bridging` | ★Nonaktif untuk uji D-0 (`is_bridging_active: false`). Versi afiliasi nanti: preset terpisah dengan bridge di klip 4 |
| `visual_swap` | `is_vso_active: true`; ★`visual_identity_preset_id: vi_mwfzpljm_bf15cfe9`; ★`visual_style_preset: stylized_3d_character`; ★`character_concept`: tidak `faceless` (biarkan kosong/sesuai VI); lighting `window_daylight` |
| `workflow` | `approval_mode: storyboard` (berhenti untuk review); `enable_tts/glabs/ffmpeg: true`; `enable_motion_text: true`; ★`enable_social_post: false`; lainnya mengikuti sumber |

**Daftar pemeran suara:** belum bisa disimpan di preset (menunggu D-3). Saat membuat kampanye uji, isi `voice_cast_json` kampanye dengan 3 pemeran di tabel Bagian 1. Setelah D-3 selesai, pindahkan ke preset.

### Langkah eksekusi (setelah disetujui)
1. `cf_create_preset` (key `kawan_rumah_3d_dialog`).
2. `cf_get_preset_detail` → cocokkan isi, laporkan field yang dinormalisasi.
3. Tidak menjalankan kampanye apa pun. Uji Start Frame tetap dijalankan agent sesuai laporan v2.48.6 (berhenti sebelum render video).

---

## 3. Yang perlu diputuskan pengguna
1. Setuju dengan trio **Si Wajan, Sponge, Sapu**? Atau ganti Sponge/Sapu dengan Kulkas?
2. Siapa yang mengeksekusi: **Claude lewat MCP** (perubahan data staging, bukan kode) atau Antigravity?
3. Suara: pakai yang ada dulu, lalu ganti setelah mendengar sampel di uji Start Frame/TTS?

---

## 4. Hasil eksekusi (2026-11-14, staging)
| Langkah | Hasil |
|---|---|
| Cadangan VI lama | `plans/dialog-karakter/backup-vi-kawan-rumah-v1.json` (versi 1) |
| Ubah VI `vi_mwfzpljm_bf15cfe9` | ✅ Tersimpan sebagai **versi 2**. Semua field usulan cocok saat dibaca ulang. `sleeve_policy: not_applicable` diterima. |
| Field yang ditambahkan otomatis oleh validator | `schema_mode: legacy`, `metaphor_engine.mode: off`, `style_limits: {max_3d_clips: 1, allow_cartoon: false, …}` (nilai default), dan field kosong `lighting.character`, `wardrobe.palette`, `environment.fallback_location`, `signature_accents` |
| Buat preset `kawan_rumah_3d_dialog` | ✅ Revision 1. Semua field cocok saat dibaca ulang. |

### Catatan untuk Antigravity sebelum uji Start Frame
1. **`style_limits` default (`max_3d_clips: 1`, `allow_cartoon: false`)** ikut tersimpan di VI. Batas ini dipakai jalur Scene Director (`angle-visual-formats.js` ±629, `visual-identity-allocator.js` ±307). Pastikan jalur karakter 3D (`isStylizedCharacterVisualConfig`) **tidak** membaca batas ini, sehingga 5/5 klip tetap 3D. Bila ternyata terbaca: validator harus mengabaikan/mengisi `style_limits` yang sesuai untuk VI stylized. Jangan ubah VI secara manual.
2. **Pemeran suara di kampanye** (preset belum mendukung, menunggu D-3). Pakai 3 karakter ini:
   ```json
   {"characters":[
     {"id":"si_wajan","name":"Si Wajan","minimax_voice_id":"Indonesian_energetic_streamer_vv2","gemini_voice_id":"Puck"},
     {"id":"sponge","name":"Sponge","minimax_voice_id":"Indonesian_intellectual_commentator_vv2","gemini_voice_id":"Callirrhoe"},
     {"id":"sapu","name":"Sapu","minimax_voice_id":"Indonesian_crisp_reporter_vv2","gemini_voice_id":"Aoede"}
   ]}
   ```
3. Buat kampanye uji **baru** dari preset `kawan_rumah_3d_dialog`. Jangan pakai #2175/#2176, karena masih memakai snapshot VI versi 1 (4 karakter).
4. Cek di Start Frame:
   - ketiga karakter tampil dengan wujud sesuai deskripsi;
   - minimal satu adegan berisi 2 karakter atau lebih;
   - tidak ada tangan manusia;
   - `result_json.voiceover[].voice_segments` hanya memakai `si_wajan` / `sponge` / `sapu`.
5. **Kirim sampel suara 3–5 detik per karakter** ke pengguna.
