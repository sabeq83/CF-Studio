import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { resolveWhisperCliConfig, alignClipWordsTier2 } from '@/lib/word-alignment-engine';
import { getMediaDuration } from '@/lib/video-studio-processor';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { audio_path } = body;

    if (!audio_path) {
      return NextResponse.json({
        success: false,
        error: 'Path file audio wajib diisi'
      }, { status: 400 });
    }

    const resolvedAudioPath = path.isAbsolute(audio_path)
      ? audio_path
      : path.join(process.cwd(), audio_path);

    if (!fs.existsSync(resolvedAudioPath)) {
      return NextResponse.json({
        success: false,
        error: `File audio tidak ditemukan di server: ${audio_path}`
      }, { status: 404 });
    }

    const whisperConfig = resolveWhisperCliConfig();
    if (!whisperConfig.bin || !whisperConfig.modelPath) {
      return NextResponse.json({
        success: false,
        available: false,
        error: 'Whisper CLI tidak terpasang di server Staging. Silakan ketik teks Voiceover secara manual.'
      }, { status: 200 });
    }

    let duration = 0;
    try {
      duration = await getMediaDuration(resolvedAudioPath);
    } catch (_) {}

    const result = await alignClipWordsTier2({
      audioPath: resolvedAudioPath,
      duration
    });

    if (!result || !result.words || result.words.length === 0) {
      return NextResponse.json({
        success: false,
        available: true,
        error: 'Transkripsi Whisper tidak mendeteksi suara ucapan pada audio.'
      }, { status: 200 });
    }

    const text = result.words.map(w => w.w).join(' ');

    return NextResponse.json({
      success: true,
      available: true,
      text,
      words: result.words,
      duration: result.duration
    });

  } catch (error) {
    console.error('[Video Studio Transcribe API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
