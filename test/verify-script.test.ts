import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const PACKAGE_JSON_PATH = '/home/openclaw/.openclaw/workspace/bot-buddy/package.json';
const CI_WORKFLOW_PATH = '/home/openclaw/.openclaw/workspace/bot-buddy/.github/workflows/ci.yml';

test('verify scripts run canonical local validation sequences', () => {
  const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8')) as {
    scripts?: Record<string, string>;
  };

  assert.equal(
    packageJson.scripts?.['verify:quick'],
    'npm run check && npm run check:docs && npm run test:changelog-policy',
    'verify:quick should run check + docs link check + changelog-policy fixtures',
  );

  assert.equal(
    packageJson.scripts?.verify,
    'npm run check && npm run check:docs && npm test',
    'verify should run check + docs link check + full tests',
  );
});

test('ci workflow runs both quick and full verify commands', () => {
  const workflow = readFileSync(CI_WORKFLOW_PATH, 'utf8');

  assert.match(workflow, /run:\s*npm run verify:quick/);
  assert.match(workflow, /run:\s*npm run verify/);
});

test('ci workflow cancels superseded runs on the same ref', () => {
  const workflow = readFileSync(CI_WORKFLOW_PATH, 'utf8');

  assert.match(workflow, /concurrency:\s*[\s\S]*cancel-in-progress:\s*true/);
  assert.match(workflow, /group:\s*\$\{\{\s*github\.workflow\s*\}\}-\$\{\{\s*github\.ref\s*\}\}/);
});
