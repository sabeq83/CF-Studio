import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  getEffectiveFinishingOverride,
  buildFinishingOverridePatch,
  parseFinishingOverrideFields
} from '../lib/finishing-template-registry.js';
import { resolveCampaignCaptionMode } from '../lib/finishing-plan-validator.js';
import { resolvePreRenderFinishingMeta } from '../lib/tiktok-compliance-service.js';
import { buildPhase1Timeline } from '../lib/finishing-overlay-renderer.js';

test('F4-T0 (R19.1, R19.2): Legacy campaign NULL caption_mode renders as full & diff-only patch preserves NULL', () => {
  const legacyCampaign = {
    id: 'camp_legacy_1',
    finishing_template: null,
    caption_mode: null,
    loudness_target: null
  };

  const eff = getEffectiveFinishingOverride(legacyCampaign);
  assert.equal(eff.finishing_template, 'none');
  assert.equal(eff.finishing_template_is_default, true);
  assert.equal(eff.caption_mode, 'full');
  assert.equal(eff.caption_mode_is_default, true);
  assert.equal(eff.loudness_target, -14);
  assert.equal(eff.loudness_target_is_default, true);

  // User opens legacy campaign and only changes finishing_template -> tips_listicle
  const patch = buildFinishingOverridePatch(legacyCampaign, {
    finishing_template: 'tips_listicle',
    caption_mode: eff.caption_mode,
    loudness_target: eff.loudness_target
  });
  assert.deepEqual(patch, { finishing_template: 'tips_listicle' });
  assert.equal('caption_mode' in patch, false);
  assert.equal('loudness_target' in patch, false);

  // Simulated DB record after applying only changed patch: caption_mode stays NULL!
  const updatedCampaign = { ...legacyCampaign, ...patch };
  assert.equal(updatedCampaign.caption_mode, null);
  assert.equal(resolveCampaignCaptionMode(updatedCampaign), 'full');
});

test('F4-T0 (R19.3, R19.4): parseFinishingOverrideFields rejects empty string with 400 and allows explicit null reset', () => {
  for (const field of ['caption_mode', 'finishing_template', 'loudness_target']) {
    const emptyRes = parseFinishingOverrideFields({ [field]: '' });
    assert.equal(emptyRes.status, 400, `${field}: "" must be rejected with 400`);
    assert.ok(emptyRes.error);

    const wsRes = parseFinishingOverrideFields({ [field]: '   ' });
    assert.equal(wsRes.status, 400, `${field}: whitespace must be rejected with 400`);

    const nullRes = parseFinishingOverrideFields({ [field]: null });
    assert.equal(nullRes.status, 200);
    assert.equal(nullRes.updates[field], null);
  }

  const invalidCap = parseFinishingOverrideFields({ caption_mode: 'invalid_mode' });
  assert.equal(invalidCap.status, 400);

  const invalidLoud = parseFinishingOverrideFields({ loudness_target: -30 });
  assert.equal(invalidLoud.status, 400);

  const validOnlyTpl = parseFinishingOverrideFields({ finishing_template: 'TIPS_LISTICLE' });
  assert.equal(validOnlyTpl.status, 200);
  assert.deepEqual(validOnlyTpl.updates, { finishing_template: 'tips_listicle' });
});

test('F4-T0 (R19.5): E2E simulation opening legacy campaign, updating template only keeps render captionMode=full', async () => {
  const dbCampaign = {
    id: 'camp_legacy_e2e',
    campaign_name: 'Legacy Editorial',
    finishing_template: null,
    caption_mode: null,
    loudness_target: null
  };

  // 1. UI loads baseline & changes only finishing_template
  const uiBaseline = getEffectiveFinishingOverride(dbCampaign);
  assert.equal(uiBaseline.caption_mode, 'full');
  const patchBody = buildFinishingOverridePatch(dbCampaign, {
    finishing_template: 'tips_listicle',
    caption_mode: uiBaseline.caption_mode,
    loudness_target: uiBaseline.loudness_target
  });
  const parsed = parseFinishingOverrideFields(patchBody);
  assert.equal(parsed.status, 200);

  const persistedCampaign = { ...dbCampaign, ...parsed.updates };
  assert.equal(persistedCampaign.finishing_template, 'tips_listicle');
  assert.equal(persistedCampaign.caption_mode, null);

  // 2. Render resolver preserves legacy 'full' mode
  const meta = await resolvePreRenderFinishingMeta({ db: null, campaign: persistedCampaign, item: null });
  assert.equal(meta.finishingTemplate, 'tips_listicle');
  assert.equal(meta.captionMode, 'full');

  const tl = buildPhase1Timeline({
    finishingTemplate: meta.finishingTemplate,
    captionMode: meta.captionMode,
    totalDuration: 4,
    wordEvents: [
      { w: 'Satu', s: 0.2, e: 0.6, c: 0 },
      { w: 'dua', s: 0.7, e: 1.1, c: 0 }
    ]
  });
  assert.equal(tl.config.finishingTemplate, 'tips_listicle');
  assert.equal(tl.config.captionMode, 'full');
});

test('F4-T0: Audit source files have no silent || hybrid fallback on campaign/preset override paths', () => {
  const filesToCheck = [
    'app/pillar-campaigns/[id]/page.js',
    'app/api/v2/pillar-campaigns/[id]/route.js',
    'app/api/v2/re-campaigns/[id]/route.js',
    'app/api/v2/operator-presets/route.js',
    'app/api/v2/operator-presets/[key]/route.js',
    'app/settings/presets/page.js'
  ];

  for (const rel of filesToCheck) {
    const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
    assert.equal(
      /caption_mode\s*\|\|\s*['"]hybrid['"]/.test(src),
      false,
      `${rel} must not contain silent caption_mode || 'hybrid' fallback`
    );
  }
});

