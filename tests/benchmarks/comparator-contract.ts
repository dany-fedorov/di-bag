import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type ComparatorAdapter = {
  readonly name: string;
  readonly version: string;
  readonly sourceSha256: string;
  readonly semantics: 'restricted-common-subset';
  buildGraph(count: number): unknown;
  resolve(graph: unknown, name: string): unknown;
  dispose(graph: unknown): Promise<void>;
};

export type ComparatorAdmission = {
  readonly status: 'eligible';
  readonly name: string;
  readonly version: string;
  readonly sourceSha256: string;
  readonly semantics: 'restricted-common-subset';
} | {
  readonly status: 'not-comparable';
  readonly name?: string;
  readonly version?: string;
  readonly reason: string;
};

export type ComparatorEvidenceRow = {
  readonly schema: 1;
  readonly lane: 'comparator';
  readonly name: 'typed-inject' | 'awilix';
  readonly status: 'unavailable' | 'not-comparable' | 'eligible';
  readonly version?: string;
  readonly reason?: string;
  readonly sourceSha256?: string;
  readonly semantics?: 'restricted-common-subset';
};

type Probe = {
  readonly contract: 'di-bag-comparator-v1';
  readonly lifetime: 'singleton' | 'transient';
  readonly serial: number;
  disposed: boolean;
};

const exactVersion = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const hash = /^[a-f0-9]{64}$/;
const optionalPackages = ['typed-inject', 'awilix'] as const;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function promiseLike(value: unknown): value is PromiseLike<unknown> {
  return record(value) && typeof value.then === 'function';
}

function probe(value: unknown, lifetime: Probe['lifetime'], serial: number): value is Probe {
  return record(value)
    && value.contract === 'di-bag-comparator-v1'
    && value.lifetime === lifetime
    && value.serial === serial
    && value.disposed === false;
}

function rejection(adapter: unknown, reason: string): ComparatorAdmission {
  const value = record(adapter) ? adapter : {};
  return {
    status: 'not-comparable',
    ...(typeof value.name === 'string' && value.name !== '' ? { name: value.name } : {}),
    ...(typeof value.version === 'string' && value.version !== '' ? { version: value.version } : {}),
    reason,
  };
}

export async function validateComparator(adapter: ComparatorAdapter): Promise<ComparatorAdmission> {
  if (!record(adapter)) return rejection(adapter, 'adapter must be an object');
  if (typeof adapter.name !== 'string' || adapter.name.trim() === '') return rejection(adapter, 'invalid adapter name');
  if (typeof adapter.version !== 'string' || !exactVersion.test(adapter.version)) return rejection(adapter, 'adapter version is not exact');
  if (typeof adapter.sourceSha256 !== 'string' || !hash.test(adapter.sourceSha256)) return rejection(adapter, 'invalid adapter source hash');
  if (adapter.semantics !== 'restricted-common-subset') return rejection(adapter, 'unsupported comparator semantics');
  if (typeof adapter.buildGraph !== 'function') return rejection(adapter, 'buildGraph is absent');
  if (typeof adapter.resolve !== 'function') return rejection(adapter, 'resolve is absent');
  if (typeof adapter.dispose !== 'function') return rejection(adapter, 'dispose is absent');

  let graph: unknown;
  try {
    graph = adapter.buildGraph(3);
  } catch (error) {
    return rejection(adapter, `buildGraph failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (promiseLike(graph)) return rejection(adapter, 'buildGraph must be synchronous');

  let terminal: unknown;
  let singleton1: unknown;
  let singleton2: unknown;
  let transient1: unknown;
  let transient2: unknown;
  let semanticFailure: string | undefined;
  try {
    terminal = adapter.resolve(graph, 'service-2');
    singleton1 = adapter.resolve(graph, 'singleton');
    singleton2 = adapter.resolve(graph, 'singleton');
    transient1 = adapter.resolve(graph, 'transient');
    transient2 = adapter.resolve(graph, 'transient');
    if ([terminal, singleton1, singleton2, transient1, transient2].some(promiseLike)) {
      semanticFailure = 'resolve must be synchronous';
    } else if (!record(terminal)
      || terminal.contract !== 'di-bag-comparator-v1'
      || terminal.kind !== 'linear-terminal'
      || terminal.count !== 3
      || terminal.checksum !== 'service-0>service-1>service-2') {
      semanticFailure = 'linear named graph result mismatch';
    } else if (singleton1 !== singleton2) {
      semanticFailure = 'singleton identity mismatch';
    } else if (!probe(singleton1, 'singleton', 1)) {
      semanticFailure = 'singleton result mismatch';
    } else if (transient1 === transient2) {
      semanticFailure = 'transient identity mismatch';
    } else if (!probe(transient1, 'transient', 1) || !probe(transient2, 'transient', 2)) {
      semanticFailure = 'transient result mismatch';
    }
  } catch (error) {
    semanticFailure = `resolve failed: ${error instanceof Error ? error.message : String(error)}`;
  }

  let disposal: Promise<void>;
  try {
    disposal = adapter.dispose(graph);
  } catch (error) {
    return rejection(adapter, `dispose failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!(disposal instanceof Promise)) return rejection(adapter, 'dispose must return a Promise');
  try {
    await disposal;
  } catch (error) {
    return rejection(adapter, `dispose failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (semanticFailure !== undefined) return rejection(adapter, semanticFailure);
  if (![singleton1, transient1, transient2].every(value => record(value) && value.disposed === true)) {
    return rejection(adapter, 'explicit lifecycle did not dispose every resolved value');
  }
  return {
    status: 'eligible',
    name: adapter.name,
    version: adapter.version,
    sourceSha256: adapter.sourceSha256,
    semantics: adapter.semantics,
  };
}

type LockPackage = { readonly version?: unknown; readonly integrity?: unknown };

function installedPackage(root: string, packageName: string): { name?: string; version?: string } | undefined {
  try {
    const parsed = JSON.parse(readFileSync(join(root, 'node_modules', packageName, 'package.json'), 'utf8')) as unknown;
    return record(parsed) ? {
      ...(typeof parsed.name === 'string' ? { name: parsed.name } : {}),
      ...(typeof parsed.version === 'string' ? { version: parsed.version } : {}),
    } : undefined;
  } catch {
    return undefined;
  }
}

export async function inspectOptionalComparators(
  root: string,
  adapters: Partial<Record<(typeof optionalPackages)[number], ComparatorAdapter>> = {},
): Promise<readonly ComparatorEvidenceRow[]> {
  let packages: Record<string, LockPackage> = {};
  try {
    const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8')) as unknown;
    if (record(lock) && record(lock.packages)) packages = lock.packages as Record<string, LockPackage>;
  } catch {
    return optionalPackages.map(name => ({
      schema: 1, lane: 'comparator', name, status: 'unavailable', reason: 'lockfile-unavailable',
    }));
  }

  const rows: ComparatorEvidenceRow[] = [];
  for (const name of optionalPackages) {
    const locked = packages[`node_modules/${name}`];
    if (!record(locked) || typeof locked.version !== 'string' || !exactVersion.test(locked.version)
      || typeof locked.integrity !== 'string' || locked.integrity === '') {
      rows.push({ schema: 1, lane: 'comparator', name, status: 'unavailable', reason: 'not-lockfile-pinned' });
      continue;
    }
    const installed = installedPackage(root, name);
    if (installed?.version === undefined) {
      rows.push({ schema: 1, lane: 'comparator', name, version: locked.version, status: 'unavailable', reason: 'lockfile-pinned-but-not-installed' });
      continue;
    }
    if (installed.name !== name) {
      rows.push({ schema: 1, lane: 'comparator', name, version: locked.version, status: 'unavailable', reason: 'installed-package-name-mismatch' });
      continue;
    }
    if (installed.version !== locked.version) {
      rows.push({ schema: 1, lane: 'comparator', name, version: locked.version, status: 'unavailable', reason: 'installed-version-mismatch' });
      continue;
    }
    const adapter = adapters[name];
    if (adapter === undefined) {
      rows.push({ schema: 1, lane: 'comparator', name, version: locked.version, status: 'not-comparable', reason: 'adapter-not-reviewed' });
      continue;
    }
    if (adapter.name !== name || adapter.version !== locked.version) {
      rows.push({ schema: 1, lane: 'comparator', name, version: locked.version, status: 'not-comparable', reason: 'adapter-package-identity-mismatch' });
      continue;
    }
    const admission = await validateComparator(adapter);
    rows.push(admission.status === 'eligible'
      ? { schema: 1, lane: 'comparator', name, version: admission.version, status: 'eligible', sourceSha256: admission.sourceSha256, semantics: admission.semantics }
      : { schema: 1, lane: 'comparator', name, version: locked.version, status: 'not-comparable', reason: admission.reason });
  }
  return rows;
}
