import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestId, formatLogLine } from '../src/log.ts';

test('formatLogLine includes scope and level', () => {
  const line = formatLogLine('info', 'ready', { scope: 'boot' });
  assert.equal(line, '[boot] [info] ready');
});

test('formatLogLine includes request id when provided', () => {
  const line = formatLogLine('error', 'failed', { scope: 'discord', requestId: 'abc123' });
  assert.equal(line, '[discord] [error] rid=abc123 failed');
});

test('createRequestId returns short non-empty token', () => {
  const rid = createRequestId();
  assert.equal(typeof rid, 'string');
  assert.equal(rid.length > 0, true);
  assert.equal(rid.includes('-'), false);
});
