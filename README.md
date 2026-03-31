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
- `/ping` — fast liveness check (`pong` + uptime + model)
- `/status` — uptime + model + redacted runtime summary
- `/diag` — quick configuration health report + last backend error snapshot
- `/health` — machine-grep-friendly one-line health summary (runtime + backend + in-memory metrics, including llmCalls, LLM avg/recent-max latency + buckets, and command latency)
- `/reload` — re-read `.env` safely (no process restart, cooldown controlled by `OPERATOR_RELOAD_COOLDOWN_SEC`)
- `/metrics-reset` — reset in-memory metrics (disabled by default; enable with `ALLOW_METRICS_RESET=true`)
- `/audit-tail` or `/audit-tail <1-20>` — show recent in-memory operator audit events (disabled by default; enable with `ALLOW_AUDIT_TAIL=true`; limit must be an unsigned integer; invalid extra args are rejected)

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

## Next features queued

- memory file + simple persona card
- command router (`/status`, `/ping`, `/dream`)
- Discord slash commands
- optional webhook control plane
