# Handoff Antigravity: Custom Storyboard `gemini_engineer` Selalu Gagal

> Tanggal: 15 Nov 2026 · Prioritas: **tinggi** (memblokir semua video produk lewat Custom Storyboard)
> Ditemukan oleh: Claude (review) · Status: **belum diperbaiki**

## Gejala
- Kampanye `cst_228a741fdcbe` (item 2193, NutriBake Premix Cocoa) berstatus `failed` tanpa pesan error tersimpan.
- Log staging (`staging-api.out.log`, rilis `20261115T054227Z-5ab1aa995405`):
  ```
  [Pillar Generator] Failed to generate storyboard for item 2193: ReferenceError: topicComplianceSection is not defined
  ```
  Dicoba otomatis 3x, lalu ditandai gagal. Gagal sebelum start frame, jadi kuota G-Labs tidak terpakai.

## Penyebab
- `lib/prompts.js` → `buildCustomStoryboardPromptEngineerPrompt` (±baris 3524).
- Fungsi ini memakai `${topicComplianceSection}` di ±baris 3652, tapi variabel itu **tidak ikut di-destructure** dari `buildPillarSharedPromptContext(...)` (±baris 3545–3576).
- Pembandingnya, `buildOrganicPillarPrompt` (±baris 3343) sudah men-destructure-nya dengan benar.
- Muncul sejak commit `f64476b` — *release: v2.48.2 — K7.1 Jalur B wardrobe lock, night lighting, heart claim & test DB guard* (14 Nov 2026).
- Dampak: **setiap** Custom Storyboard dengan `prompt_mode = gemini_engineer` gagal. Mode `direct_passthrough` (HabitFolk) tidak terdampak.

## Perbaikan (satu baris)

**Code Sebelum (Current/Before)** — `lib/prompts.js` ±baris 3575:
```js
    storytellingRule7,
    faceVisibility
  } = buildPillarSharedPromptContext(kbTexts, effectiveCampaignData, productData, brandProfile, vsoData);
```

**Code Sesudah (Proposed/After):**
```js
    storytellingRule7,
    faceVisibility,
    topicComplianceSection
  } = buildPillarSharedPromptContext(kbTexts, effectiveCampaignData, productData, brandProfile, vsoData);
```

## Saran tambahan (opsional)
1. **Unit test regresi:** panggil `buildCustomStoryboardPromptEngineerPrompt` dengan data minimal dan pastikan tidak melempar error. Bug serupa akan langsung tertangkap.
2. **Simpan pesan error ke kampanye.** Saat ini `generation_status = failed` tanpa alasan, sehingga diagnosis harus lewat log server.

## Langkah setelah perbaikan
1. Rilis patch sesuai SOP: `npm run release-non-interactive -- --type patch --title "Fix topicComplianceSection di Custom Storyboard gemini_engineer" --points "..."`
2. Deploy ke **staging** (atomic, full SHA). Jangan ke Production tanpa instruksi pengguna.
3. Beri tahu pengguna. Claude akan mengirim ulang video uji NutriBake dengan idempotency key baru (naskah di `uji-kertas-claude/NASKAH_UJI_NUTRIBAKE_PREMIX_COCOA.md`).
