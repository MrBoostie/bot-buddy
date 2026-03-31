export type OperatorCommandDeps = {
  formatUptime: () => string;
  modelName: () => string;
  runtimeSummary: () => string;
  validateRuntime: () => string[];
  refreshConfigFromEnv: () => void;
  hasDiscord: () => boolean;
  hasOpenAI: () => boolean;
  backendHealthSummary: () => string;
};

export function evaluateOperatorCommand(input: string, deps: OperatorCommandDeps): string | null {
  const cmd = input.trim().toLowerCase();

  if (cmd === '/ping') {
    return `pong | uptime=${deps.formatUptime()} | model=${deps.modelName()}`;
  }

  if (cmd === '/status') {
    return `status: online | uptime=${deps.formatUptime()} | model=${deps.modelName()} | ${deps.runtimeSummary()}`;
  }

  if (cmd === '/diag') {
    const issues = deps.validateRuntime();
    const backend = deps.backendHealthSummary();
    return issues.length === 0
      ? `diag: ok | hasDiscord=${String(deps.hasDiscord())} | hasOpenAI=${String(deps.hasOpenAI())} | lastBackendError=${backend}`
      : `diag: issues detected -> ${issues.join(' ; ')} | lastBackendError=${backend}`;
  }

  if (cmd === '/reload') {
    deps.refreshConfigFromEnv();
    const issues = deps.validateRuntime();
    if (issues.length > 0) {
      return `reload: applied, but issues remain -> ${issues.join(' ; ')}`;
    }
    return `reload: applied | ${deps.runtimeSummary()}`;
  }

  return null;
}
