import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConfigFromEnv, runtimeModelLabel, validateConfig } from '../src/config.ts';

test('accepts valid openai backend config', () => {
  const cfg = buildConfigFromEnv({
    LLM_BACKEND: 'openai',
    OPENAI_API_KEY: 'sk-test',
    DISCORD_TOKEN: 'discord-token',
    OPENCLAW_TIMEOUT_SEC: '45',
    OPENCLAW_AGENT_ID: 'main',
    OPERATOR_RELOAD_COOLDOWN_SEC: '30',
    METRICS_SNAPSHOT_INTERVAL_SEC: '0',
  });

  const issues = validateConfig(cfg);
  assert.deepEqual(issues, []);
});

test('flags invalid backend value', () => {
  const cfg = buildConfigFromEnv({
    LLM_BACKEND: 'wat',
  });

  const issues = validateConfig(cfg);
  assert.equal(issues.some((issue) => issue.includes('LLM_BACKEND must be')), true);
});

test('flags missing OpenAI key only when required for openai discord mode', () => {
  const cfg = buildConfigFromEnv({
    LLM_BACKEND: 'openai',
    DISCORD_TOKEN: 'discord-token',
    REQUIRE_OPENAI_FOR_DISCORD: 'true',
  });

  const issues = validateConfig(cfg);
  assert.equal(issues.some((issue) => issue.includes('OPENAI_API_KEY is missing')), true);
});

test('boolean parser supports yes/no style values', () => {
  const cfg = buildConfigFromEnv({
    REQUIRE_OPENAI_FOR_DISCORD: 'no',
    ALLOW_METRICS_RESET: 'yes',
    ALLOW_AUDIT_TAIL: 'true',
    METRICS_SNAPSHOT_INTERVAL_SEC: '60',
  });

  assert.equal(cfg.requireOpenAIForDiscord, false);
  assert.equal(cfg.allowMetricsReset, true);
  assert.equal(cfg.allowAuditTail, true);
  assert.equal(cfg.metricsSnapshotIntervalSec, 60);
});

test('flags non-positive timeout, empty agent id, invalid reload cooldown, and invalid metrics snapshot interval', () => {
  const cfg = buildConfigFromEnv({
    OPENCLAW_TIMEOUT_SEC: '0',
    OPENCLAW_AGENT_ID: '   ',
    OPERATOR_RELOAD_COOLDOWN_SEC: '0',
    METRICS_SNAPSHOT_INTERVAL_SEC: '-1',
  });

  const issues = validateConfig(cfg);
  assert.equal(issues.some((issue) => issue.includes('OPENCLAW_TIMEOUT_SEC')), true);
  assert.equal(issues.some((issue) => issue.includes('OPENCLAW_AGENT_ID')), true);
  assert.equal(issues.some((issue) => issue.includes('OPERATOR_RELOAD_COOLDOWN_SEC')), true);
  assert.equal(issues.some((issue) => issue.includes('METRICS_SNAPSHOT_INTERVAL_SEC')), true);
});

test('runtimeModelLabel uses openclaw agent label in openclaw mode', () => {
  const cfg = buildConfigFromEnv({
    LLM_BACKEND: 'openclaw',
    OPENCLAW_AGENT_ID: 'gremlin',
    OPENAI_MODEL: 'gpt-4.1-mini',
  });

  assert.equal(runtimeModelLabel(cfg), 'openclaw:gremlin');
});

test('runtimeModelLabel trims openclaw agent label and falls back to unknown when empty', () => {
  const cfg = buildConfigFromEnv({
    LLM_BACKEND: 'openclaw',
    OPENCLAW_AGENT_ID: '   ',
  });

  assert.equal(runtimeModelLabel(cfg), 'openclaw:unknown');
});

test('runtimeModelLabel uses openai model in openai mode', () => {
  const cfg = buildConfigFromEnv({
    LLM_BACKEND: 'openai',
    OPENAI_MODEL: 'gpt-4o-mini',
    OPENCLAW_AGENT_ID: 'main',
  });

  assert.equal(runtimeModelLabel(cfg), 'gpt-4o-mini');
});
