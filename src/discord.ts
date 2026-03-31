import { Client, Events, GatewayIntentBits } from 'discord.js';
import {
  config,
  hasOpenAI,
  hasDiscord,
  redactedRuntimeSummary,
  refreshConfigFromEnv,
  validateRuntime,
} from './config.js';
import { think } from './brain.js';
import { formatUptime } from './runtime.js';
import { evaluateOperatorCommand } from './operator-commands.js';
import { routeDiscordInput } from './discord-routing.js';
import { executeDiscordRouting } from './discord-executor.js';
import { createRequestId, logError, logInfo } from './log.js';
import { getBackendHealthSummary } from './brain-health.js';
import { tryAcquireReload } from './operator-rate-limit.js';
import { getMetricsSummary, resetMetrics } from './metrics.js';
import { getOperatorAuditEvent } from './operator-audit.js';

export async function startDiscord(): Promise<void> {
  if (!config.discordToken) throw new Error('DISCORD_TOKEN not set');

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once(Events.ClientReady, (c) => {
    logInfo(`logged in as ${c.user.tag}`, { scope: 'discord' });

    if (config.metricsSnapshotIntervalSec > 0) {
      const interval = setInterval(() => {
        logInfo(`metrics snapshot | ${getMetricsSummary()}`, { scope: 'discord' });
      }, config.metricsSnapshotIntervalSec * 1000);
      interval.unref();
      logInfo(`metrics snapshot enabled | everySec=${config.metricsSnapshotIntervalSec}`, {
        scope: 'discord',
      });
    }
  });

  client.on(Events.MessageCreate, async (msg) => {
    const result = routeDiscordInput(
      {
        authorIsBot: msg.author.bot,
        channelId: msg.channelId,
        content: msg.content,
      },
      {
        botUserId: client.user!.id,
        channelLockId: config.discordChannelId,
        evaluateCommand: (prompt) =>
          evaluateOperatorCommand(prompt, {
            formatUptime,
            modelName: () => config.openaiModel,
            runtimeSummary: redactedRuntimeSummary,
            validateRuntime,
            refreshConfigFromEnv,
            hasDiscord,
            hasOpenAI,
            backendHealthSummary: getBackendHealthSummary,
            tryAcquireReload,
            metricsSummary: getMetricsSummary,
            allowMetricsReset: () => config.allowMetricsReset,
            resetMetrics,
          }),
      },
    );

    const requestId = createRequestId();

    const auditEvent = getOperatorAuditEvent(result);
    if (auditEvent) {
      logInfo(`${auditEvent} | actor=${msg.author.id} | channel=${msg.channelId}`, {
        scope: 'discord',
        requestId,
      });
    }

    await executeDiscordRouting(result, {
      sendTyping: () => msg.channel.sendTyping(),
      think,
      reply: (text) => msg.reply(text),
      logError: (message, error) => logError(message, error, { scope: 'discord', requestId }),
    });
  });

  await client.login(config.discordToken);
}
