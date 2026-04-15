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

test('returns denied audit event for metrics reset invalid usage', () => {
  const event = getOperatorAuditEvent({
    kind: 'command',
    text: 'metrics-reset: invalid usage (use /metrics-reset)',
  });
  assert.equal(event, 'operator metrics reset denied (invalid usage)');
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

test('returns audit event for reload apply', () => {
  const event = getOperatorAuditEvent({
    kind: 'command',
    text: 'reload: applied | bot=buddy | llmBackend=openclaw',
  });
  assert.equal(event, 'operator reload applied');
});

test('returns audit event for reload dry-run ok', () => {
  const event = getOperatorAuditEvent({
    kind: 'command',
    text: 'reload: dry-run ok | bot=buddy | llmBackend=openclaw',
  });
  assert.equal(event, 'operator reload dry-run ok');
});

test('returns audit event for reload dry-run issues', () => {
  const event = getOperatorAuditEvent({
    kind: 'command',
    text: 'reload: dry-run detected issues -> OPENAI_API_KEY missing',
  });
  assert.equal(event, 'operator reload dry-run detected issues');
});

test('returns audit event for reload rejected', () => {
  const event = getOperatorAuditEvent({
    kind: 'command',
    text: 'reload: rejected -> OPENAI_API_KEY missing',
  });
  assert.equal(event, 'operator reload rejected');
});

test('returns audit event for reload rate-limited', () => {
  const event = getOperatorAuditEvent({
    kind: 'command',
    text: 'reload: rate-limited | retryAfterSec=9',
  });
  assert.equal(event, 'operator reload denied (rate-limited)');
});

test('returns audit event for reload invalid usage', () => {
  const event = getOperatorAuditEvent({
    kind: 'command',
    text: 'reload: invalid usage (use /reload or /reload --dry-run)',
  });
  assert.equal(event, 'operator reload denied (invalid usage)');
});

test('returns audit event for reload applied with issues', () => {
  const event = getOperatorAuditEvent({
    kind: 'command',
    text: 'reload: applied, but issues remain -> OPENAI_API_KEY missing',
  });
  assert.equal(event, 'operator reload applied with issues');
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
