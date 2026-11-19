import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { getUniverseManifest, getUniverseManifestAsync } from './universe-manifests.js';
import { isStylizedCharacterVisualConfig } from './visual-identity-contract.js';

const MAX_CHARACTER_REFS = 3;

export function createReferenceNotResolvedError(message, details = {}) {
  const err = new Error(message);
  err.code = 'REFERENCE_NOT_RESOLVED';
  err.details = details;
  return err;
}

function buildResolvedCharacterAssetRecord(key, charObj, loadedPath = null) {
  const ia = charObj?.identity_asset || null;
  const ir = charObj?.identity_reference || null;
  const source = ia?.source
    || (ir ? 'approved_asset' : (charObj?.identity_reference_path || charObj?.reference_image_path ? 'legacy_path' : 'unknown'));
  return {
    character_key: key,
    asset_id: ia?.asset_id || ir?.asset_id || null,
    version: ia?.version || ir?.version || charObj?.version || null,
    sha256: ia?.sha256 || ir?.sha256 || null,
    source,
    public_path: loadedPath || ia?.public_path || ir?.public_path || charObj?.identity_reference_path || charObj?.reference_image_path || null
  };
}

function safeParseJson(value, fallback = null) {
  if (!value) return fallback;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return typeof value === 'object' ? value : fallback;
}

export function extractClipCharacterIds({
  planEntry = null,
  voiceSegments = null,
  clipCharacters = []
} = {}) {
  const collected = [];
  const seen = new Set();
  const addId = (raw) => {
    if (!raw) return;
    const val = String(raw).trim();
    if (!val) return;
    const key = val.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    collected.push(val);
  };

  if (Array.isArray(clipCharacters) && clipCharacters.length > 0) {
    clipCharacters.forEach(addId);
  } else if (Array.isArray(planEntry?.characters) && planEntry.characters.length > 0) {
    planEntry.characters.forEach(addId);
  }

  if (collected.length === 0) {
    const segs = Array.isArray(voiceSegments)
      ? voiceSegments
      : (Array.isArray(planEntry?.voice_segments) ? planEntry.voice_segments : []);
    for (const seg of segs) {
      if (seg?.character_id) addId(seg.character_id);
    }
  }

  return collected;
}

export function hasStylizedUniverseLink({
  campaign = null,
  row = null,
  visualIdentitySnapshot = null,
  visualOverrides = null
} = {}) {
  const vi = safeParseJson(visualIdentitySnapshot)
    || safeParseJson(visualOverrides)
    || safeParseJson(campaign?.visual_overrides_json)
    || safeParseJson(row?.visual_overrides_json)
    || null;
  const structured = vi?.structured || vi || null;
  const viSubject = structured?.subject || {};

  const isCartoonWorld = campaign?.content_world === 'cartoon_universe' || row?.content_world === 'cartoon_universe';
  const isStylized = isCartoonWorld || isStylizedCharacterVisualConfig({ campaign, row, visualOverrides: vi });
  const universeProfileId = viSubject.universe_profile_id || null;
  const universeSlug = viSubject.universe_slug || campaign?.universe_profile || row?.universe_profile || null;
  const hasUniverseLink = Boolean(universeProfileId || universeSlug);

  return {
    isCartoonWorld,
    isStylized,
    hasUniverseLink,
    shouldResolveReferences: isCartoonWorld || (isStylized && hasUniverseLink),
    universeProfileId,
    universeSlug,
    fallbackCharacterKeys: Array.isArray(viSubject.character_keys) ? viSubject.character_keys : []
  };
}

export function fileToBase64(filePath, cwd = process.cwd()) {
  if (!filePath || typeof filePath !== 'string') return null;

  const cleanPath = filePath.trim().split('?')[0].split('#')[0];
  if (!cleanPath) return null;

  // Public web paths such as /uploads/... satisfy path.isAbsolute() on POSIX,
  // so always fall back to <cwd>/public/<rel> and <cwd>/<rel> when not on disk verbatim.
  const rel = cleanPath.replace(/^\/+/, '');
  const candidates = [
    cleanPath,
    path.join(cwd, 'public', rel),
    path.join(cwd, rel)
  ];

  let targetPath = null;
  for (const p of candidates) {
    if (p && fs.existsSync(p) && fs.statSync(p).isFile()) {
      targetPath = p;
      break;
    }
  }

  if (!targetPath) return null;
  try {
    const fileBuffer = fs.readFileSync(targetPath);
    const extensionName = path.extname(targetPath).toLowerCase();
    let mimeType = 'image/png';
    if (extensionName === '.jpg' || extensionName === '.jpeg') {
      mimeType = 'image/jpeg';
    } else if (extensionName === '.webp') {
      mimeType = 'image/webp';
    } else if (extensionName === '.gif') {
      mimeType = 'image/gif';
    }
    return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
  } catch (err) {
    console.error('[fileToBase64 Error]:', err.message);
    return null;
  }
}

/**
 * Downloads an image from HTTP or HTTPS and converts it to a base64 Data URL.
 */
export async function fetchUrlBase64(url) {
  if (!url || typeof url !== 'string' || (!url.startsWith('http://') && !url.startsWith('https://'))) return null;
  return new Promise((resolve) => {
    const transport = url.startsWith('https') ? https : http;
    const req = transport.get(url, { timeout: 10000 }, (res) => {
      if (res.statusCode !== 200) {
        console.warn(`[fetchUrlBase64] Failed to fetch image: status ${res.statusCode} for ${url}`);
        resolve(null);
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (!buffer.length) {
          resolve(null);
          return;
        }
        let mime = 'image/png';
        const rawUrl = url.split('?')[0].toLowerCase();
        if (rawUrl.endsWith('.jpg') || rawUrl.endsWith('.jpeg')) mime = 'image/jpeg';
        else if (rawUrl.endsWith('.webp')) mime = 'image/webp';
        else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) mime = 'image/jpeg';
        else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) mime = 'image/png';
        else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) mime = 'image/webp';
        resolve(`data:${mime};base64,${buffer.toString('base64')}`);
      });
    });
    req.on('error', (err) => {
      console.warn(`[fetchUrlBase64 Error] ${err.message}`);
      resolve(null);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * Universal resolver that handles both local file paths and remote URLs.
 */
export async function resolveImageToBase64(pathOrUrl) {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return null;
  if (pathOrUrl.startsWith('data:image/')) return pathOrUrl;
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return await fetchUrlBase64(pathOrUrl);
  }
  return fileToBase64(pathOrUrl);
}

/**
 * Asynchronously resolves reference images (base64 strings) for cartoon character, product, and style locks
 */
export async function resolveClipReferenceImagesAsync({
  contentWorld,
  universeProfile,
  universeProfileId = null,
  tenantId = null,
  universeSnapshot,
  visualIdentitySnapshot,
  clip,
  promptText, // Optional prompt string for text-based character scanning
  productReference, // Can be base64, path, or url
  productRevealBeat, // e.g. "beat_4" or "beat_5"
  clipCharacters = [], // From storyboard JSON
  voiceSegments = null,
  fallbackCharacterKeys = [],
  imageLoader = resolveImageToBase64
}) {
  const result = {
    characterReferences: [],
    characterKeysResolved: [],
    resolvedCharacterAssets: [],
    productReferences: [],
    styleReferences: [],
    lineupReferences: [],
    allReferences: []
  };

  const viParsed = safeParseJson(visualIdentitySnapshot);
  const viStructured = viParsed?.structured || viParsed || null;
  const viSubject = viStructured?.subject || {};
  const isStrictLock = viSubject.character_lock_mode === 'strict';
  const effectiveUniverseId = universeProfileId || viSubject.universe_profile_id || null;
  const effectiveUniverseSlug = universeProfile || viSubject.universe_slug || universeSnapshot?.manifest?.universe_profile || null;
  const isStylizedVI = isStylizedCharacterVisualConfig({ visualOverrides: viParsed });
  const shouldResolve = contentWorld === 'cartoon_universe'
    || (isStylizedVI && Boolean(effectiveUniverseSlug || effectiveUniverseId || universeSnapshot?.manifest))
    || (isStrictLock && Boolean(effectiveUniverseSlug || effectiveUniverseId || universeSnapshot?.manifest));

  if (!shouldResolve) {
    if (productReference) {
      const pBase64 = await imageLoader(productReference);
      if (pBase64) {
        result.productReferences.push(pBase64);
        result.allReferences.push(pBase64);
      }
    }
    return result;
  }

  // 1. Resolve Character references
  let manifest = universeSnapshot?.manifest;
  if (!manifest && (effectiveUniverseSlug || effectiveUniverseId)) {
    manifest = await getUniverseManifestAsync(effectiveUniverseSlug, {
      forceRefresh: true,
      universeId: effectiveUniverseId,
      tenantId
    });
  }
  if (!manifest && effectiveUniverseSlug) {
    manifest = getUniverseManifest(effectiveUniverseSlug, { tenantId });
  }

  if (isStrictLock && (!manifest || !manifest.characters)) {
    throw createReferenceNotResolvedError(
      'Character lock strict: universe manifest is missing or contains no characters.',
      { character_key: null, path: null, source: 'missing_manifest' }
    );
  }

  if (manifest && manifest.characters) {
    const resolvedCharKeys = [];
    const resolvedSet = new Set();
    const pushCharKey = (k) => {
      if (!k || !manifest.characters[k] || resolvedSet.has(k)) return;
      resolvedSet.add(k);
      resolvedCharKeys.push(k);
    };

    const matchCharacterKey = (raw) => {
      if (!raw) return null;
      const clean = String(raw).trim().toLowerCase();
      if (manifest.characters[clean]) return clean;
      for (const [k, charObj] of Object.entries(manifest.characters)) {
        if (k.toLowerCase() === clean || charObj.display_name?.toLowerCase() === clean) {
          return k;
        }
      }
      return null;
    };

    if (isStrictLock) {
      const rawAllowlist = Array.isArray(viSubject.character_keys)
        ? viSubject.character_keys.map(k => String(k || '').trim()).filter(Boolean)
        : [];
      if (rawAllowlist.length === 0) {
        throw createReferenceNotResolvedError(
          'Character lock strict: visual identity has no character_keys configured.',
          { character_key: null, path: null, source: 'empty_allowlist' }
        );
      }

      const allowlistKeys = [];
      const allowlistSet = new Set();
      for (const rawKey of rawAllowlist) {
        const matched = matchCharacterKey(rawKey);
        if (!matched) {
          throw createReferenceNotResolvedError(
            `Character lock strict: allowlist character_key "${rawKey}" not found in universe manifest.`,
            { character_key: rawKey, path: null, source: 'missing_in_manifest' }
          );
        }
        if (!allowlistSet.has(matched)) {
          allowlistSet.add(matched);
          allowlistKeys.push(matched);
        }
      }

      const requestedChars = extractClipCharacterIds({ clipCharacters, voiceSegments });
      for (const c of requestedChars) {
        const matched = matchCharacterKey(c);
        if (matched && allowlistSet.has(matched)) {
          pushCharKey(matched);
        }
      }

      // On strict mode, promptText scan ONLY accepts keys inside the allowlist
      if (promptText && typeof promptText === 'string') {
        const lowerPrompt = promptText.toLowerCase();
        for (const k of allowlistKeys) {
          const charObj = manifest.characters[k];
          const dName = (charObj?.display_name || '').toLowerCase();
          if ((dName && lowerPrompt.includes(dName)) || lowerPrompt.includes(k.toLowerCase())) {
            pushCharKey(k);
          }
        }
      }

      // If no allowlisted character was explicitly matched, fall back ONLY to first allowlist key
      if (resolvedCharKeys.length === 0) {
        pushCharKey(allowlistKeys[0]);
      }
    } else {
      const requestedChars = extractClipCharacterIds({ clipCharacters, voiceSegments });
      for (const c of requestedChars) {
        pushCharKey(matchCharacterKey(c));
      }

      // Also scan promptText for mentioned universe characters
      if (promptText && typeof promptText === 'string') {
        const lowerPrompt = promptText.toLowerCase();
        for (const [k, charObj] of Object.entries(manifest.characters)) {
          const dName = (charObj.display_name || '').toLowerCase();
          if ((dName && lowerPrompt.includes(dName)) || lowerPrompt.includes(k.toLowerCase())) {
            pushCharKey(k);
          }
        }
      }

      // Fallback to primary character (e.g., si_wajan or configured VI character_key) ONLY on stylized VI path
      // Preserve legacy cartoon_universe establishing shots when clipCharacters/voiceSegments/promptText are all empty
      if (resolvedCharKeys.length === 0 && (isStylizedVI || fallbackCharacterKeys.length > 0 || (viSubject.character_keys?.length > 0))) {
        const fallbackCandidates = [
          ...(Array.isArray(fallbackCharacterKeys) ? fallbackCharacterKeys : []),
          ...(Array.isArray(viSubject.character_keys) ? viSubject.character_keys : []),
          'si_wajan',
          ...Object.keys(manifest.characters)
        ];
        for (const candidate of fallbackCandidates) {
          const matched = matchCharacterKey(candidate);
          if (matched) {
            pushCharKey(matched);
            break;
          }
        }
      }
    }

    const cappedCharKeys = resolvedCharKeys.slice(0, MAX_CHARACTER_REFS);
    result.characterKeysResolved = cappedCharKeys;
    console.log(`[CharacterLock Async] Clip ${clip}: characters=${cappedCharKeys.join(',')} refs=${cappedCharKeys.length}${isStrictLock ? ' (strict)' : ''}`);

    for (const key of cappedCharKeys) {
      if (result.characterReferences.length >= MAX_CHARACTER_REFS) break;
      const char = manifest.characters[key];
      const identitySource = char?.identity_asset?.source || null;

      if (isStrictLock && identitySource === 'fabricated_path') {
        throw createReferenceNotResolvedError(
          `Character lock strict: fabricated reference path is not allowed for character "${key}".`,
          {
            character_key: key,
            path: char?.identity_asset?.public_path || char?.identity_reference_path || null,
            source: 'fabricated_path'
          }
        );
      }

      const candidates = [
        char.identity_asset?.public_path,
        char.identity_reference_path,
        char.character_sheet_reference_path,
        char.reference_image_path
      ].filter((p, idx, arr) => Boolean(p) && arr.indexOf(p) === idx);

      let loaded = null;
      let loadedPath = null;
      for (const imagePath of candidates) {
        loaded = await imageLoader(imagePath);
        if (loaded) {
          loadedPath = imagePath;
          break;
        }
      }
      if (loaded) {
        result.characterReferences.push(loaded);
        result.resolvedCharacterAssets.push(buildResolvedCharacterAssetRecord(key, char, loadedPath));
      } else if (isStrictLock) {
        throw createReferenceNotResolvedError(
          `Character lock strict: reference image could not be loaded for character "${key}".`,
          {
            character_key: key,
            path: candidates[0] || null,
            source: identitySource || 'missing_file'
          }
        );
      } else {
        console.warn(`[CharacterLock Warning] Reference image not found for character ${key} at: ${candidates[0]}`);
      }
    }
  }

  // 2. Resolve Product references
  const revealBeatNum = productRevealBeat === 'beat_5' ? 5 : (productRevealBeat === 'beat_4' ? 4 : 99);
  const isProductVisible = Number(clip) >= revealBeatNum;
  
  if (isProductVisible && productReference) {
    const pBase64 = await imageLoader(productReference);
    if (pBase64) {
      result.productReferences.push(pBase64);
    }
  }

  // 3. Style Reference & VI Lineup character_sheet (lowest priority scale/style ref)
  let stylePath = manifest?.style_reference_path || null;
  let lineupPath = null;
  const viAssets = Array.isArray(viParsed?.reference_assets) ? viParsed.reference_assets : [];

  const viStyle = viAssets.find(
    a => (!a.owner_type || a.owner_type === 'visual_identity') && (a.role === 'visual_style' || a.asset_role === 'visual_style') && (!a.status || a.status === 'approved')
  );
  if (viStyle?.public_path) {
    stylePath = viStyle.public_path;
  }

  const viLineupAsset = viAssets.find(
    a => (!a.owner_type || a.owner_type === 'visual_identity') && (a.role === 'character_sheet' || a.asset_role === 'character_sheet') && (!a.status || a.status === 'approved')
  );
  if (viLineupAsset?.public_path) {
    lineupPath = viLineupAsset.public_path;
  } else if (viParsed?.identity_ref?.id && viParsed.identity_ref.id !== 'inline' && !viAssets.length) {
    try {
      const { getApprovedReferenceAssets } = await import('./reference-asset-repository.js');
      const { tenantContext } = await import('./tenant-context.js');
      const dbAssets = await tenantContext.run(tenantId || '__none__', () => getApprovedReferenceAssets('visual_identity', viParsed.identity_ref.id, ['visual_style', 'character_sheet']));
      const dbStyle = dbAssets.find(a => a.asset_role === 'visual_style' && a.public_path);
      const dbLineup = dbAssets.find(a => a.asset_role === 'character_sheet' && a.public_path);
      if (!stylePath && dbStyle?.public_path) stylePath = dbStyle.public_path;
      if (dbLineup?.public_path) lineupPath = dbLineup.public_path;
    } catch (_) {}
  }

  if (stylePath) {
    const b64 = await imageLoader(stylePath);
    if (b64) {
      result.styleReferences.push(b64);
    }
  }

  if (lineupPath && lineupPath !== stylePath) {
    const lineupB64 = await imageLoader(lineupPath);
    if (lineupB64) {
      result.lineupReferences.push(lineupB64);
      if (result.styleReferences.length === 0) {
        result.styleReferences.push(lineupB64);
      }
    }
  }

  // 4. Combine and deduplicate all references (characters -> product -> style -> lineup at lowest priority)
  const allSet = new Set([
    ...result.characterReferences,
    ...result.productReferences,
    ...result.styleReferences,
    ...result.lineupReferences
  ]);
  result.allReferences = Array.from(allSet);

  return result;
}

/**
 * Synchronous resolver (preserved for backward compatibility with synchronous callers)
 */
export function resolveClipReferenceImages({
  contentWorld,
  universeProfile,
  tenantId = null,
  universeSnapshot,
  visualIdentitySnapshot,
  clip,
  promptText = null,
  productReference, // Can be base64 or path
  productRevealBeat, // e.g. "beat_4" or "beat_5"
  clipCharacters = [], // From storyboard JSON
  voiceSegments = null
}) {
  const result = {
    characterReferences: [],
    characterKeysResolved: [],
    resolvedCharacterAssets: [],
    productReferences: [],
    styleReferences: [],
    allReferences: []
  };

  const viParsed = safeParseJson(visualIdentitySnapshot);
  const viStructured = viParsed?.structured || viParsed || null;
  const viSubject = viStructured?.subject || {};
  const isStrictLock = viSubject.character_lock_mode === 'strict';
  const effectiveUniverseSlug = universeProfile || viSubject.universe_slug || universeSnapshot?.manifest?.universe_profile || null;

  if (contentWorld !== 'cartoon_universe' && !isStrictLock) {
    if (productReference) {
      const pBase64 = productReference.startsWith('data:') ? productReference : fileToBase64(productReference);
      if (pBase64) {
        result.productReferences.push(pBase64);
        result.allReferences.push(pBase64);
      }
    }
    return result;
  }

  // 1. Resolve Character references
  let manifest = universeSnapshot?.manifest;
  if (!manifest && effectiveUniverseSlug) {
    manifest = getUniverseManifest(effectiveUniverseSlug, { tenantId });
  }

  if (isStrictLock && (!manifest || !manifest.characters)) {
    throw createReferenceNotResolvedError(
      'Character lock strict: universe manifest is missing or contains no characters.',
      { character_key: null, path: null, source: 'missing_manifest' }
    );
  }

  if (manifest && manifest.characters) {
    if (isStrictLock) {
      const matchCharacterKey = (raw) => {
        if (!raw) return null;
        const clean = String(raw).trim().toLowerCase();
        if (manifest.characters[clean]) return clean;
        for (const [k, charObj] of Object.entries(manifest.characters)) {
          if (k.toLowerCase() === clean || charObj.display_name?.toLowerCase() === clean) {
            return k;
          }
        }
        return null;
      };

      const rawAllowlist = Array.isArray(viSubject.character_keys)
        ? viSubject.character_keys.map(k => String(k || '').trim()).filter(Boolean)
        : [];
      if (rawAllowlist.length === 0) {
        throw createReferenceNotResolvedError(
          'Character lock strict: visual identity has no character_keys configured.',
          { character_key: null, path: null, source: 'empty_allowlist' }
        );
      }

      const allowlistKeys = [];
      const allowlistSet = new Set();
      for (const rawKey of rawAllowlist) {
        const matched = matchCharacterKey(rawKey);
        if (!matched) {
          throw createReferenceNotResolvedError(
            `Character lock strict: allowlist character_key "${rawKey}" not found in universe manifest.`,
            { character_key: rawKey, path: null, source: 'missing_in_manifest' }
          );
        }
        if (!allowlistSet.has(matched)) {
          allowlistSet.add(matched);
          allowlistKeys.push(matched);
        }
      }

      const resolvedCharKeys = [];
      const resolvedSet = new Set();
      const pushKey = (k) => {
        if (!k || !allowlistSet.has(k) || resolvedSet.has(k)) return;
        resolvedSet.add(k);
        resolvedCharKeys.push(k);
      };

      const requestedChars = extractClipCharacterIds({ clipCharacters, voiceSegments });
      for (const c of requestedChars) {
        pushKey(matchCharacterKey(c));
      }
      if (promptText && typeof promptText === 'string') {
        const lowerPrompt = promptText.toLowerCase();
        for (const k of allowlistKeys) {
          const charObj = manifest.characters[k];
          const dName = (charObj?.display_name || '').toLowerCase();
          if ((dName && lowerPrompt.includes(dName)) || lowerPrompt.includes(k.toLowerCase())) {
            pushKey(k);
          }
        }
      }
      if (resolvedCharKeys.length === 0) {
        pushKey(allowlistKeys[0]);
      }

      const cappedCharKeys = resolvedCharKeys.slice(0, MAX_CHARACTER_REFS);
      result.characterKeysResolved = cappedCharKeys;
      console.log(`[CharacterLock] Clip ${clip}: characters=${cappedCharKeys.join(',')} refs=${cappedCharKeys.length} (strict)`);

      for (const key of cappedCharKeys) {
        const char = manifest.characters[key];
        const identitySource = char?.identity_asset?.source || null;
        if (identitySource === 'fabricated_path') {
          throw createReferenceNotResolvedError(
            `Character lock strict: fabricated reference path is not allowed for character "${key}".`,
            {
              character_key: key,
              path: char?.identity_asset?.public_path || char?.identity_reference_path || null,
              source: 'fabricated_path'
            }
          );
        }
        const imagePath = char.identity_asset?.public_path || char.identity_reference_path || char.reference_image_path;
        const b64 = imagePath?.startsWith?.('data:image/') ? imagePath : fileToBase64(imagePath);
        if (b64) {
          result.characterReferences.push(b64);
          result.resolvedCharacterAssets.push(buildResolvedCharacterAssetRecord(key, char, imagePath));
        } else {
          throw createReferenceNotResolvedError(
            `Character lock strict: reference image could not be loaded for character "${key}".`,
            {
              character_key: key,
              path: imagePath || null,
              source: identitySource || 'missing_file'
            }
          );
        }
      }
    } else {
      const resolvedCharKeys = new Set();
      clipCharacters.forEach(c => {
        const clean = c.trim().toLowerCase();
        // Only resolve character if present in manifest characters list
        if (manifest.characters[clean]) {
          resolvedCharKeys.add(clean);
        }
      });

      // Deduplicate and maintain stable sorting
      const sortedCharKeys = Array.from(resolvedCharKeys).sort();
      result.characterKeysResolved = sortedCharKeys;

      // Log resolution path safely (no base64 or sensitive data)
      console.log(`[CharacterLock] Clip ${clip}: characters=${sortedCharKeys.join(',')} refs=${sortedCharKeys.length}`);

      for (const key of sortedCharKeys) {
        const char = manifest.characters[key];
        const imagePath = char.identity_reference_path || char.reference_image_path;
        const b64 = fileToBase64(imagePath);
        if (b64) {
          result.characterReferences.push(b64);
          result.resolvedCharacterAssets.push(buildResolvedCharacterAssetRecord(key, char, imagePath));
        } else {
          console.warn(`[CharacterLock Warning] Reference image not found for character ${key} at: ${imagePath}`);
        }
      }
    }
  }

  // 2. Resolve Product references
  // Only visible on or after reveal beat
  const revealBeatNum = productRevealBeat === 'beat_5' ? 5 : (productRevealBeat === 'beat_4' ? 4 : 99);
  const isProductVisible = Number(clip) >= revealBeatNum;
  
  if (isProductVisible && productReference) {
    const pBase64 = productReference.startsWith('data:') ? productReference : fileToBase64(productReference);
    if (pBase64) {
      result.productReferences.push(pBase64);
    }
  }

  // 3. Style Reference
  let stylePath = manifest?.style_reference_path;
  if (visualIdentitySnapshot?.reference_assets) {
    const viStyle = visualIdentitySnapshot.reference_assets.find(
      a => a.owner_type === 'visual_identity' && a.role === 'visual_style'
    );
    if (viStyle?.public_path) {
      stylePath = viStyle.public_path;
    }
  }

  if (stylePath) {
    const b64 = fileToBase64(stylePath);
    if (b64) {
      result.styleReferences.push(b64);
    }
  }

  // 4. Combine and deduplicate all references
  const allSet = new Set([
    ...result.characterReferences,
    ...result.productReferences,
    ...result.styleReferences
  ]);
  result.allReferences = Array.from(allSet);

  return result;
}
