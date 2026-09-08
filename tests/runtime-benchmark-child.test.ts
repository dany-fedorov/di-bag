import { expect, test } from 'bun:test';
import { DiBag } from '../src/index.ts';
import { DiBag as NodeDiBag } from '../src/node.ts';
import { parseRuntimeChildRequestArgument } from '../scripts/runtime-benchmark-child.ts';
import {
  expectedScenarioResult,
  prepareScenario,
  runTimed,
  verifyScenario,
} from './benchmarks/runtime-scenarios.ts';

for (const providers of [10, 100] as const) {
  test(`build-close constructs ${providers} registrations without acquiring them`, async () => {
    const prepared = await prepareScenario('build-close', providers, DiBag);
    const timed = await runTimed(prepared);
    expect(verifyScenario(prepared, timed)).toEqual({ checksum: `build-${providers}`, factories: 0, disposers: 0, cleanupLog: [] });
  });

  test(`cold-linear-resolve acquires each of ${providers} factories once`, async () => {
    const prepared = await prepareScenario('cold-linear-resolve', providers, DiBag);
    const timed = await runTimed(prepared);
    expect(verifyScenario(prepared, timed)).toEqual({ checksum: `cold-${providers}`, factories: providers, disposers: 0, cleanupLog: [] });
  });

  test(`warm-root-resolve excludes priming and observes one cached terminal value at ${providers}`, async () => {
    const prepared = await prepareScenario('warm-root-resolve', providers, DiBag);
    expect(prepared.factories).toBe(providers);
    expect(verifyScenario(prepared, await runTimed(prepared)))
      .toEqual({ checksum: `warm-${providers}`, factories: providers, disposers: 0, cleanupLog: [] });
    expect(prepared.factories).toBe(providers);
  });

  test(`scope-resolve-close verifies child work after its timed operation at ${providers}`, async () => {
    const prepared = await prepareScenario('scope-resolve-close', providers, DiBag);
    const timed = await runTimed(prepared);
    expect(verifyScenario(prepared, timed)).toEqual({
      checksum: `scope-${providers}`,
      factories: providers + 3,
      disposers: 3,
      cleanupLog: ['transient-2', 'transient-1', 'scoped'],
    });
    expect(prepared.bag!.inspect(`provider${providers - 1}`).acquisitions).toHaveLength(1);
    expect(timed.rootValue).toBe(providers);
    expect(timed.scopedValue).toBe(prepared.scopedValue);
    expect(timed.values).toEqual(prepared.values);
    expect(() => verifyScenario(prepared, {
      ...timed, rootValue: undefined, scopedValue: undefined,
      values: Array.from({ length: 2 }, () => ({})),
    })).toThrow('scope resolution result mismatch');
  });

  test(`transient-resolve-close verifies ${providers} distinct owned values in reverse cleanup order`, async () => {
    const prepared = await prepareScenario('transient-resolve-close', providers, DiBag);
    const timed = await runTimed(prepared);
    const result = verifyScenario(prepared, timed);
    expect(result).toEqual({
      checksum: `transient-${providers}`, factories: providers, disposers: providers,
      cleanupLog: Array.from({ length: providers }, (_, index) => `transient-${providers - index}`),
    });
    expect(new Set(timed.values)).toHaveLength(providers);
    expect(timed.values).toEqual(prepared.values);
    expect(() => verifyScenario(prepared, {
      ...timed, values: Array.from({ length: providers }, () => ({})),
    })).toThrow('transient resolution identity mismatch');
  });

  test(`raw-promise-identity retains the exact raw Promise through resolution and disposal at ${providers}`, async () => {
    const prepared = await prepareScenario('raw-promise-identity', providers, DiBag);
    const timed = await runTimed(prepared);
    expect(timed.value).toBe(prepared.rawPromise);
    expect(verifyScenario(prepared, timed)).toEqual({
      checksum: `raw-promise-${providers}`, factories: 1, disposers: 1, cleanupLog: ['raw-promise'],
    });
    expect(prepared.disposedValue).toBe(prepared.rawPromise);
  });

  test(`node-native-promise awaits the native Promise and disposes its fulfillment at ${providers}`, async () => {
    const prepared = await prepareScenario('node-native-promise', providers, NodeDiBag);
    const timed = await runTimed(prepared);
    expect(timed.value).toBe(prepared.nativePromise);
    expect(verifyScenario(prepared, timed)).toEqual({
      checksum: `node-native-${providers}`, factories: 1, disposers: 1, cleanupLog: ['node-native'],
    });
    expect(prepared.disposedValue).toBe(prepared.nativeValue);
  });
}

test('scenario preparation rejects unsupported provider counts', async () => {
  await expect(prepareScenario('cold-linear-resolve', 0, DiBag)).rejects.toThrow('runtime providers must be 10 or 100');
  await expect(prepareScenario('cold-linear-resolve', 11, DiBag)).rejects.toThrow('runtime providers must be 10 or 100');
});

test('parent expectations cover the complete fixed scenario matrix', () => {
  expect([
    expectedScenarioResult('build-close', 10),
    expectedScenarioResult('cold-linear-resolve', 10),
    expectedScenarioResult('warm-root-resolve', 10),
    expectedScenarioResult('scope-resolve-close', 10),
    expectedScenarioResult('transient-resolve-close', 10),
    expectedScenarioResult('raw-promise-identity', 10),
    expectedScenarioResult('node-native-promise', 10),
  ]).toEqual([
    { checksum: 'build-10', factories: 0, disposers: 0, cleanupLog: [] },
    { checksum: 'cold-10', factories: 10, disposers: 0, cleanupLog: [] },
    { checksum: 'warm-10', factories: 10, disposers: 0, cleanupLog: [] },
    { checksum: 'scope-10', factories: 13, disposers: 3, cleanupLog: ['transient-2', 'transient-1', 'scoped'] },
    { checksum: 'transient-10', factories: 10, disposers: 10, cleanupLog: Array.from({ length: 10 }, (_, index) => `transient-${10 - index}`) },
    { checksum: 'raw-promise-10', factories: 1, disposers: 1, cleanupLog: ['raw-promise'] },
    { checksum: 'node-native-10', factories: 1, disposers: 1, cleanupLog: ['node-native'] },
  ]);
});

test('verification rejects a timed result from another preparation', async () => {
  const left = await prepareScenario('cold-linear-resolve', 10, DiBag);
  const right = await prepareScenario('cold-linear-resolve', 10, DiBag);
  await runTimed(left);
  const result = await runTimed(right);
  expect(() => verifyScenario(left, result)).toThrow('timed result does not belong to prepared scenario');
});

test('child argument parser accepts one exact request and rejects malformed or extra input', () => {
  const request = {
    lane: 'current', scenario: 'build-close', providers: 10,
    archiveIdentity: 'a'.repeat(64), implementationIdentity: 'current:0123456', orderSlot: 0,
    installedPackageRoot: '/tmp/consumer/node_modules/di-bag',
    expected: { checksum: 'build-10', factories: 0, disposers: 0, cleanupLog: [] },
  } as const;
  expect(parseRuntimeChildRequestArgument([JSON.stringify(request)])).toEqual(request);
  expect(() => parseRuntimeChildRequestArgument([])).toThrow('runtime child requires one request argument');
  expect(() => parseRuntimeChildRequestArgument([JSON.stringify(request), 'extra'])).toThrow('runtime child requires one request argument');
  expect(() => parseRuntimeChildRequestArgument(['not-json'])).toThrow('runtime child request is not valid JSON');
});
