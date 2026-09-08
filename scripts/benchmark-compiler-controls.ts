import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import type { Diagnostic, MatrixCase } from './benchmark-result.ts';
import { runCompilerCase, type CompilerLane } from './compiler-case.ts';
import { resolveNative } from './native-compiler.ts';

export type CompilerControlCaseName =
  | 'named-chained-100-valid'
  | 'named-chained-100-missing'
  | 'named-chained-100-wrong-shape'
  | 'named-grouped-1000-valid'
  | 'named-grouped-1000-missing'
  | 'named-grouped-1000-wrong-shape'
  | 'token-bindings-100-valid'
  | 'token-bindings-100-missing-final-token'
  | 'token-bindings-100-mismatched-invariant-service';

export type CompilerControlDefinition = MatrixCase & {
  case: CompilerControlCaseName;
  expectedMarker?: string;
  generatedPath: 'tests/generated-type-scale.ts' | 'tests/generated-token-scale.ts';
};

export type CompilerControlSample = {
  compiler: string;
  case: CompilerControlCaseName;
  count: number;
  form: MatrixCase['form'];
  scenario: MatrixCase['scenario'];
  compileMilliseconds: number;
  processMilliseconds: number;
  maxRssMiB: number;
  instantiations: number;
  diagnostics: Diagnostic[];
  boundaryLine: number | undefined;
  accepted: boolean;
  sourceCommitBefore: string;
  sourceCommitAfter: string;
  sourceStatusBefore: string;
  sourceStatusAfter: string;
  sourceSha256Before: string;
  sourceSha256After: string;
  generatedSha256Before: string;
  generatedSha256After: string;
};

export type NumericSeries = {
  values: number[];
  min: number;
  p05: number;
  median: number;
  mean: number;
  standardDeviation: number;
  p95: number;
  max: number;
};

export type CompilerControlRow = {
  schema: 1;
  status: 'informational';
  compiler: string;
  case: CompilerControlCaseName;
  warmups: number;
  samples: number;
  compileMilliseconds: NumericSeries;
  processMilliseconds: NumericSeries;
  maxRssMiB: NumericSeries;
  instantiations: NumericSeries;
  diagnostics: Diagnostic[][];
  markerAccepted: boolean;
};

const named = (
  form: 'chained' | 'grouped',
  count: 100 | 1000,
  scenario: 'valid' | 'missing' | 'wrong-shape',
): CompilerControlDefinition => ({
  case: `named-${form}-${count}-${scenario}` as CompilerControlCaseName,
  count,
  form,
  scenario,
  generatedPath: 'tests/generated-type-scale.ts',
  ...(scenario === 'valid' ? {} : {
    expectedMarker: scenario === 'missing' ? 'missing factories' : 'a dependency has the wrong shape',
  }),
});

const token = (
  scenario: 'valid' | 'missing-final-token' | 'mismatched-invariant-service',
): CompilerControlDefinition => ({
  case: `token-bindings-100-${scenario}` as CompilerControlCaseName,
  count: 100,
  form: 'bindings',
  scenario,
  generatedPath: 'tests/generated-token-scale.ts',
  ...(scenario === 'valid' ? {} : {
    expectedMarker: scenario === 'missing-final-token'
      ? 'missing factories'
      : 'token dependency has an incompatible or opaque contract',
  }),
});

export const compilerControlCases: readonly CompilerControlDefinition[] = [
  named('chained', 100, 'valid'),
  named('chained', 100, 'missing'),
  named('chained', 100, 'wrong-shape'),
  named('grouped', 1000, 'valid'),
  named('grouped', 1000, 'missing'),
  named('grouped', 1000, 'wrong-shape'),
  token('valid'),
  token('missing-final-token'),
  token('mismatched-invariant-service'),
];

function finiteNonnegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function finitePositive(value: unknown): value is number {
  return finiteNonnegative(value) && value > 0;
}

export function validateCompilerControl(
  control: CompilerControlDefinition,
  sample: Partial<CompilerControlSample>,
): { accepted: boolean; reason?: string } {
  const diagnostics = Array.isArray(sample.diagnostics) ? sample.diagnostics : [];
  if (diagnostics.some(diagnostic => diagnostic.code === 2589)) {
    return { accepted: false, reason: 'compiler returned TS2589' };
  }
  if (control.expectedMarker === undefined) {
    if (diagnostics.length !== 0) return { accepted: false, reason: 'valid control returned diagnostics' };
  } else {
    const markers = diagnostics.filter(diagnostic =>
      diagnostic.file?.endsWith(control.generatedPath)
      && diagnostic.line === sample.boundaryLine
      && diagnostic.message.includes(control.expectedMarker!),
    );
    if (markers.length === 0) return { accepted: false, reason: 'expected marker missing' };
    if (markers.length > 1) return { accepted: false, reason: 'expected marker occurred more than once' };
  }
  if (sample.case !== control.case || sample.count !== control.count
    || sample.form !== control.form || sample.scenario !== control.scenario) {
    return { accepted: false, reason: 'control identity mismatch' };
  }
  if (!finitePositive(sample.compileMilliseconds) || !finitePositive(sample.processMilliseconds)
    || !finitePositive(sample.maxRssMiB) || !finiteNonnegative(sample.instantiations)) {
    return { accepted: false, reason: 'invalid compiler work metrics' };
  }
  const stable = sample.sourceCommitBefore === sample.sourceCommitAfter
    && sample.sourceSha256Before === sample.sourceSha256After
    && sample.generatedSha256Before === sample.generatedSha256After
    && sample.sourceStatusBefore === sample.sourceStatusAfter;
  if (!stable) return { accepted: false, reason: 'compiler provenance changed' };
  if (sample.sourceStatusBefore !== '') return { accepted: false, reason: 'source tree is dirty' };
  if (sample.accepted !== true) return { accepted: false, reason: 'compiler case was not accepted' };
  return { accepted: true };
}

function numericSeries(values: readonly number[]): NumericSeries {
  if (values.length === 0 || values.some(value => !finiteNonnegative(value))) {
    throw new Error('compiler series requires finite nonnegative samples');
  }
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (fraction: number) => sorted[Math.ceil(fraction * sorted.length) - 1]!;
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;
  return {
    values: [...values],
    min: sorted[0]!,
    p05: percentile(0.05),
    median: percentile(0.5),
    mean,
    standardDeviation: Math.sqrt(variance),
    p95: percentile(0.95),
    max: sorted.at(-1)!,
  };
}

export function summarizeCompilerControl(
  control: CompilerControlDefinition,
  compiler: string,
  warmups: readonly CompilerControlSample[],
  samples: readonly CompilerControlSample[],
): CompilerControlRow {
  if (samples.length === 0) throw new Error('compiler controls require retained samples');
  for (const sample of [...warmups, ...samples]) {
    const validation = validateCompilerControl(control, sample);
    if (!validation.accepted) throw new Error(`${control.case}: ${validation.reason}`);
    if (sample.compiler !== compiler) throw new Error(`${control.case}: compiler identity mismatch`);
  }
  return {
    schema: 1,
    status: 'informational',
    compiler,
    case: control.case,
    warmups: warmups.length,
    samples: samples.length,
    compileMilliseconds: numericSeries(samples.map(sample => sample.compileMilliseconds)),
    processMilliseconds: numericSeries(samples.map(sample => sample.processMilliseconds)),
    maxRssMiB: numericSeries(samples.map(sample => sample.maxRssMiB)),
    instantiations: numericSeries(samples.map(sample => sample.instantiations)),
    diagnostics: samples.map(sample => sample.diagnostics),
    markerAccepted: true,
  };
}

export async function collectCompilerControl(
  control: CompilerControlDefinition,
  compiler: string,
  run: (phase: 'warmup' | 'sample', index: number) => Promise<CompilerControlSample>,
): Promise<CompilerControlRow> {
  const warmups: CompilerControlSample[] = [];
  const samples: CompilerControlSample[] = [];
  for (let index = 0; index < 5; index += 1) warmups.push(await run('warmup', index));
  for (let index = 0; index < 31; index += 1) samples.push(await run('sample', index));
  return summarizeCompilerControl(control, compiler, warmups, samples);
}

function requiredNumber(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (!finiteNonnegative(value)) throw new Error(`compiler row has invalid ${key}`);
  return value;
}

function requiredString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== 'string') throw new Error(`compiler row has invalid ${key}`);
  return value;
}

export function normalizeCompilerSample(
  control: CompilerControlDefinition,
  compiler: string,
  lane: CompilerLane,
  row: Record<string, unknown>,
): CompilerControlSample {
  const metrics = row.nativeMetrics;
  const nativeMetrics = typeof metrics === 'object' && metrics !== null
    ? metrics as Record<string, unknown>
    : {};
  const diagnostics = row.diagnostics;
  if (!Array.isArray(diagnostics) || !diagnostics.every(diagnostic =>
    typeof diagnostic === 'object' && diagnostic !== null
    && Number.isInteger(diagnostic.code) && typeof diagnostic.message === 'string')) {
    throw new Error('compiler row has malformed diagnostics');
  }
  const sample: CompilerControlSample = {
    compiler,
    case: control.case,
    count: requiredNumber(row, 'count'),
    form: row.form as MatrixCase['form'],
    scenario: row.scenario as MatrixCase['scenario'],
    compileMilliseconds: lane === 'classic'
      ? requiredNumber(row, 'milliseconds')
      : requiredNumber(nativeMetrics, 'Total time') * 1000,
    processMilliseconds: lane === 'classic'
      ? requiredNumber(row, 'processMilliseconds')
      : requiredNumber(row, 'milliseconds'),
    maxRssMiB: lane === 'classic'
      ? requiredNumber(row, 'maxRssMiB')
      : requiredNumber(row, 'peakObservedRssMiB'),
    instantiations: lane === 'classic'
      ? requiredNumber(row, 'instantiations')
      : requiredNumber(nativeMetrics, 'Instantiations'),
    diagnostics: diagnostics as Diagnostic[],
    boundaryLine: row.boundaryLine === undefined ? undefined : requiredNumber(row, 'boundaryLine'),
    accepted: row.accepted === true,
    sourceCommitBefore: requiredString(row, 'sourceCommitBefore'),
    sourceCommitAfter: requiredString(row, 'sourceCommitAfter'),
    sourceStatusBefore: requiredString(row, 'sourceStatusBefore'),
    sourceStatusAfter: requiredString(row, 'sourceStatusAfter'),
    sourceSha256Before: requiredString(row, 'sourceSha256Before'),
    sourceSha256After: requiredString(row, 'sourceSha256After'),
    generatedSha256Before: requiredString(row, 'generatedSha256Before'),
    generatedSha256After: requiredString(row, 'generatedSha256After'),
  };
  const validation = validateCompilerControl(control, sample);
  if (!validation.accepted) throw new Error(`${control.case}: ${validation.reason}`);
  return sample;
}

function sha256(path: string): string {
  return createHash('sha256').update(new Uint8Array(readFileSync(path))).digest('hex');
}

async function compilerIdentities(root: string): Promise<Record<CompilerLane, string>> {
  const classicCli = resolve(root, 'node_modules/typescript/bin/tsc6');
  const native = await resolveNative(root);
  return {
    classic: `classic6:${ts.version}:${sha256(classicCli)}`,
    native: `native7:${native.version}:${sha256(native.executable)}`,
  };
}

async function main() {
  if (process.argv.length !== 2) throw new Error('benchmark:compiler-controls accepts no arguments');
  const root = process.cwd();
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const sourceStatus = execFileSync('git', ['status', '--porcelain', '--', 'src'], { cwd: root, encoding: 'utf8' }).trim();
  if (sourceStatus !== '') throw new Error('compiler controls require a clean source tree');
  const identities = await compilerIdentities(root);
  const utc = new Date().toISOString();
  const directory = resolve(root, 'docs/benchmarks/results', `${utc.slice(0, 10)}-${commit.slice(0, 7)}`);
  const rawPath = resolve(directory, `compiler-controls-${utc.replaceAll(':', '-')}.jsonl`);
  mkdirSync(directory, { recursive: true });
  writeFileSync(rawPath, `${JSON.stringify({
    schema: 1,
    type: 'header',
    status: 'informational',
    utc,
    command: [process.execPath, '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/benchmark-compiler-controls.ts'],
    commit,
    sourceStatus,
    compilers: identities,
    warmups: 5,
    samples: 31,
    controls: compilerControlCases.map(control => control.case),
  })}\n`);
  const summaries: CompilerControlRow[] = [];
  for (const lane of ['classic', 'native'] as const) {
    for (const control of compilerControlCases) {
      const summary = await collectCompilerControl(control, identities[lane], async (phase, index) => {
        const raw = await runCompilerCase(root, lane, control);
        const sample = normalizeCompilerSample(control, identities[lane], lane, raw);
        appendFileSync(rawPath, `${JSON.stringify({
          schema: 1,
          type: 'sample',
          phase,
          index,
          lane,
          ...sample,
        })}\n`);
        return sample;
      });
      summaries.push(summary);
      appendFileSync(rawPath, `${JSON.stringify({ type: 'summary', ...summary })}\n`);
      console.log(JSON.stringify({ ...summary, rawEvidence: relative(root, rawPath) }));
    }
  }
  appendFileSync(rawPath, `${JSON.stringify({
    schema: 1,
    type: 'complete',
    rows: summaries.length,
    samples: summaries.reduce((total, row) => total + row.samples, 0),
    warmups: summaries.reduce((total, row) => total + row.warmups, 0),
    markerAccepted: summaries.every(row => row.markerAccepted),
  })}\n`);
  console.log(JSON.stringify({
    status: 'informational',
    rows: summaries.length,
    samples: summaries.reduce((total, row) => total + row.samples, 0),
    warmups: summaries.reduce((total, row) => total + row.warmups, 0),
    rawEvidence: relative(root, rawPath),
  }));
}

if (basename(process.argv[1] ?? '') === 'benchmark-compiler-controls.ts') {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
