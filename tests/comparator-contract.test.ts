import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  inspectOptionalComparators,
  validateComparator,
  type ComparatorAdapter,
} from './benchmarks/comparator-contract.ts';
import { parsePerformanceEvidenceArgs, performanceEvidenceMain } from '../scripts/performance-evidence.ts';

type Probe = {
  contract: 'di-bag-comparator-v1';
  lifetime: 'singleton' | 'transient';
  serial: number;
  disposed: boolean;
};

function validAdapter(overrides: Partial<ComparatorAdapter> = {}): ComparatorAdapter {
  return {
    name: 'fixture-container',
    version: '1.2.3',
    sourceSha256: 'a'.repeat(64),
    semantics: 'restricted-common-subset',
    buildGraph(count) {
      let transientSerial = 0;
      const singleton: Probe = {
        contract: 'di-bag-comparator-v1', lifetime: 'singleton', serial: 1, disposed: false,
      };
      const transients: Probe[] = [];
      return { count, singleton, transients, nextTransient: () => {
        const probe: Probe = {
          contract: 'di-bag-comparator-v1', lifetime: 'transient', serial: ++transientSerial, disposed: false,
        };
        transients.push(probe);
        return probe;
      } };
    },
    resolve(graph, name) {
      const state = graph as ReturnType<NonNullable<ComparatorAdapter['buildGraph']>> & {
        count: number; singleton: Probe; nextTransient(): Probe;
      };
      if (name === 'singleton') return state.singleton;
      if (name === 'transient') return state.nextTransient();
      if (name === `service-${state.count - 1}`) return {
        contract: 'di-bag-comparator-v1',
        kind: 'linear-terminal',
        count: state.count,
        checksum: Array.from({ length: state.count }, (_, index) => `service-${index}`).join('>'),
      };
      throw new Error(`unknown fixture service ${name}`);
    },
    async dispose(graph) {
      const state = graph as { singleton: Probe; transients: Probe[] };
      state.singleton.disposed = true;
      for (const probe of state.transients) probe.disposed = true;
    },
    ...overrides,
  };
}

test('admits only a synchronous named graph with singleton, transient and explicit lifecycle semantics', async () => {
  await expect(validateComparator(validAdapter())).resolves.toEqual({
    status: 'eligible',
    name: 'fixture-container',
    version: '1.2.3',
    sourceSha256: 'a'.repeat(64),
    semantics: 'restricted-common-subset',
  });
});

test('comparator cannot enter the table with incomplete or forged metadata', async () => {
  for (const adapter of [
    {},
    validAdapter({ name: '' }),
    validAdapter({ version: 'latest' }),
    validAdapter({ sourceSha256: 'source.ts' }),
    validAdapter({ semantics: 'all-di-features' as never }),
    validAdapter({ buildGraph: undefined as never }),
    validAdapter({ resolve: undefined as never }),
    validAdapter({ dispose: undefined as never }),
  ]) {
    await expect(validateComparator(adapter as ComparatorAdapter)).resolves.toMatchObject({ status: 'not-comparable' });
  }
});

test('rejects asynchronous construction or resolution from the synchronous common subset', async () => {
  await expect(validateComparator(validAdapter({ buildGraph: (() => Promise.resolve({})) as never }))).resolves.toMatchObject({ status: 'not-comparable', reason: 'buildGraph must be synchronous' });
  await expect(validateComparator(validAdapter({ resolve: (() => Promise.resolve({})) as never }))).resolves.toMatchObject({ status: 'not-comparable', reason: 'resolve must be synchronous' });
});

test('forbidden rejected async results are consumed before the child exits', () => {
  const moduleUrl = pathToFileURL(join(process.cwd(), 'tests', 'benchmarks', 'comparator-contract.ts')).href;
  const base = `
    import { validateComparator } from ${JSON.stringify(moduleUrl)};
    const singleton = { contract: 'di-bag-comparator-v1', lifetime: 'singleton', serial: 1, disposed: false };
    const graph = { singleton, transients: [] };
    const adapter = {
      name: 'fixture-container', version: '1.2.3', sourceSha256: '${'a'.repeat(64)}',
      semantics: 'restricted-common-subset', buildGraph() { return graph; },
      async dispose() { singleton.disposed = true; for (const value of graph.transients) value.disposed = true; },
    };
  `;
  const cases = [
    `${base} adapter.buildGraph = () => Promise.reject(new Error('async build failed'));
      adapter.resolve = () => singleton;
      console.log(JSON.stringify(await validateComparator(adapter)));`,
    `${base} adapter.resolve = () => Promise.reject(new Error('async resolve failed'));
      console.log(JSON.stringify(await validateComparator(adapter)));`,
    `${base} let calls = 0; adapter.resolve = () => {
        calls += 1;
        if (calls === 1) return Promise.reject(new Error('early async resolve failed'));
        throw new Error('later resolve failed');
      };
      console.log(JSON.stringify(await validateComparator(adapter)));`,
  ];
  for (const source of cases) {
    const child = spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--input-type=module', '--eval', source], {
      encoding: 'utf8', timeout: 10_000,
    });
    expect(child.status).toBe(0);
    expect(child.signal).toBeNull();
    expect(child.stderr).toBe('');
    expect(JSON.parse(child.stdout)).toMatchObject({ status: 'not-comparable' });
  }
});

test('rejects a changed named workload, singleton caching or transient freshness', async () => {
  await expect(validateComparator(validAdapter({ resolve: () => ({ wrong: true }) }))).resolves.toMatchObject({ status: 'not-comparable', reason: 'linear named graph result mismatch' });

  const shared: Probe = {
    contract: 'di-bag-comparator-v1', lifetime: 'singleton', serial: 1, disposed: false,
  };
  await expect(validateComparator(validAdapter({ resolve: (_graph, name) => name === 'transient' ? shared : shared }))).resolves.toMatchObject({ status: 'not-comparable' });

  const base = validAdapter();
  await expect(validateComparator(validAdapter({
    resolve(graph, name) {
      if (name === 'singleton') return base.resolve(graph, 'transient');
      return base.resolve(graph, name);
    },
  }))).resolves.toMatchObject({ status: 'not-comparable', reason: 'singleton identity mismatch' });
});

test('rejects missing, partial and failing explicit disposal', async () => {
  await expect(validateComparator(validAdapter({ dispose: async () => {} }))).resolves.toMatchObject({ status: 'not-comparable', reason: 'explicit lifecycle did not dispose every resolved value' });
  await expect(validateComparator(validAdapter({ dispose: (() => undefined) as never }))).resolves.toMatchObject({ status: 'not-comparable', reason: 'dispose must return a Promise' });
  await expect(validateComparator(validAdapter({ dispose: async () => { throw new Error('close failed'); } }))).resolves.toMatchObject({ status: 'not-comparable', reason: 'dispose failed: close failed' });
});

test('reports absent optional packages as unavailable without inventing adapter rows', async () => {
  const root = mkdtempSync(join(tmpdir(), 'di-bag-comparator-'));
  try {
    writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: { '': {} } }));
    await expect(inspectOptionalComparators(root)).resolves.toEqual([
      { schema: 1, lane: 'comparator', name: 'typed-inject', status: 'unavailable', reason: 'not-lockfile-pinned' },
      { schema: 1, lane: 'comparator', name: 'awilix', status: 'unavailable', reason: 'not-lockfile-pinned' },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('distinguishes unavailable installation from an unreviewed or semantically invalid adapter', async () => {
  const root = mkdtempSync(join(tmpdir(), 'di-bag-comparator-'));
  try {
    writeFileSync(join(root, 'package-lock.json'), JSON.stringify({
      lockfileVersion: 3,
      packages: { '': {}, 'node_modules/typed-inject': { version: '1.2.3', integrity: 'sha512-fixture' } },
    }));
    expect((await inspectOptionalComparators(root))[0]).toMatchObject({
      name: 'typed-inject', status: 'unavailable', reason: 'lockfile-pinned-but-not-installed', version: '1.2.3',
    });

    const installed = join(root, 'node_modules', 'typed-inject');
    mkdirSync(installed, { recursive: true });
    writeFileSync(join(installed, 'package.json'), JSON.stringify({ name: 'typed-inject', version: '1.2.3' }));
    expect((await inspectOptionalComparators(root))[0]).toMatchObject({
      name: 'typed-inject', status: 'not-comparable', reason: 'adapter-not-reviewed', version: '1.2.3',
    });
    expect((await inspectOptionalComparators(root, { 'typed-inject': validAdapter({ name: 'typed-inject' }) }))[0]).toMatchObject({ name: 'typed-inject', status: 'eligible', semantics: 'restricted-common-subset' });
    expect((await inspectOptionalComparators(root, {
      'typed-inject': validAdapter({ name: 'typed-inject', dispose: async () => {} }),
    }))[0]).toMatchObject({ name: 'typed-inject', status: 'not-comparable' });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects package and adapter identity drift before semantic admission', async () => {
  const root = mkdtempSync(join(tmpdir(), 'di-bag-comparator-'));
  try {
    const installed = join(root, 'node_modules', 'awilix');
    mkdirSync(installed, { recursive: true });
    writeFileSync(join(root, 'package-lock.json'), JSON.stringify({
      lockfileVersion: 3, packages: { '': {}, 'node_modules/awilix': { version: '9.0.0', integrity: 'sha512-fixture' } },
    }));
    writeFileSync(join(installed, 'package.json'), JSON.stringify({ name: 'awilix', version: '8.0.0' }));
    expect((await inspectOptionalComparators(root, { awilix: validAdapter({ name: 'awilix', version: '9.0.0' }) }))[1]).toMatchObject({ status: 'unavailable', reason: 'installed-version-mismatch' });
    writeFileSync(join(installed, 'package.json'), JSON.stringify({ name: 'awilix', version: '9.0.0' }));
    expect((await inspectOptionalComparators(root, { awilix: validAdapter({ name: 'wrong-name', version: '9.0.0' }) }))[1]).toMatchObject({ status: 'not-comparable', reason: 'adapter-package-identity-mismatch' });
    writeFileSync(join(installed, 'package.json'), JSON.stringify({ name: 'lookalike', version: '9.0.0' }));
    expect((await inspectOptionalComparators(root, { awilix: validAdapter({ name: 'awilix', version: '9.0.0' }) }))[1]).toMatchObject({ status: 'unavailable', reason: 'installed-package-name-mismatch' });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('comparator CLI mode emits only truthful optional status rows and creates no timing evidence', async () => {
  const root = mkdtempSync(join(tmpdir(), 'di-bag-comparator-cli-'));
  try {
    writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: { '': {} } }));
    expect(parsePerformanceEvidenceArgs(['--comparators'])).toEqual({ mode: 'comparators' });
    let output = '';
    const rows = await performanceEvidenceMain(['--comparators'], root, chunk => { output += chunk; });
    expect(rows).toEqual([
      { schema: 1, lane: 'comparator', name: 'typed-inject', status: 'unavailable', reason: 'not-lockfile-pinned' },
      { schema: 1, lane: 'comparator', name: 'awilix', status: 'unavailable', reason: 'not-lockfile-pinned' },
    ]);
    expect(output).toBe(
      '{"lane":"comparator","name":"typed-inject","reason":"not-lockfile-pinned","schema":1,"status":"unavailable"}\n'
      + '{"lane":"comparator","name":"awilix","reason":"not-lockfile-pinned","schema":1,"status":"unavailable"}\n',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
