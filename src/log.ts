import { randomUUID } from 'node:crypto';

type LogLevel = 'info' | 'warn' | 'error';

type LoggerContext = {
  scope: string;
  requestId?: string;
};

export function createRequestId(): string {
  return randomUUID().split('-')[0] ?? 'unknown';
}

export function formatLogLine(level: LogLevel, message: string, context: LoggerContext): string {
  const rid = context.requestId ? ` rid=${context.requestId}` : '';
  return `[${context.scope}] [${level}]${rid} ${message}`;
}

export function logInfo(message: string, context: LoggerContext): void {
  console.log(formatLogLine('info', message, context));
}

export function logWarn(message: string, context: LoggerContext): void {
  console.warn(formatLogLine('warn', message, context));
}

export function logError(message: string, error: unknown, context: LoggerContext): void {
  console.error(formatLogLine('error', message, context), error);
}
