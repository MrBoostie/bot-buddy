import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import OpenAI from 'openai';
import { config, hasOpenAI } from './config.js';

const execFileAsync = promisify(execFile);

type OpenClawAgentResponse = {
  status?: string;
  result?: { payloads?: Array<{ text?: string | null }> };
};

const fallbackReply = (input: string) =>
  `[local-mode] heard: ${input}\n\n(no OPENAI_API_KEY yet — wire creds tomorrow and I'll get smarter)`;

export function parseOpenClawAgentOutput(stdout: string): string {
  let parsed: OpenClawAgentResponse;

  try {
    parsed = JSON.parse(stdout) as OpenClawAgentResponse;
  } catch {
    throw new Error('openclaw agent returned invalid JSON output');
  }

  if (parsed.status !== 'ok') {
    throw new Error(`openclaw agent failed with status=${parsed.status ?? 'unknown'}`);
  }

  const text = parsed.result?.payloads?.map((p) => p.text ?? '').join('\n').trim();
  return text || '...thinking noises...';
}

async function thinkWithOpenAI(input: string): Promise<string> {
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

async function thinkWithOpenClaw(input: string): Promise<string> {
  const prompt = `${config.systemPrompt}\n\nUser: ${input}`;

  const { stdout } = await execFileAsync(
    'openclaw',
    [
      'agent',
      '--agent',
      config.openclawAgentId,
      '--message',
      prompt,
      '--json',
      '--timeout',
      String(config.openclawTimeoutSec),
    ],
    { timeout: config.openclawTimeoutSec * 1000 + 5000, maxBuffer: 1024 * 1024 * 8 },
  );

  return parseOpenClawAgentOutput(stdout);
}

export async function think(input: string): Promise<string> {
  if (config.llmBackend === 'openai') {
    return thinkWithOpenAI(input);
  }
  return thinkWithOpenClaw(input);
}
