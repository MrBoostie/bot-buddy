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

## Changelog policy

Behavior-visible changes require a `CHANGELOG.md` update (unless maintainers apply the exceptional `skip-changelog` PR label).

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

## Release hygiene

- Keep `README.md` operator/runtime docs in sync with behavior changes.
- Record user-visible updates in `CHANGELOG.md` (`Unreleased`).
