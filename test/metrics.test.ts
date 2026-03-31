import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getMetricsSummary,
  incrementCommandCount,
  incrementLlmErrorCount,
  incrementLlmSuccessCount,
  recordLlmLatencyMs,
  resetMetricsForTests,
} from '../src/metrics.ts';

test('metrics summary reflects counter increments', () => {
  resetMetricsForTests();
  incrementCommandCount();
  incrementCommandCount();
  incrementLlmSuccessCount();
  incrementLlmErrorCount();
  recordLlmLatencyMs(200);
  recordLlmLatencyMs(300);

  assert.equal(getMetricsSummary(), 'commands=2,llmOk=1,llmErr=1,llmAvgMs=250');
});
