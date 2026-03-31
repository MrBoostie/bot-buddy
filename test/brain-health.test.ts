import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearBackendError,
  getBackendHealthSummary,
  recordBackendError,
  resetBackendHealthForTests,
} from '../src/brain-health.ts';

test('backend health defaults to none', () => {
  resetBackendHealthForTests();
  assert.equal(getBackendHealthSummary(), 'none');
});

test('records backend error with timestamp', () => {
  resetBackendHealthForTests();
  recordBackendError('openclaw timeout', Date.parse('2026-03-31T00:00:00.000Z'));
  assert.equal(getBackendHealthSummary(), 'openclaw timeout @ 2026-03-31T00:00:00.000Z');
});

test('clearBackendError resets state', () => {
  resetBackendHealthForTests();
  recordBackendError('oops');
  clearBackendError();
  assert.equal(getBackendHealthSummary(), 'none');
});
