let lastSummary: string | null = null;
let suppressedCount = 0;

export function evaluateMetricsSnapshot(summary: string):
  | { emit: true; summary: string; suppressedBeforeEmit: number }
  | { emit: false } {
  if (summary === lastSummary) {
    suppressedCount += 1;
    return { emit: false };
  }

  const suppressedBeforeEmit = suppressedCount;
  lastSummary = summary;
  suppressedCount = 0;
  return { emit: true, summary, suppressedBeforeEmit };
}

export function resetMetricsSnapshotStateForTests(): void {
  lastSummary = null;
  suppressedCount = 0;
}
