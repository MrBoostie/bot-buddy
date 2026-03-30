import dotenv from 'dotenv';

type RuntimeConfig = {
  botName: string;
  systemPrompt: string;
  llmBackend: 'openai' | 'openclaw';
  openclawAgentId: string;
  openclawTimeoutSec: number;
  openaiApiKey?: string;
  openaiModel: string;
  requireOpenAIForDiscord: boolean;
  discordToken?: string;
  discordClientId?: string;
  discordGuildId?: string;
  discordChannelId?: string;
};

function loadFromEnv(): RuntimeConfig {
  return {
    botName: process.env.BOT_NAME ?? 'buddy',
    systemPrompt:
      process.env.SYSTEM_PROMPT ??
      "You are Buddy, Boostie's sidekick. Be concise, useful, and a little chaotic.",
    llmBackend: (process.env.LLM_BACKEND ?? 'openclaw').toLowerCase() === 'openai' ? 'openai' : 'openclaw',
    openclawAgentId: process.env.OPENCLAW_AGENT_ID ?? 'main',
    openclawTimeoutSec: Number(process.env.OPENCLAW_TIMEOUT_SEC ?? '90'),
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
    requireOpenAIForDiscord:
      (process.env.REQUIRE_OPENAI_FOR_DISCORD ?? 'true').toLowerCase() === 'true',
    discordToken: process.env.DISCORD_TOKEN,
    discordClientId: process.env.DISCORD_CLIENT_ID,
    discordGuildId: process.env.DISCORD_GUILD_ID,
    discordChannelId: process.env.DISCORD_CHANNEL_ID,
  };
}

dotenv.config();

export const config: RuntimeConfig = loadFromEnv();

export function refreshConfigFromEnv(): void {
  dotenv.config({ override: true });
  Object.assign(config, loadFromEnv());
}

export function hasOpenAI(): boolean {
  return Boolean(config.openaiApiKey);
}

export function hasDiscord(): boolean {
  return Boolean(config.discordToken);
}

export function validateRuntime(): string[] {
  const issues: string[] = [];

  if (hasDiscord() && config.requireOpenAIForDiscord && config.llmBackend === 'openai' && !hasOpenAI()) {
    issues.push(
      'DISCORD_TOKEN is set but OPENAI_API_KEY is missing while LLM_BACKEND=openai and REQUIRE_OPENAI_FOR_DISCORD=true.',
    );
  }

  if (!Number.isFinite(config.openclawTimeoutSec) || config.openclawTimeoutSec <= 0) {
    issues.push('OPENCLAW_TIMEOUT_SEC must be a positive number.');
  }

  return issues;
}

export function redactedRuntimeSummary(): string {
  const hasToken = Boolean(config.discordToken);
  const hasKey = Boolean(config.openaiApiKey);
  const channelLock = config.discordChannelId ? `locked(${config.discordChannelId})` : 'off';

  return [
    `bot=${config.botName}`,
    `llmBackend=${config.llmBackend}`,
    `discordToken=${hasToken ? 'set' : 'unset'}`,
    `openAIKey=${hasKey ? 'set' : 'unset'}`,
    `channelLock=${channelLock}`,
    `openclawAgent=${config.openclawAgentId}`,
    `openclawTimeoutSec=${config.openclawTimeoutSec}`,
    `requireOpenAIForDiscord=${String(config.requireOpenAIForDiscord)}`,
  ].join(' | ');
}
