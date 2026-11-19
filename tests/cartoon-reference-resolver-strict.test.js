import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DISABLE_STARTUP_DB_CACHES = 'true';

const {
  resolveClipReferenceImagesAsync,
  resolveClipReferenceImages
} = await import('../lib/cartoon-reference-resolver.js');
const { buildOpcStartFrameRequest } = await import('../lib/opc-start-frame-request.js');

function makeTempPng(dir, name, fillByte) {
  const buf = Buffer.concat([
    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
    Buffer.alloc(120, fillByte)
  ]);
  const fullPath = path.join(dir, name);
  fs.writeFileSync(fullPath, buf);
  return { fullPath, b64: `data:image/png;base64,${buf.toString('base64')}` };
}

test('B4 strict async: ignores prompt/clip mention of Maya, resolves only allowlisted Arka, emits resolvedCharacterAssets', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-strict-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const arkaImg = makeTempPng(dir, 'arka.png', 0x11);
  const mayaImg = makeTempPng(dir, 'maya.png', 0x22);

  const universeSnapshot = {
    manifest: {
      universe_profile: 'ruang-akustik-id',
      characters: {
        maya: {
          display_name: 'Maya',
          identity_reference_path: mayaImg.fullPath,
          identity_asset: {
            asset_id: 'ref_maya_1',
            version: 1,
            sha256: 'sha_maya_1',
            public_path: mayaImg.fullPath,
            source: 'approved_asset'
          }
        },
        arka_acoustic_consultant: {
          display_name: 'Arka',
          identity_reference_path: arkaImg.fullPath,
          identity_asset: {
            asset_id: 'ref_arka_1',
            version: 2,
            sha256: 'sha_arka_2',
            public_path: arkaImg.fullPath,
            source: 'approved_asset'
          }
        }
      }
    }
  };

  const strictVi = {
    structured: {
      subject: {
        kind: 'stylized_3d_character',
        universe_profile_id: 'univ_ra_1',
        universe_slug: 'ruang-akustik-id',
        character_keys: ['arka_acoustic_consultant'],
        character_lock_mode: 'strict'
      },
      visual_language: { primary_style: 'stylized_3d_character' }
    }
  };

  // Even when promptText and clipCharacters mention Maya, strict mode MUST only resolve Arka!
  const res = await resolveClipReferenceImagesAsync({
    contentWorld: 'general',
    universeProfile: 'ruang-akustik-id',
    universeSnapshot,
    visualIdentitySnapshot: strictVi,
    clip: 1,
    promptText: 'Maya explains acoustic absorption panels in a studio room',
    clipCharacters: ['maya'],
    voiceSegments: [{ character_id: 'maya', text: 'Halo dari Maya' }]
  });

  assert.deepEqual(res.characterKeysResolved, ['arka_acoustic_consultant']);
  assert.equal(res.characterReferences.length, 1);
  assert.equal(res.characterReferences[0], arkaImg.b64);
  assert.equal(res.resolvedCharacterAssets.length, 1);
  assert.deepEqual(res.resolvedCharacterAssets[0], {
    character_key: 'arka_acoustic_consultant',
    asset_id: 'ref_arka_1',
    version: 2,
    sha256: 'sha_arka_2',
    source: 'approved_asset',
    public_path: arkaImg.fullPath
  });
});

test('B4 strict async & sync: rejects missing key, missing image file, and fabricated_path with REFERENCE_NOT_RESOLVED', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-strict-err-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const mayaImg = makeTempPng(dir, 'maya.png', 0x22);

  // 1. Key not in manifest -> must NOT fall back to Maya / si_wajan / first char
  const viMissingKey = {
    structured: {
      subject: {
        kind: 'stylized_3d_character',
        universe_slug: 'ruang-akustik-id',
        character_keys: ['arka_acoustic_consultant'],
        character_lock_mode: 'strict'
      },
      visual_language: { primary_style: 'stylized_3d_character' }
    }
  };
  const snapOnlyMaya = {
    manifest: {
      universe_profile: 'ruang-akustik-id',
      characters: {
        maya: { display_name: 'Maya', identity_reference_path: mayaImg.fullPath }
      }
    }
  };

  await assert.rejects(
    () => resolveClipReferenceImagesAsync({
      contentWorld: 'general',
      universeProfile: 'ruang-akustik-id',
      universeSnapshot: snapOnlyMaya,
      visualIdentitySnapshot: viMissingKey,
      clip: 1
    }),
    (err) => err.code === 'REFERENCE_NOT_RESOLVED' && err.details?.character_key === 'arka_acoustic_consultant'
  );

  assert.throws(
    () => resolveClipReferenceImages({
      contentWorld: 'cartoon_universe',
      universeProfile: 'ruang-akustik-id',
      universeSnapshot: snapOnlyMaya,
      visualIdentitySnapshot: viMissingKey,
      clip: 1
    }),
    (err) => err.code === 'REFERENCE_NOT_RESOLVED' && err.details?.character_key === 'arka_acoustic_consultant'
  );

  // 2. fabricated_path is rejected even if a file existed
  const snapFabricated = {
    manifest: {
      universe_profile: 'ruang-akustik-id',
      characters: {
        arka_acoustic_consultant: {
          display_name: 'Arka',
          identity_reference_path: mayaImg.fullPath,
          identity_asset: {
            public_path: mayaImg.fullPath,
            source: 'fabricated_path'
          }
        }
      }
    }
  };

  await assert.rejects(
    () => resolveClipReferenceImagesAsync({
      contentWorld: 'general',
      universeProfile: 'ruang-akustik-id',
      universeSnapshot: snapFabricated,
      visualIdentitySnapshot: viMissingKey,
      clip: 1
    }),
    (err) => err.code === 'REFERENCE_NOT_RESOLVED' && err.details?.source === 'fabricated_path'
  );

  assert.throws(
    () => resolveClipReferenceImages({
      contentWorld: 'cartoon_universe',
      universeProfile: 'ruang-akustik-id',
      universeSnapshot: snapFabricated,
      visualIdentitySnapshot: viMissingKey,
      clip: 1
    }),
    (err) => err.code === 'REFERENCE_NOT_RESOLVED' && err.details?.source === 'fabricated_path'
  );

  // 3. Missing image on disk throws REFERENCE_NOT_RESOLVED (not swallowed)
  const snapMissingFile = {
    manifest: {
      universe_profile: 'ruang-akustik-id',
      characters: {
        arka_acoustic_consultant: {
          display_name: 'Arka',
          identity_reference_path: path.join(dir, 'does-not-exist.png'),
          identity_asset: {
            asset_id: 'ref_missing',
            version: 1,
            sha256: 'sha_x',
            public_path: path.join(dir, 'does-not-exist.png'),
            source: 'approved_asset'
          }
        }
      }
    }
  };

  await assert.rejects(
    () => resolveClipReferenceImagesAsync({
      contentWorld: 'general',
      universeProfile: 'ruang-akustik-id',
      universeSnapshot: snapMissingFile,
      visualIdentitySnapshot: viMissingKey,
      clip: 1
    }),
    (err) => err.code === 'REFERENCE_NOT_RESOLVED' && err.details?.character_key === 'arka_acoustic_consultant'
  );

  // 4. R4: buildOpcStartFrameRequest must NOT swallow REFERENCE_NOT_RESOLVED
  await assert.rejects(
    () => buildOpcStartFrameRequest({
      campaign: {
        id: 'camp_strict_1',
        content_world: 'general',
        universe_profile: 'ruang-akustik-id',
        universe_snapshot_json: JSON.stringify(snapMissingFile),
        visual_overrides_json: JSON.stringify(viMissingKey),
        aspect_ratio: '9:16'
      },
      item: {
        id: 'item_strict_1',
        new_video_plan_json: JSON.stringify([{ clip_index: 1, characters: ['arka_acoustic_consultant'] }])
      },
      clipIndex: 1,
      prompt: 'Arka stands in acoustic studio'
    }),
    (err) => err.code === 'REFERENCE_NOT_RESOLVED'
  );
});

test('B4 non-strict: preserves exact legacy fallback (si_wajan / prompt scan / PawVille)', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-nonstrict-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const wajanImg = makeTempPng(dir, 'wajan.png', 0x44);

  const snap = {
    manifest: {
      universe_profile: 'kawan-rumah',
      characters: {
        si_wajan: {
          display_name: 'Si Wajan',
          identity_reference_path: wajanImg.fullPath
        }
      }
    }
  };

  const legacyVi = {
    structured: {
      subject: {
        kind: 'stylized_3d_character',
        universe_slug: 'kawan-rumah',
        character_keys: []
      },
      visual_language: { primary_style: 'stylized_3d_character' }
    }
  };

  const res = await resolveClipReferenceImagesAsync({
    contentWorld: 'general',
    universeProfile: 'kawan-rumah',
    universeSnapshot: snap,
    visualIdentitySnapshot: legacyVi,
    clip: 1,
    promptText: 'Warm empty kitchen counter',
    clipCharacters: []
  });

  assert.deepEqual(res.characterKeysResolved, ['si_wajan']);
  assert.equal(res.characterReferences[0], wajanImg.b64);

  // Sync strict happy path too
  const arkaImg = makeTempPng(dir, 'arka_sync.png', 0x55);
  const syncStrictRes = resolveClipReferenceImages({
    contentWorld: 'cartoon_universe',
    universeProfile: 'ruang-akustik-id',
    universeSnapshot: {
      manifest: {
        universe_profile: 'ruang-akustik-id',
        characters: {
          maya: { display_name: 'Maya', identity_reference_path: wajanImg.fullPath },
          arka_acoustic_consultant: {
            display_name: 'Arka',
            identity_reference_path: arkaImg.fullPath,
            identity_asset: {
              asset_id: 'ref_sync_1',
              version: 1,
              sha256: 'sha_sync_1',
              public_path: arkaImg.fullPath,
              source: 'approved_asset'
            }
          }
        }
      }
    },
    visualIdentitySnapshot: {
      structured: {
        subject: {
          kind: 'stylized_3d_character',
          universe_slug: 'ruang-akustik-id',
          character_keys: ['arka_acoustic_consultant'],
          character_lock_mode: 'strict'
        }
      }
    },
    clip: 1,
    promptText: 'Maya speaks about acoustic foam',
    clipCharacters: ['maya']
  });
  assert.deepEqual(syncStrictRes.characterKeysResolved, ['arka_acoustic_consultant']);
  assert.equal(syncStrictRes.characterReferences[0], arkaImg.b64);
  assert.equal(syncStrictRes.resolvedCharacterAssets[0].asset_id, 'ref_sync_1');
});
