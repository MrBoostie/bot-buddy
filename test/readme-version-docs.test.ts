import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const README_PATH = new URL('../README.md', import.meta.url);

test('README documents BOT_BUDDY_VERSION for systemd EnvironmentFile', () => {
  const readme = readFileSync(README_PATH, 'utf8');
  assert.match(readme, /\*\*systemd\*\* \(`EnvironmentFile`\):/);
  assert.match(readme, /BOT_BUDDY_VERSION=2026\.04\.01/);
});

test('README documents BOT_BUDDY_VERSION for docker run env flag', () => {
  const readme = readFileSync(README_PATH, 'utf8');
  assert.match(readme, /\*\*docker\*\* \(`docker run`\):/);
  assert.match(readme, /docker run --env BOT_BUDDY_VERSION=2026\.04\.01 \.\.\./);
});

test('README documents /version fallback chain for deterministic expectations', () => {
  const readme = readFileSync(README_PATH, 'utf8');
  assert.match(
    readme,
    /`version` resolves from `BOT_BUDDY_VERSION`, then `npm_package_version`, else `unknown`/,
  );
});

test('README documents startup app version log metadata contract', () => {
  const readme = readFileSync(README_PATH, 'utf8');
  assert.match(
    readme,
    /On Discord startup, the bot now logs resolved app version metadata \(`value` \+ `source`\)/,
  );
});
