import { config, hasDiscord, redactedRuntimeSummary, validateRuntime } from './config.js';
import { startDiscord } from './discord.js';
import { logError, logInfo } from './log.js';
import { decideBoot, formatBootOpsLine } from './boot.js';

async function main(): Promise<void> {
  logInfo(
    formatBootOpsLine({
      llmBackend: config.llmBackend,
      reloadCooldownSec: config.operatorReloadCooldownSec,
      channelLockId: config.discordChannelId,
    }),
    { scope: 'boot' },
  );

  const issues = validateRuntime();
  const decision = decideBoot(issues, hasDiscord());

  if (decision.kind === 'exit-invalid-config') {
    logError('configuration guard failed', decision.issues.join(' | '), { scope: 'boot' });
    logInfo(`summary: ${redactedRuntimeSummary()}`, { scope: 'boot' });
    process.exitCode = decision.exitCode;
    return;
  }

  if (decision.kind === 'local-cli-hint') {
    logInfo('no DISCORD_TOKEN set. Run `npm run buddy` for local chat mode.', { scope: 'boot' });
    logInfo(`summary: ${redactedRuntimeSummary()}`, { scope: 'boot' });
    return;
  }

  logInfo(`summary: ${redactedRuntimeSummary()}`, { scope: 'boot' });
  await startDiscord();
}

void main();
