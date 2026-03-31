import test from 'node:test';
import assert from 'node:assert/strict';
import { executeDiscordRouting } from '../src/discord-executor.ts';
import { getMetricsSummary, resetMetricsForTests } from '../src/metrics.ts';

test('ignore route performs no actions', async () => {
  let typingCalls = 0;
  let thinkCalls = 0;
  const replies: string[] = [];
  let logCalls = 0;

  await executeDiscordRouting(
    { kind: 'ignore' },
    {
      sendTyping: async () => {
        typingCalls += 1;
      },
      think: async () => {
        thinkCalls += 1;
        return 'x';
      },
      reply: async (text) => {
        replies.push(text);
      },
      logError: () => {
        logCalls += 1;
      },
    },
  );

  assert.equal(typingCalls, 0);
  assert.equal(thinkCalls, 0);
  assert.deepEqual(replies, []);
  assert.equal(logCalls, 0);
});

test('command route replies without typing/think', async () => {
  let typingCalls = 0;
  let thinkCalls = 0;
  const replies: string[] = [];

  await executeDiscordRouting(
    { kind: 'command', text: 'pong' },
    {
      sendTyping: async () => {
        typingCalls += 1;
      },
      think: async () => {
        thinkCalls += 1;
        return 'x';
      },
      reply: async (text) => {
        replies.push(text);
      },
      logError: () => {},
    },
  );

  assert.equal(typingCalls, 0);
  assert.equal(thinkCalls, 0);
  assert.deepEqual(replies, ['pong']);
});

test('llm route types, thinks, and replies', async () => {
  resetMetricsForTests();
  const callOrder: string[] = [];
  const replies: string[] = [];

  await executeDiscordRouting(
    { kind: 'llm', prompt: 'hello' },
    {
      sendTyping: async () => {
        callOrder.push('typing');
      },
      think: async (prompt) => {
        callOrder.push(`think:${prompt}`);
        return 'world';
      },
      reply: async (text) => {
        callOrder.push('reply');
        replies.push(text);
      },
      logError: () => {},
    },
  );

  assert.deepEqual(callOrder, ['typing', 'think:hello', 'reply']);
  assert.deepEqual(replies, ['world']);
  assert.equal(getMetricsSummary(), 'commands=0,llmOk=1,llmErr=0');
});

test('llm route truncates long replies to 1900 chars', async () => {
  const replies: string[] = [];

  await executeDiscordRouting(
    { kind: 'llm', prompt: 'long' },
    {
      sendTyping: async () => {},
      think: async () => 'x'.repeat(2500),
      reply: async (text) => {
        replies.push(text);
      },
      logError: () => {},
    },
  );

  assert.equal(replies.length, 1);
  assert.equal(replies[0].length, 1900);
});

test('llm failure returns safe fallback and logs error', async () => {
  resetMetricsForTests();
  const replies: string[] = [];
  const logs: Array<{ message: string; error: unknown }> = [];

  await executeDiscordRouting(
    { kind: 'llm', prompt: 'explode' },
    {
      sendTyping: async () => {},
      think: async () => {
        throw new Error('boom');
      },
      reply: async (text) => {
        replies.push(text);
      },
      logError: (message, error) => {
        logs.push({ message, error });
      },
    },
  );

  assert.deepEqual(replies, ['brain fart. try again in a sec.']);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].message, '[discord] reply error');
  assert.equal(getMetricsSummary(), 'commands=0,llmOk=0,llmErr=1');
});
