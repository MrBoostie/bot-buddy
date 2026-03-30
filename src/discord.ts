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
          }),
      },
    );

    const requestId = createRequestId();

    await executeDiscordRouting(result, {
      sendTyping: () => msg.channel.sendTyping(),
      think,
      reply: (text) => msg.reply(text),
      logError: (message, error) => logError(message, error, { scope: 'discord', requestId }),
    });
  });

  await client.login(config.discordToken);
}
