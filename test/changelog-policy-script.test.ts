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
  sh(dir, 'git init -b main');
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

function runPolicy(
  cwd: string,
  baseSha: string,
  headSha: string,
): { code: number; stderr: string; stdout: string } {
  const result = spawnSync('bash', [SCRIPT_PATH, baseSha, headSha], {
    cwd,
    encoding: 'utf8',
  });
  return {
    code: result.status ?? 1,
    stderr: result.stderr ?? '',
    stdout: result.stdout ?? '',
  };
}

function commitAndRunPolicy(
  dir: string,
  baseSha: string,
  filesToAdd: string,
  message: string,
): { code: number; stderr: string } {
  sh(dir, `git add ${filesToAdd}`);
  sh(dir, `git commit -m "${message}"`);
  const headSha = sh(dir, 'git rev-parse HEAD');
  return runPolicy(dir, baseSha, headSha);
}

function expectPolicyFailure(result: { code: number; stderr: string; stdout: string }): void {
  assert.equal(result.code, 1);
  assert.match(result.stderr, /CHANGELOG\.md must be updated/i);
  assert.match(result.stdout, /::error::CHANGELOG\.md must be updated/i);
}

test('fails when behavior-visible files change without changelog update', () => {
  const { dir, baseSha } = setupRepo();
  writeFileSync(join(dir, 'src', 'main.ts'), 'export const x = 2;\n');
  const result = commitAndRunPolicy(dir, baseSha, 'src/main.ts', 'change src');
  expectPolicyFailure(result);
});

test('passes when behavior-visible files change with changelog update', () => {
  const { dir, baseSha } = setupRepo();
  writeFileSync(join(dir, 'src', 'main.ts'), 'export const x = 2;\n');
  writeFileSync(join(dir, 'CHANGELOG.md'), '# changelog\n- updated\n');
  const result = commitAndRunPolicy(dir, baseSha, 'src/main.ts CHANGELOG.md', 'change src + changelog');
  assert.equal(result.code, 0);
  assert.match(result.stdout, /::notice::Changelog policy satisfied for behavior-visible changes/i);
});

test('passes when non-behavior-visible files change without changelog update', () => {
  const { dir, baseSha } = setupRepo();
  writeFileSync(join(dir, 'notes.txt'), 'internal notes\n');
  const result = commitAndRunPolicy(dir, baseSha, 'notes.txt', 'notes only');
  assert.equal(result.code, 0);
  assert.match(result.stdout, /::notice::No behavior-visible file changes detected/i);
});

test('fails when README behavior-visible docs change without changelog update', () => {
  const { dir, baseSha } = setupRepo();
  writeFileSync(join(dir, 'README.md'), '# test\n\nupdated operator behavior docs\n');
  const result = commitAndRunPolicy(dir, baseSha, 'README.md', 'readme behavior change');
  expectPolicyFailure(result);
});

test('fails when scripts change without changelog update', () => {
  const { dir, baseSha } = setupRepo();
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(join(dir, 'scripts', 'helper.sh'), '#!/usr/bin/env bash\necho hi\n');
  const result = commitAndRunPolicy(dir, baseSha, 'scripts/helper.sh', 'script behavior change');
  expectPolicyFailure(result);
});

test('fails when package.json changes without changelog update', () => {
  const { dir, baseSha } = setupRepo();
  writeFileSync(join(dir, 'package.json'), '{"name":"fixture","version":"1.0.1"}\n');
  const result = commitAndRunPolicy(dir, baseSha, 'package.json', 'package behavior change');
  expectPolicyFailure(result);
});

test('passes when README behavior-visible docs change with changelog update', () => {
  const { dir, baseSha } = setupRepo();
  writeFileSync(join(dir, 'README.md'), '# test\n\nupdated operator behavior docs\n');
  writeFileSync(join(dir, 'CHANGELOG.md'), '# changelog\n- readme update\n');
  const result = commitAndRunPolicy(dir, baseSha, 'README.md CHANGELOG.md', 'readme + changelog');
  assert.equal(result.code, 0);
});

test('passes when scripts change with changelog update', () => {
  const { dir, baseSha } = setupRepo();
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(join(dir, 'scripts', 'helper.sh'), '#!/usr/bin/env bash\necho hi\n');
  writeFileSync(join(dir, 'CHANGELOG.md'), '# changelog\n- script update\n');
  const result = commitAndRunPolicy(
    dir,
    baseSha,
    'scripts/helper.sh CHANGELOG.md',
    'script + changelog',
  );
  assert.equal(result.code, 0);
});

test('passes when package.json changes with changelog update', () => {
  const { dir, baseSha } = setupRepo();
  writeFileSync(join(dir, 'package.json'), '{"name":"fixture","version":"1.0.1"}\n');
  writeFileSync(join(dir, 'CHANGELOG.md'), '# changelog\n- package update\n');
  const result = commitAndRunPolicy(
    dir,
    baseSha,
    'package.json CHANGELOG.md',
    'package + changelog',
  );
  assert.equal(result.code, 0);
});

test('fails on mixed behavior-visible and non-visible changes without changelog', () => {
  const { dir, baseSha } = setupRepo();
  writeFileSync(join(dir, 'README.md'), '# test\n\nbehavior change\n');
  writeFileSync(join(dir, 'notes.txt'), 'non-visible change\n');
  const result = commitAndRunPolicy(
    dir,
    baseSha,
    'README.md notes.txt',
    'mixed visible + non-visible without changelog',
  );
  expectPolicyFailure(result);
});

test('passes on mixed behavior-visible and non-visible changes with changelog', () => {
  const { dir, baseSha } = setupRepo();
  writeFileSync(join(dir, 'README.md'), '# test\n\nbehavior change\n');
  writeFileSync(join(dir, 'notes.txt'), 'non-visible change\n');
  writeFileSync(join(dir, 'CHANGELOG.md'), '# changelog\n- mixed update\n');
  const result = commitAndRunPolicy(
    dir,
    baseSha,
    'README.md notes.txt CHANGELOG.md',
    'mixed visible + non-visible with changelog',
  );
  assert.equal(result.code, 0);
});
