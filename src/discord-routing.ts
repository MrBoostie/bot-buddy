import { extractDirectedPrompt } from './directive.js';

export type DiscordInput = {
  authorIsBot: boolean;
  channelId: string;
  content: string;
};

export type DiscordRoutingDeps = {
  botUserId: string;
  channelLockId?: string;
  evaluateCommand: (prompt: string) => string | null;
};

export type DiscordRoutingResult =
  | { kind: 'ignore' }
  | { kind: 'command'; text: string }
  | { kind: 'llm'; prompt: string };

export function routeDiscordInput(input: DiscordInput, deps: DiscordRoutingDeps): DiscordRoutingResult {
  if (input.authorIsBot) return { kind: 'ignore' };
  if (deps.channelLockId && input.channelId !== deps.channelLockId) return { kind: 'ignore' };

  const prompt = extractDirectedPrompt(input.content, deps.botUserId);
  if (!prompt) return { kind: 'ignore' };

  const command = deps.evaluateCommand(prompt);
  if (command) {
    return { kind: 'command', text: command.slice(0, 1900) };
  }

  return { kind: 'llm', prompt };
}
