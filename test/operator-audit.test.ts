import test from 'node:test';
import assert from 'node:assert/strict';
import { getOperatorAuditEvent } from '../src/operator-audit.ts';

test('returns executed audit event for metrics reset success', () => {
  const event = getOperatorAuditEvent({ kind: 'command', text: 'metrics-reset: ok | metrics=...' });
  assert.equal(event, 'operator metrics reset executed');
});

test('returns denied audit event for metrics reset when disabled', () => {
  const event = getOperatorAuditEvent({
    kind: 'command',
    text: 'metrics-reset: disabled (set ALLOW_METRICS_RESET=true to enable)',
  });
  assert.equal(event, 'operator metrics reset denied (disabled)');
});

test('returns null for non-audited command', () => {
  const event = getOperatorAuditEvent({ kind: 'command', text: 'pong | uptime=5s | model=gpt' });
  assert.equal(event, null);
});

test('returns null for non-command routes', () => {
  assert.equal(getOperatorAuditEvent({ kind: 'ignore' }), null);
  assert.equal(getOperatorAuditEvent({ kind: 'llm', prompt: 'hello' }), null);
});
