import { Pool } from 'pg';
import { uploadVideoBufferToR2 } from '../lib/cloudflare-r2-client.js';

const pool = new Pool({
  host: '100.78.186.123',
  port: 5432,
  database: 'maknaflow_db',
  user: 'makna_user',
  password: 'maknagridpass'
});

async function run() {
  console.log('--- 1. Mengunduh video MP4 valid dari Nextcloud ---');
  const sourceUrl = 'http://100.78.186.123/index.php/s/fADJDNs97A8CfAQ/download';
  const res = await fetch(sourceUrl, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Gagal mengunduh: HTTP ${res.status}`);
  }
  const ab = await res.arrayBuffer();
  const buffer = Buffer.from(ab);
  console.log(`Berhasil mengunduh: ${buffer.length} bytes (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

  const magic = buffer.slice(4, 8).toString('utf8');
  console.log('Magic bytes (offset 4-8):', magic);
  if (magic !== 'ftyp') {
    throw new Error(`Bukan file video MP4 valid! Header: ${buffer.slice(0, 30).toString('utf8')}`);
  }

  console.log('\n--- 2. Mengunggah ke Cloudflare R2 ---');
  const tenantId = 'default_tenant';

  // Unggah ke key baru dan timpa key lama
  const newKey = `staging/nutribake_mul_s6so1p_01_healed.mp4`;
  const uploadedNew = await uploadVideoBufferToR2({
    buffer,
    key: newKey,
    contentType: 'video/mp4',
    tenantId
  });
  console.log('Uploaded new URL:', uploadedNew.publicUrl);

  const oldKeys = [
    'staging/repliz_pub_1794149982784_f79a0536_1794150485347.mp4',
    'staging/repliz_pub_1794149982792_dae96063_1794150486583.mp4',
    'staging/repliz_pub_1794149982798_586f2241_1794150515260.mp4'
  ];

  for (const k of oldKeys) {
    await uploadVideoBufferToR2({
      buffer,
      key: k,
      contentType: 'video/mp4',
      tenantId
    });
    console.log(`Overwritten old key: ${k}`);
  }

  console.log('\n--- 3. Mengambil kredensial Repliz dari database ---');
  const kRes = await pool.query(`SELECT setting_value FROM staging.tenant_settings WHERE setting_key = 'repliz_access_key' LIMIT 1`);
  const sRes = await pool.query(`SELECT setting_value FROM staging.tenant_settings WHERE setting_key = 'repliz_secret_key' LIMIT 1`);
  const accessKey = kRes.rows[0]?.setting_value;
  const secretKey = sRes.rows[0]?.setting_value;
  const authHeader = 'Basic ' + Buffer.from(`${accessKey}:${secretKey}`).toString('base64');

  const jobsToHeal = [
    { platform: 'facebook', jobId: 'pub_1794149982784_f79a0536', scheduleId: '6af09056030f5e06ecb20b37' },
    { platform: 'instagram', jobId: 'pub_1794149982792_dae96063', scheduleId: '6af090575fcad16015e21549' },
    { platform: 'tiktok', jobId: 'pub_1794149982798_586f2241', scheduleId: '6af09074030f5e06ecb21404' }
  ];

  console.log('\n--- 4. Update database dan trigger update/retry di Repliz ---');
  for (const item of jobsToHeal) {
    console.log(`\nProcessing ${item.platform.toUpperCase()} (${item.jobId})...`);

    // Update URL di database
    await pool.query(`
      UPDATE staging.publishing_jobs
      SET 
        media_url_snapshot = $1,
        status = 'retry_wait',
        last_error_code = NULL,
        last_error_message = NULL,
        next_attempt_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [uploadedNew.publicUrl, item.jobId]);

    // Coba update schedule di Repliz via PUT /public/schedule/{scheduleId}
    try {
      const getScheduleRes = await fetch(`https://api.repliz.com/public/schedule/${item.scheduleId}`, {
        headers: { Authorization: authHeader }
      });
      const currentSchedule = await getScheduleRes.json();

      const putPayload = {
        description: currentSchedule.description || currentSchedule.caption || '',
        type: currentSchedule.type || 'reel',
        medias: [
          {
            alt: '',
            customThumbnail: false,
            type: 'video',
            thumbnail: '',
            url: uploadedNew.publicUrl
          }
        ],
        scheduleAt: new Date(Date.now() + 10000).toISOString()
      };

      const putRes = await fetch(`https://api.repliz.com/public/schedule/${item.scheduleId}`, {
        method: 'PUT',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(putPayload)
      });
      console.log(`PUT schedule status: ${putRes.status}`);
      const putData = await putRes.json();
      console.log('PUT response:', putData);
    } catch (putErr) {
      console.warn(`PUT schedule warning:`, putErr.message);
    }

    // Trigger retry via POST /public/schedule/{scheduleId}/retry
    try {
      const retryRes = await fetch(`https://api.repliz.com/public/schedule/${item.scheduleId}/retry`, {
        method: 'POST',
        headers: { Authorization: authHeader }
      });
      console.log(`Retry status: ${retryRes.status}`);
      const retryData = await retryRes.json();
      console.log('Retry response:', retryData);
    } catch (retryErr) {
      console.warn(`Retry warning:`, retryErr.message);
    }
  }

  console.log('\n--- 5. Selesai ---');
  await pool.end();
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
