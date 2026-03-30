import { Client, Events, GatewayIntentBits } from 'discord.js';
import { config } from './config.js';
import { think } from './brain.js';
import { extractDirectedPrompt } from './directive.js';

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
