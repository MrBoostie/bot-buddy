import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const README_PATH = new URL('../README.md', import.meta.url);

test('README documents versioning and startup-log guidance (table-driven)', () => {
  const readme = readFileSync(README_PATH, 'utf8');
  const patterns = [
    /\*\*systemd\*\* \(`EnvironmentFile`\):/,
    /BOT_BUDDY_VERSION=2026\.04\.01/,
    /\*\*docker\*\* \(`docker run`\):/,
    /docker run --env BOT_BUDDY_VERSION=2026\.04\.01 \.\.\./,
    /`version` resolves from `BOT_BUDDY_VERSION`, then `npm_package_version`, else `unknown`/,
    /On Discord startup, the bot now logs resolved app version metadata \(`value` \+ `source`\)/,
    /Command order is intentional: fast identity\/liveness\/diagnostics first, higher-impact guard-gated commands at the end\./,
    /Known no-arg operator commands now return explicit usage guidance when called with extra args \(e\.g\. `\/ping now` -> `ping: invalid usage \(use \/ping\)`\) instead of generic unknown-command fallback\./,
    /Guard-first behavior: while disabled, arg-suffixed forms \(e\.g\. `\/metrics-reset now`\) return `metrics-reset: disabled \(set ALLOW_METRICS_RESET=true to enable\)`; once enabled, extra args return invalid usage\./,
    /Guard-first behavior: while disabled, malformed forms \(e\.g\. `\/audit-tail 21`, `\/audit-tail 3 extra`\) return `audit-tail: disabled \(set ALLOW_AUDIT_TAIL=true to enable\)`; validation errors apply when enabled\./,
    /Extra args are rejected \(`\/help now` -> `help: invalid usage \(use \/\?, \/help, or \/commands\)`\) to keep operator command parsing predictable\./,
    /Unknown slash commands now return an explicit hint \(`unknown command: \/<name> \(use \/\?, \/help, or \/commands\)`\)/,
    /In operator mode, unknown slash commands are handled deterministically and do \*\*not\*\* route to LLM chat generation\./,
    /Typo-suggestion boundaries \(operator mode\):/,
    /Suggestions are provided for close, relevant typos of known commands \(including common transpositions like `\/stauts` -> `\/status`\)\./,
    /Suggestions are intentionally suppressed for noisy\/ambiguous cases \(very short low-signal tokens, unrelated commands, and `\/\?` alias-style noise\)\./,
    /Guard-gated commands \(`\/metrics-reset`, `\/audit-tail`\) are only suggested when their guards are enabled\./,
    /Operator command contract:/,
    /Slash commands are case-insensitive \(`\/PING`, `\/Help`, `\/AUDIT-TAIL` are normalized\)\./,
    /Whitespace separators are normalized for argument parsing \(spaces, tabs, and newlines are treated consistently\)\./,
    /`\/diag` — quick configuration health report \+ availability signals \(`hasDiscord`\/`hasOpenAI`\) \+ guard\/policy snapshot \+ last backend error/,
    /diag: issues detected -> OPENAI_API_KEY missing \| hasDiscord=true \| hasOpenAI=false \| llmBackend=openai \| allowMetricsReset=false \| allowAuditTail=false \| auditTailDefault=5 \| auditTailMax=20 \| operatorReplyMaxChars=1900 \| lastBackendError=none/,
    /`\/diag` field glossary \(quick operator reference\):/,
    /`hasDiscord` \/ `hasOpenAI` — runtime capability checks for configured integrations\./,
    /`llmBackend` — active backend mode \(`openclaw` or `openai`\)\./,
    /`allowMetricsReset` \/ `allowAuditTail` — guard toggles for sensitive operator commands\./,
    /`auditTailDefault` \/ `auditTailMax` — configured audit-tail limit policy\./,
    /`operatorReplyMaxChars` — max operator response length before truncation safety applies\./,
    /`lastBackendError` — latest backend health summary string \(`none` when healthy\)\./,
    /Sample `\/health` output:/,
    /health \| runtime=ok \| issues=0 \| discord=true \| openai=false \| backend=none \| metrics=commands=0,llmCalls=0,llmOk=0,llmErr=0,llmAvgMs=0,llmRecentMaxMs=0,llmLt250Ms=0,llm250To1000Ms=0,llmGt1000Ms=0,cmdAvgMs=0,cmdRecentMaxMs=0/,
    /`\/health` field glossary \(quick operator reference\):/,
    /`runtime` — overall status \(`ok` when no validation issues, else `degraded`\)\./,
    /`issues` — count of active runtime validation issues\./,
    /`discord` \/ `openai` — capability booleans surfaced in health context\./,
    /`backend` — latest backend health summary token\/string\./,
    /`metrics` — in-memory counters \+ latency distributions used by operator diagnostics\./,
    /When to use which:/,
    /Use `\/health` for quick one-line status checks and machine-friendly monitoring\/grep pipelines\./,
    /Use `\/diag` for deeper operator triage \(capabilities, guard flags, policy limits, and backend error context\)\./,
    /Operator command output style \(quick map\):/,
    /Machine-grep-friendly: `\/health`, `\/status`, `\/runtime`, `\/ping`, `\/uptime`, `\/up`, `\/version`, `\/id`, `\/model`, `\/backend`/,
    /Human-triage-oriented: `\/diag`, `\/help`, `\/commands`, `\/\?`, `\/reload`, `\/metrics-reset`, `\/audit-tail`/,
  ];

  for (const pattern of patterns) {
    assert.match(readme, pattern);
  }
});
