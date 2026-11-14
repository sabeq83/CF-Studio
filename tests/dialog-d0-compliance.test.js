process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.PG_SEARCH_PATH = process.env.PG_SEARCH_PATH || 'dev';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findVoClaimViolations,
  stripSpeakerLabelPrefix,
  collectSpeakableComplianceText,
  resolveIsHerbalOrHealthTarget,
  resolveIsSkincareTarget,
  resolveIsClaimRestrictedTarget,
  rewriteViolatingVoSentences,
  auditScriptForTikTok
} from '../lib/tiktok-compliance-service.js';

test('D-0a: stripSpeakerLabelPrefix removes [X]: labels without mangling spoken text', () => {
  assert.equal(
    stripSpeakerLabelPrefix('[SI_WAJAN]: Jantungmu jadi kuat. [SAPU]: Wah beneran?'),
    'Jantungmu jadi kuat. Wah beneran?'
  );
  // Even if speaker label word looks sensitive, label itself is stripped before claim matching
  assert.deepEqual(
    findVoClaimViolations('[MONSTER_JERAWAT]: Aku muncul kalau kulitmu kotor.', { strict: true }),
    []
  );
});

test('D-0a: rewriteViolatingVoSentences inspects voice_segments[].text and keeps segments & narration synchronized', async () => {
  const result = await rewriteViolatingVoSentences({
    voiceover: [
      {
        scene: 1,
        narration: '[SI_WAJAN]: Jantungmu jadi kuat setiap pagi. [SAPU]: Beneran nih?',
        voice_segments: [
          { character_id: 'si_wajan', text: 'Jantungmu jadi kuat setiap pagi.' },
          { character_id: 'sapu', text: 'Beneran nih?' }
        ]
      }
    ],
    callRewriteJsonFn: async (prompt) => {
      assert.match(prompt, /Jantungmu jadi kuat setiap pagi\./);
      assert.doesNotMatch(prompt, /\[SI_WAJAN\]:/);
      return {
        rewrites: [
          { id: '1__seg_0', scene: 1, narration: 'Pagi terasa lebih ringan dan nyaman saat rutin beraktivitas.' }
        ]
      };
    }
  });

  assert.equal(result.blocked, false);
  assert.equal(result.changed, true);
  assert.equal(result.callsUsed, 1);
  assert.equal(
    result.voiceover[0].voice_segments[0].text,
    'Pagi terasa lebih ringan dan nyaman saat rutin beraktivitas.'
  );
  assert.equal(result.voiceover[0].voice_segments[1].text, 'Beneran nih?');
  assert.equal(
    result.voiceover[0].narration,
    '[SI_WAJAN]: Pagi terasa lebih ringan dan nyaman saat rutin beraktivitas. [SAPU]: Beneran nih?'
  );
  assert.deepEqual(result.remainingViolations, []);
});

test('D-0a: rewriteViolatingVoSentences marks blocked=true if voice_segments still violates after 1x rewrite (triggers paused_compliance)', async () => {
  const blocked = await rewriteViolatingVoSentences({
    voiceover: [
      {
        scene: 1,
        narration: '[DROPY]: Ini menghilangkan jerawatmu permanen. [MONSTER]: Masa?',
        voice_segments: [
          { character_id: 'dropy', text: 'Ini menghilangkan jerawatmu permanen.' },
          { character_id: 'monster', text: 'Masa?' }
        ]
      }
    ],
    isSkincare: true,
    callRewriteJsonFn: async () => ({
      rewrites: [
        { id: '1__seg_0', scene: 1, narration: 'Serum ini tetap menyembuhkan jerawatnya dalam 3 hari.' }
      ]
    })
  });

  assert.equal(blocked.blocked, true);
  assert.ok(blocked.remainingViolations.length > 0);
});

test('D-0a: collectSpeakableComplianceText catches violation in voice_segments even if narration was clean', () => {
  const combined = collectSpeakableComplianceText([
    {
      scene: 1,
      narration: '[SI_WAJAN]: Rutinitas pagi yang nyaman.',
      voice_segments: [
        { character_id: 'si_wajan', text: 'Jantungmu jadi kuat.' },
        { character_id: 'sapu', text: 'Wah mantap.' }
      ]
    }
  ]);
  const hits = findVoClaimViolations(combined, { strict: true });
  assert.ok(hits.includes('jantungmu'));
});

test('D-0b: resolveIsSkincareTarget detects skincare products, brands, and pillars accurately without false positives on cookware/herbal', () => {
  assert.equal(resolveIsSkincareTarget({ productName: 'Serum Niacinamide 10%' }), true);
  assert.equal(resolveIsSkincareTarget({ brandName: 'skinworld' }), true);
  assert.equal(resolveIsSkincareTarget({ contentPillar: 'Perawatan Kulit Wajah Berjerawat' }), true);
  assert.equal(resolveIsSkincareTarget({ category: 'Kosmetik & Skincare', productName: 'Toner Wajah' }), true);

  // Non-skincare negative checks
  assert.equal(resolveIsSkincareTarget({ category: 'Peralatan Dapur', productName: 'Wajan Anti Lengket', brandName: 'kawanrumah' }), false);
  assert.equal(resolveIsSkincareTarget({ productName: 'Wajan Kulit Lumpia', category: 'Alat Masak' }), false);
  assert.equal(resolveIsSkincareTarget({ productName: 'GarliBee Madu Bawang Lanang', brandName: 'dapurbotani' }), false);

  // Unified restricted target covers both herbal and skincare
  assert.equal(resolveIsClaimRestrictedTarget({ brandName: 'skinworld' }), true);
  assert.equal(resolveIsClaimRestrictedTarget({ brandName: 'dapurbotani', productName: 'Madu Herbal' }), true);
  assert.equal(resolveIsClaimRestrictedTarget({ brandName: 'kawanrumah', productName: 'Wajan Anti Lengket' }), false);
});

test('D-0b: Skincare/cosmetic BPOM claim list catches positive violations (including -mu/-nya/-ku) and passes safe phrases', async () => {
  const positiveSkincareViolations = [
    'Serum ini menghilangkan jerawatmu dengan cepat.',
    'Krim ini menyembuhkan jerawatnya tanpa bekas.',
    'Oleskan tipis untuk menghilangkan eksimku dan dermatitisnya.',
    'Toner ini menghilangkan flek hitamnya dan bekas lukamu.',
    'Formula ini memutihkan permanen sejak pemakaian awal.',
    'Jangan khawatir soal infeksi kulit dan antibiotik alami ini.',
    'Ini bukan obat biasa, ini terapi kulit paling ampuh.',
    'Kandungannya menumbuhkan kolagenmu serta menghilangkan kerutan permanen.',
    'Dapatkan hasil instan dalam 3 hari saja!'
  ];

  for (const text of positiveSkincareViolations) {
    const hits = findVoClaimViolations(text, { strict: true });
    assert.ok(hits.length > 0, `Harus mendeteksi klaim terlarang skincare pada: "${text}"`);
  }

  const positiveHerbalViolations = [
    'Madu ini membantu menurunkan kolesterolnya.',
    'Minum rutin agar jantungmu tetap sehat dan bebas diabetes.',
    'Detoks racun dari ginjalmu setiap malam.'
  ];
  for (const text of positiveHerbalViolations) {
    const hits = findVoClaimViolations(text, { strict: true });
    assert.ok(hits.length > 0, `Harus mendeteksi klaim terlarang herbal pada: "${text}"`);
  }

  const safeSkincarePhrases = [
    'Serum ringan ini membantu kulit tampak lebih cerah setiap pagi.',
    'Teksturnya cepat meresap dan efektif melembapkan kulit kering.',
    'Rutinitas malam bantu merawat skin barrier agar tetap nyaman.',
    'Setelah dua minggu pemakaian rutin, kulit terasa lebih halus dan lembap.',
    'Kenapa jerawat bisa muncul di area dagu? Yuk rawat kulit wajah dengan lembut.'
  ];
  for (const text of safeSkincarePhrases) {
    const hits = findVoClaimViolations(text, { strict: true });
    assert.deepEqual(hits, [], `Kalimat aman kosmetik tidak boleh terblokir: "${text}" -> hits=${JSON.stringify(hits)}`);
  }

  // Negative herbal phrases stay clean
  assert.deepEqual(
    findVoClaimViolations('Hangatkan malam keluarga dengan satu sendok madu bawang sebelum istirahat.', { strict: true }),
    []
  );
  assert.equal(resolveIsHerbalOrHealthTarget({ productName: 'Madu Herbal' }), true);

  // auditScriptForTikTok also rejects skincare claim violations cleanly even if AI passes
  const auditRes = await auditScriptForTikTok('Krim ini menghilangkan kerutan permanen dan menyembuhkan eksim.', '', {
    skipCooldown: true,
    aiAuditorFn: async () => ({ status: 'pass', verdict: 'pass', revised_script: [] })
  });
  assert.notEqual(auditRes.status, 'pass');
  assert.equal(auditRes.passed, false);
});

