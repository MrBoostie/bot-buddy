import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT_SOURCE = '/home/openclaw/.openclaw/workspace/bot-buddy/scripts/check-doc-links.sh';

function setupDocsFixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'bot-buddy-doc-links-'));
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  copyFileSync(SCRIPT_SOURCE, join(dir, 'scripts', 'check-doc-links.sh'));

  // required docs scanned by the script
  if (!files['README.md']) files['README.md'] = '# Readme\n';
  if (!files['CONTRIBUTING.md']) files['CONTRIBUTING.md'] = '# Contributing\n';
  if (!files['CHANGELOG.md']) files['CHANGELOG.md'] = '# Changelog\n';

  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(dir, path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content);
  }

  return dir;
}

function runDocCheck(cwd: string): { code: number; stdout: string; stderr: string } {
  const result = spawnSync('bash', ['scripts/check-doc-links.sh'], { cwd, encoding: 'utf8' });
  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

test('passes with valid local links', () => {
  const dir = setupDocsFixture({
    'README.md': '[Contrib](./CONTRIBUTING.md)\n[Guide](./docs/guide.md)\n',
    'docs/guide.md': '# Guide\n',
  });

  const result = runDocCheck(dir);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Doc link check passed/i);
});

test('fails when local link target is missing', () => {
  const dir = setupDocsFixture({
    'README.md': '[Missing](./docs/missing.md)\n',
  });

  const result = runDocCheck(dir);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /references missing link target/i);
  assert.match(result.stdout, /::error::Documentation link check failed/i);
});

test('ignores external and anchor links', () => {
  const dir = setupDocsFixture({
    'README.md': '[Site](https://example.com)\n[Jump](#section)\n',
  });

  const result = runDocCheck(dir);
  assert.equal(result.code, 0);
});

test('fails when anchored relative target file is missing', () => {
  const dir = setupDocsFixture({
    'README.md': '[Missing anchored](./docs/missing.md#intro)\n',
  });

  const result = runDocCheck(dir);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /references missing link target: \.\/docs\/missing\.md#intro/i);
});
