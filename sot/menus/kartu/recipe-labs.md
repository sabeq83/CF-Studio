# Kartu Menu: Recipe Labs

Terakhir dicek: 28 November 2026 · Versi aplikasi: v2.68.0 (branch `fitur/recipe-labs-infografis`)
Alamat: `/recipe-labs` · Kelompok: WORKFLOW · Kunci izin menu: `recipe_labs`

## Fungsi
Pabrik konten kuliner statis (Poster Infografis Resep satu halaman & foto grid kolase) serta storyboard video resep. Mendukung **2 sumber resep** (`ai_generated` oleh Gemini atau `recipe_library` dari `curated_recipes` dengan takaran asli dikunci), **3 layout poster infografis** (`infographic_step_grid`, `infographic_text_steps`, `infographic_visual_ingredients` via Playwright + Sharp), watermark nama brand, produk opsional dari Product Database, dan paket caption siap tayang lintas platform.

## Alur pakai
1. Pilih sumber resep (AI Bikin Sendiri atau Ambil dari Recipe Library) dan format output (`Poster Infografis` atau `Grid Kolase Foto`).
2. Atur template layout, tema warna, rasio (`4:5` / `3:4` / `1:1`), nama brand watermark, dan produk opsional bila perlu.
3. Sistem membuat teks terstruktur + foto bersih G-Labs, lalu merender poster infografis JPEG + caption siap tayang ke ContentFlow Hub atau Recipe Exporter.

## Terhubung dengan
- Butuh data dari: Recipe Library (`curated_recipes`), Product Database (`product_extractions` opsional), Brand Profile (`brand_profiles`).
- Hasilnya dipakai oleh: ContentFlow Hub (`content_flow_items`), Recipe Exporter, Repliz (`media_type: 'image'`).
- Perintah MCP: `cf_create_recipe_labs_post`.

## Lokasi (untuk agent)
- Halaman: `app/recipe-labs/page.js`, `app/components/campaign-forms/RecipeLabsConfigurationForm.js`, `app/components/campaign-forms/RecipeInfographicControls.js`
- API: `app/api/recipe-labs/route.js`
- Logika inti: `lib/recipe-library-picker.js`, `lib/recipe-infographic-prompt.js`, `lib/recipe-infographic-renderer.js`, `lib/scheduler-processors.js` (`processRecipeGenerator`, `processRecipeGLabs`, `processRecipeExporter`)
- Tabel data: `recipe_campaigns`, `recipe_items`, `curated_recipes`

## Aturan penting & jebakan
1. Kunci izin sama dengan Recipe Exporter (`recipe_labs`).
2. Berbeda dengan Auto Pipeline `recipe_campaign` yang membuat **video** — Recipe Labs menghasilkan **artikel + foto grid**.

## Belum ada / batasan
- Belum ada auto-posting langsung; harus lewat ContentFlow Hub atau export manual.

## Dokumen lengkap
`sot/menus/recipe-labs.md`
