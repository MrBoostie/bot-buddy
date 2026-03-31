import test from 'node:test';
import assert from 'node:assert/strict';
import { decideBoot, formatBootOpsLine } from '../src/boot.ts';

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

test('formats ops line with channel lock', () => {
  const line = formatBootOpsLine({
    llmBackend: 'openclaw',
    reloadCooldownSec: 30,
    channelLockId: '123456',
  });
  assert.equal(line, 'ops: backend=openclaw | reloadCooldownSec=30 | channelLock=on(123456)');
});

test('formats ops line without channel lock', () => {
  const line = formatBootOpsLine({
    llmBackend: 'openai',
    reloadCooldownSec: 45,
  });
  assert.equal(line, 'ops: backend=openai | reloadCooldownSec=45 | channelLock=off');
});
