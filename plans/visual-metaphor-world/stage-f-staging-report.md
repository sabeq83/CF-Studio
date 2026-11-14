# Laporan Implementasi & Uji Staging — Tahap F (Metaphor World Kit + Metaphor Policy F1+F2)

- **Tanggal:** 2026-11-14
- **Rilis / Tag:** `v2.46.0` (commit `9e6bbbde9aaa53801605dabcb32ebfc79bec90b8`)
- **Lingkungan Uji:** Staging Mac Mini (`http://100.95.245.55:5010`, API `7010`, DB schema `staging`)
- **Status Production:** **Tidak tersentuh** (tanpa deploy, tanpa migrasi, tanpa perubahan flag/data di schema `public`)

---

## 1. Ringkasan Eksekusi Rilis, Migrasi & Deploy Staging

| Tahapan | Hasil | Bukti / Catatan Verifikasi |
|---|---|---|
| **F1 — Rilis Non-Interaktif** | Lulus | `v2.46.0` commit `9e6bbbde9aaa53801605dabcb32ebfc79bec90b8`, branch `main` dan tag `v2.46.0` ter-push ke remote GitHub |
| **F2 — Migrasi Schema `staging`** | Lulus | Tabel `metaphor_kit_usage` dibuat melalui `scripts/migrate-metaphor-kit-usage.mjs` pada `PG_SEARCH_PATH=staging,public` |
| **F2 — Atomic Deploy Staging** | Lulus | Release ID `20261114T020607Z-9e6bbbde9aaa` aktif; `maknaflow-staging-ui` & `maknaflow-staging-api` status `online`; `PG_SEARCH_PATH=staging`, `PGPOOL_MAX=3`; UI & `/health` HTTP 200 |
| **F3 — Isolasi Feature Flag** | Lulus | `tenant_settings.metaphor_kit_engine = 'on'` hanya 1 baris pada `tenant_id = 'default_tenant'` |
| **F3 — Visual Identity Test** | Lulus | `vi_dapurbotani_metaphor_world_test` (`preset_key: dapurbotani_metaphor_world_test`) dikloning dari `vi_dapurbotani_apothecary_3d_female`; VI asli tidak diubah |

### Konfigurasi VI Test (`vi_dapurbotani_metaphor_world_test`)
- `environment.policy`: `"metaphor_driven"`
- `metaphor_engine`:
  - `enabled`: `true`
  - `pattern`: `"concept_to_object_to_action"`
  - `hands_policy`: `"modest_hands_active"`
  - `product_entry`: `"inside_metaphor"`
  - `lighting_arc`: `"kit"`
- `mode_routing.mechanism`: `"symbolic_surrealism"`

---

## 2. Hasil Uji Batch 7 Video DapurBotani di Staging

- **Campaign ID:** `opc_261114_g0zltt` (`status: 'completed'`)
- **Tautan UI Staging:** `http://100.95.245.55:5010/pillar-campaigns/opc_261114_g0zltt`
- **Brand & Produk:** `dapurbotani` (`df382ce8-2145-4464-ae63-79375ff3aff2`) — `GarliBee — Honey Infused Solo Garlic` (`pe_1793545394035_6698`)
- **Struktur Klip:** `6` klip per video, `bridge_at_clip = 3`, `bridge_duration_clips = 1`
- **Catatan Eksekusi Pipeline:** Campaign awalnya dibuat dalam mode `creative_review` (storyboard selesai tanpa T2I Start Frame), lalu dialihkan ke `full_autopilot` (Start Frames, TTS, G-Labs Veo, dan FFmpeg aktif) dengan `#2126` di-reset ke `generation_status = 'pending'` untuk menguji **sticky kit regeneration**.

| Item | Topik Terdeteksi (`kit_topics`) | `kit_key` Terpilih | `kit_reason` | Start Frames | Video Final (`http://100.95.245.55:5010/...`) |
|---|---|---|---|---|---|
| `#2126` | `kolesterol` | `oil_powder_emulsify` | `sticky` | 6/6 | `/temp/opc_final_2126.mp4` |
| `#2127` | `pencernaan` | `ayce_plate_tower` | `rotation` | 6/6 | `/temp/opc_final_2127.mp4` |
| `#2128` | `kesehatan_kulit` + `stamina` | `santan_food_coma` | `rotation` | 6/6 | `/temp/opc_final_2128.mp4` |
| `#2129` | `kolesterol` | `greasy_tupperware` | `rotation` | 6/6 | `/temp/opc_final_2129.mp4` |
| `#2130` | `pencernaan` | `sink_drain_unclog` | `rotation` | 6/6 | `/temp/opc_final_2130.mp4` |
| `#2131` | `kesehatan_kulit` | `carpet_deep_clean` | `rotation` | 6/6 | `/temp/opc_final_2131.mp4` |
| `#2132` | `pencernaan` | `clogged_clear_tube` | `rotation` | 6/6 | `/temp/opc_final_2132.mp4` |

*(Catatan: `#2129` sempat mengalami 1× kegagalan G-Labs Veo `PUBLIC_ERROR_USER_MINOR` pada Task `7432be3f` di percobaan pertama, lalu berhasil selesai penuh hingga FFmpeg pada percobaan ulang tanpa mengubah kode).*

---

## 3. Verifikasi Rotasi, Sticky Kit & Kebersihan Prompt

1. **Keragaman Kit (7/7 Unik):** Seluruh 7 item memilih kit yang berbeda satu sama lain (`oil_powder_emulsify`, `ayce_plate_tower`, `santan_food_coma`, `greasy_tupperware`, `sink_drain_unclog`, `carpet_deep_clean`, `clogged_clear_tube`) dan tercatat dalam `metaphor_kit_usage` (7 baris `reason = 'rotation'`).
2. **Sticky Kit Test (`#2126`):** Setelah `#2126` dijalankan ulang melalui `processPillarGenerator`, resolver tetap mengunci `oil_powder_emulsify` dengan `kit_reason = 'sticky'` dan tanpa menduplikasi entri di `metaphor_kit_usage` (jumlah baris tetap 7).
3. **Audit Prompt (42 Klip `t2i_prompt` & `visual_action`):**
   - Kebocoran `ABSOLUTELY ZERO HANDS`: **0 / 42 klip**
   - Kebocoran kata `3D` / `CGI` / `anatomical`: **0 / 42 klip**
   - Kebocoran penyebutan produk/botol GarliBee sebelum bridge (Klip 1–2): **0 / 14 klip**
4. **Resolved Metaphor Policy (`resolved_metaphor_policy`):** Ketujuh item menyelesaikan `active: true`, `environmentPolicy: 'metaphor_driven'`, `handsPolicy: 'modest_hands_active'`, `productEntry: 'inside_metaphor'`, serta `lightingArc` dan `sceneEnvironment` sesuai kit masing-masing.

---

## 4. Hasil Inspeksi Visual Contact Sheet

Berkas contact sheet hasil generasi frame aktual dari Staging (`http://100.95.245.55:5010/uploads/start_frames/...`):
- **Ringkasan 3×3 (Klip 1 Hook \| Klip 2 Struggle \| Klip 3 Bridge + Baseline `#2013`):** `/Users/sabeqmmursyid/.gemini/antigravity/brain/0a15a433-ced2-491e-98e0-5a2cf8630a0d/contact_sheet_3x3_summary.png`
- **Matriks Penuh 7×6 (42 Start Frames):** `/Users/sabeqmmursyid/.gemini/antigravity/brain/0a15a433-ced2-491e-98e0-5a2cf8630a0d/contact_sheet_7x6_full.png`

### Temuan Inspeksi Frame Aktual
- **Latar Unik per Video & Bebas 3D CGI:** Setiap video tampil dengan latar rumah tangga siang hari yang berbeda (mangkuk emulsi minyak, menara piring, meja makan kuah santan dengan tatakan rotan, wadah plastik/wajan berminyak, wastafel tersumbat, karpet ruang tamu berdebu, selang transparan di bak cuci). Berbeda jelas dari baseline `opc_261103_8kz9ko #2013` yang bernuansa gelap/malam. **0 / 42 frame** memunculkan 3D CGI atau anatomi seluler.
- **Zero Bottles Pre-Bridge:** **0 / 14 frame** pada Klip 1–2 menampilkan toples GarliBee (`#2128` Klip 2 hanya menampilkan botol bumbu dapur kabur di latar belakang).
- **Produk di Dalam Dunia Metafora (Bridge Klip 3):** **7 / 7 frame** Klip 3 menempatkan toples kaca persegi **GarliBee** berlabel hitam langsung di dalam adegan metafora masing-masing item.
- **Kebijakan Tangan Syar'i & Catatan Jujur Klip 1:**
  - Pada **Klip 2–6**, model konsisten merender tangan dengan lengan panjang soft-mocca yang menutupi pergelangan tangan (kebijakan `modest_hands_active` aktif dan tidak tertekan oleh `ZERO HANDS`).
  - **Temuan minor pada Klip 1 (Hook):** Walau prompt Klip 1 disusun berfokus objek tanpa instruksi tangan, model T2I masih memunculkan tangan pada Klip 1 di 6 item (`#2126`, `#2127`, `#2128`, `#2129`, `#2131`, `#2132`, termasuk lengan bawah terbuka pada `#2129` Klip 1 dan `#2131` Klip 1). Hanya `#2130` (`sink_drain_unclog`) yang 100% pure object-only pada Klip 1. *(Catatan untuk iterasi lanjutan bila diinginkan: perketat negative/object framing khusus Klip 1 saat `hands_policy = 'modest_hands_active'`).*

---

## 5. Kegagalan Tes Lama yang Dicatat (Tidak Diubah)

Sesuai instruksi, kegagalan tes yang sudah ada sebelum pekerjaan F1+F2 tidak diubah dan dicatat sebagai berikut:
1. `tests/bridge-prompt-snapshot.test.js` — selisih 284 karakter pada blok `"finishing_plan"` (pre-existing terhadap `HEAD`).
2. `tests/test-visual-identity-allocator.mjs` (baris `100`) — ekspektasi lama allocator yang sudah gagal sebelumnya.
3. `tests/test-autonomous-product-pipeline-preset-integration.test.js` — kegagalan pre-existing.
4. `tests/test-visual-mode-preset-resolution.test.js` — kegagalan pre-existing.
5. `tests/pillar-glabs-stale-recovery.test.mjs` (#3) — kegagalan pre-existing.

