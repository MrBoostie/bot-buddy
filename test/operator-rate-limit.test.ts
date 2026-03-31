import test from 'node:test';
import assert from 'node:assert/strict';
import { resetReloadGateForTests, tryAcquireReload } from '../src/operator-rate-limit.ts';

test('first reload attempt is allowed', () => {
  resetReloadGateForTests();
  const result = tryAcquireReload(1_000);
  assert.deepEqual(result, { ok: true });
});

test('second reload attempt during cooldown is rejected', () => {
  resetReloadGateForTests();
  tryAcquireReload(1_000);
  const result = tryAcquireReload(5_000);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.retryAfterSec > 0, true);
  }
});

test('reload allowed again after cooldown', () => {
  resetReloadGateForTests();
  tryAcquireReload(1_000);
  const result = tryAcquireReload(40_000);
  assert.deepEqual(result, { ok: true });
});

test('supports custom cooldown override for deterministic checks', () => {
  resetReloadGateForTests();
  tryAcquireReload(1_000, 5_000);
  const blocked = tryAcquireReload(5_500, 5_000);
  assert.equal(blocked.ok, false);

  const allowed = tryAcquireReload(6_100, 5_000);
  assert.deepEqual(allowed, { ok: true });
});
