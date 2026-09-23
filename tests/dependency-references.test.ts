import { expect, test } from 'bun:test';
import { DiBag } from '../src';
import { DiBag as Core } from '../src';

const key = Symbol('number');
const number = DiBag.createToken(key).forService<number>();

test('optional absence is distinct from a present undefined acquisition', async () => {
  const optional = DiBag.createProviderFromFunction({ dependencies: [DiBag.optional(number)], factoryFunction: value => value });
  const absent = DiBag.createBuilder().withServices({ optional }).buildContainer();
  expect(absent.resolve('optional')).toBeUndefined();
  const present = DiBag.createBuilder().withTokenService(number, () => 17).withServices({ optional }).buildContainer();
  expect(present.resolve('optional')).toBe(17);
  const undefinedKey = Symbol('undefined'); const empty = DiBag.createToken(undefinedKey).forService<undefined>();
  const disposed: string[] = [];
  const bag = DiBag.createBuilder().withTokenService(empty, DiBag.withDisposal(() => undefined, () => { disposed.push('target'); })).withServices({ optional: DiBag.withDisposal(DiBag.createProviderFromFunction({ dependencies: [DiBag.optional(empty)], factoryFunction: value => value }), () => { disposed.push('consumer'); }) }).buildContainer();
  expect(bag.resolve('optional')).toBeUndefined();
  expect(bag.serviceSnapshot(empty).acquisitions).toHaveLength(1);
  await bag.close(); expect(disposed).toEqual(['consumer', 'target']);
  await absent.close(); await present.close();
});

test('optional factory failures and native rejections propagate and retry', async () => {
  const failure = new Error('factory failure'); let calls = 0;
  const bag = DiBag.createBuilder().withTokenService(number, () => { if (++calls === 1) throw failure; return 9; }).withServices({ optional: DiBag.createProviderFromFunction({ dependencies: [DiBag.optional(number)], factoryFunction: value => value }) }).buildContainer();
  expect(() => bag.resolve('optional')).toThrow(failure);
  expect(bag.resolve('optional')).toBe(9); expect(calls).toBe(2); await bag.close();
  const promiseKey = Symbol('promise'); const promise = DiBag.createToken(promiseKey).forService<Promise<number>>();
  const rejection = new Error('native failure'); const rejected = Promise.reject<number>(rejection);
  const asyncBag = DiBag.createBuilder().withTokenService(promise, () => rejected).withServices({ optional: DiBag.createProviderFromFunction({ dependencies: [DiBag.optional(promise)], factoryFunction: value => ({ value }) }) }).buildContainer();
  expect(asyncBag.resolve('optional').value).toBe(rejected);
  await expect(rejected).rejects.toBe(rejection); await asyncBag.close();
});

for (const lifetime of ['scoped', 'root', 'transient'] as const) {
  test(`lazy ${lifetime} dependencies defer construction and retain invocation ownership`, async () => {
    const targetKey = Symbol('target'); const target = DiBag.createToken(targetKey).forService<{ id: number }>();
    let calls = 0; const disposed: string[] = [];
    const lazy = DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(target)], factoryFunction: get => ({ get }) });
    const owned = DiBag.withDisposal(() => ({ id: ++calls }), value => { disposed.push(`target:${value.id}`); });
    const registration = lifetime === 'root' ? DiBag.withLifetime(owned, 'root')
      : lifetime === 'transient' ? DiBag.withLifetime(owned, 'transient') : owned;
    const bag = DiBag.createBuilder().withTokenService(target, registration).withServices({ lazy: DiBag.withDisposal(lazy, () => { disposed.push('consumer'); }) }).buildContainer();
    const consumer = bag.resolve('lazy'); expect(calls).toBe(0);
    expect(bag.serviceSnapshot(target).acquisitions).toHaveLength(0);
    const first = consumer.get(); const second = consumer.get();
    expect(first).toEqual({ id: 1 });
    if (lifetime === 'transient') { expect(second).toEqual({ id: 2 }); expect(second).not.toBe(first); }
    else { expect(second).toBe(first); }
    await bag.close();
    expect(disposed).toEqual(lifetime === 'transient' ? ['consumer', 'target:2', 'target:1'] : ['consumer', 'target:1']);
    expect(consumer.get).toThrow('closed');
  });
}

test('all adapters snapshot mixed references by index and authenticate every handle', async () => {
  const optional = DiBag.optional(number); const lazy = DiBag.lazy(number);
  expect(Object.isFrozen(optional)).toBe(true); expect(Object.isFrozen(lazy)).toBe(true);
  for (const adapter of [DiBag.createProviderFromFunction, DiBag.createProviderFromFunction, DiBag.createProviderFromClass]) {
    const tuple: [typeof optional, typeof lazy, typeof number] = [optional, lazy, number];
    tuple[Symbol.iterator] = function* () { throw new Error('iterator'); };
    const callback = adapter === DiBag.createProviderFromClass ? class { constructor(readonly optional: number | undefined, readonly lazy: () => number, readonly direct: number) {} }
      : (optional: number | undefined, lazy: () => number, direct: number) => ({ optional, lazy, direct });
    const source = Reflect.apply(adapter, undefined, [adapter === DiBag.createProviderFromClass
      ? { dependencies: tuple, serviceClass: callback }
      : { dependencies: tuple, factoryFunction: callback }]) as () => { optional: number | undefined; lazy: () => number; direct: number };
    tuple.reverse();
    const bag = DiBag.createBuilder().withTokenService(number, () => 23).withServices({ source }).buildContainer();
    const value = bag.resolve('source') as { optional: number | undefined; lazy: () => number; direct: number };
    expect(value.optional).toBe(23); expect(value.lazy()).toBe(23); expect(value.direct).toBe(23);
    await bag.close();
    for (const invalid of [{ ...optional }, { ...lazy }, new Proxy(optional, {}), new Proxy(lazy, {}), { kind: 'optional', token: number }]) {
      expect(() => Reflect.apply(adapter, undefined, [adapter === DiBag.createProviderFromClass
        ? { dependencies: [invalid], serviceClass: callback }
        : { dependencies: [invalid], factoryFunction: callback }])).toThrow();
    }
  }
  for (const wrapper of [DiBag.optional, DiBag.lazy]) {
    for (const invalid of [optional, lazy, { ...number }, new Proxy(number, {}), { key }, null]) {
      expect(() => Reflect.apply(wrapper, undefined, [invalid])).toThrow('token');
    }
  }
  expect(() => Reflect.apply(DiBag.createBuilder().withTokenService, DiBag.createBuilder(), [optional, () => 1])).toThrow('token');
  expect(() => Reflect.apply(DiBag.createBuilder().withServices, DiBag.createBuilder(), [{ invalid: lazy }])).toThrow('registration');
});

test('lazy reads preserve lexical private tokens, export renames and external optional absence', async () => {
  const feature = DiBag.createBuilder().withTokenService(number, () => 3).withServices({
    client: DiBag.createProviderFromFunction({ dependencies: [DiBag.optional(number), DiBag.lazy(number)], factoryFunction: (value, get) => ({ value, get }) }),
    forwarding: ({ client }: { client: { value: number | undefined; get: () => number } }) => client,
  }).buildModule({ exportedServiceKeys: ['client', 'forwarding'] }).withRenamedExport({ currentExportKey: 'client', newExportKey: 'renamed' });
  const bag = DiBag.createBuilder().withTokenService(number, () => 100).withInstalledModules([feature]).buildContainer();
  expect(bag.resolve('renamed').value).toBe(3); expect(bag.resolve('forwarding').get()).toBe(3);
  const external = DiBag.createBuilder().withServices({ optional: DiBag.createProviderFromFunction({ dependencies: [DiBag.optional(number)], factoryFunction: value => value }) }).buildModule({ exportedServiceKeys: ['optional'] });
  const absent = DiBag.createBuilder().withInstalledModules([external]).buildContainer(); expect(absent.resolve('optional')).toBeUndefined();
  await absent.close(); await bag.close();
});

test('lazy closures use shared/root owner context and independent fork overrides', async () => {
  const bag = DiBag.createBuilder().withTokenService(number, () => 1).withServices({ source: DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(number)], factoryFunction: get => ({ get }) }) }).buildContainer();
  const child = bag.createChildContainer([number], { [key]: () => 2 }, { sharedParentServiceKeys: ['source'] });
  const shared = child.resolve('source'); expect(shared.get()).toBe(1); expect(child.resolve(number)).toBe(2);
  await child.close(); expect(shared.get()).toBe(1);
  const fork = bag.createIndependentContainer([number], { [key]: () => 3 }); expect(fork.resolve('source').get()).toBe(3);
  await fork.close(); await bag.close(); expect(shared.get).toThrow('closed');
  const root = DiBag.createBuilder().withTokenService(number, DiBag.withLifetime(() => 4, 'root')).withServices({
    source: DiBag.withLifetime(DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(number)], factoryFunction: get => ({ get }) }), 'root'),
  }).buildContainer();
  const scoped = root.createChildContainer([number], { [key]: () => 5 }); expect(scoped.resolve('source').get()).toBe(4);
  await root.close();
});

test('raw and native references preserve Promise identity and disposal values', async () => {
  const promiseKey = Symbol('promise'); const target = Core.createToken(promiseKey).forService<Promise<number>>();
  const promise = Promise.resolve(5); const disposed: unknown[] = [];
  const bag = Core.createBuilder().withTokenService(target, Core.withDisposal(Core.createProvider(() => promise, { factoryReturnKind: 'uninspected' }), value => { disposed.push(value); })).withServices({
      optional: Core.withDisposal(Core.createProviderFromFunction({ dependencies: [Core.optional(target)], factoryFunction: value => value, factoryReturnKind: 'uninspected' }), value => { disposed.push(value); }),
      lazy: Core.createProviderFromFunction({ dependencies: [Core.lazy(target)], factoryFunction: get => ({ get }), factoryReturnKind: 'uninspected' }),
      native: Core.withDisposal(Core.createProviderFromFunction({ dependencies: [Core.lazy(target)], factoryFunction: get => get(), factoryReturnKind: 'native-promise' }), value => { disposed.push(value); }),
    }).buildContainer();
  expect(bag.resolve('optional')).toBe(promise); expect(bag.resolve('lazy').get()).toBe(promise); expect(bag.resolve('native')).toBe(promise);
  await bag.close(); expect(disposed.filter(value => value === promise)).toHaveLength(2); expect(disposed).toContain(5);
});

for (const reference of ['optional', 'lazy'] as const) {
  test(`${reference} synchronous and post-await cycles propagate`, async () => {
    const aKey = Symbol('a'); const a = DiBag.createToken(aKey).forService<number>();
    const bKey = Symbol('b'); const b = DiBag.createToken(bKey).forService<number>();
    const readA = reference === 'optional' ? DiBag.createProviderFromFunction({ dependencies: [DiBag.optional(a)], factoryFunction: value => value ?? 0 })
      : DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(a)], factoryFunction: get => get() });
    const bag = DiBag.createBuilder().withTokenService(a, DiBag.createProviderFromFunction({ dependencies: [b], factoryFunction: value => value })).withTokenService(b, readA).buildContainer();
    expect(() => bag.resolve(a)).toThrow('cycle'); await bag.close();
    const pKey = Symbol('p'); const p = DiBag.createToken(pKey).forService<Promise<number>>();
    const qKey = Symbol('q'); const q = DiBag.createToken(qKey).forService<Promise<number>>();
    const readP = reference === 'optional' ? DiBag.createProviderFromFunction({ dependencies: [DiBag.optional(p)], factoryFunction: async value => { await Promise.resolve(); return await value ?? 0; } })
      : DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(p)], factoryFunction: async get => { await Promise.resolve(); return get(); } });
    const asyncBag = DiBag.createBuilder().withTokenService(p, DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(q)], factoryFunction: async get => { await Promise.resolve(); return get(); } })).withTokenService(q, readP).buildContainer();
    await expect(asyncBag.resolve(p)).rejects.toThrow('cycle'); await asyncBag.close();
  });
}

test('lazy closure shutdown admission belongs to the capturing source attempt', async () => {
  let release!: () => void; const barrier = new Promise<void>(resolve => { release = resolve; });
  let get!: () => number; let calls = 0;
  const bag = DiBag.createBuilder().withTokenService(number, () => ++calls).withServices({
    source: DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(number)], factoryFunction: async read => { get = read; await barrier; return read(); } }),
  }).buildContainer();
  const pending = bag.resolve('source'); const closing = bag.close();
  expect(get()).toBe(1); release(); expect(await pending).toBe(1); await closing; expect(get).toThrow('closed');
  const ready = DiBag.createBuilder().withTokenService(number, () => 1).withServices({ source: DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(number)], factoryFunction: read => ({ read }) }) }).buildContainer();
  const read = ready.resolve('source').read; const readyClosing = ready.close(); expect(read).toThrow('closing'); await readyClosing;
  let retired!: () => number;
  const failed = DiBag.createBuilder().withTokenService(number, () => 8).withServices({ source: DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(number)], factoryFunction: read => { retired = read; throw new Error('retire'); } }) }).buildContainer();
  expect(() => failed.resolve('source')).toThrow('retire'); expect(retired()).toBe(8);
  const failedClosing = failed.close(); expect(retired).toThrow('closing'); await failedClosing;
});

test('observed reference reads retain strict root checks before routing', async () => {
  const root = DiBag.withLifetime(DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(number)], factoryFunction: get => ({ get }) }), 'root');
  const builder = DiBag.createBuilder().withTokenService(number, () => 1).withServices({ root });
  const bag = Reflect.apply(builder.buildContainer, builder, []) as { resolve(key: string): { get(): number }; close(): Promise<void> };
  expect(bag.resolve('root').get).toThrow('root lifetime'); await bag.close();
});

test('lazy reads detect a cycle between already ready consumers', async () => {
  const aKey = Symbol('a'); const a = DiBag.createToken(aKey).forService<{ get(): unknown }>();
  const bKey = Symbol('b'); const b = DiBag.createToken(bKey).forService<{ get(): unknown }>();
  const bag = DiBag.createBuilder().withTokenService(a, DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(b)], factoryFunction: get => ({ get }) })).withTokenService(b, DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(a)], factoryFunction: get => ({ get }) })).buildContainer();
  const first = bag.resolve(a); const second = bag.resolve(b);
  expect(first.get()).toBe(second); expect(second.get).toThrow('cycle'); await bag.close();
});

test('a pending projection does not extend a lazy source shutdown admission', async () => {
  let release!: () => void; const barrier = new Promise<void>(resolve => { release = resolve; });
  let get!: () => number; let calls = 0;
  const source = DiBag.createProviderFromFunction({ dependencies: [DiBag.lazy(number)], factoryFunction: read => { get = read; return { read }; } });
  const bag = DiBag.createBuilder().withTokenService(number, () => ++calls).withServices({ source: DiBag.transformService(source, { mode: 'awaited', transform: async value => { await barrier; return value; } }) }).buildContainer();
  const pending = bag.resolve('source'); const closing = bag.close();
  expect(get).toThrow('closing'); expect(calls).toBe(0); release(); await pending; await closing;
});

test('root explicit capture and optional reads retain the root lexical context', async () => {
  const source = DiBag.withLifetime(DiBag.createProviderFromFunction({ dependencies: [DiBag.optional(number), DiBag.lazy(number)], factoryFunction: (value, get) => ({ value, get }) }), 'root', { allowScopedDependencies: true });
  const bag = DiBag.createBuilder().withTokenService(number, () => 6).withServices({ source }).buildContainer();
  const child = bag.createChildContainer([number], { [key]: () => 7 });
  expect(child.resolve('source').value).toBe(6); expect(child.resolve('source').get()).toBe(6); await bag.close();
  const strict = DiBag.withLifetime(DiBag.createProviderFromFunction({ dependencies: [DiBag.optional(number)], factoryFunction: value => value }), 'root');
  const builder = DiBag.createBuilder().withTokenService(number, () => 1).withServices({ strict });
  const unchecked = Reflect.apply(builder.buildContainer, builder, []) as { resolve(key: string): unknown; close(): Promise<void> };
  expect(() => unchecked.resolve('strict')).toThrow('root lifetime'); await unchecked.close();
});
