import { realpathSync } from 'node:fs';
import { sep } from 'node:path';

export type RuntimeScenario =
  | 'build-close'
  | 'cold-linear-resolve'
  | 'warm-root-resolve'
  | 'scope-resolve-close'
  | 'transient-resolve-close'
  | 'raw-promise-identity'
  | 'node-native-promise';

export type PreparedScenario = object;
export type TimedScenarioResult = object;
export type RuntimeWorkResult = {
  checksum: string;
  factories: number;
  disposers: number;
  cleanupLog: readonly string[];
};

export type RuntimeChildRequest = {
  lane: string;
  scenario: RuntimeScenario;
  providers: number;
  archiveIdentity: string;
  implementationIdentity: string;
  orderSlot: number;
  installedPackageRoot: string;
  expected: RuntimeWorkResult;
};

export type RuntimeChildOutput = RuntimeWorkResult & {
  lane: string;
  scenario: RuntimeScenario;
  providers: number;
  resolvedDiBag: string;
  elapsedNanoseconds: string;
};

export type RuntimeChildExecution = {
  status: number | null;
  signal: string | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
};

export type BenchmarkSample = RuntimeChildOutput & {
  archiveIdentity: string;
  implementationIdentity: string;
  orderSlot: number;
};

export type BenchmarkSummary = {
  samples: readonly string[];
  count: number;
  minNanoseconds: string;
  p05Nanoseconds: string;
  medianNanoseconds: string;
  p95Nanoseconds: string;
  meanNanoseconds: string;
  standardDeviationNanoseconds: string;
  maxNanoseconds: string;
};

export type PairedBootstrapSummary = {
  seed: number;
  samples: number;
  medianRatio: number;
  medianRatioCi95: readonly [number, number];
};

const scenarios = new Set<RuntimeScenario>([
  'build-close',
  'cold-linear-resolve',
  'warm-root-resolve',
  'scope-resolve-close',
  'transient-resolve-close',
  'raw-promise-identity',
  'node-native-promise',
]);

const childKeys = [
  'lane', 'scenario', 'providers', 'resolvedDiBag', 'elapsedNanoseconds',
  'checksum', 'factories', 'disposers', 'cleanupLog',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertCount(value: unknown, label: string): asserts value is number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(`invalid runtime ${label} count`);
}

function duration(value: unknown): bigint {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) throw new Error('invalid runtime duration');
  const parsed = BigInt(value);
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('invalid runtime duration');
  return parsed;
}

function validateWorkResult(value: RuntimeWorkResult): void {
  if (typeof value.checksum !== 'string' || value.checksum.length === 0) throw new Error('invalid runtime checksum');
  assertCount(value.factories, 'factory');
  assertCount(value.disposers, 'disposer');
  if (!Array.isArray(value.cleanupLog) || !value.cleanupLog.every(entry => typeof entry === 'string')) {
    throw new Error('invalid runtime cleanup log');
  }
}

function canonicalChildJson(output: RuntimeChildOutput): string {
  const ordered: RuntimeChildOutput = {
    lane: output.lane,
    scenario: output.scenario,
    providers: output.providers,
    resolvedDiBag: output.resolvedDiBag,
    elapsedNanoseconds: output.elapsedNanoseconds,
    checksum: output.checksum,
    factories: output.factories,
    disposers: output.disposers,
    cleanupLog: output.cleanupLog,
  };
  return JSON.stringify(ordered);
}

function assertChildSchema(value: unknown): asserts value is RuntimeChildOutput {
  if (!isRecord(value) || Object.keys(value).length !== childKeys.length
    || childKeys.some(key => !Object.hasOwn(value, key))) throw new Error('runtime child schema mismatch');
  if (typeof value.lane !== 'string' || typeof value.scenario !== 'string' || !scenarios.has(value.scenario as RuntimeScenario)
    || !Number.isSafeInteger(value.providers) || Number(value.providers) <= 0
    || typeof value.resolvedDiBag !== 'string' || typeof value.elapsedNanoseconds !== 'string') {
    throw new Error('runtime child schema mismatch');
  }
  validateWorkResult(value as RuntimeChildOutput);
}

function canonicalInstalledPath(file: string, directory: string): boolean {
  let actual: string;
  let root: string;
  try {
    actual = realpathSync(file);
    root = realpathSync(directory);
  } catch {
    throw new Error('cannot resolve runtime di-bag identity');
  }
  if (directory !== root) throw new Error('runtime package root is not canonical');
  if (file !== actual) throw new Error('runtime di-bag identity is not canonical');
  return actual.startsWith(`${root}${sep}`);
}

export function validateRuntimeSample(request: RuntimeChildRequest, child: RuntimeChildOutput): BenchmarkSample {
  assertChildSchema(child);
  duration(child.elapsedNanoseconds);
  if (child.lane !== request.lane) throw new Error('runtime lane mismatch');
  if (child.scenario !== request.scenario) throw new Error('runtime scenario mismatch');
  if (child.providers !== request.providers) throw new Error('runtime provider count mismatch');
  if (!canonicalInstalledPath(child.resolvedDiBag, request.installedPackageRoot)) {
    throw new Error('runtime resolvedDiBag is outside installed di-bag');
  }
  validateWorkResult(request.expected);
  if (child.checksum !== request.expected.checksum) throw new Error('runtime checksum mismatch');
  if (child.factories !== request.expected.factories) throw new Error('runtime factory count mismatch');
  if (child.disposers !== request.expected.disposers) throw new Error('runtime disposer count mismatch');
  if (child.cleanupLog.length !== request.expected.cleanupLog.length
    || child.cleanupLog.some((entry, index) => entry !== request.expected.cleanupLog[index])) {
    throw new Error('runtime cleanup log mismatch');
  }
  if (!/^[a-f0-9]{64}$/.test(request.archiveIdentity)) throw new Error('invalid runtime archive identity');
  if (typeof request.implementationIdentity !== 'string'
    || request.implementationIdentity.trim() === '') throw new Error('invalid runtime implementation identity');
  if (!Number.isSafeInteger(request.orderSlot) || request.orderSlot < 0) throw new Error('invalid runtime order slot');
  return {
    archiveIdentity: request.archiveIdentity,
    implementationIdentity: request.implementationIdentity,
    orderSlot: request.orderSlot,
    ...child,
    cleanupLog: [...child.cleanupLog],
  };
}

export function parseRuntimeChild(request: RuntimeChildRequest, execution: RuntimeChildExecution): BenchmarkSample {
  if (execution.timedOut) throw new Error('runtime child timed out');
  if (execution.signal !== null) throw new Error(`runtime child terminated by ${execution.signal}`);
  if (execution.status !== 0) throw new Error(`runtime child exited with status ${String(execution.status)}`);
  if (execution.stderr !== '') throw new Error('runtime child stderr is not empty');
  let parsed: unknown;
  try { parsed = JSON.parse(execution.stdout); }
  catch { throw new Error('child stdout is not one canonical JSON object'); }
  if (!isRecord(parsed)) throw new Error('child stdout is not one canonical JSON object');
  try { assertChildSchema(parsed); }
  catch (error) {
    if (error instanceof Error && error.message === 'runtime child schema mismatch') throw error;
    throw new Error('runtime child schema mismatch');
  }
  if (execution.stdout !== `${canonicalChildJson(parsed)}\n`) {
    throw new Error('child stdout is not one canonical JSON object');
  }
  return validateRuntimeSample(request, parsed);
}

export async function runRuntimeChild(
  request: RuntimeChildRequest,
  execute: (request: RuntimeChildRequest) => Promise<RuntimeChildExecution>,
): Promise<BenchmarkSample> {
  return parseRuntimeChild(request, await execute(request));
}

function assertSamples(samples: readonly bigint[]): void {
  if (samples.length === 0) throw new Error('runtime samples must not be empty');
  for (const sample of samples) {
    if (sample <= 0n) throw new Error('runtime sample must be positive');
    if (sample > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('runtime sample exceeds safe statistic range');
  }
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function decimal(value: number): string {
  if (!Number.isFinite(value)) throw new Error('invalid runtime statistic arithmetic');
  return String(value);
}

export function summarize(samples: readonly bigint[]): BenchmarkSummary {
  assertSamples(samples);
  const raw = samples.map(String);
  const sorted = samples.map(Number).sort((left, right) => left - right);
  const count = sorted.length;
  const mean = sorted.reduce((sum, value) => sum + value, 0) / count;
  const variance = sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / count;
  const percentile = (fraction: number) => sorted[Math.max(0, Math.ceil(fraction * count) - 1)]!;
  return {
    samples: raw,
    count,
    minNanoseconds: String(sorted[0]),
    p05Nanoseconds: String(percentile(0.05)),
    medianNanoseconds: decimal(median(sorted)),
    p95Nanoseconds: String(percentile(0.95)),
    meanNanoseconds: decimal(mean),
    standardDeviationNanoseconds: decimal(Math.sqrt(variance)),
    maxNanoseconds: String(sorted[count - 1]),
  };
}

function randomGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 0x1_0000_0000;
  };
}

export function pairedBootstrapMedianRatio(
  current: readonly bigint[],
  baseline: readonly bigint[],
  seed: number,
  resamples = 10_000,
): PairedBootstrapSummary {
  if (current.length === 0 || current.length !== baseline.length) throw new Error('paired samples must have equal nonzero lengths');
  assertSamples(current);
  assertSamples(baseline);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffff_ffff) throw new Error('bootstrap seed must be an unsigned integer');
  if (!Number.isSafeInteger(resamples) || resamples <= 0) throw new Error('bootstrap resample count must be positive');
  const currentNumbers = current.map(Number);
  const baselineNumbers = baseline.map(Number);
  const medianRatio = median(currentNumbers) / median(baselineNumbers);
  const random = randomGenerator(seed);
  const ratios = new Array<number>(resamples);
  for (let sample = 0; sample < resamples; sample += 1) {
    const resampledCurrent: number[] = [];
    const resampledBaseline: number[] = [];
    for (let index = 0; index < current.length; index += 1) {
      const pair = Math.floor(random() * current.length);
      resampledCurrent.push(currentNumbers[pair]!);
      resampledBaseline.push(baselineNumbers[pair]!);
    }
    ratios[sample] = median(resampledCurrent) / median(resampledBaseline);
  }
  ratios.sort((left, right) => left - right);
  return {
    seed,
    samples: resamples,
    medianRatio,
    medianRatioCi95: [ratios[Math.ceil(resamples * 0.025) - 1]!, ratios[Math.ceil(resamples * 0.975) - 1]!],
  };
}

export async function executePreparedRuntimeScenario<P extends PreparedScenario, T extends TimedScenarioResult>(
  prepared: P,
  runTimed: (prepared: P) => Promise<T>,
  verifyScenario: (prepared: P, timed: T) => RuntimeWorkResult,
  clock: () => bigint = process.hrtime.bigint,
): Promise<RuntimeWorkResult & { elapsedNanoseconds: string }> {
  const start = clock();
  const timed = await runTimed(prepared);
  const elapsed = clock() - start;
  if (elapsed <= 0n) throw new Error('runtime duration must be positive');
  const work = verifyScenario(prepared, timed);
  validateWorkResult(work);
  return { elapsedNanoseconds: String(elapsed), ...work, cleanupLog: [...work.cleanupLog] };
}

export function canonicalRuntimeChildJson(output: RuntimeChildOutput): string {
  assertChildSchema(output);
  duration(output.elapsedNanoseconds);
  return canonicalChildJson(output);
}
