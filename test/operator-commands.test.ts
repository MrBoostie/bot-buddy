import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOperatorCommand, type OperatorCommandDeps } from '../src/operator-commands.ts';

function makeDeps(overrides: Partial<OperatorCommandDeps> = {}): OperatorCommandDeps {
  return {
    formatUptime: () => '12s',
    modelName: () => 'gpt-test',
    runtimeSummary: () => 'bot=buddy | llmBackend=openclaw',
    validateRuntime: () => [],
    refreshConfigFromEnv: () => {},
    hasDiscord: () => true,
    hasOpenAI: () => false,
    llmBackend: () => 'openclaw',
    backendHealthSummary: () => 'none',
    tryAcquireReload: () => ({ ok: true }),
    metricsSummary: () => 'commands=0,llmCalls=0,llmOk=0,llmErr=0,llmAvgMs=0,llmRecentMaxMs=0,llmLt250Ms=0,llm250To1000Ms=0,llmGt1000Ms=0,cmdAvgMs=0,cmdRecentMaxMs=0',
    allowMetricsReset: () => false,
    resetMetrics: () => {},
    allowAuditTail: () => false,
    getAuditTail: () => 'none',
    ...overrides,
  };
}

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
  },
): void {
  const target = text ?? '';
  assert.match(target, new RegExp(`^health \\| runtime=${options.runtime} \\| issues=${options.issues} \\|`));
  assert.match(target, new RegExp(`\\| openai=${String(options.openai)} \\|`));
}

function assertDiagIssues(text: string | null, issuePrefix: string): void {
  const target = text ?? '';
  assert.match(target, new RegExp(`^diag: issues detected -> ${issuePrefix}`));
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

test('returns ping payload', () => {
  const result = evaluateOperatorCommand('/ping', makeDeps());
  assert.equal(result, 'pong | uptime=12s | model=gpt-test');
});

test('returns status payload', () => {
  const result = evaluateOperatorCommand('/status', makeDeps());
  assert.equal(
    result,
    'status: online | uptime=12s | model=gpt-test | bot=buddy | llmBackend=openclaw',
  );
});

test('returns ping/status payloads with openclaw agent model label', () => {
  const deps = makeDeps({ modelName: () => 'openclaw:gremlin' });

  const ping = evaluateOperatorCommand('/ping', deps);
  const status = evaluateOperatorCommand('/status', deps);

  assert.equal(ping, 'pong | uptime=12s | model=openclaw:gremlin');
  assert.equal(
    status,
    'status: online | uptime=12s | model=openclaw:gremlin | bot=buddy | llmBackend=openclaw',
  );
});

test('returns ping/status payloads with openai model label', () => {
  const deps = makeDeps({
    modelName: () => 'gpt-4o-mini',
    llmBackend: () => 'openai',
    runtimeSummary: () => 'bot=buddy | llmBackend=openai',
  });

  const ping = evaluateOperatorCommand('/ping', deps);
  const status = evaluateOperatorCommand('/status', deps);

  assert.equal(ping, 'pong | uptime=12s | model=gpt-4o-mini');
  assert.equal(
    status,
    'status: online | uptime=12s | model=gpt-4o-mini | bot=buddy | llmBackend=openai',
  );
});

test('returns diag ok payload', () => {
  const result = evaluateOperatorCommand('/diag', makeDeps());
  assert.equal(
    result,
    'diag: ok | hasDiscord=true | hasOpenAI=false | llmBackend=openclaw | allowMetricsReset=false | allowAuditTail=false | auditTailDefault=5 | auditTailMax=20 | operatorReplyMaxChars=1900 | lastBackendError=none',
  );
});

test('returns diag issues payload', () => {
  const result = evaluateOperatorCommand(
    '/diag',
    makeDeps({
      validateRuntime: () => ['bad env', 'missing key'],
      backendHealthSummary: () => 'openclaw timeout @ 2026-03-31T00:20:00.000Z',
      allowMetricsReset: () => true,
      allowAuditTail: () => true,
    }),
  );
  assertDiagIssues(result, 'bad env ; missing key');
  assertHasBackendMode(result, 'openclaw');
  assert.match(result ?? '', /allowMetricsReset=true/);
  assert.match(result ?? '', /allowAuditTail=true/);
  assert.match(result ?? '', /lastBackendError=openclaw timeout @ 2026-03-31T00:20:00.000Z/);
});

test('returns diag payload with openai backend mode when configured', () => {
  const result = evaluateOperatorCommand(
    '/diag',
    makeDeps({
      hasOpenAI: () => true,
      llmBackend: () => 'openai',
    }),
  );

  assert.equal(
    result,
    'diag: ok | hasDiscord=true | hasOpenAI=true | llmBackend=openai | allowMetricsReset=false | allowAuditTail=false | auditTailDefault=5 | auditTailMax=20 | operatorReplyMaxChars=1900 | lastBackendError=none',
  );
});

test('diag reflects hasOpenAI=true after reload switches backend to openai', () => {
  const deps = makeModeSwitchDeps();

  const before = evaluateOperatorCommand('/diag', deps);
  evaluateOperatorCommand('/reload', deps);
  const after = evaluateOperatorCommand('/diag', deps);

  assertHasBackendMode(before, 'openclaw');
  assert.match(before ?? '', /hasOpenAI=false/);

  assertHasBackendMode(after, 'openai');
  assert.match(after ?? '', /hasOpenAI=true/);
});

test('returns health payload in ok state', () => {
  const result = evaluateOperatorCommand('/health', makeDeps());
  assert.equal(
    result,
    'health | runtime=ok | issues=0 | discord=true | openai=false | backend=none | metrics=commands=0,llmCalls=0,llmOk=0,llmErr=0,llmAvgMs=0,llmRecentMaxMs=0,llmLt250Ms=0,llm250To1000Ms=0,llmGt1000Ms=0,cmdAvgMs=0,cmdRecentMaxMs=0',
  );
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
  assert.equal(
    result,
    'health | runtime=degraded | issues=1 | discord=true | openai=false | backend=timeout @ 2026-03-31T00:40:00.000Z | metrics=commands=9,llmCalls=9,llmOk=7,llmErr=2,llmAvgMs=423,llmRecentMaxMs=1100,llmLt250Ms=2,llm250To1000Ms=6,llmGt1000Ms=1,cmdAvgMs=14,cmdRecentMaxMs=22',
  );
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
  assert.match(diag ?? '', /llmBackend=openai/);

  assertHealthSignals(health, { runtime: 'degraded', issues: 1, openai: false });
});

test('health stays coherent across reload switch to openai', () => {
  const deps = makeModeSwitchDeps({
    validateRuntime: (mode) => (mode === 'openai' ? ['OPENAI_API_KEY missing'] : []),
  });

  const before = evaluateOperatorCommand('/health', deps);
  evaluateOperatorCommand('/reload', deps);
  const after = evaluateOperatorCommand('/health', deps);

  assertHealthSignals(before, { runtime: 'ok', issues: 0, openai: false });
  assertHealthSignals(after, { runtime: 'degraded', issues: 1, openai: true });
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
  assertHasBackendMode(afterDiag, 'openai');
  assertDiagIssues(afterDiag, 'OPENAI_API_KEY missing');
  assert.equal(
    afterStatus,
    'status: online | uptime=12s | model=gpt-4o-mini | bot=buddy | llmBackend=openai',
  );
});

test('returns metrics-reset disabled payload when guard is off', () => {
  const result = evaluateOperatorCommand('/metrics-reset', makeDeps());
  assert.equal(result, 'metrics-reset: disabled (set ALLOW_METRICS_RESET=true to enable)');
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
      metricsSummary: () => 'commands=0,llmCalls=0,llmOk=0,llmErr=0,llmAvgMs=0,llmRecentMaxMs=0,llmLt250Ms=0,llm250To1000Ms=0,llmGt1000Ms=0,cmdAvgMs=0,cmdRecentMaxMs=0',
    }),
  );

  assert.equal(resetCalls, 1);
  assert.equal(
    result,
    'metrics-reset: ok | commands=0,llmCalls=0,llmOk=0,llmErr=0,llmAvgMs=0,llmRecentMaxMs=0,llmLt250Ms=0,llm250To1000Ms=0,llmGt1000Ms=0,cmdAvgMs=0,cmdRecentMaxMs=0',
  );
});

test('returns audit-tail disabled payload when guard is off', () => {
  const result = evaluateOperatorCommand('/audit-tail', makeDeps());
  assert.equal(result, 'audit-tail: disabled (set ALLOW_AUDIT_TAIL=true to enable)');
});

test('returns audit tail when guard is on', () => {
  const result = evaluateOperatorCommand(
    '/audit-tail',
    makeDeps({
      allowAuditTail: () => true,
      getAuditTail: () => '2026-03-31T03:30:00.000Z operator metrics reset executed',
    }),
  );
  assert.equal(result, 'audit-tail: 2026-03-31T03:30:00.000Z operator metrics reset executed');
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
  assert.equal(result, 'audit-tail: tail');
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
  assert.equal(result, 'audit-tail: tail');
});

test('rejects extra audit-tail args', () => {
  const result = evaluateOperatorCommand('/audit-tail 3 extra', makeDeps());
  assert.equal(result, 'audit-tail: invalid usage (use /audit-tail or /audit-tail <1-20>)');
});

test('rejects invalid audit-tail limit', () => {
  const result = evaluateOperatorCommand('/audit-tail 21', makeDeps());
  assert.equal(result, 'audit-tail: invalid limit (use /audit-tail or /audit-tail <1-20>)');
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

  assert.equal(result, 'audit-tail: short tail');
});

test('returns null for non-command input', () => {
  const result = evaluateOperatorCommand('hello bot', makeDeps());
  assert.equal(result, null);
});
