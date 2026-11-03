# Recipe Campaign

Gunakan `planner_focus: recipe_campaign`, `recipe_category` salah satu masakan/minuman/dessert/kue, count integer 1–30 (default 3), platform dan bahasa. Tidak menggunakan pilar/CEP/VFO sebagai field wajib; `use_content_pillars` selalu false.

`products` adalah array katalog eksplisit `{id, name, description}` dengan id dan nama unik, bukan lookup database. Default []. Tanpa produk = organic; primary_product_id, product_reference dan product wajib null, featured_products kosong; bahan pantry generik tetap diperbolehkan. Jangan menyimpulkan merek dari nama resep.

`strategy_mode`: synergy (default) atau rotation. Synergy mengalokasikan seluruh produk pada setiap ide dengan peran alami; rotation satu produk per ide sesuai urutan katalog. Jika semua produk tidak cocok untuk synergy, jelaskan dan minta perubahan mode/katalog. Helper tidak menebak kecocokan masakannya.

Distribution row: sequence, category, pillar=null, primary_product_id (produk pertama yang dialokasikan atau null), product_reference (nama utama/null), allocated_product_ids (array id). Skeleton wajib menyalin seluruh alokasi, menambahkan title, content_subject (premis resep spesifik), product (sama product_reference), commercial_intent dan cta_type dengan aturan contracts.md. Kerangka resep ini dikunci sebelum detail final.

Final menambahkan:

- hook dan visual_action: string tidak kosong, sesuai premis.
- servings: string; prep_time_minutes dan cook_time_minutes: angka >=0 (estimasi, catat sebagai asumsi); difficulty: string.
- ingredients: array tidak kosong `{name, amount, unit, product_id}`. Name/amount string tidak kosong; unit string (boleh kosong untuk satuan seperti butir dalam amount); product_id null untuk pantry atau id produk yang dialokasikan.
- steps: array tidak kosong `{index, instruction}` dengan index 1..N dan instruksi tidak kosong. Urutan harus realistis.
- featured_products: array `{product_id, product_name, role, action_step}` persis untuk produk yang dialokasikan, dengan role main_ingredient/supporting_ingredient/appliance/topping; action_step menjelaskan penggunaan. Semua bahan dan peralatan bermerek harus dari katalog.
- chef_tips: array string; cta: string tidak kosong, selaras cta_type; organic mengajak mencoba/simpan/bagikan, tanpa tautan belanja rekaan.

Jangan memaksa alat masak sebagai bahan; featured product bertipe appliance dapat tidak ada dalam ingredients, tetapi penggunaannya harus disebut di langkah. Semua bahan yang dipakai langkah/visual perlu ada dalam ingredients; tinjau makna ini secara manual karena helper tidak melakukan pencocokan bahasa alami. Jangan mengarang nutrisi, klaim kesehatan, atau jaminan durasi. Pantangan/alergi dari brief adalah constraint wajib; beri tahu jika tidak dapat dipenuhi.

Mode ini menghasilkan perencanaan resep kanonis ringkas, bukan produksi storyboard/VO/video. Jangan menjanjikan impor langsung ke aplikasi; engine asal memiliki field produksi tambahan yang sengaja tidak menjadi syarat skill.

Provenance: `lib/recipe-campaign-contract.js` dan `lib/recipe-planner-engine.js`, baseline commit `0fd0b9268aff2d64f43c5875175398f6848a533c`, diperiksa 3 November 2026. Adaptasi mandiri menggunakan katalog dari brief dan envelope rows seragam tanpa database, API key, atau snapshot tenant.
