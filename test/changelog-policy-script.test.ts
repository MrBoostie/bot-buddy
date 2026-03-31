import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

const SCRIPT_PATH = '/home/openclaw/.openclaw/workspace/bot-buddy/scripts/check-changelog-policy.sh';

function sh(cwd: string, command: string): string {
  return execSync(command, { cwd, encoding: 'utf8' }).trim();
}

function setupRepo(): { dir: string; baseSha: string } {
  const dir = mkdtempSync(join(tmpdir(), 'bot-buddy-changelog-policy-'));
  sh(dir, 'git init');
  sh(dir, 'git config user.name "Test Bot"');
  sh(dir, 'git config user.email "test@example.com"');

  writeFileSync(join(dir, 'README.md'), '# test\n');
  writeFileSync(join(dir, 'CHANGELOG.md'), '# changelog\n');
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'src', 'main.ts'), 'export const x = 1;\n');

  sh(dir, 'git add .');
  sh(dir, 'git commit -m "base"');
  return { dir, baseSha: sh(dir, 'git rev-parse HEAD') };
}

function runPolicy(cwd: string, baseSha: string, headSha: string): { code: number; stderr: string } {
  const result = spawnSync('bash', [SCRIPT_PATH, baseSha, headSha], {
    cwd,
    encoding: 'utf8',
  });
  return { code: result.status ?? 1, stderr: result.stderr ?? '' };
}

test('fails when behavior-visible files change without changelog update', () => {
  const { dir, baseSha } = setupRepo();
  writeFileSync(join(dir, 'src', 'main.ts'), 'export const x = 2;\n');
  sh(dir, 'git add src/main.ts');
  sh(dir, 'git commit -m "change src"');
  const headSha = sh(dir, 'git rev-parse HEAD');

  const result = runPolicy(dir, baseSha, headSha);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /CHANGELOG\.md must be updated/i);
});

test('passes when behavior-visible files change with changelog update', () => {
  const { dir, baseSha } = setupRepo();
  writeFileSync(join(dir, 'src', 'main.ts'), 'export const x = 2;\n');
  writeFileSync(join(dir, 'CHANGELOG.md'), '# changelog\n- updated\n');
  sh(dir, 'git add src/main.ts CHANGELOG.md');
  sh(dir, 'git commit -m "change src + changelog"');
  const headSha = sh(dir, 'git rev-parse HEAD');

  const result = runPolicy(dir, baseSha, headSha);
  assert.equal(result.code, 0);
});

test('passes when non-behavior-visible files change without changelog update', () => {
  const { dir, baseSha } = setupRepo();
  writeFileSync(join(dir, 'notes.txt'), 'internal notes\n');
  sh(dir, 'git add notes.txt');
  sh(dir, 'git commit -m "notes only"');
  const headSha = sh(dir, 'git rev-parse HEAD');

  const result = runPolicy(dir, baseSha, headSha);
  assert.equal(result.code, 0);
});
