import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateOperatorCommand,
  formatCommandListWithOr,
  type OperatorCommandDeps,
} from '../src/operator-commands.ts';

const METRICS_SUMMARY_BASE =
  'commands=0,llmCalls=0,llmOk=0,llmErr=0,llmAvgMs=0,llmRecentMaxMs=0,llmLt250Ms=0,llm250To1000Ms=0,llmGt1000Ms=0,cmdAvgMs=0,cmdRecentMaxMs=0';
const HELP_BASE_COMMANDS =
  '/?, /help, /commands, /ping, /up, /uptime, /version, /id, /model, /backend, /status, /runtime, /diag, /health, /reload';
const HELP_ENABLE_BOTH_HINT = ' | enable: ALLOW_METRICS_RESET=true, ALLOW_AUDIT_TAIL=true';
const HELP_ENABLE_AUDIT_HINT = ' | enable: ALLOW_AUDIT_TAIL=true';
const HELP_METRICS_RESET_ENABLED = '/metrics-reset';
const HELP_METRICS_RESET_DISABLED = '/metrics-reset (disabled)';
const HELP_AUDIT_TAIL_ENABLED = '/audit-tail [1-20]';
const HELP_AUDIT_TAIL_DISABLED = '/audit-tail [1-20] (disabled)';
const HELP_ALL_ENABLED = `${HELP_BASE_COMMANDS}, ${HELP_METRICS_RESET_ENABLED}, ${HELP_AUDIT_TAIL_ENABLED}`;
const HELP_ALL_DISABLED =
  `${HELP_BASE_COMMANDS}, ${HELP_METRICS_RESET_DISABLED}, ${HELP_AUDIT_TAIL_DISABLED}${HELP_ENABLE_BOTH_HINT}`;
const HELP_METRICS_ENABLED_AUDIT_DISABLED =
  `${HELP_BASE_COMMANDS}, ${HELP_METRICS_RESET_ENABLED}, ${HELP_AUDIT_TAIL_DISABLED}${HELP_ENABLE_AUDIT_HINT}`;

const AUDIT_TAIL_USAGE_SUFFIX = '(use /audit-tail or /audit-tail <1-20>)';
const AUDIT_TAIL_INVALID_USAGE_LINE = `audit-tail: invalid usage ${AUDIT_TAIL_USAGE_SUFFIX}`;
const AUDIT_TAIL_INVALID_LIMIT_LINE = `audit-tail: invalid limit ${AUDIT_TAIL_USAGE_SUFFIX}`;

const METRICS_RESET_DISABLED_LINE = 'metrics-reset: disabled (set ALLOW_METRICS_RESET=true to enable)';
const METRICS_RESET_INVALID_USAGE_LINE = 'metrics-reset: invalid usage (use /metrics-reset)';
const METRICS_RESET_OK_LINE = `metrics-reset: ok | ${METRICS_SUMMARY_BASE}`;
const AUDIT_TAIL_DISABLED_LINE = 'audit-tail: disabled (set ALLOW_AUDIT_TAIL=true to enable)';
const AUDIT_TAIL_SAMPLE_ENTRY = '2026-03-31T03:30:00.000Z operator metrics reset executed';
const AUDIT_TAIL_TAIL_LINE = 'audit-tail: tail';
const AUDIT_TAIL_SHORT_LINE = 'audit-tail: short tail';

const UNKNOWN_COMMAND_USAGE_HINT = '(use /?, /help, or /commands)';
const HELP_INVALID_USAGE_LINE = `help: invalid usage ${UNKNOWN_COMMAND_USAGE_HINT}`;

function commandsLine(commands: string): string {
  return `commands: ${commands}`;
}

function unknownCommandLine(command: string): string {
  return `unknown command: ${command} ${UNKNOWN_COMMAND_USAGE_HINT}`;
}

function unknownCommandWithSuggestion(command: string, suggestion: string): string {
  return `${unknownCommandLine(command)} | did you mean ${suggestion}?`;
}

function noArgInvalidUsageLine(command: string): string {
  const normalized = command.startsWith('/') ? command.slice(1) : command;
  return `${normalized}: invalid usage (use /${normalized})`;
}

function auditTailLine(payload: string): string {
  return `audit-tail: ${payload}`;
}

test('line-format helpers produce canonical operator response prefixes', () => {
  assert.equal(commandsLine('/help, /commands'), 'commands: /help, /commands');
  assert.equal(unknownCommandLine('/mystery'), 'unknown command: /mystery (use /?, /help, or /commands)');
  assert.equal(
    unknownCommandWithSuggestion('/hepl', '/help'),
    'unknown command: /hepl (use /?, /help, or /commands) | did you mean /help?',
  );
  assert.equal(noArgInvalidUsageLine('/ping'), 'ping: invalid usage (use /ping)');
  assert.equal(auditTailLine('tail'), 'audit-tail: tail');
});

test('reload assertion helpers enforce canonical reload response lines', () => {
  assertReloadApplied('reload: applied | bot=buddy');
  assertReloadApplied(
    'reload: applied | bot=buddy | llmBackend=openai | openAIKey=set',
    'bot=buddy | llmBackend=openai | openAIKey=set',
  );

  assertReloadRateLimited('reload: rate-limited | retryAfterSec=12', 12);
  assertReloadIssuesRemain('reload: applied, but issues remain -> OPENAI_API_KEY missing', 'OPENAI_API_KEY missing');

  assertAssertionFailure(() => assertReloadApplied('reload: applied | bot=other | llmBackend=openclaw'));
  assertAssertionFailure(() => assertReloadRateLimited('reload: rate-limited | retryAfterSec=13', 12));
  assertAssertionFailure(() => assertReloadIssuesRemain('reload: applied, but issues remain -> wrong', 'OPENAI_API_KEY missing'));
});

test('health assertion helpers enforce canonical signal formatting and reject near-misses', () => {
  const healthLine =
    'health | runtime=degraded | issues=2 | discord=true | openai=true | llmBackend=openai | backend=timeout | metrics=commands=9,llmCalls=9';

  assertHealthSignals(healthLine, { runtime: 'degraded', issues: 2, openai: true, llmBackend: 'openai' });
  assertHealthBackendSummary(healthLine, 'timeout');
  assertHealthMetricsSuffix(healthLine, 'commands=9,llmCalls=9');
  assertHealthFieldOrder(healthLine);

  assertAssertionFailure(() =>
    assertHealthSignals(healthLine, { runtime: 'ok', issues: 2, openai: true, llmBackend: 'openai' }),
  );
  assertAssertionFailure(() => assertHealthBackendSummary(healthLine, 'none'));
  assertAssertionFailure(() => assertHealthMetricsSuffix(healthLine, 'commands=9,llmCalls=8'));
  assertAssertionFailure(() =>
    assertHealthFieldOrder(
      'health | runtime=degraded | issues=2 | openai=true | discord=true | llmBackend=openai | backend=timeout | metrics=commands=9,llmCalls=9',
    ),
  );
});

test('diag assertion helpers enforce canonical formatting and reject near-misses', () => {
  const diagOkLine =
    'diag: ok | hasDiscord=true | hasOpenAI=false | llmBackend=openclaw | allowMetricsReset=false | allowAuditTail=true | openclawRetryAttempts=0 | openclawRetryBaseDelayMs=250 | auditTailDefault=5 | auditTailMax=20 | operatorReplyMaxChars=1900 | lastBackendError=none';
  assertDiagOk(diagOkLine, {
    hasDiscord: true,
    hasOpenAI: false,
    llmBackend: 'openclaw',
    allowMetricsReset: false,
    allowAuditTail: true,
  });
  assertDiagCoreFieldOrder(diagOkLine);

  const diagIssuesLine =
    'diag: issues detected -> OPENAI_API_KEY missing | hasDiscord=false | hasOpenAI=true | llmBackend=openai | allowMetricsReset=true | allowAuditTail=false | openclawRetryAttempts=3 | openclawRetryBaseDelayMs=750 | auditTailDefault=5 | auditTailMax=20 | operatorReplyMaxChars=1900 | lastBackendError=timeout';
  assertDiagIssues(diagIssuesLine, 'OPENAI_API_KEY missing');
  assertDiagAvailability(diagIssuesLine, { hasDiscord: false, hasOpenAI: true });
  assertDiagBackendAndGuards(diagIssuesLine, {
    llmBackend: 'openai',
    allowMetricsReset: true,
    allowAuditTail: false,
  });
  assertDiagRetryPolicy(diagIssuesLine, { attempts: 3, baseDelayMs: 750 });
  assertDiagPolicyTail(diagIssuesLine);
  assertDiagLastBackendError(diagIssuesLine, 'timeout');
  assertDiagCoreFieldOrder(diagIssuesLine);

  assertAssertionFailure(() =>
    assertDiagOk(diagOkLine, {
      hasDiscord: false,
      hasOpenAI: false,
      llmBackend: 'openclaw',
      allowMetricsReset: false,
      allowAuditTail: true,
    }),
  );
  assertAssertionFailure(() => assertDiagIssues(diagIssuesLine, 'OPENAI_API_KEY mismatch'));
  assertAssertionFailure(() => assertDiagLastBackendError(diagIssuesLine, 'none'));
});

test('diag ok/issues outputs preserve shared core field ordering', () => {
  const ok = evaluateOperatorCommand('/diag', makeDeps());
  const issues = evaluateOperatorCommand(
    '/diag',
    makeDeps({
      validateRuntime: () => ['OPENAI_API_KEY missing'],
      llmBackend: () => 'openai',
      hasOpenAI: () => false,
      runtimeSummary: () => 'bot=buddy | llmBackend=openai',
    }),
  );

  assertDiagCoreFieldOrder(ok);
  assertDiagCoreFieldOrder(issues);
});

function makeDeps(overrides: Partial<OperatorCommandDeps> = {}): OperatorCommandDeps {
  return {
    formatUptime: () => '12s',
    modelName: () => 'gpt-test',
    appVersion: () => '0.1.0-test',
    runtimeSummary: () => 'bot=buddy | llmBackend=openclaw',
    validateRuntime: () => [],
    refreshConfigFromEnv: () => {},
    hasDiscord: () => true,
    hasOpenAI: () => false,
    llmBackend: () => 'openclaw',
    backendHealthSummary: () => 'none',
    tryAcquireReload: () => ({ ok: true }),
    metricsSummary: () => METRICS_SUMMARY_BASE,
    allowMetricsReset: () => false,
    resetMetrics: () => {},
    allowAuditTail: () => false,
    openclawRetryAttempts: () => 0,
    openclawRetryBaseDelayMs: () => 250,
    getAuditTail: () => 'none',
    ...overrides,
  };
}

test('formatCommandListWithOr handles 0/1/2/n command lists (table-driven)', () => {
  const cases: Array<{ input: string[]; expected: string }> = [
    { input: [], expected: '' },
    { input: ['/help'], expected: '/help' },
    { input: ['/help', '/commands'], expected: '/help or /commands' },
    { input: ['/?', '/help', '/commands'], expected: '/?, /help, or /commands' },
    { input: ['/ping', '/status', '/diag', '/reload'], expected: '/ping, /status, /diag, or /reload' },
  ];

  for (const c of cases) {
    assert.equal(formatCommandListWithOr(c.input), c.expected);
  }
});

test('formatCommandListWithOr does not mutate input arrays', () => {
  const input = ['/?', '/help', '/commands'];
  const snapshot = [...input];

  const result = formatCommandListWithOr(input);

  assert.equal(result, '/?, /help, or /commands');
  assert.deepEqual(input, snapshot);
});

function backendModeToken(mode: 'openclaw' | 'openai'): string {
  return `llmBackend=${mode}`;
}

function assertHasBackendMode(text: string | null, mode: 'openclaw' | 'openai'): void {
  assert.match(text ?? '', new RegExp(backendModeToken(mode)));
}

function assertHealthSignals(
  text: string | null,
  options: {
    runtime: 'ok' | 'degraded';
    issues: number;
    openai: boolean;
    llmBackend: 'openclaw' | 'openai';
  },
): void {
  const target = text ?? '';
  assert.match(target, new RegExp(`^health \\| runtime=${options.runtime} \\| issues=${options.issues} \\|`));
  assert.match(target, new RegExp(`\\| openai=${String(options.openai)} \\|`));
  assert.match(target, new RegExp(`\\| llmBackend=${options.llmBackend} \\|`));
}

function assertHealthBackendSummary(text: string | null, backendSummary: string): void {
  const target = text ?? '';
  assert.match(target, new RegExp(`\\| backend=${backendSummary} \\|`));
}

function assertHealthMetricsSuffix(text: string | null, metrics: string): void {
  const target = text ?? '';
  assert.match(target, new RegExp(`\\| metrics=${metrics}$`));
}

function assertHealthFieldOrder(text: string | null): void {
  const target = text ?? '';
  const fragments = ['| runtime=', '| issues=', '| discord=', '| openai=', '| llmBackend=', '| backend=', '| metrics='];

  let cursor = -1;
  for (const fragment of fragments) {
    const index = target.indexOf(fragment);
    assert.ok(index >= 0, `missing health fragment: ${fragment}`);
    assert.ok(index > cursor, `out-of-order health fragment: ${fragment}`);
    cursor = index;
  }
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertDiagIssues(text: string | null, issuePrefix: string): void {
  const target = text ?? '';
  const escaped = escapeForRegExp(issuePrefix);
  assert.match(target, new RegExp(`^diag: issues detected -> ${escaped}`));
}

function assertAssertionFailure(fn: () => unknown): void {
  assert.throws(fn, (err: unknown) => {
    return err instanceof assert.AssertionError;
  });
}

function assertDiagPolicyTail(text: string | null): void {
  const target = text ?? '';
  assert.match(
    target,
    /\| openclawRetryAttempts=\d+ \| openclawRetryBaseDelayMs=\d+ \| auditTailDefault=5 \| auditTailMax=20 \| operatorReplyMaxChars=1900 \|/,
  );
}

function assertDiagRetryPolicy(
  text: string | null,
  options: {
    attempts: number;
    baseDelayMs: number;
  },
): void {
  const target = text ?? '';
  assert.match(target, new RegExp(`\\| openclawRetryAttempts=${options.attempts} \\|`));
  assert.match(target, new RegExp(`\\| openclawRetryBaseDelayMs=${options.baseDelayMs} \\|`));
}

function assertDiagAvailability(
  text: string | null,
  options: {
    hasDiscord: boolean;
    hasOpenAI: boolean;
  },
): void {
  const target = text ?? '';
  assert.match(target, new RegExp(`\\| hasDiscord=${String(options.hasDiscord)} \\|`));
  assert.match(target, new RegExp(`\\| hasOpenAI=${String(options.hasOpenAI)} \\|`));
}

function assertDiagBackendAndGuards(
  text: string | null,
  options: {
    llmBackend: 'openclaw' | 'openai';
    allowMetricsReset: boolean;
    allowAuditTail: boolean;
  },
): void {
  const target = text ?? '';
  assertHasBackendMode(target, options.llmBackend);
  assert.match(target, new RegExp(`\\| allowMetricsReset=${String(options.allowMetricsReset)} \\|`));
  assert.match(target, new RegExp(`\\| allowAuditTail=${String(options.allowAuditTail)} \\|`));
}

function assertDiagLastBackendError(text: string | null, value: string): void {
  const target = text ?? '';
  assert.match(target, new RegExp(`\\| lastBackendError=${value}$`));
}

function assertDiagCoreFieldOrder(text: string | null): void {
  const target = text ?? '';
  const fragments = [
    '| hasDiscord=',
    '| hasOpenAI=',
    '| llmBackend=',
    '| allowMetricsReset=',
    '| allowAuditTail=',
    '| openclawRetryAttempts=',
    '| openclawRetryBaseDelayMs=',
    '| auditTailDefault=',
    '| auditTailMax=',
    '| operatorReplyMaxChars=',
    '| lastBackendError=',
  ];

  let cursor = -1;
  for (const fragment of fragments) {
    const index = target.indexOf(fragment);
    assert.ok(index >= 0, `missing diag fragment: ${fragment}`);
    assert.ok(index > cursor, `out-of-order diag fragment: ${fragment}`);
    cursor = index;
  }
}

function assertDiagOk(
  text: string | null,
  options: {
    hasDiscord: boolean;
    hasOpenAI: boolean;
    llmBackend: 'openclaw' | 'openai';
    allowMetricsReset: boolean;
    allowAuditTail: boolean;
    lastBackendError?: string;
  },
): void {
  const target = text ?? '';
  assert.match(target, /^diag: ok \|/);
  assertDiagAvailability(target, {
    hasDiscord: options.hasDiscord,
    hasOpenAI: options.hasOpenAI,
  });
  assert.match(target, new RegExp(`\\| llmBackend=${options.llmBackend} \\|`));
  assert.match(target, new RegExp(`\\| allowMetricsReset=${String(options.allowMetricsReset)} \\|`));
  assert.match(target, new RegExp(`\\| allowAuditTail=${String(options.allowAuditTail)} \\|`));
  assertDiagRetryPolicy(target, { attempts: 0, baseDelayMs: 250 });
  assertDiagPolicyTail(target);
  assertDiagLastBackendError(target, options.lastBackendError ?? 'none');
}

function assertReloadApplied(text: string | null, summaryPrefix = 'bot=buddy'): void {
  assert.equal(text, `reload: applied | ${summaryPrefix}`);
}

function assertReloadRateLimited(text: string | null, retryAfterSec: number): void {
  assert.equal(text, `reload: rate-limited | retryAfterSec=${retryAfterSec}`);
}

function assertReloadIssuesRemain(text: string | null, issues: string): void {
  assert.equal(text, `reload: applied, but issues remain -> ${issues}`);
}

function assertStatusPayload(
  text: string | null,
  options: {
    model: string;
    llmBackend: 'openclaw' | 'openai';
  },
): void {
  assert.equal(
    text,
    `status: online | uptime=12s | model=${options.model} | bot=buddy | llmBackend=${options.llmBackend}`,
  );
}

function assertPingPayload(text: string | null, model: string): void {
  assert.equal(text, `pong | uptime=12s | model=${model}`);
}

function makeDiagTupleDeps(options: {
  hasDiscord: boolean;
  hasOpenAI: boolean;
  llmBackend: 'openclaw' | 'openai';
  allowMetricsReset?: boolean;
  allowAuditTail?: boolean;
  validateRuntime?: () => string[];
  backendHealthSummary?: () => string;
}): OperatorCommandDeps {
  return makeDeps({
    hasDiscord: () => options.hasDiscord,
    hasOpenAI: () => options.hasOpenAI,
    llmBackend: () => options.llmBackend,
    allowMetricsReset: () => options.allowMetricsReset ?? false,
    allowAuditTail: () => options.allowAuditTail ?? false,
    validateRuntime: options.validateRuntime ?? (() => []),
    backendHealthSummary: options.backendHealthSummary ?? (() => 'none'),
  });
}

function makeModeSwitchDeps(options: {
  initialMode?: 'openclaw' | 'openai';
  switchedMode?: 'openclaw' | 'openai';
  onRefresh?: () => void;
  validateRuntime?: (mode: 'openclaw' | 'openai') => string[];
} = {}): OperatorCommandDeps {
  let mode = options.initialMode ?? 'openclaw';
  const switchedMode = options.switchedMode ?? 'openai';

  return makeDeps({
    modelName: () => (mode === 'openai' ? 'gpt-4o-mini' : 'openclaw:main'),
    llmBackend: () => mode,
    runtimeSummary: () => `bot=buddy | llmBackend=${mode}`,
    refreshConfigFromEnv: () => {
      mode = switchedMode;
      options.onRefresh?.();
    },
    validateRuntime: () => options.validateRuntime?.(mode) ?? [],
    hasOpenAI: () => mode === 'openai',
  });
}

test('makeModeSwitchDeps honors initial/switched mode permutations', () => {
  const cases: Array<{
    initialMode: 'openclaw' | 'openai';
    switchedMode: 'openclaw' | 'openai';
    expectedInitialModel: string;
    expectedSwitchedModel: string;
  }> = [
    {
      initialMode: 'openclaw',
      switchedMode: 'openai',
      expectedInitialModel: 'openclaw:main',
      expectedSwitchedModel: 'gpt-4o-mini',
    },
    {
      initialMode: 'openai',
      switchedMode: 'openclaw',
      expectedInitialModel: 'gpt-4o-mini',
      expectedSwitchedModel: 'openclaw:main',
    },
  ];

  for (const c of cases) {
    const deps = makeModeSwitchDeps({
      initialMode: c.initialMode,
      switchedMode: c.switchedMode,
    });

    assert.equal(deps.llmBackend(), c.initialMode);
    assert.equal(deps.modelName(), c.expectedInitialModel);

    deps.refreshConfigFromEnv();

    assert.equal(deps.llmBackend(), c.switchedMode);
    assert.equal(deps.modelName(), c.expectedSwitchedModel);
  }
});

test('returns base liveness payloads for ping/uptime commands (table-driven)', () => {
  const cases: Array<{ input: string; expected: string }> = [
    {
      input: '/ping',
      expected: 'pong | uptime=12s | model=gpt-test',
    },
    {
      input: '/uptime',
      expected: 'uptime=12s | model=gpt-test',
    },
    {
      input: '/up',
      expected: 'uptime=12s | model=gpt-test',
    },
  ];

  for (const c of cases) {
    const result = evaluateOperatorCommand(c.input, makeDeps());
    assert.equal(result, c.expected);
  }
});

test('returns version payload across known/unknown appVersion states (table-driven)', () => {
  const cases: Array<{ appVersion: string; expected: string }> = [
    {
      appVersion: '0.1.0-test',
      expected: `version=0.1.0-test | node=${process.version} | model=gpt-test`,
    },
    {
      appVersion: 'unknown',
      expected: `version=unknown | node=${process.version} | model=gpt-test`,
    },
  ];

  for (const c of cases) {
    const result = evaluateOperatorCommand('/version', makeDeps({ appVersion: () => c.appVersion }));
    assert.equal(result, c.expected);
  }
});

test('returns id payload with combined runtime identity fields', () => {
  const openclawResult = evaluateOperatorCommand('/id', makeDeps());
  assert.equal(openclawResult, `id: version=0.1.0-test | model=gpt-test | backend=openclaw | node=${process.version}`);

  const openaiResult = evaluateOperatorCommand(
    '/id',
    makeDeps({
      appVersion: () => '2.0.1',
      modelName: () => 'gpt-4o-mini',
      llmBackend: () => 'openai',
      runtimeSummary: () => 'bot=buddy | llmBackend=openai',
    }),
  );
  assert.equal(openaiResult, `id: version=2.0.1 | model=gpt-4o-mini | backend=openai | node=${process.version}`);
});

test('returns model payload with current backend', () => {
  const openclawResult = evaluateOperatorCommand('/model', makeDeps());
  assert.equal(openclawResult, 'model=gpt-test | backend=openclaw');

  const openclawAliasResult = evaluateOperatorCommand('/backend', makeDeps());
  assert.equal(openclawAliasResult, 'model=gpt-test | backend=openclaw');

  const openaiResult = evaluateOperatorCommand(
    '/model',
    makeDeps({
      modelName: () => 'gpt-4o-mini',
      llmBackend: () => 'openai',
      runtimeSummary: () => 'bot=buddy | llmBackend=openai',
    }),
  );
  assert.equal(openaiResult, 'model=gpt-4o-mini | backend=openai');

  const openaiAliasResult = evaluateOperatorCommand(
    '/backend',
    makeDeps({
      modelName: () => 'gpt-4o-mini',
      llmBackend: () => 'openai',
      runtimeSummary: () => 'bot=buddy | llmBackend=openai',
    }),
  );
  assert.equal(openaiAliasResult, 'model=gpt-4o-mini | backend=openai');
});

test('returns help payload with disabled guard markers for all help aliases (table-driven)', () => {
  const cases = ['/help', '/commands', '/?'];
  const expected =
    'commands: /?, /help, /commands, /ping, /up, /uptime, /version, /id, /model, /backend, /status, /runtime, /diag, /health, /reload, /metrics-reset (disabled), /audit-tail [1-20] (disabled) | enable: ALLOW_METRICS_RESET=true, ALLOW_AUDIT_TAIL=true';

  for (const input of cases) {
    const result = evaluateOperatorCommand(input, makeDeps());
    assert.equal(result, expected);
  }
});

test('help output preserves canonical command ordering for operator discoverability', () => {
  const result = evaluateOperatorCommand('/help', makeDeps());
  assert.ok(result);

  const commandsPart = result
    .replace(/^commands:\s*/, '')
    .split(' | enable: ', 1)[0]
    .split(', ');

  assert.deepEqual(commandsPart, [
    '/?',
    '/help',
    '/commands',
    '/ping',
    '/up',
    '/uptime',
    '/version',
    '/id',
    '/model',
    '/backend',
    '/status',
    '/runtime',
    '/diag',
    '/health',
    '/reload',
    '/metrics-reset (disabled)',
    '/audit-tail [1-20] (disabled)',
  ]);
});

test('help output preserves canonical ordering when guard-gated commands are enabled', () => {
  const result = evaluateOperatorCommand(
    '/help',
    makeDeps({
      allowMetricsReset: () => true,
      allowAuditTail: () => true,
    }),
  );
  assert.ok(result);

  const commandsPart = result.replace(/^commands:\s*/, '').split(', ');

  assert.deepEqual(commandsPart, [
    '/?',
    '/help',
    '/commands',
    '/ping',
    '/up',
    '/uptime',
    '/version',
    '/id',
    '/model',
    '/backend',
    '/status',
    '/runtime',
    '/diag',
    '/health',
    '/reload',
    '/metrics-reset',
    '/audit-tail [1-20]',
  ]);
});

test('returns help payload across guard-state combinations (table-driven)', () => {
  const cases: Array<{
    allowMetricsReset: boolean;
    allowAuditTail: boolean;
    expected: string;
  }> = [
    {
      allowMetricsReset: true,
      allowAuditTail: true,
      expected: commandsLine(HELP_ALL_ENABLED),
    },
    {
      allowMetricsReset: true,
      allowAuditTail: false,
      expected: commandsLine(HELP_METRICS_ENABLED_AUDIT_DISABLED),
    },
  ];

  for (const c of cases) {
    const result = evaluateOperatorCommand(
      '/help',
      makeDeps({
        allowMetricsReset: () => c.allowMetricsReset,
        allowAuditTail: () => c.allowAuditTail,
      }),
    );
    assert.equal(result, c.expected);
  }
});

test('help command summaries do not leak state across guard toggles (table-driven)', () => {
  const cases: Array<{
    name: string;
    start: { allowMetricsReset: boolean; allowAuditTail: boolean };
    next: { allowMetricsReset: boolean; allowAuditTail: boolean };
    expectedFirst: string;
    expectedSecond: string;
  }> = [
    {
      name: 'disabled->enabled',
      start: { allowMetricsReset: false, allowAuditTail: false },
      next: { allowMetricsReset: true, allowAuditTail: true },
      expectedFirst: commandsLine(HELP_ALL_DISABLED),
      expectedSecond: commandsLine(HELP_ALL_ENABLED),
    },
    {
      name: 'enabled->disabled',
      start: { allowMetricsReset: true, allowAuditTail: true },
      next: { allowMetricsReset: false, allowAuditTail: false },
      expectedFirst: commandsLine(HELP_ALL_ENABLED),
      expectedSecond: commandsLine(HELP_ALL_DISABLED),
    },
  ];

  for (const c of cases) {
    let allowMetricsReset = c.start.allowMetricsReset;
    let allowAuditTail = c.start.allowAuditTail;

    const deps = makeDeps({
      allowMetricsReset: () => allowMetricsReset,
      allowAuditTail: () => allowAuditTail,
    });

    const first = evaluateOperatorCommand('/help', deps);

    allowMetricsReset = c.next.allowMetricsReset;
    allowAuditTail = c.next.allowAuditTail;
    const second = evaluateOperatorCommand('/help', deps);

    assert.equal(first, c.expectedFirst, `${c.name} first help mismatch`);
    assert.equal(second, c.expectedSecond, `${c.name} second help mismatch`);
  }
});

test('rejects invalid help usage with extra args (space/tab/newline + mixed-case)', () => {
  const inputs = [
    '/help now',
    '/commands now',
    '/? now',
    '/help\tnow',
    '/commands\tnow',
    '/?\tnow',
    '/help\nnow',
    '/commands\nnow',
    '/?\nnow',
    '/Help now',
    '/Commands now',
  ];
  const expected = HELP_INVALID_USAGE_LINE;

  for (const input of inputs) {
    const result = evaluateOperatorCommand(input, makeDeps());
    assert.equal(result, expected);
  }
});

test('does not treat help-alias-prefixed tokens as help invalid-usage (table-driven)', () => {
  const inputs = ['/helping', '/commandsx', '/?x'];

  for (const input of inputs) {
    const result = evaluateOperatorCommand(input, makeDeps());
    assert.ok(result?.startsWith(unknownCommandLine(input)));
    assert.ok(!result?.startsWith(HELP_INVALID_USAGE_LINE));
  }
});

test('returns status payload', () => {
  const result = evaluateOperatorCommand('/status', makeDeps());
  assertStatusPayload(result, { model: 'gpt-test', llmBackend: 'openclaw' });
});

test('returns runtime payload as status alias', () => {
  const result = evaluateOperatorCommand('/runtime', makeDeps());
  assertStatusPayload(result, { model: 'gpt-test', llmBackend: 'openclaw' });
});

test('returns ping/status payloads with backend-specific model labels (table-driven)', () => {
  const cases: Array<{
    deps: OperatorCommandDeps;
    model: string;
    llmBackend: 'openclaw' | 'openai';
  }> = [
    {
      deps: makeDeps({ modelName: () => 'openclaw:gremlin' }),
      model: 'openclaw:gremlin',
      llmBackend: 'openclaw',
    },
    {
      deps: makeDeps({
        modelName: () => 'gpt-4o-mini',
        llmBackend: () => 'openai',
        runtimeSummary: () => 'bot=buddy | llmBackend=openai',
      }),
      model: 'gpt-4o-mini',
      llmBackend: 'openai',
    },
  ];

  for (const c of cases) {
    const ping = evaluateOperatorCommand('/ping', c.deps);
    const status = evaluateOperatorCommand('/status', c.deps);

    assertPingPayload(ping, c.model);
    assertStatusPayload(status, { model: c.model, llmBackend: c.llmBackend });
  }
});

test('diag ok payload reflects availability/backend tuples (table-driven)', () => {
  const cases = [
    {
      name: 'openclaw with discord available and openai unavailable',
      hasDiscord: true,
      hasOpenAI: false,
      llmBackend: 'openclaw' as const,
    },
    {
      name: 'openai with discord available and openai available',
      hasDiscord: true,
      hasOpenAI: true,
      llmBackend: 'openai' as const,
    },
    {
      name: 'openai with discord unavailable and openai available',
      hasDiscord: false,
      hasOpenAI: true,
      llmBackend: 'openai' as const,
    },
  ];

  for (const c of cases) {
    const result = evaluateOperatorCommand(
      '/diag',
      makeDiagTupleDeps({
        hasDiscord: c.hasDiscord,
        hasOpenAI: c.hasOpenAI,
        llmBackend: c.llmBackend,
      }),
    );

    assertDiagOk(result, {
      hasDiscord: c.hasDiscord,
      hasOpenAI: c.hasOpenAI,
      llmBackend: c.llmBackend,
      allowMetricsReset: false,
      allowAuditTail: false,
    });
  }
});

test('diag issues payload reflects availability/backend/guard tuples (table-driven)', () => {
  const cases = [
    {
      issues: ['bad env', 'missing key'],
      expectedIssuePrefix: 'bad env ; missing key',
      hasDiscord: true,
      hasOpenAI: false,
      llmBackend: 'openclaw' as const,
      allowMetricsReset: true,
      allowAuditTail: true,
      backendError: 'openclaw timeout @ 2026-03-31T00:20:00.000Z',
    },
    {
      issues: ['OPENAI_API_KEY missing'],
      expectedIssuePrefix: 'OPENAI_API_KEY missing',
      hasDiscord: false,
      hasOpenAI: true,
      llmBackend: 'openai' as const,
      allowMetricsReset: false,
      allowAuditTail: false,
      backendError: 'none',
    },
  ];

  for (const c of cases) {
    const result = evaluateOperatorCommand(
      '/diag',
      makeDiagTupleDeps({
        hasDiscord: c.hasDiscord,
        hasOpenAI: c.hasOpenAI,
        llmBackend: c.llmBackend,
        allowMetricsReset: c.allowMetricsReset,
        allowAuditTail: c.allowAuditTail,
        validateRuntime: () => c.issues,
        backendHealthSummary: () => c.backendError,
      }),
    );

    assertDiagIssues(result, c.expectedIssuePrefix);
    assertDiagAvailability(result, {
      hasDiscord: c.hasDiscord,
      hasOpenAI: c.hasOpenAI,
    });
    assertDiagBackendAndGuards(result, {
      llmBackend: c.llmBackend,
      allowMetricsReset: c.allowMetricsReset,
      allowAuditTail: c.allowAuditTail,
    });
    assertDiagPolicyTail(result);
    assertDiagLastBackendError(result, c.backendError);
  }
});

test('diag issues assertion treats regex-like issue text as literals (table-driven)', () => {
  const cases = [
    'missing key (OPENAI_API_KEY?)',
    'token [OPENAI|ALT] missing',
    'path C:\\bot\\key ^missing$',
  ];

  for (const issue of cases) {
    const result = evaluateOperatorCommand(
      '/diag',
      makeDeps({
        validateRuntime: () => [issue],
      }),
    );

    assertDiagIssues(result, issue);
  }
});

test('diag issues assertion rejects near-match issue text (single-character diffs)', () => {
  const cases = [
    {
      actual: 'missing key (OPENAI_API_KEY?)',
      expected: 'missing key (OPENAI_API_KEY!)',
    },
    {
      actual: 'token [OPENAI|ALT] missing',
      expected: 'token [OPENAI|AL7] missing',
    },
    {
      actual: 'path C:\\bot\\key ^missing$',
      expected: 'path C:\\bot\\key ^missing!$',
    },
  ];

  for (const c of cases) {
    const result = evaluateOperatorCommand(
      '/diag',
      makeDeps({
        validateRuntime: () => [c.actual],
      }),
    );

    assertAssertionFailure(() => assertDiagIssues(result, c.expected));
  }
});


test('diag reflects hasOpenAI=true after reload switches backend to openai', () => {
  const deps = makeModeSwitchDeps();

  const before = evaluateOperatorCommand('/diag', deps);
  evaluateOperatorCommand('/reload', deps);
  const after = evaluateOperatorCommand('/diag', deps);

  assertHasBackendMode(before, 'openclaw');
  assertDiagAvailability(before, { hasDiscord: true, hasOpenAI: false });

  assertHasBackendMode(after, 'openai');
  assertDiagAvailability(after, { hasDiscord: true, hasOpenAI: true });
});

test('returns health payload in ok state', () => {
  const result = evaluateOperatorCommand('/health', makeDeps());
  assertHealthSignals(result, { runtime: 'ok', issues: 0, openai: false, llmBackend: 'openclaw' });
  assertHealthBackendSummary(result, 'none');
  assertHealthMetricsSuffix(result, METRICS_SUMMARY_BASE);
  assertHealthFieldOrder(result);
});
test('returns health payload in degraded state', () => {
  const result = evaluateOperatorCommand(
    '/health',
    makeDeps({
      validateRuntime: () => ['bad env'],
      backendHealthSummary: () => 'timeout @ 2026-03-31T00:40:00.000Z',
      metricsSummary: () => 'commands=9,llmCalls=9,llmOk=7,llmErr=2,llmAvgMs=423,llmRecentMaxMs=1100,llmLt250Ms=2,llm250To1000Ms=6,llmGt1000Ms=1,cmdAvgMs=14,cmdRecentMaxMs=22',
    }),
  );
  assertHealthSignals(result, { runtime: 'degraded', issues: 1, openai: false, llmBackend: 'openclaw' });
  assertHealthBackendSummary(result, 'timeout @ 2026-03-31T00:40:00.000Z');
  assertHealthMetricsSuffix(
    result,
    'commands=9,llmCalls=9,llmOk=7,llmErr=2,llmAvgMs=423,llmRecentMaxMs=1100,llmLt250Ms=2,llm250To1000Ms=6,llmGt1000Ms=1,cmdAvgMs=14,cmdRecentMaxMs=22',
  );
  assertHealthFieldOrder(result);
});

test('diag and health surface inconsistent openai capability signals', () => {
  const deps = makeDeps({
    llmBackend: () => 'openai',
    hasOpenAI: () => false,
    runtimeSummary: () => 'bot=buddy | llmBackend=openai',
    validateRuntime: () => ['OPENAI_API_KEY is missing while LLM_BACKEND=openai'],
  });

  const diag = evaluateOperatorCommand('/diag', deps);
  const health = evaluateOperatorCommand('/health', deps);

  assertDiagIssues(diag, 'OPENAI_API_KEY is missing while LLM_BACKEND=openai');
  assertDiagAvailability(diag, { hasDiscord: true, hasOpenAI: false });
  assertDiagBackendAndGuards(diag, {
    llmBackend: 'openai',
    allowMetricsReset: false,
    allowAuditTail: false,
  });
  assertDiagPolicyTail(diag);

  assertHealthSignals(health, { runtime: 'degraded', issues: 1, openai: false, llmBackend: 'openai' });
});

test('health stays coherent across reload switch to openai', () => {
  const deps = makeModeSwitchDeps({
    validateRuntime: (mode) => (mode === 'openai' ? ['OPENAI_API_KEY missing'] : []),
  });

  const before = evaluateOperatorCommand('/health', deps);
  evaluateOperatorCommand('/reload', deps);
  const after = evaluateOperatorCommand('/health', deps);

  assertHealthSignals(before, { runtime: 'ok', issues: 0, openai: false, llmBackend: 'openclaw' });
  assertHealthSignals(after, { runtime: 'degraded', issues: 1, openai: true, llmBackend: 'openai' });
});

test('runs reload and returns success payload', () => {
  let reloadCalls = 0;
  const result = evaluateOperatorCommand(
    '/reload',
    makeDeps({
      refreshConfigFromEnv: () => {
        reloadCalls += 1;
      },
    }),
  );

  assert.equal(reloadCalls, 1);
  assertReloadApplied(result, 'bot=buddy | llmBackend=openclaw');
});

test('runs reload and returns success payload for openai mode summary', () => {
  let reloadCalls = 0;
  const result = evaluateOperatorCommand(
    '/reload',
    makeDeps({
      refreshConfigFromEnv: () => {
        reloadCalls += 1;
      },
      llmBackend: () => 'openai',
      runtimeSummary: () => 'bot=buddy | llmBackend=openai | openAIKey=set',
      hasOpenAI: () => true,
    }),
  );

  assert.equal(reloadCalls, 1);
  assertReloadApplied(result, 'bot=buddy | llmBackend=openai | openAIKey=set');
});

test('diag and reload stay semantically aligned on backend mode after mode switch', () => {
  const deps = makeModeSwitchDeps();

  const before = evaluateOperatorCommand('/diag', deps);
  const reloaded = evaluateOperatorCommand('/reload', deps);
  const after = evaluateOperatorCommand('/diag', deps);

  assertHasBackendMode(before, 'openclaw');
  assertReloadApplied(reloaded, 'bot=buddy | llmBackend=openai');
  assertHasBackendMode(after, 'openai');
});

test('returns reload rate-limit payload and skips refresh', () => {
  let reloadCalls = 0;
  const result = evaluateOperatorCommand(
    '/reload',
    makeDeps({
      tryAcquireReload: () => ({ ok: false, retryAfterSec: 12 }),
      refreshConfigFromEnv: () => {
        reloadCalls += 1;
      },
    }),
  );

  assert.equal(reloadCalls, 0);
  assertReloadRateLimited(result, 12);
});

test('reload rate-limit does not mutate backend mode observed by diag', () => {
  let refreshCalls = 0;

  const deps = makeModeSwitchDeps({
    onRefresh: () => {
      refreshCalls += 1;
    },
  });

  const before = evaluateOperatorCommand('/diag', deps);
  const reloaded = evaluateOperatorCommand(
    '/reload',
    makeDeps({
      ...deps,
      tryAcquireReload: () => ({ ok: false, retryAfterSec: 9 }),
    }),
  );
  const after = evaluateOperatorCommand('/diag', deps);

  assertHasBackendMode(before, 'openclaw');
  assertReloadRateLimited(reloaded, 9);
  assert.equal(refreshCalls, 0);
  assertHasBackendMode(after, 'openclaw');
});

test('runs reload and returns issues payload when validation fails', () => {
  let reloadCalls = 0;
  const result = evaluateOperatorCommand(
    '/reload',
    makeDeps({
      refreshConfigFromEnv: () => {
        reloadCalls += 1;
      },
      validateRuntime: () => ['still broken'],
    }),
  );

  assert.equal(reloadCalls, 1);
  assertReloadIssuesRemain(result, 'still broken');
});

test('reload issues branch keeps diag/status mode-consistent after switch to openai', () => {
  const deps = makeModeSwitchDeps({
    validateRuntime: (mode) => (mode === 'openai' ? ['OPENAI_API_KEY missing'] : []),
  });

  const beforeDiag = evaluateOperatorCommand('/diag', deps);
  const reloaded = evaluateOperatorCommand('/reload', deps);
  const afterDiag = evaluateOperatorCommand('/diag', deps);
  const afterStatus = evaluateOperatorCommand('/status', deps);

  assertHasBackendMode(beforeDiag, 'openclaw');
  assertReloadIssuesRemain(reloaded, 'OPENAI_API_KEY missing');
  assertDiagBackendAndGuards(afterDiag, {
    llmBackend: 'openai',
    allowMetricsReset: false,
    allowAuditTail: false,
  });
  assertDiagIssues(afterDiag, 'OPENAI_API_KEY missing');
  assertDiagPolicyTail(afterDiag);
  assertStatusPayload(afterStatus, { model: 'gpt-4o-mini', llmBackend: 'openai' });
});

test('returns metrics-reset disabled payload when guard is off', () => {
  const result = evaluateOperatorCommand('/metrics-reset', makeDeps());
  assert.equal(result, METRICS_RESET_DISABLED_LINE);
});

test('treats mixed-case metrics-reset token as guard-gated command when disabled', () => {
  const result = evaluateOperatorCommand('/METRICS-RESET', makeDeps());
  assert.equal(result, METRICS_RESET_DISABLED_LINE);
});

test('resets metrics when metrics-reset guard is on', () => {
  let resetCalls = 0;
  const result = evaluateOperatorCommand(
    '/metrics-reset',
    makeDeps({
      allowMetricsReset: () => true,
      resetMetrics: () => {
        resetCalls += 1;
      },
      metricsSummary: () => METRICS_SUMMARY_BASE,
    }),
  );

  assert.equal(resetCalls, 1);
  assert.equal(result, METRICS_RESET_OK_LINE);
});
test('supports mixed-case metrics-reset token when guard is on', () => {
  let resetCalls = 0;
  const result = evaluateOperatorCommand(
    '/METRICS-RESET',
    makeDeps({
      allowMetricsReset: () => true,
      resetMetrics: () => {
        resetCalls += 1;
      },
      metricsSummary: () => METRICS_SUMMARY_BASE,
    }),
  );

  assert.equal(resetCalls, 1);
  assert.equal(result, METRICS_RESET_OK_LINE);
});
test('returns audit-tail disabled payload when guard is off', () => {
  const result = evaluateOperatorCommand('/audit-tail', makeDeps());
  assert.equal(result, AUDIT_TAIL_DISABLED_LINE);
});

test('returns audit tail when guard is on', () => {
  const result = evaluateOperatorCommand(
    '/audit-tail',
    makeDeps({
      allowAuditTail: () => true,
      getAuditTail: () => AUDIT_TAIL_SAMPLE_ENTRY,
    }),
  );
  assert.equal(result, auditTailLine(AUDIT_TAIL_SAMPLE_ENTRY));
});

test('supports custom audit-tail limit in valid range', () => {
  let calledWith: number | undefined;
  const result = evaluateOperatorCommand(
    '/audit-tail 12',
    makeDeps({
      allowAuditTail: () => true,
      getAuditTail: (limit) => {
        calledWith = limit;
        return 'tail';
      },
    }),
  );

  assert.equal(calledWith, 12);
  assert.equal(result, auditTailLine('tail'));
});

test('supports extra whitespace around audit-tail limit', () => {
  let calledWith: number | undefined;
  const result = evaluateOperatorCommand(
    '/audit-tail    3   ',
    makeDeps({
      allowAuditTail: () => true,
      getAuditTail: (limit) => {
        calledWith = limit;
        return 'tail';
      },
    }),
  );

  assert.equal(calledWith, 3);
  assert.equal(result, auditTailLine('tail'));
});

test('supports tab/newline whitespace for audit-tail command detection', () => {
  let calledWith: number | undefined;
  const result = evaluateOperatorCommand(
    '/audit-tail\t3\n',
    makeDeps({
      allowAuditTail: () => true,
      getAuditTail: (limit) => {
        calledWith = limit;
        return 'tail';
      },
    }),
  );

  assert.equal(calledWith, 3);
  assert.equal(result, auditTailLine('tail'));
});

test('supports mixed-case audit-tail command token in evaluator routing', () => {
  let calledWith: number | undefined;
  const result = evaluateOperatorCommand(
    '/AUDIT-TAIL 3',
    makeDeps({
      allowAuditTail: () => true,
      getAuditTail: (limit) => {
        calledWith = limit;
        return 'tail';
      },
    }),
  );

  assert.equal(calledWith, 3);
  assert.equal(result, auditTailLine('tail'));
});

test('treats audit-tail with trailing tab as audit-tail command (not unknown command)', () => {
  const result = evaluateOperatorCommand('/audit-tail\t', makeDeps());
  assert.equal(result, AUDIT_TAIL_DISABLED_LINE);
});

test('treats mixed-case audit-tail token as guard-gated command when disabled', () => {
  const result = evaluateOperatorCommand('/AUDIT-TAIL 3', makeDeps());
  assert.equal(result, AUDIT_TAIL_DISABLED_LINE);
});

test('returns disabled for audit-tail with extra args when guard is off', () => {
  const result = evaluateOperatorCommand('/audit-tail 3 extra', makeDeps());
  assert.equal(result, AUDIT_TAIL_DISABLED_LINE);
});

test('rejects extra audit-tail args when guard is on (space/tab/newline + mixed-case)', () => {
  const cases = ['/audit-tail 3 extra', '/audit-tail\t3\textra', '/audit-tail\n3\nextra', '/Audit-Tail 3 extra'];

  for (const input of cases) {
    const result = evaluateOperatorCommand(input, makeDeps({ allowAuditTail: () => true }));
    assert.equal(result, AUDIT_TAIL_INVALID_USAGE_LINE);
  }
});

test('treats audit-tail-prefixed unknown commands as unknown command hints', () => {
  const result = evaluateOperatorCommand('/audit-tailing', makeDeps());
  assert.equal(result, unknownCommandLine('/audit-tailing'));
});

test('returns disabled for invalid audit-tail limit when guard is off', () => {
  const result = evaluateOperatorCommand('/audit-tail 21', makeDeps());
  assert.equal(result, AUDIT_TAIL_DISABLED_LINE);
});

test('rejects invalid audit-tail limit when guard is on (space/tab/newline + mixed-case)', () => {
  const cases = ['/audit-tail 21', '/audit-tail\t21', '/audit-tail\n21', '/Audit-Tail 21'];

  for (const input of cases) {
    const result = evaluateOperatorCommand(input, makeDeps({ allowAuditTail: () => true }));
    assert.equal(result, AUDIT_TAIL_INVALID_LIMIT_LINE);
  }
});

test('truncates oversized audit-tail response safely', () => {
  const result = evaluateOperatorCommand(
    '/audit-tail',
    makeDeps({
      allowAuditTail: () => true,
      getAuditTail: () => 'x'.repeat(5000),
    }),
  );

  assert.ok(result?.startsWith('audit-tail: '));
  assert.ok(result?.endsWith(' ...[truncated]'));
  assert.ok((result?.length ?? 0) <= 1900);
});

test('does not truncate normal audit-tail response', () => {
  const result = evaluateOperatorCommand(
    '/audit-tail',
    makeDeps({
      allowAuditTail: () => true,
      getAuditTail: () => 'short tail',
    }),
  );

  assert.equal(result, auditTailLine('short tail'));
});

test('returns null for non-command input', () => {
  const result = evaluateOperatorCommand('hello bot', makeDeps());
  assert.equal(result, null);
});

test('returns unknown command hint for near-miss slash-command typos (table-driven)', () => {
  const cases: Array<{ input: string; expected: string }> = [
    {
      input: '/hepl',
      expected: unknownCommandWithSuggestion('/hepl', '/help'),
    },
    {
      input: '/stauts',
      expected: unknownCommandWithSuggestion('/stauts', '/status'),
    },
    {
      input: '/uptim',
      expected: unknownCommandWithSuggestion('/uptim', '/uptime'),
    },
    {
      input: '/upp',
      expected: unknownCommandWithSuggestion('/upp', '/up'),
    },
    {
      input: '/verison',
      expected: unknownCommandWithSuggestion('/verison', '/version'),
    },
    {
      input: '/modle',
      expected: unknownCommandWithSuggestion('/modle', '/model'),
    },
    {
      input: '/backedn',
      expected: unknownCommandWithSuggestion('/backedn', '/backend'),
    },
    {
      input: '/runtmie',
      expected: unknownCommandWithSuggestion('/runtmie', '/runtime'),
    },
    {
      input: '/relaod',
      expected: unknownCommandWithSuggestion('/relaod', '/reload'),
    },
    {
      input: '/commnads',
      expected: unknownCommandWithSuggestion('/commnads', '/commands'),
    },
    {
      input: '/healht',
      expected: unknownCommandWithSuggestion('/healht', '/health'),
    },
  ];

  for (const c of cases) {
    const result = evaluateOperatorCommand(c.input, makeDeps());
    assert.equal(result, c.expected);
  }
});

test('returns unknown command hint for unrecognized slash command with args', () => {
  const result = evaluateOperatorCommand('/mystery abc 123', makeDeps());
  assert.equal(result, unknownCommandLine('/mystery'));
});

test('returns explicit invalid-usage guidance for known no-arg commands with extra args', () => {
  const cases: Array<{ input: string; expected: string }> = [
    { input: '/ping now', expected: noArgInvalidUsageLine('/ping') },
    { input: '/up now', expected: noArgInvalidUsageLine('/up') },
    { input: '/uptime now', expected: noArgInvalidUsageLine('/uptime') },
    { input: '/version now', expected: noArgInvalidUsageLine('/version') },
    { input: '/id now', expected: noArgInvalidUsageLine('/id') },
    { input: '/model now', expected: noArgInvalidUsageLine('/model') },
    { input: '/backend now', expected: noArgInvalidUsageLine('/backend') },
    { input: '/status now', expected: noArgInvalidUsageLine('/status') },
    { input: '/runtime now', expected: noArgInvalidUsageLine('/runtime') },
    { input: '/diag now', expected: noArgInvalidUsageLine('/diag') },
    { input: '/health now', expected: noArgInvalidUsageLine('/health') },
    { input: '/reload now', expected: noArgInvalidUsageLine('/reload') },
    { input: '/metrics-reset now', expected: METRICS_RESET_DISABLED_LINE },
    { input: '/ping\tnow', expected: noArgInvalidUsageLine('/ping') },
    { input: '/status\nnow', expected: noArgInvalidUsageLine('/status') },
    { input: '/PING now', expected: noArgInvalidUsageLine('/ping') },
    { input: '/Status now', expected: noArgInvalidUsageLine('/status') },
    { input: '/Reload now', expected: noArgInvalidUsageLine('/reload') },
    { input: '/Metrics-Reset now', expected: METRICS_RESET_DISABLED_LINE },
  ];

  for (const c of cases) {
    const result = evaluateOperatorCommand(c.input, makeDeps());
    assert.equal(result, c.expected);
  }
});

test('returns invalid usage for metrics-reset extra args when guard is on', () => {
  const cases = ['/metrics-reset now', '/metrics-reset\tnow', '/metrics-reset\nnow', '/Metrics-Reset now'];

  for (const input of cases) {
    const result = evaluateOperatorCommand(input, makeDeps({ allowMetricsReset: () => true }));
    assert.equal(result, METRICS_RESET_INVALID_USAGE_LINE);
  }
});

test('returns disabled for metrics-reset extra args with whitespace variants when guard is off', () => {
  const cases = ['/metrics-reset now', '/metrics-reset\tnow', '/metrics-reset\nnow'];

  for (const input of cases) {
    const result = evaluateOperatorCommand(input, makeDeps());
    assert.equal(result, METRICS_RESET_DISABLED_LINE);
  }
});

test('does not suggest /? for short unknown slash commands', () => {
  const inputs = ['/x', '/?x'];

  for (const input of inputs) {
    const result = evaluateOperatorCommand(input, makeDeps());
    assert.equal(result, unknownCommandLine(input));
  }
});

test('does not emit noisy suggestions for unrelated or broad unknown commands (table-driven)', () => {
  const inputs = ['/beacon', '/runner', '/beep', '/hello', '/mod'];

  for (const input of inputs) {
    const result = evaluateOperatorCommand(input, makeDeps());
    assert.equal(result, unknownCommandLine(input));
  }
});

test('does not suggest guard-gated commands when the guards are disabled', () => {
  const cases = ['/metricsresest', '/MetricsResest', '/audit-tailx', '/AUDIT-TAILX'];

  for (const input of cases) {
    const result = evaluateOperatorCommand(input, makeDeps());
    assert.equal(result, unknownCommandLine(input.toLowerCase()));
  }
});

test('suggests guard-gated commands when the guards are enabled', () => {
  const deps = makeDeps({
    allowMetricsReset: () => true,
    allowAuditTail: () => true,
  });

  const cases: Array<{ input: string; suggestion: string }> = [
    { input: '/metricsresest', suggestion: '/metrics-reset' },
    { input: '/MetricsResest', suggestion: '/metrics-reset' },
    { input: '/audit-tailx', suggestion: '/audit-tail' },
    { input: '/AUDIT-TAILX', suggestion: '/audit-tail' },
  ];

  for (const c of cases) {
    const normalized = c.input.toLowerCase();
    const result = evaluateOperatorCommand(c.input, deps);
    assert.equal(
      result,
      unknownCommandWithSuggestion(normalized, c.suggestion),
    );
  }
});

test('enforces suggestion policy across command classes (table-driven)', () => {
  const disabledDeps = makeDeps();
  const enabledDeps = makeDeps({ allowMetricsReset: () => true, allowAuditTail: () => true });

  const cases: Array<{ input: string; deps: typeof disabledDeps; shouldSuggest: boolean }> = [
    // help aliases
    { input: '/hepl', deps: disabledDeps, shouldSuggest: true },
    { input: '/?x', deps: disabledDeps, shouldSuggest: false },
    // short alias noise guard
    { input: '/di', deps: disabledDeps, shouldSuggest: false },
    // guarded commands (off => suppress, on => allow)
    { input: '/metricsresest', deps: disabledDeps, shouldSuggest: false },
    { input: '/metricsresest', deps: enabledDeps, shouldSuggest: true },
    { input: '/audit-tailx', deps: disabledDeps, shouldSuggest: false },
    { input: '/audit-tailx', deps: enabledDeps, shouldSuggest: true },
  ];

  for (const c of cases) {
    const result = evaluateOperatorCommand(c.input, c.deps);
    assert.ok(result?.startsWith(unknownCommandLine(c.input)));
    const hasSuggestion = (result ?? '').includes('| did you mean ');
    assert.equal(hasSuggestion, c.shouldSuggest, `${c.input} suggestion mismatch`);
  }
});

test('does not suggest /id for short transposition typo due short-command noise guard', () => {
  const result = evaluateOperatorCommand('/di', makeDeps());
  assert.equal(result, unknownCommandLine('/di'));
});
