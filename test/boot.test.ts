import test from 'node:test';
import assert from 'node:assert/strict';
import { decideBoot } from '../src/boot.ts';

test('returns invalid-config decision when issues exist', () => {
  const decision = decideBoot(['bad env'], true);
  assert.deepEqual(decision, {
    kind: 'exit-invalid-config',
    exitCode: 1,
    issues: ['bad env'],
  });
});

test('returns local-cli-hint when discord token missing and config is valid', () => {
  const decision = decideBoot([], false);
  assert.deepEqual(decision, { kind: 'local-cli-hint' });
});

test('returns start-discord when config is valid and discord token exists', () => {
  const decision = decideBoot([], true);
  assert.deepEqual(decision, { kind: 'start-discord' });
});
