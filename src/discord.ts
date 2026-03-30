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
import { extractDirectedPrompt } from './directive.js';
import { formatUptime } from './runtime.js';

function commandReply(command: string): string | null {
  const cmd = command.trim().toLowerCase();

  if (cmd === '/status') {
    return `status: online | uptime=${formatUptime()} | model=${config.openaiModel} | ${redactedRuntimeSummary()}`;
  }

  if (cmd === '/diag') {
    const issues = validateRuntime();
    return issues.length === 0
      ? `diag: ok | hasDiscord=${String(hasDiscord())} | hasOpenAI=${String(hasOpenAI())}`
      : `diag: issues detected -> ${issues.join(' ; ')}`;
  }

  if (cmd === '/reload') {
    refreshConfigFromEnv();
    const issues = validateRuntime();
    if (issues.length > 0) {
      return `reload: applied, but issues remain -> ${issues.join(' ; ')}`;
    }
    return `reload: applied | ${redactedRuntimeSummary()}`;
  }

  return null;
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
    console.log(`[discord] logged in as ${c.user.tag}`);
  });

  client.on(Events.MessageCreate, async (msg) => {
    if (msg.author.bot) return;
    if (config.discordChannelId && msg.channelId !== config.discordChannelId) return;

    const prompt = extractDirectedPrompt(msg.content, client.user!.id);
    if (!prompt) return;

    const command = commandReply(prompt);
    if (command) {
      await msg.reply(command.slice(0, 1900));
      return;
    }

    try {
      await msg.channel.sendTyping();
      const reply = await think(prompt);
      await msg.reply(reply.slice(0, 1900));
    } catch (err) {
      console.error('[discord] reply error', err);
      await msg.reply('brain fart. try again in a sec.');
    }
  });

  await client.login(config.discordToken);
}
