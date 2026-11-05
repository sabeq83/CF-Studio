import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import express from 'express';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMaknaServer, operatorClient } from './tools.mjs';

export function createHttpApp({ request, bearerToken, allowedHosts = ['127.0.0.1', 'localhost'], allowedOrigins = [] }) {
  if (!bearerToken || bearerToken.length < 32) throw new Error('MAKNA_MCP_BEARER_TOKEN must contain at least 32 characters');
  const digest = value => crypto.createHash('sha256').update(value).digest();
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    if (!allowedHosts.includes(req.hostname)) return res.sendStatus(403);
    if (req.headers.origin && !allowedOrigins.includes(req.headers.origin)) return res.sendStatus(403);
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'maknaflow-mcp' }));
  app.use('/mcp', (req, res, next) => {
    if (!crypto.timingSafeEqual(digest(req.headers.authorization || ''), digest(`Bearer ${bearerToken}`))) {
      res.set('WWW-Authenticate', 'Bearer realm="maknaflow-mcp"');
      return res.sendStatus(401);
    }
    next();
  });
  app.use(express.json({ limit: '64kb' }));
  app.post('/mcp', async (req, res) => {
    const server = createMaknaServer(request);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void transport.close(); void server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      if (!res.headersSent) res.status(500).json({ error: 'MCP request failed' });
    }
  });
  app.all('/mcp', (_req, res) => res.set('Allow', 'POST').sendStatus(405));
  return app;
}

async function main() {
  const request = operatorClient({ baseUrl: process.env.MAKNA_OPERATOR_BASE_URL || 'http://127.0.0.1:5010', token: process.env.MAKNA_OPERATOR_API_TOKEN });
  if (process.argv.includes('--stdio')) {
    await createMaknaServer(request).connect(new StdioServerTransport());
    return;
  }
  const list = value => (value || '').split(',').map(x => x.trim()).filter(Boolean);
  const app = createHttpApp({ request, bearerToken: process.env.MAKNA_MCP_BEARER_TOKEN,
    allowedHosts: list(process.env.MAKNA_MCP_ALLOWED_HOSTS || '127.0.0.1,localhost'), allowedOrigins: list(process.env.MAKNA_MCP_ALLOWED_ORIGINS) });
  const http = app.listen(Number(process.env.MAKNA_MCP_PORT || 7030), process.env.MAKNA_MCP_HOST || '127.0.0.1', () => console.error('MAKNA MCP listening'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => http.close());
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error('MAKNA MCP startup failed. Check configuration.'); process.exitCode = 1; });
