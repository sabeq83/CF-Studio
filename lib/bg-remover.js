import { removeBackground } from '@imgly/background-removal-node';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { execSync } from 'child_process';
import os from 'os';

/**
 * S8: Memeriksa apakah latar belakang gambar sudah berupa warna putih polos (Studio Look).
 * Mengecek strip tepi 4% dari setiap sisi gambar.
 * Jika >= 95% piksel di strip tepi memiliki luminansi >= 245 dan selisih RGB <= 15 (saturasi rendah),
 * maka latar dianggap putih polos dan pemrosesan rembg/imgly dilewati.
 * @param {Buffer|string} bufferOrPath
 * @returns {Promise<boolean>}
 */
export async function isPlainWhiteBackground(bufferOrPath) {
  try {
    if (!bufferOrPath) return false;
    const img = sharp(bufferOrPath);
    const meta = await img.metadata();
    const w = meta.width;
    const h = meta.height;
    if (!w || !h || w < 10 || h < 10) return false;

    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const channels = info.channels;

    const borderX = Math.max(1, Math.round(w * 0.04));
    const borderY = Math.max(1, Math.round(h * 0.04));

    let borderPixels = 0;
    let whitePixels = 0;

    for (let y = 0; y < h; y++) {
      const isTopOrBottom = y < borderY || y >= (h - borderY);
      for (let x = 0; x < w; x++) {
        const isLeftOrRight = x < borderX || x >= (w - borderX);
        if (isTopOrBottom || isLeftOrRight) {
          borderPixels++;
          const idx = (y * w + x) * channels;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = channels >= 4 ? data[idx + 3] : 255;

          if (a < 240) continue;

          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const maxVal = Math.max(r, g, b);
          const minVal = Math.min(r, g, b);
          const diff = maxVal - minVal;

          if (lum >= 245 && diff <= 15) {
            whitePixels++;
          }
        }
      }
    }

    if (borderPixels === 0) return false;
    return (whitePixels / borderPixels) >= 0.95;
  } catch (err) {
    console.warn('[isPlainWhiteBackground] Error saat memeriksa latar putih:', err.message);
    return false;
  }
}

/**
 * Menghapus latar belakang gambar dan menggantinya dengan warna putih (Studio Look)
 * @param {string} inputImagePath - Path absolut gambar mentah
 * @param {string} outputFilename - Nama file output yang diinginkan
 * @returns {Promise<string>} - Path relatif gambar yang sudah bersih
 */
export async function createCleanProductShot(inputImagePath, outputFilename) {
  console.log(`[AI Vision] Memulai pemotongan latar belakang untuk: ${path.basename(inputImagePath)}`);
  
  const finalOutputDir = path.join(process.cwd(), 'public', 'uploads', 'products', 'clean');
  if (!fs.existsSync(finalOutputDir)) {
    fs.mkdirSync(finalOutputDir, { recursive: true });
  }
  const finalOutputPath = path.join(finalOutputDir, outputFilename);

  // S8: Cek apakah latar gambar sudah putih polos (bypass rembg agar kemasan putih tidak terhapus)
  const isWhite = await isPlainWhiteBackground(inputImagePath);
  if (isWhite) {
    console.log(`[AI Vision] Latar belakang sudah putih polos (≥95% strip tepi). Melewati rembg.`);
    await sharp(inputImagePath)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 90 })
      .toFile(finalOutputPath);
    console.log(`[AI Vision] [Bypass Rembg] Sukses! Foto produk studio tersimpan di: clean/${outputFilename}`);
    return `/uploads/products/clean/${outputFilename}`;
  }

  // Deteksi path rembg local (pip user install) maupun global
  const homeDir = os.homedir();
  const possibleRembgPaths = [
    '/opt/homebrew/bin/rembg',
    path.join(homeDir, '.local', 'bin', 'rembg'),
    path.join(homeDir, 'miniconda', 'bin', 'rembg'),
    '/usr/local/bin/rembg',
    '/usr/bin/rembg'
  ];
  
  let rembgPath = null;
  for (const p of possibleRembgPaths) {
    if (fs.existsSync(p)) {
      rembgPath = p;
      break;
    }
  }

  // Cek jika rembg bisa dipanggil secara global di system PATH
  if (!rembgPath) {
    try {
      execSync('which rembg', { stdio: 'ignore' });
      rembgPath = 'rembg';
    } catch (_) {}
  }

  if (rembgPath) {
    console.log(`[AI Vision] Terdeteksi rembg di: ${rembgPath}. Menggunakan rembg untuk kualitas pemotongan background terbaik.`);
    try {
      // 1. Buat file temporary transparent output
      const tempOutput = path.join(os.tmpdir(), `transparent_${Date.now()}_${outputFilename.replace(/\.[^/.]+$/, "")}.png`);
      
      // Jalankan CLI rembg
      execSync(`"${rembgPath}" i "${inputImagePath}" "${tempOutput}"`, { stdio: 'ignore' });
      
      // 2. Tambahkan latar belakang putih solid menggunakan sharp
      await sharp(tempOutput)
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality: 90 })
        .toFile(finalOutputPath);
        
      // Hapus file temporary
      if (fs.existsSync(tempOutput)) {
        fs.unlinkSync(tempOutput);
      }
      
      console.log(`[AI Vision] [Rembg] Sukses! Foto produk studio tersimpan di: clean/${outputFilename}`);
      return `/uploads/products/clean/${outputFilename}`;
      
    } catch (rembgErr) {
      console.warn(`[AI Vision] Gagal memproses menggunakan rembg: ${rembgErr.message}. Fallback otomatis ke imgly...`);
    }
  }

  // Fallback ke @imgly/background-removal-node jika rembg tidak ada/gagal
  try {
    const imageBuffer = fs.readFileSync(inputImagePath);
    const ext = path.extname(inputImagePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    const blob = new Blob([imageBuffer], { type: mimeType });
    
    const transparentBlob = await removeBackground(blob, { model: 'medium' });
    const transparentBuffer = Buffer.from(await transparentBlob.arrayBuffer());

    await sharp(transparentBuffer)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 90 })
      .toFile(finalOutputPath);

    console.log(`[AI Vision] [Imgly Fallback] Sukses! Foto produk studio tersimpan di: clean/${outputFilename}`);
    return `/uploads/products/clean/${outputFilename}`;

  } catch (error) {
    console.error(`[AI Vision] Gagal memproses gambar:`, error.message);
    throw error;
  }
}
