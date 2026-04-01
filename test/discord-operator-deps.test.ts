import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOperatorCommandDeps, formatAppVersionLog, resolveAppVersionInfo } from '../src/discord.ts';
import { config } from '../src/config.ts';

test('buildOperatorCommandDeps reports consistent openclaw backend and model label', () => {
  const prevBackend = config.llmBackend;
  const prevAgent = config.openclawAgentId;
  const prevModel = config.openaiModel;

  config.llmBackend = 'openclaw';
  config.openclawAgentId = 'gremlin';
  config.openaiModel = 'gpt-4o-mini';

  try {
    const deps = buildOperatorCommandDeps();
    assert.equal(deps.llmBackend(), 'openclaw');
    assert.equal(deps.modelName(), 'openclaw:gremlin');
  } finally {
    config.llmBackend = prevBackend;
    config.openclawAgentId = prevAgent;
    config.openaiModel = prevModel;
  }
});

test('buildOperatorCommandDeps reports consistent openai backend and model label', () => {
  const prevBackend = config.llmBackend;
  const prevAgent = config.openclawAgentId;
  const prevModel = config.openaiModel;

  config.llmBackend = 'openai';
  config.openclawAgentId = 'main';
  config.openaiModel = 'gpt-4.1-mini';

  try {
    const deps = buildOperatorCommandDeps();
    assert.equal(deps.llmBackend(), 'openai');
    assert.equal(deps.modelName(), 'gpt-4.1-mini');
  } finally {
    config.llmBackend = prevBackend;
    config.openclawAgentId = prevAgent;
    config.openaiModel = prevModel;
  }
});

test('buildOperatorCommandDeps remains runtime-consistent across config mutation', () => {
  const prevBackend = config.llmBackend;
  const prevAgent = config.openclawAgentId;
  const prevModel = config.openaiModel;

  try {
    const deps = buildOperatorCommandDeps();

    config.llmBackend = 'openclaw';
    config.openclawAgentId = 'gremlin';
    config.openaiModel = 'gpt-4.1-mini';

    assert.equal(deps.llmBackend(), 'openclaw');
    assert.equal(deps.modelName(), 'openclaw:gremlin');
    assert.match(deps.runtimeSummary(), /llmBackend=openclaw/);
    assert.match(deps.runtimeSummary(), /openclawAgent=gremlin/);

    config.llmBackend = 'openai';
    config.openaiModel = 'gpt-4o-mini';

    assert.equal(deps.llmBackend(), 'openai');
    assert.equal(deps.modelName(), 'gpt-4o-mini');
    assert.match(deps.runtimeSummary(), /llmBackend=openai/);
  } finally {
    config.llmBackend = prevBackend;
    config.openclawAgentId = prevAgent;
    config.openaiModel = prevModel;
  }
});

test('buildOperatorCommandDeps appVersion prefers BOT_BUDDY_VERSION over npm_package_version', () => {
  const prevExplicit = process.env.BOT_BUDDY_VERSION;
  const prevNpm = process.env.npm_package_version;

  process.env.BOT_BUDDY_VERSION = '2.0.0-custom';
  process.env.npm_package_version = '1.2.3';

  try {
    const deps = buildOperatorCommandDeps();
    assert.equal(deps.appVersion(), '2.0.0-custom');
  } finally {
    if (prevExplicit === undefined) delete process.env.BOT_BUDDY_VERSION;
    else process.env.BOT_BUDDY_VERSION = prevExplicit;

    if (prevNpm === undefined) delete process.env.npm_package_version;
    else process.env.npm_package_version = prevNpm;
  }
});

test('buildOperatorCommandDeps appVersion falls back to unknown when no version env is set', () => {
  const prevExplicit = process.env.BOT_BUDDY_VERSION;
  const prevNpm = process.env.npm_package_version;

  delete process.env.BOT_BUDDY_VERSION;
  delete process.env.npm_package_version;

  try {
    const deps = buildOperatorCommandDeps();
    assert.equal(deps.appVersion(), 'unknown');
  } finally {
    if (prevExplicit === undefined) delete process.env.BOT_BUDDY_VERSION;
    else process.env.BOT_BUDDY_VERSION = prevExplicit;

    if (prevNpm === undefined) delete process.env.npm_package_version;
    else process.env.npm_package_version = prevNpm;
  }
});

test('resolveAppVersionInfo reports BOT_BUDDY_VERSION source when set', () => {
  const prevExplicit = process.env.BOT_BUDDY_VERSION;
  const prevNpm = process.env.npm_package_version;

  process.env.BOT_BUDDY_VERSION = '9.9.9-local';
  process.env.npm_package_version = '1.0.0';

  try {
    assert.deepEqual(resolveAppVersionInfo(), {
      value: '9.9.9-local',
      source: 'BOT_BUDDY_VERSION',
    });
  } finally {
    if (prevExplicit === undefined) delete process.env.BOT_BUDDY_VERSION;
    else process.env.BOT_BUDDY_VERSION = prevExplicit;

    if (prevNpm === undefined) delete process.env.npm_package_version;
    else process.env.npm_package_version = prevNpm;
  }
});

test('resolveAppVersionInfo reports npm_package_version source when explicit version is unset', () => {
  const prevExplicit = process.env.BOT_BUDDY_VERSION;
  const prevNpm = process.env.npm_package_version;

  delete process.env.BOT_BUDDY_VERSION;
  process.env.npm_package_version = '1.2.3';

  try {
    assert.deepEqual(resolveAppVersionInfo(), {
      value: '1.2.3',
      source: 'npm_package_version',
    });
  } finally {
    if (prevExplicit === undefined) delete process.env.BOT_BUDDY_VERSION;
    else process.env.BOT_BUDDY_VERSION = prevExplicit;

    if (prevNpm === undefined) delete process.env.npm_package_version;
    else process.env.npm_package_version = prevNpm;
  }
});

test('resolveAppVersionInfo reports unknown source when no version env is set', () => {
  const prevExplicit = process.env.BOT_BUDDY_VERSION;
  const prevNpm = process.env.npm_package_version;

  delete process.env.BOT_BUDDY_VERSION;
  delete process.env.npm_package_version;

  try {
    assert.deepEqual(resolveAppVersionInfo(), {
      value: 'unknown',
      source: 'unknown',
    });
  } finally {
    if (prevExplicit === undefined) delete process.env.BOT_BUDDY_VERSION;
    else process.env.BOT_BUDDY_VERSION = prevExplicit;

    if (prevNpm === undefined) delete process.env.npm_package_version;
    else process.env.npm_package_version = prevNpm;
  }
});

test('formatAppVersionLog renders stable key-value startup log contract', () => {
  assert.equal(
    formatAppVersionLog({
      value: '2.4.1',
      source: 'BOT_BUDDY_VERSION',
    }),
    'app version | value=2.4.1 | source=BOT_BUDDY_VERSION',
  );
});

test('formatAppVersionLog renders unknown-source payload consistently', () => {
  assert.equal(
    formatAppVersionLog({
      value: 'unknown',
      source: 'unknown',
    }),
    'app version | value=unknown | source=unknown',
  );
});
