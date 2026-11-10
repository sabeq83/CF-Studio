import { pgQuery } from './db-pg.js';

/**
 * Repository untuk Threads Affiliate Intelligence & Auto-Reply Engine (TAIRE)
 */

export async function listMonitoringKeywords(tenantId = 'default_tenant') {
  const sql = `
    SELECT * FROM threads_monitoring_keywords
    WHERE tenant_id = $1
    ORDER BY created_at DESC
  `;
  const res = await pgQuery(sql, [tenantId]);
  return res.rows;
}

export async function addMonitoringKeyword(tenantId = 'default_tenant', { keyword, category = 'general', intervalMinutes = 30 }) {
  const cleanKeyword = String(keyword || '').trim();
  if (!cleanKeyword) throw new Error('Kata kunci tidak boleh kosong');

  const sql = `
    INSERT INTO threads_monitoring_keywords (tenant_id, keyword, category, check_interval_minutes, is_active)
    VALUES ($1, $2, $3, $4, true)
    ON CONFLICT (tenant_id, keyword) DO UPDATE
    SET is_active = true, category = EXCLUDED.category
    RETURNING *
  `;
  const res = await pgQuery(sql, [tenantId, cleanKeyword, category, intervalMinutes]);
  return res.rows[0];
}

export async function toggleMonitoringKeyword(tenantId = 'default_tenant', id) {
  const sql = `
    UPDATE threads_monitoring_keywords
    SET is_active = NOT is_active
    WHERE tenant_id = $1 AND id = $2
    RETURNING *
  `;
  const res = await pgQuery(sql, [tenantId, id]);
  return res.rows[0] || null;
}

export async function deleteMonitoringKeyword(tenantId = 'default_tenant', id) {
  const sql = `
    DELETE FROM threads_monitoring_keywords
    WHERE tenant_id = $1 AND id = $2
    RETURNING id
  `;
  const res = await pgQuery(sql, [tenantId, id]);
  return Boolean(res.rowCount);
}

export async function saveDiscoveredPostsBatch(tenantId = 'default_tenant', keywordId, posts = []) {
  if (!Array.isArray(posts) || posts.length === 0) return [];

  const saved = [];
  for (const post of posts) {
    const threadId = String(post.id || post.thread_id || '');
    if (!threadId) continue;

    const postUrl = post.url || `https://www.threads.net/post/${threadId}`;
    const authorUsername = post.owner?.username || post.author_username || '';
    const authorName = post.owner?.name || post.author_name || '';
    const authorAvatar = post.owner?.picture || post.author_avatar_url || null;
    const postContent = post.description || post.text || post.post_content || '';
    const publishedAt = post.createdAt ? new Date(post.createdAt) : new Date();

    const sql = `
      INSERT INTO threads_discovered_posts (
        tenant_id, keyword_id, thread_id, post_url,
        author_username, author_name, author_avatar_url,
        post_content, post_published_at, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending_analysis')
      ON CONFLICT (tenant_id, thread_id) DO NOTHING
      RETURNING *
    `;

    try {
      const res = await pgQuery(sql, [
        tenantId,
        keywordId || null,
        threadId,
        postUrl,
        authorUsername,
        authorName,
        authorAvatar,
        postContent,
        publishedAt
      ]);
      if (res.rows[0]) saved.push(res.rows[0]);
    } catch (err) {
      console.warn(`[Threads Repo] Skip saving post ${threadId}:`, err.message);
    }
  }
  return saved;
}

export async function listPendingAnalysisPosts(tenantId = 'default_tenant', limit = 20) {
  const sql = `
    SELECT p.*, k.keyword as source_keyword
    FROM threads_discovered_posts p
    LEFT JOIN threads_monitoring_keywords k ON p.keyword_id = k.id
    WHERE p.tenant_id = $1 AND p.status = 'pending_analysis'
    ORDER BY p.post_published_at DESC
    LIMIT $2
  `;
  const res = await pgQuery(sql, [tenantId, limit]);
  return res.rows;
}

export async function saveReplyDraft(tenantId = 'default_tenant', draftData) {
  const {
    discovered_post_id,
    matched_product_id,
    reply_text,
    reply_strategy = 'soft_in_bio',
    product_image_url,
    shopee_affiliate_url,
    ai_confidence_score = 80,
    ai_intent_category = 'general'
  } = draftData;

  const sql = `
    INSERT INTO threads_reply_drafts (
      tenant_id, discovered_post_id, matched_product_id,
      reply_text, reply_strategy, product_image_url,
      shopee_affiliate_url, ai_confidence_score, ai_intent_category,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft')
    RETURNING *
  `;

  const res = await pgQuery(sql, [
    tenantId,
    discovered_post_id,
    matched_product_id,
    reply_text,
    reply_strategy,
    product_image_url,
    shopee_affiliate_url,
    ai_confidence_score,
    ai_intent_category
  ]);

  // Update status postingan asal menjadi 'drafted'
  await pgQuery(
    `UPDATE threads_discovered_posts SET status = 'drafted' WHERE tenant_id = $1 AND id = $2`,
    [tenantId, discovered_post_id]
  );

  return res.rows[0];
}

export async function listOpportunities(tenantId = 'default_tenant', { status = 'all', limit = 50 } = {}) {
  const conditions = ['p.tenant_id = $1'];
  const params = [tenantId];
  let paramIdx = 2;

  if (status && status !== 'all') {
    conditions.push(`d.status = $${paramIdx++}`);
    params.push(status);
  }

  const whereClause = conditions.join(' AND ');

  const sql = `
    SELECT 
      d.id as draft_id,
      d.reply_text,
      d.reply_strategy,
      d.product_image_url,
      d.shopee_affiliate_url,
      d.ai_confidence_score,
      d.ai_intent_category,
      d.status as draft_status,
      d.reviewed_at,
      p.id as post_id,
      p.thread_id,
      p.post_url,
      p.author_username,
      p.author_name,
      p.author_avatar_url,
      p.post_content,
      p.post_published_at,
      k.keyword as keyword_tag,
      COALESCE(pr.product_name, 'Produk Shopee') as product_name,
      '0' as product_price
    FROM threads_reply_drafts d
    JOIN threads_discovered_posts p ON d.discovered_post_id = p.id
    LEFT JOIN threads_monitoring_keywords k ON p.keyword_id = k.id
    LEFT JOIN products pr ON d.matched_product_id = pr.id
    WHERE ${whereClause}
    ORDER BY d.created_at DESC
    LIMIT $${paramIdx}
  `;
  params.push(limit);

  const res = await pgQuery(sql, params);
  return res.rows;
}

export const listOpportunitiesWithProducts = listOpportunities;

export async function updateDraftStatus(tenantId = 'default_tenant', draftId, newStatus, reviewer = 'admin') {
  const sql = `
    UPDATE threads_reply_drafts
    SET status = $3, reviewed_by = $4, reviewed_at = CURRENT_TIMESTAMP
    WHERE tenant_id = $1 AND id = $2
    RETURNING *
  `;
  const res = await pgQuery(sql, [tenantId, draftId, newStatus, reviewer]);
  return res.rows[0] || null;
}

export async function logExecutionOutcome(tenantId = 'default_tenant', logData) {
  const {
    reply_draft_id,
    repliz_account_id,
    repliz_comment_id,
    delay_applied_seconds = 0,
    status,
    error_message = null
  } = logData;

  const sql = `
    INSERT INTO threads_execution_logs (
      tenant_id, reply_draft_id, repliz_account_id,
      repliz_comment_id, delay_applied_seconds, status, error_message
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  const res = await pgQuery(sql, [
    tenantId,
    reply_draft_id,
    repliz_account_id,
    repliz_comment_id,
    delay_applied_seconds,
    status,
    error_message
  ]);

  if (status === 'success') {
    await updateDraftStatus(tenantId, reply_draft_id, 'posted');
  } else {
    await updateDraftStatus(tenantId, reply_draft_id, 'failed');
  }

  return res.rows[0];
}

/**
 * Update isi teks naskah balasan draf sebelum disetujui
 */
export async function updateDraftText(tenantId = 'default_tenant', draftId, newText) {
  const sql = `
    UPDATE threads_reply_drafts
    SET reply_text = $3
    WHERE tenant_id = $1 AND id = $2
    RETURNING *
  `;
  const res = await pgQuery(sql, [tenantId, draftId, newText]);
  return res.rows[0] || null;
}

/**
 * Mengambil konfigurasi jadwal pemindaian radar untuk tenant tertentu
 */
export async function getRadarSchedule(tenantId = 'default_tenant') {
  const sql = `
    SELECT * FROM threads_radar_schedules 
    WHERE tenant_id = $1 
    ORDER BY created_at ASC 
    LIMIT 1
  `;
  const res = await pgQuery(sql, [tenantId]);
  if (res.rows.length > 0) return res.rows[0];

  // Inisialisasi default schedule jika belum ada
  const insertSql = `
    INSERT INTO threads_radar_schedules (
      tenant_id, name, is_active, schedule_mode, active_days, specific_hours, interval_hours, range_start, range_end
    )
    VALUES (
      $1, 'Default Radar Schedule', true, 'specific',
      ARRAY['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'],
      ARRAY['08:00','12:30','17:00','20:30'],
      3, '07:00', '22:00'
    )
    ON CONFLICT (tenant_id, name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  const insertRes = await pgQuery(insertSql, [tenantId]);
  return insertRes.rows[0];
}

/**
 * Menyimpan / memperbarui konfigurasi jadwal pemindaian radar
 */
export async function saveRadarSchedule(tenantId = 'default_tenant', config = {}) {
  const {
    is_active = true,
    schedule_mode = 'specific',
    active_days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'],
    specific_hours = ['08:00', '12:30', '17:00', '20:30'],
    interval_hours = 3,
    range_start = '07:00',
    range_end = '22:00',
    selected_account_id = undefined,
    selected_account_username = undefined,
    next_run_at = null
  } = config;

  const sql = `
    INSERT INTO threads_radar_schedules (
      tenant_id, name, is_active, schedule_mode, active_days, specific_hours,
      interval_hours, range_start, range_end, selected_account_id, selected_account_username, next_run_at, updated_at
    )
    VALUES ($1, 'Default Radar Schedule', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
    ON CONFLICT (tenant_id, name) DO UPDATE SET
      is_active = EXCLUDED.is_active,
      schedule_mode = EXCLUDED.schedule_mode,
      active_days = EXCLUDED.active_days,
      specific_hours = EXCLUDED.specific_hours,
      interval_hours = EXCLUDED.interval_hours,
      range_start = EXCLUDED.range_start,
      range_end = EXCLUDED.range_end,
      selected_account_id = COALESCE(EXCLUDED.selected_account_id, threads_radar_schedules.selected_account_id),
      selected_account_username = COALESCE(EXCLUDED.selected_account_username, threads_radar_schedules.selected_account_username),
      next_run_at = COALESCE(EXCLUDED.next_run_at, threads_radar_schedules.next_run_at),
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  const res = await pgQuery(sql, [
    tenantId,
    Boolean(is_active),
    schedule_mode,
    active_days,
    specific_hours,
    parseInt(interval_hours, 10) || 3,
    range_start,
    range_end,
    selected_account_id !== undefined ? selected_account_id : null,
    selected_account_username !== undefined ? selected_account_username : null,
    next_run_at
  ]);
  return res.rows[0];
}

/**
 * Memperbarui waktu eksekusi terakhir & waktu eksekusi berikutnya
 */
export async function updateRadarScheduleRunTimes(tenantId = 'default_tenant', { lastRunAt, nextRunAt }) {
  const sql = `
    UPDATE threads_radar_schedules
    SET last_run_at = COALESCE($2, last_run_at),
        next_run_at = COALESCE($3, next_run_at),
        updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = $1
    RETURNING *
  `;
  const res = await pgQuery(sql, [tenantId, lastRunAt || null, nextRunAt || null]);
  return res.rows[0] || null;
}

/**
 * Mengambil daftar akun Threads yang tersinkronisasi untuk tenant tertentu
 */
export async function listConnectedThreadsAccounts(tenantId = 'default_tenant') {
  const sql = `
    SELECT * FROM threads_connected_accounts
    WHERE tenant_id = $1
    ORDER BY is_selected DESC, created_at ASC
  `;
  const res = await pgQuery(sql, [tenantId]);
  return res.rows;
}

/**
 * Menyinkronkan daftar akun Threads dari respon Repliz API ke database
 */
export async function syncConnectedThreadsAccounts(tenantId = 'default_tenant', replizAccounts = []) {
  const threadsAccounts = (Array.isArray(replizAccounts) ? replizAccounts : [])
    .filter(a => (a.type === 'threads' || a.platform === 'threads'));

  // Cek apakah sudah ada akun terpilih sebelumnya
  const scheduleRes = await pgQuery(
    `SELECT selected_account_id FROM threads_radar_schedules WHERE tenant_id = $1 LIMIT 1`,
    [tenantId]
  );
  let selectedAccountId = scheduleRes.rows[0]?.selected_account_id || null;

  for (const acc of threadsAccounts) {
    const accId = acc._id || acc.id;
    const username = acc.username || '';
    const name = acc.name || '';
    const avatarUrl = acc.avatar || acc.picture || acc.profilePicture || null;
    const status = acc.status || 'active';
    const isSelected = selectedAccountId ? (selectedAccountId === accId) : false;

    await pgQuery(`
      INSERT INTO threads_connected_accounts (
        tenant_id, account_id, username, name, avatar_url, status, is_selected, raw_data, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_id, account_id) DO UPDATE SET
        username = EXCLUDED.username,
        name = EXCLUDED.name,
        avatar_url = EXCLUDED.avatar_url,
        status = EXCLUDED.status,
        raw_data = EXCLUDED.raw_data,
        updated_at = CURRENT_TIMESTAMP
    `, [tenantId, accId, username, name, avatarUrl, status, isSelected, JSON.stringify(acc)]);
  }

  // Jika belum ada akun terpilih dan ada akun Threads aktif, jadikan default
  if (!selectedAccountId && threadsAccounts.length > 0) {
    const firstActive = threadsAccounts.find(a => a.status === 'active') || threadsAccounts[0];
    const firstId = firstActive._id || firstActive.id;
    await setSelectedThreadsAccount(tenantId, firstId);
  }

  return await listConnectedThreadsAccounts(tenantId);
}

/**
 * Memilih akun Threads aktif untuk pemantauan radar dan penerbitan komentar
 */
export async function setSelectedThreadsAccount(tenantId = 'default_tenant', accountId) {
  // Ambil detail akun target
  const accRes = await pgQuery(
    `SELECT * FROM threads_connected_accounts WHERE tenant_id = $1 AND account_id = $2`,
    [tenantId, accountId]
  );
  const account = accRes.rows[0];
  if (!account) {
    throw new Error(`Akun Threads dengan ID "${accountId}" tidak ditemukan dalam daftar akun tersinkronisasi.`);
  }

  // Update status is_selected di tabel accounts
  await pgQuery(
    `UPDATE threads_connected_accounts 
     SET is_selected = (account_id = $2), updated_at = CURRENT_TIMESTAMP 
     WHERE tenant_id = $1`,
    [tenantId, accountId]
  );

  // Update di tabel threads_radar_schedules
  await pgQuery(`
    INSERT INTO threads_radar_schedules (tenant_id, name, selected_account_id, selected_account_username, updated_at)
    VALUES ($1, 'Default Radar Schedule', $2, $3, CURRENT_TIMESTAMP)
    ON CONFLICT (tenant_id, name) DO UPDATE SET
      selected_account_id = EXCLUDED.selected_account_id,
      selected_account_username = EXCLUDED.selected_account_username,
      updated_at = CURRENT_TIMESTAMP
  `, [tenantId, account.account_id, account.username]);

  return account;
}

/**
 * Mengambil akun Threads yang saat ini aktif dipilih
 */
export async function getSelectedThreadsAccount(tenantId = 'default_tenant') {
  const scheduleRes = await pgQuery(
    `SELECT selected_account_id, selected_account_username FROM threads_radar_schedules WHERE tenant_id = $1 LIMIT 1`,
    [tenantId]
  );
  const selectedId = scheduleRes.rows[0]?.selected_account_id;
  if (!selectedId) return null;

  const accRes = await pgQuery(
    `SELECT * FROM threads_connected_accounts WHERE tenant_id = $1 AND account_id = $2 LIMIT 1`,
    [tenantId, selectedId]
  );
  return accRes.rows[0] || null;
}

