import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import ts from 'typescript';
import {
  scaleBoundaryLine,
  scaleSource,
  tokenScaleBoundaryLine,
  tokenScaleSource,
} from '../tests/compiler.ts';
import type {
  ScaleCase,
  ScaleForm,
  TokenScaleCase,
  TokenScaleForm,
} from '../tests/compiler.ts';
import { evaluateWorker, type MatrixCase } from './benchmark-result.ts';
import { resolveNative } from './native-compiler.ts';
import { nativeScale } from './native-scale.ts';

export type CompilerLane = 'classic' | 'native';
export type CompilerCaseProvenance = {
  sourceCommit: string;
  sourceStatus: string;
  sourceSha256: string;
  generatedSha256: string;
};
export function parseCompilerCase(args: readonly string[]): { lane: CompilerLane; item: MatrixCase } {
  const [lane, countText, form, scenario] = args;
  const count = Number(countText);
  const token = form === 'bindings' || form === 'modules';
  const forms = ['bulk', 'chained', 'grouped', 'replacement', 'bindings', 'modules'];
  const scenarios = token
    ? ['valid', 'missing-final-token', 'mismatched-invariant-service']
    : ['valid', 'missing', 'wrong-shape'];
  if (args.length !== 4 || (lane !== 'classic' && lane !== 'native')
    || !['100', '500', '1000'].includes(countText ?? '')
    || !forms.includes(form ?? '') || !scenarios.includes(scenario ?? '')) {
    throw new Error('expected lane count form scenario from the original matrix');
  }
  return { lane, item: { count, form, scenario } as MatrixCase };
}

function generatedCase(item: MatrixCase) {
  const tokens = item.form === 'bindings' || item.form === 'modules';
  if (tokens) {
    const source = tokenScaleSource(
      item.count,
      item.form as TokenScaleForm,
      item.scenario as TokenScaleCase,
    );
    return {
      tokens,
      source,
      boundaryLine: tokenScaleBoundaryLine(source),
      path: 'tests/generated-token-scale.ts',
    };
  }
  const source = scaleSource(item.count, item.form as ScaleForm, item.scenario as ScaleCase);
  return {
    tokens,
    source,
    boundaryLine: scaleBoundaryLine(
      source,
      item.count,
      item.form as ScaleForm,
      item.scenario as ScaleCase,
    ),
    path: 'tests/generated-type-scale.ts',
  };
}

function sourceHash(root: string) {
  const sourceRoot = resolve(root, 'src');
  const sourceFiles = (folder: string): string[] => readdirSync(resolve(sourceRoot, folder), { withFileTypes: true })
    .flatMap(entry => entry.isDirectory()
      ? sourceFiles(join(folder, entry.name))
      : [join(folder, entry.name)]);
  const hash = createHash('sha256');
  for (const file of sourceFiles('').filter(file => file.endsWith('.ts')).sort()) {
    hash.update(file);
    hash.update(new Uint8Array(readFileSync(resolve(sourceRoot, file))));
  }
  return hash.digest('hex');
}

function captureProvenance(root: string, generatedSource: string): CompilerCaseProvenance {
  return {
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
    sourceStatus: execFileSync('git', ['status', '--porcelain', '--', 'src'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
    sourceSha256: sourceHash(root),
    generatedSha256: createHash('sha256').update(generatedSource).digest('hex'),
  };
}

async function dispatchCompilerCase(
  root: string,
  lane: CompilerLane,
  item: MatrixCase,
): Promise<Record<string, unknown>> {
  const generated = generatedCase(item);
  if (lane === 'native') {
    return nativeScale(root, await resolveNative(root), item);
  }
  const args = generated.tokens
    ? [resolve(root, 'scripts/check-token-scale.ts'), item.form, item.scenario, String(item.count)]
    : [resolve(root, 'scripts/benchmark-types.ts'), '--worker', String(item.count), item.form, item.scenario];
  const child = spawnSync(process.execPath, [
    '--max-old-space-size=3072', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', ...args,
  ], { cwd: root, encoding: 'utf8', timeout: 60_000, maxBuffer: 4_194_304 });
  return evaluateWorker(item, {
    status: child.status,
    signal: child.signal,
    stdout: child.stdout,
    stderr: child.stderr,
    ...(child.error ? { error: child.error.message } : {}),
  }, resolve(root, generated.path));
}

export function verifyCompilerCaseEvidence(
  lane: CompilerLane,
  row: Record<string, unknown>,
  expectedBoundaryLine: number | undefined,
  before: CompilerCaseProvenance,
  after: CompilerCaseProvenance,
  processMilliseconds: number,
): Record<string, unknown> {
  const boundaryMatches = row.boundaryLine === expectedBoundaryLine;
  const provenanceMatches = before.sourceCommit === after.sourceCommit
    && before.sourceStatus === after.sourceStatus
    && before.sourceSha256 === after.sourceSha256
    && before.generatedSha256 === after.generatedSha256;
  const compiledSnapshotMatchesStart = lane === 'classic'
    || row.sourceCommit === before.sourceCommit
      && row.sourceSha256 === before.sourceSha256
      && row.generatedSha256 === before.generatedSha256;
  const accepted = row.accepted === true && boundaryMatches && provenanceMatches && compiledSnapshotMatchesStart;
  const failureReason = !boundaryMatches
    ? 'worker boundary differs from the original generated source'
    : !provenanceMatches
      ? 'repository provenance changed while compiler case was running'
      : !compiledSnapshotMatchesStart
        ? 'compiled snapshot differs from starting repository provenance'
        : row.failureReason;
  return {
    ...row,
    lane,
    accepted,
    expectedBoundaryLine,
    sourceCommitBefore: before.sourceCommit,
    sourceCommitAfter: after.sourceCommit,
    sourceStatusBefore: before.sourceStatus,
    sourceStatusAfter: after.sourceStatus,
    sourceSha256Before: before.sourceSha256,
    sourceSha256After: after.sourceSha256,
    generatedSha256Before: before.generatedSha256,
    generatedSha256After: after.generatedSha256,
    sourceDirty: before.sourceStatus !== '',
    sourceStatus: before.sourceStatus,
    ...(lane === 'classic' ? {
      typescript: ts.version,
      node: process.version,
      sourceCommit: before.sourceCommit,
      sourceSha256: before.sourceSha256,
      generatedSha256: before.generatedSha256,
    } : {}),
    processMilliseconds,
    ...(failureReason === undefined ? {} : { failureReason }),
  };
}

export async function runCompilerCase(
  root: string,
  lane: CompilerLane,
  item: MatrixCase,
): Promise<Record<string, unknown>> {
  const selected = parseCompilerCase([
    String(lane), String(item.count), String(item.form), String(item.scenario),
  ]);
  const resolvedRoot = resolve(root);
  if (resolvedRoot !== process.cwd()) {
    throw new Error('compiler cases must run from the requested repository root');
  }

  const generatedBefore = generatedCase(selected.item);
  const before = captureProvenance(resolvedRoot, generatedBefore.source);
  const start = performance.now();
  const row = await dispatchCompilerCase(resolvedRoot, selected.lane, selected.item);
  const generatedAfter = generatedCase(selected.item);
  const after = captureProvenance(resolvedRoot, generatedAfter.source);
  return verifyCompilerCaseEvidence(
    selected.lane,
    row,
    generatedBefore.boundaryLine,
    before,
    after,
    Math.round(performance.now() - start),
  );
}

export function compilerCaseExitCode(row: Readonly<Record<string, unknown>>): 0 | 1 {
  return row.accepted === true ? 0 : 1;
}
