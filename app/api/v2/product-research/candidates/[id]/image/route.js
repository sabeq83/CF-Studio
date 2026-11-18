import fs from 'fs';
import { withProductResearchAccess } from '../../../../../../../lib/auth.js';
import { getActiveTenantId } from '../../../../../../../lib/tenant-context.js';
import { getResearchCandidateById } from '../../../../../../../lib/product-research-repository.js';
import { resolveResearchImageAbsolutePath } from '../../../../../../../lib/product-research-image-storage.js';
import { detectImageMime } from '../../../../../../../lib/product-image-storage.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withProductResearchAccess(async (request, context) => {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get('kind') === 'screenshot' ? 'screenshot' : 'thumb';

    const candidate = await getResearchCandidateById(id);
    if (!candidate) {
      return Response.json({ success: false, error: 'Kandidat tidak ditemukan.' }, { status: 404 });
    }

    const relativePath = kind === 'screenshot'
      ? (candidate.screenshot_path || candidate.thumb_path)
      : (candidate.thumb_path || candidate.screenshot_path);

    if (!relativePath) {
      return Response.json({ success: false, error: 'Foto riset belum tersedia.' }, { status: 404 });
    }

    const tenantId = getActiveTenantId();
    const absolutePath = resolveResearchImageAbsolutePath({ relativePath, tenantId });
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      return Response.json({ success: false, error: 'File foto riset tidak ditemukan.' }, { status: 404 });
    }

    const buffer = await fs.promises.readFile(absolutePath);
    const mimeType = detectImageMime(buffer) || 'image/jpeg';

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'private, max-age=3600'
      }
    });
  } catch (error) {
    console.error('[Product Research Candidate Image GET Error]:', error);
    return Response.json(
      { success: false, error: error.message || 'Gagal memuat foto riset.' },
      { status: error.status || 500 }
    );
  }
});
