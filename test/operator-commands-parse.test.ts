import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAuditTailInput } from '../src/operator-commands.ts';

test('parseAuditTailInput defaults to configured limit', () => {
  const result = parseAuditTailInput('/audit-tail');
  assert.deepEqual(result, { ok: true, limit: 5 });
});

test('parseAuditTailInput accepts explicit limit with extra whitespace', () => {
  const result = parseAuditTailInput('  /audit-tail   12  ');
  assert.deepEqual(result, { ok: true, limit: 12 });
});

test('parseAuditTailInput rejects extra args', () => {
  const result = parseAuditTailInput('/audit-tail 3 extra');
  assert.deepEqual(result, { ok: false, reason: 'invalid-usage' });
});

test('parseAuditTailInput rejects invalid range', () => {
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

test('parseAuditTailInput rejects non-command input', () => {
  const result = parseAuditTailInput('/ping');
  assert.deepEqual(result, { ok: false, reason: 'invalid-usage' });
});
