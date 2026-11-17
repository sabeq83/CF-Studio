#!/usr/bin/env node

import { Client } from 'pg';

const parseArgs = (argv) => {
  const args = {
    schema: 'staging',
    ids: [],
    to: '',
    apply: false
  };

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--schema' && argv[i + 1]) {
      args.schema = argv[++i];
    } else if (argv[i] === '--ids' && argv[i + 1]) {
      args.ids = argv[++i].split(',').map(s => s.trim()).filter(Boolean);
    } else if (argv[i] === '--to' && argv[i + 1]) {
      args.to = argv[++i].trim();
    } else if (argv[i] === '--apply') {
      args.apply = true;
    }
  }
  return args;
};

async function main() {
  const { schema, ids, to, apply } = parseArgs(process.argv);
  console.log(`================================================================`);
  console.log(`📦 RENCANA PEMINDAHAN TENANT PRODUK (S4)`);
  console.log(`Schema: [${schema}] | Target Tenant: [${to || 'BELUM DITENTUKAN'}] | Mode: ${apply ? '🚨 APPLY' : '🛡️ DRY-RUN'}`);
  console.log(`================================================================`);

  if (!ids.length || !to) {
    console.log(`Penggunaan:`);
    console.log(`  node scripts/move-product-tenant.mjs --schema staging --ids <id1,id2> --to <target_tenant_id> [--apply]\n`);
    console.log(`Contoh kandidat Cuculemon:`);
    console.log(`  node scripts/move-product-tenant.mjs --schema staging --ids pe_1794900810596_563 --to tnt_pt-gim-sosmed_62d0d9\n`);
  }

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

    // Verifikasi tenant tujuan
    if (to) {
      const tenantCheck = await client.query('SELECT id, name FROM tenants WHERE id = $1', [to]);
      if (tenantCheck.rows.length === 0) {
        console.error(`❌ Tenant tujuan "${to}" tidak ditemukan di tabel tenants!`);
        process.exit(1);
      }
      console.log(`✅ Tenant tujuan terverifikasi: "${tenantCheck.rows[0].name}" (${to})\n`);
    }

    if (ids.length > 0) {
      const prodRes = await client.query(
        'SELECT id, tenant_id, product_name, source_url, photo_status, created_at FROM product_extractions WHERE id = ANY($1::text[])',
        [ids]
      );

      console.log(`Daftar Produk Target (${prodRes.rows.length} ditemukan dari ${ids.length} ID):`);
      for (const p of prodRes.rows) {
        console.log(`- [${p.id}] ${p.product_name}`);
        console.log(`  Tenant Sekarang : ${p.tenant_id}`);
        console.log(`  Tenant Baru     : ${to}`);
        console.log(`  Source URL      : ${p.source_url}`);
        console.log(`  Status Foto     : ${p.photo_status}\n`);
      }

      if (!apply) {
        console.log(`🛡️ Mode DRY-RUN: Tidak ada data yang dipindahkan.`);
        console.log(`   Jalankan dengan izin pengguna dan tambahkan --apply untuk mengeksekusi pemindahan.`);
      } else {
        console.log(`🚨 Menerapkan pemindahan tenant...`);
        const updateRes = await client.query(
          'UPDATE product_extractions SET tenant_id = $1 WHERE id = ANY($2::text[]) RETURNING id, tenant_id',
          [to, ids]
        );
        console.log(`✅ Berhasil memindahkan ${updateRes.rows.length} produk ke tenant ${to}.`);
      }
    }
  } catch (err) {
    console.error(`❌ Terjadi error:`, err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
