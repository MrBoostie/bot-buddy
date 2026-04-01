import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAuditTailInput, parseUnsignedIntInRange } from '../src/operator-commands.ts';

test('parseUnsignedIntInRange accepts in-range digits', () => {
  const result = parseUnsignedIntInRange('12', 1, 20);
  assert.deepEqual(result, { ok: true, value: 12 });
});

test('parseUnsignedIntInRange rejects non-digit tokens', () => {
  const result = parseUnsignedIntInRange('2.5', 1, 20);
  assert.deepEqual(result, { ok: false, reason: 'invalid-number' });
});

test('parseUnsignedIntInRange rejects out-of-range digits', () => {
  const result = parseUnsignedIntInRange('21', 1, 20);
  assert.deepEqual(result, { ok: false, reason: 'out-of-range' });
});

test('parseUnsignedIntInRange table-driven edge coverage', () => {
  const cases: Array<{
    raw: string;
    min: number;
    max: number;
    expected:
      | { ok: true; value: number }
      | { ok: false; reason: 'invalid-number' | 'out-of-range' };
  }> = [
    { raw: '1', min: 1, max: 20, expected: { ok: true, value: 1 } },
    { raw: '20', min: 1, max: 20, expected: { ok: true, value: 20 } },
    { raw: '0007', min: 1, max: 20, expected: { ok: true, value: 7 } },
    { raw: '0', min: 1, max: 20, expected: { ok: false, reason: 'out-of-range' } },
    { raw: '21', min: 1, max: 20, expected: { ok: false, reason: 'out-of-range' } },
    { raw: ' 7', min: 1, max: 20, expected: { ok: false, reason: 'invalid-number' } },
    { raw: '７', min: 1, max: 20, expected: { ok: false, reason: 'invalid-number' } },
  ];

  for (const tc of cases) {
    assert.deepEqual(parseUnsignedIntInRange(tc.raw, tc.min, tc.max), tc.expected);
  }
});

test('parseAuditTailInput defaults to configured limit', () => {
  const result = parseAuditTailInput('/audit-tail');
  assert.deepEqual(result, { ok: true, limit: 5 });
});

test('parseAuditTailInput treats blank trailing argument spacing as default limit', () => {
  const result = parseAuditTailInput('/audit-tail    ');
  assert.deepEqual(result, { ok: true, limit: 5 });
});

test('parseAuditTailInput accepts explicit limit with extra whitespace', () => {
  const result = parseAuditTailInput('  /audit-tail   12  ');
  assert.deepEqual(result, { ok: true, limit: 12 });
});

test('parseAuditTailInput accepts tab/newline whitespace around arguments', () => {
  const result = parseAuditTailInput('\n\t/audit-tail\t7\n');
  assert.deepEqual(result, { ok: true, limit: 7 });
});

test('parseAuditTailInput accepts mixed-case command tokens', () => {
  const result = parseAuditTailInput('/AuDiT-TaIl 7');
  assert.deepEqual(result, { ok: true, limit: 7 });
});

test('parseAuditTailInput rejects extra args', () => {
  const result = parseAuditTailInput('/audit-tail 3 extra');
  assert.deepEqual(result, { ok: false, reason: 'invalid-usage' });
});

test('parseAuditTailInput accepts max in-range value', () => {
  const result = parseAuditTailInput('/audit-tail 20');
  assert.deepEqual(result, { ok: true, limit: 20 });
});

test('parseAuditTailInput rejects value above max range', () => {
  const result = parseAuditTailInput('/audit-tail 21');
  assert.deepEqual(result, { ok: false, reason: 'invalid-limit' });
});

test('parseAuditTailInput rejects negative values', () => {
  const result = parseAuditTailInput('/audit-tail -1');
  assert.deepEqual(result, { ok: false, reason: 'invalid-limit' });
});

test('parseAuditTailInput rejects decimal values', () => {
  const result = parseAuditTailInput('/audit-tail 2.5');
  assert.deepEqual(result, { ok: false, reason: 'invalid-limit' });
});

test('parseAuditTailInput rejects plus-signed values', () => {
  const result = parseAuditTailInput('/audit-tail +3');
  assert.deepEqual(result, { ok: false, reason: 'invalid-limit' });
});

test('parseAuditTailInput accepts leading-zero values', () => {
  const result = parseAuditTailInput('/audit-tail 03');
  assert.deepEqual(result, { ok: true, limit: 3 });
});

test('parseAuditTailInput rejects zero-padded out-of-range values', () => {
  const result = parseAuditTailInput('/audit-tail 021');
  assert.deepEqual(result, { ok: false, reason: 'invalid-limit' });
});

test('parseAuditTailInput rejects zero value even when zero-padded', () => {
  const result = parseAuditTailInput('/audit-tail 000');
  assert.deepEqual(result, { ok: false, reason: 'invalid-limit' });
});

test('parseAuditTailInput rejects very large numeric values', () => {
  const result = parseAuditTailInput('/audit-tail 999999999999');
  assert.deepEqual(result, { ok: false, reason: 'invalid-limit' });
});

test('parseAuditTailInput rejects non-ascii digit input', () => {
  const result = parseAuditTailInput('/audit-tail １２');
  assert.deepEqual(result, { ok: false, reason: 'invalid-limit' });
});

test('parseAuditTailInput rejects non-command input', () => {
  const result = parseAuditTailInput('/ping');
  assert.deepEqual(result, { ok: false, reason: 'invalid-usage' });
});
