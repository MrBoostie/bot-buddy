import { hasDiscord, redactedRuntimeSummary, validateRuntime } from './config.js';
import { startDiscord } from './discord.js';
import { logError, logInfo } from './log.js';

async function main(): Promise<void> {
  const issues = validateRuntime();
  if (issues.length > 0) {
    logError('configuration guard failed', issues.join(' | '), { scope: 'boot' });
    logInfo(`summary: ${redactedRuntimeSummary()}`, { scope: 'boot' });
    process.exitCode = 1;
    return;
  }

  if (!hasDiscord()) {
    logInfo('no DISCORD_TOKEN set. Run `npm run buddy` for local chat mode.', { scope: 'boot' });
    logInfo(`summary: ${redactedRuntimeSummary()}`, { scope: 'boot' });
    return;
  }

  logInfo(`summary: ${redactedRuntimeSummary()}`, { scope: 'boot' });
  await startDiscord();
}

void main();
