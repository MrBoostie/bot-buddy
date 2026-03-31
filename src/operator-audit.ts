import type { DiscordRoutingResult } from './discord-routing.js';

export function getOperatorAuditEvent(result: DiscordRoutingResult): string | null {
  if (result.kind !== 'command') return null;

  if (result.text.startsWith('metrics-reset: ok')) {
    return 'operator metrics reset executed';
  }

  if (result.text.startsWith('metrics-reset: disabled')) {
    return 'operator metrics reset denied (disabled)';
  }

  return null;
}
