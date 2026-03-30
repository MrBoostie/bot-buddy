const buddyPrefix = /^buddy\s+/i;

export function extractDirectedPrompt(content: string, botUserId: string): string | null {
  const raw = content.trim();
  if (!raw) return null;

  const mentionRegex = new RegExp(`^<@!?${escapeRegExp(botUserId)}>\\s*`);
  if (mentionRegex.test(raw)) {
    const prompt = raw.replace(mentionRegex, '').trim();
    return prompt || null;
  }

  if (buddyPrefix.test(raw)) {
    const prompt = raw.replace(buddyPrefix, '').trim();
    return prompt || null;
  }

  return null;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
