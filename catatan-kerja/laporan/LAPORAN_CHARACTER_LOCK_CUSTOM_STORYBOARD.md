# Laporan: Character Lock untuk Custom Storyboard (jalur CFA) — v2.50.2

> Tanggal: 17 November 2026 · Dikerjakan oleh: Claude (Antigravity sedang error, atas permintaan pengguna)
> Instruksi: `catatan-kerja/instruksi-agent/antigravity_character_lock_custom_storyboard_instructions.md`
> Status: **SELESAI & TERBUKTI di Staging**

## Ringkasan

Sebelum perbaikan, kampanye dari CFA (custom storyboard, `direct_passthrough`) tidak membawa snapshot Visual Identity, sehingga gambar acuan karakter Universe **tidak pernah dilampirkan**. Sekarang snapshot VI disimpan pada kampanye. Uji nyata di Staging membuktikan gambar acuan Reno terkirim di setiap klip dengan model `nano_banana_pro`.

## Perubahan kode

`lib/custom-storyboard-pipeline.js`:

1. Impor `resolveVisualIdentitySubmission` dari `./visual-override-resolver.js`.
2. Fungsi baru `resolveCustomStoryboardIdentity(visualIdentityPresetId, resolver)` (diekspor agar bisa dites):
   - tanpa id → `{ ref: null, snapshot: null }`, resolver tidak dipanggil;
   - id ditemukan → kembalikan `ref` + `snapshot`;
   - **pengaman tambahan (tidak ada di instruksi awal):** bila resolver mengembalikan `ref.id === 'inline'`, snapshot **tidak disimpan**. Ini kondisi saat VI tidak ditemukan dan `resolveVisualIdentity` jatuh ke VI default "Muslimah Sage Kitchen" (`lib/visual-override-resolver.js:132–134`), yang tidak boleh tersimpan pada kampanye;
   - resolver error → warning, snapshot null.
3. Setelah `visualIdentityPresetId` ditentukan: `const identityResult = await resolveCustomStoryboardIdentity(visualIdentityPresetId);`

**Code Sebelum (Current/Before)** — objek `createPillarCampaign`:
```js
    visual_overrides_json: null,
    visual_identity_preset_id: visualIdentityPresetId,
    visual_identity_preset_version: 1,
```
**Code Sesudah (Proposed/After):**
```js
    visual_overrides_json: identityResult.snapshot ? JSON.stringify(identityResult.snapshot) : null,
    visual_identity_preset_id: identityResult.ref?.id || visualIdentityPresetId,
    visual_identity_preset_version: identityResult.ref?.version || 1,
```

Tidak diubah: `content_world` (tetap bukan `cartoon_universe`), `lib/pillar-campaign-ingest.js` (jalur Editorial), dan pemanggil start frame.

## Verifikasi pemanggil start frame (bagian B)

| Pemanggil | Sumber `campaign` | Hasil |
|---|---|---|
| `lib/start-frame-provider-adapter.js:10–16` (worker start frame) | `SELECT * FROM pillar_campaigns WHERE id=?` | ✅ membawa `visual_overrides_json` |
| `lib/campaign-scheduler.js:713` (preflight) | objek kampanye dari loop scheduler (DB) | ✅ |
| `lib/scheduler-processors.js:8111` (production_recovery) | kampanye dari DB; `contextReferences` kosong untuk non-kartun → auto-resolve berjalan | ✅ |

Tidak perlu perubahan tambahan.

## Pengujian

| Tes | Hasil |
|---|---|
| `tests/custom-storyboard-character-lock.test.js` (baru, 6 kasus) | ✅ 6/6 |
| `tests/test-custom-storyboard-mcp.test.js` (skema dev) | ✅ 6/6 |
| `tests/custom-storyboard-prompt-engineer.test.mjs` (skema dev) | ✅ 4/4 |
| `tests/test-cartoon-reference-url-resolver.mjs` | ✅ 1/1 |
| `npm run build` (`DISABLE_AUTO_MIGRATIONS=true`) | ✅ |

Catatan: dua tes integrasi wajib `PG_SEARCH_PATH=dev` (guard `assertSafeTestDbEnv`), dan dijalankan dengan `--env-file=.env.local`.
Insiden kecil: satu kali `node -e import(...)` untuk cek modul tanpa `DISABLE_AUTO_MIGRATIONS` menjalankan migrasi startup idempoten di **skema dev** (sama seperti saat server dev start). Setelah itu semua perintah memakai `DISABLE_AUTO_MIGRATIONS=true`.

Belum diuji nyata: jalur CFA produk (`gemini_engineer` + VI manusia DapurBotani/NutriBake). Secara kode, VI non-stylized tidak memicu referensi karakter. Perlu dipantau pada putaran CFA produk berikutnya.

## Rilis & deploy

| Langkah | Hasil |
|---|---|
| Rilis | **v2.50.2**, commit `7ef02a6b2bd0f16e090a2406f99ca1bc654d75ea`, tag `v2.50.2`, push ke `github.com/sabeq83/CF-Studio` |
| Dev | release `20261117T025317Z-7ef02a6b2bd0` · UI 5020 = 200 · API 7020 `/health` = 200 · PM2 online |
| Staging (09:58 WIB) | release `20261117T025550Z-7ef02a6b2bd0` · antrean kosong & 0 item CFA diproduksi saat aktivasi · `current` → rilis baru · UI 5010 = 200 · API 7010 `/health` = 200 · PM2 ui/api/mcp online, `pm_cwd` = rilis baru · `PG_SEARCH_PATH=staging`, `PGPOOL_MAX=3` |
| Production | tidak disentuh (SOP) |

Kartu menu `sot/menus/kartu/visual-identities.md` diperbarui (butir 4–5, v2.50.2).

## Uji nyata Staging

- Kampanye uji `cst_24aa4768bccb`, item #2226, 2 klip, preset `solusi_thermal_cfa`, VI Reno v4 `vi_mwk2cm17_3b3a3166`, `direct_passthrough`, **tidak dipublikasikan** (`enable_social_post=false`, `auto_sync_contentflow=false`).
- Log `maknaflow-staging-ui`:
  ```
  2026-11-17 09:59:07 [CharacterLock Async] Clip 1: characters=reno_thermal_engineer refs=1
  2026-11-17 09:59:07 [CharacterLock Async] Clip 2: characters=reno_thermal_engineer refs=1
  2026-11-17 09:59:25 [StartFrame Model] Clip 1 (item #2226): model=nano_banana_pro task=a5ebcaf2
  2026-11-17 09:59:42 [StartFrame Model] Clip 2 (item #2226): model=nano_banana_pro task=098841f8
  ```
- Start frame: `/uploads/start_frames/opc_start_frame_2226_clip_1_r1_a5ebcaf2.jpg` (ruang tamu, AC menetes) dan `/uploads/start_frames/opc_start_frame_2226_clip_2_r1_098841f8.jpg` (area pipa uap).
  - **Latar mengikuti adegan** dan tidak ikut meniru latar pabrik pada gambar acuan.
  - Helm biru, kacamata, rambut, dan jumpsuit navy-oranye konsisten di kedua klip.
- Video final: `/temp/opc_final_2226.mp4`, Nextcloud `http://100.78.186.123/index.php/s/RC6nPipZdyZs9Q5`.
- Seluruh pipeline selesai (TTS, start frame, Veo, FFmpeg, upload) dalam ±5 menit.

## Catatan lanjutan

- Penilaian akhir kemiripan wajah dengan gambar acuan perlu dilihat pengguna (video/start frame di atas).
- Maya belum diuji nyata, tetapi alurnya identik (VI v4 Maya sudah tersambung Universe).
