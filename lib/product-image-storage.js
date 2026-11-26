import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export function detectImageMime(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer.length >= 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return 'image/webp';
  return null;
}

export function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function saveRawProductImage({ tenantId, productId, buffer, originalName }) {
  const mimeType = detectImageMime(buffer);
  if (!mimeType) throw new Error('Invalid image format');
  
  const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
  const tenantSafeId = String(tenantId).replace(/[^a-zA-Z0-9_-]/g, '');
  const productSafeId = String(productId).replace(/[^a-zA-Z0-9_-]/g, '');
  const timestamp = Date.now();
  
  const fileName = `raw_${tenantSafeId}_${productSafeId}_${timestamp}.${ext}`;
  const dirPath = path.join(process.cwd(), 'public', 'uploads', 'products', tenantSafeId, 'raw');
  
  await fs.promises.mkdir(dirPath, { recursive: true });
  
  const absolutePath = path.join(dirPath, fileName);
  await fs.promises.writeFile(absolutePath, buffer);
  
  const relativePath = `/uploads/products/${tenantSafeId}/raw/${fileName}`;
  const sha256 = sha256Hex(buffer);
  
  return { relativePath, absolutePath, sha256, mimeType, sizeBytes: buffer.length };
}

export async function saveCleanProductImage({ tenantId, productId, buffer, mimeType }) {
  const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
  const tenantSafeId = String(tenantId).replace(/[^a-zA-Z0-9_-]/g, '');
  const productSafeId = String(productId).replace(/[^a-zA-Z0-9_-]/g, '');
  const timestamp = Date.now();
  
  const fileName = `clean_${tenantSafeId}_${productSafeId}_${timestamp}.${ext}`;
  const dirPath = path.join(process.cwd(), 'public', 'uploads', 'products', tenantSafeId, 'clean');
  
  await fs.promises.mkdir(dirPath, { recursive: true });
  
  const absolutePath = path.join(dirPath, fileName);
  await fs.promises.writeFile(absolutePath, buffer);
  
  const relativePath = `/uploads/products/${tenantSafeId}/clean/${fileName}`;
  const sha256 = sha256Hex(buffer);
  
  return { relativePath, absolutePath, sha256, sizeBytes: buffer.length };
}

export function safeDeleteFile(absolutePath) {
  try {
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
  } catch (e) {
    // Ignore error
  }
}

export const BASE_PRODUCTS_UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'products');
export const TRANSPARENT_1X1_GIF_BUFFER = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/**
 * Validasi dan sanitasi path gambar di bawah public/uploads/products tanpa path traversal.
 */
export function resolveSafeProductUploadFile(relativePath, { baseDir = BASE_PRODUCTS_UPLOAD_DIR } = {}) {
  if (!relativePath || typeof relativePath !== 'string') {
    return { error: 'path parameter is required', status: 400 };
  }

  const trimmed = relativePath.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return { error: 'External URLs are not proxied by this endpoint', status: 400 };
  }

  let cleanPath = trimmed.replace(/\\/g, '/').replace(/\/+/g, '/');
  if (cleanPath.startsWith('/')) cleanPath = cleanPath.slice(1);
  if (cleanPath.startsWith('public/')) cleanPath = cleanPath.slice(7);
  if (cleanPath.startsWith('uploads/products/')) cleanPath = cleanPath.slice(17);

  if (!cleanPath) {
    return { error: 'path parameter is required', status: 400 };
  }

  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.resolve(path.join(resolvedBase, cleanPath));
  if (!resolvedPath.startsWith(`${resolvedBase}${path.sep}`)) {
    return { error: 'Unauthorized path', status: 403 };
  }

  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    return { missing: true, cleanPath, resolvedPath, contentType: 'image/gif' };
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  const contentTypeMap = {
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml'
  };

  return {
    missing: false,
    cleanPath,
    resolvedPath,
    contentType: contentTypeMap[ext] || 'image/jpeg'
  };
}

export function readLocalImageToBuffer(relativePath) {
  if (!relativePath) return null;
  // Ensure it doesn't try to read outside public directory
  const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  const absolutePath = path.join(process.cwd(), 'public', cleanPath);
  
  // Basic security check
  if (!absolutePath.startsWith(path.join(process.cwd(), 'public'))) return null;
  
  try {
    if (fs.existsSync(absolutePath)) {
      return fs.readFileSync(absolutePath);
    }
  } catch (e) {
    // Ignore
  }
  return null;
}

const MAX_REMOTE_IMAGE_BYTES = 10 * 1024 * 1024;

export async function resolveImageBufferFromInput({ photoBase64, photoUrl, filename = 'upload' }) {
  if (photoBase64 && typeof photoBase64 === 'string') {
    let base64Payload = photoBase64.trim();
    let inferredExt = '';
    const dataUriMatch = base64Payload.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (dataUriMatch) {
      inferredExt = dataUriMatch[1].replace('jpeg', 'jpg').toLowerCase();
      base64Payload = dataUriMatch[2];
    }
    const buffer = Buffer.from(base64Payload, 'base64');
    if (!buffer.length) {
      throw new Error('Data photo_base64 kosong atau tidak valid.');
    }
    if (buffer.length > MAX_REMOTE_IMAGE_BYTES) {
      throw new Error('Ukuran gambar melebihi batas maksimal 10MB.');
    }
    const safeName = filename.includes('.') || !inferredExt ? filename : `${filename}.${inferredExt}`;
    return { buffer, filename: safeName };
  }

  if (photoUrl && typeof photoUrl === 'string') {
    let parsed;
    try {
      parsed = new URL(photoUrl.trim());
    } catch {
      throw new Error('Format photo_url tidak valid.');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('photo_url wajib menggunakan protokol http atau https.');
    }
    const response = await fetch(parsed.toString(), {
      redirect: 'follow',
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) {
      throw new Error(`Gagal mengunduh gambar dari photo_url (HTTP ${response.status}).`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer.length) {
      throw new Error('Gambar yang diunduh dari photo_url kosong.');
    }
    if (buffer.length > MAX_REMOTE_IMAGE_BYTES) {
      throw new Error('Ukuran gambar dari photo_url melebihi batas maksimal 10MB.');
    }
    const urlBaseName = path.basename(parsed.pathname || '') || filename;
    return { buffer, filename: urlBaseName };
  }

  throw new Error('Sertakan photo_base64 atau photo_url untuk mengunggah gambar.');
}
