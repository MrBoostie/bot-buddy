const RELOAD_COOLDOWN_MS = 30_000;

let nextReloadAllowedAt = 0;

export type ReloadGateResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

export function tryAcquireReload(now = Date.now()): ReloadGateResult {
  if (now < nextReloadAllowedAt) {
    const remainingMs = Math.max(0, nextReloadAllowedAt - now);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(remainingMs / 1000)) };
  }

  nextReloadAllowedAt = now + RELOAD_COOLDOWN_MS;
  return { ok: true };
}

export function resetReloadGateForTests(): void {
  nextReloadAllowedAt = 0;
}
