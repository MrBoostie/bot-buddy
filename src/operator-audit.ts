import type { DiscordRoutingResult } from './discord-routing.js';

const AUDIT_TAIL_LIMIT = 20;
const auditEvents: string[] = [];

export function getOperatorAuditEvent(result: DiscordRoutingResult): string | null {
  if (result.kind !== 'command') return null;

  if (result.text.startsWith('metrics-reset: ok')) {
    return 'operator metrics reset executed';
  }

  if (result.text.startsWith('metrics-reset: disabled')) {
    return 'operator metrics reset denied (disabled)';
  }

  if (result.text.startsWith('metrics-reset: invalid usage')) {
    return 'operator metrics reset denied (invalid usage)';
  }

  if (result.text.startsWith('audit-tail: disabled')) {
    return 'operator audit tail denied (disabled)';
  }

  if (result.text.startsWith('audit-tail: invalid usage')) {
    return 'operator audit tail denied (invalid usage)';
  }

  if (result.text.startsWith('audit-tail: invalid limit')) {
    return 'operator audit tail denied (invalid limit)';
  }

  if (result.text.startsWith('audit-tail: ')) {
    return 'operator audit tail viewed';
  }

  return null;
}

export function recordAuditEvent(event: string, now = Date.now()): void {
  auditEvents.push(`${new Date(now).toISOString()} ${event}`);
  if (auditEvents.length > AUDIT_TAIL_LIMIT) {
    auditEvents.shift();
  }
}

export function getAuditTail(limit = 5): string {
  const safeLimit = Math.max(1, Math.min(limit, AUDIT_TAIL_LIMIT));
  const lines = auditEvents.slice(-safeLimit);
  return lines.length > 0 ? lines.join(' || ') : 'none';
}

export function resetAuditForTests(): void {
  auditEvents.length = 0;
}
