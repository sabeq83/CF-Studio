# Usulan Hotfix: Foto Hero Halusinasi (Mix Berries) Akibat Placeholder Harfiah & Prompt Bahasa Indonesia

Tanggal: 28 November 2026  
Branch: `fitur/recipe-labs-infografis`  
Bukti Database: `dev.recipe_items` ID `rcitem_recipe_261128_gor0a4_1`

---

## 1. Bukti Akar Masalah dari Database (`rcitem_recipe_261128_gor0a4_1`)

Dari pemeriksaan langsung `t2i_prompts_json` dan `seo_data_json` item `gor0a4` (`Sourdough Coffee Brownie`):

1. **Gemini menyalin kalimat contoh `"matching dish_visual_identity"` secara harfiah di `hero_prompt`**:
   - Isi `t2i_prompts_json.image_1` yang terkirim ke G-Labs berbunyi:
     > *"Commercial bright macro hero food photography **matching dish_visual_identity**, beautifully served on Pristine bright white Carrara marble..., Matte minimalist artisan ceramic bowls, brushed stainless utensils, fresh garnish..."*
   - Prompt tersebut **tidak mengandung kata nama makanan sama sekali** (tidak ada `bread`, `sourdough`, `chocolate`, maupun `brownie`), hanya menyebut `ceramic bowls, spoons, fresh garnish`. Karena kosong nama hidangannya, model G-Labs mengarang hidangan paling umum untuk mangkuk keramik + hiasan segar -> **granola & mix berries**.
2. **`dish_visual_identity` terisi Bahasa Indonesia**:
   - Gemini mengisi `dish_visual_identity` dengan `"Sebuah loaf roti artisanal sourdough..."`, karena aturan prompt tidak mengunci bahwa `dish_visual_identity` **wajib Bahasa Inggris**. Bila diselipkan ke Stage 2 T2I G-Labs, model gambar tidak optimal memahaminya.
3. **Tag `[CLEAN MACRO FOOD PHOTOGRAPHY ONLY: ...]` ganda di ujung prompt**:
   - Regex pembersih di `enforcePromptHandAndMacroPolicy` ([lib/recipe-infographic-prompt.js](../../lib/recipe-infographic-prompt.js)) hanya menghapus `[CLEAN FOOD PHOTOGRAPHY ONLY: ...]`, belum menghapus varian `[CLEAN MACRO FOOD PHOTOGRAPHY ONLY: ...]`, sehingga tag guardrail ditulis 2 kali berturut-turut di setiap prompt.

---

## 2. Usulan Hotfix (3 Perbaikan Presisi)

1. **Kunci Bahasa Inggris & Contoh Konkret pada Prompt Gemini ([lib/recipe-infographic-prompt.js](../../lib/recipe-infographic-prompt.js))**:
   - Wajibkan `dish_visual_identity` **100% Bahasa Inggris** (*concise English concrete noun phrase*).
   - Hapus frase ambigu `"matching dish_visual_identity"` pada contoh JSON `hero_prompt` & `secondary_prompt`; ganti dengan instruksi pengisian nama hidangan konkret berbasis **`Original Authoritative Dish Name`** (misalnya: `<CONCRETE ENGLISH DESCRIPTION OF "${originalTitle}" AND ITS FINISH, NO PLACEHOLDER TEXT>`).
   - Pada contoh `hero_prompt`, jangan memaksa menyertakan kata `"ceramic bowls"` untuk hidangan non-mangkuk (seperti roti/kue panggang yang disajikan di `ceramic plate` atau `wooden board`).
2. **Fail-Safe Sanitasi Placeholder & Injeksi Nama Hidangan Wajib di `enforcePromptHandAndMacroPolicy`**:
   - Hapus segala placeholder bocor (`/matching\s+dish_visual_identity/gi`, `/\[DISH[^\]]*\]/gi`) bila masih lolos dari Gemini.
   - Pastikan **setiap `hero_prompt` (`image_1`) dan `secondary_prompt`** wajib mengandung nama hidangan (`dish_visual_identity` atau `original_title` Inggris). Jika terdeteksi tidak memuat nama hidangan / berpotensi kosong konteks, otomatis sisipkan `dish_visual_identity` + `original_title` di awal prompt sebelum dikirim ke G-Labs.
   - Perbarui regex penghapus tag agar mencakup `/\[CLEAN(?:\s+MACRO)?\s+FOOD PHOTOGRAPHY ONLY:[^\]]*\]/gi` sehingga tidak pernah dobel.
3. **Pengaman Stage 2 di `processRecipeGLabs` ([lib/scheduler-processors.js](../../lib/scheduler-processors.js))**:
   - Pastikan `dish_visual_identity` hanya disisipkan ke prompt Stage 2 bila tervalidasi berbahasa Inggris (ASCII deskripsi Inggris bersih, bukan teks Indonesia).

---

## Verifikasi yang Akan Dilakukan
1. Tambah unit test di [tests/recipe-infographic.test.js](../../tests/recipe-infographic.test.js) yang memverifikasi:
   - Prompt mengandung `matching dish_visual_identity` otomatis dibersihkan dan diisi dengan nama/wujud hidangan nyata (`Coffee Brownie Sourdough Bread` / `dish_visual_identity`).
   - Tidak ada tag `[CLEAN MACRO FOOD PHOTOGRAPHY ONLY: ...]` yang muncul ganda.
2. Jalankan unit test, `npm run build`, commit & push ke `fitur/recipe-labs-infografis`, lalu deploy ulang Dev (`5020`).
