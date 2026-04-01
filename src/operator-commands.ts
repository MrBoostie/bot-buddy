import { incrementCommandCount, recordCommandLatencyMs } from './metrics.js';

const MAX_OPERATOR_REPLY_CHARS = 1900;
const AUDIT_TAIL_DEFAULT_LIMIT = 5;
const AUDIT_TAIL_MAX_LIMIT = 20;
const KNOWN_OPERATOR_COMMANDS = [
  '/help',
  '/commands',
  '/ping',
  '/status',
  '/diag',
  '/health',
  '/reload',
  '/metrics-reset',
  '/audit-tail',
] as const;
function helpCommandSummary(deps: Pick<OperatorCommandDeps, 'allowMetricsReset' | 'allowAuditTail'>): string {
  const commands = ['/ping', '/status', '/diag', '/health', '/reload'];

  commands.push(
    deps.allowMetricsReset() ? '/metrics-reset' : '/metrics-reset (disabled)',
    deps.allowAuditTail() ? '/audit-tail [1-20]' : '/audit-tail [1-20] (disabled)',
  );

  return commands.join(', ');
}

function helpEnableHint(deps: Pick<OperatorCommandDeps, 'allowMetricsReset' | 'allowAuditTail'>): string {
  const envToggles: string[] = [];

  if (!deps.allowMetricsReset()) {
    envToggles.push('ALLOW_METRICS_RESET=true');
  }

  if (!deps.allowAuditTail()) {
    envToggles.push('ALLOW_AUDIT_TAIL=true');
  }

  if (envToggles.length === 0) {
    return '';
  }

  return ` | enable: ${envToggles.join(', ')}`;
}

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[a.length][b.length];
}

function unknownCommandSuggestion(command: string): string {
  let best: { command: string; distance: number } | null = null;

  for (const known of KNOWN_OPERATOR_COMMANDS) {
    const distance = levenshteinDistance(command, known);
    if (!best || distance < best.distance) {
      best = { command: known, distance };
    }
  }

  if (!best || best.distance > 2) {
    return '';
  }

  return ` | did you mean ${best.command}?`;
}

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
  llmBackend: () => string;
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

  if (cmd === '/help' || cmd === '/commands') {
    incrementCommandCount();
    return done(`commands: ${helpCommandSummary(deps)}${helpEnableHint(deps)}`);
  }

  if (cmd.startsWith('/help ') || cmd.startsWith('/commands ')) {
    incrementCommandCount();
    return done('help: invalid usage (use /help or /commands)');
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
    const backendMode = `llmBackend=${deps.llmBackend()}`;
    return issues.length === 0
      ? done(
          `diag: ok | hasDiscord=${String(deps.hasDiscord())} | hasOpenAI=${String(deps.hasOpenAI())} | ${backendMode} | ${guards} | ${auditTail} | ${replyPolicy} | lastBackendError=${backend}`,
        )
      : done(
          `diag: issues detected -> ${issues.join(' ; ')} | ${backendMode} | ${guards} | ${auditTail} | ${replyPolicy} | lastBackendError=${backend}`,
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

  if (cmd.startsWith('/')) {
    const unknown = cmd.split(/\s+/, 1)[0] || cmd;
    return done(`unknown command: ${unknown} (use /help)${unknownCommandSuggestion(unknown)}`);
  }

  return null;
}
