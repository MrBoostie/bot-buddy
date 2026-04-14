import test from 'node:test';
import assert from 'node:assert/strict';
import { runLocalCli } from '../src/local-cli-runner.ts';

test('prints greeting and exits cleanly on exit command', async () => {
  const outputs: string[] = [];

  await runLocalCli({
    botName: 'buddy',
    think: async () => 'unused',
    io: {
      prompt: async () => 'exit',
      print: (line) => outputs.push(line),
      printError: () => {},
    },
  });

  assert.deepEqual(outputs, ['[buddy] local console online. type "exit" to quit.', '[buddy] bye.']);
});

test('ignores blank lines and prints think result', async () => {
  const outputs: string[] = [];
  const prompts = ['   ', 'hello', 'exit'];

  await runLocalCli({
    botName: 'buddy',
    think: async (input) => `echo:${input}`,
    io: {
      prompt: async () => {
        const next = prompts.shift();
        assert.ok(next !== undefined);
        return next;
      },
      print: (line) => outputs.push(line),
      printError: () => {},
    },
  });

  assert.deepEqual(outputs, [
    '[buddy] local console online. type "exit" to quit.',
    'buddy> echo:hello',
    '[buddy] bye.',
  ]);
});

test('handles thinker errors without exiting loop', async () => {
  const outputs: string[] = [];
  const errors: Array<{ line: string; error: unknown }> = [];
  const prompts = ['boom', 'exit'];

  await runLocalCli({
    botName: 'buddy',
    think: async () => {
      throw new Error('oops');
    },
    io: {
      prompt: async () => {
        const next = prompts.shift();
        assert.ok(next !== undefined);
        return next;
      },
      print: (line) => outputs.push(line),
      printError: (line, error) => errors.push({ line, error }),
    },
  });

  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.line, 'buddy> error:');
  assert.match(String((errors[0]?.error as Error).message), /oops/);
  assert.deepEqual(outputs, ['[buddy] local console online. type "exit" to quit.', '[buddy] bye.']);
});

test('exits cleanly when readline is already closed (EOF/ctrl+c)', async () => {
  const outputs: string[] = [];

  await runLocalCli({
    botName: 'buddy',
    think: async () => 'unused',
    io: {
      prompt: async () => {
        const err = new Error('readline was closed') as Error & { code?: string };
        err.code = 'ERR_USE_AFTER_CLOSE';
        throw err;
      },
      print: (line) => outputs.push(line),
      printError: () => {},
    },
  });

  assert.deepEqual(outputs, ['[buddy] local console online. type "exit" to quit.', '[buddy] console closed.']);
});
