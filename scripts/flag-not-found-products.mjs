#!/usr/bin/env node

import { Client } from 'pg';

const parseArgs = (argv) => {
  const args = {
    schema: 'staging',
    apply: false
  };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--schema' && argv[i + 1]) {
      args.schema = argv[++i];
    } else if (argv[i] === '--apply') {
      args.apply = true;
    }
  }
  return args;
};

async function main() {
  const { schema, apply } = parseArgs(process.argv);
  console.log(`================================================================`);
  console.log(`🔍 AUDIT PRODUK 404 (S2) — Schema: [${schema}] | Mode: ${apply ? '🚨 APPLY' : '🛡️ DRY-RUN'}`);
  console.log(`================================================================`);

  const client = new Client({
    host: process.env.PGHOST || '100.78.186.123',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'makna_user',
    password: process.env.PGPASSWORD || 'maknagridpass',
    database: process.env.PGDATABASE || 'maknaflow_db'
  });

  try {
    await client.connect();
    await client.query(`SET search_path TO ${schema}, public`);

    const query = `
      SELECT id, tenant_id, product_name, source_url, raw_description, enrichment_status, photo_status, created_at
      FROM product_extractions
      WHERE raw_description ILIKE '%tujuanmu nggak ada%'
         OR raw_description ILIKE '%halaman tidak ditemukan%'
         OR raw_description ILIKE '%produk tidak ditemukan%'
         OR raw_description ILIKE '%produk ini tidak tersedia%'
         OR raw_description ILIKE '%page not found%'
      ORDER BY created_at DESC
    `;

    const res = await client.query(query);
    const rows = res.rows;

    console.log(`Ditemukan ${rows.length} produk dengan indikasi sumber halaman 404:\n`);

    for (const r of rows) {
      console.log(`- ID: ${r.id} | Tenant: ${r.tenant_id}`);
      console.log(`  Nama: ${r.product_name || '(Tanpa Nama)'}`);
      console.log(`  Source: ${r.source_url}`);
      console.log(`  Dibuat: ${r.created_at}`);
      console.log(`  Status Sekarang: enrichment=${r.enrichment_status}, photo=${r.photo_status}`);
      const snippet = (r.raw_description || '').replace(/\s+/g, ' ').slice(0, 120);
      console.log(`  Cuplikan Deskripsi: "${snippet}..."\n`);
    }

    if (!apply) {
      console.log(`🛡️ Mode DRY-RUN selesai. Tidak ada baris data yang diubah.`);
      console.log(`   Untuk menandai produk di atas, jalankan dengan izin pengguna menggunakan flag --apply.`);
    } else {
      console.log(`🚨 Menerapkan penandaan produk 404...`);
      for (const r of rows) {
        await client.query(
          `UPDATE product_extractions 
           SET enrichment_status = 'failed',
               enrichment_error = 'Sumber produk 404: data dikarang, jangan dipakai',
               photo_status = 'needs_review',
               photo_error = 'sumber produk 404'
           WHERE id = $1`,
          [r.id]
        );
        console.log(`  ✅ Berhasil menandai produk ID: ${r.id}`);
      }
      console.log(`\n🎉 Selesai menerapkan status 404 pada ${rows.length} produk.`);
    }
  } catch (err) {
    console.error(`❌ Terjadi error:`, err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
