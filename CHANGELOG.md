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
  - Added `/id` operator command for a single-line runtime identity snapshot (`version`, `model`, `backend`, `node`).
  - README now documents that help command ordering is intentional (quick triage commands first, guard-gated commands last).
  - `/version` now supports explicit version injection via `BOT_BUDDY_VERSION` (fallback chain: `BOT_BUDDY_VERSION` -> `npm_package_version` -> `unknown`).
  - Discord startup now logs resolved app version `value` + `source` for faster deployment verification and incident triage.
  - README now includes systemd/docker `BOT_BUDDY_VERSION` examples for deterministic `/version` and startup version logs across deploy targets.
  - `/help` and `/commands` now reject extra args with an explicit usage hint instead of silently falling through.
  - Unrecognized slash commands now return `unknown command: /<name> (use /help)` instead of falling through to LLM handling.
  - Unknown command hints now include typo suggestions for near-miss operator commands (e.g. `/hepl` suggests `/help`).
  - `/audit-tail` no longer captures similarly-prefixed unknown commands (e.g. `/audit-tailing` now returns the standard unknown-command hint).
  - Tightened unknown-command suggestion relevance: very short unknown commands no longer get noisy suggestions, and `/?` is no longer suggested for non-`/?` inputs.
  - Unknown command fallback hint now references all supported help aliases (`/?`, `/help`, `/commands`) for faster operator recovery.
  - Unknown command suggestion logic now supports close typos of short aliases (e.g. `/upp` suggests `/up`) while still suppressing noisy unrelated short-command suggestions.
  - Unknown command suggestion matching now uses transposition-aware distance with tighter relevance gates to suppress noisy hints for unrelated commands (e.g. `/beep`, `/hello`, `/mod`).
  - Unknown command typo suggestions now respect guard state: disabled guard-gated commands (`/metrics-reset`, `/audit-tail`) are excluded from suggestions until enabled.
  - `/audit-tail` command detection now accepts any whitespace separator (spaces, tabs, newlines), preserving parser behavior for non-space whitespace variants.

### Fixed
- `/ping` and `/status` now report the active backend label correctly in Discord operator mode (`openclaw:<agent>` when `LLM_BACKEND=openclaw`, OpenAI model name when `LLM_BACKEND=openai`).
- `/diag` now reports the active backend mode explicitly (`llmBackend=openclaw|openai`) to reduce operator confusion during mixed environment debugging.
- Help aliases with non-space argument separators (tab/newline), e.g. `/help\tnow` or `/?\nnow`, now correctly return `help: invalid usage ...` instead of falling into unknown-command handling.
- Unknown-command fallback no longer emits self-suggestions when a known command is invoked with extra args (e.g. `/ping now` no longer says `did you mean /ping?`).
- Known no-arg operator commands with extra args now return explicit invalid-usage guidance (e.g. `/ping now` -> `ping: invalid usage (use /ping)`) instead of generic unknown-command fallback.
- README operator command docs now explicitly document no-arg invalid-usage behavior (and include test coverage to prevent doc drift).
- `/audit-tail` now prioritizes guard denial when disabled (even with malformed args/limits), returning `audit-tail: disabled ...` consistently until enabled.
- `/metrics-reset` now mirrors guard-first behavior for arg-suffixed invocations when disabled (`/metrics-reset now` -> disabled response); when enabled, extra args still return invalid usage.
- Operator audit mapping now records `metrics-reset: invalid usage ...` as a denied metrics-reset audit event for clearer denied-attempt visibility.
- README operator command docs now explicitly document guard-first behavior for disabled `/metrics-reset` and `/audit-tail` malformed/suffixed invocations.

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
- Expanded unknown-command typo-suggestion regression coverage to include `/runtime` near-miss handling (`/runtmie` -> `/runtime`).
- Added a negative regression case to ensure distant run-prefixed commands (e.g. `/runner`) do not trigger noisy `/runtime` suggestions.
- Added short-token regression coverage confirming `/di` does not suggest `/id` under the short-command noise guard.
- Added regression coverage to ensure `/audit-tail` only matches exact command/arg forms and does not swallow similarly-prefixed unknown commands.
- Consolidated noisy unknown-command suggestion regressions into a table-driven test (`/beacon`, `/runner`, `/beep`, `/hello`, `/mod`) to keep relevance-guard coverage compact.
- Added regression coverage for guard-aware typo suggestions (disabled guards suppress `/metrics-reset`/`/audit-tail` suggestions; enabled guards allow them).
- Added regression coverage to ensure `/audit-tail` command routing accepts tab/newline-separated limits (not just spaces).
- Added regression coverage ensuring `/audit-tail` with trailing tab is routed as audit-tail (disabled response) instead of unknown-command fallback.
- Hoisted `/audit-tail` command-detection regex into a shared constant to avoid per-command regex allocation and reduce routing drift risk.
- Expanded typo-suggestion regression coverage for transposition edits across key operator commands (`/reload`, `/commands`, `/health`).
- Added `hasCommandArgs()` helper + regression coverage so help alias invalid-usage detection consistently handles whitespace separators (`space`, `tab`, `newline`).
- Added regression coverage ensuring unknown-command fallback suppresses identical-command suggestions for arg-suffixed known commands.
- Added regression coverage for explicit invalid-usage responses on known no-arg commands with extra args (`/ping`, `/status`, `/reload`, `/metrics-reset`).
- Expanded no-arg invalid-usage regression coverage to include tab/newline-separated args (e.g. `/ping\tnow`, `/status\nnow`).
- Expanded no-arg invalid-usage regression coverage across all primary no-arg operator commands and aliases (`/up`, `/uptime`, `/version`, `/id`, `/model`, `/backend`, `/runtime`, `/diag`, `/health`, etc.) to prevent alias drift.
- Added mixed-case no-arg invalid-usage regressions (`/PING now`, `/Status now`, `/Reload now`, `/Metrics-Reset now`) to pin case-normalized operator handling.
- Split `/audit-tail` invalid-input coverage by guard state: disabled guard now returns consistent disabled response; enabled guard continues to enforce invalid-usage/invalid-limit parsing.
- Added guard-state regression coverage for `/metrics-reset` arg-suffixed invocation (`disabled` vs `invalid usage` when enabled).
- Added regression coverage for metrics-reset invalid-usage audit mapping (`operator metrics reset denied (invalid usage)`).
- Simplified help-arg detection to avoid per-call regex allocation and added regression coverage ensuring help-prefixed tokens (e.g. `/helping`) stay in unknown-command handling.
- Expanded help-alias prefix regression coverage to include `/commandsx` and `/?x`, ensuring all help aliases avoid false invalid-usage classification.
- Unknown-command suggestions no longer propose the `/?` alias, avoiding noisy outputs like `did you mean /??` for inputs such as `/?x`.
- Added a table-driven suggestion-policy regression test across help aliases, short-alias noise guards, and guard-gated commands (enabled vs disabled) to prevent typo-suggestion drift.
- Expanded `/metrics-reset` guard-state regressions to cover tab/newline argument separators, ensuring disabled-vs-invalid-usage behavior remains consistent across whitespace variants.
- Expanded enabled-guard `/audit-tail` invalid-input regressions to cover tab/newline separator variants for both extra-arg and invalid-limit paths.
- Expanded guard-gated typo-suggestion regressions to include mixed-case unknown inputs, pinning case-normalized suggestion behavior for `/metrics-reset` and `/audit-tail` across enabled/disabled guard states.
- Hoisted guard-denied operator response literals (`metrics-reset`, `audit-tail`) into shared constants to reduce duplicated string drift across command branches.
- Hoisted `/audit-tail` invalid-usage/invalid-limit response text into shared constants with a single usage hint source, reducing hardcoded range-string drift risk.
- Added evaluator-level mixed-case `/audit-tail` routing regressions (enabled + disabled guard states) to pin parser/router case-normalization behavior.
- Added evaluator-level mixed-case `/metrics-reset` guard-gated routing regressions (enabled + disabled states) to pin command normalization behavior.
- De-duplicated operator test metrics-summary fixture text behind a shared constant to reduce assertion drift and maintenance noise.
- Expanded enabled-guard `/metrics-reset` invalid-usage regressions to include mixed-case command token variants (e.g. `/Metrics-Reset now`).
- Expanded enabled-guard `/audit-tail` invalid-input regressions to include mixed-case command token variants (`/Audit-Tail 3 extra`, `/Audit-Tail 21`).
- Hoisted baseline help command ordering into a shared constant used by `helpCommandSummary()`, reducing duplicated list literals and ordering drift risk.
- Centralized guard-enable env toggle literals (`ALLOW_METRICS_RESET=true`, `ALLOW_AUDIT_TAIL=true`) into shared constants reused by help enable hints and guard-denied command responses.
- Expanded invalid help-usage regressions to include mixed-case help aliases (`/Help now`, `/Commands now`) to pin case-normalized handling.
- Derived `NO_ARG_OPERATOR_COMMANDS` from the shared baseline help command list (plus guarded `/metrics-reset`) to reduce no-arg policy drift when help-list commands evolve.
- Added shared `HELP_ALIASES`/`HELP_ALIAS_SET` constants and refactored help alias checks (exact-match + arg-suffixed invalid usage + usage hint rendering) to one source of truth.
- Added `formatCommandListWithOr()` helper for stable human-readable command-list formatting and covered 0/1/2/N list behavior with table-driven tests.
- Expanded README docs regression coverage to pin operator help-invalid-usage and unknown-command hint wording (`use /?, /help, or /commands`) against runtime behavior.
- Clarified README guard-first docs with exact disabled response strings for `/metrics-reset` and `/audit-tail`, and pinned those strings in README regression tests.
- Expanded `formatCommandListWithOr()` regression coverage with a 4-item command list case to pin Oxford-comma formatting for longer operator hint lists.
- Added regression coverage ensuring `formatCommandListWithOr()` is non-mutating (input arrays remain unchanged after formatting).
- Consolidated `/help` guard-toggle statelessness checks into a single table-driven regression covering both disabled→enabled and enabled→disabled transitions.
- Centralized the remaining mixed guard-state help fixture (`metrics enabled + audit disabled`) into a named test constant to complete help-summary expected-string de-duplication.
- Added a small `commandsLine()` test helper and switched help-summary fixtures to use it, reducing repeated `commands: ...` wrapper literals.
- Centralized help-summary enable-hint suffix fixtures (`ALLOW_METRICS_RESET`/`ALLOW_AUDIT_TAIL`) into shared test constants to reduce repeated hint-literal drift.
- Centralized help-summary guarded command tokens (`/metrics-reset` and `/audit-tail [1-20]`, enabled/disabled forms) into shared test constants to reduce repeated literal drift.
- Added shared unknown-command test helpers (`unknownCommandLine`, `unknownCommandWithSuggestion`) and switched operator typo/unknown assertions to use them, reducing repeated hint-literal boilerplate.
- Centralized help invalid-usage expected text in tests (`HELP_INVALID_USAGE_LINE`) and reused it across help-invalid/false-positive assertions to reduce wording drift.
- Centralized `/audit-tail` invalid-usage and invalid-limit expected strings in operator tests to reduce repeated error-text literals.
- Centralized `/metrics-reset` disabled and invalid-usage expected strings in operator tests to reduce repeated guard/error response literals.
- Centralized `/audit-tail` disabled expected strings in operator tests to remove remaining repeated guard-denied response literals.
- Centralized `/metrics-reset` success expected string (`metrics-reset: ok | ...`) in operator tests to complete metrics-reset response fixture normalization.
- Centralized common `/audit-tail` success response fixtures (`audit-tail: tail`, `audit-tail: short tail`, sample entry payload) to reduce repeated literals in operator tests.
- Added `noArgInvalidUsageLine()` helper for operator tests and switched no-arg invalid-usage cases to use it, reducing repeated `"<cmd>: invalid usage (use /<cmd>)"` literals.
- Added `auditTailLine()` helper in operator tests and switched audit-tail success assertions to use it (`tail`, `short tail`, sample entry payload), reducing repeated response-wrapper literals.
- Added a small regression test covering shared operator line-format helpers (`commandsLine`, unknown-command helpers, `noArgInvalidUsageLine`, `auditTailLine`) to pin canonical response-prefix formatting.
- Added direct regression coverage for reload assertion helpers (`assertReloadApplied`, `assertReloadRateLimited`, `assertReloadIssuesRemain`), including near-miss rejection checks.
- Added direct canonical/near-miss regression coverage for health/diag assertion helpers (`assertHealth*`, `assertDiag*`) to pin helper-level formatting contracts.
- Fixed diag assertion helper regex matchers to escape literal `|` separators correctly, so near-miss failure tests now validate real delimiter matching instead of permissive alternation behavior.
- `/diag` issues payload now includes `hasDiscord` and `hasOpenAI` fields (matching the `diag: ok` shape) for consistent diagnostics across healthy/degraded runtime states.
- Added diag core-field ordering regression checks for both helper-level fixtures and live `/diag` outputs, pinning consistent field order across `diag: ok` and `diag: issues detected` paths.
- Refactored `/diag` response assembly through a shared `diagCoreFields()` helper to keep ok/issues field composition centralized and reduce formatting drift risk.
- Added a `/diag` field glossary to README (capabilities, backend mode, guards, policy limits, reply cap, backend error) and pinned it via docs regression tests.
- Added a `/health` sample + field glossary to README (runtime, issue count, capability flags, backend summary, metrics payload) and pinned it via docs regression tests.
- Added a concise `/health` vs `/diag` “when to use which” note to README and pinned it in docs regression tests for operator guidance consistency.
- Added a quick operator output-style map in README (`machine-grep-friendly` vs `human-triage-oriented` commands) and pinned it in docs regression tests.
- Clarified README operator behavior that unknown slash commands are deterministic and never fall through to LLM chat generation; pinned via docs regression coverage.
- Added an explicit operator command contract section to README (case-insensitive slash commands + normalized whitespace argument parsing) and pinned it via docs regression tests.
- Added README typo-suggestion boundary notes (what is suggested vs intentionally suppressed, including guard-gated behavior) and pinned them via docs regression tests.
- Clarified README that `/?` is still a direct help alias but intentionally excluded from typo suggestion targets; pinned via docs regression coverage.
- Added a concise guard-first summary line in README for guard-gated commands and pinned it in docs regression tests.
- Clarified `/reload` safe hot-refresh contract in README (in-process apply, no restart, cooldown-limited) and pinned it in docs regression tests.
- README operator docs now explicitly document `/diag` availability signals and include a degraded `diag: issues detected` sample with `hasDiscord`/`hasOpenAI` fields.
- Added a dedicated help-order regression test to pin canonical operator command discovery ordering and prevent accidental list drift.
- Expanded help-order regression coverage to assert the same canonical ordering when guard-gated commands are enabled.
- Expanded README docs regression coverage to pin the intentional help-ordering guidance line.
