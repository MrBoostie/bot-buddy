import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyOpenClawExecError,
  computeOpenClawRetryDelayMs,
  isRetryableOpenClawExecError,
  parseOpenClawAgentOutput,
  thinkWithOpenClaw,
} from '../src/brain.ts';
import { config } from '../src/config.ts';

test('parses successful openclaw output with concatenated payload text', () => {
  const text = parseOpenClawAgentOutput(
    JSON.stringify({
      status: 'ok',
      result: { payloads: [{ text: 'hello' }, { text: 'world' }] },
    }),
  );

  assert.equal(text, 'hello\nworld');
});

test('returns thinking fallback when payload text is empty', () => {
  const text = parseOpenClawAgentOutput(
    JSON.stringify({
      status: 'ok',
      result: { payloads: [{ text: '   ' }, { text: null }] },
    }),
  );

  assert.equal(text, '...thinking noises...');
});

test('throws on non-ok status', () => {
  assert.throws(
    () => parseOpenClawAgentOutput(JSON.stringify({ status: 'error' })),
    /openclaw agent failed with status=error/,
  );
});

test('parses json payload when stdout includes leading non-json log lines', () => {
  const text = parseOpenClawAgentOutput(
    [
      'warning: transient CLI notice',
      JSON.stringify({
        status: 'ok',
        result: { payloads: [{ text: 'hello from json line' }] },
      }),
    ].join('\n'),
  );

  assert.equal(text, 'hello from json line');
});

test('throws clear error on malformed JSON', () => {
  assert.throws(
    () => parseOpenClawAgentOutput('{not-json'),
    /openclaw agent returned invalid JSON output/,
  );
});

test('classifies ENOENT exec failure', () => {
  const message = classifyOpenClawExecError({ code: 'ENOENT' });
  assert.equal(message, 'openclaw CLI is not installed or not available in PATH');
});

test('classifies timeout exec failure', () => {
  const message = classifyOpenClawExecError({ code: 'ETIMEDOUT', message: 'process timed out' });
  assert.equal(message.includes('openclaw agent timed out after '), true);
});

test('classifies unknown exec failure with code when present', () => {
  const message = classifyOpenClawExecError({ code: 'EACCES' });
  assert.equal(message, 'openclaw agent execution failed (code=EACCES)');
});

test('retry classifier marks transient network/timeout failures as retryable', () => {
  assert.equal(isRetryableOpenClawExecError({ code: 'ETIMEDOUT' }), true);
  assert.equal(isRetryableOpenClawExecError({ code: 'ECONNRESET' }), true);
  assert.equal(isRetryableOpenClawExecError({ message: 'request timeout reached' }), true);
  assert.equal(isRetryableOpenClawExecError({ code: 'ENOENT' }), false);
});

test('retry delay calculator applies bounded jitter around exponential backoff', () => {
  const attempt0Low = computeOpenClawRetryDelayMs(0, 200, 0);
  const attempt0High = computeOpenClawRetryDelayMs(0, 200, 1);
  const attempt1Mid = computeOpenClawRetryDelayMs(1, 200, 0.5);
  const cappedHigh = computeOpenClawRetryDelayMs(10, 5000, 1);

  assert.equal(attempt0Low, 160);
  assert.equal(attempt0High, 240);
  assert.equal(attempt1Mid, 400);
  assert.equal(cappedHigh, 10000);
});

test('thinkWithOpenClaw retries transient failure and succeeds on subsequent attempt', async () => {
  const previous = {
    openclawRetryAttempts: config.openclawRetryAttempts,
    openclawRetryBaseDelayMs: config.openclawRetryBaseDelayMs,
  };
  config.openclawRetryAttempts = 2;
  config.openclawRetryBaseDelayMs = 100;

  let calls = 0;
  const sleepCalls: number[] = [];
  try {
    const result = await thinkWithOpenClaw('hello', {
      execFileAsync: async () => {
        calls += 1;
        if (calls === 1) {
          throw { code: 'ETIMEDOUT', message: 'process timed out' };
        }
        return {
          stdout: JSON.stringify({ status: 'ok', result: { payloads: [{ text: 'recovered' }] } }),
          stderr: '',
        };
      },
      sleep: async (ms) => {
        sleepCalls.push(ms);
      },
      random: () => 0.5,
    });

    assert.equal(result, 'recovered');
    assert.equal(calls, 2);
    assert.deepEqual(sleepCalls, [100]);
  } finally {
    config.openclawRetryAttempts = previous.openclawRetryAttempts;
    config.openclawRetryBaseDelayMs = previous.openclawRetryBaseDelayMs;
  }
});

test('thinkWithOpenClaw surfaces timeout error after retry budget is exhausted', async () => {
  const previous = {
    openclawRetryAttempts: config.openclawRetryAttempts,
    openclawRetryBaseDelayMs: config.openclawRetryBaseDelayMs,
  };
  config.openclawRetryAttempts = 1;
  config.openclawRetryBaseDelayMs = 100;

  let calls = 0;
  const sleepCalls: number[] = [];
  try {
    await assert.rejects(
      () =>
        thinkWithOpenClaw('hello', {
          execFileAsync: async () => {
            calls += 1;
            throw { code: 'ETIMEDOUT', message: 'process timed out' };
          },
          sleep: async (ms) => {
            sleepCalls.push(ms);
          },
          random: () => 0.5,
        }),
      /openclaw agent timed out after .*s/,
    );

    assert.equal(calls, 2);
    assert.deepEqual(sleepCalls, [100]);
  } finally {
    config.openclawRetryAttempts = previous.openclawRetryAttempts;
    config.openclawRetryBaseDelayMs = previous.openclawRetryBaseDelayMs;
  }
});

test('thinkWithOpenClaw does not retry non-retryable failures even when retry budget exists', async () => {
  const previous = {
    openclawRetryAttempts: config.openclawRetryAttempts,
    openclawRetryBaseDelayMs: config.openclawRetryBaseDelayMs,
  };
  config.openclawRetryAttempts = 3;
  config.openclawRetryBaseDelayMs = 100;

  let calls = 0;
  const sleepCalls: number[] = [];
  try {
    await assert.rejects(
      () =>
        thinkWithOpenClaw('hello', {
          execFileAsync: async () => {
            calls += 1;
            throw { code: 'ENOENT', message: 'command not found' };
          },
          sleep: async (ms) => {
            sleepCalls.push(ms);
          },
          random: () => 0.5,
        }),
      /openclaw CLI is not installed or not available in PATH/,
    );

    assert.equal(calls, 1);
    assert.deepEqual(sleepCalls, []);
  } finally {
    config.openclawRetryAttempts = previous.openclawRetryAttempts;
    config.openclawRetryBaseDelayMs = previous.openclawRetryBaseDelayMs;
  }
});
