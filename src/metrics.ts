let commandCount = 0;
let llmSuccessCount = 0;
let llmErrorCount = 0;

export function incrementCommandCount(): void {
  commandCount += 1;
}

export function incrementLlmSuccessCount(): void {
  llmSuccessCount += 1;
}

export function incrementLlmErrorCount(): void {
  llmErrorCount += 1;
}

export function getMetricsSummary(): string {
  return `commands=${commandCount},llmOk=${llmSuccessCount},llmErr=${llmErrorCount}`;
}

export function resetMetricsForTests(): void {
  commandCount = 0;
  llmSuccessCount = 0;
  llmErrorCount = 0;
}
