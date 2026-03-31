let commandCount = 0;
let llmSuccessCount = 0;
let llmErrorCount = 0;
let llmLatencyTotalMs = 0;
let llmLatencyCount = 0;

export function incrementCommandCount(): void {
  commandCount += 1;
}

export function incrementLlmSuccessCount(): void {
  llmSuccessCount += 1;
}

export function incrementLlmErrorCount(): void {
  llmErrorCount += 1;
}

export function recordLlmLatencyMs(durationMs: number): void {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;
  llmLatencyTotalMs += durationMs;
  llmLatencyCount += 1;
}

export function getMetricsSummary(): string {
  const llmAvgMs = llmLatencyCount > 0 ? Math.round(llmLatencyTotalMs / llmLatencyCount) : 0;
  return `commands=${commandCount},llmOk=${llmSuccessCount},llmErr=${llmErrorCount},llmAvgMs=${llmAvgMs}`;
}

export function resetMetricsForTests(): void {
  commandCount = 0;
  llmSuccessCount = 0;
  llmErrorCount = 0;
  llmLatencyTotalMs = 0;
  llmLatencyCount = 0;
}
