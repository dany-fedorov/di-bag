import { expect, test } from 'bun:test';
import { DiBag } from '../src';
import { DiBag as Core } from '../src';
import { withoutBuiltinModule } from './host-builtin-module';

const portKey = Symbol('port');
const port = DiBag.createToken(portKey).forService<number>();

class Client {
  #port: number;
  readonly target: unknown;
  constructor(readonly port: number) { this.#port = port; this.target = new.target; }
  read() { return this.#port; }
}

test('class adapters construct lazily with private fields, inherited prototypes and new.target', async () => {
  let calls = 0;
  class Derived extends Client { constructor(value: number) { super(value); calls++; } }
  const source = DiBag.createProviderFromClass({ dependencies: [port], serviceClass: Derived });
  const bag = DiBag.createBuilder().withTokenService(port, DiBag.providerWithLifetime({ provider: () => 8080, lifetime: 'scoped:one-per-container' })).withServices({ source: DiBag.providerWithLifetime({ provider: source, lifetime: 'scoped:one-per-container' }) }).buildContainer();
  expect(calls).toBe(0);
  const client = bag.resolve('source');
  expect(client).toBeInstanceOf(Derived);
  expect(client).toBeInstanceOf(Client);
  expect(client.read()).toBe(8080);
  expect(client.target).toBe(Derived);
  expect(bag.resolve('source')).toBe(client);
  expect(calls).toBe(1);
  await bag.close();
});

test('constructor validation invokes neither the constructor nor its prototype getter', async () => {
  let calls = 0; let prototypeReads = 0;
  const original = new Proxy(class { constructor() { calls++; } }, {
    get(target, key, receiver) { if (key === 'prototype') prototypeReads++; return Reflect.get(target, key, receiver); },
  });
  const source = DiBag.createProviderFromClass({ dependencies: [], serviceClass: original });
  expect(calls).toBe(0); expect(prototypeReads).toBe(0);
  const bag = DiBag.createBuilder().withServices({ source: DiBag.providerWithLifetime({ provider: source, lifetime: 'scoped:one-per-container' }) }).buildContainer();
  bag.resolve('source');
  expect(calls).toBe(1); expect(prototypeReads).toBe(1);
  await bag.close();
});

test('function adapters pass positional values exactly and support explicitly bound receivers', async () => {
  const promiseKey = Symbol('promise'); const promised = DiBag.createToken(promiseKey).forService<Promise<number>>();
  const pending = Promise.resolve(9);
  const receiver = { prefix: 'port:', format(this: { prefix: string }, value: number) { return this.prefix + value; } };
  const bag = DiBag.createBuilder().withTokenService(port, DiBag.providerWithLifetime({ provider: () => 80, lifetime: 'scoped:one-per-container' })).withTokenService(promised, DiBag.providerWithLifetime({ provider: () => pending, lifetime: 'scoped:one-per-container' })).withServices({
    source: DiBag.providerWithLifetime({ provider: DiBag.createProviderFromFunction({ dependencies: [port, promised], factoryFunction: function (this: void, value, promise) { return { receiver: this, value, promise }; } }), lifetime: 'scoped:one-per-container' }),
    bound: DiBag.providerWithLifetime({ provider: DiBag.createProviderFromFunction({ dependencies: [port], factoryFunction: receiver.format.bind(receiver) }), lifetime: 'scoped:one-per-container' }),
    empty: DiBag.providerWithLifetime({ provider: DiBag.createProviderFromFunction({ dependencies: [], factoryFunction: () => 'empty' }), lifetime: 'scoped:one-per-container' }),
  }).buildContainer();
  expect(bag.resolve('source')).toEqual({ receiver: undefined, value: 80, promise: pending });
  expect(bag.resolve('source').promise).toBe(pending);
  expect(bag.resolve('bound')).toBe('port:80'); expect(bag.resolve('empty')).toBe('empty');
  await bag.close();
});

test('optional and rest function and constructor arguments follow selected positions', async () => {
  class Optional { constructor(readonly first = 7, readonly second?: number) {} }
  class Rest { constructor(readonly first: number, ...rest: number[]) { this.rest = rest; } readonly rest: number[]; }
  const bag = DiBag.createBuilder().withTokenService(port, DiBag.providerWithLifetime({ provider: () => 4, lifetime: 'scoped:one-per-container' })).withServices({
    optional: DiBag.providerWithLifetime({ provider: DiBag.createProviderFromClass({ dependencies: [], serviceClass: Optional }), lifetime: 'scoped:one-per-container' }), rest: DiBag.providerWithLifetime({ provider: DiBag.createProviderFromClass({ dependencies: [port, port, port], serviceClass: Rest }), lifetime: 'scoped:one-per-container' }),
    fn: DiBag.providerWithLifetime({ provider: DiBag.createProviderFromFunction({ dependencies: [port, port], factoryFunction: (first: number, ...rest: number[]) => first + rest.length }), lifetime: 'scoped:one-per-container' }),
    optionalFn: DiBag.providerWithLifetime({ provider: DiBag.createProviderFromFunction({ dependencies: [], factoryFunction: (value = 3) => value }), lifetime: 'scoped:one-per-container' }),
  }).buildContainer();
  expect(bag.resolve('optional')).toEqual({ first: 7, second: undefined });
  expect(bag.resolve('rest').rest).toEqual([4, 4]); expect(bag.resolve('fn')).toBe(5);
  expect(bag.resolve('optionalFn')).toBe(3); await bag.close();
});

for (const kind of ['function', 'class'] as const) {
  test(`${kind} adapters snapshot indexed tokens and ignore custom iterators`, async () => {
    const otherKey = Symbol('other'); const other = DiBag.createToken(otherKey).forService<number>();
    const tokens: [typeof port, typeof other] = [port, other];
    let reads = 0;
    Object.defineProperty(tokens, 0, { get() { reads++; return port; }, configurable: true });
    tokens[Symbol.iterator] = function* () { throw new Error('iterator must not run'); };
    const source = kind === 'function' ? DiBag.createProviderFromFunction({ dependencies: tokens, factoryFunction: (a, b) => ({ a, b }) })
      : DiBag.createProviderFromClass({ dependencies: tokens, serviceClass: class { constructor(readonly a: number, readonly b: number) {} } });
    Object.defineProperty(tokens, 0, { value: other }); tokens[1] = port as unknown as typeof other;
    const bag = DiBag.createBuilder().withTokenService(port, DiBag.providerWithLifetime({ provider: () => 1, lifetime: 'scoped:one-per-container' })).withTokenService(other, DiBag.providerWithLifetime({ provider: () => 2, lifetime: 'scoped:one-per-container' })).withServices({ source: DiBag.providerWithLifetime({ provider: source, lifetime: 'scoped:one-per-container' }) }).buildContainer();
    expect(bag.resolve('source')).toEqual({ a: 1, b: 2 }); expect(reads).toBe(1);
    await bag.close();
  });
  test(`${kind} adapters reject invalid declaration inputs before user effects`, () => {
    let calls = 0;
    const adapter = kind === 'function' ? DiBag.createProviderFromFunction : DiBag.createProviderFromClass;
    const callback = kind === 'function' ? () => { calls++; } : class { constructor() { calls++; } };
    const options = (dependencies: unknown, value: unknown, extra: object = {}) => kind === 'function'
      ? { dependencies, factoryFunction: value, ...extra }
      : { dependencies, serviceClass: value, ...extra };
    for (const tokens of [null, {}, [undefined], [{ ...port }], [new Proxy(port, {})]]) {
      expect(() => Reflect.apply(adapter, undefined, [options(tokens, callback)])).toThrow();
    }
    for (const invalid of [null, 1, options([], callback, { factoryReturnKind: 'invalid' })]) {
      expect(() => Reflect.apply(adapter, undefined, [invalid])).toThrow();
    }
    const hostile = Object.defineProperty([], 0, { get() { throw new Error('token getter'); } });
    expect(() => Reflect.apply(adapter, undefined, [options(hostile, callback)])).toThrow('token getter');
    for (const invalid of [null, {}, 1, ...(kind === 'class' ? [() => 1, async () => 1, function* () {}] : [])]) {
      expect(() => Reflect.apply(adapter, undefined, [options([], invalid)])).toThrow(kind === 'class' ? 'constructor' : 'function');
    }
    expect(calls).toBe(0);
  });
  test(`${kind} acquisition failures retry and disposal is explicit`, async () => {
    let calls = 0; let conventionalCleanup = 0; const disposed: unknown[] = [];
    class Resource {
      constructor() { if (++calls === 1) throw new Error('setup'); }
      close() { conventionalCleanup++; }
      dispose() { conventionalCleanup++; }
    }
    const source = kind === 'class' ? DiBag.createProviderFromClass({ dependencies: [], serviceClass: Resource }) : DiBag.createProviderFromFunction({ dependencies: [], factoryFunction: () => new Resource() });
    const bag = DiBag.createBuilder().withServices({ owned: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: source, disposeService: value => { disposed.push(value); } }), lifetime: 'scoped:one-per-container' }), plain: DiBag.providerWithLifetime({ provider: source, lifetime: 'scoped:one-per-container' }) }).buildContainer();
    expect(() => bag.resolve('owned')).toThrow('setup');
    const value = bag.resolve('owned'); expect(value).toBeInstanceOf(Resource);
    bag.resolve('plain'); await bag.close();
    expect(calls).toBe(3); expect(disposed).toEqual([value]); expect(conventionalCleanup).toBe(0);
  });
}

test('raw and native adapters retain Promise identity and select the disposal value', async () => {
  const value = { id: 1 }; const promise = Promise.resolve(value); const disposed: unknown[] = [];
  const bag = Core.createBuilder().withServices({
    raw: DiBag.providerWithLifetime({ provider: Core.providerWithDisposal({ provider: Core.createProviderFromFunction({ dependencies: [], factoryFunction: () => promise, factoryReturnKind: 'uninspected' }), disposeService: result => { disposed.push(result); } }), lifetime: 'scoped:one-per-container' }),
    native: DiBag.providerWithLifetime({ provider: Core.providerWithDisposal({ provider: Core.createProviderFromFunction({ dependencies: [], factoryFunction: () => promise, factoryReturnKind: 'native-promise' }), disposeService: result => { disposed.push(result); } }), lifetime: 'scoped:one-per-container' }),
  }).buildContainer();
  expect(bag.resolve('raw')).toBe(promise); expect(bag.resolve('native')).toBe(promise);
  await bag.close(); expect(disposed).toContain(promise); expect(disposed).toContain(value);
});

test('raw class adapters preserve thenables and auto rejects them without assimilation', async () => {
  let thenCalls = 0; const disposed: unknown[] = [];
  class Thenable { then() { thenCalls++; throw new Error('must not assimilate'); } }
  const bag = DiBag.createBuilder().withServices({
    raw: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: DiBag.createProviderFromClass({ dependencies: [], serviceClass: Thenable, factoryReturnKind: 'uninspected' }), disposeService: value => { disposed.push(value); } }), lifetime: 'scoped:one-per-container' }),
    // @ts-expect-error The runtime rejection of a structural thenable is what this test exercises.
    auto: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: DiBag.createProviderFromClass({ dependencies: [], serviceClass: Thenable }), disposeService: value => { disposed.push(value); } }), lifetime: 'scoped:one-per-container' }),
  }).buildContainer();
  const raw = bag.resolve('raw');
  expect(raw).toBeInstanceOf(Thenable); expect(() => bag.resolve('auto')).toThrow('Structural thenables');
  await bag.close(); expect(thenCalls).toBe(0); expect(disposed).toEqual([raw]);
});

test('automatic adapters require runtime classification before acquisition', () => {
  let calls = 0;
  expect(() => withoutBuiltinModule(() => Core.createBuilder().withServices({ source: DiBag.providerWithLifetime({ provider: Core.createProviderFromFunction({ dependencies: [], factoryFunction: () => { calls++; return 1; } }), lifetime: 'scoped:one-per-container' }) }).buildContainer())).toThrow('DI_BAG_CLASSIFIER_REQUIRED: this host has no process.getBuiltinModule');
  expect(() => withoutBuiltinModule(() => Core.createBuilder().withServices({ source: DiBag.providerWithLifetime({ provider: Core.createProviderFromClass({ dependencies: [], serviceClass: class { constructor() { calls++; } } }), lifetime: 'scoped:one-per-container' }) }).buildContainer())).toThrow('DI_BAG_CLASSIFIER_REQUIRED: this host has no process.getBuiltinModule');
  expect(calls).toBe(0);
});

test('module token graphs and selected sharing keep ownership and parent dependencies', async () => {
  const disposed: unknown[] = [];
  const feature = DiBag.createBuilder().withServices({ source: DiBag.providerWithLifetime({ provider: DiBag.providerWithDisposal({ provider: DiBag.createProviderFromClass({ dependencies: [port], serviceClass: Client }), disposeService: value => { disposed.push(value); } }), lifetime: 'scoped:one-per-container' }) }).buildModule({ exportedServiceKeys: ['source'] });
  const bag = DiBag.createBuilder().withTokenService(port, DiBag.providerWithLifetime({ provider: () => 80, lifetime: 'scoped:one-per-container' })).withInstalledModules([feature]).buildContainer();
  const child = bag.createChildContainer([port], { [portKey]: DiBag.providerWithLifetime({ provider: () => 90, lifetime: 'scoped:one-per-container' }) }, { sharedParentServiceKeys: ['source'] });
  const shared = child.resolve('source'); expect(shared.port).toBe(80); expect(shared).toBe(bag.resolve('source'));
  expect(child.resolve(port)).toBe(90); await child.close(); expect(disposed).toEqual([]);
  const fork = bag.createIndependentContainer([port], { [portKey]: DiBag.providerWithLifetime({ provider: () => 99, lifetime: 'scoped:one-per-container' }) }); expect(fork.resolve('source').port).toBe(99);
  await fork.close(); await bag.close(); expect(disposed).toHaveLength(2); expect(disposed).toContain(shared);
});

test('strict root class adapters retain root dependencies through child overrides', async () => {
  const bag = DiBag.createBuilder().withTokenService(port, DiBag.providerWithLifetime({ provider: () => 80, lifetime: 'singleton:one-per-container-tree' })).withServices({
    source: DiBag.providerWithLifetime({ provider: DiBag.createProviderFromClass({ dependencies: [port], serviceClass: Client }), lifetime: 'singleton:one-per-container-tree' }),
  }).buildContainer();
  const child = bag.createChildContainer();
  expect(child.resolve('source')).toBe(bag.resolve('source')); expect(child.resolve('source').port).toBe(80);
  const independent = bag.createIndependentContainer([port], { [portKey]: DiBag.providerWithLifetime({ provider: () => 90, lifetime: 'singleton:one-per-container-tree' }) });
  expect(independent.resolve('source').port).toBe(90);
  await independent.close();
  await bag.close();
});


test('native class acquisition preserves constructed promises and disposes their fulfilled value', async () => {
  const disposed: unknown[] = [];
  class Promised extends Promise<number> {
    static get [Symbol.species]() { return Promise; }
    constructor() { super(resolve => resolve(7)); }
  }
  const bag = Core.createBuilder().withServices({
    source: DiBag.providerWithLifetime({ provider: Core.providerWithDisposal({ provider: Core.createProviderFromClass({ dependencies: [], serviceClass: Promised, factoryReturnKind: 'native-promise' }), disposeService: value => { disposed.push(value); } }), lifetime: 'scoped:one-per-container' }),
    raw: DiBag.providerWithLifetime({ provider: Core.providerWithDisposal({ provider: Core.createProviderFromClass({ dependencies: [], serviceClass: Promised, factoryReturnKind: 'uninspected' }), disposeService: value => { disposed.push(value); } }), lifetime: 'scoped:one-per-container' }),
  }).buildContainer();
  const source = bag.resolve('source'); const raw = bag.resolve('raw');
  expect(source).toBeInstanceOf(Promised); expect(bag.resolve('source')).toBe(source);
  expect(raw).toBeInstanceOf(Promised); expect(await source).toBe(7);
  await bag.close(); expect(disposed).toContain(raw); expect(disposed).toContain(7);
});

test('rejected function acquisitions retry with the original Promise return', async () => {
  let calls = 0; let current: Promise<number> | undefined;
  const bag = DiBag.createBuilder().withServices({ source: DiBag.providerWithLifetime({ provider: DiBag.createProviderFromFunction({ dependencies: [], factoryFunction: () => {
    current = ++calls === 1 ? Promise.reject(new Error('retry')) : Promise.resolve(42); return current;
  } }), lifetime: 'scoped:one-per-container' }) }).buildContainer();
  const first = bag.resolve('source'); expect(current).toBe(first);
  await expect(first).rejects.toThrow('retry'); await Promise.resolve();
  const second = bag.resolve('source'); expect(current).toBe(second); expect(second).not.toBe(first);
  expect(await second).toBe(42); expect(calls).toBe(2); await bag.close();
});

test('constructor proxies retain their acquisition trap and original new.target', async () => {
  let traps = 0; let seen: unknown;
  const original = new Proxy(Client, { construct(target, args, newTarget) {
    traps++; seen = newTarget; return Reflect.construct(target, args, newTarget);
  } });
  const source = DiBag.createProviderFromClass({ dependencies: [port], serviceClass: original });
  expect(traps).toBe(0);
  const bag = DiBag.createBuilder().withTokenService(port, DiBag.providerWithLifetime({ provider: () => 80, lifetime: 'scoped:one-per-container' })).withServices({ source: DiBag.providerWithLifetime({ provider: source, lifetime: 'scoped:one-per-container' }) }).buildContainer();
  expect(bag.resolve('source').read()).toBe(80); expect(traps).toBe(1); expect(seen).toBe(original);
  expect(bag.resolve('source').target).toBe(original); await bag.close();
});
