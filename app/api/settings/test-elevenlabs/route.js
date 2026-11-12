import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';
import { withTenantContext } from '@/lib/auth';

export const POST = withTenantContext(async (request, _context, user) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { api_key, use_stored } = body;

    let keyToTest = api_key;
    if (use_stored || !keyToTest) {
      keyToTest = await getSetting('elevenlabs_api_key', false);
    }

    if (!keyToTest || !String(keyToTest).trim()) {
      return NextResponse.json({
        success: false,
        error: 'API Key ElevenLabs tidak ditemukan. Harap masukkan atau simpan API Key terlebih dahulu.'
      }, { status: 400 });
    }

    const res = await fetch('https://api.elevenlabs.io/v1/user', {
      method: 'GET',
      headers: { 'xi-api-key': String(keyToTest).trim() }
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      const sub = data.subscription || {};
      return NextResponse.json({
        success: true,
        message: 'Koneksi ke ElevenLabs API berhasil terverifikasi!',
        tier: sub.tier || 'Creator / Pro',
        character_count: sub.character_count ?? 0,
        character_limit: sub.character_limit ?? 0,
        status: sub.status || 'active'
      });
    }

    // 403 = scoped key (missing user_read). Fallback: verify via /v1/models (requires only auth)
    if (res.status === 403) {
      const modelsRes = await fetch('https://api.elevenlabs.io/v1/models', {
        method: 'GET',
        headers: { 'xi-api-key': String(keyToTest).trim() }
      });
      if (modelsRes.ok) {
        return NextResponse.json({
          success: true,
          message: 'API Key ElevenLabs valid & siap digunakan untuk Voice Generation. (Scoped Key — quota info tidak tersedia)',
          tier: 'Scoped Key (TTS Ready)',
          character_count: null,
          character_limit: null,
          status: 'active'
        });
      }
    }

    const errMsg = data?.detail?.message || data?.message || data?.error || `HTTP ${res.status}: Gagal memverifikasi API Key ElevenLabs`;
    return NextResponse.json({ success: false, error: errMsg }, { status: res.status });
  } catch (error) {
    console.error('[API /settings/test-elevenlabs Error]', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Terjadi kesalahan saat menguji koneksi ke ElevenLabs'
    }, { status: 500 });
  }
});

