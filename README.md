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
npm run buddy
```

Talk in terminal. Type `exit` to quit.

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
- `/ping` — fast liveness check (`pong` + uptime + model)
- `/status` — uptime + model + redacted runtime summary
- `/diag` — quick configuration health report + guard/policy snapshot + last backend error
- `/health` — machine-grep-friendly one-line health summary (runtime + backend + in-memory metrics, including llmCalls, LLM avg/recent-max latency + buckets, and command latency)
- `/reload` — re-read `.env` safely (no process restart, cooldown controlled by `OPERATOR_RELOAD_COOLDOWN_SEC`)
- `/metrics-reset` — reset in-memory metrics (disabled by default; enable with `ALLOW_METRICS_RESET=true`)
- `/audit-tail` or `/audit-tail <1-20>` — show recent in-memory operator audit events (disabled by default; enable with `ALLOW_AUDIT_TAIL=true`; limit must be an unsigned integer; invalid extra args are rejected)

Unknown slash commands now return an explicit hint (`unknown command: /<name> (use /?, /help, or /commands)`) instead of falling through to LLM mode, with near-match suggestions for simple typos (e.g. `/hepl` -> `did you mean /help?`).

Sample `/diag` output:

```text
diag: ok | hasDiscord=true | hasOpenAI=false | llmBackend=openclaw | allowMetricsReset=false | allowAuditTail=false | auditTailDefault=5 | auditTailMax=20 | operatorReplyMaxChars=1900 | lastBackendError=none
```

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

GitHub Actions now runs `npm run check` + `npm test` on every push to `main` and on pull requests.

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
