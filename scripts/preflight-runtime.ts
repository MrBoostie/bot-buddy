import { buildConfigFromEnv, runtimeModelLabel, validateConfig } from '../src/config.ts';

const runtime = buildConfigFromEnv(process.env);
const issues = validateConfig(runtime);

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
  ].join(' | '),
);
