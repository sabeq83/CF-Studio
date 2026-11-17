import { generateImage, generateProductPhotoWithOpenAI, getTaskStatus, getFileUrl } from '../webhook-client.js';
import { getSetting } from '../db.js';

export async function generateWithGlabs({ referenceImage, prompt, tenantId, engine = null }) {
  if (engine === 'gpt_image_2') {
    const response = await generateProductPhotoWithOpenAI({ referenceImage, prompt });
    if (!response?.task_id) throw new Error('G-Labs (GPT) tidak mengembalikan task_id');
    return { mode: 'async', provider: 'glabs', model: 'gpt_image_2', taskId: response.task_id };
  }

  let model = null;
  try {
    model = await getSetting('product_photo_glabs_model');
    if (!model) model = await getSetting('webhook_image_model');
  } catch (e) {}
  
  const response = await generateImage({
    prompt,
    model: model || undefined,
    aspect_ratio: '1:1',
    reference_images: referenceImage ? [referenceImage] : undefined
  });
  
  if (!response?.task_id) throw new Error('G-Labs tidak mengembalikan task_id');
  return {
    mode: 'async',
    provider: 'glabs',
    model: response?.effective_model || 'nano_banana',
    taskId: response.task_id
  };
}

export async function pollGlabsPhotoTask(taskId) {
  const statusResult = await getTaskStatus(taskId);
  const status = (statusResult?.status || '').toLowerCase();
  
  if (status === 'completed') {
    const files = statusResult.results || statusResult.files || [];
    let imageFile = files.find(f => /\.(png|jpe?g|webp)$/i.test(f)) || files[0];
    
    if (!imageFile) throw new Error('G-Labs task selesai tapi tidak ada file gambar');
    
    if (imageFile.startsWith('http://') || imageFile.startsWith('https://')) {
      imageFile = imageFile.split('/').pop();
    }
    
    const downloadUrl = getFileUrl(imageFile, taskId);
    const res = await fetch(downloadUrl);
    
    if (!res.ok) throw new Error(`Gagal download dari G-Labs: ${res.status}`);
    
    const imageBuffer = Buffer.from(await res.arrayBuffer());
    const mimeType = res.headers.get('content-type') || 'image/png';
    return { completed: true, imageBuffer, mimeType };
  }
  
  if (status === 'failed') {
    return {
      completed: false,
      failed: true,
      error: statusResult?.error || statusResult?.error_detail || 'G-Labs task gagal'
    };
  }
  
  return { completed: false, failed: false };
}
