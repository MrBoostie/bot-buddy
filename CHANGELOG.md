# Changelog

## Unreleased

### Added
- Operator command hardening + observability improvements:
  - `/audit-tail <1-20>` support with strict argument validation.
  - Safe `/audit-tail` response truncation to Discord-safe length.
  - `/diag` now includes operator guard/policy fields (`allowMetricsReset`, `allowAuditTail`, `auditTailDefault`, `auditTailMax`, `operatorReplyMaxChars`).
  - In-memory operator audit events now include request correlation (`rid`) and classify invalid `/audit-tail` attempts.

### Internal
- Added shared numeric parsing helper `parseUnsignedIntInRange` for consistent strict numeric command argument validation.
- Expanded parser test coverage for edge cases (whitespace variants, leading zeros, non-ASCII digits, large values, bounds).
