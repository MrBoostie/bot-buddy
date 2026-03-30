import dotenv from 'dotenv';

dotenv.config();

export const config = {
  botName: process.env.BOT_NAME ?? 'buddy',
  systemPrompt:
    process.env.SYSTEM_PROMPT ??
    "You are Buddy, Boostie's sidekick. Be concise, useful, and a little chaotic.",
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
  discordToken: process.env.DISCORD_TOKEN,
  discordClientId: process.env.DISCORD_CLIENT_ID,
  discordGuildId: process.env.DISCORD_GUILD_ID,
  discordChannelId: process.env.DISCORD_CHANNEL_ID,
};

export function hasOpenAI(): boolean {
  return Boolean(config.openaiApiKey);
}

export function hasDiscord(): boolean {
  return Boolean(config.discordToken);
}
