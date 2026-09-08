import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import {
  canonicalRuntimeChildJson,
  executePreparedRuntimeScenario,
  type PreparedScenario,
  type RuntimeChildOutput,
  type RuntimeChildRequest,
  type RuntimeWorkResult,
  type TimedScenarioResult,
} from './performance-evidence.ts';
import { prepareScenario, runTimed, verifyScenario } from '../tests/benchmarks/runtime-scenarios.ts';

export type RuntimeScenarioLifecycle<P extends PreparedScenario, T extends TimedScenarioResult> = {
  prepareScenario(name: RuntimeChildRequest['scenario'], providers: number): Promise<P>;
  runTimed(prepared: P): Promise<T>;
  verifyScenario(prepared: P, timed: T): RuntimeWorkResult;
};

export async function runRuntimeChildProtocol<P extends PreparedScenario, T extends TimedScenarioResult>(
  request: RuntimeChildRequest,
  resolvedDiBag: string,
  lifecycle: RuntimeScenarioLifecycle<P, T>,
  clock: () => bigint = process.hrtime.bigint,
): Promise<RuntimeChildOutput> {
  const prepared = await lifecycle.prepareScenario(request.scenario, request.providers);
  const result = await executePreparedRuntimeScenario(prepared, lifecycle.runTimed, lifecycle.verifyScenario, clock);
  return {
    lane: request.lane,
    scenario: request.scenario,
    providers: request.providers,
    resolvedDiBag,
    ...result,
  };
}

export async function printRuntimeChild<P extends PreparedScenario, T extends TimedScenarioResult>(
  request: RuntimeChildRequest,
  resolvedDiBag: string,
  lifecycle: RuntimeScenarioLifecycle<P, T>,
  clock: () => bigint = process.hrtime.bigint,
  write: (chunk: string) => unknown = chunk => process.stdout.write(chunk),
): Promise<void> {
  const output = await runRuntimeChildProtocol(request, resolvedDiBag, lifecycle, clock);
  write(`${canonicalRuntimeChildJson(output)}\n`);
}

export function parseRuntimeChildRequestArgument(args: readonly string[]): RuntimeChildRequest {
  if (args.length !== 1) throw new Error('runtime child requires one request argument');
  try {
    return JSON.parse(args[0]!) as RuntimeChildRequest;
  } catch {
    throw new Error('runtime child request is not valid JSON');
  }
}

export async function runtimeBenchmarkChildMain(args = process.argv.slice(2)): Promise<void> {
  const request = parseRuntimeChildRequestArgument(args);
  const entry = request.scenario === 'node-native-promise' ? 'di-bag/node' : 'di-bag';
  const consumerRequire = createRequire(resolve(process.cwd(), 'package.json'));
  const resolvedDiBag = consumerRequire.resolve(entry);
  const imported = await import(entry) as { DiBag: unknown };
  await printRuntimeChild(request, resolvedDiBag, {
    prepareScenario: (scenario, providers) => prepareScenario(scenario, providers, imported.DiBag),
    runTimed,
    verifyScenario,
  });
}

const runtimeChildScript = resolve(process.cwd(), 'scripts', 'runtime-benchmark-child.ts');
if (process.argv[1] !== undefined && resolve(process.argv[1]) === runtimeChildScript) {
  runtimeBenchmarkChildMain().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
