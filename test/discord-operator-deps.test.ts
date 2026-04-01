import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOperatorCommandDeps } from '../src/discord.ts';
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
