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
    metricsSummary: () => 'commands=0,llmOk=0,llmErr=0',
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
  assert.equal(result, 'diag: ok | hasDiscord=true | hasOpenAI=false | lastBackendError=none');
});

test('returns diag issues payload', () => {
  const result = evaluateOperatorCommand(
    '/diag',
    makeDeps({
      validateRuntime: () => ['bad env', 'missing key'],
      backendHealthSummary: () => 'openclaw timeout @ 2026-03-31T00:20:00.000Z',
    }),
  );
  assert.equal(
    result,
    'diag: issues detected -> bad env ; missing key | lastBackendError=openclaw timeout @ 2026-03-31T00:20:00.000Z',
  );
});

test('returns health payload in ok state', () => {
  const result = evaluateOperatorCommand('/health', makeDeps());
  assert.equal(
    result,
    'health | runtime=ok | issues=0 | discord=true | openai=false | backend=none | metrics=commands=0,llmOk=0,llmErr=0',
  );
});

test('returns health payload in degraded state', () => {
  const result = evaluateOperatorCommand(
    '/health',
    makeDeps({
      validateRuntime: () => ['bad env'],
      backendHealthSummary: () => 'timeout @ 2026-03-31T00:40:00.000Z',
      metricsSummary: () => 'commands=9,llmOk=7,llmErr=2',
    }),
  );
  assert.equal(
    result,
    'health | runtime=degraded | issues=1 | discord=true | openai=false | backend=timeout @ 2026-03-31T00:40:00.000Z | metrics=commands=9,llmOk=7,llmErr=2',
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

test('returns null for non-command input', () => {
  const result = evaluateOperatorCommand('hello bot', makeDeps());
  assert.equal(result, null);
});
