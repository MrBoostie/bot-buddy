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
    ...overrides,
  };
}

test('returns status payload', () => {
  const result = evaluateOperatorCommand('/status', makeDeps());
  assert.equal(
    result,
    'status: online | uptime=12s | model=gpt-test | bot=buddy | llmBackend=openclaw',
  );
});

test('returns diag ok payload', () => {
  const result = evaluateOperatorCommand('/diag', makeDeps());
  assert.equal(result, 'diag: ok | hasDiscord=true | hasOpenAI=false');
});

test('returns diag issues payload', () => {
  const result = evaluateOperatorCommand(
    '/diag',
    makeDeps({ validateRuntime: () => ['bad env', 'missing key'] }),
  );
  assert.equal(result, 'diag: issues detected -> bad env ; missing key');
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
