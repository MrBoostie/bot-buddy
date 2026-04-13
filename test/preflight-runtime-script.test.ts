import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const REPO = '/home/openclaw/.openclaw/workspace/bot-buddy';

function runPreflight(env: Record<string, string>) {
  return spawnSync('node', ['--import', 'tsx', 'scripts/preflight-runtime.ts'], {
    cwd: REPO,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
      ...env,
    },
  });
}

test('preflight script exits 0 for valid runtime env', () => {
  const result = runPreflight({
    LLM_BACKEND: 'openclaw',
    OPENCLAW_AGENT_ID: 'main',
    OPENCLAW_TIMEOUT_SEC: '90',
    OPERATOR_RELOAD_COOLDOWN_SEC: '30',
    METRICS_SNAPSHOT_INTERVAL_SEC: '0',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /preflight: ok/);
  assert.match(result.stdout, /retryAttempts=0/);
  assert.match(result.stdout, /retryBaseDelayMs=250/);
  assert.match(result.stdout, /strictTools=false/);
});

test('preflight script exits non-zero and reports config issues', () => {
  const result = runPreflight({
    LLM_BACKEND: 'wat',
    OPENCLAW_AGENT_ID: '   ',
    OPENCLAW_TIMEOUT_SEC: '0',
    OPENCLAW_RETRY_ATTEMPTS: '6',
    OPENCLAW_RETRY_BASE_DELAY_MS: '5001',
    OPERATOR_RELOAD_COOLDOWN_SEC: '0',
    METRICS_SNAPSHOT_INTERVAL_SEC: '-1',
  });

  assert.notEqual(result.status, 0, 'expected non-zero exit for invalid env');
  assert.match(result.stderr, /preflight: issues detected/);
  assert.match(result.stderr, /LLM_BACKEND must be "openclaw" or "openai"/);
  assert.match(result.stderr, /OPENCLAW_AGENT_ID cannot be empty/);
  assert.match(result.stderr, /OPENCLAW_RETRY_ATTEMPTS must be a non-negative integer <= 5/);
  assert.match(result.stderr, /OPENCLAW_RETRY_BASE_DELAY_MS must be a positive number <= 5000/);
});

test('preflight strict tool checks pass when required command is available', () => {
  const result = runPreflight({
    PREFLIGHT_STRICT_TOOLS: 'true',
    PREFLIGHT_OPENCLAW_COMMAND: 'node',
    LLM_BACKEND: 'openclaw',
    OPENCLAW_AGENT_ID: 'main',
    OPENCLAW_TIMEOUT_SEC: '90',
    OPERATOR_RELOAD_COOLDOWN_SEC: '30',
    METRICS_SNAPSHOT_INTERVAL_SEC: '0',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /preflight: ok/);
  assert.match(result.stdout, /retryAttempts=0/);
  assert.match(result.stdout, /retryBaseDelayMs=250/);
  assert.match(result.stdout, /strictTools=true/);
});

test('preflight strict tool checks fail when openclaw CLI is unavailable', () => {
  const result = runPreflight({
    PREFLIGHT_STRICT_TOOLS: 'true',
    PREFLIGHT_OPENCLAW_COMMAND: '__definitely_missing_openclaw_binary__',
    LLM_BACKEND: 'openclaw',
    OPENCLAW_AGENT_ID: 'main',
    OPENCLAW_TIMEOUT_SEC: '90',
    OPERATOR_RELOAD_COOLDOWN_SEC: '30',
    METRICS_SNAPSHOT_INTERVAL_SEC: '0',
  });

  assert.notEqual(result.status, 0, 'expected non-zero exit when strict tool check fails');
  assert.match(
    result.stderr,
    /PREFLIGHT_STRICT_TOOLS=true and LLM_BACKEND=openclaw, but __definitely_missing_openclaw_binary__ CLI is unavailable in PATH/,
  );
});

test('preflight success output reflects configured retry policy values', () => {
  const result = runPreflight({
    LLM_BACKEND: 'openclaw',
    OPENCLAW_AGENT_ID: 'main',
    OPENCLAW_TIMEOUT_SEC: '90',
    OPENCLAW_RETRY_ATTEMPTS: '3',
    OPENCLAW_RETRY_BASE_DELAY_MS: '750',
    OPERATOR_RELOAD_COOLDOWN_SEC: '30',
    METRICS_SNAPSHOT_INTERVAL_SEC: '0',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /preflight: ok/);
  assert.match(result.stdout, /retryAttempts=3/);
  assert.match(result.stdout, /retryBaseDelayMs=750/);
});
