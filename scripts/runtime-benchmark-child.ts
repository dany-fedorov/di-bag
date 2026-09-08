import {
  canonicalRuntimeChildJson,
  executePreparedRuntimeScenario,
  type PreparedScenario,
  type RuntimeChildOutput,
  type RuntimeChildRequest,
  type RuntimeWorkResult,
  type TimedScenarioResult,
} from './performance-evidence.ts';

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
): Promise<void> {
  const output = await runRuntimeChildProtocol(request, resolvedDiBag, lifecycle);
  process.stdout.write(`${canonicalRuntimeChildJson(output)}\n`);
}
