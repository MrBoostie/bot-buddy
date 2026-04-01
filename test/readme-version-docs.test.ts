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
  ];

  for (const pattern of patterns) {
    assert.match(readme, pattern);
  }
});
