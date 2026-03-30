import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConfigFromEnv, validateConfig } from '../src/config.ts';

test('accepts valid openai backend config', () => {
  const cfg = buildConfigFromEnv({
    LLM_BACKEND: 'openai',
    OPENAI_API_KEY: 'sk-test',
    DISCORD_TOKEN: 'discord-token',
    OPENCLAW_TIMEOUT_SEC: '45',
    OPENCLAW_AGENT_ID: 'main',
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
  });

  assert.equal(cfg.requireOpenAIForDiscord, false);
});

test('flags non-positive timeout and empty agent id', () => {
  const cfg = buildConfigFromEnv({
    OPENCLAW_TIMEOUT_SEC: '0',
    OPENCLAW_AGENT_ID: '   ',
  });

  const issues = validateConfig(cfg);
  assert.equal(issues.some((issue) => issue.includes('OPENCLAW_TIMEOUT_SEC')), true);
  assert.equal(issues.some((issue) => issue.includes('OPENCLAW_AGENT_ID')), true);
});
