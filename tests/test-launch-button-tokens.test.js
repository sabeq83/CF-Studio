import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('app/theme.css defines status-purple and status-rose tokens for both dark and light modes', () => {
  const themeCss = fs.readFileSync(path.resolve(process.cwd(), 'app/theme.css'), 'utf-8');

  // Verify Dark mode definitions
  assert.ok(themeCss.includes('--status-purple: #c084fc;'), 'Dark theme must define --status-purple');
  assert.ok(themeCss.includes('--status-purple-soft: rgba(192, 132, 252, 0.14);'), 'Dark theme must define --status-purple-soft');
  assert.ok(themeCss.includes('--status-rose: #f43f5e;'), 'Dark theme must define --status-rose');
  assert.ok(themeCss.includes('--status-rose-soft: rgba(244, 63, 94, 0.14);'), 'Dark theme must define --status-rose-soft');

  // Verify Light mode definitions
  assert.ok(themeCss.includes('--status-purple: #8b5cf6;'), 'Light theme must define --status-purple');
  assert.ok(themeCss.includes('--status-purple-soft: #f5f3ff;'), 'Light theme must define --status-purple-soft');
  assert.ok(themeCss.includes('--status-rose: #e11d48;'), 'Light theme must define --status-rose');
  assert.ok(themeCss.includes('--status-rose-soft: #fff1f2;'), 'Light theme must define --status-rose-soft');
});

test('app/auto-pipeline/page.js standardizes 1-click launch button with canonical var(--action-primary)', () => {
  const pageJs = fs.readFileSync(path.resolve(process.cwd(), 'app/auto-pipeline/page.js'), 'utf-8');

  // Verify the submit button uses uniform var(--action-primary)
  assert.ok(
    pageJs.includes("background: isLaunching ? 'var(--surface-interactive)' : 'var(--action-primary)'"),
    'Launch button must uniformly use var(--action-primary)'
  );

  // Verify text color uses var(--on-action-primary)
  assert.ok(
    pageJs.includes("color: isLaunching ? 'var(--text-muted)' : 'var(--on-action-primary)'"),
    'Launch button text must use var(--on-action-primary)'
  );

  // Verify box-shadow uses var(--accent-glow) instead of hardcoded blue
  assert.ok(
    pageJs.includes("boxShadow: isLaunching ? 'none' : '0 4px 16px var(--accent-glow)'"),
    'Launch button shadow must use var(--accent-glow)'
  );

  // Verify obsolete branch on launch button background is removed
  assert.ok(
    !pageJs.includes("instantCampaignType === 'multiplier_campaign' ? 'var(--status-purple)'"),
    'Obsolete campaign-specific button background branches must be removed'
  );
});
