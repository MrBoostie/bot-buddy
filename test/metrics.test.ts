import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getMetricsSummary,
  incrementCommandCount,
  incrementLlmErrorCount,
  incrementLlmSuccessCount,
  recordCommandLatencyMs,
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
  recordCommandLatencyMs(15);
  recordCommandLatencyMs(30);

  assert.equal(
    getMetricsSummary(),
    'commands=2,llmCalls=2,llmOk=1,llmErr=1,llmAvgMs=250,llmRecentMaxMs=300,llmLt250Ms=1,llm250To1000Ms=1,llmGt1000Ms=0,cmdAvgMs=23,cmdRecentMaxMs=30',
  );
});

test('recent max latency uses rolling window', () => {
  resetMetricsForTests();

  for (let i = 1; i <= 25; i += 1) {
    recordLlmLatencyMs(i * 10);
  }

  const summary = getMetricsSummary();
  assert.equal(summary.includes('llmRecentMaxMs=250'), true);
});
