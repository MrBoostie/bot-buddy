import { spawnSync } from 'node:child_process';
import { buildConfigFromEnv, runtimeModelLabel, validateConfig } from '../src/config.ts';

function strictToolChecksEnabled(): boolean {
  const raw = process.env.PREFLIGHT_STRICT_TOOLS?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function commandExists(command: string): boolean {
  const probe = spawnSync(command, ['--version'], { encoding: 'utf8' });
  return probe.status === 0;
}

const runtime = buildConfigFromEnv(process.env);
const issues = validateConfig(runtime);

const openclawCommand = process.env.PREFLIGHT_OPENCLAW_COMMAND?.trim() || 'openclaw';
if (strictToolChecksEnabled() && runtime.llmBackend === 'openclaw' && !commandExists(openclawCommand)) {
  issues.push(
    `PREFLIGHT_STRICT_TOOLS=true and LLM_BACKEND=openclaw, but ${openclawCommand} CLI is unavailable in PATH.`,
  );
}

if (issues.length > 0) {
  console.error(`preflight: issues detected (${issues.length})`);
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(
  [
    'preflight: ok',
    `backend=${runtime.llmBackend}`,
    `model=${runtimeModelLabel(runtime)}`,
    `discord=${runtime.discordToken ? 'enabled' : 'disabled'}`,
    `strictTools=${strictToolChecksEnabled()}`,
  ].join(' | '),
);
