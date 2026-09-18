// scripts/benchmark-compiler-ceiling.ts
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { cpus, release, totalmem } from 'node:os';
import { basename, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import ts from 'typescript';
import { compilerProgram, controlScaleSource, describeDiagnostic, namedModuleScaleSource, scalePath, scaleSource } from '../tests/compiler.ts';
import { nativeLimits, resolveNative, type NativeCompiler } from './native-compiler.ts';
import { compileGeneratedNative } from './native-scale.ts';

/**
 * Informational ceiling search: the largest single-expression call count each compiler accepts per form,
 * with every failure classified and a classic stack overflow attributed by one rerun on a larger V8 stack.
 * Not a gate: the number moves with JIT state and host load (docs/benchmarks/typescript.md).
 */
export type CeilingForm = 'chained' | 'replacement' | 'control' | 'named-modules';
export const ceilingForms: readonly CeilingForm[] = ['chained', 'replacement', 'control', 'named-modules'];
export type CeilingLane = 'classic' | 'native';
export type FailureKind = 'stack-overflow' | 'heap' | 'timeout' | 'memory' | 'output' | 'diagnostics' | 'crash';
export type ProbeResult = { accepted: true } | { accepted: false; kind: FailureKind };
export type CeilingOutcome = ProbeResult & {
  lane: CeilingLane; form: CeilingForm; count: number; stackKiB: number | undefined;
  milliseconds: number; compileMilliseconds: number | undefined; maxRssMiB: number | undefined;
  instantiations: number | undefined; diagnosticCount: number | undefined; stderrHead: string;
};
export type CeilingSearchOptions = { from: number; to: number; resolution: number; repeats: number };
export type CeilingSearch<R extends ProbeResult> = CeilingSearchOptions & {
  largestAccepted: number | undefined; largestAcceptedSample: R | undefined;
  smallestFailed: number | undefined; failureKind: FailureKind | undefined;
  flaky: number[]; samples: Array<{ count: number; results: R[] }>;
};
export type CeilingOptions = CeilingSearchOptions & { lane: CeilingLane; forms: CeilingForm[]; stackKiB: number };
export type ChildEvidence = {
  status: number | null; signal: string | null; stderr: string; timedOut: boolean;
  terminationReason: string | undefined; diagnosticCount: number | undefined;
};

// The same budget the matrix worker runs under (scripts/compiler-case.ts).
export const classicLimits = { timeoutMilliseconds: 60_000, maxOldSpaceMiB: 3072 } as const;

export function ceilingSource(count: number, form: CeilingForm): string {
  if (form === 'control') return controlScaleSource(count);
  if (form === 'named-modules') return namedModuleScaleSource(count, 'valid');
  return scaleSource(count, form, 'valid');
}

export function stackSizeKiB(execArgv: readonly string[]): number | undefined {
  const flag = execArgv.find(argument => argument.startsWith('--stack-size='));
  return flag === undefined ? undefined : Number(flag.slice('--stack-size='.length));
}

export function classifyFailure(child: ChildEvidence): FailureKind {
  if (child.timedOut || child.terminationReason === 'timeout') return 'timeout';
  if (child.terminationReason === 'memory') return 'memory';
  if (child.terminationReason === 'output') return 'output';
  if (child.stderr.includes('Maximum call stack size exceeded')) return 'stack-overflow';
  if (/heap out of memory|Allocation failed/i.test(child.stderr)) return 'heap';
  if (child.signal === null && child.diagnosticCount !== undefined && child.diagnosticCount > 0) return 'diagnostics';
  return 'crash';
}

const head = (text: string) => text.split('\n').slice(0, 12).join('\n');

export function classicProbe(root: string, count: number, form: CeilingForm, stackKiB?: number): CeilingOutcome {
  const child = spawnSync(process.execPath, [
    ...(stackKiB === undefined ? [] : [`--stack-size=${stackKiB}`]),
    `--max-old-space-size=${classicLimits.maxOldSpaceMiB}`, '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    resolve(root, 'scripts/benchmark-compiler-ceiling.ts'), '--worker', String(count), form,
  ], { cwd: root, encoding: 'utf8', timeout: classicLimits.timeoutMilliseconds, maxBuffer: 4_194_304 });
  let row: Record<string, unknown> = {};
  try { row = JSON.parse(child.stdout) as Record<string, unknown>; } catch { /* a crashed or killed worker prints nothing */ }
  const number = (key: string) => typeof row[key] === 'number' ? row[key] as number : undefined;
  const diagnosticCount = number('diagnosticCount');
  const completed = child.status === 0 && child.signal === null && child.error === undefined && child.stderr === '';
  const accepted = completed && row.count === count && row.form === form && diagnosticCount === 0;
  const base = {
    lane: 'classic' as const, form, count, stackKiB, milliseconds: number('milliseconds') ?? 0, compileMilliseconds: number('milliseconds'),
    maxRssMiB: number('maxRssMiB'), instantiations: number('instantiations'), diagnosticCount, stderrHead: head(child.stderr),
  };
  if (accepted) return { ...base, accepted: true };
  return { ...base, accepted: false, kind: classifyFailure({
    status: child.status, signal: child.signal, stderr: child.stderr, terminationReason: undefined, diagnosticCount,
    timedOut: (child.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT',
  }) };
}

export async function nativeProbe(root: string, compiler: NativeCompiler, count: number, form: CeilingForm): Promise<CeilingOutcome> {
  const result = await compileGeneratedNative(root, compiler, { fileName: 'generated-type-scale.ts', source: ceilingSource(count, form) });
  const diagnosticCount = result.checked ? result.diagnostics.length : undefined;
  const accepted = result.checked && result.status === 0 && result.diagnostics.length === 0;
  const totalSeconds = result.metrics['Total time'];
  const base = {
    lane: 'native' as const, form, count, stackKiB: undefined, milliseconds: result.milliseconds,
    compileMilliseconds: totalSeconds === undefined ? undefined : Math.round(totalSeconds * 1000),
    maxRssMiB: Math.round(result.peakObservedRssMiB), instantiations: result.metrics.Instantiations, diagnosticCount, stderrHead: head(result.stderr),
  };
  if (accepted) return { ...base, accepted: true };
  return { ...base, accepted: false, kind: classifyFailure({
    status: result.status, signal: result.signal, stderr: result.stderr, timedOut: false, terminationReason: result.terminationReason, diagnosticCount,
  }) };
}

/**
 * Probe both bounds, then halve the bracket until it is at most `resolution` wide. A count passes only when
 * every repeat is accepted; the first failed repeat ends it. `largestAccepted` is conservative by construction.
 */
export async function bisectCeiling<R extends ProbeResult>(probe: (count: number) => Promise<R>, options: CeilingSearchOptions): Promise<CeilingSearch<R>> {
  const { from, to, resolution, repeats } = options;
  if (![from, to, resolution, repeats].every(value => Number.isInteger(value) && value > 0) || to < from) throw new Error('invalid ceiling search');
  const search: CeilingSearch<R> = { from, to, resolution, repeats, largestAccepted: undefined, largestAcceptedSample: undefined, smallestFailed: undefined, failureKind: undefined, flaky: [], samples: [] };
  const passes = async (count: number): Promise<boolean> => {
    const results: R[] = [];
    for (let index = 0; index < repeats; index += 1) {
      const result = await probe(count);
      results.push(result);
      if (!result.accepted) break;
    }
    search.samples.push({ count, results });
    const last = results.at(-1)!;
    if (last.accepted) {
      if (search.largestAccepted === undefined || count > search.largestAccepted) { search.largestAccepted = count; search.largestAcceptedSample = last; }
      return true;
    }
    if (results.length > 1) search.flaky.push(count);
    if (search.smallestFailed === undefined || count < search.smallestFailed) { search.smallestFailed = count; search.failureKind = (last as { kind: FailureKind }).kind; }
    return false;
  };
  if (!(await passes(from)) || from === to || await passes(to)) return search;
  let low = from, high = to;
  while (high - low > resolution) {
    const middle = low + Math.floor((high - low) / 2);
    if (await passes(middle)) low = middle; else high = middle;
  }
  return search;
}

const numericFlags = { '--from': 'from', '--to': 'to', '--resolution': 'resolution', '--repeats': 'repeats', '--stack-size': 'stackKiB' } as const;

export function parseCeilingArguments(args: readonly string[]): CeilingOptions {
  const options: CeilingOptions = { lane: 'classic', forms: [], from: 500, to: 1500, resolution: 25, repeats: 3, stackKiB: 4000 };
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]!;
    if (flag === '--native') { options.lane = 'native'; continue; }
    const value = args[index + 1];
    index += 1;
    if (flag === '--form') {
      const form = ceilingForms.find(candidate => candidate === value);
      if (!form || options.forms.includes(form)) throw new Error('invalid ceiling arguments');
      options.forms.push(form);
      continue;
    }
    const key = Object.hasOwn(numericFlags, flag) ? numericFlags[flag as keyof typeof numericFlags] : undefined;
    if (!key || value === undefined || !/^\d+$/.test(value) || Number(value) < 1) throw new Error('invalid ceiling arguments');
    options[key] = Number(value);
  }
  if (options.forms.length === 0) options.forms = [...ceilingForms];
  if (options.to < options.from) throw new Error('invalid ceiling arguments');
  return options;
}

async function main() {
  const options = parseCeilingArguments(process.argv.slice(2));
  const root = process.cwd();
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const sourceStatus = execFileSync('git', ['status', '--porcelain', '--', 'src'], { cwd: root, encoding: 'utf8' }).trim();
  const native = options.lane === 'native' ? await resolveNative(root) : undefined;
  const utc = new Date().toISOString();
  const directory = resolve(root, 'docs/benchmarks/results', `${utc.slice(0, 10)}-${commit.slice(0, 7)}`);
  const evidencePath = resolve(directory, `compiler-ceiling-${utc.replaceAll(':', '-')}.jsonl`);
  mkdirSync(directory, { recursive: true });
  const record = (entry: Record<string, unknown>) => { const line = JSON.stringify(entry); appendFileSync(evidencePath, `${line}\n`); console.log(line); };
  record({
    schema: 1, type: 'header', status: 'informational', utc, commit, sourceStatus, lane: options.lane,
    typescript: native?.version ?? ts.version, ...(native ? { compiler: native } : {}), node: process.version,
    host: { platform: process.platform, release: release(), arch: process.arch, cpus: cpus().length, memoryMiB: Math.round(totalmem() / 1048576) },
    limits: native ? nativeLimits : classicLimits, options,
    note: 'Informational. A count passes only when every repeat is accepted. Attribution reruns a classic stack overflow once on a larger V8 stack; that stack is not a supported configuration.',
  });
  const summaries: Record<string, unknown>[] = [];
  for (const form of options.forms) {
    const search = await bisectCeiling(async count => {
      const outcome = native ? await nativeProbe(root, native, count, form) : classicProbe(root, count, form);
      record({ schema: 1, type: 'probe', ...outcome });
      return outcome;
    }, options);
    const { samples, ...rest } = search;
    let attribution: 'v8-stack-budget' | 'not-stack-budget' | undefined;
    if (!native && search.smallestFailed !== undefined && search.failureKind === 'stack-overflow') {
      const outcome = classicProbe(root, search.smallestFailed, form, options.stackKiB);
      record({ schema: 1, type: 'attribution', ...outcome });
      attribution = outcome.accepted ? 'v8-stack-budget' : 'not-stack-budget';
    }
    const summary = { schema: 1, type: 'summary', lane: options.lane, form, ...rest, probes: samples.length, ...(attribution ? { attribution } : {}) };
    record(summary);
    summaries.push(summary);
  }
  record({ schema: 1, type: 'complete', forms: summaries.length, evidence: relative(root, evidencePath) });
}

if (process.argv[2] === '--worker') {
  const count = Number(process.argv[3]);
  const form = ceilingForms.find(candidate => candidate === process.argv[4]);
  if (process.argv.length !== 5 || !form || !Number.isInteger(count) || count < 1) throw new Error('invalid ceiling case');
  const source = ceilingSource(count, form);
  const start = performance.now();
  const program = compilerProgram(scalePath, source);
  const errors = ts.getPreEmitDiagnostics(program).map(describeDiagnostic);
  console.log(JSON.stringify({
    count, form, typescript: ts.version, node: process.version, stackKiB: stackSizeKiB(process.execArgv),
    milliseconds: Math.round(performance.now() - start),
    maxRssMiB: Math.round(process.resourceUsage().maxRSS / 1024),
    instantiations: program.getInstantiationCount(),
    diagnosticCount: errors.length, codes: [...new Set(errors.map(error => error.code))], firstDiagnostic: errors[0],
  }));
} else if (basename(process.argv[1] ?? '') === 'benchmark-compiler-ceiling.ts') {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
