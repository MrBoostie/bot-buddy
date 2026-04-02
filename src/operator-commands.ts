import { incrementCommandCount, recordCommandLatencyMs } from './metrics.js';

const MAX_OPERATOR_REPLY_CHARS = 1900;
const AUDIT_TAIL_DEFAULT_LIMIT = 5;
const AUDIT_TAIL_MAX_LIMIT = 20;
const AUDIT_TAIL_COMMAND_RE = /^\/audit-tail(?:\s|$)/;
const ENV_ALLOW_METRICS_RESET = 'ALLOW_METRICS_RESET=true';
const ENV_ALLOW_AUDIT_TAIL = 'ALLOW_AUDIT_TAIL=true';
const METRICS_RESET_DISABLED_MESSAGE = `metrics-reset: disabled (set ${ENV_ALLOW_METRICS_RESET} to enable)`;
const AUDIT_TAIL_DISABLED_MESSAGE = `audit-tail: disabled (set ${ENV_ALLOW_AUDIT_TAIL} to enable)`;
const AUDIT_TAIL_USAGE_HINT = `/audit-tail or /audit-tail <1-${AUDIT_TAIL_MAX_LIMIT}>`;
const AUDIT_TAIL_INVALID_USAGE_MESSAGE = `audit-tail: invalid usage (use ${AUDIT_TAIL_USAGE_HINT})`;
const AUDIT_TAIL_INVALID_LIMIT_MESSAGE = `audit-tail: invalid limit (use ${AUDIT_TAIL_USAGE_HINT})`;

function hasCommandArgs(input: string, command: string): boolean {
  if (!input.startsWith(command)) {
    return false;
  }

  const next = input.slice(command.length, command.length + 1);
  return next.length > 0 && /\s/.test(next);
}
const OPERATOR_COMMANDS = {
  question: '/?',
  help: '/help',
  commands: '/commands',
  ping: '/ping',
  up: '/up',
  uptime: '/uptime',
  version: '/version',
  id: '/id',
  model: '/model',
  backend: '/backend',
  status: '/status',
  runtime: '/runtime',
  diag: '/diag',
  health: '/health',
  reload: '/reload',
  metricsReset: '/metrics-reset',
  auditTail: '/audit-tail',
} as const;

const KNOWN_OPERATOR_COMMANDS = Object.values(OPERATOR_COMMANDS);
const HELP_ALIASES: string[] = [
  OPERATOR_COMMANDS.question,
  OPERATOR_COMMANDS.help,
  OPERATOR_COMMANDS.commands,
];
const HELP_ALIAS_SET = new Set<string>(HELP_ALIASES);

export function formatCommandListWithOr(commands: readonly string[]): string {
  if (commands.length === 0) {
    return '';
  }

  if (commands.length === 1) {
    return commands[0];
  }

  if (commands.length === 2) {
    return `${commands[0]} or ${commands[1]}`;
  }

  return `${commands.slice(0, -1).join(', ')}, or ${commands[commands.length - 1]}`;
}

const HELP_USAGE_HINT = `(use ${formatCommandListWithOr(HELP_ALIASES)})`;
const HELP_INVALID_USAGE = `help: invalid usage ${HELP_USAGE_HINT}`;
const BASE_HELP_COMMANDS: string[] = [
  ...HELP_ALIASES,
  OPERATOR_COMMANDS.ping,
  OPERATOR_COMMANDS.up,
  OPERATOR_COMMANDS.uptime,
  OPERATOR_COMMANDS.version,
  OPERATOR_COMMANDS.id,
  OPERATOR_COMMANDS.model,
  OPERATOR_COMMANDS.backend,
  OPERATOR_COMMANDS.status,
  OPERATOR_COMMANDS.runtime,
  OPERATOR_COMMANDS.diag,
  OPERATOR_COMMANDS.health,
  OPERATOR_COMMANDS.reload,
];
const NO_ARG_OPERATOR_COMMANDS = new Set<string>([
  ...BASE_HELP_COMMANDS.filter((cmd) => !HELP_ALIAS_SET.has(cmd)),
  OPERATOR_COMMANDS.metricsReset,
]);

function helpCommandSummary(deps: Pick<OperatorCommandDeps, 'allowMetricsReset' | 'allowAuditTail'>): string {
  const commands: string[] = [...BASE_HELP_COMMANDS];

  commands.push(
    deps.allowMetricsReset()
      ? OPERATOR_COMMANDS.metricsReset
      : `${OPERATOR_COMMANDS.metricsReset} (disabled)`,
    deps.allowAuditTail()
      ? `${OPERATOR_COMMANDS.auditTail} [1-20]`
      : `${OPERATOR_COMMANDS.auditTail} [1-20] (disabled)`,
  );

  return commands.join(', ');
}

function helpEnableHint(deps: Pick<OperatorCommandDeps, 'allowMetricsReset' | 'allowAuditTail'>): string {
  const envToggles: string[] = [];

  if (!deps.allowMetricsReset()) {
    envToggles.push(ENV_ALLOW_METRICS_RESET);
  }

  if (!deps.allowAuditTail()) {
    envToggles.push(ENV_ALLOW_AUDIT_TAIL);
  }

  if (envToggles.length === 0) {
    return '';
  }

  return ` | enable: ${envToggles.join(', ')}`;
}

function damerauLevenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }

  return dp[a.length][b.length];
}

function unknownCommandSuggestion(
  command: string,
  deps: Pick<OperatorCommandDeps, 'allowMetricsReset' | 'allowAuditTail'>,
): string {
  let best: { command: string; distance: number } | null = null;

  const unknownToken = command.slice(1);

  for (const known of KNOWN_OPERATOR_COMMANDS) {
    if (known === OPERATOR_COMMANDS.metricsReset && !deps.allowMetricsReset()) {
      continue;
    }

    if (known === OPERATOR_COMMANDS.auditTail && !deps.allowAuditTail()) {
      continue;
    }

    if (known === OPERATOR_COMMANDS.question) {
      continue;
    }

    const knownToken = known.slice(1);
    if (unknownToken.slice(0, 1) !== knownToken.slice(0, 1)) {
      continue;
    }

    const distance = damerauLevenshteinDistance(command, known);
    if (!best || distance < best.distance) {
      best = { command: known, distance };
    }
  }

  if (!best || best.distance > 2) {
    return '';
  }

  if (best.command === command) {
    return '';
  }

  if (best.distance === 2 && Math.abs(command.length - best.command.length) >= 1) {
    return '';
  }

  const isShortCommand = command.length < 4;
  const isShortSuggestion = best.command.length <= 3;
  if (isShortCommand) {
    if (!isShortSuggestion || best.distance > 1) {
      return '';
    }

    const shortCommandToken = command.slice(1);
    const shortSuggestionToken = best.command.slice(1);
    if (!shortCommandToken.startsWith(shortSuggestionToken.slice(0, 1))) {
      return '';
    }
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
  if (parts[0] !== OPERATOR_COMMANDS.auditTail) {
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
  appVersion: () => string;
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

  if (cmd === OPERATOR_COMMANDS.ping) {
    incrementCommandCount();
    return done(`pong | uptime=${deps.formatUptime()} | model=${deps.modelName()}`);
  }

  if (cmd === OPERATOR_COMMANDS.up || cmd === OPERATOR_COMMANDS.uptime) {
    incrementCommandCount();
    return done(`uptime=${deps.formatUptime()} | model=${deps.modelName()}`);
  }

  if (cmd === OPERATOR_COMMANDS.version) {
    incrementCommandCount();
    return done(`version=${deps.appVersion()} | node=${process.version} | model=${deps.modelName()}`);
  }

  if (cmd === OPERATOR_COMMANDS.id) {
    incrementCommandCount();
    return done(
      `id: version=${deps.appVersion()} | model=${deps.modelName()} | backend=${deps.llmBackend()} | node=${process.version}`,
    );
  }

  if (cmd === OPERATOR_COMMANDS.model || cmd === OPERATOR_COMMANDS.backend) {
    incrementCommandCount();
    return done(`model=${deps.modelName()} | backend=${deps.llmBackend()}`);
  }

  if (HELP_ALIAS_SET.has(cmd)) {
    incrementCommandCount();
    return done(`commands: ${helpCommandSummary(deps)}${helpEnableHint(deps)}`);
  }

  if (HELP_ALIASES.some((alias) => hasCommandArgs(cmd, alias))) {
    incrementCommandCount();
    return done(HELP_INVALID_USAGE);
  }

  if (cmd === OPERATOR_COMMANDS.status || cmd === OPERATOR_COMMANDS.runtime) {
    incrementCommandCount();
    return done(
      `status: online | uptime=${deps.formatUptime()} | model=${deps.modelName()} | ${deps.runtimeSummary()}`,
    );
  }

  if (cmd === OPERATOR_COMMANDS.diag) {
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

  if (cmd === OPERATOR_COMMANDS.health) {
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

  if (cmd === OPERATOR_COMMANDS.reload) {
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

  if (cmd === OPERATOR_COMMANDS.metricsReset) {
    incrementCommandCount();
    if (!deps.allowMetricsReset()) {
      return done(METRICS_RESET_DISABLED_MESSAGE);
    }
    deps.resetMetrics();
    return done(`metrics-reset: ok | ${deps.metricsSummary()}`);
  }

  if (AUDIT_TAIL_COMMAND_RE.test(cmd)) {
    incrementCommandCount();

    if (!deps.allowAuditTail()) {
      return done(AUDIT_TAIL_DISABLED_MESSAGE);
    }

    const parsed = parseAuditTailInput(cmd);
    if (!parsed.ok) {
      if (parsed.reason === 'invalid-usage') {
        return done(AUDIT_TAIL_INVALID_USAGE_MESSAGE);
      }
      return done(AUDIT_TAIL_INVALID_LIMIT_MESSAGE);
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

    if (unknown !== cmd && unknown === OPERATOR_COMMANDS.metricsReset && !deps.allowMetricsReset()) {
      return done(METRICS_RESET_DISABLED_MESSAGE);
    }

    if (unknown !== cmd && NO_ARG_OPERATOR_COMMANDS.has(unknown)) {
      return done(`${unknown.slice(1)}: invalid usage (use ${unknown})`);
    }

    return done(`unknown command: ${unknown} ${HELP_USAGE_HINT}${unknownCommandSuggestion(unknown, deps)}`);
  }

  return null;
}
