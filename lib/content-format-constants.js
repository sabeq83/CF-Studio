/**
 * Centralized Content & Recipe Formatting Hub
 * Single Source of Truth untuk Format Resep/Racikan Media Sosial dan Judul YouTube Shorts High-CTR
 * Mendukung Bahasa Indonesia (id-ID) dan US English (en-US).
 */

export function buildRecipeVoStepContractSection(targetLanguage = 'id-ID') {
  const isEn = String(targetLanguage || '').toLowerCase().startsWith('en');
  if (isEn) {
    return [
      'RECIPE VO & STEP SPECIFICITY CONTRACT (VO CONTENT CONTRACT = ON):',
      '- EVERY cooking_step (both canonical cooking steps and scene voice_over) MUST specify concrete measurable parameters when applicable: heat level / temperature (e.g. "low heat", "180°C"), duration (e.g. "2 minutes", "30 seconds"), exact measured ingredients (e.g. "1 tbsp", "150 ml"), AND an observable visual/sensory completion cue (e.g. "bubbles gently", "thickens and turns glossy golden").',
      '- ANTI-FILLER RULE: BANNED filler atmosphere or generic mood clips in voice_over (no "enjoy this cozy moment", "elevate your kitchen vibes", "simply delicious magic"). Every clip must state ingredients, ratios, temperatures/times, or visual doneness cues.',
      '- Never write vague amounts like "some", "a bit", or "briefly" without an observable completion cue.'
    ].join('\n');
  }
  return [
    'KONTRAK SPESIFISITAS LANGKAH & ANTI-FILLER RESEP (VO CONTENT CONTRACT = ON):',
    '- SETIAP cooking_step (pada langkah resep kanonik dan voice_over tiap adegan) WAJIB memuat parameter memasak konkret sesuai konteks: tingkat api/suhu (mis. "api kecil", "180°C"), durasi waktu (mis. "2 menit", "30 detik"), takaran bahan terukur (mis. "1 sdm", "150 ml"), DAN tanda visual/sensorik matang (mis. "berbuih halus di tepi", "mengental mengilap", "harum keluar").',
    '- ATURAN ANTI-FILLER: DILARANG mengisi voice_over klip dengan kalimat suasana atau motivasi klise (mis. "nikmati momen hangat", "bikin suasana makin nyaman", "rasanya langsung juara"). Setiap klip wajib membawa bahan, takaran, suhu/durasi, atau tanda kematangan nyata.',
    '- Dilarang kata takaran samar ("secukupnya", "sebentar", "sedikit") tanpa tanda visual selesai yang bisa dilihat penonton.'
  ].join('\n');
}

export function getRecipeMandateSection(isRecipeActive, targetLanguage = 'id-ID', options = {}) {
  if (!isRecipeActive) return '';
  const isEn = String(targetLanguage || '').toLowerCase().startsWith('en');
  const voContractAddon = options?.voContractActive
    ? `\n${buildRecipeVoStepContractSection(targetLanguage)}\n`
    : '';

  if (isEn) {
    return `
========================================================================
🍳 RECIPE & NUTRITION PREPARATION MANDATE [ENGLISH - STRICT]
========================================================================
This content focuses on culinary recipes, healthy meal preps, desserts, or functional wellness beverages.
You MUST compose a comprehensive, detailed recipe text 100% directly correlated with the visual ingredients of the reference Blueprint:
1. INGREDIENTS & EXACT MEASUREMENTS (MATCHING VISUAL BLUEPRINT):
   - List all core visual ingredients shown in the scenes with precise, practical measurements (cups, tbsp, tsp, grams, ml, scoops).
2. STEP-BY-STEP INSTRUCTIONS:
   - Provide clear, numbered instructions strictly matching the chronological clip sequence.
3. KEY HEALTH BENEFITS & PRO TIPS:
   - Highlight the primary health/wellness payoff matching the angle (e.g. 30g protein, zero blood sugar spike, creamy velvety texture tips).
4. CAPTION & SOCIAL MEDIA PRESENTATION:
   - Present this full recipe directly inside the "caption" field with clean, organized emojis, ready to post!${voContractAddon}
========================================================================
`;
  }

  return `
========================================================================
🍳 RECIPE & HERBAL CONCOCTION MANDATE [AKTIF] (INCL. DYNAMIC FOOD & NUTRITION PREPARATION)
========================================================================
Konten ini berfokus pada resep kuliner, hidangan bernutrisi (health/fitness food prep), dessert sehat, minuman fungsional, atau racikan alami.
Anda WAJIB menyusun teks resep yang terperinci dan 100% berkorelasi langsung dengan bahan baku serta adegan visual pada Blueprint referensi:
1. IDENTIFIKASI BAHAN & TAKARAN (SESUAI VISUAL BLUEPRINT):
   - Sebutkan seluruh bahan baku pokok yang tampak di adegan visual video asli (misal: jika puding chia seed maka chia seed, selai kacang, bubuk kakao, susu almond, madu; jika es krim buah maka alpukat, pisang beku, yogurt, lemon, madu; jika seduhan herbal maka rimpang rempah yang tampak).
   - Berikan takaran yang jelas dan aplikatif (sendok makan, gram, sendok teh, ml, butir, buah, lembar).
2. LANGKAH PEMBUATAN RUNTUT SESUAI ADEGAN:
   - Tuliskan langkah-langkah bernomor yang runtut dan ringkas sesuai urutan kronologis adegan visual klip video.
3. KHASIAT / VALUE DELIVERY & PRO-TIP:
   - Jelaskan manfaat utama sesuai angle (misal: tinggi protein, penumpas ngidam manis malam, indeks glikemik aman/anti-spike, melancarkan pencernaan, atau tips agar tekstur creamy sempurna).
4. PENYAJIAN DI CAPTION:
   - Anda WAJIB menyajikan format teks resep lengkap ini LANGSUNG di dalam field "caption" pada "social_media_package" (dan pada "tiktok_caption" / "ig_caption" / "yt_desc") dengan tata letak emoji yang rapi, estetik, dan siap posting!${voContractAddon}
========================================================================
`;
}

export const YT_SHORTS_HIGH_CTR_TITLE_MANDATE = `
========================================================================
🔥 YOUTUBE SHORTS HIGH-CTR TITLE MANDATE [STRICT]
========================================================================
Untuk field "title" / "yt_title", Anda WAJIB merumuskan judul YouTube Shorts yang memikat penonton (high CTR) dengan ketentuan mutlak:
1. PANJANG & TAG WAJIB:
   - Panjang total HARUS antara 50 hingga 75 karakter (MAKSIMAL ABSOLUT 85 karakter).
   - WAJIB diakhiri tepat dengan tag: #Shorts
2. ANTI-CUTOFF GUARANTEE (DILARANG MENGGANTUNG):
   - Judul WAJIB berupa kalimat UTUH dan tuntas.
   - DILARANG KERAS menghasilkan judul terpotong di tengah kalimat atau menyisakan kata perbandingan menggantung (CONTOH SALAH: "...sama seperti #Shorts", "...ternyata bikin #Shorts").
3. FORMULA PSIKOLOGIS CLICK-WORTHY SESUAI NICHE KONTEN:
   - [Health/Nutrition]: "Ngidam Manis Jam 10 Malam? Resep Puding Bebas Lonjakan Gula #Shorts" / "Craving Sweets at 10 PM? Blood Sugar Safe Pudding #Shorts"
   - [Fitness/Protein]: "Trik Sarapan Kenyang 6 Jam! Cuma Butuh 3 Bahan di Toples Ini #Shorts" / "6-Hour Fullness Hack! Only 3 Ingredients in a Jar #Shorts"
   - [Healthy Dessert]: "Bikin Es Krim Tanpa Gula & Susu, Kok Bisa Secreamy Ini? #Shorts" / "Dairy-Free Velvet Ice Cream in 2 Minutes #Shorts"
   - [Curiosity / Hacks]: "Jangan Dibuang! Trik Alpukat Terlalu Matang Jadi Dessert Mewah #Shorts" / "Don't Throw Away Overripe Avocados! Try This 2-Min Hack #Shorts"
   - [Herbal / Wellness]: "Cuma Butuh 3 Rempah Dapur! Trik Alami Hangatkan Badan #Shorts" / "Only 3 Kitchen Spices! Natural Winter Wellness Brew #Shorts"
========================================================================
`;

export function cleanYoutubeTitle(rawTitle, fallbackText = '') {
  let title = (typeof rawTitle === 'string' ? rawTitle : '').trim();

  // If empty, attempt fallback
  if (!title && fallbackText) {
    title = String(fallbackText).trim();
  }
  if (!title) {
    return 'Rahasia Racikan Alami Yang Jarang Diketahui #Shorts';
  }

  // Remove markdown bolding/italics and normalize spaces
  title = title.replace(/\*\*/g, '').replace(/\*/g, '');
  title = title.replace(/\s+/g, ' ').trim();

  // Strip existing #shorts tag first to normalize base title
  let baseTitle = title.replace(/#shorts\b/gi, '').trim();

  // Strip wrapping and trailing/leading quotes from base title
  baseTitle = baseTitle.replace(/^["'“”«»‘’`\s]+|["'“”«»‘’`\s]+$/g, '').trim();

  // Iteratively clean trailing punctuation, quotes & hanging conjunctions
  const hangingWordsRegex = /\s+(sama seperti|seperti|ternyata|bikin|buat|dan|yang|atau|dengan|karena|pada|di|ke|dari|untuk|agar|supaya|adalah|yaitu|bisa)\s*$/i;
  let iterations = 0;
  while (iterations < 5) {
    baseTitle = baseTitle.replace(/[\s\-_,:;."''“”«»‘’`]+$/, '').trim();
    if (hangingWordsRegex.test(baseTitle)) {
      baseTitle = baseTitle.replace(hangingWordsRegex, '').trim();
      iterations++;
    } else {
      break;
    }
  }

  // Truncate at word boundary if baseTitle + " #Shorts" > 85 chars
  const MAX_BASE_LEN = 77; // 85 - 8 (" #Shorts")
  if (baseTitle.length > MAX_BASE_LEN) {
    baseTitle = baseTitle.slice(0, MAX_BASE_LEN);
    const lastSpace = baseTitle.lastIndexOf(' ');
    if (lastSpace > 25) {
      baseTitle = baseTitle.slice(0, lastSpace).trim();
    }
    iterations = 0;
    while (iterations < 5) {
      baseTitle = baseTitle.replace(/[\s\-_,:;."''“”«»‘’`]+$/, '').trim();
      if (hangingWordsRegex.test(baseTitle)) {
        baseTitle = baseTitle.replace(hangingWordsRegex, '').trim();
        iterations++;
      } else {
        break;
      }
    }
  }

  // Final trim of any remaining surrounding quotes
  baseTitle = baseTitle.replace(/^["'“”«»‘’`\s]+|["'“”«»‘’`\s]+$/g, '').trim();

  // Ensure base title is not empty
  if (!baseTitle) {
    baseTitle = 'Rahasia Racikan Alami Yang Jarang Diketahui';
  }

  // Ensure final #Shorts tag
  return `${baseTitle} #Shorts`;
}

