import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { pgQuery } from '@/lib/db-pg';
import { 
  updateDraftStatus, 
  updateDraftText, 
  logExecutionOutcome 
} from '@/lib/threads-affiliate-repository';
import { 
  getReplizCredentials, 
  getActiveThreadsAccount 
} from '@/lib/threads-radar-scheduler';
import { createReplizComment, redactCredentials } from '@/lib/repliz-client';

export const dynamic = 'force-dynamic';

function getTenantId(req) {
  const user = getCurrentUser(req);
  if (user && user.tenantId && user.tenantId !== '__none__') {
    return user.tenantId;
  }
  return process.env.DEFAULT_TENANT_ID || 'default_tenant';
}

export async function POST(req, context) {
  try {
    const tenantId = getTenantId(req);
    const { params } = context;
    const { id: draftId } = await params;

    if (!draftId) {
      return NextResponse.json({ success: false, error: 'Draft ID wajib disertakan' }, { status: 400 });
    }

    // 1. Ambil detail draft dan post
    const draftRes = await pgQuery(
      `SELECT d.*, p.thread_id, p.author_username, p.post_url
       FROM threads_reply_drafts d
       JOIN threads_discovered_posts p ON d.discovered_post_id = p.id
       WHERE d.tenant_id = $1 AND d.id = $2
       LIMIT 1`,
      [tenantId, draftId]
    );

    if (draftRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Draf balasan tidak ditemukan' }, { status: 404 });
    }

    const draft = draftRes.rows[0];

    // 2. Ambil kredensial Repliz & akun Threads aktif
    const credentials = await getReplizCredentials(tenantId);
    if (!credentials.accessKey || !credentials.secretKey) {
      return NextResponse.json({ success: false, error: 'Kredensial Repliz belum dikonfigurasi' }, { status: 400 });
    }

    const threadsAcc = await getActiveThreadsAccount(credentials);
    if (!threadsAcc) {
      return NextResponse.json({ success: false, error: 'Tidak ditemukan akun Threads aktif di Repliz' }, { status: 400 });
    }

    // 3. Jitter Delay pengaman (3-6 detik untuk respons interaktif UI semi-autopilot)
    const jitterMs = Math.floor(Math.random() * 3000) + 2000;
    await new Promise(r => setTimeout(r, jitterMs));

    // 4. Siapkan payload gambar jika ada
    let imagePayload = null;
    if (draft.product_image_url && draft.product_image_url.startsWith('http')) {
      imagePayload = {
        url: draft.product_image_url,
        mimetype: 'image/jpeg'
      };
    }

    console.log(`[API Threads Reply] Mengirim komentar ke post ${draft.thread_id} via akun ${threadsAcc.id}...`);

    let replizComment;
    try {
      replizComment = await createReplizComment(credentials, {
        contentId: draft.thread_id,
        accountId: threadsAcc.id,
        text: draft.reply_text,
        image: imagePayload
      });
    } catch (apiErr) {
      console.error('[API Threads Reply Error from Repliz]:', redactCredentials(apiErr.message));
      await logExecutionOutcome(tenantId, {
        reply_draft_id: draftId,
        repliz_account_id: threadsAcc.id,
        status: 'failed',
        error_message: apiErr.message,
        delay_applied_seconds: Math.round(jitterMs / 1000)
      });

      return NextResponse.json({
        success: false,
        error: `Gagal mengirim balasan ke Threads: ${apiErr.message}`
      }, { status: 502 });
    }

    const commentId = replizComment?.id || replizComment?.commentId || 'live_comment';

    // 5. Catat log sukses dan update status draft ke 'posted'
    const executionLog = await logExecutionOutcome(tenantId, {
      reply_draft_id: draftId,
      repliz_account_id: threadsAcc.id,
      repliz_comment_id: String(commentId),
      delay_applied_seconds: Math.round(jitterMs / 1000),
      status: 'success'
    });

    return NextResponse.json({
      success: true,
      message: 'Balasan berhasil dikirim dan tayang di Threads!',
      data: {
        draftId,
        commentId,
        replizResponse: replizComment,
        executionLog
      }
    });

  } catch (err) {
    console.error('[API Threads Reply POST Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req, context) {
  try {
    const tenantId = getTenantId(req);
    const { params } = context;
    const { id: draftId } = await params;
    const body = await req.json();

    if (!draftId) {
      return NextResponse.json({ success: false, error: 'Draft ID wajib disertakan' }, { status: 400 });
    }

    const { reply_text, status } = body;
    let updated;

    if (reply_text !== undefined) {
      updated = await updateDraftText(tenantId, draftId, reply_text);
    } else if (status !== undefined) {
      updated = await updateDraftStatus(tenantId, draftId, status);
    } else {
      return NextResponse.json({ success: false, error: 'Tidak ada data yang diperbarui' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: updated
    });

  } catch (err) {
    console.error('[API Threads Reply PATCH Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
