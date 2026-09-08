import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { arch, platform, release, tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { packIsolatedClassic, stableJson, verifyTool, type VerifiedTool } from './platform-evidence.ts';
import { expectedScenarioResult } from '../tests/benchmarks/runtime-scenarios.ts';

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

export type RuntimeSampleCollection = {
  readonly warmups: number;
  readonly samples: readonly BenchmarkSample[];
  readonly summary: BenchmarkSummary;
};

export type CurrentRuntimeEvidenceRow = {
  readonly schema: 1;
  readonly lane: 'current';
  readonly status: 'informational';
  readonly scenario: RuntimeScenario;
  readonly providers: 10 | 100;
  readonly warmups: 5;
  readonly samples: 31;
  readonly archiveIdentity: string;
  readonly implementationIdentity: string;
  readonly resolvedDiBag: string;
  readonly summary: BenchmarkSummary;
  readonly rawEvidence: string;
  readonly provenance: RuntimeProvenance;
};

export type RuntimeProvenance = {
  readonly utc: string;
  readonly git: { readonly sha: string; readonly dirty: boolean };
  readonly executionEnvironment: {
    readonly operatingSystem: string;
    readonly operatingSystemRelease: string;
    readonly architecture: string;
    readonly node: string;
  };
  readonly tools: Record<'node' | 'npm' | 'classic6', {
    readonly version: string;
    readonly sha256: string;
    readonly argv: readonly string[];
  }>;
  readonly source: {
    readonly lockfileSha256: string;
    readonly srcSha256: string;
    readonly fixtureSha256: { readonly child: string; readonly protocol: string; readonly scenarios: string };
  };
  readonly command: readonly string[];
};

export type RuntimeExecutionRecord = {
  readonly schema: 1;
  readonly kind: 'runtime-child';
  readonly phase: 'warmup' | 'sample';
  readonly request: RuntimeChildRequest;
  readonly execution: RuntimeChildExecution;
};

export type UnavailableRuntimeEvidenceRow = {
  readonly schema: 1;
  readonly lane: 'current';
  readonly status: 'unavailable';
  readonly reason: string;
};

export async function collectRuntimeSamples(
  request: RuntimeChildRequest,
  execute: (request: RuntimeChildRequest) => Promise<RuntimeChildExecution>,
  warmups = 5,
  sampleCount = 31,
  record: (record: RuntimeExecutionRecord) => void | Promise<void> = () => {},
): Promise<RuntimeSampleCollection> {
  if (!Number.isSafeInteger(warmups) || warmups < 0) throw new Error('runtime warmup count must be nonnegative');
  if (!Number.isSafeInteger(sampleCount) || sampleCount <= 0) throw new Error('runtime sample count must be positive');
  const samples: BenchmarkSample[] = [];
  for (let index = 0; index < warmups + sampleCount; index += 1) {
    const childRequest = { ...request, orderSlot: index };
    const execution = await execute(childRequest);
    await record({ schema: 1, kind: 'runtime-child', phase: index < warmups ? 'warmup' : 'sample', request: childRequest, execution });
    const sample = parseRuntimeChild(childRequest, execution);
    if (index >= warmups) samples.push(sample);
  }
  return {
    warmups,
    samples,
    summary: summarize(samples.map(sample => BigInt(sample.elapsedNanoseconds))),
  };
}

const runtimeScenarios: readonly RuntimeScenario[] = [
  'build-close', 'cold-linear-resolve', 'warm-root-resolve', 'scope-resolve-close',
  'transient-resolve-close', 'raw-promise-identity', 'node-native-promise',
];

function exactChildExecution(node: VerifiedTool, script: string, request: RuntimeChildRequest): RuntimeChildExecution {
  const result = spawnSync(node.argv[0], [
    ...node.argv.slice(1), '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', script, JSON.stringify(request),
  ], { cwd: dirname(dirname(script)), encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024 });
  return {
    status: result.status,
    signal: result.signal,
    timedOut: result.error !== undefined && 'code' in result.error && result.error.code === 'ETIMEDOUT',
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function currentGit(root: string): { sha: string; dirty: boolean } {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  if (head.status !== 0 || head.signal !== null || !/^[a-f0-9]{40}\n$/.test(head.stdout)) throw new Error('cannot identify current runtime source');
  const dirty = spawnSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' });
  if (dirty.status !== 0 || dirty.signal !== null) throw new Error('cannot identify current runtime worktree state');
  return { sha: head.stdout.trim(), dirty: dirty.stdout !== '' };
}

function sha256File(path: string): string {
  return createHash('sha256').update(Uint8Array.from(readFileSync(path))).digest('hex');
}

function sourceTreeSha256(root: string): string {
  const hash = createHash('sha256');
  const visit = (directory: string): void => {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) visit(path);
      else {
        hash.update(relative(root, path));
        hash.update('\0');
        hash.update(Uint8Array.from(readFileSync(path)));
        hash.update('\0');
      }
    }
  };
  visit(join(root, 'src'));
  return hash.digest('hex');
}

function runtimeProvenance(
  root: string,
  tools: readonly [VerifiedTool, VerifiedTool, VerifiedTool],
  git: { sha: string; dirty: boolean },
  utc: string,
): RuntimeProvenance {
  const [node, npm, classic6] = tools;
  const tool = (value: VerifiedTool) => ({ version: value.version, sha256: value.sha256, argv: [...value.argv] });
  return {
    utc,
    git,
    executionEnvironment: {
      operatingSystem: platform(), operatingSystemRelease: release(), architecture: arch(), node: process.version,
    },
    tools: { node: tool(node), npm: tool(npm), classic6: tool(classic6) },
    source: {
      lockfileSha256: sha256File(join(root, 'package-lock.json')),
      srcSha256: sourceTreeSha256(root),
      fixtureSha256: {
        child: sha256File(join(root, 'scripts', 'runtime-benchmark-child.ts')),
        protocol: sha256File(join(root, 'scripts', 'performance-evidence.ts')),
        scenarios: sha256File(join(root, 'tests', 'benchmarks', 'runtime-scenarios.ts')),
      },
    },
    command: [...node.argv, '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/performance-evidence.ts', '--current'],
  };
}

function redactRuntimeRecord(record: RuntimeExecutionRecord, consumer: string, archiveTree: string): RuntimeExecutionRecord {
  const redact = (value: string) => value.split(consumer).join('$CONSUMER').split(archiveTree).join('$ARCHIVE_BUILD');
  return {
    ...record,
    request: { ...record.request, installedPackageRoot: redact(record.request.installedPackageRoot) },
    execution: { ...record.execution, stdout: redact(record.execution.stdout), stderr: redact(record.execution.stderr) },
  };
}

export async function runCurrentRuntimeEvidence(
  root = resolve(process.cwd()),
  record: (record: unknown) => void | Promise<void> = () => {},
  rawEvidence = 'callback',
):
Promise<readonly (CurrentRuntimeEvidenceRow | UnavailableRuntimeEvidenceRow)[]> {
  const checked = await Promise.all((['node', 'npm', 'classic6'] as const).map(name => verifyTool(root, name)));
  const unavailableIndex = checked.findIndex(tool => tool.status === 'unavailable');
  if (unavailableIndex >= 0) {
    const unavailable = checked[unavailableIndex]!;
    return [{ schema: 1, lane: 'current', status: 'unavailable', reason: `${(['node', 'npm', 'classic6'] as const)[unavailableIndex]}-${unavailable.status === 'unavailable' ? unavailable.reason : 'not-provisioned'}` }];
  }
  const [node, npm, classic6] = checked as [VerifiedTool, VerifiedTool, VerifiedTool];
  const archive = await packIsolatedClassic(root, node, npm, classic6);
  const consumer = mkdtempSync(join(tmpdir(), 'di-bag-runtime-consumer-'));
  try {
    writeFileSync(join(consumer, 'package.json'), '{"private":true}\n');
    const installed = spawnSync(npm.argv[0], [
      ...npm.argv.slice(1), 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', archive.path,
    ], { cwd: consumer, encoding: 'utf8', timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
    if (installed.error || installed.signal !== null || installed.status !== 0) {
      throw new Error(`runtime archive install failed: ${installed.stderr || installed.stdout || installed.error?.message}`);
    }
    const childScript = join(consumer, 'scripts', 'runtime-benchmark-child.ts');
    const fixtureScript = join(consumer, 'tests', 'benchmarks', 'runtime-scenarios.ts');
    const protocolScript = join(consumer, 'scripts', 'performance-evidence.ts');
    mkdirSync(dirname(childScript), { recursive: true });
    mkdirSync(dirname(fixtureScript), { recursive: true });
    cpSync(join(root, 'scripts', 'runtime-benchmark-child.ts'), childScript);
    cpSync(join(root, 'scripts', 'performance-evidence.ts'), protocolScript);
    cpSync(join(root, 'scripts', 'platform-evidence.ts'), join(consumer, 'scripts', 'platform-evidence.ts'));
    cpSync(join(root, 'tests', 'benchmarks', 'runtime-scenarios.ts'), fixtureScript);
    const installedPackageRoot = realpathSync(join(consumer, 'node_modules', 'di-bag'));
    const git = currentGit(root);
    const implementationIdentity = `current:${git.sha}${git.dirty ? ':dirty' : ''}`;
    const provenance = runtimeProvenance(root, [node, npm, classic6], git, new Date().toISOString());
    await record({ schema: 1, kind: 'runtime-run', archiveIdentity: archive.sha256, provenance });
    const rows: CurrentRuntimeEvidenceRow[] = [];
    for (const providers of [10, 100] as const) {
      for (const scenario of runtimeScenarios) {
        const request: RuntimeChildRequest = {
          lane: 'current', scenario, providers, archiveIdentity: archive.sha256,
          implementationIdentity, orderSlot: 0, installedPackageRoot,
          expected: expectedScenarioResult(scenario, providers),
        };
        const collection = await collectRuntimeSamples(
          request,
          childRequest => Promise.resolve(exactChildExecution(node, childScript, childRequest)),
          5,
          31,
          childRecord => record(redactRuntimeRecord(childRecord, consumer, archive.packageTree)),
        );
        const first = collection.samples[0]!;
        const relativeEntry = relative(consumer, first.resolvedDiBag);
        if (collection.samples.some(sample => sample.resolvedDiBag !== first.resolvedDiBag)) {
          throw new Error('runtime child package identity changed between samples');
        }
        rows.push({
          schema: 1, lane: 'current', status: 'informational', scenario, providers,
          warmups: 5, samples: 31, archiveIdentity: archive.sha256, implementationIdentity,
          resolvedDiBag: relativeEntry, summary: collection.summary, rawEvidence, provenance,
        });
      }
    }
    return rows;
  } finally {
    rmSync(consumer, { recursive: true, force: true });
    rmSync(archive.packageTree, { recursive: true, force: true });
  }
}

export function validateCurrentRuntimeEvidenceRow(value: unknown): CurrentRuntimeEvidenceRow {
  if (!isRecord(value) || value.schema !== 1 || value.lane !== 'current' || value.status !== 'informational'
    || !scenarios.has(value.scenario as RuntimeScenario) || (value.providers !== 10 && value.providers !== 100)
    || value.warmups !== 5 || value.samples !== 31 || typeof value.archiveIdentity !== 'string'
    || !/^[a-f0-9]{64}$/.test(value.archiveIdentity) || typeof value.implementationIdentity !== 'string'
    || typeof value.resolvedDiBag !== 'string' || typeof value.rawEvidence !== 'string') {
    throw new Error('runtime evidence row mismatch');
  }
  if (value.resolvedDiBag.startsWith('/') || value.resolvedDiBag.includes('..')
    || !value.resolvedDiBag.startsWith('node_modules/di-bag/dist/')) throw new Error('runtime evidence entry must be clone-safe');
  const provenance = value.provenance;
  const hash = (item: unknown) => typeof item === 'string' && /^[a-f0-9]{64}$/.test(item);
  if (!isRecord(provenance) || typeof provenance.utc !== 'string' || !isRecord(provenance.git)
    || typeof provenance.git.sha !== 'string' || !/^[a-f0-9]{40}$/.test(provenance.git.sha)
    || typeof provenance.git.dirty !== 'boolean' || !isRecord(provenance.executionEnvironment)
    || !isRecord(provenance.tools) || !isRecord(provenance.source) || !isRecord(provenance.source.fixtureSha256)
    || !hash(provenance.source.lockfileSha256) || !hash(provenance.source.srcSha256)
    || !hash(provenance.source.fixtureSha256.child) || !hash(provenance.source.fixtureSha256.protocol)
    || !hash(provenance.source.fixtureSha256.scenarios) || !Array.isArray(provenance.command)) {
    throw new Error('runtime evidence provenance mismatch');
  }
  for (const name of ['node', 'npm', 'classic6']) {
    const tool = provenance.tools[name];
    if (!isRecord(tool) || typeof tool.version !== 'string' || !hash(tool.sha256)
      || !Array.isArray(tool.argv) || !tool.argv.every(part => typeof part === 'string')) {
      throw new Error('runtime evidence provenance mismatch');
    }
  }
  if (!isRecord(value.summary) || value.summary.count !== 31 || !Array.isArray(value.summary.samples)
    || value.summary.samples.length !== 31) throw new Error('runtime evidence summary mismatch');
  return value as CurrentRuntimeEvidenceRow;
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

export function createRuntimeJournal(root: string, sha: string, utc: string): {
  readonly path: string;
  readonly relativePath: string;
  append(record: unknown): void;
} {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('runtime journal requires an exact Git SHA');
  let canonicalUtc = false;
  try { canonicalUtc = new Date(utc).toISOString() === utc; } catch { /* rejected below */ }
  if (!canonicalUtc) throw new Error('runtime journal requires canonical UTC');
  const filename = `runtime-current-${utc.replace(/[:.]/g, '-')}.jsonl`;
  const relativePath = join('docs', 'benchmarks', 'results', `${utc.slice(0, 10)}-${sha.slice(0, 7)}`, filename);
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, '', { flag: 'wx' });
  return {
    path,
    relativePath,
    append(record: unknown): void { writeFileSync(path, `${stableJson(record)}\n`, { flag: 'a' }); },
  };
}

export async function performanceEvidenceMain(
  args = process.argv.slice(2),
  root = resolve(process.cwd()),
  write: (chunk: string) => unknown = chunk => process.stdout.write(chunk),
): Promise<readonly (CurrentRuntimeEvidenceRow | UnavailableRuntimeEvidenceRow)[]> {
  if (args.length !== 1 || args[0] !== '--current') throw new Error('runtime evidence requires --current');
  const git = currentGit(root);
  const utc = new Date().toISOString();
  const journal = createRuntimeJournal(root, git.sha, utc);
  const rows = await runCurrentRuntimeEvidence(root, record => journal.append(record), journal.relativePath);
  for (const row of rows) {
    if (row.status === 'informational') validateCurrentRuntimeEvidenceRow(row);
    write(`${stableJson(row)}\n`);
  }
  return rows;
}

const performanceEvidenceScript = resolve(process.cwd(), 'scripts', 'performance-evidence.ts');
if (process.argv[1] !== undefined && resolve(process.argv[1]) === performanceEvidenceScript) {
  performanceEvidenceMain().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
