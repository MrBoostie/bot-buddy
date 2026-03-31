import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOperatorCommand, type OperatorCommandDeps } from '../src/operator-commands.ts';

function makeDeps(overrides: Partial<OperatorCommandDeps> = {}): OperatorCommandDeps {
  return {
    formatUptime: () => '12s',
    modelName: () => 'gpt-test',
    runtimeSummary: () => 'bot=buddy | llmBackend=openclaw',
    validateRuntime: () => [],
    refreshConfigFromEnv: () => {},
    hasDiscord: () => true,
    hasOpenAI: () => false,
    backendHealthSummary: () => 'none',
    tryAcquireReload: () => ({ ok: true }),
    metricsSummary: () => 'commands=0,llmCalls=0,llmOk=0,llmErr=0,llmAvgMs=0,llmRecentMaxMs=0,llmLt250Ms=0,llm250To1000Ms=0,llmGt1000Ms=0,cmdAvgMs=0,cmdRecentMaxMs=0',
    allowMetricsReset: () => false,
    resetMetrics: () => {},
    allowAuditTail: () => false,
    getAuditTail: () => 'none',
    ...overrides,
  };
}

test('returns ping payload', () => {
  const result = evaluateOperatorCommand('/ping', makeDeps());
  assert.equal(result, 'pong | uptime=12s | model=gpt-test');
});

test('returns status payload', () => {
  const result = evaluateOperatorCommand('/status', makeDeps());
  assert.equal(
    result,
    'status: online | uptime=12s | model=gpt-test | bot=buddy | llmBackend=openclaw',
  );
});

test('returns diag ok payload', () => {
  const result = evaluateOperatorCommand('/diag', makeDeps());
  assert.equal(
    result,
    'diag: ok | hasDiscord=true | hasOpenAI=false | allowMetricsReset=false | allowAuditTail=false | lastBackendError=none',
  );
});

test('returns diag issues payload', () => {
  const result = evaluateOperatorCommand(
    '/diag',
    makeDeps({
      validateRuntime: () => ['bad env', 'missing key'],
      backendHealthSummary: () => 'openclaw timeout @ 2026-03-31T00:20:00.000Z',
      allowMetricsReset: () => true,
      allowAuditTail: () => true,
    }),
  );
  assert.equal(
    result,
    'diag: issues detected -> bad env ; missing key | allowMetricsReset=true | allowAuditTail=true | lastBackendError=openclaw timeout @ 2026-03-31T00:20:00.000Z',
  );
});

test('returns health payload in ok state', () => {
  const result = evaluateOperatorCommand('/health', makeDeps());
  assert.equal(
    result,
    'health | runtime=ok | issues=0 | discord=true | openai=false | backend=none | metrics=commands=0,llmCalls=0,llmOk=0,llmErr=0,llmAvgMs=0,llmRecentMaxMs=0,llmLt250Ms=0,llm250To1000Ms=0,llmGt1000Ms=0,cmdAvgMs=0,cmdRecentMaxMs=0',
  );
});

test('returns health payload in degraded state', () => {
  const result = evaluateOperatorCommand(
    '/health',
    makeDeps({
      validateRuntime: () => ['bad env'],
      backendHealthSummary: () => 'timeout @ 2026-03-31T00:40:00.000Z',
      metricsSummary: () => 'commands=9,llmCalls=9,llmOk=7,llmErr=2,llmAvgMs=423,llmRecentMaxMs=1100,llmLt250Ms=2,llm250To1000Ms=6,llmGt1000Ms=1,cmdAvgMs=14,cmdRecentMaxMs=22',
    }),
  );
  assert.equal(
    result,
    'health | runtime=degraded | issues=1 | discord=true | openai=false | backend=timeout @ 2026-03-31T00:40:00.000Z | metrics=commands=9,llmCalls=9,llmOk=7,llmErr=2,llmAvgMs=423,llmRecentMaxMs=1100,llmLt250Ms=2,llm250To1000Ms=6,llmGt1000Ms=1,cmdAvgMs=14,cmdRecentMaxMs=22',
  );
});

test('runs reload and returns success payload', () => {
  let reloadCalls = 0;
  const result = evaluateOperatorCommand(
    '/reload',
    makeDeps({
      refreshConfigFromEnv: () => {
        reloadCalls += 1;
      },
    }),
  );

  assert.equal(reloadCalls, 1);
  assert.equal(result, 'reload: applied | bot=buddy | llmBackend=openclaw');
});

test('returns reload rate-limit payload and skips refresh', () => {
  let reloadCalls = 0;
  const result = evaluateOperatorCommand(
    '/reload',
    makeDeps({
      tryAcquireReload: () => ({ ok: false, retryAfterSec: 12 }),
      refreshConfigFromEnv: () => {
        reloadCalls += 1;
      },
    }),
  );

  assert.equal(reloadCalls, 0);
  assert.equal(result, 'reload: rate-limited | retryAfterSec=12');
});

test('runs reload and returns issues payload when validation fails', () => {
  let reloadCalls = 0;
  const result = evaluateOperatorCommand(
    '/reload',
    makeDeps({
      refreshConfigFromEnv: () => {
        reloadCalls += 1;
      },
      validateRuntime: () => ['still broken'],
    }),
  );

  assert.equal(reloadCalls, 1);
  assert.equal(result, 'reload: applied, but issues remain -> still broken');
});

test('returns metrics-reset disabled payload when guard is off', () => {
  const result = evaluateOperatorCommand('/metrics-reset', makeDeps());
  assert.equal(result, 'metrics-reset: disabled (set ALLOW_METRICS_RESET=true to enable)');
});

test('resets metrics when metrics-reset guard is on', () => {
  let resetCalls = 0;
  const result = evaluateOperatorCommand(
    '/metrics-reset',
    makeDeps({
      allowMetricsReset: () => true,
      resetMetrics: () => {
        resetCalls += 1;
      },
      metricsSummary: () => 'commands=0,llmCalls=0,llmOk=0,llmErr=0,llmAvgMs=0,llmRecentMaxMs=0,llmLt250Ms=0,llm250To1000Ms=0,llmGt1000Ms=0,cmdAvgMs=0,cmdRecentMaxMs=0',
    }),
  );

  assert.equal(resetCalls, 1);
  assert.equal(
    result,
    'metrics-reset: ok | commands=0,llmCalls=0,llmOk=0,llmErr=0,llmAvgMs=0,llmRecentMaxMs=0,llmLt250Ms=0,llm250To1000Ms=0,llmGt1000Ms=0,cmdAvgMs=0,cmdRecentMaxMs=0',
  );
});

test('returns audit-tail disabled payload when guard is off', () => {
  const result = evaluateOperatorCommand('/audit-tail', makeDeps());
  assert.equal(result, 'audit-tail: disabled (set ALLOW_AUDIT_TAIL=true to enable)');
});

test('returns audit tail when guard is on', () => {
  const result = evaluateOperatorCommand(
    '/audit-tail',
    makeDeps({
      allowAuditTail: () => true,
      getAuditTail: () => '2026-03-31T03:30:00.000Z operator metrics reset executed',
    }),
  );
  assert.equal(result, 'audit-tail: 2026-03-31T03:30:00.000Z operator metrics reset executed');
});

test('returns null for non-command input', () => {
  const result = evaluateOperatorCommand('hello bot', makeDeps());
  assert.equal(result, null);
});
