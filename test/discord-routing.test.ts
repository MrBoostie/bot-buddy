import test from 'node:test';
import assert from 'node:assert/strict';
import { routeDiscordInput } from '../src/discord-routing.ts';

test('ignores messages from bots', () => {
  const result = routeDiscordInput(
    { authorIsBot: true, channelId: 'c1', content: 'buddy hi' },
    {
      botUserId: '123',
      evaluateCommand: () => null,
    },
  );

  assert.deepEqual(result, { kind: 'ignore' });
});

test('ignores messages outside channel lock', () => {
  const result = routeDiscordInput(
    { authorIsBot: false, channelId: 'c2', content: 'buddy hi' },
    {
      botUserId: '123',
      channelLockId: 'c1',
      evaluateCommand: () => null,
    },
  );

  assert.deepEqual(result, { kind: 'ignore' });
});

test('ignores undirected messages', () => {
  const result = routeDiscordInput(
    { authorIsBot: false, channelId: 'c1', content: 'hello everyone' },
    {
      botUserId: '123',
      evaluateCommand: () => null,
    },
  );

  assert.deepEqual(result, { kind: 'ignore' });
});

test('returns command route when command is detected', () => {
  let seenPrompt = '';

  const result = routeDiscordInput(
    { authorIsBot: false, channelId: 'c1', content: 'buddy /ping' },
    {
      botUserId: '123',
      evaluateCommand: (prompt) => {
        seenPrompt = prompt;
        return 'pong';
      },
    },
  );

  assert.equal(seenPrompt, '/ping');
  assert.deepEqual(result, { kind: 'command', text: 'pong' });
});

test('routes directed non-command messages to llm path', () => {
  let seenPrompt = '';

  const result = routeDiscordInput(
    { authorIsBot: false, channelId: 'c1', content: '<@123> tell me a joke' },
    {
      botUserId: '123',
      evaluateCommand: (prompt) => {
        seenPrompt = prompt;
        return null;
      },
    },
  );

  assert.equal(seenPrompt, 'tell me a joke');
  assert.deepEqual(result, {
    kind: 'llm',
    prompt: 'tell me a joke',
  });
});
