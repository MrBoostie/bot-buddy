import { Client, Events, GatewayIntentBits } from 'discord.js';
import {
  config,
  hasOpenAI,
  hasDiscord,
  redactedRuntimeSummary,
  refreshConfigFromEnv,
  validateRuntime,
  runtimeModelLabel,
} from './config.js';
import { think } from './brain.js';
import { formatUptime } from './runtime.js';
import { evaluateOperatorCommand, type OperatorCommandDeps } from './operator-commands.js';
import { routeDiscordInput } from './discord-routing.js';
import { executeDiscordRouting } from './discord-executor.js';
import { createRequestId, logError, logInfo } from './log.js';
import { getBackendHealthSummary } from './brain-health.js';
import { tryAcquireReload } from './operator-rate-limit.js';
import { getMetricsSummary, resetMetrics } from './metrics.js';
import { getAuditTail, getOperatorAuditEvent, recordAuditEvent } from './operator-audit.js';
import { evaluateMetricsSnapshot } from './metrics-snapshot.js';

export function resolveAppVersionInfo(): { value: string; source: 'BOT_BUDDY_VERSION' | 'npm_package_version' | 'unknown' } {
  const explicit = process.env.BOT_BUDDY_VERSION?.trim();
  if (explicit) {
    return { value: explicit, source: 'BOT_BUDDY_VERSION' };
  }

  const npmVersion = process.env.npm_package_version?.trim();
  if (npmVersion) {
    return { value: npmVersion, source: 'npm_package_version' };
  }

  return { value: 'unknown', source: 'unknown' };
}

export function buildOperatorCommandDeps(): OperatorCommandDeps {
  return {
    formatUptime,
    modelName: () => runtimeModelLabel(),
    appVersion: () => resolveAppVersionInfo().value,
    runtimeSummary: redactedRuntimeSummary,
    validateRuntime,
    refreshConfigFromEnv,
    hasDiscord,
    hasOpenAI,
    llmBackend: () => config.llmBackend,
    backendHealthSummary: getBackendHealthSummary,
    tryAcquireReload,
    metricsSummary: getMetricsSummary,
    allowMetricsReset: () => config.allowMetricsReset,
    resetMetrics,
    allowAuditTail: () => config.allowAuditTail,
    getAuditTail,
  };
}

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
    const version = resolveAppVersionInfo();
    logInfo(`logged in as ${c.user.tag}`, { scope: 'discord' });
    logInfo(`app version | value=${version.value} | source=${version.source}`, { scope: 'discord' });

    if (config.metricsSnapshotIntervalSec > 0) {
      const interval = setInterval(() => {
        const snapshot = evaluateMetricsSnapshot(getMetricsSummary());
        if (!snapshot.emit) return;

        const suffix =
          snapshot.suppressedBeforeEmit > 0
            ? ` | suppressedUnchanged=${snapshot.suppressedBeforeEmit}`
            : '';
        logInfo(`metrics snapshot | ${snapshot.summary}${suffix}`, { scope: 'discord' });
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
        evaluateCommand: (prompt) => evaluateOperatorCommand(prompt, buildOperatorCommandDeps()),
      },
    );

    const requestId = createRequestId();

    const auditEvent = getOperatorAuditEvent(result);
    if (auditEvent) {
      const line = `${auditEvent} | actor=${msg.author.id} | channel=${msg.channelId} | rid=${requestId}`;
      recordAuditEvent(line);
      logInfo(line, {
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
