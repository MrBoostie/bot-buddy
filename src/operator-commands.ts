import { incrementCommandCount, recordCommandLatencyMs } from './metrics.js';

const MAX_OPERATOR_REPLY_CHARS = 1900;
const AUDIT_TAIL_DEFAULT_LIMIT = 5;
const AUDIT_TAIL_MAX_LIMIT = 20;

type ParseUnsignedIntInRangeResult =
  | { ok: true; value: number }
  | { ok: false; reason: 'invalid-number' | 'out-of-range' };

type AuditTailParseResult =
  | { ok: true; limit: number }
  | { ok: false; reason: 'invalid-usage' | 'invalid-limit' };

export function parseUnsignedIntInRange(
  raw: string,
  min: number,
  max: number,
): ParseUnsignedIntInRangeResult {
  if (!/^\d+$/.test(raw)) {
    return { ok: false, reason: 'invalid-number' };
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    return { ok: false, reason: 'out-of-range' };
  }

  return { ok: true, value };
}

export function parseAuditTailInput(input: string): AuditTailParseResult {
  const cmd = input.trim().toLowerCase();
  const parts = cmd.split(/\s+/).filter(Boolean);
  if (parts[0] !== '/audit-tail') {
    return { ok: false, reason: 'invalid-usage' };
  }

  if (parts.length > 2) {
    return { ok: false, reason: 'invalid-usage' };
  }

  const rawLimit = parts.length === 2 ? parts[1] : undefined;
  if (rawLimit === undefined) {
    return { ok: true, limit: AUDIT_TAIL_DEFAULT_LIMIT };
  }

  const parsedLimit = parseUnsignedIntInRange(rawLimit, 1, AUDIT_TAIL_MAX_LIMIT);
  if (!parsedLimit.ok) {
    return { ok: false, reason: 'invalid-limit' };
  }

  return { ok: true, limit: parsedLimit.value };
}

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
    const guards = `allowMetricsReset=${String(deps.allowMetricsReset())} | allowAuditTail=${String(deps.allowAuditTail())}`;
    const auditTail = `auditTailDefault=${AUDIT_TAIL_DEFAULT_LIMIT} | auditTailMax=${AUDIT_TAIL_MAX_LIMIT}`;
    const replyPolicy = `operatorReplyMaxChars=${MAX_OPERATOR_REPLY_CHARS}`;
    return issues.length === 0
      ? done(
          `diag: ok | hasDiscord=${String(deps.hasDiscord())} | hasOpenAI=${String(deps.hasOpenAI())} | ${guards} | ${auditTail} | ${replyPolicy} | lastBackendError=${backend}`,
        )
      : done(
          `diag: issues detected -> ${issues.join(' ; ')} | ${guards} | ${auditTail} | ${replyPolicy} | lastBackendError=${backend}`,
        );
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

  if (cmd.startsWith('/audit-tail')) {
    incrementCommandCount();
    const parsed = parseAuditTailInput(cmd);
    if (!parsed.ok) {
      if (parsed.reason === 'invalid-usage') {
        return done('audit-tail: invalid usage (use /audit-tail or /audit-tail <1-20>)');
      }
      return done('audit-tail: invalid limit (use /audit-tail or /audit-tail <1-20>)');
    }

    if (!deps.allowAuditTail()) {
      return done('audit-tail: disabled (set ALLOW_AUDIT_TAIL=true to enable)');
    }

    const payload = `audit-tail: ${deps.getAuditTail(parsed.limit)}`;
    if (payload.length <= MAX_OPERATOR_REPLY_CHARS) {
      return done(payload);
    }

    const suffix = ' ...[truncated]';
    return done(`${payload.slice(0, MAX_OPERATOR_REPLY_CHARS - suffix.length)}${suffix}`);
  }

  return null;
}
