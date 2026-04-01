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
  operatorReloadCooldownSec: number;
  allowMetricsReset: boolean;
  allowAuditTail: boolean;
  metricsSnapshotIntervalSec: number;
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

function parseNonNegativeNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return Number.NaN;
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
    operatorReloadCooldownSec: parsePositiveNumber(env.OPERATOR_RELOAD_COOLDOWN_SEC, 30),
    allowMetricsReset: parseBoolean(env.ALLOW_METRICS_RESET, false),
    allowAuditTail: parseBoolean(env.ALLOW_AUDIT_TAIL, false),
    metricsSnapshotIntervalSec: parseNonNegativeNumber(env.METRICS_SNAPSHOT_INTERVAL_SEC, 0),
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

  if (!Number.isFinite(runtime.operatorReloadCooldownSec) || runtime.operatorReloadCooldownSec <= 0) {
    issues.push('OPERATOR_RELOAD_COOLDOWN_SEC must be a positive number.');
  }

  if (!Number.isFinite(runtime.metricsSnapshotIntervalSec) || runtime.metricsSnapshotIntervalSec < 0) {
    issues.push('METRICS_SNAPSHOT_INTERVAL_SEC must be a non-negative number.');
  }

  return issues;
}

export function validateRuntime(): string[] {
  return validateConfig(config);
}

export function runtimeModelLabel(runtime: RuntimeConfig = config): string {
  if (runtime.llmBackend === 'openclaw') {
    const agent = runtime.openclawAgentId.trim() || 'unknown';
    return `openclaw:${agent}`;
  }

  return runtime.openaiModel;
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
    `operatorReloadCooldownSec=${config.operatorReloadCooldownSec}`,
    `allowMetricsReset=${String(config.allowMetricsReset)}`,
    `allowAuditTail=${String(config.allowAuditTail)}`,
    `metricsSnapshotIntervalSec=${config.metricsSnapshotIntervalSec}`,
    `requireOpenAIForDiscord=${String(config.requireOpenAIForDiscord)}`,
  ].join(' | ');
}
