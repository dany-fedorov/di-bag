import { expect, test } from 'bun:test';
import { DiBag } from '../src';

test('contributions preserve order, empty reads and array immutability', async () => {
  const key = Symbol('number');
  const numbers = DiBag.createToken(key).forCollectionOf<number>();
  const empty = DiBag.createBuilder().buildContainer();
  expect(empty.resolveCollection(numbers)).toEqual([]);
  const bag = DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: () => 1 }).withCollectionContribution({ collectionToken: numbers, provider: () => 2 }).buildContainer();
  const first = bag.resolveCollection(numbers);
  expect(first).toEqual([1, 2]);
  expect(Object.isFrozen(first)).toBe(true);
  expect(bag.resolveCollection(numbers)).not.toBe(first);
  await bag.close();
  await empty.close();
});

// These controls catch accidental singular/group merging and deduplication.
test('host and repeated exportless modules append distinct lexical bindings', async () => {
  const itemKey = Symbol('items'); const items = DiBag.createToken(itemKey).forCollectionOf<{ id: number; label: string }>();
  const singularItemKey = Symbol('singular item'); const singularItem = DiBag.createToken(singularItemKey).forService<{ id: number; label: string }>();
  let ids = 0; const disposed: number[] = [];
  const sharedHandle = DiBag.providerWithDisposal({ provider: ({ helper }: { helper: number }) => ({ id: helper, label: 'module' }), disposeService: value => { disposed.push(value.id); } });
  const feature = DiBag.createBuilder().withServices({ helper: () => ++ids }).withCollectionContribution({ collectionToken: items, provider: sharedHandle }).withCollectionContribution({ collectionToken: items, provider: sharedHandle }).buildModule({ exportedServiceKeys: [] });
  const base = DiBag.createBuilder().withCollectionContribution({ collectionToken: items, provider: () => ({ id: 0, label: 'host' }) });
  const bag = base.withInstalledModules([feature]).withInstalledModules([feature]).withTokenService(singularItem, () => ({ id: 99, label: 'singular' })).buildContainer();
  expect(bag.resolveCollection(items).map(value => value.id)).toEqual([0, 1, 1, 2, 2]);
  expect(bag.resolve(singularItem).id).toBe(99);
  const baseBag = base.buildContainer();
  expect(baseBag.resolveCollection(items)).toEqual([{ id: 0, label: 'host' }]);
  await baseBag.close();
  expect(new Set(bag.serviceSnapshot(items).map(value => value.bindingId)).size).toBe(5);
  await bag.close();
  expect(disposed.sort()).toEqual([1, 1, 2, 2]);
});

test('all adapters select frozen arrays and retain module export renames', async () => {
  const key = Symbol('numbers'); const numbers = DiBag.createToken(key).forCollectionOf<number>();
  class Total { constructor(readonly values: readonly number[]) {} }
  const feature = DiBag.createBuilder().withServices({ helper: () => 7 }).withCollectionContribution({ collectionToken: numbers, provider: ({ helper }: { helper: number }) => helper }).buildModule({ exportedServiceKeys: ['helper'] }).withRenamedExport({ currentExportKey: 'helper', newExportKey: 'renamed' });
  const ref = numbers;
  const bag = DiBag.createBuilder().withInstalledModules([feature]).withServices({
    tokens: DiBag.createProviderFromFunction({ dependencies: [ref], factoryFunction: values => values }),
    fn: DiBag.createProviderFromFunction({ dependencies: [ref], factoryFunction: values => values.reduce((a, b) => a + b, 0) }),
    cls: DiBag.createProviderFromClass({ dependencies: [ref], serviceClass: Total }),
  }).buildContainer();
  expect(Object.isFrozen(ref)).toBe(true);
  expect(bag.resolve('tokens')).toEqual([7]);
  expect(Object.isFrozen(bag.resolve('tokens'))).toBe(true);
  expect(bag.resolve('fn')).toBe(7);
  expect(bag.resolve('cls')).toBeInstanceOf(Total);
  expect(bag.resolve('cls').values).toEqual([7]);
  const fork = bag.createIndependentContainer(['renamed'], { renamed: () => 9 });
  expect(fork.resolveCollection(numbers)).toEqual([9]);
  await fork.close(); await bag.close();
});

test('root scoped and transient contributions retain individual ownership', async () => {
  const key = Symbol('objects'); const objects = DiBag.createToken(key).forCollectionOf<{ id: number }>();
  let ids = 0; const disposed: number[] = [];
  const create = DiBag.providerWithDisposal({ provider: () => ({ id: ++ids }), disposeService: value => { disposed.push(value.id); } });
  const bag = DiBag.createBuilder().withCollectionContribution({ collectionToken: objects, provider: DiBag.providerWithLifetime({ provider: create, lifetime: 'singleton:one-per-container-tree' }) }).withCollectionContribution({ collectionToken: objects, provider: create }).withCollectionContribution({ collectionToken: objects, provider: DiBag.providerWithLifetime({ provider: create, lifetime: 'transient:one-per-resolve' }) }).buildContainer();
  const first = bag.resolveCollection(objects); const again = bag.resolveCollection(objects);
  expect(first[0]).toBe(again[0]); expect(first[1]).toBe(again[1]); expect(first[2]).not.toBe(again[2]);
  const child = bag.createChildContainer(); const scoped = child.resolveCollection(objects);
  expect(scoped[0]).toBe(first[0]); expect(scoped[1]).not.toBe(first[1]);
  const fork = bag.createIndependentContainer(); expect(fork.resolveCollection(objects)[0]).not.toBe(first[0]);
  await child.close(); expect(disposed).not.toContain(first[0]!.id);
  await fork.close(); await bag.close();
  expect(disposed.length).toBe(ids); expect(new Set(disposed).size).toBe(ids);
});

test('shared aggregate borrows the parent graph while a lazy registry reads its local graph', async () => {
  const key = Symbol('numbers'); const numbers = DiBag.createToken(key).forCollectionOf<number>();
  const registryKey = Symbol('registry'); const registry = DiBag.createToken(registryKey).forService<readonly number[]>();
  const bag = DiBag.createBuilder().withServices({ helper: () => 1 }).withCollectionContribution({ collectionToken: numbers, provider: ({ helper }: { helper: number }) => helper }).withTokenService(registry, DiBag.createProviderFromFunction({ dependencies: [numbers], factoryFunction: values => values })).withServices({ lazy: DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(registry)], factoryFunction: get => get }) }).buildContainer();
  const child = bag.createChildContainer(['helper'], { helper: () => 2 }, { sharedParentServiceKeys: [registry] });
  expect(child.resolve(registry)).toBe(bag.resolve(registry));
  expect(child.resolveCollection(numbers)).toEqual([2]); expect(child.resolve('lazy')()).toEqual([1]);
  const fork = child.createIndependentContainer(); expect(fork.resolve('lazy')()).toEqual([2]);
  await child.close(); await fork.close(); await bag.close();
});

test('partial failure retains accepted ownership and retries only failed contributors', async () => {
  const key = Symbol('number'); const numbers = DiBag.createToken(key).forCollectionOf<number>();
  let first = 0; let second = 0; const disposed: number[] = []; const failure = new Error('second');
  const bag = DiBag.createBuilder().withCollectionContribution({ collectionToken: numbers, provider: DiBag.providerWithDisposal({ provider: () => ++first, disposeService: value => { disposed.push(value); } }) }).withCollectionContribution({ collectionToken: numbers, provider: () => { if (++second === 1) throw failure; return 2; } }).buildContainer();
  expect(() => bag.resolveCollection(numbers)).toThrow(failure); expect(disposed).toEqual([]);
  expect(bag.resolveCollection(numbers)).toEqual([1, 2]); expect(first).toBe(1); expect(second).toBe(2);
  await bag.close(); await bag.close(); expect(disposed).toEqual([1]);
});

test('pending native and raw promises preserve identity and disposal payloads', async () => {
  const key = Symbol('promises'); const promises = DiBag.createToken(key).forCollectionOf<Promise<number>>();
  let release!: (value: number) => void; const pending = new Promise<number>(resolve => { release = resolve; });
  const seen: unknown[] = [];
  const native = DiBag.providerWithDisposal({ provider: DiBag.createProvider(() => pending, { factoryReturnKind: 'native-promise' }), disposeService: value => { seen.push(value); } });
  const raw = DiBag.providerWithDisposal({ provider: DiBag.createProvider(() => pending, { factoryReturnKind: 'uninspected' }), disposeService: value => { seen.push(value); } });
  const bag = DiBag.createBuilder().withCollectionContribution({ collectionToken: promises, provider: native }).withCollectionContribution({ collectionToken: promises, provider: raw }).buildContainer();
  const values = bag.resolveCollection(promises); expect(values[0]).toBe(pending); expect(values[1]).toBe(pending);
  const closing = bag.close(); let closed = false; void closing.then(() => { closed = true; });
  await Promise.resolve(); expect(closed).toBe(false); release(5); await closing;
  expect(seen).toContain(5); expect(seen).toContain(pending); expect(seen.length).toBe(2);
});

test('self collections participate in ordinary cycle detection', async () => {
  const key = Symbol('cycle'); const values = DiBag.createToken(key).forCollectionOf<number>();
  const bag = DiBag.createBuilder().withCollectionContribution({ collectionToken: values, provider: DiBag.createProviderFromFunction({ dependencies: [values], factoryFunction: items => items.length }) }).buildContainer();
  expect(() => bag.resolveCollection(values)).toThrow(/cycle/); await bag.close();
});

test('inspection is immutable nonresolving and does not freeze application values', async () => {
  const key = Symbol('items'); const items = DiBag.createToken(key).forCollectionOf<{ value: number }>();
  let calls = 0; const service = { value: 1 };
  const bag = DiBag.createBuilder().withCollectionContribution({ collectionToken: items, provider: DiBag.providerWithRegistrationMetadata({ provider: () => { calls++; return service; }, registrationMetadata: { label: 'a' } }) }).buildContainer();
  const before = bag.serviceSnapshot(items); expect(calls).toBe(0);
  expect(Object.isFrozen(before)).toBe(true); expect(Object.isFrozen(before[0])).toBe(true);
  expect(before[0]!.acquisitions).toEqual([]); expect(before[0]!.registrationMetadata).toEqual({ label: 'a' });
  bag.resolveCollection(items); const after = bag.serviceSnapshot(items);
  expect(after[0]!.acquisitions.length).toBe(1); expect(before[0]!.acquisitions).toEqual([]);
  service.value = 2; expect(bag.resolveCollection(items)[0]!.value).toBe(2); await bag.close();
});

test('forged tokens references and providers reject before provider effects', async () => {
  const key = Symbol('real'); const token = DiBag.createToken(key).forService<number>(); let effects = 0;
  const collectionKey = Symbol('collection'); const collection = DiBag.createToken(collectionKey).forCollectionOf<number>();
  for (const fake of [key, {}, Object.create(token), { ...token }, DiBag.optional(token), DiBag.lazy(token)]) {
    expect(() => (DiBag.createBuilder().withCollectionContribution as Function)({ collectionToken: fake, provider: () => { effects++; return 1; } })).toThrow();
    expect(() => (DiBag.optional as Function)(fake)).toThrow();
  }
  const provider = DiBag.createProviderFromFunction({ dependencies: [], factoryFunction: () => { effects++; return 1; } });
  expect(() => (DiBag.createBuilder().withCollectionContribution as Function)({ collectionToken: collection, provider: { ...provider } })).toThrow();
  expect(() => (DiBag.createBuilder().withCollectionContribution as Function)({ collectionToken: collection, provider: {} })).toThrow();
  const refs = [collection]; refs[Symbol.iterator] = function* () { throw new Error('iterator'); };
  const bag = DiBag.createBuilder().withCollectionContribution({ collectionToken: collection, provider: () => 1 }).withServices({ list: DiBag.createProviderFromFunction({ dependencies: refs as [typeof refs[0]], factoryFunction: values => values }) }).buildContainer();
  expect(bag.resolve('list')).toEqual([1]); expect(effects).toBe(0); await bag.close();
  expect(() => bag.resolveCollection(collection)).toThrow(/closed|closing/);
});

test('cooperative lazy registries admit late collection reads only for their in-flight source', async () => {
  const key = Symbol('items'); const items = DiBag.createToken(key).forCollectionOf<number>();
  const registryKey = Symbol('registry'); const registry = DiBag.createToken(registryKey).forService<readonly number[]>();
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const disposed: string[] = []; let read!: () => readonly number[];
  const bag = DiBag.createBuilder().withCollectionContribution({ collectionToken: items, provider: DiBag.providerWithDisposal({ provider: () => 7, disposeService: () => { disposed.push('item'); } }) }).withTokenService(registry, DiBag.createProviderFromFunction({ dependencies: [items], factoryFunction: values => values })).withServices({ source: DiBag.providerWithDisposal({ provider: DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(registry)], factoryFunction: async get => {
      read = get; await gate; return get();
    } }), disposeService: () => { disposed.push('source'); } }), ready: DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(registry)], factoryFunction: get => get }) }).buildContainer();
  const pending = bag.resolve('source'); const ready = bag.resolve('ready'); const closing = bag.close();
  expect(ready).toThrow(/closing/); expect(read()).toEqual([7]);
  release(); expect(await pending).toEqual([7]); await closing;
  expect(disposed).toEqual(['source', 'item']); expect(read).toThrow(/closed/);
});

test('observed strict roots reject cached scoped contributions before owner routing', async () => {
  const key = Symbol('items'); const items = DiBag.createToken(key).forCollectionOf<number>();
  const root = DiBag.providerWithLifetime({ provider: DiBag.createProviderFromFunction({ dependencies: [items], factoryFunction: values => values }), lifetime: 'singleton:one-per-container-tree' });
  // An unchecked caller must still meet the observed lifetime boundary.
  const builder = DiBag.createBuilder().withCollectionContribution({ collectionToken: items, provider: () => 1 }).withServices({ root });
  const bag = (builder.buildContainer as Function).call(builder);
  expect(bag.resolveCollection(items)).toEqual([1]);
  expect(() => bag.resolve('root')).toThrow(/singleton lifetime cannot capture scoped/);
  const child = bag.createChildContainer(); expect(() => child.resolve('root')).toThrow(/singleton lifetime cannot capture scoped/);
  await bag.close();
});

test('startup failure rolls back accepted contribution ownership', async () => {
  const key = Symbol('items'); const items = DiBag.createToken(key).forCollectionOf<number>(); const disposed: number[] = [];
  const builder = DiBag.createBuilder().withCollectionContribution({ collectionToken: items, provider: DiBag.providerWithDisposal({ provider: () => 1, disposeService: value => { disposed.push(value); } }) }).withCollectionContribution({ collectionToken: items, provider: () => { throw new Error('failed contribution'); } }).withServices({ aggregate: DiBag.createProviderFromFunction({ dependencies: [items], factoryFunction: values => values }) });
  await expect(builder.buildContainer().ensureServicesReady(['aggregate'])).rejects.toThrow(); expect(disposed).toEqual([1]);
});
