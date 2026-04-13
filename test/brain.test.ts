import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyOpenClawExecError,
  computeOpenClawRetryDelayMs,
  isRetryableOpenClawExecError,
  parseOpenClawAgentOutput,
} from '../src/brain.ts';

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
  assert.equal(cappedHigh, 12000);
});
