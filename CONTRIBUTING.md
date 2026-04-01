# Contributing

Thanks for contributing to bot-buddy.

## Before opening a PR

1. Run type checks:

```bash
npm run check
```

2. Run full tests:

```bash
npm test
```

3. For changelog policy coverage only (fast loop):

```bash
npm run test:changelog-policy
```

4. Validate docs link consistency:

```bash
npm run check:docs
```

## PR checklist

- [ ] `npm run check` passes
- [ ] `npm test` passes
- [ ] `CHANGELOG.md` updated for behavior-visible changes (or maintainer applied `skip-changelog` label intentionally)
- [ ] `README.md` / operator docs updated if command/runtime behavior changed
- [ ] New/changed policy logic covered by `test/changelog-policy-script.test.ts` where applicable

## Changelog policy

Behavior-visible changes require a `CHANGELOG.md` update (unless maintainers apply the exceptional `skip-changelog` PR label).

### `skip-changelog` label ownership

- `skip-changelog` is maintainers-only and should be treated as an exception path, not normal flow.
- Use only when changes are clearly non-user-visible (for example: internal CI-only refactors or metadata cleanup).
- If there is any ambiguity about user-visible impact, prefer updating `CHANGELOG.md` instead of applying the label.

Behavior-visible paths include:

- `src/`
- `scripts/`
- `package.json`
- `README.md` changes that alter operator/runtime behavior docs

Run the same policy check locally against two SHAs:

```bash
scripts/check-changelog-policy.sh <base-sha> <head-sha>
```

Example:

```bash
scripts/check-changelog-policy.sh HEAD~1 HEAD
```

## Key files map

- `src/index.ts` — process entrypoint and runtime startup wiring.
- `src/discord.ts` — Discord adapter, message routing, and operator command execution path.
- `src/operator-commands.ts` — operator command parsing/handling (`/diag`, `/health`, `/audit-tail`, etc.).
- `src/operator-audit.ts` + `src/operator-audit-store.ts` — audit event classification and in-memory audit tail storage.
- `scripts/check-changelog-policy.sh` — CI/local changelog policy enforcement script.
- `test/changelog-policy-script.test.ts` — fixture-based policy behavior tests (fail/pass matrix).
- `.github/workflows/ci.yml` — CI checks/order (`check`, policy fixtures, full test suite).

## Policy troubleshooting

If changelog policy CI fails, check these first:

- You changed a behavior-visible path (`src/`, `scripts/`, `package.json`, or behavior-impacting `README.md`) but did not update `CHANGELOG.md`.
- You updated `CHANGELOG.md`, but the file wasn’t included in the commit/PR diff.
- You expected non-visible-only changes, but a touched file still matches policy scope.

Quick local verification:

```bash
npm run test:changelog-policy
scripts/check-changelog-policy.sh <base-sha> <head-sha>
```

## Release hygiene

- Keep `README.md` operator/runtime docs in sync with behavior changes.
- Record user-visible updates in `CHANGELOG.md` (`Unreleased`).
