import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOpenClawAgentOutput } from '../src/brain.ts';

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

test('throws clear error on malformed JSON', () => {
  assert.throws(
    () => parseOpenClawAgentOutput('{not-json'),
    /openclaw agent returned invalid JSON output/,
  );
});
