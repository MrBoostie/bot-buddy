import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const PACKAGE_JSON_PATH = '/home/openclaw/.openclaw/workspace/bot-buddy/package.json';
const CI_WORKFLOW_PATH = '/home/openclaw/.openclaw/workspace/bot-buddy/.github/workflows/ci.yml';

test('verify script runs canonical local validation sequence', () => {
  const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8')) as {
    scripts?: Record<string, string>;
  };

  assert.equal(
    packageJson.scripts?.verify,
    'npm run check && npm run check:docs && npm test',
    'verify script should run check + docs link check + full tests',
  );
});

test('ci workflow uses npm run verify', () => {
  const workflow = readFileSync(CI_WORKFLOW_PATH, 'utf8');

  assert.match(workflow, /run:\s*npm run verify/);
});
