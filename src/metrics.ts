let commandCount = 0;
let llmSuccessCount = 0;
let llmErrorCount = 0;
let llmLatencyTotalMs = 0;
let llmLatencyCount = 0;
let llmLt250MsCount = 0;
let llm250To1000MsCount = 0;
let llmGt1000MsCount = 0;
let commandLatencyTotalMs = 0;
let commandLatencyCount = 0;
const llmRecentLatencyMs: number[] = [];
const commandRecentLatencyMs: number[] = [];
const LLM_RECENT_WINDOW_SIZE = 20;
const COMMAND_RECENT_WINDOW_SIZE = 20;

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

  if (durationMs < 250) {
    llmLt250MsCount += 1;
  } else if (durationMs <= 1000) {
    llm250To1000MsCount += 1;
  } else {
    llmGt1000MsCount += 1;
  }

  llmRecentLatencyMs.push(durationMs);
  if (llmRecentLatencyMs.length > LLM_RECENT_WINDOW_SIZE) {
    llmRecentLatencyMs.shift();
  }
}

export function recordCommandLatencyMs(durationMs: number): void {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;
  commandLatencyTotalMs += durationMs;
  commandLatencyCount += 1;
  commandRecentLatencyMs.push(durationMs);
  if (commandRecentLatencyMs.length > COMMAND_RECENT_WINDOW_SIZE) {
    commandRecentLatencyMs.shift();
  }
}

export function getMetricsSummary(): string {
  const llmAvgMs = llmLatencyCount > 0 ? Math.round(llmLatencyTotalMs / llmLatencyCount) : 0;
  const llmRecentMaxMs = llmRecentLatencyMs.length > 0 ? Math.round(Math.max(...llmRecentLatencyMs)) : 0;
  const commandAvgMs =
    commandLatencyCount > 0 ? Math.round(commandLatencyTotalMs / commandLatencyCount) : 0;
  const commandRecentMaxMs =
    commandRecentLatencyMs.length > 0 ? Math.round(Math.max(...commandRecentLatencyMs)) : 0;
  const llmCalls = llmSuccessCount + llmErrorCount;
  return `commands=${commandCount},llmCalls=${llmCalls},llmOk=${llmSuccessCount},llmErr=${llmErrorCount},llmAvgMs=${llmAvgMs},llmRecentMaxMs=${llmRecentMaxMs},llmLt250Ms=${llmLt250MsCount},llm250To1000Ms=${llm250To1000MsCount},llmGt1000Ms=${llmGt1000MsCount},cmdAvgMs=${commandAvgMs},cmdRecentMaxMs=${commandRecentMaxMs}`;
}

export function resetMetrics(): void {
  commandCount = 0;
  llmSuccessCount = 0;
  llmErrorCount = 0;
  llmLatencyTotalMs = 0;
  llmLatencyCount = 0;
  llmLt250MsCount = 0;
  llm250To1000MsCount = 0;
  llmGt1000MsCount = 0;
  commandLatencyTotalMs = 0;
  commandLatencyCount = 0;
  llmRecentLatencyMs.length = 0;
  commandRecentLatencyMs.length = 0;
}

export function resetMetricsForTests(): void {
  resetMetrics();
}
