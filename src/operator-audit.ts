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

  if (result.text.startsWith('reload: applied |')) {
    return 'operator reload applied';
  }

  if (result.text.startsWith('reload: dry-run ok |')) {
    return 'operator reload dry-run ok';
  }

  if (result.text.startsWith('reload: dry-run detected issues ->')) {
    return 'operator reload dry-run detected issues';
  }

  if (result.text.startsWith('reload: rejected ->')) {
    return 'operator reload rejected';
  }

  if (result.text.startsWith('reload: rate-limited |')) {
    return 'operator reload denied (rate-limited)';
  }

  if (result.text.startsWith('reload: invalid usage')) {
    return 'operator reload denied (invalid usage)';
  }

  if (result.text.startsWith('reload: applied, but issues remain ->')) {
    return 'operator reload applied with issues';
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
