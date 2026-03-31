import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMetricsSnapshot, resetMetricsSnapshotStateForTests } from '../src/metrics-snapshot.ts';

test('emits first snapshot', () => {
  resetMetricsSnapshotStateForTests();
  const result = evaluateMetricsSnapshot('a=1');
  assert.deepEqual(result, { emit: true, summary: 'a=1', suppressedBeforeEmit: 0 });
});

test('suppresses unchanged snapshots', () => {
  resetMetricsSnapshotStateForTests();
  evaluateMetricsSnapshot('a=1');
  const second = evaluateMetricsSnapshot('a=1');
  assert.deepEqual(second, { emit: false });
});

test('emits changed snapshot with suppressed count', () => {
  resetMetricsSnapshotStateForTests();
  evaluateMetricsSnapshot('a=1');
  evaluateMetricsSnapshot('a=1');
  evaluateMetricsSnapshot('a=1');

  const changed = evaluateMetricsSnapshot('a=2');
  assert.deepEqual(changed, { emit: true, summary: 'a=2', suppressedBeforeEmit: 2 });
});
