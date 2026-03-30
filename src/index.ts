import { hasDiscord, redactedRuntimeSummary, validateRuntime } from './config.js';
import { startDiscord } from './discord.js';

async function main(): Promise<void> {
  const issues = validateRuntime();
  if (issues.length > 0) {
    console.error('[boot] configuration guard failed:');
    for (const issue of issues) console.error(`- ${issue}`);
    console.error(`[boot] summary: ${redactedRuntimeSummary()}`);
    process.exitCode = 1;
    return;
  }

  if (!hasDiscord()) {
    console.log('[boot] no DISCORD_TOKEN set. Run `npm run buddy` for local chat mode.');
    console.log(`[boot] summary: ${redactedRuntimeSummary()}`);
    return;
  }

  console.log(`[boot] summary: ${redactedRuntimeSummary()}`);
  await startDiscord();
}

void main();
