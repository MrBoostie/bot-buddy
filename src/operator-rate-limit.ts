import { config } from './config.js';

let nextReloadAllowedAt = 0;

export type ReloadGateResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

export function tryAcquireReload(now = Date.now(), cooldownMs?: number): ReloadGateResult {
  const effectiveCooldownMs = cooldownMs ?? config.operatorReloadCooldownSec * 1000;

  if (now < nextReloadAllowedAt) {
    const remainingMs = Math.max(0, nextReloadAllowedAt - now);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(remainingMs / 1000)) };
  }

  nextReloadAllowedAt = now + effectiveCooldownMs;
  return { ok: true };
}

export function resetReloadGateForTests(): void {
  nextReloadAllowedAt = 0;
}
