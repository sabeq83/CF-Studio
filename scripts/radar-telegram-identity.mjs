// Daftarkan / cabut identitas Telegram yang boleh menyetujui kandidat Radar Produk via bot.
// Pemakaian:
//   node --env-file=.env.local scripts/radar-telegram-identity.mjs add    --tenant default_tenant --telegram 123456789 --name "Nama"
//   node --env-file=.env.local scripts/radar-telegram-identity.mjs revoke --tenant default_tenant --telegram 123456789
// Schema ditentukan PG_SEARCH_PATH (dev/staging). Tidak mencetak data sensitif.
import { tenantContext } from '../lib/tenant-context.js';
import { closePgPool } from '../lib/db-pg.js';
import { registerTelegramIdentity, revokeTelegramIdentity } from '../lib/product-research-bot-service.js';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : '';
}

const action = process.argv[2];
const tenant = arg('tenant');
const telegram = arg('telegram');
const name = arg('name') || null;

try {
  if (!['add', 'revoke'].includes(action) || !tenant || !telegram) {
    throw new Error('Pemakaian: <add|revoke> --tenant <id> --telegram <id> [--name <nama>]');
  }
  const row = await tenantContext.run(tenant, () =>
    action === 'add'
      ? registerTelegramIdentity({ telegramUserId: telegram, displayName: name, createdBy: 'cli' })
      : revokeTelegramIdentity(telegram)
  );
  console.log(JSON.stringify({ action, tenant, telegram_user_id: telegram, status: row?.status || 'not_found' }));
} catch (e) {
  console.error('❌', e.message);
  process.exitCode = 1;
} finally {
  await closePgPool();
}
