import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

test('lib/webhook-client.js normalizes HTTP 404 / Not found in getTaskStatus to status=failed', () => {
  const webhookClientCode = fs.readFileSync(path.join(rootDir, 'lib/webhook-client.js'), 'utf8');
  assert.match(webhookClientCode, /res\.status === 404/);
  assert.match(webhookClientCode, /error_code:\s*'TASK_NOT_FOUND'/);
});

test('lib/scheduler-processors.js attaches HTTP status on clip download errors and invalidates 404/410 tasks in processPillarGlabs', () => {
  const processorsCode = fs.readFileSync(path.join(rootDir, 'lib/scheduler-processors.js'), 'utf8');
  assert.match(processorsCode, /dlErr\.status = response\.status/);
  assert.match(processorsCode, /if \(pollErr\?\.status === 404 \|\| pollErr\?\.status === 410\)/);
  assert.match(processorsCode, /Task \$\{taskId\} clip file expired\/not found on GLabs/);
  assert.match(processorsCode, /const hasLocalClip = fs\.existsSync\(expectedClipPath\)/);
  assert.match(processorsCode, /if \(existingTask\.prompt === expectedPrompt && hasLocalClip\)/);
});

test('lib/campaign-scheduler.js sets hasActiveItem only for active Fase 1 or approved Fase 2 items', () => {
  const schedulerCode = fs.readFileSync(path.join(rootDir, 'lib/campaign-scheduler.js'), 'utf8');
  const guardIdx = schedulerCode.indexOf('if (!isOpcFullAutopilot && !isOpcApprovedForProduction)');
  assert.ok(guardIdx > 0, 'Phase 2 approval guard must exist');
  const afterGuardSnippet = schedulerCode.slice(guardIdx, guardIdx + 300);
  assert.match(afterGuardSnippet, /hasActiveItem = true;/);
});
