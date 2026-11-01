import { Pool } from 'pg';

export async function updateGarliBeeProductTruth() {
  console.log('🌱 [GarliBee Updater] Updating GarliBee Product Truth in PostgreSQL...');

  const pool = new Pool({
    host: process.env.PGHOST || '100.78.186.123',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'makna_user',
    password: process.env.PGPASSWORD || 'maknagridpass',
    database: process.env.PGDATABASE || 'maknaflow_db',
    ssl: false,
    max: 2
  });

  const client = await pool.connect();

  const productTruth = "Authentic naturally fermented Solo Garlic (Bawang Lanang / monobulb pearl garlic) aged for over 3 months in raw forest honey: a solitary, round marble-shaped single clove (strictly seamless, zero internal segments) displaying a rich translucent caramelized amber-brown hue from deep honey fermentation. The surface is glistening, glossy, and honey-glazed with tiny active fermentation micro-bubbles. Visually tender and soft in texture (supple, honey-absorbed, spoon-soft), submerged in liquid golden-amber raw honey.";
  
  const geometricTruth = "Squircle transparent glass jar (rounded rectangular glass container with defined shoulders) with a premium ribbed silver-metal screw lid, wrapped with a sleek matte-black label featuring a gold droplet logo, 'GarliBee HONEY INFUSED SOLO GARLIC', and gold subtitle 'Madu Mentah & Bawang Putih Tunggal'. The jar is filled with viscous dark golden-amber honey with micro-bubbles below the jar shoulder, completely visible through clear glass.";
  
  const cleanPhotoT2iPrompt = "Commercial studio product photography of authentic GarliBee honey-infused solo garlic in a transparent squircle glass jar with ribbed silver metal screw lid and matte black label featuring gold logo 'GarliBee HONEY INFUSED SOLO GARLIC', filled with viscous dark golden-amber honey. In the foreground on a dark slate stone surface, a rustic wooden spoon displays a single round, seamless, caramelized amber-brown fermented solo garlic clove glistening with honey syrup. Isolated on a clean background, soft directional studio lighting, crisp focus, 8k resolution.";

  const packagingType = "Jar Kaca (Squircle Glass Jar)";
  const cleanPhotoUrl = "/uploads/products/garlibee_clean_official.jpg";

  try {
    for (const schema of ['staging', 'dev', 'public']) {
      await client.query(`SET search_path TO ${schema}, public;`);

      // Check product_extractions
      try {
        const updatePeQuery = `
          UPDATE product_extractions
          SET
            packaging_type = $1,
            clean_photo_url = $2,
            cleaned_photo_url = $2,
            photo_url = $2,
            clean_photo_t2i_prompt = $3,
            product_truth = $4,
            geometric_truth = $5,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = 'pe_1793545394035_6698' OR product_name ILIKE '%garlibee%'
          RETURNING id, product_name, packaging_type;
        `;
        const peRes = await client.query(updatePeQuery, [
          packagingType,
          cleanPhotoUrl,
          cleanPhotoT2iPrompt,
          productTruth,
          geometricTruth
        ]);
        if (peRes.rows.length > 0) {
          console.log(`  ✅ [${schema}.product_extractions] Updated ${peRes.rows.length} product(s):`, peRes.rows);
        }
      } catch (err) {
        console.log(`  ℹ️  [${schema}.product_extractions] Skip: ${err.message}`);
      }

      // Check pillar_campaigns ephemeral update
      try {
        const updateCampQuery = `
          UPDATE pillar_campaigns
          SET
            product_ref_image_path = $1
          WHERE target_product_id = 'pe_1793545394035_6698' OR campaign_name ILIKE '%garlibee%'
          RETURNING id, campaign_name, product_ref_image_path;
        `;
        const campRes = await client.query(updateCampQuery, [cleanPhotoUrl]);
        if (campRes.rows.length > 0) {
          console.log(`  ✅ [${schema}.pillar_campaigns] Updated ${campRes.rows.length} campaign(s) product_ref_image_path:`, campRes.rows);
        }
      } catch (err) {
        console.log(`  ℹ️  [${schema}.pillar_campaigns] Skip: ${err.message}`);
      }

      // Also upsert to public.products if exists
      if (schema === 'public') {
        try {
          const upsertProd = `
            INSERT INTO products (
              id, tenant_id, product_name, product_description, unique_selling_point, 
              packaging_type, clean_photo_url, clean_photo_t2i_prompt, product_truth, geometric_truth, is_in_packaging
            ) VALUES (
              'pe_1793545394035_6698', 'default_tenant', 'GarliBee — Honey Infused Solo Garlic',
              'Perpaduan bawang putih tunggal (bawang lanang) pilihan dengan madu mentah (raw honey), melalui proses fermentasi alami selama minimal 3 bulan.',
              'Fermentasi alami minimal 3 bulan, tekstur sangat lembut dan warna kecokelatan, 100% bawang lanang tunggal bulat.',
              $1, $2, $3, $4, $5, 1
            )
            ON CONFLICT (id) DO UPDATE SET
              packaging_type = EXCLUDED.packaging_type,
              clean_photo_url = EXCLUDED.clean_photo_url,
              clean_photo_t2i_prompt = EXCLUDED.clean_photo_t2i_prompt,
              product_truth = EXCLUDED.product_truth,
              geometric_truth = EXCLUDED.geometric_truth;
          `;
          await client.query(upsertProd, [
            packagingType,
            cleanPhotoUrl,
            cleanPhotoT2iPrompt,
            productTruth,
            geometricTruth
          ]);
          console.log(`  ✅ [public.products] Upserted GarliBee product truth`);
        } catch (err) {
          console.log(`  ℹ️  [public.products] Skip: ${err.message}`);
        }
      }
    }

    console.log('🎉 GarliBee Product Truth update finished successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1]?.endsWith('update-garlibee-product-truth.mjs')) {
  updateGarliBeeProductTruth()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Error updating GarliBee:', err);
      process.exit(1);
    });
}
