import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import OpenAI from 'openai';
import { config, hasOpenAI } from './config.js';
import { clearBackendError, recordBackendError } from './brain-health.js';

const execFileAsync = promisify(execFile);

type OpenClawAgentResponse = {
  status?: string;
  result?: { payloads?: Array<{ text?: string | null }> };
};

function parseJsonCandidate(candidate: string): OpenClawAgentResponse | null {
  try {
    return JSON.parse(candidate) as OpenClawAgentResponse;
  } catch {
    return null;
  }
}

function parseOpenClawStdout(stdout: string): OpenClawAgentResponse {
  const direct = parseJsonCandidate(stdout);
  if (direct) return direct;

  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const parsed = parseJsonCandidate(lines[index] ?? '');
    if (parsed) {
      return parsed;
    }
  }

  throw new Error('openclaw agent returned invalid JSON output');
}

type ExecLikeError = {
  code?: string | number;
  message?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRetryableOpenClawExecError(error: unknown): boolean {
  const err = (error ?? {}) as ExecLikeError;
  const code = typeof err.code === 'number' ? String(err.code) : (err.code ?? '');
  const message = err.message?.toLowerCase() ?? '';

  if (code === 'ETIMEDOUT') return true;
  if (['ECONNRESET', 'EPIPE', 'EAI_AGAIN', 'ENETUNREACH', 'ECONNREFUSED'].includes(code)) return true;
  return message.includes('timed out') || message.includes('timeout');
}

export function computeOpenClawRetryDelayMs(
  attempt: number,
  baseDelayMs: number,
  randomValue: number = Math.random(),
): number {
  const maxDelayMs = 10_000;
  const exponentialDelay = Math.min(maxDelayMs, Math.max(0, baseDelayMs * 2 ** Math.max(0, attempt)));
  const jitterSpan = Math.round(exponentialDelay * 0.2);
  const centered = Math.max(0, Math.min(1, randomValue)) * 2 - 1;
  return Math.min(maxDelayMs, Math.max(0, Math.round(exponentialDelay + centered * jitterSpan)));
}

const fallbackReply = (input: string) =>
  `[local-mode] heard: ${input}\n\n(no OPENAI_API_KEY yet — wire creds tomorrow and I'll get smarter)`;

export function parseOpenClawAgentOutput(stdout: string): string {
  const parsed = parseOpenClawStdout(stdout);

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

  let lastError: unknown;

  for (let attempt = 0; attempt <= config.openclawRetryAttempts; attempt += 1) {
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
      return parseOpenClawAgentOutput(result.stdout);
    } catch (error) {
      lastError = error;
      const hasRemainingRetryBudget = attempt < config.openclawRetryAttempts;
      if (!hasRemainingRetryBudget || !isRetryableOpenClawExecError(error)) {
        break;
      }

      const retryDelayMs = computeOpenClawRetryDelayMs(attempt, config.openclawRetryBaseDelayMs);
      await sleep(retryDelayMs);
    }
  }

  throw new Error(classifyOpenClawExecError(lastError));
}

export async function think(input: string): Promise<string> {
  try {
    const reply =
      config.llmBackend === 'openai' ? await thinkWithOpenAI(input) : await thinkWithOpenClaw(input);
    clearBackendError();
    return reply;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    recordBackendError(message);
    throw error;
  }
}
