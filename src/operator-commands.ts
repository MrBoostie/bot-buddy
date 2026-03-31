import { incrementCommandCount, recordCommandLatencyMs } from './metrics.js';

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
  allowAuditTail: () => boolean;
  getAuditTail: (limit?: number) => string;
};

export function evaluateOperatorCommand(input: string, deps: OperatorCommandDeps): string | null {
  const startedAt = Date.now();
  const cmd = input.trim().toLowerCase();

  const done = (text: string): string => {
    recordCommandLatencyMs(Date.now() - startedAt);
    return text;
  };

  if (cmd === '/ping') {
    incrementCommandCount();
    return done(`pong | uptime=${deps.formatUptime()} | model=${deps.modelName()}`);
  }

  if (cmd === '/status') {
    incrementCommandCount();
    return done(
      `status: online | uptime=${deps.formatUptime()} | model=${deps.modelName()} | ${deps.runtimeSummary()}`,
    );
  }

  if (cmd === '/diag') {
    incrementCommandCount();
    const issues = deps.validateRuntime();
    const backend = deps.backendHealthSummary();
    return issues.length === 0
      ? done(
          `diag: ok | hasDiscord=${String(deps.hasDiscord())} | hasOpenAI=${String(deps.hasOpenAI())} | lastBackendError=${backend}`,
        )
      : done(`diag: issues detected -> ${issues.join(' ; ')} | lastBackendError=${backend}`);
  }

  if (cmd === '/health') {
    incrementCommandCount();
    const issues = deps.validateRuntime();
    const runtime = issues.length === 0 ? 'ok' : 'degraded';
    return done(
      [
        'health',
        `runtime=${runtime}`,
        `issues=${issues.length}`,
        `discord=${String(deps.hasDiscord())}`,
        `openai=${String(deps.hasOpenAI())}`,
        `backend=${deps.backendHealthSummary()}`,
        `metrics=${deps.metricsSummary()}`,
      ].join(' | '),
    );
  }

  if (cmd === '/reload') {
    incrementCommandCount();
    const gate = deps.tryAcquireReload();
    if (!gate.ok) {
      return done(`reload: rate-limited | retryAfterSec=${gate.retryAfterSec}`);
    }

    deps.refreshConfigFromEnv();
    const issues = deps.validateRuntime();
    if (issues.length > 0) {
      return done(`reload: applied, but issues remain -> ${issues.join(' ; ')}`);
    }
    return done(`reload: applied | ${deps.runtimeSummary()}`);
  }

  if (cmd === '/metrics-reset') {
    incrementCommandCount();
    if (!deps.allowMetricsReset()) {
      return done('metrics-reset: disabled (set ALLOW_METRICS_RESET=true to enable)');
    }
    deps.resetMetrics();
    return done(`metrics-reset: ok | ${deps.metricsSummary()}`);
  }

  if (cmd === '/audit-tail') {
    incrementCommandCount();
    if (!deps.allowAuditTail()) {
      return done('audit-tail: disabled (set ALLOW_AUDIT_TAIL=true to enable)');
    }
    return done(`audit-tail: ${deps.getAuditTail(5)}`);
  }

  return null;
}
