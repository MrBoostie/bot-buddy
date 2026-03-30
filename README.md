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

- `OPENAI_API_KEY`
- `DISCORD_TOKEN`
- optional `DISCORD_CHANNEL_ID` lock
- `REQUIRE_OPENAI_FOR_DISCORD=true` (default): refuse Discord boot if key missing

Then:

```bash
npm run build
npm start
```

In Discord, buddy responds when messaged as either `buddy <prompt>`, `<@BOT_ID> <prompt>`, or `<@!BOT_ID> <prompt>`.

Built-in operator commands (directed to bot):
- `/status` — uptime + model + redacted runtime summary
- `/diag` — quick configuration health report
- `/reload` — re-read `.env` safely (no process restart)

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
