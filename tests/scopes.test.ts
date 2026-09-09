import { expect, test } from 'bun:test';
import { isPromise } from 'node:util/types';
import { DiBag, DiBagCleanupError } from '../src/node';
import { DiBag as Core } from '../src';
import { BindingGraph, Runtime } from '../src/runtime';
import type { BindingDescription } from '../src/runtime';
import { deferred } from './helpers';

function graph(bindings: BindingDescription[], slots: [string | symbol, symbol][]): BindingGraph {
  return new BindingGraph({
    bindings: new Map(bindings.map(binding => [binding.id, binding])),
    publicSlots: new Map(slots),
  });
}

test('children own fresh acquisitions while independent forks outlive their source', async () => {
  let next = 0;
  const disposed: number[] = [];
  const root = DiBag.begin().add({
    service: DiBag.withDisposal(() => ++next, value => { disposed.push(value); }),
  }).end();
  const child = root.scope();
  const sibling = root.scope();
  const fork = child.fork();
  expect(next).toBe(0);
  expect(root.resolve('service')).toBe(1);
  expect(child.resolve('service')).toBe(2);
  expect(child.resolve('service')).toBe(2);
  expect(sibling.resolve('service')).toBe(3);
  expect(fork.resolve('service')).toBe(4);
  await root.close();
  expect([...disposed].sort()).toEqual([1, 2, 3]);
  expect(disposed.at(-1)).toBe(1);
  expect(() => child.resolve('service')).toThrow('closed');
  expect(fork.resolve('service')).toBe(4);
  await fork.close();
  expect(disposed).toHaveLength(4);
});

test('parent close synchronously closes every descendant admission gate and waits for descendants', async () => {
  const releaseGrandchild = deferred<void>();
  const started = new Map<number, ReturnType<typeof deferred<void>>>();
  const disposed: number[] = [];
  let next = 0;
  const root = DiBag.begin().add({
    resource: DiBag.withDisposal(() => ++next, async value => {
      started.get(value)?.resolve();
      if (value === 3) await releaseGrandchild.promise;
      disposed.push(value);
    }),
  }).end();
  for (let id = 1; id <= 4; id++) started.set(id, deferred<void>());
  const child = root.scope();
  const grandchild = child.scope();
  const sibling = root.scope();
  root.resolve('resource');
  child.resolve('resource');
  grandchild.resolve('resource');
  sibling.resolve('resource');

  const closing = root.close();
  expect(root.close()).toBe(closing);
  for (const bag of [root, child, grandchild, sibling]) {
    expect(() => bag.resolve('resource')).toThrow(/clos/);
    expect(() => bag.fork()).toThrow(/clos/);
    expect(() => bag.scope()).toThrow(/clos/);
  }
  await Promise.all([started.get(3)!.promise, started.get(4)!.promise]);
  expect(disposed).toContain(4);
  expect(disposed).not.toContain(1);
  expect(disposed).not.toContain(2);
  releaseGrandchild.resolve();
  await closing;
  expect(disposed.indexOf(3)).toBeLessThan(disposed.indexOf(2));
  expect(disposed.at(-1)).toBe(1);
});

test('pending child sources may acquire dependencies after parent close starts', async () => {
  const gate = deferred<void>();
  const disposed: string[] = [];
  const root = DiBag.begin().add({
    base: DiBag.withDisposal(() => 21, () => { disposed.push('base'); }),
    result: DiBag.withDisposal(async (deps: { base: number }) => {
      await gate.promise;
      return deps.base * 2;
    }, () => { disposed.push('result'); }),
  }).end();
  const child = root.scope();
  const result = child.resolve('result');
  const closing = root.close();
  gate.resolve();
  expect(await result).toBe(42);
  await closing;
  expect(disposed).toEqual(['result', 'base']);
});

test('pending acquisition promises deduplicate only within one scope', async () => {
  const gates = [deferred<number>(), deferred<number>()];
  let next = 0;
  const root = DiBag.begin().add({ value: () => gates[next++]!.promise }).end();
  const child = root.scope();
  const rootValue = root.resolve('value');
  const childValue = child.resolve('value');
  expect(root.resolve('value')).toBe(rootValue);
  expect(child.resolve('value')).toBe(childValue);
  expect(childValue).not.toBe(rootValue);
  gates[0]!.resolve(1);
  gates[1]!.resolve(2);
  expect(await rootValue).toBe(1);
  expect(await childValue).toBe(2);
  await root.close();
});

test('nested cleanup failures flatten by registration order despite reversed completion', async () => {
  const delayed = deferred<void>();
  const childError = new Error('child');
  const siblingError = new Error('sibling');
  const rootError = new Error('root');
  let next = 0;
  const root = DiBag.begin().add({
    resource: DiBag.withDisposal(() => ++next, async value => {
      if (value === 3) { await delayed.promise; throw undefined; }
      if (value === 2) throw childError;
      if (value === 4) throw siblingError;
      throw rootError;
    }),
  }).end();
  const child = root.scope();
  const grandchild = child.scope();
  const sibling = root.scope();
  const bags = [root, child, grandchild, sibling] as const;
  for (const bag of bags) bag.resolve('resource');
  const snapshots = bags.map(bag => bag.inspect('resource'));
  const closing = root.close();
  await Promise.resolve();
  await Promise.resolve();
  delayed.resolve();
  const error: unknown = await closing.catch(error => error);
  expect(error).toBeInstanceOf(DiBagCleanupError);
  if (!(error instanceof DiBagCleanupError)) throw new Error('missing cleanup aggregate');
  expect(error.errors).toEqual([undefined, childError, siblingError, rootError]);
  expect(error.failures.map(failure => ({
    acquisitionId: failure.acquisitionId,
    bindingId: failure.bindingId,
    label: failure.label,
  }))).toEqual([snapshots[2], snapshots[1], snapshots[3], snapshots[0]].map(snapshot => ({
    acquisitionId: snapshot!.acquisitions[0]!.acquisitionId,
    bindingId: snapshot!.bindingId,
    label: 'resource',
  })));
  await expect(root.close()).rejects.toBe(error);
});

test('independently settled children detach on success and failure without replay', async () => {
  const id = Symbol('resource');
  const failure = new Error('cleanup');
  let next = 0;
  const parent = new Runtime(graph([{
    id,
    label: 'resource',
    registration: DiBag.withDisposal(() => ++next, value => { if (value === 2) throw failure; }),
    localNames: new Map(),
  }], [['resource', id]]), { isNativePromise: isPromise });
  const successful = parent.scope();
  const failing = parent.scope();
  successful.resolve('resource');
  failing.resolve('resource');
  expect(Reflect.get(parent, 'children')).toBeInstanceOf(Set);
  expect(Reflect.get(parent, 'children').size).toBe(2);
  await successful.close();
  expect(Reflect.get(parent, 'children').size).toBe(1);
  expect(Reflect.get(successful, 'detach')).toBeUndefined();
  const childFailure = await failing.close().catch(error => error);
  expect(childFailure).toBeInstanceOf(DiBagCleanupError);
  expect(Reflect.get(parent, 'children').size).toBe(0);
  expect(Reflect.get(failing, 'detach')).toBeUndefined();
  expect(parent.resolve('resource')).toBe(3);
  const sibling = parent.scope();
  expect(sibling.resolve('resource')).toBe(4);
  await parent.close();
});

test('parent close includes a child already closing until its failure settles', async () => {
  const gate = deferred<void>();
  const failure = new Error('closing child');
  const root = DiBag.begin().add({
    resource: DiBag.withDisposal(() => 1, async () => { await gate.promise; throw failure; }),
  }).end();
  const child = root.scope();
  child.resolve('resource');
  const childClosing = child.close();
  const parentClosing = root.close();
  gate.resolve();
  const [childError, parentError] = await Promise.all([
    childClosing.catch(error => error),
    parentClosing.catch(error => error),
  ]);
  expect(childError).toBeInstanceOf(DiBagCleanupError);
  expect(parentError).toBeInstanceOf(DiBagCleanupError);
  if (!(parentError instanceof DiBagCleanupError)) throw new Error('missing parent aggregate');
  expect(parentError.errors).toEqual([failure]);
});

test('unexpected child close rejection is retained after parent cleanup', async () => {
  const failure = new Error('internal child close');
  const disposed: string[] = [];
  const id = Symbol('resource');
  const parent = new Runtime(graph([{
    id,
    label: 'resource',
    registration: DiBag.withDisposal(() => 'parent', value => { disposed.push(value); }),
    localNames: new Map(),
  }], [['resource', id]]), { isNativePromise: isPromise });
  const child = parent.scope();
  Reflect.set(child, 'close', () => Promise.reject(failure));
  parent.resolve('resource');
  const error: unknown = await parent.close().catch(error => error);
  expect(disposed).toEqual(['parent']);
  expect(error).toBeInstanceOf(AggregateError);
  if (!(error instanceof AggregateError)) throw new Error('missing unexpected aggregate');
  expect(error.errors).toEqual([failure]);
});

test('scope preserves native shadowed-then and raw Promise ownership in configured core', async () => {
  const nativeGate = deferred<{ id: 'native' }>();
  Object.defineProperty(nativeGate.promise, 'then', { value: undefined });
  const raw = new Promise<{ id: 'raw' }>(() => {});
  const disposed: unknown[] = [];
  const configured = Core.configure({ isNativePromise: isPromise });
  const root = configured.begin().add({
    native: configured.withDisposal(configured.factory(() => nativeGate.promise, { acquisition: 'native' }), value => { disposed.push(value); }),
    raw: configured.withDisposal(configured.factory(() => raw, { acquisition: 'raw' }), value => { disposed.push(value); }),
  }).end();
  const child = root.scope();
  expect(child.resolve('native')).toBe(nativeGate.promise);
  expect(child.resolve('raw')).toBe(raw);
  const closing = root.close();
  await Promise.resolve();
  expect(disposed).toEqual([]);
  nativeGate.resolve({ id: 'native' });
  await closing;
  expect(disposed).toEqual([{ id: 'native' }, raw]);
});

test('child projection rollback finishes before a parent-owned finalizer', async () => {
  const rollback = deferred<void>();
  const started = deferred<void>();
  const events: string[] = [];
  const source = DiBag.withDisposal(() => 'source', async () => {
    started.resolve();
    await rollback.promise;
    events.push('rollback');
  });
  const root = DiBag.begin().add({
    parent: DiBag.withDisposal(() => 'parent', () => { events.push('parent'); }),
    projected: DiBag.mapSync(source, () => { throw new Error('projection'); }),
  }).end();
  root.resolve('parent');
  const child = root.scope();
  expect(() => child.resolve('projected')).toThrow('projection');
  await started.promise;
  const closing = root.close();
  await Promise.resolve();
  expect(events).toEqual([]);
  rollback.resolve();
  await closing;
  expect(events).toEqual(['rollback', 'parent']);
});

test('scopes retain module-private identities and unchanged public binding metadata', async () => {
  let next = 0;
  const feature = DiBag.module().add({
    hidden: () => ({ id: ++next }),
    publicValue: DiBag.withMetadata(({ hidden, external }: { hidden: { id: number }; external: number }) =>
      ({ hidden, external }), { owner: 'module' as const }),
  }).exports(['publicValue']).rename('publicValue', 'service');
  const root = DiBag.begin().install(feature).add({ external: () => 7 }).end();
  const child = root.scope();
  expect(root.inspect('service').bindingId).toBe(child.inspect('service').bindingId);
  expect(child.inspect('service').metadata.owner).toBe('module');
  expect(root.inspect('service').acquisitions).toEqual([]);
  expect(child.inspect('service').acquisitions).toEqual([]);
  expect(child.resolve('service')).toEqual({ hidden: { id: 1 }, external: 7 });
  expect(root.resolve('service')).toEqual({ hidden: { id: 2 }, external: 7 });
  expect(root.resolve('service').hidden).not.toBe(child.resolve('service').hidden);
  await root.close();
});

test('unchecked scope arguments reject before creating or acquiring a child', async () => {
  let created = 0;
  const root = DiBag.begin().add({ value: () => ++created }).end();
  const originalScope = Runtime.prototype.scope;
  let runtimeScopes = 0;
  Runtime.prototype.scope = function () { runtimeScopes++; return originalScope.call(this); };
  try {
    for (const args of [[undefined], [{ share: ['missing'] }], [{ value: () => 2 }]]) {
      expect(() => Reflect.apply(root.scope, root, args)).toThrow('scope');
    }
    expect(runtimeScopes).toBe(0);
    expect(created).toBe(0);
    const child = root.scope();
    expect(runtimeScopes).toBe(1);
    expect(child.resolve('value')).toBe(1);
    await root.close();
  } finally {
    Runtime.prototype.scope = originalScope;
  }
});
