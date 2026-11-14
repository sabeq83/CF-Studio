import fs from 'node:fs';
import path from 'node:path';

export function loadAndValidateDbEnv(options = {}) {
  const { allowDefaultFallback = false, requireDevSchema = true } = options;

  // If environment variables are missing, attempt to load from .env.local
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    const content = fs.readFileSync(envLocalPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }

  const required = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE'];
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required database environment variable: ${key}`);
    }
  }

  const schema = process.env.PG_SEARCH_PATH || 'dev';
  if (requireDevSchema && schema !== 'dev') {
    throw new Error(`Invalid database schema: "${schema}". Script must run explicitly against "dev" schema.`);
  }

  return {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    schema
  };
}

/**
 * Guard wajib untuk helper & unit test DB lokal (K7.1-D):
 * memaksa DISABLE_AUTO_MIGRATIONS='true' dan fail-loudly jika PG_SEARCH_PATH kosong atau mengarah ke 'public'.
 */
export function assertSafeTestDbEnv({ allowedSchemas = ['dev', 'staging'], allowStudioTestPrefix = true } = {}) {
  if (process.env.DISABLE_AUTO_MIGRATIONS !== 'true') {
    process.env.DISABLE_AUTO_MIGRATIONS = 'true';
  }
  const raw = String(process.env.PG_SEARCH_PATH || '').trim();
  if (!raw) {
    throw new Error('[DB_TEST_GUARD] PG_SEARCH_PATH kosong. Unit/integration test lokal WAJIB menyetel PG_SEARCH_PATH=dev (atau staging) secara eksplisit.');
  }
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0 || parts.includes('public')) {
    throw new Error(`[DB_TEST_GUARD] PG_SEARCH_PATH="${raw}" dilarang menyentuh schema "public" saat pengujian lokal.`);
  }
  const primary = parts[0];
  const isAllowed = allowedSchemas.includes(primary) || (allowStudioTestPrefix && /^studio_test_/i.test(primary));
  if (!isAllowed) {
    throw new Error(`[DB_TEST_GUARD] PG_SEARCH_PATH="${primary}" tidak termasuk schema test yang diizinkan (${allowedSchemas.join(', ')}).`);
  }
  return {
    disableAutoMigrations: process.env.DISABLE_AUTO_MIGRATIONS === 'true',
    searchPath: raw,
    primarySchema: primary
  };
}
