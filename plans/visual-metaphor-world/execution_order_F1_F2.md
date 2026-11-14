# Urutan Eksekusi Gabungan F1 + F2 (Satu Rilis)

> Status: **RENCANA — menunggu persetujuan eksekusi.** Belum ada kode yang diubah.
> Keputusan: F1 + F2 digabung dalam satu rilis (2026-11-14).
> Detail per tugas: [F1](implementation_plan_F1.md) · [F2](implementation_plan_F2.md)

## Prinsip urutan
1. **Fondasi tanpa efek samping dulu**: data kit, schema, dan helper murni. Semua bisa dites tanpa menyentuh pipeline.
2. **Integrasi pipeline di satu titik** (`processPillarGenerator`), lalu konsumen (prompt, sanitizer, start-frame).
3. **Gate regresi sebelum rilis**: snapshot lama harus identik saat flag/switch off.
4. Satu rilis, satu flag (`metaphor_kit_engine`), satu VI test di staging.

## Execution Task List (gabungan)

### Tahap A — Verifikasi & fondasi (tanpa menyentuh pipeline)
- [x] A1. (F2-T1) Verifikasi alur data: field snapshot VI di `tempCampaign`; `campaign` di `opc-start-frame-request.js` = `tempCampaign`?
- [x] A2. (F1-T1) `detectHealthTopics` + alias di `lib/health-metaphors.js` + tes snapshot `resolveHealthMetaphor`
- [x] A3. (F1-T2/T3) `lib/metaphor-world-kits.js` + 28 seed kit (beat pre-bridge object-only, `hand_variant`, `lighting_arc`, `vo_bridge`, `compliance_note`)
- [x] A4. (F1-T4) `tests/metaphor-world-kits.test.js`
- [x] A5. (F2-T2) Field `environment.policy` + `metaphor_engine.{hands_policy, product_entry, lighting_arc}` di `lib/visual-identity-contract.js` + compliance report
- [x] A6. (F2-T3) `lib/metaphor-policy.js` + `tests/metaphor-policy.test.js`

### Tahap B — Rotasi & penyimpanan
- [x] B1. (F1-T5) `lib/metaphor-kit-usage-repository.js` + migrasi `lib/db-pg.js` + `scripts/migrate-metaphor-kit-usage.mjs`
- [x] B2. (F1-T6) `lib/metaphor-kit-resolver.js` + `tests/metaphor-kit-resolver.test.js`

### Tahap C — Integrasi pipeline (satu titik resolve)
- [x] C1. (F1-T7 + F2-T4) `processPillarGenerator`: resolve kit (flag `metaphor_kit_engine`, tanpa fallback default_tenant) → resolve policy → simpan `resolved_health_metaphor` + `resolved_metaphor_policy` ke `tempCampaign` dan `result_json`

### Tahap D — Konsumen
- [x] D1. (F1-T8 + F2-T7) `lib/prompts.js`: blok kit (`:2349`), tuple notice (`:2163`), mandate header, cabang legacy (`:2342`), pemanggil allocator (`:2156`)
- [x] D2. (F2-T8) `lib/visual-identity-allocator.js`: parameter `metaphorPolicy`, remap 3D, teks latar `metaphor_driven`
- [x] D3. (F2-T5) `applyPromptReplacements` (`scheduler-processors.js:158–175`): tangan aktif + lighting arc
- [x] D4. (F2-T6) `opc-start-frame-request.js:125–129`

### Tahap E — Gate kualitas
- [x] E1. (F2-T9) `tests/metaphor-policy-prompt.test.js` + regresi penuh (snapshot `bridge-prompt-stage1`, `apply-replacements-clip-index`, `dynamic-bridge-isolation`, allocator, garlibee, multiplier dual-realm, opc-planner) + `npm run build`
- [x] E2. (F2-T11) `f2-prompt-diff.md`: diff prompt 1 baris DapurBotani (flag off vs on)
- [x] E3. (Opsional) Badge UI kit + policy di `app/pillar-campaigns/[id]/page.js` (F1-T9 + F2-T10)

### Tahap F — Rilis & uji staging (hanya atas persetujuan eksplisit)
- [ ] F1. `npm run release-non-interactive -- --type minor --title "Metaphor World Kit + Metaphor Policy (F1+F2)" --points "..."`
- [ ] F2. Migrasi `metaphor_kit_usage` di schema `staging` → deploy staging atomic (full SHA)
- [ ] F3. Nyalakan `metaphor_kit_engine=on` **hanya** di `default_tenant`; buat VI test `dapurbotani_metaphor_world_test` (VI asli tidak diubah)
- [ ] F4. Batch 6–7 baris DapurBotani → cek kit berbeda, sticky, tangan syar'i, latar per video, tidak ada botol pre-bridge, tanpa 3D → contact sheet + laporan

## Titik keputusan yang masih terbuka (dari F1 & F2)
| # | Keputusan | Default yang akan saya pakai bila Anda setuju |
|---|---|---|
| 1 | Penyimpanan kit | File JS (Git); DB hanya untuk usage |
| 2 | Window rotasi | 6 video per brand |
| 3 | Klip 1 saat tangan aktif | Tetap object-only |
| 4 | Lokasi switch policy | Field Visual Identity saja |
| 5 | Badge UI (E3) | Ikut, hanya teks, token yang ada |
| 6 | Rilis & deploy staging (Tahap F) | Saya jalankan setelah Tahap E lulus **dan** Anda memberi izin terpisah |
| — | Production | Tidak disentuh (sesuai SOP) |

## Estimasi file tersentuh
- **Baru (8):** `lib/metaphor-world-kits.js`, `lib/metaphor-kit-resolver.js`, `lib/metaphor-kit-usage-repository.js`, `lib/metaphor-policy.js`, `scripts/migrate-metaphor-kit-usage.mjs`, 3–4 file tes
- **Diubah (8):** `lib/health-metaphors.js`, `lib/visual-identity-contract.js`, `lib/visual-identity-ai-contract.js`, `lib/visual-identity-allocator.js`, `lib/prompts.js`, `lib/scheduler-processors.js`, `lib/opc-start-frame-request.js`, `lib/db-pg.js` (+ opsional `app/pillar-campaigns/[id]/page.js`)
