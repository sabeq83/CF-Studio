import { pgQuery, withPgTransaction } from './db-pg.js';
import { decryptSecret, encryptSecret } from './encrypted-secret.js';
import { calculateBackoff } from './content-automation-retry.js';
import { isInQuietHours, nextQuietHoursEnd } from './content-automation-quiet-hours.js';
import { sendTelegramNotification } from './notification-providers/telegram.js';

export const BRAND_NOTIFICATION_EVENTS = [
  'production_and_schedule',
  'production_failed',
  'awaiting_approval',
  'publish_succeeded',
  'publish_failed'
];

export const DEFAULT_BRAND_NOTIFICATION_EVENTS = [...BRAND_NOTIFICATION_EVENTS];
const ERROR_EVENT_TYPES = new Set(['production_failed', 'publish_failed']);
const TERMINAL_PUBLISH_STATUSES = new Set(['published', 'draft_created', 'failed', 'needs_review', 'cancelled']);
const FAILURE_PUBLISH_STATUSES = new Set(['failed', 'needs_review']);
const SUCCESS_PUBLISH_STATUSES = new Set(['published', 'draft_created']);

const DEFAULT_TENANT_AUTOMATION_EVENTS = ['awaiting_approval', 'failed', 'auto_paused', 'missed_run'];

function parseJson(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function validateTimeHHMM(value) {
  return value === null || value === undefined || value === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value));
}

export function validateTimezone(value) {
  try {
    new Intl.DateTimeFormat('id-ID', { timeZone: value || 'Asia/Jakarta' }).format();
    return true;
  } catch {
    return false;
  }
}

export function maskChatId(chatId) {
  const raw = String(chatId || '').trim();
  if (!raw) return '';
  if (raw.length <= 6) return `${raw.slice(0, 2)}***`;
  return `${raw.slice(0, 5)}...${raw.slice(-3)}`;
}

function getTimezoneLabel(timezone) {
  if (timezone === 'Asia/Makassar') return 'WITA';
  if (timezone === 'Asia/Jayapura') return 'WIT';
  if (timezone === 'Asia/Jakarta') return 'WIB';
  return timezone || 'WIB';
}

export function formatScheduleTime(dateInput, timezone = 'Asia/Jakarta') {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return String(dateInput);
  try {
    const formatted = new Intl.DateTimeFormat('id-ID', {
      timeZone: timezone || 'Asia/Jakarta',
      weekday: 'long',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(date);
    return `${formatted} ${getTimezoneLabel(timezone)}`;
  } catch {
    return date.toISOString();
  }
}

export function formatShortTime(dateInput, timezone = 'Asia/Jakarta') {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return String(dateInput);
  try {
    const formatted = new Intl.DateTimeFormat('id-ID', {
      timeZone: timezone || 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(date);
    return `${formatted} ${getTimezoneLabel(timezone)}`;
  } catch {
    return date.toISOString();
  }
}

function sanitizeErrorSnippet(errOrMessage, maxLength = 240) {
  const raw = errOrMessage instanceof Error ? errOrMessage.message : String(errOrMessage || 'Terjadi kesalahan tidak terduga');
  return raw.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function formatPlatformLabel(platform) {
  const p = String(platform || '').toLowerCase();
  if (p === 'facebook') return 'Facebook';
  if (p === 'instagram') return 'Instagram';
  if (p === 'tiktok') return 'TikTok';
  if (p === 'youtube') return 'YouTube';
  if (p === 'threads') return 'Threads';
  if (p === 'linkedin') return 'LinkedIn';
  return p ? p.charAt(0).toUpperCase() + p.slice(1) : 'Platform';
}

function createValidationError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Update only bot_token/chat_id/enabled on tenant-level Telegram config without clobbering existing automation events.
 */
export async function saveTenantTelegramDefaults(tenantId, input = {}, actor = 'admin', { queryFn = pgQuery } = {}) {
  const currentRes = await queryFn(
    'SELECT * FROM content_automation_notification_preferences WHERE tenant_id = $1',
    [tenantId]
  );
  const current = currentRes.rows[0] || null;
  const chatId = input.chat_id !== undefined ? String(input.chat_id || '').trim() : (current?.chat_id || '');
  const rawToken = String(input.bot_token || '').trim();

  if (rawToken && !/^\d+:[A-Za-z0-9_-]+$/.test(rawToken)) {
    throw createValidationError('Format Telegram bot token tidak valid.');
  }

  const cipher = rawToken ? encryptSecret(rawToken) : (current?.bot_token_ciphertext || null);
  const enabled = input.enabled !== undefined ? Boolean(input.enabled) : Boolean(current?.enabled ?? (chatId && cipher));

  if (enabled && (!chatId || !cipher)) {
    throw createValidationError('Chat ID grup dan bot token Telegram tenant wajib diisi.');
  }

  const existingEvents = parseJson(current?.events_json, null);
  const eventsJson = JSON.stringify(
    Array.isArray(existingEvents) && existingEvents.length > 0 ? existingEvents : DEFAULT_TENANT_AUTOMATION_EVENTS
  );

  const saved = await queryFn(
    `INSERT INTO content_automation_notification_preferences
      (tenant_id, enabled, channel, chat_id, bot_token_ciphertext, events_json, quiet_start, quiet_end, timezone, updated_by)
     VALUES ($1, $2, 'telegram', $3, $4, $5::jsonb, $6, $7, $8, $9)
     ON CONFLICT (tenant_id) DO UPDATE SET
      enabled = EXCLUDED.enabled,
      chat_id = EXCLUDED.chat_id,
      bot_token_ciphertext = EXCLUDED.bot_token_ciphertext,
      updated_by = EXCLUDED.updated_by,
      updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      tenantId,
      enabled,
      chatId || null,
      cipher,
      eventsJson,
      current?.quiet_start || null,
      current?.quiet_end || null,
      current?.timezone || 'Asia/Jakarta',
      actor
    ]
  );
  return saved.rows[0] || null;
}

export async function getBrandNotificationPreference(tenantId, brandId, { queryFn = pgQuery } = {}) {
  const [brandRes, tenantRes] = await Promise.all([
    queryFn(
      `SELECT * FROM brand_notification_preferences WHERE tenant_id = $1 AND brand_id = $2 AND channel = 'telegram' LIMIT 1`,
      [tenantId, brandId]
    ),
    queryFn(
      `SELECT enabled, chat_id, bot_token_ciphertext, quiet_start, quiet_end, timezone FROM content_automation_notification_preferences WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    )
  ]);

  const brandPref = brandRes.rows[0] || null;
  const tenantPref = tenantRes.rows[0] || null;
  const parsedEvents = parseJson(brandPref?.events_json, null);
  const events = Array.isArray(parsedEvents) ? parsedEvents.filter(e => BRAND_NOTIFICATION_EVENTS.includes(e)) : DEFAULT_BRAND_NOTIFICATION_EVENTS;
  const effectiveChatId = brandPref?.chat_id || tenantPref?.chat_id || '';
  const tenantConfigured = Boolean(tenantPref?.bot_token_ciphertext && tenantPref?.chat_id);

  return {
    brand_id: brandId,
    enabled: Boolean(brandPref?.enabled),
    channel: 'telegram',
    chat_id: brandPref?.chat_id || '',
    message_thread_id: brandPref?.message_thread_id ? Number(brandPref.message_thread_id) : null,
    events: events.length > 0 ? events : DEFAULT_BRAND_NOTIFICATION_EVENTS,
    quiet_start: brandPref?.quiet_start || '',
    quiet_end: brandPref?.quiet_end || '',
    bypass_quiet_for_errors: brandPref?.bypass_quiet_for_errors !== false,
    timezone: brandPref?.timezone || tenantPref?.timezone || 'Asia/Jakarta',
    updated_at: brandPref?.updated_at || null,
    tenant_configured: tenantConfigured,
    tenant_bot_configured: Boolean(tenantPref?.bot_token_ciphertext),
    tenant_chat_id_masked: maskChatId(tenantPref?.chat_id),
    effective_chat_id_masked: maskChatId(effectiveChatId),
    tenant_telegram: {
      enabled: Boolean(tenantPref?.enabled),
      chat_id: tenantPref?.chat_id || '',
      chat_id_masked: maskChatId(tenantPref?.chat_id),
      configured: tenantConfigured,
      has_bot_token: Boolean(tenantPref?.bot_token_ciphertext)
    }
  };
}

export async function listBrandNotificationPreferencesByTenant(tenantId, { queryFn = pgQuery } = {}) {
  const [prefsRes, tenantRes] = await Promise.all([
    queryFn(
      `SELECT brand_id, enabled, chat_id, message_thread_id, events_json, timezone
       FROM brand_notification_preferences
       WHERE tenant_id = $1 AND channel = 'telegram'`,
      [tenantId]
    ),
    queryFn(
      `SELECT enabled, chat_id, bot_token_ciphertext
       FROM content_automation_notification_preferences
       WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    )
  ]);

  const tenantPref = tenantRes.rows[0] || null;
  const tenantConfigured = Boolean(tenantPref?.bot_token_ciphertext && tenantPref?.chat_id);
  const byBrandId = {};

  for (const row of prefsRes.rows || []) {
    byBrandId[row.brand_id] = {
      enabled: Boolean(row.enabled),
      message_thread_id: row.message_thread_id ? Number(row.message_thread_id) : null,
      has_chat_override: Boolean(row.chat_id),
      tenant_configured: tenantConfigured
    };
  }

  return {
    tenant_telegram: {
      enabled: Boolean(tenantPref?.enabled),
      chat_id: tenantPref?.chat_id || '',
      chat_id_masked: maskChatId(tenantPref?.chat_id),
      configured: tenantConfigured,
      has_bot_token: Boolean(tenantPref?.bot_token_ciphertext)
    },
    by_brand_id: byBrandId
  };
}

export async function saveBrandNotificationPreference(tenantId, brandId, input = {}, actor = 'admin', { queryFn = pgQuery } = {}) {
  if (input.tenant_telegram && typeof input.tenant_telegram === 'object') {
    await saveTenantTelegramDefaults(tenantId, input.tenant_telegram, actor, { queryFn });
  }

  const tenantRes = await queryFn(
    `SELECT chat_id, bot_token_ciphertext FROM content_automation_notification_preferences WHERE tenant_id = $1 LIMIT 1`,
    [tenantId]
  );
  const tenantPref = tenantRes.rows[0] || null;

  const currentRes = await queryFn(
    `SELECT * FROM brand_notification_preferences WHERE tenant_id = $1 AND brand_id = $2 AND channel = 'telegram' LIMIT 1`,
    [tenantId, brandId]
  );
  const current = currentRes.rows[0] || null;

  const enabled = input.enabled !== undefined ? Boolean(input.enabled) : Boolean(current?.enabled);
  const chatOverride = input.chat_id !== undefined
    ? (String(input.chat_id || '').trim() || null)
    : (current?.chat_id || null);

  let messageThreadId = current?.message_thread_id ? Number(current.message_thread_id) : null;
  if (input.message_thread_id !== undefined) {
    if (input.message_thread_id === null || input.message_thread_id === '') {
      messageThreadId = null;
    } else {
      const parsed = Number(input.message_thread_id);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw createValidationError('Topic / Thread ID Telegram harus berupa bilangan bulat positif.');
      }
      messageThreadId = parsed;
    }
  }

  let events = DEFAULT_BRAND_NOTIFICATION_EVENTS;
  if (input.events !== undefined) {
    const normalized = [...new Set(Array.isArray(input.events) ? input.events : [])];
    if (normalized.length === 0 || normalized.some(ev => !BRAND_NOTIFICATION_EVENTS.includes(ev))) {
      throw createValidationError('Pilih minimal satu event notifikasi brand yang valid.');
    }
    events = normalized;
  } else if (current?.events_json) {
    const parsed = parseJson(current.events_json, DEFAULT_BRAND_NOTIFICATION_EVENTS);
    if (Array.isArray(parsed) && parsed.length > 0) events = parsed;
  }

  const quietStart = input.quiet_start !== undefined ? (String(input.quiet_start || '').trim() || null) : (current?.quiet_start || null);
  const quietEnd = input.quiet_end !== undefined ? (String(input.quiet_end || '').trim() || null) : (current?.quiet_end || null);
  if (!validateTimeHHMM(quietStart) || !validateTimeHHMM(quietEnd)) {
    throw createValidationError('Format jam tenang harus HH:mm.');
  }

  const timezone = input.timezone !== undefined ? String(input.timezone || 'Asia/Jakarta').trim() : (current?.timezone || 'Asia/Jakarta');
  if (!validateTimezone(timezone)) {
    throw createValidationError('Zona waktu tidak valid.');
  }

  const bypassQuietForErrors = input.bypass_quiet_for_errors !== undefined
    ? Boolean(input.bypass_quiet_for_errors)
    : (current?.bypass_quiet_for_errors !== false);

  const effectiveChatId = chatOverride || tenantPref?.chat_id || '';
  if (enabled && (!tenantPref?.bot_token_ciphertext || !effectiveChatId)) {
    throw createValidationError('Bot Token atau Chat ID grup Telegram tenant belum dikonfigurasi. Lengkapi pengaturan Bot & Grup Tenant terlebih dahulu.');
  }

  await queryFn(
    `INSERT INTO brand_notification_preferences
      (tenant_id, brand_id, enabled, channel, chat_id, message_thread_id, events_json, quiet_start, quiet_end, bypass_quiet_for_errors, timezone, updated_by)
     VALUES ($1, $2, $3, 'telegram', $4, $5, $6::jsonb, $7, $8, $9, $10, $11)
     ON CONFLICT (tenant_id, brand_id, channel) DO UPDATE SET
      enabled = EXCLUDED.enabled,
      chat_id = EXCLUDED.chat_id,
      message_thread_id = EXCLUDED.message_thread_id,
      events_json = EXCLUDED.events_json,
      quiet_start = EXCLUDED.quiet_start,
      quiet_end = EXCLUDED.quiet_end,
      bypass_quiet_for_errors = EXCLUDED.bypass_quiet_for_errors,
      timezone = EXCLUDED.timezone,
      updated_by = EXCLUDED.updated_by,
      updated_at = CURRENT_TIMESTAMP`,
    [
      tenantId,
      brandId,
      enabled,
      chatOverride,
      messageThreadId,
      JSON.stringify(events),
      quietStart,
      quietEnd,
      bypassQuietForErrors,
      timezone,
      actor
    ]
  );

  return await getBrandNotificationPreference(tenantId, brandId, { queryFn });
}

export async function resolveBrandTelegramTarget(tenantId, brandId, { queryFn = pgQuery, ignoreBrandEnabled = false } = {}) {
  if (!tenantId || !brandId) return null;
  const [brandRes, tenantRes, profileRes] = await Promise.all([
    queryFn(
      `SELECT * FROM brand_notification_preferences WHERE tenant_id = $1 AND brand_id = $2 AND channel = 'telegram' LIMIT 1`,
      [tenantId, brandId]
    ),
    queryFn(
      `SELECT chat_id, bot_token_ciphertext, quiet_start, quiet_end, timezone FROM content_automation_notification_preferences WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    ),
    queryFn(
      `SELECT id, brand_name FROM brand_profiles WHERE tenant_id = $1 AND id = $2 LIMIT 1`,
      [tenantId, brandId]
    )
  ]);

  const brandPref = brandRes.rows[0] || null;
  const tenantPref = tenantRes.rows[0] || null;
  const profile = profileRes.rows[0] || null;

  if (!ignoreBrandEnabled && brandPref?.enabled !== true) {
    return null;
  }

  const effectiveChatId = brandPref?.chat_id || tenantPref?.chat_id || null;
  const effectiveTokenCipher = tenantPref?.bot_token_ciphertext || null;
  if (!effectiveChatId || !effectiveTokenCipher) {
    return null;
  }

  const parsedThreadId = Number(brandPref?.message_thread_id);
  const effectiveThreadId = Number.isInteger(parsedThreadId) && parsedThreadId > 0 ? parsedThreadId : null;
  const parsedEvents = parseJson(brandPref?.events_json, DEFAULT_BRAND_NOTIFICATION_EVENTS);
  const events = Array.isArray(parsedEvents) ? parsedEvents : DEFAULT_BRAND_NOTIFICATION_EVENTS;

  return {
    tenantId,
    brandId,
    brandName: profile?.brand_name || brandId,
    chatId: effectiveChatId,
    messageThreadId: effectiveThreadId,
    botTokenCiphertext: effectiveTokenCipher,
    events,
    quietStart: brandPref?.quiet_start ?? tenantPref?.quiet_start ?? null,
    quietEnd: brandPref?.quiet_end ?? tenantPref?.quiet_end ?? null,
    bypassQuietForErrors: brandPref?.bypass_quiet_for_errors !== false,
    timezone: brandPref?.timezone || tenantPref?.timezone || 'Asia/Jakarta'
  };
}

export async function resolveBrandForContent(tenantId, contentId, { queryFn = pgQuery } = {}) {
  if (!tenantId || !contentId) return null;
  try {
    const cfRes = await queryFn(
      `SELECT id, brand_profile_id, source_campaign_id, source_type, account_name, campaign_title, hook, nama_produk, link_affiliate, link_produk
       FROM content_flow_items
       WHERE tenant_id = $1 AND (video_id = $2 OR id = $2)
       LIMIT 1`,
      [tenantId, contentId]
    );
    const cfItem = cfRes.rows[0] || null;
    if (cfItem?.brand_profile_id) {
      return cfItem.brand_profile_id;
    }

    if (cfItem?.source_campaign_id) {
      const schedRes = await queryFn(
        `SELECT brand_id FROM auto_pipeline_schedules
         WHERE tenant_id = $1 AND last_campaign_id = $2
         ORDER BY updated_at DESC LIMIT 1`,
        [tenantId, cfItem.source_campaign_id]
      );
      if (schedRes.rows[0]?.brand_id) {
        return schedRes.rows[0].brand_id;
      }

      const pillarRes = await queryFn(
        `SELECT brand_profile_id FROM pillar_campaigns
         WHERE tenant_id = $1 AND id = $2
         LIMIT 1`,
        [tenantId, cfItem.source_campaign_id]
      );
      if (pillarRes.rows[0]?.brand_profile_id) {
        return pillarRes.rows[0].brand_profile_id;
      }
    }

    if (cfItem?.account_name && cfItem.account_name !== 'Umum') {
      const bpRes = await queryFn(
        `SELECT id FROM brand_profiles
         WHERE tenant_id = $1 AND LOWER(brand_name) = LOWER($2)
         LIMIT 1`,
        [tenantId, cfItem.account_name]
      );
      if (bpRes.rows[0]?.id) {
        return bpRes.rows[0].id;
      }
    }

    return null;
  } catch (err) {
    console.warn('[Brand Notification] Gagal resolve brand_id untuk content:', contentId, err.message);
    return null;
  }
}

export async function enqueueBrandNotification({
  tenantId,
  brandId,
  sourceModule,
  entityId = null,
  eventKey,
  eventType,
  title,
  message,
  actionUrl = '/content-flow',
  ignoreBrandEnabled = false,
  targetOverride = null,
  queryFn = pgQuery
}) {
  try {
    if (!tenantId || !brandId || !eventKey || !eventType) return null;
    const target = targetOverride || await resolveBrandTelegramTarget(tenantId, brandId, {
      queryFn,
      ignoreBrandEnabled: ignoreBrandEnabled || eventType === 'test'
    });
    if (!target) return null;

    if (eventType !== 'test' && !target.events.includes(eventType)) {
      return null;
    }

    const now = new Date();
    const isErrorEvent = ERROR_EVENT_TYPES.has(eventType);
    const shouldBypassQuiet = isErrorEvent && target.bypassQuietForErrors;
    const inQuiet = !shouldBypassQuiet && eventType !== 'test' && isInQuietHours({
      date: now,
      start: target.quietStart,
      end: target.quietEnd,
      timezone: target.timezone
    });
    const nextAttemptAt = inQuiet
      ? nextQuietHoursEnd({ date: now, start: target.quietStart, end: target.quietEnd, timezone: target.timezone })
      : now;

    const result = await queryFn(
      `INSERT INTO studio_notification_outbox
        (tenant_id, brand_id, source_module, entity_id, event_key, channel, event_type, chat_id, message_thread_id, bot_token_ciphertext, payload_json, next_attempt_at)
       VALUES ($1, $2, $3, $4, $5, 'telegram', $6, $7, $8, $9, $10::jsonb, $11)
       ON CONFLICT (tenant_id, event_key, channel) DO NOTHING
       RETURNING *`,
      [
        tenantId,
        brandId,
        sourceModule || 'auto_pipeline',
        entityId || null,
        eventKey,
        eventType,
        target.chatId,
        target.messageThreadId,
        target.botTokenCiphertext,
        JSON.stringify({ title, message, action_url: actionUrl }),
        nextAttemptAt
      ]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.warn('[Brand Notification] Fail-open enqueue error:', err.message);
    return null;
  }
}

export function buildReplizReadyDigestPayload({ brandName, contentMeta, jobs, timezone = 'Asia/Jakarta' }) {
  const titleText = contentMeta?.campaign_title || contentMeta?.hook || contentMeta?.schedule_name || contentMeta?.content_id || 'Konten Video';
  const campaignId = contentMeta?.source_campaign_id || null;
  const scheduledAt = jobs[0]?.scheduled_at || contentMeta?.scheduled_at || null;
  const hasAffiliate = Boolean(contentMeta?.link_affiliate || contentMeta?.link_produk);
  const channelSummary = jobs.map(j => {
    const label = formatPlatformLabel(j.platform);
    const accName = j.account_display_name ? ` (${j.account_display_name})` : '';
    return `${label}${accName} ✅`;
  }).join(' | ');

  const lines = [
    `• Konten: ${titleText}`,
    campaignId ? `• Campaign: ${campaignId}` : null,
    `• Tayang: ${formatScheduleTime(scheduledAt, timezone)}`,
    `• Channel: ${channelSummary}`,
    `• Link Afiliasi: ${hasAffiliate ? 'Aktif' : 'Tidak ada'}`
  ].filter(Boolean);

  return {
    title: `✅ [${brandName}] Video Siap & Terjadwal ke Repliz`,
    message: lines.join('\n'),
    actionUrl: '/content-flow'
  };
}

export function buildPublishedDigestPayload({ brandName, contentMeta, jobs, timezone = 'Asia/Jakarta' }) {
  const titleText = contentMeta?.campaign_title || contentMeta?.hook || jobs[0]?.title_snapshot || contentMeta?.content_id || 'Konten Video';
  const scheduledAt = jobs[0]?.scheduled_at || null;

  const platformLines = jobs
    .filter(j => SUCCESS_PUBLISH_STATUSES.has(j.status))
    .map(j => {
      const label = formatPlatformLabel(j.platform);
      const statusLabel = j.status === 'draft_created' ? 'Draft tersimpan' : 'Terbit';
      return j.external_permalink
        ? `• ${label}: ${statusLabel} (${j.external_permalink})`
        : `• ${label}: ${statusLabel}`;
    });

  const lines = [
    `• Konten: ${titleText}`,
    `• Jadwal Asli: ${formatShortTime(scheduledAt, timezone)}`,
    ...platformLines
  ];

  return {
    title: `🚀 [${brandName}] Konten Sudah Tayang`,
    message: lines.join('\n'),
    actionUrl: '/content-flow'
  };
}

export async function maybeEmitReplizReadyDigest(tenantId, contentId, { queryFn = pgQuery } = {}) {
  try {
    if (!tenantId || !contentId) return null;

    const jobsRes = await queryFn(
      `SELECT j.*, pa.display_name AS account_display_name
       FROM publishing_jobs j
       LEFT JOIN publishing_accounts pa ON pa.id = j.account_id
       WHERE j.tenant_id = $1 AND j.content_id = $2
       ORDER BY j.created_at ASC`,
      [tenantId, contentId]
    );
    const jobs = jobsRes.rows || [];
    if (jobs.length === 0) return null;

    const stillPendingRepliz = jobs.some(
      j => j.provider === 'repliz' && !j.external_schedule_id && ['scheduled', 'processing', 'retry_wait'].includes(j.status)
    );
    if (stillPendingRepliz) {
      return { pending: true };
    }

    const brandId = await resolveBrandForContent(tenantId, contentId, { queryFn });
    if (!brandId) return null;

    const target = await resolveBrandTelegramTarget(tenantId, brandId, { queryFn });
    if (!target) return null;

    const cfRes = await queryFn(
      `SELECT id, source_campaign_id, campaign_title, hook, link_affiliate, link_produk
       FROM content_flow_items
       WHERE tenant_id = $1 AND (video_id = $2 OR id = $2)
       LIMIT 1`,
      [tenantId, contentId]
    );
    const contentMeta = { ...(cfRes.rows[0] || {}), content_id: contentId };

    const failedJobs = jobs.filter(j => FAILURE_PUBLISH_STATUSES.has(j.status));
    if (failedJobs.length > 0) {
      const errorLines = failedJobs.map(j =>
        `• ${formatPlatformLabel(j.platform)}${j.account_display_name ? ` (${j.account_display_name})` : ''}: ${sanitizeErrorSnippet(j.last_error_message || j.last_error_code || j.status)}`
      );
      const okJobs = jobs.filter(j => !FAILURE_PUBLISH_STATUSES.has(j.status) && j.status !== 'cancelled');
      const messageLines = [
        `• Konten: ${contentMeta.campaign_title || contentMeta.hook || contentId}`,
        okJobs.length > 0 ? `• Berhasil terjadwal: ${okJobs.map(j => formatPlatformLabel(j.platform)).join(', ')}` : null,
        ...errorLines
      ].filter(Boolean);

      return await enqueueBrandNotification({
        tenantId,
        brandId,
        sourceModule: 'publishing',
        entityId: contentId,
        eventKey: `prod_repliz_fail:${contentId}`,
        eventType: 'publish_failed',
        title: `⚠️ [${target.brandName}] Gagal Jadwal Repliz`,
        message: messageLines.join('\n'),
        actionUrl: '/content-flow',
        targetOverride: target,
        queryFn
      });
    }

    const activeJobs = jobs.filter(j => j.status !== 'cancelled');
    if (activeJobs.length === 0) return null;

    const payload = buildReplizReadyDigestPayload({
      brandName: target.brandName,
      contentMeta,
      jobs: activeJobs,
      timezone: target.timezone
    });

    return await enqueueBrandNotification({
      tenantId,
      brandId,
      sourceModule: 'publishing',
      entityId: contentId,
      eventKey: `prod_repliz:${contentId}`,
      eventType: 'production_and_schedule',
      title: payload.title,
      message: payload.message,
      actionUrl: payload.actionUrl,
      targetOverride: target,
      queryFn
    });
  } catch (err) {
    console.warn('[Brand Notification] maybeEmitReplizReadyDigest error:', err.message);
    return null;
  }
}

export async function maybeEmitPublishedDigest(tenantId, contentId, { queryFn = pgQuery } = {}) {
  try {
    if (!tenantId || !contentId) return null;

    const jobsRes = await queryFn(
      `SELECT j.*, pa.display_name AS account_display_name
       FROM publishing_jobs j
       LEFT JOIN publishing_accounts pa ON pa.id = j.account_id
       WHERE j.tenant_id = $1 AND j.content_id = $2
       ORDER BY j.created_at ASC`,
      [tenantId, contentId]
    );
    const jobs = jobsRes.rows || [];
    if (jobs.length === 0) return null;

    const hasPending = jobs.some(j => !TERMINAL_PUBLISH_STATUSES.has(j.status));
    if (hasPending) {
      return { pending: true };
    }

    const hasFailure = jobs.some(j => FAILURE_PUBLISH_STATUSES.has(j.status));
    const hasSuccess = jobs.some(j => SUCCESS_PUBLISH_STATUSES.has(j.status));
    if (hasFailure || !hasSuccess) {
      return null;
    }

    const brandId = await resolveBrandForContent(tenantId, contentId, { queryFn });
    if (!brandId) return null;

    const target = await resolveBrandTelegramTarget(tenantId, brandId, { queryFn });
    if (!target) return null;

    const cfRes = await queryFn(
      `SELECT id, source_campaign_id, campaign_title, hook
       FROM content_flow_items
       WHERE tenant_id = $1 AND (video_id = $2 OR id = $2)
       LIMIT 1`,
      [tenantId, contentId]
    );
    const contentMeta = { ...(cfRes.rows[0] || {}), content_id: contentId };

    const payload = buildPublishedDigestPayload({
      brandName: target.brandName,
      contentMeta,
      jobs,
      timezone: target.timezone
    });

    return await enqueueBrandNotification({
      tenantId,
      brandId,
      sourceModule: 'publishing',
      entityId: contentId,
      eventKey: `pub_done_all:${contentId}`,
      eventType: 'publish_succeeded',
      title: payload.title,
      message: payload.message,
      actionUrl: payload.actionUrl,
      targetOverride: target,
      queryFn
    });
  } catch (err) {
    console.warn('[Brand Notification] maybeEmitPublishedDigest error:', err.message);
    return null;
  }
}

export async function enqueueBrandErrorNotification(job, finalStatus, errorMessage, { queryFn = pgQuery } = {}) {
  try {
    if (!job?.tenant_id || !job?.content_id) return null;
    const brandId = await resolveBrandForContent(job.tenant_id, job.content_id, { queryFn });
    if (!brandId) return null;

    const target = await resolveBrandTelegramTarget(job.tenant_id, brandId, { queryFn });
    if (!target) return null;

    const statusLabel = finalStatus === 'needs_review' ? 'Perlu Review' : 'Gagal Publish';
    const lines = [
      `• Konten: ${job.title_snapshot || job.content_id}`,
      `• Platform: ${formatPlatformLabel(job.platform)}${job.account_display_name ? ` (${job.account_display_name})` : ''}`,
      `• Error: ${sanitizeErrorSnippet(errorMessage || job.last_error_message || job.last_error_code)}`,
      `• Jadwal Tayang: ${formatScheduleTime(job.scheduled_at, target.timezone)}`
    ];

    return await enqueueBrandNotification({
      tenantId: job.tenant_id,
      brandId,
      sourceModule: 'publishing',
      entityId: job.content_id,
      eventKey: `pub_fail:${job.id}:${finalStatus}`,
      eventType: 'publish_failed',
      title: `🚨 [${target.brandName}] ${statusLabel}`,
      message: lines.join('\n'),
      actionUrl: '/content-flow',
      targetOverride: target,
      queryFn
    });
  } catch (err) {
    console.warn('[Brand Notification] enqueueBrandErrorNotification error:', err.message);
    return null;
  }
}

export async function notifyAutoPipelineProductionReady(tenantId, scheduleRow, campaignId, { queryFn = pgQuery } = {}) {
  try {
    if (!tenantId || !scheduleRow?.brand_id || !campaignId) return null;
    const target = await resolveBrandTelegramTarget(tenantId, scheduleRow.brand_id, { queryFn });
    if (!target) return null;

    const lines = [
      `• Jadwal: ${scheduleRow.name || scheduleRow.id}`,
      `• Campaign: ${campaignId}`,
      '• Status: Video selesai dirender (Auto-Publish nonaktif)'
    ];

    return await enqueueBrandNotification({
      tenantId,
      brandId: scheduleRow.brand_id,
      sourceModule: 'auto_pipeline',
      entityId: String(campaignId),
      eventKey: `ap_prod_only:${scheduleRow.id}:${campaignId}`,
      eventType: 'production_and_schedule',
      title: `✅ [${target.brandName}] Produksi Video Selesai`,
      message: lines.join('\n'),
      actionUrl: '/content-flow',
      targetOverride: target,
      queryFn
    });
  } catch (err) {
    console.warn('[Brand Notification] notifyAutoPipelineProductionReady error:', err.message);
    return null;
  }
}

export async function notifyAutoPipelineProductionFailed(tenantId, scheduleRow, errorMessage, runDateStr = null, { queryFn = pgQuery } = {}) {
  try {
    if (!tenantId || !scheduleRow?.brand_id) return null;
    const target = await resolveBrandTelegramTarget(tenantId, scheduleRow.brand_id, { queryFn });
    if (!target) return null;

    const dateTag = runDateStr || scheduleRow.target_date || new Date().toISOString().slice(0, 10);
    const targetSchedule = [scheduleRow.publish_date || dateTag, scheduleRow.publish_time].filter(Boolean).join(' ');
    const lines = [
      `• Jadwal: ${scheduleRow.name || scheduleRow.id} (${dateTag})`,
      `• Error: ${sanitizeErrorSnippet(errorMessage)}`,
      targetSchedule ? `• Target Tayang: ${targetSchedule} ${getTimezoneLabel(scheduleRow.timezone || target.timezone)}` : null
    ].filter(Boolean);

    return await enqueueBrandNotification({
      tenantId,
      brandId: scheduleRow.brand_id,
      sourceModule: 'auto_pipeline',
      entityId: scheduleRow.id,
      eventKey: `ap_fail:${scheduleRow.id}:${dateTag}`,
      eventType: 'production_failed',
      title: `🚨 [${target.brandName}] Gagal Produksi Video`,
      message: lines.join('\n'),
      actionUrl: '/auto-pipeline',
      targetOverride: target,
      queryFn
    });
  } catch (err) {
    console.warn('[Brand Notification] notifyAutoPipelineProductionFailed error:', err.message);
    return null;
  }
}

export async function notifyAutoPipelineDispatchFailed(tenantId, scheduleRow, cfItemId, errorMessage, { queryFn = pgQuery } = {}) {
  try {
    if (!tenantId || !scheduleRow?.brand_id || !cfItemId) return null;
    const target = await resolveBrandTelegramTarget(tenantId, scheduleRow.brand_id, { queryFn });
    if (!target) return null;

    const lines = [
      `• Jadwal: ${scheduleRow.name || scheduleRow.id}`,
      `• Konten: ${cfItemId}`,
      `• Error: ${sanitizeErrorSnippet(errorMessage)}`
    ];

    return await enqueueBrandNotification({
      tenantId,
      brandId: scheduleRow.brand_id,
      sourceModule: 'auto_pipeline',
      entityId: cfItemId,
      eventKey: `ap_dispatch_fail:${scheduleRow.id}:${cfItemId}`,
      eventType: 'publish_failed',
      title: `⚠️ [${target.brandName}] Gagal Dispatch Publish`,
      message: lines.join('\n'),
      actionUrl: '/auto-pipeline',
      targetOverride: target,
      queryFn
    });
  } catch (err) {
    console.warn('[Brand Notification] notifyAutoPipelineDispatchFailed error:', err.message);
    return null;
  }
}

export async function notifyBrandAwaitingApproval(run, { queryFn = pgQuery } = {}) {
  try {
    if (!run?.tenant_id || !run?.schedule_id) return null;
    const schedRes = await queryFn(
      `SELECT id, name, brand_profile_id, operator_request_json
       FROM content_automation_schedules
       WHERE tenant_id = $1 AND id = $2
       LIMIT 1`,
      [run.tenant_id, run.schedule_id]
    );
    const sched = schedRes.rows[0] || null;
    const reqJson = parseJson(sched?.operator_request_json, {});
    const brandId = sched?.brand_profile_id || reqJson?.planner?.brand_id || null;
    if (!brandId) return null;

    const target = await resolveBrandTelegramTarget(run.tenant_id, brandId, { queryFn });
    if (!target) return null;

    const lines = [
      `• Jadwal: ${run.schedule_name || sched?.name || run.schedule_id}`,
      '• Status: Storyboard siap direview dan menunggu persetujuan.'
    ];

    return await enqueueBrandNotification({
      tenantId: run.tenant_id,
      brandId,
      sourceModule: 'content_automations',
      entityId: run.id,
      eventKey: `ca_approval:${run.id}`,
      eventType: 'awaiting_approval',
      title: `👀 [${target.brandName}] Menunggu Persetujuan`,
      message: lines.join('\n'),
      actionUrl: `/content-automations?run=${run.id}`,
      targetOverride: target,
      queryFn
    });
  } catch (err) {
    console.warn('[Brand Notification] notifyBrandAwaitingApproval error:', err.message);
    return null;
  }
}

export async function recoverStaleStudioOutbox() {
  await pgQuery(
    `UPDATE studio_notification_outbox
     SET status = 'retry_wait',
         next_attempt_at = CURRENT_TIMESTAMP,
         locked_at = NULL,
         locked_by = NULL,
         last_error = COALESCE(last_error, 'stale sending claim recovered'),
         updated_at = CURRENT_TIMESTAMP
     WHERE status = 'sending' AND locked_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes'`
  );
}

export async function claimStudioNotification(workerId) {
  return withPgTransaction(async client => {
    const row = (
      await client.query(
        `SELECT o.*,
                bp.quiet_start,
                bp.quiet_end,
                bp.bypass_quiet_for_errors,
                bp.timezone
         FROM studio_notification_outbox o
         LEFT JOIN brand_notification_preferences bp
           ON bp.tenant_id = o.tenant_id
          AND bp.brand_id = o.brand_id
          AND bp.channel = o.channel
         WHERE o.status IN ('queued', 'retry_wait')
           AND o.next_attempt_at <= CURRENT_TIMESTAMP
         ORDER BY o.next_attempt_at ASC, o.id ASC
         FOR UPDATE OF o SKIP LOCKED
         LIMIT 1`
      )
    ).rows[0];
    if (!row) return null;

    const updated = (
      await client.query(
        `UPDATE studio_notification_outbox
         SET status = 'sending',
             attempt_count = attempt_count + 1,
             locked_at = CURRENT_TIMESTAMP,
             locked_by = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [row.id, workerId]
      )
    ).rows[0];

    return updated ? { ...row, ...updated } : null;
  });
}

export async function processStudioNotificationOutboxTick({ workerId, state = null, sendFn = sendTelegramNotification } = {}) {
  await recoverStaleStudioOutbox();
  const baseUrl = process.env.MAKNA_PUBLIC_BASE_URL || process.env.STAGING_WEB_ORIGIN || 'http://127.0.0.1:3000';

  for (let i = 0; i < 10; i++) {
    const item = await claimStudioNotification(workerId);
    if (!item) break;

    const isErrorEvent = ERROR_EVENT_TYPES.has(item.event_type);
    const shouldBypassQuiet = isErrorEvent && item.bypass_quiet_for_errors !== false;
    if (!shouldBypassQuiet && item.event_type !== 'test' && isInQuietHours({
      date: new Date(),
      start: item.quiet_start,
      end: item.quiet_end,
      timezone: item.timezone || 'Asia/Jakarta'
    })) {
      const retryAt = nextQuietHoursEnd({
        date: new Date(),
        start: item.quiet_start,
        end: item.quiet_end,
        timezone: item.timezone || 'Asia/Jakarta'
      });
      await pgQuery(
        `UPDATE studio_notification_outbox
         SET status = 'retry_wait',
             attempt_count = GREATEST(attempt_count - 1, 0),
             next_attempt_at = $2,
             last_error = 'deferred by quiet hours',
             locked_at = NULL,
             locked_by = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [item.id, retryAt]
      );
      continue;
    }

    try {
      const payload = parseJson(item.payload_json, {});
      const result = await sendFn({
        botToken: decryptSecret(item.bot_token_ciphertext),
        chatId: item.chat_id,
        messageThreadId: item.message_thread_id,
        title: payload.title,
        message: payload.message,
        actionUrl: payload.action_url,
        actionLabel: 'Buka CF Studio',
        baseUrl
      });

      await pgQuery(
        `UPDATE studio_notification_outbox
         SET status = 'sent',
             provider_message_id = $2,
             sent_at = CURRENT_TIMESTAMP,
             locked_at = NULL,
             locked_by = NULL,
             last_error = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [item.id, result?.provider_message_id || null]
      );
      if (state) {
        state.lastSentAt = new Date().toISOString();
        state.lastError = null;
      }
    } catch (error) {
      if (state) state.lastError = error.message;
      if (error.permanent || item.attempt_count >= 5) {
        await pgQuery(
          `UPDATE studio_notification_outbox
           SET status = 'dead_letter',
               last_error = $2,
               locked_at = NULL,
               locked_by = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [item.id, error.message]
        );
      } else {
        const delay = calculateBackoff({ attempt: item.attempt_count, baseSeconds: 30, maxSeconds: 3600 });
        await pgQuery(
          `UPDATE studio_notification_outbox
           SET status = 'retry_wait',
               next_attempt_at = $2,
               last_error = $3,
               locked_at = NULL,
               locked_by = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [item.id, new Date(Date.now() + delay * 1000), error.message]
        );
      }
    }
  }
}
