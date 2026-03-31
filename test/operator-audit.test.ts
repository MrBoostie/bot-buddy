import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAuditTail,
  getOperatorAuditEvent,
  recordAuditEvent,
  resetAuditForTests,
} from '../src/operator-audit.ts';

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

test('returns audit event for audit-tail disabled', () => {
  const event = getOperatorAuditEvent({
    kind: 'command',
    text: 'audit-tail: disabled (set ALLOW_AUDIT_TAIL=true to enable)',
  });
  assert.equal(event, 'operator audit tail denied (disabled)');
});

test('returns audit event for audit-tail access', () => {
  const event = getOperatorAuditEvent({
    kind: 'command',
    text: 'audit-tail: 2026-03-31T03:30:00.000Z operator metrics reset executed',
  });
  assert.equal(event, 'operator audit tail viewed');
});

test('returns denied audit event for invalid audit-tail usage', () => {
  const event = getOperatorAuditEvent({
    kind: 'command',
    text: 'audit-tail: invalid usage (use /audit-tail or /audit-tail <1-20>)',
  });
  assert.equal(event, 'operator audit tail denied (invalid usage)');
});

test('returns denied audit event for invalid audit-tail limit', () => {
  const event = getOperatorAuditEvent({
    kind: 'command',
    text: 'audit-tail: invalid limit (use /audit-tail or /audit-tail <1-20>)',
  });
  assert.equal(event, 'operator audit tail denied (invalid limit)');
});

test('returns null for non-audited command', () => {
  const event = getOperatorAuditEvent({ kind: 'command', text: 'pong | uptime=5s | model=gpt' });
  assert.equal(event, null);
});

test('returns null for non-command routes', () => {
  assert.equal(getOperatorAuditEvent({ kind: 'ignore' }), null);
  assert.equal(getOperatorAuditEvent({ kind: 'llm', prompt: 'hello' }), null);
});

test('returns none when audit tail is empty', () => {
  resetAuditForTests();
  assert.equal(getAuditTail(), 'none');
});

test('records and returns latest audit events in tail', () => {
  resetAuditForTests();
  recordAuditEvent('event-1', Date.parse('2026-03-31T03:00:00.000Z'));
  recordAuditEvent('event-2', Date.parse('2026-03-31T03:01:00.000Z'));

  const tail = getAuditTail(2);
  assert.equal(
    tail,
    '2026-03-31T03:00:00.000Z event-1 || 2026-03-31T03:01:00.000Z event-2',
  );
});
