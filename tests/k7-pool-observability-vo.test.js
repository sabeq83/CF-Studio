process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  isDbFlagOn,
  isDbFlagOff,
  normalizeComplianceScore,
  evaluateFreePoolQuotaBrake
} from '../lib/scheduler-processors.js';
import {
  sqliteToPgQuery,
  normalizePoolModelName,
  DEFAULT_POOL_MODEL,
  getGeminiQuotaDateStr,
  getGeminiQuotaResetWibInfo
} from '../lib/db.js';
import {
  __setGeminiTestHooks,
  executeWithKeyPool,
  runWithGeminiTrace,
  recordGeminiHttpCall,
  resolveStartFrameQcModel
} from '../lib/gemini.js';
import { calculateTokenCost } from '../lib/ai-token-meter.js';

after(() => {
  __setGeminiTestHooks(null);
  setTimeout(() => process.exit(0), 50);
});

test('K7.11: isDbFlagOn/Off handles Postgres bigint string "1"/"0", boolean & numeric', () => {
  assert.equal(isDbFlagOn('1'), true);
  assert.equal(isDbFlagOn(1), true);
  assert.equal(isDbFlagOn(true), true);
  assert.equal(isDbFlagOn('0'), false);
  assert.equal(isDbFlagOn(0), false);
  assert.equal(isDbFlagOn(null), false);

  assert.equal(isDbFlagOff('0'), true);
  assert.equal(isDbFlagOff(0), true);
  assert.equal(isDbFlagOff(false), true);
  assert.equal(isDbFlagOff('1'), false);
});

test('K7.11: normalizeComplianceScore converts risk_level strings to INTEGER (never "low")', () => {
  assert.equal(normalizeComplianceScore({ risk_level: 'low' }), 15);
  assert.equal(normalizeComplianceScore({ risk_level: 'medium' }), 55);
  assert.equal(normalizeComplianceScore({ risk_level: 'high' }), 85);
  assert.equal(normalizeComplianceScore({ risk_score: 'low' }), 15);
  assert.equal(normalizeComplianceScore({ risk_score: 72.4 }), 72);
  assert.equal(Number.isInteger(normalizeComplianceScore({ risk_level: 'low' })), true);
});

test('K7.11: updatePillarCampaignItem whitelist includes all 6 VO/compliance columns', () => {
  const dbSource = fs.readFileSync(path.join(process.cwd(), 'lib/db.js'), 'utf8');
  for (const col of [
    'original_voiceover',
    'tiktok_safe_voiceover',
    'compliance_status',
    'compliance_score',
    'compliance_log_json',
    'selected_vo_version'
  ]) {
    assert.ok(dbSource.includes(`'${col}'`), `updatePillarCampaignItem whitelist must include ${col}`);
  }
});

test('K7.10: sqliteToPgQuery maps api_key_usages conflict to (date, key_id, model_name)', () => {
  const sql = sqliteToPgQuery(
    'INSERT OR REPLACE INTO api_key_usages (date, key_id, model_name, count) VALUES (?, ?, ?, ?)'
  );
  assert.ok(sql.includes('ON CONFLICT (date, key_id, model_name) DO UPDATE SET count = EXCLUDED.count'));
  assert.equal(normalizePoolModelName(''), DEFAULT_POOL_MODEL);
  assert.equal(normalizePoolModelName('gemini-2.5-flash-lite'), 'gemini-2.5-flash-lite');
});

test('K7.10 Reviewer: Quota date follows America/Los_Angeles (automatic DST) instead of UTC', () => {
  // 10:00 WIB (03:00 UTC) pada 2026-11-14 masih 2026-11-13 19:00 PST
  const morningWib = new Date('2026-11-14T03:00:00Z');
  assert.equal(getGeminiQuotaDateStr(morningWib), '2026-11-13');
  const pstInfo = getGeminiQuotaResetWibInfo(morningWib);
  assert.equal(pstInfo.resetWib, '15:00 WIB');

  // 15:05 WIB (08:05 UTC) pada 2026-11-14 sudah masuk 2026-11-14 00:05 PST
  const afterResetPst = new Date('2026-11-14T08:05:00Z');
  assert.equal(getGeminiQuotaDateStr(afterResetPst), '2026-11-14');

  // Saat DST musim panas (PDT UTC-7), reset terjadi 14:00 WIB
  const summerWibMorning = new Date('2026-07-15T06:30:00Z'); // 13:30 WIB
  assert.equal(getGeminiQuotaDateStr(summerWibMorning), '2026-07-14');
  assert.equal(getGeminiQuotaResetWibInfo(summerWibMorning).resetWib, '14:00 WIB');
});

test('K7.10: evaluateFreePoolQuotaBrake pauses Free Pool below 15%, shows WIB reset, respects toggle & leaves Paid tier running', async () => {
  const paused = await evaluateFreePoolQuotaBrake({
    modelName: 'gemini-3.6-flash',
    getSettingFn: async (k) => (k === 'gemini_api_tier' ? 'free' : (k === 'gemini_quota_brake' ? 'on' : 'gemini-3.6-flash')),
    getPoolQuotaStatusFn: async () => ({
      model_name: 'gemini-3.6-flash',
      remaining: 2,
      total_capacity: 20,
      remaining_ratio: 0.1,
      reset_wib: '15:00 WIB',
      is_low_quota: true
    })
  });
  assert.equal(paused.paused, true);
  assert.ok(paused.reason.includes('<15%'));
  assert.ok(paused.reason.includes('15:00 WIB'));

  const brakeOff = await evaluateFreePoolQuotaBrake({
    modelName: 'gemini-3.6-flash',
    getSettingFn: async (k) => (k === 'gemini_quota_brake' ? 'off' : 'free'),
    getPoolQuotaStatusFn: async () => {
      throw new Error('Should skip quota pause when gemini_quota_brake is off');
    }
  });
  assert.equal(brakeOff.paused, false);
  assert.equal(brakeOff.brakeDisabled, true);

  const ok = await evaluateFreePoolQuotaBrake({
    modelName: 'gemini-3.6-flash',
    getSettingFn: async (k) => (k === 'gemini_quota_brake' ? 'on' : 'free'),
    getPoolQuotaStatusFn: async () => ({
      model_name: 'gemini-3.6-flash',
      remaining: 5,
      total_capacity: 20,
      remaining_ratio: 0.25,
      is_low_quota: false
    })
  });
  assert.equal(ok.paused, false);

  const paid = await evaluateFreePoolQuotaBrake({
    modelName: 'gemini-3.6-flash',
    getSettingFn: async (k) => (k === 'gemini_quota_brake' ? 'on' : 'paid'),
    getPoolQuotaStatusFn: async () => {
      throw new Error('Should not check quota on paid tier');
    }
  });
  assert.equal(paid.paused, false);
  assert.equal(paid.tier, 'paid');
});

test('K7.10 & K7.12: resolveStartFrameQcModel + recordGeminiHttpCall log [GEMINI_CALL], track exact (key,model) once per HTTP call, and write recordAiTokenUsage', async () => {
  const usageCalls = [];
  const tokenMeterCalls = [];
  const logLines = [];
  const origLog = console.log;
  console.log = (...args) => {
    logLines.push(args.join(' '));
  };

  try {
    let nextKeyIndex = 0;
    const mockKeys = [
      { id: 7, key_name: 'pool-key-7', api_key: 'TEST_MOCK_API_KEY_7' },
      { id: 9, key_name: 'pool-key-9', api_key: 'TEST_MOCK_API_KEY_9' }
    ];
    __setGeminiTestHooks({
      getSetting: (key) => {
        if (key === 'start_frame_visual_qc_model') return 'gemini-2.5-flash-lite';
        if (key === 'gemini_api_tier') return 'free';
        return null;
      },
      getAvailableApiKey: async () => mockKeys[nextKeyIndex++] || mockKeys[0],
      markApiKeyStatus: async () => {},
      markKeyExhausted: async () => {},
      incrementKeyUsage: async (keyId, cost, modelName) => {
        usageCalls.push({ keyId, cost, modelName });
      },
      recordAiTokenUsage: async (entry) => {
        tokenMeterCalls.push(entry);
      }
    });

    const qcModel = await resolveStartFrameQcModel();
    assert.equal(qcModel, 'gemini-2.5-flash-lite');

    await runWithGeminiTrace(
      { campaign_id: 99, item_id: 2140, stage: 'start_frame_visual_qc_batch', clip_index: 1 },
      () => executeWithKeyPool(1, async () => {
        await recordGeminiHttpCall({
          moduleName: 'start_frame_visual_qc_batch',
          modelName: 'gemini-2.5-flash-lite',
          attempt: 0,
          httpStatus: 503,
          ok: false,
          durationMs: 420,
          error: '503 Service Unavailable'
        });
        await recordGeminiHttpCall({
          moduleName: 'start_frame_visual_qc_batch',
          modelName: 'gemini-2.5-flash-lite',
          attempt: 1,
          httpStatus: 200,
          ok: true,
          durationMs: 650,
          usageMetadata: { promptTokenCount: 1500, candidatesTokenCount: 220, totalTokenCount: 1720 }
        });
      }, { modelName: qcModel })
    );

    await runWithGeminiTrace(
      { campaign_id: 99, item_id: 2140, stage: 'tts_generation' },
      () => executeWithKeyPool(1, async () => {
        await recordGeminiHttpCall({
          moduleName: 'gemini_tts_batch',
          modelName: 'gemini-2.5-flash-preview-tts',
          attempt: 0,
          httpStatus: 200,
          ok: true,
          durationMs: 810,
          usageMetadata: { promptTokenCount: 400, candidatesTokenCount: 120, totalTokenCount: 520 }
        });
      }, { modelName: 'gemini-2.5-flash-preview-tts' })
    );
  } finally {
    console.log = origLog;
    __setGeminiTestHooks(null);
  }

  // Both 503 attempt and 200 attempt + TTS call recorded per exact (key_id, model_name)
  assert.equal(usageCalls.length, 3);
  assert.deepEqual(usageCalls[0], { keyId: 7, cost: 1, modelName: 'gemini-2.5-flash-lite' });
  assert.deepEqual(usageCalls[1], { keyId: 7, cost: 1, modelName: 'gemini-2.5-flash-lite' });
  assert.deepEqual(usageCalls[2], { keyId: 9, cost: 1, modelName: 'gemini-2.5-flash-preview-tts' });

  // Token meter called for both Vision QC & TTS with pricing coverage
  assert.equal(tokenMeterCalls.length, 2);
  assert.equal(tokenMeterCalls[0].feature, 'start_frame_visual_qc_batch');
  assert.equal(tokenMeterCalls[0].meta.stage, 'start_frame_visual_qc_batch');
  assert.equal(tokenMeterCalls[1].model, 'gemini-2.5-flash-preview-tts');

  const liteCost = calculateTokenCost('gemini-2.5-flash-lite', 1_000_000, 1_000_000);
  const ttsCost = calculateTokenCost('gemini-2.5-flash-preview-tts', 1_000_000, 1_000_000);
  assert.ok(liteCost.costUsd > 0);
  assert.ok(ttsCost.costUsd > 0);

  // Structured [GEMINI_CALL] log emitted
  assert.equal(logLines.filter(l => l.includes('[GEMINI_CALL]')).length, 3);
  assert.ok(logLines.some(l => l.includes('status=503') && l.includes('model=gemini-2.5-flash-lite')));
  assert.ok(logLines.some(l => l.includes('status=200') && l.includes('model=gemini-2.5-flash-preview-tts')));
});

