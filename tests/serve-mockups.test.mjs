import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  listMockupFiles,
  resolveSafePublicPath,
  createMockupServer
} from '../scripts/serve-mockups.mjs';

test('listMockupFiles lists mockup_*.html sorted newest first and blocks path traversal', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockup-srv-'));
  try {
    const f1 = path.join(tmpDir, 'mockup_alpha.html');
    const f2 = path.join(tmpDir, 'mockup_beta.html');
    const other = path.join(tmpDir, 'ignore.txt');
    fs.writeFileSync(f1, '<h1>Alpha</h1>');
    fs.writeFileSync(f2, '<h1>Beta</h1>');
    fs.writeFileSync(other, 'ignored');
    fs.utimesSync(f1, 1000, 1000);
    fs.utimesSync(f2, 2000, 2000);

    const files = listMockupFiles(tmpDir);
    assert.deepEqual(files.map((f) => f.name), ['mockup_beta.html', 'mockup_alpha.html']);
    assert.equal(resolveSafePublicPath(tmpDir, '/../package.json'), null);
    assert.equal(resolveSafePublicPath(tmpDir, '/mockup_alpha.html'), path.resolve(f1));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('createMockupServer serves index, HTML files with no-store, health check, and rejects traversal', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockup-http-'));
  const server = createMockupServer({ publicDir: tmpDir, port: 4199 });
  try {
    fs.writeFileSync(path.join(tmpDir, 'mockup_sample.html'), '<title>Sample Mockup</title>');
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;

    const idxRes = await fetch(`${base}/`);
    assert.equal(idxRes.status, 200);
    assert.equal(idxRes.headers.get('cache-control'), 'no-store, must-revalidate');
    const idxText = await idxRes.text();
    assert.match(idxText, /mockup_sample\.html/);

    const fileRes = await fetch(`${base}/mockup_sample.html`);
    assert.equal(fileRes.status, 200);
    assert.equal(fileRes.headers.get('cache-control'), 'no-store, must-revalidate');
    assert.match(await fileRes.text(), /Sample Mockup/);

    const healthRes = await fetch(`${base}/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = await healthRes.json();
    assert.equal(healthJson.status, 'ok');

    const missRes = await fetch(`${base}/missing_file.html`);
    assert.equal(missRes.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
