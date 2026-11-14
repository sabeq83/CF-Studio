import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildOpcStartFrameRequest,
  resolveOpcStartFrameModel,
  computeStartFrameFingerprint
} from '../lib/opc-start-frame-request.js';
import { fileToBase64 } from '../lib/cartoon-reference-resolver.js';

const TINY_PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aW0QAAAAASUVORK5CYII=';

test('Stylized 3D VI selects nano_banana_pro automatically for Start Frame', async () => {
  const campaign = {
    id: 'camp_stylized_1',
    aspect_ratio: '9:16',
    visual_style: 'stylized_3d_character',
    visual_overrides_json: JSON.stringify({
      structured: {
        subject: { kind: 'stylized_3d_character', universe_slug: 'kawan-rumah' },
        visual_language: { primary_style: 'stylized_3d_character' }
      }
    })
  };
  const item = { id: 'item_1', new_video_plan_json: '[]', result_json: '{}' };
  const req = await buildOpcStartFrameRequest({
    campaign,
    item,
    clipIndex: 1,
    prompt: 'Si Wajan and Sponge chatting by the sink',
    contextReferences: []
  });
  assert.equal(req.providerRequest.model, 'nano_banana_pro');
  assert.equal(req.audit.requested_model, 'nano_banana_pro');
  assert.equal(req.audit.effective_model, 'nano_banana_pro');
});

test('Multi-character cast or character/lineup references select nano_banana_pro', () => {
  assert.equal(
    resolveOpcStartFrameModel({
      campaign: {
        voice_cast_json: JSON.stringify({ characters: [{ id: 'a' }, { id: 'b' }] })
      }
    }),
    'nano_banana_pro'
  );
  assert.equal(
    resolveOpcStartFrameModel({
      campaign: {},
      references: [
        { name: 'char_a.jpg', data: TINY_PNG_DATA_URL },
        { name: 'char_b.jpg', data: TINY_PNG_DATA_URL }
      ]
    }),
    'nano_banana_pro'
  );
  assert.equal(
    resolveOpcStartFrameModel({
      campaign: {},
      references: [{ name: 'lineup_trio.jpg', data: TINY_PNG_DATA_URL }]
    }),
    'nano_banana_pro'
  );
});

test('Standard faceless / product / DapurBotani campaigns keep nano_banana_2 default', async () => {
  const campaign = {
    id: 'camp_dapurbotani',
    aspect_ratio: '9:16',
    visual_style: 'metaphoric_faceless',
    face_visibility: 'Faceless'
  };
  const item = { id: 'item_2', new_video_plan_json: '[]', result_json: '{}' };
  const req = await buildOpcStartFrameRequest({
    campaign,
    item,
    clipIndex: 1,
    prompt: 'Hands stirring garlic honey jar on warm wooden kitchen tabletop',
    contextReferences: []
  });
  assert.equal(req.providerRequest.model, 'nano_banana_2');
  assert.equal(req.audit.requested_model, 'nano_banana_2');
  assert.equal(req.audit.effective_model, 'nano_banana_2');
});

test('Explicit modelOverride & rebuildFingerprintForModel reflect actual model used', async () => {
  const campaign = {
    id: 'camp_ab_test',
    aspect_ratio: '9:16',
    visual_style: 'stylized_3d_character',
    visual_overrides_json: JSON.stringify({
      structured: { subject: { kind: 'stylized_3d_character' } }
    })
  };
  const item = { id: 'item_2183', new_video_plan_json: '[]', result_json: '{}' };

  const reqPro = await buildOpcStartFrameRequest({
    campaign,
    item,
    clipIndex: 1,
    prompt: 'Si Wajan at sink',
    modelOverride: 'nano_banana_pro'
  });
  const req2 = await buildOpcStartFrameRequest({
    campaign,
    item,
    clipIndex: 1,
    prompt: 'Si Wajan at sink',
    modelOverride: 'nano_banana_2'
  });

  assert.equal(reqPro.providerRequest.model, 'nano_banana_pro');
  assert.equal(req2.providerRequest.model, 'nano_banana_2');
  assert.notEqual(reqPro.audit.request_fingerprint, req2.audit.request_fingerprint);
  assert.equal(
    reqPro.rebuildFingerprintForModel('nano_banana_2'),
    req2.audit.request_fingerprint,
    'Fallback fingerprint to nano_banana_2 must match direct nano_banana_2 fingerprint'
  );
  assert.notEqual(
    computeStartFrameFingerprint({ clipIndex: 1, promptSha256: 'abc', model: 'nano_banana_pro' }),
    computeStartFrameFingerprint({ clipIndex: 1, promptSha256: 'abc', model: 'nano_banana_2' })
  );
});

test('Audit updater and fallback logging support effective_model and request_fingerprint', () => {
  const auditSrc = fs.readFileSync(new URL('../lib/opc-start-frame-audit.js', import.meta.url), 'utf8');
  const adapterSrc = fs.readFileSync(new URL('../lib/start-frame-provider-adapter.js', import.meta.url), 'utf8');
  const webhookSrc = fs.readFileSync(new URL('../lib/webhook-client.js', import.meta.url), 'utf8');

  assert.match(auditSrc, /'effective_model'/);
  assert.match(auditSrc, /'request_fingerprint'/);
  assert.match(adapterSrc, /\[StartFrame Model\] Clip/);
  assert.match(adapterSrc, /rebuildFingerprintForModel/);
  assert.match(webhookSrc, /taskFallbackInfoMap/);
});

test('fileToBase64 resolves leading-slash public web paths under <cwd>/public', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-ref-path-'));
  try {
    const refDir = path.join(tmpRoot, 'public', 'uploads', 'reference-assets', 't1', 'character', 'v3');
    fs.mkdirSync(refDir, { recursive: true });
    const imgPath = path.join(refDir, 'si_wajan.jpg');
    fs.writeFileSync(imgPath, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]));

    const b64 = fileToBase64('/uploads/reference-assets/t1/character/v3/si_wajan.jpg', tmpRoot);
    assert.ok(b64 && b64.startsWith('data:image/jpeg;base64,'), 'Must resolve /uploads/... relative to <cwd>/public');

    const b64Query = fileToBase64('/uploads/reference-assets/t1/character/v3/si_wajan.jpg?v=123', tmpRoot);
    assert.equal(b64Query, b64, 'Must strip URL query string when resolving local upload path');
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

