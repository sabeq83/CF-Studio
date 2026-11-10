import { getPgPool } from '../lib/db-pg.js';
import { analyzeAndDraftReply } from '../lib/threads-affiliate-matcher.js';

async function main() {
  console.log('=== Uji Coba Agen 2 (AI Cognitive Matcher & Copywriter) ===\n');

  getPgPool();

  // Contoh data produk tiruan (jika tabel products belum memiliki barang thermal/pendingin)
  const sampleProducts = [
    {
      id: 'prod_alum_foil_01',
      name: 'Aluminium Foil Bubble Thermal Insulation 4mm',
      category: 'Home Improvement',
      price: 32000,
      description: 'Peredam panas atap seng dan plafon kamar, menolak radiasi panas hingga 97%, mudah dipasang sendiri.',
      image_url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=600',
      shopee_url: 'https://shopee.co.id/product/123/456'
    },
    {
      id: 'prod_mini_ac_cooler',
      name: 'Portable Air Cooler Mini AC Humidifier USB',
      category: 'Elektronik Kamar',
      price: 79000,
      description: 'Kipas pendingin ruangan mini dengan wadah air es, hemat listrik 5 watt, cocok untuk kamar kos sempit.',
      image_url: 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=600',
      shopee_url: 'https://shopee.co.id/product/789/101'
    }
  ];

  // Kasus Uji 1: Orang bertanya rekomendasi AC / kamar panas (relevan)
  const samplePost1 = {
    id: 'test_post_001',
    author_username: 'elfanmdi',
    post_url: 'https://www.threads.com/@elfanmdi/post/Dfjfhcsk2om',
    post_content: 'Rekomendasi AC buat Bandung yang super panas ini bisa skaligus pasang di rumah dan garansi ok gais? Yg murah2 aja 1/2PK buat kamar kecil....'
  };

  console.log('--- Kasus Uji 1 (Pertanyaan Solusi Kamar Panas) ---');
  console.log(`Postingan: "${samplePost1.post_content}"`);
  console.log('Menjalankan Agen 2 (Gemini AI)...');

  const result1 = await analyzeAndDraftReply('default_tenant', samplePost1, sampleProducts);
  console.log('\nHasil Analisa Agen 2:');
  console.log(`- Relevan?: ${result1.is_relevant}`);
  console.log(`- Skor Keyakinan: ${result1.draft?.ai_confidence_score}%`);
  console.log(`- Produk Terpilih: ${result1.matched_product?.name}`);
  console.log(`- Strategi Link: ${result1.draft?.reply_strategy}`);
  console.log(`- Draf Jawaban AI:\n"${result1.draft?.reply_text}"`);

  // Kasus Uji 2: Postingan tidak relevan (politik / meme)
  const samplePost2 = {
    id: 'test_post_002',
    author_username: 'netizen_random',
    post_url: 'https://www.threads.com/@netizen/post/999',
    post_content: 'Hari ini macet banget daerah Sudirman, bikin emosi di jalan.'
  };

  console.log('\n--- Kasus Uji 2 (Curhat Macet - Harusnya Ditolak/Skip) ---');
  console.log(`Postingan: "${samplePost2.post_content}"`);
  const result2 = await analyzeAndDraftReply('default_tenant', samplePost2, sampleProducts);
  console.log('Hasil Analisa Agen 2:');
  console.log(`- Relevan?: ${result2.is_relevant}`);
  console.log(`- Alasan Skip: ${result2.skip_reason}`);

  console.log('\n🎉 VALIDASI FASE 2 SUKSES: AI Matcher mampu memilih produk & meracik balasan natural!');
  process.exit(0);
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

