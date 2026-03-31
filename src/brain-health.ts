let lastBackendError: string | null = null;
let lastBackendErrorAt: number | null = null;

export function recordBackendError(message: string, now = Date.now()): void {
  lastBackendError = message;
  lastBackendErrorAt = now;
}

export function clearBackendError(): void {
  lastBackendError = null;
  lastBackendErrorAt = null;
}

export function getBackendHealthSummary(): string {
  if (!lastBackendError || !lastBackendErrorAt) return 'none';
  return `${lastBackendError} @ ${new Date(lastBackendErrorAt).toISOString()}`;
}

export function resetBackendHealthForTests(): void {
  clearBackendError();
}
