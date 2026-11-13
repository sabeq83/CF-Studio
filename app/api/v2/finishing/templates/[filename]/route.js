import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { withTenantContext } from '../../../../../../lib/auth';
import { FINISHING_TEMPLATE_REGISTRY } from '../../../../../../lib/finishing-template-registry';

const ALLOWED_FILES = new Set([
  ...FINISHING_TEMPLATE_REGISTRY.map((entry) => entry.file),
  'shared-layers.js'
]);

export const GET = withTenantContext(async (_request, { params }) => {
  const { filename } = await params;
  const safeName = path.basename(String(filename || '').trim());

  if (!safeName || !ALLOWED_FILES.has(safeName)) {
    return NextResponse.json({ error: 'Finishing template not found' }, { status: 404 });
  }

  const fullPath = path.join(process.cwd(), 'templates', 'finishing', safeName);
  try {
    const content = await fs.readFile(fullPath, 'utf8');
    const contentType = safeName.endsWith('.js')
      ? 'application/javascript; charset=utf-8'
      : 'text/html; charset=utf-8';

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store'
      }
    });
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return NextResponse.json({ error: 'Finishing template file missing' }, { status: 404 });
    }
    throw err;
  }
});

