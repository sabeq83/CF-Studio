import test from 'node:test';
import assert from 'node:assert/strict';
import pkg from 'pg';

process.env.DISABLE_AUTO_MIGRATIONS = 'true';
process.env.DISABLE_STARTUP_DB_CACHES = 'true';
process.env.ENABLE_BACKGROUND_SERVICES = 'false';

import {
  parseUtcDate,
  formatWibDateTime,
  formatWibTime,
  formatWibShortDateTime
} from '../lib/date-format.js';
import '../lib/db-pg.js';

const { types } = pkg;

test('parseUtcDate treats bare PostgreSQL TIMESTAMP WITHOUT TIME ZONE strings as UTC', () => {
  const parsed = parseUtcDate('2026-11-26 10:16:49.616942');
  assert.ok(parsed instanceof Date);
  assert.equal(parsed.toISOString(), '2026-11-26T10:16:49.616Z');

  const isoBare = parseUtcDate('2026-11-26T10:11:34');
  assert.equal(isoBare.toISOString(), '2026-11-26T10:11:34.000Z');
});

test('parseUtcDate preserves explicit offsets and handles invalid/null values', () => {
  const withOffset = parseUtcDate('2026-11-26T17:16:49+07:00');
  assert.equal(withOffset.toISOString(), '2026-11-26T10:16:49.000Z');
  assert.equal(parseUtcDate(null), null);
  assert.equal(parseUtcDate(''), null);
  assert.equal(parseUtcDate('not-a-date'), null);
});

test('db-pg registers OID 1114 parser to return UTC Date instead of local-shifted Date', () => {
  const parser1114 = types.getTypeParser(1114);
  const parsed = parser1114('2026-11-26 10:16:49.616942');
  assert.ok(parsed instanceof Date);
  assert.equal(parsed.toISOString(), '2026-11-26T10:16:49.616Z');
});

test('formatWibDateTime, formatWibTime, and formatWibShortDateTime always render GMT+7 (WIB)', () => {
  const utcIso = '2026-11-26T10:16:49.616Z';
  const full = formatWibDateTime(utcIso);
  const timeOnly = formatWibTime(utcIso);
  const shortText = formatWibShortDateTime(utcIso);

  assert.match(full, /26\/11\/2026/);
  assert.match(full, /17[.:]16[.:]49 WIB$/);
  assert.match(timeOnly, /17[.:]16[.:]49 WIB$/);
  assert.match(shortText, /26 Nov.*17[.:]16 WIB$/);
  assert.equal(formatWibDateTime(null), '-');
});
