import dotenv from 'dotenv';

export type LlmBackend = 'openai' | 'openclaw';

export type RuntimeConfig = {
  botName: string;
  systemPrompt: string;
  llmBackend: LlmBackend;
  llmBackendRaw: string;
  llmBackendValid: boolean;
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

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parseBackend(value: string | undefined): {
  llmBackend: LlmBackend;
  llmBackendRaw: string;
  llmBackendValid: boolean;
} {
  const llmBackendRaw = (value ?? 'openclaw').trim().toLowerCase();
  if (llmBackendRaw === 'openai' || llmBackendRaw === 'openclaw') {
    return {
      llmBackend: llmBackendRaw,
      llmBackendRaw,
      llmBackendValid: true,
    };
  }

  return {
    llmBackend: 'openclaw',
    llmBackendRaw,
    llmBackendValid: false,
  };
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return Number.NaN;
  return parsed;
}

export function buildConfigFromEnv(env: NodeJS.ProcessEnv): RuntimeConfig {
  const backend = parseBackend(env.LLM_BACKEND);

  return {
    botName: env.BOT_NAME ?? 'buddy',
    systemPrompt:
      env.SYSTEM_PROMPT ??
      "You are Buddy, Boostie's sidekick. Be concise, useful, and a little chaotic.",
    llmBackend: backend.llmBackend,
    llmBackendRaw: backend.llmBackendRaw,
    llmBackendValid: backend.llmBackendValid,
    openclawAgentId: env.OPENCLAW_AGENT_ID ?? 'main',
    openclawTimeoutSec: parsePositiveNumber(env.OPENCLAW_TIMEOUT_SEC, 90),
    openaiApiKey: env.OPENAI_API_KEY,
    openaiModel: env.OPENAI_MODEL ?? 'gpt-4.1-mini',
    requireOpenAIForDiscord: parseBoolean(env.REQUIRE_OPENAI_FOR_DISCORD, true),
    discordToken: env.DISCORD_TOKEN,
    discordClientId: env.DISCORD_CLIENT_ID,
    discordGuildId: env.DISCORD_GUILD_ID,
    discordChannelId: env.DISCORD_CHANNEL_ID,
  };
}

dotenv.config();

export const config: RuntimeConfig = buildConfigFromEnv(process.env);

export function refreshConfigFromEnv(): void {
  dotenv.config({ override: true });
  Object.assign(config, buildConfigFromEnv(process.env));
}

export function hasOpenAI(): boolean {
  return Boolean(config.openaiApiKey);
}

export function hasDiscord(): boolean {
  return Boolean(config.discordToken);
}

export function validateConfig(runtime: RuntimeConfig): string[] {
  const issues: string[] = [];

  if (!runtime.llmBackendValid) {
    issues.push(
      `LLM_BACKEND must be "openclaw" or "openai" (got: "${runtime.llmBackendRaw || 'empty'}").`,
    );
  }

  if (runtime.discordToken && runtime.requireOpenAIForDiscord && runtime.llmBackend === 'openai' && !runtime.openaiApiKey) {
    issues.push(
      'DISCORD_TOKEN is set but OPENAI_API_KEY is missing while LLM_BACKEND=openai and REQUIRE_OPENAI_FOR_DISCORD=true.',
    );
  }

  if (!runtime.openclawAgentId.trim()) {
    issues.push('OPENCLAW_AGENT_ID cannot be empty.');
  }

  if (!Number.isFinite(runtime.openclawTimeoutSec) || runtime.openclawTimeoutSec <= 0) {
    issues.push('OPENCLAW_TIMEOUT_SEC must be a positive number.');
  }

  return issues;
}

export function validateRuntime(): string[] {
  return validateConfig(config);
}

export function redactedRuntimeSummary(): string {
  const hasToken = Boolean(config.discordToken);
  const hasKey = Boolean(config.openaiApiKey);
  const channelLock = config.discordChannelId ? `locked(${config.discordChannelId})` : 'off';

  return [
    `bot=${config.botName}`,
    `llmBackend=${config.llmBackend}`,
    `llmBackendRaw=${config.llmBackendRaw}`,
    `discordToken=${hasToken ? 'set' : 'unset'}`,
    `openAIKey=${hasKey ? 'set' : 'unset'}`,
    `channelLock=${channelLock}`,
    `openclawAgent=${config.openclawAgentId}`,
    `openclawTimeoutSec=${config.openclawTimeoutSec}`,
    `requireOpenAIForDiscord=${String(config.requireOpenAIForDiscord)}`,
  ].join(' | ');
}
