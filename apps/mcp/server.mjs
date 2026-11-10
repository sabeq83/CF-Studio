import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import express from 'express';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createCfStudioServer, createMaknaServer, operatorClient } from './tools.mjs';

export function createHttpApp({ request, baseUrl, bearerToken, allowedHosts = ['127.0.0.1', 'localhost', '100.95.245.55'], allowedOrigins = [] }) {
  const digest = value => crypto.createHash('sha256').update(value).digest();
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    // Izinkan localhost, domain terdaftar, atau IP CGNAT Tailscale (100.x.x.x)
    const isTailscaleIp = req.hostname.startsWith('100.');
    const isAllowed = isTailscaleIp || allowedHosts.includes(req.hostname) || allowedHosts.includes('*');
    if (!isAllowed) return res.sendStatus(403);
    if (req.headers.origin && !allowedOrigins.includes(req.headers.origin)) return res.sendStatus(403);
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'cf-studio-mcp' }));

  app.use(express.json({ limit: '64kb' }));

  // Helper untuk menjalankan sesi MCP Streamable HTTP
  const handleMcpSession = async (req, res, clientRequest) => {
    const server = createCfStudioServer(clientRequest);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void transport.close(); void server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      if (!res.headersSent) res.status(500).json({ error: 'MCP request failed' });
    }
  };

  // 1. Endpoint Tailscale Tokenized URL: /u/:token
  app.all('/u/:token', async (req, res) => {
    const token = req.params.token;
    if (!token || token.length < 16) {
      return res.status(401).json({ error: 'Invalid or missing operator token in URL' });
    }
    const clientRequest = operatorClient({ baseUrl, token });
    await handleMcpSession(req, res, clientRequest);
  });

  // 2. Endpoint Standard /mcp (dengan Bearer token atau ?token=...)
  app.use('/mcp', (req, res, next) => {
    if (req.query.token && req.query.token.length >= 16) {
      req.clientToken = req.query.token;
      return next();
    }
    if (bearerToken && req.headers.authorization && crypto.timingSafeEqual(digest(req.headers.authorization), digest(`Bearer ${bearerToken}`))) {
      req.clientToken = null;
      return next();
    }
    res.set('WWW-Authenticate', 'Bearer realm="cf-studio-mcp"');
    return res.sendStatus(401);
  });

  app.post('/mcp', async (req, res) => {
    const clientRequest = req.clientToken ? operatorClient({ baseUrl, token: req.clientToken }) : request;
    if (!clientRequest) {
      return res.status(500).json({ error: 'Default operator token not configured on server' });
    }
    await handleMcpSession(req, res, clientRequest);
  });
  app.all('/mcp', (_req, res) => res.set('Allow', 'POST').sendStatus(405));
  return app;
}

async function main() {
  const baseUrl = process.env.CF_STUDIO_OPERATOR_BASE_URL || process.env.MAKNA_OPERATOR_BASE_URL || 'http://127.0.0.1:5010';
  const token = process.env.CF_STUDIO_OPERATOR_API_TOKEN || process.env.MAKNA_OPERATOR_API_TOKEN || '';
  const request = token ? operatorClient({ baseUrl, token }) : null;
  if (process.argv.includes('--stdio')) {
    if (!request) throw new Error('CF_STUDIO_OPERATOR_API_TOKEN is required in stdio mode');
    await createCfStudioServer(request).connect(new StdioServerTransport());
    return;
  }
  const list = value => (value || '').split(',').map(x => x.trim()).filter(Boolean);
  const bearerToken = process.env.CF_STUDIO_MCP_BEARER_TOKEN || process.env.MAKNA_MCP_BEARER_TOKEN;
  const allowedHosts = list(process.env.CF_STUDIO_MCP_ALLOWED_HOSTS || process.env.MAKNA_MCP_ALLOWED_HOSTS || '127.0.0.1,localhost');
  const allowedOrigins = list(process.env.CF_STUDIO_MCP_ALLOWED_ORIGINS || process.env.MAKNA_MCP_ALLOWED_ORIGINS);
  const host = process.env.CF_STUDIO_MCP_HOST || process.env.MAKNA_MCP_HOST || '0.0.0.0';
  const port = Number(process.env.CF_STUDIO_MCP_PORT || process.env.MAKNA_MCP_PORT || 7030);

  const app = createHttpApp({ request, baseUrl, bearerToken, allowedHosts, allowedOrigins });
  const http = app.listen(port, host, () => console.error(`CF Studio MCP listening on ${host}:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => http.close());
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(err => { console.error('CF Studio MCP startup failed:', err); process.exitCode = 1; });
