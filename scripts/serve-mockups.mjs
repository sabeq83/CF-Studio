import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
};

/**
 * List `mockup_*.html` files inside `publicDir`, sorted newest modified first.
 */
export function listMockupFiles(publicDir) {
  if (!fs.existsSync(publicDir)) return [];
  const entries = fs.readdirSync(publicDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /^mockup_.*\.html$/i.test(entry.name))
    .map((entry) => {
      const fullPath = path.join(publicDir, entry.name);
      const stat = fs.statSync(fullPath);
      return {
        name: entry.name,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        updatedAt: new Date(stat.mtimeMs).toISOString()
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs || a.name.localeCompare(b.name));
}

/**
 * Safely resolve a URL pathname inside `publicDir` preventing directory traversal.
 */
export function resolveSafePublicPath(publicDir, rawPathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(String(rawPathname || '/').split('?')[0]);
  } catch {
    return null;
  }
  const normalized = decoded.replace(/^\/+/, '');
  if (!normalized) return null;
  const rootResolved = path.resolve(publicDir);
  const candidate = path.resolve(rootResolved, normalized);
  if (!candidate.startsWith(`${rootResolved}${path.sep}`)) {
    return null;
  }
  return candidate;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderIndexHtml(files, port) {
  const rows = files.length === 0
    ? '<p class="muted">Belum ada file <code>public/mockup_*.html</code>.</p>'
    : files.map((file) => {
      const kb = (file.size / 1024).toFixed(1);
      const updated = new Date(file.mtimeMs).toLocaleString('id-ID');
      return `
        <a class="row" href="/${encodeURIComponent(file.name)}">
          <div class="row-title">${escapeHtml(file.name)}</div>
          <div class="row-meta">${kb} KB &middot; Diperbarui ${escapeHtml(updated)}</div>
        </a>
      `;
    }).join('');

  return `<!DOCTYPE html>
<html lang="id" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CF Studio — Server Mockup HTML Lokal</title>
  <style>
    :root, [data-theme="dark"] {
      --canvas: #0b0f17;
      --surface: #131a26;
      --surface-raised: #1a2333;
      --border-subtle: rgba(148, 163, 184, 0.18);
      --text-primary: #f1f5f9;
      --text-muted: #94a3b8;
      --action-primary: #2dd4bf;
    }
    [data-theme="light"] {
      --canvas: #f4f6f9;
      --surface: #ffffff;
      --surface-raised: #f8fafc;
      --border-subtle: rgba(15, 23, 42, 0.12);
      --text-primary: #0f172a;
      --text-muted: #64748b;
      --action-primary: #0d9488;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--canvas);
      color: var(--text-primary);
      padding: 28px 16px 48px;
    }
    .wrap { max-width: 820px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
    .top { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    .btn {
      background: var(--surface-raised);
      color: var(--text-primary);
      border: 1px solid var(--border-subtle);
      border-radius: 8px;
      padding: 7px 12px;
      font-weight: 700;
      font-size: 0.8rem;
      cursor: pointer;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border-subtle);
      border-radius: 14px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      text-decoration: none;
      background: var(--surface-raised);
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      padding: 11px 14px;
      color: var(--text-primary);
    }
    .row:hover { border-color: var(--action-primary); }
    .row-title { font-weight: 700; font-size: 0.88rem; color: var(--action-primary); }
    .row-meta, .muted { font-size: 0.76rem; color: var(--text-muted); }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div>
        <h1 style="margin:0; font-size:1.2rem;">CF Studio — Server Mockup HTML Lokal</h1>
        <div class="muted">Menyajikan <code>public/mockup_*.html</code> langsung dari disk (port ${port}, zero-cache)</div>
      </div>
      <button class="btn" onclick="const h=document.documentElement;h.setAttribute('data-theme',h.getAttribute('data-theme')==='dark'?'light':'dark')">Ganti Tema</button>
    </div>
    <div class="card">
      <div class="muted">Total ${files.length} mockup ditemukan (diurutkan terbaru di atas):</div>
      ${rows}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Create a lightweight zero-DB HTTP server for local `public/mockup_*.html` files.
 */
export function createMockupServer({ publicDir = path.join(process.cwd(), 'public'), port = 4199 } = {}) {
  const resolvedPublicDir = path.resolve(publicDir);

  return http.createServer((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Method Not Allowed');
      return;
    }

    const reqPath = String(req.url || '/').split('?')[0];
    if (reqPath === '/health') {
      const payload = JSON.stringify({ status: 'ok', service: 'cfstudio-mockup-local', publicDir: resolvedPublicDir });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : payload);
      return;
    }

    if (reqPath === '/' || reqPath === '/index.html') {
      const files = listMockupFiles(resolvedPublicDir);
      const html = renderIndexHtml(files, port);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, must-revalidate' });
      res.end(req.method === 'HEAD' ? undefined : html);
      return;
    }

    const filePath = resolveSafePublicPath(resolvedPublicDir, reqPath);
    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('Mockup file not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store, must-revalidate'
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  });
}

function parseCliArgs(argv) {
  let port = Number(process.env.MOCKUP_PORT || 4199);
  let host = '127.0.0.1';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--lan') host = '0.0.0.0';
    if (argv[i] === '--port' && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) port = parsed;
      i++;
    }
  }
  return { port, host };
}

const isMainEntry = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainEntry) {
  const { port, host } = parseCliArgs(process.argv.slice(2));
  const publicDir = path.join(process.cwd(), 'public');
  const server = createMockupServer({ publicDir, port });
  server.listen(port, host, () => {
    console.log(`[Mockup Server Lokal] Aktif di http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/ (menyajikan ${publicDir})`);
  });
}
