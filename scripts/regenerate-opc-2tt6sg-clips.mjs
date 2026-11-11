import fs from 'fs';
import path from 'path';
import { getPgPool } from '../lib/db-pg.js';
import { generateImage, getTaskStatus, getTaskResult, getFileUrl } from '../lib/webhook-client.js';

const ITEM_ID = 2089;
const CAMPAIGN_ID = 'opc_261111_2tt6sg';

const CLIP_1_NEW_PROMPT = `[CAMERA FRAMING: Strict neck-down POV close-up cropped tightly below chest, hands only, head and face 100% out of frame] (VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: OPTICS] (Realistic cinematic film aesthetic, macro 45-degree angled POV close-up cropped below collarbone, shallow depth of field, 8K resolution, 35mm lens). [LAYER 2: CRAFT & WORKSPACE TRUTH] (Biometric Anchor: POV close-up framing focusing strictly on female forearms and hands covered down to the wrists in loose-fitting modest sleeves, delicate female hands with smooth Southeast Asian skin tone, camera cropped tightly below chest, head and face 100% out of frame), (Wardrobe: in Mocca, Taupe & Caramel Latte colors, timeless sophisticated neutral colors that are highly versatile and elegant), (Action & Craft: POV close-up focusing strictly on hands typing on a laptop keyboard at a cozy wooden desk, hands resting calmly beside the trackpad, strictly hands and workspace only, head and face 100% out of frame), (Texture: sleek laptop aluminum, warm wooden desk grain, soft knit sleeve hem), (Geometric Truth: strictly no product shown, strictly no bottle, jar, or packaging). [LAYER 3: SCENE & LIGHT] (Environment: Cozy indoor workspace beside rain-streaked window glass), (Lighting: illuminated by soft natural daylight coming from a side window, realistic soft-shadow roll-off, clean highlights, Natural diffused daylight from rainy window blended with warm 2800K indoor accent lamp, creating cozy comforting atmosphere.).`;

const CLIP_2_NEW_PROMPT = `[CAMERA FRAMING: Strict 180-degree rear shot positioned directly behind subject's back, subject completely facing away toward the window/background, zero facial profile, zero visible eyes/nose/mouth] (VERTICAL 9:16) --ar 9:16 --no landscape [LAYER 1: OPTICS] (Atmospheric cinematic 180-degree direct rear view from behind, camera positioned behind subject looking over the shoulder toward rain-streaked glass, 35mm lens, 8K resolution). [LAYER 2: CRAFT & WORKSPACE TRUTH] (Biometric Anchor: Strict 180-degree rear view positioned directly behind subject's back, modest Muslimah in wide flowing khimar and loose abaya completely facing away towards background, 100% zero facial features, zero side profile, camera looks over shoulder towards the window), (Wardrobe: in Mocca, Taupe & Caramel Latte colors, timeless sophisticated neutral colors that are highly versatile and elegant), (Action & Craft: Strict 180-degree rear view from behind subject, completely facing away towards the window, two hands holding a steaming ceramic mug at chest level looking out at the rainy night, back of head covered in wide khimar facing 100% away from camera, zero facial features visible), (Texture: ceramic glaze, gentle rising steam, window raindrops bokeh, rich fabric drape). [LAYER 3: SCENE & LIGHT] (Environment: Cozy indoor living room with rain droplets outdoor bokeh), (Lighting: illuminated by soft natural daylight coming from a side window, realistic soft-shadow roll-off, clean highlights, Natural diffused daylight from rainy window blended with warm 2800K indoor accent lamp, creating cozy comforting atmosphere.).`;

async function main() {
  console.log(`[Regenerate] Starting start-frame regeneration for item ${ITEM_ID} (${CAMPAIGN_ID})...`);

  const pool = getPgPool();
  const searchPath = process.env.PG_SEARCH_PATH || 'staging';
  const client = await pool.connect();

  try {
    await client.query(`SET search_path TO ${searchPath}`);

    // Fetch webhook settings for default_tenant
    const settingsRes = await client.query(
      `SELECT setting_key, setting_value FROM tenant_settings WHERE tenant_id = 'default_tenant' AND setting_key IN ('webhook_host', 'webhook_port', 'webhook_api_key')`
    );
    const settingsMap = new Map(settingsRes.rows.map(r => [r.setting_key, r.setting_value]));
    const webhookOverride = {
      webhook_host: settingsMap.get('webhook_host') || '100.64.70.61',
      webhook_port: settingsMap.get('webhook_port') || '8765',
      webhook_api_key: settingsMap.get('webhook_api_key')
    };

    console.log(`[Regenerate] Using Webhook Override: ${webhookOverride.webhook_host}:${webhookOverride.webhook_port}`);

    const itemRes = await client.query('SELECT * FROM pillar_campaign_items WHERE id = $1', [ITEM_ID]);
    if (!itemRes.rows.length) {
      throw new Error(`Item ${ITEM_ID} not found in ${searchPath}.pillar_campaign_items`);
    }
    const item = itemRes.rows[0];
    const plan = JSON.parse(item.new_video_plan_json || '[]');
    let currentImages = JSON.parse(item.t2i_images_json || '[]');

    console.log(`[Regenerate] Found item with ${plan.length} clips. Current revision: ${item.start_frame_revision || 1}`);

    // Update prompts in new_video_plan_json
    for (const clip of plan) {
      if (Number(clip.clip_index) === 1) {
        clip.t2i_prompt = CLIP_1_NEW_PROMPT;
      } else if (Number(clip.clip_index) === 2) {
        clip.t2i_prompt = CLIP_2_NEW_PROMPT;
      }
    }

    const tasksToRun = [
      { clipIndex: 1, prompt: CLIP_1_NEW_PROMPT, existingTaskId: '9e3ee6b2' },
      { clipIndex: 2, prompt: CLIP_2_NEW_PROMPT }
    ];

    const results = [];

    for (const task of tasksToRun) {
      let taskId = task.existingTaskId || null;
      let completed = false;
      let finalResult = null;

      if (taskId) {
        console.log(`\n[Regenerate] Checking existing task for Clip ${task.clipIndex}: ${taskId}...`);
        try {
          const statusRes = await getTaskStatus(taskId);
          if (statusRes.status === 'completed' || statusRes.status === 'succeeded' || statusRes.task_status === 'SUCCESS') {
            completed = true;
            finalResult = statusRes;
            console.log(`[Regenerate] Existing task ${taskId} is completed!`);
          }
        } catch (e) {
          console.warn(`[Regenerate] Could not reuse ${taskId}: ${e.message}. Will submit fresh task.`);
          taskId = null;
          completed = false;
        }
      }

      if (!completed) {
        console.log(`\n[Regenerate] Dispatching Clip ${task.clipIndex} to G-Labs...`);
        const genRes = await generateImage({
          prompt: task.prompt,
          model: 'nano_banana_2',
          aspect_ratio: '9:16',
          webhookOverride
        });

        taskId = genRes.task_id;
        console.log(`[Regenerate] Task dispatched: ${taskId}. Polling for completion...`);

        let attempts = 0;
        while (!completed && attempts < 60) {
          await new Promise(r => setTimeout(r, 4000));
          attempts++;
          const statusRes = await getTaskStatus(taskId);
          const status = statusRes.status || statusRes.task_status;
          process.stdout.write(`.`);

          if (status === 'completed' || status === 'succeeded' || status === 'SUCCESS') {
            completed = true;
            finalResult = statusRes;
            console.log(`\n[Regenerate] Clip ${task.clipIndex} completed!`);
            break;
          } else if (status === 'failed' || status === 'ERROR') {
            throw new Error(`Clip ${task.clipIndex} generation failed: ${statusRes.error || 'Unknown error'}`);
          }
        }
      }

      if (!completed) {
        throw new Error(`Clip ${task.clipIndex} timed out after polling.`);
      }

      // Fetch task result to obtain filename
      const resultData = await getTaskResult(taskId);
      const files = resultData?.files || resultData?.results || finalResult?.files || [];
      const imageFile = files.find(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.webp')) || files[0];
      if (!imageFile) throw new Error(`Clip ${task.clipIndex} did not return any image file. Result: ${JSON.stringify(resultData)}`);

      const downloadUrl = imageFile.startsWith('http') ? imageFile : getFileUrl(imageFile, taskId);
      console.log(`[Regenerate] Downloading Clip ${task.clipIndex} from ${downloadUrl}...`);

      const imgRes = await fetch(downloadUrl);
      if (!imgRes.ok) throw new Error(`Failed to download image from ${downloadUrl}: ${imgRes.statusText}`);
      const arrayBuffer = await imgRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const targetDir = path.join(process.cwd(), 'public', 'uploads', 'start_frames');
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

      const hashStr = Math.random().toString(16).slice(2, 10);
      const filename = `opc_start_frame_${ITEM_ID}_clip_${task.clipIndex}_r2_${hashStr}.jpg`;
      const localFilePath = path.join(targetDir, filename);
      fs.writeFileSync(localFilePath, buffer);

      const relativeUrl = `/uploads/start_frames/${filename}`;
      console.log(`[Regenerate] Saved Clip ${task.clipIndex} to ${localFilePath} (${buffer.length} bytes)`);

      results.push({
        clipIndex: task.clipIndex,
        filename,
        relativeUrl,
        localFilePath,
        buffer
      });
    }

    // Update images in array
    for (const res of results) {
      currentImages[res.clipIndex - 1] = res.relativeUrl;
    }

    // Persist to Staging database
    await client.query(
      `UPDATE pillar_campaign_items 
       SET new_video_plan_json = $1,
           t2i_images_json = $2,
           start_frame_revision = 2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [JSON.stringify(plan), JSON.stringify(currentImages), ITEM_ID]
    );

    console.log(`\n[Regenerate] Database successfully updated with Revision 2!`);
    console.log(`[Regenerate] Updated t2i_images_json:`, currentImages);

    return results;
  } finally {
    client.release();
    await pool.end();
  }
}

main().then(res => {
  console.log('[Regenerate] All done successfully!');
  process.exit(0);
}).catch(err => {
  console.error('[Regenerate] Fatal error:', err);
  process.exit(1);
});
