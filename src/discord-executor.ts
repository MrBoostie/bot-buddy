import type { DiscordRoutingResult } from './discord-routing.js';
import {
  incrementLlmErrorCount,
  incrementLlmSuccessCount,
  recordLlmLatencyMs,
} from './metrics.js';

export type DiscordExecutorDeps = {
  sendTyping: () => Promise<unknown>;
  think: (prompt: string) => Promise<string>;
  reply: (text: string) => Promise<unknown>;
  logError: (message: string, error: unknown) => void;
};

export async function executeDiscordRouting(
  result: DiscordRoutingResult,
  deps: DiscordExecutorDeps,
): Promise<void> {
  if (result.kind === 'ignore') return;

  if (result.kind === 'command') {
    await deps.reply(result.text);
    return;
  }

  const startedAt = Date.now();

  try {
    await deps.sendTyping();
    const reply = await deps.think(result.prompt);
    incrementLlmSuccessCount();
    await deps.reply(reply.slice(0, 1900));
  } catch (err) {
    incrementLlmErrorCount();
    deps.logError('[discord] reply error', err);
    await deps.reply('brain fart. try again in a sec.');
  } finally {
    recordLlmLatencyMs(Date.now() - startedAt);
  }
}
