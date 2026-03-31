import { incrementCommandCount } from './metrics.js';

export type OperatorCommandDeps = {
  formatUptime: () => string;
  modelName: () => string;
  runtimeSummary: () => string;
  validateRuntime: () => string[];
  refreshConfigFromEnv: () => void;
  hasDiscord: () => boolean;
  hasOpenAI: () => boolean;
  backendHealthSummary: () => string;
  tryAcquireReload: () => { ok: true } | { ok: false; retryAfterSec: number };
  metricsSummary: () => string;
  allowMetricsReset: () => boolean;
  resetMetrics: () => void;
};

export function evaluateOperatorCommand(input: string, deps: OperatorCommandDeps): string | null {
  const cmd = input.trim().toLowerCase();

  if (cmd === '/ping') {
    incrementCommandCount();
    return `pong | uptime=${deps.formatUptime()} | model=${deps.modelName()}`;
  }

  if (cmd === '/status') {
    incrementCommandCount();
    return `status: online | uptime=${deps.formatUptime()} | model=${deps.modelName()} | ${deps.runtimeSummary()}`;
  }

  if (cmd === '/diag') {
    incrementCommandCount();
    const issues = deps.validateRuntime();
    const backend = deps.backendHealthSummary();
    return issues.length === 0
      ? `diag: ok | hasDiscord=${String(deps.hasDiscord())} | hasOpenAI=${String(deps.hasOpenAI())} | lastBackendError=${backend}`
      : `diag: issues detected -> ${issues.join(' ; ')} | lastBackendError=${backend}`;
  }

  if (cmd === '/health') {
    incrementCommandCount();
    const issues = deps.validateRuntime();
    const runtime = issues.length === 0 ? 'ok' : 'degraded';
    return [
      'health',
      `runtime=${runtime}`,
      `issues=${issues.length}`,
      `discord=${String(deps.hasDiscord())}`,
      `openai=${String(deps.hasOpenAI())}`,
      `backend=${deps.backendHealthSummary()}`,
      `metrics=${deps.metricsSummary()}`,
    ].join(' | ');
  }

  if (cmd === '/reload') {
    incrementCommandCount();
    const gate = deps.tryAcquireReload();
    if (!gate.ok) {
      return `reload: rate-limited | retryAfterSec=${gate.retryAfterSec}`;
    }

    deps.refreshConfigFromEnv();
    const issues = deps.validateRuntime();
    if (issues.length > 0) {
      return `reload: applied, but issues remain -> ${issues.join(' ; ')}`;
    }
    return `reload: applied | ${deps.runtimeSummary()}`;
  }

  if (cmd === '/metrics-reset') {
    incrementCommandCount();
    if (!deps.allowMetricsReset()) {
      return 'metrics-reset: disabled (set ALLOW_METRICS_RESET=true to enable)';
    }
    deps.resetMetrics();
    return `metrics-reset: ok | ${deps.metricsSummary()}`;
  }

  return null;
}
