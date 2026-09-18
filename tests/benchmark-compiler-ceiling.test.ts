import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { bisectCeiling, classicProbe, classifyFailure, parseCeilingArguments, type ProbeResult } from '../scripts/benchmark-compiler-ceiling.ts';
import { controlScaleSource, describeDiagnostic, diagnostics, namedModuleScaleSource, scalePath } from './compiler';

const root = resolve(__dirname, '..');
const script = resolve(root, 'scripts/benchmark-compiler-ceiling.ts');
const failed = (kind: 'stack-overflow' | 'timeout'): ProbeResult => ({ accepted: false, kind });
const options = { from: 500, to: 1500, resolution: 25, repeats: 2 };

test('the control chain imports the library so the checker is warm, then registers count times', () => {
  const source = controlScaleSource(3);
  expect(source.startsWith("import { DiBag } from '../src';\nconst seed: unknown = DiBag;\n")).toBe(true);
  // The first call shares the `const bag = builder` line, so count dotted calls, not line starts.
  expect(source.match(/\.register\(/g)).toHaveLength(3);
  expect(source).toContain("bag.resolve('svc2')");
  expect(source).not.toContain('createBuilder');
  expect(() => controlScaleSource(0)).toThrow('control scale count must be at least one');
});

test('the control chain compiles clean', () => {
  expect(diagnostics(scalePath, controlScaleSource(5)).map(describeDiagnostic)).toEqual([]);
}, 60_000);

test('named modules hold 50 providers each and the fault sits in the last module', () => {
  const valid = namedModuleScaleSource(120);
  expect(valid.match(/^const feature\d+ = /gm)).toHaveLength(3);
  // Three installs into the host, plus the reuse check's `installModule(feature0)`.
  expect(valid.match(/\.installModule\(feature\d+\)/g)).toHaveLength(4);
  expect(valid).toContain('const reused = DiBag.createBuilder().installModule(feature0).build();');
  expect(valid).toContain("bag.resolve('svc60')");
  expect(valid).toContain("bag.resolve('svc119')");
  expect(valid).toContain("reused.resolve('svc49')");
  expect(namedModuleScaleSource(120, 'missing')).toContain('svc100: ({ missingFinal }: { missingFinal: number })');
  expect(namedModuleScaleSource(120, 'wrong-shape')).toContain('svc100: ({ svc99 }: { svc99: string })');
  expect(namedModuleScaleSource(1000, 'missing')).toContain('svc950: ({ missingFinal }');
  expect(() => namedModuleScaleSource(49)).toThrow('named module scale count must be at least 50');
  expect(() => namedModuleScaleSource(50, 'missing')).toThrow('negative named module scenarios need at least two modules');
});

test('the bisection brackets a deterministic threshold within the resolution', async () => {
  const counts: number[] = [];
  const search = await bisectCeiling(async count => { counts.push(count); return count <= 700 ? { accepted: true } : failed('stack-overflow'); }, options);
  expect(counts).toEqual([500, 500, 1500, 1000, 750, 625, 625, 687, 687, 718, 702]);
  expect(search).toMatchObject({ largestAccepted: 687, smallestFailed: 702, failureKind: 'stack-overflow', flaky: [], largestAcceptedSample: { accepted: true } });
  expect(search.samples.map(sample => sample.count)).toEqual([500, 1500, 1000, 750, 625, 687, 718, 702]);
});

test('a count that fails on a later repeat is conservative and reported as flaky', async () => {
  let seen = 0;
  const search = await bisectCeiling(async count => {
    if (count === 687 && ++seen === 2) return failed('stack-overflow');
    return count <= 700 ? { accepted: true } : failed('stack-overflow');
  }, options);
  expect(search).toMatchObject({ largestAccepted: 671, smallestFailed: 687, flaky: [687] });
});

test('endpoints end the search early and a point range probes once', async () => {
  const low = await bisectCeiling(async () => failed('timeout'), options);
  expect(low.largestAccepted).toBeUndefined();
  expect(low).toMatchObject({ smallestFailed: 500, failureKind: 'timeout' });
  expect(low.samples).toHaveLength(1);
  const high = await bisectCeiling(async () => ({ accepted: true }), options);
  expect(high.smallestFailed).toBeUndefined();
  expect(high.largestAccepted).toBe(1500);
  expect(high.samples.map(sample => sample.count)).toEqual([500, 1500]);
  const point = await bisectCeiling(async () => ({ accepted: true }), { ...options, from: 1000, to: 1000, repeats: 1 });
  expect(point.samples).toEqual([{ count: 1000, results: [{ accepted: true }] }]);
  for (const bad of [{ from: 0 }, { to: 400 }, { resolution: 0 }, { repeats: 1.5 }]) {
    await expect(bisectCeiling(async () => ({ accepted: true }), { ...options, ...bad })).rejects.toThrow('invalid ceiling search');
  }
});

test('failure kinds are classified from the child evidence', () => {
  const child = { status: 1 as number | null, signal: null as string | null, stderr: '', timedOut: false, terminationReason: undefined as string | undefined, diagnosticCount: undefined as number | undefined };
  expect(classifyFailure({ ...child, timedOut: true })).toBe('timeout');
  expect(classifyFailure({ ...child, terminationReason: 'timeout' })).toBe('timeout');
  expect(classifyFailure({ ...child, terminationReason: 'memory' })).toBe('memory');
  expect(classifyFailure({ ...child, terminationReason: 'output' })).toBe('output');
  expect(classifyFailure({ ...child, stderr: 'RangeError: Maximum call stack size exceeded\n    at checkExpression' })).toBe('stack-overflow');
  expect(classifyFailure({ ...child, stderr: 'FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory' })).toBe('heap');
  expect(classifyFailure({ ...child, status: 0, diagnosticCount: 2 })).toBe('diagnostics');
  expect(classifyFailure({ ...child, signal: 'SIGKILL' })).toBe('crash');
});

test('arguments select lane, forms and search bounds, and reject anything else', () => {
  expect(parseCeilingArguments([])).toEqual({ lane: 'classic', forms: ['chained', 'replacement', 'control', 'named-modules'], from: 500, to: 1500, resolution: 25, repeats: 3, stackKiB: 4000 });
  expect(parseCeilingArguments(['--native', '--form', 'control', '--from', '1000', '--to', '1000', '--repeats', '1'])).toMatchObject({ lane: 'native', forms: ['control'], from: 1000, to: 1000, repeats: 1 });
  for (const args of [['--form'], ['--form', 'bulk'], ['--form', 'chained', '--form', 'chained'], ['--from', '600', '--to', '500'], ['--repeats', '0'], ['--stack-size', 'big'], ['--unknown']]) {
    expect(() => parseCeilingArguments(args)).toThrow('invalid ceiling arguments');
  }
});

for (const [count, form] of [[20, 'chained'], [20, 'replacement'], [20, 'control'], [100, 'named-modules']] as const) {
  test(`ceiling worker compiles ${count} ${form} and reports its metrics`, () => {
    const child = spawnSync(process.execPath, ['--stack-size=1200', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', script, '--worker', String(count), form],
      { cwd: root, encoding: 'utf8', timeout: 60_000, maxBuffer: 1024 * 1024 });
    expect({ status: child.status, signal: child.signal, stderr: child.stderr }).toEqual({ status: 0, signal: null, stderr: '' });
    const row = JSON.parse(child.stdout);
    expect(row).toMatchObject({ count, form, typescript: '6.0.3', stackKiB: 1200, diagnosticCount: 0, codes: [] });
    expect(row.instantiations).toBeGreaterThan(0);
    expect(row.maxRssMiB).toBeGreaterThan(0);
  }, 65_000);
}

test('a classic probe returns an accepted outcome with metrics for a small chain', () => {
  const outcome = classicProbe(root, 20, 'chained');
  expect(outcome).toMatchObject({ lane: 'classic', form: 'chained', count: 20, accepted: true, diagnosticCount: 0, stderrHead: '' });
  expect(outcome.stackKiB).toBeUndefined();
  expect(outcome.instantiations).toBeGreaterThan(0);
}, 65_000);

test('ceiling worker and CLI reject malformed cases before compiling', () => {
  for (const args of [['--worker', '20'], ['--worker', 'x', 'chained'], ['--worker', '20', 'bulk'], ['--worker', '20', 'chained', 'extra']]) {
    const child = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', script, ...args], { cwd: root, encoding: 'utf8', timeout: 10_000 });
    expect(child.status).not.toBe(0); expect(child.stdout).toBe(''); expect(child.stderr).toContain('invalid ceiling case');
  }
  const cli = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', script, '--bogus'], { cwd: root, encoding: 'utf8', timeout: 10_000 });
  expect(cli.status).not.toBe(0); expect(cli.stdout).toBe(''); expect(cli.stderr).toContain('invalid ceiling arguments');
});
