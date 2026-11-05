import test from 'node:test';
import { request as httpRequest } from 'node:http';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createMaknaServer, operatorClient } from '../tools.mjs';
import { createHttpApp } from '../server.mjs';

async function connected(t, request) {
  const server = createMaknaServer(request);
  const client = new Client({ name: 'test', version: '1' });
  const [left, right] = InMemoryTransport.createLinkedPair();
  await server.connect(right); await client.connect(left);
  t.after(async () => { await client.close(); await server.close(); });
  return client;
}
test('discovery, creation checkpoint, stable retry key, and status', async t => {
  const calls = [];
  const client = await connected(t, async (...args) => { calls.push(args); return { success: true, job_id: 'job-1' }; });
  const tools = (await client.listTools()).tools;
  assert.equal(tools.length, 5);
  assert.equal(tools.find(x => x.name === 'makna_create_campaign').annotations.readOnlyHint, false);
  const args = { idempotency_key: 'same-key', product_name: 'Coffee', product_description: 'Ground coffee', target_audience: 'Adults', content_goal: 'Awareness' };
  for (let i = 0; i < 2; i++) await client.callTool({ name: 'makna_create_campaign', arguments: args });
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls[0][1].key, 'same-key');
  assert.equal(calls[0][1].body.production.approval_mode, 'creative');
  assert.equal(calls[0][1].body.publishing.mode, 'draft_only');
  await client.callTool({ name: 'makna_get_campaign_status', arguments: { job_id: 'job-1' } });
  assert.equal(calls[2][0], '/api/operator/v1/content-jobs/job-1');
});
test('reject invalid arguments before contacting backend; propagate tool error', async t => {
  let calls = 0;
  const client = await connected(t, async () => { calls++; return { success: false, status: 403 }; });
  assert.equal((await client.callTool({ name: 'makna_get_campaign_status', arguments: { job_id: '../other' } })).isError, true);
  assert.equal(calls, 0);
  assert.equal((await client.callTool({ name: 'makna_whoami' })).isError, true);
});
test('operator credentials stay server-side; HTTP failures never expose response secrets', async () => {
  const request = operatorClient({ baseUrl: 'https://example.com', token: 'TEST_MOCK_TOKEN', fetchImpl: async (url, options) => {
    assert.equal(url.pathname, '/api/operator/v1/whoami');
    assert.equal(options.headers.authorization, 'Bearer TEST_MOCK_TOKEN');
    assert.equal(options.redirect, 'error');
    return new Response('private backend details', { status: 403 });
  } });
  assert.deepEqual(await request('/api/operator/v1/whoami'), { success: false, status: 403, error: 'Operator request rejected; check permissions, input, or job ID.' });
  assert.throws(() => operatorClient({ baseUrl: 'http://remote.example', token: 'TEST_MOCK_TOKEN' }));
});
test('HTTP authentication, origin and host protection, real MCP handshake', async t => {
  const bearerToken = 'TEST_MOCK_TOKEN_FOR_LOCAL_PROTOCOL_TEST';
  let calls = 0;
  const app = createHttpApp({ bearerToken, request: async () => { calls++; return { success: true }; } });
  const http = await new Promise((resolve, reject) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); listener.on('error', reject); });
  t.after(() => new Promise(resolve => { http.closeAllConnections(); http.close(resolve); }));
  const url = new URL(`http://127.0.0.1:${http.address().port}/mcp`);
  assert.equal((await fetch(url, { method: 'POST' })).status, 401);
  assert.equal((await fetch(url, { method: 'POST', headers: { origin: 'https://untrusted.example' } })).status, 403);
  assert.equal(await new Promise((resolve, reject) => { const req = httpRequest(url, { headers: { host: 'untrusted.example' } }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject); req.end(); }), 403);
  assert.equal(calls, 0);
  const client = new Client({ name: 'http-test', version: '1' });
  t.after(() => client.close());
  await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { authorization: `Bearer ${bearerToken}` } } }));
  assert.equal((await client.listTools()).tools.length, 5);
  assert.equal((await client.callTool({ name: 'makna_whoami' })).isError, undefined);
  assert.equal(calls, 1);
});
