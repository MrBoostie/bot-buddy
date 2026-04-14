import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { think } from './brain.js';
import { config } from './config.js';
import { runLocalCli } from './local-cli-runner.js';

async function main(): Promise<void> {
  const rl = readline.createInterface({ input, output });
  rl.on('SIGINT', () => rl.close());

  try {
    await runLocalCli({
      botName: config.botName,
      think,
      io: {
        prompt: (query) => rl.question(query),
        print: (line) => console.log(line),
        printError: (line, error) => console.error(line, error),
      },
    });
  } finally {
    rl.close();
  }
}

void main();
