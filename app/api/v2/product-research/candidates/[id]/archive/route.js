import { withProductResearchAccess } from '../../../../../../../lib/auth.js';
import {
  archiveResearchCandidate,
  getResearchCandidateById
} from '../../../../../../../lib/product-research-repository.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withProductResearchAccess(async (request, context, user) => {
  try {
    const { id } = await context.params;
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const archived = body?.archived === undefined ? true : Boolean(body.archived);
    const requestedBy = user?.username || user?.id || 'web_user';

    const updated = await archiveResearchCandidate(id, { archived, requestedBy });
    if (!updated) {
      return Response.json(
        { success: false, error: 'Kandidat riset tidak ditemukan.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const detail = await getResearchCandidateById(id);
    return Response.json({
      success: true,
      archived,
      candidate: detail
    }, {
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (error) {
    console.error('[Product Research Candidate Archive POST Error]:', error);
    return Response.json(
      { success: false, error: error.message || 'Gagal mengarsipkan kandidat.' },
      { status: error.status || 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
});
