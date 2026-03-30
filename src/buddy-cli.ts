import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { think } from './brain.js';
import { config } from './config.js';

async function main(): Promise<void> {
  const rl = readline.createInterface({ input, output });
  console.log(`[${config.botName}] local console online. type "exit" to quit.`);

  while (true) {
    const line = (await rl.question('you> ')).trim();
    if (!line) continue;
    if (line.toLowerCase() === 'exit') break;

    try {
      const reply = await think(line);
      console.log(`${config.botName}> ${reply}`);
    } catch (err) {
      console.error(`${config.botName}> error:`, err);
    }
  }

  rl.close();
}

void main();
