import fs from 'fs';
import os from 'os';
import path from 'path';

const FONT_METRICS_CACHE = new Map();
let fontconfigInitialized = false;

/**
 * Ensures local OFL fonts in public/fonts/ are registered via FONTCONFIG_FILE
 * so Sharp / librsvg renders Anton, Montserrat Black/ExtraBold, and Inter deterministically.
 */
export function ensureMotionFontsRegistered() {
  const fontsDir = path.join(process.cwd(), 'public', 'fonts');
  if (!fs.existsSync(fontsDir)) {
    return { registered: false, fontsDir, configPath: null };
  }

  if (fontconfigInitialized && process.env.FONTCONFIG_FILE && fs.existsSync(process.env.FONTCONFIG_FILE)) {
    return { registered: true, fontsDir, configPath: process.env.FONTCONFIG_FILE };
  }

  const runtimeDir = path.join(os.tmpdir(), 'cfstudio-fontconfig');
  const cacheDir = path.join(runtimeDir, 'cache');
  fs.mkdirSync(cacheDir, { recursive: true });

  const configPath = path.join(runtimeDir, 'fonts.conf');
  const xmlSafeFontsDir = fontsDir.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const xmlSafeCacheDir = cacheDir.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const confXml = [
    '<?xml version="1.0"?>',
    '<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">',
    '<fontconfig>',
    '  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>',
    '  <include ignore_missing="yes">/opt/homebrew/etc/fonts/fonts.conf</include>',
    `  <dir>${xmlSafeFontsDir}</dir>`,
    `  <cachedir>${xmlSafeCacheDir}</cachedir>`,
    '</fontconfig>',
    ''
  ].join('\n');

  fs.writeFileSync(configPath, confXml, 'utf8');
  process.env.FONTCONFIG_FILE = configPath;
  process.env.FONTCONFIG_PATH = runtimeDir;
  if (!process.env.PANGOCAIRO_BACKEND) {
    process.env.PANGOCAIRO_BACKEND = 'fc';
  }
  fontconfigInitialized = true;

  return { registered: true, fontsDir, configPath };
}

/**
 * Parses TrueType cmap (format 4/12), head, hhea, maxp, and hmtx tables so text widths
 * can be measured against the actual local OFL font without spawning a headless browser.
 */
function loadTtfMetrics(fontFileName) {
  const fontPath = path.join(process.cwd(), 'public', 'fonts', fontFileName);
  if (FONT_METRICS_CACHE.has(fontPath)) {
    return FONT_METRICS_CACHE.get(fontPath);
  }
  if (!fs.existsSync(fontPath)) {
    return null;
  }

  const buf = fs.readFileSync(fontPath);
  const numTables = buf.readUInt16BE(4);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const recOff = 12 + i * 16;
    const tag = buf.toString('ascii', recOff, recOff + 4);
    tables[tag] = {
      offset: buf.readUInt32BE(recOff + 8),
      length: buf.readUInt32BE(recOff + 12)
    };
  }

  if (!tables.head || !tables.hhea || !tables.maxp || !tables.hmtx || !tables.cmap) {
    return null;
  }

  const unitsPerEm = buf.readUInt16BE(tables.head.offset + 18);
  const numberOfHMetrics = buf.readUInt16BE(tables.hhea.offset + 34);
  const numGlyphs = buf.readUInt16BE(tables.maxp.offset + 4);

  const advanceWidths = new Uint16Array(numGlyphs);
  const hmtxOff = tables.hmtx.offset;
  let lastAdvance = 500;
  for (let i = 0; i < numberOfHMetrics && i < numGlyphs; i++) {
    lastAdvance = buf.readUInt16BE(hmtxOff + i * 4);
    advanceWidths[i] = lastAdvance;
  }
  for (let i = numberOfHMetrics; i < numGlyphs; i++) {
    advanceWidths[i] = lastAdvance;
  }

  const cmapBase = tables.cmap.offset;
  const subtableCount = buf.readUInt16BE(cmapBase + 2);
  let chosenSubtableOff = 0;
  let chosenFormat = 0;

  for (let i = 0; i < subtableCount; i++) {
    const rec = cmapBase + 4 + i * 8;
    const platformId = buf.readUInt16BE(rec);
    const encodingId = buf.readUInt16BE(rec + 2);
    const subOff = cmapBase + buf.readUInt32BE(rec + 4);
    const fmt = buf.readUInt16BE(subOff);
    if ((platformId === 3 && (encodingId === 10 || encodingId === 1)) || platformId === 0) {
      if (fmt === 12) {
        chosenSubtableOff = subOff;
        chosenFormat = 12;
        break;
      }
      if (fmt === 4 && !chosenSubtableOff) {
        chosenSubtableOff = subOff;
        chosenFormat = 4;
      }
    }
  }

  const glyphLookup = buildGlyphLookup(buf, chosenSubtableOff, chosenFormat);
  const metrics = { unitsPerEm, advanceWidths, glyphLookup };
  FONT_METRICS_CACHE.set(fontPath, metrics);
  return metrics;
}

function buildGlyphLookup(buf, subOff, format) {
  if (!subOff) return () => 0;

  if (format === 12) {
    const numGroups = buf.readUInt32BE(subOff + 12);
    const groups = [];
    for (let i = 0; i < numGroups; i++) {
      const gOff = subOff + 16 + i * 12;
      groups.push({
        start: buf.readUInt32BE(gOff),
        end: buf.readUInt32BE(gOff + 4),
        startGlyph: buf.readUInt32BE(gOff + 8)
      });
    }
    return (cp) => {
      for (const g of groups) {
        if (cp >= g.start && cp <= g.end) {
          return g.startGlyph + (cp - g.start);
        }
      }
      return 0;
    };
  }

  if (format === 4) {
    const segCountX2 = buf.readUInt16BE(subOff + 6);
    const segCount = segCountX2 / 2;
    const endCodeBase = subOff + 14;
    const startCodeBase = endCodeBase + segCountX2 + 2;
    const idDeltaBase = startCodeBase + segCountX2;
    const idRangeOffsetBase = idDeltaBase + segCountX2;

    const segments = [];
    for (let i = 0; i < segCount; i++) {
      segments.push({
        end: buf.readUInt16BE(endCodeBase + i * 2),
        start: buf.readUInt16BE(startCodeBase + i * 2),
        idDelta: buf.readInt16BE(idDeltaBase + i * 2),
        idRangeOffsetPos: idRangeOffsetBase + i * 2,
        idRangeOffset: buf.readUInt16BE(idRangeOffsetBase + i * 2)
      });
    }

    return (cp) => {
      if (cp > 0xffff) return 0;
      for (const seg of segments) {
        if (cp >= seg.start && cp <= seg.end) {
          if (seg.idRangeOffset === 0) {
            return (cp + seg.idDelta) & 0xffff;
          }
          const glyphOffset = seg.idRangeOffsetPos + seg.idRangeOffset + 2 * (cp - seg.start);
          const gid = glyphOffset + 2 <= buf.length ? buf.readUInt16BE(glyphOffset) : 0;
          return gid === 0 ? 0 : (gid + seg.idDelta) & 0xffff;
        }
      }
      return 0;
    };
  }

  return () => 0;
}

/**
 * Measures rendered pixel width for a string using the actual local OFL TTF advance widths
 * plus optional SVG letter-spacing (in px).
 */
export function measureFontTextWidth(fontFileName, fontSizePx, text, letterSpacingPx = 0) {
  const str = String(text || '');
  if (!str || !fontSizePx) return 0;

  const metrics = loadTtfMetrics(fontFileName);
  if (!metrics) {
    return str.length * fontSizePx * 0.56 + Math.max(0, str.length - 1) * letterSpacingPx;
  }

  const chars = Array.from(str);
  let totalUnits = 0;
  for (const ch of chars) {
    const cp = ch.codePointAt(0);
    const gid = metrics.glyphLookup(cp);
    const adv = metrics.advanceWidths[gid] || metrics.advanceWidths[0] || Math.round(metrics.unitsPerEm * 0.5);
    totalUnits += adv;
  }

  const glyphWidth = (totalUnits / metrics.unitsPerEm) * fontSizePx;
  const trackingWidth = Math.max(0, chars.length - 1) * letterSpacingPx;
  return glyphWidth + trackingWidth;
}
