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
    console.log(`[discord] logged in as ${c.user.tag}`);
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

    if (result.kind === 'ignore') return;

    if (result.kind === 'command') {
      await msg.reply(result.text);
      return;
    }

    try {
      await msg.channel.sendTyping();
      const reply = await think(result.prompt);
      await msg.reply(reply.slice(0, 1900));
    } catch (err) {
      console.error('[discord] reply error', err);
      await msg.reply('brain fart. try again in a sec.');
    }
  });

  await client.login(config.discordToken);
}
