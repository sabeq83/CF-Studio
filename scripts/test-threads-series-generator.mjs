import { generateThreadsSeries } from '../lib/threads-series-generator.js';
import { closePgPool } from '../lib/db-pg.js';

async function main() {
  console.log('=== Testing Threads Series Generator (Gemini AI Single-Pass) ===\n');

  // Test 1: Produk Pribadi dengan Visual G-Labs
  console.log('1. Menguji Generate Utas Produk Pribadi (G-Labs Visual):');
  const resPersonal = await generateThreadsSeries({
    accountUsername: 'kost_sasyahouse',
    brandName: 'Sasya House',
    postObjective: 'personal_product',
    personalProductName: 'Kamar Deluxe Eksklusif Sasya House',
    personalProductCta: 'DM ke @kost_sasyahouse untuk booking survey!',
    visualMode: 'glabs'
  });

  console.log('   Theme:', resPersonal.theme);
  console.log(`   Parts Count: ${resPersonal.series.length}`);
  resPersonal.series.forEach(p => {
    console.log(`   [Part ${p.part} - ${p.role}]: ${p.text.substring(0, 80)}...`);
  });
  console.log('   T2I Prompt:', resPersonal.visual_prompt_t2i);

  // Test 2: Cerita Murni Text-Only
  console.log('\n2. Menguji Generate Utas Cerita Murni (Text-Only):');
  const resOrganic = await generateThreadsSeries({
    accountUsername: 'nutribake_id',
    brandName: 'NutriBake',
    postObjective: 'pure_organic',
    pureOrganicTopic: 'Rahasia sourdough mengembang sempurna tanpa ragi instan',
    visualMode: 'none'
  });

  console.log('   Theme:', resOrganic.theme);
  console.log(`   Parts Count: ${resOrganic.series.length}`);
  console.log('   T2I Prompt (harus null):', resOrganic.visual_prompt_t2i);

  await closePgPool();
  console.log('\n=== Test Generator Selesai & Berhasil 100%! ===');
}

main().catch(err => {
  console.error('Test Error:', err);
  process.exit(1);
});
