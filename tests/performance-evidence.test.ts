import { expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  executePreparedRuntimeScenario,
  collectRuntimeSamples,
  validateCurrentRuntimeEvidenceRow,
  pairedBootstrapMedianRatio,
  parseRuntimeChild,
  runRuntimeChild,
  summarize,
  validateRuntimeSample,
  type RuntimeChildOutput,
  type RuntimeChildRequest,
} from '../scripts/performance-evidence.ts';
import { printRuntimeChild, runRuntimeChildProtocol } from '../scripts/runtime-benchmark-child.ts';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'di-bag-performance-test-'));
  const consumer = join(root, 'consumer');
  const packageRoot = join(consumer, 'node_modules', 'di-bag');
  mkdirSync(join(packageRoot, 'dist'), { recursive: true });
  writeFileSync(join(packageRoot, 'dist', 'index.js'), 'export {};\n');
  const request: RuntimeChildRequest = {
    lane: 'current',
    scenario: 'cold-linear-resolve',
    providers: 10,
    archiveIdentity: 'a'.repeat(64),
    implementationIdentity: 'current:0123456',
    orderSlot: 3,
    installedPackageRoot: realpathSync(packageRoot),
    expected: { checksum: 'cold-10', factories: 10, disposers: 0, cleanupLog: [] },
  };
  const output: RuntimeChildOutput = {
    lane: 'current',
    scenario: 'cold-linear-resolve',
    providers: 10,
    resolvedDiBag: join(packageRoot, 'dist', 'index.js'),
    elapsedNanoseconds: '101',
    checksum: 'cold-10',
    factories: 10,
    disposers: 0,
    cleanupLog: [],
  };
  return { root, request, output, packageRoot };
}

function withFixture(run: (value: ReturnType<typeof fixture>) => void): void {
  const value = fixture();
  try { run(value); } finally { rmSync(value.root, { recursive: true, force: true }); }
}

async function withAsyncFixture(run: (value: ReturnType<typeof fixture>) => Promise<void>): Promise<void> {
  const value = fixture();
  try { await run(value); } finally { rmSync(value.root, { recursive: true, force: true }); }
}

test('validates one canonical runtime sample and preserves its provenance', () => withFixture(({ request, output }) => {
  expect(validateRuntimeSample(request, output)).toEqual({
    archiveIdentity: 'a'.repeat(64),
    implementationIdentity: 'current:0123456',
    orderSlot: 3,
    ...output,
  });
}));

test('rejects a correct duration with an incorrect workload checksum', () => withFixture(({ request, output }) => {
  expect(() => validateRuntimeSample(request, { ...output, checksum: 'wrong' }))
    .toThrow('runtime checksum mismatch');
}));

test('rejects every semantic control mismatch', () => withFixture(({ request, output }) => {
  expect(() => validateRuntimeSample(request, { ...output, factories: 9 })).toThrow('runtime factory count mismatch');
  expect(() => validateRuntimeSample(request, { ...output, disposers: 1 })).toThrow('runtime disposer count mismatch');
  expect(() => validateRuntimeSample(request, { ...output, cleanupLog: ['unexpected'] })).toThrow('runtime cleanup log mismatch');
  expect(() => validateRuntimeSample(request, { ...output, lane: 'baseline' })).toThrow('runtime lane mismatch');
  expect(() => validateRuntimeSample(request, { ...output, providers: 100 })).toThrow('runtime provider count mismatch');
  expect(() => validateRuntimeSample(request, { ...output, scenario: 'build-close' })).toThrow('runtime scenario mismatch');
}));

test('rejects invalid request provenance rather than attaching it to a valid child result', () => withFixture(({ request, output }) => {
  expect(() => validateRuntimeSample({ ...request, archiveIdentity: 'dirty-tree' }, output)).toThrow('invalid runtime archive identity');
  expect(() => validateRuntimeSample({ ...request, implementationIdentity: '' }, output)).toThrow('invalid runtime implementation identity');
  expect(() => validateRuntimeSample({ ...request, implementationIdentity: '   ' }, output)).toThrow('invalid runtime implementation identity');
  expect(() => validateRuntimeSample({ ...request, implementationIdentity: 42 as never }, output)).toThrow('invalid runtime implementation identity');
  expect(() => validateRuntimeSample({ ...request, implementationIdentity: { source: 'current' } as never }, output)).toThrow('invalid runtime implementation identity');
  expect(() => validateRuntimeSample({ ...request, orderSlot: -1 }, output)).toThrow('invalid runtime order slot');
}));

test('rejects invalid duration arithmetic and malformed result fields', () => withFixture(({ request, output }) => {
  for (const elapsedNanoseconds of ['', '0', '-1', '+1', '1.0', '01', '9e2', '9007199254740992']) {
    expect(() => validateRuntimeSample(request, { ...output, elapsedNanoseconds })).toThrow('invalid runtime duration');
  }
  expect(() => validateRuntimeSample(request, { ...output, factories: -1 })).toThrow('invalid runtime factory count');
  expect(() => validateRuntimeSample(request, { ...output, disposers: 1.5 })).toThrow('invalid runtime disposer count');
  expect(() => validateRuntimeSample(request, { ...output, cleanupLog: ['ok', 1] as never })).toThrow('invalid runtime cleanup log');
}));

test('requires the resolved public entry to stay inside the real installed package', () => withFixture(({ root, request, output, packageRoot }) => {
  expect(() => validateRuntimeSample(request, { ...output, resolvedDiBag: packageRoot })).toThrow('outside installed di-bag');
  const lookalike = `${packageRoot}-lookalike`;
  mkdirSync(lookalike);
  writeFileSync(join(lookalike, 'index.js'), 'export {};\n');
  expect(() => validateRuntimeSample(request, { ...output, resolvedDiBag: join(lookalike, 'index.js') })).toThrow('outside installed di-bag');
  expect(() => validateRuntimeSample(request, { ...output, resolvedDiBag: join(root, 'missing.js') })).toThrow('cannot resolve runtime di-bag identity');
  const outside = join(root, 'outside');
  mkdirSync(outside);
  writeFileSync(join(outside, 'index.js'), 'export {};\n');
  const link = join(packageRoot, 'dist', 'escape');
  symlinkSync(outside, link);
  expect(() => validateRuntimeSample(request, { ...output, resolvedDiBag: join(link, 'index.js') })).toThrow('runtime di-bag identity is not canonical');
}));

test('rejects noncanonical package and entry paths even when they resolve inside the archive', () => withFixture(({ request, output, packageRoot }) => {
  expect(() => validateRuntimeSample(request, {
    ...output, resolvedDiBag: `${packageRoot}/dist/../dist/index.js`,
  })).toThrow('runtime di-bag identity is not canonical');
  expect(() => validateRuntimeSample({
    ...request, installedPackageRoot: `${packageRoot}/dist/..`,
  }, output)).toThrow('runtime package root is not canonical');
}));

test('parses only one canonical JSON object from a clean successful child', () => withFixture(({ request, output }) => {
  const canonical = `${JSON.stringify(output)}\n`;
  expect(parseRuntimeChild(request, { status: 0, signal: null, timedOut: false, stdout: canonical, stderr: '' }))
    .toMatchObject({ elapsedNanoseconds: '101', orderSlot: 3 });
  for (const stdout of [JSON.stringify(output), ` ${canonical}`, `${canonical}noise`, '{broken}\n', `${JSON.stringify([output])}\n`]) {
    expect(() => parseRuntimeChild(request, { status: 0, signal: null, timedOut: false, stdout, stderr: '' }))
      .toThrow('child stdout is not one canonical JSON object');
  }
}));

test('rejects child timeout, signal, status, stderr and unexpected schema keys', () => withFixture(({ request, output }) => {
  const clean = { status: 0, signal: null, timedOut: false, stdout: `${JSON.stringify(output)}\n`, stderr: '' };
  expect(() => parseRuntimeChild(request, { ...clean, timedOut: true })).toThrow('runtime child timed out');
  expect(() => parseRuntimeChild(request, { ...clean, signal: 'SIGKILL' })).toThrow('runtime child terminated by SIGKILL');
  expect(() => parseRuntimeChild(request, { ...clean, status: 2 })).toThrow('runtime child exited with status 2');
  expect(() => parseRuntimeChild(request, { ...clean, status: null })).toThrow('runtime child exited with status null');
  expect(() => parseRuntimeChild(request, { ...clean, stderr: 'warning\n' })).toThrow('runtime child stderr is not empty');
  expect(() => parseRuntimeChild(request, { ...clean, stdout: `${JSON.stringify({ ...output, extra: true })}\n` }))
    .toThrow('runtime child schema mismatch');
}));

test('runtime runner validates the execution returned for the exact request', async () => withAsyncFixture(async ({ request, output }) => {
  let received: RuntimeChildRequest | undefined;
  const sample = await runRuntimeChild(request, async actual => {
    received = actual;
    return { status: 0, signal: null, timedOut: false, stdout: `${JSON.stringify(output)}\n`, stderr: '' };
  });
  expect(received).toBe(request);
  expect(sample).toMatchObject({ checksum: 'cold-10', archiveIdentity: 'a'.repeat(64) });
  await expect(runRuntimeChild(request, async () => ({
    status: 0, signal: null, timedOut: true, stdout: '', stderr: '',
  }))).rejects.toThrow('runtime child timed out');
}));

test('computes summary from every raw nanosecond without mutating input', () => {
  const samples = [5n, 1n, 4n, 2n, 3n];
  expect(summarize(samples)).toEqual({
    samples: ['5', '1', '4', '2', '3'],
    count: 5,
    minNanoseconds: '1',
    p05Nanoseconds: '1',
    medianNanoseconds: '3',
    p95Nanoseconds: '5',
    meanNanoseconds: '3',
    standardDeviationNanoseconds: '1.4142135623730951',
    maxNanoseconds: '5',
  });
  expect(samples).toEqual([5n, 1n, 4n, 2n, 3n]);
  expect(summarize([1n, 2n, 4n, 8n]).medianNanoseconds).toBe('3');
  expect(summarize([1n, 2n]).meanNanoseconds).toBe('1.5');
});

test('summary rejects absent, nonpositive and unsafe samples instead of producing invalid arithmetic', () => {
  expect(() => summarize([])).toThrow('runtime samples must not be empty');
  expect(() => summarize([0n])).toThrow('runtime sample must be positive');
  expect(() => summarize([-1n])).toThrow('runtime sample must be positive');
  expect(() => summarize([BigInt(Number.MAX_SAFE_INTEGER) + 1n])).toThrow('runtime sample exceeds safe statistic range');
});

test('paired bootstrap is seeded, paired and sensitive to seed mutations', () => {
  const baseline = [100n, 120n, 95n, 150n, 80n, 130n, 105n];
  const current = [110n, 150n, 100n, 210n, 84n, 150n, 130n];
  const first = pairedBootstrapMedianRatio(current, baseline, 17, 10_000);
  expect(first).toEqual({
    seed: 17,
    samples: 10_000,
    medianRatio: 1.2380952380952381,
    medianRatioCi95: [1.0526315789473684, 1.25],
  });
  expect(pairedBootstrapMedianRatio(current, baseline, 17, 10_000)).toEqual(first);
  expect(pairedBootstrapMedianRatio(current, baseline, 18, 10_000)).not.toEqual(first);
  expect(first.medianRatioCi95[0]).toBeGreaterThan(1);
  expect(first.samples).toBe(10_000);
});

test('paired bootstrap rejects length, seed, count and denominator errors', () => {
  expect(() => pairedBootstrapMedianRatio([2n], [1n, 2n], 1)).toThrow('paired samples must have equal nonzero lengths');
  expect(() => pairedBootstrapMedianRatio([], [], 1)).toThrow('paired samples must have equal nonzero lengths');
  expect(() => pairedBootstrapMedianRatio([2n], [0n], 1)).toThrow('runtime sample must be positive');
  expect(() => pairedBootstrapMedianRatio([2n], [1n], -1)).toThrow('bootstrap seed must be an unsigned integer');
  expect(() => pairedBootstrapMedianRatio([2n], [1n], 1, 0)).toThrow('bootstrap resample count must be positive');
});

test('scenario execution awaits only runTimed between clock reads and verifies afterwards', async () => {
  const events: string[] = [];
  const clockValues = [100n, 145n];
  const result = await executePreparedRuntimeScenario(
    { marker: 'prepared' },
    async prepared => { events.push(`run:${prepared.marker}`); return { value: 7 }; },
    (prepared, timed) => {
      events.push(`verify:${prepared.marker}:${timed.value}`);
      return { checksum: 'ok', factories: 1, disposers: 0, cleanupLog: [] };
    },
    () => { events.push('clock'); return clockValues.shift()!; },
  );
  expect(events).toEqual(['clock', 'run:prepared', 'clock', 'verify:prepared:7']);
  expect(result).toEqual({ elapsedNanoseconds: '45', checksum: 'ok', factories: 1, disposers: 0, cleanupLog: [] });
});

test('scenario execution rejects a backwards or zero clock before accepting evidence', async () => {
  for (const clocks of [[2n, 2n], [2n, 1n]]) {
    let index = 0;
    await expect(executePreparedRuntimeScenario({}, async () => ({}), () => ({
      checksum: 'ok', factories: 0, disposers: 0, cleanupLog: [],
    }), () => clocks[index++]!)).rejects.toThrow('runtime duration must be positive');
  }
});

test('child protocol prepares before timing and emits request identity with verified work', async () => withAsyncFixture(async ({ request, output }) => {
  const events: string[] = [];
  const clocks = [20n, 53n];
  const actual = await runRuntimeChildProtocol(request, output.resolvedDiBag, {
    async prepareScenario(scenario, providers) {
      events.push(`prepare:${scenario}:${providers}`);
      return { prepared: true };
    },
    async runTimed(prepared) {
      events.push(`run:${prepared.prepared}`);
      return { complete: true };
    },
    verifyScenario(prepared, timed) {
      events.push(`verify:${prepared.prepared}:${timed.complete}`);
      return request.expected;
    },
  }, () => { events.push('clock'); return clocks.shift()!; });
  expect(events).toEqual([
    'prepare:cold-linear-resolve:10', 'clock', 'run:true', 'clock', 'verify:true:true',
  ]);
  expect(actual).toEqual({ ...output, elapsedNanoseconds: '33' });
}));

test('current-only collection runs five warmups then retains 31 validated samples serially', async () => withAsyncFixture(async ({ request, output }) => {
  const calls: number[] = [];
  let active = 0;
  const collected = await collectRuntimeSamples(request, async childRequest => {
    active += 1;
    expect(active).toBe(1);
    calls.push(childRequest.orderSlot);
    await Promise.resolve();
    const elapsedNanoseconds = String(100 + calls.length);
    active -= 1;
    return {
      status: 0,
      signal: null,
      timedOut: false,
      stdout: `${JSON.stringify({ ...output, elapsedNanoseconds })}\n`,
      stderr: '',
    };
  });
  expect(calls).toEqual(Array.from({ length: 36 }, (_, index) => index));
  expect(collected.warmups).toBe(5);
  expect(collected.samples).toHaveLength(31);
  expect(collected.samples.map(sample => sample.elapsedNanoseconds)).toEqual(
    Array.from({ length: 31 }, (_, index) => String(index + 106)),
  );
  expect(collected.summary).toMatchObject({ count: 31, minNanoseconds: '106', medianNanoseconds: '121', maxNanoseconds: '136' });
}));

test('collection journals every execution before validation so a late failure retains prior and rejected output', async () => withAsyncFixture(async ({ request, output }) => {
  const journal: unknown[] = [];
  let calls = 0;
  await expect(collectRuntimeSamples(request, async () => {
    calls += 1;
    return calls === 4
      ? { status: 1, signal: null, timedOut: false, stdout: 'rejected stdout', stderr: 'rejected stderr' }
      : { status: 0, signal: null, timedOut: false, stdout: `${JSON.stringify(output)}\n`, stderr: '' };
  }, 1, 5, record => { journal.push(record); })).rejects.toThrow('runtime child exited with status 1');
  expect(journal).toHaveLength(4);
  expect(journal[0]).toMatchObject({ phase: 'warmup', request: { orderSlot: 0 }, execution: { status: 0 } });
  expect(journal[3]).toMatchObject({
    phase: 'sample', request: { orderSlot: 3 },
    execution: { status: 1, stdout: 'rejected stdout', stderr: 'rejected stderr' },
  });
}));

test('current evidence validation requires reproducible environment, tools, fixture and source identities', () => {
  const row = {
    schema: 1, lane: 'current', status: 'informational', scenario: 'build-close', providers: 10,
    warmups: 5, samples: 31, archiveIdentity: 'a'.repeat(64), implementationIdentity: 'current:' + 'b'.repeat(40),
    resolvedDiBag: 'node_modules/di-bag/dist/index.js', rawEvidence: 'docs/benchmarks/results/current.jsonl',
    summary: summarize(Array.from({ length: 31 }, (_, index) => BigInt(index + 1))),
    provenance: {
      utc: '2026-09-08T00:00:00.000Z', git: { sha: 'b'.repeat(40), dirty: false },
      executionEnvironment: { operatingSystem: 'linux', operatingSystemRelease: '1', architecture: 'x64', node: 'v24.20.0' },
      tools: {
        node: { version: '24.20.0', sha256: 'c'.repeat(64), argv: ['/bin/node'] },
        npm: { version: '11.19.0', sha256: 'd'.repeat(64), argv: ['/bin/node', '/bin/npm'] },
        classic6: { version: '6.0.3', sha256: 'e'.repeat(64), argv: ['/bin/node', '/bin/tsc'] },
      },
      source: {
        lockfileSha256: 'f'.repeat(64), srcSha256: '1'.repeat(64),
        fixtureSha256: { child: '2'.repeat(64), protocol: '3'.repeat(64), scenarios: '4'.repeat(64) },
      },
      command: ['node', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/performance-evidence.ts', '--current'],
    },
  } as const;
  expect(validateCurrentRuntimeEvidenceRow(row)).toBe(row);
  expect(() => validateCurrentRuntimeEvidenceRow({ ...row, provenance: { ...row.provenance, source: undefined } }))
    .toThrow('runtime evidence provenance mismatch');
  expect(() => validateCurrentRuntimeEvidenceRow({ ...row, resolvedDiBag: '/tmp/consumer/node_modules/di-bag/dist/index.js' }))
    .toThrow('runtime evidence entry must be clone-safe');
});

test('actual child printer writes one canonical newline-terminated object accepted by the parent', async () => withAsyncFixture(async ({ request, output }) => {
  let stdout = '';
  const lifecycle = {
    async prepareScenario() { return {}; },
    async runTimed() { return {}; },
    verifyScenario() { return request.expected; },
  };
  const clocks = [100n, 201n];
  await printRuntimeChild(
    request, output.resolvedDiBag, lifecycle, () => clocks.shift()!, (chunk: string) => { stdout += chunk; },
  );
  expect(stdout).toBe(`${JSON.stringify({ ...output, elapsedNanoseconds: output.elapsedNanoseconds })}\n`);
  expect(parseRuntimeChild(request, {
    status: 0, signal: null, timedOut: false, stdout, stderr: '',
  })).toMatchObject({ checksum: 'cold-10', elapsedNanoseconds: '101' });
}));
