import { expect, test } from 'bun:test';
import { DiBag } from '../src/node';
import { DiBag as Core } from '../src';

const key = Symbol('number');
const number = DiBag.token(key).of<number>();

test('optional absence is distinct from a present undefined acquisition', async () => {
  const optional = DiBag.fromFunction([DiBag.optional(number)], value => value);
  const absent = DiBag.createBuilder().register({ optional }).build();
  expect(absent.resolve('optional')).toBeUndefined();
  const present = DiBag.createBuilder().register(number, () => 17).register({ optional }).build();
  expect(present.resolve('optional')).toBe(17);
  const undefinedKey = Symbol('undefined'); const empty = DiBag.token(undefinedKey).of<undefined>();
  const disposed: string[] = [];
  const bag = DiBag.createBuilder().register(empty, DiBag.withDisposal(() => undefined, () => { disposed.push('target'); })).register({ optional: DiBag.withDisposal(DiBag.fromFunction([DiBag.optional(empty)], value => value), () => { disposed.push('consumer'); }) }).build();
  expect(bag.resolve('optional')).toBeUndefined();
  expect(bag.inspect(empty).acquisitions).toHaveLength(1);
  await bag.close(); expect(disposed).toEqual(['consumer', 'target']);
  await absent.close(); await present.close();
});

test('optional factory failures and native rejections propagate and retry', async () => {
  const failure = new Error('factory failure'); let calls = 0;
  const bag = DiBag.createBuilder().register(number, () => { if (++calls === 1) throw failure; return 9; }).register({ optional: DiBag.fromFunction([DiBag.optional(number)], value => value) }).build();
  expect(() => bag.resolve('optional')).toThrow(failure);
  expect(bag.resolve('optional')).toBe(9); expect(calls).toBe(2); await bag.close();
  const promiseKey = Symbol('promise'); const promise = DiBag.token(promiseKey).of<Promise<number>>();
  const rejection = new Error('native failure'); const rejected = Promise.reject<number>(rejection);
  const asyncBag = DiBag.createBuilder().register(promise, () => rejected).register({ optional: DiBag.fromFunction([DiBag.optional(promise)], value => ({ value })) }).build();
  expect(asyncBag.resolve('optional').value).toBe(rejected);
  await expect(rejected).rejects.toBe(rejection); await asyncBag.close();
});

for (const lifetime of ['scoped', 'root', 'transient'] as const) {
  test(`lazy ${lifetime} dependencies defer construction and retain invocation ownership`, async () => {
    const targetKey = Symbol('target'); const target = DiBag.token(targetKey).of<{ id: number }>();
    let calls = 0; const disposed: string[] = [];
    const lazy = DiBag.fromFunction([DiBag.lazy(target)], get => ({ get }));
    const owned = DiBag.withDisposal(() => ({ id: ++calls }), value => { disposed.push(`target:${value.id}`); });
    const registration = lifetime === 'root' ? DiBag.withLifetime(owned, 'root')
      : lifetime === 'transient' ? DiBag.withLifetime(owned, 'transient') : owned;
    const bag = DiBag.createBuilder().register(target, registration).register({ lazy: DiBag.withDisposal(lazy, () => { disposed.push('consumer'); }) }).build();
    const consumer = bag.resolve('lazy'); expect(calls).toBe(0);
    expect(bag.inspect(target).acquisitions).toHaveLength(0);
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
  for (const adapter of [DiBag.fromFunction, DiBag.fromFunction, DiBag.fromClass]) {
    const tuple: [typeof optional, typeof lazy, typeof number] = [optional, lazy, number];
    tuple[Symbol.iterator] = function* () { throw new Error('iterator'); };
    const callback = adapter === DiBag.fromClass ? class { constructor(readonly optional: number | undefined, readonly lazy: () => number, readonly direct: number) {} }
      : (optional: number | undefined, lazy: () => number, direct: number) => ({ optional, lazy, direct });
    const source = Reflect.apply(adapter, undefined, [tuple, callback]) as () => { optional: number | undefined; lazy: () => number; direct: number };
    tuple.reverse();
    const bag = DiBag.createBuilder().register(number, () => 23).register({ source }).build();
    const value = bag.resolve('source') as { optional: number | undefined; lazy: () => number; direct: number };
    expect(value.optional).toBe(23); expect(value.lazy()).toBe(23); expect(value.direct).toBe(23);
    await bag.close();
    for (const invalid of [{ ...optional }, { ...lazy }, new Proxy(optional, {}), new Proxy(lazy, {}), { kind: 'optional', token: number }]) {
      expect(() => Reflect.apply(adapter, undefined, [[invalid], callback])).toThrow();
    }
  }
  for (const wrapper of [DiBag.optional, DiBag.lazy]) {
    for (const invalid of [optional, lazy, { ...number }, new Proxy(number, {}), { key }, null]) {
      expect(() => Reflect.apply(wrapper, undefined, [invalid])).toThrow('token');
    }
  }
  expect(() => Reflect.apply(DiBag.createBuilder().register, DiBag.createBuilder(), [optional, () => 1])).toThrow('token');
  expect(() => Reflect.apply(DiBag.createBuilder().register, DiBag.createBuilder(), [{ invalid: lazy }])).toThrow('registration');
});

test('lazy reads preserve lexical private tokens, export renames and external optional absence', async () => {
  const feature = DiBag.createModuleBuilder().register(number, () => 3).register({
    client: DiBag.fromFunction([DiBag.optional(number), DiBag.lazy(number)], (value, get) => ({ value, get })),
    forwarding: ({ client }: { client: { value: number | undefined; get: () => number } }) => client,
  }).buildModule(['client', 'forwarding']).renameExport('client', 'renamed');
  const bag = DiBag.createBuilder().register(number, () => 100).installModule(feature).build();
  expect(bag.resolve('renamed').value).toBe(3); expect(bag.resolve('forwarding').get()).toBe(3);
  const external = DiBag.createModuleBuilder().register({ optional: DiBag.fromFunction([DiBag.optional(number)], value => value) }).buildModule(['optional']);
  const absent = DiBag.createBuilder().installModule(external).build(); expect(absent.resolve('optional')).toBeUndefined();
  await absent.close(); await bag.close();
});

test('lazy closures use shared/root owner context and independent fork overrides', async () => {
  const bag = DiBag.createBuilder().register(number, () => 1).register({ source: DiBag.fromFunction([DiBag.lazy(number)], get => ({ get })) }).build();
  const child = bag.createScope([number], { [key]: () => 2 }, { share: ['source'] });
  const shared = child.resolve('source'); expect(shared.get()).toBe(1); expect(child.resolve(number)).toBe(2);
  await child.close(); expect(shared.get()).toBe(1);
  const fork = bag.fork([number], { [key]: () => 3 }); expect(fork.resolve('source').get()).toBe(3);
  await fork.close(); await bag.close(); expect(shared.get).toThrow('closed');
  const root = DiBag.createBuilder().register(number, DiBag.withLifetime(() => 4, 'root')).register({
    source: DiBag.withLifetime(DiBag.fromFunction([DiBag.lazy(number)], get => ({ get })), 'root'),
  }).build();
  const scoped = root.createScope([number], { [key]: () => 5 }); expect(scoped.resolve('source').get()).toBe(4);
  await root.close();
});

test('raw and native references preserve Promise identity and disposal values', async () => {
  const promiseKey = Symbol('promise'); const target = Core.token(promiseKey).of<Promise<number>>();
  const promise = Promise.resolve(5); const disposed: unknown[] = [];
  const bag = Core.createBuilder().register(target, Core.withDisposal(Core.fromFactory(() => promise, { acquisitionMode: 'raw' }), value => { disposed.push(value); })).register({
      optional: Core.withDisposal(Core.fromFunction([Core.optional(target)], value => value, { acquisitionMode: 'raw' }), value => { disposed.push(value); }),
      lazy: Core.fromFunction([Core.lazy(target)], get => ({ get }), { acquisitionMode: 'raw' }),
      native: Core.withDisposal(Core.fromFunction([Core.lazy(target)], get => get(), { acquisitionMode: 'nativePromise' }), value => { disposed.push(value); }),
    }).build();
  expect(bag.resolve('optional')).toBe(promise); expect(bag.resolve('lazy').get()).toBe(promise); expect(bag.resolve('native')).toBe(promise);
  await bag.close(); expect(disposed.filter(value => value === promise)).toHaveLength(2); expect(disposed).toContain(5);
});

for (const reference of ['optional', 'lazy'] as const) {
  test(`${reference} synchronous and post-await cycles propagate`, async () => {
    const aKey = Symbol('a'); const a = DiBag.token(aKey).of<number>();
    const bKey = Symbol('b'); const b = DiBag.token(bKey).of<number>();
    const readA = reference === 'optional' ? DiBag.fromFunction([DiBag.optional(a)], value => value ?? 0)
      : DiBag.fromFunction([DiBag.lazy(a)], get => get());
    const bag = DiBag.createBuilder().register(a, DiBag.fromFunction([b], value => value)).register(b, readA).build();
    expect(() => bag.resolve(a)).toThrow('cycle'); await bag.close();
    const pKey = Symbol('p'); const p = DiBag.token(pKey).of<Promise<number>>();
    const qKey = Symbol('q'); const q = DiBag.token(qKey).of<Promise<number>>();
    const readP = reference === 'optional' ? DiBag.fromFunction([DiBag.optional(p)], async value => { await Promise.resolve(); return await value ?? 0; })
      : DiBag.fromFunction([DiBag.lazy(p)], async get => { await Promise.resolve(); return get(); });
    const asyncBag = DiBag.createBuilder().register(p, DiBag.fromFunction([DiBag.lazy(q)], async get => { await Promise.resolve(); return get(); })).register(q, readP).build();
    await expect(asyncBag.resolve(p)).rejects.toThrow('cycle'); await asyncBag.close();
  });
}

test('lazy closure shutdown admission belongs to the capturing source attempt', async () => {
  let release!: () => void; const barrier = new Promise<void>(resolve => { release = resolve; });
  let get!: () => number; let calls = 0;
  const bag = DiBag.createBuilder().register(number, () => ++calls).register({
    source: DiBag.fromFunction([DiBag.lazy(number)], async read => { get = read; await barrier; return read(); }),
  }).build();
  const pending = bag.resolve('source'); const closing = bag.close();
  expect(get()).toBe(1); release(); expect(await pending).toBe(1); await closing; expect(get).toThrow('closed');
  const ready = DiBag.createBuilder().register(number, () => 1).register({ source: DiBag.fromFunction([DiBag.lazy(number)], read => ({ read })) }).build();
  const read = ready.resolve('source').read; const readyClosing = ready.close(); expect(read).toThrow('closing'); await readyClosing;
  let retired!: () => number;
  const failed = DiBag.createBuilder().register(number, () => 8).register({ source: DiBag.fromFunction([DiBag.lazy(number)], read => { retired = read; throw new Error('retire'); }) }).build();
  expect(() => failed.resolve('source')).toThrow('retire'); expect(retired()).toBe(8);
  const failedClosing = failed.close(); expect(retired).toThrow('closing'); await failedClosing;
});

test('observed reference reads retain strict root checks before routing', async () => {
  const root = DiBag.withLifetime(DiBag.fromFunction([DiBag.lazy(number)], get => ({ get })), 'root');
  const builder = DiBag.createBuilder().register(number, () => 1).register({ root });
  const bag = Reflect.apply(builder.build, builder, []) as { resolve(key: string): { get(): number }; close(): Promise<void> };
  expect(bag.resolve('root').get).toThrow('root lifetime'); await bag.close();
});

test('lazy reads detect a cycle between already ready consumers', async () => {
  const aKey = Symbol('a'); const a = DiBag.token(aKey).of<{ get(): unknown }>();
  const bKey = Symbol('b'); const b = DiBag.token(bKey).of<{ get(): unknown }>();
  const bag = DiBag.createBuilder().register(a, DiBag.fromFunction([DiBag.lazy(b)], get => ({ get }))).register(b, DiBag.fromFunction([DiBag.lazy(a)], get => ({ get }))).build();
  const first = bag.resolve(a); const second = bag.resolve(b);
  expect(first.get()).toBe(second); expect(second.get).toThrow('cycle'); await bag.close();
});

test('a pending projection does not extend a lazy source shutdown admission', async () => {
  let release!: () => void; const barrier = new Promise<void>(resolve => { release = resolve; });
  let get!: () => number; let calls = 0;
  const source = DiBag.fromFunction([DiBag.lazy(number)], read => { get = read; return { read }; });
  const bag = DiBag.createBuilder().register(number, () => ++calls).register({ source: DiBag.transformService(source, { mode: 'awaited', transform: async value => { await barrier; return value; } }) }).build();
  const pending = bag.resolve('source'); const closing = bag.close();
  expect(get).toThrow('closing'); expect(calls).toBe(0); release(); await pending; await closing;
});

test('root explicit capture and optional reads retain the root lexical context', async () => {
  const source = DiBag.withLifetime(DiBag.fromFunction([DiBag.optional(number), DiBag.lazy(number)], (value, get) => ({ value, get })), 'root', { allowScopedDependencies: true });
  const bag = DiBag.createBuilder().register(number, () => 6).register({ source }).build();
  const child = bag.createScope([number], { [key]: () => 7 });
  expect(child.resolve('source').value).toBe(6); expect(child.resolve('source').get()).toBe(6); await bag.close();
  const strict = DiBag.withLifetime(DiBag.fromFunction([DiBag.optional(number)], value => value), 'root');
  const builder = DiBag.createBuilder().register(number, () => 1).register({ strict });
  const unchecked = Reflect.apply(builder.build, builder, []) as { resolve(key: string): unknown; close(): Promise<void> };
  expect(() => unchecked.resolve('strict')).toThrow('root lifetime'); await unchecked.close();
});
