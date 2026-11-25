import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

/**
 * Menambahkan header RIFF WAV ke buffer PCM 16-bit linear mono
 * @param {Buffer} pcmBuffer - Data PCM mentah dari Gemini
 * @param {number} sampleRate - Frekuensi sampling (Default Gemini: 24000)
 * @returns {Buffer} Buffer WAV utuh siap simpan/putar
 */
export function convertPcmToWav(pcmBuffer, sampleRate = 24000) {
  const wavHeader = Buffer.alloc(44);
  const numChannels = 1; // Mono
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const chunkSize = 36 + dataSize;

  // RIFF Header
  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(chunkSize, 4);
  wavHeader.write('WAVE', 8);

  // FMT Sub-chunk
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16); // Sub-chunk size
  wavHeader.writeUInt16LE(1, 20);  // Audio format (1 = PCM)
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(byteRate, 28);
  wavHeader.writeUInt16LE(blockAlign, 32);
  wavHeader.writeUInt16LE(bitsPerSample, 34);

  // Data Sub-chunk
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(dataSize, 40);

  return Buffer.concat([wavHeader, pcmBuffer]);
}

/**
 * Menyusun argumen FFmpeg untuk menggabungkan klip audio secara aman di FFmpeg 8.x
 * (menyertakan `aresample=44100` dan format output eksplisit agar terhindar dari
 * `inadequate AVFrame plane padding` pada `libmp3lame`).
 */
export function buildAudioConcatArgs(clipPaths = [], outputPath = '') {
  if (!Array.isArray(clipPaths) || clipPaths.length === 0) {
    throw new Error('clipPaths tidak boleh kosong untuk concat audio.');
  }
  const args = ['-y'];
  for (const clipPath of clipPaths) {
    args.push('-i', clipPath);
  }
  const filterString =
    clipPaths.map((_, index) => `[${index}:a]`).join('') +
    `concat=n=${clipPaths.length}:v=0:a=1,aresample=44100[a]`;
  args.push('-filter_complex', filterString, '-map', '[a]', '-ar', '44100', '-ac', '2');
  if (String(outputPath).toLowerCase().endsWith('.mp3')) {
    args.push('-c:a', 'libmp3lame', '-b:a', '128k');
  }
  args.push(outputPath);
  return args;
}

/**
 * Menggabungkan satu atau lebih file klip audio menjadi satu file audio output.
 */
export function concatAudioClipsToFile(clipPaths = [], outputPath = '') {
  if (!Array.isArray(clipPaths) || clipPaths.length === 0) {
    throw new Error('clipPaths tidak boleh kosong untuk concat audio.');
  }
  if (
    clipPaths.length === 1 &&
    path.extname(clipPaths[0]).toLowerCase() === path.extname(outputPath).toLowerCase()
  ) {
    fs.copyFileSync(clipPaths[0], outputPath);
    return outputPath;
  }
  const args = buildAudioConcatArgs(clipPaths, outputPath);
  execFileSync('ffmpeg', args);
  return outputPath;
}
