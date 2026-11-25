process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

import test from 'node:test';
import assert from 'node:assert/strict';
import { sendTelegramNotification } from '../lib/notification-providers/telegram.js';
import {
  resolveBrandTelegramTarget,
  resolveBrandForContent,
  enqueueBrandNotification,
  maybeEmitReplizReadyDigest,
  maybeEmitPublishedDigest,
  saveBrandNotificationPreference
} from '../lib/brand-notification-service.js';

function createMockDb({
  brandPref = null,
  tenantPref = null,
  brandProfile = { id: 'bp_nutribake', brand_name: 'NutriBake' },
  contentFlowItem = null,
  autoSchedule = null,
  pillarCampaign = null,
  publishingJobs = []
} = {}) {
  const outbox = new Map();
  let nextOutboxId = 1;
  let savedBrandPref = brandPref ? { ...brandPref } : null;
  let savedTenantPref = tenantPref ? { ...tenantPref } : null;

  const queryFn = async (sql, params = []) => {
    const text = String(sql).replace(/\s+/g, ' ').trim();

    if (text.startsWith('SELECT * FROM brand_notification_preferences')) {
      return { rows: savedBrandPref ? [savedBrandPref] : [] };
    }
    if (text.includes('FROM content_automation_notification_preferences')) {
      return { rows: savedTenantPref ? [savedTenantPref] : [] };
    }
    if (text.startsWith('SELECT id, brand_name FROM brand_profiles')) {
      return { rows: brandProfile ? [brandProfile] : [] };
    }
    if (text.includes('INSERT INTO content_automation_notification_preferences')) {
      savedTenantPref = {
        tenant_id: params[0],
        enabled: params[1],
        chat_id: params[2],
        bot_token_ciphertext: params[3],
        events_json: JSON.parse(params[4]),
        quiet_start: params[5],
        quiet_end: params[6],
        timezone: params[7],
        updated_by: params[8]
      };
      return { rows: [savedTenantPref] };
    }
    if (text.includes('INSERT INTO brand_notification_preferences')) {
      savedBrandPref = {
        tenant_id: params[0],
        brand_id: params[1],
        enabled: params[2],
        chat_id: params[3],
        message_thread_id: params[4],
        events_json: JSON.parse(params[5]),
        quiet_start: params[6],
        quiet_end: params[7],
        bypass_quiet_for_errors: params[8],
        timezone: params[9],
        updated_by: params[10],
        updated_at: new Date().toISOString()
      };
      return { rows: [savedBrandPref] };
    }
    if (text.includes('FROM content_flow_items')) {
      return { rows: contentFlowItem ? [contentFlowItem] : [] };
    }
    if (text.includes('FROM auto_pipeline_schedules')) {
      return { rows: autoSchedule ? [autoSchedule] : [] };
    }
    if (text.includes('FROM pillar_campaigns')) {
      return { rows: pillarCampaign ? [pillarCampaign] : [] };
    }
    if (text.includes('FROM brand_profiles') && text.includes('LOWER(brand_name)')) {
      return { rows: brandProfile ? [brandProfile] : [] };
    }
    if (text.includes('FROM publishing_jobs j')) {
      return { rows: publishingJobs };
    }
    if (text.startsWith('INSERT INTO studio_notification_outbox')) {
      const key = `${params[0]}::${params[4]}::telegram`;
      if (outbox.has(key)) {
        return { rows: [] };
      }
      const row = {
        id: nextOutboxId++,
        tenant_id: params[0],
        brand_id: params[1],
        source_module: params[2],
        entity_id: params[3],
        event_key: params[4],
        channel: 'telegram',
        event_type: params[5],
        chat_id: params[6],
        message_thread_id: params[7],
        bot_token_ciphertext: params[8],
        payload_json: JSON.parse(params[9]),
        next_attempt_at: params[10],
        status: 'queued'
      };
      outbox.set(key, row);
      return { rows: [row] };
    }
    return { rows: [] };
  };

  return {
    queryFn,
    getOutbox: () => Array.from(outbox.values()),
    getSavedBrandPref: () => savedBrandPref,
    getSavedTenantPref: () => savedTenantPref
  };
}

test('1. Resolusi target mewarisi bot token dan chat_id tenant sementara message_thread_id dari brand', async () => {
  const db = createMockDb({
    brandPref: {
      tenant_id: 'tnt_1',
      brand_id: 'bp_nutribake',
      enabled: true,
      chat_id: null,
      message_thread_id: 42,
      events_json: ['production_and_schedule', 'publish_failed'],
      bypass_quiet_for_errors: true,
      timezone: 'Asia/Jakarta'
    },
    tenantPref: {
      chat_id: '-1001234567890',
      bot_token_ciphertext: 'cipher_tenant_bot',
      quiet_start: '22:00',
      quiet_end: '05:00',
      timezone: 'Asia/Jakarta'
    }
  });

  const target = await resolveBrandTelegramTarget('tnt_1', 'bp_nutribake', { queryFn: db.queryFn });
  assert.ok(target);
  assert.equal(target.chatId, '-1001234567890');
  assert.equal(target.botTokenCiphertext, 'cipher_tenant_bot');
  assert.equal(target.messageThreadId, 42);
  assert.equal(target.brandName, 'NutriBake');
});

test('2. Resolusi brand_id untuk content mengikuti fallback content_flow -> auto_pipeline -> pillar -> nama akun', async () => {
  const dbFromCf = createMockDb({
    contentFlowItem: { id: 'cf_1', brand_profile_id: 'bp_direct' }
  });
  assert.equal(await resolveBrandForContent('tnt_1', 'cf_1', { queryFn: dbFromCf.queryFn }), 'bp_direct');

  const dbFromSchedule = createMockDb({
    contentFlowItem: { id: 'cf_2', brand_profile_id: null, source_campaign_id: 'mul_99' },
    autoSchedule: { brand_id: 'bp_from_sched' }
  });
  assert.equal(await resolveBrandForContent('tnt_1', 'cf_2', { queryFn: dbFromSchedule.queryFn }), 'bp_from_sched');
});

test('3. Agregasi multi-platform menahan pesan sampai semua akun Repliz siap, lalu mengirim 1 pesan idempoten', async () => {
  const jobs = [
    {
      id: 'pj_fb',
      tenant_id: 'tnt_1',
      content_id: 'vid_101',
      provider: 'repliz',
      platform: 'facebook',
      account_display_name: 'NutriBake FB',
      status: 'scheduled',
      external_schedule_id: 'rep_sched_1',
      scheduled_at: '2026-11-26T00:15:00.000Z'
    },
    {
      id: 'pj_ig',
      tenant_id: 'tnt_1',
      content_id: 'vid_101',
      provider: 'repliz',
      platform: 'instagram',
      account_display_name: 'NutriBake IG',
      status: 'scheduled',
      external_schedule_id: null,
      scheduled_at: '2026-11-26T00:15:00.000Z'
    }
  ];

  const db = createMockDb({
    brandPref: {
      tenant_id: 'tnt_1',
      brand_id: 'bp_nutribake',
      enabled: true,
      chat_id: null,
      message_thread_id: 42,
      events_json: ['production_and_schedule', 'publish_succeeded', 'publish_failed'],
      timezone: 'Asia/Jakarta'
    },
    tenantPref: {
      chat_id: '-1001234567890',
      bot_token_ciphertext: 'cipher_tenant_bot',
      timezone: 'Asia/Jakarta'
    },
    contentFlowItem: {
      id: 'vid_101',
      brand_profile_id: 'bp_nutribake',
      source_campaign_id: 'mul_261126_abc123',
      campaign_title: 'Tepung Almond Sehat',
      link_affiliate: 'https://shopee.co.id/item'
    },
    publishingJobs: jobs
  });

  // Baris ke-2 masih menunggu delegasi Repliz
  const pendingRes = await maybeEmitReplizReadyDigest('tnt_1', 'vid_101', { queryFn: db.queryFn });
  assert.deepEqual(pendingRes, { pending: true });
  assert.equal(db.getOutbox().length, 0);

  // Baris ke-2 selesai mendapat external_schedule_id
  jobs[1].external_schedule_id = 'rep_sched_2';
  const emitted = await maybeEmitReplizReadyDigest('tnt_1', 'vid_101', { queryFn: db.queryFn });
  assert.ok(emitted);
  assert.equal(db.getOutbox().length, 1);
  assert.equal(db.getOutbox()[0].event_key, 'prod_repliz:vid_101');
  assert.equal(db.getOutbox()[0].message_thread_id, 42);
  assert.match(db.getOutbox()[0].payload_json.message, /Facebook \(NutriBake FB\)/);
  assert.match(db.getOutbox()[0].payload_json.message, /Instagram \(NutriBake IG\)/);

  // Pemanggilan ulang untuk content_id yang sama tetap idempoten (tepat 1 baris outbox)
  await maybeEmitReplizReadyDigest('tnt_1', 'vid_101', { queryFn: db.queryFn });
  assert.equal(db.getOutbox().length, 1);

  // Tahap tayang H-0: baru 1 akun published -> belum kirim; kedua akun published -> kirim 1 pesan dengan permalink
  jobs[0].status = 'published';
  jobs[0].external_permalink = 'https://facebook.com/post/1';
  const pubPending = await maybeEmitPublishedDigest('tnt_1', 'vid_101', { queryFn: db.queryFn });
  assert.deepEqual(pubPending, { pending: true });
  assert.equal(db.getOutbox().length, 1);

  jobs[1].status = 'published';
  jobs[1].external_permalink = 'https://instagram.com/reel/2';
  await maybeEmitPublishedDigest('tnt_1', 'vid_101', { queryFn: db.queryFn });
  assert.equal(db.getOutbox().length, 2);
  assert.equal(db.getOutbox()[1].event_key, 'pub_done_all:vid_101');
  assert.match(db.getOutbox()[1].payload_json.message, /https:\/\/facebook\.com\/post\/1/);
  assert.match(db.getOutbox()[1].payload_json.message, /https:\/\/instagram\.com\/reel\/2/);
});

test('4. Fail-open safety: error database pada enqueue tidak melempar exception', async () => {
  const failingQuery = async () => {
    throw new Error('Simulated DB connection loss');
  };

  const result = await enqueueBrandNotification({
    tenantId: 'tnt_1',
    brandId: 'bp_nutribake',
    sourceModule: 'auto_pipeline',
    eventKey: 'ap_fail:test',
    eventType: 'production_failed',
    title: 'Gagal',
    message: 'Error',
    queryFn: failingQuery
  });
  assert.equal(result, null);
});

test('5. Provider telegram.js menyertakan message_thread_id saat positif dan menghapusnya saat null', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ ok: true, result: { message_id: 999 } }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };

  try {
    await sendTelegramNotification({
      botToken: '123456:TEST_MOCK_BOT_TOKEN',
      chatId: '-1001234567890',
      messageThreadId: 42,
      title: 'Tes Topic',
      message: 'Isi pesan',
      actionUrl: '/settings/brand-profiles',
      actionLabel: 'Buka CF Studio',
      baseUrl: 'http://127.0.0.1:5020'
    });
    assert.equal(requests[0].body.message_thread_id, 42);
    assert.match(requests[0].body.text, /Buka CF Studio/);

    await sendTelegramNotification({
      botToken: '123456:TEST_MOCK_BOT_TOKEN',
      chatId: '-1001234567890',
      messageThreadId: null,
      title: 'Tes Tanpa Topic',
      message: 'Isi pesan',
      baseUrl: 'http://127.0.0.1:5020'
    });
    assert.equal('message_thread_id' in requests[1].body, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('6. Validasi saveBrandNotificationPreference dan update bot tenant dari modal tanpa menimpa event lama', async () => {
  const prevSecret = process.env.CREDENTIALS_ENCRYPTION_KEY;
  process.env.CREDENTIALS_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  try {
    const db = createMockDb({
      tenantPref: {
        tenant_id: 'tnt_1',
        enabled: true,
        chat_id: '-100111',
        bot_token_ciphertext: 'existing_cipher',
        events_json: ['awaiting_approval', 'failed'],
        timezone: 'Asia/Jakarta'
      }
    });

    await assert.rejects(
      () => saveBrandNotificationPreference('tnt_1', 'bp_nutribake', { enabled: true, message_thread_id: -5 }, 'usr_1', { queryFn: db.queryFn }),
      /bilangan bulat positif/i
    );

    const saved = await saveBrandNotificationPreference(
      'tnt_1',
      'bp_nutribake',
      {
        enabled: true,
        message_thread_id: 42,
        events: ['production_and_schedule', 'publish_failed'],
        tenant_telegram: {
          chat_id: '-100999888777',
          bot_token: '123456:TEST_MOCK_BOT_TOKEN',
          enabled: true
        }
      },
      'usr_1',
      { queryFn: db.queryFn }
    );

    assert.equal(saved.enabled, true);
    assert.equal(saved.message_thread_id, 42);
    assert.equal(saved.tenant_telegram.chat_id, '-100999888777');
    assert.deepEqual(db.getSavedTenantPref().events_json, ['awaiting_approval', 'failed']);
  } finally {
    if (prevSecret === undefined) delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    else process.env.CREDENTIALS_ENCRYPTION_KEY = prevSecret;
  }
});
