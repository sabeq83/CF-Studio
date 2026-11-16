import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  FINISHING_SKIN_REGISTRY,
  FINISHING_SKIN_IDS,
  DEFAULT_FINISHING_SKIN,
  resolveFinishingSkin,
  getSkinCssVariables
} from '../lib/finishing-skin-registry.js';
import {
  FINISHING_TEMPLATE_REGISTRY,
  FINISHING_TEMPLATE_IDS,
  suggestFinishingTemplate,
  parseFinishingOverrideFields
} from '../lib/finishing-template-registry.js';
import { auditTextDensity } from '../lib/finishing-plan-validator.js';

test('Fase 2 & 6: Finishing Skin Registry defines 6 general skins with tokens', () => {
  assert.equal(FINISHING_SKIN_REGISTRY.length, 6);
  assert.equal(DEFAULT_FINISHING_SKIN, 'pop_kuning');

  const expectedIds = ['pop_kuning', 'bersih_putih', 'hangat_earthy', 'gelap_tegas', 'pastel_lembut', 'editorial_serif'];
  assert.deepEqual(FINISHING_SKIN_IDS, expectedIds);

  for (const skin of FINISHING_SKIN_REGISTRY) {
    assert.ok(skin.tokens['--fx-accent'], `${skin.id} missing --fx-accent`);
    assert.ok(skin.tokens['--fx-card'], `${skin.id} missing --fx-card`);
    assert.ok(skin.tokens['--fx-font-display'], `${skin.id} missing --fx-font-display`);
    assert.ok(skin.tokens['--fx-font-body'], `${skin.id} missing --fx-font-body`);
    assert.ok(Array.isArray(skin.fonts) && skin.fonts.length > 0, `${skin.id} missing fonts array`);
  }
});

test('Fase 2: Skin resolver returns valid skin and falls back to pop_kuning safely', () => {
  const pop = resolveFinishingSkin('pop_kuning');
  assert.equal(pop.id, 'pop_kuning');

  const bersih = resolveFinishingSkin('bersih_putih');
  assert.equal(bersih.id, 'bersih_putih');
  assert.equal(bersih.tokens['--fx-stroke-width'], '0');

  const fallback1 = resolveFinishingSkin('non_existent_skin');
  assert.equal(fallback1.id, 'pop_kuning');

  const fallback2 = resolveFinishingSkin(null);
  assert.equal(fallback2.id, 'pop_kuning');

  const css = getSkinCssVariables('editorial_serif');
  assert.ok(css.includes('--fx-accent:'));
  assert.ok(css.includes('Playfair Display'));
});

test('Fase 6: Finishing Template Registry has zero brand name coupling in suggest patterns', () => {
  const brandRegex = /sasyahouse|siasat\s+sehat|nutriblend|dapur\s*botani|ruang\s*akustik|solusi\s*thermal/i;
  for (const tpl of FINISHING_TEMPLATE_REGISTRY) {
    if (Array.isArray(tpl.suggestFor)) {
      for (const s of tpl.suggestFor) {
        if (Array.isArray(s.patterns)) {
          for (const p of s.patterns) {
            assert.ok(!brandRegex.test(p.source), `Found brand mention in pattern ${p.source} of template ${tpl.id}`);
          }
        }
      }
    }
  }

  // Suggesting works for general content keywords
  assert.equal(suggestFinishingTemplate({ campaign_kind: 'recipe_campaign' }), 'recipe_pop');
  assert.equal(suggestFinishingTemplate({ content_pillar: '3 tips dan cara cepat' }), 'tips_listicle');
  assert.equal(suggestFinishingTemplate({ content_pillar: 'masalah dan solusi bocor' }), 'problem_solution');
  assert.equal(suggestFinishingTemplate({ content_pillar: 'jamu ramuan seduhan herbal' }), 'ramuan_ritual');
});

test('Fase 6: parseFinishingOverrideFields validates finishing_skin correctly', () => {
  const valid = parseFinishingOverrideFields({ finishing_skin: 'bersih_putih' });
  assert.equal(valid.status, 200);
  assert.equal(valid.updates.finishing_skin, 'bersih_putih');

  const invalid = parseFinishingOverrideFields({ finishing_skin: 'brand_xyz' });
  assert.equal(invalid.status, 400);
  assert.ok(invalid.error.includes('Invalid finishing_skin'));

  const nullVal = parseFinishingOverrideFields({ finishing_skin: null }, { allowNull: true });
  assert.equal(nullVal.status, 200);
  assert.equal(nullVal.updates.finishing_skin, null);
});

test('Fase 2 & 3: Static check confirms ZERO hex codes (#...) in all 8 template HTML files', () => {
  const templatesDir = path.join(process.cwd(), 'templates', 'finishing');
  const files = fs.readdirSync(templatesDir).filter((f) => f.endsWith('.html'));
  assert.equal(files.length, 8, 'Expected exactly 8 HTML templates in templates/finishing/');

  const hexRegex = /#[0-9a-fA-F]{3,6}/;
  for (const file of files) {
    const content = fs.readFileSync(path.join(templatesDir, file), 'utf8');
    const match = hexRegex.exec(content);
    assert.ok(!match, `Found hardcoded hex "${match?.[0]}" in template ${file}`);
  }
});

test('Fase 7: auditTextDensity flags text overcrowding when active blocks > 2', () => {
  // Good case: max 2 blocks (1 top slot + 1 subtitle chunk)
  const okTimeline = {
    config: { duration: 10, captionMode: 'full' },
    slots: [
      { layer: 'hook', s: 0, e: 2.0, zone: 'mid' },
      { layer: 'step', s: 2.5, e: 6.0, zone: 'top' },
      { layer: 'save', s: 6.5, e: 9.5, zone: 'top' }
    ],
    chunks: [
      { s: 2.6, e: 4.0, text: 'Potong kecil wortel' },
      { s: 4.2, e: 5.8, text: 'Rebus sampai empuk' }
    ]
  };
  const okAudit = auditTextDensity(okTimeline);
  assert.equal(okAudit.ok, true);
  assert.ok(okAudit.maxBlocks <= 2);
  assert.equal(okAudit.hotspots.length, 0);

  // Overcrowded case: 3 blocks (top card + mid card + subtitle active at t=3.0)
  const crowdedTimeline = {
    config: { duration: 10, captionMode: 'full' },
    slots: [
      { layer: 'step', s: 2.0, e: 6.0, zone: 'top' },
      { layer: 'punch', s: 2.5, e: 4.0, zone: 'mid' }
    ],
    chunks: [
      { s: 2.2, e: 5.0, text: 'Teks subtitle panjang' }
    ]
  };
  const crowdedAudit = auditTextDensity(crowdedTimeline);
  assert.equal(crowdedAudit.ok, false);
  assert.ok(crowdedAudit.maxBlocks >= 3);
  assert.ok(crowdedAudit.hotspots.length > 0);
  assert.ok(crowdedAudit.summary.includes('titik padat'));
});

// Clean exit
setTimeout(() => process.exit(0), 100);
