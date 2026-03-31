import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import OpenAI from 'openai';
import { config, hasOpenAI } from './config.js';

const execFileAsync = promisify(execFile);

type OpenClawAgentResponse = {
  status?: string;
  result?: { payloads?: Array<{ text?: string | null }> };
};

type ExecLikeError = {
  code?: string | number;
  message?: string;
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

export function classifyOpenClawExecError(error: unknown): string {
  const err = (error ?? {}) as ExecLikeError;
  const code = typeof err.code === 'number' ? String(err.code) : (err.code ?? '');
  const message = err.message?.toLowerCase() ?? '';

  if (code === 'ENOENT') {
    return 'openclaw CLI is not installed or not available in PATH';
  }

  if (code === 'ETIMEDOUT' || message.includes('timed out') || message.includes('timeout')) {
    return `openclaw agent timed out after ${config.openclawTimeoutSec}s`;
  }

  return `openclaw agent execution failed${code ? ` (code=${code})` : ''}`;
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

  let stdout: string;

  try {
    const result = await execFileAsync(
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
    stdout = result.stdout;
  } catch (error) {
    throw new Error(classifyOpenClawExecError(error));
  }

  return parseOpenClawAgentOutput(stdout);
}

export async function think(input: string): Promise<string> {
  if (config.llmBackend === 'openai') {
    return thinkWithOpenAI(input);
  }
  return thinkWithOpenClaw(input);
}
