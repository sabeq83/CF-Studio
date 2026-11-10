import { pgQuery } from './db-pg.js';
import { generateThreadsSeries } from './threads-series-generator.js';
import { generateImage, getTaskStatus, getFileUrl } from './webhook-client.js';
import { getReplizCredentials } from './threads-radar-scheduler.js';
import { createReplizSchedule, extractReplizScheduleState } from './repliz-client.js';
import fs from 'fs';
import path from 'path';

/**
 * Eksekusi Autonomous Threads Series Pipeline
 * Menggabungkan Gemini AI Single-Pass Utas 5-Part -> G-Labs AI Image (Node 2) -> PostgreSQL -> Repliz Scheduler.
 */
export async function executeAutonomousThreadsSeriesPipeline({
  schedule = {},
  pipelineConfig = {},
  tenantId = 'default_tenant',
  targetPublishIso = null
}) {
  const finalTenantId = tenantId || schedule.tenant_id || 'default_tenant';
  console.log(`[Threads Series Pipeline] Memulai eksekusi untuk tenant: ${finalTenantId}`);

  // 1. Dapatkan Akun Threads yang dipilih
  let targetAccountId = pipelineConfig.account_id || schedule.repliz_account_ids?.[0] || null;
  let targetAccountUsername = pipelineConfig.account_username || null;

  if (!targetAccountId) {
    try {
      const accRes = await pgQuery(
        `SELECT account_id, username FROM threads_connected_accounts 
         WHERE tenant_id = $1 AND is_selected = TRUE 
         LIMIT 1`,
        [finalTenantId]
      );
      if (accRes.rowCount > 0) {
        targetAccountId = accRes.rows[0].account_id;
        targetAccountUsername = accRes.rows[0].username;
      } else {
        const anyAcc = await pgQuery(
          `SELECT account_id, username FROM threads_connected_accounts 
           WHERE tenant_id = $1 
           ORDER BY created_at DESC LIMIT 1`,
          [finalTenantId]
        );
        if (anyAcc.rowCount > 0) {
          targetAccountId = anyAcc.rows[0].account_id;
          targetAccountUsername = anyAcc.rows[0].username;
        }
      }
    } catch (e) {
      console.warn('[Threads Series Pipeline] Warning mengambil akun Threads:', e.message);
    }
  }

  // 2. Tentukan Parameter Konten
  const postObjective = pipelineConfig.post_objective || 'personal_product'; // 'personal_product' | 'affiliate_shopee' | 'pure_organic'
  const visualMode = pipelineConfig.visual_mode === 'none' ? 'none' : 'glabs'; // Hanya 'glabs' atau 'none'

  const generatorOptions = {
    objective: postObjective,
    personalProductName: pipelineConfig.personal_product_name || 'Kamar Deluxe Eksklusif Sasya House Kost',
    personalProductCta: pipelineConfig.personal_product_cta || 'DM @sasyahouse sekarang untuk booking jadwal survei & promo kamar!',
    affiliateProductTitle: pipelineConfig.affiliate_product_title || 'Kasur Busa Orthopedic Anti Sakit Punggung',
    affiliateProductLink: pipelineConfig.affiliate_product_link || 'https://shope.ee/contoh_affiliate',
    pureOrganicTopic: pipelineConfig.pure_organic_topic || 'Cara mengatur kamar kost sempit jadi terasa 2x lebih luas & estetik',
    visualMode: visualMode,
    tenantId: finalTenantId
  };

  console.log(`[Threads Series Pipeline] Generating Series: Objective=${postObjective}, VisualMode=${visualMode}`);
  const seriesResult = await generateThreadsSeries(generatorOptions);

  if (!seriesResult || !Array.isArray(seriesResult.series) || seriesResult.series.length === 0) {
    throw new Error('Gagal menghasilkan rangkaian naskah Utas dari Gemini AI.');
  }

  // 3. Eksekusi G-Labs AI Image Generation jika visualMode === 'glabs'
  let glabsTaskId = null;
  let finalMediaUrl = null;

  if (visualMode === 'glabs' && seriesResult.visual_prompt_t2i) {
    try {
      console.log(`[Threads Series Pipeline] Mengirimkan prompt T2I ke G-Labs Node 2: "${seriesResult.visual_prompt_t2i.slice(0, 80)}..."`);
      const t2iResult = await generateImage({
        prompt: seriesResult.visual_prompt_t2i,
        model: 'nano_banana_2',
        aspect_ratio: '1:1'
      });

      if (t2iResult?.task_id) {
        glabsTaskId = t2iResult.task_id;
        console.log(`[Threads Series Pipeline] G-Labs Task ID: ${glabsTaskId}. Memulai polling hingga selesai...`);

        // Polling loop: maks 60 detik (30 x 2000ms)
        const maxPolls = 30;
        for (let i = 0; i < maxPolls; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const statusRes = await getTaskStatus(glabsTaskId);
          const taskStatus = (statusRes?.status || '').toLowerCase();

          if (taskStatus === 'completed') {
            const files = statusRes.results || statusRes.files || [];
            let imageFile = files.find(f => /\.(png|jpg|jpeg|webp)$/i.test(f)) || files[0];
            if (imageFile) {
              if (imageFile.startsWith('http://') || imageFile.startsWith('https://')) {
                imageFile = imageFile.split('/').pop();
              }
              const downloadUrl = getFileUrl(imageFile, glabsTaskId);
              console.log(`[Threads Series Pipeline] G-Labs selesai! Downloading dari: ${downloadUrl}`);

              // Download dan simpan ke public/uploads/threads_series/
              try {
                const imgRes = await fetch(downloadUrl);
                if (imgRes.ok) {
                  const imgBuf = Buffer.from(await imgRes.arrayBuffer());
                  const filename = `threads_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.png`;
                  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'threads_series');
                  if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                  }
                  const localPath = path.join(uploadDir, filename);
                  fs.writeFileSync(localPath, imgBuf);
                  finalMediaUrl = `/uploads/threads_series/${filename}`;
                  console.log(`[Threads Series Pipeline] Gambar berhasil disimpan: ${finalMediaUrl}`);
                }
              } catch (downloadErr) {
                console.warn('[Threads Series Pipeline] Gagal menyimpan file gambar lokal:', downloadErr.message);
                finalMediaUrl = downloadUrl; // fallback direct URL
              }
            }
            break;
          } else if (taskStatus === 'failed') {
            console.warn(`[Threads Series Pipeline] G-Labs task ${glabsTaskId} reported failed.`);
            break;
          }
        }
      }
    } catch (glabsErr) {
      console.warn('[Threads Series Pipeline] Warning G-Labs generation gagal:', glabsErr.message);
      // Fail-safe: Lanjut postingan sebagai text-only jika G-Labs mengalami error
    }
  }

  // 4. Hitung Waktu Publikasi Target
  const scheduledTime = targetPublishIso || new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // 5. Simpan ke Database (threads_series_posts)
  const part1 = seriesResult.series[0]?.text || '';
  const part2 = seriesResult.series[1]?.text || '';
  const part3 = seriesResult.series[2]?.text || '';
  const part4 = seriesResult.series[3]?.text || '';
  const part5 = seriesResult.series[4]?.text || '';

  const insertRes = await pgQuery(
    `INSERT INTO threads_series_posts (
      tenant_id,
      schedule_id,
      account_id,
      account_username,
      post_objective,
      theme,
      series_count,
      part_1_text,
      part_2_text,
      part_3_text,
      part_4_text,
      part_5_text,
      visual_mode,
      visual_prompt_t2i,
      media_url,
      glabs_task_id,
      status,
      scheduled_at,
      meta
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
    ) RETURNING *`,
    [
      finalTenantId,
      schedule.id || null,
      targetAccountId,
      targetAccountUsername,
      postObjective,
      seriesResult.theme || 'Untangling Life',
      seriesResult.series.length,
      part1,
      part2,
      part3,
      part4,
      part5,
      visualMode,
      seriesResult.visual_prompt_t2i || null,
      finalMediaUrl,
      glabsTaskId,
      'generated',
      scheduledTime,
      JSON.stringify({
        cta_meta: seriesResult.cta_meta,
        series: seriesResult.series,
        generator_options: generatorOptions
      })
    ]
  );

  const createdPost = insertRes.rows[0];
  console.log(`[Threads Series Pipeline] Post record berhasil dibuat di DB. ID: ${createdPost.id}`);

  // 6. Penjadwalan ke Repliz jika Auto Publish diaktifkan dan ada targetAccountId
  const autoPublishEnabled = schedule.auto_publish_enabled !== false;
  let replizScheduleId = null;
  let publishStatus = 'generated';
  let publishError = null;

  if (autoPublishEnabled && targetAccountId) {
    try {
      console.log(`[Threads Series Pipeline] Menjadwalkan ke Repliz untuk akun: ${targetAccountId}`);
      const credentials = await getReplizCredentials(finalTenantId);

      if (credentials && credentials.accessKey && credentials.secretKey) {
        // Susun struktur rantai replies
        const replies = [];
        if (part2) replies.push({ description: part2 });
        if (part3) replies.push({ description: part3 });
        if (part4) replies.push({ description: part4 });
        if (part5) replies.push({ description: part5 });

        // Tentukan public media URL jika ada
        let publicMediaUrl = finalMediaUrl;
        if (publicMediaUrl && publicMediaUrl.startsWith('/')) {
          // Bila file lokal, sambungkan dengan host base URL jika tersedia
          const baseUrl = process.env.NEXTAUTH_URL || 'http://100.95.245.55:5010';
          publicMediaUrl = `${baseUrl.replace(/\/+$/, '')}${publicMediaUrl}`;
        }

        const replizPayload = {
          accountId: targetAccountId,
          scheduleAt: scheduledTime,
          type: (visualMode === 'glabs' && publicMediaUrl) ? 'image' : 'text',
          description: part1,
          topic: '',
          medias: (visualMode === 'glabs' && publicMediaUrl) ? [
            {
              alt: seriesResult.theme || '',
              type: 'image',
              url: publicMediaUrl
            }
          ] : [],
          additionalInfo: {
            isAiGenerated: true,
            isDraft: false,
            collaborators: [],
            products: [],
            tags: [],
            mentions: []
          },
          replies: replies
        };

        const replizRes = await createReplizSchedule(credentials, replizPayload);
        const scheduleState = extractReplizScheduleState(replizRes);
        replizScheduleId = scheduleState.id || String(replizRes?.id || replizRes?._id || '');

        if (replizScheduleId) {
          publishStatus = 'scheduled';
          await pgQuery(
            `UPDATE threads_series_posts 
             SET repliz_schedule_id = $1, status = $2, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $3`,
            [replizScheduleId, publishStatus, createdPost.id]
          );
          console.log(`[Threads Series Pipeline] ✅ Berhasil dijadwalkan ke Repliz! Schedule ID: ${replizScheduleId}`);
        }
      } else {
        console.warn('[Threads Series Pipeline] Kredensial Repliz tidak ditemukan, postingan tetap tersimpan sebagai draft.');
      }
    } catch (schedErr) {
      console.error('[Threads Series Pipeline] Gagal menjadwalkan ke Repliz:', schedErr.message);
      publishError = schedErr.message;
      await pgQuery(
        `UPDATE threads_series_posts 
         SET error_log = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [publishError, createdPost.id]
      );
    }
  }

  return {
    success: true,
    post_id: createdPost.id,
    theme: seriesResult.theme,
    status: publishStatus,
    repliz_schedule_id: replizScheduleId,
    scheduled_at: scheduledTime,
    visual_mode: visualMode,
    media_url: finalMediaUrl,
    series: seriesResult.series,
    cta_meta: seriesResult.cta_meta,
    error: publishError
  };
}
