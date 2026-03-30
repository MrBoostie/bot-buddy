import test from 'node:test';
import assert from 'node:assert/strict';
import { extractDirectedPrompt } from '../src/directive.ts';

test('extracts prompt from classic mention', () => {
  const prompt = extractDirectedPrompt('<@12345>  hey there  ', '12345');
  assert.equal(prompt, 'hey there');
});

test('extracts prompt from nickname mention', () => {
  const prompt = extractDirectedPrompt('<@!12345> status', '12345');
  assert.equal(prompt, 'status');
});

test('extracts prompt from buddy prefix', () => {
  const prompt = extractDirectedPrompt('buddy   ping', '12345');
  assert.equal(prompt, 'ping');
});

test('returns null for undirected text', () => {
  const prompt = extractDirectedPrompt('hello everyone', '12345');
  assert.equal(prompt, null);
});

test('returns null when directed with no payload', () => {
  assert.equal(extractDirectedPrompt('<@12345>   ', '12345'), null);
  assert.equal(extractDirectedPrompt('buddy   ', '12345'), null);
});
