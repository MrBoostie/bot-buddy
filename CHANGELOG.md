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

### Fixed
- `/ping` and `/status` now report the active backend label correctly in Discord operator mode (`openclaw:<agent>` when `LLM_BACKEND=openclaw`, OpenAI model name when `LLM_BACKEND=openai`).
- `/diag` now reports the active backend mode explicitly (`llmBackend=openclaw|openai`) to reduce operator confusion during mixed environment debugging.

### Internal
- Refactored Discord operator command dependency wiring into `buildOperatorCommandDeps()` to reduce drift risk between backend mode and model label wiring.
- Added dedicated dependency-composition tests to verify openclaw/openai backend+model label consistency in Discord operator command wiring.
- Added shared numeric parsing helper `parseUnsignedIntInRange` for consistent strict numeric command argument validation.
- Expanded parser test coverage for edge cases (whitespace variants, leading zeros, non-ASCII digits, large values, bounds).
- Added CI changelog policy enforcement for behavior-visible PR changes, with documented local runner script and maintainers-only `skip-changelog` label bypass.
