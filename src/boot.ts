export type BootDecision =
  | { kind: 'exit-invalid-config'; exitCode: 1; issues: string[] }
  | { kind: 'local-cli-hint' }
  | { kind: 'start-discord' };

export function decideBoot(issues: string[], hasDiscordToken: boolean): BootDecision {
  if (issues.length > 0) {
    return { kind: 'exit-invalid-config', exitCode: 1, issues };
  }

  if (!hasDiscordToken) {
    return { kind: 'local-cli-hint' };
  }

  return { kind: 'start-discord' };
}
