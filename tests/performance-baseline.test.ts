import { afterEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  buildBaselineArchive,
  collectPairedRuntimeSamples,
  comparePaired,
  parsePerformanceEvidenceArgs,
  pairedExecutionOrder,
  validateRuntimeComparisonEvidenceRow,
} from '../scripts/performance-evidence.ts';

const originalControlledRunner = process.env.DI_BAG_CONTROLLED_PERFORMANCE_RUNNER;

afterEach(() => {
  if (originalControlledRunner === undefined) delete process.env.DI_BAG_CONTROLLED_PERFORMANCE_RUNNER;
  else process.env.DI_BAG_CONTROLLED_PERFORMANCE_RUNNER = originalControlledRunner;
});

function samples(value: number): bigint[] {
  return Array.from({ length: 31 }, () => BigInt(value));
}

test('review requires median, p95 and paired interval regression predicates together', () => {
  process.env.DI_BAG_CONTROLLED_PERFORMANCE_RUNNER = '1';
  const baseline = samples(100);
  const regression = samples(125);
  expect(comparePaired(regression, baseline, 17)).toMatchObject({
    status: 'review', controlledRunner: true, confirmationRequired: true,
    predicates: { median: true, p95: true, confidenceInterval: true },
  });

  const missesMedian = [...samples(125)];
  for (let index = 0; index < 16; index += 1) missesMedian[index] = 114n;
  expect(comparePaired(missesMedian, baseline, 17)).toMatchObject({
    status: 'informational', predicates: { median: false, p95: true }, confirmationRequired: false,
  });

  const missesP95 = samples(115);
  expect(comparePaired(missesP95, baseline, 17)).toMatchObject({
    status: 'informational', predicates: { median: true, p95: false }, confirmationRequired: false,
  });

  const uncertain = Array.from({ length: 31 }, (_, index) => index < 16 ? 115n : 100n);
  expect(comparePaired(uncertain, baseline, 17)).toMatchObject({
    status: 'informational', predicates: { confidenceInterval: false }, confirmationRequired: false,
  });
});

test('ordinary hosts remain informational even when every review threshold is met', () => {
  delete process.env.DI_BAG_CONTROLLED_PERFORMANCE_RUNNER;
  expect(comparePaired(samples(130), samples(100), 29)).toMatchObject({
    status: 'informational', controlledRunner: false, confirmationRequired: false,
    predicates: { median: true, p95: true, confidenceInterval: true },
  });
});

test('paired verdict validates the exact 31-sample protocol and unsigned seed', () => {
  expect(() => comparePaired(samples(120).slice(1), samples(100), 17)).toThrow('paired comparison requires exactly 31 samples per implementation');
  expect(() => comparePaired(samples(120), samples(100), -1)).toThrow('bootstrap seed must be an unsigned integer');
  expect(() => comparePaired([...samples(120).slice(0, 30), 0n], samples(100), 17)).toThrow('runtime sample must be positive');
});

test('seeded execution order is reproducible, balanced and alternates pair orientation', () => {
  const first = pairedExecutionOrder(17, 31);
  expect(first).toHaveLength(62);
  expect(first.filter(lane => lane === 'current')).toHaveLength(31);
  expect(first.filter(lane => lane === 'baseline')).toHaveLength(31);
  for (let pair = 1; pair < 31; pair += 1) {
    expect(first[pair * 2]).not.toBe(first[(pair - 1) * 2]);
    expect(new Set(first.slice(pair * 2, pair * 2 + 2))).toEqual(new Set(['current', 'baseline']));
  }
  expect(pairedExecutionOrder(17, 31)).toEqual(first);
  expect(pairedExecutionOrder(29, 31)).not.toEqual(first);
  expect(() => pairedExecutionOrder(-1, 31)).toThrow('order seed must be an unsigned integer');
  expect(() => pairedExecutionOrder(17, 0)).toThrow('pair count must be positive');
});

test('paired collection runs serial warmups and retains samples in pair index order', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'di-bag-paired-test-'));
  try {
    const requests = Object.fromEntries(['current', 'baseline'].map(lane => {
      const installedPackageRoot = resolve(root, lane, 'node_modules/di-bag');
      mkdirSync(resolve(installedPackageRoot, 'dist'), { recursive: true });
      writeFileSync(resolve(installedPackageRoot, 'dist/index.js'), 'export {}\n');
      return [lane, {
        lane, scenario: 'build-close', providers: 10, archiveIdentity: lane === 'current' ? 'a'.repeat(64) : 'b'.repeat(64),
        implementationIdentity: `${lane}:identity`, orderSlot: 0, installedPackageRoot,
        expected: { checksum: 'build-10', factories: 0, disposers: 0, cleanupLog: [] },
      }];
    })) as any;
    const journal: any[] = [];
    const calls: string[] = [];
    let active = 0;
    const collected = await collectPairedRuntimeSamples(requests, async (lane, request) => {
      active += 1;
      expect(active).toBe(1);
      calls.push(`${lane}:${request.orderSlot}`);
      await Promise.resolve();
      active -= 1;
      return {
        status: 0, signal: null, timedOut: false, stderr: '',
        stdout: `${JSON.stringify({
          lane, scenario: 'build-close', providers: 10,
          resolvedDiBag: resolve(request.installedPackageRoot, 'dist/index.js'),
          elapsedNanoseconds: String((lane === 'current' ? 200 : 100) + request.orderSlot),
          checksum: 'build-10', factories: 0, disposers: 0, cleanupLog: [],
        })}\n`,
      };
    }, 17, 2, 3, record => { journal.push(record); });
    expect(calls).toHaveLength(10);
    expect(collected.current.map(sample => sample.orderSlot)).toEqual([0, 1, 2]);
    expect(collected.baseline.map(sample => sample.orderSlot)).toEqual([0, 1, 2]);
    expect(journal).toHaveLength(10);
    expect(journal.map(record => record.sequence)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(journal.slice(0, 4).every(record => record.phase === 'warmup')).toBe(true);
    expect(journal.slice(4).every(record => record.phase === 'sample')).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('paired collection journals a rejected execution before validation stops the run', async () => {
  const request = {
    lane: 'current', scenario: 'build-close', providers: 10, archiveIdentity: 'a'.repeat(64),
    implementationIdentity: 'current:id', orderSlot: 0, installedPackageRoot: '/missing',
    expected: { checksum: 'build-10', factories: 0, disposers: 0, cleanupLog: [] },
  } as const;
  const journal: any[] = [];
  await expect(collectPairedRuntimeSamples({ current: request, baseline: { ...request, lane: 'baseline' } }, async () => ({
    status: 7, signal: null, timedOut: false, stdout: 'bad', stderr: 'failure',
  }), 17, 0, 1, record => { journal.push(record); })).rejects.toThrow('runtime child exited with status 7');
  expect(journal).toHaveLength(1);
  expect(journal[0]).toMatchObject({ schema: 1, kind: 'runtime-comparison-child', sequence: 0, phase: 'sample' });
  expect(journal[0].execution).toEqual({ status: 7, signal: null, timedOut: false, stdout: 'bad', stderr: 'failure' });
});

test('comparison command accepts an exact pinned baseline and unsigned seed only', () => {
  expect(parsePerformanceEvidenceArgs(['--current'])).toEqual({ mode: 'current' });
  expect(parsePerformanceEvidenceArgs(['--current', '--baseline=739b509', '--seed=17']))
    .toEqual({ mode: 'comparison', baseline: '739b509', seed: 17 });
  expect(() => parsePerformanceEvidenceArgs(['--baseline=739b509', '--seed=17'])).toThrow('runtime evidence requires --current');
  expect(() => parsePerformanceEvidenceArgs(['--current', '--baseline=main', '--seed=17'])).toThrow('baseline must be a hexadecimal Git object name');
  expect(() => parsePerformanceEvidenceArgs(['--current', '--baseline=739b509'])).toThrow('comparison requires one --seed');
  expect(() => parsePerformanceEvidenceArgs(['--current', '--baseline=739b509', '--seed=-1'])).toThrow('comparison seed must be an unsigned integer');
  expect(() => parsePerformanceEvidenceArgs(['--current', '--baseline=739b509', '--seed=17', '--seed=29'])).toThrow('comparison requires one --seed');
});

test('comparison row validation rejects incomplete, unsafe and unpaired evidence', () => {
  const summary = {
    samples: Array.from({ length: 31 }, () => '100'), count: 31,
    minNanoseconds: '100', p05Nanoseconds: '100', medianNanoseconds: '100', p95Nanoseconds: '100',
    meanNanoseconds: '100', standardDeviationNanoseconds: '0', maxNanoseconds: '100',
  };
  const tool = { argv: ['/tool'], version: '1', sha256: 'a'.repeat(64) };
  const row: any = {
    schema: 1, lane: 'comparison', status: 'informational', scenario: 'build-close', providers: 10,
    warmups: 5, samples: 31, orderSeed: 17, rawEvidence: 'docs/benchmarks/results/run/raw.jsonl',
    current: { archiveIdentity: 'b'.repeat(64), implementationIdentity: `current:${'c'.repeat(40)}`,
      resolvedDiBag: 'node_modules/di-bag/dist/index.js', summary },
    baseline: { archiveIdentity: 'd'.repeat(64), implementationIdentity: `baseline:${'e'.repeat(40)}`,
      resolvedDiBag: 'node_modules/di-bag/dist/index.js', summary,
      provenance: { requestedRef: '739b509', commit: 'e'.repeat(40), tree: 'f'.repeat(40),
        sourceArchiveSha256: '1'.repeat(64), lockfileSha256: '2'.repeat(64),
        tools: { node: tool, npm: tool, classic6: tool, git: tool, tar: tool } } },
    verdict: { status: 'informational', controlledRunner: false, confirmationRequired: false,
      seed: 17, samples: 10000, medianRatio: 1, medianRatioCi95: [1, 1], p95Ratio: 1,
      predicates: { median: false, p95: false, confidenceInterval: false } },
    provenance: { utc: '2026-09-08T00:00:00.000Z', git: { sha: 'c'.repeat(40), dirty: false },
      executionEnvironment: { operatingSystem: 'linux', operatingSystemRelease: '1', architecture: 'x64', node: 'v24' },
      tools: { node: tool, npm: tool, classic6: tool },
      source: { lockfileSha256: '3'.repeat(64), srcSha256: '4'.repeat(64),
        fixtureSha256: { child: '5'.repeat(64), protocol: '6'.repeat(64), scenarios: '7'.repeat(64) } },
      command: ['/node', 'scripts/performance-evidence.ts', '--current', '--baseline=739b509', '--seed=17'] },
  };
  expect(validateRuntimeComparisonEvidenceRow(row)).toBe(row);
  expect(() => validateRuntimeComparisonEvidenceRow({ ...row, rawEvidence: '/tmp/raw.jsonl' })).toThrow('clone-safe');
  expect(() => validateRuntimeComparisonEvidenceRow({ ...row, samples: 30 })).toThrow('comparison evidence row mismatch');
  expect(() => validateRuntimeComparisonEvidenceRow({ ...row, verdict: { ...row.verdict, seed: 29 } })).toThrow('comparison verdict mismatch');
  expect(() => validateRuntimeComparisonEvidenceRow({ ...row, current: { ...row.current, summary: { ...summary, samples: summary.samples.slice(1) } } }))
    .toThrow('comparison summary mismatch');
});

test('baseline archive is built from the exact commit with retained source and tool identities', async () => {
  const archive = await buildBaselineArchive(resolve('.'), '739b509');
  try {
    expect(archive.baseline).toMatchObject({
      requestedRef: '739b509',
      commit: '739b509eb7942e4e26c972a711d003aaf8769997',
      tree: '9630be16dd0280575c6fc097ddaaf046e6280e24',
      lockfileSha256: 'a68e095582633c5b4d58b6fd01a26d982b9e932c4072db94473210dfc89fc4eb',
    });
    expect(archive.baseline.sourceArchiveSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(archive.baseline.tools).toMatchObject({
      node: { version: '24.20.0' }, npm: { version: '11.19.0' }, classic6: { version: '6.0.3' },
    });
    expect(archive.baseline.tools.git.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(archive.baseline.tools.tar.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(archive.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(archive.files).toContain('dist/index.js');
  } finally {
    rmSync(archive.packageTree, { recursive: true, force: true });
  }
}, 120_000);
