# Changelog

This project follows a simple keep-a-changelog style.

When preparing a release, move `Unreleased` items into a new dated heading (e.g. `## 2026-04-01`) and start a fresh empty `Unreleased` section using the template below.

### Unreleased template

```md
## Unreleased

### Added
- ...

### Changed
- ...

### Fixed
- ...

### Internal
- ...
```

## Unreleased

### Added
- Operator command hardening + observability improvements:
  - `/audit-tail <1-20>` support with strict argument validation.
  - Safe `/audit-tail` response truncation to Discord-safe length.
  - `/diag` now includes operator guard/policy fields (`allowMetricsReset`, `allowAuditTail`, `auditTailDefault`, `auditTailMax`, `operatorReplyMaxChars`).
  - In-memory operator audit events now include request correlation (`rid`) and classify invalid `/audit-tail` attempts.
  - Added `/help` operator command to quickly enumerate supported operator commands in one line.
  - `/help` now reflects guard state by marking `/metrics-reset` and `/audit-tail` as disabled when their guards are off.
  - Added `/commands` as an alias for `/help` to improve command discoverability.
  - `/help`/`/commands` now include targeted `enable:` env-toggle hints when guard-gated commands are disabled.
  - Added `/?` as a compact alias for help/command discovery output.
  - Help output now lists all help aliases (`/?`, `/help`, `/commands`) explicitly to improve discoverability.
  - Added `/uptime` operator command for a compact uptime+model check.
  - Added `/up` alias for `/uptime` for faster operator ergonomics.
  - Added `/version` operator command for quick runtime identity checks (`version`, `node`, `model`).
  - Added `/model` operator command for quick model/backend identity checks.
  - Added `/backend` alias for `/model` to improve operator command ergonomics.
  - Added `/runtime` alias for `/status` to improve operator command ergonomics.
  - `/version` now supports explicit version injection via `BOT_BUDDY_VERSION` (fallback chain: `BOT_BUDDY_VERSION` -> `npm_package_version` -> `unknown`).
  - Discord startup now logs resolved app version `value` + `source` for faster deployment verification and incident triage.
  - README now includes systemd/docker `BOT_BUDDY_VERSION` examples for deterministic `/version` and startup version logs across deploy targets.
  - `/help` and `/commands` now reject extra args with an explicit usage hint instead of silently falling through.
  - Unrecognized slash commands now return `unknown command: /<name> (use /help)` instead of falling through to LLM handling.
  - Unknown command hints now include typo suggestions for near-miss operator commands (e.g. `/hepl` suggests `/help`).
  - Tightened unknown-command suggestion relevance: very short unknown commands no longer get noisy suggestions, and `/?` is no longer suggested for non-`/?` inputs.
  - Unknown command fallback hint now references all supported help aliases (`/?`, `/help`, `/commands`) for faster operator recovery.
  - Unknown command suggestion logic now supports close typos of short aliases (e.g. `/upp` suggests `/up`) while still suppressing noisy unrelated short-command suggestions.

### Fixed
- `/ping` and `/status` now report the active backend label correctly in Discord operator mode (`openclaw:<agent>` when `LLM_BACKEND=openclaw`, OpenAI model name when `LLM_BACKEND=openai`).
- `/diag` now reports the active backend mode explicitly (`llmBackend=openclaw|openai`) to reduce operator confusion during mixed environment debugging.

### Internal
- Refactored Discord operator command dependency wiring into `buildOperatorCommandDeps()` to reduce drift risk between backend mode and model label wiring.
- Added dedicated dependency-composition tests to verify openclaw/openai backend+model label consistency in Discord operator command wiring.
- Added shared numeric parsing helper `parseUnsignedIntInRange` for consistent strict numeric command argument validation.
- Expanded parser test coverage for edge cases (whitespace variants, leading zeros, non-ASCII digits, large values, bounds).
- Added CI changelog policy enforcement for behavior-visible PR changes, with documented local runner script and maintainers-only `skip-changelog` label bypass.
- Refactored operator command literals into a shared `OPERATOR_COMMANDS` constant to reduce drift between help output, command evaluation, and typo-suggestion command matching.
- Refactored `/audit-tail` parser and validation error text to consume shared command constants, reducing future literal-drift risk when command aliases evolve.
- Refactored help invalid-usage text to reuse shared help-usage constants so alias guidance stays synchronized across unknown-command and help-usage responses.
- Added `formatAppVersionLog()` helper + tests to keep startup app-version log output stable and regression-resistant.
- Added README regression tests to keep `BOT_BUDDY_VERSION` systemd/docker deployment examples from drifting.
- Expanded README regression coverage to assert `/version` fallback-chain documentation remains accurate (`BOT_BUDDY_VERSION` -> `npm_package_version` -> `unknown`).
- Expanded README regression coverage to pin startup app-version log metadata docs (`value` + `source`) to the runtime logging contract.
- Expanded runtime log-format tests to explicitly cover `formatAppVersionLog()` behavior for the `unknown` source/value path.
- Added a table-driven `formatAppVersionLog()` test that covers all supported source variants (`BOT_BUDDY_VERSION`, `npm_package_version`, `unknown`).
- Removed redundant single-case `formatAppVersionLog()` tests in favor of the table-driven source-variant coverage to reduce maintenance noise.
- Consolidated README version/startup-log docs assertions into one table-driven test to reduce duplicate test scaffolding while preserving coverage.
- Consolidated unknown-command typo suggestion assertions into a single table-driven operator-command test to reduce repetitive test blocks while keeping behavior coverage unchanged.
- Consolidated `/help`/`/commands`/`/?` default help-output assertions into one table-driven alias test to reduce duplicate expectations while preserving coverage.
- Consolidated invalid help-usage alias assertions into a single looped test block (`/help now`, `/commands now`, `/? now`) to reduce repetitive scaffolding.
- Consolidated `/version` known/unknown appVersion assertions into one table-driven test for consistent operator-test style and less duplication.
- Consolidated `/ping`, `/uptime`, and `/up` baseline liveness assertions into one table-driven test to reduce repetitive command-output checks.
- Consolidated backend-specific `/ping` + `/status` model-label assertions into one table-driven test covering openclaw/openai modes.
- Consolidated `/help` guard-state output assertions into a table-driven test across guard combinations, reducing duplicate setup/expectation blocks.
- Expanded unknown-command typo-suggestion regression coverage to include `/model` near-miss handling (`/modle` -> `/model`).
- Expanded unknown-command typo-suggestion regression coverage to include `/backend` near-miss handling (`/backedn` -> `/backend`).
- Added a negative regression case to ensure distant unknown commands (e.g. `/beacon`) do not trigger noisy `/backend` suggestions.
