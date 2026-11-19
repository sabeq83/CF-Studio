import fs from 'fs';
import path from 'path';
import { detectImageMime, sha256Hex } from './product-image-storage.js';

export const MAX_RESEARCH_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_RESEARCH_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function sanitizePathSegment(value, fallback = 'item') {
  const cleaned = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 64);
  return cleaned || fallback;
}

function makeImageError(message, status = 400, code = 'INVALID_RESEARCH_IMAGE') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export function decodeResearchBase64Image(base64Input) {
  if (!base64Input || typeof base64Input !== 'string') {
    throw makeImageError('Payload gambar base64 harus berupa string.');
  }
  let payload = base64Input.trim();
  const dataUriMatch = payload.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/s);
  if (dataUriMatch) {
    payload = dataUriMatch[2].trim();
  }
  if (!payload) {
    throw makeImageError('Data gambar base64 kosong.');
  }

  // Cek cepat estimasi panjang sebelum alokasi penuh
  const estimatedBytes = Math.ceil((payload.length * 3) / 4);
  if (estimatedBytes > MAX_RESEARCH_IMAGE_BYTES + 1024) {
    throw makeImageError('Ukuran foto riset melebihi batas maksimal 5 MB.', 413, 'RESEARCH_IMAGE_TOO_LARGE');
  }

  const buffer = Buffer.from(payload, 'base64');
  if (!buffer.length) {
    throw makeImageError('Data gambar base64 tidak valid.');
  }
  if (buffer.length > MAX_RESEARCH_IMAGE_BYTES) {
    throw makeImageError('Ukuran foto riset melebihi batas maksimal 5 MB.', 413, 'RESEARCH_IMAGE_TOO_LARGE');
  }

  const mimeType = detectImageMime(buffer);
  if (!mimeType || !ALLOWED_RESEARCH_IMAGE_MIMES.has(mimeType)) {
    throw makeImageError('Format foto riset wajib jpg, png, atau webp.', 415, 'UNSUPPORTED_RESEARCH_IMAGE_TYPE');
  }

  return { buffer, mimeType };
}

export function validateResearchImageBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    throw makeImageError('File foto riset kosong atau tidak valid.');
  }
  if (buffer.length > MAX_RESEARCH_IMAGE_BYTES) {
    throw makeImageError('Ukuran foto riset melebihi batas maksimal 5 MB.', 413, 'RESEARCH_IMAGE_TOO_LARGE');
  }
  const mimeType = detectImageMime(buffer);
  if (!mimeType || !ALLOWED_RESEARCH_IMAGE_MIMES.has(mimeType)) {
    throw makeImageError('Format foto riset wajib jpg, png, atau webp.', 415, 'UNSUPPORTED_RESEARCH_IMAGE_TYPE');
  }
  return mimeType;
}

/**
 * Menyimpan foto riset ke public/uploads/product-research/<tenant>/<batch>/...
 * Folder ini terisolasi penuh dari foto katalog product_extractions.
 */
export async function saveResearchImage({
  tenantId,
  batchKey,
  candidateKey,
  kind = 'thumb',
  buffer
}) {
  if (!tenantId || tenantId === '__none__') {
    throw makeImageError('Tenant tidak valid untuk penyimpanan foto riset.', 403);
  }
  const mimeType = validateResearchImageBuffer(buffer);
  const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';

  const tenantSafe = sanitizePathSegment(tenantId, 'tenant');
  const batchSafe = sanitizePathSegment(batchKey, 'batch');
  const candidateSafe = sanitizePathSegment(candidateKey, 'cand');
  const kindSafe = kind === 'screenshot' ? 'screenshot' : 'thumb';
  const sha256 = sha256Hex(buffer);

  const fileName = `${candidateSafe}_${kindSafe}_${sha256.slice(0, 12)}.${ext}`;
  const dirPath = path.join(process.cwd(), 'public', 'uploads', 'product-research', tenantSafe, batchSafe);
  await fs.promises.mkdir(dirPath, { recursive: true });

  const absolutePath = path.join(dirPath, fileName);
  if (!fs.existsSync(absolutePath)) {
    await fs.promises.writeFile(absolutePath, buffer);
  }

  const relativePath = `/uploads/product-research/${tenantSafe}/${batchSafe}/${fileName}`;
  return {
    relativePath,
    absolutePath,
    sha256,
    mimeType,
    sizeBytes: buffer.length
  };
}

/**
 * Resolusi path aman untuk menyajikan foto riset terotorisasi tenant.
 */
export function resolveResearchImageAbsolutePath({ relativePath, tenantId }) {
  if (!relativePath || typeof relativePath !== 'string' || !tenantId || tenantId === '__none__') {
    return null;
  }
  const tenantSafe = sanitizePathSegment(tenantId, '');
  if (!tenantSafe) return null;

  const expectedPrefix = `/uploads/product-research/${tenantSafe}/`;
  if (!relativePath.startsWith(expectedPrefix)) {
    return null;
  }

  const tenantBaseDir = path.resolve(process.cwd(), 'public', 'uploads', 'product-research', tenantSafe);
  const cleanRel = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  const resolved = path.resolve(process.cwd(), 'public', cleanRel);

  if (!resolved.startsWith(tenantBaseDir + path.sep)) {
    return null;
  }
  return resolved;
}
