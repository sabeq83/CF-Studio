import path from 'path';
import fs from 'fs';
import { NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/auth';
import { generateImage, getTaskStatus, getFileUrl } from '@/lib/webhook-client';

export const dynamic = 'force-dynamic';

function requireVisualIdentityAiAccess(user) {
  if (!user) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  const isAllowed = user.role === 'admin' || user.role === 'superadmin' || user.menuPermissions?.includes('operator_presets');
  const isDisabled = user.tenantDisabledMenus?.includes('operator_presets');
  if (!isAllowed || isDisabled) {
    const err = new Error('Forbidden: Access to Visual Identity Studio is not authorized');
    err.status = 403;
    throw err;
  }
}

export const POST = withTenantContext(async (req, _context, user) => {
  try {
    requireVisualIdentityAiAccess(user);
    const body = await req.json();
    const prompt = String(body.prompt || '').trim();
    const aspectRatio = String(body.aspect_ratio || '9:16').trim();
    const model = body.model || null;

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'Prompt T2I tidak boleh kosong' }, { status: 400 });
    }

    // 1. Submit T2I Task ke G-Labs Node 2
    const t2iResult = await generateImage({
      prompt,
      aspect_ratio: aspectRatio,
      model
    });

    if (!t2iResult || !t2iResult.task_id) {
      return NextResponse.json({ success: false, error: 'G-Labs worker tidak mengembalikan task_id' }, { status: 502 });
    }

    const taskId = t2iResult.task_id;

    // 2. Poll Task Status hingga selesai (maksimal 75 detik = 30 x 2.5 detik)
    let statusRes = null;
    let maxRetries = 30;
    while (maxRetries > 0) {
      await new Promise(resolve => setTimeout(resolve, 2500));
      statusRes = await getTaskStatus(taskId);
      if (statusRes && (statusRes.status === 'completed' || statusRes.status === 'failed')) {
        break;
      }
      maxRetries--;
    }

    if (!statusRes || statusRes.status !== 'completed') {
      return NextResponse.json({
        success: false,
        error: `Generasi gambar G-Labs gagal atau timeout: ${statusRes?.error || 'Worker timeout'}`
      }, { status: 504 });
    }

    const results = statusRes.results || statusRes.files || [];
    let completedImageName = results.find(f => 
      typeof f === 'string' && (f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.webp') || f.endsWith('.jpeg'))
    ) || results[0];

    if (!completedImageName) {
      return NextResponse.json({ success: false, error: 'G-Labs tidak mengembalikan file gambar valid.' }, { status: 502 });
    }

    if (completedImageName.startsWith('http://') || completedImageName.startsWith('https://')) {
      completedImageName = completedImageName.split('/').pop();
    }
    const downloadUrl = getFileUrl(completedImageName, taskId);
    const ext = completedImageName.split('.').pop() || 'png';
    const filename = `vi_preview_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const destDir = path.join(process.cwd(), 'public', 'uploads', 'visual-identities', 'previews');
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const destPath = path.join(destDir, filename);
    const dlRes = await fetch(downloadUrl);
    if (!dlRes.ok) {
      throw new Error(`Gagal download hasil render dari G-Labs: ${dlRes.statusText}`);
    }

    const buffer = await dlRes.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(buffer));

    const publicUrl = `/uploads/visual-identities/previews/${filename}`;

    return NextResponse.json({
      success: true,
      image_url: publicUrl,
      task_id: taskId,
      aspect_ratio: aspectRatio
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Internal Server Error'
    }, { status: err.status || 500 });
  }
});
