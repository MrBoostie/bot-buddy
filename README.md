# bot-buddy

Boostie's sidekick bot. Local-first today, Discord+OpenAI-ready tomorrow.

## Why this exists

- Build a playground bot I can evolve quickly
- Keep a direct interface outside Discord for dev/testing
- Deploy safely on VPS with least privilege (service user, no sudo)

## Current modes

1. **Local CLI mode** (works right now, no creds needed)
2. **Discord mode** (enable when token is provided)
3. **LLM mode** (enable when OpenAI key is provided)

## Quick start

```bash
npm install
cp .env.example .env
npm run check
npm test
npm run preflight
npm run buddy
```

Talk in terminal. Type `exit` to quit.

`npm run preflight` performs a runtime env sanity check (same validation rules as startup) and exits non-zero with actionable issues when config is invalid.

## Tomorrow morning wiring

Populate `.env`:

- `LLM_BACKEND=openclaw` (default, uses same OpenClaw auth path as Boostie)
- `OPENCLAW_AGENT_ID=main`
- `OPENCLAW_TIMEOUT_SEC=90`
- `DISCORD_TOKEN`
- optional `DISCORD_CHANNEL_ID` lock

If you want direct key mode instead:
- `LLM_BACKEND=openai`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `REQUIRE_OPENAI_FOR_DISCORD=true` (default): refuse Discord boot if key missing in openai mode

Then:

```bash
npm run build
npm start
```

In Discord, buddy responds when messaged as either `buddy <prompt>`, `<@BOT_ID> <prompt>`, or `<@!BOT_ID> <prompt>`.

Built-in operator commands (directed to bot):
- `/?`, `/help`, or `/commands` — list available operator commands (marks guard-gated commands as disabled when not enabled and includes exact env toggles to enable them)
  - Extra args are rejected (`/help now` -> `help: invalid usage (use /?, /help, or /commands)`) to keep operator command parsing predictable.
  - Help output now includes all three help aliases explicitly for easier discoverability.
  - Command order is intentional: fast identity/liveness/diagnostics first, higher-impact guard-gated commands at the end.
- `/ping` — fast liveness check (`pong` + uptime + model)
- `/up` or `/uptime` — compact uptime + model check without ping wording
- `/version` — compact build/runtime identity (`version`, `node`, `model`)
  - `version` resolves from `BOT_BUDDY_VERSION`, then `npm_package_version`, else `unknown`
- `/id` — single-line identity snapshot (`version`, `model`, `backend`, `node`)
- `/model` or `/backend` — quick model/backend identity (`model`, `backend`)
- `/status` or `/runtime` — uptime + model + redacted runtime summary

On Discord startup, the bot now logs resolved app version metadata (`value` + `source`) to simplify deployment/debug verification.
- `/diag` — quick configuration health report + availability signals (`hasDiscord`/`hasOpenAI`) + guard/policy snapshot + last backend error
- `/health` — machine-grep-friendly one-line health summary (runtime + backend + in-memory metrics, including llmCalls, LLM avg/recent-max latency + buckets, and command latency)
- `/reload` — re-read `.env` safely (no process restart, cooldown controlled by `OPERATOR_RELOAD_COOLDOWN_SEC`)
  - Safe hot-refresh contract: applies environment changes in-process, never restarts the bot process, and is cooldown-limited (`reload: rate-limited | retryAfterSec=<n>`).
  - Validation-failure contract: if refresh applies but runtime checks still fail, response is `reload: applied, but issues remain -> ...` (with inline issue summary).
- `/metrics-reset` — reset in-memory metrics (disabled by default; enable with `ALLOW_METRICS_RESET=true`)
  - Guard-first behavior: while disabled, arg-suffixed forms (e.g. `/metrics-reset now`) return `metrics-reset: disabled (set ALLOW_METRICS_RESET=true to enable)`; once enabled, extra args return invalid usage.
- `/audit-tail` or `/audit-tail <1-20>` — show recent in-memory operator audit events (disabled by default; enable with `ALLOW_AUDIT_TAIL=true`; limit must be an unsigned integer; invalid extra args are rejected)
  - Guard-first behavior: while disabled, malformed forms (e.g. `/audit-tail 21`, `/audit-tail 3 extra`) return `audit-tail: disabled (set ALLOW_AUDIT_TAIL=true to enable)`; validation errors apply when enabled.

Guard-first summary: for guard-gated commands, disabled guards always return deterministic `...: disabled (...)` responses before deeper argument validation.

Unknown slash commands now return an explicit hint (`unknown command: /<name> (use /?, /help, or /commands)`) instead of falling through to LLM mode, with near-match suggestions for simple typos (e.g. `/hepl` -> `did you mean /help?`). In operator mode, unknown slash commands are handled deterministically and do **not** route to LLM chat generation.

Typo-suggestion boundaries (operator mode):

- Suggestions are provided for close, relevant typos of known commands (including common transpositions like `/stauts` -> `/status`).
- Suggestions are intentionally suppressed for noisy/ambiguous cases (very short low-signal tokens, unrelated commands, and `/?` alias-style noise).
- `/?` remains a first-class help alias for direct use, but it is intentionally excluded from typo suggestion targets (to avoid outputs like `did you mean /??`).
- Guard-gated commands (`/metrics-reset`, `/audit-tail`) are only suggested when their guards are enabled.
Known no-arg operator commands now return explicit usage guidance when called with extra args (e.g. `/ping now` -> `ping: invalid usage (use /ping)`) instead of generic unknown-command fallback.

Operator command contract:

- Slash commands are case-insensitive (`/PING`, `/Help`, `/AUDIT-TAIL` are normalized).
- Whitespace separators are normalized for argument parsing (spaces, tabs, and newlines are treated consistently).

Sample `/diag` output:

```text
diag: ok | hasDiscord=true | hasOpenAI=false | llmBackend=openclaw | allowMetricsReset=false | allowAuditTail=false | auditTailDefault=5 | auditTailMax=20 | operatorReplyMaxChars=1900 | lastBackendError=none
diag: issues detected -> OPENAI_API_KEY missing | hasDiscord=true | hasOpenAI=false | llmBackend=openai | allowMetricsReset=false | allowAuditTail=false | auditTailDefault=5 | auditTailMax=20 | operatorReplyMaxChars=1900 | lastBackendError=none
```

`/diag` field glossary (quick operator reference):

- `hasDiscord` / `hasOpenAI` — runtime capability checks for configured integrations.
- `llmBackend` — active backend mode (`openclaw` or `openai`).
- `allowMetricsReset` / `allowAuditTail` — guard toggles for sensitive operator commands.
- `auditTailDefault` / `auditTailMax` — configured audit-tail limit policy.
- `operatorReplyMaxChars` — max operator response length before truncation safety applies.
- `lastBackendError` — latest backend health summary string (`none` when healthy).

Sample `/health` output:

```text
health | runtime=ok | issues=0 | discord=true | openai=false | backend=none | metrics=commands=0,llmCalls=0,llmOk=0,llmErr=0,llmAvgMs=0,llmRecentMaxMs=0,llmLt250Ms=0,llm250To1000Ms=0,llmGt1000Ms=0,cmdAvgMs=0,cmdRecentMaxMs=0
```

`/health` field glossary (quick operator reference):

- `runtime` — overall status (`ok` when no validation issues, else `degraded`).
- `issues` — count of active runtime validation issues.
- `discord` / `openai` — capability booleans surfaced in health context.
- `backend` — latest backend health summary token/string.
- `metrics` — in-memory counters + latency distributions used by operator diagnostics.

When to use which:

- Use `/health` for quick one-line status checks and machine-friendly monitoring/grep pipelines.
- Use `/diag` for deeper operator triage (capabilities, guard flags, policy limits, and backend error context).

Operator command output style (quick map):

- Machine-grep-friendly: `/health`, `/status`, `/runtime`, `/ping`, `/uptime`, `/up`, `/version`, `/id`, `/model`, `/backend`
- Human-triage-oriented: `/diag`, `/help`, `/commands`, `/?`, `/reload`, `/metrics-reset`, `/audit-tail`

Operational logging toggles:
- `METRICS_SNAPSHOT_INTERVAL_SEC=0` disables periodic metric logs (default)
- Set `METRICS_SNAPSHOT_INTERVAL_SEC` to a positive value to emit periodic `metrics snapshot` log lines
- Unchanged periodic snapshots are deduped; next changed snapshot reports how many unchanged intervals were suppressed

Runtime config guardrails:
- Invalid `LLM_BACKEND` values are flagged at boot (`openclaw`/`openai` only)
- Invalid `OPENCLAW_TIMEOUT_SEC` (<=0 / non-numeric) fails fast
- Empty `OPENCLAW_AGENT_ID` fails fast

Logging:
- Structured console prefixes (`[scope] [level]`) for boot/discord paths
- Startup emits an ops-focused line: backend mode + reload cooldown + channel lock state
- Discord execution errors include short request IDs (`rid=...`) for easier traceability
- `/metrics-reset` attempts are audit-logged with actor + channel + request ID

Secrets hygiene:
- Never commit `.env`
- Commit `.env.example` only
- Keep API keys in local runtime env or systemd `EnvironmentFile`

Version pinning for deterministic `/version` + startup logs:
- **systemd** (`EnvironmentFile`):

  ```ini
  BOT_BUDDY_VERSION=2026.04.01
  ```

- **docker** (`docker run`):

  ```bash
  docker run --env BOT_BUDDY_VERSION=2026.04.01 ...
  ```

## Developer notes

- `parseUnsignedIntInRange(raw, min, max)` in `src/operator-commands.ts` is the shared strict numeric parser for operator command args.
- It enforces ASCII digits only (`0-9`) and explicit range bounds (no sign prefixes, decimals, or localized numerals).
- Reuse this helper for future numeric operator command arguments to keep validation behavior consistent.

## VPS hardening note

You said: *"Boostie has sudo, buddy will not."* ✅

Use a dedicated unprivileged user to run the service:

```bash
sudo useradd -r -s /usr/sbin/nologin buddy || true
sudo chown -R buddy:buddy /opt/bot-buddy
```

Then install service:

```bash
./scripts/install-service.sh buddy
```

## CI

GitHub Actions now runs two CI validation tracks on push/PR:
- `npm run verify:quick` for fast feedback (typecheck + docs links + changelog-policy fixtures)
- `npm run verify` for the full validation gate (typecheck + docs links + full tests)

Local validation shortcuts:
- `npm run verify:quick` -> typecheck + docs links + changelog policy fixtures (fast feedback loop)
- `npm run verify` -> full validation gate used by CI

## Release notes

- Ongoing changes are tracked in [CHANGELOG.md](./CHANGELOG.md).

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contributor workflow and changelog policy commands.

## Release checklist

Canonical contributor/release checklist is maintained in [CONTRIBUTING.md](./CONTRIBUTING.md) to avoid drift.

### What counts as behavior-visible?

For changelog/PR policy, treat these as behavior-visible:

- Changes under `src/` that alter bot runtime behavior or operator command responses
- Changes under `scripts/` that affect setup/deploy/runtime operations
- `package.json` changes that alter runtime dependencies or scripts
- `README.md` updates that change documented operator/runtime behavior

### Changelog policy bypass label

- Maintainers can add PR label `skip-changelog` to bypass the changelog policy check in exceptional cases.
- Use sparingly (e.g., clearly non-user-visible internal CI/docs-only cleanup).

### Run changelog policy check locally

You can run the same changelog policy used in CI against two commits:

```bash
scripts/check-changelog-policy.sh <base-sha> <head-sha>
```

Example (last commit vs current HEAD):

```bash
scripts/check-changelog-policy.sh HEAD~1 HEAD
```

For fast fixture-only policy checks:

```bash
npm run test:changelog-policy
```

### Changelog policy fixture coverage

- `src/` changes: fail without changelog, pass with changelog
- `README.md` changes: fail without changelog, pass with changelog
- `scripts/` changes: fail without changelog, pass with changelog
- `package.json` changes: fail without changelog, pass with changelog
- Non-behavior-visible-only changes: pass without changelog

## Next features queued

- memory file + simple persona card
- command router (`/status`, `/ping`, `/dream`)
- Discord slash commands
- optional webhook control plane
