import { hasDiscord } from './config.js';
import { startDiscord } from './discord.js';

async function main(): Promise<void> {
  if (!hasDiscord()) {
    console.log('[boot] no DISCORD_TOKEN set. Run `npm run buddy` for local chat mode.');
    return;
  }

  await startDiscord();
}

void main();
