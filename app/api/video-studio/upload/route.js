import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const TEMP_DIR = path.join(process.cwd(), 'public', 'temp');

// Ensure public/temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    
    // Support multiple files via 'files' or multiple 'file' keys
    let rawFiles = formData.getAll('files');
    if (!rawFiles || rawFiles.length === 0) {
      rawFiles = formData.getAll('file');
    }

    const validFiles = (rawFiles || []).filter(f => f && f.size > 0);

    if (validFiles.length === 0) {
      return NextResponse.json({ success: false, error: 'File wajib diunggah' }, { status: 400 });
    }

    const maxVideoSize = 50 * 1024 * 1024; // 50MB
    const maxAudioSize = 10 * 1024 * 1024; // 10MB

    const processedData = [];

    for (const file of validFiles) {
      const filename = file.name || 'unnamed_file';
      const ext = path.extname(filename).toLowerCase();
      const mimeType = file.type || '';

      const isVideo = mimeType.startsWith('video/') || ['.mp4', '.mov', '.webm', '.mkv', '.avi'].includes(ext);
      const isAudio = mimeType.startsWith('audio/') || ['.mp3', '.wav', '.ogg', '.m4a', '.aac'].includes(ext);

      if (!isVideo && !isAudio) {
        return NextResponse.json({
          success: false,
          error: `Format file '${filename}' tidak didukung. Harap unggah file video (.mp4/.mov) atau audio (.mp3/.wav)`
        }, { status: 400 });
      }

      if (isVideo && file.size > maxVideoSize) {
        return NextResponse.json({
          success: false,
          error: `Ukuran video '${filename}' melebihi batas maksimal (50MB). Ukuran file: ${(file.size / (1024 * 1024)).toFixed(2)}MB`
        }, { status: 400 });
      }

      if (isAudio && file.size > maxAudioSize) {
        return NextResponse.json({
          success: false,
          error: `Ukuran audio '${filename}' melebihi batas maksimal (10MB). Ukuran file: ${(file.size / (1024 * 1024)).toFixed(2)}MB`
        }, { status: 400 });
      }

      // Generate safe unique filename
      const safeBaseName = path.basename(filename, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
      const uniqueFilename = `tmp_${uuidv4().substring(0, 8)}_${safeBaseName}${ext}`;
      const destinationPath = path.join(TEMP_DIR, uniqueFilename);

      // Save file
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(destinationPath, buffer);

      const relativeFsPath = path.join('public', 'temp', uniqueFilename);
      const webUrlPath = `/temp/${uniqueFilename}`;

      processedData.push({
        filename: filename,
        fs_path: relativeFsPath,
        web_path: webUrlPath,
        size_bytes: file.size,
        mime_type: mimeType,
        is_video: isVideo
      });
    }

    if (processedData.length === 1 && !formData.has('files')) {
      // Backward compatible for single file upload
      return NextResponse.json({
        success: true,
        data: processedData[0],
        items: processedData
      });
    }

    return NextResponse.json({
      success: true,
      data: processedData,
      count: processedData.length
    });

  } catch (error) {
    console.error('[Video Studio Upload API] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
