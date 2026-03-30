import OpenAI from 'openai';
import { config, hasOpenAI } from './config.js';

const fallbackReply = (input: string) =>
  `[local-mode] heard: ${input}\n\n(no OPENAI_API_KEY yet — wire creds tomorrow and I'll get smarter)`;

export async function think(input: string): Promise<string> {
  if (!hasOpenAI()) return fallbackReply(input);

  const client = new OpenAI({ apiKey: config.openaiApiKey });

  const rsp = await client.responses.create({
    model: config.openaiModel,
    input: [
      { role: 'system', content: [{ type: 'input_text', text: config.systemPrompt }] },
      { role: 'user', content: [{ type: 'input_text', text: input }] },
    ],
  });

  return rsp.output_text?.trim() || '...thinking noises...';
}
