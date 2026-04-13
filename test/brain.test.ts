import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyOpenClawExecError, parseOpenClawAgentOutput } from '../src/brain.ts';

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
