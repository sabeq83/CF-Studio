import { pgQuery } from './db-pg.js';
import { getSetting } from './db.js';
import { 
  listMonitoringKeywords, 
  saveDiscoveredPostsBatch, 
  getRadarSchedule,
  updateRadarScheduleRunTimes 
} from './threads-affiliate-repository.js';
import { 
  listReplizAccounts, 
  searchReplizThreadsContent, 
  redactCredentials 
} from './repliz-client.js';
import { processDiscoveredThreadsPosts } from './threads-affiliate-matcher.js';

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/**
 * Mendapatkan informasi waktu saat ini di zona waktu Asia/Jakarta (WIB)
 */
export function getWibTimeContext(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const map = {};
  parts.forEach(p => { map[p.type] = p.value; });

  const dateStr = `${map.year}-${map.month}-${map.day}`;
  const timeStr = `${map.hour}:${map.minute}`;

  // Hari ke-0 = Minggu, ke-1 = Senin, dst.
  const dt = new Date(`${dateStr}T${timeStr}:00+07:00`);
  const dayIndex = dt.getDay();
  const dayName = DAY_NAMES[dayIndex];

  return { dateStr, timeStr, dayIndex, dayName, now };
}

/**
 * Mengambil kredensial Repliz dari pengaturan database
 */
export async function getReplizCredentials(tenantId = 'default_tenant') {
  let url = (await getSetting('repliz_api_url')) || process.env.REPLIZ_API_URL || 'https://api.repliz.com';
  let accessKey = await getSetting('repliz_access_key') || process.env.REPLIZ_ACCESS_KEY;
  let secretKey = await getSetting('repliz_secret_key') || process.env.REPLIZ_SECRET_KEY;

  if (!accessKey || !secretKey) {
    try {
      const res = await pgQuery(
        `SELECT setting_key, setting_value FROM (
           SELECT setting_key, setting_value, tenant_id FROM tenant_settings
           UNION ALL
           SELECT setting_key, setting_value, tenant_id FROM staging.tenant_settings
         ) s
         WHERE setting_key IN ('repliz_access_key', 'repliz_secret_key', 'repliz_api_url')
         ORDER BY CASE 
           WHEN tenant_id = $1 THEN 1 
           WHEN tenant_id = 'tnt_pt-gim-sosmed_62d0d9' THEN 2 
           ELSE 3 
         END`,
        [tenantId]
      );
      for (const row of res.rows) {
        if (row.setting_key === 'repliz_access_key' && !accessKey) accessKey = row.setting_value;
        if (row.setting_key === 'repliz_secret_key' && !secretKey) secretKey = row.setting_value;
        if (row.setting_key === 'repliz_api_url' && !url) url = row.setting_value;
      }
    } catch (err) {
      console.warn('[Threads Scheduler] Warning querying tenant_settings:', err.message);
    }
  }

  return { apiUrl: url, accessKey, secretKey };
}

/**
 * Mengambil akun Threads aktif yang terdaftar di Repliz
 */
export async function getActiveThreadsAccount(credentials) {
  const accounts = await listReplizAccounts(credentials);
  const threadsAcc = accounts.find(a => (a.type === 'threads' || a.platform === 'threads') && a.status === 'active')
    || accounts.find(a => (a.type === 'threads' || a.platform === 'threads'));
  return threadsAcc || null;
}

/**
 * Menghitung waktu eksekusi jadwal berikutnya
 */
export function computeNextRunTime(scheduleConfig, now = new Date()) {
  const { is_active, schedule_mode, active_days, specific_hours, interval_hours, range_start, range_end } = scheduleConfig;
  if (!is_active || !Array.isArray(active_days) || active_days.length === 0) return null;

  const wib = getWibTimeContext(now);

  if (schedule_mode === 'specific') {
    const hours = (Array.isArray(specific_hours) ? specific_hours : [])
      .map(h => String(h).replace(' WIB', '').trim())
      .filter(Boolean)
      .sort();

    if (hours.length === 0) return null;

    // Cek apakah ada slot tersisa hari ini
    if (active_days.includes(wib.dayName)) {
      for (const h of hours) {
        if (h > wib.timeStr) {
          return new Date(`${wib.dateStr}T${h}:00+07:00`);
        }
      }
    }

    // Jika tidak ada sisa hari ini, cari hari aktif berikutnya
    for (let d = 1; d <= 7; d++) {
      const nextDt = new Date(now.getTime() + d * 86400000);
      const nextWib = getWibTimeContext(nextDt);
      if (active_days.includes(nextWib.dayName)) {
        return new Date(`${nextWib.dateStr}T${hours[0]}:00+07:00`);
      }
    }
  } else {
    // Mode Interval
    const intHours = parseInt(interval_hours, 10) || 3;
    const nextTimestamp = now.getTime() + intHours * 3600000;
    return new Date(nextTimestamp);
  }

  return null;
}

/**
 * Memeriksa apakah jadwal harus dieksekusi pada menit saat ini
 */
export function shouldRunScheduleNow(scheduleConfig, now = new Date()) {
  if (!scheduleConfig || !scheduleConfig.is_active) return false;

  const { active_days, schedule_mode, specific_hours, interval_hours, range_start, range_end, last_run_at } = scheduleConfig;
  if (!Array.isArray(active_days) || active_days.length === 0) return false;

  const wib = getWibTimeContext(now);

  // Pastikan hari ini adalah salah satu hari aktif
  if (!active_days.includes(wib.dayName)) return false;

  if (schedule_mode === 'specific') {
    const hours = (Array.isArray(specific_hours) ? specific_hours : [])
      .map(h => String(h).replace(' WIB', '').trim());

    // Cek apakah waktu sekarang (HH:mm) cocok dengan salah satu jam spesifik
    const matchesCurrentHour = hours.includes(wib.timeStr);
    if (!matchesCurrentHour) return false;

    // Cek apakah sudah pernah berjalan dalam 10 menit terakhir untuk menghindari double execution
    if (last_run_at) {
      const lastRun = new Date(last_run_at);
      const diffMinutes = (now.getTime() - lastRun.getTime()) / 60000;
      if (diffMinutes < 10) return false;
    }

    return true;
  } else {
    // Mode Interval: Periksa rentang jam aktif
    const start = range_start || '07:00';
    const end = range_end || '22:00';
    if (wib.timeStr < start || wib.timeStr > end) return false;

    if (!last_run_at) return true;

    const intHours = parseInt(interval_hours, 10) || 3;
    const lastRun = new Date(last_run_at);
    const diffHours = (now.getTime() - lastRun.getTime()) / 3600000;
    return diffHours >= (intHours - 0.05); // toleransi 3 menit
  }
}

/**
 * Menjalankan satu siklus penuh pemindaian radar kata kunci:
 * 1. Baca kata kunci aktif
 * 2. Search ke Repliz Threads API
 * 3. Simpan ke threads_discovered_posts
 * 4. Panggil Gemini AI Cognitive Matcher (Agen 2) untuk mencocokkan produk Shopee
 * 5. Update waktu eksekusi jadwal
 */
export async function executeRadarScanCycle(tenantId = 'default_tenant', options = {}) {
  const startTime = Date.now();
  console.log(`[Threads Radar Scheduler] Memulai siklus pemindaian untuk tenant ${tenantId}...`);

  // 1. Ambil kata kunci pemantau yang aktif
  const keywords = await listMonitoringKeywords(tenantId);
  const activeKeywords = keywords.filter(k => k.is_active);

  if (activeKeywords.length === 0) {
    console.log(`[Threads Radar Scheduler] Tidak ada kata kunci aktif untuk dipantau.`);
    return { success: true, message: 'Tidak ada kata kunci aktif', keywordsChecked: 0, postsFound: 0, draftsCreated: 0 };
  }

  // 2. Ambil kredensial Repliz & akun Threads aktif
  const credentials = await getReplizCredentials(tenantId);
  if (!credentials.accessKey || !credentials.secretKey) {
    throw new Error('Kredensial Repliz belum dikonfigurasi.');
  }

  const threadsAccount = await getActiveThreadsAccount(credentials);
  if (!threadsAccount) {
    throw new Error('Tidak ditemukan akun Threads aktif yang terhubung di Repliz.');
  }

  console.log(`[Threads Radar Scheduler] Menggunakan akun Threads @${threadsAccount.username || threadsAccount.id}`);

  let totalPostsFound = 0;
  const keywordResults = [];

  // 3. Pindai tiap kata kunci ke Repliz API
  for (const kw of activeKeywords) {
    try {
      console.log(`[Threads Radar Scheduler] Memindai kata kunci: "${kw.keyword}"...`);
      const searchRes = await searchReplizThreadsContent(credentials, {
        accountId: threadsAccount.id,
        search: kw.keyword,
        sort: 'RECENT',
        mode: 'KEYWORD'
      });

      const items = Array.isArray(searchRes) ? searchRes : (searchRes?.data || searchRes?.items || []);
      console.log(`[Threads Radar Scheduler] Ditemukan ${items.length} postingan untuk "${kw.keyword}".`);

      if (items.length > 0) {
        const saved = await saveDiscoveredPostsBatch(tenantId, kw.id, items);
        totalPostsFound += saved.length;
      }

      keywordResults.push({ keyword: kw.keyword, count: items.length });
    } catch (err) {
      console.warn(`[Threads Radar Scheduler] Gagal memindai keyword "${kw.keyword}":`, redactCredentials(err.message));
    }
  }

  // 4. Jalankan AI Cognitive Matcher (Agen 2) untuk meracik draf balasan
  console.log(`[Threads Radar Scheduler] Memicu Agen 2 Cognitive Matcher...`);
  const matchResult = await processDiscoveredThreadsPosts(tenantId, { limit: 10 });
  const draftsCreated = matchResult.draftsCreated || 0;

  // 5. Update waktu eksekusi jadwal
  const now = new Date();
  const scheduleConfig = await getRadarSchedule(tenantId);
  const nextRun = computeNextRunTime(scheduleConfig, now);

  await updateRadarScheduleRunTimes(tenantId, {
    lastRunAt: now,
    nextRunAt: nextRun
  });

  const durationMs = Date.now() - startTime;
  console.log(`[Threads Radar Scheduler] Siklus selesai dalam ${durationMs}ms: ${activeKeywords.length} kata kunci, ${totalPostsFound} post baru, ${draftsCreated} draf AI.`);

  return {
    success: true,
    keywordsChecked: activeKeywords.length,
    postsFound: totalPostsFound,
    draftsCreated,
    nextRunAt: nextRun ? nextRun.toISOString() : null,
    durationMs,
    keywordResults
  };
}

/**
 * Worker tick untuk scheduler background (dapat dipanggil secara periodik oleh cron)
 */
export async function tickThreadsRadarScheduler(tenantId = 'default_tenant') {
  try {
    const schedule = await getRadarSchedule(tenantId);
    if (!schedule || !schedule.is_active) return;

    const shouldRun = shouldRunScheduleNow(schedule);
    if (shouldRun) {
      console.log(`[Threads Radar Scheduler Tick] Waktu eksekusi terpenuhi untuk tenant ${tenantId}. Menjalankan siklus...`);
      await executeRadarScanCycle(tenantId);
    }
  } catch (err) {
    console.warn(`[Threads Radar Scheduler Tick Error]:`, redactCredentials(err.message));
  }
}
