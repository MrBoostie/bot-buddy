import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const README_PATH = new URL('../README.md', import.meta.url);

test('README documents versioning and startup-log guidance (table-driven)', () => {
  const readme = readFileSync(README_PATH, 'utf8');
  const patterns = [
    /\*\*systemd\*\* \(`EnvironmentFile`\):/,
    /BOT_BUDDY_VERSION=2026\.04\.01/,
    /\*\*docker\*\* \(`docker run`\):/,
    /docker run --env BOT_BUDDY_VERSION=2026\.04\.01 \.\.\./,
    /`version` resolves from `BOT_BUDDY_VERSION`, then `npm_package_version`, else `unknown`/,
    /On Discord startup, the bot now logs resolved app version metadata \(`value` \+ `source`\)/,
    /Command order is intentional: fast identity\/liveness\/diagnostics first, higher-impact guard-gated commands at the end\./,
    /Known no-arg operator commands now return explicit usage guidance when called with extra args \(e\.g\. `\/ping now` -> `ping: invalid usage \(use \/ping\)`\) instead of generic unknown-command fallback\./,
    /Guard-first behavior: while disabled, arg-suffixed forms \(e\.g\. `\/metrics-reset now`\) return the disabled response; once enabled, extra args return invalid usage\./,
    /Guard-first behavior: while disabled, malformed forms \(e\.g\. `\/audit-tail 21`, `\/audit-tail 3 extra`\) still return the disabled response; validation errors apply when enabled\./,
  ];

  for (const pattern of patterns) {
    assert.match(readme, pattern);
  }
});
